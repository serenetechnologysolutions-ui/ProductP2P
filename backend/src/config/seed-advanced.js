const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

async function seedAdvanced() {
  const conn = await pool.getConnection();
  try {
    // System Admin user
    const [saExists] = await conn.query("SELECT id FROM users WHERE email = 'sysadmin@procuretrack.com'");
    if (saExists.length === 0) {
      const hash = await bcrypt.hash('SysAdmin@123', 12);
      await conn.query('INSERT INTO users (id, email, password_hash, role, must_reset_password, full_name, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), 'sysadmin@procuretrack.com', hash, 'system_admin', false, 'System Administrator', true]);
    }

    // System settings
    const settings = [
      { key: 'module_mode', value: 'advanced' },
      { key: 'modules_audit', value: 'true' },
      { key: 'modules_ticketing', value: 'true' },
      { key: 'modules_risk', value: 'true' },
      { key: 'modules_esg', value: 'true' },
      { key: 'modules_pricing', value: 'true' },
    ];
    for (const s of settings) {
      const [exists] = await conn.query('SELECT id FROM system_settings WHERE setting_key = ?', [s.key]);
      if (exists.length === 0) {
        await conn.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (?, ?, ?)', [uuidv4(), s.key, s.value]);
      }
    }

    // Sample ESG data for approved vendors
    const [vendors] = await conn.query("SELECT id FROM vendors WHERE status = 'approved'");
    for (const v of vendors) {
      const [exists] = await conn.query('SELECT id FROM vendor_esg WHERE vendor_id = ?', [v.id]);
      if (exists.length === 0) {
        const diversity = Math.random() > 0.5;
        const compliance = Math.random() > 0.3 ? 'compliant' : 'non_compliant';
        await conn.query('INSERT INTO vendor_esg (id, vendor_id, diversity_flag, compliance_status, remarks) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), v.id, diversity, compliance, diversity ? 'MSME certified, women-led enterprise' : 'Standard compliance']);
      }
    }

    // Sample risk scores
    for (const v of vendors) {
      const [exists] = await conn.query('SELECT id FROM vendor_risk_scores WHERE vendor_id = ?', [v.id]);
      if (exists.length === 0) {
        const delay = Math.floor(Math.random() * 40);
        const rejection = Math.floor(Math.random() * 30);
        const audit = Math.floor(Math.random() * 20);
        const score = Math.round(delay * 0.4 + rejection * 0.35 + audit * 0.25);
        const level = score <= 30 ? 'low' : score <= 60 ? 'medium' : 'high';
        await conn.query('INSERT INTO vendor_risk_scores (id, vendor_id, risk_score, risk_level, delay_score, rejection_score, audit_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), v.id, score, level, delay, rejection, audit]);
      }
    }

    // Sample audit checklist
    const [clExists] = await conn.query("SELECT id FROM audit_checklists WHERE name = 'Quality Compliance Audit'");
    if (clExists.length === 0) {
      const clId = uuidv4();
      await conn.query('INSERT INTO audit_checklists (id, name, description, category) VALUES (?, ?, ?, ?)',
        [clId, 'Quality Compliance Audit', 'Standard quality compliance checklist for all Tier 1 suppliers', 'Quality']);
      const items = ['ISO 9001 certification valid', 'Quality control process documented', 'Incoming material inspection in place', 'Non-conformance tracking system', 'Corrective action process defined'];
      for (let i = 0; i < items.length; i++) {
        await conn.query('INSERT INTO audit_checklist_items (id, checklist_id, item_text, sequence) VALUES (?, ?, ?, ?)', [uuidv4(), clId, items[i], i + 1]);
      }
    }

    // Sample ticket
    const [tkExists] = await conn.query("SELECT id FROM tickets WHERE ticket_number = 'TKT-0001'");
    if (tkExists.length === 0 && vendors.length > 0) {
      const tkId = uuidv4();
      await conn.query("INSERT INTO tickets (id, ticket_number, subject, description, priority, status) VALUES (?, ?, ?, ?, ?, ?)",
        [tkId, 'TKT-0001', 'Delayed shipment for PO-2024-001', 'Shipment was expected on 15th but not received. Please provide update.', 'high', 'initiated']);
      await conn.query('INSERT INTO ticket_vendors (id, ticket_id, vendor_id, status) VALUES (?, ?, ?, ?)', [uuidv4(), tkId, vendors[0].id, 'open']);
    }

    // Price history from PO line items
    const [poLines] = await conn.query('SELECT pli.description, pli.unit_price, pli.quantity, po.vendor_id, po.id as po_id FROM po_line_items pli JOIN purchase_orders po ON pli.po_id = po.id');
    for (const pl of poLines) {
      const [exists] = await conn.query('SELECT id FROM price_history WHERE item_description = ? AND vendor_id = ? AND po_id = ?', [pl.description, pl.vendor_id, pl.po_id]);
      if (exists.length === 0) {
        await conn.query('INSERT INTO price_history (id, item_description, vendor_id, po_id, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), pl.description, pl.vendor_id, pl.po_id, pl.unit_price, pl.quantity]);
      }
    }

    console.log('✅ Advanced seed data inserted');
    console.log('   System Admin: sysadmin@procuretrack.com / SysAdmin@123');
  } finally {
    conn.release();
    await pool.end();
  }
}

seedAdvanced().catch(err => { console.error('Seed failed:', err); process.exit(1); });
