const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Root@123',
  database: process.env.DB_NAME || 'vendor_portal',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Without this listener, an idle-connection error (DB restart, network blip) emits
// an 'error' event with no listener, which Node treats as an uncaught exception
// and crashes the whole process instead of just failing the in-flight query.
pool.on('error', (err) => {
  require('../common/logger').logger.error('MySQL pool error', { error: err.message, code: err.code });
});

module.exports = { pool };
