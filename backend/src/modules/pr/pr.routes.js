const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');
const { emitEvent } = require('../../common/eventBus');
const { maybeCreateIntercompanySalesOrder, getCompanyDetails } = require('../company/company.helpers');
const { resolveCompanyAccess, requireCompanyAccess } = require('../company/company.middleware');
const { assertCompanyActive } = require('../company/company.guards');
const { evaluateDecisionRules } = require('../decision-engine/decision-engine.service');
const {
  getPrOrThrow,
  autoPRNumber,
  getSetting,
  recordMapping,
  getMappedQuantity,
  refreshPrLineRemaining,
  refreshPrStatusAfterConsumption,
  resolveApprovalRule,
  computeSourcingRecommendation,
  computeBudgetStatus,
  commitBudget,
  releaseCommitment,
  consumeBudget,
  determineLineApprovalRequirement,
  getBlockingLineItems,
  finalizePrApproval,
} = require('./pr.helpers');
const { detectBudgetBreach } = require('../exceptions/exceptions.service');
const { assertVendorUsable } = require('../vendor/vendor-compliance.service');
const { assertContractUsable, recordContractConsumption, getContractOrThrow } = require('../contracts/contracts.service');
const { createWorkflowInstance, recordStepDecision, wouldFinalizeOnApproval } = require('../workflow/workflow-engine.service');
const {
  newDocument, fmtMoney, fmtDate, drawDocumentHeader, drawTwoColumnBlock, drawFieldGrid,
  drawSectionTitle, drawTable, drawTotalsBlock, drawSignatureBlock, drawFooterNote, drawCompanyDetailsBlock, MARGIN, CONTENT_WIDTH,
} = require('../../common/pdf');

const router = express.Router();

const INTERNAL_ROLES = ['mdm_admin', 'procurement_admin'];

// ─── Helpers local to this module ───────────────────────────────────────────

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

function computeLineTotal(item) {
  return Number(item.quantity || 0) * Number(item.estimated_unit_price || 0);
}

// Shared by /approve, /reject, and the line-level approve/reject endpoints —
// every action against a submitted PR's workflow gates on the same rule:
// only the current step's approver_role (or mdm_admin) may act.
async function assertCurrentStepApprover(pr, user, conn) {
  const c = conn || pool;
  const [[instance]] = await c.query('SELECT * FROM workflow_instances WHERE id = ?', [pr.workflow_instance_id]);
  if (!instance) throw new NotFoundError('Workflow instance not found');
  if (instance.current_step_id && user.role !== 'mdm_admin') {
    const [[currentStep]] = await c.query('SELECT approver_role FROM workflow_steps WHERE id = ?', [instance.current_step_id]);
    if (currentStep && currentStep.approver_role !== user.role) {
      throw new AuthorizationError(`This step requires approver role '${currentStep.approver_role}'`);
    }
  }
  return instance;
}

async function fetchPrLineItems(prId, conn) {
  const [rows] = await (conn || pool).query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY sequence', [prId]);
  return rows;
}

// Resolves which PR lines + quantities a create-rfq/create-po call should act
// on. Validates against the *live* mapping ledger, not the cached
// remaining_quantity column, so a stale read can never let two near-
// simultaneous actions over-allocate the same line. `lines` is an optional
// [{ pr_line_item_id, quantity, unit_price? }] selection; omitted/empty means
// "every line at its full remaining quantity" (the original, simpler
// behavior). `unit_price` is an optional manual override (PR→PO data
// propagation allows manual pricing since the PR only ever carries an
// estimate) — falls back to the PR line's estimated_unit_price when omitted.
// Returns an array (possibly empty) — callers decide whether that's an error.
async function resolvePrLineSelections(prId, lines, conn) {
  const allLines = await fetchPrLineItems(prId, conn);
  const selections = [];

  if (lines && Array.isArray(lines) && lines.length > 0) {
    for (const sel of lines) {
      const li = allLines.find(l => l.id === sel.pr_line_item_id);
      if (!li) throw new ValidationError(`Line ${sel.pr_line_item_id} does not belong to this requisition`);
      // Line-Level Approval: a rejected line can never be sourced, even via
      // an explicit manual selection.
      if (li.approval_status === 'rejected') throw new ValidationError(`"${li.description}" was rejected during line-level approval and cannot be sourced`);
      const remaining = Number(li.quantity) - (await getMappedQuantity('PR', li.id, conn));
      const qty = Number(sel.quantity);
      if (!qty || qty <= 0) throw new ValidationError(`Quantity for "${li.description}" must be greater than zero`);
      if (qty > remaining) throw new ValidationError(`Quantity for "${li.description}" exceeds the remaining requisition quantity (${remaining})`);
      selections.push({ ...li, chosenQty: qty, chosenUnitPrice: sel.unit_price != null ? Number(sel.unit_price) : Number(li.estimated_unit_price || 0) });
    }
  } else {
    for (const li of allLines) {
      // Line-Level Approval: skip rejected lines entirely in the "all
      // remaining lines" default path (used by AUTO_PO and bulk create-rfq/po).
      if (li.approval_status === 'rejected') continue;
      const remaining = Number(li.quantity) - (await getMappedQuantity('PR', li.id, conn));
      if (remaining > 0) selections.push({ ...li, chosenQty: remaining, chosenUnitPrice: Number(li.estimated_unit_price || 0) });
    }
  }

  return selections;
}

// Creates a PO from a set of PR line items — shared by the manual create-po
// route and the AUTO_PO auto-trigger fired from approve().
async function createPoFromPr(pr, lineItems, vendorId, opts = {}, conn) {
  const c = conn || pool;
  // Vendor Compliance Engine: gate the actual spend commitment (this is
  // where a real PO gets created — for both the manual "Create PO" button
  // and the AUTO_PO auto-trigger fired from approve()) rather than the PR's
  // earlier, non-committing preferred_vendor_id selection.
  await assertVendorUsable(vendorId, conn);

  // Contract Consumption Tracking: "use contract price as default" — a line
  // with no usable price of its own (no estimate, no explicit override)
  // falls back to the contract's flat default_unit_price when this PO is
  // being created against one.
  if (opts.contract_id && opts.default_unit_price != null) {
    lineItems = lineItems.map(li => {
      const hasPrice = (li.chosenUnitPrice != null && Number(li.chosenUnitPrice) !== 0) || (li.estimated_unit_price != null && Number(li.estimated_unit_price) !== 0);
      return hasPrice ? li : { ...li, chosenUnitPrice: Number(opts.default_unit_price) };
    });
  }

  const poId = uuidv4();
  const poNumber = await autoPONumber(conn);
  const totalAmount = lineItems.reduce((sum, li) => sum + Number(li.chosenQty) * Number(li.chosenUnitPrice ?? li.estimated_unit_price ?? 0), 0);

  // Contract Consumption Tracking: enforce usage (active, within validity,
  // within remaining value) before the PO is actually created.
  if (opts.contract_id) await assertContractUsable(opts.contract_id, totalAmount, conn);

  await c.query(
    `INSERT INTO purchase_orders
      (id, po_number, vendor_id, total_amount, pr_id, department, account_assignment_category, company_code, plant, requester_id, contract_id, terms_of_payment, cost_center, transaction_chain_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poId, poNumber, vendorId, totalAmount, pr.id, pr.department, pr.account_assignment_category,
      pr.company_code || null, pr.plant || null, pr.requester_id, opts.contract_id || null, opts.terms_of_payment || null,
      pr.cost_center || null, pr.transaction_chain_id || pr.id,
    ]
  );

  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const unitPrice = Number(li.chosenUnitPrice ?? li.estimated_unit_price ?? 0);
    const amount = Number(li.chosenQty) * unitPrice;
    const poLineId = uuidv4();
    await c.query(
      `INSERT INTO po_line_items (id, po_id, line_number, description, quantity, uom, unit_price, amount, pr_line_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poLineId, poId, i + 1, li.description, li.chosenQty, li.uom, unitPrice, amount, li.id]
    );
    await recordMapping('PR', li.id, 'PO', poLineId, li.chosenQty, opts.actorId, conn);
    await refreshPrLineRemaining(li.id, conn);
  }

  await refreshPrStatusAfterConsumption(pr.id, conn);
  // Budget Commitment Model: stage 1->2 — the portion of the PR's commitment
  // covered by this PO converts into a firm, consumed obligation. Released by
  // exact amount, not a percentage estimate, since these line items are the
  // precise slice of the PR being converted.
  await releaseCommitment(pr.cost_center, totalAmount, conn);
  await consumeBudget(pr.cost_center, totalAmount, conn);
  // Contract Consumption Tracking: update on PO creation.
  if (opts.contract_id) await recordContractConsumption(opts.contract_id, totalAmount, conn);
  // Validation rule: a PO can legitimately cost more than its PR line's
  // estimate (price changed during sourcing) — if that pushes the cost
  // center over budget, surface it as a tracked exception rather than
  // silently letting it through (budget_breach was already wired at PR
  // submit time; this re-checks at the point money actually moves).
  const budgetAfter = await computeBudgetStatus(pr.cost_center, pr.total_value, conn);
  if (budgetAfter.budget_status === 'exceeds_budget') {
    await detectBudgetBreach(pr, budgetAfter, pr.total_value, conn);
  }
  await c.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), pr.id, 'converted_to_po', opts.actorId || pr.requester_id, poNumber]
  );

  // PO_APPROVED: this app's PO lifecycle has no separate approval step (a PO
  // is usable the moment it's created) — creation is the closest real
  // equivalent, so that's what this fires on.
  await emitEvent('PO_APPROVED', { module_name: 'po', record_id: poId, po_number: poNumber, total_amount: totalAmount, vendor_id: vendorId }, conn);

  // Module 1: Intercompany — a no-op for the overwhelming majority of POs
  // (vendor isn't one of the organization's own companies); see company.helpers.js.
  // Best-effort by design (catches its own errors) — sharing this transaction's
  // conn just means it sees the PO row that was just inserted above.
  await maybeCreateIntercompanySalesOrder(vendorId, poId, totalAmount, pr.company_id, conn);

  return { po_id: poId, po_number: poNumber };
}

// Shared by every path that can finalize a requisition once its workflow
// sign-off chain is complete: the final wave of /:id/approve, a workflow that
// resolves with zero applicable steps at /:id/submit (Workflow Engine's
// conditional steps can all skip), and a line-level approve/reject call that
// turns out to be the last blocking line on an already-resolved workflow.
// Always call getBlockingLineItems first and only invoke this once it's
// empty — this function itself does not re-check that gate.
async function finalizeRequisition(pr, actorId, conn) {
  const finalResult = await finalizePrApproval(pr, actorId, conn);
  let poResult = null;
  if (finalResult.final_status === 'approved' && pr.sourcing_strategy === 'AUTO_PO' && pr.preferred_vendor_id) {
    const selections = await resolvePrLineSelections(pr.id, null, conn);
    if (selections.length > 0) {
      poResult = await createPoFromPr({ ...pr, status: 'approved' }, selections, pr.preferred_vendor_id, { actorId }, conn);
    }
  }
  return { finalResult, poResult };
}

// Covers the narrow case where a requisition's workflow already resolved
// with zero applicable steps (Workflow Engine conditional steps all skipped
// at submit time — see /:id/submit) while lines still needed individual
// review: nothing else will ever call /:id/approve for it (there's no active
// step), so resolving the LAST blocking line is itself what must finalize
// it. No-op (returns null) for the normal case where a human step is still
// pending — finalization there stays gated on /:id/approve as usual.
async function maybeAutoFinalizeAfterLineDecision(pr, instance, actorId, conn) {
  if (instance.current_step_id) return null;
  const blocking = await getBlockingLineItems(pr.id, conn);
  if (blocking.length > 0) return null;
  return finalizeRequisition(pr, actorId, conn);
}

// ─── List ────────────────────────────────────────────────────────────────

router.get('/', authenticate, requireRole(...INTERNAL_ROLES), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { status, department, priority, sourcing_strategy, document_type } = req.query;

  // Multi-company isolation: if companyIds is an empty array, the user has no
  // company access — return empty result immediately.
  if (Array.isArray(req.companyIds) && req.companyIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  // rfq_line_count / blocking_line_count are read-only display aggregates for
  // the List page's Insight column (e.g. "RFQ required but not created" /
  // "N line(s) need approval") — blocking_line_count mirrors the exact
  // WHERE clause pr.helpers.js's getBlockingLineItems() already uses, not a
  // new approval rule.
  let sql = `
    SELECT pr.*, u.full_name as requester_name, cm.company_name,
      (SELECT COUNT(*) FROM pr_line_items WHERE pr_id = pr.id) as item_count,
      (SELECT COUNT(*) FROM rfq_line_items rli INNER JOIN pr_line_items pli ON rli.pr_line_item_id = pli.id WHERE pli.pr_id = pr.id) as rfq_line_count,
      (SELECT COUNT(*) FROM pr_line_items WHERE pr_id = pr.id AND requires_line_approval = TRUE AND approval_status = 'pending') as blocking_line_count,
      s.approver_role as current_approver_role, s.step_name as current_step_name
    FROM purchase_requisitions pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN company_master cm ON pr.company_id = cm.id
    LEFT JOIN workflow_instances wi ON pr.workflow_instance_id = wi.id
    LEFT JOIN workflow_steps s ON wi.current_step_id = s.id
    WHERE 1=1`;
  const params = [];

  // Multi-company isolation: filter by user's accessible companies.
  // null means system_admin (unrestricted); array means scoped user.
  if (Array.isArray(req.companyIds)) {
    sql += ` AND (pr.company_id IN (${req.companyIds.map(() => '?').join(',')}) OR pr.company_id IS NULL)`;
    params.push(...req.companyIds);
  }

  if (status) { sql += ' AND pr.status = ?'; params.push(status); }
  if (department) { sql += ' AND pr.department = ?'; params.push(department); }
  if (priority) { sql += ' AND pr.priority = ?'; params.push(priority); }
  if (sourcing_strategy) { sql += ' AND pr.sourcing_strategy = ?'; params.push(sourcing_strategy); }
  if (document_type) { sql += ' AND pr.document_type = ?'; params.push(document_type); }
  sql += ' ORDER BY pr.created_at DESC';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// ─── Stateless insight endpoints (must be registered before /:id) ─────────

router.get('/recommend-sourcing', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { total_value, preferred_vendor_id, contract_id } = req.query;
  const recommendation = await computeSourcingRecommendation({
    total_value: total_value || 0,
    preferred_vendor_id: preferred_vendor_id || null,
    contract_id: contract_id || null,
  });
  res.json({ success: true, data: recommendation });
}));

router.get('/budget-check', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { cost_center, total_value } = req.query;
  const result = await computeBudgetStatus(cost_center || null, total_value || 0);
  res.json({ success: true, data: result });
}));

// ─── Create ──────────────────────────────────────────────────────────────

router.post('/', authenticate, requireRole(...INTERNAL_ROLES), resolveCompanyAccess, requireCompanyAccess(), asyncHandler(async (req, res) => {
  const {
    document_type, company_code, plant, department, cost_center, project_code,
    account_assignment_category, currency, required_date, priority, justification,
    sourcing_strategy, preferred_vendor_id, contract_id, line_items, company_id,
  } = req.body;

  // Multi-company isolation: validate the submitted company is active
  await assertCompanyActive(company_id);

  const missing = [];
  if (!department) missing.push('department');
  if (!justification) missing.push('justification');
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) missing.push('line_items');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  for (let i = 0; i < line_items.length; i++) {
    const item = line_items[i];
    if (!item.description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
  }

  const prId = uuidv4();
  const totalValue = line_items.reduce((sum, item) => sum + computeLineTotal(item), 0);
  let prNumber;

  await withTransaction(async (conn) => {
    prNumber = await autoPRNumber(conn);
    await conn.query(
      `INSERT INTO purchase_requisitions
        (id, pr_number, document_type, company_code, plant, department, requester_id, cost_center, project_code,
         account_assignment_category, currency, required_date, priority, justification, sourcing_strategy,
         preferred_vendor_id, contract_id, total_value, transaction_chain_id, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prId, prNumber, document_type || 'Standard', company_code || null, plant || null, department, req.user.id,
        cost_center || null, project_code || null, account_assignment_category || 'Cost Center', currency || 'INR',
        required_date || null, priority || 'Medium', justification, sourcing_strategy || 'RFQ_REQUIRED',
        preferred_vendor_id || null, contract_id || null, totalValue,
        prId, // a PR is always the root of its own transaction chain
        company_id || null,
      ]
    );

    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      const lineTotal = computeLineTotal(item);
      await conn.query(
        `INSERT INTO pr_line_items
          (id, pr_id, sequence, item_master_id, description, quantity, uom, estimated_unit_price, estimated_total_price,
           delivery_date, delivery_location, plant, storage_location, gr_required, ir_required, partial_delivery_allowed,
           account_assignment_details, preferred_vendor_id, remaining_quantity, attachment_path, attachment_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), prId, i + 1, item.item_master_id || null, item.description, item.quantity, item.uom || 'Nos',
          item.estimated_unit_price ?? null, lineTotal || null, item.delivery_date || null, item.delivery_location || null,
          item.plant || null, item.storage_location || null, item.gr_required !== false, item.ir_required !== false,
          item.partial_delivery_allowed !== false,
          item.account_assignment_details ? JSON.stringify(item.account_assignment_details) : null,
          item.preferred_vendor_id || null, item.quantity, item.attachment_path || null, item.attachment_name || null,
        ]
      );
    }

    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
      [uuidv4(), prId, 'created', req.user.id]
    );
  });

  res.status(201).json({ success: true, data: { id: prId, pr_number: prNumber } });
}));

// ─── Detail ──────────────────────────────────────────────────────────────

router.get('/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  const lineItems = await fetchPrLineItems(pr.id);

  const lineIds = lineItems.map(li => li.id);
  let linkedRfqByLine = {}, linkedPoByLine = {};
  if (lineIds.length > 0) {
    const placeholders = lineIds.map(() => '?').join(',');
    const [rfqLinks] = await pool.query(
      `SELECT pr_line_item_id, rfq_id FROM rfq_line_items WHERE pr_line_item_id IN (${placeholders})`,
      lineIds
    );
    const [poLinks] = await pool.query(
      `SELECT pr_line_item_id, po_id FROM po_line_items WHERE pr_line_item_id IN (${placeholders})`,
      lineIds
    );
    rfqLinks.forEach(l => { (linkedRfqByLine[l.pr_line_item_id] ||= new Set()).add(l.rfq_id); });
    poLinks.forEach(l => { (linkedPoByLine[l.pr_line_item_id] ||= new Set()).add(l.po_id); });
  }
  lineItems.forEach(li => {
    li.linked_rfq_ids = linkedRfqByLine[li.id] ? Array.from(linkedRfqByLine[li.id]) : [];
    li.linked_po_ids = linkedPoByLine[li.id] ? Array.from(linkedPoByLine[li.id]) : [];
  });

  const [[requester]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [pr.requester_id]);

  let currentApproverRole = null, currentStepName = null;
  if (pr.workflow_instance_id) {
    const [[step]] = await pool.query(
      `SELECT s.approver_role, s.step_name FROM workflow_instances wi
       LEFT JOIN workflow_steps s ON wi.current_step_id = s.id WHERE wi.id = ?`,
      [pr.workflow_instance_id]
    );
    currentApproverRole = step?.approver_role || null;
    currentStepName = step?.step_name || null;
  }

  res.json({
    success: true,
    data: {
      ...pr, line_items: lineItems,
      requester_name: requester?.full_name || requester?.email,
      current_approver_role: currentApproverRole,
      current_step_name: currentStepName,
    },
  });
}));

// ─── Edit (draft/rejected only) ───────────────────────────────────────────
// Once a requisition has been approved (or partially approved, or moved into
// sourcing), it's locked from further editing — silently changing an already-
// approved document's values/lines undermines the approval that was just
// recorded against it. A user who needs different terms after approval must
// raise a new requisition instead. Only draft and rejected requisitions
// (rejected = resubmittable after revision) can still be edited here. Line
// items are updated in place by id (not delete+recreate) so an RFQ already
// created from a line keeps a valid pr_line_item_id and the
// document_flow_mapping ledger stays correct. A line can only be removed,
// and its quantity only reduced, down to what hasn't already been sent to an
// RFQ or PO.

router.put('/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (!['draft', 'rejected'].includes(pr.status)) {
    throw new ValidationError(`This requisition can no longer be edited (status: ${pr.status}) — create a new requisition instead`);
  }
  const existingLines = await fetchPrLineItems(pr.id);

  const {
    document_type, company_code, plant, department, cost_center, project_code,
    account_assignment_category, currency, required_date, priority, justification,
    sourcing_strategy, preferred_vendor_id, contract_id, line_items,
  } = req.body;

  if (!department) throw new ValidationError('Missing required field', ['department']);
  if (!justification) throw new ValidationError('Missing required field', ['justification']);
  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
    throw new ValidationError('Missing required field', ['line_items']);
  }

  const totalValue = line_items.reduce((sum, item) => sum + computeLineTotal(item), 0);
  // A rejected PR resets to draft on save, ready to resubmit through the
  // workflow fresh — the guard above already guarantees status is draft or
  // rejected here.
  const nextStatus = 'draft';

  // Whole edit is one transaction — a per-line validation failure partway
  // through (e.g. "quantity reduced below what's already been sent out" on
  // line 3 of 5) previously left lines 1-2 already updated/deleted in the
  // database even though the request as a whole reported failure.
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE purchase_requisitions SET
         document_type = ?, company_code = ?, plant = ?, department = ?, cost_center = ?, project_code = ?,
         account_assignment_category = ?, currency = ?, required_date = ?, priority = ?, justification = ?,
         sourcing_strategy = ?, preferred_vendor_id = ?, contract_id = ?, total_value = ?, status = ?
       WHERE id = ?`,
      [
        document_type || 'Standard', company_code || null, plant || null, department, cost_center || null,
        project_code || null, account_assignment_category || 'Cost Center', currency || 'INR', required_date || null,
        priority || 'Medium', justification, sourcing_strategy || 'RFQ_REQUIRED', preferred_vendor_id || null,
        contract_id || null, totalValue, nextStatus, pr.id,
      ]
    );

    const payloadIds = new Set(line_items.filter(li => li.id).map(li => li.id));

    for (const existing of existingLines) {
      if (!payloadIds.has(existing.id)) {
        const mapped = await getMappedQuantity('PR', existing.id, conn);
        if (mapped > 0) {
          throw new ValidationError(`Cannot remove "${existing.description}" — it has already been sent to an RFQ or PO`);
        }
        await conn.query('DELETE FROM pr_line_items WHERE id = ?', [existing.id]);
      }
    }

    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      if (!item.description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
      const lineTotal = computeLineTotal(item);
      const accountAssignmentDetails = item.account_assignment_details ? JSON.stringify(item.account_assignment_details) : null;

      if (item.id) {
        if (!existingLines.some(l => l.id === item.id)) throw new ValidationError(`Line item ${item.id} does not belong to this requisition`);
        const mapped = await getMappedQuantity('PR', item.id, conn);
        if (Number(item.quantity) < mapped) {
          throw new ValidationError(`Quantity for "${item.description}" cannot be reduced below what's already been sent out (${mapped})`);
        }
        await conn.query(
          `UPDATE pr_line_items SET
             item_master_id = ?, description = ?, quantity = ?, uom = ?, estimated_unit_price = ?, estimated_total_price = ?,
             delivery_date = ?, delivery_location = ?, plant = ?, storage_location = ?, gr_required = ?, ir_required = ?,
             partial_delivery_allowed = ?, account_assignment_details = ?, preferred_vendor_id = ?,
             remaining_quantity = ? - ?, attachment_path = ?, attachment_name = ?, sequence = ?
           WHERE id = ?`,
          [
            item.item_master_id || null, item.description, item.quantity, item.uom || 'Nos',
            item.estimated_unit_price ?? null, lineTotal || null, item.delivery_date || null, item.delivery_location || null,
            item.plant || null, item.storage_location || null, item.gr_required !== false, item.ir_required !== false,
            item.partial_delivery_allowed !== false, accountAssignmentDetails, item.preferred_vendor_id || null,
            item.quantity, mapped, item.attachment_path || null, item.attachment_name || null, i + 1, item.id,
          ]
        );
      } else {
        await conn.query(
          `INSERT INTO pr_line_items
            (id, pr_id, sequence, item_master_id, description, quantity, uom, estimated_unit_price, estimated_total_price,
             delivery_date, delivery_location, plant, storage_location, gr_required, ir_required, partial_delivery_allowed,
             account_assignment_details, preferred_vendor_id, remaining_quantity, attachment_path, attachment_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), pr.id, i + 1, item.item_master_id || null, item.description, item.quantity, item.uom || 'Nos',
            item.estimated_unit_price ?? null, lineTotal || null, item.delivery_date || null, item.delivery_location || null,
            item.plant || null, item.storage_location || null, item.gr_required !== false, item.ir_required !== false,
            item.partial_delivery_allowed !== false, accountAssignmentDetails, item.preferred_vendor_id || null,
            item.quantity, item.attachment_path || null, item.attachment_name || null,
          ]
        );
      }
    }

    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
      [uuidv4(), pr.id, 'edited', req.user.id]
    );
  });

  res.json({ success: true, message: 'Requisition updated' });
}));

// ─── Submit ──────────────────────────────────────────────────────────────

router.post('/:id/submit', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (!['draft', 'rejected'].includes(pr.status)) {
    throw new ValidationError(`Only draft or rejected requisitions can be submitted (status: ${pr.status})`);
  }
  if (pr.sourcing_strategy === 'CONTRACT_BASED' && !pr.contract_id) {
    throw new ValidationError('A contract must be selected for contract-based sourcing');
  }

  // Everything below is one transaction — submit touches line approval
  // flags, a new workflow instance (and possibly its full finalize/auto-PO
  // chain), the PR's own status, and the audit log; a failure partway
  // through previously left whichever of those had already run committed
  // even though the submit as a whole reported failure.
  let responsePayload;
  await withTransaction(async (conn) => {
    const lineItems = await fetchPrLineItems(pr.id, conn);
    const totalValue = lineItems.reduce((sum, li) => sum + Number(li.estimated_total_price || 0), 0);

    const threshold = Number(await getSetting('pr_rfq_threshold_value', '500000', conn));
    if (totalValue > threshold && pr.sourcing_strategy !== 'RFQ_REQUIRED') {
      throw new ValidationError(`Value ${totalValue} exceeds the RFQ threshold (${threshold}) — RFQ sourcing is required for this requisition`);
    }

    const budget = await computeBudgetStatus(pr.cost_center, totalValue, conn);
    const enforcement = await getSetting('pr_budget_enforcement', 'soft', conn);
    if (budget.budget_status === 'exceeds_budget' && enforcement === 'hard') {
      throw new ValidationError(`Requisition value ${totalValue} exceeds the remaining budget (${budget.remaining_amount}) for cost center ${pr.cost_center}`);
    }
    // Exception Management Engine: tracked separately from the hard-stop above —
    // a soft-enforced breach still goes through, but must stay visible until resolved.
    await detectBudgetBreach(pr, budget, totalValue, conn);

    // Decision Engine (Module 6) — admin-configurable rules layered on top of
    // the hardcoded budget/threshold checks above; a no-op until an admin
    // actually defines a decision_rules row for the 'pr' module.
    await evaluateDecisionRules('pr', {
      record_id: pr.id, total_value: totalValue, cost_center: pr.cost_center,
      budget_remaining_pct: budget.remaining_amount != null && Number(budget.allocated_amount) > 0
        ? Math.round((Number(budget.remaining_amount) / Number(budget.allocated_amount)) * 10000) / 100 : null,
      sourcing_strategy: pr.sourcing_strategy,
    }, conn);

    // Line-Level Approval: re-evaluated fresh on every submit (a snapshot, like
    // the RFQ threshold check above) — also resets any prior line decisions,
    // since editing and resubmitting a rejected/draft PR should start review clean.
    for (const li of lineItems) {
      const requiresApproval = await determineLineApprovalRequirement(li, conn);
      await conn.query(
        "UPDATE pr_line_items SET requires_line_approval = ?, approval_status = 'pending', approved_by = NULL, approved_at = NULL, rejection_remarks = NULL WHERE id = ?",
        [requiresApproval, li.id]
      );
    }

    const rule = await resolveApprovalRule({ ...pr, total_value: totalValue }, conn);

    // Workflow Engine: conditional steps (value/category/vendor risk) evaluate
    // against this context — document_type doubles as "category" (it's the
    // same spend-category dimension pr_approval_rules already conditions
    // workflow *selection* on), and vendor risk comes from whatever vendor is
    // already on file, if any.
    let vendorRiskLevel = null;
    if (pr.preferred_vendor_id) {
      const [[riskRow]] = await conn.query('SELECT risk_level FROM vendor_risk_scores WHERE vendor_id = ?', [pr.preferred_vendor_id]);
      vendorRiskLevel = riskRow?.risk_level || null;
    }
    const workflowContext = { total_value: totalValue, category: pr.document_type, vendor_risk_level: vendorRiskLevel };

    const { instance_id: instanceId, final } = await createWorkflowInstance(rule.workflow_id, 'purchase_requisition', pr.id, req.user.id, workflowContext, conn);

    await conn.query(
      `UPDATE purchase_requisitions
       SET status = 'submitted', total_value = ?, budget_status = ?, approval_workflow_id = ?, workflow_instance_id = ?
       WHERE id = ?`,
      [totalValue, budget.budget_status, rule.workflow_id, instanceId, pr.id]
    );

    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
      [uuidv4(), pr.id, 'submitted', req.user.id]
    );

    // Workflow Engine: every step on the resolved workflow was conditional and
    // none applied to this requisition's context (e.g. all value-gated above
    // what this PR is worth) — the instance already resolved itself with no
    // human sign-off needed. Finalize immediately rather than leaving the
    // requisition stuck at 'submitted' with no active step to approve against.
    // If any line still needs individual review, leave it at 'submitted' —
    // resolving the last such line is itself what finalizes it (see
    // PUT /:id/lines/:lineId/approve|reject below).
    if (final) {
      const blocking = await getBlockingLineItems(pr.id, conn);
      if (blocking.length === 0) {
        const prForFinalize = { ...pr, total_value: totalValue };
        const { finalResult, poResult } = await finalizeRequisition(prForFinalize, req.user.id, conn);
        await conn.query(
          'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), pr.id, finalResult.final_status === 'rejected' ? 'rejected' : 'approved', req.user.id, 'No approval steps applied to this requisition — auto-resolved']
        );
        responsePayload = {
          message: `Requisition submitted — no approval steps applied, auto-${finalResult.final_status}`,
          data: { workflow_instance_id: instanceId, budget_status: budget.budget_status, final_status: finalResult.final_status, po: poResult },
        };
        return;
      }
    }

    responsePayload = { message: 'Requisition submitted for approval', data: { workflow_instance_id: instanceId, budget_status: budget.budget_status } };
  });

  res.json({ success: true, ...responsePayload });
}));

// ─── Approve ─────────────────────────────────────────────────────────────

router.post('/:id/approve', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);
  if (!pr.workflow_instance_id) throw new NotFoundError('Workflow instance not found');

  // One transaction — recording the step decision, finalizing the
  // requisition (status + budget commit/release), and auto-creating a PO are
  // all part of the same logical "approve" action; a failure partway through
  // previously left whichever step had already run committed regardless.
  let result;
  await withTransaction(async (conn) => {
    const [[instance]] = await conn.query('SELECT current_step_id FROM workflow_instances WHERE id = ?', [pr.workflow_instance_id]);
    if (!instance?.current_step_id) throw new NotFoundError('Workflow instance has no active step');
    const currentStepId = instance.current_step_id;

    // Line-Level Approval: if this approval would finalize the requisition's
    // sign-off chain (no other parallel approval pending in this wave, no
    // further applicable step after it — Workflow Engine's conditional/
    // parallel logic both factor in here), every line flagged for individual
    // review must already be resolved. Checked BEFORE recording the decision
    // so a blocked finalization never leaves a half-recorded approval behind.
    if (await wouldFinalizeOnApproval(pr.workflow_instance_id, currentStepId, conn)) {
      const blocking = await getBlockingLineItems(pr.id, conn);
      if (blocking.length > 0) {
        throw new ValidationError(
          `${blocking.length} line item(s) require individual approval before this requisition can be finalized — use line-level approve/reject first`,
          blocking.map(l => l.id)
        );
      }
    }

    const decision = await recordStepDecision(pr.workflow_instance_id, currentStepId, req.user.id, req.user.role, 'approve', req.body.remarks, conn);

    if (!decision.final) {
      const message = decision.wave_remaining
        ? `Recorded — ${decision.wave_remaining} parallel approval(s) still pending in this wave`
        : 'Advanced to next approval step';
      await conn.query(
        'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), pr.id, 'approved', req.user.id, message]
      );
      result = { message };
      return;
    }

    // decision.final === true — the workflow's sign-off chain is complete.
    // Budget Commitment Model: stage 1 — earmark the approved lines' value the
    // moment finalization happens, before any PO exists. Released back as each
    // line converts to a PO (see createPoFromPr below). finalizePrApproval sets
    // the requisition's final status itself — 'approved', 'partially_approved',
    // or 'rejected' (every line rejected) — and commits budget only for the
    // lines that were actually approved.
    const { finalResult, poResult } = await finalizeRequisition(pr, req.user.id, conn);
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [
        uuidv4(), pr.id, finalResult.final_status === 'rejected' ? 'rejected' : 'approved', req.user.id,
        finalResult.final_status === 'partially_approved' ? `Partially approved — ${finalResult.rejected_count} line(s) rejected` : null,
      ]
    );

    if (finalResult.final_status === 'rejected') {
      result = { message: 'All line items rejected — requisition rejected', data: finalResult };
      return;
    }
    if (poResult) {
      result = { message: 'Requisition approved — PO auto-created', data: poResult };
      return;
    }
    result = {
      message: finalResult.final_status === 'partially_approved' ? 'Requisition partially approved' : 'Requisition approved',
      data: finalResult,
    };
  });

  res.json({
    success: true,
    ...result,
  });
}));

// ─── Reject ──────────────────────────────────────────────────────────────

router.post('/:id/reject', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) throw new ValidationError('Rejection remarks are required', ['remarks']);

  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);
  if (!pr.workflow_instance_id) throw new NotFoundError('Workflow instance not found');

  await withTransaction(async (conn) => {
    const [[instance]] = await conn.query('SELECT current_step_id FROM workflow_instances WHERE id = ?', [pr.workflow_instance_id]);
    if (!instance?.current_step_id) throw new NotFoundError('Workflow instance has no active step');

    await recordStepDecision(pr.workflow_instance_id, instance.current_step_id, req.user.id, req.user.role, 'reject', remarks, conn);
    await conn.query("UPDATE purchase_requisitions SET status = 'rejected', rejection_reason = ? WHERE id = ?", [remarks || null, pr.id]);
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'rejected', req.user.id, remarks || null]
    );
  });

  res.json({ success: true, message: 'Requisition rejected' });
}));

// ─── Close (manual closure, with a reason, without further processing) ───
// Distinct from Reject (pre-approval only, ends the workflow step itself)
// and from the automatic closure refreshPrStatusAfterConsumption already
// applies once every line has been fully allocated to an RFQ/PO — this is
// for a requisition that simply won't be carried any further at all, at any
// point in its life (the need went away, raised in error, superseded by
// another PR, etc.), with a mandatory reason for the audit trail. Already-
// terminal requisitions (closed/rejected) can't be closed again.
router.post('/:id/close', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) throw new ValidationError('Closure reason is required', ['reason']);

  const pr = await getPrOrThrow(req.params.id);
  if (['closed', 'rejected'].includes(pr.status)) {
    throw new ValidationError(`Requisition is already ${pr.status}`);
  }

  await withTransaction(async (conn) => {
    // Budget committed at approval (see finalizePrApproval) would otherwise sit
    // stuck against the cost center forever if this PR never converts to a PO.
    if (['approved', 'partially_approved', 'sourcing'].includes(pr.status)) {
      const [[{ approvedValue }]] = await conn.query(
        "SELECT COALESCE(SUM(estimated_total_price), 0) as approvedValue FROM pr_line_items WHERE pr_id = ? AND approval_status = 'approved'",
        [pr.id]
      );
      await releaseCommitment(pr.cost_center, approvedValue, conn);
    }

    // A 'submitted' PR closed mid-approval still has a live workflow instance —
    // cancel it so the SLA escalation sweep stops flagging a pending step that
    // will now never be acted on.
    if (pr.status === 'submitted' && pr.workflow_instance_id) {
      await conn.query("UPDATE workflow_instances SET status = 'cancelled', completed_at = NOW() WHERE id = ?", [pr.workflow_instance_id]);
    }

    await conn.query(
      "UPDATE purchase_requisitions SET status = 'closed', closure_reason = ?, closed_by = ?, closed_at = NOW() WHERE id = ?",
      [reason, req.user.id, pr.id]
    );
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'closed', req.user.id, reason]
    );
  });

  res.json({ success: true, message: 'Requisition closed' });
}));

// ─── Line-Level Approval ─────────────────────────────────────────────────
// Approve or reject an individual line item. Lines flagged by
// requires_line_approval (set at submit time from the pr_line_approval_value_
// threshold / pr_line_approval_categories settings — see
// determineLineApprovalRequirement in pr.helpers.js) must each be resolved
// this way before the final workflow step's /approve can finalize the
// requisition. A rejected line is permanently excluded from sourcing
// (resolvePrLineSelections enforces this) and the requisition's own status
// becomes 'partially_approved' if some — but not all — lines end up rejected.

router.put('/:id/lines/:lineId/approve', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);

  let result;
  await withTransaction(async (conn) => {
    const instance = await assertCurrentStepApprover(pr, req.user, conn);

    const [[line]] = await conn.query('SELECT * FROM pr_line_items WHERE id = ? AND pr_id = ?', [req.params.lineId, pr.id]);
    if (!line) throw new NotFoundError('Line item not found on this requisition');
    if (line.approval_status !== 'pending') throw new ValidationError(`Line item is already ${line.approval_status}`);

    await conn.query(
      "UPDATE pr_line_items SET approval_status = 'approved', approved_by = ?, approved_at = NOW(), rejection_remarks = NULL WHERE id = ?",
      [req.user.id, line.id]
    );
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'line_approved', req.user.id, line.description]
    );

    const autoFinalized = await maybeAutoFinalizeAfterLineDecision(pr, instance, req.user.id, conn);
    if (autoFinalized) {
      await conn.query(
        'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), pr.id, autoFinalized.finalResult.final_status === 'rejected' ? 'rejected' : 'approved', req.user.id, 'Last line item resolved — requisition auto-finalized']
      );
      result = { message: 'Line item approved — requisition finalized', data: autoFinalized };
      return;
    }
    result = { message: 'Line item approved' };
  });

  res.json({ success: true, ...result });
}));

router.put('/:id/lines/:lineId/reject', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) throw new ValidationError('Rejection remarks are required', ['remarks']);

  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);

  let result;
  await withTransaction(async (conn) => {
    const instance = await assertCurrentStepApprover(pr, req.user, conn);

    const [[line]] = await conn.query('SELECT * FROM pr_line_items WHERE id = ? AND pr_id = ?', [req.params.lineId, pr.id]);
    if (!line) throw new NotFoundError('Line item not found on this requisition');
    if (line.approval_status !== 'pending') throw new ValidationError(`Line item is already ${line.approval_status}`);

    await conn.query(
      "UPDATE pr_line_items SET approval_status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_remarks = ? WHERE id = ?",
      [req.user.id, remarks, line.id]
    );
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'line_rejected', req.user.id, `${line.description}: ${remarks}`]
    );

    const autoFinalized = await maybeAutoFinalizeAfterLineDecision(pr, instance, req.user.id, conn);
    if (autoFinalized) {
      await conn.query(
        'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), pr.id, autoFinalized.finalResult.final_status === 'rejected' ? 'rejected' : 'approved', req.user.id, 'Last line item resolved — requisition auto-finalized']
      );
      result = { message: 'Line item rejected — requisition finalized', data: autoFinalized };
      return;
    }
    result = { message: 'Line item rejected' };
  });

  res.json({ success: true, ...result });
}));

// ─── Create RFQ from PR ──────────────────────────────────────────────────

router.post('/:id/create-rfq', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (!['approved', 'sourcing'].includes(pr.status)) {
    throw new ValidationError(`Requisition must be approved before creating an RFQ (status: ${pr.status})`);
  }
  if (pr.sourcing_strategy === 'CONTRACT_BASED') {
    throw new ValidationError('Contract-based requisitions skip RFQ sourcing — use Create PO instead');
  }

  const { vendor_ids, submission_deadline, lines, title } = req.body;
  const missing = [];
  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) missing.push('vendor_ids');
  if (!submission_deadline) missing.push('submission_deadline');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  let rfqId, rfqNumber;
  await withTransaction(async (conn) => {
    const selections = await resolvePrLineSelections(pr.id, lines, conn);
    if (selections.length === 0) throw new ValidationError('No remaining quantity is available to source');

    rfqId = uuidv4();
    rfqNumber = await autoRfqNumber(conn);

    await conn.query(
      `INSERT INTO rfqs (id, rfq_number, title, description, created_by, submission_deadline, pr_id, transaction_chain_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rfqId, rfqNumber, title || `Sourcing for ${pr.pr_number}`, pr.justification, req.user.id, new Date(submission_deadline), pr.id, pr.transaction_chain_id || pr.id]
    );

    for (const vendorId of vendor_ids) {
      await conn.query('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), rfqId, vendorId]);
    }

    for (let i = 0; i < selections.length; i++) {
      const li = selections[i];
      const rfqLineId = uuidv4();
      await conn.query(
        `INSERT INTO rfq_line_items (id, rfq_id, item_master_id, item_description, quantity, uom, target_price, sequence, pr_line_item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rfqLineId, rfqId, li.item_master_id || null, li.description, li.chosenQty, li.uom, li.estimated_unit_price || null, i + 1, li.id]
      );
      await recordMapping('PR', li.id, 'RFQ', rfqLineId, li.chosenQty, req.user.id, conn);
      await refreshPrLineRemaining(li.id, conn);
    }

    // Quantity is reserved the moment it's sent to RFQ, so the PR can already
    // be fully allocated (closed) even before this RFQ is ever awarded.
    await refreshPrStatusAfterConsumption(pr.id, conn);
    await conn.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'converted_to_rfq', req.user.id, rfqNumber]
    );
  });

  res.status(201).json({ success: true, data: { rfq_id: rfqId, rfq_number: rfqNumber } });
}));

// ─── Create PO from PR ───────────────────────────────────────────────────

router.post('/:id/create-po', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (!['approved', 'sourcing'].includes(pr.status)) {
    throw new ValidationError(`Requisition must be approved before creating a PO (status: ${pr.status})`);
  }
  if (pr.sourcing_strategy === 'RFQ_REQUIRED') {
    throw new ValidationError('Direct PO is not allowed for this requisition — RFQ sourcing is required');
  }

  const { lines } = req.body;
  let vendorId = req.body.vendor_id || null;
  const poOpts = { actorId: req.user.id };

  let result;
  await withTransaction(async (conn) => {
    if (pr.sourcing_strategy === 'CONTRACT_BASED') {
      if (!pr.contract_id) throw new ValidationError('No contract is linked to this requisition');
      // Active/validity/remaining-value enforcement happens inside
      // createPoFromPr (assertContractUsable), once the PO's total amount is
      // actually known — this just resolves the vendor and pass-through terms.
      const contract = await getContractOrThrow(pr.contract_id, conn);
      vendorId = contract.vendor_id;
      poOpts.contract_id = contract.id;
      poOpts.terms_of_payment = contract.payment_terms;
      poOpts.default_unit_price = contract.default_unit_price;
    } else if (pr.sourcing_strategy === 'AUTO_PO') {
      vendorId = vendorId || pr.preferred_vendor_id;
      if (!vendorId) throw new ValidationError('No vendor available — set a preferred vendor on the requisition or supply vendor_id');
    } else if (pr.sourcing_strategy === 'DIRECT_PO_ALLOWED' && !vendorId) {
      throw new ValidationError('Missing required field', ['vendor_id']);
    }

    const selections = await resolvePrLineSelections(pr.id, lines, conn);
    if (selections.length === 0) throw new ValidationError('No remaining quantity is available to order');

    result = await createPoFromPr(pr, selections, vendorId, poOpts, conn);
  });
  res.status(201).json({ success: true, data: result });
}));

// ─── Document flow ───────────────────────────────────────────────────────

router.get('/:id/document-flow', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  const lineItems = await fetchPrLineItems(pr.id);
  const lineIds = lineItems.map(li => li.id);

  if (lineIds.length === 0) return res.json({ success: true, data: { rfqs: [], purchase_orders: [] } });

  const placeholders = lineIds.map(() => '?').join(',');

  // mapped_quantity per target line — exact quantity handed over at that hop,
  // not just "this document touches this PR" (PR→RFQ for rfq lines, either
  // PR→PO or RFQ→PO for po lines, depending on whether RFQ sourcing was used).
  async function attachMappedQuantity(rows, targetDocType) {
    for (const row of rows) {
      const [[m]] = await pool.query(
        'SELECT COALESCE(SUM(mapped_quantity), 0) as mapped FROM document_flow_mapping WHERE target_doc_type = ? AND target_line_id = ?',
        [targetDocType, row.id]
      );
      row.mapped_quantity = Number(m.mapped);
    }
    return rows;
  }

  const [rfqIdRows] = await pool.query(
    `SELECT DISTINCT rfq_id FROM rfq_line_items WHERE pr_line_item_id IN (${placeholders})`,
    lineIds
  );
  const rfqs = [];
  for (const { rfq_id } of rfqIdRows) {
    const [[rfq]] = await pool.query('SELECT id, rfq_number, status, submission_deadline FROM rfqs WHERE id = ?', [rfq_id]);
    const [lines] = await pool.query(
      `SELECT * FROM rfq_line_items WHERE rfq_id = ? AND pr_line_item_id IN (${placeholders})`,
      [rfq_id, ...lineIds]
    );
    rfqs.push({ ...rfq, line_items: await attachMappedQuantity(lines, 'RFQ') });
  }

  const [poIdRows] = await pool.query(
    `SELECT DISTINCT po_id FROM po_line_items WHERE pr_line_item_id IN (${placeholders})`,
    lineIds
  );
  const purchaseOrders = [];
  for (const { po_id } of poIdRows) {
    const [[po]] = await pool.query('SELECT id, po_number, status, total_amount, vendor_id FROM purchase_orders WHERE id = ?', [po_id]);
    const [lines] = await pool.query(
      `SELECT * FROM po_line_items WHERE po_id = ? AND pr_line_item_id IN (${placeholders})`,
      [po_id, ...lineIds]
    );
    purchaseOrders.push({ ...po, line_items: await attachMappedQuantity(lines, 'PO') });
  }

  res.json({ success: true, data: { rfqs, purchase_orders: purchaseOrders } });
}));

// ─── Allocation — per-line remaining qty + mapping breakdown ──────────────

router.get('/:id/allocation', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  const lineItems = await fetchPrLineItems(pr.id);

  const lines = [];
  for (const li of lineItems) {
    const [mappings] = await pool.query(
      `SELECT dfm.target_doc_type, dfm.target_line_id, dfm.mapped_quantity, dfm.created_at,
         CASE dfm.target_doc_type
           WHEN 'RFQ' THEN (SELECT r.rfq_number FROM rfq_line_items rli JOIN rfqs r ON rli.rfq_id = r.id WHERE rli.id = dfm.target_line_id)
           WHEN 'PO' THEN (SELECT po.po_number FROM po_line_items pli JOIN purchase_orders po ON pli.po_id = po.id WHERE pli.id = dfm.target_line_id)
         END as target_document_number
       FROM document_flow_mapping dfm
       WHERE dfm.source_doc_type = 'PR' AND dfm.source_line_id = ?
       ORDER BY dfm.created_at`,
      [li.id]
    );
    const mapped = mappings.reduce((sum, m) => sum + Number(m.mapped_quantity), 0);
    lines.push({
      pr_line_item_id: li.id,
      description: li.description,
      uom: li.uom,
      estimated_unit_price: li.estimated_unit_price != null ? Number(li.estimated_unit_price) : null,
      quantity: Number(li.quantity),
      mapped_quantity: mapped,
      remaining_quantity: Number(li.quantity) - mapped,
      mappings,
    });
  }

  res.json({ success: true, data: { pr_id: pr.id, pr_number: pr.pr_number, lines } });
}));

// ─── Audit log ────────────────────────────────────────────────────────────

router.get('/:id/audit-log', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  await getPrOrThrow(req.params.id);
  const [rows] = await pool.query(
    `SELECT l.*, u.full_name as actor_name, u.email as actor_email
     FROM pr_audit_log l LEFT JOIN users u ON l.actor_id = u.id
     WHERE l.pr_id = ? ORDER BY l.created_at`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

// ─── PDF ──────────────────────────────────────────────────────────────────

router.get('/:id/pdf', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  const lineItems = await fetchPrLineItems(pr.id);
  const [[requester]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [pr.requester_id]);

  let approvalLogs = [];
  if (pr.workflow_instance_id) {
    const [logs] = await pool.query(
      `SELECT l.action, l.remarks, l.created_at, s.step_name, u.full_name as actor_name, u.email as actor_email
       FROM workflow_logs l LEFT JOIN workflow_steps s ON l.step_id = s.id LEFT JOIN users u ON l.actor_id = u.id
       WHERE l.instance_id = ? ORDER BY l.created_at`,
      [pr.workflow_instance_id]
    );
    approvalLogs = logs;
  }

  const doc = newDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pr.pr_number}.pdf"`);
  doc.pipe(res);

  // Multi-company: render company details at the top if company_id is set
  const company = await getCompanyDetails(pr.company_id);
  const companyStartY = drawCompanyDetailsBlock(doc, company);

  let y = drawDocumentHeader(doc, {
    companyName: company ? company.company_name : (pr.company_code || 'ProcureTrack'),
    companyLine: company ? (pr.plant ? `Plant: ${pr.plant}` : undefined) : (pr.plant ? `Plant: ${pr.plant}` : undefined),
    title: 'PURCHASE REQUISITION',
    startY: company ? companyStartY : undefined,
    fields: [
      ['PR Number', pr.pr_number],
      ['Date Raised', fmtDate(pr.created_at)],
      ['Required By', fmtDate(pr.required_date)],
      ['Status', (pr.status || '').replace('_', ' ').toUpperCase()],
    ],
  });

  y = drawTwoColumnBlock(doc, y,
    { title: 'Requisition Details', rows: [
      ['Department', pr.department], ['Cost Center', pr.cost_center], ['Project Code', pr.project_code],
      ['Account Assignment', pr.account_assignment_category], ['Document Type', pr.document_type],
    ] },
    { title: 'Requester', rows: [
      ['Requested By', requester?.full_name || requester?.email], ['Priority', pr.priority],
      ['Sourcing Strategy', (pr.sourcing_strategy || '').replace(/_/g, ' ')], ['Budget Status', (pr.budget_status || '').replace('_', ' ')],
    ] }
  );

  y = drawSectionTitle(doc, y, 'Justification');
  doc.fontSize(8.5).font('Helvetica').fillColor('#444444').text(pr.justification || '—', MARGIN, y, { width: CONTENT_WIDTH });
  y = doc.y + 10;

  y = drawSectionTitle(doc, y, 'Line Items');
  y = drawTable(doc, y, {
    columns: [
      { title: '#', width: 24, align: 'center' },
      { title: 'Description', width: 220 },
      { title: 'Qty', width: 55, align: 'right' },
      { title: 'UOM', width: 50 },
      { title: 'Est. Unit Price', width: 80, align: 'right' },
      { title: 'Est. Total', width: 71, align: 'right' },
    ],
    rows: lineItems.map((li, i) => [
      i + 1, li.description, Number(li.quantity).toLocaleString(), li.uom || '—',
      li.estimated_unit_price != null ? fmtMoney(li.estimated_unit_price, pr.currency) : '—',
      li.estimated_total_price != null ? fmtMoney(li.estimated_total_price, pr.currency) : '—',
    ]),
  });

  y = drawTotalsBlock(doc, y, [
    ['Total Estimated Value', fmtMoney(pr.total_value, pr.currency), true],
  ]);

  if (approvalLogs.length > 0) {
    y = drawSectionTitle(doc, y, 'Approval Trail');
    y = drawTable(doc, y, {
      columns: [
        { title: 'Step', width: 140 },
        { title: 'Action', width: 80 },
        { title: 'By', width: 150 },
        { title: 'Remarks', width: 95 },
        { title: 'Date', width: 70, align: 'right' },
      ],
      rows: approvalLogs.map(l => [
        l.step_name || '—', (l.action || '').toUpperCase(), l.actor_name || l.actor_email || 'system',
        l.remarks || '—', fmtDate(l.created_at),
      ]),
    });
  }

  y = drawSignatureBlock(doc, y, `Requested By\n${requester?.full_name || requester?.email || ''}`, 'Approved By\nAuthorized Signatory');
  drawFooterNote(doc, `Generated electronically by ProcureTrack on ${fmtDate(new Date())} — ${pr.pr_number} — Internal document, not for external distribution`);

  doc.end();
}));

module.exports = router;
