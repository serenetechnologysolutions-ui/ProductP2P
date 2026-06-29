# Implementation Plan: HSN Tax Mapping

## Overview

This plan implements a centralized HSN code master with tax percentages in the existing `sub_masters` table, enhances the SubMasterTab with HSN-specific CRUD fields, and replaces the free-text HSN input in the PO line item form with a searchable dropdown that auto-fills tax rates. The implementation extends existing infrastructure without introducing new tables or external dependencies.

## Tasks

- [ ] 1. Database migration for tax_percentage column
  - [ ] 1.1 Create `migrate-hsn-tax.js` migration script
    - Create `backend/src/config/migrate-hsn-tax.js`
    - Check `INFORMATION_SCHEMA.COLUMNS` for existing `tax_percentage` column (idempotent)
    - If column does not exist, execute `ALTER TABLE sub_masters ADD COLUMN tax_percentage DECIMAL(5,2) NULL`
    - Log result (added or skipped)
    - Register migration in `package.json` migrate script
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Backend — Sub-Masters routes extension for HSN tax
  - [ ] 2.1 Add tax_percentage validation and HSN-specific logic to sub-masters routes
    - Modify `backend/src/modules/sub-masters/sub-masters.routes.js`
    - Add `validateHsnPayload(category, tax_percentage)` helper that rejects values < 0 or > 100
    - Update POST `/api/sub-masters`: include `tax_percentage` in INSERT; force `company_id = NULL` when category is `hsn_code`
    - Update PUT `/api/sub-masters/:id`: fetch record category, update `tax_percentage` for `hsn_code` records
    - Update GET `/api/sub-masters/:category`: include `tax_percentage` in SELECT and response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3_

  - [ ]* 2.2 Write property test for HSN CRUD round-trip
    - **Property 1: HSN CRUD Round-Trip**
    - Create record via POST with valid name, code, tax_percentage; retrieve via GET and verify all fields match and company_id is NULL
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]* 2.3 Write property test for tax_percentage validation
    - **Property 2: Tax Percentage Validation Rejects Out-of-Range Values**
    - Submit tax_percentage values < 0 and > 100 via POST and PUT; verify 400 response and no DB mutation
    - **Validates: Requirements 2.5**

  - [ ]* 2.4 Write property test for GET HSN endpoint active records
    - **Property 3: GET HSN Endpoint Returns Correct Active Records**
    - Insert mix of active/inactive hsn_code records; verify GET returns only active ones with correct fields, ordered by name
    - **Validates: Requirements 2.3, 6.1, 6.2**

- [ ] 3. Checkpoint - Verify migration and backend API
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Frontend — SubMasterTab enhancement for hsn_code category
  - [ ] 4.1 Add conditional tax_percentage column and form field to SubMasterTab
    - Modify `frontend/src/components/SubMasterTab.jsx`
    - Add "Tax %" column to table (visible only when `category === 'hsn_code'`)
    - Add `InputNumber` form field for tax_percentage (visible only when `category === 'hsn_code'`, min 0, max 100, step 0.01)
    - Include `tax_percentage` in POST/PUT payloads when category is `hsn_code`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write unit test for SubMasterTab HSN conditional rendering
    - **Property 9: Non-HSN Categories Hide Tax Percentage UI**
    - Verify "Tax %" column and input render for hsn_code, and are absent for other categories
    - **Validates: Requirements 3.4**

- [ ] 5. Frontend — HsnDropdown component
  - [ ] 5.1 Create HsnDropdown reusable component
    - Create `frontend/src/components/HsnDropdown.jsx`
    - Fetch HSN records from `/api/sub-masters/hsn_code` on mount
    - Render Ant Design `Select` with `showSearch`, `allowClear`
    - Display options as `"code — name"` format
    - Implement `filterOption` to search by name or code (case-insensitive)
    - Emit `onChange(selectedId, option)` where option carries `code`, `name`, `tax_percentage`
    - _Requirements: 4.1, 4.2_

  - [ ]* 5.2 Write unit test for HsnDropdown filter logic
    - **Property 4: HSN Dropdown Filter Matches Name or Code**
    - Verify filter returns records matching search string in name or code (case-insensitive)
    - **Validates: Requirements 4.2**

- [ ] 6. Frontend — PO Line Item form integration
  - [ ] 6.1 Replace free-text HSN input with HsnDropdown in PurchaseOrders
    - Modify `frontend/src/pages/PurchaseOrders.jsx`
    - Replace `<Input>` for HSN with `<HsnDropdown>` component in line item form
    - Implement `handleHsnSelect(index, selectedId, option)`:
      - On selection: set `hsn_sac = option.code`, set `tax_percent = option.tax_percentage`
      - On clear: clear `hsn_sac` and reset `tax_percent` to 0
    - Extend `updateItem` to recalculate `tax_amount = qty * price * (tax_percent / 100)` and `total_line_amount = amount + tax_amount`
    - Allow manual override of tax_percent after auto-fill
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 5.3_

  - [ ] 6.2 Add HsnDropdown to PO amendment panel
    - Update amendment section in `PurchaseOrders.jsx`
    - Pre-populate HsnDropdown with stored `hsn_sac` value by matching against fetched HSN records
    - Allow changing HSN selection during amendment with same auto-fill behavior
    - _Requirements: 7.1, 7.2_

  - [ ]* 6.3 Write unit test for HSN selection auto-fill and recalculation
    - **Property 5: HSN Selection Populates Line Item Fields**
    - **Property 6: Line Item Tax Amount Recalculation**
    - Verify selection sets hsn_sac and tax_percent; verify recalculation formula: tax_amount = qty * price * (tax_percent / 100)
    - **Validates: Requirements 4.3, 5.1, 5.3**

- [ ] 7. Checkpoint - Verify frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. End-to-end validation and HSN format enforcement
  - [ ] 8.1 Verify HSN/SAC format validation on PO creation with dropdown values
    - Confirm `validateGstHsn` function in backend continues to validate hsn_sac format (4, 6, or 8 digits) regardless of source
    - Test PO creation end-to-end: create PO with HSN-selected line items, verify hsn_sac and tax_percent persist correctly to po_line_items
    - _Requirements: 7.1, 7.3_

  - [ ]* 8.2 Write property test for HSN/SAC format validation
    - **Property 8: HSN/SAC Format Validation**
    - Verify `validateGstHsn` accepts only strings matching `^\d{4}(\d{2}){0,2}$` and rejects all others
    - **Validates: Requirements 7.3**

  - [ ]* 8.3 Write property test for PO line item HSN persistence
    - **Property 7: PO Line Item HSN Persistence Round-Trip**
    - Create PO with line items containing hsn_sac and tax_percent; retrieve and verify values match
    - **Validates: Requirements 7.1**

- [ ] 9. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration is additive-only — no existing columns or tables are dropped
- No changes to `po_line_items` schema — the dropdown populates existing columns
- HSN codes are always global (company_id = NULL), not scoped to any company
- The existing `validateGstHsn` function continues to enforce HSN/SAC format

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3"] }
  ]
}
```
