const { pool } = require('../../config/database');
const { ValidationError } = require('../../common/errors');
const { raiseException, autoResolve } = require('../exceptions/exceptions.service');

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

async function getAlertDays(conn) {
  const c = conn || pool;
  const [rows] = await c.query("SELECT setting_value FROM system_settings WHERE setting_key = 'vendor_compliance_alert_days'");
  return rows.length > 0 ? Number(rows[0].setting_value) : 30;
}

// Computes per-document expiry status for one vendor against the configured
// alert window. This is the single definition of "expired"/"expiring soon" —
// reused by the lifecycle auto-block check, the RFQ/PR usability guard, and
// the read-only GET /vendors/:id/compliance endpoint, so all three always agree.
async function getComplianceStatus(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT compliance_expiry_dates FROM vendors WHERE id = ?', [vendorId]);
  if (rows.length === 0) return { is_blocked: false, alert_days: await getAlertDays(c), documents: [] };

  const alertDays = await getAlertDays(c);
  const dates = parseMaybeJson(rows[0].compliance_expiry_dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const documents = Object.entries(dates)
    .filter(([, date]) => !!date)
    .map(([label, date]) => {
      const expiryDate = new Date(date);
      const daysRemaining = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      let status = 'ok';
      if (daysRemaining < 0) status = 'expired';
      else if (daysRemaining <= alertDays) status = 'expiring_soon';
      return { label, expiry_date: date, days_remaining: daysRemaining, status };
    });

  return { is_blocked: documents.some(d => d.status === 'expired'), alert_days: alertDays, documents };
}

// Raises a `compliance_expiry` exception per expired/expiring document (or
// auto-resolves one that's no longer a problem) — called from
// vendor.routes.js's syncLifecycleStage(), so this stays current on every
// vendor save/status-change without needing a separate scheduled job (there
// isn't one anywhere in this app — see Known Limitations).
async function syncComplianceExceptions(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT vendor_name FROM vendors WHERE id = ?', [vendorId]);
  const vendorName = rows[0]?.vendor_name || vendorId;
  const status = await getComplianceStatus(vendorId, c);

  for (const doc of status.documents) {
    const dedupKey = `compliance_expiry:vendor:${vendorId}:${doc.label}`;
    if (doc.status === 'ok') {
      await autoResolve(dedupKey, `${doc.label} is no longer expired or within the alert window`, c);
      continue;
    }
    await raiseException({
      exception_type: 'compliance_expiry',
      severity: doc.status === 'expired' ? 'critical' : 'medium',
      module_name: 'vendor',
      record_id: vendorId,
      vendor_id: vendorId,
      title: `${doc.status === 'expired' ? 'Expired' : 'Expiring soon'}: ${doc.label} — ${vendorName}`,
      message: `${doc.label} ${doc.status === 'expired' ? 'expired' : 'expires'} on ${doc.expiry_date} (${Math.abs(doc.days_remaining)} day(s) ${doc.status === 'expired' ? 'overdue' : 'remaining'}).`,
      metadata: doc,
      dedup_key: dedupKey,
    }, c);
  }

  return status;
}

// Guard for RFQ vendor invites / PR preferred-vendor selection / PO vendor
// resolution — throws with the specific expired document(s) named, rather
// than silently dropping the vendor, so the caller gets an actionable reason.
async function assertVendorUsable(vendorId, conn) {
  const status = await getComplianceStatus(vendorId, conn);
  if (status.is_blocked) {
    const expired = status.documents.filter(d => d.status === 'expired').map(d => d.label).join(', ');
    throw new ValidationError(`Vendor is blocked for compliance — expired document(s): ${expired}. Update compliance expiry dates to restore eligibility.`);
  }
}

module.exports = { getAlertDays, getComplianceStatus, syncComplianceExceptions, assertVendorUsable };
