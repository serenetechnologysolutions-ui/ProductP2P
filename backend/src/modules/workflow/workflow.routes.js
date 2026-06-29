const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');
const {
  validateStepDefinitions, createWorkflowInstance, recordStepDecision, getInstanceApprovals, checkSlaEscalations,
} = require('./workflow-engine.service');

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

  // Conditional workflows + parallel approvals: step_order defaults to the
  // step's position (sequential, one approver each — unchanged default
  // behavior) but callers can explicitly group steps under the same
  // step_order with is_parallel: true to require simultaneous approval.
  const stepsWithOrder = steps.map((step, i) => ({ ...step, step_order: step.step_order ?? i + 1 }));
  validateStepDefinitions(stepsWithOrder);

  const workflowId = uuidv4();
  await withTransaction(async (conn) => {
    await conn.query(
      'INSERT INTO workflow_master (id, name, module_name, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [workflowId, name, module_name, description || null, req.user.id]
    );

    for (const step of stepsWithOrder) {
      if (!step.step_name || !step.approver_role) throw new ValidationError('Each step requires step_name and approver_role');
      await conn.query(
        `INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours, condition_rule, is_parallel, escalation_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), workflowId, step.step_order, step.step_name, step.approver_role, step.sla_hours ?? 24,
          step.condition_rule ? JSON.stringify(step.condition_rule) : null, !!step.is_parallel, step.escalation_role || null,
        ]
      );
    }
  });

  res.status(201).json({ success: true, data: { id: workflowId } });
}));

// GET /api/workflow/instances — list workflow instances (optional filters), with workflow + current step names
router.get('/instances', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  // SLA Escalation: no background scheduler exists in this codebase, so the
  // sweep runs lazily whenever someone is actually looking at the workflow
  // dashboard — best-effort, never blocks the list view if it fails.
  try { await checkSlaEscalations(); } catch { /* swept again on next view */ }

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

  // Parallel approvals: the current wave's per-step breakdown (who's
  // approved, who's still pending, who's overdue) — empty for instances that
  // predate this enhancement and never advanced through a tracked wave.
  const approvals = await getInstanceApprovals(id);

  res.json({ success: true, data: { ...rows[0], logs, approvals } });
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

  await withTransaction(async (conn) => {
    await conn.query(
      'UPDATE workflow_master SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, description, is_active, id]
    );

    if (steps && Array.isArray(steps)) {
      const stepsWithOrder = steps.map((step, i) => ({ ...step, step_order: step.step_order ?? i + 1 }));
      validateStepDefinitions(stepsWithOrder);

      await conn.query('DELETE FROM workflow_steps WHERE workflow_id = ?', [id]);
      for (const step of stepsWithOrder) {
        if (!step.step_name || !step.approver_role) throw new ValidationError('Each step requires step_name and approver_role');
        await conn.query(
          `INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours, condition_rule, is_parallel, escalation_role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), id, step.step_order, step.step_name, step.approver_role, step.sla_hours ?? 24,
            step.condition_rule ? JSON.stringify(step.condition_rule) : null, !!step.is_parallel, step.escalation_role || null,
          ]
        );
      }
    }
  });

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

// POST /api/workflow/:id/instances — kick off a new instance of a workflow
// (any authenticated role). `context` — { total_value, category,
// vendor_risk_level } — is what conditional steps (value/category/vendor
// risk) evaluate against; omitting it just means every conditional step is
// skipped (since a condition referencing missing context never matches).
router.post('/:id/instances', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { module_name, record_id, context } = req.body;

  const missing = [];
  if (!module_name) missing.push('module_name');
  if (!record_id) missing.push('record_id');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const result = await createWorkflowInstance(id, module_name, record_id, req.user.id, context || null);
  res.status(201).json({ success: true, data: { id: result.instance_id, ...result } });
}));

// POST /api/workflow/instances/:id/advance — approve or reject one step
// within the instance's current wave. Parallel approvals: if the current
// wave has multiple steps (is_parallel), every one of them must approve
// (AND-join) before the instance moves on; any single rejection fails the
// whole instance immediately. Only the role assigned as that step's
// approver_role (or mdm_admin, as the platform's top-level override) may act
// on it — otherwise any authenticated user could approve/reject
// business-critical workflow steps they have no authority over.
router.post('/instances/:id/advance', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, remarks, step_id } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    throw new ValidationError("action must be 'approve' or 'reject'");
  }

  const [[instance]] = await pool.query('SELECT * FROM workflow_instances WHERE id = ?', [id]);
  if (!instance) throw new NotFoundError('Workflow instance not found');

  // Sequential (non-parallel) instances can omit step_id — it's
  // unambiguous which step is being acted on. A parallel wave requires it.
  const stepId = step_id || instance.current_step_id;
  if (!stepId) throw new ValidationError('step_id is required');

  const result = await withTransaction(conn => recordStepDecision(id, stepId, req.user.id, req.user.role, action, remarks, conn));
  res.json({
    success: true,
    message: result.status === 'rejected' ? 'Workflow instance rejected'
      : result.final ? 'Workflow instance approved'
      : result.wave_remaining ? `Recorded — ${result.wave_remaining} approval(s) still pending in this wave`
      : 'Advanced to next step',
    data: result,
  });
}));

// POST /api/workflow/escalations/check — manually run the SLA escalation
// sweep (also runs lazily from GET /instances).
router.post('/escalations/check', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const escalated = await checkSlaEscalations();
  res.json({ success: true, data: { escalated_count: escalated.length, escalated } });
}));

module.exports = router;
