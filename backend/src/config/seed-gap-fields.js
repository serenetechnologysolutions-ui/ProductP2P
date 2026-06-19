const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

// Sub-master entries backing the new FK-style fields added in migrate-gap-fields.js
// (vendor_type, industry, registration_type, payment_terms_id, item category/subcategory/uom,
// rfq procurement_category_id, ticket category). Safe to re-run.
async function seedGapFields() {
  const conn = await pool.getConnection();
  try {
    const subMasters = [
      { category: 'vendor_type', name: 'Manufacturer' },
      { category: 'vendor_type', name: 'Trader' },
      { category: 'vendor_type', name: 'Service' },

      { category: 'industry', name: 'Manufacturing' },
      { category: 'industry', name: 'IT Services' },
      { category: 'industry', name: 'Logistics' },
      { category: 'industry', name: 'Retail' },
      { category: 'industry', name: 'Construction' },
      { category: 'industry', name: 'Healthcare' },
      { category: 'industry', name: 'Energy' },
      { category: 'industry', name: 'Agriculture' },

      { category: 'registration_type', name: 'LLP' },
      { category: 'registration_type', name: 'Private Limited' },
      { category: 'registration_type', name: 'Public Limited' },
      { category: 'registration_type', name: 'Partnership' },
      { category: 'registration_type', name: 'Sole Proprietorship' },
      { category: 'registration_type', name: 'One Person Company' },
      { category: 'registration_type', name: 'Other' },

      { category: 'payment_terms', name: 'Net 15', code: 'NET15' },
      { category: 'payment_terms', name: 'Net 30', code: 'NET30' },
      { category: 'payment_terms', name: 'Net 45', code: 'NET45' },
      { category: 'payment_terms', name: 'Net 60', code: 'NET60' },
      { category: 'payment_terms', name: 'Advance', code: 'ADVANCE' },
      { category: 'payment_terms', name: 'Cash on Delivery', code: 'COD' },

      { category: 'item_category', name: 'Raw Material' },
      { category: 'item_category', name: 'Finished Goods' },
      { category: 'item_category', name: 'Consumables' },
      { category: 'item_category', name: 'Spare Parts' },
      { category: 'item_category', name: 'Services' },

      { category: 'item_subcategory', name: 'Electrical' },
      { category: 'item_subcategory', name: 'Mechanical' },
      { category: 'item_subcategory', name: 'Packaging' },
      { category: 'item_subcategory', name: 'IT Hardware' },
      { category: 'item_subcategory', name: 'Office Supplies' },

      { category: 'uom', name: 'Nos' },
      { category: 'uom', name: 'Kg' },
      { category: 'uom', name: 'Litre' },
      { category: 'uom', name: 'Box' },
      { category: 'uom', name: 'Meter' },
      { category: 'uom', name: 'Set' },
      { category: 'uom', name: 'Pair' },
      { category: 'uom', name: 'Roll' },
      { category: 'uom', name: 'Ton' },

      { category: 'procurement_category', name: 'Direct' },
      { category: 'procurement_category', name: 'Indirect' },
      { category: 'procurement_category', name: 'Capex' },
      { category: 'procurement_category', name: 'MRO' },
      { category: 'procurement_category', name: 'Services' },

      { category: 'ticket_category', name: 'Technical' },
      { category: 'ticket_category', name: 'Billing' },
      { category: 'ticket_category', name: 'Logistics' },
      { category: 'ticket_category', name: 'Compliance' },
      { category: 'ticket_category', name: 'Quality' },
      { category: 'ticket_category', name: 'Other' },
    ];

    let inserted = 0;
    for (const sm of subMasters) {
      const [existing] = await conn.query('SELECT id FROM sub_masters WHERE category = ? AND name = ?', [sm.category, sm.name]);
      if (existing.length === 0) {
        await conn.query('INSERT INTO sub_masters (id, category, name, code) VALUES (?, ?, ?, ?)', [uuidv4(), sm.category, sm.name, sm.code || null]);
        inserted++;
      }
    }

    console.log(`✅ Gap-fields sub-master seed complete (${inserted} new of ${subMasters.length} entries)`);
  } finally {
    conn.release();
    await pool.end();
  }
}

seedGapFields().catch(err => { console.error('Gap-fields seed failed:', err); process.exit(1); });
