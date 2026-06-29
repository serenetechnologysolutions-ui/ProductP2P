const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { emitEvent } = require('../../common/eventBus');

async function getPrOrThrow(id, conn) {
  const [rows] = await (conn || pool).query(
    `SELECT pr.*, cm.company_name FROM purchase_requisitions pr LEFT JOIN company_master cm ON pr.company_id = cm.id WHERE pr.id = ?`,
    [id]
  );
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
// Vendor Segmentation: a preferred vendor's segment refines the recommendation
// further — Strategic/Preferred vendors are already vetted go-to partners
// (lean toward automatic ordering), Tactical vendors still warrant competitive
// sourcing even below the value threshold (lean toward RFQ).
async function computeSourcingRecommendation({ total_value, preferred_vendor_id, contract_id }, conn) {
  const threshold = Number(await getSetting('pr_rfq_threshold_value', '500000', conn));
  if (contract_id) return { recommended_strategy: 'CONTRACT_BASED', reason: 'An active contract is referenced — sourcing can skip RFQ.' };
  if (Number(total_value) > threshold) return { recommended_strategy: 'RFQ_REQUIRED', reason: `Value exceeds the configured RFQ threshold (${threshold}).` };
  if (preferred_vendor_id) {
    const c = conn || pool;
    const [rows] = await c.query('SELECT vendor_segment FROM vendors WHERE id = ?', [preferred_vendor_id]);
    const segment = rows[0]?.vendor_segment;
    if (segment === 'tactical') {
      return { recommended_strategy: 'RFQ_REQUIRED', reason: 'Preferred vendor is segmented as Tactical — competitive sourcing is recommended even below the RFQ threshold.' };
    }
    if (segment === 'strategic' || segment === 'preferred') {
      return { recommended_strategy: 'AUTO_PO', reason: `Preferred vendor is segmented as ${segment.charAt(0).toUpperCase() + segment.slice(1)} — automatic ordering is appropriate.` };
    }
    return { recommended_strategy: 'DIRECT_PO_ALLOWED', reason: 'A preferred vendor is on file — direct PO is possible.' };
  }
  return { recommended_strategy: 'RFQ_REQUIRED', reason: 'No preferred vendor or contract on file — default to competitive sourcing.' };
}

// ─── Budget Commitment Model ────────────────────────────────────────────────
// Four-stage funnel against one budget_allocations row (cost_center + fiscal
// year): allocated -> committed (PR approved) -> consumed (PO created) ->
// actual (ASN posted). Money is *reclassified* from one stage to the next as
// it moves through the lifecycle, not just added on top — otherwise the same
// rupee would show up committed AND consumed AND actual simultaneously,
// overstating total exposure when the three are summed. All four functions
// are no-ops if the cost center has no allocation row, matching the existing
// opt-in behavior (not_configured never blocks).
//
// Known limitation inherited from the existing consumeBudget design: fiscal
// year is derived from the current calendar year at call time, not stored on
// the PR/PO/ASN itself, so a PR approved in one fiscal year whose PO/ASN
// lands in the next would commit/consume/actualize against different
// allocation rows. Not fixed here — would need a stored fiscal_year column
// on PR/PO/ASN, which is a larger change than this task asked for.

async function commitBudget(costCenter, amount, conn) {
  if (!costCenter || !amount) return;
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  await c.query(
    'UPDATE budget_allocations SET committed_amount = committed_amount + ? WHERE cost_center = ? AND fiscal_year = ?',
    [amount, costCenter, fiscalYear]
  );
}

// Called when a PR's committed value converts into a real PO — releases the
// corresponding amount from committed_amount (GREATEST clamps at 0 so a price
// change between PR-estimate and PO-actual can never drive it negative).
async function releaseCommitment(costCenter, amount, conn) {
  if (!costCenter || !amount) return;
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  await c.query(
    'UPDATE budget_allocations SET committed_amount = GREATEST(committed_amount - ?, 0) WHERE cost_center = ? AND fiscal_year = ?',
    [amount, costCenter, fiscalYear]
  );
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

// Called when an ASN posts — releases the matching amount from
// consumed_amount (the PO-stage obligation) as it converts into real,
// incurred spend (recordActual, below).
async function releaseConsumption(costCenter, amount, conn) {
  if (!costCenter || !amount) return;
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  await c.query(
    'UPDATE budget_allocations SET consumed_amount = GREATEST(consumed_amount - ?, 0) WHERE cost_center = ? AND fiscal_year = ?',
    [amount, costCenter, fiscalYear]
  );
}

async function recordActual(costCenter, amount, conn) {
  if (!costCenter || !amount) return;
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  await c.query(
    'UPDATE budget_allocations SET actual_amount = actual_amount + ? WHERE cost_center = ? AND fiscal_year = ?',
    [amount, costCenter, fiscalYear]
  );
}

// `remaining` now nets out every stage of the funnel (committed + consumed +
// actual), not just consumed — two PRs against the same cost center that
// haven't yet converted to POs now correctly compete for the same remaining
// budget instead of each independently appearing "within budget."
async function computeBudgetStatus(costCenter, totalValue, conn) {
  if (!costCenter) return { budget_status: 'not_configured', allocated_amount: null, committed_amount: null, consumed_amount: null, actual_amount: null, remaining_amount: null };
  const c = conn || pool;
  const fiscalYear = String(new Date().getFullYear());
  const [rows] = await c.query(
    'SELECT * FROM budget_allocations WHERE cost_center = ? AND fiscal_year = ?',
    [costCenter, fiscalYear]
  );
  if (rows.length === 0) return { budget_status: 'not_configured', allocated_amount: null, committed_amount: null, consumed_amount: null, actual_amount: null, remaining_amount: null };
  const allocation = rows[0];
  const remaining = Number(allocation.allocated_amount)
    - Number(allocation.committed_amount)
    - Number(allocation.consumed_amount)
    - Number(allocation.actual_amount);
  return {
    budget_status: Number(totalValue) > remaining ? 'exceeds_budget' : 'within_budget',
    allocated_amount: allocation.allocated_amount,
    committed_amount: allocation.committed_amount,
    consumed_amount: allocation.consumed_amount,
    actual_amount: allocation.actual_amount,
    remaining_amount: remaining,
  };
}

// ─── Line-Level Approval ─────────────────────────────────────────────────────
// "Workflow based on value/category": which lines must be individually
// approved/rejected (rather than riding through on the requisition's bulk
// approval) is decided once at submit time, from two configurable triggers —
// a line value threshold and an item-category list — mirroring how the
// pr_rfq_threshold_value check already works at submit.
async function determineLineApprovalRequirement(line, conn) {
  const c = conn || pool;
  const valueThreshold = Number(await getSetting('pr_line_approval_value_threshold', '200000', c));
  if (Number(line.estimated_total_price || 0) >= valueThreshold) return true;

  const categoriesRaw = await getSetting('pr_line_approval_categories', '', c);
  const categories = categoriesRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (categories.length > 0 && line.item_master_id) {
    const [[item]] = await c.query('SELECT category FROM item_master WHERE id = ?', [line.item_master_id]);
    if (item && categories.includes(item.category)) return true;
  }
  return false;
}

// Lines still blocking finalization — flagged as requiring individual review
// but not yet approved or rejected. Non-empty means the requisition's final
// approval step can't bulk-finalize yet.
async function getBlockingLineItems(prId, conn) {
  const c = conn || pool;
  const [lines] = await c.query(
    "SELECT * FROM pr_line_items WHERE pr_id = ? AND requires_line_approval = TRUE AND approval_status = 'pending'",
    [prId]
  );
  return lines;
}

// Called at the requisition's final workflow step once getBlockingLineItems
// is empty. Lines that never required individual review are bulk-approved
// here as a bookkeeping side effect, so every line ends up in a terminal
// state. The requisition's own status becomes 'approved' (no rejections),
// 'partially_approved' (a mix — the ENUM value the schema already had but no
// code previously set), or 'rejected' (every line rejected). Budget is
// committed only for the approved lines' value, not the full PR total, so a
// partial approval never over-commits the cost center.
async function finalizePrApproval(pr, actorId, conn) {
  const c = conn || pool;
  const [lines] = await c.query('SELECT * FROM pr_line_items WHERE pr_id = ?', [pr.id]);

  const autoApproveIds = lines.filter(l => l.approval_status === 'pending').map(l => l.id);
  if (autoApproveIds.length > 0) {
    await c.query(
      `UPDATE pr_line_items SET approval_status = 'approved', approved_by = ?, approved_at = NOW() WHERE id IN (${autoApproveIds.map(() => '?').join(',')})`,
      [actorId, ...autoApproveIds]
    );
    lines.forEach(l => { if (l.approval_status === 'pending') l.approval_status = 'approved'; });
  }

  const rejectedLines = lines.filter(l => l.approval_status === 'rejected');
  const approvedLines = lines.filter(l => l.approval_status === 'approved');
  const approvedValue = approvedLines.reduce((sum, l) => sum + Number(l.estimated_total_price || 0), 0);

  if (approvedLines.length === 0) {
    const remarks = rejectedLines.map(l => `${l.description}: ${l.rejection_remarks || 'rejected'}`).join('; ') || 'All line items rejected';
    await c.query("UPDATE purchase_requisitions SET status = 'rejected', rejection_reason = ? WHERE id = ?", [remarks, pr.id]);
    return { final_status: 'rejected', approved_value: 0, rejected_count: rejectedLines.length };
  }

  const finalStatus = rejectedLines.length > 0 ? 'partially_approved' : 'approved';
  await c.query('UPDATE purchase_requisitions SET status = ? WHERE id = ?', [finalStatus, pr.id]);
  await commitBudget(pr.cost_center, approvedValue, c);

  await emitEvent('PR_APPROVED', { module_name: 'pr', record_id: pr.id, pr_number: pr.pr_number, final_status: finalStatus, approved_value: approvedValue }, c);

  return { final_status: finalStatus, approved_value: approvedValue, rejected_count: rejectedLines.length };
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
  commitBudget,
  releaseCommitment,
  consumeBudget,
  releaseConsumption,
  recordActual,
  determineLineApprovalRequirement,
  getBlockingLineItems,
  finalizePrApproval,
};
