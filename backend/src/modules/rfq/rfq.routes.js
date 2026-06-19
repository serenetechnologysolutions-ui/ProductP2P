const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRfqOrThrow(id, conn) {
  const [rows] = await (conn || pool).query('SELECT * FROM rfqs WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('RFQ not found');
  return rows[0];
}

async function autoRfqNumber(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
    "SELECT MAX(CAST(SUBSTRING(rfq_number, 5) AS UNSIGNED)) as maxNum FROM rfqs WHERE rfq_number LIKE 'RFQ-%'"
  );
  const next = (maxNum || 0) + 1;
  return `RFQ-${String(next).padStart(6, '0')}`;
}

async function autoPONumber(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
    "SELECT MAX(CAST(SUBSTRING(po_number, 4) AS UNSIGNED)) as maxNum FROM purchase_orders WHERE po_number LIKE 'PO-%' AND po_number REGEXP '^PO-[0-9]+$'"
  );
  const next = (maxNum || 0) + 1;
  return `PO-${String(next).padStart(6, '0')}`;
}

// ─── List RFQs ──────────────────────────────────────────────────────────────

router.get('/', authenticate, asyncHandler(async (req, res) => {
  let sql, params = [];

  if (req.user.role === 'vendor') {
    // Deliberately excludes vendor_count / bid_count — a vendor must not learn how many
    // other suppliers were invited to or bid on the same RFQ.
    sql = `
      SELECT r.*, rv.participation_status,
        (SELECT COUNT(*) FROM rfq_line_items WHERE rfq_id = r.id) as item_count
      FROM rfqs r
      INNER JOIN rfq_vendors rv ON r.id = rv.rfq_id AND rv.vendor_id = ?
      ORDER BY r.created_at DESC`;
    params.push(req.user.vendorId);
  } else {
    sql = `
      SELECT r.*,
        (SELECT COUNT(*) FROM rfq_vendors WHERE rfq_id = r.id) as vendor_count,
        (SELECT COUNT(*) FROM rfq_line_items WHERE rfq_id = r.id) as item_count,
        (SELECT COUNT(*) FROM vendor_bids WHERE rfq_id = r.id) as bid_count
      FROM rfqs r
      ORDER BY r.created_at DESC`;
  }

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// ─── Create RFQ ─────────────────────────────────────────────────────────────

router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { title, description, submission_deadline, vendor_ids, line_items, rfq_type, procurement_category_id, budget_value, scoring_weight_config } = req.body;

  const missing = [];
  if (!title) missing.push('title');
  if (!submission_deadline) missing.push('submission_deadline');
  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) missing.push('vendor_ids');
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) missing.push('line_items');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const rfqId = uuidv4();
  const rfqNumber = await autoRfqNumber();

  await pool.query(
    `INSERT INTO rfqs (id, rfq_number, title, description, created_by, submission_deadline, rfq_type, procurement_category_id, budget_value, scoring_weight_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rfqId, rfqNumber, title, description || null, req.user.id, new Date(submission_deadline), rfq_type || 'limited', procurement_category_id || null, budget_value || null, scoring_weight_config ? JSON.stringify(scoring_weight_config) : null]
  );

  for (const vendorId of vendor_ids) {
    await pool.query(
      'INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)',
      [uuidv4(), rfqId, vendorId]
    );
  }

  for (let i = 0; i < line_items.length; i++) {
    const item = line_items[i];
    if (!item.item_description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
    await pool.query(
      `INSERT INTO rfq_line_items (id, rfq_id, item_master_id, item_description, quantity, uom, target_price, sequence, remarks, attachment_path, attachment_name, technical_specifications, delivery_location_id, required_delivery_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), rfqId, item.item_master_id || null, item.item_description, item.quantity, item.uom || 'Nos', item.target_price || null, i + 1, item.remarks || null, item.attachment_path || null, item.attachment_name || null, item.technical_specifications ? JSON.stringify(item.technical_specifications) : null, item.delivery_location_id || null, item.required_delivery_date || null]
    );
  }

  res.status(201).json({ success: true, data: { id: rfqId, rfq_number: rfqNumber } });
}));

// ─── Get RFQ Detail ─────────────────────────────────────────────────────────

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rfq = await getRfqOrThrow(id);

  if (req.user.role === 'vendor') {
    const [assigned] = await pool.query('SELECT id FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [id, req.user.vendorId]);
    if (assigned.length === 0) throw new NotFoundError('RFQ not found');
  }

  // Other invited vendors' identities/participation are competitive information —
  // never exposed to a vendor, only to internal procurement/MDM roles.
  let vendors = [];
  if (req.user.role !== 'vendor') {
    [vendors] = await pool.query(
      `SELECT rv.*, v.vendor_name, v.company_name FROM rfq_vendors rv
       LEFT JOIN vendors v ON rv.vendor_id = v.id WHERE rv.rfq_id = ?`,
      [id]
    );
  }
  const [lineItems] = await pool.query('SELECT * FROM rfq_line_items WHERE rfq_id = ? ORDER BY sequence', [id]);

  let myBid = null;
  let allBids = [];

  if (req.user.role === 'vendor') {
    const [bids] = await pool.query(
      'SELECT * FROM vendor_bids WHERE rfq_id = ? AND vendor_id = ?',
      [id, req.user.vendorId]
    );
    if (bids.length > 0) {
      const [bidItems] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bids[0].id]);
      myBid = { ...bids[0], bid_items: bidItems };
    }
  } else {
    const [bids] = await pool.query(
      `SELECT vb.*, v.vendor_name FROM vendor_bids vb
       LEFT JOIN vendors v ON vb.vendor_id = v.id WHERE vb.rfq_id = ?`,
      [id]
    );
    for (const bid of bids) {
      const [bidItems] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bid.id]);
      allBids.push({ ...bid, bid_items: bidItems });
    }
  }

  res.json({
    success: true,
    data: {
      ...rfq,
      line_items: lineItems,
      ...(req.user.role === 'vendor' ? { my_bid: myBid } : { vendors, bids: allBids }),
    },
  });
}));

// ─── Publish RFQ ────────────────────────────────────────────────────────────

router.put('/:id/publish', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  if (rfq.status !== 'draft') throw new ValidationError('Only draft RFQs can be published');

  await pool.query("UPDATE rfqs SET status = 'published' WHERE id = ?", [rfq.id]);
  res.json({ success: true, message: 'RFQ published' });
}));

// ─── Close RFQ ──────────────────────────────────────────────────────────────

router.put('/:id/close', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  if (rfq.status !== 'published') throw new ValidationError('Only published RFQs can be closed');

  await pool.query("UPDATE rfqs SET status = 'closed' WHERE id = ?", [rfq.id]);

  // Mark vendors who never responded as not_responded
  await pool.query(
    `UPDATE rfq_vendors rv
     SET rv.participation_status = 'not_responded'
     WHERE rv.rfq_id = ? AND rv.participation_status = 'invited'
       AND NOT EXISTS (SELECT 1 FROM vendor_bids vb WHERE vb.rfq_id = rv.rfq_id AND vb.vendor_id = rv.vendor_id)`,
    [rfq.id]
  );

  res.json({ success: true, message: 'RFQ closed' });
}));

// ─── Comparison Data ─────────────────────────────────────────────────────────

router.get('/:id/comparison', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);

  const [lineItems] = await pool.query('SELECT * FROM rfq_line_items WHERE rfq_id = ? ORDER BY sequence', [rfq.id]);

  const [bids] = await pool.query(
    `SELECT vb.*, v.vendor_name, v.company_name FROM vendor_bids vb
     LEFT JOIN vendors v ON vb.vendor_id = v.id WHERE vb.rfq_id = ?`,
    [rfq.id]
  );

  const bidsWithItems = [];
  for (const bid of bids) {
    const [bidItems] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bid.id]);
    bidsWithItems.push({ ...bid, bid_items: bidItems });
  }

  // Price benchmarks from historical data per item
  const benchmarks = {};
  for (const item of lineItems) {
    const [hist] = await pool.query(
      `SELECT
         AVG(unit_price) as avg_price,
         MIN(unit_price) as min_price,
         MAX(unit_price) as max_price,
         (SELECT unit_price FROM price_history
          WHERE item_description LIKE ? ORDER BY recorded_at DESC LIMIT 1) as last_price
       FROM price_history WHERE item_description LIKE ?`,
      [`%${item.item_description}%`, `%${item.item_description}%`]
    );
    benchmarks[item.id] = {
      avg_price: hist[0].avg_price ? Number(hist[0].avg_price).toFixed(2) : null,
      min_price: hist[0].min_price ? Number(hist[0].min_price).toFixed(2) : null,
      max_price: hist[0].max_price ? Number(hist[0].max_price).toFixed(2) : null,
      last_price: hist[0].last_price ? Number(hist[0].last_price).toFixed(2) : null,
    };
  }

  // Vendor scorecards from risk scores
  const vendorIds = bids.map(b => b.vendor_id);
  let riskScores = {};
  if (vendorIds.length > 0) {
    const placeholders = vendorIds.map(() => '?').join(',');
    const [scores] = await pool.query(
      `SELECT vendor_id, risk_score, risk_level, delay_score, rejection_score, audit_score
       FROM vendor_risk_scores WHERE vendor_id IN (${placeholders})`,
      vendorIds
    );
    scores.forEach(s => { riskScores[s.vendor_id] = s; });
  }

  // TCO ranking — cheapest total cost of ownership first, only bids with a tco_value
  const tcoRanking = bidsWithItems
    .filter(b => b.tco_value != null)
    .map(b => ({ vendor_id: b.vendor_id, vendor_name: b.vendor_name, tco_value: b.tco_value }))
    .sort((a, b) => Number(a.tco_value) - Number(b.tco_value));

  res.json({
    success: true,
    data: {
      rfq,
      line_items: lineItems,
      bids: bidsWithItems,
      benchmarks,
      risk_scores: riskScores,
      tco_ranking: tcoRanking,
    },
  });
}));

// ─── Update Scoring Weight Config ───────────────────────────────────────────

router.put('/:id/scoring-config', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  const { scoring_weight_config } = req.body;
  if (!scoring_weight_config || typeof scoring_weight_config !== 'object') {
    throw new ValidationError('scoring_weight_config is required', ['scoring_weight_config']);
  }

  await pool.query('UPDATE rfqs SET scoring_weight_config = ? WHERE id = ?', [JSON.stringify(scoring_weight_config), rfq.id]);
  res.json({ success: true, message: 'Scoring weight configuration updated' });
}));

// ─── Submit / Revise Bid (Vendor) ────────────────────────────────────────────

router.post('/:id/bids', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'vendor') throw new ValidationError('Only vendors can submit bids');

  const rfq = await getRfqOrThrow(req.params.id);
  if (rfq.status !== 'published') throw new ValidationError('Bids can only be submitted on published RFQs');
  if (new Date(rfq.submission_deadline) < new Date()) throw new ValidationError('Submission deadline has passed');

  const [assigned] = await pool.query('SELECT id FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [rfq.id, req.user.vendorId]);
  if (assigned.length === 0) throw new ValidationError('You are not invited to this RFQ');

  const { bid_items, remarks, taxes_included_flag, offered_payment_terms, warranty_period, deviation_flag, tco_value } = req.body;
  if (!bid_items || !Array.isArray(bid_items) || bid_items.length === 0) throw new ValidationError('bid_items are required');

  // Check for existing bid
  const [existing] = await pool.query('SELECT id FROM vendor_bids WHERE rfq_id = ? AND vendor_id = ?', [rfq.id, req.user.vendorId]);

  // Quantities come from the RFQ line items, not client input, since bid_items only carries price/lead time.
  const [rfqLineItems] = await pool.query('SELECT id, quantity FROM rfq_line_items WHERE rfq_id = ?', [rfq.id]);
  const quantityByLineItem = {};
  rfqLineItems.forEach(li => { quantityByLineItem[li.id] = Number(li.quantity); });

  let bidId;
  const totalValue = bid_items.reduce((sum, bi) => {
    const lineQty = quantityByLineItem[bi.rfq_line_item_id] || 0;
    return sum + ((bi.unit_price || 0) * lineQty);
  }, 0);

  // TCO (total cost of ownership) — use vendor-supplied value if given, otherwise
  // default to the computed totalValue so the comparison engine always has a usable number.
  const tcoValue = tco_value != null ? tco_value : totalValue;

  if (existing.length > 0) {
    bidId = existing[0].id;
    await pool.query(
      `UPDATE vendor_bids
       SET total_value = ?, remarks = ?, status = 'revised', updated_at = NOW(),
           taxes_included_flag = ?, offered_payment_terms = ?, warranty_period = ?, deviation_flag = ?, tco_value = ?
       WHERE id = ?`,
      [totalValue, remarks || null, taxes_included_flag ?? false, offered_payment_terms || null, warranty_period || null, deviation_flag ?? false, tcoValue, bidId]
    );
    await pool.query('DELETE FROM vendor_bid_items WHERE bid_id = ?', [bidId]);
  } else {
    bidId = uuidv4();
    await pool.query(
      `INSERT INTO vendor_bids (id, rfq_id, vendor_id, total_value, remarks, taxes_included_flag, offered_payment_terms, warranty_period, deviation_flag, tco_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bidId, rfq.id, req.user.vendorId, totalValue, remarks || null, taxes_included_flag ?? false, offered_payment_terms || null, warranty_period || null, deviation_flag ?? false, tcoValue]
    );
    await pool.query(
      "UPDATE rfq_vendors SET participation_status = 'submitted' WHERE rfq_id = ? AND vendor_id = ?",
      [rfq.id, req.user.vendorId]
    );
  }

  for (const bi of bid_items) {
    if (!bi.rfq_line_item_id || bi.unit_price == null) throw new ValidationError('Each bid item needs rfq_line_item_id and unit_price');
    await pool.query(
      `INSERT INTO vendor_bid_items (id, bid_id, rfq_line_item_id, unit_price, lead_time_days, remarks, attachment_path, attachment_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), bidId, bi.rfq_line_item_id, bi.unit_price, bi.lead_time_days || null, bi.remarks || null, bi.attachment_path || null, bi.attachment_name || null]
    );
  }

  res.status(201).json({ success: true, data: { bid_id: bidId } });
}));

// ─── Award RFQ → Auto-generate POs ──────────────────────────────────────────

router.post('/:id/award', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  if (rfq.status !== 'closed') throw new ValidationError('RFQ must be closed before awarding');

  const { award_items } = req.body;
  // award_items: [{ rfq_line_item_id, vendor_id, unit_price, quantity }]
  if (!award_items || !Array.isArray(award_items) || award_items.length === 0) {
    throw new ValidationError('award_items are required');
  }

  // Validate all line items belong to this RFQ
  const [rfqLineItems] = await pool.query('SELECT * FROM rfq_line_items WHERE rfq_id = ?', [rfq.id]);
  const rfqItemMap = {};
  rfqLineItems.forEach(li => { rfqItemMap[li.id] = li; });

  for (const ai of award_items) {
    if (!rfqItemMap[ai.rfq_line_item_id]) throw new ValidationError(`Line item ${ai.rfq_line_item_id} does not belong to this RFQ`);
    if (!ai.vendor_id || ai.unit_price == null || !ai.quantity) throw new ValidationError('Each award item needs vendor_id, unit_price, and quantity');
  }

  // Group award items by vendor
  const byVendor = {};
  for (const ai of award_items) {
    if (!byVendor[ai.vendor_id]) byVendor[ai.vendor_id] = [];
    byVendor[ai.vendor_id].push(ai);
  }

  const generatedPOs = [];

  for (const [vendorId, items] of Object.entries(byVendor)) {
    const totalAmount = items.reduce((sum, ai) => sum + (Number(ai.unit_price) * Number(ai.quantity)), 0);
    const poId = uuidv4();
    const poNumber = await autoPONumber();

    await pool.query(
      'INSERT INTO purchase_orders (id, po_number, vendor_id, total_amount) VALUES (?, ?, ?, ?)',
      [poId, poNumber, vendorId, totalAmount]
    );

    for (let i = 0; i < items.length; i++) {
      const ai = items[i];
      const rfqItem = rfqItemMap[ai.rfq_line_item_id];
      const lineAmount = Number(ai.unit_price) * Number(ai.quantity);
      await pool.query(
        'INSERT INTO po_line_items (id, po_id, line_number, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), poId, i + 1, rfqItem.item_description, ai.quantity, ai.unit_price, lineAmount]
      );

      // Record price history for benchmarking
      await pool.query(
        'INSERT INTO price_history (id, item_description, vendor_id, po_id, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rfqItem.item_description, vendorId, poId, ai.unit_price, ai.quantity]
      );
    }

    generatedPOs.push({ po_id: poId, po_number: poNumber, vendor_id: vendorId });
  }

  await pool.query("UPDATE rfqs SET status = 'awarded' WHERE id = ?", [rfq.id]);

  res.json({ success: true, data: { rfq_id: rfq.id, purchase_orders: generatedPOs } });
}));

module.exports = router;
