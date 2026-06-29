const { NotFoundError } = require('../../common/errors');
const repo = require('./traceability.repository');

// ─── Chain-id resolvers ──────────────────────────────────────────────────────
// Used at document-creation time (pr.routes.js, rfq.routes.js, po.routes.js,
// asn.routes.js) to decide what transaction_chain_id a new row gets. A
// document is the root of its own chain (chain_id = its own id) unless it was
// created from a parent document, in which case it inherits the parent's
// chain_id. Each resolver mirrors one specific "created from X" path that
// already exists in the codebase — there is no single generic case here
// because each module resolves its parent differently.

function rootChainId(ownId) {
  return ownId;
}

async function chainIdFromPr(prId, conn) {
  return repo.getChainIdForTable('purchase_requisitions', prId, conn);
}

async function chainIdFromRfq(rfqId, conn) {
  return repo.getChainIdForTable('rfqs', rfqId, conn);
}

async function chainIdFromPo(poId, conn) {
  return repo.getChainIdForTable('purchase_orders', poId, conn);
}

async function chainIdFromPrLineItem(prLineItemId, conn) {
  return repo.getChainIdFromPrLineItem(prLineItemId, conn);
}

// ─── getFullTraceability ─────────────────────────────────────────────────────
//
// Accepts the id of ANY document in the chain (PR, RFQ, PO, or ASN) and
// returns every document sharing its transaction_chain_id, plus the
// parent-child edges between them: PR<->RFQ and PR/RFQ<->PO edges come from
// the existing document_flow_mapping ledger (reused, not re-derived); the
// PO<->ASN edge comes directly from asn_line_items.po_line_id, since that FK
// relationship is already the single source of truth for it and writing it
// into the ledger too would just be a second copy of the same fact.
async function getFullTraceability(documentId, conn) {
  const found = await repo.findDocumentById(documentId, conn);
  if (!found) throw new NotFoundError('Document not found in any traceable module (PR, RFQ, PO, ASN, GRN, Invoice)');

  const chainId = found.row.transaction_chain_id || found.row.id;

  const [prs, rfqs, pos, asns] = await Promise.all([
    repo.getChainPurchaseRequisitions(chainId, conn),
    repo.getChainRfqs(chainId, conn),
    repo.getChainPurchaseOrders(chainId, conn),
    repo.getChainAsns(chainId, conn),
  ]);

  const prLineItemsByPr = {};
  for (const pr of prs) prLineItemsByPr[pr.id] = await repo.getPrLineItems(pr.id, conn);

  const rfqLineItemsByRfq = {};
  for (const rfq of rfqs) rfqLineItemsByRfq[rfq.id] = await repo.getRfqLineItems(rfq.id, conn);

  const poLineItemsByPo = {};
  for (const po of pos) poLineItemsByPo[po.id] = await repo.getPoLineItems(po.id, conn);

  const asnLineItemsByAsn = {};
  for (const asn of asns) asnLineItemsByAsn[asn.id] = await repo.getAsnLineItems(asn.id, conn);

  // GRN/Invoice — the two formal stages between ASN and ERP posting. Each
  // ASN has at most one of either (UNIQUE on invoices.asn_id; one GRN per
  // ASN by construction in grn.service.js).
  const grnByAsn = {};
  const invoiceByAsn = {};
  for (const asn of asns) {
    const grn = await repo.getGrnForAsn(asn.id, conn);
    if (grn) grn.line_items = await repo.getGrnLineItems(grn.id, conn);
    grnByAsn[asn.id] = grn;

    const invoice = await repo.getInvoiceForAsn(asn.id, conn);
    if (invoice) invoice.line_items = await repo.getInvoiceLineItems(invoice.id, conn);
    invoiceByAsn[asn.id] = invoice;
  }
  const grns = Object.values(grnByAsn).filter(Boolean);
  const invoices = Object.values(invoiceByAsn).filter(Boolean);

  // ── Edges: PR/RFQ -> PO, from document_flow_mapping ──
  const allPrLineIds = Object.values(prLineItemsByPr).flat().map(li => li.id);
  const allRfqLineIds = Object.values(rfqLineItemsByRfq).flat().map(li => li.id);
  const mappings = await repo.getFlowMappingsForLineIds([...allPrLineIds, ...allRfqLineIds], conn);

  const prLineDescById = {};
  for (const li of Object.values(prLineItemsByPr).flat()) prLineDescById[li.id] = li.description;
  const rfqLineDescById = {};
  for (const li of Object.values(rfqLineItemsByRfq).flat()) rfqLineDescById[li.id] = li.item_description;
  const poLineDescById = {};
  for (const li of Object.values(poLineItemsByPo).flat()) poLineDescById[li.id] = li.description;

  const edges = mappings.map(m => ({
    from: { type: m.source_doc_type === 'PR' ? 'purchase_requisition' : 'rfq', line_item_id: m.source_line_id, description: m.source_doc_type === 'PR' ? prLineDescById[m.source_line_id] : rfqLineDescById[m.source_line_id] },
    to: { type: m.target_doc_type === 'RFQ' ? 'rfq' : 'purchase_order', line_item_id: m.target_line_id, description: m.target_doc_type === 'RFQ' ? rfqLineDescById[m.target_line_id] : poLineDescById[m.target_line_id] },
    quantity: m.mapped_quantity,
    created_at: m.created_at,
  }));

  // ── Edges: PO -> ASN, directly from the FK (no ledger row needed) ──
  for (const asn of asns) {
    for (const asnLine of asnLineItemsByAsn[asn.id] || []) {
      if (!asnLine.po_line_id) continue;
      edges.push({
        from: { type: 'purchase_order', line_item_id: asnLine.po_line_id, description: poLineDescById[asnLine.po_line_id] },
        to: { type: 'asn', line_item_id: asnLine.id, description: asnLine.description },
        quantity: asnLine.quantity,
        created_at: asn.created_at,
      });
    }
  }

  // ── Edges: ASN -> GRN, ASN -> Invoice, directly from the FK ──
  for (const asn of asns) {
    const grn = grnByAsn[asn.id];
    for (const grnLine of grn?.line_items || []) {
      edges.push({
        from: { type: 'asn', line_item_id: grnLine.asn_line_item_id, description: null },
        to: { type: 'goods_receipt_note', line_item_id: grnLine.id, description: null },
        quantity: grnLine.received_quantity,
        created_at: grn.created_at,
      });
    }
    const invoice = invoiceByAsn[asn.id];
    for (const invLine of invoice?.line_items || []) {
      edges.push({
        from: { type: 'asn', line_item_id: invLine.asn_line_item_id, description: null },
        to: { type: 'invoice', line_item_id: invLine.id, description: null },
        quantity: invLine.quantity,
        created_at: invoice.created_at,
      });
    }
  }

  const documents = {
    purchase_requisitions: prs.map(pr => ({ ...pr, line_items: prLineItemsByPr[pr.id] })),
    rfqs: rfqs.map(rfq => ({ ...rfq, line_items: rfqLineItemsByRfq[rfq.id] })),
    purchase_orders: pos.map(po => ({ ...po, line_items: poLineItemsByPo[po.id] })),
    asns: asns.map(asn => ({ ...asn, line_items: asnLineItemsByAsn[asn.id], grn: grnByAsn[asn.id] || null, invoice: invoiceByAsn[asn.id] || null })),
    goods_receipt_notes: grns,
    invoices,
  };

  // Chronological timeline across every document — a flat, sorted view on
  // top of the same `documents` data, useful for a UI activity feed later.
  const timeline = [
    ...prs.map(d => ({ type: 'purchase_requisition', id: d.id, number: d.pr_number, status: d.status, at: d.created_at })),
    ...rfqs.map(d => ({ type: 'rfq', id: d.id, number: d.rfq_number, status: d.status, at: d.created_at })),
    ...pos.map(d => ({ type: 'purchase_order', id: d.id, number: d.po_number, status: d.status, at: d.created_at })),
    ...asns.map(d => ({ type: 'asn', id: d.id, number: d.asn_number, status: d.status, at: d.created_at })),
    ...grns.map(d => ({ type: 'goods_receipt_note', id: d.id, number: d.grn_number, status: d.status, at: d.created_at, asn_id: d.asn_id })),
    ...invoices.map(d => ({ type: 'invoice', id: d.id, number: d.invoice_number, status: d.match_status, at: d.created_at, asn_id: d.asn_id })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return {
    transaction_chain_id: chainId,
    requested_document: { type: found.type, id: found.row.id },
    summary: {
      purchase_requisition_count: prs.length,
      rfq_count: rfqs.length,
      purchase_order_count: pos.length,
      asn_count: asns.length,
      goods_receipt_note_count: grns.length,
      invoice_count: invoices.length,
      total_po_value: pos.reduce((s, po) => s + Number(po.total_amount || 0), 0),
      total_asn_value: asns.reduce((s, a) => s + Number(a.total_amount || 0), 0),
    },
    documents,
    edges,
    timeline,
  };
}

module.exports = {
  rootChainId,
  chainIdFromPr,
  chainIdFromRfq,
  chainIdFromPo,
  chainIdFromPrLineItem,
  getFullTraceability,
};
