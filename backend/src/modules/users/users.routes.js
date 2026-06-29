const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');

const router = express.Router();

// GET /api/users — List all users
router.get('/', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, email, role, full_name, vendor_id, is_active, must_reset_password, created_at FROM users ORDER BY created_at DESC');
  res.json({ success: true, data: rows });
}));

// POST /api/users — Create user
router.post('/', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { email, password, role, full_name, company_ids } = req.body;

  if (!email || !password || !role || !full_name) {
    throw new ValidationError('Email, password, role, and full name are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new ValidationError('Invalid email format');

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) throw new ValidationError('User with this email already exists');

  const id = uuidv4();
  const hash = await bcrypt.hash(password, 12);

  await withTransaction(async (conn) => {
    // Validate all company_ids exist in company_master
    if (company_ids && company_ids.length > 0) {
      const [companies] = await conn.query(
        `SELECT id FROM company_master WHERE id IN (${company_ids.map(() => '?').join(',')})`,
        company_ids
      );
      if (companies.length !== company_ids.length) {
        const foundIds = new Set(companies.map(c => c.id));
        const invalid = company_ids.find(cid => !foundIds.has(cid));
        throw new ValidationError(`Invalid company_id: ${invalid}`);
      }
    }

    // Create user
    await conn.query(
      'INSERT INTO users (id, email, password_hash, role, full_name, must_reset_password, is_active) VALUES (?, ?, ?, ?, ?, FALSE, TRUE)',
      [id, email, hash, role, full_name]
    );

    // Create company access records
    if (company_ids && company_ids.length > 0) {
      for (const companyId of company_ids) {
        await conn.query(
          'INSERT INTO user_company_access (id, user_id, company_id) VALUES (?, ?, ?)',
          [uuidv4(), id, companyId]
        );
      }
    }
  });

  res.status(201).json({ success: true, data: { id, email, role, full_name, company_ids: company_ids || [] } });
}));

// PUT /api/users/:id — Update user
router.put('/:id', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { full_name, role, is_active, password, company_ids } = req.body;

  const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('User not found');

  await withTransaction(async (conn) => {
    await conn.query('UPDATE users SET full_name = ?, role = ?, is_active = ? WHERE id = ?', [full_name, role, is_active !== false, id]);

    // Update password if provided
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 12);
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    }

    // Update company access if company_ids is provided
    if (company_ids !== undefined) {
      // Validate all company_ids exist in company_master
      if (company_ids && company_ids.length > 0) {
        const [companies] = await conn.query(
          `SELECT id FROM company_master WHERE id IN (${company_ids.map(() => '?').join(',')})`,
          company_ids
        );
        if (companies.length !== company_ids.length) {
          const foundIds = new Set(companies.map(c => c.id));
          const invalid = company_ids.find(cid => !foundIds.has(cid));
          throw new ValidationError(`Invalid company_id: ${invalid}`);
        }
      }

      // Delete existing company access records
      await conn.query('DELETE FROM user_company_access WHERE user_id = ?', [id]);

      // Insert new company access records
      if (company_ids && company_ids.length > 0) {
        for (const companyId of company_ids) {
          await conn.query(
            'INSERT INTO user_company_access (id, user_id, company_id) VALUES (?, ?, ?)',
            [uuidv4(), id, companyId]
          );
        }
      }
    }
  });

  res.json({ success: true, message: 'User updated' });
}));

// DELETE /api/users/:id — Delete user (soft delete)
router.delete('/:id', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Don't allow deleting yourself
  if (req.user.id === id) throw new ValidationError('Cannot delete your own account');

  await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
  res.json({ success: true, message: 'User deactivated' });
}));

module.exports = router;
