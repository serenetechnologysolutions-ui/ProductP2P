const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Procurement OS expansion — adds the new tables behind Multi-Company,
// Payment Lifecycle, Inventory Integration, the (mocked) SAP Connector,
// the Decision/Next-Best-Action engines, multi-company access, and
// integration/audit logging, all inside the existing app and database per
// explicit product direction (no new services, no message broker — see
// ProcureTrack_Product_Reference.md's Procurement OS section). Every table
// here is purely additive; no existing table is dropped or renamed, only
// (idempotently) extended with a handful of nullable linkage columns.
async function migrateProcurementOs() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  // ─── Module 8: Event-Driven System ─────────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS event_log (
      id VARCHAR(36) PRIMARY KEY,
      event_type VARCHAR(60) NOT NULL,
      module_name VARCHAR(60) NULL,
      record_id VARCHAR(36) NULL,
      payload JSON NULL,
      status ENUM('processed','failed') NOT NULL DEFAULT 'processed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_event_type (event_type),
      INDEX idx_event_record (module_name, record_id),
      INDEX idx_event_created (created_at)
    )
  `);
  console.log('  + event_log table');

  // ─── Module 1: Multi-Company + Intercompany ────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organization_master (
      id VARCHAR(36) PRIMARY KEY,
      org_code VARCHAR(20) NOT NULL UNIQUE,
      org_name VARCHAR(150) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  + organization_master table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_master (
      id VARCHAR(36) PRIMARY KEY,
      organization_id VARCHAR(36) NOT NULL,
      company_code VARCHAR(20) NOT NULL UNIQUE,
      company_name VARCHAR(150) NOT NULL,
      gstin VARCHAR(15) NULL,
      address TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organization_master(id),
      INDEX idx_company_org (organization_id)
    )
  `);
  console.log('  + company_master table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS business_unit_master (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      bu_code VARCHAR(20) NOT NULL,
      bu_name VARCHAR(150) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_master(id),
      UNIQUE KEY uq_bu_company_code (company_id, bu_code)
    )
  `);
  console.log('  + business_unit_master table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_sap_mapping (
      id VARCHAR(36) PRIMARY KEY,
      company_id VARCHAR(36) NOT NULL,
      sap_company_code VARCHAR(20) NOT NULL,
      sap_system_id VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_master(id),
      UNIQUE KEY uq_company_sap (company_id)
    )
  `);
  console.log('  + company_sap_mapping table');

  // Intercompany mirror — a PO raised by Company A against a vendor that is
  // itself one of the organization's own companies creates one of these in
  // the vendor's (Company B's) own books, instead of (or alongside) a real
  // external PO posting.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id VARCHAR(36) PRIMARY KEY,
      so_number VARCHAR(50) NOT NULL UNIQUE,
      selling_company_id VARCHAR(36) NOT NULL,
      buying_company_id VARCHAR(36) NOT NULL,
      source_po_id VARCHAR(36) NOT NULL,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      status ENUM('open','fulfilled','cancelled') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (selling_company_id) REFERENCES company_master(id),
      FOREIGN KEY (buying_company_id) REFERENCES company_master(id),
      FOREIGN KEY (source_po_id) REFERENCES purchase_orders(id),
      INDEX idx_so_source_po (source_po_id)
    )
  `);
  console.log('  + sales_orders table (intercompany mirror)');

  // Seed one default organization + company so every pre-existing PO/PR/etc.
  // has somewhere to point once the columns below go non-null-by-convention
  // (the columns themselves stay nullable — existing rows are simply left
  // unset rather than force-backfilled, since there is no real multi-company
  // data to assign them to).
  const [orgRows] = await connection.query("SELECT id FROM organization_master WHERE org_code = 'DEFAULT'");
  let defaultOrgId = orgRows[0]?.id;
  if (!defaultOrgId) {
    defaultOrgId = uuidv4();
    await connection.query('INSERT INTO organization_master (id, org_code, org_name) VALUES (?, ?, ?)', [defaultOrgId, 'DEFAULT', 'Default Organization']);
    console.log('  + seeded default organization');
  }
  const [coRows] = await connection.query("SELECT id FROM company_master WHERE company_code = 'DEFAULT'");
  if (coRows.length === 0) {
    await connection.query(
      'INSERT INTO company_master (id, organization_id, company_code, company_name) VALUES (?, ?, ?, ?)',
      [uuidv4(), defaultOrgId, 'DEFAULT', 'Default Company']
    );
    console.log('  + seeded default company');
  }

  // Additive linkage columns — every one nullable, so this never breaks an
  // existing insert/update that doesn't pass them.
  const addColumn = async (table, def) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${def}`);
      console.log(`  + ${table}.${def.split(' ')[0]}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  };
  for (const table of ['purchase_requisitions', 'purchase_orders', 'asns']) {
    await addColumn(table, 'organization_id VARCHAR(36) NULL');
    await addColumn(table, 'company_id VARCHAR(36) NULL');
    await addColumn(table, 'business_unit_id VARCHAR(36) NULL');
  }
  // Marks a vendor as one of the organization's own companies — set, this
  // triggers the intercompany mirror above instead of (or alongside) treating
  // the PO as a normal external purchase.
  await addColumn('vendors', 'internal_company_id VARCHAR(36) NULL');

  // ─── Module 2: Payment Lifecycle ───────────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payment_schedule (
      id VARCHAR(36) PRIMARY KEY,
      invoice_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      due_date DATE NOT NULL,
      scheduled_amount DECIMAL(15,2) NOT NULL,
      paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      status ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      INDEX idx_pay_sched_vendor (vendor_id),
      INDEX idx_pay_sched_due (due_date),
      INDEX idx_pay_sched_status (status)
    )
  `);
  console.log('  + payment_schedule table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY,
      payment_number VARCHAR(50) NOT NULL UNIQUE,
      payment_schedule_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method ENUM('bank_transfer','cheque','other') NOT NULL DEFAULT 'bank_transfer',
      status ENUM('processing','completed','failed','reconciled') NOT NULL DEFAULT 'processing',
      bank_reference VARCHAR(100) NULL,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedule(id),
      INDEX idx_payments_vendor (vendor_id),
      INDEX idx_payments_status (status)
    )
  `);
  console.log('  + payments table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_ledger (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL,
      transaction_type ENUM('invoice','payment') NOT NULL,
      reference_id VARCHAR(36) NOT NULL,
      debit DECIMAL(15,2) NOT NULL DEFAULT 0,
      credit DECIMAL(15,2) NOT NULL DEFAULT 0,
      running_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
      transaction_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ledger_vendor (vendor_id),
      INDEX idx_ledger_date (transaction_date)
    )
  `);
  console.log('  + vendor_ledger table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS cashflow_projection (
      id VARCHAR(36) PRIMARY KEY,
      bucket_date DATE NOT NULL,
      expected_outflow DECIMAL(15,2) NOT NULL DEFAULT 0,
      schedule_count INT NOT NULL DEFAULT 0,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cashflow_bucket (bucket_date)
    )
  `);
  console.log('  + cashflow_projection table');

  // ─── Module 3: Inventory Integration ───────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id VARCHAR(36) PRIMARY KEY,
      warehouse_code VARCHAR(20) NOT NULL UNIQUE,
      warehouse_name VARCHAR(150) NOT NULL,
      location VARCHAR(255) NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  + warehouses table');

  const [whRows] = await connection.query("SELECT id FROM warehouses WHERE warehouse_code = 'DEFAULT'");
  if (whRows.length === 0) {
    await connection.query('INSERT INTO warehouses (id, warehouse_code, warehouse_name) VALUES (?, ?, ?)', [uuidv4(), 'DEFAULT', 'Default Warehouse']);
    console.log('  + seeded default warehouse');
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_stock (
      id VARCHAR(36) PRIMARY KEY,
      warehouse_id VARCHAR(36) NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      quantity_on_hand DECIMAL(15,3) NOT NULL DEFAULT 0,
      reorder_level DECIMAL(15,3) NOT NULL DEFAULT 0,
      reorder_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      UNIQUE KEY uq_stock_warehouse_item (warehouse_id, item_master_id)
    )
  `);
  console.log('  + inventory_stock table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id VARCHAR(36) PRIMARY KEY,
      warehouse_id VARCHAR(36) NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      movement_type ENUM('in','out') NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      reference_type ENUM('grn','consumption','adjustment') NOT NULL,
      reference_id VARCHAR(36) NULL,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      INDEX idx_stock_mv_item (item_master_id),
      INDEX idx_stock_mv_ref (reference_type, reference_id)
    )
  `);
  console.log('  + stock_movements table');

  // ─── Module 4/11/12: SAP Connector (mocked), Retry/DLQ, Logging ───────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS integration_logs (
      id VARCHAR(36) PRIMARY KEY,
      integration_type VARCHAR(60) NOT NULL,
      direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
      record_id VARCHAR(36) NULL,
      request_payload JSON NULL,
      response_payload JSON NULL,
      status ENUM('success','failed','retrying') NOT NULL,
      attempt_count INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_int_log_type (integration_type),
      INDEX idx_int_log_record (record_id),
      INDEX idx_int_log_status (status)
    )
  `);
  console.log('  + integration_logs table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS integration_dlq (
      id VARCHAR(36) PRIMARY KEY,
      integration_type VARCHAR(60) NOT NULL,
      record_id VARCHAR(36) NULL,
      payload JSON NULL,
      error_message TEXT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      resolved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dlq_type (integration_type),
      INDEX idx_dlq_resolved (resolved)
    )
  `);
  console.log('  + integration_dlq table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      actor_id VARCHAR(36) NULL,
      action VARCHAR(60) NOT NULL,
      module_name VARCHAR(60) NOT NULL,
      record_id VARCHAR(36) NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_module_record (module_name, record_id),
      INDEX idx_audit_actor (actor_id)
    )
  `);
  console.log('  + audit_logs table');

  // ─── Module 6: Decision Engine expansion ───────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS decision_rules (
      id VARCHAR(36) PRIMARY KEY,
      rule_name VARCHAR(150) NOT NULL,
      module_name ENUM('pr','rfq','po','invoice') NOT NULL,
      conditions JSON NULL,
      output_type ENUM('best_vendor','risk_alert','budget_alert','cost_insight') NOT NULL,
      output_template JSON NULL,
      priority INT NOT NULL DEFAULT 100,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_decision_rules_module (module_name, is_active)
    )
  `);
  console.log('  + decision_rules table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS decision_outputs (
      id VARCHAR(36) PRIMARY KEY,
      rule_id VARCHAR(36) NOT NULL,
      module_name VARCHAR(60) NOT NULL,
      record_id VARCHAR(36) NOT NULL,
      output JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES decision_rules(id),
      INDEX idx_decision_outputs_record (module_name, record_id)
    )
  `);
  console.log('  + decision_outputs table');

  // ─── Module 7: Next Best Action engine ─────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS action_rules (
      id VARCHAR(36) PRIMARY KEY,
      rule_name VARCHAR(150) NOT NULL,
      trigger_event VARCHAR(60) NOT NULL,
      conditions JSON NULL,
      recommended_action VARCHAR(150) NOT NULL,
      action_payload JSON NULL,
      priority INT NOT NULL DEFAULT 100,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action_rules_trigger (trigger_event, is_active)
    )
  `);
  console.log('  + action_rules table');

  // ─── Module 10: Security & multi-company Access ────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_company_access (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      company_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES company_master(id),
      UNIQUE KEY uq_user_company (user_id, company_id)
    )
  `);
  console.log('  + user_company_access table');

  console.log('✅ Procurement OS expansion migration complete');
  await connection.end();
}

migrateProcurementOs().catch(err => {
  console.error('Procurement OS migration failed:', err);
  process.exit(1);
});
