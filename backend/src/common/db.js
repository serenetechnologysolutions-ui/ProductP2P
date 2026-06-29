const { pool } = require('../config/database');
const { logger } = require('./logger');

// Runs `fn(conn)` inside a real MySQL transaction — acquires a dedicated
// connection, commits on success, rolls back on any thrown error (re-thrown
// unchanged, so AppError subclasses like ValidationError/ConflictError still
// carry their statusCode through to the response), and always releases the
// connection. Pass `conn` to every query/helper call inside `fn` (the
// existing `(conn || pool)` convention already used throughout
// `*.helpers.js`/`*.service.js`) — a write made via the bare `pool` instead
// of `conn` runs on a different connection and is NOT part of the
// transaction, so it would still commit even if the rest rolls back.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      logger.error('Transaction rollback failed', { error: rollbackErr.message });
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { withTransaction };
