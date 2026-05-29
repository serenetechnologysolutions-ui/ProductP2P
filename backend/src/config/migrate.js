const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  // Create database
  await connection.query(`CREATE DATABASE IF NOT EXISTS vendor_portal`);
  await connection.query(`USE vendor_portal`);

  // Users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('mdm_admin', 'vendor', 'procurement_admin') NOT NULL,
      vendor_id VARCHAR(36) NULL,
      must_reset_password BOOLEAN DEFAULT TRUE,
      full_name VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Sub masters table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sub_masters (
      id VARCHAR(36) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_category (category)
    )
  `);

  // Vendors table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id VARCHAR(36) PRIMARY KEY,
      vendor_number VARCHAR(50) UNIQUE,
      vendor_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      department VARCHAR(255) NOT NULL,
      supplier_group VARCHAR(255) NOT NULL,
      supplier_category VARCHAR(255) NOT NULL,
      supplier_location VARCHAR(255) NOT NULL,
      status ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'inactive') DEFAULT 'draft',
      rejection_reason TEXT,
      gst_number VARCHAR(15),
      pan_number VARCHAR(10),
      trade_name VARCHAR(255),
      legal_name VARCHAR(255),
      msme_type VARCHAR(100),
      itr_filing_status VARCHAR(100),
      phone1 VARCHAR(20),
      phone2 VARCHAR(20),
      email1 VARCHAR(255),
      email2 VARCHAR(255),
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_email (email)
    )
  `);

  // Vendor addresses
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_addresses (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL,
      line1 VARCHAR(500) NOT NULL,
      line2 VARCHAR(500),
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      country VARCHAR(100) NOT NULL DEFAULT 'India',
      pin_code VARCHAR(10) NOT NULL,
      tags JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);

  // Vendor bank accounts
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL,
      ifsc_code VARCHAR(11) NOT NULL,
      account_number VARCHAR(30) NOT NULL,
      account_holder_name VARCHAR(255) NOT NULL,
      bank_name VARCHAR(255) NOT NULL,
      branch VARCHAR(255) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      country VARCHAR(100) NOT NULL DEFAULT 'India',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);

  // Vendor documents
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_documents (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL,
      doc_type ENUM('pan', 'gst_certificate', 'cin', 'msme_certificate', 'bank_proof', 'other') NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);

  // Purchase orders
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id VARCHAR(36) PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      total_amount DECIMAL(15,2) NOT NULL,
      status ENUM('open', 'partially_fulfilled', 'fulfilled', 'closed') DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      INDEX idx_vendor (vendor_id)
    )
  `);

  // PO line items
  await connection.query(`
    CREATE TABLE IF NOT EXISTS po_line_items (
      id VARCHAR(36) PRIMARY KEY,
      po_id VARCHAR(36) NOT NULL,
      line_number INT NOT NULL,
      description VARCHAR(500) NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      fulfilled_quantity DECIMAL(15,3) DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    )
  `);

  // ASNs
  await connection.query(`
    CREATE TABLE IF NOT EXISTS asns (
      id VARCHAR(36) PRIMARY KEY,
      asn_number VARCHAR(50) UNIQUE,
      vendor_id VARCHAR(36) NOT NULL,
      po_id VARCHAR(36) NOT NULL,
      eta DATE NOT NULL,
      invoice_number VARCHAR(100) NOT NULL,
      total_amount DECIMAL(15,2) NOT NULL,
      invoice_pdf_path VARCHAR(500),
      lr_number VARCHAR(100) NOT NULL,
      transporter_name VARCHAR(255) NOT NULL,
      driver_name VARCHAR(255) NOT NULL,
      driver_number VARCHAR(20),
      reference_doc_path VARCHAR(500),
      excel_attachment_path VARCHAR(500),
      remarks TEXT,
      status ENUM('draft', 'submitted', 'validated', 'posted', 'rejected') DEFAULT 'draft',
      extraction_results JSON,
      validation_result JSON,
      erp_posting_status ENUM('posted', 'failed', 'pending') NULL,
      erp_posting_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_invoice_number (invoice_number),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      INDEX idx_vendor_asn (vendor_id),
      INDEX idx_status_asn (status)
    )
  `);

  // ASN line items
  await connection.query(`
    CREATE TABLE IF NOT EXISTS asn_line_items (
      id VARCHAR(36) PRIMARY KEY,
      asn_id VARCHAR(36) NOT NULL,
      po_line_id VARCHAR(36) NOT NULL,
      line_number INT NOT NULL,
      description VARCHAR(500),
      quantity DECIMAL(15,3) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      FOREIGN KEY (asn_id) REFERENCES asns(id) ON DELETE CASCADE,
      FOREIGN KEY (po_line_id) REFERENCES po_line_items(id)
    )
  `);

  // Extraction configs
  await connection.query(`
    CREATE TABLE IF NOT EXISTS extraction_configs (
      id VARCHAR(36) PRIMARY KEY,
      field_name VARCHAR(100) NOT NULL,
      aliases JSON NOT NULL,
      regex_pattern VARCHAR(500),
      priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ All tables created successfully');
  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
