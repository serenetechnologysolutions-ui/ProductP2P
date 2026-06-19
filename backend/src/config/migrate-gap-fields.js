const mysql = require('mysql2/promise');
require('dotenv').config();

// Gap-analysis migration: adds governance/workflow columns to existing tables and
// creates the new Workflow Engine + Document Management tables. Every ALTER is
// guarded so this is safe to re-run against a database that already has some
// (or all) of these columns.
async function migrateGapFields() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  async function addColumnIfMissing(table, columnDef, columnName) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`  + ${table}.${columnName}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  async function addIndexIfMissing(table, indexName, indexDef) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD ${indexDef}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    }
  }

  // ─── 1. GLOBAL GAP FIELDS ───────────────────────────────────────────────
  // Applied to every primary record-bearing table across the modules covered
  // by this gap analysis, so any module can plug into the workflow engine,
  // SLA tracking, soft delete, and audit trail in a consistent way.
  const GLOBAL_TABLES = ['vendors', 'purchase_orders', 'asns', 'rfqs', 'tickets', 'item_master', 'audit_executions', 'vendor_risk_scores', 'vendor_esg'];
  const GLOBAL_COLUMNS = [
    ['approval_workflow_id', 'approval_workflow_id VARCHAR(36) NULL'],
    ['workflow_instance_id', 'workflow_instance_id VARCHAR(36) NULL'],
    ['sla_due_date', 'sla_due_date DATETIME NULL'],
    ['sla_breach_flag', 'sla_breach_flag BOOLEAN DEFAULT FALSE'],
    ['escalation_level', 'escalation_level INT DEFAULT 0'],
    ['external_source', "external_source ENUM('API','Manual','Upload') DEFAULT 'Manual'"],
    ['data_source_reference_id', 'data_source_reference_id VARCHAR(100) NULL'],
    ['soft_delete_flag', 'soft_delete_flag BOOLEAN DEFAULT FALSE'],
    ['audit_log_reference_id', 'audit_log_reference_id VARCHAR(36) NULL'],
  ];
  for (const table of GLOBAL_TABLES) {
    for (const [name, def] of GLOBAL_COLUMNS) {
      await addColumnIfMissing(table, def, name);
    }
  }

  // ─── 2. VENDOR MASTER — missing fields only ────────────────────────────
  await addColumnIfMissing('vendors', 'vendor_code VARCHAR(50) NULL', 'vendor_code');
  await addColumnIfMissing('vendors', 'vendor_code_auto VARCHAR(50) NULL', 'vendor_code_auto');
  await addColumnIfMissing('vendors', 'vendor_type VARCHAR(100) NULL', 'vendor_type');
  await addColumnIfMissing('vendors', 'industry VARCHAR(100) NULL', 'industry');
  await addColumnIfMissing('vendors', 'registration_type VARCHAR(100) NULL', 'registration_type');
  await addColumnIfMissing('vendors', "gst_validation_status ENUM('pending','valid','invalid') DEFAULT 'pending'", 'gst_validation_status');
  await addColumnIfMissing('vendors', "pan_validation_status ENUM('pending','valid','invalid') DEFAULT 'pending'", 'pan_validation_status');
  await addColumnIfMissing('vendors', 'credit_rating VARCHAR(10) NULL', 'credit_rating');
  await addColumnIfMissing('vendors', 'credit_limit DECIMAL(15,2) NULL', 'credit_limit');
  await addColumnIfMissing('vendors', 'payment_terms_id VARCHAR(36) NULL', 'payment_terms_id');
  await addColumnIfMissing('vendors', "currency_code VARCHAR(3) DEFAULT 'INR'", 'currency_code');
  await addColumnIfMissing('vendors', "risk_category ENUM('low','medium','high') NULL", 'risk_category');
  await addColumnIfMissing('vendors', 'blacklist_flag BOOLEAN DEFAULT FALSE', 'blacklist_flag');
  await addColumnIfMissing('vendors', 'blacklist_reason TEXT NULL', 'blacklist_reason');
  await addColumnIfMissing('vendors', 'compliance_expiry_dates JSON NULL', 'compliance_expiry_dates');
  await addColumnIfMissing('vendors', 'geo_latitude DECIMAL(10,7) NULL', 'geo_latitude');
  await addColumnIfMissing('vendors', 'geo_longitude DECIMAL(10,7) NULL', 'geo_longitude');
  await addColumnIfMissing('vendors', 'serviceable_regions JSON NULL', 'serviceable_regions');
  await addColumnIfMissing('vendors', 'account_manager_name VARCHAR(255) NULL', 'account_manager_name');
  await addColumnIfMissing('vendors', "lifecycle_stage ENUM('onboarding','active','dormant','blocked') DEFAULT 'onboarding'", 'lifecycle_stage');
  await addColumnIfMissing('vendors', 'preferred_vendor_flag BOOLEAN DEFAULT FALSE', 'preferred_vendor_flag');
  await addIndexIfMissing('vendors', 'uq_vendor_code', 'UNIQUE KEY uq_vendor_code (vendor_code)');
  await addIndexIfMissing('vendors', 'uq_vendor_code_auto', 'UNIQUE KEY uq_vendor_code_auto (vendor_code_auto)');

  // ─── 3. ITEM MASTER — extend existing table + new mapping table ───────
  await addColumnIfMissing('item_master', 'item_name VARCHAR(255) NULL', 'item_name');
  await addColumnIfMissing('item_master', 'category_id VARCHAR(36) NULL', 'category_id');
  await addColumnIfMissing('item_master', 'subcategory_id VARCHAR(36) NULL', 'subcategory_id');
  await addColumnIfMissing('item_master', 'uom_id VARCHAR(36) NULL', 'uom_id');
  await addColumnIfMissing('item_master', 'hsn_sac_code VARCHAR(20) NULL', 'hsn_sac_code');
  await addColumnIfMissing('item_master', 'standard_cost DECIMAL(15,2) NULL', 'standard_cost');
  await addColumnIfMissing('item_master', "currency VARCHAR(3) DEFAULT 'INR'", 'currency');
  await addColumnIfMissing('item_master', 'specification_template JSON NULL', 'specification_template');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS item_vendor_mapping (
      id VARCHAR(36) PRIMARY KEY,
      item_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      is_preferred BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_item_vendor (item_id, vendor_id),
      FOREIGN KEY (item_id) REFERENCES item_master(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);

  // ─── 4. PURCHASE ORDER — missing fields only ───────────────────────────
  await addColumnIfMissing('purchase_orders', 'contract_id VARCHAR(36) NULL', 'contract_id');
  await addColumnIfMissing('purchase_orders', 'incoterms VARCHAR(20) NULL', 'incoterms');
  await addColumnIfMissing('purchase_orders', 'cost_center VARCHAR(100) NULL', 'cost_center');
  await addColumnIfMissing('purchase_orders', 'project_code VARCHAR(100) NULL', 'project_code');
  await addColumnIfMissing('purchase_orders', 'budget_code VARCHAR(100) NULL', 'budget_code');
  await addColumnIfMissing('purchase_orders', 'delivery_schedule_json JSON NULL', 'delivery_schedule_json');
  await addColumnIfMissing('purchase_orders', 'partial_delivery_allowed_flag BOOLEAN DEFAULT TRUE', 'partial_delivery_allowed_flag');
  await addColumnIfMissing('purchase_orders', 'retention_percentage DECIMAL(5,2) NULL', 'retention_percentage');

  // ─── 5. ASN — missing fields only ──────────────────────────────────────
  await addColumnIfMissing('asns', "shipment_mode ENUM('road','air','sea') NULL", 'shipment_mode');
  await addColumnIfMissing('asns', 'vehicle_number VARCHAR(20) NULL', 'vehicle_number');
  await addColumnIfMissing('asns', 'eway_bill_number VARCHAR(50) NULL', 'eway_bill_number');
  await addColumnIfMissing('asns', 'dispatch_date DATE NULL', 'dispatch_date');
  await addColumnIfMissing('asns', 'actual_delivery_date DATE NULL', 'actual_delivery_date');
  await addColumnIfMissing('asns', "invoice_currency VARCHAR(3) DEFAULT 'INR'", 'invoice_currency');
  await addColumnIfMissing('asns', 'exchange_rate DECIMAL(10,4) DEFAULT 1.0000', 'exchange_rate');
  await addColumnIfMissing('asns', 'cgst_amount DECIMAL(15,2) DEFAULT 0', 'cgst_amount');
  await addColumnIfMissing('asns', 'sgst_amount DECIMAL(15,2) DEFAULT 0', 'sgst_amount');
  await addColumnIfMissing('asns', 'igst_amount DECIMAL(15,2) DEFAULT 0', 'igst_amount');
  await addColumnIfMissing('asns', 'freight_charges DECIMAL(15,2) DEFAULT 0', 'freight_charges');
  await addColumnIfMissing('asns', "three_way_match_status ENUM('matched','mismatched','pending') DEFAULT 'pending'", 'three_way_match_status');
  await addColumnIfMissing('asns', 'discrepancy_flag BOOLEAN DEFAULT FALSE', 'discrepancy_flag');
  await addColumnIfMissing('asns', 'discrepancy_reason TEXT NULL', 'discrepancy_reason');

  // ─── 6. RFQ — missing fields only ──────────────────────────────────────
  await addColumnIfMissing('rfqs', "rfq_type ENUM('open','limited','single') DEFAULT 'limited'", 'rfq_type');
  await addColumnIfMissing('rfqs', 'procurement_category_id VARCHAR(36) NULL', 'procurement_category_id');
  await addColumnIfMissing('rfqs', 'budget_value DECIMAL(15,2) NULL', 'budget_value');
  await addColumnIfMissing('rfqs', 'scoring_weight_config JSON NULL', 'scoring_weight_config');

  // item_id (FK to item master) is already covered by rfq_line_items.item_master_id (added in migrate-v2.js)
  await addColumnIfMissing('rfq_line_items', 'technical_specifications JSON NULL', 'technical_specifications');
  await addColumnIfMissing('rfq_line_items', 'delivery_location_id VARCHAR(36) NULL', 'delivery_location_id');
  await addColumnIfMissing('rfq_line_items', 'required_delivery_date DATE NULL', 'required_delivery_date');

  await addColumnIfMissing('vendor_bids', 'taxes_included_flag BOOLEAN DEFAULT FALSE', 'taxes_included_flag');
  await addColumnIfMissing('vendor_bids', 'offered_payment_terms VARCHAR(100) NULL', 'offered_payment_terms');
  await addColumnIfMissing('vendor_bids', 'warranty_period VARCHAR(100) NULL', 'warranty_period');
  await addColumnIfMissing('vendor_bids', 'deviation_flag BOOLEAN DEFAULT FALSE', 'deviation_flag');
  await addColumnIfMissing('vendor_bids', 'tco_value DECIMAL(15,2) NULL', 'tco_value');

  // ─── 7. TICKETS — missing fields only (sla_* covered by global section) ─
  await addColumnIfMissing('tickets', 'category VARCHAR(100) NULL', 'category');
  await addColumnIfMissing('tickets', 'root_cause TEXT NULL', 'root_cause');
  await addColumnIfMissing('tickets', 'resolution_type VARCHAR(100) NULL', 'resolution_type');
  await addColumnIfMissing('tickets', 'attachment_group_id VARCHAR(36) NULL', 'attachment_group_id');

  // ─── 8. AUDIT MODULE — missing fields only ─────────────────────────────
  await addColumnIfMissing('audit_executions', 'audit_score DECIMAL(5,2) NULL', 'audit_score');
  await addColumnIfMissing('audit_executions', 'compliance_percentage DECIMAL(5,2) NULL', 'compliance_percentage');
  await addColumnIfMissing('audit_executions', 'auditor_user_id VARCHAR(36) NULL', 'auditor_user_id');
  await addColumnIfMissing('audit_executions', 'evidence_attachment_group VARCHAR(36) NULL', 'evidence_attachment_group');
  await addColumnIfMissing('audit_findings', 'capa_action_owner VARCHAR(255) NULL', 'capa_action_owner');
  await addColumnIfMissing('audit_findings', 'capa_due_date DATE NULL', 'capa_due_date');
  await addColumnIfMissing('audit_findings', 'capa_closure_date DATE NULL', 'capa_closure_date');

  // ─── 9. RISK MODULE — missing fields only ──────────────────────────────
  await addColumnIfMissing('vendor_risk_scores', "risk_trend ENUM('improving','stable','worsening') DEFAULT 'stable'", 'risk_trend');
  await addColumnIfMissing('vendor_risk_scores', 'financial_risk_score DECIMAL(5,2) DEFAULT 0', 'financial_risk_score');
  await addColumnIfMissing('vendor_risk_scores', 'dependency_risk_score DECIMAL(5,2) DEFAULT 0', 'dependency_risk_score');
  await addColumnIfMissing('vendor_risk_scores', 'geographic_risk_score DECIMAL(5,2) DEFAULT 0', 'geographic_risk_score');
  await addColumnIfMissing('vendor_risk_scores', 'esg_risk_score DECIMAL(5,2) DEFAULT 0', 'esg_risk_score');

  // ─── 10. ESG MODULE — missing fields only ──────────────────────────────
  await addColumnIfMissing('vendor_esg', 'carbon_emission_score DECIMAL(5,2) NULL', 'carbon_emission_score');
  await addColumnIfMissing('vendor_esg', 'energy_consumption DECIMAL(15,2) NULL', 'energy_consumption');
  await addColumnIfMissing('vendor_esg', 'waste_management_score DECIMAL(5,2) NULL', 'waste_management_score');
  await addColumnIfMissing('vendor_esg', 'certification_list JSON NULL', 'certification_list');
  await addColumnIfMissing('vendor_esg', 'esg_document_group_id VARCHAR(36) NULL', 'esg_document_group_id');

  // ─── 11. WORKFLOW ENGINE — new tables ───────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_master (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_workflow_module (module_name)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id VARCHAR(36) PRIMARY KEY,
      workflow_id VARCHAR(36) NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(255) NOT NULL,
      approver_role VARCHAR(100) NOT NULL,
      sla_hours INT DEFAULT 24,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflow_master(id) ON DELETE CASCADE,
      UNIQUE KEY uq_workflow_step_order (workflow_id, step_order)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id VARCHAR(36) PRIMARY KEY,
      workflow_id VARCHAR(36) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(36) NOT NULL,
      current_step_id VARCHAR(36) NULL,
      status ENUM('in_progress','approved','rejected','cancelled') DEFAULT 'in_progress',
      initiated_by VARCHAR(36),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflow_master(id),
      FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id),
      INDEX idx_instance_record (module_name, record_id),
      INDEX idx_instance_status (status)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS workflow_logs (
      id VARCHAR(36) PRIMARY KEY,
      instance_id VARCHAR(36) NOT NULL,
      step_id VARCHAR(36) NULL,
      action VARCHAR(50) NOT NULL,
      actor_id VARCHAR(36),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES workflow_steps(id)
    )
  `);

  // ─── 12. DOCUMENT MANAGEMENT — new generic layer ───────────────────────
  // Existing vendor_documents / asns.invoice_pdf_path uploads are untouched;
  // this table is for modules that don't have a dedicated upload table yet
  // (tickets, audit evidence, ESG certifications, etc).
  await connection.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(36) PRIMARY KEY,
      document_group_id VARCHAR(36) NOT NULL,
      module_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(36) NULL,
      file_type VARCHAR(50) NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      uploaded_by VARCHAR(36),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATE NULL,
      verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
      INDEX idx_doc_group (document_group_id),
      INDEX idx_doc_module_record (module_name, record_id)
    )
  `);

  console.log('✅ Gap-fields migration complete');
  await connection.end();
}

migrateGapFields().catch(err => {
  console.error('Gap-fields migration failed:', err);
  process.exit(1);
});
