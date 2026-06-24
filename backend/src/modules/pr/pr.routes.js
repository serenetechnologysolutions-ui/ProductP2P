const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
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
  consumeBudget,
} = require('./pr.helpers');
const {
  newDocument, fmtMoney, fmtDate, drawDocumentHeader, drawTwoColumnBlock, drawFieldGrid,
  drawSectionTitle, drawTable, drawTotalsBlock, drawSignatureBlock, drawFooterNote, MARGIN, CONTENT_WIDTH,
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

async function fetchPrLineItems(prId) {
  const [rows] = await pool.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY sequence', [prId]);
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
async function resolvePrLineSelections(prId, lines) {
  const allLines = await fetchPrLineItems(prId);
  const selections = [];

  if (lines && Array.isArray(lines) && lines.length > 0) {
    for (const sel of lines) {
      const li = allLines.find(l => l.id === sel.pr_line_item_id);
      if (!li) throw new ValidationError(`Line ${sel.pr_line_item_id} does not belong to this requisition`);
      const remaining = Number(li.quantity) - (await getMappedQuantity('PR', li.id));
      const qty = Number(sel.quantity);
      if (!qty || qty <= 0) throw new ValidationError(`Quantity for "${li.description}" must be greater than zero`);
      if (qty > remaining) throw new ValidationError(`Quantity for "${li.description}" exceeds the remaining requisition quantity (${remaining})`);
      selections.push({ ...li, chosenQty: qty, chosenUnitPrice: sel.unit_price != null ? Number(sel.unit_price) : Number(li.estimated_unit_price || 0) });
    }
  } else {
    for (const li of allLines) {
      const remaining = Number(li.quantity) - (await getMappedQuantity('PR', li.id));
      if (remaining > 0) selections.push({ ...li, chosenQty: remaining, chosenUnitPrice: Number(li.estimated_unit_price || 0) });
    }
  }

  return selections;
}

// Creates a PO from a set of PR line items — shared by the manual create-po
// route and the AUTO_PO auto-trigger fired from approve().
async function createPoFromPr(pr, lineItems, vendorId, opts = {}) {
  const poId = uuidv4();
  const poNumber = await autoPONumber();
  const totalAmount = lineItems.reduce((sum, li) => sum + Number(li.chosenQty) * Number(li.chosenUnitPrice ?? li.estimated_unit_price ?? 0), 0);

  await pool.query(
    `INSERT INTO purchase_orders
      (id, po_number, vendor_id, total_amount, pr_id, department, account_assignment_category, company_code, plant, requester_id, contract_id, terms_of_payment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poId, poNumber, vendorId, totalAmount, pr.id, pr.department, pr.account_assignment_category,
      pr.company_code || null, pr.plant || null, pr.requester_id, opts.contract_id || null, opts.terms_of_payment || null,
    ]
  );

  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const unitPrice = Number(li.chosenUnitPrice ?? li.estimated_unit_price ?? 0);
    const amount = Number(li.chosenQty) * unitPrice;
    const poLineId = uuidv4();
    await pool.query(
      `INSERT INTO po_line_items (id, po_id, line_number, description, quantity, uom, unit_price, amount, pr_line_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poLineId, poId, i + 1, li.description, li.chosenQty, li.uom, unitPrice, amount, li.id]
    );
    await recordMapping('PR', li.id, 'PO', poLineId, li.chosenQty, opts.actorId);
    await refreshPrLineRemaining(li.id);
  }

  await refreshPrStatusAfterConsumption(pr.id);
  await consumeBudget(pr.cost_center, totalAmount);
  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), pr.id, 'converted_to_po', opts.actorId || pr.requester_id, poNumber]
  );

  return { po_id: poId, po_number: poNumber };
}

// ─── List ────────────────────────────────────────────────────────────────

router.get('/', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { status, department, priority, sourcing_strategy, document_type } = req.query;
  let sql = `
    SELECT pr.*, u.full_name as requester_name,
      (SELECT COUNT(*) FROM pr_line_items WHERE pr_id = pr.id) as item_count,
      s.approver_role as current_approver_role, s.step_name as current_step_name
    FROM purchase_requisitions pr
    LEFT JOIN users u ON pr.requester_id = u.id
    LEFT JOIN workflow_instances wi ON pr.workflow_instance_id = wi.id
    LEFT JOIN workflow_steps s ON wi.current_step_id = s.id
    WHERE 1=1`;
  const params = [];
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

router.post('/', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const {
    document_type, company_code, plant, department, cost_center, project_code,
    account_assignment_category, currency, required_date, priority, justification,
    sourcing_strategy, preferred_vendor_id, contract_id, line_items,
  } = req.body;

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
  const prNumber = await autoPRNumber();
  const totalValue = line_items.reduce((sum, item) => sum + computeLineTotal(item), 0);

  await pool.query(
    `INSERT INTO purchase_requisitions
      (id, pr_number, document_type, company_code, plant, department, requester_id, cost_center, project_code,
       account_assignment_category, currency, required_date, priority, justification, sourcing_strategy,
       preferred_vendor_id, contract_id, total_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prId, prNumber, document_type || 'Standard', company_code || null, plant || null, department, req.user.id,
      cost_center || null, project_code || null, account_assignment_category || 'Cost Center', currency || 'INR',
      required_date || null, priority || 'Medium', justification, sourcing_strategy || 'RFQ_REQUIRED',
      preferred_vendor_id || null, contract_id || null, totalValue,
    ]
  );

  for (let i = 0; i < line_items.length; i++) {
    const item = line_items[i];
    const lineTotal = computeLineTotal(item);
    await pool.query(
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

  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), prId, 'created', req.user.id]
  );

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

// ─── Edit (allowed at any status, up until a PO has been created) ───────
// A requisition can be edited right up to the moment a PO actually exists
// against any of its lines (directly, or via an awarded RFQ) — after that
// it's locked. Line items are updated in place by id (not delete+recreate)
// so an RFQ already created from a line keeps a valid pr_line_item_id and
// the document_flow_mapping ledger stays correct. A line can only be removed,
// and its quantity only reduced, down to what hasn't already been sent to an
// RFQ or PO.

router.put('/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  const existingLines = await fetchPrLineItems(pr.id);

  if (existingLines.length > 0) {
    const lineIds = existingLines.map(l => l.id);
    const placeholders = lineIds.map(() => '?').join(',');
    const [[{ poCount }]] = await pool.query(
      `SELECT COUNT(*) as poCount FROM po_line_items WHERE pr_line_item_id IN (${placeholders})`,
      lineIds
    );
    if (poCount > 0) {
      throw new ValidationError('Cannot edit — a Purchase Order has already been created from this requisition');
    }
  }

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
  // Only a draft/rejected PR resets to draft on save — one already in or past
  // the approval workflow keeps its current status (editing it shouldn't
  // silently discard an in-flight or completed approval).
  const nextStatus = ['draft', 'rejected'].includes(pr.status) ? 'draft' : pr.status;

  await pool.query(
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
      const mapped = await getMappedQuantity('PR', existing.id);
      if (mapped > 0) {
        throw new ValidationError(`Cannot remove "${existing.description}" — it has already been sent to an RFQ or PO`);
      }
      await pool.query('DELETE FROM pr_line_items WHERE id = ?', [existing.id]);
    }
  }

  for (let i = 0; i < line_items.length; i++) {
    const item = line_items[i];
    if (!item.description || !item.quantity) throw new ValidationError(`Line item ${i + 1} missing description or quantity`);
    const lineTotal = computeLineTotal(item);
    const accountAssignmentDetails = item.account_assignment_details ? JSON.stringify(item.account_assignment_details) : null;

    if (item.id) {
      if (!existingLines.some(l => l.id === item.id)) throw new ValidationError(`Line item ${item.id} does not belong to this requisition`);
      const mapped = await getMappedQuantity('PR', item.id);
      if (Number(item.quantity) < mapped) {
        throw new ValidationError(`Quantity for "${item.description}" cannot be reduced below what's already been sent out (${mapped})`);
      }
      await pool.query(
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
      await pool.query(
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

  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), pr.id, 'edited', req.user.id]
  );

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

  const lineItems = await fetchPrLineItems(pr.id);
  const totalValue = lineItems.reduce((sum, li) => sum + Number(li.estimated_total_price || 0), 0);

  const threshold = Number(await getSetting('pr_rfq_threshold_value', '500000'));
  if (totalValue > threshold && pr.sourcing_strategy !== 'RFQ_REQUIRED') {
    throw new ValidationError(`Value ${totalValue} exceeds the RFQ threshold (${threshold}) — RFQ sourcing is required for this requisition`);
  }

  const budget = await computeBudgetStatus(pr.cost_center, totalValue);
  const enforcement = await getSetting('pr_budget_enforcement', 'soft');
  if (budget.budget_status === 'exceeds_budget' && enforcement === 'hard') {
    throw new ValidationError(`Requisition value ${totalValue} exceeds the remaining budget (${budget.remaining_amount}) for cost center ${pr.cost_center}`);
  }

  const rule = await resolveApprovalRule({ ...pr, total_value: totalValue });

  const [steps] = await pool.query('SELECT id FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order LIMIT 1', [rule.workflow_id]);
  const firstStepId = steps.length > 0 ? steps[0].id : null;

  const instanceId = uuidv4();
  await pool.query(
    'INSERT INTO workflow_instances (id, workflow_id, module_name, record_id, current_step_id, initiated_by) VALUES (?, ?, ?, ?, ?, ?)',
    [instanceId, rule.workflow_id, 'purchase_requisition', pr.id, firstStepId, req.user.id]
  );
  await pool.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), instanceId, firstStepId, 'started', req.user.id]
  );

  await pool.query(
    `UPDATE purchase_requisitions
     SET status = 'submitted', total_value = ?, budget_status = ?, approval_workflow_id = ?, workflow_instance_id = ?
     WHERE id = ?`,
    [totalValue, budget.budget_status, rule.workflow_id, instanceId, pr.id]
  );

  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), pr.id, 'submitted', req.user.id]
  );

  res.json({ success: true, message: 'Requisition submitted for approval', data: { workflow_instance_id: instanceId, budget_status: budget.budget_status } });
}));

// ─── Approve ─────────────────────────────────────────────────────────────

router.post('/:id/approve', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);

  const [instances] = await pool.query('SELECT * FROM workflow_instances WHERE id = ?', [pr.workflow_instance_id]);
  if (instances.length === 0) throw new NotFoundError('Workflow instance not found');
  const instance = instances[0];
  const currentStepId = instance.current_step_id;

  if (currentStepId && req.user.role !== 'mdm_admin') {
    const [[currentStep]] = await pool.query('SELECT approver_role FROM workflow_steps WHERE id = ?', [currentStepId]);
    if (currentStep && currentStep.approver_role !== req.user.role) {
      throw new AuthorizationError(`This step requires approver role '${currentStep.approver_role}'`);
    }
  }

  let nextStep = null;
  if (currentStepId) {
    const [[currentStepRow]] = await pool.query('SELECT step_order FROM workflow_steps WHERE id = ?', [currentStepId]);
    if (currentStepRow) {
      const [nextSteps] = await pool.query(
        'SELECT id FROM workflow_steps WHERE workflow_id = ? AND step_order > ? ORDER BY step_order LIMIT 1',
        [instance.workflow_id, currentStepRow.step_order]
      );
      if (nextSteps.length > 0) nextStep = nextSteps[0];
    }
  }

  await pool.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), instance.id, currentStepId, 'approved', req.user.id, req.body.remarks || null]
  );

  if (nextStep) {
    await pool.query('UPDATE workflow_instances SET current_step_id = ? WHERE id = ?', [nextStep.id, instance.id]);
    await pool.query(
      'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), pr.id, 'approved', req.user.id, 'Advanced to next approval step']
    );
    return res.json({ success: true, message: 'Advanced to next approval step' });
  }

  await pool.query("UPDATE workflow_instances SET status = 'approved', completed_at = NOW(), current_step_id = NULL WHERE id = ?", [instance.id]);
  await pool.query("UPDATE purchase_requisitions SET status = 'approved' WHERE id = ?", [pr.id]);
  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), pr.id, 'approved', req.user.id]
  );

  // AUTO_PO: if a preferred vendor is on file, the PO is created right away.
  if (pr.sourcing_strategy === 'AUTO_PO' && pr.preferred_vendor_id) {
    const selections = await resolvePrLineSelections(pr.id, null);
    if (selections.length > 0) {
      const result = await createPoFromPr({ ...pr, status: 'approved' }, selections, pr.preferred_vendor_id, { actorId: req.user.id });
      return res.json({ success: true, message: 'Requisition approved — PO auto-created', data: result });
    }
  }

  res.json({ success: true, message: 'Requisition approved' });
}));

// ─── Reject ──────────────────────────────────────────────────────────────

router.post('/:id/reject', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) throw new ValidationError('Rejection remarks are required', ['remarks']);

  const pr = await getPrOrThrow(req.params.id);
  if (pr.status !== 'submitted') throw new ValidationError(`Requisition is not awaiting approval (status: ${pr.status})`);

  const [instances] = await pool.query('SELECT * FROM workflow_instances WHERE id = ?', [pr.workflow_instance_id]);
  if (instances.length === 0) throw new NotFoundError('Workflow instance not found');
  const instance = instances[0];
  const currentStepId = instance.current_step_id;

  if (currentStepId && req.user.role !== 'mdm_admin') {
    const [[currentStep]] = await pool.query('SELECT approver_role FROM workflow_steps WHERE id = ?', [currentStepId]);
    if (currentStep && currentStep.approver_role !== req.user.role) {
      throw new AuthorizationError(`This step requires approver role '${currentStep.approver_role}'`);
    }
  }

  await pool.query("UPDATE workflow_instances SET status = 'rejected', completed_at = NOW() WHERE id = ?", [instance.id]);
  await pool.query(
    'INSERT INTO workflow_logs (id, instance_id, step_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), instance.id, currentStepId, 'rejected', req.user.id, remarks || null]
  );
  await pool.query("UPDATE purchase_requisitions SET status = 'rejected', rejection_reason = ? WHERE id = ?", [remarks || null, pr.id]);
  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), pr.id, 'rejected', req.user.id, remarks || null]
  );

  res.json({ success: true, message: 'Requisition rejected' });
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

  const selections = await resolvePrLineSelections(pr.id, lines);
  if (selections.length === 0) throw new ValidationError('No remaining quantity is available to source');

  const rfqId = uuidv4();
  const rfqNumber = await autoRfqNumber();

  await pool.query(
    `INSERT INTO rfqs (id, rfq_number, title, description, created_by, submission_deadline, pr_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rfqId, rfqNumber, title || `Sourcing for ${pr.pr_number}`, pr.justification, req.user.id, new Date(submission_deadline), pr.id]
  );

  for (const vendorId of vendor_ids) {
    await pool.query('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), rfqId, vendorId]);
  }

  for (let i = 0; i < selections.length; i++) {
    const li = selections[i];
    const rfqLineId = uuidv4();
    await pool.query(
      `INSERT INTO rfq_line_items (id, rfq_id, item_master_id, item_description, quantity, uom, target_price, sequence, pr_line_item_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rfqLineId, rfqId, li.item_master_id || null, li.description, li.chosenQty, li.uom, li.estimated_unit_price || null, i + 1, li.id]
    );
    await recordMapping('PR', li.id, 'RFQ', rfqLineId, li.chosenQty, req.user.id);
    await refreshPrLineRemaining(li.id);
  }

  // Quantity is reserved the moment it's sent to RFQ, so the PR can already
  // be fully allocated (closed) even before this RFQ is ever awarded.
  await refreshPrStatusAfterConsumption(pr.id);
  await pool.query(
    'INSERT INTO pr_audit_log (id, pr_id, action, actor_id, remarks) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), pr.id, 'converted_to_rfq', req.user.id, rfqNumber]
  );

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

  if (pr.sourcing_strategy === 'CONTRACT_BASED') {
    if (!pr.contract_id) throw new ValidationError('No contract is linked to this requisition');
    const [contracts] = await pool.query('SELECT * FROM contracts WHERE id = ?', [pr.contract_id]);
    if (contracts.length === 0) throw new NotFoundError('Linked contract not found');
    const contract = contracts[0];
    if (contract.status !== 'active') throw new ValidationError('Linked contract is not active');
    const today = new Date();
    if (today < new Date(contract.start_date) || today > new Date(contract.end_date)) {
      throw new ValidationError('Linked contract is outside its validity period');
    }
    vendorId = contract.vendor_id;
    poOpts.contract_id = contract.id;
    poOpts.terms_of_payment = contract.payment_terms;
  } else if (pr.sourcing_strategy === 'AUTO_PO') {
    vendorId = vendorId || pr.preferred_vendor_id;
    if (!vendorId) throw new ValidationError('No vendor available — set a preferred vendor on the requisition or supply vendor_id');
  } else if (pr.sourcing_strategy === 'DIRECT_PO_ALLOWED' && !vendorId) {
    throw new ValidationError('Missing required field', ['vendor_id']);
  }

  const selections = await resolvePrLineSelections(pr.id, lines);
  if (selections.length === 0) throw new ValidationError('No remaining quantity is available to order');

  const result = await createPoFromPr(pr, selections, vendorId, poOpts);
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

  let y = drawDocumentHeader(doc, {
    companyName: pr.company_code || 'ProcureTrack',
    companyLine: pr.plant ? `Plant: ${pr.plant}` : undefined,
    title: 'PURCHASE REQUISITION',
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
