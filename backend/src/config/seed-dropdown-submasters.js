const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Seeds sub_masters rows for reference-data dropdowns that used to be
// hardcoded arrays in the frontend (currency, incoterms, PR document type,
// PR priority, account assignment category, RFQ type, ASN shipment mode,
// vendor MSME type). Status/workflow enums (PO status, sourcing_strategy,
// etc.) are deliberately NOT included — those gate backend branching and
// stay as fixed code-level values. Safe to re-run (existence-checked).
async function seedDropdownSubMasters() {
  const conn = await pool.getConnection();
  try {
    const subMasters = [
      { category: 'currency', name: 'INR' },
      { category: 'currency', name: 'USD' },
      { category: 'currency', name: 'EUR' },
      { category: 'currency', name: 'GBP' },
      { category: 'currency', name: 'AED' },
      { category: 'currency', name: 'SGD' },

      { category: 'incoterms', name: 'EXW' },
      { category: 'incoterms', name: 'FOB' },
      { category: 'incoterms', name: 'CIF' },
      { category: 'incoterms', name: 'CPT' },
      { category: 'incoterms', name: 'DDP' },
      { category: 'incoterms', name: 'DAP' },

      { category: 'document_type', name: 'Standard' },
      { category: 'document_type', name: 'Capex' },
      { category: 'document_type', name: 'Service' },

      { category: 'priority', name: 'Low' },
      { category: 'priority', name: 'Medium' },
      { category: 'priority', name: 'High' },
      { category: 'priority', name: 'Critical' },

      { category: 'account_assignment_category', name: 'Cost Center' },
      { category: 'account_assignment_category', name: 'Asset' },
      { category: 'account_assignment_category', name: 'Project' },

      { category: 'rfq_type', name: 'Open' },
      { category: 'rfq_type', name: 'Limited' },
      { category: 'rfq_type', name: 'Single' },

      { category: 'shipment_mode', name: 'Road' },
      { category: 'shipment_mode', name: 'Air' },
      { category: 'shipment_mode', name: 'Sea' },

      { category: 'msme_type', name: 'Micro' },
      { category: 'msme_type', name: 'Small' },
      { category: 'msme_type', name: 'Medium' },

      { category: 'plant', name: 'PLANT-01', code: 'Mumbai Plant' },
      { category: 'plant', name: 'PLANT-02', code: 'Chennai Plant' },
      { category: 'plant', name: 'PLANT-03', code: 'Pune Plant' },

      // Names match budget_allocations.cost_center exactly (seeded in seed-pr.js)
      // so picking one from this dropdown lines up with the live budget check.
      { category: 'cost_center', name: 'CC-PROC-01', code: 'Procurement' },
      { category: 'cost_center', name: 'CC-FIN-01', code: 'Finance' },
      { category: 'cost_center', name: 'CC-OPS-01', code: 'Operations' },

      { category: 'storage_location', name: 'Main Warehouse' },
      { category: 'storage_location', name: 'Raw Material Store' },
      { category: 'storage_location', name: 'Finished Goods Store' },
      { category: 'storage_location', name: 'Quality Hold Area' },
    ];

    let inserted = 0;
    for (const sm of subMasters) {
      const [existing] = await conn.query('SELECT id FROM sub_masters WHERE category = ? AND name = ?', [sm.category, sm.name]);
      if (existing.length === 0) {
        await conn.query('INSERT INTO sub_masters (id, category, name, code) VALUES (?, ?, ?, ?)', [uuidv4(), sm.category, sm.name, sm.code || null]);
        inserted++;
      }
    }

    console.log(`✅ Dropdown sub-master seed complete (${inserted} new of ${subMasters.length} entries)`);
  } finally {
    conn.release();
    await pool.end();
  }
}

seedDropdownSubMasters().catch(err => { console.error('Dropdown sub-master seed failed:', err); process.exit(1); });
