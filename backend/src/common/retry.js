const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logger } = require('./logger');

// Module 11: generic retry + dead-letter queue, usable by any integration
// (the mocked SAP connector today, anything else tomorrow) — not specific to
// SAP, so it lives in common/ rather than inside the sap-connector module.

// Retries fn() up to maxAttempts times with a short linear backoff. On final
// failure, writes one row to integration_dlq (status visible/retryable from
// there — see POST /api/integration/dlq/:id/retry) and re-throws so the
// caller's own integration_logs entry still records the failure accurately.
async function withRetry(fn, { maxAttempts = 3, integrationType, recordId, payload, conn } = {}) {
  const c = conn || pool;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      logger.warn('Integration attempt failed', { integrationType, recordId, attempt, maxAttempts, error: err.message });
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 200));
    }
  }

  await c.query(
    'INSERT INTO integration_dlq (id, integration_type, record_id, payload, error_message, retry_count) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), integrationType, recordId || null, payload ? JSON.stringify(payload) : null, lastErr.message, maxAttempts]
  );
  throw lastErr;
}

async function retryDlqEntry(dlqId, fn, conn) {
  const c = conn || pool;
  const [[entry]] = await c.query('SELECT * FROM integration_dlq WHERE id = ?', [dlqId]);
  if (!entry) throw new Error('DLQ entry not found');
  if (entry.resolved) throw new Error('This DLQ entry has already been resolved');

  const payload = entry.payload ? JSON.parse(entry.payload) : {};
  try {
    const result = await fn(payload);
    await c.query('UPDATE integration_dlq SET resolved = TRUE, resolved_at = NOW() WHERE id = ?', [dlqId]);
    return result;
  } catch (err) {
    await c.query('UPDATE integration_dlq SET retry_count = retry_count + 1, error_message = ? WHERE id = ?', [err.message, dlqId]);
    throw err;
  }
}

module.exports = { withRetry, retryDlqEntry };
