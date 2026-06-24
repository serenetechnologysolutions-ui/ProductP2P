const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// PR module seed: a default single-step approval workflow (Procurement Admin
// only — no MDM step, per policy) + a catch-all approval rule (guarantees
// every submitted PR resolves to *some* workflow even before an admin
// configures department/value-specific rules), the three PR-related system
// settings, and a couple of sample budget allocations for manual testing.
// Safe to re-run (existence-checked before each insert).
async function seedPR() {
  const conn = await pool.getConnection();
  try {
    const [existingWorkflow] = await conn.query(
      "SELECT id FROM workflow_master WHERE module_name = 'purchase_requisition' AND is_active = TRUE LIMIT 1"
    );

    let workflowId;
    if (existingWorkflow.length > 0) {
      workflowId = existingWorkflow[0].id;
    } else {
      workflowId = uuidv4();
      await conn.query(
        'INSERT INTO workflow_master (id, name, module_name, description, created_by) VALUES (?, ?, ?, ?, ?)',
        [workflowId, 'Purchase Requisition Approval (Procurement Only)', 'purchase_requisition', 'Single-step approval — Procurement Admin only, no MDM step', null]
      );
      await conn.query(
        'INSERT INTO workflow_steps (id, workflow_id, step_order, step_name, approver_role, sla_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), workflowId, 1, 'Procurement Review', 'procurement_admin', 24]
      );
      console.log('  + workflow_master: Purchase Requisition Approval (Procurement Only) — 1 step');
    }

    const [existingRule] = await conn.query(
      'SELECT id FROM pr_approval_rules WHERE document_type IS NULL AND department IS NULL AND min_value IS NULL AND max_value IS NULL'
    );
    if (existingRule.length === 0) {
      await conn.query(
        'INSERT INTO pr_approval_rules (id, document_type, department, min_value, max_value, workflow_id, is_active) VALUES (?, NULL, NULL, NULL, NULL, ?, TRUE)',
        [uuidv4(), workflowId]
      );
      console.log('  + pr_approval_rules: catch-all rule');
    }

    const settings = [
      { key: 'pr_number_prefix', value: 'PR' },
      { key: 'pr_rfq_threshold_value', value: '500000' },
      { key: 'pr_budget_enforcement', value: 'soft' },
      // 'false' by default so the existing direct-PO flow keeps working until an
      // admin deliberately opts into strict PR/RFQ-only PO creation.
      { key: 'po_require_pr_reference', value: 'false' },
    ];
    for (const s of settings) {
      const [exists] = await conn.query('SELECT id FROM system_settings WHERE setting_key = ?', [s.key]);
      if (exists.length === 0) {
        await conn.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (?, ?, ?)', [uuidv4(), s.key, s.value]);
      }
    }
    console.log('  + system_settings: pr_number_prefix, pr_rfq_threshold_value, pr_budget_enforcement, po_require_pr_reference');

    const fiscalYear = String(new Date().getFullYear());
    const allocations = [
      { cost_center: 'CC-PROC-01', allocated_amount: 2000000 },
      { cost_center: 'CC-FIN-01', allocated_amount: 1000000 },
      { cost_center: 'CC-OPS-01', allocated_amount: 1500000 },
    ];
    let allocInserted = 0;
    for (const a of allocations) {
      const [exists] = await conn.query(
        'SELECT id FROM budget_allocations WHERE cost_center = ? AND fiscal_year = ?',
        [a.cost_center, fiscalYear]
      );
      if (exists.length === 0) {
        await conn.query(
          'INSERT INTO budget_allocations (id, cost_center, fiscal_year, allocated_amount, consumed_amount) VALUES (?, ?, ?, ?, 0)',
          [uuidv4(), a.cost_center, fiscalYear, a.allocated_amount]
        );
        allocInserted++;
      }
    }
    console.log(`  + budget_allocations: ${allocInserted} new of ${allocations.length} sample rows for FY${fiscalYear}`);

    console.log('✅ PR seed complete');
  } finally {
    conn.release();
    await pool.end();
  }
}

seedPR().catch(err => { console.error('PR seed failed:', err); process.exit(1); });
