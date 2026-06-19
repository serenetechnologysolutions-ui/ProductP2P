const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
require('dotenv').config();

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/documents — generic multipart document upload
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), upload.single('file'), asyncHandler(async (req, res) => {
  const { module_name, record_id, file_type, document_group_id, expiry_date } = req.body;
  if (!module_name) throw new ValidationError('module_name is required');
  if (!req.file) throw new ValidationError('file is required');

  const id = uuidv4();
  const groupId = document_group_id || uuidv4();

  await pool.query(
    `INSERT INTO documents
      (id, document_group_id, module_name, record_id, file_type, file_name, file_url, uploaded_by, expiry_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, groupId, module_name, record_id || null, file_type || null, req.file.originalname, req.file.path, req.user.id, expiry_date || null]
  );

  const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

// GET /api/documents — list with filters (admin/procurement only — documents span every
// vendor/ticket/audit/ESG record, so this is not scoped per-caller like vendor-owned data)
router.get('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { module_name, record_id, document_group_id, verification_status } = req.query;
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const params = [];

  if (module_name) { sql += ' AND module_name = ?'; params.push(module_name); }
  if (record_id) { sql += ' AND record_id = ?'; params.push(record_id); }
  if (document_group_id) { sql += ' AND document_group_id = ?'; params.push(document_group_id); }
  if (verification_status) { sql += ' AND verification_status = ?'; params.push(verification_status); }
  sql += ' ORDER BY uploaded_at DESC';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// PUT /api/documents/:id/verify — verify or reject a document
router.put('/:id/verify', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { verification_status } = req.body;

  if (!verification_status || !['verified', 'rejected'].includes(verification_status)) {
    throw new ValidationError("verification_status must be 'verified' or 'rejected'");
  }

  const [existing] = await pool.query('SELECT id FROM documents WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Document not found');

  await pool.query('UPDATE documents SET verification_status = ? WHERE id = ?', [verification_status, id]);
  res.json({ success: true, message: 'Document verification status updated' });
}));

// DELETE /api/documents/:id — hard delete (file on disk is left as-is)
router.delete('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [existing] = await pool.query('SELECT id FROM documents WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Document not found');

  await pool.query('DELETE FROM documents WHERE id = ?', [id]);
  res.json({ success: true, message: 'Document deleted' });
}));

module.exports = router;
