const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { logger } = require('../../common/logger');

// Module 1 (Multi-Company + Intercompany) — if the vendor on a newly-created
// PO is itself flagged as one of the organization's own companies
// (vendors.internal_company_id), mirror the PO as a Sales Order in that
// vendor's own books instead of treating it as a normal external purchase.
// Best-effort: a failure here must never roll back the PO itself, since the
// PO is real either way — it's only the intercompany bookkeeping that's at risk.
async function autoPONumber(prefix, conn) {
  const c = conn || pool;
  const [[{ maxNum }]] = await c.query(
    `SELECT MAX(CAST(SUBSTRING(so_number, ${prefix.length + 2}) AS UNSIGNED)) as maxNum FROM sales_orders WHERE so_number LIKE '${prefix}-%'`
  );
  return `${prefix}-${String((maxNum || 0) + 1).padStart(6, '0')}`;
}

async function maybeCreateIntercompanySalesOrder(vendorId, poId, totalAmount, buyingCompanyId, conn) {
  const c = conn || pool;
  try {
    const [[vendor]] = await c.query('SELECT internal_company_id FROM vendors WHERE id = ?', [vendorId]);
    if (!vendor?.internal_company_id) return null;

    // Most POs don't yet have an explicit company_id set (it's a new,
    // nullable column) — fall back to the seeded default company rather
    // than leaving sales_orders.buying_company_id unset.
    let resolvedBuyingCompanyId = buyingCompanyId;
    if (!resolvedBuyingCompanyId) {
      const [[defaultCo]] = await c.query("SELECT id FROM company_master WHERE company_code = 'DEFAULT'");
      resolvedBuyingCompanyId = defaultCo?.id;
    }
    if (!resolvedBuyingCompanyId) return null;

    const soId = uuidv4();
    const soNumber = await autoPONumber('SO', c);
    await c.query(
      `INSERT INTO sales_orders (id, so_number, selling_company_id, buying_company_id, source_po_id, total_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [soId, soNumber, vendor.internal_company_id, resolvedBuyingCompanyId, poId, totalAmount]
    );
    return { id: soId, so_number: soNumber };
  } catch (err) {
    logger.error('Intercompany Sales Order mirror failed (PO itself is unaffected)', { poId, vendorId, error: err.message });
    return null;
  }
}

// Module 10: multi-company access restriction — only system_admin is truly
// unrestricted (returns null). All other roles, including mdm_admin, are
// scoped to their explicit user_company_access grants. This ensures
// MDM_Admin users can only manage companies they are mapped to.
// Returns null to mean "unrestricted" (system_admin only), or an array of
// company_id strings (possibly empty) for all other roles.
async function getUserCompanyIds(userId, role, conn) {
  if (role === 'system_admin') return null;
  const c = conn || pool;
  const [rows] = await c.query('SELECT company_id FROM user_company_access WHERE user_id = ?', [userId]);
  return rows.map(r => r.company_id);
}

// Fetch company details for PDF generation (PR/PO headers).
// Returns the company record with statutory fields, or null if not found.
async function getCompanyDetails(companyId) {
  if (!companyId) return null;
  const [[company]] = await pool.query(
    `SELECT company_name, address, city, state, pin_code, cin, pan, gstin
     FROM company_master WHERE id = ?`,
    [companyId]
  );
  return company || null;
}

module.exports = { maybeCreateIntercompanySalesOrder, getUserCompanyIds, getCompanyDetails };
