const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

async function seed() {
  const conn = await pool.getConnection();
  try {
    // ─── SUB MASTERS ───
    const subMasters = [
      { category: 'company', name: 'Serene Technology' },
      { category: 'company', name: 'ABC Corp' },
      { category: 'company', name: 'XYZ Industries' },
      { category: 'company', name: 'Global Traders' },
      { category: 'department', name: 'Procurement' },
      { category: 'department', name: 'Finance' },
      { category: 'department', name: 'Operations' },
      { category: 'department', name: 'Logistics' },
      { category: 'supplier_group', name: 'Raw Materials' },
      { category: 'supplier_group', name: 'Services' },
      { category: 'supplier_group', name: 'Equipment' },
      { category: 'supplier_group', name: 'Packaging' },
      { category: 'supplier_category', name: 'Tier 1' },
      { category: 'supplier_category', name: 'Tier 2' },
      { category: 'supplier_category', name: 'Tier 3' },
      { category: 'country', name: 'India' },
      { category: 'country', name: 'USA' },
      { category: 'country', name: 'UK' },
      { category: 'state', name: 'Maharashtra' },
      { category: 'state', name: 'Karnataka' },
      { category: 'state', name: 'Tamil Nadu' },
      { category: 'state', name: 'Delhi' },
      { category: 'state', name: 'Gujarat' },
      { category: 'state', name: 'Rajasthan' },
      { category: 'city', name: 'Mumbai' },
      { category: 'city', name: 'Pune' },
      { category: 'city', name: 'Bangalore' },
      { category: 'city', name: 'Chennai' },
      { category: 'city', name: 'Delhi' },
      { category: 'city', name: 'Ahmedabad' },
      { category: 'city', name: 'Jaipur' },
      { category: 'city', name: 'Hyderabad' },
    ];

    for (const sm of subMasters) {
      const [existing] = await conn.query('SELECT id FROM sub_masters WHERE category = ? AND name = ?', [sm.category, sm.name]);
      if (existing.length === 0) {
        await conn.query('INSERT INTO sub_masters (id, category, name) VALUES (?, ?, ?)', [uuidv4(), sm.category, sm.name]);
      }
    }

    // ─── ADMIN USERS ───
    const [adminExists] = await conn.query("SELECT id FROM users WHERE email = 'admin@vendorportal.com'");
    let adminId;
    if (adminExists.length === 0) {
      adminId = uuidv4();
      const hash = await bcrypt.hash('Admin@123', 10);
      await conn.query('INSERT INTO users (id, email, password_hash, role, must_reset_password, full_name) VALUES (?, ?, ?, ?, ?, ?)', [adminId, 'admin@vendorportal.com', hash, 'mdm_admin', false, 'System Admin']);
    } else { adminId = adminExists[0].id; }

    const [procExists] = await conn.query("SELECT id FROM users WHERE email = 'procurement@vendorportal.com'");
    if (procExists.length === 0) {
      const hash = await bcrypt.hash('Proc@123', 10);
      await conn.query('INSERT INTO users (id, email, password_hash, role, must_reset_password, full_name) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), 'procurement@vendorportal.com', hash, 'procurement_admin', false, 'Procurement Admin']);
    }

    // ─── SAMPLE VENDORS ───
    const vendors = [
      { name: 'Tata Steel Ltd', email: 'vendor1@tatasteel.com', phone: '9876543210', company: 'Serene Technology', dept: 'Procurement', group: 'Raw Materials', category: 'Tier 1', location: 'Mumbai', status: 'approved', gst: '27AAACT2727Q1ZV', pan: 'AAACT2727Q' },
      { name: 'Reliance Industries', email: 'vendor2@reliance.com', phone: '9876543211', company: 'ABC Corp', dept: 'Operations', group: 'Raw Materials', category: 'Tier 1', location: 'Mumbai', status: 'approved', gst: '27AABCR1234A1Z5', pan: 'AABCR1234A' },
      { name: 'Infosys Technologies', email: 'vendor3@infosys.com', phone: '9876543212', company: 'XYZ Industries', dept: 'Finance', group: 'Services', category: 'Tier 1', location: 'Bangalore', status: 'approved', gst: '29AABCI1234B1Z6', pan: 'AABCI1234B' },
      { name: 'Mahindra Logistics', email: 'vendor4@mahindra.com', phone: '9876543213', company: 'Global Traders', dept: 'Logistics', group: 'Services', category: 'Tier 2', location: 'Pune', status: 'submitted', gst: '27AABCM5678C1Z7', pan: 'AABCM5678C' },
      { name: 'Hindustan Packaging', email: 'vendor5@hinpack.com', phone: '9876543214', company: 'Serene Technology', dept: 'Operations', group: 'Packaging', category: 'Tier 2', location: 'Chennai', status: 'under_review', gst: '33AABCH9012D1Z8', pan: 'AABCH9012D' },
      { name: 'Bharat Electronics', email: 'vendor6@bel.com', phone: '9876543215', company: 'ABC Corp', dept: 'Procurement', group: 'Equipment', category: 'Tier 1', location: 'Bangalore', status: 'draft', gst: null, pan: null },
      { name: 'Godrej Industries', email: 'vendor7@godrej.com', phone: '9876543216', company: 'XYZ Industries', dept: 'Finance', group: 'Raw Materials', category: 'Tier 2', location: 'Mumbai', status: 'rejected', gst: '27AABCG3456E1Z9', pan: 'AABCG3456E' },
      { name: 'Larsen & Toubro', email: 'vendor8@lnt.com', phone: '9876543217', company: 'Global Traders', dept: 'Operations', group: 'Equipment', category: 'Tier 1', location: 'Mumbai', status: 'approved', gst: '27AABCL7890F1Z0', pan: 'AABCL7890F' },
    ];

    const vendorIds = [];
    for (const v of vendors) {
      const [existing] = await conn.query('SELECT id FROM vendors WHERE email = ?', [v.email]);
      if (existing.length === 0) {
        const vid = uuidv4();
        vendorIds.push(vid);
        const vnum = 'VND-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await conn.query(
          'INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, gst_number, pan_number, trade_name, legal_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [vid, vnum, v.name, v.email, v.phone, v.company, v.dept, v.group, v.category, v.location, v.status, v.gst, v.pan, v.name, v.name + ' Pvt Ltd', adminId]
        );
        // Create vendor user account — or, if a login with this email
        // already exists (e.g. vendors was truncated/reseeded but users
        // wasn't), repoint it at the freshly (re)created vendor row instead
        // of trying to insert a second account with the same email.
        const [existingUser] = await conn.query('SELECT id FROM users WHERE email = ?', [v.email]);
        if (existingUser.length === 0) {
          const hash = await bcrypt.hash('Vendor@123', 10);
          await conn.query('INSERT INTO users (id, email, password_hash, role, vendor_id, must_reset_password, full_name) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), v.email, hash, 'vendor', vid, false, v.name]);
        } else {
          await conn.query('UPDATE users SET vendor_id = ? WHERE id = ?', [vid, existingUser[0].id]);
        }

        // Add addresses for approved vendors
        if (v.status === 'approved') {
          await conn.query('INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), vid, '123 Industrial Area, Phase 2', 'Near Highway Junction', v.location, 'Maharashtra', 'India', '400001', JSON.stringify(['billing', 'registered'])]);
          await conn.query('INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), vid, '456 Warehouse Complex', 'Sector 5', v.location, 'Maharashtra', 'India', '400002', JSON.stringify(['shipping'])]);
        }

        // Add bank accounts for approved vendors
        if (v.status === 'approved') {
          await conn.query('INSERT INTO vendor_bank_accounts (id, vendor_id, ifsc_code, account_number, account_holder_name, bank_name, branch, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), vid, 'SBIN0001234', '1234567890' + Math.floor(Math.random() * 100), v.name, 'State Bank of India', 'Main Branch', v.location, 'Maharashtra', 'India']);
        }
      } else {
        vendorIds.push(existing[0].id);
      }
    }

    // Add rejection reason for rejected vendor
    await conn.query("UPDATE vendors SET rejection_reason = 'Incomplete GST documentation. Please re-upload valid GST certificate and resubmit.' WHERE status = 'rejected' AND rejection_reason IS NULL");

    // ─── PURCHASE ORDERS ───
    const approvedVendorIds = [];
    const [approvedVendors] = await conn.query("SELECT id FROM vendors WHERE status = 'approved'");
    approvedVendors.forEach(v => approvedVendorIds.push(v.id));

    const poData = [
      { number: 'PO-2024-001', vendorIdx: 0, amount: 250000, items: [{ desc: 'Steel Plates 10mm', qty: 100, price: 1500, amt: 150000 }, { desc: 'Steel Rods 8mm', qty: 200, price: 500, amt: 100000 }] },
      { number: 'PO-2024-002', vendorIdx: 1, amount: 180000, items: [{ desc: 'Polymer Granules Grade A', qty: 500, price: 200, amt: 100000 }, { desc: 'Chemical Solvent X', qty: 400, price: 200, amt: 80000 }] },
      { number: 'PO-2024-003', vendorIdx: 2, amount: 500000, items: [{ desc: 'IT Consulting Services', qty: 1, price: 300000, amt: 300000 }, { desc: 'Software License Annual', qty: 1, price: 200000, amt: 200000 }] },
      { number: 'PO-2024-004', vendorIdx: 0, amount: 75000, items: [{ desc: 'Welding Electrodes', qty: 500, price: 100, amt: 50000 }, { desc: 'Safety Equipment', qty: 50, price: 500, amt: 25000 }] },
      { number: 'PO-2024-005', vendorIdx: 3, amount: 320000, items: [{ desc: 'CNC Machine Parts', qty: 10, price: 20000, amt: 200000 }, { desc: 'Hydraulic Pumps', qty: 4, price: 30000, amt: 120000 }] },
    ];

    const poIds = [];
    for (const po of poData) {
      if (!approvedVendorIds[po.vendorIdx]) continue;
      const [existing] = await conn.query('SELECT id FROM purchase_orders WHERE po_number = ?', [po.number]);
      if (existing.length === 0) {
        const poId = uuidv4();
        poIds.push(poId);
        await conn.query('INSERT INTO purchase_orders (id, po_number, vendor_id, total_amount, status) VALUES (?, ?, ?, ?, ?)',
          [poId, po.number, approvedVendorIds[po.vendorIdx], po.amount, 'open']);
        for (let i = 0; i < po.items.length; i++) {
          const item = po.items[i];
          await conn.query('INSERT INTO po_line_items (id, po_id, line_number, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), poId, i + 1, item.desc, item.qty, item.price, item.amt]);
        }
      } else {
        poIds.push(existing[0].id);
      }
    }

    // ─── SAMPLE ASNs ───
    const asnData = [
      { poIdx: 0, vendorIdx: 0, invoice: 'INV-2024-1001', amount: 150000, status: 'posted', lr: 'LR-78901', transporter: 'Blue Dart Express', driver: 'Ramesh Kumar' },
      { poIdx: 0, vendorIdx: 0, invoice: 'INV-2024-1002', amount: 100000, status: 'validated', lr: 'LR-78902', transporter: 'Delhivery', driver: 'Suresh Patel' },
      { poIdx: 1, vendorIdx: 1, invoice: 'INV-2024-2001', amount: 100000, status: 'submitted', lr: 'LR-88001', transporter: 'DTDC Logistics', driver: 'Anil Sharma' },
      { poIdx: 2, vendorIdx: 2, invoice: 'INV-2024-3001', amount: 300000, status: 'posted', lr: 'LR-99001', transporter: 'FedEx India', driver: 'Vijay Singh' },
      { poIdx: 3, vendorIdx: 0, invoice: 'INV-2024-1003', amount: 50000, status: 'submitted', lr: 'LR-78903', transporter: 'Gati Ltd', driver: 'Mohan Das' },
      { poIdx: 4, vendorIdx: 3, invoice: 'INV-2024-5001', amount: 200000, status: 'draft', lr: 'LR-55001', transporter: 'Safexpress', driver: 'Ravi Verma' },
    ];

    for (const asn of asnData) {
      if (!poIds[asn.poIdx] || !approvedVendorIds[asn.vendorIdx]) continue;
      const [existing] = await conn.query('SELECT id FROM asns WHERE invoice_number = ?', [asn.invoice]);
      if (existing.length === 0) {
        const asnId = uuidv4();
        const asnNum = 'ASN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const eta = new Date(Date.now() + Math.random() * 30 * 86400000).toISOString().split('T')[0];
        const erpStatus = asn.status === 'posted' ? 'posted' : null;
        const erpMsg = asn.status === 'posted' ? 'Successfully Posted' : null;

        await conn.query(
          'INSERT INTO asns (id, asn_number, vendor_id, po_id, eta, invoice_number, total_amount, lr_number, transporter_name, driver_name, status, erp_posting_status, erp_posting_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [asnId, asnNum, approvedVendorIds[asn.vendorIdx], poIds[asn.poIdx], eta, asn.invoice, asn.amount, asn.lr, asn.transporter, asn.driver, asn.status, erpStatus, erpMsg]
        );

        // Add line items
        const [poLines] = await conn.query('SELECT id, description, quantity, unit_price, amount FROM po_line_items WHERE po_id = ? LIMIT 1', [poIds[asn.poIdx]]);
        if (poLines.length > 0) {
          const pl = poLines[0];
          const qty = Math.min(pl.quantity, Math.ceil(pl.quantity * 0.6));
          await conn.query('INSERT INTO asn_line_items (id, asn_id, po_line_id, line_number, description, quantity, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), asnId, pl.id, 1, pl.description, qty, qty * pl.unit_price]);
        }
      }
    }

    // ─── EXTRACTION CONFIGS ───
    const configs = [
      { field_name: 'Invoice Number', aliases: ['invoice number', 'invoice no', 'inv no', 'inv. no', 'bill no', 'invoice #'], regex_pattern: '[A-Z0-9\\-/]+', priority: 'high' },
      { field_name: 'Invoice Date', aliases: ['invoice date', 'inv date', 'date', 'bill date', 'dated'], regex_pattern: '\\d{2}[/\\-]\\d{2}[/\\-]\\d{4}', priority: 'high' },
      { field_name: 'Total Amount', aliases: ['total amount', 'total', 'grand total', 'net amount', 'amount payable', 'net payable'], regex_pattern: '[\\d,]+\\.?\\d*', priority: 'high' },
      { field_name: 'GST Number', aliases: ['gstin', 'gst no', 'gst number', 'gst identification'], regex_pattern: '[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}', priority: 'medium' },
      { field_name: 'PO Number', aliases: ['po number', 'purchase order', 'po no', 'po #', 'order number'], regex_pattern: 'PO[\\-/]?\\d+', priority: 'medium' },
      { field_name: 'Quantity', aliases: ['quantity', 'qty', 'total qty', 'units'], regex_pattern: '\\d+', priority: 'low' },
    ];

    for (const cfg of configs) {
      const [existing] = await conn.query('SELECT id FROM extraction_configs WHERE field_name = ?', [cfg.field_name]);
      if (existing.length === 0) {
        await conn.query('INSERT INTO extraction_configs (id, field_name, aliases, regex_pattern, priority) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), cfg.field_name, JSON.stringify(cfg.aliases), cfg.regex_pattern, cfg.priority]);
      }
    }

    console.log('✅ Seed data inserted successfully');
    console.log('   - Sub Masters: ' + subMasters.length + ' entries');
    console.log('   - Vendors: ' + vendors.length + ' (various statuses)');
    console.log('   - Purchase Orders: ' + poData.length);
    console.log('   - ASNs: ' + asnData.length + ' (various statuses)');
    console.log('   - Extraction Configs: ' + configs.length);
    console.log('');
    console.log('   Login credentials:');
    console.log('   Admin:       admin@vendorportal.com / Admin@123');
    console.log('   Procurement: procurement@vendorportal.com / Proc@123');
    console.log('   Vendor:      vendor1@tatasteel.com / Vendor@123');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
