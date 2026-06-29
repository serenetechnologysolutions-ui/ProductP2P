# Implementation Plan: Multi-Company Isolation

## Overview

This plan implements strict company-level data boundaries across ProcureTrack. The core pattern introduces a `resolveCompanyAccess` middleware that resolves user-accessible company IDs and injects them into requests, enabling all modules to filter data by company. Key changes include: updating `getUserCompanyIds()` to scope MDM_Admin, adding vendor-company mapping, enriching company master data with statutory fields, company-filtering all transaction endpoints (PR/PO/RFQ/ASN/Inventory), and enabling RFQ-to-PO conversion.

## Tasks

- [x] 1. Database migration and schema changes
  - [x] 1.1 Create `migrate-multi-company-isolation.js` migration file
    - Create `backend/src/config/migrate-multi-company-isolation.js`
    - Add columns to `company_master`: `cin VARCHAR(21)`, `pan VARCHAR(10)`, `certificate_path VARCHAR(500)`, `city VARCHAR(100)`, `state VARCHAR(100)`, `pin_code VARCHAR(6)`
    - Create `vendor_company_mapping` table with `id`, `vendor_id`, `company_id`, unique constraint on `(vendor_id, company_id)`, and indexes
    - Add `company_id VARCHAR(36)` column to `sub_masters` with index
    - Add `company_id VARCHAR(36)` column to `warehouses` with index
    - All operations idempotent (duplicate-column guards, IF NOT EXISTS)
    - Register migration in `package.json` migrate script
    - _Requirements: 2.1, 5.3, 7.1_

- [x] 2. Company middleware and helpers
  - [x] 2.1 Update `getUserCompanyIds()` to scope MDM_Admin
    - Modify `backend/src/modules/company/company.helpers.js`
    - Change logic so only `system_admin` returns `null` (unrestricted); `mdm_admin` now queries `user_company_access` like other roles
    - Add `getCompanyDetails(companyId)` function for PDF generation (returns company name, address, city, state, pin_code, cin, pan, gstin)
    - _Requirements: 1.3, 6.6, 11.1_

  - [x] 2.2 Create company filter middleware
    - Create `backend/src/modules/company/company.middleware.js`
    - Implement `resolveCompanyAccess` middleware that sets `req.companyIds` from `getUserCompanyIds()`
    - Implement `requireCompanyAccess(companyIdExtractor)` that checks target company_id is in `req.companyIds` (or passes if null/system_admin)
    - _Requirements: 6.6, 8.2, 9.3_

  - [x] 2.3 Create company validators
    - Create `backend/src/modules/company/company.validators.js`
    - Implement `validatePAN(pan)` — accepts only `[A-Z0-9]{10}` format
    - Implement `validatePINCode(pinCode)` — accepts only `[0-9]{6}` format
    - Implement `validateCertificateFile(file)` — accepts PDF/PNG/JPEG, max 5 MB
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 2.4 Create inactive company guard
    - Create `backend/src/modules/company/company.guards.js`
    - Implement `assertCompanyActive(companyId, conn)` — queries `company_master.is_active`, throws 400 ValidationError if inactive
    - _Requirements: 4.1, 4.2_

  - [ ]* 2.5 Write property tests for company middleware
    - **Property 1: Company Management Role Gate** — verify non-mdm_admin/system_admin roles get 403 on company CRUD
    - **Property 2: MDM_Admin Scoped Company Management** — verify MDM_Admin can only manage mapped companies
    - **Property 8: System_Admin Unrestricted Access** — verify system_admin always gets null (unrestricted)
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.6**

- [x] 3. Checkpoint - Ensure middleware and migration work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Company routes enhancement
  - [x] 4.1 Update company create/edit routes with role and validation
    - Modify `backend/src/modules/company/company.routes.js`
    - Change `POST /` and `PUT /:id` to allow `mdm_admin` role alongside `system_admin`
    - Add `resolveCompanyAccess` middleware to `PUT /:id`; enforce MDM_Admin can only edit companies in their access set
    - Add PAN and PIN code validation on create and edit
    - Add new fields (cin, pan, city, state, pin_code) to INSERT and UPDATE queries
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [x] 4.2 Add certificate upload endpoint
    - Add `POST /companies/:id/certificate` route using multer (single file)
    - Validate file type (PDF/PNG/JPEG) and size (≤5 MB) using `validateCertificateFile`
    - Save file to disk and update `certificate_path` in `company_master`
    - _Requirements: 2.4_

  - [x] 4.3 Add `active_only` query parameter to company list
    - Modify `GET /` route to accept `?active_only=true`
    - When set, add `AND c.is_active = TRUE` to the WHERE clause
    - Used by frontend dropdown components to exclude inactive companies
    - _Requirements: 4.4, 4.5_

  - [ ]* 4.4 Write property tests for company validation and inactivation
    - **Property 3: Company Form Field Validation** — PAN/PIN/certificate format acceptance/rejection
    - **Property 5: Inactive Company Blocks New Transactions** — inactive company rejects creation
    - **Property 6: Inactive Company Excluded from Dropdowns** — active_only filter correctness
    - **Validates: Requirements 2.2, 2.3, 2.4, 4.2, 4.4**

- [x] 5. Vendor-company mapping module
  - [x] 5.1 Create vendor-company mapping routes
    - Create `backend/src/modules/vendor/vendor-company.routes.js`
    - `GET /api/vendor-company-mapping?company_id=...` — list mappings (MDM_Admin/System_Admin)
    - `POST /api/vendor-company-mapping` — create mapping; validate vendor and company exist and are active; MDM_Admin must have access to the company
    - `DELETE /api/vendor-company-mapping/:id` — remove mapping
    - Register routes in `app.js`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.2 Update vendor list endpoint with company filtering
    - Modify `backend/src/modules/vendor/vendor.routes.js`
    - For non-system_admin: JOIN `vendor_company_mapping` to filter vendors by user's accessible companies
    - Accept `?company_id=X` query param to further filter by a specific company
    - System_Admin sees all vendors unchanged
    - _Requirements: 7.4, 7.5, 9.2_

  - [x] 5.3 Enforce vendor-company mapping on vendor creation
    - Modify vendor create endpoint: MDM_Admin must provide at least one company mapping from their accessible companies
    - After vendor INSERT, create `vendor_company_mapping` rows for specified companies
    - _Requirements: 11.2, 11.3_

  - [ ]* 5.4 Write property tests for vendor-company mapping
    - **Property 9: Vendor-Company Mapping Validation** — creation succeeds only when both entities are active
    - **Property 10: Vendor Visibility Restricted by Company Access** — non-system_admin sees only mapped vendors
    - **Property 14: Vendor Dropdown Filtered by Selected Company** — company_id param filters correctly
    - **Property 15: New Vendor Requires Accessible Company Mapping** — MDM_Admin vendor creation validation
    - **Validates: Requirements 7.3, 7.4, 9.2, 11.1, 11.2, 11.3**

- [x] 6. Transaction company isolation (PR, PO, RFQ, ASN)
  - [x] 6.1 Add company isolation to PR module
    - Modify `backend/src/modules/pr/` routes
    - PR list: filter by `req.companyIds` using `getUserCompanyIds()`
    - PR create: add `resolveCompanyAccess` + `requireCompanyAccess` for submitted company_id; call `assertCompanyActive`
    - System_Admin bypasses all filters
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 6.2 Add company isolation to PO module
    - Modify `backend/src/modules/purchase-orders/` routes
    - PO list: filter by `req.companyIds`
    - PO create: validate company access + active check; vendor dropdown endpoint filters by `vendor_company_mapping`
    - System_Admin bypasses all filters
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.3 Add company isolation to RFQ module
    - Modify `backend/src/modules/rfq/` routes
    - RFQ list: filter by `req.companyIds`
    - RFQ create: validate company access + active check
    - System_Admin bypasses all filters
    - _Requirements: 10.1, 10.4_

  - [x] 6.4 Add company isolation to ASN module
    - Modify `backend/src/modules/asn/` routes
    - ASN list: filter by `req.companyIds`
    - ASN create: validate company access + active check
    - System_Admin bypasses all filters
    - _Requirements: 10.2, 10.4_

  - [ ]* 6.5 Write property tests for transaction isolation
    - **Property 11: Company Dropdown Restricted to User Mappings** — dropdown returns only mapped active companies
    - **Property 12: Unauthorized Company Submission Rejected** — non-mapped company_id returns 403
    - **Property 13: Transaction List Filtered by Company Access** — list returns only records for user's companies
    - **Validates: Requirements 8.1, 8.2, 8.3, 9.1, 9.3, 9.4, 10.1, 10.2, 10.3**

- [x] 7. Checkpoint - Ensure all backend isolation works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Inventory module and cost centre scoping
  - [x] 8.1 Update inventory module role access
    - Modify `backend/src/modules/inventory/inventory.routes.js`
    - Change `requireRole('system_admin')` to `requireRole('system_admin', 'procurement_admin')`
    - Add company filtering: join `warehouses.company_id` with user's accessible company IDs
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 8.2 Add company-scoped cost centre endpoint
    - Modify `backend/src/modules/sub-masters/sub-masters.routes.js`
    - Add `GET /api/sub-masters/cost-centre?company_id=X` endpoint
    - Returns only `sub_masters` records where `category = 'cost_centre'` AND `company_id` matches
    - Returns empty array when no `company_id` provided
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 8.3 Write property tests for inventory and cost centre
    - **Property 7: Cost Centre Filtered by Selected Company** — only matching cost centres returned
    - **Property 13 (inventory portion): Transaction List Filtered by Company Access** — inventory filtered through warehouse company_id
    - **Validates: Requirements 5.1, 5.2, 5.3, 12.3**

- [x] 9. PDF generation enhancement
  - [x] 9.1 Update PR and PO PDF generation with company details
    - Modify PR PDF route (likely `backend/src/modules/pr/` PDF endpoint) and PO PDF route (likely `backend/src/modules/purchase-orders/` PDF endpoint)
    - Use `getCompanyDetails(company_id)` to fetch company data
    - If company data exists: render company name, address, city, state, PIN code, CIN, PAN, GSTIN in PDF header
    - If no company_id or company not found: generate PDF without company section (existing behavior)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 9.2 Write property tests for PDF company details
    - **Property 4: PDF Document Company Details Inclusion** — verify PDF includes company details when company_id is present, omits when null
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 10. RFQ comparison to PO conversion
  - [x] 10.1 Implement RFQ-to-PO conversion endpoint
    - Add `POST /api/rfqs/:rfqId/create-po` route in `backend/src/modules/rfq/rfq.routes.js`
    - Accepts `{ vendor_id }` in body
    - Load RFQ with awarded lines for specified vendor
    - Validate vendor is mapped to RFQ's company via `vendor_company_mapping`
    - Validate user has access to RFQ's company
    - Assert company is active
    - Create draft PO pre-filled with: RFQ's company_id, awarded vendor, line items with awarded quantities and bid prices, payment terms
    - Set `rfq_id` on the new PO
    - Return `{ po_id }` for frontend navigation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 10.2 Write property tests for RFQ-to-PO conversion
    - **Property 16: RFQ-to-PO Conversion Data Integrity** — PO data matches RFQ awarded data
    - **Property 17: RFQ-to-PO Vendor-Company Validation** — rejects unmapped vendor
    - **Validates: Requirements 13.2, 13.4, 13.5**

- [x] 11. Checkpoint - Ensure all backend features work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Frontend - Company form and reusable components
  - [x] 12.1 Enhance company form with statutory fields
    - Update `frontend/src/pages/mdm/CompanyForm.jsx` (or create if not exists)
    - Add form fields: CIN, PAN, certificate upload, address, city, state, PIN code
    - Client-side validation: PAN 10-char alphanumeric, PIN 6-digit numeric
    - Certificate upload using `antd Upload` with `beforeUpload` check for type (PDF/PNG/JPEG) and size (≤5 MB)
    - Show form to `mdm_admin` and `system_admin` roles
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 12.2 Create reusable CompanySelector component
    - Create `frontend/src/components/CompanySelector.jsx`
    - Antd `Select` component that fetches `/api/companies?active_only=true` on mount
    - API handles filtering by user access; component displays only allowed companies
    - Emits `onChange` with selected company_id for dependent dropdowns
    - _Requirements: 4.4, 8.1, 9.1_

  - [x] 12.3 Create company-scoped CostCentreDropdown component
    - Create `frontend/src/components/CostCentreDropdown.jsx`
    - Accepts `companyId` prop; fetches `/api/sub-masters/cost-centre?company_id={companyId}` on change
    - Shows placeholder "Select a company first" when no companyId provided
    - _Requirements: 5.1, 5.2_

  - [x] 12.4 Create company-scoped VendorDropdown component
    - Create `frontend/src/components/VendorDropdown.jsx`
    - Accepts `companyId` prop; fetches `/api/vendors?company_id={companyId}` on change
    - Used on PO creation form to show only vendors mapped to the selected company
    - _Requirements: 9.2_

  - [x] 12.5 Create InactiveCompanyBadge component
    - Create `frontend/src/components/InactiveCompanyBadge.jsx`
    - Renders `antd Tag color="red"` with "Inactive Company" text
    - Used on transaction list rows and detail pages when the linked company is inactive
    - _Requirements: 4.3, 4.5_

- [x] 13. Frontend - Module integration and navigation
  - [x] 13.1 Integrate CompanySelector into PR, PO, and RFQ forms
    - Update PR creation/edit form to use `CompanySelector` and `CostCentreDropdown`
    - Update PO creation form to use `CompanySelector` and `VendorDropdown`
    - Update RFQ creation form to use `CompanySelector`
    - Wire `onChange` events to refresh dependent dropdowns
    - _Requirements: 5.1, 8.1, 9.1, 9.2_

  - [x] 13.2 Add InactiveCompanyBadge to transaction lists
    - Update PR, PO, RFQ, ASN list pages to show `InactiveCompanyBadge` on rows where the linked company is inactive
    - Make transaction rows read-only (disable edit buttons) when company is inactive
    - _Requirements: 4.3_

  - [x] 13.3 Add "Create PO" button on RFQ comparison page
    - Update RFQ comparison page component
    - For each awarded vendor row, render a "Create PO" button
    - On click, call `POST /api/rfqs/:rfqId/create-po` with the vendor_id
    - On success, navigate to `/purchase-orders/:newPoId` detail page
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 13.4 Update sidebar navigation for inventory access
    - Add Inventory menu item under Procurement Admin sidebar section
    - Set roles to `['system_admin', 'procurement_admin']`
    - _Requirements: 12.4_

  - [x] 13.5 Add vendor-company mapping management UI
    - Create a vendor-company mapping section in vendor detail/edit page (or MDM admin panel)
    - Allow MDM_Admin to add/remove company mappings for vendors
    - Show only companies the MDM_Admin has access to
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 14. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration is additive-only — no existing columns or tables are dropped
- `getUserCompanyIds()` is the single canonical gate for company access resolution
- System_Admin bypass (returns `null`) is preserved across all modules

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "9.1", "10.1"] },
    { "id": 7, "tasks": ["9.2", "10.2"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5"] },
    { "id": 9, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
