const { pool } = require('../../config/database');
const { ValidationError } = require('../../common/errors');

/**
 * Asserts that the given company is active.
 * Throws ValidationError (400) if the company is not found or inactive.
 * Allows null/undefined companyId to pass through (legacy records).
 *
 * @param {string|null} companyId - The company ID to check
 * @param {object} [conn] - Optional database connection (defaults to pool)
 */
async function assertCompanyActive(companyId, conn) {
  if (!companyId) return; // null company_id allowed (legacy records)
  const c = conn || pool;
  const [[company]] = await c.query(
    'SELECT is_active FROM company_master WHERE id = ?',
    [companyId]
  );
  if (!company) throw new ValidationError('Company not found', ['company_id']);
  if (!company.is_active) {
    throw new ValidationError(
      'Company is inactive. New transactions cannot be created.',
      ['company_id']
    );
  }
}

module.exports = { assertCompanyActive };
