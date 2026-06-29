const { pool } = require('../../config/database');

// Pure data access for ExceptionService.

async function insertException(row, conn) {
  const c = conn || pool;
  await c.query(
    `INSERT INTO procurement_exceptions
      (id, exception_type, severity, status, module_name, record_id, vendor_id, transaction_chain_id,
       title, message, metadata, dedup_key, detected_by, created_by)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.exception_type, row.severity, row.module_name, row.record_id, row.vendor_id || null,
      row.transaction_chain_id || null, row.title, row.message, row.metadata ? JSON.stringify(row.metadata) : null,
      row.dedup_key, row.detected_by || 'system', row.created_by || null,
    ]
  );
}

async function updateExceptionFields(id, { severity, title, message, metadata }, conn) {
  const c = conn || pool;
  await c.query(
    'UPDATE procurement_exceptions SET severity = ?, title = ?, message = ?, metadata = ?, updated_at = NOW() WHERE id = ?',
    [severity, title, message, metadata ? JSON.stringify(metadata) : null, id]
  );
}

async function findOpenByDedupKey(dedupKey, conn) {
  const c = conn || pool;
  const [rows] = await c.query("SELECT * FROM procurement_exceptions WHERE dedup_key = ? AND status = 'open' LIMIT 1", [dedupKey]);
  return rows[0] || null;
}

async function findById(id, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM procurement_exceptions WHERE id = ?', [id]);
  return rows[0] || null;
}

async function resolveById(id, { resolved_by, resolution_remarks }, conn) {
  const c = conn || pool;
  await c.query(
    "UPDATE procurement_exceptions SET status = 'resolved', resolved_by = ?, resolution_remarks = ?, resolved_at = NOW() WHERE id = ?",
    [resolved_by || null, resolution_remarks || null, id]
  );
}

async function resolveByDedupKey(dedupKey, { resolved_by, resolution_remarks }, conn) {
  const c = conn || pool;
  await c.query(
    "UPDATE procurement_exceptions SET status = 'resolved', resolved_by = ?, resolution_remarks = ?, resolved_at = NOW() WHERE dedup_key = ? AND status = 'open'",
    [resolved_by || null, resolution_remarks || null, dedupKey]
  );
}

async function listExceptions(filters, conn) {
  const c = conn || pool;
  let sql = `
    SELECT pe.*, v.vendor_name
    FROM procurement_exceptions pe
    LEFT JOIN vendors v ON pe.vendor_id = v.id
    WHERE 1=1`;
  const params = [];
  if (filters.status) { sql += ' AND pe.status = ?'; params.push(filters.status); }
  if (filters.exception_type) { sql += ' AND pe.exception_type = ?'; params.push(filters.exception_type); }
  if (filters.severity) { sql += ' AND pe.severity = ?'; params.push(filters.severity); }
  if (filters.module_name) { sql += ' AND pe.module_name = ?'; params.push(filters.module_name); }
  if (filters.record_id) { sql += ' AND pe.record_id = ?'; params.push(filters.record_id); }
  if (filters.vendor_id) { sql += ' AND pe.vendor_id = ?'; params.push(filters.vendor_id); }
  if (filters.transaction_chain_id) { sql += ' AND pe.transaction_chain_id = ?'; params.push(filters.transaction_chain_id); }
  sql += ' ORDER BY (pe.status = "open") DESC, pe.severity = "critical" DESC, pe.created_at DESC';

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
  const [countRows] = await c.query(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
  const total = countRows[0].total;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, (page - 1) * limit);
  const [rows] = await c.query(sql, params);
  return { rows, pagination: { page, limit, total } };
}

// Aggregate counts for the Control Tower dashboard's summary panel — kept
// separate from listExceptions so the dashboard's headline numbers are
// always global (not capped by listExceptions' own page size/100-row limit).
async function getSummaryCounts(conn) {
  const c = conn || pool;
  const [bySeverity] = await c.query(
    "SELECT severity, COUNT(*) as cnt FROM procurement_exceptions WHERE status = 'open' GROUP BY severity"
  );
  const [byType] = await c.query(
    "SELECT exception_type, COUNT(*) as cnt FROM procurement_exceptions WHERE status = 'open' GROUP BY exception_type"
  );
  const [[{ openTotal }]] = await c.query("SELECT COUNT(*) as openTotal FROM procurement_exceptions WHERE status = 'open'");
  const [[{ resolvedTotal }]] = await c.query("SELECT COUNT(*) as resolvedTotal FROM procurement_exceptions WHERE status = 'resolved'");
  const [[{ resolvedToday }]] = await c.query(
    "SELECT COUNT(*) as resolvedToday FROM procurement_exceptions WHERE status = 'resolved' AND resolved_at >= CURDATE()"
  );
  return {
    open_total: Number(openTotal),
    resolved_total: Number(resolvedTotal),
    resolved_today: Number(resolvedToday),
    by_severity: bySeverity.reduce((acc, r) => { acc[r.severity] = Number(r.cnt); return acc; }, {}),
    by_type: byType.reduce((acc, r) => { acc[r.exception_type] = Number(r.cnt); return acc; }, {}),
  };
}

// Procurement Command Center — Budget Health: rolls up every cost center's
// budget_allocations row (the same allocated/committed/consumed/actual
// figures computeBudgetStatus() already reads one cost-center-at-a-time for
// the PR submit-time check) into a cross-cost-center table for the Control
// Tower, rather than a second budget-tracking mechanism.
async function getBudgetHealth(conn) {
  const c = conn || pool;
  const [rows] = await c.query(`
    SELECT cost_center, fiscal_year, allocated_amount, committed_amount, consumed_amount, actual_amount,
      (allocated_amount - committed_amount - consumed_amount - actual_amount) as remaining_amount
    FROM budget_allocations
    ORDER BY fiscal_year DESC, cost_center ASC
  `);
  return rows.map(r => ({
    ...r,
    utilization_pct: Number(r.allocated_amount) > 0
      ? Math.round(((Number(r.committed_amount) + Number(r.consumed_amount) + Number(r.actual_amount)) / Number(r.allocated_amount)) * 10000) / 100
      : null,
  }));
}

// Procurement Command Center — Vendor Risk: top N highest-risk vendors, same
// vendor_risk_scores table the Risk Dashboard already reads, just ranked and
// capped for a summary widget instead of the dashboard's full sortable list.
async function getTopRiskVendors(limit, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT v.id as vendor_id, v.vendor_name, v.supplier_category, vrs.risk_score, vrs.risk_level, vrs.risk_trend
     FROM vendor_risk_scores vrs INNER JOIN vendors v ON vrs.vendor_id = v.id
     WHERE vrs.risk_level = 'high'
     ORDER BY vrs.risk_score DESC
     LIMIT ?`,
    [Number(limit) || 10]
  );
  return rows;
}

module.exports = {
  insertException,
  updateExceptionFields,
  findOpenByDedupKey,
  findById,
  resolveById,
  resolveByDedupKey,
  listExceptions,
  getSummaryCounts,
  getBudgetHealth,
  getTopRiskVendors,
};
