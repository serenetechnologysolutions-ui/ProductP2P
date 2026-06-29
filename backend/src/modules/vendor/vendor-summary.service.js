const { NotFoundError } = require('../../common/errors');
const repo = require('./vendor-summary.repository');

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

// Vendor 360 Profile — every field here is computed on read from
// purchase_orders/asns, never stored. Backs GET /api/vendors/:id/summary.
async function getVendorSummary(vendorId, conn) {
  const vendor = await repo.getVendorBasic(vendorId, conn);
  if (!vendor) throw new NotFoundError('Vendor not found');

  const po = await repo.getPoAggregatesForVendor(vendorId, conn);
  const asnRows = await repo.getAsnRowsForVendor(vendorId, conn);

  // Rejection rate: same definition risk.service.js uses for rejection_score
  // (status = 'rejected'), expressed here as a percentage of all ASNs rather
  // than a capped 0-100 risk contribution — one definition of "rejected", two views of it.
  const rejectedCount = asnRows.filter(a => a.status === 'rejected').length;
  const rejectionRate = asnRows.length > 0 ? round2((rejectedCount / asnRows.length) * 100) : null;

  // On-time delivery: prefer the real actual_delivery_date vs eta comparison
  // when it's been filled in; fall back to the same eta-vs-created_at proxy
  // risk.service.js uses for its delay_score when actual_delivery_date is
  // NULL, so this doesn't silently invent a second definition of "late".
  const deliveredRows = asnRows.filter(a => a.status !== 'rejected');
  let onTimeCount = 0;
  for (const a of deliveredRows) {
    const onTime = a.actual_delivery_date
      ? new Date(a.actual_delivery_date) <= new Date(a.eta)
      : !(new Date(a.eta) < new Date(a.created_at));
    if (onTime) onTimeCount++;
  }
  const onTimeDeliveryPct = deliveredRows.length > 0 ? round2((onTimeCount / deliveredRows.length) * 100) : null;

  const lastAsnDate = asnRows.length > 0 ? asnRows.reduce((max, a) => (!max || new Date(a.created_at) > new Date(max)) ? a.created_at : max, null) : null;
  const lastTransactionDate = [po.last_po_date, lastAsnDate].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return {
    vendor_id: vendor.id,
    vendor_name: vendor.vendor_name,
    status: vendor.status,
    total_spend: round2(po.total_spend),
    active_po_count: Number(po.active_po_count) || 0,
    total_po_count: Number(po.total_po_count) || 0,
    on_time_delivery_pct: onTimeDeliveryPct,
    rejection_rate: rejectionRate,
    last_transaction_date: lastTransactionDate,
    // Denominators included alongside the rates above so a UI/consumer can
    // show "92% (23/25)" instead of a bare, unverifiable percentage.
    sample_sizes: { delivery_evaluated: deliveredRows.length, asn_total: asnRows.length },
  };
}

module.exports = { getVendorSummary };
