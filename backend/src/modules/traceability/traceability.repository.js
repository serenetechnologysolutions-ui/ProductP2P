const { pool } = require('../../config/database');

// Pure data access for TraceabilityService. No business logic — every
// function here either probes for a document's type or fetches rows.

const DOC_TABLES = [
  { type: 'purchase_requisition', table: 'purchase_requisitions', numberCol: 'pr_number' },
  { type: 'rfq', table: 'rfqs', numberCol: 'rfq_number' },
  { type: 'purchase_order', table: 'purchase_orders', numberCol: 'po_number' },
  { type: 'asn', table: 'asns', numberCol: 'asn_number' },
  // GRN/Invoice both carry their own transaction_chain_id (copied from the
  // parent ASN at creation) — accepting their id as an entry point matters
  // because exceptions raised from grn.service.js/invoice.service.js use the
  // GRN's/invoice's own id as record_id, not the parent ASN's id.
  { type: 'goods_receipt_note', table: 'goods_receipt_notes', numberCol: 'grn_number' },
  { type: 'invoice', table: 'invoices', numberCol: 'invoice_number' },
];

// A documentId could belong to any of the four chain tables — probe each by
// primary key (cheap, indexed) until one matches. Also supports lookup by
// document number (PR-000001, PO-000001, etc.) for user convenience.
// Returns null if none do.
async function findDocumentById(documentId, conn) {
  const c = conn || pool;
  // First try by UUID (primary key)
  for (const def of DOC_TABLES) {
    const [rows] = await c.query(`SELECT * FROM ${def.table} WHERE id = ?`, [documentId]);
    if (rows.length > 0) return { type: def.type, row: rows[0] };
  }
  // Fallback: try by document number (pr_number, po_number, etc.)
  for (const def of DOC_TABLES) {
    if (def.numberCol) {
      const [rows] = await c.query(`SELECT * FROM ${def.table} WHERE ${def.numberCol} = ?`, [documentId]);
      if (rows.length > 0) return { type: def.type, row: rows[0] };
    }
  }
  return null;
}

async function getChainPurchaseRequisitions(chainId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM purchase_requisitions WHERE transaction_chain_id = ?', [chainId]);
  return rows;
}

async function getChainRfqs(chainId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM rfqs WHERE transaction_chain_id = ?', [chainId]);
  return rows;
}

async function getChainPurchaseOrders(chainId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT po.*, v.vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.transaction_chain_id = ?`,
    [chainId]
  );
  return rows;
}

async function getChainAsns(chainId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT a.*, v.vendor_name FROM asns a LEFT JOIN vendors v ON a.vendor_id = v.id WHERE a.transaction_chain_id = ?`,
    [chainId]
  );
  return rows;
}

async function getPrLineItems(prId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY sequence', [prId]);
  return rows;
}

async function getRfqLineItems(rfqId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM rfq_line_items WHERE rfq_id = ? ORDER BY sequence', [rfqId]);
  return rows;
}

async function getPoLineItems(poId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM po_line_items WHERE po_id = ? ORDER BY line_number', [poId]);
  return rows;
}

async function getAsnLineItems(asnId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM asn_line_items WHERE asn_id = ? ORDER BY line_number', [asnId]);
  return rows;
}

async function getGrnForAsn(asnId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM goods_receipt_notes WHERE asn_id = ?', [asnId]);
  return rows[0] || null;
}

async function getGrnLineItems(grnId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM grn_line_items WHERE grn_id = ?', [grnId]);
  return rows;
}

async function getInvoiceForAsn(asnId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM invoices WHERE asn_id = ?', [asnId]);
  return rows[0] || null;
}

async function getInvoiceLineItems(invoiceId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM invoice_line_items WHERE invoice_id = ?', [invoiceId]);
  return rows;
}

// document_flow_mapping rows touching any of the given line ids, on either
// side of the edge (PR->RFQ, PR->PO, RFQ->PO) — the existing ledger written
// by pr.helpers.recordMapping(), reused as-is rather than re-derived.
async function getFlowMappingsForLineIds(lineIds, conn) {
  if (!lineIds || lineIds.length === 0) return [];
  const c = conn || pool;
  const placeholders = lineIds.map(() => '?').join(',');
  const [rows] = await c.query(
    `SELECT * FROM document_flow_mapping WHERE source_line_id IN (${placeholders}) OR target_line_id IN (${placeholders})`,
    [...lineIds, ...lineIds]
  );
  return rows;
}

async function getChainIdForTable(table, id, conn) {
  const c = conn || pool;
  const [rows] = await c.query(`SELECT transaction_chain_id FROM ${table} WHERE id = ?`, [id]);
  return rows[0] ? rows[0].transaction_chain_id : null;
}

// Resolves a PR's chain id starting from one of its line items — used when
// a manually-created PO only carries a pr_line_item_id, not the parent PR's
// id directly (see po.routes.js POST /).
async function getChainIdFromPrLineItem(prLineItemId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT pr.transaction_chain_id FROM pr_line_items pli JOIN purchase_requisitions pr ON pli.pr_id = pr.id WHERE pli.id = ?`,
    [prLineItemId]
  );
  return rows[0] ? rows[0].transaction_chain_id : null;
}

module.exports = {
  findDocumentById,
  getChainPurchaseRequisitions,
  getChainRfqs,
  getChainPurchaseOrders,
  getChainAsns,
  getPrLineItems,
  getRfqLineItems,
  getPoLineItems,
  getAsnLineItems,
  getGrnForAsn,
  getGrnLineItems,
  getInvoiceForAsn,
  getInvoiceLineItems,
  getFlowMappingsForLineIds,
  getChainIdForTable,
  getChainIdFromPrLineItem,
};
