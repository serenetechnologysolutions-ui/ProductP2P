const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateAdvanced() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  // System settings
  await connection.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id VARCHAR(36) PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Audit checklists
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_checklists (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      created_by VARCHAR(36),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit checklist items
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_checklist_items (
      id VARCHAR(36) PRIMARY KEY,
      checklist_id VARCHAR(36) NOT NULL,
      item_text VARCHAR(500) NOT NULL,
      sequence INT NOT NULL,
      FOREIGN KEY (checklist_id) REFERENCES audit_checklists(id) ON DELETE CASCADE
    )
  `);

  // Audit schedules
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_schedules (
      id VARCHAR(36) PRIMARY KEY,
      checklist_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36),
      vendor_group VARCHAR(255),
      frequency ENUM('one_time', 'monthly', 'quarterly') NOT NULL,
      start_date DATE NOT NULL,
      next_due_date DATE,
      last_run_date DATE,
      status ENUM('planned', 'in_progress', 'completed') DEFAULT 'planned',
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES audit_checklists(id)
    )
  `);

  // Audit executions
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_executions (
      id VARCHAR(36) PRIMARY KEY,
      schedule_id VARCHAR(36) NOT NULL,
      status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      executed_by VARCHAR(36),
      FOREIGN KEY (schedule_id) REFERENCES audit_schedules(id)
    )
  `);

  // Audit responses
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_responses (
      id VARCHAR(36) PRIMARY KEY,
      execution_id VARCHAR(36) NOT NULL,
      checklist_item_id VARCHAR(36) NOT NULL,
      response ENUM('yes', 'no', 'na') NOT NULL,
      remarks TEXT,
      FOREIGN KEY (execution_id) REFERENCES audit_executions(id) ON DELETE CASCADE
    )
  `);

  // Audit findings
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_findings (
      id VARCHAR(36) PRIMARY KEY,
      execution_id VARCHAR(36) NOT NULL,
      description TEXT NOT NULL,
      severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
      status ENUM('open', 'closed') DEFAULT 'open',
      assigned_to VARCHAR(255),
      closed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (execution_id) REFERENCES audit_executions(id)
    )
  `);

  // Tickets
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(36) PRIMARY KEY,
      ticket_number VARCHAR(50) UNIQUE NOT NULL,
      subject VARCHAR(500) NOT NULL,
      description TEXT,
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      status ENUM('initiated', 'in_progress', 'vendor_closed', 'closed') DEFAULT 'initiated',
      created_by VARCHAR(36),
      rating INT,
      closure_remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL
    )
  `);

  // Ticket vendors
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_vendors (
      id VARCHAR(36) PRIMARY KEY,
      ticket_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      status ENUM('open', 'closed') DEFAULT 'open',
      remarks TEXT,
      closed_at TIMESTAMP NULL,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  // Ticket messages
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id VARCHAR(36) PRIMARY KEY,
      ticket_id VARCHAR(36) NOT NULL,
      sender_id VARCHAR(36) NOT NULL,
      sender_role VARCHAR(50),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Vendor risk scores
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_risk_scores (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL UNIQUE,
      risk_score DECIMAL(5,2) DEFAULT 0,
      risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
      delay_score DECIMAL(5,2) DEFAULT 0,
      rejection_score DECIMAL(5,2) DEFAULT 0,
      audit_score DECIMAL(5,2) DEFAULT 0,
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  // Vendor ESG
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_esg (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL UNIQUE,
      diversity_flag BOOLEAN DEFAULT FALSE,
      compliance_status ENUM('compliant', 'non_compliant', 'pending') DEFAULT 'pending',
      remarks TEXT,
      updated_by VARCHAR(36),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  // Price history
  await connection.query(`
    CREATE TABLE IF NOT EXISTS price_history (
      id VARCHAR(36) PRIMARY KEY,
      item_description VARCHAR(500) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      po_id VARCHAR(36),
      unit_price DECIMAL(15,2) NOT NULL,
      quantity DECIMAL(15,3),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      INDEX idx_item (item_description(100))
    )
  `);

  // Add system_admin to users role enum
  await connection.query(`ALTER TABLE users MODIFY COLUMN role ENUM('mdm_admin', 'vendor', 'procurement_admin', 'system_admin') NOT NULL`).catch(() => {});

  console.log('✅ Advanced module tables created successfully');
  await connection.end();
}

migrateAdvanced().catch(err => {
  console.error('Advanced migration failed:', err);
  process.exit(1);
});
