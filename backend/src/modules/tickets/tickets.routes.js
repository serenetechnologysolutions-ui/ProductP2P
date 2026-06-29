const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');

const router = express.Router();

// GET /api/tickets — List tickets
// NOTE: sla_breach_flag is computed on the fly here rather than trusting the stored column,
// since there is no scheduled job in this app to keep the stored column fresh.
router.get('/', authenticate, asyncHandler(async (req, res) => {
  let sql, params = [];

  const breachExpr = `, (sla_due_date IS NOT NULL AND sla_due_date < NOW() AND status NOT IN ('closed','vendor_closed')) AS sla_breach_flag`;

  if (req.user.role === 'vendor') {
    // Vendor sees only tickets assigned to them
    sql = `SELECT t.*${breachExpr.replace('sla_due_date', 't.sla_due_date').replace('status', 't.status')} FROM tickets t
           INNER JOIN ticket_vendors tv ON t.id = tv.ticket_id
           WHERE tv.vendor_id = ?
           ORDER BY t.created_at DESC`;
    params.push(req.user.vendorId);
  } else {
    // Admin sees all
    sql = `SELECT *${breachExpr} FROM tickets ORDER BY created_at DESC`;
  }

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST /api/tickets — Create ticket (admin only)
router.post('/', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { subject, description, priority, vendor_ids, category, sla_hours } = req.body;

  const missing = [];
  if (!subject) missing.push('subject');
  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) missing.push('vendor_ids');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  // Auto-generate ticket_number
  const [[{ maxNum }]] = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(ticket_number, 5) AS UNSIGNED)) as maxNum FROM tickets WHERE ticket_number LIKE 'TKT-%'"
  );
  const nextNum = (maxNum || 0) + 1;
  const ticketNumber = `TKT-${String(nextNum).padStart(5, '0')}`;

  const ticketId = uuidv4();
  await withTransaction(async (conn) => {
    if (sla_hours) {
      await conn.query(
        'INSERT INTO tickets (id, ticket_number, subject, description, priority, created_by, category, sla_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
        [ticketId, ticketNumber, subject, description || null, priority || 'medium', req.user.id, category || null, sla_hours]
      );
    } else {
      await conn.query(
        'INSERT INTO tickets (id, ticket_number, subject, description, priority, created_by, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ticketId, ticketNumber, subject, description || null, priority || 'medium', req.user.id, category || null]
      );
    }

    // Assign vendors
    for (const vendorId of vendor_ids) {
      await conn.query(
        'INSERT INTO ticket_vendors (id, ticket_id, vendor_id) VALUES (?, ?, ?)',
        [uuidv4(), ticketId, vendorId]
      );
    }
  });

  res.status(201).json({ success: true, data: { id: ticketId, ticket_number: ticketNumber } });
}));

// GET /api/tickets/:id — Get ticket with messages and vendor statuses
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [tickets] = await pool.query(
    `SELECT *, (sla_due_date IS NOT NULL AND sla_due_date < NOW() AND status NOT IN ('closed','vendor_closed')) AS sla_breach_flag
     FROM tickets WHERE id = ?`,
    [id]
  );
  if (tickets.length === 0) throw new NotFoundError('Ticket not found');

  const ticket = tickets[0];

  // If vendor, check they are assigned
  if (req.user.role === 'vendor') {
    const [assigned] = await pool.query(
      'SELECT id FROM ticket_vendors WHERE ticket_id = ? AND vendor_id = ?',
      [id, req.user.vendorId]
    );
    if (assigned.length === 0) throw new NotFoundError('Ticket not found');
  }

  const [messages] = await pool.query(
    'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
    [id]
  );

  const [vendorStatuses] = await pool.query(
    'SELECT tv.*, v.vendor_name FROM ticket_vendors tv LEFT JOIN vendors v ON tv.vendor_id = v.id WHERE tv.ticket_id = ?',
    [id]
  );

  res.json({ success: true, data: { ...ticket, messages, vendor_statuses: vendorStatuses } });
}));

// POST /api/tickets/:id/messages — Add message
router.post('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message) throw new ValidationError('Missing required field', ['message']);

  const [tickets] = await pool.query('SELECT id FROM tickets WHERE id = ?', [id]);
  if (tickets.length === 0) throw new NotFoundError('Ticket not found');

  // If vendor, check they are assigned
  if (req.user.role === 'vendor') {
    const [assigned] = await pool.query(
      'SELECT id FROM ticket_vendors WHERE ticket_id = ? AND vendor_id = ?',
      [id, req.user.vendorId]
    );
    if (assigned.length === 0) throw new NotFoundError('Ticket not found');
  }

  const messageId = uuidv4();
  await pool.query(
    'INSERT INTO ticket_messages (id, ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?, ?)',
    [messageId, id, req.user.id, req.user.role, message]
  );

  res.status(201).json({ success: true, data: { id: messageId } });
}));

// PUT /api/tickets/:id/vendors/:vendorId/close — Vendor closes their part
router.put('/:id/vendors/:vendorId/close', authenticate, asyncHandler(async (req, res) => {
  const { id, vendorId } = req.params;
  const { remarks } = req.body;

  if (!remarks) throw new ValidationError('Remarks are required to close');

  // Verify vendor is assigned
  const [tv] = await pool.query(
    'SELECT id, status FROM ticket_vendors WHERE ticket_id = ? AND vendor_id = ?',
    [id, vendorId]
  );
  if (tv.length === 0) throw new NotFoundError('Ticket vendor assignment not found');
  if (tv[0].status === 'closed') throw new ValidationError('Already closed');

  await withTransaction(async (conn) => {
    await conn.query(
      "UPDATE ticket_vendors SET status = 'closed', remarks = ?, closed_at = NOW() WHERE ticket_id = ? AND vendor_id = ?",
      [remarks, id, vendorId]
    );

    // Check if all vendors closed — update ticket status to vendor_closed
    const [[{ openCount }]] = await conn.query(
      "SELECT COUNT(*) as openCount FROM ticket_vendors WHERE ticket_id = ? AND status = 'open'",
      [id]
    );
    if (openCount === 0) {
      await conn.query("UPDATE tickets SET status = 'vendor_closed' WHERE id = ?", [id]);
    } else {
      await conn.query("UPDATE tickets SET status = 'in_progress' WHERE id = ? AND status = 'initiated'", [id]);
    }
  });

  res.json({ success: true, message: 'Vendor ticket closed' });
}));

// PUT /api/tickets/:id/reassign — Reassign vendors
router.put('/:id/reassign', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendor_ids } = req.body;

  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) {
    throw new ValidationError('At least one vendor is required', ['vendor_ids']);
  }

  const [tickets] = await pool.query('SELECT id FROM tickets WHERE id = ?', [id]);
  if (tickets.length === 0) throw new NotFoundError('Ticket not found');

  // Remove existing vendor assignments and re-assign
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM ticket_vendors WHERE ticket_id = ?', [id]);
    for (const vendorId of vendor_ids) {
      await conn.query('INSERT INTO ticket_vendors (id, ticket_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), id, vendorId]);
    }
  });

  res.json({ success: true, message: 'Ticket reassigned' });
}));

// PUT /api/tickets/:id/close — Admin closes ticket
router.put('/:id/close', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, closure_remarks, root_cause, resolution_type } = req.body;

  const missing = [];
  if (!rating || rating < 1 || rating > 5) missing.push('rating (1-5)');
  if (!closure_remarks) missing.push('closure_remarks');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const [tickets] = await pool.query('SELECT id FROM tickets WHERE id = ?', [id]);
  if (tickets.length === 0) throw new NotFoundError('Ticket not found');

  await pool.query(
    "UPDATE tickets SET status = 'closed', rating = ?, closure_remarks = ?, root_cause = ?, resolution_type = ?, closed_at = NOW() WHERE id = ?",
    [rating, closure_remarks, root_cause || null, resolution_type || null, id]
  );

  res.json({ success: true, message: 'Ticket closed' });
}));

// PUT /api/tickets/:id/category — Admin categorizes/recategorizes a ticket
router.put('/:id/category', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  if (!category) throw new ValidationError('Missing required field', ['category']);

  const [tickets] = await pool.query('SELECT id FROM tickets WHERE id = ?', [id]);
  if (tickets.length === 0) throw new NotFoundError('Ticket not found');

  await pool.query('UPDATE tickets SET category = ? WHERE id = ?', [category, id]);

  res.json({ success: true, message: 'Ticket category updated' });
}));

module.exports = router;
