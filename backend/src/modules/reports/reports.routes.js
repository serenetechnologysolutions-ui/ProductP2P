const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate } = require('../auth/auth.middleware');
const { REPORT_DEFINITIONS } = require('./report-definitions');

const router = express.Router();

const PREVIEW_LIMIT = 200;
const EXPORT_LIMIT = 20000;

function getDefinitionOrThrow(type, user) {
  const def = REPORT_DEFINITIONS[type];
  if (!def) throw new NotFoundError('Unknown report type');
  if (!def.roles.includes(user.role)) throw new AuthorizationError();
  return def;
}

// GET /api/reports/types — every report the caller's role may run, with its
// filter/column config, so the frontend renders the filter form generically.
router.get('/types', authenticate, asyncHandler(async (req, res) => {
  const types = Object.entries(REPORT_DEFINITIONS)
    .filter(([, def]) => def.roles.includes(req.user.role))
    .map(([key, def]) => ({ key, label: def.label, filters: def.filters, columns: def.columns }));
  res.json({ success: true, data: types });
}));

// GET /api/reports/:type/preview — capped row set for the on-screen viewer.
router.get('/:type/preview', authenticate, asyncHandler(async (req, res) => {
  const def = getDefinitionOrThrow(req.params.type, req.user);
  const { sql, params } = def.buildQuery(req.query, req.user);
  const [rows] = await pool.query(`${sql} LIMIT ${PREVIEW_LIMIT}`, params);
  res.json({ success: true, data: rows, truncated: rows.length === PREVIEW_LIMIT, columns: def.columns });
}));

// GET /api/reports/:type/export — same query, higher cap, returned as .xlsx.
router.get('/:type/export', authenticate, asyncHandler(async (req, res) => {
  const def = getDefinitionOrThrow(req.params.type, req.user);
  const { sql, params } = def.buildQuery(req.query, req.user);
  const [rows] = await pool.query(`${sql} LIMIT ${EXPORT_LIMIT}`, params);

  const headerRow = def.columns.map(c => c.label);
  const dataRows = rows.map(row => def.columns.map(c => row[c.key] ?? ''));
  const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, def.label.slice(0, 31));
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const filename = `${req.params.type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

module.exports = router;
