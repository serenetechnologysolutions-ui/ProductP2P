const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');
const { recordMapping, getMappedQuantity, consumeBudget } = require('../pr/pr.helpers');
const { assertVendorUsable } = require('../vendor/vendor-compliance.service');
const { suggestVendorsForItem, getItemPriceBenchmark, getShouldCostBenchmark } = require('../insights/insights.service');
const { resolveCompanyAccess } = require('../company/company.middleware');
const { assertCompanyActive } = require('../company/company.guards');

const router = express.Router();

// ─── Ensure rfqs.company_id column exists (idempotent) ──────────────────────
(async () => {
  try {
    await pool.query('ALTER TABLE rfqs ADD COLUMN company_id VARCHAR(36) NULL');
    await pool.query('ALTER TABLE rfqs ADD INDEX idx_rfqs_company (company_id)');
  } catch (err) {
    // ER_DUP_FIELDNAME / ER_DUP_KEYNAME — column/index already exists
    if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_KEYNAME') {
      console.error('RFQ company_id column setup warning:', err.message);
    }
  }
})();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRfqOrThrow(id, conn) {
  // Pulls a small, vendor-safe subset of the source PR's header (department,
  // priority, required date, justification) so the RFQ Overview tab can show
  // "enough information captured as part of the PR" without exposing
  // internal-only fields like cost center or budget.
  const [rows] = await (conn || pool).query(
    `SELECT r.*, pr.pr_number, pr.department as pr_department, pr.priority as pr_priority,
       pr.required_date as pr_required_date, pr.justification as pr_justification
     FROM rfqs r LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id WHERE r.id = ?`,
    [id]
  );
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

router.get('/', authenticate, resolveCompanyAccess, asyncHandler(async (req, res) => {
  let sql, params = [];

  if (req.user.role === 'vendor') {
    // Deliberately excludes vendor_count / bid_count — a vendor must not learn how many
    // other suppliers were invited to or bid on the same RFQ.
    sql = `
      SELECT r.*, rv.participation_status, pr.pr_number,
        (SELECT COUNT(*) FROM rfq_line_items WHERE rfq_id = r.id) as item_count
      FROM rfqs r
      INNER JOIN rfq_vendors rv ON r.id = rv.rfq_id AND rv.vendor_id = ?
      LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id
      ORDER BY r.created_at DESC`;
    params.push(req.user.vendorId);
  } else {
    // Multi-Company Isolation: filter RFQs by user's accessible companies.
    // system_admin (companyIds === null) sees all; other roles see only their companies.
    const companyIds = req.companyIds;

    if (Array.isArray(companyIds) && companyIds.length === 0) {
      // User has no company mappings — return empty result
      return res.json({ success: true, data: [] });
    }

    let whereClause = '';
    if (Array.isArray(companyIds)) {
      const placeholders = companyIds.map(() => '?').join(',');
      whereClause = ` WHERE (r.company_id IN (${placeholders}) OR r.company_id IS NULL)`;
      params.push(...companyIds);
    }

    sql = `
      SELECT r.*, pr.pr_number,
        (SELECT COUNT(*) FROM rfq_vendors WHERE rfq_id = r.id) as vendor_count,
        (SELECT COUNT(*) FROM rfq_line_items WHERE rfq_id = r.id) as item_count,
        (SELECT COUNT(*) FROM vendor_bids WHERE rfq_id = r.id AND round_number = r.current_round) as bid_count
      FROM rfqs r
      LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id
      ${whereClause}
      ORDER BY r.created_at DESC`;
  }

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// ─── RFQ Vendor Suggestion ──────────────────────────────────────────────────
// Stateless — registered before /:id so it never collides with the RFQ-id
// route. Ranks candidate vendors for sourcing a given catalogue item using
// item history, vendor score, and risk level — reuses
// ProcurementInsightsService.suggestVendorsForItem verbatim rather than
// duplicating any of that logic here.

router.get('/vendor-suggestions/:itemMasterId', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await suggestVendorsForItem(req.params.itemMasterId);
  res.json({ success: true, data });
}));

// ─── Create RFQ ─────────────────────────────────────────────────────────────

router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { title, description, submission_deadline, vendor_ids, line_items, rfq_type, procurement_category_id, budget_value, scoring_weight_config, company_id } = req.body;

  const missing = [];
  if (!title) missing.push('title');
  if (!submission_deadline) missing.push('submission_deadline');
  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) missing.push('vendor_ids');
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) missing.push('line_items');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  // Multi-Company Isolation: validate company access
  if (company_id && req.companyIds !== null) {
    if (!req.companyIds.includes(company_id)) {
      throw new AuthorizationError('You do not have access to this company');
    }
  }

  // Assert company is active before creating RFQ
  if (company_id) {
    await assertCompanyActive(company_id);
  }

  // Vendor Compliance Engine: a vendor with an expired compliance document
  // can't be invited to source — fail fast rather than creating a partial RFQ.
  for (const vendorId of vendor_ids) { await assertVendorUsable(vendorId); }

  let rfqId, rfqNumber;
  await withTransaction(async (conn) => {
    rfqId = uuidv4();
    rfqNumber = await autoRfqNumber(conn);

    await conn.query(
      `INSERT INTO rfqs (id, rfq_number, title, description, created_by, submission_deadline, rfq_type, procurement_category_id, budget_value, scoring_weight_config, transaction_chain_id, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rfqId, rfqNumber, title, description || null, req.user.id, new Date(submission_deadline), rfq_type || 'limited', procurement_category_id || null, budget_value || null, scoring_weight_config ? JSON.stringify(scoring_weight_config) : null, rfqId, company_id || null]
    );

    for (const vendorId of vendor_ids) {
      await conn.query(
        'INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)',
        [uuidv4(), rfqId, vendorId]
      );
    }

    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      if (!item.item_description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
      await conn.query(
        `INSERT INTO rfq_line_items (id, rfq_id, item_master_id, item_description, quantity, uom, target_price, sequence, remarks, attachment_path, attachment_name, technical_specifications, delivery_location_id, required_delivery_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), rfqId, item.item_master_id || null, item.item_description, item.quantity, item.uom || 'Nos', item.target_price || null, i + 1, item.remarks || null, item.attachment_path || null, item.attachment_name || null, item.technical_specifications ? JSON.stringify(item.technical_specifications) : null, item.delivery_location_id || null, item.required_delivery_date || null]
      );
    }
  });

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

  // Multi-Round Negotiation: the Overview/comparison views only ever show the
  // RFQ's CURRENT round — prior rounds remain queryable in full via
  // GET /:id/negotiation-history rather than being mixed into the live view.
  if (req.user.role === 'vendor') {
    const [bids] = await pool.query(
      'SELECT * FROM vendor_bids WHERE rfq_id = ? AND vendor_id = ? AND round_number = ?',
      [id, req.user.vendorId, rfq.current_round]
    );
    if (bids.length > 0) {
      const [bidItems] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bids[0].id]);
      myBid = { ...bids[0], bid_items: bidItems };
    }
  } else {
    const [bids] = await pool.query(
      `SELECT vb.*, v.vendor_name FROM vendor_bids vb
       LEFT JOIN vendors v ON vb.vendor_id = v.id WHERE vb.rfq_id = ? AND vb.round_number = ?`,
      [id, rfq.current_round]
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

// ─── Edit RFQ (header, vendors, line items) — allowed at any status ────────
// Unlike PR, which only allows editing while still draft/rejected, an RFQ can
// be edited by procurement at any point in its lifecycle. Line items are
// updated in place by id (not delete+recreate) so existing vendor bids and
// document_flow_mapping rows that reference a line's id stay valid. A line
// can only be removed, and a line's quantity can only be reduced, if doing so
// wouldn't invalidate a bid or an award that already exists against it.

router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  const { title, description, submission_deadline, rfq_type, procurement_category_id, budget_value, vendor_ids, line_items } = req.body;

  const missing = [];
  if (!title) missing.push('title');
  if (!submission_deadline) missing.push('submission_deadline');
  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) missing.push('vendor_ids');
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) missing.push('line_items');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE rfqs SET title = ?, description = ?, submission_deadline = ?, rfq_type = ?, procurement_category_id = ?, budget_value = ? WHERE id = ?`,
      [title, description || null, new Date(submission_deadline), rfq_type || 'Limited', procurement_category_id || null, budget_value || null, rfq.id]
    );

    // Vendors — add/remove invitees to match the new list. Removing an invite
    // never touches that vendor's existing bid (vendor_bids has no FK back to
    // rfq_vendors), so a bid already on file is preserved even if un-invited.
    const [existingVendorRows] = await conn.query('SELECT vendor_id FROM rfq_vendors WHERE rfq_id = ?', [rfq.id]);
    const existingVendorIds = existingVendorRows.map(v => v.vendor_id);
    for (const vendorId of vendor_ids) {
      if (!existingVendorIds.includes(vendorId)) {
        // Vendor Compliance Engine: only newly-added invitees are checked — an
        // existing invitee who became blocked after being invited isn't retroactively
        // removed by an unrelated edit; that's a decision the admin makes deliberately.
        await assertVendorUsable(vendorId, conn);
        await conn.query('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), rfq.id, vendorId]);
      }
    }
    for (const vendorId of existingVendorIds) {
      if (!vendor_ids.includes(vendorId)) {
        await conn.query('DELETE FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [rfq.id, vendorId]);
      }
    }

    // Line items
    const [existingLines] = await conn.query('SELECT * FROM rfq_line_items WHERE rfq_id = ?', [rfq.id]);
    const payloadIds = new Set(line_items.filter(li => li.id).map(li => li.id));

    for (const existing of existingLines) {
      if (!payloadIds.has(existing.id)) {
        const [[{ cnt: bidCount }]] = await conn.query('SELECT COUNT(*) as cnt FROM vendor_bid_items WHERE rfq_line_item_id = ?', [existing.id]);
        const awarded = await getMappedQuantity('RFQ', existing.id, conn);
        if (bidCount > 0 || awarded > 0) {
          throw new ValidationError(`Cannot remove "${existing.item_description}" — it already has a vendor bid or has been awarded`);
        }
        await conn.query('DELETE FROM rfq_line_items WHERE id = ?', [existing.id]);
      }
    }

    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      if (!item.item_description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
      const techSpecs = item.technical_specifications ? JSON.stringify(item.technical_specifications) : null;

      if (item.id) {
        if (!existingLines.some(l => l.id === item.id)) throw new ValidationError(`Line item ${item.id} does not belong to this RFQ`);
        const awarded = await getMappedQuantity('RFQ', item.id, conn);
        if (Number(item.quantity) < awarded) {
          throw new ValidationError(`Quantity for "${item.item_description}" cannot be reduced below what's already been awarded (${awarded})`);
        }
        await conn.query(
          `UPDATE rfq_line_items SET
             item_master_id = ?, item_description = ?, quantity = ?, uom = ?, target_price = ?, sequence = ?,
             technical_specifications = ?, delivery_location_id = ?, required_delivery_date = ?, remarks = ?, attachment_path = ?, attachment_name = ?
           WHERE id = ?`,
          [
            item.item_master_id || null, item.item_description, item.quantity, item.uom || 'Nos', item.target_price || null, i + 1,
            techSpecs, item.delivery_location_id || null, item.required_delivery_date || null, item.remarks || null,
            item.attachment_path || null, item.attachment_name || null, item.id,
          ]
        );
      } else {
        await conn.query(
          `INSERT INTO rfq_line_items
            (id, rfq_id, item_master_id, item_description, quantity, uom, target_price, sequence, remarks, attachment_path, attachment_name, technical_specifications, delivery_location_id, required_delivery_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), rfq.id, item.item_master_id || null, item.item_description, item.quantity, item.uom || 'Nos', item.target_price || null, i + 1,
            item.remarks || null, item.attachment_path || null, item.attachment_name || null, techSpecs, item.delivery_location_id || null, item.required_delivery_date || null,
          ]
        );
      }
    }
  });

  res.json({ success: true, message: 'RFQ updated' });
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
  if (!['published', 'negotiation'].includes(rfq.status)) throw new ValidationError('Only published or in-negotiation RFQs can be closed');

  await pool.query("UPDATE rfqs SET status = 'closed' WHERE id = ?", [rfq.id]);

  // Mark vendors who never responded THIS round as not_responded.
  await pool.query(
    `UPDATE rfq_vendors rv
     SET rv.participation_status = 'not_responded'
     WHERE rv.rfq_id = ? AND rv.participation_status = 'invited'
       AND NOT EXISTS (SELECT 1 FROM vendor_bids vb WHERE vb.rfq_id = rv.rfq_id AND vb.vendor_id = rv.vendor_id AND vb.round_number = ?)`,
    [rfq.id, rfq.current_round]
  );

  res.json({ success: true, message: 'RFQ closed' });
}));

// ─── Open Negotiation Round ─────────────────────────────────────────────────
// Multi-Round RFQ Negotiation: reopens a closed RFQ for a fresh round of bid
// revisions. Every prior round's bids/items remain untouched in vendor_bids/
// vendor_bid_items as permanent history (see GET /:id/negotiation-history) —
// this only advances current_round and re-invites the chosen vendors.

router.post('/:id/negotiate', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  if (!['closed', 'negotiation'].includes(rfq.status)) {
    throw new ValidationError(`RFQ must be closed before opening a new negotiation round (status: ${rfq.status})`);
  }

  const { vendor_ids, submission_deadline, remarks } = req.body;
  if (!submission_deadline) throw new ValidationError('Missing required field', ['submission_deadline']);

  const nextRound = rfq.current_round + 1;

  // Default: re-invite every vendor who actually bid in the round just
  // closed — procurement can narrow this to a shortlist via vendor_ids.
  let targetVendorIds = vendor_ids;
  if (!targetVendorIds || !Array.isArray(targetVendorIds) || targetVendorIds.length === 0) {
    const [prevBidders] = await pool.query(
      'SELECT DISTINCT vendor_id FROM vendor_bids WHERE rfq_id = ? AND round_number = ?',
      [rfq.id, rfq.current_round]
    );
    targetVendorIds = prevBidders.map(b => b.vendor_id);
  }
  if (targetVendorIds.length === 0) throw new ValidationError('No vendors to invite to the next round — specify vendor_ids');

  await withTransaction(async (conn) => {
    await conn.query(
      "UPDATE rfqs SET status = 'negotiation', current_round = ?, submission_deadline = ? WHERE id = ?",
      [nextRound, new Date(submission_deadline), rfq.id]
    );

    for (const vendorId of targetVendorIds) {
      const [[existingInvite]] = await conn.query('SELECT id FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [rfq.id, vendorId]);
      if (existingInvite) {
        await conn.query("UPDATE rfq_vendors SET participation_status = 'invited' WHERE id = ?", [existingInvite.id]);
      } else {
        await assertVendorUsable(vendorId, conn);
        await conn.query('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), rfq.id, vendorId]);
      }
    }
  });

  res.json({
    success: true,
    message: `Negotiation round ${nextRound} opened`,
    data: { round_number: nextRound, invited_vendor_count: targetVendorIds.length, remarks: remarks || null },
  });
}));

// ─── Negotiation History — every round's bids, in full ────────────────────

router.get('/:id/negotiation-history', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);

  const [bids] = await pool.query(
    `SELECT vb.*, v.vendor_name FROM vendor_bids vb
     LEFT JOIN vendors v ON vb.vendor_id = v.id
     WHERE vb.rfq_id = ? ORDER BY vb.round_number, v.vendor_name`,
    [rfq.id]
  );

  const byRound = {};
  for (const bid of bids) {
    const [items] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bid.id]);
    (byRound[bid.round_number] ||= []).push({ ...bid, bid_items: items });
  }

  res.json({ success: true, data: { rfq_id: rfq.id, rfq_number: rfq.rfq_number, current_round: rfq.current_round, rounds: byRound } });
}));

// ─── Comparison Data ─────────────────────────────────────────────────────────

router.get('/:id/comparison', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);

  const [lineItems] = await pool.query('SELECT * FROM rfq_line_items WHERE rfq_id = ? ORDER BY sequence', [rfq.id]);

  // Multi-Round Negotiation: comparison always reflects the current round —
  // prior rounds are available via GET /:id/negotiation-history.
  const [bids] = await pool.query(
    `SELECT vb.*, v.vendor_name, v.company_name FROM vendor_bids vb
     LEFT JOIN vendors v ON vb.vendor_id = v.id WHERE vb.rfq_id = ? AND vb.round_number = ?`,
    [rfq.id, rfq.current_round]
  );

  const lineById = {};
  lineItems.forEach(li => { lineById[li.id] = li; });

  // Should-Cost Benchmark: every bid item gets a should-cost comparison
  // (deviation % + high-deviation warning) whenever its RFQ line is linked to
  // a catalogue item — reuses ProcurementInsightsService rather than a
  // second pricing computation living here.
  const bidsWithItems = [];
  for (const bid of bids) {
    const [bidItems] = await pool.query('SELECT * FROM vendor_bid_items WHERE bid_id = ?', [bid.id]);
    for (const bi of bidItems) {
      const line = lineById[bi.rfq_line_item_id];
      bi.should_cost_comparison = null;
      if (line?.item_master_id) {
        try { bi.should_cost_comparison = await getShouldCostBenchmark(line.item_master_id, bi.unit_price); }
        catch { /* item_master row missing — leave null */ }
      }
    }
    bidsWithItems.push({ ...bid, bid_items: bidItems });
  }

  // Price benchmarks from historical data per item — uses the catalogue-item
  // benchmark (stable item_master_id match) when the line is linked, falling
  // back to the legacy free-text match for lines that aren't.
  const benchmarks = {};
  for (const item of lineItems) {
    if (item.item_master_id) {
      try {
        const ib = await getItemPriceBenchmark(item.item_master_id);
        benchmarks[item.id] = {
          avg_price: ib.benchmark.avg_price, min_price: ib.benchmark.min_price,
          max_price: ib.benchmark.max_price, last_price: ib.benchmark.last_price,
        };
        continue;
      } catch { /* fall through to legacy lookup below */ }
    }
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
  if (!['published', 'negotiation'].includes(rfq.status)) throw new ValidationError('Bids can only be submitted on published or in-negotiation RFQs');
  if (new Date(rfq.submission_deadline) < new Date()) throw new ValidationError('Submission deadline has passed');

  const [assigned] = await pool.query('SELECT id FROM rfq_vendors WHERE rfq_id = ? AND vendor_id = ?', [rfq.id, req.user.vendorId]);
  if (assigned.length === 0) throw new ValidationError('You are not invited to this RFQ');

  const { bid_items, remarks, taxes_included_flag, offered_payment_terms, warranty_period, deviation_flag, tco_value, overall_attachment_path, overall_attachment_name } = req.body;
  if (!bid_items || !Array.isArray(bid_items) || bid_items.length === 0) throw new ValidationError('bid_items are required');

  // Multi-Round Negotiation: a bid is scoped to the RFQ's CURRENT round — a
  // vendor can freely revise in place within this round (existing behavior,
  // unchanged below), but once the round advances (POST /:id/negotiate) this
  // lookup finds nothing for the new round and a brand-new row is inserted,
  // leaving the prior round's bid untouched as permanent history.
  // One transaction — revising a bid deletes its old line items before
  // re-inserting the new ones; a failure partway through the items loop
  // (e.g. a malformed item) previously left the bid header updated but with
  // no items at all (or only some of the new ones).
  let bidId;
  await withTransaction(async (conn) => {
    const [existing] = await conn.query(
      'SELECT id FROM vendor_bids WHERE rfq_id = ? AND vendor_id = ? AND round_number = ?',
      [rfq.id, req.user.vendorId, rfq.current_round]
    );

    // Quantities come from the RFQ line items, not client input, since bid_items only carries price/lead time.
    const [rfqLineItems] = await conn.query('SELECT id, quantity FROM rfq_line_items WHERE rfq_id = ?', [rfq.id]);
    const quantityByLineItem = {};
    rfqLineItems.forEach(li => { quantityByLineItem[li.id] = Number(li.quantity); });

    const totalValue = bid_items.reduce((sum, bi) => {
      const lineQty = quantityByLineItem[bi.rfq_line_item_id] || 0;
      return sum + ((bi.unit_price || 0) * lineQty);
    }, 0);

    // TCO (total cost of ownership) — use vendor-supplied value if given, otherwise
    // default to the computed totalValue so the comparison engine always has a usable number.
    const tcoValue = tco_value != null ? tco_value : totalValue;

    if (existing.length > 0) {
      bidId = existing[0].id;
      await conn.query(
        `UPDATE vendor_bids
         SET total_value = ?, remarks = ?, status = 'revised', updated_at = NOW(),
             taxes_included_flag = ?, offered_payment_terms = ?, warranty_period = ?, deviation_flag = ?, tco_value = ?,
             overall_attachment_path = ?, overall_attachment_name = ?
         WHERE id = ?`,
        [totalValue, remarks || null, taxes_included_flag ?? false, offered_payment_terms || null, warranty_period || null, deviation_flag ?? false, tcoValue, overall_attachment_path || null, overall_attachment_name || null, bidId]
      );
      await conn.query('DELETE FROM vendor_bid_items WHERE bid_id = ?', [bidId]);
    } else {
      bidId = uuidv4();
      await conn.query(
        `INSERT INTO vendor_bids (id, rfq_id, vendor_id, round_number, total_value, remarks, taxes_included_flag, offered_payment_terms, warranty_period, deviation_flag, tco_value, overall_attachment_path, overall_attachment_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bidId, rfq.id, req.user.vendorId, rfq.current_round, totalValue, remarks || null, taxes_included_flag ?? false, offered_payment_terms || null, warranty_period || null, deviation_flag ?? false, tcoValue, overall_attachment_path || null, overall_attachment_name || null]
      );
      await conn.query(
        "UPDATE rfq_vendors SET participation_status = 'submitted' WHERE rfq_id = ? AND vendor_id = ?",
        [rfq.id, req.user.vendorId]
      );
    }

    for (const bi of bid_items) {
      if (!bi.rfq_line_item_id || bi.unit_price == null) throw new ValidationError('Each bid item needs rfq_line_item_id and unit_price');
      await conn.query(
        `INSERT INTO vendor_bid_items (id, bid_id, rfq_line_item_id, unit_price, lead_time_days, remarks, attachment_path, attachment_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), bidId, bi.rfq_line_item_id, bi.unit_price, bi.lead_time_days || null, bi.remarks || null, bi.attachment_path || null, bi.attachment_name || null]
      );
    }
  });

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

  // Award generates one PO per vendor (each with its own line items, price
  // history, and RFQ->PO mapping rows) and then marks the RFQ awarded — all
  // one transaction, since a failure partway through a multi-vendor split
  // award previously left some vendors' POs created and others not, with the
  // RFQ never actually marked 'awarded' either way.
  let generatedPOs;
  await withTransaction(async (conn) => {
    // Validate all line items belong to this RFQ
    const [rfqLineItems] = await conn.query('SELECT * FROM rfq_line_items WHERE rfq_id = ?', [rfq.id]);
    const rfqItemMap = {};
    rfqLineItems.forEach(li => { rfqItemMap[li.id] = li; });

    for (const ai of award_items) {
      if (!rfqItemMap[ai.rfq_line_item_id]) throw new ValidationError(`Line item ${ai.rfq_line_item_id} does not belong to this RFQ`);
      if (!ai.vendor_id || ai.unit_price == null || !ai.quantity) throw new ValidationError('Each award item needs vendor_id, unit_price, and quantity');
    }

    // A single RFQ line can be split across several award_items (one per
    // vendor) — cap the *total* awarded across all of them at the line's own
    // quantity, on top of whatever was already awarded in a prior partial award.
    const requestedByLine = {};
    for (const ai of award_items) {
      requestedByLine[ai.rfq_line_item_id] = (requestedByLine[ai.rfq_line_item_id] || 0) + Number(ai.quantity);
    }
    for (const [lineId, requestedQty] of Object.entries(requestedByLine)) {
      const line = rfqItemMap[lineId];
      const remaining = Number(line.quantity) - (await getMappedQuantity('RFQ', lineId, conn));
      if (requestedQty > remaining) {
        throw new ValidationError(`Award quantity for "${line.item_description}" (${requestedQty}) exceeds the remaining awardable quantity (${remaining})`);
      }
    }

    // Group award items by vendor
    const byVendor = {};
    for (const ai of award_items) {
      if (!byVendor[ai.vendor_id]) byVendor[ai.vendor_id] = [];
      byVendor[ai.vendor_id].push(ai);
    }

    let sourcePr = null;
    if (rfq.pr_id) {
      const [[pr]] = await conn.query('SELECT * FROM purchase_requisitions WHERE id = ?', [rfq.pr_id]);
      sourcePr = pr || null;
    }

    generatedPOs = [];

    for (const [vendorId, items] of Object.entries(byVendor)) {
      const totalAmount = items.reduce((sum, ai) => sum + (Number(ai.unit_price) * Number(ai.quantity)), 0);
      const poId = uuidv4();
      const poNumber = await autoPONumber(conn);

      await conn.query(
        `INSERT INTO purchase_orders (id, po_number, vendor_id, total_amount, pr_id, rfq_id, department, account_assignment_category, company_code, plant, requester_id, transaction_chain_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          poId, poNumber, vendorId, totalAmount, rfq.pr_id || null, rfq.id,
          sourcePr?.department || null, sourcePr?.account_assignment_category || null,
          sourcePr?.company_code || null, sourcePr?.plant || null, sourcePr?.requester_id || null,
          rfq.transaction_chain_id || rfq.id,
        ]
      );
      if (sourcePr?.cost_center) await consumeBudget(sourcePr.cost_center, totalAmount, conn);

      for (let i = 0; i < items.length; i++) {
        const ai = items[i];
        const rfqItem = rfqItemMap[ai.rfq_line_item_id];
        const lineAmount = Number(ai.unit_price) * Number(ai.quantity);
        const poLineId = uuidv4();
        await conn.query(
          'INSERT INTO po_line_items (id, po_id, line_number, description, quantity, unit_price, amount, pr_line_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [poLineId, poId, i + 1, rfqItem.item_description, ai.quantity, ai.unit_price, lineAmount, rfqItem.pr_line_item_id || null]
        );

        // Record price history for benchmarking — carries item_master_id through
        // when the RFQ line was linked to a catalogue item, so ProcurementInsightsService
        // can benchmark by stable item identity instead of item_description text.
        await conn.query(
          'INSERT INTO price_history (id, item_description, item_master_id, vendor_id, po_id, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), rfqItem.item_description, rfqItem.item_master_id || null, vendorId, poId, ai.unit_price, ai.quantity]
        );

        // RFQ→PO mapping — the PR-level pool was already reserved when this
        // RFQ line was created, so awarding only consumes the RFQ's own pool.
        await recordMapping('RFQ', rfqItem.id, 'PO', poLineId, ai.quantity, req.user.id, conn);
      }

      generatedPOs.push({ po_id: poId, po_number: poNumber, vendor_id: vendorId });
    }

    await conn.query("UPDATE rfqs SET status = 'awarded' WHERE id = ?", [rfq.id]);
  });

  res.json({ success: true, data: { rfq_id: rfq.id, purchase_orders: generatedPOs } });
}));

// ─── Create PO from RFQ Comparison ──────────────────────────────────────────
// Converts an awarded vendor's bid lines into a draft PO. The vendor must
// have at least one awarded bid for this RFQ, must be mapped to the RFQ's
// company (if the RFQ has one), and the user must have access to that company.

router.post('/:rfqId/create-po', authenticate, requireRole('procurement_admin', 'system_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { vendor_id } = req.body;
  if (!vendor_id) throw new ValidationError('vendor_id is required', ['vendor_id']);

  const rfq = await getRfqOrThrow(req.params.rfqId);

  // 1. Validate user has access to RFQ's company
  if (rfq.company_id && req.companyIds !== null) {
    if (!req.companyIds || !req.companyIds.includes(rfq.company_id)) {
      throw new AuthorizationError('You do not have access to this company');
    }
  }

  // 2. Assert company is active
  if (rfq.company_id) {
    await assertCompanyActive(rfq.company_id);
  }

  // 3. Validate vendor is mapped to RFQ's company via vendor_company_mapping
  if (rfq.company_id) {
    const [[mapping]] = await pool.query(
      'SELECT id FROM vendor_company_mapping WHERE vendor_id = ? AND company_id = ?',
      [vendor_id, rfq.company_id]
    );
    if (!mapping) {
      throw new ValidationError('Vendor is not available for the selected company', ['vendor_id']);
    }
  }

  // 4. Load awarded bid for this vendor on this RFQ
  const [bids] = await pool.query(
    "SELECT * FROM vendor_bids WHERE rfq_id = ? AND vendor_id = ? AND status = 'awarded'",
    [rfq.id, vendor_id]
  );
  if (bids.length === 0) {
    throw new ValidationError('No awarded bid found for this vendor on this RFQ', ['vendor_id']);
  }
  const awardedBid = bids[0];

  // 5. Load bid items with RFQ line item details
  const [bidItems] = await pool.query(
    `SELECT vbi.*, rli.item_description, rli.quantity, rli.uom
     FROM vendor_bid_items vbi
     INNER JOIN rfq_line_items rli ON vbi.rfq_line_item_id = rli.id
     WHERE vbi.bid_id = ?`,
    [awardedBid.id]
  );

  if (bidItems.length === 0) {
    throw new ValidationError('No bid line items found for the awarded bid', ['vendor_id']);
  }

  // 6. Create draft PO within a transaction
  let poId, poNumber;
  await withTransaction(async (conn) => {
    poId = uuidv4();
    poNumber = await autoPONumber(conn);
    const totalAmount = bidItems.reduce((sum, bi) => sum + (Number(bi.unit_price) * Number(bi.quantity)), 0);

    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, total_amount, status, company_id, rfq_id, transaction_chain_id)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [poId, poNumber, vendor_id, totalAmount, rfq.company_id || null, rfq.id, rfq.transaction_chain_id || rfq.id]
    );

    for (let i = 0; i < bidItems.length; i++) {
      const bi = bidItems[i];
      const lineAmount = Number(bi.unit_price) * Number(bi.quantity);
      await conn.query(
        'INSERT INTO po_line_items (id, po_id, line_number, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), poId, i + 1, bi.item_description, bi.quantity, bi.unit_price, lineAmount]
      );
    }
  });

  res.status(201).json({ success: true, data: { po_id: poId, po_number: poNumber } });
}));

// ─── Allocation — per-line awarded/remaining qty ───────────────────────────

router.get('/:id/allocation', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const rfq = await getRfqOrThrow(req.params.id);
  const [lineItems] = await pool.query('SELECT * FROM rfq_line_items WHERE rfq_id = ? ORDER BY sequence', [rfq.id]);

  const lines = [];
  for (const li of lineItems) {
    const awarded = await getMappedQuantity('RFQ', li.id);
    lines.push({
      rfq_line_item_id: li.id,
      item_description: li.item_description,
      uom: li.uom,
      target_price: li.target_price != null ? Number(li.target_price) : null,
      quantity: Number(li.quantity),
      awarded_quantity: awarded,
      remaining_to_award: Number(li.quantity) - awarded,
    });
  }

  res.json({ success: true, data: { rfq_id: rfq.id, rfq_number: rfq.rfq_number, lines } });
}));

module.exports = router;
