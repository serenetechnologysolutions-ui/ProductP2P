const { pool } = require('../config/database');

const LIFECYCLES = ['experimental', 'beta', 'stable'];

// A flag's setting_value is "<'true'|'false'>" or, once it's been through a
// lifecycle decision, "<'true'|'false'>:<experimental|beta|stable>" — the
// lifecycle is encoded into the same value rather than a second column/table,
// so every pre-existing bare 'true'/'false' flag keeps working unparsed
// (parseValue treats a missing lifecycle as 'stable': no lifecycle tracking
// configured yet is the same as "not worth tracking," not "broken").
function parseValue(rawValue) {
  if (!rawValue) return { enabled: true, lifecycle: 'stable' };
  const [enabledStr, lifecycle] = rawValue.split(':');
  return { enabled: enabledStr === 'true', lifecycle: LIFECYCLES.includes(lifecycle) ? lifecycle : 'stable' };
}

// Reads a feature-flag value out of the existing system_settings table (no
// dedicated feature-flag table — see migrate-feature-flags.js). Missing key =
// enabled by default, so a flag only ever turns a capability OFF; it can
// never accidentally gate something that forgot to seed its own row.
// `role`, if passed, additionally enforces the EXPERIMENTAL lifecycle's
// internal-only visibility — callers that don't care about that distinction
// (most of the app, today) simply omit it and get the plain enabled/disabled
// check unchanged.
async function isFeatureEnabled(key, conn, role) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
  if (rows.length === 0) return true;
  const { enabled, lifecycle } = parseValue(rows[0].setting_value);
  if (!enabled) return false;
  if (lifecycle === 'experimental' && role && role !== 'system_admin') return false;
  return true;
}

// GET /api/feature-flags/status — every seeded flag's current enabled state
// and lifecycle stage, for the System Settings admin widget.
async function getFeatureFlagStatus(conn) {
  const c = conn || pool;
  const [rows] = await c.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%_enabled'");
  return rows.map(r => ({ key: r.setting_key, ...parseValue(r.setting_value) }));
}

module.exports = { isFeatureEnabled, getFeatureFlagStatus };
