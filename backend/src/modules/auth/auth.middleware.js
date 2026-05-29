const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('../../common/errors');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'vendor-portal-secret-key-2024';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('No token provided'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AuthenticationError('Invalid or expired token'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AuthorizationError());
    }
    next();
  };
}

function requirePasswordReset(req, res, next) {
  if (req.user && req.user.mustResetPassword && req.path !== '/api/auth/reset-password') {
    return res.status(403).json({
      success: false,
      error: 'Password reset required',
      mustResetPassword: true,
    });
  }
  next();
}

function vendorIsolation(req, res, next) {
  if (req.user && req.user.role === 'vendor') {
    req.vendorId = req.user.vendorId;
  }
  next();
}

module.exports = { authenticate, requireRole, requirePasswordReset, vendorIsolation };
