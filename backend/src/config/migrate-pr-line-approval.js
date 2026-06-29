const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs Line-Level Approval for PR. Each pr_line_items row gains its own
// approval_status, independent of the requisition-wide status — a PR can now
// end up 'partially_approved' (an ENUM value the schema already had but no
// code ever set) when some lines are approved and others rejected.
// requires_line_approval is decided once at submit time (see
// determineLineApprovalRequirement in pr.helpers.js) from two configurable
// triggers seeded below: a line value threshold and an item-category list —
// the "workflow based on value/category" requirement.
async function migratePrLineApproval() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [name, def] of [
    ['approval_status', "approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'"],
    ['requires_line_approval', 'requires_line_approval BOOLEAN NOT NULL DEFAULT FALSE'],
    ['approved_by', 'approved_by VARCHAR(36) NULL'],
    ['approved_at', 'approved_at TIMESTAMP NULL'],
    ['rejection_remarks', 'rejection_remarks TEXT NULL'],
  ]) {
    try {
      await connection.query(`ALTER TABLE pr_line_items ADD COLUMN ${def}`);
      console.log(`  + pr_line_items.${name}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  // Backfill existing requisitions so this feature doesn't retroactively
  // reopen anything already settled — requires_line_approval stays FALSE
  // for all existing rows (it's a forward-looking gate, evaluated fresh on
  // the next submit of each PR), only approval_status is backfilled to
  // match the requisition's already-decided outcome.
  const [approvedResult] = await connection.query(`
    UPDATE pr_line_items pli
    JOIN purchase_requisitions pr ON pli.pr_id = pr.id
    SET pli.approval_status = 'approved'
    WHERE pr.status IN ('approved', 'partially_approved', 'sourcing', 'closed') AND pli.approval_status = 'pending'
  `);
  console.log(`  + backfilled approval_status='approved' on ${approvedResult.affectedRows} line(s) of already-approved requisitions`);

  const [rejectedResult] = await connection.query(`
    UPDATE pr_line_items pli
    JOIN purchase_requisitions pr ON pli.pr_id = pr.id
    SET pli.approval_status = 'rejected'
    WHERE pr.status = 'rejected' AND pli.approval_status = 'pending'
  `);
  console.log(`  + backfilled approval_status='rejected' on ${rejectedResult.affectedRows} line(s) of already-rejected requisitions`);

  for (const [key, value] of [
    ['pr_line_approval_value_threshold', '200000'],
    ['pr_line_approval_categories', ''],
  ]) {
    const [existing] = await connection.query('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
    if (existing.length === 0) {
      await connection.query(
        'INSERT INTO system_settings (id, setting_key, setting_value) VALUES (UUID(), ?, ?)',
        [key, value]
      );
      console.log(`  + system_settings.${key} = '${value}' (default)`);
    }
  }

  console.log('✅ PR line-level approval migration complete');
  await connection.end();
}

migratePrLineApproval().catch(err => {
  console.error('PR line-level approval migration failed:', err);
  process.exit(1);
});
