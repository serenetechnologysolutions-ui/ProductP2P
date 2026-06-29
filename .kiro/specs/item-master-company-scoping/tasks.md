# Implementation Plan: Item Master Company Scoping

## Overview

This plan implements company-scoped item master management, including: a database migration for the `item_company_mapping` junction table, Excel bulk import/export with company scoping, item-company mapping CRUD, user creation with company assignment, and scoped company dropdowns. It builds on the existing `resolveCompanyAccess` middleware and extends the current item-master and users modules.

## Tasks

- [x] 1. Database migration for item_company_mapping
  - [x] 1.1 Create `migrate-item-company-mapping.js` migration file
    - Create `backend/src/config/migrate-item-company-mapping.js`
    - Create `item_company_mapping` table with columns: `id VARCHAR(36) PRIMARY KEY`, `item_id VARCHAR(36) NOT NULL`, `company_id VARCHAR(36) NOT NULL`, `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
    - Add foreign keys: `item_id` → `item_master(id)`, `company_id` → `company_master(id)`
    - Add unique constraint `uq_item_company (item_id, company_id)`
    - Add indexes: `idx_icm_item (item_id)`, `idx_icm_company (company_id)`
    - Use idempotent `CREATE TABLE IF NOT EXISTS` pattern
    - Register migration in `package.json` migrate script
    - _Requirements: 3.1, 3.2_

- [x] 2. Item import service and route
  - [x] 2.1 Create `item-master.import.js` validation module
    - Create `backend/src/modules/item-master/item-master.import.js`
    - Implement `validateImportRows(rows, existingCodes)` function
    - Validate required fields: `item_code` and `item_description` must be present and non-empty
    - Detect duplicates: rows whose `item_code` exists in `existingCodes` are skipped with duplicate error
    - Return `{ valid: Array, errors: Array<{row, message}> }` structure
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Add import endpoint to item-master routes
    - Modify `backend/src/modules/item-master/item-master.routes.js`
    - Add `POST /api/item-master/import` route with `authenticate`, `requireRole('mdm_admin', 'system_admin')`, `resolveCompanyAccess`, and `multer` file upload middleware
    - Parse uploaded `.xlsx` file using `xlsx` package
    - Validate file exists and is `.xlsx` format; return 400 if invalid
    - Validate `company_ids` from request body (JSON string array); verify each exists in `company_master`
    - Call `validateImportRows()` with parsed rows and existing item_codes from DB
    - Insert valid rows into `item_master` and create `item_company_mapping` records within a transaction
    - Return Import_Summary: `{ total_rows, successful_count, skipped_count, errors }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 3.3_

  - [ ]* 2.3 Write property tests for import validation
    - **Property 1: Import row validation rejects invalid rows**
    - **Property 2: Import inserts novel items**
    - **Property 3: Import skips duplicates**
    - **Property 4: Import summary arithmetic invariant**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [x] 3. Item export endpoint
  - [x] 3.1 Add export endpoint to item-master routes
    - Add `GET /api/item-master/export` route with `authenticate`, `requireRole('mdm_admin', 'system_admin')`, and `resolveCompanyAccess`
    - If `req.companyIds` is not null (MDM_Admin), join `item_company_mapping` to filter items by user's accessible companies
    - If `req.companyIds` is null (System_Admin), return all active items
    - Use `xlsx` package to generate `.xlsx` buffer from query results
    - Set `Content-Type` to `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    - Set `Content-Disposition` header with timestamped filename
    - Send buffer as response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write property test for export company scoping
    - **Property 6: Export company scoping**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Checkpoint - Import/export working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Item-company mapping CRUD and company-scoped item list
  - [x] 5.1 Add company-scoped filtering to GET /api/item-master
    - Modify existing `GET /` route in `backend/src/modules/item-master/item-master.routes.js`
    - Add `resolveCompanyAccess` middleware
    - If `req.companyIds` is not null, INNER JOIN `item_company_mapping` filtered by user's companies and use `SELECT DISTINCT`
    - If `req.companyIds` is null (System_Admin), return all active items unchanged
    - _Requirements: 3.5, 3.6_

  - [x] 5.2 Update POST /api/item-master to accept company_ids
    - Modify existing `POST /` route in `backend/src/modules/item-master/item-master.routes.js`
    - Add `resolveCompanyAccess` middleware
    - Accept `company_ids` array in request body
    - After item insert, create `item_company_mapping` records for each company_id within a transaction
    - Validate that all `company_ids` exist in `company_master`
    - _Requirements: 3.3_

  - [x] 5.3 Add PUT /api/item-master/:id/companies endpoint
    - Add new route in `backend/src/modules/item-master/item-master.routes.js`
    - Accept `{ company_ids: [...] }` in body
    - Verify item exists (404 if not)
    - Within a transaction: delete all existing `item_company_mapping` for the item, then insert new mappings
    - Validate all `company_ids` exist in `company_master`
    - _Requirements: 3.4_

  - [ ]* 5.4 Write property tests for item-company mapping
    - **Property 7: Item-company mapping uniqueness**
    - **Property 8: Item creation produces correct mapping count**
    - **Property 9: Item mapping replacement is complete**
    - **Property 10: Item list returns only company-scoped items**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 6. User creation and update with company assignment
  - [x] 6.1 Enhance POST /api/users with company_ids
    - Modify `backend/src/modules/users/users.routes.js`
    - Accept optional `company_ids` array in request body
    - Wrap user creation in a transaction (use `pool.getConnection()`)
    - Validate all `company_ids` exist in `company_master`; return 400 if any invalid
    - After user INSERT, create `user_company_access` records for each `company_id`
    - If `company_ids` is empty or not provided, create user without company access records
    - Return `company_ids` in the response data
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Enhance PUT /api/users/:id with company_ids
    - Modify `backend/src/modules/users/users.routes.js`
    - Accept optional `company_ids` array in request body
    - Within a transaction: delete existing `user_company_access` for the user, then insert new records
    - Validate all `company_ids` exist in `company_master`
    - If `company_ids` not provided in body, leave existing company access unchanged
    - _Requirements: 4.5_

  - [ ]* 6.3 Write property tests for user company assignment
    - **Property 11: User creation produces correct company access records**
    - **Property 12: User creation transaction atomicity**
    - **Property 13: User company access replacement is complete**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

- [x] 7. MDM Admin scoped company dropdown
  - [x] 7.1 Apply resolveCompanyAccess to GET /api/companies
    - Modify `backend/src/modules/company/company.routes.js`
    - Add `resolveCompanyAccess` middleware to `GET /` endpoint
    - If `req.companyIds` is not null (MDM_Admin), add `WHERE id IN (...)` filter using `req.companyIds`
    - If `req.companyIds` is null (System_Admin), return all companies without filtering
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property test for company endpoint scoping
    - **Property 14: Company endpoint returns only accessible companies for scoped users**
    - **Validates: Requirements 5.1, 5.2**

- [x] 8. Checkpoint - All backend features complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend - Item import UI
  - [x] 9.1 Create ItemImport component
    - Create `frontend/src/pages/mdm/ItemImport.jsx`
    - Ant Design `Upload` component accepting `.xlsx` files only
    - Multi-company selector using existing CompanySelector in `mode="multiple"` for assigning companies to imported items
    - On upload, POST to `/api/item-master/import` as multipart/form-data with file and `company_ids`
    - Display Import_Summary result: total, successful, skipped counts
    - Show per-row errors in a collapsible Ant Design `Table` or `List`
    - Restrict access to `mdm_admin` and `system_admin` roles
    - _Requirements: 1.1, 1.5, 1.6_

  - [x] 9.2 Add export button to item master list page
    - Modify existing item master list page (e.g., `frontend/src/pages/mdm/ItemMaster.jsx`)
    - Add "Export" button that triggers `GET /api/item-master/export` and downloads the resulting file
    - Use `window.open()` or create a hidden anchor with blob URL for download
    - _Requirements: 2.1, 2.4_

- [x] 10. Frontend - Item-company mapping UI
  - [x] 10.1 Add multi-company selector to item create/edit form
    - Modify item creation form (within item master page or modal)
    - Add CompanySelector with `mode="multiple"` for selecting company mappings
    - On item create, include `company_ids` in the POST body
    - On item edit, show current company mappings and allow update via PUT `/api/item-master/:id/companies`
    - _Requirements: 3.3, 3.4_

- [x] 11. Frontend - User creation with company assignment
  - [x] 11.1 Add multi-company selector to user creation form
    - Modify user creation form/modal in admin section
    - Add CompanySelector with `mode="multiple"` for assigning companies at creation
    - Include `company_ids` in POST /api/users body
    - On user edit, show current company assignments and allow update via PUT
    - _Requirements: 4.1, 4.5_

- [x] 12. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The migration is additive-only — no existing columns or tables are dropped
- `resolveCompanyAccess` middleware is reused from the existing multi-company-isolation feature
- System_Admin bypass (`req.companyIds === null`) is preserved across all scoped queries
- The `xlsx` and `multer` packages are already available in dependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "5.2", "5.3", "6.1", "6.2"] },
    { "id": 3, "tasks": ["2.3", "3.2", "5.4", "6.3", "7.2"] },
    { "id": 4, "tasks": ["9.1", "9.2", "10.1", "11.1"] }
  ]
}
```
