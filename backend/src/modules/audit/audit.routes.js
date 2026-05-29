const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/audit/checklists — List all active checklists with items
router.get('/checklists', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [checklists] = await pool.query('SELECT * FROM audit_checklists WHERE is_active = TRUE ORDER BY created_at DESC');

  for (const checklist of checklists) {
    const [items] = await pool.query('SELECT * FROM audit_checklist_items WHERE checklist_id = ? ORDER BY sequence', [checklist.id]);
    checklist.items = items;
  }

  res.json({ success: true, data: checklists });
}));

// POST /api/audit/checklists — Create checklist
router.post('/checklists', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { name, description, category, items } = req.body;

  const missing = [];
  if (!name) missing.push('name');
  if (!items || !Array.isArray(items) || items.length === 0) missing.push('items');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const checklistId = uuidv4();
  await pool.query(
    'INSERT INTO audit_checklists (id, name, description, category, created_by) VALUES (?, ?, ?, ?, ?)',
    [checklistId, name, description || null, category || null, req.user.id]
  );

  for (let i = 0; i < items.length; i++) {
    await pool.query(
      'INSERT INTO audit_checklist_items (id, checklist_id, item_text, sequence) VALUES (?, ?, ?, ?)',
      [uuidv4(), checklistId, items[i].item_text || items[i], i + 1]
    );
  }

  res.status(201).json({ success: true, data: { id: checklistId } });
}));

// PUT /api/audit/checklists/:id — Update checklist
router.put('/checklists/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, category, items } = req.body;

  const [existing] = await pool.query('SELECT id FROM audit_checklists WHERE id = ? AND is_active = TRUE', [id]);
  if (existing.length === 0) throw new NotFoundError('Checklist not found');

  await pool.query(
    'UPDATE audit_checklists SET name = COALESCE(?, name), description = COALESCE(?, description), category = COALESCE(?, category) WHERE id = ?',
    [name, description, category, id]
  );

  if (items && Array.isArray(items)) {
    await pool.query('DELETE FROM audit_checklist_items WHERE checklist_id = ?', [id]);
    for (let i = 0; i < items.length; i++) {
      await pool.query(
        'INSERT INTO audit_checklist_items (id, checklist_id, item_text, sequence) VALUES (?, ?, ?, ?)',
        [uuidv4(), id, items[i].item_text || items[i], i + 1]
      );
    }
  }

  res.json({ success: true, message: 'Checklist updated' });
}));

// DELETE /api/audit/checklists/:id — Soft delete
router.delete('/checklists/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT id FROM audit_checklists WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Checklist not found');

  await pool.query('UPDATE audit_checklists SET is_active = FALSE WHERE id = ?', [id]);
  res.json({ success: true, message: 'Checklist deleted' });
}));

// GET /api/audit/schedules — List schedules with checklist name
router.get('/schedules', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT s.*, c.name as checklist_name FROM audit_schedules s LEFT JOIN audit_checklists c ON s.checklist_id = c.id ORDER BY s.created_at DESC'
  );
  res.json({ success: true, data: rows });
}));

// POST /api/audit/schedules — Create schedule
router.post('/schedules', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { checklist_id, vendor_id, vendor_group, frequency, start_date, end_date } = req.body;

  const missing = [];
  if (!checklist_id) missing.push('checklist_id');
  if (!frequency) missing.push('frequency');
  if (!start_date) missing.push('start_date');
  if (!end_date) missing.push('end_date');
  if (!vendor_id && !vendor_group) missing.push('vendor_id or vendor_group');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  // Calculate number of audits based on frequency and date range
  const start = new Date(start_date);
  const end = new Date(end_date);
  let totalAudits = 1;

  if (frequency === 'weekly') {
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    totalAudits = Math.max(1, Math.ceil(diffDays / 7));
  } else if (frequency === 'monthly') {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    totalAudits = Math.max(1, months + 1);
  } else if (frequency === 'quarterly') {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    totalAudits = Math.max(1, Math.ceil((months + 1) / 3));
  }

  const scheduleId = uuidv4();
  await pool.query(
    'INSERT INTO audit_schedules (id, checklist_id, vendor_id, vendor_group, frequency, start_date, end_date, next_due_date, total_audits, completed_audits, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [scheduleId, checklist_id, vendor_id || null, vendor_group || null, frequency, start_date, end_date, start_date, totalAudits, req.user.id]
  );

  // Auto-create planned execution records
  let currentDate = new Date(start_date);
  for (let i = 0; i < totalAudits; i++) {
    const execId = uuidv4();
    const dueDate = currentDate.toISOString().split('T')[0];
    await pool.query(
      "INSERT INTO audit_executions (id, schedule_id, status, started_at) VALUES (?, ?, 'planned', ?)",
      [execId, scheduleId, dueDate]
    );

    // Advance to next period
    if (frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      currentDate.setMonth(currentDate.getMonth() + 3);
    }
  }

  res.status(201).json({ success: true, data: { id: scheduleId, total_audits: totalAudits } });
}));

// GET /api/audit/executions — List executions
router.get('/executions', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.*, s.checklist_id, c.name as checklist_name, s.vendor_id, v.vendor_name
     FROM audit_executions e
     LEFT JOIN audit_schedules s ON e.schedule_id = s.id
     LEFT JOIN audit_checklists c ON s.checklist_id = c.id
     LEFT JOIN vendors v ON s.vendor_id = v.id
     ORDER BY e.started_at DESC`
  );
  res.json({ success: true, data: rows });
}));

// GET /api/audit/executions/:id — Get execution detail with responses and findings
router.get('/executions/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [execRows] = await pool.query(
    `SELECT e.*, s.checklist_id, c.name as checklist_name, s.vendor_id, v.vendor_name
     FROM audit_executions e
     LEFT JOIN audit_schedules s ON e.schedule_id = s.id
     LEFT JOIN audit_checklists c ON s.checklist_id = c.id
     LEFT JOIN vendors v ON s.vendor_id = v.id
     WHERE e.id = ?`, [id]
  );
  if (execRows.length === 0) throw new NotFoundError('Execution not found');

  const [responses] = await pool.query('SELECT * FROM audit_responses WHERE execution_id = ?', [id]);
  const [findings] = await pool.query('SELECT * FROM audit_findings WHERE execution_id = ? ORDER BY created_at DESC', [id]);
  const [checklistItems] = await pool.query('SELECT * FROM audit_checklist_items WHERE checklist_id = ? ORDER BY sequence', [execRows[0].checklist_id]);

  res.json({ success: true, data: { ...execRows[0], responses, findings, checklist_items: checklistItems } });
}));

// POST /api/audit/executions — Start execution
router.post('/executions', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { schedule_id } = req.body;
  if (!schedule_id) throw new ValidationError('Missing required field', ['schedule_id']);

  const [schedule] = await pool.query('SELECT id FROM audit_schedules WHERE id = ?', [schedule_id]);
  if (schedule.length === 0) throw new NotFoundError('Schedule not found');

  const executionId = uuidv4();
  await pool.query(
    "INSERT INTO audit_executions (id, schedule_id, status, executed_by) VALUES (?, ?, 'in_progress', ?)",
    [executionId, schedule_id, req.user.id]
  );

  await pool.query("UPDATE audit_schedules SET status = 'in_progress', last_run_date = CURDATE() WHERE id = ?", [schedule_id]);

  res.status(201).json({ success: true, data: { id: executionId } });
}));

// PUT /api/audit/executions/:id/start — Start a planned execution
router.put('/executions/:id/start', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [execution] = await pool.query('SELECT id, schedule_id, status FROM audit_executions WHERE id = ?', [id]);
  if (execution.length === 0) throw new NotFoundError('Execution not found');
  if (execution[0].status !== 'planned') throw new ValidationError('Only planned executions can be started');

  await pool.query("UPDATE audit_executions SET status = 'in_progress', started_at = NOW(), executed_by = ? WHERE id = ?", [req.user.id, id]);
  await pool.query("UPDATE audit_schedules SET status = 'in_progress', last_run_date = CURDATE() WHERE id = ?", [execution[0].schedule_id]);

  res.json({ success: true, message: 'Execution started' });
}));

// PUT /api/audit/executions/:id/complete — Complete execution
router.put('/executions/:id/complete', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [execution] = await pool.query('SELECT id, schedule_id FROM audit_executions WHERE id = ?', [id]);
  if (execution.length === 0) throw new NotFoundError('Execution not found');

  await pool.query("UPDATE audit_executions SET status = 'completed', completed_at = NOW() WHERE id = ?", [id]);
  await pool.query("UPDATE audit_schedules SET status = 'completed' WHERE id = ?", [execution[0].schedule_id]);

  res.json({ success: true, message: 'Execution completed' });
}));

// PUT /api/audit/executions/:id/close — Close execution (all findings must be closed)
router.put('/executions/:id/close', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [execution] = await pool.query('SELECT id, schedule_id FROM audit_executions WHERE id = ?', [id]);
  if (execution.length === 0) throw new NotFoundError('Execution not found');

  // Check no open findings
  const [[{ openCount }]] = await pool.query(
    "SELECT COUNT(*) as openCount FROM audit_findings WHERE execution_id = ? AND status = 'open'",
    [id]
  );
  if (openCount > 0) throw new ValidationError(`Cannot close: ${openCount} open finding(s) remain`);

  await pool.query("UPDATE audit_executions SET status = 'closed', completed_at = NOW() WHERE id = ?", [id]);

  res.json({ success: true, message: 'Audit closed — all findings resolved' });
}));

// POST /api/audit/executions/:id/responses — Save responses
router.post('/executions/:id/responses', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { responses } = req.body;

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    throw new ValidationError('Missing required field', ['responses']);
  }

  const [execution] = await pool.query('SELECT id FROM audit_executions WHERE id = ?', [id]);
  if (execution.length === 0) throw new NotFoundError('Execution not found');

  for (const r of responses) {
    if (!r.checklist_item_id || !r.response) {
      throw new ValidationError('Each response must have checklist_item_id and response');
    }
    await pool.query(
      'INSERT INTO audit_responses (id, execution_id, checklist_item_id, response, remarks) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE response = VALUES(response), remarks = VALUES(remarks)',
      [uuidv4(), id, r.checklist_item_id, r.response, r.remarks || null]
    );
  }

  res.status(201).json({ success: true, message: 'Responses saved' });
}));

// POST /api/audit/executions/:id/findings — Add finding
router.post('/executions/:id/findings', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, severity } = req.body;

  const missing = [];
  if (!description) missing.push('description');
  if (!severity) missing.push('severity');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const [execution] = await pool.query('SELECT id FROM audit_executions WHERE id = ?', [id]);
  if (execution.length === 0) throw new NotFoundError('Execution not found');

  const findingId = uuidv4();
  await pool.query(
    'INSERT INTO audit_findings (id, execution_id, description, severity) VALUES (?, ?, ?, ?)',
    [findingId, id, description, severity]
  );

  res.status(201).json({ success: true, data: { id: findingId } });
}));

// PUT /api/audit/findings/:id — Update finding status
router.put('/findings/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['open', 'closed'].includes(status)) {
    throw new ValidationError('Status must be open or closed');
  }

  const [existing] = await pool.query('SELECT id FROM audit_findings WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Finding not found');

  const closedAt = status === 'closed' ? new Date() : null;
  await pool.query('UPDATE audit_findings SET status = ?, closed_at = ? WHERE id = ?', [status, closedAt, id]);

  res.json({ success: true, message: 'Finding updated' });
}));

module.exports = router;
