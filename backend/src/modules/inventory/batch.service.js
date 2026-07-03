const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { logger } = require('../../common/logger');

/**
 * Generates a unique batch number in the format: {ItemCode}-{LocationCode}-{YYYYMMDD}-{Seq}
 * Seq is a 3-digit zero-padded sequence number, unique per item+location+date combination.
 * Retries on collision up to 10 times.
 */
async function generateBatchNumber(itemCode, locationCode, date, conn) {
  const c = conn || pool;
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${itemCode}-${locationCode}-${dateStr}-`;

  const MAX_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Find the current max sequence for this prefix
    const [[result]] = await c.query(
      'SELECT batch_number FROM inventory_batches WHERE batch_number LIKE ? ORDER BY batch_number DESC LIMIT 1',
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (result) {
      const parts = result.batch_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      nextSeq = lastSeq + 1 + attempt; // offset by attempt to handle collisions
    } else {
      nextSeq = 1 + attempt;
    }

    const batchNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    // Check for collision
    const [[existing]] = await c.query(
      'SELECT id FROM inventory_batches WHERE batch_number = ?',
      [batchNumber]
    );

    if (!existing) {
      return batchNumber;
    }

    logger.warn('Batch number collision, retrying', { batchNumber, attempt: attempt + 1 });
  }

  throw new ValidationError(`Failed to generate unique batch number after ${MAX_RETRIES} retries for ${prefix}`);
}

/**
 * Event handler for GRN_COMPLETED. Creates one batch record per accepted GRN line item.
 * For each GRN line:
 *   - Resolves item_master_id from PO line → PR line chain, or fallback by description
 *   - Resolves location (warehouse) from GRN data or uses default warehouse
 *   - Generates batch number
 *   - INSERTs into inventory_batches
 *   - INSERTs stock_movement with movement_type='batch_in'
 *   - Updates inventory_stock (upsert: add quantity)
 */
async function generateBatchesFromGrn(grnPayload, conn) {
  const c = conn || pool;
  const grnId = grnPayload.record_id;

  // Fetch GRN line items with PO line linkage
  const [grnLines] = await c.query(
    `SELECT gl.id AS grn_line_item_id,
            gl.accepted_quantity,
            gl.po_line_id,
            poli.item_master_id AS po_item_master_id,
            poli.unit_price AS po_unit_price,
            poli.description AS po_description,
            pli.item_master_id AS pr_item_master_id
     FROM grn_line_items gl
     LEFT JOIN po_line_items poli ON gl.po_line_id = poli.id
     LEFT JOIN pr_line_items pli ON poli.pr_line_item_id = pli.id
     WHERE gl.grn_id = ?`,
    [grnId]
  );

  if (!grnLines || grnLines.length === 0) {
    logger.warn('No GRN line items found for batch generation', { grnId });
    return [];
  }

  // Resolve warehouse/location — try GRN's warehouse_id first, else default
  let warehouseId = grnPayload.warehouse_id || null;
  if (!warehouseId) {
    // Try to get warehouse from the GRN record itself
    const [[grn]] = await c.query(
      'SELECT warehouse_id FROM goods_receipt_notes WHERE id = ?',
      [grnId]
    );
    warehouseId = grn?.warehouse_id || null;
  }

  if (!warehouseId) {
    // Fallback: use default warehouse
    const [[defaultWh]] = await c.query(
      "SELECT id FROM warehouses WHERE warehouse_code = 'DEFAULT' LIMIT 1"
    );
    warehouseId = defaultWh?.id || null;
  }

  if (!warehouseId) {
    throw new ValidationError('No warehouse found for batch generation. Configure a DEFAULT warehouse.');
  }

  // Get warehouse code for batch number generation
  const [[warehouse]] = await c.query(
    'SELECT warehouse_code FROM warehouses WHERE id = ?',
    [warehouseId]
  );
  const warehouseCode = warehouse?.warehouse_code || 'DEFAULT';

  const createdBatches = [];

  for (const line of grnLines) {
    if (Number(line.accepted_quantity) <= 0) continue;

    // Resolve item_master_id: PR chain → PO item_master_id → fallback by description
    let itemMasterId = line.pr_item_master_id || line.po_item_master_id;

    if (!itemMasterId && line.po_description) {
      const [[match]] = await c.query(
        'SELECT id FROM item_master WHERE item_description = ? AND is_active = TRUE LIMIT 1',
        [line.po_description]
      );
      if (match) itemMasterId = match.id;
    }

    if (!itemMasterId) {
      logger.warn('Skipping batch creation - no item_master_id resolved', {
        grnId,
        grnLineItemId: line.grn_line_item_id,
      });
      continue;
    }

    // Get item_code from item_master
    const [[item]] = await c.query(
      'SELECT item_code FROM item_master WHERE id = ?',
      [itemMasterId]
    );

    if (!item) {
      logger.warn('Skipping batch creation - item_master not found', { itemMasterId });
      continue;
    }

    const itemCode = item.item_code;
    const rate = line.po_unit_price != null ? Number(line.po_unit_price) : 0;
    const qtyReceived = Number(line.accepted_quantity);

    // Generate batch number
    const batchNumber = await generateBatchNumber(itemCode, warehouseCode, new Date(), c);

    const batchId = uuidv4();

    // INSERT into inventory_batches
    await c.query(
      `INSERT INTO inventory_batches 
       (id, batch_number, item_master_id, grn_id, grn_line_item_id, location_id, qty_received, qty_available, rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [batchId, batchNumber, itemMasterId, grnId, line.grn_line_item_id, warehouseId, qtyReceived, qtyReceived, rate]
    );

    // INSERT stock_movement with movement_type='batch_in'
    await c.query(
      `INSERT INTO stock_movements 
       (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, batch_id)
       VALUES (?, ?, ?, 'batch_in', ?, 'batch', ?, ?)`,
      [uuidv4(), warehouseId, itemMasterId, qtyReceived, grnId, batchId]
    );

    // Upsert inventory_stock
    await upsertStock(warehouseId, itemMasterId, qtyReceived, c);

    createdBatches.push({
      id: batchId,
      batch_number: batchNumber,
      item_master_id: itemMasterId,
      qty_received: qtyReceived,
      qty_available: qtyReceived,
      rate,
    });
  }

  return createdBatches;
}

/**
 * Upsert inventory_stock — add deltaQty to existing record or create new one.
 * Mirrors the pattern from inventory.service.js.
 */
async function upsertStock(warehouseId, itemMasterId, deltaQty, conn) {
  const c = conn || pool;
  const [existing] = await c.query(
    'SELECT id, quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?',
    [warehouseId, itemMasterId]
  );

  if (existing.length === 0) {
    await c.query(
      'INSERT INTO inventory_stock (id, warehouse_id, item_master_id, quantity_on_hand) VALUES (?, ?, ?, ?)',
      [uuidv4(), warehouseId, itemMasterId, Math.max(0, deltaQty)]
    );
    return Math.max(0, deltaQty);
  }

  const newQty = Number(existing[0].quantity_on_hand) + deltaQty;
  await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [Math.max(0, newQty), existing[0].id]);
  return Math.max(0, newQty);
}

/**
 * Query inventory_batches with optional filters.
 * Filters: item_code, location_id, batch_number, include_exhausted (boolean).
 * JOINs item_master and warehouses for names.
 */
async function getBatches(filters = {}, conn) {
  const c = conn || pool;
  const conditions = [];
  const params = [];

  if (filters.item_code) {
    conditions.push('im.item_code = ?');
    params.push(filters.item_code);
  }

  if (filters.location_id) {
    conditions.push('ib.location_id = ?');
    params.push(filters.location_id);
  }

  if (filters.batch_number) {
    conditions.push('ib.batch_number LIKE ?');
    params.push(`%${filters.batch_number}%`);
  }

  if (!filters.include_exhausted) {
    conditions.push("ib.status != 'exhausted'");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await c.query(
    `SELECT ib.id, ib.batch_number, ib.item_master_id, ib.grn_id, ib.grn_line_item_id,
            ib.location_id, ib.qty_received, ib.qty_available, ib.rate,
            ib.discount_percentage, ib.tax_percentage, ib.status, ib.created_at, ib.updated_at,
            im.item_code, im.item_description AS item_name,
            w.warehouse_name AS location_name, w.warehouse_code
     FROM inventory_batches ib
     LEFT JOIN item_master im ON ib.item_master_id = im.id
     LEFT JOIN warehouses w ON ib.location_id = w.id
     ${whereClause}
     ORDER BY ib.created_at DESC`,
    params
  );

  return rows.map((row) => ({
    ...row,
    total_amount: calculateBatchAmount(row.qty_available, row.rate, row.discount_percentage, row.tax_percentage),
  }));
}

/**
 * Fetch a single batch with item and location details.
 */
async function getBatchById(batchId, conn) {
  const c = conn || pool;

  const [[batch]] = await c.query(
    `SELECT ib.id, ib.batch_number, ib.item_master_id, ib.grn_id, ib.grn_line_item_id,
            ib.location_id, ib.qty_received, ib.qty_available, ib.rate,
            ib.discount_percentage, ib.tax_percentage, ib.status, ib.created_at, ib.updated_at,
            im.item_code, im.item_description AS item_name,
            w.warehouse_name AS location_name, w.warehouse_code
     FROM inventory_batches ib
     LEFT JOIN item_master im ON ib.item_master_id = im.id
     LEFT JOIN warehouses w ON ib.location_id = w.id
     WHERE ib.id = ?`,
    [batchId]
  );

  if (!batch) {
    throw new NotFoundError(`Batch not found: ${batchId}`);
  }

  return {
    ...batch,
    total_amount: calculateBatchAmount(batch.qty_available, batch.rate, batch.discount_percentage, batch.tax_percentage),
  };
}

/**
 * Consume stock from a specific batch. Reduces qty_available.
 * If qty_available reaches 0, marks status as 'exhausted'.
 * Also reduces inventory_stock and records stock_movement of type 'consumption'.
 * Throws if requested quantity > available.
 */
async function consumeFromBatch(batchId, quantity, reference, actorId, conn) {
  const c = conn || pool;

  if (!batchId || !quantity || quantity <= 0) {
    throw new ValidationError('batch_id and a positive quantity are required');
  }

  const [[batch]] = await c.query(
    'SELECT * FROM inventory_batches WHERE id = ?',
    [batchId]
  );

  if (!batch) {
    throw new NotFoundError(`Batch not found: ${batchId}`);
  }

  const available = Number(batch.qty_available);

  if (quantity > available) {
    throw new ValidationError(
      `Insufficient batch quantity — available ${available}, requested ${quantity}`
    );
  }

  const newQtyAvailable = available - quantity;
  const newStatus = newQtyAvailable === 0 ? 'exhausted' : 'active';

  // Update batch
  await c.query(
    'UPDATE inventory_batches SET qty_available = ?, status = ?, updated_at = NOW() WHERE id = ?',
    [newQtyAvailable, newStatus, batchId]
  );

  // Reduce inventory_stock
  await upsertStock(batch.location_id, batch.item_master_id, -quantity, c);

  // Record stock_movement
  await c.query(
    `INSERT INTO stock_movements 
     (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, batch_id, created_by)
     VALUES (?, ?, ?, 'consumption', ?, 'consumption', ?, ?, ?)`,
    [uuidv4(), batch.location_id, batch.item_master_id, quantity, reference || null, batchId, actorId || null]
  );

  return {
    id: batchId,
    batch_number: batch.batch_number,
    qty_available: newQtyAvailable,
    status: newStatus,
  };
}

/**
 * Calculate the total amount for a batch line:
 * (qty × rate) × (1 - discount/100) × (1 + tax/100)
 */
function calculateBatchAmount(qty, rate, discountPct, taxPct) {
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  const d = Number(discountPct) || 0;
  const t = Number(taxPct) || 0;
  return parseFloat(((q * r) * (1 - d / 100) * (1 + t / 100)).toFixed(2));
}

module.exports = {
  generateBatchNumber,
  generateBatchesFromGrn,
  getBatches,
  getBatchById,
  consumeFromBatch,
  calculateBatchAmount,
  upsertStock,
};
