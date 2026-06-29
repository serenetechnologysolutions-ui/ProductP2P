const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError, AuthorizationError, ConflictError } = require('../../common/errors');

// PO Versioning: every amendment is propose -> approve/reject. A proposal
// computes a JSON diff (change_log) against the PO's current state and
// stores the full proposed state (snapshot) in a new po_versions row with
// status='pending_approval' — nothing on the live purchase_orders/
// po_line_items rows changes until that proposal is approved. Only header
// commercial terms and existing line items' commercial fields are amendable
// here (not adding/removing lines or changing the vendor) — keeps the diff
// model bounded and avoids touching the document_flow_mapping/ASN
// consumption logic that's keyed off existing po_line_items ids.

const AMENDABLE_HEADER_FIELDS = [
  'total_amount', 'validity_date', 'terms_of_payment', 'incoterms',
  'partial_delivery_allowed_flag', 'retention_percentage', 'delivery_schedule_json',
];
const AMENDABLE_LINE_FIELDS = ['description', 'quantity', 'unit_price', 'hsn_sac', 'tax_percent'];

// ─── GST + HSN validation ───────────────────────────────────────────────────
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const HSN_SAC_REGEX = /^\d{4}(\d{2}){0,2}$/; // 4, 6, or 8 digits

function validateGstHsn({ gstin, line_items }) {
  const invalid = [];
  if (gstin != null && gstin !== '' && !GSTIN_REGEX.test(String(gstin).toUpperCase())) {
    invalid.push('gstin');
  }
  (line_items || []).forEach((li, i) => {
    if (li.hsn_sac != null && li.hsn_sac !== '' && !HSN_SAC_REGEX.test(String(li.hsn_sac))) {
      invalid.push(`line_items[${i}].hsn_sac`);
    }
  });
  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid GST/HSN format: ${invalid.join(', ')}. GSTIN must be a valid 15-character GSTIN; HSN/SAC must be 4, 6, or 8 digits.`,
      invalid
    );
  }
}

// ─── Diffing ─────────────────────────────────────────────────────────────────

function diffHeader(before, after) {
  const changes = {};
  for (const field of AMENDABLE_HEADER_FIELDS) {
    const beforeVal = before[field] ?? null;
    const afterVal = after[field] ?? null;
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes[field] = { from: beforeVal, to: afterVal };
    }
  }
  return changes;
}

function diffLineItems(beforeLines, afterLines) {
  const beforeById = {};
  beforeLines.forEach(l => { beforeById[l.id] = l; });
  const changes = [];
  for (const after of afterLines) {
    const before = beforeById[after.id];
    if (!before) continue; // adding new lines via amendment isn't supported
    const fieldChanges = {};
    for (const field of AMENDABLE_LINE_FIELDS) {
      const beforeVal = before[field] ?? null;
      const afterVal = after[field] ?? null;
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        fieldChanges[field] = { from: beforeVal, to: afterVal };
      }
    }
    if (Object.keys(fieldChanges).length > 0) {
      changes.push({ po_line_item_id: after.id, description: before.description, fields: fieldChanges });
    }
  }
  return changes;
}

async function getPoWithLines(poId, conn) {
  const c = conn || pool;
  const [[po]] = await c.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) throw new NotFoundError('PO not found');
  const [lineItems] = await c.query('SELECT * FROM po_line_items WHERE po_id = ?', [poId]);
  return { po, lineItems };
}

// ─── Propose ─────────────────────────────────────────────────────────────────
// changes: { header: { ...amendable header fields }, line_items: [{ id, ...amendable line fields }] }
async function proposeAmendment(poId, changes, actorId, changeReason, conn) {
  const c = conn || pool;
  const { po, lineItems } = await getPoWithLines(poId, c);

  if (po.amendment_status === 'pending_approval') {
    throw new ConflictError('An amendment is already pending approval for this PO');
  }

  const headerChanges = changes?.header || {};
  const lineChanges = changes?.line_items || [];

  const afterHeader = { ...po, ...headerChanges };
  const afterLines = lineItems.map(li => {
    const override = lineChanges.find(lc => lc.id === li.id);
    return override ? { ...li, ...override } : li;
  });

  validateGstHsn({ gstin: afterHeader.gstin, line_items: afterLines });

  const changeLog = { header: diffHeader(po, afterHeader), line_items: diffLineItems(lineItems, afterLines) };
  if (Object.keys(changeLog.header).length === 0 && changeLog.line_items.length === 0) {
    throw new ValidationError('No changes detected — nothing to amend');
  }

  const versionId = uuidv4();
  const nextVersion = po.version + 1;
  await c.query(
    `INSERT INTO po_versions (id, po_id, version_number, change_log, snapshot, status, change_reason, requested_by)
     VALUES (?, ?, ?, ?, ?, 'pending_approval', ?, ?)`,
    [versionId, poId, nextVersion, JSON.stringify(changeLog), JSON.stringify({ header: afterHeader, line_items: afterLines }), changeReason || null, actorId]
  );
  await c.query("UPDATE purchase_orders SET amendment_status = 'pending_approval' WHERE id = ?", [poId]);

  return { version_id: versionId, version_number: nextVersion, change_log: changeLog };
}

// ─── Approve ─────────────────────────────────────────────────────────────────
async function approveAmendment(poId, versionId, actorId, conn) {
  const c = conn || pool;
  const [[version]] = await c.query('SELECT * FROM po_versions WHERE id = ? AND po_id = ?', [versionId, poId]);
  if (!version) throw new NotFoundError('PO version not found');
  if (version.status !== 'pending_approval') throw new ValidationError(`Version is already ${version.status}`);
  if (version.requested_by === actorId) throw new AuthorizationError('Cannot approve your own amendment proposal');

  const snapshot = typeof version.snapshot === 'string' ? JSON.parse(version.snapshot) : version.snapshot;
  const { header, line_items } = snapshot;

  await c.query(
    `UPDATE purchase_orders SET
       total_amount = ?, validity_date = ?, terms_of_payment = ?, incoterms = ?,
       partial_delivery_allowed_flag = ?, retention_percentage = ?, delivery_schedule_json = ?,
       version = ?, amendment_status = 'none'
     WHERE id = ?`,
    [
      header.total_amount, header.validity_date || null, header.terms_of_payment || null, header.incoterms || null,
      header.partial_delivery_allowed_flag === undefined ? true : !!header.partial_delivery_allowed_flag,
      header.retention_percentage ?? null,
      header.delivery_schedule_json ? (typeof header.delivery_schedule_json === 'string' ? header.delivery_schedule_json : JSON.stringify(header.delivery_schedule_json)) : null,
      version.version_number, poId,
    ]
  );

  for (const li of line_items) {
    await c.query(
      'UPDATE po_line_items SET description = ?, quantity = ?, unit_price = ?, amount = ?, hsn_sac = ?, tax_percent = ?, tax_amount = ?, total_line_amount = ? WHERE id = ?',
      [
        li.description, li.quantity, li.unit_price, Number(li.quantity) * Number(li.unit_price),
        li.hsn_sac || null, li.tax_percent || 0,
        Number(li.quantity) * Number(li.unit_price) * ((li.tax_percent || 0) / 100),
        Number(li.quantity) * Number(li.unit_price) * (1 + (li.tax_percent || 0) / 100),
        li.id,
      ]
    );
  }

  await c.query("UPDATE po_versions SET status = 'approved', decided_by = ?, decided_at = NOW() WHERE id = ?", [actorId, versionId]);

  return { version_number: version.version_number, status: 'approved' };
}

// ─── Reject ──────────────────────────────────────────────────────────────────
async function rejectAmendment(poId, versionId, actorId, remarks, conn) {
  const c = conn || pool;
  const [[version]] = await c.query('SELECT * FROM po_versions WHERE id = ? AND po_id = ?', [versionId, poId]);
  if (!version) throw new NotFoundError('PO version not found');
  if (version.status !== 'pending_approval') throw new ValidationError(`Version is already ${version.status}`);

  await c.query(
    "UPDATE po_versions SET status = 'rejected', decided_by = ?, decided_at = NOW(), decision_remarks = ? WHERE id = ?",
    [actorId, remarks || null, versionId]
  );
  await c.query("UPDATE purchase_orders SET amendment_status = 'none' WHERE id = ?", [poId]);

  return { version_number: version.version_number, status: 'rejected' };
}

async function getVersionHistory(poId, conn) {
  const c = conn || pool;
  const [[po]] = await c.query('SELECT id, po_number, version, amendment_status FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) throw new NotFoundError('PO not found');
  const [versions] = await c.query('SELECT * FROM po_versions WHERE po_id = ? ORDER BY version_number', [poId]);
  return { po, versions };
}

module.exports = {
  validateGstHsn,
  proposeAmendment,
  approveAmendment,
  rejectAmendment,
  getVersionHistory,
};
