const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// Module 12: generic audit_logs — distinct from PR's own pr_audit_log (which
// is a PR-specific narrative log of approvals/rejections/conversions); this
// is the cross-module one introduced for the Procurement OS modules
// (multi-company, payments, inventory, SAP sync) so they share one place to
// record who-changed-what rather than each inventing its own.
async function recordAudit(actorId, action, moduleName, recordId, beforeData, afterData, ipAddress, conn) {
  const c = conn || pool;
  await c.query(
    'INSERT INTO audit_logs (id, actor_id, action, module_name, record_id, before_data, after_data, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), actorId || null, action, moduleName, recordId || null, beforeData ? JSON.stringify(beforeData) : null, afterData ? JSON.stringify(afterData) : null, ipAddress || null]
  );
}

module.exports = { recordAudit };
