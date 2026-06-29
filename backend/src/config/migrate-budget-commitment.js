const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs the Budget Commitment Model. Extends the existing budget_allocations
// table (allocated_amount, consumed_amount already existed and are unchanged)
// with the two missing stages of the funnel:
//   allocated -> committed (PR approved) -> consumed (PO created) -> actual (ASN posted)
// committed_amount and actual_amount both start at 0 for every existing row —
// they're new tracking dimensions going forward. Reconstructing historical
// committed/actual values from past PRs/ASNs is *not* attempted here (it
// would require re-walking all historical PR/PO/ASN data and risks producing
// numbers that look authoritative but are guesses) — see Known Limitations.
async function migrateBudgetCommitment() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [name, def] of [
    ['committed_amount', 'committed_amount DECIMAL(15,2) NOT NULL DEFAULT 0'],
    ['actual_amount', 'actual_amount DECIMAL(15,2) NOT NULL DEFAULT 0'],
  ]) {
    try {
      await connection.query(`ALTER TABLE budget_allocations ADD COLUMN ${def}`);
      console.log(`  + budget_allocations.${name}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  // purchase_orders.cost_center already exists (manual PO creation sets it
  // directly) but PR-derived POs never populated it — pr.routes.js's
  // createPoFromPr() now sets it going forward; this backfills existing rows
  // from their source PR so every PO is self-sufficient for budget tracking.
  const [result] = await connection.query(`
    UPDATE purchase_orders po
    JOIN purchase_requisitions pr ON po.pr_id = pr.id
    SET po.cost_center = pr.cost_center
    WHERE po.cost_center IS NULL AND pr.cost_center IS NOT NULL
  `);
  console.log(`  + backfilled cost_center on ${result.affectedRows} PR-derived PO(s)`);

  console.log('✅ Budget commitment migration complete');
  await connection.end();
}

migrateBudgetCommitment().catch(err => {
  console.error('Budget commitment migration failed:', err);
  process.exit(1);
});
