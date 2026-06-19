const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');

async function seedRfq() {
  const conn = await pool.getConnection();
  try {
    // Get approved vendors for seeding
    const [vendors] = await conn.query("SELECT id, vendor_name FROM vendors WHERE status = 'approved' LIMIT 3");
    if (vendors.length < 2) {
      console.log('⚠️  Need at least 2 approved vendors to seed RFQ data. Run seed.js first.');
      return;
    }

    // Seed a published RFQ with bids already submitted
    const [rfqExists] = await conn.query("SELECT id FROM rfqs WHERE rfq_number = 'RFQ-000001'");
    if (rfqExists.length === 0) {
      const rfqId = uuidv4();
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 14);

      await conn.query(
        "INSERT INTO rfqs (id, rfq_number, title, description, submission_deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
        [rfqId, 'RFQ-000001', 'Q3 Steel Components Supply', 'Procurement of structural steel components for Q3 production cycle', deadline, 'published']
      );

      const items = [
        { desc: 'MS Flat Bar 50x6mm', qty: 500, uom: 'Kg', target: 85 },
        { desc: 'MS Angle 50x50x5mm', qty: 300, uom: 'Kg', target: 90 },
        { desc: 'ERW Pipe 2 inch', qty: 120, uom: 'Mtr', target: 320 },
      ];

      const lineItemIds = [];
      for (let i = 0; i < items.length; i++) {
        const liId = uuidv4();
        lineItemIds.push(liId);
        await conn.query(
          'INSERT INTO rfq_line_items (id, rfq_id, item_description, quantity, uom, target_price, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [liId, rfqId, items[i].desc, items[i].qty, items[i].uom, items[i].target, i + 1]
        );
      }

      // Invite all vendors
      for (const v of vendors) {
        await conn.query(
          "INSERT INTO rfq_vendors (id, rfq_id, vendor_id, participation_status) VALUES (?, ?, ?, ?)",
          [uuidv4(), rfqId, v.id, 'invited']
        );
      }

      // Submit bids from first two vendors
      const bidPrices = [
        [82, 88, 315],
        [79, 92, 308],
      ];
      for (let v = 0; v < 2; v++) {
        const bidId = uuidv4();
        const total = bidPrices[v].reduce((sum, p, i) => sum + p * items[i].qty, 0);
        await conn.query(
          "INSERT INTO vendor_bids (id, rfq_id, vendor_id, total_value, status) VALUES (?, ?, ?, ?, 'submitted')",
          [bidId, rfqId, vendors[v].id, total]
        );
        for (let i = 0; i < lineItemIds.length; i++) {
          await conn.query(
            'INSERT INTO vendor_bid_items (id, bid_id, rfq_line_item_id, unit_price, lead_time_days) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), bidId, lineItemIds[i], bidPrices[v][i], 7 + v * 3]
          );
        }
        await conn.query(
          "UPDATE rfq_vendors SET participation_status = 'submitted' WHERE rfq_id = ? AND vendor_id = ?",
          [rfqId, vendors[v].id]
        );
      }
    }

    // Seed a draft RFQ
    const [draftExists] = await conn.query("SELECT id FROM rfqs WHERE rfq_number = 'RFQ-000002'");
    if (draftExists.length === 0) {
      const rfqId2 = uuidv4();
      const deadline2 = new Date();
      deadline2.setDate(deadline2.getDate() + 21);

      await conn.query(
        "INSERT INTO rfqs (id, rfq_number, title, description, submission_deadline, status) VALUES (?, ?, ?, ?, ?, 'draft')",
        [rfqId2, 'RFQ-000002', 'Electrical Consumables Q3', 'Annual procurement of electrical components and consumables', deadline2]
      );

      const items2 = [
        { desc: 'Cable Ties 200mm', qty: 2000, uom: 'Nos', target: 5 },
        { desc: 'PVC Conduit 25mm', qty: 500, uom: 'Mtr', target: 45 },
      ];
      for (let i = 0; i < items2.length; i++) {
        await conn.query(
          'INSERT INTO rfq_line_items (id, rfq_id, item_description, quantity, uom, target_price, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), rfqId2, items2[i].desc, items2[i].qty, items2[i].uom, items2[i].target, i + 1]
        );
      }
      for (const v of vendors.slice(0, 2)) {
        await conn.query('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)', [uuidv4(), rfqId2, v.id]);
      }
    }

    console.log('✅ RFQ seed data inserted');
    console.log('   RFQ-000001: Published, 3 line items, 2 bids submitted');
    console.log('   RFQ-000002: Draft, 2 line items');
  } finally {
    conn.release();
    await pool.end();
  }
}

seedRfq().catch(err => { console.error('RFQ seed failed:', err); process.exit(1); });
