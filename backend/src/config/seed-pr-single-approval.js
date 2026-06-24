const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Policy change: PR approval no longer requires a second "MDM Final Approval"
// step — Procurement Admin's sign-off is sufficient. The original 2-step
// workflow definition is left in place (its history is referenced by
// existing workflow_logs/instances), but is deactivated and replaced for new
// submissions by a new 1-step workflow. Any PR currently stuck waiting on the
// now-removed second step is fast-tracked to 'approved'. Safe to re-run.
async function seedPrSingleApproval() {
  const conn = await pool.getConnection();
  try {
    const [oldWorkflows] = await conn.query(
      "SELECT id FROM workflow_master WHERE module_name = 'purchase_requisition' AND is_active = TRUE"
    );

    let newWorkflowId = null;
    const [existingSingleStep] = await conn.query(
      `SELECT wm.id FROM workflow_master wm
       WHERE wm.module_name = 'purchase_requisition' AND wm.name = 'Purchase Requisition Approval (Procurement Only)'`
    );

    if (existingSingleStep.length > 0) {
      newWorkflowId = existingSingleStep[0].id;
    } else {
      newWorkflowId = uuidv4();
      await conn.query(
        'INSERT INTO workflow_master (id, name, module_name, description, created_by) VALUES (?, ?, ?, ?, ?)',
        [newWorkflowId, 'Purchase Requisition Approval (Procurement Only)', 'purchase_requisition', 'Single-step approval — Procurement Admin only, no MDM step', null]
      );
      await conn.query(
        'INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), newWorkflowId, 1, 'Procurement Review', 'procurement_admin', 24]
      );
      console.log('  + workflow_master: Purchase Requisition Approval (Procurement Only) — 1 step');
    }

    // Repoint every active approval rule that was using a 2-step (or any
    // other) PR workflow to the new single-step one.
    const [rules] = await conn.query(
      "SELECT id, workflow_id FROM pr_approval_rules WHERE is_active = TRUE AND workflow_id != ?",
      [newWorkflowId]
    );
    for (const rule of rules) {
      await conn.query('UPDATE pr_approval_rules SET workflow_id = ? WHERE id = ?', [newWorkflowId, rule.id]);
    }
    if (rules.length > 0) console.log(`  + repointed ${rules.length} pr_approval_rules row(s) to the single-step workflow`);

    // Deactivate the old 2-step workflow(s) so they no longer appear as a
    // selectable active definition (history is preserved, not deleted).
    for (const wf of oldWorkflows) {
      if (wf.id !== newWorkflowId) {
        await conn.query('UPDATE workflow_master SET is_active = FALSE WHERE id = ?', [wf.id]);
      }
    }

    // Fast-track any PR currently stuck waiting on a since-removed second
    // step — Procurement Review (the only step that still matters) was
    // already approved, so the instance is complete under the new policy.
    const [stuckInstances] = await conn.query(`
      SELECT wi.id as instance_id, wi.current_step_id, pr.id as pr_id, pr.pr_number
      FROM workflow_instances wi
      JOIN purchase_requisitions pr ON pr.workflow_instance_id = wi.id
      JOIN workflow_steps s ON wi.current_step_id = s.id
      WHERE wi.module_name = 'purchase_requisition' AND wi.status = 'in_progress' AND s.step_order > 1
    `);

    for (const row of stuckInstances) {
      await conn.query(
        "UPDATE workflow_instances SET status = 'approved', completed_at = NOW(), current_step_id = NULL WHERE id = ?",
        [row.instance_id]
      );
      await conn.query(
        'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), row.instance_id, row.current_step_id, 'approved', null, 'Auto-approved — second approval step removed from policy']
      );
      await conn.query("UPDATE purchase_requisitions SET status = 'approved' WHERE id = ?", [row.pr_id]);
      await conn.query(
        'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), row.pr_id, 'approved', null, 'Auto-approved — second approval step removed from policy']
      );
      console.log(`  + fast-tracked ${row.pr_number} to approved`);
    }

    console.log(`✅ PR single-approval policy applied (${stuckInstances.length} PR(s) unblocked)`);
  } finally {
    conn.release();
    await pool.end();
  }
}

seedPrSingleApproval().catch(err => { console.error('PR single-approval seed failed:', err); process.exit(1); });
