const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../common/errors');
const repo = require('./exceptions.repository');

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

// ─── Core primitives ─────────────────────────────────────────────────────────

// Creates a new exception, or — if an OPEN exception with the same dedup_key
// already exists — refreshes it in place instead of creating a duplicate.
// This is what makes repeated detection runs (nightly risk recalculation,
// re-running a 3-way match) idempotent rather than exception-spam.
async function raiseException(input, conn) {
  const { exception_type, severity, module_name, record_id, vendor_id, transaction_chain_id, title, message, metadata, dedup_key, created_by } = input;
  if (!exception_type || !module_name || !record_id || !title || !message || !dedup_key) {
    throw new ValidationError('exception_type, module_name, record_id, title, message, and dedup_key are required');
  }

  const existing = await repo.findOpenByDedupKey(dedup_key, conn);
  if (existing) {
    await repo.updateExceptionFields(existing.id, { severity: severity || existing.severity, title, message, metadata }, conn);
    return { ...existing, severity: severity || existing.severity, title, message, metadata, refreshed: true };
  }

  const id = uuidv4();
  await repo.insertException({
    id, exception_type, severity: severity || 'medium', module_name, record_id, vendor_id, transaction_chain_id,
    title, message, metadata, dedup_key, detected_by: 'system', created_by,
  }, conn);
  return { id, exception_type, severity: severity || 'medium', module_name, record_id, status: 'open', refreshed: false };
}

// The flip side of raiseException — used by self-healing checks (e.g. a
// vendor's risk clears) to close an exception automatically without a human
// having to notice it's no longer relevant and resolve it by hand.
async function autoResolve(dedupKey, reason, conn) {
  await repo.resolveByDedupKey(dedupKey, { resolved_by: null, resolution_remarks: `Auto-resolved by system: ${reason}` }, conn);
}

async function resolveException(id, { resolved_by, resolution_remarks }, conn) {
  const existing = await repo.findById(id, conn);
  if (!existing) throw new NotFoundError('Exception not found');
  if (existing.status === 'resolved') throw new ValidationError('Exception is already resolved');
  if (!resolution_remarks || !resolution_remarks.trim()) throw new ValidationError('resolution_remarks is required', ['resolution_remarks']);
  await repo.resolveById(id, { resolved_by, resolution_remarks }, conn);
  return repo.findById(id, conn);
}

async function getException(id, conn) {
  const row = await repo.findById(id, conn);
  if (!row) throw new NotFoundError('Exception not found');
  return row;
}

async function listExceptions(filters, conn) {
  return repo.listExceptions(filters || {}, conn);
}

async function getSummaryCounts(conn) {
  return repo.getSummaryCounts(conn);
}

async function getBudgetHealth(conn) {
  return repo.getBudgetHealth(conn);
}

async function getTopRiskVendors(limit, conn) {
  return repo.getTopRiskVendors(limit, conn);
}

// ─── Detection: budget breach ────────────────────────────────────────────────
// Called from pr.routes.js POST /:id/submit right after computeBudgetStatus
// runs — reuses that exact result rather than recomputing budget status a
// second way.
async function detectBudgetBreach(pr, budget, totalValue, conn) {
  const dedupKey = `budget_breach:purchase_requisition:${pr.id}`;
  if (budget.budget_status !== 'exceeds_budget') {
    await autoResolve(dedupKey, 'requisition value no longer exceeds the allocated budget', conn);
    return null;
  }
  const overBy = round2(Number(totalValue) - Number(budget.remaining_amount));
  return raiseException({
    exception_type: 'budget_breach',
    severity: overBy > Number(budget.allocated_amount) * 0.25 ? 'critical' : 'high',
    module_name: 'purchase_requisition',
    record_id: pr.id,
    transaction_chain_id: pr.transaction_chain_id || pr.id,
    title: `Budget exceeded for ${pr.pr_number}`,
    message: `Requisition value ${totalValue} exceeds the remaining budget (${budget.remaining_amount}) for cost center ${pr.cost_center} by ${overBy}.`,
    metadata: { cost_center: pr.cost_center, requested_value: totalValue, allocated_amount: budget.allocated_amount, consumed_amount: budget.consumed_amount, remaining_amount: budget.remaining_amount, over_by: overBy },
    dedup_key: dedupKey,
  }, conn);
}

// ─── Detection: vendor risk alert ────────────────────────────────────────────
// Called from risk.service.js calculateVendorRiskScore() right after it
// upserts vendor_risk_scores — every caller of that function (the bulk
// /risk/calculate loop, and ProcurementInsightsService.getVendorScore)
// gets exception detection for free, with no separate call needed.
async function detectVendorRiskAlert(vendorId, riskRow, conn) {
  const c = conn || pool;
  const [[vendor]] = await c.query('SELECT vendor_name, blacklist_flag FROM vendors WHERE id = ?', [vendorId]);
  const dedupKey = `vendor_risk:vendor:${vendorId}`;

  const isHighRisk = riskRow.risk_level === 'high';
  const isWorsening = riskRow.risk_trend === 'worsening';
  const isBlacklisted = !!vendor?.blacklist_flag;

  if (!isHighRisk && !isWorsening && !isBlacklisted) {
    await autoResolve(dedupKey, 'risk level is no longer High and trend is no longer worsening', conn);
    return null;
  }

  const reasons = [];
  if (isBlacklisted) reasons.push('vendor is blacklisted');
  if (isHighRisk) reasons.push(`risk level is High (score ${riskRow.risk_score})`);
  if (isWorsening) reasons.push('risk trend is worsening');

  return raiseException({
    exception_type: 'vendor_risk',
    severity: isBlacklisted ? 'critical' : isHighRisk ? 'high' : 'medium',
    module_name: 'vendor',
    record_id: vendorId,
    vendor_id: vendorId,
    title: `Risk alert: ${vendor?.vendor_name || vendorId}`,
    message: `${vendor?.vendor_name || 'Vendor'} flagged — ${reasons.join('; ')}.`,
    metadata: { risk_score: riskRow.risk_score, risk_level: riskRow.risk_level, risk_trend: riskRow.risk_trend, blacklisted: isBlacklisted },
    dedup_key: dedupKey,
  }, conn);
}

// ─── Detection: price & quantity mismatch ───────────────────────────────────
// Called from asn.routes.js PUT /:id/three-way-match. Compares what was
// ORDERED (po_line_items) against what's being shipped/invoiced
// (asn_line_items) — the textbook definition of a 3-way-match exception —
// independent of whatever the admin manually selects for three_way_match_status.
const PRICE_MISMATCH_THRESHOLD_PCT = 1; // PO vs invoice should match almost exactly; this isn't a market-benchmark comparison

async function detectPriceAndQuantityMismatch(asnId, conn) {
  const c = conn || pool;
  const [[asn]] = await c.query('SELECT * FROM asns WHERE id = ?', [asnId]);
  if (!asn) throw new NotFoundError('ASN not found');

  const [asnLines] = await c.query('SELECT * FROM asn_line_items WHERE asn_id = ?', [asnId]);
  const raised = { price_mismatch: [], quantity_mismatch: [] };

  for (const asnLine of asnLines) {
    if (!asnLine.po_line_id) continue;
    const [[poLine]] = await c.query('SELECT * FROM po_line_items WHERE id = ?', [asnLine.po_line_id]);
    if (!poLine) continue;

    // Price: effective unit price implied by this ASN's invoiced amount, vs the PO's ordered unit price.
    const priceDedupKey = `price_mismatch:asn_line:${asnLine.id}`;
    if (Number(asnLine.quantity) > 0 && poLine.unit_price != null) {
      const effectiveUnitPrice = Number(asnLine.amount) / Number(asnLine.quantity);
      const deviationPct = round2(((effectiveUnitPrice - Number(poLine.unit_price)) / Number(poLine.unit_price)) * 100);
      if (Math.abs(deviationPct) > PRICE_MISMATCH_THRESHOLD_PCT) {
        const result = await raiseException({
          exception_type: 'price_mismatch',
          severity: Math.abs(deviationPct) > 10 ? 'high' : 'medium',
          module_name: 'asn',
          record_id: asnId,
          vendor_id: asn.vendor_id,
          transaction_chain_id: asn.transaction_chain_id,
          title: `Price mismatch on ${asn.asn_number}`,
          message: `Invoiced unit price ${round2(effectiveUnitPrice)} differs from the PO unit price ${poLine.unit_price} by ${deviationPct}% on "${poLine.description}".`,
          metadata: { po_line_item_id: poLine.id, po_unit_price: poLine.unit_price, invoiced_unit_price: round2(effectiveUnitPrice), deviation_pct: deviationPct },
          dedup_key: priceDedupKey,
        }, c);
        raised.price_mismatch.push(result);
      } else {
        await autoResolve(priceDedupKey, 'invoiced price is now within tolerance of the PO unit price', c);
      }
    }

    // Quantity: cumulative non-rejected ASN quantity against this PO line, vs what was ordered.
    // Per-ASN partial shipment is normal; this only fires on genuine over-shipment beyond the PO line.
    const qtyDedupKey = `quantity_mismatch:po_line:${poLine.id}`;
    const [[{ cumulativeQty }]] = await c.query(
      `SELECT COALESCE(SUM(ali.quantity), 0) as cumulativeQty FROM asn_line_items ali
       INNER JOIN asns a ON ali.asn_id = a.id
       WHERE ali.po_line_id = ? AND a.status != 'rejected'`,
      [poLine.id]
    );
    if (Number(cumulativeQty) > Number(poLine.quantity)) {
      const result = await raiseException({
        exception_type: 'quantity_mismatch',
        severity: 'high',
        module_name: 'asn',
        record_id: asnId,
        vendor_id: asn.vendor_id,
        transaction_chain_id: asn.transaction_chain_id,
        title: `Over-shipment on ${asn.asn_number}`,
        message: `Cumulative shipped quantity ${cumulativeQty} exceeds the ordered quantity ${poLine.quantity} on "${poLine.description}".`,
        metadata: { po_line_item_id: poLine.id, ordered_quantity: poLine.quantity, cumulative_shipped_quantity: Number(cumulativeQty) },
        dedup_key: qtyDedupKey,
      }, c);
      raised.quantity_mismatch.push(result);
    } else {
      await autoResolve(qtyDedupKey, 'cumulative shipped quantity is back within the ordered quantity', c);
    }
  }

  return raised;
}

module.exports = {
  raiseException,
  autoResolve,
  resolveException,
  getException,
  listExceptions,
  getSummaryCounts,
  getBudgetHealth,
  getTopRiskVendors,
  detectBudgetBreach,
  detectVendorRiskAlert,
  detectPriceAndQuantityMismatch,
};
