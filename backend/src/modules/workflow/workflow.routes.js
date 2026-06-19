const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/workflow — list workflow definitions (optional ?module_name= filter), with steps attached
router.get('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { module_name } = req.query;
  let sql = 'SELECT * FROM workflow_master WHERE is_active = TRUE';
  const params = [];
  if (module_name) { sql += ' AND module_name = ?'; params.push(module_name); }
  sql += ' ORDER BY created_at DESC';

  const [workflows] = await pool.query(sql, params);

  for (const wf of workflows) {
    const [steps] = await pool.query('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order', [wf.id]);
    wf.steps = steps;
  }

  res.json({ success: true, data: workflows });
}));

// POST /api/workflow — create workflow definition + steps
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { name, module_name, description, steps } = req.body;

  const missing = [];
  if (!name) missing.push('name');
  if (!module_name) missing.push('module_name');
  if (!steps || !Array.isArray(steps) || steps.length === 0) missing.push('steps');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const workflowId = uuidv4();
  await pool.query(
    'INSERT INTO workflow_master (id, name, module_name, description, created_by) VALUES (?, ?, ?, ?, ?)',
    [workflowId, name, module_name, description || null, req.user.id]
  );

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.step_name || !step.approver_role) throw new ValidationError('Each step requires step_name and approver_role');
    await pool.query(
      'INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), workflowId, i + 1, step.step_name, step.approver_role, step.sla_hours ?? 24]
    );
  }

  res.status(201).json({ success: true, data: { id: workflowId } });
}));

// GET /api/workflow/instances — list workflow instances (optional filters), with workflow + current step names
router.get('/instances', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { module_name, record_id, status } = req.query;
  let sql = `SELECT i.*, w.name as workflow_name, s.step_name as current_step_name
             FROM workflow_instances i
             LEFT JOIN workflow_master w ON i.workflow_id = w.id
             LEFT JOIN workflow_steps s ON i.current_step_id = s.id
             WHERE 1=1`;
  const params = [];
  if (module_name) { sql += ' AND i.module_name = ?'; params.push(module_name); }
  if (record_id) { sql += ' AND i.record_id = ?'; params.push(record_id); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  sql += ' ORDER BY i.started_at DESC';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/workflow/instances/:id — instance detail with logs
router.get('/instances/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT i.*, w.name as workflow_name, s.step_name as current_step_name
     FROM workflow_instances i
     LEFT JOIN workflow_master w ON i.workflow_id = w.id
     LEFT JOIN workflow_steps s ON i.current_step_id = s.id
     WHERE i.id = ?`,
    [id]
  );
  if (rows.length === 0) throw new NotFoundError('Workflow instance not found');

  const [logs] = await pool.query(
    `SELECT l.*, s.step_name FROM workflow_logs l LEFT JOIN workflow_steps s ON l.step_id = s.id
     WHERE l.instance_id = ? ORDER BY l.created_at`,
    [id]
  );

  res.json({ success: true, data: { ...rows[0], logs } });
}));

// GET /api/workflow/:id — workflow definition detail with steps
router.get('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM workflow_master WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new NotFoundError('Workflow not found');

  const [steps] = await pool.query('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order', [req.params.id]);
  res.json({ success: true, data: { ...rows[0], steps } });
}));

// PUT /api/workflow/:id — update workflow definition (and steps if provided)
router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active, steps } = req.body;

  const [existing] = await pool.query('SELECT id FROM workflow_master WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Workflow not found');

  await pool.query(
    'UPDATE workflow_master SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name, description, is_active, id]
  );

  if (steps && Array.isArray(steps)) {
    await pool.query('DELETE FROM workflow_steps WHERE workflow_id = ?', [id]);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.step_name || !step.approver_role) throw new ValidationError('Each step requires step_name and approver_role');
      await pool.query(
        'INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, i + 1, step.step_name, step.approver_role, step.sla_hours ?? 24]
      );
    }
  }

  res.json({ success: true, message: 'Workflow updated' });
}));

// DELETE /api/workflow/:id — soft delete, blocked if any in_progress instances reference it
router.delete('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT id FROM workflow_master WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Workflow not found');

  const [[{ activeCount }]] = await pool.query(
    "SELECT COUNT(*) as activeCount FROM workflow_instances WHERE workflow_id = ? AND status = 'in_progress'",
    [id]
  );
  if (activeCount > 0) throw new ValidationError(`Cannot delete: ${activeCount} instance(s) are still in progress`);

  await pool.query('UPDATE workflow_master SET is_active = FALSE WHERE id = ?', [id]);
  res.json({ success: true, message: 'Workflow deleted' });
}));

// POST /api/workflow/:id/instances — kick off a new instance of a workflow (any authenticated role)
router.post('/:id/instances', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { module_name, record_id } = req.body;

  const missing = [];
  if (!module_name) missing.push('module_name');
  if (!record_id) missing.push('record_id');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const [workflow] = await pool.query('SELECT id FROM workflow_master WHERE id = ? AND is_active = TRUE', [id]);
  if (workflow.length === 0) throw new NotFoundError('Workflow not found');

  const [steps] = await pool.query('SELECT id FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order LIMIT 1', [id]);
  const firstStepId = steps.length > 0 ? steps[0].id : null;

  const instanceId = uuidv4();
  await pool.query(
    'INSERT INTO workflow_instances (id, workflow_id, module_name, record_id, current_step_id, initiated_by) VALUES (?, ?, ?, ?, ?, ?)',
    [instanceId, id, module_name, record_id, firstStepId, req.user.id]
  );

  await pool.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), instanceId, firstStepId, 'started', req.user.id, null]
  );

  res.status(201).json({ success: true, data: { id: instanceId, current_step_id: firstStepId } });
}));

// POST /api/workflow/instances/:id/advance — approve or reject the current step.
// Only the role assigned as the current step's approver_role (or mdm_admin, as the
// platform's top-level override) may act on it — otherwise any authenticated user
// could approve/reject business-critical workflow steps they have no authority over.
router.post('/instances/:id/advance', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    throw new ValidationError("action must be 'approve' or 'reject'");
  }

  const [instances] = await pool.query('SELECT * FROM workflow_instances WHERE id = ?', [id]);
  if (instances.length === 0) throw new NotFoundError('Workflow instance not found');
  const instance = instances[0];

  if (instance.status !== 'in_progress') throw new ValidationError(`Instance is not in progress (status: ${instance.status})`);

  const currentStepId = instance.current_step_id;

  if (currentStepId && req.user.role !== 'mdm_admin') {
    const [[currentStep]] = await pool.query('SELECT approver_role FROM workflow_steps WHERE id = ?', [currentStepId]);
    if (currentStep && currentStep.approver_role !== req.user.role) {
      throw new AuthorizationError(`This step requires approver role '${currentStep.approver_role}'`);
    }
  }

  if (action === 'reject') {
    await pool.query("UPDATE workflow_instances SET status = 'rejected', completed_at = NOW() WHERE id = ?", [id]);
    await pool.query(
      'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, currentStepId, 'rejected', req.user.id, remarks || null]
    );
    return res.json({ success: true, message: 'Workflow instance rejected' });
  }

  // action === 'approve'
  let nextStep = null;
  if (currentStepId) {
    const [[currentStepRow]] = await pool.query('SELECT step_order FROM workflow_steps WHERE id = ?', [currentStepId]);
    if (currentStepRow) {
      const [nextSteps] = await pool.query(
        'SELECT id FROM workflow_steps WHERE workflow_id = ? AND step_order > ? ORDER BY step_order LIMIT 1',
        [instance.workflow_id, currentStepRow.step_order]
      );
      if (nextSteps.length > 0) nextStep = nextSteps[0];
    }
  }

  if (nextStep) {
    await pool.query('UPDATE workflow_instances SET current_step_id = ? WHERE id = ?', [nextStep.id, id]);
  } else {
    await pool.query("UPDATE workflow_instances SET status = 'approved', completed_at = NOW(), current_step_id = NULL WHERE id = ?", [id]);
  }

  await pool.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), id, currentStepId, 'approved', req.user.id, remarks || null]
  );

  res.json({ success: true, message: nextStep ? 'Advanced to next step' : 'Workflow instance approved' });
}));

module.exports = router;
