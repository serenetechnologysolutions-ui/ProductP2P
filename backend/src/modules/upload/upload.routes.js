const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate } = require('../auth/auth.middleware');
const { ValidationError, AuthorizationError, NotFoundError } = require('../../common/errors');
require('dotenv').config();

const router = express.Router();

// VAPT: allowlist of file types accepted for upload — blocks HTML/SVG/script-bearing
// files that the static /uploads server would otherwise render inline (stored XSS).
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.xls', '.xlsx', '.csv', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new ValidationError(`File type ${ext || '(none)'} is not allowed`));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload/vendor-document
router.post('/vendor-document', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  const { vendor_id, doc_type } = req.body;
  if (!vendor_id || !doc_type) throw new ValidationError('vendor_id and doc_type are required');

  // VAPT: a vendor may only attach documents to their own vendor record (IDOR guard)
  if (req.user.role === 'vendor' && req.user.vendorId !== vendor_id) throw new AuthorizationError();

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
  if (!asn_id) throw new ValidationError('asn_id is required');

  // VAPT: a vendor may only attach an invoice to one of their own ASNs (IDOR guard)
  const [rows] = await pool.query('SELECT vendor_id FROM asns WHERE id = ?', [asn_id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (req.user.role === 'vendor' && req.user.vendorId !== rows[0].vendor_id) throw new AuthorizationError();

  await pool.query('UPDATE asns SET invoice_pdf_path = ? WHERE id = ?', [req.file.path, asn_id]);
  res.json({ success: true, data: { file_name: req.file.originalname, file_path: req.file.path } });
}));

// POST /api/upload/file — generic attachment upload (RFQ line items, vendor bid items, etc.)
// Returns the stored path/name only; the caller links it to its own record.
router.post('/file', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { file_name: req.file.originalname, file_path: req.file.path } });
}));

module.exports = router;
