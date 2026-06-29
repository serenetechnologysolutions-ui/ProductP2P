const { pool } = require('../../config/database');

// Pure data access for ProcurementInsightsService — no business logic here,
// only queries. Every function accepts an optional `conn` so callers running
// inside a transaction elsewhere in the app can pass their own connection,
// matching the (conn || pool) convention already used in pr.helpers.js.

async function getItemMasterById(itemId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM item_master WHERE id = ?', [itemId]);
  return rows[0] || null;
}

// Price history for one item, matched by stable item_master_id where it's
// set, falling back to a normalized item_description match for rows
// recorded before that column existed (or that couldn't be backfilled
// unambiguously) — see migrate-procurement-insights.js. The two branches of
// the OR are mutually exclusive, so no row is ever counted twice.
async function getPriceHistoryForItem(itemId, itemDescription, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT ph.*, v.vendor_name
     FROM price_history ph
     LEFT JOIN vendors v ON ph.vendor_id = v.id
     WHERE ph.item_master_id = ?
        OR (ph.item_master_id IS NULL AND LOWER(TRIM(ph.item_description)) = LOWER(TRIM(?)))
     ORDER BY ph.recorded_at DESC`,
    [itemId, itemDescription || '']
  );
  return rows;
}

// Every price_history row a vendor has ever supplied, each tagged with
// whichever item_master_id it could be resolved to (NULL if it never could) —
// used to compute a vendor's price-competitiveness index across all items
// they've supplied, one item-benchmark comparison at a time.
async function getPriceHistoryForVendor(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT ph.*, im.item_description AS item_master_description
     FROM price_history ph
     LEFT JOIN item_master im ON ph.item_master_id = im.id
     WHERE ph.vendor_id = ?
     ORDER BY ph.recorded_at DESC`,
    [vendorId]
  );
  return rows;
}

// Benchmark rows (vendor-agnostic) for a set of items, keyed by item_master_id —
// used internally so a vendor's price competitiveness can be compared against
// the *market* average per item without re-running getPriceHistoryForItem once per line.
async function getPriceHistoryForItemIds(itemMasterIds, conn) {
  if (!itemMasterIds || itemMasterIds.length === 0) return [];
  const c = conn || pool;
  const placeholders = itemMasterIds.map(() => '?').join(',');
  const [rows] = await c.query(
    `SELECT * FROM price_history WHERE item_master_id IN (${placeholders})`,
    itemMasterIds
  );
  return rows;
}

async function getVendorBasic(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    'SELECT id, vendor_name, status, risk_category, blacklist_flag, preferred_vendor_flag FROM vendors WHERE id = ?',
    [vendorId]
  );
  return rows[0] || null;
}

async function getVendorRiskScoreRow(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM vendor_risk_scores WHERE vendor_id = ?', [vendorId]);
  return rows[0] || null;
}

async function getContractsForVendor(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT * FROM contracts
     WHERE vendor_id = ?
     ORDER BY (status = 'active') DESC, end_date DESC`,
    [vendorId]
  );
  return rows;
}

async function getPrLineItems(prId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY sequence', [prId]);
  return rows;
}

async function getContractById(contractId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT * FROM contracts WHERE id = ?', [contractId]);
  return rows[0] || null;
}

// item_vendor_mapping rows for one item, preferred first — the *item-level*
// notion of "preferred vendor" (who's good for this specific item), distinct
// from a PR's own preferred_vendor_id (a PR-level vendor pick).
async function getPreferredVendorsForItem(itemId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT m.vendor_id, m.is_preferred, v.vendor_name, v.status AS vendor_status, v.vendor_segment, v.blacklist_flag
     FROM item_vendor_mapping m
     LEFT JOIN vendors v ON m.vendor_id = v.id
     WHERE m.item_id = ?
     ORDER BY m.is_preferred DESC, v.vendor_name`,
    [itemId]
  );
  return rows;
}

module.exports = {
  getItemMasterById,
  getPriceHistoryForItem,
  getPriceHistoryForVendor,
  getPriceHistoryForItemIds,
  getVendorBasic,
  getVendorRiskScoreRow,
  getContractsForVendor,
  getPrLineItems,
  getContractById,
  getPreferredVendorsForItem,
};
