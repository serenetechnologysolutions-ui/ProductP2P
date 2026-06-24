const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');

async function getPrOrThrow(id, conn) {
  const [rows] = await (conn || pool).query('SELECT * FROM purchase_requisitions WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Purchase requisition not found');
  return rows[0];
}

async function autoPRNumber(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
    "SELECT MAX(CAST(SUBSTRING(pr_number, 4) AS UNSIGNED)) as maxNum FROM purchase_requisitions WHERE pr_number LIKE 'PR-%' AND pr_number REGEXP '^PR-[0-9]+$'"
  );
  const next = (maxNum || 0) + 1;
  return `PR-${String(next).padStart(6, '0')}`;
}

async function autoContractNumber(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
    "SELECT MAX(CAST(SUBSTRING(contract_number, 5) AS UNSIGNED)) as maxNum FROM contracts WHERE contract_number LIKE 'CON-%'"
  );
  const next = (maxNum || 0) + 1;
  return `CON-${String(next).padStart(6, '0')}`;
}

async function getSetting(key, fallback, conn) {
  const [rows] = await (conn || pool).query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
  return rows.length > 0 ? rows[0].setting_value : fallback;
}

// Inserts one row into the document_flow_mapping ledger — the single source
// of truth for "how much of this line has been handed to a downstream
// document." Every row is itself an audit entry (no separate history table).
async function recordMapping(sourceDocType, sourceLineId, targetDocType, targetLineId, quantity, actorId, conn) {
  const c = conn || pool;
  await c.query(
    `INSERT INTO document_flow_mapping (id, source_doc_type, source_line_id, target_doc_type, target_line_id, mapped_quantity, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), sourceDocType, sourceLineId, targetDocType, targetLineId, quantity, actorId || null]
  );
}

// Total quantity of a PR or RFQ line already handed to any downstream document.
async function getMappedQuantity(sourceDocType, sourceLineId, conn) {
  const c = conn || pool;
  const [[{ mapped }]] = await c.query(
    'SELECT COALESCE(SUM(mapped_quantity), 0) as mapped FROM document_flow_mapping WHERE source_doc_type = ? AND source_line_id = ?',
    [sourceDocType, sourceLineId]
  );
  return Number(mapped);
}

// Re-derives consumed/remaining quantity for a PR line from the mapping
// ledger (PR→RFQ and PR→PO mappings both count) rather than from po_line_items
// directly — a PR line's quantity is reserved the moment it's sent to *either*
// an RFQ or a direct PO, not only once a PO actually exists.
async function refreshPrLineRemaining(prLineItemId, conn) {
  const c = conn || pool;
  const mapped = await getMappedQuantity('PR', prLineItemId, c);
  await c.query(
    'UPDATE pr_line_items SET consumed_quantity = ?, remaining_quantity = quantity - ? WHERE id = ?',
    [mapped, mapped, prLineItemId]
  );
}

// After a conversion to RFQ/PO, flip the PR to closed once every line is
// fully consumed, otherwise leave it in sourcing (partially fulfilled).
async function refreshPrStatusAfterConsumption(prId, conn) {
  const c = conn || pool;
  const [[{ remaining }]] = await c.query(
    'SELECT COALESCE(SUM(remaining_quantity), 0) as remaining FROM pr_line_items WHERE pr_id = ?',
    [prId]
  );
  await c.query(
    "UPDATE purchase_requisitions SET status = ? WHERE id = ?",
    [Number(remaining) <= 0 ? 'closed' : 'sourcing', prId]
  );
}

// Picks the most specific active rule whose document_type/department/value
// range matches the PR — "most specific" = most non-null conditions matched.
async function resolveApprovalRule(pr, conn) {
  const c = conn || pool;
  const [rules] = await c.query(
    `SELECT * FROM pr_approval_rules
     WHERE is_active = TRUE
       AND (document_type IS NULL OR document_type = ?)
       AND (department IS NULL OR department = ?)
       AND (min_value IS NULL OR ? >= min_value)
       AND (max_value IS NULL OR ? <= max_value)`,
    [pr.document_type, pr.department, pr.total_value, pr.total_value]
  );
  if (rules.length === 0) {
    throw new ValidationError('No approval rule is configured for this requisition — contact an administrator');
  }
  rules.sort((a, b) => {
    const specificity = (r) => [r.document_type, r.department, r.min_value, r.max_value].filter(v => v != null).length;
    return specificity(b) - specificity(a);
  });
  return rules[0];
}

// Pure, side-effect-free suggestion for the create form's "System Insights"
// panel — never overrides the sourcing_strategy the user actually picks.
async function computeSourcingRecommendation({ total_value, preferred_vendor_id, contract_id }, conn) {
  const threshold = Number(await getSetting('pr_rfq_threshold_value', '500000', conn));
  if (contract_id) return { recommended_strategy: 'CONTRACT_BASED', reason: 'An active contract is referenced — sourcing can skip RFQ.' };
  if (Number(total_value) > threshold) return { recommended_strategy: 'RFQ_REQUIRED', reason: `Value exceeds the configured RFQ threshold (${threshold}).` };
  if (preferred_vendor_id) return { recommended_strategy: 'DIRECT_PO_ALLOWED', reason: 'A preferred vendor is on file — direct PO is possible.' };
  return { recommended_strategy: 'RFQ_REQUIRED', reason: 'No preferred vendor or contract on file — default to competitive sourcing.' };
}

// Increments the matching allocation's consumed_amount when a PO is actually
// created against a PR — a no-op if the cost center has no allocation row,
// since budget tracking here is opt-in (not_configured never blocks).
async function consumeBudget(costCenter, amount, conn) {
  if (!costCenter || !amount) return;
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  await c.query(
    'UPDATE budget_allocations SET consumed_amount = consumed_amount + ? WHERE cost_center = ? AND fiscal_year = ?',
    [amount, costCenter, fiscalYear]
  );
}

async function computeBudgetStatus(costCenter, totalValue, conn) {
  if (!costCenter) return { budget_status: 'not_configured', allocated_amount: null, consumed_amount: null, remaining_amount: null };
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  const [rows] = await c.query(
    'SELECT * FROM budget_allocations WHERE cost_center = ? AND fiscal_year = ?',
    [costCenter, fiscalYear]
  );
  if (rows.length === 0) return { budget_status: 'not_configured', allocated_amount: null, consumed_amount: null, remaining_amount: null };
  const allocation = rows[0];
  const remaining = Number(allocation.allocated_amount) - Number(allocation.consumed_amount);
  return {
    budget_status: Number(totalValue) > remaining ? 'exceeds_budget' : 'within_budget',
    allocated_amount: allocation.allocated_amount,
    consumed_amount: allocation.consumed_amount,
    remaining_amount: remaining,
  };
}

module.exports = {
  getPrOrThrow,
  autoPRNumber,
  autoContractNumber,
  getSetting,
  recordMapping,
  getMappedQuantity,
  refreshPrLineRemaining,
  refreshPrStatusAfterConsumption,
  resolveApprovalRule,
  computeSourcingRecommendation,
  computeBudgetStatus,
  consumeBudget,
};
