const mysql = require('mysql2/promise');
require('dotenv').config();

// Purchase Requisition (PR) module: new PR/line-item/approval-rule/budget/contract
// tables, plus the reverse-FK columns on rfq_line_items/po_line_items/rfqs/
// purchase_orders that let a PR line item trace forward into every RFQ/PO it
// was ever (partially) converted into. Safe to re-run.
async function migratePR() {
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

  // ─── 1. CONTRACTS — minimal master so CONTRACT_BASED sourcing has a real
  // vendor + payment terms + validity window to pull from ──────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id VARCHAR(36) PRIMARY KEY,
      contract_number VARCHAR(50) UNIQUE NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      payment_terms VARCHAR(100) NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      contract_value DECIMAL(15,2) NULL,
      status ENUM('active','expired','terminated') DEFAULT 'active',
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      INDEX idx_contract_vendor (vendor_id),
      INDEX idx_contract_status (status)
    )
  `);

  // ─── 2. BUDGET ALLOCATIONS — lightweight cost-center budget tracking ────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS budget_allocations (
      id VARCHAR(36) PRIMARY KEY,
      cost_center VARCHAR(100) NOT NULL,
      fiscal_year VARCHAR(9) NOT NULL,
      allocated_amount DECIMAL(15,2) NOT NULL,
      consumed_amount DECIMAL(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_budget_cc_year (cost_center, fiscal_year)
    )
  `);

  // ─── 3. PURCHASE REQUISITION HEADER ─────────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_requisitions (
      id VARCHAR(36) PRIMARY KEY,
      pr_number VARCHAR(50) UNIQUE NOT NULL,
      document_type ENUM('Standard','Capex','Service') DEFAULT 'Standard',
      company_code VARCHAR(50) NULL,
      plant VARCHAR(100) NULL,
      department VARCHAR(255) NOT NULL,
      requester_id VARCHAR(36) NOT NULL,
      cost_center VARCHAR(100) NULL,
      project_code VARCHAR(100) NULL,
      account_assignment_category ENUM('Cost Center','Asset','Project') DEFAULT 'Cost Center',
      currency VARCHAR(3) DEFAULT 'INR',
      required_date DATE NULL,
      priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
      justification TEXT NOT NULL,
      sourcing_strategy ENUM('RFQ_REQUIRED','DIRECT_PO_ALLOWED','AUTO_PO','CONTRACT_BASED') DEFAULT 'RFQ_REQUIRED',
      preferred_vendor_id VARCHAR(36) NULL,
      contract_id VARCHAR(36) NULL,
      status ENUM('draft','submitted','approved','partially_approved','sourcing','closed','rejected') DEFAULT 'draft',
      total_value DECIMAL(15,2) DEFAULT 0,
      budget_status ENUM('within_budget','exceeds_budget','not_configured') DEFAULT 'not_configured',
      rejection_reason TEXT NULL,
      approval_workflow_id VARCHAR(36) NULL,
      workflow_instance_id VARCHAR(36) NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (preferred_vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      INDEX idx_pr_status (status),
      INDEX idx_pr_department (department),
      INDEX idx_pr_created_by (created_by)
    )
  `);

  // ─── 4. PR LINE ITEMS ────────────────────────────────────────────────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS pr_line_items (
      id VARCHAR(36) PRIMARY KEY,
      pr_id VARCHAR(36) NOT NULL,
      sequence INT NOT NULL,
      item_master_id VARCHAR(36) NULL,
      description VARCHAR(500) NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      uom VARCHAR(50) DEFAULT 'Nos',
      estimated_unit_price DECIMAL(15,2) NULL,
      estimated_total_price DECIMAL(15,2) NULL,
      delivery_date DATE NULL,
      delivery_location VARCHAR(255) NULL,
      plant VARCHAR(100) NULL,
      storage_location VARCHAR(100) NULL,
      gr_required BOOLEAN DEFAULT TRUE,
      ir_required BOOLEAN DEFAULT TRUE,
      partial_delivery_allowed BOOLEAN DEFAULT TRUE,
      account_assignment_details JSON NULL,
      preferred_vendor_id VARCHAR(36) NULL,
      consumed_quantity DECIMAL(15,3) DEFAULT 0,
      remaining_quantity DECIMAL(15,3) NULL,
      FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_master_id) REFERENCES item_master(id)
    )
  `);

  // ─── 5. PR APPROVAL RULES — value/department/type → workflow ───────────
  await connection.query(`
    CREATE TABLE IF NOT EXISTS pr_approval_rules (
      id VARCHAR(36) PRIMARY KEY,
      document_type VARCHAR(50) NULL,
      department VARCHAR(255) NULL,
      min_value DECIMAL(15,2) NULL,
      max_value DECIMAL(15,2) NULL,
      workflow_id VARCHAR(36) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflow_master(id)
    )
  `);

  // ─── 6. PR AUDIT LOG — create/edit/submit/approve/reject/convert trail ──
  // workflow_logs already captures step approve/reject; this fills the gap
  // for the actions that happen outside the step-advance flow.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS pr_audit_log (
      id VARCHAR(36) PRIMARY KEY,
      pr_id VARCHAR(36) NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_id VARCHAR(36),
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) ON DELETE CASCADE
    )
  `);

  // ─── 7. REVERSE-FK COLUMNS — PR line traceability into RFQ/PO ──────────
  await addColumnIfMissing('rfqs', 'pr_id VARCHAR(36) NULL', 'pr_id');
  await addColumnIfMissing('rfq_line_items', 'pr_line_item_id VARCHAR(36) NULL', 'pr_line_item_id');
  await addColumnIfMissing('purchase_orders', 'pr_id VARCHAR(36) NULL', 'pr_id');
  await addColumnIfMissing('po_line_items', 'pr_line_item_id VARCHAR(36) NULL', 'pr_line_item_id');

  // ─── 8. PO HEADER ALIGNMENT — same org/account-assignment fields as PR ──
  await addColumnIfMissing('purchase_orders', 'department VARCHAR(255) NULL', 'department');
  await addColumnIfMissing('purchase_orders', 'account_assignment_category VARCHAR(50) NULL', 'account_assignment_category');
  await addColumnIfMissing('purchase_orders', 'account_assignment_details JSON NULL', 'account_assignment_details');
  await addColumnIfMissing('purchase_orders', 'company_code VARCHAR(50) NULL', 'company_code');
  await addColumnIfMissing('purchase_orders', 'plant VARCHAR(100) NULL', 'plant');
  await addColumnIfMissing('purchase_orders', 'requester_id VARCHAR(36) NULL', 'requester_id');

  console.log('✅ PR module migration complete');
  await connection.end();
}

migratePR().catch(err => {
  console.error('PR migration failed:', err);
  process.exit(1);
});
