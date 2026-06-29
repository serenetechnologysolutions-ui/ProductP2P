const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs the new ProcurementInsightsService (backend/src/modules/insights/).
// Adds price_history.item_master_id so price benchmarking can be keyed off a
// stable item identity instead of the fuzzy item_description text matching
// that pricing.routes.js and the RFQ comparison endpoint still use. Existing
// rows that can't be backfilled unambiguously are left NULL and keep working
// exactly as before via their item_description — this migration is purely
// additive and changes no existing query's behavior.
async function migrateProcurementInsights() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  try {
    await connection.query('ALTER TABLE price_history ADD COLUMN item_master_id VARCHAR(36) NULL');
    console.log('  + price_history.item_master_id');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  try {
    await connection.query('ALTER TABLE price_history ADD INDEX idx_price_history_item_master (item_master_id)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }

  // Best-effort backfill: only where exactly one item_master row has this
  // exact (case/whitespace-insensitive) description, so we never guess.
  const [result] = await connection.query(`
    UPDATE price_history ph
    JOIN (
      SELECT LOWER(TRIM(item_description)) AS norm_description, MIN(id) AS item_master_id
      FROM item_master
      GROUP BY LOWER(TRIM(item_description))
      HAVING COUNT(*) = 1
    ) matched ON LOWER(TRIM(ph.item_description)) = matched.norm_description
    SET ph.item_master_id = matched.item_master_id
    WHERE ph.item_master_id IS NULL
  `);
  console.log(`  + price_history backfilled item_master_id on ${result.affectedRows} existing row(s)`);

  console.log('✅ Procurement insights migration complete');
  await connection.end();
}

migrateProcurementInsights().catch(err => {
  console.error('Procurement insights migration failed:', err);
  process.exit(1);
});
