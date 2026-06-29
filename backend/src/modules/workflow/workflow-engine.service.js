const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { withTransaction } = require('../../common/db');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { raiseException } = require('../exceptions/exceptions.service');
const { evaluateConditions } = require('../../common/conditions');
const { logger } = require('../../common/logger');

// ─── Conditional Workflows ───────────────────────────────────────────────────
// condition_rule on a step is a JSON array of {field, operator, value},
// AND-combined (see ../../common/conditions, shared with Field
// Configuration) — every clause must pass for the step to apply. No
// condition_rule (null/empty) means "always applies", so every workflow
// defined before this enhancement keeps behaving exactly as it did.

// Validates a workflow definition's step list before it's persisted —
// non-parallel steps can't share a step_order (ambiguous: which one is
// "the" step at that order?), and every parallel group must use the same
// approver_role only when that's actually intended (not enforced — a
// parallel group of DIFFERENT roles approving simultaneously is valid and
// is exactly what "parallel approvals" usually means in practice).
function validateStepDefinitions(steps) {
  const byOrder = {};
  steps.forEach(s => { (byOrder[s.step_order] ||= []).push(s); });
  for (const [order, group] of Object.entries(byOrder)) {
    if (group.length > 1 && group.some(s => !s.is_parallel)) {
      throw new ValidationError(`Step order ${order} has multiple steps but isn't marked is_parallel on all of them`);
    }
  }
}

// ─── Instance lifecycle (conditional + parallel aware) ──────────────────────

// Inserts a workflow_instance_step_approvals row per applicable step at the
// given order, with sla_due_at computed from each step's sla_hours.
async function openWave(instanceId, stepsAtOrder, conn) {
  const c = conn || pool;
  for (const step of stepsAtOrder) {
    const slaDueAt = step.sla_hours != null ? new Date(Date.now() + Number(step.sla_hours) * 3600 * 1000) : null;
    await c.query(
      'INSERT INTO workflow_instance_step_approvals (id, instance_id, step_id, status, sla_due_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), instanceId, step.id, 'pending', slaDueAt]
    );
  }
}

// Finds the next step_order (after `afterOrder`) with at least one applicable
// step given `context`, opens a wave for it, and updates the instance
// pointer. Order groups where every step's condition fails are skipped
// entirely (not blocking) — recurses forward until an applicable wave is
// found or the workflow runs out of steps, in which case the instance is
// fully approved.
async function advanceToNextWave(instance, workflowId, afterOrder, context, actorId, conn) {
  const c = conn || pool;
  const [allSteps] = await c.query(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? AND step_order > ? ORDER BY step_order',
    [workflowId, afterOrder]
  );
  const orders = [...new Set(allSteps.map(s => s.step_order))];

  for (const order of orders) {
    const stepsAtOrder = allSteps.filter(s => s.step_order === order);
    const applicable = stepsAtOrder.filter(s => evaluateConditions(s.condition_rule, context));
    if (applicable.length === 0) continue;

    await openWave(instance.id, applicable, c);
    await c.query('UPDATE workflow_instances SET current_step_order = ?, current_step_id = ? WHERE id = ?', [order, applicable[0].id, instance.id]);
    await c.query(
      'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), instance.id, applicable[0].id, 'started', actorId || null, applicable.length > 1 ? `Parallel wave of ${applicable.length} approver(s) started` : null]
    );
    return { final: false, step_order: order, steps: applicable };
  }

  await c.query("UPDATE workflow_instances SET status = 'approved', completed_at = NOW(), current_step_id = NULL, current_step_order = NULL WHERE id = ?", [instance.id]);
  await c.query('INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id) VALUES (?, ?, ?, ?, ?)', [uuidv4(), instance.id, null, 'approved', actorId || null]);
  return { final: true, status: 'approved' };
}

// Creates a new instance and opens its first applicable wave. `context` —
// { total_value, category, vendor_risk_level } — is stored on the instance
// so later waves (and SLA/condition re-evaluation) use the same snapshot the
// instance started with, rather than a value that could drift mid-flight.
async function createWorkflowInstance(workflowId, moduleName, recordId, actorId, context, conn) {
  const c = conn || pool;
  const [[workflow]] = await c.query('SELECT id FROM workflow_master WHERE id = ? AND is_active = TRUE', [workflowId]);
  if (!workflow) throw new NotFoundError('Workflow not found');

  const instanceId = uuidv4();
  await c.query(
    'INSERT INTO workflow_instances (id, workflow_id, module_name, record_id, initiated_by, context) VALUES (?, ?, ?, ?, ?, ?)',
    [instanceId, workflowId, moduleName, recordId, actorId, context ? JSON.stringify(context) : null]
  );

  const wave = await advanceToNextWave({ id: instanceId }, workflowId, 0, context, actorId, c);
  return { instance_id: instanceId, ...wave };
}

// Records one approver's decision on one step within the current wave.
// Parallel AND-join: rejecting fails the whole instance immediately
// (fail-fast); approving only advances once every step in the current wave
// has approved. Returns the wave/finalization result so callers (e.g. PR's
// own approve handler) can react to "fully approved" without duplicating
// the advance logic themselves.
async function recordStepDecision(instanceId, stepId, actorId, actorRole, action, remarks, conn) {
  const c = conn || pool;
  const [[instance]] = await c.query('SELECT * FROM workflow_instances WHERE id = ?', [instanceId]);
  if (!instance) throw new NotFoundError('Workflow instance not found');
  if (instance.status !== 'in_progress') throw new ValidationError(`Instance is not in progress (status: ${instance.status})`);

  const [[step]] = await c.query('SELECT * FROM workflow_steps WHERE id = ?', [stepId]);
  if (!step) throw new NotFoundError('Workflow step not found');
  if (actorRole !== 'mdm_admin' && step.approver_role !== actorRole) {
    throw new AuthorizationError(`This step requires approver role '${step.approver_role}'`);
  }

  const [[approval]] = await c.query(
    "SELECT * FROM workflow_instance_step_approvals WHERE instance_id = ? AND step_id = ? AND status = 'pending'",
    [instanceId, stepId]
  );
  if (!approval) throw new ValidationError('No pending approval found for this step on this instance');

  await c.query(
    'UPDATE workflow_instance_step_approvals SET status = ?, actor_id = ?, remarks = ?, decided_at = NOW() WHERE id = ?',
    [action === 'reject' ? 'rejected' : 'approved', actorId, remarks || null, approval.id]
  );
  await c.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), instanceId, stepId, action === 'reject' ? 'rejected' : 'approved', actorId, remarks || null]
  );

  if (action === 'reject') {
    await c.query("UPDATE workflow_instances SET status = 'rejected', completed_at = NOW() WHERE id = ?", [instanceId]);
    return { final: true, status: 'rejected' };
  }

  const [pendingInWave] = await c.query(
    "SELECT id FROM workflow_instance_step_approvals WHERE instance_id = ? AND status = 'pending'",
    [instanceId]
  );
  // Steps in a parallel wave were all opened together; any still pending
  // here belongs to the same wave (a new wave only opens once the prior one
  // is fully resolved), so this check alone correctly implements the AND-join.
  if (pendingInWave.length > 0) {
    return { final: false, status: 'in_progress', wave_remaining: pendingInWave.length };
  }

  const context = instance.context ? (typeof instance.context === 'string' ? JSON.parse(instance.context) : instance.context) : null;
  const wave = await advanceToNextWave(instance, instance.workflow_id, instance.current_step_order, context, actorId, c);
  return wave.final ? { final: true, status: 'approved' } : { final: false, status: 'in_progress', step_order: wave.step_order };
}

// True if recording an approval on `stepId` right now would finalize the
// instance (no other parallel approval still pending in this wave, and no
// further applicable step after it). Callers that need to gate finalization
// on their own additional business rules (e.g. PR's Line-Level Approval)
// check this BEFORE calling recordStepDecision, so a failed gate never
// leaves a half-recorded approval behind.
async function wouldFinalizeOnApproval(instanceId, stepId, conn) {
  const c = conn || pool;
  const [[instance]] = await c.query('SELECT * FROM workflow_instances WHERE id = ?', [instanceId]);
  if (!instance) throw new NotFoundError('Workflow instance not found');

  const [otherPending] = await c.query(
    "SELECT id FROM workflow_instance_step_approvals WHERE instance_id = ? AND step_id != ? AND status = 'pending'",
    [instanceId, stepId]
  );
  if (otherPending.length > 0) return false;

  const context = instance.context ? (typeof instance.context === 'string' ? JSON.parse(instance.context) : instance.context) : null;
  const [futureSteps] = await c.query(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? AND step_order > ? ORDER BY step_order',
    [instance.workflow_id, instance.current_step_order]
  );
  return !futureSteps.some(s => evaluateConditions(s.condition_rule, context));
}

async function getInstanceApprovals(instanceId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT wisa.*, ws.step_name, ws.approver_role, ws.step_order, ws.escalation_role, u.full_name as actor_name
     FROM workflow_instance_step_approvals wisa
     LEFT JOIN workflow_steps ws ON wisa.step_id = ws.id
     LEFT JOIN users u ON wisa.actor_id = u.id
     WHERE wisa.instance_id = ? ORDER BY ws.step_order, wisa.created_at`,
    [instanceId]
  );
  return rows;
}

// ─── SLA Escalation ──────────────────────────────────────────────────────────
// No background scheduler exists in this codebase — this is swept on demand
// (POST /api/workflow/escalations/check, and lazily from GET /instances) the
// same way vendor compliance/lifecycle state is recomputed on read rather
// than via a cron job.
async function checkSlaEscalations(conn) {
  const c = conn || pool;
  const [overdue] = await c.query(
    `SELECT wisa.*, ws.step_name, ws.approver_role, ws.escalation_role, wi.module_name, wi.record_id, wi.id as instance_id
     FROM workflow_instance_step_approvals wisa
     JOIN workflow_steps ws ON wisa.step_id = ws.id
     JOIN workflow_instances wi ON wisa.instance_id = wi.id
     WHERE wisa.status = 'pending' AND wisa.escalated = FALSE AND wisa.sla_due_at IS NOT NULL AND wisa.sla_due_at < NOW()`
  );

  // Each row gets its own transaction (mark escalated + raise exception
  // together) rather than one transaction for the whole sweep — a failure on
  // one overdue row shouldn't undo escalations already recorded for others,
  // and one bad row shouldn't abort the rest of the sweep either.
  const escalated = [];
  for (const row of overdue) {
    try {
      await withTransaction(async (rowConn) => {
        await rowConn.query('UPDATE workflow_instance_step_approvals SET escalated = TRUE, escalated_at = NOW() WHERE id = ?', [row.id]);
        const hoursOverdue = Math.round((Date.now() - new Date(row.sla_due_at).getTime()) / 3600000);
        await raiseException({
          exception_type: 'sla_breach',
          severity: hoursOverdue > 48 ? 'critical' : hoursOverdue > 24 ? 'high' : 'medium',
          module_name: row.module_name,
          record_id: row.record_id,
          title: `SLA breach: ${row.step_name}`,
          message: `"${row.step_name}" (approver role: ${row.approver_role}) is ${hoursOverdue}h overdue.${row.escalation_role ? ` Escalated to ${row.escalation_role}.` : ''}`,
          metadata: { instance_id: row.instance_id, step_id: row.step_id, hours_overdue: hoursOverdue, escalation_role: row.escalation_role || null },
          dedup_key: `sla_breach:approval:${row.id}`,
        }, rowConn);
        escalated.push({ instance_id: row.instance_id, step_name: row.step_name, hours_overdue: hoursOverdue, escalation_role: row.escalation_role || null });
      });
    } catch (err) {
      logger.error('SLA escalation failed for one approval row', { approvalId: row.id, error: err.message });
    }
  }
  return escalated;
}

module.exports = {
  evaluateConditions,
  validateStepDefinitions,
  createWorkflowInstance,
  recordStepDecision,
  advanceToNextWave,
  wouldFinalizeOnApproval,
  getInstanceApprovals,
  checkSlaEscalations,
};
