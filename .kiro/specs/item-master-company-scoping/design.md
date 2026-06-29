# Design Document: Item Master Company Scoping

## Overview

This feature extends the existing item master module with company-scoped access, Excel bulk import/export, a many-to-many item-company mapping via a junction table, and company assignment during user creation. It builds on the existing `resolveCompanyAccess` middleware and `getUserCompanyIds()` helper, ensuring MDM admins see only items and companies mapped to their access set while system admins retain unrestricted access.

## Architecture

### System Context

```
┌─────────────────┐       ┌────────────────────────────┐       ┌──────────┐
│  React Frontend │──API──▶│  Express Backend            │──SQL──▶│  MySQL   │
│  (Ant Design)   │       │  /api/item-master/*         │       │          │
│  CompanySelector │       │  /api/users (enhanced)      │       │          │
└─────────────────┘       │  /api/companies (existing)  │       └──────────┘
                          └────────────────────────────┘
```

### Request Flow

1. **Authentication** → `authenticate` middleware validates JWT
2. **Role Check** → `requireRole('mdm_admin', 'system_admin')` gates access
3. **Company Resolution** → `resolveCompanyAccess` sets `req.companyIds` (null for system_admin, array for others)
4. **Business Logic** → Route handler applies company filter to queries

## Components and Interfaces

### Backend Components

#### 1. Migration: `migrate-item-company-mapping.js`

Creates the `item_company_mapping` junction table with a unique constraint on `(item_id, company_id)`.

```javascript
// Schema
CREATE TABLE IF NOT EXISTS item_company_mapping (
  id VARCHAR(36) PRIMARY KEY,
  item_id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES item_master(id),
  FOREIGN KEY (company_id) REFERENCES company_master(id),
  UNIQUE KEY uq_item_company (item_id, company_id),
  INDEX idx_icm_item (item_id),
  INDEX idx_icm_company (company_id)
);
```

#### 2. Item Master Routes Enhancement: `item-master.routes.js`

Extends the existing route file with import, export, and company-scoped filtering.

**Modified Endpoints:**
- `GET /api/item-master` — Adds company-scope filtering via `resolveCompanyAccess`
- `POST /api/item-master` — Accepts `company_ids` array, creates mappings in transaction

**New Endpoints:**
- `POST /api/item-master/import` — Excel bulk import with multer file upload
- `GET /api/item-master/export` — Excel export filtered by company scope
- `PUT /api/item-master/:id/companies` — Update item-company mappings

#### 3. Item Import Service: `item-master.import.js`

Pure logic module for parsing and validating Excel rows.

```javascript
/**
 * @param {Array<Object>} rows - Parsed spreadsheet rows
 * @param {Set<string>} existingCodes - item_codes already in DB
 * @returns {{ valid: Array, errors: Array<{row: number, message: string}> }}
 */
function validateImportRows(rows, existingCodes) { /* ... */ }
```

#### 4. User Routes Enhancement: `users.routes.js`

Modifies `POST /api/users` and `PUT /api/users/:id` to accept and persist `company_ids` within a transaction.

### Frontend Components

#### 1. Multi-Company Selector (for Item Forms)

Extends CompanySelector to support `mode="multiple"` for selecting multiple companies during item creation/editing.

#### 2. Item Import Page/Modal

Upload Excel file, display import summary (success/skip/error counts), show per-row error details.

#### 3. User Creation Form Enhancement

Adds a multi-company selector to the user creation form.

### API Interfaces

#### POST /api/item-master/import

```
Request:
  Content-Type: multipart/form-data
  Body: file (xlsx), company_ids (JSON string array)
  Auth: mdm_admin, system_admin

Response 200:
{
  "success": true,
  "data": {
    "total_rows": 100,
    "successful_count": 85,
    "skipped_count": 15,
    "errors": [
      { "row": 3, "message": "Missing required field: item_code" },
      { "row": 7, "message": "Duplicate item_code: ITEM-001" }
    ]
  }
}
```

#### GET /api/item-master/export

```
Request:
  Auth: mdm_admin, system_admin
  Query: (optional) search, category

Response 200:
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="item_master_export_<timestamp>.xlsx"
  Body: Binary xlsx file
```

#### PUT /api/item-master/:id/companies

```
Request:
  Body: { "company_ids": ["uuid-1", "uuid-2"] }
  Auth: mdm_admin, system_admin

Response 200:
{
  "success": true,
  "message": "Company mappings updated"
}
```

#### POST /api/users (enhanced)

```
Request:
  Body: { "email", "password", "role", "full_name", "company_ids": ["uuid-1", "uuid-2"] }
  Auth: mdm_admin, system_admin

Response 201:
{
  "success": true,
  "data": { "id", "email", "role", "full_name", "company_ids": [...] }
}
```

#### PUT /api/users/:id (enhanced)

```
Request:
  Body: { "full_name", "role", "is_active", "company_ids": ["uuid-1"] }
  Auth: mdm_admin, system_admin

Response 200:
{
  "success": true,
  "message": "User updated"
}
```

## Data Models

### item_company_mapping

| Column     | Type        | Constraints                              |
|-----------|-------------|------------------------------------------|
| id        | VARCHAR(36) | PRIMARY KEY                              |
| item_id   | VARCHAR(36) | NOT NULL, FK → item_master(id)           |
| company_id| VARCHAR(36) | NOT NULL, FK → company_master(id)        |
| created_at| TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP                |

**Indexes:** UNIQUE(item_id, company_id), INDEX(item_id), INDEX(company_id)

### Existing Tables (unchanged schema)

- **item_master**: id, item_code, item_description, item_name, uom, category, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template, is_active
- **user_company_access**: id, user_id, company_id, created_at
- **company_master**: id, organization_id, company_code, company_name, gstin, address, cin, pan, city, state, pin_code, certificate_path, is_active

## Error Handling

| Scenario | HTTP Status | Error Type | Message |
|----------|-------------|------------|---------|
| Unauthorized role on import/export | 403 | AuthorizationError | "Forbidden" |
| Missing file on import | 400 | ValidationError | "No file uploaded" |
| Invalid file format (not .xlsx) | 400 | ValidationError | "Invalid file format. Please upload an .xlsx file" |
| Empty spreadsheet (no data rows) | 400 | ValidationError | "The uploaded file contains no data rows" |
| Non-existent company_id in company_ids | 400 | ValidationError | "Invalid company_id: <id>" |
| Item not found for mapping update | 404 | NotFoundError | "Item not found" |
| User not found for update | 404 | NotFoundError | "User not found" |
| Duplicate item_code during import | — | Skipped row | Recorded in errors array |
| Missing required fields in row | — | Skipped row | Recorded in errors array |

## Key Implementation Details

### Company-Scoped Item Query

```javascript
// GET /api/item-master with company scoping
async function getItems(req) {
  let sql = 'SELECT im.* FROM item_master im';
  const params = [];

  // If user is company-scoped (not system_admin), join with mapping table
  if (req.companyIds !== null) {
    sql += ` INNER JOIN item_company_mapping icm ON im.id = icm.item_id
             AND icm.company_id IN (${req.companyIds.map(() => '?').join(',')})`;
    params.push(...req.companyIds);
  }

  sql += ' WHERE im.is_active = TRUE';
  // ... additional filters (search, category)

  // De-duplicate since an item may map to multiple of user's companies
  sql = `SELECT DISTINCT im.* FROM item_master im` + sql.substring(sql.indexOf(' INNER'));
  
  const [rows] = await pool.query(sql, params);
  return rows;
}
```

### Import Transaction Pattern

```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();

  for (const validRow of validRows) {
    const id = uuidv4();
    await conn.query('INSERT INTO item_master (...) VALUES (...)', [...]);
    // Insert company mappings for this item
    for (const companyId of companyIds) {
      await conn.query(
        'INSERT INTO item_company_mapping (id, item_id, company_id) VALUES (?, ?, ?)',
        [uuidv4(), id, companyId]
      );
    }
  }

  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

### User Creation with Company Assignment

```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();

  // Validate all company_ids exist
  if (company_ids && company_ids.length > 0) {
    const [companies] = await conn.query(
      `SELECT id FROM company_master WHERE id IN (${company_ids.map(() => '?').join(',')})`,
      company_ids
    );
    if (companies.length !== company_ids.length) {
      throw new ValidationError('One or more company_ids are invalid');
    }
  }

  // Create user
  const userId = uuidv4();
  await conn.query('INSERT INTO users (...) VALUES (...)', [...]);

  // Create company access records
  for (const companyId of (company_ids || [])) {
    await conn.query(
      'INSERT INTO user_company_access (id, user_id, company_id) VALUES (?, ?, ?)',
      [uuidv4(), userId, companyId]
    );
  }

  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

### Export with Company Scoping

```javascript
const XLSX = require('xlsx');

async function exportItems(req, res) {
  let sql = 'SELECT im.* FROM item_master im';
  const params = [];

  if (req.companyIds !== null) {
    sql += ` INNER JOIN item_company_mapping icm ON im.id = icm.item_id
             AND icm.company_id IN (${req.companyIds.map(() => '?').join(',')})`;
    params.push(...req.companyIds);
  }
  sql += ' WHERE im.is_active = TRUE GROUP BY im.id ORDER BY im.item_code';

  const [rows] = await pool.query(sql, params);

  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    item_code: r.item_code,
    item_description: r.item_description,
    item_name: r.item_name,
    uom: r.uom,
    category: r.category,
    hsn_sac_code: r.hsn_sac_code,
    standard_cost: r.standard_cost,
    currency: r.currency,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="item_master_export_${Date.now()}.xlsx"`);
  res.send(buf);
}
```

## Testing Strategy

### Unit Tests
- Validate import row parsing logic (specific examples: empty fields, whitespace-only, valid rows)
- Verify HTTP headers on export response
- Confirm system_admin bypasses company filtering
- Test empty/missing company_ids on user creation produces no access records

### Property-Based Tests
- Import validation, duplicate detection, and summary invariants (Properties 1–5)
- Export company scoping filter correctness (Property 6)
- Item-company mapping CRUD correctness (Properties 7–10)
- User-company assignment and transaction atomicity (Properties 11–13)
- Company endpoint scoping (Property 14)

### Integration Tests
- Full upload flow: multipart form → parse → insert → summary response
- Export flow: request → query → xlsx buffer → correct headers
- User creation with company_ids → verify both tables populated
- Company dropdown response filtering for different roles

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Import row validation rejects invalid rows

*For any* spreadsheet row where item_code or item_description is empty/missing, the import process SHALL skip that row and include an error entry with the correct row number in the Import_Summary errors array.

**Validates: Requirements 1.1, 1.4**

### Property 2: Import inserts novel items

*For any* spreadsheet row with a valid item_code that does not exist in item_master, the import process SHALL insert a new active item record, and the resulting item_master table SHALL contain that item_code.

**Validates: Requirements 1.2**

### Property 3: Import skips duplicates

*For any* spreadsheet row whose item_code already exists in item_master, the import process SHALL skip that row and record a duplicate error in the Import_Summary without modifying the existing record.

**Validates: Requirements 1.3**

### Property 4: Import summary arithmetic invariant

*For any* import operation, the Import_Summary SHALL satisfy: total_rows = successful_count + skipped_count, and the errors array length SHALL equal skipped_count.

**Validates: Requirements 1.5**

### Property 5: Import role restriction

*For any* user whose role is not mdm_admin or system_admin, attempting to access the import endpoint SHALL result in a 403 Forbidden response.

**Validates: Requirements 1.6**

### Property 6: Export company scoping

*For any* MDM_Admin with a specific set of accessible companies, every item in the exported file SHALL have at least one item_company_mapping record linking it to one of that admin's accessible companies.

**Validates: Requirements 2.1, 2.2**

### Property 7: Item-company mapping uniqueness

*For any* pair (item_id, company_id), attempting to insert a duplicate mapping into item_company_mapping SHALL be rejected, ensuring no duplicate relationships exist.

**Validates: Requirements 3.2**

### Property 8: Item creation produces correct mapping count

*For any* item creation request with an array of N distinct valid company_ids, exactly N item_company_mapping records SHALL be created linking the new item to those companies.

**Validates: Requirements 3.3**

### Property 9: Item mapping replacement is complete

*For any* item with existing company mappings, updating with a new set of company_ids SHALL result in the item_company_mapping table containing exactly and only the new set — no remnants of previous mappings remain.

**Validates: Requirements 3.4**

### Property 10: Item list returns only company-scoped items

*For any* MDM_Admin querying the item list, every returned item SHALL have at least one item_company_mapping record where company_id is in the admin's accessible company set, and no item lacking such a mapping SHALL appear in results.

**Validates: Requirements 3.5**

### Property 11: User creation produces correct company access records

*For any* user creation request with an array of N distinct valid company_ids, exactly N user_company_access records SHALL be created for that user, and the user record SHALL also exist.

**Validates: Requirements 4.1, 4.2**

### Property 12: User creation transaction atomicity

*For any* user creation request where company_ids contains at least one non-existent company_id, the entire operation SHALL be rejected with a 400 error, and no user record or company access records SHALL be persisted.

**Validates: Requirements 4.2, 4.3**

### Property 13: User company access replacement is complete

*For any* user with existing company access records, updating with a new set of company_ids SHALL result in user_company_access containing exactly and only the new set for that user.

**Validates: Requirements 4.5**

### Property 14: Company endpoint returns only accessible companies for scoped users

*For any* MDM_Admin, the GET /api/companies response SHALL contain only companies present in that admin's user_company_access records, and no other companies SHALL appear.

**Validates: Requirements 5.1**
