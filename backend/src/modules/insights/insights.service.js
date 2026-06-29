const { NotFoundError } = require('../../common/errors');
const { calculateVendorRiskScore } = require('../risk/risk.service');
const { getPrOrThrow, computeBudgetStatus, computeSourcingRecommendation } = require('../pr/pr.helpers');
const repo = require('./insights.repository');

// ─── Shared statistics helpers ──────────────────────────────────────────────

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

function priceStats(rows) {
  if (rows.length === 0) {
    return { record_count: 0, avg_price: null, min_price: null, max_price: null, last_price: null, last_recorded_at: null, price_volatility: null };
  }
  const prices = rows.map(r => Number(r.unit_price));
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const variance = prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length;
  // rows are ordered DESC by recorded_at by the repository query
  const latest = rows[0];
  return {
    record_count: rows.length,
    avg_price: round2(avg),
    min_price: round2(Math.min(...prices)),
    max_price: round2(Math.max(...prices)),
    last_price: round2(latest.unit_price),
    last_recorded_at: latest.recorded_at,
    // Population standard deviation — a wide spread here means the item has
    // been bought at very inconsistent prices, which is itself a decision signal
    // (worth standardizing via a contract or RFQ) independent of the average.
    price_volatility: round2(Math.sqrt(variance)),
  };
}

function vendorBreakdown(rows) {
  const byVendor = {};
  for (const r of rows) {
    const key = r.vendor_id || 'unknown';
    if (!byVendor[key]) byVendor[key] = { vendor_id: r.vendor_id, vendor_name: r.vendor_name || 'Unknown vendor', prices: [], last_recorded_at: r.recorded_at };
    byVendor[key].prices.push(Number(r.unit_price));
    if (new Date(r.recorded_at) > new Date(byVendor[key].last_recorded_at)) byVendor[key].last_recorded_at = r.recorded_at;
  }
  return Object.values(byVendor)
    .map(v => ({
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      record_count: v.prices.length,
      avg_price: round2(v.prices.reduce((s, p) => s + p, 0) / v.prices.length),
      last_price: round2(v.prices[0]),
      last_recorded_at: v.last_recorded_at,
    }))
    .sort((a, b) => a.avg_price - b.avg_price);
}

// ─── getItemPriceBenchmark ───────────────────────────────────────────────────
//
// Reusable across PR (line-item estimate sanity-check), RFQ (target price /
// bid comparison), and PO (unit price sanity-check) — every caller gets the
// exact same benchmark numbers for a given item, computed one way.
async function getItemPriceBenchmark(itemId, conn) {
  const item = await repo.getItemMasterById(itemId, conn);
  if (!item) throw new NotFoundError('Item not found');

  const rows = await repo.getPriceHistoryForItem(itemId, item.item_description, conn);
  const benchmark = priceStats(rows);
  const vendor_breakdown = vendorBreakdown(rows);

  // Item-level preferred vendors (item_vendor_mapping) — who's designated as
  // good for THIS item, independent of any single PR's own vendor pick.
  const preferredRows = await repo.getPreferredVendorsForItem(itemId, conn);
  const preferred_vendors = preferredRows.map(r => ({
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name,
    is_preferred: !!r.is_preferred,
    vendor_status: r.vendor_status,
    vendor_segment: r.vendor_segment,
    blacklist_flag: !!r.blacklist_flag,
    usable: r.vendor_status === 'approved' && !r.blacklist_flag,
  }));

  // Compare the realized market average against the item's own standard_cost
  // (item_master.standard_cost) — a field that exists today but, until now,
  // was never actually checked against real purchase prices anywhere in the app.
  let cost_deviation = { standard_cost: item.standard_cost, deviation_pct: null, status: 'not_set' };
  if (item.standard_cost != null && benchmark.avg_price != null) {
    const deviationPct = round2(((benchmark.avg_price - Number(item.standard_cost)) / Number(item.standard_cost)) * 100);
    cost_deviation = {
      standard_cost: item.standard_cost,
      deviation_pct: deviationPct,
      status: deviationPct > 10 ? 'above_standard' : deviationPct < -10 ? 'below_standard' : 'within_standard',
    };
  }

  let insight = { level: 'info', message: 'No purchase history recorded for this item yet — benchmark will populate as POs are placed.' };
  if (benchmark.record_count > 0) {
    if (cost_deviation.status === 'above_standard') {
      insight = { level: 'warning', message: `Market average price is ${cost_deviation.deviation_pct}% above the item's standard cost.` };
    } else if (vendor_breakdown.length > 1) {
      const cheapest = vendor_breakdown[0];
      const priciest = vendor_breakdown[vendor_breakdown.length - 1];
      const spreadPct = round2(((priciest.avg_price - cheapest.avg_price) / cheapest.avg_price) * 100);
      insight = spreadPct > 15
        ? { level: 'warning', message: `${spreadPct}% price spread across ${vendor_breakdown.length} vendors — ${cheapest.vendor_name} averages the lowest at ${cheapest.avg_price}.` }
        : { level: 'info', message: `Pricing is consistent across ${vendor_breakdown.length} vendor(s).` };
    } else {
      insight = { level: 'info', message: `${benchmark.record_count} historical record(s) from a single vendor — no cross-vendor comparison available yet.` };
    }
  }

  return {
    item: {
      id: item.id, item_code: item.item_code, item_description: item.item_description,
      uom: item.uom, currency: item.currency || 'INR',
    },
    benchmark,
    cost_deviation,
    vendor_breakdown,
    preferred_vendors,
    insight,
  };
}

// ─── getShouldCostBenchmark ──────────────────────────────────────────────────
//
// Should-Cost Benchmark: compares any quoted/proposed unit price (an RFQ bid,
// a PO line override, a fresh PR estimate) against the item's should-cost —
// the market average derived from historical price_history — flagging a
// warning when the deviation is high. Reuses getItemPriceBenchmark's market
// average rather than recomputing it a second way.
const SHOULD_COST_HIGH_DEVIATION_PCT = 15;

async function getShouldCostBenchmark(itemId, quotedPrice, conn) {
  const benchmark = await getItemPriceBenchmark(itemId, conn);
  const shouldCost = benchmark.benchmark.avg_price;

  let deviation_pct = null;
  let status = 'no_history';
  let warning = null;

  if (shouldCost != null && quotedPrice != null) {
    deviation_pct = round2(((Number(quotedPrice) - shouldCost) / shouldCost) * 100);
    status = Math.abs(deviation_pct) >= SHOULD_COST_HIGH_DEVIATION_PCT ? 'high_deviation' : 'within_tolerance';
    if (status === 'high_deviation') {
      warning = {
        level: 'warning',
        message: `Quoted price ${quotedPrice} is ${Math.abs(deviation_pct)}% ${deviation_pct > 0 ? 'above' : 'below'} the should-cost benchmark of ${shouldCost} (based on ${benchmark.benchmark.record_count} historical record(s)).`,
      };
    }
  }

  return {
    item: benchmark.item,
    should_cost: shouldCost,
    quoted_price: quotedPrice != null ? Number(quotedPrice) : null,
    deviation_pct,
    status,
    high_deviation_threshold_pct: SHOULD_COST_HIGH_DEVIATION_PCT,
    warning,
    record_count: benchmark.benchmark.record_count,
  };
}

// ─── getVendorScore ──────────────────────────────────────────────────────────
//
// Blends the existing risk-scoring module (reused, not duplicated) with two
// dimensions risk scoring doesn't cover: how this vendor's prices compare to
// the market, and whether the commercial relationship is actually backed by
// a contract. Reusable across PR (preferred-vendor sanity-check), RFQ
// (vendor scorecard), and PO (pre-issue check).
async function getVendorScore(vendorId, conn) {
  const vendor = await repo.getVendorBasic(vendorId, conn);
  if (!vendor) throw new NotFoundError('Vendor not found');

  // Always recompute fresh rather than reading a possibly-stale cached row —
  // this is a single-vendor calculation (a handful of COUNT queries), cheap
  // enough to run on every call, and decision support should reflect current
  // data, not whenever someone last clicked "Recalculate Scores" globally.
  const risk = await calculateVendorRiskScore(vendorId, conn);

  // ── Price competitiveness ──
  const vendorPriceRows = await repo.getPriceHistoryForVendor(vendorId, conn);
  const itemIds = [...new Set(vendorPriceRows.map(r => r.item_master_id).filter(Boolean))];
  const marketRows = await repo.getPriceHistoryForItemIds(itemIds, conn);

  const marketAvgByItem = {};
  for (const id of itemIds) {
    const prices = marketRows.filter(r => r.item_master_id === id).map(r => Number(r.unit_price));
    if (prices.length > 0) marketAvgByItem[id] = prices.reduce((s, p) => s + p, 0) / prices.length;
  }
  const vendorAvgByItem = {};
  for (const id of itemIds) {
    const prices = vendorPriceRows.filter(r => r.item_master_id === id).map(r => Number(r.unit_price));
    if (prices.length > 0) vendorAvgByItem[id] = prices.reduce((s, p) => s + p, 0) / prices.length;
  }
  const deviations = itemIds
    .filter(id => marketAvgByItem[id] > 0)
    .map(id => ((vendorAvgByItem[id] - marketAvgByItem[id]) / marketAvgByItem[id]) * 100);
  const itemsWithoutBenchmark = vendorPriceRows.filter(r => !r.item_master_id).length;

  const avgDeviationPct = deviations.length > 0 ? round2(deviations.reduce((s, d) => s + d, 0) / deviations.length) : null;
  const priceCompetitiveness = {
    items_compared: deviations.length,
    items_without_item_master_link: itemsWithoutBenchmark,
    avg_deviation_from_market_pct: avgDeviationPct,
    // 70 = priced exactly at market average; every 1% above market costs 1.5
    // points, every 1% below market earns 1.5 points back, clamped to 0-100.
    // Documented and returned alongside the raw deviation so the score is
    // auditable rather than a black box.
    score: avgDeviationPct == null ? null : Math.max(0, Math.min(100, round2(70 - avgDeviationPct * 1.5))),
  };

  // ── Contract relationship ──
  const contracts = await repo.getContractsForVendor(vendorId, conn);
  const activeContract = contracts.find(c => c.status === 'active') || null;
  const contractSummary = {
    total_contracts: contracts.length,
    has_active_contract: !!activeContract,
    active_contract: activeContract ? {
      id: activeContract.id, contract_number: activeContract.contract_number,
      end_date: activeContract.end_date, contract_value: activeContract.contract_value, currency: activeContract.currency,
    } : null,
    // 100 = relationship formalized under an active contract; 60 = no contract
    // on file (neutral — most vendors are transactional, this isn't a fault);
    // 40 = had one and let it lapse without renewing, which is worth a look.
    score: activeContract ? 100 : (contracts.length > 0 ? 40 : 60),
  };

  // ── Composite ──
  const reliabilityScore = round2(100 - Number(risk.risk_score)); // invert risk: higher = better
  const priceScoreForComposite = priceCompetitiveness.score == null ? 70 : priceCompetitiveness.score; // neutral default until there's history
  const performanceScore = round2(
    reliabilityScore * 0.6 +
    priceScoreForComposite * 0.25 +
    contractSummary.score * 0.15
  );

  const insights = [];
  if (vendor.blacklist_flag) insights.push({ type: 'blacklist', severity: 'critical', message: 'Vendor is currently blacklisted.' });
  if (risk.risk_level === 'high') insights.push({ type: 'risk_level', severity: 'critical', message: 'Vendor risk level is High.' });
  if (risk.risk_trend === 'worsening') insights.push({ type: 'risk_trend', severity: 'warning', message: 'Vendor risk has worsened since the last calculation.' });
  if (avgDeviationPct != null && avgDeviationPct > 10) {
    insights.push({ type: 'price_competitiveness', severity: 'warning', message: `Vendor's prices average ${avgDeviationPct}% above market across ${priceCompetitiveness.items_compared} item(s).` });
  }
  if (!contractSummary.has_active_contract && contracts.length === 0) {
    insights.push({ type: 'contract_gap', severity: 'info', message: 'No contract on file for this vendor.' });
  }
  if (insights.length === 0) insights.push({ type: 'overall', severity: 'info', message: 'No outstanding concerns — vendor is performing within normal parameters.' });

  return {
    vendor: { id: vendor.id, vendor_name: vendor.vendor_name, status: vendor.status, risk_category: vendor.risk_category, blacklist_flag: !!vendor.blacklist_flag },
    risk: {
      risk_score: risk.risk_score, risk_level: risk.risk_level, risk_trend: risk.risk_trend,
      delay_score: risk.delay_score, rejection_score: risk.rejection_score, audit_score: risk.audit_score,
      financial_risk_score: risk.financial_risk_score, dependency_risk_score: risk.dependency_risk_score,
      geographic_risk_score: risk.geographic_risk_score, esg_risk_score: risk.esg_risk_score,
    },
    price_competitiveness: priceCompetitiveness,
    contract_summary: contractSummary,
    performance_score: performanceScore,
    insights,
  };
}

// ─── getVendorContractSummary ────────────────────────────────────────────────
// Standalone accessor for the contract-usage half of getVendorScore, exposed
// separately since "contract usage tracking" is its own scope item and PR/PO
// flows may want it without paying for a full risk recalculation.
async function getVendorContractSummary(vendorId, conn) {
  const vendor = await repo.getVendorBasic(vendorId, conn);
  if (!vendor) throw new NotFoundError('Vendor not found');
  const contracts = await repo.getContractsForVendor(vendorId, conn);
  const activeContract = contracts.find(c => c.status === 'active') || null;
  return {
    vendor_id: vendorId,
    total_contracts: contracts.length,
    has_active_contract: !!activeContract,
    active_contract: activeContract,
    contracts,
  };
}

// ─── suggestVendorsForItem ───────────────────────────────────────────────────
//
// RFQ Vendor Suggestion: ranks candidate vendors for sourcing a given item
// using exactly the three signals asked for — item purchase history (who's
// actually supplied it, at what price), vendor score (getVendorScore's
// performance_score, itself already a blend of reliability/price/contract),
// and risk level (surfaced explicitly too, since a high scorer who's
// currently flagged High risk is worth calling out, not just averaged away).
// Reused as-is by RFQ creation — no separate suggestion logic duplicated there.
async function suggestVendorsForItem(itemId, conn) {
  const benchmark = await getItemPriceBenchmark(itemId, conn);

  // Candidate pool: item-level preferred vendors (item_vendor_mapping) plus
  // every vendor who has actually supplied this item before (price_history) —
  // a vendor doesn't need to be pre-mapped "preferred" to be a legitimate
  // suggestion if they already have a track record on this exact item.
  const candidateIds = new Set();
  benchmark.preferred_vendors.forEach(v => { if (v.vendor_id) candidateIds.add(v.vendor_id); });
  benchmark.vendor_breakdown.forEach(v => { if (v.vendor_id) candidateIds.add(v.vendor_id); });

  const suggestions = [];
  for (const vendorId of candidateIds) {
    let score;
    try { score = await getVendorScore(vendorId, conn); } catch { continue; } // vendor missing/inactive — skip rather than fail the whole list
    if (score.vendor.blacklist_flag) continue; // never suggest a blacklisted vendor

    const history = benchmark.vendor_breakdown.find(v => v.vendor_id === vendorId) || null;
    const preferredEntry = benchmark.preferred_vendors.find(v => v.vendor_id === vendorId) || null;

    suggestions.push({
      vendor_id: vendorId,
      vendor_name: score.vendor.vendor_name,
      is_preferred_for_item: !!preferredEntry?.is_preferred,
      vendor_segment: preferredEntry?.vendor_segment || null,
      item_history: history ? {
        record_count: history.record_count, avg_price: history.avg_price,
        last_price: history.last_price, last_recorded_at: history.last_recorded_at,
      } : null,
      vendor_score: score.performance_score,
      risk_level: score.risk.risk_level,
      risk_score: score.risk.risk_score,
      has_active_contract: score.contract_summary.has_active_contract,
      // Explainable ranking number, not just performance_score reused verbatim:
      // a bonus for a proven track record on THIS item and for being marked
      // preferred for it, and a penalty for elevated risk on top of whatever
      // performance_score already factors in.
      suggestion_score: Math.max(0, Math.min(100, round2(
        score.performance_score
        + (history ? 5 : 0)
        + (preferredEntry?.is_preferred ? 5 : 0)
        - (score.risk.risk_level === 'high' ? 15 : score.risk.risk_level === 'medium' ? 5 : 0)
      ))),
    });
  }

  suggestions.sort((a, b) => b.suggestion_score - a.suggestion_score);

  return {
    item: benchmark.item,
    candidates_evaluated: suggestions.length,
    suggestions,
  };
}

// ─── getPRInsights ───────────────────────────────────────────────────────────
//
// Composes everything above plus the PR module's own existing helpers (reused
// verbatim, not reimplemented) into one decision-support payload for a single
// requisition: budget position, sourcing-strategy sanity check, per-line price
// alerts, the resolved vendor's score, and contract-usage opportunity.
async function getPRInsights(prId, conn) {
  const pr = await getPrOrThrow(prId, conn); // throws NotFoundError if missing — reused from pr.helpers
  const lineItems = await repo.getPrLineItems(prId, conn);

  const budget = await computeBudgetStatus(pr.cost_center, pr.total_value, conn);
  const sourcingRecommendation = await computeSourcingRecommendation(
    { total_value: pr.total_value, preferred_vendor_id: pr.preferred_vendor_id, contract_id: pr.contract_id },
    conn
  );

  // Per-line price benchmarking — only for lines linked to the Item Master,
  // since that's the only stable identity price_history can be matched on.
  const PRICE_ALERT_THRESHOLD_PCT = 10;
  const lineInsights = [];

  // PR Intelligence Panel — one entry per line, ALWAYS present (unlike
  // lineInsights above, which only carries lines that crossed the alert
  // threshold or have no history). This is what the inline PR-page panel
  // renders: last purchase price, preferred vendors, contract availability,
  // and price variance, side by side, for every line on the requisition.
  const intelligencePanel = [];

  for (const line of lineItems) {
    const panelEntry = {
      pr_line_item_id: line.id,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
      estimated_unit_price: line.estimated_unit_price,
      last_purchase_price: null,
      price_variance_pct: null,
      line_preferred_vendor: null,
      preferred_vendors: [],
      contract_availability: { has_active_contract: false, vendors_with_contract: [] },
    };

    // The line's own explicit vendor pick (pr_line_items.preferred_vendor_id),
    // distinct from the item-level item_vendor_mapping list below.
    if (line.preferred_vendor_id) {
      const lineVendor = await repo.getVendorBasic(line.preferred_vendor_id, conn);
      if (lineVendor) {
        panelEntry.line_preferred_vendor = {
          vendor_id: lineVendor.id, vendor_name: lineVendor.vendor_name,
          status: lineVendor.status, blacklist_flag: !!lineVendor.blacklist_flag,
        };
      }
    }

    if (line.item_master_id) {
      const benchmark = await getItemPriceBenchmark(line.item_master_id, conn);
      panelEntry.last_purchase_price = benchmark.benchmark.last_price;
      panelEntry.preferred_vendors = benchmark.preferred_vendors;

      // Contract availability scoped to this item's preferred vendors — distinct
      // from contract_usage below, which only checks the PR's single resolved vendor.
      const vendorsWithContract = [];
      for (const pv of benchmark.preferred_vendors) {
        if (!pv.vendor_id) continue;
        const pvContracts = await repo.getContractsForVendor(pv.vendor_id, conn);
        const activePvContract = pvContracts.find(c => c.status === 'active');
        if (activePvContract) {
          vendorsWithContract.push({
            vendor_id: pv.vendor_id, vendor_name: pv.vendor_name,
            contract_number: activePvContract.contract_number, end_date: activePvContract.end_date,
          });
        }
      }
      panelEntry.contract_availability = { has_active_contract: vendorsWithContract.length > 0, vendors_with_contract: vendorsWithContract };

      if (line.estimated_unit_price != null) {
        if (benchmark.benchmark.record_count === 0) {
          lineInsights.push({ pr_line_item_id: line.id, description: line.description, type: 'no_history', severity: 'info', message: 'No purchase history for this item — cannot benchmark yet.' });
        } else {
          const deviationPct = round2(((Number(line.estimated_unit_price) - benchmark.benchmark.avg_price) / benchmark.benchmark.avg_price) * 100);
          panelEntry.price_variance_pct = deviationPct;
          if (Math.abs(deviationPct) >= PRICE_ALERT_THRESHOLD_PCT) {
            lineInsights.push({
              pr_line_item_id: line.id, description: line.description,
              type: deviationPct > 0 ? 'price_above_benchmark' : 'price_below_benchmark',
              severity: deviationPct > 0 ? 'warning' : 'info',
              message: `Estimated price is ${Math.abs(deviationPct)}% ${deviationPct > 0 ? 'above' : 'below'} the ${benchmark.benchmark.avg_price} market average.`,
              estimated_unit_price: line.estimated_unit_price, market_avg_price: benchmark.benchmark.avg_price, deviation_pct: deviationPct,
            });
          }
        }
      }
    }

    intelligencePanel.push(panelEntry);
  }

  // Resolve the vendor this requisition is actually pointed at — either an
  // explicit preferred vendor, or (for contract-based sourcing) the vendor
  // behind the linked contract — so we can attach a vendor score and check
  // for an unused contract from the *same* resolved vendor.
  let targetVendorId = pr.preferred_vendor_id || null;
  let linkedContract = null;
  if (pr.contract_id) {
    linkedContract = await repo.getContractById(pr.contract_id, conn);
    if (linkedContract) targetVendorId = targetVendorId || linkedContract.vendor_id;
  }

  let vendorScore = null;
  let contractUsage = null;
  if (targetVendorId) {
    vendorScore = await getVendorScore(targetVendorId, conn);
    const contracts = await repo.getContractsForVendor(targetVendorId, conn);
    const activeContract = contracts.find(c => c.status === 'active') || null;
    contractUsage = {
      has_active_contract: !!activeContract,
      active_contract: activeContract,
      is_contract_based_sourcing: pr.sourcing_strategy === 'CONTRACT_BASED',
      // The actionable case: an active contract exists for this vendor but
      // the requisition isn't using contract-based sourcing to take advantage of it.
      contract_available_not_used: !!activeContract && pr.sourcing_strategy !== 'CONTRACT_BASED',
    };
  }

  const insights = [];
  if (budget.budget_status === 'exceeds_budget') {
    insights.push({ type: 'budget', severity: 'critical', message: `Requisition value exceeds the remaining budget for cost center ${pr.cost_center} (remaining: ${budget.remaining_amount}).` });
  } else if (budget.budget_status === 'not_configured') {
    insights.push({ type: 'budget', severity: 'info', message: 'No budget allocation configured for this cost center — spend is untracked.' });
  }
  if (pr.sourcing_strategy && sourcingRecommendation.recommended_strategy !== pr.sourcing_strategy) {
    insights.push({ type: 'sourcing_strategy', severity: 'info', message: `Selected sourcing strategy (${pr.sourcing_strategy}) differs from the recommended ${sourcingRecommendation.recommended_strategy} — ${sourcingRecommendation.reason}` });
  }
  for (const li of lineInsights) {
    if (li.type !== 'no_history') insights.push({ type: li.type, severity: li.severity, message: `[${li.description}] ${li.message}` });
  }
  if (vendorScore) insights.push(...vendorScore.insights.map(i => ({ ...i, type: `vendor_${i.type}`, message: `[${vendorScore.vendor.vendor_name}] ${i.message}` })));
  if (contractUsage?.contract_available_not_used) {
    insights.push({ type: 'contract_available_not_used', severity: 'warning', message: `An active contract (${contractUsage.active_contract.contract_number}) exists for this vendor but this requisition isn't using contract-based sourcing.` });
  }
  if (insights.length === 0) insights.push({ type: 'overall', severity: 'info', message: 'No outstanding concerns for this requisition.' });

  return {
    pr: { id: pr.id, pr_number: pr.pr_number, department: pr.department, status: pr.status, total_value: pr.total_value, sourcing_strategy: pr.sourcing_strategy },
    budget,
    sourcing_recommendation: sourcingRecommendation,
    line_item_insights: lineInsights,
    intelligence_panel: intelligencePanel,
    vendor_score: vendorScore,
    contract_usage: contractUsage,
    insights,
  };
}

module.exports = {
  getItemPriceBenchmark,
  getShouldCostBenchmark,
  getVendorScore,
  getVendorContractSummary,
  suggestVendorsForItem,
  getPRInsights,
};
