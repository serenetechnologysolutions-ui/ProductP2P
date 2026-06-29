# Design Document: Multi-Company Isolation

## Overview

Multi-Company Isolation adds row-level data boundaries across ProcureTrack so that each company's procurement transactions, vendors, cost centres, and master data are visible only to users explicitly mapped to that company. The core pattern is a middleware-driven company filter that resolves the current user's accessible company IDs (via `user_company_access`) and injects SQL `WHERE` clauses before any data is returned or mutated.

### Guiding Principles

1. **Additive changes only** — no table drops or renames; new columns are nullable.
2. **Single helper, single pattern** — `getUserCompanyIds()` is the canonical gate.
3. **System_Admin bypass** — returns `null` for system_admin, signalling unrestricted access.
4. **MDM_Admin scoped** — MDM_Admin is now company-scoped (change from current code).
5. **Fail-closed** — if a user has no `user_company_access` rows, they see zero records.

## Architecture

### Data Flow: Transaction Creation (PR/PO/RFQ/ASN)

```
User → API → authenticate → requireRole → resolveCompanyAccess
  → requireCompanyAccess(req.body.company_id)
  → assertCompanyActive(req.body.company_id)
  → Create Record (with company_id set)
  → Response
```

### Data Flow: Transaction List Retrieval

```
User → API → authenticate → resolveCompanyAccess
  → getUserCompanyIds() → null (system_admin) or [ids]
  → SQL WHERE company_id IN (...) or no filter
  → Response
```

### Data Flow: Vendor Filtering

```
User → GET /api/vendors?company_id=X
  → resolveCompanyAccess
  → If system_admin: return all vendors
  → If other role: JOIN vendor_company_mapping WHERE company_id IN (user's companies)
  → If company_id param: additionally filter by that specific company
  → Response
```

### Migration Strategy

A single new migration file: `backend/src/config/migrate-multi-company-isolation.js`

Execution order:
1. Add columns to `company_master` (cin, pan, certificate_path, city, state, pin_code)
2. Create `vendor_company_mapping` table
3. Add `company_id` to `sub_masters`
4. Add `company_id` to `warehouses`
5. All operations are idempotent (CREATE IF NOT EXISTS, ALTER with duplicate-field guard)

No data backfill required — existing records keep `NULL` company_id and remain visible until scoped.

## Components and Interfaces

### 1. Database Schema Changes

#### 1.1 `company_master` — Additional Columns

```sql
ALTER TABLE company_master
  ADD COLUMN cin VARCHAR(21) NULL,
  ADD COLUMN pan VARCHAR(10) NULL,
  ADD COLUMN certificate_path VARCHAR(500) NULL,
  ADD COLUMN city VARCHAR(100) NULL,
  ADD COLUMN state VARCHAR(100) NULL,
  ADD COLUMN pin_code VARCHAR(6) NULL;
```

#### 1.2 `vendor_company_mapping` — New Table

```sql
CREATE TABLE IF NOT EXISTS vendor_company_mapping (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (company_id) REFERENCES company_master(id),
  UNIQUE KEY uq_vendor_company (vendor_id, company_id),
  INDEX idx_vcm_vendor (vendor_id),
  INDEX idx_vcm_company (company_id)
);
```

#### 1.3 `sub_masters` — Add `company_id` Column

```sql
ALTER TABLE sub_masters
  ADD COLUMN company_id VARCHAR(36) NULL,
  ADD INDEX idx_sub_masters_company (company_id);
```

This scopes cost centres (and other sub-masters) to a specific company.

#### 1.4 `warehouses` — Add `company_id` Column

```sql
ALTER TABLE warehouses
  ADD COLUMN company_id VARCHAR(36) NULL,
  ADD INDEX idx_warehouses_company (company_id);
```

#### 1.5 `inventory_stock` — Implicit Company via Warehouse

Inventory isolation is achieved through the warehouse's `company_id`; no direct column needed on `inventory_stock`.

### 2. Backend Services and Middleware

#### 2.1 Updated `getUserCompanyIds()` Helper

**File:** `backend/src/modules/company/company.helpers.js`

```javascript
async function getUserCompanyIds(userId, role, conn) {
  // Only system_admin is truly unrestricted
  if (role === 'system_admin') return null;
  const c = conn || pool;
  const [rows] = await c.query(
    'SELECT company_id FROM user_company_access WHERE user_id = ?',
    [userId]
  );
  return rows.map(r => r.company_id);
}
```

Key change: `mdm_admin` is no longer returned as `null` (unrestricted).

#### 2.2 Company Filter Middleware

**File:** `backend/src/modules/company/company.middleware.js` (new)

```javascript
const { getUserCompanyIds } = require('./company.helpers');
const { AuthorizationError } = require('../../common/errors');

async function resolveCompanyAccess(req, res, next) {
  if (!req.user) return next();
  req.companyIds = await getUserCompanyIds(req.user.id, req.user.role);
  next();
}

function requireCompanyAccess(companyIdExtractor) {
  return (req, res, next) => {
    const targetCompanyId = companyIdExtractor(req);
    if (!targetCompanyId) return next();
    if (req.companyIds === null) return next(); // unrestricted (system_admin)
    if (!req.companyIds.includes(targetCompanyId)) {
      return next(new AuthorizationError());
    }
    next();
  };
}

module.exports = { resolveCompanyAccess, requireCompanyAccess };
```

#### 2.3 Company Validation Service

**File:** `backend/src/modules/company/company.validators.js` (new)

```javascript
function validatePAN(pan) {
  if (!pan) return null;
  const regex = /^[A-Z0-9]{10}$/;
  if (!regex.test(pan)) return 'PAN must be exactly 10 alphanumeric characters';
  return null;
}

function validatePINCode(pinCode) {
  if (!pinCode) return null;
  const regex = /^[0-9]{6}$/;
  if (!regex.test(pinCode)) return 'PIN code must be exactly 6 digits';
  return null;
}

function validateCertificateFile(file) {
  if (!file) return null;
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (!allowedMimeTypes.includes(file.mimetype))
    return 'Certificate must be PDF, PNG, or JPEG';
  if (file.size > maxSize)
    return 'Certificate file must not exceed 5 MB';
  return null;
}

module.exports = { validatePAN, validatePINCode, validateCertificateFile };
```

#### 2.4 Inactive Company Guard

**File:** `backend/src/modules/company/company.guards.js` (new)

```javascript
const { pool } = require('../../config/database');
const { ValidationError } = require('../../common/errors');

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
```

#### 2.5 Company Routes Updates

**File:** `backend/src/modules/company/company.routes.js`

Changes:
- `POST /`, `PUT /:id`: Allow `mdm_admin` (not just `system_admin`)
- `PUT /:id`: MDM_Admin can only edit companies in their access set
- Add PAN/PIN/certificate validation on create/edit
- Add `POST /:id/certificate` file upload endpoint (multer, single file)
- Company list accepts `?active_only=true` query param for dropdown use

```javascript
router.put('/:id', authenticate, requireRole('system_admin', 'mdm_admin'),
  resolveCompanyAccess, asyncHandler(async (req, res) => {
    if (req.user.role === 'mdm_admin' && req.companyIds !== null) {
      if (!req.companyIds.includes(req.params.id)) {
        throw new AuthorizationError('You do not have access to this company');
      }
    }
    // PAN/PIN validation, then update
  })
);
```

#### 2.6 Vendor-Company Mapping Routes

**File:** `backend/src/modules/vendor/vendor-company.routes.js` (new)

Endpoints:
- `GET /api/vendor-company-mapping?company_id=...` — list mappings
- `POST /api/vendor-company-mapping` — create mapping (validates both exist and active)
- `DELETE /api/vendor-company-mapping/:id` — remove mapping

```javascript
router.post('/', authenticate, requireRole('system_admin', 'mdm_admin'),
  resolveCompanyAccess, asyncHandler(async (req, res) => {
    const { vendor_id, company_id } = req.body;
    // Validate both exist and are active
    // Validate MDM_Admin has access to company_id
    // Create mapping
  })
);
```

#### 2.7 Vendor List Filtering

**File:** `backend/src/modules/vendor/vendor.routes.js`

For non-system_admin users, augment vendor queries with a JOIN:

```javascript
if (companyIds !== null) {
  sql += ` INNER JOIN vendor_company_mapping vcm ON v.id = vcm.vendor_id
           WHERE vcm.company_id IN (${companyIds.map(() => '?').join(',')})`;
  params.push(...companyIds);
}
if (req.query.company_id) {
  sql += ` AND vcm.company_id = ?`;
  params.push(req.query.company_id);
}
```

#### 2.8 Transaction List Filtering (PR/PO/RFQ/ASN)

All list endpoints follow identical pattern:

```javascript
const companyIds = await getUserCompanyIds(req.user.id, req.user.role);
let sql = `SELECT ... FROM {table} WHERE 1=1`;
const params = [];
if (companyIds !== null) {
  if (companyIds.length === 0) return res.json({ success: true, data: [] });
  sql += ` AND company_id IN (${companyIds.map(() => '?').join(',')})`;
  params.push(...companyIds);
}
```

#### 2.9 Cost Centre Endpoint

**File:** `backend/src/modules/sub-masters/sub-masters.routes.js`

New endpoint for company-scoped cost centres:

```javascript
router.get('/cost-centre', authenticate, asyncHandler(async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.json({ success: true, data: [] });
  const [rows] = await pool.query(
    'SELECT * FROM sub_masters WHERE category = ? AND company_id = ? AND is_active = TRUE ORDER BY name',
    ['cost_centre', company_id]
  );
  res.json({ success: true, data: rows });
}));
```

#### 2.10 PDF Generation Enhancement

**File:** `backend/src/modules/company/company.helpers.js` (new function)

```javascript
async function getCompanyDetails(companyId) {
  if (!companyId) return null;
  const [[company]] = await pool.query(
    `SELECT company_name, address, city, state, pin_code, cin, pan, gstin
     FROM company_master WHERE id = ?`,
    [companyId]
  );
  return company || null;
}
```

PR and PO PDF routes updated:
- If `company_id` is present: pass company data to `drawDocumentHeader`
- If `company_id` is null: use default "ProcureTrack" branding (existing behavior)

#### 2.11 RFQ Comparison to PO Conversion

**File:** `backend/src/modules/rfq/rfq.routes.js`

```javascript
// POST /api/rfqs/:rfqId/create-po
router.post('/:rfqId/create-po', authenticate,
  requireRole('procurement_admin', 'system_admin'),
  resolveCompanyAccess, asyncHandler(async (req, res) => {
    const { vendor_id } = req.body;
    // 1. Load RFQ + awarded lines for this vendor
    // 2. Validate vendor mapped to RFQ's company (vendor_company_mapping)
    // 3. Validate user has access to RFQ's company
    // 4. Assert company is active
    // 5. Create draft PO pre-filled with RFQ data
    // 6. Set rfq_id on new PO
    // 7. Return { po_id } for frontend navigation
  })
);
```

#### 2.12 Inventory Module Role Update

**File:** `backend/src/modules/inventory/inventory.routes.js`

- Change `requireRole('system_admin')` to `requireRole('system_admin', 'procurement_admin')`
- Add company filtering: join `warehouses.company_id` with user's company access

### 3. Frontend Components

#### 3.1 Company Form Enhancement

**File:** `frontend/src/pages/mdm/CompanyForm.jsx` (updated)

- Add fields: CIN, PAN, certificate upload, address, city, state, PIN code
- Client-side validation: PAN 10 chars alphanumeric, PIN 6 digits
- Certificate upload via `antd Upload` with `beforeUpload` type/size check
- Form shown to `mdm_admin` and `system_admin` roles only

#### 3.2 Company Selector Component

**File:** `frontend/src/components/CompanySelector.jsx` (new)

Reusable `antd Select` that:
- Fetches `/api/companies?active_only=true` on mount
- Returns only companies the user is mapped to (API handles filtering)
- Emits `onChange` for dependent dropdowns (cost centre, vendor)

#### 3.3 Cost Centre Dropdown

Accepts `companyId` prop. On change, fetches `/api/sub-masters/cost-centre?company_id={companyId}`. Shows placeholder when no company selected.

#### 3.4 Vendor Dropdown (PO Form)

Accepts `companyId` prop. On change, fetches `/api/vendors?company_id={companyId}`.

#### 3.5 Inactive Company Badge

Shared `<InactiveCompanyBadge />` — renders `antd Tag color="red"` with "Inactive Company" text.

#### 3.6 RFQ Comparison "Create PO" Button

For each awarded vendor row, renders "Create PO" button calling `POST /api/rfqs/:rfqId/create-po`, then navigates to `/purchase-orders/:newPoId`.

#### 3.7 Sidebar Navigation Update

Inventory menu item added under Procurement Admin section:

```javascript
{ key: 'inventory', label: 'Inventory', icon: <DatabaseOutlined />,
  roles: ['system_admin', 'procurement_admin'] }
```

## Data Models

### company_master (extended)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| organization_id | VARCHAR(36) | FK, NOT NULL | Parent org |
| company_code | VARCHAR(20) | UNIQUE, NOT NULL | Short code |
| company_name | VARCHAR(150) | NOT NULL | Display name |
| gstin | VARCHAR(15) | NULL | GST number |
| address | TEXT | NULL | Full address |
| cin | VARCHAR(21) | NULL | Corporate Identity Number |
| pan | VARCHAR(10) | NULL | PAN (validated 10 alphanumeric) |
| certificate_path | VARCHAR(500) | NULL | Path to uploaded certificate file |
| city | VARCHAR(100) | NULL | City |
| state | VARCHAR(100) | NULL | State |
| pin_code | VARCHAR(6) | NULL | PIN code (validated 6 digits) |
| is_active | BOOLEAN | DEFAULT TRUE | Active flag |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

### vendor_company_mapping (new)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| vendor_id | VARCHAR(36) | FK vendors(id), NOT NULL | Vendor reference |
| company_id | VARCHAR(36) | FK company_master(id), NOT NULL | Company reference |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

Unique constraint on `(vendor_id, company_id)`.

### user_company_access (existing)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | NOT NULL | User reference |
| company_id | VARCHAR(36) | FK company_master(id), NOT NULL | Company reference |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

Unique constraint on `(user_id, company_id)`.

### sub_masters (extended)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ... | ... | ... | Existing columns unchanged |
| company_id | VARCHAR(36) | NULL, INDEX | Company scope for cost centres |

### warehouses (extended)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ... | ... | ... | Existing columns unchanged |
| company_id | VARCHAR(36) | NULL, INDEX | Company scope for inventory |

## Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| User lacks role for endpoint | 403 | "Access denied" |
| User submits unauthorized company_id | 403 | "Access denied" |
| MDM_Admin edits unmapped company | 403 | "You do not have access to this company" |
| Transaction for inactive company | 400 | "Company is inactive. New transactions cannot be created." |
| Invalid PAN format | 400 | "PAN must be exactly 10 alphanumeric characters" |
| Invalid PIN format | 400 | "PIN code must be exactly 6 digits" |
| Certificate wrong type | 400 | "Certificate must be PDF, PNG, or JPEG" |
| Certificate too large | 400 | "Certificate file must not exceed 5 MB" |
| Vendor not mapped to company (PO from RFQ) | 400 | "Vendor is not available for the selected company" |
| Vendor or company inactive (mapping) | 400 | "Both vendor and company must exist and be active" |
| Company not found | 400 | "Company not found" |

## Testing Strategy

### Unit Tests

- Company validators: specific PAN/PIN/certificate format examples
- Inactive company guard: verify 400 response for inactive company
- Role gate: verify 403 for unauthorized roles
- Company access resolution: verify empty array vs null behavior

### Property-Based Tests

- All 17 correctness properties below are tested with 100+ generated inputs
- Generators produce random users, roles, company sets, vendor sets, and mappings
- Each property test references its design document property number

### Integration Tests

- Database migration creates expected schema
- User-company access CRUD operations
- Vendor-company mapping CRUD operations
- End-to-end RFQ-to-PO conversion flow

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Company Management Role Gate

*For any* user with a role other than `mdm_admin` or `system_admin`, any attempt to create, edit, or inactivate a company record SHALL be rejected with a 403 response.

**Validates: Requirements 1.1, 1.2**

### Property 2: MDM_Admin Scoped Company Management

*For any* MDM_Admin user and *for any* company, the MDM_Admin can edit or inactivate that company if and only if the company's ID is present in the MDM_Admin's `user_company_access` records.

**Validates: Requirements 1.3**

### Property 3: Company Form Field Validation

*For any* string submitted as PAN, the system accepts it if and only if it matches `[A-Z0-9]{10}`. *For any* string submitted as PIN code, the system accepts it if and only if it matches `[0-9]{6}`. *For any* uploaded certificate file, the system accepts it if and only if the MIME type is in {application/pdf, image/png, image/jpeg} AND the size is ≤ 5 MB.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: PDF Document Company Details Inclusion

*For any* PR or PO with a non-null `company_id`, the generated PDF SHALL contain the company's name, address, city, state, PIN code, CIN, PAN, and GSTIN in its header. *For any* PR or PO with a null `company_id`, the PDF SHALL be generated without a company details section.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Inactive Company Blocks New Transactions

*For any* company with `is_active = false` and *for any* transaction type in {PR, PO, RFQ, ASN}, an attempt to create a new transaction with that company's ID SHALL be rejected with a 400 error.

**Validates: Requirements 4.2**

### Property 6: Inactive Company Excluded from Dropdowns

*For any* set of companies where some are inactive, the company selection dropdown API (with `active_only=true`) SHALL return only companies where `is_active = true` AND the company is in the user's access set.

**Validates: Requirements 4.4**

### Property 7: Cost Centre Filtered by Selected Company

*For any* company_id, the cost centre query SHALL return exclusively sub_master records where `category = 'cost_centre'` AND `company_id` matches the requested company. When no company_id is provided, the result SHALL be an empty array.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 8: System_Admin Unrestricted Access

*For any* System_Admin user and *for any* module endpoint (companies, vendors, PRs, POs, RFQs, ASNs, inventory), the system SHALL return all records regardless of `company_id` values or `user_company_access` mappings.

**Validates: Requirements 1.4, 6.6, 7.5, 8.4, 9.5, 10.4, 11.4**

### Property 9: Vendor-Company Mapping Validation

*For any* vendor-company mapping creation attempt, the system SHALL succeed if and only if both the referenced vendor and company exist AND both have `is_active = true`.

**Validates: Requirements 7.3**

### Property 10: Vendor Visibility Restricted by Company Access

*For any* non-system_admin user, the vendor list SHALL contain only vendors that have at least one `vendor_company_mapping` row whose `company_id` is in the user's `user_company_access` set. Vendors with no mapping to any of the user's companies SHALL not appear.

**Validates: Requirements 7.4, 10.5, 11.1, 11.3**

### Property 11: Company Dropdown Restricted to User Mappings

*For any* non-system_admin user on any creation form (PR, PO, RFQ), the company selection dropdown SHALL return exactly the set of active companies present in that user's `user_company_access` records.

**Validates: Requirements 8.1, 9.1**

### Property 12: Unauthorized Company Submission Rejected

*For any* non-system_admin user, if a transaction (PR, PO, RFQ, ASN) is submitted with a `company_id` that is NOT in the user's `user_company_access` records, the system SHALL reject the submission with a 403 response.

**Validates: Requirements 8.2, 9.3**

### Property 13: Transaction List Filtered by Company Access

*For any* non-system_admin user and *for any* transaction type (PR, PO, RFQ, ASN, inventory), the list endpoint SHALL return only records whose `company_id` is in the user's `user_company_access` set (or records where `company_id` is null, for legacy compatibility).

**Validates: Requirements 8.3, 9.4, 10.1, 10.2, 10.3, 12.3**

### Property 14: Vendor Dropdown Filtered by Selected Company

*For any* company selected on the PO creation form, the vendor dropdown SHALL return only vendors that have a `vendor_company_mapping` record for that specific company.

**Validates: Requirements 9.2**

### Property 15: New Vendor Requires Accessible Company Mapping

*For any* MDM_Admin creating a new vendor, the creation SHALL succeed only if at least one company in the submitted company mappings is present in the MDM_Admin's `user_company_access` records.

**Validates: Requirements 11.2**

### Property 16: RFQ-to-PO Conversion Data Integrity

*For any* RFQ with awarded vendor lines, creating a PO from the comparison page SHALL produce a PO where: the `company_id` equals the RFQ's `company_id`, the vendor matches the awarded vendor, all line items have quantities and prices from the winning bid, and `rfq_id` references the source RFQ.

**Validates: Requirements 13.2, 13.5**

### Property 17: RFQ-to-PO Vendor-Company Validation

*For any* RFQ-to-PO conversion attempt, if the awarded vendor does NOT have a `vendor_company_mapping` record for the RFQ's `company_id`, the system SHALL reject PO creation with an error indicating the vendor is not available for that company.

**Validates: Requirements 13.4**
