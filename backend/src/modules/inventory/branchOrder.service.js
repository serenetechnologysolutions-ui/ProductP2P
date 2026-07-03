const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');

// Valid status transitions for branch orders
const VALID_TRANSITIONS = {
  created: 'approved',
  approved: 'in_transit',
  in_transit: 'received',
};

/**
 * Generates a sequential order number in the format BO-{6-digit zero-padded}.
 * Queries the max existing order_number from branch_orders to determine next sequence.
 */
async function generateOrderNumber(conn) {
  const c = conn || pool;
  const [[{ maxNum }]] = await c.query(
    "SELECT MAX(CAST(SUBSTRING(order_number, 4) AS UNSIGNED)) as maxNum FROM branch_orders WHERE order_number LIKE 'BO-%' AND order_number REGEXP '^BO-[0-9]+$'"
  );
  return `BO-${String((maxNum || 0) + 1).padStart(6, '0')}`;
}

/**
 * Creates a branch order request with status 'created'.
 * Validates: from ≠ to locations, stock availability at source for each line item.
 */
async function createBranchOrder(input, actorId, conn) {
  const c = conn || pool;
  const { from_location_id, to_location_id, request_type, request_date, remarks, line_items } = input;

  // Validate from and to are different
  if (from_location_id === to_location_id) {
    throw new ValidationError('Source and destination locations must be different');
  }

  if (!from_location_id || !to_location_id) {
    throw new ValidationError('Both source and destination locations are required');
  }

  if (!request_type) {
    throw new ValidationError('Request type is required');
  }

  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
    throw new ValidationError('At least one line item is required');
  }

  // Validate stock availability at source for each line item
  for (const line of line_items) {
    if (!line.item_master_id || !line.requested_quantity || line.requested_quantity <= 0) {
      throw new ValidationError('Each line item requires item_master_id and a positive requested_quantity');
    }

    const [[stock]] = await c.query(
      'SELECT quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?',
      [from_location_id, line.item_master_id]
    );

    const available = stock ? Number(stock.quantity_on_hand) : 0;
    if (line.requested_quantity > available) {
      throw new ValidationError(
        `Insufficient stock at source location for item ${line.item_master_id}. Available: ${available}, Requested: ${line.requested_quantity}`
      );
    }
  }

  // Generate order number
  const orderNumber = await generateOrderNumber(c);
  const orderId = uuidv4();

  // Insert branch order header
  await c.query(
    `INSERT INTO branch_orders (id, order_number, from_location_id, to_location_id, requesting_branch, request_type, request_date, status, remarks, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, NOW(), NOW())`,
    [orderId, orderNumber, from_location_id, to_location_id, to_location_id, request_type, request_date, remarks || null, actorId || null]
  );

  // Insert line items
  const lineItemRecords = [];
  for (const line of line_items) {
    const lineId = uuidv4();
    await c.query(
      `INSERT INTO branch_order_line_items (id, branch_order_id, item_master_id, requested_quantity)
       VALUES (?, ?, ?, ?)`,
      [lineId, orderId, line.item_master_id, line.requested_quantity]
    );
    lineItemRecords.push({
      id: lineId,
      branch_order_id: orderId,
      item_master_id: line.item_master_id,
      requested_quantity: line.requested_quantity,
    });
  }

  return {
    id: orderId,
    order_number: orderNumber,
    status: 'created',
    from_location_id,
    to_location_id,
    request_type,
    request_date,
    remarks: remarks || null,
    line_items: lineItemRecords,
  };
}

/**
 * Approves a branch order: transitions to 'approved'.
 * Sets approved_quantity = requested_quantity for each line.
 * Reduces inventory_stock at from_location.
 * Creates in_transit_stock records.
 */
async function approveBranchOrder(orderId, actorId, conn) {
  const c = conn || pool;

  // Fetch order
  const [[order]] = await c.query('SELECT * FROM branch_orders WHERE id = ?', [orderId]);
  if (!order) throw new NotFoundError('Branch order not found');

  // Validate transition
  if (order.status !== 'created') {
    throw new ValidationError(`Cannot transition from '${order.status}' to 'approved'. Order must be in 'created' status.`);
  }

  // Fetch line items
  const [lineItems] = await c.query('SELECT * FROM branch_order_line_items WHERE branch_order_id = ?', [orderId]);

  // For each line: set approved_quantity, reduce source stock, create in-transit record
  for (const line of lineItems) {
    const approvedQty = Number(line.requested_quantity);

    // Update line item with approved quantity
    await c.query(
      'UPDATE branch_order_line_items SET approved_quantity = ? WHERE id = ?',
      [approvedQty, line.id]
    );

    // Reduce inventory at source location
    const [[stock]] = await c.query(
      'SELECT id, quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?',
      [order.from_location_id, line.item_master_id]
    );

    if (!stock || Number(stock.quantity_on_hand) < approvedQty) {
      throw new ValidationError(
        `Insufficient stock at source location for item ${line.item_master_id}`
      );
    }

    const newQty = Number(stock.quantity_on_hand) - approvedQty;
    await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [newQty, stock.id]);

    // Create in-transit stock record
    await c.query(
      `INSERT INTO in_transit_stock (id, branch_order_id, branch_order_line_id, item_master_id, from_location_id, to_location_id, quantity, dispatched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), orderId, line.id, line.item_master_id, order.from_location_id, order.to_location_id, approvedQty]
    );
  }

  // Update order status
  await c.query(
    'UPDATE branch_orders SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
    ['approved', actorId || null, orderId]
  );

  return { id: orderId, status: 'approved' };
}

/**
 * Dispatches a branch order: transitions to 'in_transit'.
 * Records stock_movement type='transfer_out' for each line.
 * Sets dispatched_at.
 */
async function dispatchBranchOrder(orderId, actorId, conn) {
  const c = conn || pool;

  // Fetch order
  const [[order]] = await c.query('SELECT * FROM branch_orders WHERE id = ?', [orderId]);
  if (!order) throw new NotFoundError('Branch order not found');

  // Validate transition
  if (order.status !== 'approved') {
    throw new ValidationError(`Cannot transition from '${order.status}' to 'in_transit'. Order must be in 'approved' status.`);
  }

  // Fetch line items
  const [lineItems] = await c.query('SELECT * FROM branch_order_line_items WHERE branch_order_id = ?', [orderId]);

  // Record stock_movement for each line
  for (const line of lineItems) {
    await c.query(
      `INSERT INTO stock_movements (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, created_by)
       VALUES (?, ?, ?, 'transfer_out', ?, 'branch_order', ?, ?)`,
      [uuidv4(), order.from_location_id, line.item_master_id, line.approved_quantity, orderId, actorId || null]
    );
  }

  // Update order status and dispatched_at
  await c.query(
    'UPDATE branch_orders SET status = ?, dispatched_at = NOW(), updated_at = NOW() WHERE id = ?',
    ['in_transit', orderId]
  );

  return { id: orderId, status: 'in_transit' };
}

/**
 * Receives a branch order: transitions to 'received'.
 * receivedLines: [{ line_item_id, received_quantity }]
 * Increases inventory_stock at to_location.
 * Removes in_transit_stock records.
 * Records stock_movement type='transfer_in'.
 * Calculates variance = received - approved.
 * Sets received_at.
 */
async function receiveBranchOrder(orderId, receivedLines, actorId, conn) {
  const c = conn || pool;

  // Fetch order
  const [[order]] = await c.query('SELECT * FROM branch_orders WHERE id = ?', [orderId]);
  if (!order) throw new NotFoundError('Branch order not found');

  // Validate transition
  if (order.status !== 'in_transit') {
    throw new ValidationError(`Cannot transition from '${order.status}' to 'received'. Order must be in 'in_transit' status.`);
  }

  if (!receivedLines || !Array.isArray(receivedLines) || receivedLines.length === 0) {
    throw new ValidationError('Received lines are required');
  }

  const variances = [];

  for (const receivedLine of receivedLines) {
    const { line_item_id, received_quantity } = receivedLine;

    // Fetch the line item
    const [[lineItem]] = await c.query(
      'SELECT * FROM branch_order_line_items WHERE id = ? AND branch_order_id = ?',
      [line_item_id, orderId]
    );
    if (!lineItem) {
      throw new NotFoundError(`Line item ${line_item_id} not found for this order`);
    }

    const approvedQty = Number(lineItem.approved_quantity);
    const receivedQty = Number(received_quantity);
    const variance = receivedQty - approvedQty;

    // Update line item with received quantity and variance
    await c.query(
      'UPDATE branch_order_line_items SET received_quantity = ?, variance = ? WHERE id = ?',
      [receivedQty, variance, line_item_id]
    );

    // Increase inventory at destination location
    const [existingStock] = await c.query(
      'SELECT id, quantity_on_hand FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?',
      [order.to_location_id, lineItem.item_master_id]
    );

    if (existingStock.length === 0) {
      await c.query(
        'INSERT INTO inventory_stock (id, warehouse_id, item_master_id, quantity_on_hand) VALUES (?, ?, ?, ?)',
        [uuidv4(), order.to_location_id, lineItem.item_master_id, receivedQty]
      );
    } else {
      const newQty = Number(existingStock[0].quantity_on_hand) + receivedQty;
      await c.query('UPDATE inventory_stock SET quantity_on_hand = ? WHERE id = ?', [newQty, existingStock[0].id]);
    }

    // Remove in-transit stock for this line
    await c.query(
      'DELETE FROM in_transit_stock WHERE branch_order_line_id = ?',
      [line_item_id]
    );

    // Record stock_movement type='transfer_in' at destination
    await c.query(
      `INSERT INTO stock_movements (id, warehouse_id, item_master_id, movement_type, quantity, reference_type, reference_id, created_by)
       VALUES (?, ?, ?, 'transfer_in', ?, 'branch_order', ?, ?)`,
      [uuidv4(), order.to_location_id, lineItem.item_master_id, receivedQty, orderId, actorId || null]
    );

    variances.push({
      item_master_id: lineItem.item_master_id,
      approved_qty: approvedQty,
      received_qty: receivedQty,
      variance,
    });
  }

  // Update order status and received_at
  await c.query(
    'UPDATE branch_orders SET status = ?, received_at = NOW(), received_by = ?, updated_at = NOW() WHERE id = ?',
    ['received', actorId || null, orderId]
  );

  return { id: orderId, status: 'received', variances };
}

/**
 * Lists branch orders with optional filters: status, from_location_id, to_location_id.
 * JOINs warehouses for location names.
 */
async function getBranchOrders(filters, conn) {
  const c = conn || pool;
  const { status, from_location_id, to_location_id } = filters || {};

  let query = `
    SELECT bo.*,
           wf.warehouse_name as from_location_name,
           wt.warehouse_name as to_location_name
    FROM branch_orders bo
    LEFT JOIN warehouses wf ON bo.from_location_id = wf.id
    LEFT JOIN warehouses wt ON bo.to_location_id = wt.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND bo.status = ?';
    params.push(status);
  }
  if (from_location_id) {
    query += ' AND bo.from_location_id = ?';
    params.push(from_location_id);
  }
  if (to_location_id) {
    query += ' AND bo.to_location_id = ?';
    params.push(to_location_id);
  }

  query += ' ORDER BY bo.created_at DESC';

  const [rows] = await c.query(query, params);
  return rows;
}

/**
 * Fetches a single branch order by ID with line items and item names.
 */
async function getBranchOrderById(orderId, conn) {
  const c = conn || pool;

  const [[order]] = await c.query(
    `SELECT bo.*,
            wf.warehouse_name as from_location_name,
            wt.warehouse_name as to_location_name
     FROM branch_orders bo
     LEFT JOIN warehouses wf ON bo.from_location_id = wf.id
     LEFT JOIN warehouses wt ON bo.to_location_id = wt.id
     WHERE bo.id = ?`,
    [orderId]
  );

  if (!order) throw new NotFoundError('Branch order not found');

  const [lineItems] = await c.query(
    `SELECT boli.*, im.item_code, im.item_name, im.item_description
     FROM branch_order_line_items boli
     LEFT JOIN item_master im ON boli.item_master_id = im.id
     WHERE boli.branch_order_id = ?`,
    [orderId]
  );

  return { ...order, line_items: lineItems };
}

/**
 * Returns available stock per item at a specific location from inventory_stock.
 */
async function getAvailableStockAtLocation(locationId, conn) {
  const c = conn || pool;

  const [rows] = await c.query(
    `SELECT ist.item_master_id, ist.quantity_on_hand,
            im.item_code, im.item_name, im.item_description, im.uom
     FROM inventory_stock ist
     LEFT JOIN item_master im ON ist.item_master_id = im.id
     WHERE ist.warehouse_id = ? AND ist.quantity_on_hand > 0
     ORDER BY im.item_code`,
    [locationId]
  );

  return rows;
}

module.exports = {
  generateOrderNumber,
  createBranchOrder,
  approveBranchOrder,
  dispatchBranchOrder,
  receiveBranchOrder,
  getBranchOrders,
  getBranchOrderById,
  getAvailableStockAtLocation,
};
