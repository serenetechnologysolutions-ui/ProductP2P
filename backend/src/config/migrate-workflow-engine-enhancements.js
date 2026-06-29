const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Enhances the generic Workflow Engine with three capabilities, all opt-in
// and backward compatible with every existing workflow definition:
//
//  - Conditional workflows: workflow_steps.condition_rule (JSON array of
//    {field, operator, value}, AND-combined) — a step with no condition_rule
//    always applies (unchanged behavior); a step whose condition doesn't
//    match the instance's context is skipped entirely, not blocking.
//  - Parallel approvals: workflow_steps.is_parallel lets multiple steps share
//    one step_order — all of them must approve (AND-join) before the
//    instance advances; any one rejecting fails the whole instance.
//  - SLA escalation: workflow_steps.sla_hours already existed but nothing
//    read it — now used to compute workflow_instance_step_approvals.sla_due_at,
//    swept by checkSlaEscalations() into a tracked 'sla_breach' exception and
//    escalation_role for visibility.
//
// workflow_instance_step_approvals is the new per-wave tracking table —
// previously a single current_step_id on workflow_instances could only ever
// represent ONE step being acted on; with parallel steps there can be several
// simultaneously, each independently decided.
async function migrateWorkflowEngineEnhancements() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  async function addColumnIfMissing(table, columnDef, columnName) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`  + ${table}.${columnName}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  await addColumnIfMissing('workflow_steps', 'condition_rule JSON NULL', 'condition_rule');
  await addColumnIfMissing('workflow_steps', 'is_parallel BOOLEAN NOT NULL DEFAULT FALSE', 'is_parallel');
  await addColumnIfMissing('workflow_steps', 'escalation_role VARCHAR(100) NULL', 'escalation_role');

  await addColumnIfMissing('workflow_instances', 'current_step_order INT NULL', 'current_step_order');
  await addColumnIfMissing('workflow_instances', 'context JSON NULL', 'context');

  // The old UNIQUE key assumed exactly one step per step_order — no longer
  // true once is_parallel allows several. Replaced with a plain index;
  // collision prevention for non-parallel steps is enforced at the API layer.
  // Must ADD the replacement index before DROPping the old one — the old key
  // backs a foreign key, and MySQL refuses to drop the only index satisfying
  // an FK (ER_DROP_INDEX_FK) even mid-script with a replacement coming right
  // after; adding first means there's always a valid index for the FK.
  try {
    await connection.query('ALTER TABLE workflow_steps ADD INDEX idx_workflow_step_order (workflow_id, step_order)');
    console.log('  + workflow_steps.idx_workflow_step_order');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }
  try {
    await connection.query('ALTER TABLE workflow_steps DROP INDEX uq_workflow_step_order');
    console.log('  - workflow_steps.uq_workflow_step_order (replaced above)');
  } catch (err) {
    if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw err;
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_instance_step_approvals (
      id VARCHAR(36) PRIMARY KEY,
      instance_id VARCHAR(36) NOT NULL,
      step_id VARCHAR(36) NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      actor_id VARCHAR(36) NULL,
      remarks TEXT NULL,
      sla_due_at TIMESTAMP NULL,
      escalated BOOLEAN NOT NULL DEFAULT FALSE,
      escalated_at TIMESTAMP NULL,
      decided_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES workflow_steps(id),
      INDEX idx_wisa_instance (instance_id),
      INDEX idx_wisa_pending_sla (status, sla_due_at)
    )
  `);
  console.log('  + workflow_instance_step_approvals table');

  // Continuity backfill: every currently in_progress instance gets a pending
  // approval row for whichever step it's sitting on right now, so the new
  // per-wave model has something to track immediately rather than only for
  // instances created after this migration. sla_due_at is computed from NOW()
  // since the exact moment the current step actually started isn't recorded
  // anywhere prior to this migration — an approximation, not a guess at history.
  const [inProgress] = await connection.query(
    "SELECT i.id as instance_id, i.current_step_id, s.step_order, s.sla_hours FROM workflow_instances i JOIN workflow_steps s ON i.current_step_id = s.id WHERE i.status = 'in_progress'"
  );
  let backfilled = 0;
  for (const row of inProgress) {
    const [[{ cnt }]] = await connection.query(
      'SELECT COUNT(*) as cnt FROM workflow_instance_step_approvals WHERE instance_id = ? AND step_id = ?',
      [row.instance_id, row.current_step_id]
    );
    if (cnt > 0) continue;
    const slaDueAt = row.sla_hours != null ? new Date(Date.now() + row.sla_hours * 3600 * 1000) : null;
    await connection.query(
      'INSERT INTO workflow_instance_step_approvals (id, instance_id, step_id, status, sla_due_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), row.instance_id, row.current_step_id, 'pending', slaDueAt]
    );
    await connection.query('UPDATE workflow_instances SET current_step_order = ? WHERE id = ?', [row.step_order, row.instance_id]);
    backfilled++;
  }
  console.log(`  + backfilled current-step approval tracking for ${backfilled} in-progress instance(s)`);

  // Widening an ENUM by adding a value is additive and backward compatible.
  await connection.query(
    "ALTER TABLE procurement_exceptions MODIFY COLUMN exception_type ENUM('budget_breach','price_mismatch','quantity_mismatch','vendor_risk','compliance_expiry','grn_tolerance_breach','invoice_mismatch','sla_breach') NOT NULL"
  );
  console.log("  + procurement_exceptions.exception_type: added sla_breach");

  console.log('✅ Workflow engine enhancements migration complete');
  await connection.end();
}

migrateWorkflowEngineEnhancements().catch(err => {
  console.error('Workflow engine enhancements migration failed:', err);
  process.exit(1);
});
