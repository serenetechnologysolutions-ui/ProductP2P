const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { getSetting } = require('../pr/pr.helpers');
const { raiseException, autoResolve } = require('../exceptions/exceptions.service');
const { getGrnByAsnId } = require('./grn.service');
const { emitEvent } = require('../../common/eventBus');

// Invoice — formalizes the ASN's own invoice_number/amount fields (kept
// as-is on asns for backward compatibility) into its own record, and runs
// the real 3-way match: PO (ordered unit_price) vs GRN (accepted_quantity,
// when one exists) vs Invoice (billed price/quantity). Auto-block: a price or
// quantity deviation beyond the configured tolerance sets match_status =
// 'blocked', which prevents the ASN from posting to ERP.

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

async function createInvoiceFromAsn(asnId, actorId, conn) {
  const c = conn || pool;
  const [[asn]] = await c.query('SELECT * FROM asns WHERE id = ?', [asnId]);
  if (!asn) throw new NotFoundError('ASN not found');

  const [[existing]] = await c.query('SELECT id FROM invoices WHERE asn_id = ?', [asnId]);
  if (existing) throw new ValidationError('An invoice already exists for this ASN');

  const [asnLines] = await c.query(
    `SELECT ali.*, pli.unit_price as po_unit_price FROM asn_line_items ali
     LEFT JOIN po_line_items pli ON ali.po_line_id = pli.id WHERE ali.asn_id = ?`,
    [asnId]
  );
  if (asnLines.length === 0) throw new ValidationError('ASN has no line items to invoice');

  const grn = await getGrnByAsnId(asnId, c);
  const grnLineByAsnLine = {};
  (grn?.line_items || []).forEach(l => { grnLineByAsnLine[l.asn_line_item_id] = l; });

  const priceTolerancePct = Number(await getSetting('invoice_price_tolerance_pct', '2', c));

  const invoiceId = uuidv4();
  let blocked = false;
  const blockedReasons = [];
  const computedLines = [];

  for (const asnLine of asnLines) {
    const unitPrice = Number(asnLine.quantity) > 0 ? Number(asnLine.amount) / Number(asnLine.quantity) : 0;
    let deviationPct = null;
    if (asnLine.po_unit_price != null && Number(asnLine.po_unit_price) > 0) {
      deviationPct = round2(((unitPrice - Number(asnLine.po_unit_price)) / Number(asnLine.po_unit_price)) * 100);
      if (Math.abs(deviationPct) > priceTolerancePct) {
        blocked = true;
        blockedReasons.push(`"${asnLine.description}": invoiced price ${round2(unitPrice)} deviates ${deviationPct}% from PO price ${asnLine.po_unit_price}`);
      }
    }

    const grnLine = grnLineByAsnLine[asnLine.id];
    if (grnLine && Number(asnLine.quantity) > Number(grnLine.accepted_quantity)) {
      blocked = true;
      blockedReasons.push(`"${asnLine.description}": invoiced quantity ${asnLine.quantity} exceeds the GRN's accepted quantity ${grnLine.accepted_quantity}`);
    }

    computedLines.push({
      id: uuidv4(), asn_line_item_id: asnLine.id, po_line_id: asnLine.po_line_id,
      quantity: asnLine.quantity, unit_price: round2(unitPrice), amount: asnLine.amount, price_deviation_pct: deviationPct,
    });
  }

  const matchStatus = blocked ? 'blocked' : 'matched';

  await c.query(
    `INSERT INTO invoices (id, invoice_number, asn_id, grn_id, po_id, vendor_id, invoice_date, currency, exchange_rate,
       subtotal_amount, cgst_amount, sgst_amount, igst_amount, freight_charges, total_amount, match_status, blocked_reason, transaction_chain_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId, asn.invoice_number, asnId, grn?.id || null, asn.po_id, asn.vendor_id, asn.dispatch_date || null,
      asn.invoice_currency || 'INR', asn.exchange_rate ?? 1,
      computedLines.reduce((s, l) => s + Number(l.amount), 0),
      asn.cgst_amount ?? 0, asn.sgst_amount ?? 0, asn.igst_amount ?? 0, asn.freight_charges ?? 0,
      asn.total_amount, matchStatus, blocked ? blockedReasons.join('; ') : null, asn.transaction_chain_id || null,
    ]
  );

  for (const line of computedLines) {
    await c.query(
      'INSERT INTO invoice_line_items (id, invoice_id, asn_line_item_id, po_line_id, quantity, unit_price, amount, price_deviation_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [line.id, invoiceId, line.asn_line_item_id, line.po_line_id, line.quantity, line.unit_price, line.amount, line.price_deviation_pct]
    );
  }

  const dedupKey = `invoice_mismatch:asn:${asnId}`;
  if (blocked) {
    await raiseException({
      exception_type: 'invoice_mismatch',
      severity: 'high',
      module_name: 'asn',
      record_id: invoiceId,
      vendor_id: asn.vendor_id,
      transaction_chain_id: asn.transaction_chain_id,
      title: `Invoice blocked on ${asn.asn_number}`,
      message: blockedReasons.join('; '),
      metadata: { invoice_id: invoiceId, asn_id: asnId, reasons: blockedReasons },
      dedup_key: dedupKey,
    }, c);
  } else {
    await autoResolve(dedupKey, 'invoice is now within tolerance on price and quantity', c);
  }

  if (matchStatus === 'matched') {
    await emitEvent('INVOICE_APPROVED', { module_name: 'asn', record_id: invoiceId, invoice_number: asn.invoice_number, asn_id: asnId, total_amount: asn.total_amount }, c);
  }

  return { id: invoiceId, invoice_number: asn.invoice_number, match_status: matchStatus, blocked_reason: blocked ? blockedReasons.join('; ') : null, line_items: computedLines };
}

async function getInvoiceByAsnId(asnId, conn) {
  const c = conn || pool;
  const [[invoice]] = await c.query('SELECT * FROM invoices WHERE asn_id = ?', [asnId]);
  if (!invoice) return null;
  const [lineItems] = await c.query('SELECT * FROM invoice_line_items WHERE invoice_id = ?', [invoice.id]);
  return { ...invoice, line_items: lineItems };
}

module.exports = {
  createInvoiceFromAsn,
  getInvoiceByAsnId,
};
