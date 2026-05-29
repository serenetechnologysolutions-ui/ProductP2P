const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { AuthenticationError, ValidationError } = require('../../common/errors');
const { authenticate } = require('./auth.middleware');
const { logger } = require('../../common/logger');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vendor-portal-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // VAPT: Validate email format to prevent injection
  if (typeof email !== 'string' || email.length > 255) {
    throw new ValidationError('Invalid email');
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
  if (rows.length === 0) {
    logger.security('Failed login attempt - user not found', { email, ip: req.ip });
    throw new AuthenticationError();
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    logger.security('Failed login attempt - wrong password', { email, ip: req.ip, userId: user.id });
    throw new AuthenticationError();
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, vendorId: user.vendor_id, mustResetPassword: user.must_reset_password },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  logger.audit('User logged in', { userId: user.id, email: user.email, role: user.role, ip: req.ip });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      mustResetPassword: Boolean(user.must_reset_password),
      vendorId: user.vendor_id,
    },
  });
}));

// POST /api/auth/reset-password
router.post('/reset-password', authenticate, asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  // VAPT: Strong password validation
  if (!newPassword || newPassword.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new ValidationError('Password must contain uppercase, lowercase, and a digit');
  }

  const hash = await bcrypt.hash(newPassword, 12); // VAPT: Higher salt rounds
  await pool.query('UPDATE users SET password_hash = ?, must_reset_password = FALSE WHERE id = ?', [hash, req.user.id]);

  logger.audit('Password reset', { userId: req.user.id, email: req.user.email, ip: req.ip });

  res.json({ success: true, message: 'Password reset successfully' });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, email, role, full_name, vendor_id, must_reset_password FROM users WHERE id = ?', [req.user.id]);
  if (rows.length === 0) {
    throw new AuthenticationError('User not found');
  }
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
