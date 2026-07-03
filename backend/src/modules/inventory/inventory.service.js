const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { onEvent, emitEvent } = require('../../common/eventBus');
const { logger } = require('../../common/logger');
const { generateBatchesFromGrn } = require('./batch.service');

// Module 3: Inventory Integration — GRN receipt increases stock (event-driven
// off GRN_COMPLETED, same decoupling pattern as Module 2's payment
// scheduling); a separate consumption endpoint decreases it and triggers an
// auto-draft PR when the result drops below the item's reorder level.

async function getDefaultWarehouseId(conn) {
  const c = conn || pool;
  const [[wh]] = await c.query("SELECT id FROM warehouses WHERE warehouse_code = 'DEFAULT'");
  return wh?.id || null;
}

async function upsertStock(warehouseId, itemMasterId, deltaQty, conn) {
  const c = conn || pool;
  const [existing] = await c.query('SELECT id, quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?', [warehouseId, itemMasterId]);
  if (existing.length === 0) {
    await c.query(
      'INSERT INTO inventory_stock (id, warehouse_id, item_master_id, quantity_on_hand) VALUES (?, ?, ?, ?)',
      [uuidv4(), warehouseId, itemMasterId, Math.max(0, deltaQty)]
    );
    return Math.max(0, deltaQty);
  }
  const newQty = Math.max(0, Number(existing[0].quantity_on_hand) + deltaQty);
  await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [newQty, existing[0].id]);
  return newQty;
}

// GRN_COMPLETED handler — walks each accepted GRN line back to its item
// master and adds the accepted quantity to stock. Resolution chain:
// 1. grn_line_items.po_line_id -> po_line_items.pr_line_item_id -> pr_line_items.item_master_id
// 2. Fallback: match po_line_items.description against item_master.item_description
// Lines with no item master link are skipped (not an error).
async function receiveStockFromGrn(payload, conn) {
  const c = conn || pool;
  const [grnLines] = await c.query(
    `SELECT gl.accepted_quantity, gl.po_line_id,
            pli.item_master_id as pr_item_master_id,
            poli.description as po_description
     FROM grn_line_items gl
     LEFT JOIN po_line_items poli ON gl.po_line_id = poli.id
     LEFT JOIN pr_line_items pli ON poli.pr_line_item_id = pli.id
     WHERE gl.grn_id = ?`,
    [payload.record_id]
  );
  const warehouseId = await getDefaultWarehouseId(c);
  if (!warehouseId) return;

  for (const line of grnLines) {
    if (Number(line.accepted_quantity) <= 0) continue;

    let itemMasterId = line.pr_item_master_id;

    // Fallback: try matching by description if PR chain doesn't resolve
    if (!itemMasterId && line.po_description) {
      const [[match]] = await c.query(
        'SELECT id FROM item_master WHERE item_description = ? AND is_active = TRUE LIMIT 1',
        [line.po_description]
      );
      if (match) itemMasterId = match.id;
    }

    if (!itemMasterId) continue; // no item master link — skip

    await upsertStock(warehouseId, itemMasterId, Number(line.accepted_quantity), c);
    await c.query(
      'INSERT INTO stock_movements (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), warehouseId, itemMasterId, 'in', line.accepted_quantity, 'grn', payload.record_id]
    );
  }
}

function registerInventoryEventSubscribers() {
  onEvent('GRN_COMPLETED', 'receiveStockFromGrn', (payload) => receiveStockFromGrn(payload));
  onEvent('GRN_COMPLETED', 'generateBatchesFromGrn', (payload) => {
    generateBatchesFromGrn(payload).catch((err) => {
      logger.warn('Batch generation from GRN failed (non-blocking)', {
        grnId: payload.record_id,
        error: err.message,
      });
    });
  });
}

// Manual stock-out — issuing material to a department/project/manufacturing
// order. Triggers an auto-draft PR the moment the resulting balance drops
// below the item's configured reorder_level, deduped so repeated consumption
// while already-below-threshold doesn't spam a new draft every call.
async function consumeStock(warehouseId, itemMasterId, quantity, reference, actorId, conn) {
  const c = conn || pool;
  if (!warehouseId || !itemMasterId || !quantity || quantity <= 0) {
    throw new ValidationError('Missing required fields', ['warehouse_id', 'item_master_id', 'quantity']);
  }
  const [[stock]] = await c.query('SELECT * FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?', [warehouseId, itemMasterId]);
  if (!stock) throw new NotFoundError('No stock record for this item in this warehouse');
  if (Number(stock.quantity_on_hand) < quantity) {
    throw new ValidationError(`Insufficient stock — on hand ${stock.quantity_on_hand}, requested ${quantity}`);
  }

  const newQty = Number(stock.quantity_on_hand) - quantity;
  await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [newQty, stock.id]);
  await c.query(
    'INSERT INTO stock_movements (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), warehouseId, itemMasterId, 'out', quantity, 'consumption', reference || null, actorId || null]
  );

  let autoPr = null;
  if (newQty < Number(stock.reorder_level)) {
    autoPr = await maybeCreateReorderDraftPr(itemMasterId, stock.reorder_quantity, actorId, c);
  }
  return { quantity_on_hand: newQty, reorder_triggered: !!autoPr, draft_pr: autoPr };
}

async function maybeCreateReorderDraftPr(itemMasterId, reorderQuantity, actorId, conn) {
  const c = conn || pool;
  // Dedup: skip if a draft reorder PR for this item was already auto-created
  // and hasn't been actioned yet, rather than creating one on every single
  // consumption call while stock stays under the threshold.
  const [existingDraft] = await c.query(
    `SELECT pr.id FROM purchase_requisitions pr
     JOIN pr_line_items pli ON pli.pr_id = pr.id
     WHERE pli.item_master_id = ? AND pr.status = 'draft' AND pr.justification LIKE 'Auto-generated: stock below reorder level%'`,
    [itemMasterId]
  );
  if (existingDraft.length > 0) return null;

  const [[item]] = await c.query('SELECT * FROM item_master WHERE id = ?', [itemMasterId]);
  if (!item) return null;

  const prId = uuidv4();
  const [[{ maxNum }]] = await c.query("SELECT MAX(CAST(SUBSTRING(pr_number, 4) AS UNSIGNED)) as maxNum FROM purchase_requisitions WHERE pr_number LIKE 'PR-%' AND pr_number REGEXP '^PR-[0-9]+$'");
  const prNumber = `PR-${String((maxNum || 0) + 1).padStart(6, '0')}`;
  const qty = Number(reorderQuantity) > 0 ? Number(reorderQuantity) : 1;
  const estimatedTotal = qty * Number(item.standard_cost || 0);

  // Deliberately a minimal direct insert, left in 'draft' status — this is a
  // placeholder for procurement to review and submit through the normal
  // PR submit flow (budget check, approval routing, etc.), not a duplicate
  // of that flow itself.
  await c.query(
    `INSERT INTO purchase_requisitions (id, pr_number, document_type, department, requester_id, currency, priority, justification, sourcing_strategy, total_value, status)
     VALUES (?, ?, 'Standard', 'Inventory', ?, ?, 'high', ?, 'RFQ_REQUIRED', ?, 'draft')`,
    [prId, prNumber, actorId || null, item.currency || 'INR', `Auto-generated: stock below reorder level for ${item.item_code}`, estimatedTotal]
  );
  await c.query(
    `INSERT INTO pr_line_items (id, pr_id, sequence, item_master_id, description, quantity, uom, estimated_unit_price, estimated_total_price)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), prId, itemMasterId, item.item_description, qty, item.uom, item.standard_cost || 0, estimatedTotal]
  );

  await emitEvent('REORDER_PR_CREATED', { module_name: 'inventory', record_id: prId, pr_number: prNumber, item_master_id: itemMasterId }, c);
  return { id: prId, pr_number: prNumber };
}

module.exports = {
  registerInventoryEventSubscribers,
  receiveStockFromGrn,
  consumeStock,
  maybeCreateReorderDraftPr,
  getDefaultWarehouseId,
};
