const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/users — List all users
router.get('/', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, email, role, full_name, vendor_id, is_active, must_reset_password, created_at FROM users ORDER BY created_at DESC');
  res.json({ success: true, data: rows });
}));

// POST /api/users — Create user
router.post('/', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { email, password, role, full_name } = req.body;

  if (!email || !password || !role || !full_name) {
    throw new ValidationError('Email, password, role, and full name are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new ValidationError('Invalid email format');

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) throw new ValidationError('User with this email already exists');

  const id = uuidv4();
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, full_name, must_reset_password, is_active) VALUES (?, ?, ?, ?, ?, FALSE, TRUE)',
    [id, email, hash, role, full_name]
  );

  res.status(201).json({ success: true, data: { id, email, role, full_name } });
}));

// PUT /api/users/:id — Update user
router.put('/:id', authenticate, requireRole('mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { full_name, role, is_active, password } = req.body;

  const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('User not found');

  await pool.query('UPDATE users SET full_name = ?, role = ?, is_active = ? WHERE id = ?', [full_name, role, is_active !== false, id]);

  // Update password if provided
  if (password && password.length >= 6) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  }

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
