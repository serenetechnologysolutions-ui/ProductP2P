const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateBatchInventoryErp() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');
  console.log('Batch Inventory ERP migration starting...');

  // Helper for idempotent column adds
  const addColumn = async (table, def) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${def}`);
      console.log(`  + ${table}.${def.split(' ')[0]}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  };

  // ─── 1. inventory_batches ─────────────────────────────────────────────
  console.log('\n[1/6] Creating inventory_batches...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_batches (
      id VARCHAR(36) PRIMARY KEY,
      batch_number VARCHAR(100) UNIQUE NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      grn_id VARCHAR(36) NOT NULL,
      grn_line_item_id VARCHAR(36) NOT NULL,
      location_id VARCHAR(36) NOT NULL,
      qty_received DECIMAL(15,3) NOT NULL,
      qty_available DECIMAL(15,3) NOT NULL DEFAULT 0,
      rate DECIMAL(15,2) NOT NULL DEFAULT 0,
      discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('active','exhausted') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id),
      FOREIGN KEY (grn_line_item_id) REFERENCES grn_line_items(id),
      FOREIGN KEY (location_id) REFERENCES warehouses(id),
      INDEX idx_batch_item (item_master_id),
      INDEX idx_batch_location (location_id),
      INDEX idx_batch_grn (grn_id),
      INDEX idx_batch_status (status)
    )
  `);
  console.log('  + inventory_batches table');

  // ─── 2. purchase_returns ──────────────────────────────────────────────
  console.log('\n[2/6] Creating purchase_returns...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id VARCHAR(36) PRIMARY KEY,
      return_number VARCHAR(50) UNIQUE NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      grn_id VARCHAR(36) NOT NULL,
      asn_number VARCHAR(50) NULL,
      return_date DATE NOT NULL,
      return_reason TEXT NOT NULL,
      status ENUM('draft','confirmed','closed') NOT NULL DEFAULT 'draft',
      round_off DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      created_by VARCHAR(36) NULL,
      confirmed_by VARCHAR(36) NULL,
      confirmed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id),
      INDEX idx_pr_vendor (vendor_id),
      INDEX idx_pr_status (status),
      INDEX idx_pr_date (return_date)
    )
  `);
  console.log('  + purchase_returns table');

  // ─── 3. purchase_return_line_items ────────────────────────────────────
  console.log('\n[3/6] Creating purchase_return_line_items...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_return_line_items (
      id VARCHAR(36) PRIMARY KEY,
      purchase_return_id VARCHAR(36) NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      batch_id VARCHAR(36) NOT NULL,
      batch_number VARCHAR(100) NOT NULL,
      location_id VARCHAR(36) NOT NULL,
      return_quantity DECIMAL(15,3) NOT NULL,
      rate DECIMAL(15,2) NOT NULL,
      discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      line_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
      FOREIGN KEY (location_id) REFERENCES warehouses(id),
      INDEX idx_prli_return (purchase_return_id),
      INDEX idx_prli_batch (batch_id)
    )
  `);
  console.log('  + purchase_return_line_items table');

  // ─── 4. branch_orders ─────────────────────────────────────────────────
  console.log('\n[4/6] Creating branch_orders...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS branch_orders (
      id VARCHAR(36) PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      from_location_id VARCHAR(36) NOT NULL,
      to_location_id VARCHAR(36) NOT NULL,
      requesting_branch VARCHAR(36) NOT NULL,
      request_type VARCHAR(100) NOT NULL,
      request_date DATE NOT NULL,
      status ENUM('created','approved','in_transit','received') NOT NULL DEFAULT 'created',
      remarks TEXT NULL,
      created_by VARCHAR(36) NULL,
      approved_by VARCHAR(36) NULL,
      approved_at TIMESTAMP NULL,
      dispatched_at TIMESTAMP NULL,
      received_at TIMESTAMP NULL,
      received_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (from_location_id) REFERENCES warehouses(id),
      FOREIGN KEY (to_location_id) REFERENCES warehouses(id),
      FOREIGN KEY (requesting_branch) REFERENCES warehouses(id),
      INDEX idx_bo_status (status),
      INDEX idx_bo_from (from_location_id),
      INDEX idx_bo_to (to_location_id)
    )
  `);
  console.log('  + branch_orders table');

  // ─── 5. branch_order_line_items ───────────────────────────────────────
  console.log('\n[5/6] Creating branch_order_line_items...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS branch_order_line_items (
      id VARCHAR(36) PRIMARY KEY,
      branch_order_id VARCHAR(36) NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      requested_quantity DECIMAL(15,3) NOT NULL,
      approved_quantity DECIMAL(15,3) NULL,
      received_quantity DECIMAL(15,3) NULL,
      variance DECIMAL(15,3) NULL,
      FOREIGN KEY (branch_order_id) REFERENCES branch_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      INDEX idx_boli_order (branch_order_id)
    )
  `);
  console.log('  + branch_order_line_items table');

  // ─── 6. in_transit_stock ──────────────────────────────────────────────
  console.log('\n[6/6] Creating in_transit_stock...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS in_transit_stock (
      id VARCHAR(36) PRIMARY KEY,
      branch_order_id VARCHAR(36) NOT NULL,
      branch_order_line_id VARCHAR(36) NOT NULL,
      item_master_id VARCHAR(36) NOT NULL,
      from_location_id VARCHAR(36) NOT NULL,
      to_location_id VARCHAR(36) NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branch_order_id) REFERENCES branch_orders(id),
      FOREIGN KEY (branch_order_line_id) REFERENCES branch_order_line_items(id),
      FOREIGN KEY (item_master_id) REFERENCES item_master(id),
      FOREIGN KEY (from_location_id) REFERENCES warehouses(id),
      FOREIGN KEY (to_location_id) REFERENCES warehouses(id),
      INDEX idx_its_order (branch_order_id),
      INDEX idx_its_item (item_master_id)
    )
  `);
  console.log('  + in_transit_stock table');

  // ─── Extend stock_movements ───────────────────────────────────────────
  console.log('\n[+] Extending stock_movements...');
  await addColumn('stock_movements', 'batch_id VARCHAR(36) NULL');

  // Extend ENUMs (MySQL requires full redefinition)
  try {
    await connection.query(`ALTER TABLE stock_movements MODIFY COLUMN movement_type ENUM('in','out','batch_in','return_out','transfer_out','transfer_in','consumption') NOT NULL`);
    console.log('  + stock_movements.movement_type ENUM extended');
  } catch (err) { console.log('  ~ movement_type ENUM already extended or unchanged'); }

  try {
    await connection.query(`ALTER TABLE stock_movements MODIFY COLUMN reference_type ENUM('grn','consumption','adjustment','batch','purchase_return','branch_order') NOT NULL`);
    console.log('  + stock_movements.reference_type ENUM extended');
  } catch (err) { console.log('  ~ reference_type ENUM already extended or unchanged'); }

  console.log('\n✅ Batch Inventory ERP migration complete');
  await connection.end();
}

migrateBatchInventoryErp().catch(err => {
  console.error('Batch Inventory ERP migration failed:', err);
  process.exit(1);
});
