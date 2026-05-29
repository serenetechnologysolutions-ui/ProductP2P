const { AppError, ValidationError } = require('./errors');
const { logger } = require('./logger');

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = req.user?.id || 'anonymous';
    const role = req.user?.role || 'none';

    const meta = { method, url: originalUrl, status: statusCode, duration: `${duration}ms`, ip, userId, role };

    if (statusCode >= 500) {
      logger.error(`${method} ${originalUrl} ${statusCode}`, meta);
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${originalUrl} ${statusCode}`, meta);
    } else {
      logger.info(`${method} ${originalUrl} ${statusCode}`, meta);
    }
  });

  next();
}

// Error handler — never leak stack traces or internal details
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const response = { success: false, error: err.message };
    if (err instanceof ValidationError && err.fields.length > 0) {
      response.fields = err.fields;
    }
    return res.status(err.statusCode).json(response);
  }

  // Log full error internally, return generic message to client
  logger.error('Unhandled error', { error: err.message, stack: err.stack, url: req.originalUrl, method: req.method });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Rate limiting (simple in-memory)
const rateLimitStore = new Map();
function rateLimit(windowMs = 60000, maxRequests = 100) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count++;
    rateLimitStore.set(key, record);

    if (record.count > maxRequests) {
      logger.security('Rate limit exceeded', { ip: req.ip, path: req.path });
      return res.status(429).json({ success: false, error: 'Too many requests' });
    }

    next();
  };
}

// Security headers
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.removeHeader('X-Powered-By');
  next();
}

// Input sanitizer — strip potential XSS from string fields
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

module.exports = { errorHandler, notFoundHandler, asyncHandler, requestLogger, rateLimit, securityHeaders, sanitizeInput };
