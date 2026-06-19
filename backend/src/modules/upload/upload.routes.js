const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate } = require('../auth/auth.middleware');
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

// POST /api/upload/vendor-document
router.post('/vendor-document', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  const { vendor_id, doc_type } = req.body;
  const id = uuidv4();
  await pool.query(
    'INSERT INTO vendor_documents (id, vendor_id, doc_type, file_name, file_path) VALUES (?, ?, ?, ?, ?)',
    [id, vendor_id, doc_type, req.file.originalname, req.file.path]
  );
  res.status(201).json({ success: true, data: { id, file_name: req.file.originalname, file_path: req.file.path } });
}));

// POST /api/upload/asn-invoice
router.post('/asn-invoice', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  const { asn_id } = req.body;
  await pool.query('UPDATE asns SET invoice_pdf_path = ? WHERE id = ?', [req.file.path, asn_id]);
  res.json({ success: true, data: { file_name: req.file.originalname, file_path: req.file.path } });
}));

// POST /api/upload/file — generic attachment upload (RFQ line items, vendor bid items, etc.)
// Returns the stored path/name only; the caller links it to its own record.
router.post('/file', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { file_name: req.file.originalname, file_path: req.file.path } });
}));

module.exports = router;
