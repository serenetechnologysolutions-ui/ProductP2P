const express = require('express');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const multer = require('multer');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, ConflictError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { resolveCompanyAccess } = require('../company/company.middleware');
const { validateImportRows } = require('./item-master.import');

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/item-master/export — Excel export filtered by company scope
router.get('/export', authenticate, requireRole('mdm_admin', 'system_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  let sql = 'SELECT DISTINCT im.* FROM item_master im';
  const params = [];

  if (req.companyIds !== null) {
    sql += ` INNER JOIN item_company_mapping icm ON im.id = icm.item_id
             AND icm.company_id IN (${req.companyIds.map(() => '?').join(',')})`;
    params.push(...req.companyIds);
  }

  sql += ' WHERE im.is_active = TRUE ORDER BY im.item_code';

  const [rows] = await pool.query(sql, params);

  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    item_code: r.item_code,
    item_description: r.item_description,
    item_name: r.item_name,
    uom: r.uom,
    category: r.category,
    standard_cost: r.standard_cost,
    currency: r.currency,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="item_master_export_${Date.now()}.xlsx"`);
  res.send(buf);
}));

// POST /api/item-master/import — Excel bulk import with company mapping
router.post('/import', authenticate, requireRole('mdm_admin', 'system_admin'), resolveCompanyAccess, excelUpload.single('file'), asyncHandler(async (req, res) => {
  // Validate file
  if (!req.file) throw new ValidationError('No file uploaded');
  if (!req.file.originalname.endsWith('.xlsx')) {
    throw new ValidationError('Invalid file format. Please upload an .xlsx file');
  }

  // Parse xlsx
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet);

  if (!rows || rows.length === 0) {
    throw new ValidationError('The uploaded file contains no data rows');
  }

  // Parse and validate company_ids
  const companyIds = JSON.parse(req.body.company_ids || '[]');
  if (companyIds.length > 0) {
    const [companies] = await pool.query(
      `SELECT id FROM company_master WHERE id IN (${companyIds.map(() => '?').join(',')})`,
      companyIds
    );
    if (companies.length !== companyIds.length) {
      const foundIds = new Set(companies.map(c => c.id));
      const invalid = companyIds.find(id => !foundIds.has(id));
      throw new ValidationError(`Invalid company_id: ${invalid}`);
    }
  }

  // Get existing item_codes
  const [existingItems] = await pool.query('SELECT item_code FROM item_master');
  const existingCodes = new Set(existingItems.map(r => r.item_code));

  // Validate rows
  const { valid, errors } = validateImportRows(rows, existingCodes);

  // Insert valid rows in a transaction
  let successfulCount = 0;
  if (valid.length > 0) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of valid) {
        const id = uuidv4();
        await conn.query(
          `INSERT INTO item_master (id, item_code, item_description, item_name, uom, category, standard_cost, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, item.item_code, item.item_description, item.item_name, item.uom, item.category, item.standard_cost, item.currency]
        );
        // Create company mappings
        for (const companyId of companyIds) {
          await conn.query(
            'INSERT INTO item_company_mapping (id, item_id, company_id) VALUES (?, ?, ?)',
            [uuidv4(), id, companyId]
          );
        }
        successfulCount++;
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  res.json({
    success: true,
    data: {
      total_rows: rows.length,
      successful_count: successfulCount,
      skipped_count: errors.length,
      errors,
    },
  });
}));

// GET /api/item-master — list (search by code/description, optional category filter, company-scoped)
router.get('/', authenticate, resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const params = [];
  let sql;

  if (req.companyIds !== null) {
    // MDM_Admin: only items mapped to user's accessible companies
    sql = 'SELECT DISTINCT im.* FROM item_master im INNER JOIN item_company_mapping icm ON im.id = icm.item_id AND icm.company_id IN (' + req.companyIds.map(() => '?').join(',') + ')';
    params.push(...req.companyIds);
    sql += ' WHERE im.is_active = TRUE';
  } else {
    // System_Admin: all active items
    sql = 'SELECT * FROM item_master im WHERE im.is_active = TRUE';
  }

  if (search) {
    sql += ' AND (im.item_code LIKE ? OR im.item_description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND im.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY im.item_description';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST /api/item-master — create
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const {
    item_code, item_description, uom, category,
    item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template,
    company_ids,
  } = req.body;
  if (!item_code || !item_description) throw new ValidationError('item_code and item_description are required');

  const [existing] = await pool.query('SELECT id FROM item_master WHERE item_code = ?', [item_code]);
  if (existing.length > 0) throw new ConflictError('An item with this code already exists');

  // Validate company_ids if provided
  const companyIds = company_ids || [];
  if (companyIds.length > 0) {
    const [companies] = await pool.query(
      `SELECT id FROM company_master WHERE id IN (${companyIds.map(() => '?').join(',')})`,
      companyIds
    );
    if (companies.length !== companyIds.length) {
      const foundIds = new Set(companies.map(c => c.id));
      const invalid = companyIds.find(id => !foundIds.has(id));
      throw new ValidationError(`Invalid company_id: ${invalid}`);
    }
  }

  const id = uuidv4();

  if (companyIds.length > 0) {
    // Use transaction when creating company mappings
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO item_master
          (id, item_code, item_description, uom, category,
           item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, item_code, item_description, uom || 'Nos', category || null,
          item_name || null, category_id || null, subcategory_id || null, uom_id || null,
          hsn_sac_code || null, standard_cost ?? null, currency || 'INR',
          specification_template ? JSON.stringify(specification_template) : null,
        ]
      );

      for (const companyId of companyIds) {
        await conn.query(
          'INSERT INTO item_company_mapping (id, item_id, company_id) VALUES (?, ?, ?)',
          [uuidv4(), id, companyId]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    // No company mappings — simple insert
    await pool.query(
      `INSERT INTO item_master
        (id, item_code, item_description, uom, category,
         item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, item_code, item_description, uom || 'Nos', category || null,
        item_name || null, category_id || null, subcategory_id || null, uom_id || null,
        hsn_sac_code || null, standard_cost ?? null, currency || 'INR',
        specification_template ? JSON.stringify(specification_template) : null,
      ]
    );
  }

  res.status(201).json({
    success: true,
    data: {
      id, item_code, item_description, uom: uom || 'Nos', category,
      item_name: item_name || null, category_id: category_id || null, subcategory_id: subcategory_id || null,
      uom_id: uom_id || null, hsn_sac_code: hsn_sac_code || null, standard_cost: standard_cost ?? null,
      currency: currency || 'INR', specification_template: specification_template || null,
      company_ids: companyIds,
    },
  });
}));

// GET /api/item-master/:id/companies — get item-company mappings
router.get('/:id/companies', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT icm.*, c.company_name FROM item_company_mapping icm LEFT JOIN company_master c ON icm.company_id = c.id WHERE icm.item_id = ?`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

// PUT /api/item-master/:id/companies — update item-company mappings
router.put('/:id/companies', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { company_ids } = req.body;
  if (!Array.isArray(company_ids)) throw new ValidationError('company_ids must be an array');

  // Verify item exists
  const [item] = await pool.query('SELECT id FROM item_master WHERE id = ?', [req.params.id]);
  if (item.length === 0) throw new NotFoundError('Item not found');

  // Validate all company_ids exist
  if (company_ids.length > 0) {
    const [companies] = await pool.query(
      `SELECT id FROM company_master WHERE id IN (${company_ids.map(() => '?').join(',')})`,
      company_ids
    );
    if (companies.length !== company_ids.length) {
      const foundIds = new Set(companies.map(c => c.id));
      const invalid = company_ids.find(id => !foundIds.has(id));
      throw new ValidationError(`Invalid company_id: ${invalid}`);
    }
  }

  // Replace mappings in a transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM item_company_mapping WHERE item_id = ?', [req.params.id]);

    for (const companyId of company_ids) {
      await conn.query(
        'INSERT INTO item_company_mapping (id, item_id, company_id) VALUES (?, ?, ?)',
        [uuidv4(), req.params.id, companyId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ success: true, message: 'Company mappings updated' });
}));

// PUT /api/item-master/:id — update
router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const {
    item_description, uom, category, is_active,
    item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template,
  } = req.body;
  const [rows] = await pool.query('SELECT id FROM item_master WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new NotFoundError('Item not found');

  await pool.query(
    `UPDATE item_master SET
       item_description = ?, uom = ?, category = ?, is_active = ?,
       item_name = ?, category_id = ?, subcategory_id = ?, uom_id = ?,
       hsn_sac_code = ?, standard_cost = ?, currency = ?, specification_template = ?
     WHERE id = ?`,
    [
      item_description, uom || 'Nos', category || null, is_active !== false,
      item_name || null, category_id || null, subcategory_id || null, uom_id || null,
      hsn_sac_code || null, standard_cost ?? null, currency || 'INR',
      specification_template ? JSON.stringify(specification_template) : null,
      req.params.id,
    ]
  );
  res.json({ success: true, message: 'Updated' });
}));

// DELETE /api/item-master/:id — soft delete
router.delete('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE item_master SET is_active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Removed' });
}));

// ─── Preferred Vendor Mapping (item_vendor_mapping) ───

// GET /api/item-master/:itemId/vendors — list mapped vendors for an item
router.get('/:itemId/vendors', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.item_id, m.vendor_id, m.is_preferred, m.created_at, v.vendor_name
     FROM item_vendor_mapping m
     LEFT JOIN vendors v ON m.vendor_id = v.id
     WHERE m.item_id = ?
     ORDER BY m.is_preferred DESC, v.vendor_name`,
    [req.params.itemId]
  );
  res.json({ success: true, data: rows });
}));

// POST /api/item-master/:itemId/vendors — upsert a vendor mapping for an item
router.post('/:itemId/vendors', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { vendor_id, is_preferred } = req.body;
  if (!vendor_id) throw new ValidationError('vendor_id is required');

  const [item] = await pool.query('SELECT id FROM item_master WHERE id = ?', [itemId]);
  if (item.length === 0) throw new NotFoundError('Item not found');

  const id = uuidv4();
  await pool.query(
    `INSERT INTO item_vendor_mapping (id, item_id, vendor_id, is_preferred)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_preferred = VALUES(is_preferred)`,
    [id, itemId, vendor_id, !!is_preferred]
  );
  res.status(201).json({ success: true, message: 'Vendor mapping saved' });
}));

// DELETE /api/item-master/:itemId/vendors/:vendorId — remove a vendor mapping
router.delete('/:itemId/vendors/:vendorId', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { itemId, vendorId } = req.params;
  await pool.query('DELETE FROM item_vendor_mapping WHERE item_id = ? AND vendor_id = ?', [itemId, vendorId]);
  res.json({ success: true, message: 'Vendor mapping removed' });
}));

module.exports = router;
