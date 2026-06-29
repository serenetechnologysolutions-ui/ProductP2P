const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { getSetting } = require('../pr/pr.helpers');
const { raiseException, autoResolve } = require('../exceptions/exceptions.service');
const { emitEvent } = require('../../common/eventBus');

// Goods Receipt Note — formalizes "what was physically received & inspected"
// as its own record, distinct from the ASN (the vendor's shipment notice) and
// the Invoice (what's being billed). Tolerance rules + auto-block: a line
// whose received quantity deviates from what the ASN said was shipped by
// more than grn_quantity_tolerance_pct, or that has any rejected quantity, is
// flagged exceeds_tolerance and puts the whole GRN into 'exception' status —
// which blocks the ASN from being posted to ERP (see asn.routes.js POST /:id/post).

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

async function autoGrnNumber(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
    "SELECT MAX(CAST(SUBSTRING(grn_number, 5) AS UNSIGNED)) as maxNum FROM goods_receipt_notes WHERE grn_number LIKE 'GRN-%'"
  );
  const next = (maxNum || 0) + 1;
  return `GRN-${String(next).padStart(6, '0')}`;
}

async function createGrn(asnId, input, actorId, conn) {
  const c = conn || pool;
  const [[asn]] = await c.query('SELECT * FROM asns WHERE id = ?', [asnId]);
  if (!asn) throw new NotFoundError('ASN not found');
  if (asn.status !== 'validated') throw new ValidationError(`GRN can only be created for a validated ASN (status: ${asn.status})`);

  const [[existing]] = await c.query('SELECT id FROM goods_receipt_notes WHERE asn_id = ?', [asnId]);
  if (existing) throw new ValidationError('A GRN already exists for this ASN');

  const { received_date, line_items, remarks } = input;
  if (!received_date) throw new ValidationError('Missing required field', ['received_date']);
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) throw new ValidationError('line_items are required');

  const [asnLines] = await c.query(
    `SELECT ali.*, pli.quantity as po_ordered_quantity FROM asn_line_items ali
     LEFT JOIN po_line_items pli ON ali.po_line_id = pli.id WHERE ali.asn_id = ?`,
    [asnId]
  );
  const asnLineById = {};
  asnLines.forEach(l => { asnLineById[l.id] = l; });

  const tolerancePct = Number(await getSetting('grn_quantity_tolerance_pct', '5', c));

  const grnId = uuidv4();
  const grnNumber = await autoGrnNumber(c);
  let anyException = false;
  const computedLines = [];

  for (const item of line_items) {
    const asnLine = asnLineById[item.asn_line_item_id];
    if (!asnLine) throw new ValidationError(`ASN line item ${item.asn_line_item_id} does not belong to this ASN`);
    if (item.received_quantity == null) throw new ValidationError(`received_quantity is required for "${asnLine.description}"`);

    const rejectedQty = Number(item.rejected_quantity || 0);
    if (rejectedQty > 0 && !item.rejection_reason) {
      throw new ValidationError(`rejection_reason is required when rejecting quantity on "${asnLine.description}"`);
    }
    const receivedQty = Number(item.received_quantity);
    const acceptedQty = item.accepted_quantity != null ? Number(item.accepted_quantity) : receivedQty - rejectedQty;
    const shippedQty = Number(asnLine.quantity);

    const deviationPct = shippedQty > 0 ? round2(((receivedQty - shippedQty) / shippedQty) * 100) : 0;
    const exceedsTolerance = Math.abs(deviationPct) > tolerancePct || rejectedQty > 0;
    if (exceedsTolerance) anyException = true;

    computedLines.push({
      id: uuidv4(),
      asn_line_item_id: asnLine.id,
      po_line_id: asnLine.po_line_id,
      ordered_quantity: asnLine.po_ordered_quantity ?? shippedQty,
      shipped_quantity: shippedQty,
      received_quantity: receivedQty,
      accepted_quantity: acceptedQty,
      rejected_quantity: rejectedQty,
      rejection_reason: item.rejection_reason || null,
      tolerance_status: exceedsTolerance ? 'exceeds_tolerance' : 'within_tolerance',
      description: asnLine.description,
      deviation_pct: deviationPct,
    });
  }

  const grnStatus = anyException ? 'exception' : 'completed';

  await c.query(
    `INSERT INTO goods_receipt_notes (id, grn_number, asn_id, po_id, vendor_id, received_date, received_by, status, remarks, transaction_chain_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [grnId, grnNumber, asnId, asn.po_id, asn.vendor_id, received_date, actorId, grnStatus, remarks || null, asn.transaction_chain_id || null]
  );

  for (const line of computedLines) {
    await c.query(
      `INSERT INTO grn_line_items (id, grn_id, asn_line_item_id, po_line_id, ordered_quantity, shipped_quantity, received_quantity, accepted_quantity, rejected_quantity, rejection_reason, tolerance_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [line.id, grnId, line.asn_line_item_id, line.po_line_id, line.ordered_quantity, line.shipped_quantity, line.received_quantity, line.accepted_quantity, line.rejected_quantity, line.rejection_reason, line.tolerance_status]
    );
  }

  // Exception logging — one exception per breaching line, auto-resolved if a
  // later GRN line for the same ASN line item comes back within tolerance.
  for (const line of computedLines) {
    const dedupKey = `grn_tolerance_breach:asn_line:${line.asn_line_item_id}`;
    if (line.tolerance_status === 'exceeds_tolerance') {
      await raiseException({
        exception_type: 'grn_tolerance_breach',
        severity: Math.abs(line.deviation_pct) > 25 || line.rejected_quantity > 0 ? 'high' : 'medium',
        module_name: 'asn',
        record_id: grnId,
        vendor_id: asn.vendor_id,
        transaction_chain_id: asn.transaction_chain_id,
        title: `GRN tolerance breach on ${grnNumber}`,
        message: `"${line.description}": received ${line.received_quantity} vs shipped ${line.shipped_quantity} (${line.deviation_pct}% deviation)${line.rejected_quantity > 0 ? `, rejected ${line.rejected_quantity} (${line.rejection_reason})` : ''}.`,
        metadata: { grn_line_id: line.id, ordered_quantity: line.ordered_quantity, shipped_quantity: line.shipped_quantity, received_quantity: line.received_quantity, accepted_quantity: line.accepted_quantity, rejected_quantity: line.rejected_quantity, deviation_pct: line.deviation_pct },
        dedup_key: dedupKey,
      }, c);
    } else {
      await autoResolve(dedupKey, 'GRN line is now within quantity tolerance', c);
    }
  }

  if (grnStatus === 'completed') {
    await emitEvent('GRN_COMPLETED', { module_name: 'asn', record_id: grnId, grn_number: grnNumber, asn_id: asnId, po_id: asn.po_id }, c);
  }

  return { id: grnId, grn_number: grnNumber, status: grnStatus, line_items: computedLines };
}

async function getGrnByAsnId(asnId, conn) {
  const c = conn || pool;
  const [[grn]] = await c.query('SELECT * FROM goods_receipt_notes WHERE asn_id = ?', [asnId]);
  if (!grn) return null;
  const [lineItems] = await c.query('SELECT * FROM grn_line_items WHERE grn_id = ?', [grn.id]);
  return { ...grn, line_items: lineItems };
}

module.exports = {
  createGrn,
  getGrnByAsnId,
};
