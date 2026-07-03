const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { logger } = require('../../common/logger');

/**
 * Generates a sequential purchase return number in the format PR-RET-{6-digit zero-padded}.
 */
async function generateReturnNumber(conn) {
  const c = conn || pool;
  const [[{ maxNum }]] = await c.query(
    "SELECT MAX(CAST(SUBSTRING(return_number, 8) AS UNSIGNED)) as maxNum FROM purchase_returns WHERE return_number LIKE 'PR-RET-%' AND return_number REGEXP '^PR-RET-[0-9]+$'"
  );
  return `PR-RET-${String((maxNum || 0) + 1).padStart(6, '0')}`;
}

/**
 * Pure function: calculates line amount.
 * Formula: (qty * rate) * (1 - discount/100) * (1 + tax/100)
 */
function calculateLineAmount(qty, rate, discountPct, taxPct) {
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  const d = Number(discountPct) || 0;
  const t = Number(taxPct) || 0;
  return parseFloat(((q * r) * (1 - d / 100) * (1 + t / 100)).toFixed(2));
}

/**
 * Creates a draft purchase return with header and line items.
 * Validates batch availability: reject if return_quantity > qty_available or batch exhausted.
 *
 * Input: { vendor_id, grn_id, asn_number, return_date, return_reason, round_off,
 *          line_items: [{ item_master_id, batch_id, batch_number, location_id,
 *                         return_quantity, rate, discount_percentage, tax_percentage }] }
 */
async function createPurchaseReturn(input, actorId, conn) {
  const c = conn || pool;
  const { vendor_id, grn_id, asn_number, return_date, return_reason, round_off, line_items } = input;

  if (!vendor_id) throw new ValidationError('vendor_id is required');
  if (!grn_id) throw new ValidationError('grn_id is required');
  if (!return_date) throw new ValidationError('return_date is required');
  if (!return_reason) throw new ValidationError('return_reason is required');
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
    throw new ValidationError('At least one line item is required');
  }

  // Validate each line item's batch availability
  for (const line of line_items) {
    if (!line.batch_id) throw new ValidationError('batch_id is required for each line item');
    if (!line.return_quantity || line.return_quantity <= 0) {
      throw new ValidationError('return_quantity must be positive');
    }

    const [[batch]] = await c.query(
      'SELECT qty_available, status FROM inventory_batches WHERE id = ?',
      [line.batch_id]
    );

    if (!batch) throw new NotFoundError(`Batch not found: ${line.batch_id}`);

    if (batch.status === 'exhausted' || Number(batch.qty_available) === 0) {
      throw new ValidationError(`Batch ${line.batch_number || line.batch_id} is exhausted and cannot be returned`);
    }

    if (line.return_quantity > Number(batch.qty_available)) {
      throw new ValidationError(
        `Return quantity (${line.return_quantity}) exceeds available quantity (${batch.qty_available}) for batch ${line.batch_number || line.batch_id}`
      );
    }
  }

  // Generate return number
  const returnNumber = await generateReturnNumber(c);
  const returnId = uuidv4();

  // Calculate line amounts and total
  let totalAmount = 0;
  const lineRecords = [];

  for (const line of line_items) {
    const lineAmount = calculateLineAmount(
      line.return_quantity,
      line.rate,
      line.discount_percentage,
      line.tax_percentage
    );
    totalAmount += lineAmount;

    const lineId = uuidv4();
    await c.query(
      `INSERT INTO purchase_return_line_items
       (id, purchase_return_id, item_master_id, batch_id, batch_number, location_id, return_quantity, rate, discount_percentage, tax_percentage, line_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId, returnId, line.item_master_id, line.batch_id,
        line.batch_number || '', line.location_id || null,
        line.return_quantity, line.rate || 0,
        line.discount_percentage || 0, line.tax_percentage || 0,
        lineAmount,
      ]
    );

    lineRecords.push({
      id: lineId,
      item_master_id: line.item_master_id,
      batch_id: line.batch_id,
      batch_number: line.batch_number,
      location_id: line.location_id,
      return_quantity: line.return_quantity,
      rate: line.rate,
      discount_percentage: line.discount_percentage || 0,
      tax_percentage: line.tax_percentage || 0,
      line_amount: lineAmount,
    });
  }

  // Add round_off to total
  const roundOff = Number(round_off) || 0;
  totalAmount = parseFloat((totalAmount + roundOff).toFixed(2));

  // Insert purchase return header
  await c.query(
    `INSERT INTO purchase_returns
     (id, return_number, vendor_id, grn_id, asn_number, return_date, return_reason, status, round_off, total_amount, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NOW(), NOW())`,
    [returnId, returnNumber, vendor_id, grn_id, asn_number || null, return_date, return_reason, roundOff, totalAmount, actorId || null]
  );

  return {
    id: returnId,
    return_number: returnNumber,
    status: 'draft',
    vendor_id,
    grn_id,
    asn_number: asn_number || null,
    return_date,
    return_reason,
    round_off: roundOff,
    total_amount: totalAmount,
    line_items: lineRecords,
  };
}

/**
 * Confirms a purchase return: transitions from draft to confirmed.
 * Reduces batch qty_available and inventory_stock.
 * Records stock_movements of type 'return_out'.
 * Marks batches exhausted if qty reaches zero.
 */
async function confirmPurchaseReturn(returnId, actorId, conn) {
  const c = conn || pool;

  // Fetch return header
  const [[prReturn]] = await c.query('SELECT * FROM purchase_returns WHERE id = ?', [returnId]);
  if (!prReturn) throw new NotFoundError('Purchase return not found');

  if (prReturn.status !== 'draft') {
    throw new ValidationError(
      `Purchase return ${prReturn.return_number} is already ${prReturn.status} and cannot be confirmed`
    );
  }

  // Fetch line items
  const [lineItems] = await c.query(
    'SELECT * FROM purchase_return_line_items WHERE purchase_return_id = ?',
    [returnId]
  );

  // For each line: reduce batch qty_available, reduce inventory_stock, record stock_movement
  for (const line of lineItems) {
    const returnQty = Number(line.return_quantity);

    // Re-validate batch availability (in case of concurrent modification)
    const [[batch]] = await c.query(
      'SELECT id, qty_available, location_id, item_master_id, status FROM inventory_batches WHERE id = ?',
      [line.batch_id]
    );

    if (!batch) throw new NotFoundError(`Batch not found: ${line.batch_id}`);
    if (batch.status === 'exhausted' || Number(batch.qty_available) === 0) {
      throw new ValidationError(`Batch ${line.batch_number} is exhausted and cannot be returned`);
    }
    if (returnQty > Number(batch.qty_available)) {
      throw new ValidationError(
        `Return quantity (${returnQty}) exceeds available quantity (${batch.qty_available}) for batch ${line.batch_number}`
      );
    }

    const newQtyAvailable = Number(batch.qty_available) - returnQty;
    const newStatus = newQtyAvailable === 0 ? 'exhausted' : 'active';

    // Update batch
    await c.query(
      'UPDATE inventory_batches SET qty_available = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [newQtyAvailable, newStatus, line.batch_id]
    );

    // Reduce inventory_stock
    const [stockRows] = await c.query(
      'SELECT id, quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?',
      [batch.location_id, batch.item_master_id]
    );

    if (stockRows.length > 0) {
      const newStockQty = Math.max(0, Number(stockRows[0].quantity_on_hand) - returnQty);
      await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [newStockQty, stockRows[0].id]);
    }

    // Record stock_movement type='return_out'
    await c.query(
      `INSERT INTO stock_movements
       (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, batch_id, created_by)
       VALUES (?, ?, ?, 'return_out', ?, 'purchase_return', ?, ?, ?)`,
      [uuidv4(), batch.location_id, batch.item_master_id, returnQty, returnId, line.batch_id, actorId || null]
    );
  }

  // Update return status to confirmed
  await c.query(
    'UPDATE purchase_returns SET status = ?, confirmed_by = ?, confirmed_at = NOW(), updated_at = NOW() WHERE id = ?',
    ['confirmed', actorId || null, returnId]
  );

  return { id: returnId, status: 'confirmed', return_number: prReturn.return_number };
}

/**
 * Lists purchase returns with optional filters: status, vendor_id, date range.
 */
async function getPurchaseReturns(filters, conn) {
  const c = conn || pool;
  const { status, vendor_id, date_from, date_to } = filters || {};

  let query = `
    SELECT pr.*,
           v.vendor_name
    FROM purchase_returns pr
    LEFT JOIN vendors v ON pr.vendor_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }
  if (vendor_id) {
    query += ' AND pr.vendor_id = ?';
    params.push(vendor_id);
  }
  if (date_from) {
    query += ' AND pr.return_date >= ?';
    params.push(date_from);
  }
  if (date_to) {
    query += ' AND pr.return_date <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY pr.created_at DESC';

  const [rows] = await c.query(query, params);
  return rows;
}

/**
 * Fetches a single purchase return by ID with line items and batch details.
 */
async function getPurchaseReturnById(returnId, conn) {
  const c = conn || pool;

  const [[prReturn]] = await c.query(
    `SELECT pr.*,
            v.vendor_name
     FROM purchase_returns pr
     LEFT JOIN vendors v ON pr.vendor_id = v.id
     WHERE pr.id = ?`,
    [returnId]
  );

  if (!prReturn) throw new NotFoundError('Purchase return not found');

  const [lineItems] = await c.query(
    `SELECT prli.*,
            im.item_code, im.item_description AS item_name,
            w.warehouse_name AS location_name
     FROM purchase_return_line_items prli
     LEFT JOIN item_master im ON prli.item_master_id = im.id
     LEFT JOIN warehouses w ON prli.location_id = w.id
     WHERE prli.purchase_return_id = ?`,
    [returnId]
  );

  return { ...prReturn, line_items: lineItems };
}

module.exports = {
  generateReturnNumber,
  calculateLineAmount,
  createPurchaseReturn,
  confirmPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
};
