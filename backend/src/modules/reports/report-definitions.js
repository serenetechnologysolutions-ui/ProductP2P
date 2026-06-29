// Declarative report registry — adding a new report means adding one entry
// here; reports.routes.js, the on-screen preview, and the Excel export all
// stay generic and read this config, so no new routes or frontend code is
// needed per report. `filters` drives the frontend's filter form: each entry
// is { key, label, type, options? } where type is one of
// 'date_range' | 'select' | 'value_range' | 'text'.
// `roles` gates who can see/run the report at all; row-level scoping for
// vendor users (only their own data) is applied inside buildQuery, matching
// the same convention used by the underlying module's own routes.

const STATUS_OPTIONS = {
  pr: ['draft', 'submitted', 'approved', 'partially_approved', 'sourcing', 'closed', 'rejected'],
  rfq: ['draft', 'published', 'closed', 'negotiation', 'awarded'],
  po: ['open', 'partially_fulfilled', 'fulfilled', 'closed'],
  asn: ['draft', 'submitted', 'validated', 'posted', 'rejected'],
  vendor: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'inactive'],
  contract: ['active', 'expired', 'terminated'],
  ticket: ['initiated', 'in_progress', 'vendor_closed', 'closed'],
};

const ADMIN_ROLES = ['procurement_admin', 'mdm_admin', 'system_admin'];

const REPORT_DEFINITIONS = {
  purchase_requisitions: {
    label: 'Purchase Requisitions',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'date_range', label: 'Created Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.pr },
      { key: 'department', label: 'Department', type: 'select', optionsFrom: 'department' },
      { key: 'cost_center', label: 'Cost Center', type: 'select', optionsFrom: 'cost_center' },
      { key: 'value_range', label: 'Total Value', type: 'value_range' },
    ],
    columns: [
      { key: 'pr_number', label: 'PR Number' }, { key: 'department', label: 'Department' },
      { key: 'cost_center', label: 'Cost Center' }, { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' }, { key: 'sourcing_strategy', label: 'Sourcing Strategy' },
      { key: 'total_value', label: 'Total Value' }, { key: 'requester_name', label: 'Requester' },
      { key: 'created_at', label: 'Created At' },
    ],
    buildQuery(f) {
      let sql = `SELECT pr.pr_number, pr.department, pr.cost_center, pr.priority, pr.status, pr.sourcing_strategy,
                        pr.total_value, u.full_name as requester_name, pr.created_at
                 FROM purchase_requisitions pr LEFT JOIN users u ON pr.requester_id = u.id WHERE 1=1`;
      const params = [];
      if (f.date_from) { sql += ' AND pr.created_at >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND pr.created_at <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND pr.status = ?'; params.push(f.status); }
      if (f.department) { sql += ' AND pr.department = ?'; params.push(f.department); }
      if (f.cost_center) { sql += ' AND pr.cost_center = ?'; params.push(f.cost_center); }
      if (f.min_value) { sql += ' AND pr.total_value >= ?'; params.push(f.min_value); }
      if (f.max_value) { sql += ' AND pr.total_value <= ?'; params.push(f.max_value); }
      sql += ' ORDER BY pr.created_at DESC';
      return { sql, params };
    },
  },

  rfqs: {
    label: 'RFQ & Negotiation',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'date_range', label: 'Created Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.rfq },
    ],
    columns: [
      { key: 'rfq_number', label: 'RFQ Number' }, { key: 'title', label: 'Title' },
      { key: 'rfq_type', label: 'Type' }, { key: 'status', label: 'Status' },
      { key: 'current_round', label: 'Round' }, { key: 'submission_deadline', label: 'Submission Deadline' },
      { key: 'created_by_name', label: 'Created By' }, { key: 'created_at', label: 'Created At' },
    ],
    buildQuery(f) {
      let sql = `SELECT r.rfq_number, r.title, r.rfq_type, r.status, r.current_round, r.submission_deadline,
                        u.full_name as created_by_name, r.created_at
                 FROM rfqs r LEFT JOIN users u ON r.created_by = u.id WHERE 1=1`;
      const params = [];
      if (f.date_from) { sql += ' AND r.created_at >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND r.created_at <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND r.status = ?'; params.push(f.status); }
      sql += ' ORDER BY r.created_at DESC';
      return { sql, params };
    },
  },

  purchase_orders: {
    label: 'Purchase Orders',
    roles: [...ADMIN_ROLES, 'vendor'],
    filters: [
      { key: 'date_range', label: 'PO Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.po },
      { key: 'department', label: 'Department', type: 'select', optionsFrom: 'department' },
      { key: 'value_range', label: 'Total Amount', type: 'value_range' },
    ],
    columns: [
      { key: 'po_number', label: 'PO Number' }, { key: 'vendor_name', label: 'Vendor' },
      { key: 'department', label: 'Department' }, { key: 'cost_center', label: 'Cost Center' },
      { key: 'status', label: 'Status' }, { key: 'total_amount', label: 'Total Amount' },
      { key: 'po_date', label: 'PO Date' }, { key: 'validity_date', label: 'Validity Date' },
    ],
    buildQuery(f, user) {
      let sql = `SELECT po.po_number, v.vendor_name, po.department, po.cost_center, po.status,
                        po.total_amount, po.po_date, po.validity_date
                 FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE 1=1`;
      const params = [];
      if (user.role === 'vendor') { sql += ' AND po.vendor_id = ?'; params.push(user.vendorId); }
      if (f.date_from) { sql += ' AND po.po_date >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND po.po_date <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND po.status = ?'; params.push(f.status); }
      if (f.department) { sql += ' AND po.department = ?'; params.push(f.department); }
      if (f.min_value) { sql += ' AND po.total_amount >= ?'; params.push(f.min_value); }
      if (f.max_value) { sql += ' AND po.total_amount <= ?'; params.push(f.max_value); }
      sql += ' ORDER BY po.created_at DESC';
      return { sql, params };
    },
  },

  asns: {
    label: 'ASNs / Receiving',
    roles: [...ADMIN_ROLES, 'vendor'],
    filters: [
      { key: 'date_range', label: 'Created Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.asn },
    ],
    columns: [
      { key: 'asn_number', label: 'ASN Number' }, { key: 'vendor_name', label: 'Vendor' },
      { key: 'po_number', label: 'PO Number' }, { key: 'status', label: 'Status' },
      { key: 'three_way_match_status', label: '3-Way Match' }, { key: 'total_amount', label: 'Amount' },
      { key: 'eta', label: 'ETA' }, { key: 'created_at', label: 'Created At' },
    ],
    buildQuery(f, user) {
      let sql = `SELECT a.asn_number, v.vendor_name, po.po_number, a.status, a.three_way_match_status,
                        a.total_amount, a.eta, a.created_at
                 FROM asns a LEFT JOIN vendors v ON a.vendor_id = v.id LEFT JOIN purchase_orders po ON a.po_id = po.id WHERE 1=1`;
      const params = [];
      if (user.role === 'vendor') { sql += ' AND a.vendor_id = ?'; params.push(user.vendorId); }
      if (f.date_from) { sql += ' AND a.created_at >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND a.created_at <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND a.status = ?'; params.push(f.status); }
      sql += ' ORDER BY a.created_at DESC';
      return { sql, params };
    },
  },

  vendors: {
    label: 'Vendor Master',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.vendor },
      { key: 'risk_category', label: 'Risk Category', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'select', options: ['onboarding', 'active', 'dormant', 'blocked'] },
    ],
    columns: [
      { key: 'vendor_code', label: 'Vendor Code' }, { key: 'vendor_name', label: 'Vendor Name' },
      { key: 'supplier_category', label: 'Category' }, { key: 'status', label: 'Status' },
      { key: 'risk_category', label: 'Risk' }, { key: 'lifecycle_stage', label: 'Lifecycle Stage' },
      { key: 'credit_rating', label: 'Credit Rating' }, { key: 'created_at', label: 'Created At' },
    ],
    buildQuery(f) {
      let sql = `SELECT vendor_code, vendor_name, supplier_category, status, risk_category, lifecycle_stage,
                        credit_rating, created_at
                 FROM vendors WHERE 1=1`;
      const params = [];
      if (f.status) { sql += ' AND status = ?'; params.push(f.status); }
      if (f.risk_category) { sql += ' AND risk_category = ?'; params.push(f.risk_category); }
      if (f.lifecycle_stage) { sql += ' AND lifecycle_stage = ?'; params.push(f.lifecycle_stage); }
      sql += ' ORDER BY created_at DESC';
      return { sql, params };
    },
  },

  budget_allocations: {
    label: 'Budget Allocations',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'fiscal_year', label: 'Fiscal Year', type: 'text' },
      { key: 'cost_center', label: 'Cost Center', type: 'select', optionsFrom: 'cost_center' },
    ],
    columns: [
      { key: 'cost_center', label: 'Cost Center' }, { key: 'fiscal_year', label: 'Fiscal Year' },
      { key: 'allocated_amount', label: 'Allocated' }, { key: 'committed_amount', label: 'Committed' },
      { key: 'consumed_amount', label: 'Consumed' }, { key: 'actual_amount', label: 'Actual' },
      { key: 'remaining', label: 'Remaining' },
    ],
    buildQuery(f) {
      let sql = `SELECT cost_center, fiscal_year, allocated_amount, committed_amount, consumed_amount, actual_amount,
                        (allocated_amount - committed_amount - consumed_amount - actual_amount) as remaining
                 FROM budget_allocations WHERE 1=1`;
      const params = [];
      if (f.fiscal_year) { sql += ' AND fiscal_year = ?'; params.push(f.fiscal_year); }
      if (f.cost_center) { sql += ' AND cost_center = ?'; params.push(f.cost_center); }
      sql += ' ORDER BY fiscal_year DESC, cost_center';
      return { sql, params };
    },
  },

  contracts: {
    label: 'Contracts',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'date_range', label: 'Start Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.contract },
    ],
    columns: [
      { key: 'contract_number', label: 'Contract Number' }, { key: 'title', label: 'Title' },
      { key: 'vendor_name', label: 'Vendor' }, { key: 'status', label: 'Status' },
      { key: 'contract_value', label: 'Contract Value' }, { key: 'consumed_value', label: 'Consumed Value' },
      { key: 'start_date', label: 'Start Date' }, { key: 'end_date', label: 'End Date' },
    ],
    buildQuery(f) {
      let sql = `SELECT c.contract_number, c.title, v.vendor_name, c.status, c.contract_value, c.consumed_value,
                        c.start_date, c.end_date
                 FROM contracts c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE 1=1`;
      const params = [];
      if (f.date_from) { sql += ' AND c.start_date >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND c.start_date <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND c.status = ?'; params.push(f.status); }
      sql += ' ORDER BY c.start_date DESC';
      return { sql, params };
    },
  },

  tickets: {
    label: 'Supplier Issues',
    roles: [...ADMIN_ROLES, 'vendor'],
    filters: [
      { key: 'date_range', label: 'Created Date', type: 'date_range' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS.ticket },
      { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
    ],
    columns: [
      { key: 'ticket_number', label: 'Ticket Number' }, { key: 'subject', label: 'Subject' },
      { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created At' },
      { key: 'closed_at', label: 'Closed At' },
    ],
    buildQuery(f, user) {
      let sql = `SELECT t.ticket_number, t.subject, t.category, t.priority, t.status, t.created_at, t.closed_at
                 FROM tickets t WHERE 1=1`;
      const params = [];
      if (user.role === 'vendor') {
        sql += ' AND t.id IN (SELECT ticket_id FROM ticket_vendors WHERE vendor_id = ?)';
        params.push(user.vendorId);
      }
      if (f.date_from) { sql += ' AND t.created_at >= ?'; params.push(f.date_from); }
      if (f.date_to) { sql += ' AND t.created_at <= ?'; params.push(f.date_to); }
      if (f.status) { sql += ' AND t.status = ?'; params.push(f.status); }
      if (f.priority) { sql += ' AND t.priority = ?'; params.push(f.priority); }
      sql += ' ORDER BY t.created_at DESC';
      return { sql, params };
    },
  },

  item_master: {
    label: 'Item Master',
    roles: ADMIN_ROLES,
    filters: [
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'is_active', label: 'Active', type: 'select', options: ['1', '0'] },
    ],
    columns: [
      { key: 'item_code', label: 'Item Code' }, { key: 'item_description', label: 'Description' },
      { key: 'uom', label: 'UOM' }, { key: 'category', label: 'Category' },
      { key: 'standard_cost', label: 'Standard Cost' }, { key: 'currency', label: 'Currency' },
      { key: 'is_active', label: 'Active' },
    ],
    buildQuery(f) {
      let sql = `SELECT item_code, item_description, uom, category, standard_cost, currency, is_active
                 FROM item_master WHERE 1=1`;
      const params = [];
      if (f.category) { sql += ' AND category LIKE ?'; params.push(`%${f.category}%`); }
      if (f.is_active !== undefined && f.is_active !== '') { sql += ' AND is_active = ?'; params.push(f.is_active); }
      sql += ' ORDER BY item_code';
      return { sql, params };
    },
  },
};

module.exports = { REPORT_DEFINITIONS };
