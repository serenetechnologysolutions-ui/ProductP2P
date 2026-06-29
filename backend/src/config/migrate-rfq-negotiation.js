const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs Multi-Round RFQ Negotiation. vendor_bids previously had a UNIQUE
// KEY on (rfq_id, vendor_id) and every "revise bid" call overwrote the same
// row in place — no history survived past the latest revision. This widens
// the key to (rfq_id, vendor_id, round_number) so each negotiation round's
// bid persists as its own permanent row once the round advances (see
// POST /rfq/:id/negotiate), while a vendor can still freely revise their bid
// in place within the *current* round (existing behavior, unchanged).
async function migrateRfqNegotiation() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  try {
    await connection.query("ALTER TABLE rfqs ADD COLUMN current_round INT NOT NULL DEFAULT 1");
    console.log('  + rfqs.current_round');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  // Widening an ENUM by adding a value is additive and backward compatible.
  await connection.query(
    "ALTER TABLE rfqs MODIFY COLUMN status ENUM('draft','published','closed','negotiation','awarded') DEFAULT 'draft'"
  );
  console.log("  + rfqs.status: added 'negotiation'");

  try {
    await connection.query("ALTER TABLE vendor_bids ADD COLUMN round_number INT NOT NULL DEFAULT 1");
    console.log('  + vendor_bids.round_number');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  // Replace the single-round unique key with a per-round one. Existing rows
  // all default to round_number = 1, so this is a safe, lossless rename of
  // what the constraint actually covers. Must ADD the new index before
  // DROPping the old one — uq_rfq_bid backs a foreign key, and MySQL refuses
  // to drop the only index satisfying that FK (ER_DROP_INDEX_FK) even though
  // a replacement is about to take its place; adding first means there's
  // always at least one valid index for the FK at every point in time.
  try {
    await connection.query('ALTER TABLE vendor_bids ADD UNIQUE KEY uq_rfq_bid_round (rfq_id, vendor_id, round_number)');
    console.log('  + vendor_bids.uq_rfq_bid_round (rfq_id, vendor_id, round_number)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }
  try {
    await connection.query('ALTER TABLE vendor_bids DROP INDEX uq_rfq_bid');
    console.log('  - vendor_bids.uq_rfq_bid (replaced above)');
  } catch (err) {
    if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw err;
  }

  console.log('✅ RFQ negotiation migration complete');
  await connection.end();
}

migrateRfqNegotiation().catch(err => {
  console.error('RFQ negotiation migration failed:', err);
  process.exit(1);
});
