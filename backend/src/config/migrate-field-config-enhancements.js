const mysql = require('mysql2/promise');
require('dotenv').config();

// Enhances Field Configuration with two opt-in, backward-compatible
// capabilities:
//
//  - Conditional mandatory fields: field_requirements.condition_rule (same
//    {field, operator, value}[] shape the Workflow Engine uses, AND-combined)
//    — a field becomes mandatory if its static is_mandatory flag is true OR
//    its condition matches the context the caller supplies. No
//    condition_rule means "static flag only" (unchanged existing behavior).
//  - Role-based visibility: field_requirements.visible_roles (JSON array of
//    role keys) — null/empty means visible to every role (unchanged existing
//    behavior); GET /field-config/:module/visibility is the new endpoint that
//    exposes this per the CALLING user's role.
//
// Seeds the one worked example from the spec: RFQ's optional "description"
// field (doubling as a written justification) becomes mandatory once the
// RFQ's value exceeds 10,00,000 (10 lakh).
async function migrateFieldConfigEnhancements() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [name, def] of [
    ['condition_rule', 'condition_rule JSON NULL'],
    ['visible_roles', 'visible_roles JSON NULL'],
  ]) {
    try {
      await connection.query(`ALTER TABLE field_requirements ADD COLUMN ${def}`);
      console.log(`  + field_requirements.${name}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  const [result] = await connection.query(
    `UPDATE field_requirements
     SET condition_rule = '[{"field":"total_value","operator":">","value":1000000}]'
     WHERE module_key = 'rfq' AND field_key = 'description'`
  );
  console.log(`  + seeded conditional rule on rfq.description (${result.affectedRows} row(s) updated)`);

  console.log('✅ Field configuration enhancements migration complete');
  await connection.end();
}

migrateFieldConfigEnhancements().catch(err => {
  console.error('Field configuration enhancements migration failed:', err);
  process.exit(1);
});
