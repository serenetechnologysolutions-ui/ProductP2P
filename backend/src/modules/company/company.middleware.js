const { getUserCompanyIds } = require('./company.helpers');
const { AuthorizationError } = require('../../common/errors');

// Middleware: resolve the user's accessible company IDs and attach to req
async function resolveCompanyAccess(req, res, next) {
  if (!req.user) return next();
  try {
    req.companyIds = await getUserCompanyIds(req.user.id, req.user.role);
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware factory: checks if target company_id (extracted from req) is in user's access set
function requireCompanyAccess(companyIdExtractor) {
  return (req, res, next) => {
    const targetCompanyId = typeof companyIdExtractor === 'function'
      ? companyIdExtractor(req)
      : req.body.company_id;
    if (!targetCompanyId) return next(); // null company_id is allowed (legacy)
    if (req.companyIds === null) return next(); // system_admin - unrestricted
    if (!req.companyIds || !req.companyIds.includes(targetCompanyId)) {
      return next(new AuthorizationError('You do not have access to this company'));
    }
    next();
  };
}

module.exports = { resolveCompanyAccess, requireCompanyAccess };
