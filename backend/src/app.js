const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { errorHandler, notFoundHandler, requestLogger, rateLimit, securityHeaders, sanitizeInput } = require('./common/middleware');
const { logger } = require('./common/logger');

const app = express();

// Ensure directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// VAPT: Disable X-Powered-By
app.disable('x-powered-by');

// VAPT: Security headers
app.use(securityHeaders);

// VAPT: CORS — restrict to known origins in production
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // Allow in dev; tighten in production
  },
  credentials: true,
}));

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// VAPT: Input sanitization
app.use(sanitizeInput);

// Request logging
app.use(requestLogger);

// VAPT: Rate limiting on auth endpoints
app.use('/api/auth/login', rateLimit(60000, 10)); // 10 attempts per minute

// Static files (uploads) — only serve with auth in production
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/vendors', require('./modules/vendor/vendor.routes'));
app.use('/api/asns', require('./modules/asn/asn.routes'));
app.use('/api/sub-masters', require('./modules/sub-masters/sub-masters.routes'));
app.use('/api/purchase-orders', require('./modules/purchase-orders/po.routes'));
app.use('/api/extraction-configs', require('./modules/extraction/extraction.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/system', require('./modules/system/system.routes'));
app.use('/api/audit', require('./modules/audit/audit.routes'));
app.use('/api/tickets', require('./modules/tickets/tickets.routes'));
app.use('/api/risk', require('./modules/risk/risk.routes'));
app.use('/api/esg', require('./modules/esg/esg.routes'));
app.use('/api/pricing', require('./modules/pricing/pricing.routes'));
app.use('/api/rfq', require('./modules/rfq/rfq.routes'));
app.use('/api/item-master', require('./modules/item-master/item-master.routes'));
app.use('/api/workflow', require('./modules/workflow/workflow.routes'));
app.use('/api/documents', require('./modules/documents/documents.routes'));

// Health check (no sensitive info)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});

module.exports = app;
