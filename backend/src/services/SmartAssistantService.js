const { pool } = require('../config/database');
const { NotFoundError } = require('../common/errors');
const insightsService = require('../modules/insights/insights.service');
const exceptionsService = require('../modules/exceptions/exceptions.service');
const complianceService = require('../modules/vendor/vendor-compliance.service');
const { getNextBestActionsForPr } = require('../modules/action-engine/action-engine.service');

// ─────────────────────────────────────────────────────────────────────────────
// Smart Procurement Assistant — a rule-based (NO ML) explainability layer on
// top of data that already exists elsewhere (ProcurementInsightsService,
// vendor risk scoring, price history, contract availability, budget status,
// the Exception Management Engine). This module computes nothing new about
// the business — it only re-reads those existing, already-tested outputs and
// translates them into one consistent, explainable shape:
//   { type: cost_saving|risk|compliance|recommendation,
//     severity: low|medium|high, message, action, confidence: 0-100 }
// `confidence` is always derived from a concrete, named quantity (record
// count, exact date math, deterministic flag) — never randomized — so every
// number here can be explained by pointing at the rule that produced it.
// Purely additive and read-only: nothing in here writes to any table, and no
// existing service function is modified, only called.
// ─────────────────────────────────────────────────────────────────────────────

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

function insight(type, severity, message, action, confidence, source = 'insight') {
  return { type, severity, message, action, confidence: clamp(Math.round(confidence), 0, 100), source };
}

// Maps the existing engines' own severity vocabulary (critical/warning/info,
// or critical/high/medium/low) onto the assistant's three-level scale.
function toAssistantSeverity(s) {
  if (s === 'critical' || s === 'high') return 'high';
  if (s === 'warning' || s === 'medium') return 'medium';
  return 'low';
}

// Translates one already-resolved open exception (a fact, not a heuristic)
// into an assistant insight. Confidence is 100 — exceptions are detected
// conditions, not probabilistic estimates.
function exceptionToInsight(ex) {
  const type = ex.exception_type === 'compliance_expiry' ? 'compliance'
    : ex.exception_type === 'budget_breach' ? 'risk'
    : ex.exception_type === 'vendor_risk' ? 'risk'
    : 'risk';
  return insight(type, toAssistantSeverity(ex.severity), ex.message, 'Open the Procurement Control Tower to resolve this exception.', 100, 'exception');
}

// Shared translator for the {type, severity, message} insight objects already
// returned by ProcurementInsightsService.getVendorScore() — reused verbatim
// for both the PR assistant (via getPRInsights) and the Vendor assistant.
function vendorScoreInsightToAssistant(vi, vendorName) {
  const message = vendorName ? `[${vendorName}] ${vi.message}` : vi.message;
  if (vi.type === 'blacklist' || vi.type === 'risk_level' || vi.type === 'risk_trend') {
    return insight('risk', toAssistantSeverity(vi.severity), message, 'Review this vendor on the Risk Dashboard before proceeding.', 90);
  }
  if (vi.type === 'price_competitiveness') {
    return insight('cost_saving', toAssistantSeverity(vi.severity), message, 'Renegotiate pricing or source an alternate vendor for the affected item(s).', 80);
  }
  if (vi.type === 'contract_gap') {
    return insight('recommendation', 'low', message, 'Consider formalizing a contract if this vendor is used regularly.', 60);
  }
  return insight('recommendation', 'low', message, 'No action needed.', 70);
}

// ─── PR Assistant ────────────────────────────────────────────────────────────
async function getPrAssistant(prId, conn) {
  const data = await insightsService.getPRInsights(prId, conn); // throws NotFoundError if the PR doesn't exist
  const items = [];

  if (data.budget.budget_status === 'exceeds_budget') {
    items.push(insight(
      'risk', 'high',
      `Requisition value (${data.pr.total_value}) exceeds the remaining budget for department ${data.pr.department} (remaining: ${data.budget.remaining_amount}).`,
      'Reduce scope, request a budget reallocation, or route through exception approval before submitting.',
      95
    ));
  } else if (data.budget.budget_status === 'not_configured') {
    items.push(insight('recommendation', 'low', 'No budget allocation is configured for this cost center — spend is currently untracked.', 'Ask Finance to configure a budget allocation so future requisitions are checked automatically.', 75));
  }

  if (data.pr.sourcing_strategy && data.sourcing_recommendation.recommended_strategy !== data.pr.sourcing_strategy) {
    items.push(insight('recommendation', 'medium',
      `Selected sourcing strategy (${data.pr.sourcing_strategy}) differs from the recommended ${data.sourcing_recommendation.recommended_strategy}.`,
      `Switch to ${data.sourcing_recommendation.recommended_strategy}: ${data.sourcing_recommendation.reason}`,
      70));
  }

  for (const li of data.line_item_insights) {
    if (li.type === 'no_history') continue; // not actionable — nothing to recommend yet
    const deviation = Math.abs(li.deviation_pct ?? 0);
    const aboveMarket = li.type === 'price_above_benchmark';
    items.push(insight(
      'cost_saving',
      deviation >= 25 ? 'high' : deviation >= 10 ? 'medium' : 'low',
      `[${li.description}] ${li.message}`,
      aboveMarket ? 'Negotiate this line toward the market average or source an alternate vendor.' : 'Already priced below market — no action needed.',
      clamp(50 + deviation, 50, 90)
    ));
  }

  if (data.vendor_score) {
    for (const vi of data.vendor_score.insights) {
      items.push(vendorScoreInsightToAssistant(vi, data.vendor_score.vendor.vendor_name));
    }
  }

  if (data.contract_usage?.contract_available_not_used) {
    items.push(insight('cost_saving', 'medium',
      `An active contract (${data.contract_usage.active_contract.contract_number}) exists for this vendor but isn't being used for this requisition.`,
      'Switch this requisition to contract-based sourcing to lock in the contracted price.',
      85));
  }

  const { rows: exceptions } = await exceptionsService.listExceptions({ module_name: 'purchase_requisition', record_id: prId, status: 'open' }, conn);
  exceptions.forEach(ex => items.push(exceptionToInsight(ex)));

  // Next Best Action engine (Module 7) — feeds straight into the
  // Recommendations bucket alongside everything else here.
  const nextActions = await getNextBestActionsForPr(data.pr, conn);
  nextActions.forEach(a => items.push(insight('recommendation', 'medium', a.message, a.recommended_action, 80)));

  if (items.length === 0) {
    items.push(insight('recommendation', 'low', 'No outstanding concerns for this requisition.', 'No action needed.', 100));
  }

  return { insights: items };
}

// ─── RFQ Assistant ───────────────────────────────────────────────────────────
// rfq_vendor_invites/exceptions don't exist for the 'rfq' module_name in the
// procurement_exceptions schema (it's scoped to purchase_requisition /
// purchase_order / asn / vendor only) — so instead of widening that ENUM
// (out of scope, a schema change to an existing table), an RFQ created from a
// PR surfaces that PR's own open exceptions here instead, clearly labeled.
async function getRfqAssistant(rfqId, conn) {
  const c = conn || pool;
  const [[rfq]] = await c.query('SELECT * FROM rfqs WHERE id = ?', [rfqId]);
  if (!rfq) throw new NotFoundError('RFQ not found');

  const items = [];
  const [lineItems] = await c.query('SELECT * FROM rfq_line_items WHERE rfq_id = ?', [rfqId]);
  const lineById = {};
  lineItems.forEach(li => { lineById[li.id] = li; });

  const [bids] = await c.query(
    `SELECT vb.*, v.vendor_name FROM vendor_bids vb LEFT JOIN vendors v ON vb.vendor_id = v.id
     WHERE vb.rfq_id = ? AND vb.round_number = ?`,
    [rfqId, rfq.current_round || 1]
  );

  for (const bid of bids) {
    const [bidItems] = await c.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bid.id]);
    for (const bi of bidItems) {
      const line = lineById[bi.rfq_line_item_id];
      if (!line?.item_master_id) continue;
      let benchmark;
      try { benchmark = await insightsService.getShouldCostBenchmark(line.item_master_id, bi.unit_price, c); }
      catch { continue; }
      if (benchmark.status !== 'high_deviation') continue;
      const aboveShouldCost = benchmark.deviation_pct > 0;
      items.push(insight(
        'cost_saving',
        Math.abs(benchmark.deviation_pct) >= 30 ? 'high' : 'medium',
        `[${bid.vendor_name}] ${benchmark.warning.message}`,
        aboveShouldCost ? 'Negotiate this line down toward the should-cost benchmark before awarding.' : 'Verify the vendor can sustain quality/delivery at this unusually low price.',
        clamp(40 + benchmark.record_count * 5, 40, 95)
      ));
    }
  }

  const vendorIds = [...new Set(bids.map(b => b.vendor_id))];
  for (const vendorId of vendorIds) {
    try {
      const score = await insightsService.getVendorScore(vendorId, c);
      score.insights.forEach(vi => items.push(vendorScoreInsightToAssistant(vi, score.vendor.vendor_name)));
    } catch { /* vendor missing — skip rather than fail the whole assistant */ }
  }

  if (['published', 'negotiation'].includes(rfq.status) && bids.length === 0 && rfq.submission_deadline) {
    const daysToDeadline = Math.ceil((new Date(rfq.submission_deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysToDeadline <= 2) {
      items.push(insight('recommendation', 'medium',
        `Submission deadline is ${daysToDeadline <= 0 ? 'today or past' : `in ${daysToDeadline} day(s)`} with no bids received yet.`,
        'Follow up with invited vendors, or start a negotiation round with an extended deadline.',
        100, 'assistant'));
    }
  }

  if (rfq.pr_id) {
    const { rows: exceptions } = await exceptionsService.listExceptions({ module_name: 'purchase_requisition', record_id: rfq.pr_id, status: 'open' }, c);
    exceptions.forEach(ex => items.push({ ...exceptionToInsight(ex), message: `[Linked PR] ${ex.message}` }));
  }

  if (items.length === 0) {
    items.push(insight('recommendation', 'low', 'No outstanding concerns for this RFQ.', 'No action needed.', 100));
  }

  return { insights: items };
}

// ─── Vendor Assistant ────────────────────────────────────────────────────────
async function getVendorAssistant(vendorId, conn) {
  const score = await insightsService.getVendorScore(vendorId, conn); // throws NotFoundError if missing
  const items = [];

  score.insights.forEach(vi => items.push(vendorScoreInsightToAssistant(vi)));

  const compliance = await complianceService.getComplianceStatus(vendorId, conn);
  for (const doc of compliance.documents) {
    if (doc.status === 'ok') continue;
    items.push(insight(
      'compliance',
      doc.status === 'expired' ? 'high' : 'medium',
      `${doc.label} ${doc.status === 'expired' ? 'expired' : 'expires soon'} (${doc.expiry_date}, ${Math.abs(doc.days_remaining)} day(s) ${doc.status === 'expired' ? 'overdue' : 'remaining'}).`,
      'Request an updated compliance document from the vendor.',
      100
    ));
  }

  const { rows: exceptions } = await exceptionsService.listExceptions({ module_name: 'vendor', record_id: vendorId, status: 'open' }, conn);
  exceptions.forEach(ex => items.push(exceptionToInsight(ex)));

  if (items.length === 0) {
    items.push(insight('recommendation', 'low', 'No outstanding concerns — vendor is performing within normal parameters.', 'No action needed.', 100));
  }

  return { insights: items };
}

// ─── PO Assistant ────────────────────────────────────────────────────────────
async function getPoAssistant(poId, conn) {
  const c = conn || pool;
  const [[po]] = await c.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) throw new NotFoundError('Purchase Order not found');

  const items = [];

  if (po.vendor_id) {
    try {
      const score = await insightsService.getVendorScore(po.vendor_id, c);
      score.insights.forEach(vi => items.push(vendorScoreInsightToAssistant(vi, score.vendor.vendor_name)));
    } catch { /* vendor missing — skip rather than fail the whole assistant */ }
  }

  if (po.amendment_status === 'pending_approval') {
    items.push(insight('recommendation', 'medium',
      'A proposed amendment is awaiting approval on this PO.',
      'Review the pending version from the Versions tab — a different user than the proposer must approve it.',
      100, 'assistant'));
  }

  const { rows: exceptions } = await exceptionsService.listExceptions({ module_name: 'purchase_order', record_id: poId, status: 'open' }, c);
  exceptions.forEach(ex => items.push(exceptionToInsight(ex)));

  if (items.length === 0) {
    items.push(insight('recommendation', 'low', 'No outstanding concerns for this purchase order.', 'No action needed.', 100));
  }

  return { insights: items };
}

// ─── Decision Panel ──────────────────────────────────────────────────────────
// A presentational regrouping of the same per-entity insight lists above —
// no new computation, no new data source. Buckets the flat `insights[]` each
// assistant already returns into the 4 fixed sections a DecisionPanel UI
// wants, and renames fields to that UI's contract (title/recommended_action/
// confidence_score) without changing what getPrAssistant/getRfqAssistant/
// getVendorAssistant/getPoAssistant themselves return — the existing
// SmartAssistantPanel (PR/RFQ/Vendor Intelligence tabs) keeps consuming the
// original {type,severity,message,action,confidence,source} shape unchanged.
const ENTITY_ASSISTANTS = {
  pr: getPrAssistant,
  rfq: getRfqAssistant,
  vendor: getVendorAssistant,
  po: getPoAssistant,
};

const SECTION_TITLE = { risk: 'Risk', cost_saving: 'Cost Saving Opportunity', recommendation: 'Recommendation', compliance: 'Compliance Risk' };

function toDecisionItem(i) {
  return {
    title: SECTION_TITLE[i.type] || 'Insight',
    message: i.message,
    severity: i.severity,
    source: i.source,
    recommended_action: i.action,
    confidence_score: i.confidence,
  };
}

// Procurement Command Center — Cost Saving Opportunities: scans the most
// recently submitted open requisitions and reuses getPrAssistant() (same
// translator as the PR Intelligence tab) rather than a second cost-saving
// detector, collecting just the cost_saving-type items across all of them.
async function getTopCostSavingOpportunities(limit, conn) {
  const c = conn || pool;
  const cap = Number(limit) || 10;
  const [prs] = await c.query(
    "SELECT id, pr_number FROM purchase_requisitions WHERE status IN ('submitted','approved','partially_approved','sourcing') ORDER BY created_at DESC LIMIT 25"
  );
  const opportunities = [];
  for (const pr of prs) {
    if (opportunities.length >= cap) break;
    let result;
    try { result = await getPrAssistant(pr.id, c); } catch { continue; }
    result.insights.filter(i => i.type === 'cost_saving').forEach(i => {
      opportunities.push({ pr_id: pr.id, pr_number: pr.pr_number, message: i.message, recommended_action: i.action, confidence_score: i.confidence });
    });
  }
  return opportunities.slice(0, cap);
}

async function getDecisionPanel(entityType, id, conn) {
  const fn = ENTITY_ASSISTANTS[entityType];
  if (!fn) throw new NotFoundError(`Unknown decision panel entity type: ${entityType}`);
  const { insights: items } = await fn(id, conn);

  const critical_alerts = [];
  const risks = [];
  const cost_saving_opportunities = [];
  const recommendations = [];

  for (const i of items) {
    const mapped = toDecisionItem(i);
    if (i.source === 'exception') { critical_alerts.push(mapped); continue; }
    if (i.type === 'risk' || i.type === 'compliance') { risks.push(mapped); continue; }
    if (i.type === 'cost_saving') { cost_saving_opportunities.push(mapped); continue; }
    recommendations.push(mapped);
  }

  return { critical_alerts, risks, cost_saving_opportunities, recommendations };
}

module.exports = { getPrAssistant, getRfqAssistant, getVendorAssistant, getPoAssistant, getDecisionPanel, getTopCostSavingOpportunities };
