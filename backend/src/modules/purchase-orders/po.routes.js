const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { NotFoundError, ValidationError, AuthorizationError } = require('../../common/errors');
const { recordMapping, refreshPrLineRemaining, refreshPrStatusAfterConsumption, consumeBudget, getSetting } = require('../pr/pr.helpers');
const {
  newDocument, fmtMoney, fmtDate, drawDocumentHeader, drawTwoColumnBlock, drawFieldGrid,
  drawSectionTitle, drawTable, drawTotalsBlock, drawSignatureBlock, drawFooterNote, MARGIN, CONTENT_WIDTH,
} = require('../../common/pdf');

const router = express.Router();

// GET /api/purchase-orders (vendor sees own, admin sees all)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  let sql = `SELECT po.*, pr.pr_number, rfq.rfq_number FROM purchase_orders po
    LEFT JOIN purchase_requisitions pr ON po.pr_id = pr.id
    LEFT JOIN rfqs rfq ON po.rfq_id = rfq.id WHERE 1=1`;
  const params = [];
  if (req.user.role === 'vendor') { sql += ' AND po.vendor_id = ?'; params.push(req.user.vendorId); }
  if (req.query.vendor_id) { sql += ' AND po.vendor_id = ?'; params.push(req.query.vendor_id); }
  sql += ' ORDER BY po.created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/purchase-orders/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new NotFoundError('PO not found');
  const [lineItems] = await pool.query('SELECT * FROM po_line_items WHERE po_id = ? ORDER BY line_number', [req.params.id]);

  // Calculate actual consumed quantity from ALL ASNs (draft, submitted, validated, posted)
  // This gives the true "available" quantity for new ASN creation
  for (const line of lineItems) {
    const [asnQty] = await pool.query(
      'SELECT COALESCE(SUM(ali.quantity), 0) as total_asn_qty FROM asn_line_items ali INNER JOIN asns a ON ali.asn_id = a.id WHERE ali.po_line_id = ? AND a.status != ?',
      [line.id, 'rejected']
    );
    line.consumed_quantity = Number(asnQty[0].total_asn_qty);
    line.available_quantity = Number(line.quantity) - line.consumed_quantity;
  }

  res.json({ success: true, data: { ...rows[0], line_items: lineItems } });
}));

// GET /api/purchase-orders/:id/pdf — formatted PO document, styled as a
// standard commercial purchase order (vendor/buyer blocks, line items,
// totals, terms, signature blocks).
router.get('/:id/pdf', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT po.*, v.vendor_name, v.company_name as vendor_company, v.gst_number as vendor_gst,
       v.supplier_location as vendor_location, v.phone as vendor_phone, v.email as vendor_email
     FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) throw new NotFoundError('PO not found');
  const po = rows[0];

  // VAPT: a vendor may only download their own PO (same isolation as the list/detail endpoints).
  if (req.user.role === 'vendor' && req.user.vendorId !== po.vendor_id) throw new AuthorizationError();

  const [lineItems] = await pool.query('SELECT * FROM po_line_items WHERE po_id = ? ORDER BY line_number', [req.params.id]);

  const doc = newDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${po.po_number}.pdf"`);
  doc.pipe(res);

  let y = drawDocumentHeader(doc, {
    companyName: po.buyer_name || 'ProcureTrack',
    companyLine: po.buyer_address || undefined,
    title: 'PURCHASE ORDER',
    fields: [
      ['PO Number', po.po_number],
      ['PO Date', fmtDate(po.po_date)],
      ['Validity', fmtDate(po.validity_date)],
      ['Status', (po.status || '').replace('_', ' ').toUpperCase()],
    ],
  });

  y = drawTwoColumnBlock(doc, y,
    { title: 'Vendor / Supplier', rows: [
      ['Name', po.vendor_name], ['Company', po.vendor_company], ['GSTIN', po.vendor_gst],
      ['Location', po.vendor_location], ['Phone', po.vendor_phone],
    ] },
    { title: 'Buyer', rows: [
      ['GSTIN', po.gstin], ['State', po.state_name ? `${po.state_name} (${po.state_code || ''})` : null],
      ['Department', po.department], ['Company Code', po.company_code], ['Plant', po.plant],
    ] }
  );

  y = drawSectionTitle(doc, y, 'Commercial Terms');
  y = drawFieldGrid(doc, y, [
    ['Terms of Payment', po.terms_of_payment], ['Incoterms', po.incoterms], ['Cost Center', po.cost_center],
    ['Project Code', po.project_code], ['Contract Ref', po.contract_id], ['Retention %', po.retention_percentage != null ? `${po.retention_percentage}%` : null],
  ]) + 8;

  y = drawSectionTitle(doc, y, 'Line Items');
  y = drawTable(doc, y, {
    columns: [
      { title: '#', width: 24, align: 'center' },
      { title: 'Description', width: 159 },
      { title: 'HSN/SAC', width: 55 },
      { title: 'Qty', width: 45, align: 'right' },
      { title: 'UOM', width: 40 },
      { title: 'Unit Price', width: 65, align: 'right' },
      { title: 'Tax %', width: 35, align: 'right' },
      { title: 'Amount', width: 72, align: 'right' },
    ],
    rows: lineItems.map((li, i) => [
      i + 1, li.description, li.hsn_sac || '—', Number(li.quantity).toLocaleString(), li.uom || '—',
      fmtMoney(li.unit_price), li.tax_percent != null ? `${li.tax_percent}%` : '—',
      fmtMoney(li.total_line_amount ?? li.amount),
    ]),
  });

  const subtotal = lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
  const taxTotal = lineItems.reduce((s, li) => s + Number(li.tax_amount || 0), 0);
  y = drawTotalsBlock(doc, y, [
    ['Subtotal', fmtMoney(subtotal)],
    ['Tax', fmtMoney(taxTotal)],
    ['Grand Total', fmtMoney(po.total_amount), true],
  ]);

  let schedule = po.delivery_schedule_json;
  if (typeof schedule === 'string') { try { schedule = JSON.parse(schedule); } catch { schedule = null; } }
  if (Array.isArray(schedule) && schedule.length > 0) {
    y = drawSectionTitle(doc, y, 'Delivery Schedule');
    y = drawTable(doc, y, {
      columns: [
        { title: 'Milestone', width: 220 },
        { title: 'Date', width: 120 },
        { title: 'Qty %', width: 100, align: 'right' },
      ],
      rows: schedule.map(s => [s.milestone || '—', fmtDate(s.date), s.quantity_percent != null ? `${s.quantity_percent}%` : '—']),
    });
  }

  y = drawSectionTitle(doc, y, 'Terms & Conditions');
  doc.fontSize(8).font('Helvetica').fillColor('#444444').text(
    '1. Goods/services must conform strictly to the specifications, quantities, and delivery schedule stated above.\n' +
    '2. This Purchase Order is subject to the standard terms and conditions agreed between the parties.\n' +
    '3. Invoices must reference the PO Number above and be submitted along with valid tax documentation.\n' +
    `4. Partial deliveries are ${po.partial_delivery_allowed_flag ? 'permitted' : 'not permitted'} unless otherwise agreed in writing.`,
    MARGIN, y, { width: CONTENT_WIDTH }
  );
  y = doc.y + 10;

  y = drawSignatureBlock(doc, y, `For ${po.buyer_name || 'Buyer'}\nAuthorized Signatory`, `For ${po.vendor_name || 'Vendor'}\nAuthorized Signatory`);
  drawFooterNote(doc, `Generated electronically by ProcureTrack on ${fmtDate(new Date())} — ${po.po_number}`);

  doc.end();
}));

// POST /api/purchase-orders — direct/manual PO creation, no PR or RFQ required.
// Can be locked down via the 'po_require_pr_reference' system setting, in which
// case a PO can only be created through "Create PO from PR/RFQ" (i.e. at least
// one line item here must still carry a pr_line_item_id).
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const {
    po_number, vendor_id, total_amount, line_items, buyer_name, buyer_address, gstin, state_name, state_code, po_date, terms_of_payment, validity_date,
    contract_id, incoterms, cost_center, project_code, budget_code, delivery_schedule_json, partial_delivery_allowed_flag, retention_percentage,
    department, account_assignment_category, account_assignment_details, company_code, plant, requester_id,
  } = req.body;

  const requirePrReference = (await getSetting('po_require_pr_reference', 'false')) === 'true';
  if (requirePrReference && !(line_items || []).some(i => i.pr_line_item_id)) {
    throw new ValidationError('Direct PO creation is disabled — purchase orders must reference a Purchase Requisition or RFQ. Use "Create PO from PR/RFQ" instead.');
  }

  const poId = uuidv4();
  await pool.query(
    `INSERT INTO purchase_orders (
      id, po_number, po_date, vendor_id, buyer_name, buyer_address, gstin, state_name, state_code, total_amount, terms_of_payment, validity_date,
      contract_id, incoterms, cost_center, project_code, budget_code, delivery_schedule_json, partial_delivery_allowed_flag, retention_percentage,
      department, account_assignment_category, account_assignment_details, company_code, plant, requester_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poId, po_number, po_date || null, vendor_id, buyer_name || null, buyer_address || null, gstin || null, state_name || null, state_code || null, total_amount, terms_of_payment || null, validity_date || null,
      contract_id || null, incoterms || null, cost_center || null, project_code || null, budget_code || null,
      delivery_schedule_json ? JSON.stringify(delivery_schedule_json) : null,
      partial_delivery_allowed_flag === undefined ? true : !!partial_delivery_allowed_flag,
      retention_percentage ?? null,
      department || null, account_assignment_category || null,
      account_assignment_details ? JSON.stringify(account_assignment_details) : null,
      company_code || null, plant || null, requester_id || null,
    ]
  );

  if (line_items && Array.isArray(line_items)) {
    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      const lineAmount = (item.quantity || 0) * (item.unit_price || 0);
      const taxAmount = lineAmount * ((item.tax_percent || 0) / 100);
      const totalLineAmount = lineAmount + taxAmount;
      const poLineId = uuidv4();
      await pool.query(
        'INSERT INTO po_line_items (id, po_id, line_number, description, hsn_sac, quantity, uom, unit_price, amount, tax_percent, tax_amount, total_line_amount, pr_line_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [poLineId, poId, i + 1, item.description, item.hsn_sac || null, item.quantity, item.uom || 'Nos', item.unit_price, lineAmount, item.tax_percent || 0, taxAmount, totalLineAmount, item.pr_line_item_id || null]
      );
      // Manually-created POs can still be linked back to a PR line item (e.g. a
      // procurement user fills in the generic PO form instead of using the PR's
      // own Create PO action) — keep the document_flow_mapping ledger in sync either way.
      if (item.pr_line_item_id) {
        await recordMapping('PR', item.pr_line_item_id, 'PO', poLineId, item.quantity, req.user.id);
        await refreshPrLineRemaining(item.pr_line_item_id);
      }
    }
    const linkedLineItem = line_items.find(i => i.pr_line_item_id);
    if (linkedLineItem) {
      const [[link]] = await pool.query(
        `SELECT pr.id, pr.cost_center FROM pr_line_items pli JOIN purchase_requisitions pr ON pli.pr_id = pr.id WHERE pli.id = ?`,
        [linkedLineItem.pr_line_item_id]
      );
      if (link) {
        await refreshPrStatusAfterConsumption(link.id);
        await consumeBudget(link.cost_center, total_amount);
      }
    }
  }

  res.status(201).json({ success: true, data: { id: poId, po_number } });
}));

module.exports = router;
