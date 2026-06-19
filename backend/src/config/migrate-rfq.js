const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateRfq() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS rfqs (
      id VARCHAR(36) PRIMARY KEY,
      rfq_number VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      created_by VARCHAR(36),
      submission_deadline DATETIME NOT NULL,
      status ENUM('draft', 'published', 'closed', 'awarded') DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_rfq_status (status)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS rfq_vendors (
      id VARCHAR(36) PRIMARY KEY,
      rfq_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      participation_status ENUM('invited', 'submitted', 'not_responded') DEFAULT 'invited',
      invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      UNIQUE KEY uq_rfq_vendor (rfq_id, vendor_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS rfq_line_items (
      id VARCHAR(36) PRIMARY KEY,
      rfq_id VARCHAR(36) NOT NULL,
      item_description VARCHAR(500) NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      uom VARCHAR(50) DEFAULT 'Nos',
      target_price DECIMAL(15,2) NULL,
      sequence INT NOT NULL,
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_bids (
      id VARCHAR(36) PRIMARY KEY,
      rfq_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      total_value DECIMAL(15,2),
      remarks TEXT,
      status ENUM('submitted', 'revised') DEFAULT 'submitted',
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      UNIQUE KEY uq_rfq_bid (rfq_id, vendor_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_bid_items (
      id VARCHAR(36) PRIMARY KEY,
      bid_id VARCHAR(36) NOT NULL,
      rfq_line_item_id VARCHAR(36) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      lead_time_days INT,
      remarks TEXT,
      FOREIGN KEY (bid_id) REFERENCES vendor_bids(id) ON DELETE CASCADE,
      FOREIGN KEY (rfq_line_item_id) REFERENCES rfq_line_items(id)
    )
  `);

  console.log('✅ RFQ module tables created successfully');
  await connection.end();
}

migrateRfq().catch(err => {
  console.error('RFQ migration failed:', err);
  process.exit(1);
});
