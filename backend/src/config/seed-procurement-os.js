const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Seed data for: Item Master (never had a seed script at all — a
// pre-existing gap, not something this pass introduced) plus the
// Procurement OS expansion modules (multi-company, inventory, decision/
// action rule engines). Fully idempotent — every insert is guarded by an
// existence check, same convention as every other seed-*.js script.
async function seed() {
  const conn = await pool.getConnection();
  try {
    // ─── ITEM MASTER ───
    const items = [
      { code: 'ITM-1001', desc: 'Steel Plates 10mm', uom: 'Nos', category: 'Raw Materials', cost: 1500 },
      { code: 'ITM-1002', desc: 'Steel Rods 8mm', uom: 'Nos', category: 'Raw Materials', cost: 500 },
      { code: 'ITM-1003', desc: 'Polymer Granules Grade A', uom: 'Kg', category: 'Raw Materials', cost: 200 },
      { code: 'ITM-1004', desc: 'Safety Helmets', uom: 'Nos', category: 'Equipment', cost: 350 },
      { code: 'ITM-1005', desc: 'Hydraulic Pumps', uom: 'Nos', category: 'Equipment', cost: 30000 },
      { code: 'ITM-1006', desc: 'A4 Copier Paper (Box)', uom: 'Box', category: 'Office Supplies', cost: 850 },
      { code: 'ITM-1007', desc: 'Industrial Packaging Tape', uom: 'Roll', category: 'Packaging', cost: 120 },
      { code: 'ITM-1008', desc: 'Welding Electrodes', uom: 'Kg', category: 'Raw Materials', cost: 220 },
    ];
    const itemIds = {};
    for (const it of items) {
      const [existing] = await conn.query('SELECT id FROM item_master WHERE item_code = ?', [it.code]);
      if (existing.length === 0) {
        const id = uuidv4();
        itemIds[it.code] = id;
        await conn.query(
          'INSERT INTO item_master (id, item_code, item_description, item_name, uom, category, standard_cost, currency, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, it.code, it.desc, it.desc, it.uom, it.category, it.cost, 'INR', true]
        );
      } else {
        itemIds[it.code] = existing[0].id;
      }
    }
    console.log(`✅ Item Master: ${Object.keys(itemIds).length} items`);

    // Preferred vendor mapping — first two approved vendors, if any exist yet.
    const [approvedVendors] = await conn.query("SELECT id FROM vendors WHERE status = 'approved' LIMIT 2");
    if (approvedVendors.length > 0) {
      let mapped = 0;
      for (const [i, code] of Object.keys(itemIds).entries()) {
        const vendor = approvedVendors[i % approvedVendors.length];
        const [existing] = await conn.query('SELECT id FROM item_vendor_mapping WHERE item_id = ? AND vendor_id = ?', [itemIds[code], vendor.id]);
        if (existing.length === 0) {
          await conn.query('INSERT INTO item_vendor_mapping (id, item_id, vendor_id, is_preferred) VALUES (?, ?, ?, ?)', [uuidv4(), itemIds[code], vendor.id, i < 2]);
          mapped++;
        }
      }
      console.log(`✅ Item-Vendor Mapping: ${mapped} new mappings`);
    }

    // ─── MULTI-COMPANY (a 2nd company, for intercompany demo) ───
    const [[defaultOrg]] = await conn.query("SELECT id FROM organization_master WHERE org_code = 'DEFAULT'");
    let companyBId;
    const [existingCoB] = await conn.query("SELECT id FROM company_master WHERE company_code = 'COMPB'");
    if (existingCoB.length === 0) {
      companyBId = uuidv4();
      await conn.query('INSERT INTO company_master (id, organization_id, company_code, company_name, gstin) VALUES (?, ?, ?, ?, ?)',
        [companyBId, defaultOrg.id, 'COMPB', 'Serene Manufacturing Pvt Ltd', '27AABCS1234B1Z5']);
      console.log('✅ Company: COMPB (Serene Manufacturing Pvt Ltd)');
    } else {
      companyBId = existingCoB[0].id;
    }

    const [existingBu] = await conn.query("SELECT id FROM business_unit_master WHERE company_id = ? AND bu_code = 'BU-OPS'", [companyBId]);
    if (existingBu.length === 0) {
      await conn.query('INSERT INTO business_unit_master (id, company_id, bu_code, bu_name) VALUES (?, ?, ?, ?)', [uuidv4(), companyBId, 'BU-OPS', 'Operations']);
      console.log('✅ Business Unit: BU-OPS under COMPB');
    }

    const [existingMapping] = await conn.query('SELECT id FROM company_sap_mapping WHERE company_id = ?', [companyBId]);
    if (existingMapping.length === 0) {
      await conn.query('INSERT INTO company_sap_mapping (id, company_id, sap_company_code, sap_system_id) VALUES (?, ?, ?, ?)', [uuidv4(), companyBId, '2000', 'SAP-PRD-01']);
      console.log('✅ SAP Mapping: COMPB -> SAP company code 2000');
    }

    // Mark one vendor as an internal company so a PO against them mirrors
    // into a Sales Order — the concrete intercompany demonstration. Checked
    // against companyBId specifically (not just "any vendor missing a
    // value") so re-running this script doesn't keep marking another vendor.
    const [alreadyMarked] = await conn.query('SELECT id FROM vendors WHERE internal_company_id = ?', [companyBId]);
    if (alreadyMarked.length === 0) {
      const [internalCandidate] = await conn.query("SELECT id FROM vendors WHERE status = 'approved' LIMIT 1");
      if (internalCandidate.length > 0) {
        await conn.query('UPDATE vendors SET internal_company_id = ? WHERE id = ?', [companyBId, internalCandidate[0].id]);
        console.log(`✅ Vendor ${internalCandidate[0].id} marked as internal company (COMPB) for intercompany demo`);
      }
    }

    // ─── INVENTORY (stock + reorder levels for the items above) ───
    const [[warehouse]] = await conn.query("SELECT id FROM warehouses WHERE warehouse_code = 'DEFAULT'");
    let stockSeeded = 0;
    for (const code of Object.keys(itemIds)) {
      const [existing] = await conn.query('SELECT id FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?', [warehouse.id, itemIds[code]]);
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO inventory_stock (id, warehouse_id, item_master_id, quantity_on_hand, reorder_level, reorder_quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), warehouse.id, itemIds[code], 100, 20, 50]
        );
        stockSeeded++;
      }
    }
    console.log(`✅ Inventory Stock: ${stockSeeded} new stock records (qty 100, reorder at 20)`);

    // ─── DECISION ENGINE (Module 6) — illustrative rules ───
    const decisionRules = [
      { name: 'High value PR cost insight', module: 'pr', cond: [{ field: 'total_value', operator: '>', value: 100000 }], type: 'cost_insight', tmpl: { message: 'This requisition exceeds ₹1,00,000 — consider RFQ sourcing or contract pricing for better terms.' } },
      { name: 'Low budget headroom risk alert', module: 'pr', cond: [{ field: 'budget_remaining_pct', operator: '<', value: 15 }], type: 'risk_alert', tmpl: { message: 'Less than 15% of this cost center’s budget remains for the fiscal year.' } },
    ];
    let drCount = 0;
    for (const r of decisionRules) {
      const [existing] = await conn.query('SELECT id FROM decision_rules WHERE rule_name = ?', [r.name]);
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO decision_rules (id, rule_name, module_name, conditions, output_type, output_template, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), r.name, r.module, JSON.stringify(r.cond), r.type, JSON.stringify(r.tmpl), 10]
        );
        drCount++;
      }
    }
    console.log(`✅ Decision Rules: ${drCount} new rules`);

    // ─── NEXT BEST ACTION ENGINE (Module 7) — illustrative rule beyond the built-in RFQ check ───
    const actionRules = [
      { name: 'Flag very high value approvals for review', trigger: 'PR_APPROVED', cond: [{ field: 'total_value', operator: '>', value: 500000 }], action: 'flag_for_finance_review', payload: { message: 'This requisition exceeds ₹5,00,000 — Finance should review before PO creation.' } },
    ];
    let arCount = 0;
    for (const r of actionRules) {
      const [existing] = await conn.query('SELECT id FROM action_rules WHERE rule_name = ?', [r.name]);
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO action_rules (id, rule_name, trigger_event, conditions, recommended_action, action_payload, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), r.name, r.trigger, JSON.stringify(r.cond), r.action, JSON.stringify(r.payload), 10]
        );
        arCount++;
      }
    }
    console.log(`✅ Action Rules: ${arCount} new rules`);

    console.log('\n✅ Procurement OS seed complete');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Procurement OS seed failed:', err);
  process.exit(1);
});
