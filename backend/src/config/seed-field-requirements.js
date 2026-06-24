const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Registers every admin-configurable form field with its CURRENT hardcoded
// required/optional behavior, so the System Admin "Field Settings" page has
// something to show on first load without changing any existing behavior.
// Safe to re-run — existing rows are left untouched (INSERT IGNORE).
const FIELDS = [
  // ── vendor (Vendors.jsx create+edit, VendorOnboarding.jsx) ────────────────
  ['vendor', 'vendor_name', 'Vendor Name', 'Basic Information', true],
  ['vendor', 'email', 'Email', 'Basic Information', true],
  ['vendor', 'phone', 'Phone', 'Basic Information', true],
  ['vendor', 'company_name', 'Company', 'Basic Information', true],
  ['vendor', 'department', 'Department', 'Basic Information', true],
  ['vendor', 'supplier_group', 'Supplier Group', 'Basic Information', true],
  ['vendor', 'supplier_category', 'Supplier Category', 'Basic Information', true],
  ['vendor', 'supplier_location', 'Location', 'Basic Information', true],
  ['vendor', 'vendor_code', 'Vendor Code', 'Additional Information', false],
  ['vendor', 'account_manager_name', 'Account Manager', 'Additional Information', false],
  ['vendor', 'vendor_type', 'Vendor Type', 'Classification', false],
  ['vendor', 'industry', 'Industry', 'Classification', false],
  ['vendor', 'registration_type', 'Registration Type', 'Classification', false],
  ['vendor', 'currency_code', 'Currency', 'Classification', false],
  ['vendor', 'gst_number', 'GST Number', 'Business Information', false],
  ['vendor', 'pan_number', 'PAN Number', 'Business Information', false],
  ['vendor', 'trade_name', 'Trade Name', 'Business Information', false],
  ['vendor', 'legal_name', 'Legal Name', 'Business Information', false],
  ['vendor', 'msme_type', 'MSME Type', 'Business Information', false],
  ['vendor', 'itr_filing_status', 'ITR Filing Status', 'Business Information', false],
  ['vendor', 'phone1', 'Phone 1', 'Contact Information', false],
  ['vendor', 'phone2', 'Phone 2', 'Contact Information', false],
  ['vendor', 'email1', 'Email 1', 'Contact Information', false],
  ['vendor', 'email2', 'Email 2', 'Contact Information', false],
  ['vendor', 'payment_terms_id', 'Payment Terms', 'Governance', false],
  ['vendor', 'credit_rating', 'Credit Rating', 'Governance', false],
  ['vendor', 'credit_limit', 'Credit Limit', 'Governance', false],
  ['vendor', 'risk_category', 'Risk Category', 'Governance', false],
  ['vendor', 'geo_latitude', 'Geo Latitude', 'Governance', false],
  ['vendor', 'geo_longitude', 'Geo Longitude', 'Governance', false],
  ['vendor', 'serviceable_regions', 'Serviceable Regions', 'Governance', false],

  // ── asn (ASNs.jsx create/edit wizard) ──────────────────────────────────────
  ['asn', 'po_id', 'Purchase Order', 'PO Selection', true],
  ['asn', 'invoice_number', 'Invoice Number', 'Mandatory Details', true],
  ['asn', 'eta', 'ETA', 'Mandatory Details', true],
  ['asn', 'total_amount', 'Total Amount', 'Mandatory Details', true],
  ['asn', 'lr_number', 'LR Number', 'Mandatory Details', true],
  ['asn', 'transporter_name', 'Transporter', 'Mandatory Details', true],
  ['asn', 'driver_name', 'Driver Name', 'Mandatory Details', true],
  ['asn', 'driver_number', 'Driver Phone', 'Optional Fields', false],
  ['asn', 'additional_info1', 'Additional Info 1', 'Optional Fields', false],
  ['asn', 'additional_info2', 'Additional Info 2', 'Optional Fields', false],
  ['asn', 'additional_info3', 'Additional Info 3', 'Optional Fields', false],
  ['asn', 'additional_info4', 'Additional Info 4', 'Optional Fields', false],
  ['asn', 'remarks', 'Remarks / Comments', 'Optional Fields', false],
  ['asn', 'shipment_mode', 'Shipment Mode', 'Shipment Details', false],
  ['asn', 'vehicle_number', 'Vehicle Number', 'Shipment Details', false],
  ['asn', 'eway_bill_number', 'E-Way Bill Number', 'Shipment Details', false],
  ['asn', 'dispatch_date', 'Dispatch Date', 'Shipment Details', false],
  ['asn', 'actual_delivery_date', 'Actual Delivery Date', 'Shipment Details', false],
  ['asn', 'invoice_currency', 'Invoice Currency', 'Invoice & Tax Details', false],
  ['asn', 'exchange_rate', 'Exchange Rate', 'Invoice & Tax Details', false],
  ['asn', 'freight_charges', 'Freight Charges', 'Invoice & Tax Details', false],
  ['asn', 'cgst_amount', 'CGST Amount', 'Invoice & Tax Details', false],
  ['asn', 'sgst_amount', 'SGST Amount', 'Invoice & Tax Details', false],
  ['asn', 'igst_amount', 'IGST Amount', 'Invoice & Tax Details', false],

  // ── purchase_order (PurchaseOrders.jsx create form header) ─────────────────
  ['purchase_order', 'po_number', 'PO Number', 'Buyer & PO Info', true],
  ['purchase_order', 'po_date', 'PO Date', 'Buyer & PO Info', true],
  ['purchase_order', 'vendor_id', 'Vendor (Supplier)', 'Buyer & PO Info', true],
  ['purchase_order', 'validity_date', 'PO Validity Date', 'Buyer & PO Info', false],
  ['purchase_order', 'buyer_name', 'Buyer Name', 'Buyer Details', false],
  ['purchase_order', 'buyer_address', 'Buyer Address', 'Buyer Details', false],
  ['purchase_order', 'gstin', 'GSTIN', 'Buyer Details', false],
  ['purchase_order', 'state_name', 'State Name', 'Buyer Details', false],
  ['purchase_order', 'state_code', 'State Code', 'Buyer Details', false],
  ['purchase_order', 'terms_of_payment', 'Terms of Payment', 'Buyer Details', false],
  ['purchase_order', 'contract_id', 'Contract ID', 'Contract & Terms', false],
  ['purchase_order', 'incoterms', 'Incoterms', 'Contract & Terms', false],
  ['purchase_order', 'cost_center', 'Cost Center', 'Contract & Terms', false],
  ['purchase_order', 'project_code', 'Project Code', 'Contract & Terms', false],
  ['purchase_order', 'budget_code', 'Budget Code', 'Contract & Terms', false],
  ['purchase_order', 'retention_percentage', 'Retention %', 'Contract & Terms', false],

  // ── rfq (RFQ.jsx create view header) ───────────────────────────────────────
  ['rfq', 'title', 'RFQ Title', 'Header', true],
  ['rfq', 'submission_deadline', 'Bid Deadline', 'Header', true],
  ['rfq', 'description', 'Description', 'Details', false],
  ['rfq', 'vendor_ids', 'Invite Vendors', 'Vendors', true],
  ['rfq', 'rfq_type', 'RFQ Type', 'RFQ Type & Category', false],
  ['rfq', 'procurement_category_id', 'Procurement Category', 'RFQ Type & Category', false],
  ['rfq', 'budget_value', 'Budget Value', 'RFQ Type & Category', false],

  // ── rfq_bid (RFQ.jsx vendor "My Bid" terms) ────────────────────────────────
  ['rfq_bid', 'offered_payment_terms', 'Offered Payment Terms', 'Bid Terms', false],
  ['rfq_bid', 'warranty_period', 'Warranty Period', 'Bid Terms', false],
  ['rfq_bid', 'bid_remarks', 'Overall Bid Remarks', 'Bid Remarks', false],

  // ── item_master (ItemMaster.jsx add/edit) ──────────────────────────────────
  ['item_master', 'item_code', 'Item Code', 'Header', true],
  ['item_master', 'item_description', 'Item Description', 'Header', true],
  ['item_master', 'item_name', 'Item Name', 'Header', false],
  ['item_master', 'uom', 'UOM', 'Details', false],
  ['item_master', 'category', 'Category', 'Details', false],
  ['item_master', 'category_id', 'Category (Master)', 'Details', false],
  ['item_master', 'subcategory_id', 'Subcategory (Master)', 'Details', false],
  ['item_master', 'uom_id', 'UOM (Master)', 'Details', false],
  ['item_master', 'hsn_sac_code', 'HSN/SAC Code', 'Details', false],
  ['item_master', 'standard_cost', 'Standard Cost', 'Details', false],
  ['item_master', 'currency', 'Currency', 'Details', false],

  // ── user_management (UserManagement.jsx add/edit) ─────────────────────────
  ['user_management', 'full_name', 'Full Name', 'User', true],
  ['user_management', 'email', 'Email', 'User', true],
  ['user_management', 'role', 'Role', 'User', true],
  ['user_management', 'password', 'Password (on create)', 'User', true],

  // ── ticket (Tickets.jsx create modal) ──────────────────────────────────────
  ['ticket', 'subject', 'Subject', 'Create Ticket', true],
  ['ticket', 'description', 'Description', 'Create Ticket', true],
  ['ticket', 'priority', 'Priority', 'Create Ticket', true],
  ['ticket', 'vendor_ids', 'Vendors', 'Create Ticket', true],
  ['ticket', 'category', 'Category', 'Create Ticket', false],
  ['ticket', 'sla_hours', 'SLA (hours)', 'Create Ticket', false],

  // ── ticket_close (Tickets.jsx close modal) ─────────────────────────────────
  ['ticket_close', 'rating', 'Rating', 'Close Ticket', true],
  ['ticket_close', 'closure_remarks', 'Closure Remarks', 'Close Ticket', true],
  ['ticket_close', 'root_cause', 'Root Cause', 'Close Ticket', false],
  ['ticket_close', 'resolution_type', 'Resolution Type', 'Close Ticket', false],

  // ── audit_checklist (AuditManagement.jsx checklist modal) ─────────────────
  ['audit_checklist', 'name', 'Checklist Name', 'Checklist', true],
  ['audit_checklist', 'description', 'Description', 'Checklist', false],
  ['audit_checklist', 'category', 'Category', 'Checklist', true],

  // ── audit_schedule (AuditManagement.jsx schedule modal) ────────────────────
  ['audit_schedule', 'checklist_id', 'Checklist', 'Schedule', true],
  ['audit_schedule', 'vendor_id', 'Vendor', 'Schedule', false],
  ['audit_schedule', 'vendor_group', 'Vendor Group', 'Schedule', false],
  ['audit_schedule', 'frequency', 'Frequency', 'Schedule', true],
  ['audit_schedule', 'start_date', 'From Date', 'Schedule', true],
  ['audit_schedule', 'end_date', 'To Date', 'Schedule', true],

  // ── audit_finding (AuditManagement.jsx add finding modal) ──────────────────
  ['audit_finding', 'description', 'Finding Description', 'Finding', true],
  ['audit_finding', 'severity', 'Severity', 'Finding', true],
  ['audit_finding', 'assigned_to', 'Assign Corrective Action To', 'Finding', false],
  ['audit_finding', 'capa_action_owner', 'CAPA Action Owner', 'Finding', false],
  ['audit_finding', 'capa_due_date', 'CAPA Due Date', 'Finding', false],

  // ── audit_complete (AuditManagement.jsx complete audit modal) ──────────────
  ['audit_complete', 'audit_score', 'Audit Score (0-100)', 'Complete', false],
  ['audit_complete', 'compliance_percentage', 'Compliance Percentage (0-100)', 'Complete', false],

  // ── document (DocumentCenter.jsx upload modal) ─────────────────────────────
  ['document', 'module_name', 'Module', 'Upload', true],
  ['document', 'record_id', 'Record ID', 'Upload', false],
  ['document', 'file_type', 'File Type', 'Upload', false],
  ['document', 'document_group_id', 'Document Group ID', 'Upload', false],
  ['document', 'expiry_date', 'Expiry Date', 'Upload', false],

  // ── purchase_requisition (PR.jsx create+edit) ──────────────────────────────
  ['purchase_requisition', 'department', 'Department', 'Basic Information', true],
  ['purchase_requisition', 'justification', 'Justification', 'Basic Information', true],
  ['purchase_requisition', 'sourcing_strategy', 'Sourcing Strategy', 'Smart Controls', true],
  ['purchase_requisition', 'cost_center', 'Cost Center', 'Basic Information', false],
  ['purchase_requisition', 'project_code', 'Project Code', 'Basic Information', false],
  ['purchase_requisition', 'company_code', 'Company Code', 'Basic Information', false],
  ['purchase_requisition', 'plant', 'Plant', 'Basic Information', false],
  ['purchase_requisition', 'required_date', 'Required Date', 'Basic Information', false],
  ['purchase_requisition', 'preferred_vendor_id', 'Preferred Vendor', 'Smart Controls', false],
  ['purchase_requisition', 'contract_id', 'Contract', 'Smart Controls', false],

  // ── contract (Contracts.jsx create modal) ───────────────────────────────────
  ['contract', 'vendor_id', 'Vendor', 'Contract Details', true],
  ['contract', 'title', 'Title', 'Contract Details', true],
  ['contract', 'start_date', 'Start Date', 'Contract Details', true],
  ['contract', 'end_date', 'End Date', 'Contract Details', true],
  ['contract', 'payment_terms', 'Payment Terms', 'Contract Details', false],
  ['contract', 'contract_value', 'Contract Value', 'Contract Details', false],
];

async function seedFieldRequirements() {
  const conn = await pool.getConnection();
  try {
    let inserted = 0;
    let order = 0;
    for (const [module_key, field_key, field_label, section, is_mandatory] of FIELDS) {
      order++;
      const [result] = await conn.query(
        'INSERT IGNORE INTO field_requirements (id, module_key, field_key, field_label, section, is_mandatory, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), module_key, field_key, field_label, section, is_mandatory, order]
      );
      if (result.affectedRows > 0) inserted++;
    }
    console.log(`✅ Field requirements seed complete (${inserted} new of ${FIELDS.length} entries)`);
  } finally {
    conn.release();
    await pool.end();
  }
}

seedFieldRequirements().catch(err => { console.error('Field requirements seed failed:', err); process.exit(1); });
