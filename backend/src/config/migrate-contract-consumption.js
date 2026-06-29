const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs Contract Consumption Tracking. contract_value already existed;
// consumed_value is new and accumulates as POs are created against a
// contract (see contracts.service.js). remaining_value is deliberately NOT
// stored — it's always computed as contract_value - consumed_value (same
// pattern as budget_allocations' remaining), so the two numbers can never
// drift out of sync. default_unit_price is the "use contract price as
// default" field — an optional flat rate a simple rate-card contract can
// carry, applied to PO lines that don't specify their own unit_price.
async function migrateContractConsumption() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [name, def] of [
    ['consumed_value', 'consumed_value DECIMAL(15,2) NOT NULL DEFAULT 0'],
    ['default_unit_price', 'default_unit_price DECIMAL(15,2) NULL'],
  ]) {
    try {
      await connection.query(`ALTER TABLE contracts ADD COLUMN ${def}`);
      console.log(`  + contracts.${name}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  // Backfill consumed_value from POs already linked to each contract — exact
  // (a straight SUM, unlike the Budget Commitment Model's stage ambiguity),
  // so this is safe to compute rather than leaving every existing contract
  // at 0 regardless of POs already issued against it.
  const [result] = await connection.query(`
    UPDATE contracts c
    SET c.consumed_value = (
      SELECT COALESCE(SUM(po.total_amount), 0) FROM purchase_orders po WHERE po.contract_id = c.id
    )
  `);
  console.log(`  + backfilled consumed_value on ${result.affectedRows} contract(s) from existing POs`);

  console.log('✅ Contract consumption migration complete');
  await connection.end();
}

migrateContractConsumption().catch(err => {
  console.error('Contract consumption migration failed:', err);
  process.exit(1);
});
