# Implementation Plan: Vendor Onboarding & ASN Management System

## Overview

Incremental implementation starting with project scaffolding, then building core modules (auth, vendor onboarding, ASN, document intelligence), frontend portals, and finally comprehensive testing at the end.

## Tasks

- [-] 1. Project scaffolding and core setup
  - [x] 1.1 Initialize backend project (Node.js + Express + TypeScript)
    - Create directory structure: `backend/src/modules/{auth,vendor,asn,validation,erp}`, `backend/src/common/`, `backend/src/config/`
    - Set up `package.json` with dependencies: express, typescript, pg, jsonwebtoken, bcrypt, nodemailer, fast-check, jest, supertest
    - Configure `tsconfig.json`, Jest config, ESLint
    - Create Express app entry point with middleware (JSON parsing, CORS, error handler)
    - _Requirements: All_

  - [ ] 1.2 Initialize Document Intelligence service (Python + FastAPI)
    - Create directory structure: `document-intelligence/src/{extraction,config}`
    - Set up `requirements.txt`: fastapi, uvicorn, pdfplumber, rapidfuzz, hypothesis, pytest
    - Create FastAPI app entry point
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 1.3 Set up PostgreSQL database schema and connection
    - Create database migration files for: vendors, purchase_orders, po_line_items, asns, asn_line_items, extraction_configs, users tables
    - Implement database connection pool using pg
    - Create seed data script for sub-masters (Company, Department, City, State, Country)
    - _Requirements: 1.3, 6.3_

- [ ] 2. Authentication module
  - [ ] 2.1 Implement password generation utility
    - Create `generatePassword()` function: 10 chars, mix of uppercase, lowercase, digits, special characters
    - _Requirements: 2.2_

  - [ ] 2.2 Implement authentication service
    - Create `AuthService` with login, password reset, JWT token issuance
    - Implement bcrypt password hashing and verification
    - Implement JWT token generation with role and vendorId claims
    - Implement first-login password reset enforcement (check `mustResetPassword` flag)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 2.3 Implement authorization middleware
    - Create role-based access control middleware
    - Create vendor data isolation middleware (vendor can only access own data)
    - _Requirements: 3.4_

- [ ] 3. Checkpoint - Auth module complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Vendor onboarding module
  - [ ] 4.1 Implement vendor creation service
    - Create `VendorService.create()` with mandatory field validation
    - Implement email format validation
    - Generate unique vendor ID on successful creation
    - Trigger onboarding email (password generation + email send)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [ ] 4.2 Implement vendor self-onboarding data capture
    - Create `VendorService.updateOnboarding()` for business info, addresses, bank accounts, documents, contacts
    - Enforce core MDM field immutability (ignore vendor attempts to modify)
    - Support multiple addresses with tag validation (billing/shipping/registered)
    - Support multiple bank accounts with mandatory field validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 4.3 Implement vendor approval workflow state machine
    - Create `VendorWorkflow` with valid transitions: Draft→Submitted, Submitted→UnderReview, UnderReview→Approved, UnderReview→Rejected, Rejected→Draft, Approved→Inactive
    - Enforce mandatory rejection reason
    - Implement soft delete (mark as Inactive)
    - Send rejection notification email
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 4.4 Implement vendor API routes
    - Wire up Express routes: POST /api/vendors, GET /api/vendors, GET /api/vendors/:id, PUT /api/vendors/:id/onboarding, POST /api/vendors/:id/submit, POST /api/vendors/:id/approve, POST /api/vendors/:id/reject, PUT /api/vendors/:id/deactivate
    - Apply auth middleware and role guards
    - _Requirements: 1.1, 4.1, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

- [ ] 5. Checkpoint - Vendor module complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. ASN management module
  - [ ] 6.1 Implement ASN creation service
    - Create `ASNService.create()` with mandatory field validation (ETA, Invoice Number, Total Amount, Invoice PDF, LR Number, Transporter Name, Driver Name)
    - Validate PO reference exists and belongs to the vendor
    - Enforce global invoice number uniqueness
    - Support partial shipment (multiple ASNs per PO)
    - Support partial quantity per line item (validate cumulative ≤ PO quantity)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 6.2 Implement ASN workflow state machine
    - Create ASN status transitions: Draft→Submitted, Submitted→Validated, Validated→Posted
    - Implement admin approve/reject actions
    - _Requirements: 6.6, 7.1, 7.4_

  - [ ] 6.3 Implement ASN API routes
    - Wire up Express routes: POST /api/asns, GET /api/asns, GET /api/asns/:id, PUT /api/asns/:id, POST /api/asns/:id/submit, POST /api/asns/:id/validate, POST /api/asns/:id/approve, POST /api/asns/:id/reject, POST /api/asns/:id/post
    - Apply auth middleware, role guards, and vendor isolation
    - _Requirements: 6.1, 6.6, 7.1, 7.3, 7.4_

- [ ] 7. Checkpoint - ASN module complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Document Intelligence service
  - [ ] 8.1 Implement text normalization
    - Create `normalize_text()`: lowercase, collapse multiple spaces to single space, strip leading/trailing whitespace
    - _Requirements: 8.3_

  - [ ] 8.2 Implement extraction config store
    - Create CRUD operations for extraction configurations (field name, aliases, regex, priority)
    - Implement priority-ordered retrieval
    - _Requirements: 9.1, 9.3_

  - [ ] 8.3 Implement PDF extraction engine
    - Create `extract_fields()`: read PDF with pdfplumber, normalize text, match aliases (exact then fuzzy via rapidfuzz), apply regex, calculate confidence scores
    - Return ExtractionResult for each configured field
    - Flag unmatched fields for manual review
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ] 8.4 Implement FastAPI endpoints for extraction service
    - Wire up routes: POST /extract, GET /config, POST /config, DELETE /config/:id
    - _Requirements: 8.1, 9.1_

- [ ] 9. Checkpoint - Document Intelligence complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Validation engine and ERP integration
  - [ ] 10.1 Implement invoice validation engine
    - Create `ValidationService.validate()`: compare extracted invoice data against PO and ASN records
    - Detect quantity mismatches, amount mismatches
    - Handle cumulative partial shipment validation
    - Return structured ValidationResult with per-field match status
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 10.2 Implement ERP mock integration
    - Create `ERPService.post()`: simulate posting, return success status
    - Track posting status (Posted, Failed, Pending)
    - Support retry on failure
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 11. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Frontend - Vendor Portal
  - [ ] 12.1 Set up React frontend project (matching D2D patterns)
    - Initialize with Create React App (react-scripts), NOT Vite
    - Install dependencies: antd 5, @ant-design/icons, axios, react-router-dom v6, dayjs, recharts
    - Create `src/api/axios.js` with base URL config and auth token interceptor
    - Create `src/global.css` matching D2D styling (38px inputs, 6px border-radius, table styles, form labels)
    - Create `src/components/Layout/AppLayout.jsx` — collapsible dark Sider (220px) + white Header with user avatar/role badge + Content outlet
    - Create `src/components/Layout/Sidebar.jsx` — grouped Menu items (Vendor Management, ASN, Settings) with icon mapping and auto-expand based on route
    - Create `src/components/shared/AttachmentsPanel.jsx` — reusable file upload/list/preview/delete component
    - Create `src/components/shared/FilterPanel.jsx` — reusable filter row component
    - Set up routing in `App.jsx` with `RequireAuth` wrapper and nested routes under AppLayout
    - _Requirements: All_

  - [ ] 12.2 Implement authentication pages (D2D Login pattern)
    - Create Login page: gradient background (#001529 → #003a70), centered Card (max-width 420px), app logo + title, Form with username/password inputs (size="large", prefix icons), Sign In button (block), Forgot Password link
    - Create Password Reset page: same card layout, verification code flow (username → code sent → new password)
    - Implement JWT token storage in localStorage (`vendor_token`, `vendor_user`)
    - Implement `RequireAuth` route guard checking token existence
    - Implement first-login password reset redirect (check `mustResetPassword` in stored user)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 12.3 Implement vendor self-onboarding pages (D2D multi-step form pattern)
    - Create multi-step onboarding form using Ant Design `Steps` component at top of Card
    - Steps: Business Info → Addresses → Bank Accounts → Documents → Contacts → Review & Submit
    - Each step: `Title level={5}` section headers, `Row gutter={16}` with `Col span` grid, form labels with `form-label-desc` helper text
    - Business Info step: GST Number, PAN, Trade Name, Legal Name, MSME Type fields
    - Addresses step: dynamic add/remove address cards, each with line1/line2/city/state/country/pincode + tag checkboxes (Billing/Shipping/Registered)
    - Bank Accounts step: dynamic add/remove bank cards, each with IFSC/Account/Holder/Bank/Branch/City/State/Country
    - Documents step: Upload components for PAN, GST Cert, CIN, MSME Cert, Bank Proof (using AttachmentsPanel pattern)
    - Contacts step: Phone 1/2, Email 1/2
    - Review step: read-only summary cards showing all entered data
    - Display core MDM fields as read-only (disabled inputs) at top
    - Previous/Next navigation at bottom, Submit button on final step
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 12.4 Implement vendor ASN pages (D2D list/detail/form pattern)
    - ASN List View: Title "My ASNs" + "Create ASN" button → Filter card (PO number, status, date) → Table with columns (ASN #, PO #, Invoice #, ETA, Amount, Status as colored Tag) → clickable rows
    - ASN Detail View: Back button + ASN # + Status tag → Tabs (Overview, Line Items, Documents, Extraction Results) → Card grid with Statistic components for key fields → extraction results table showing field/value/confidence/status
    - ASN Create Form: Step 1 — Select PO (searchable Select showing PO numbers) → Step 2 — ASN details (ETA DatePicker, Invoice Number, Total Amount, LR Number, Transporter, Driver) → Step 3 — Line items (dynamic rows with PO line reference, quantity, amount) → Step 4 — Upload Invoice PDF + optional docs
    - Show extraction results after PDF upload: table with Field/Extracted Value/Confidence %/Status columns, allow inline editing
    - _Requirements: 6.1, 6.2, 8.6_

- [ ] 13. Frontend - Admin Portal
  - [ ] 13.1 Implement MDM Admin vendor management pages (D2D Suppliers pattern)
    - Vendor List View: Title "Vendor Master" + "Add Vendor" button (PlusOutlined icon) → Filter card with search by Name/Phone/Email (Input with prefix icons) + Search/Clear buttons → Table with columns (Name with Avatar, Company, Category, Status as colored Tag, Created date) → clickable rows to open detail
    - Vendor Detail View: Back button + Vendor Name + status Tag + vendor number Tag → Tabs (Overview, Onboarding Data, Documents) → Overview tab: Row/Col Card grid with Statistic components (Contact, Phone, Email) + info cards (GST, PAN, Category, Location) + Address card with EnvironmentOutlined icon → Documents tab: AttachmentsPanel component → Action buttons: Edit, Approve (green), Reject (red with Popconfirm requiring reason input)
    - Vendor Create Form: Back button + "New Vendor" title → Card with Form layout="vertical" → Section "Basic Information" (Title level={5}): Vendor Name (span=8, size="large"), Email (span=6), Phone (span=5), Company (Select from sub-master), Department (Select), Supplier Group (Select), Category (Select), Location (Select) → Section "Contact Details" → Save/Cancel buttons with Divider above
    - Rejection Modal: Modal with Form containing TextArea for mandatory rejection reason + confirm button
    - Vendor status workflow actions: "Begin Review" button (Submitted→UnderReview), "Approve" button (green), "Reject" button (red), "Deactivate" button (Popconfirm)
    - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

  - [ ] 13.2 Implement Procurement Admin ASN management pages (D2D Orders pattern)
    - ASN List View: Title "ASN Management" → Tabs by status (Submitted/Validated/Posted) with counts → Filter card (vendor, PO number, invoice number, date range) → Table with columns (ASN #, Vendor, PO #, Invoice #, Amount, ETA, Status Tag) → clickable rows
    - ASN Validation Page: Back button + ASN # + Status → Two-column layout: Left (span=16) — Card "Invoice Data" showing extracted fields vs PO data in comparison table (Field/Extracted/Expected/Match columns, mismatches highlighted in red) + Line Items comparison table → Right (span=8) — Card "Actions" with Validate/Approve/Reject/Post to ERP buttons + Card "Timeline" showing status history
    - Mismatch highlighting: Row background `#fff2f0` for mismatches, `#f6ffed` for matches
    - Post to ERP button: triggers mock posting, shows success message, updates status tag
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.2_

  - [ ] 13.3 Implement extraction configuration admin page (D2D SubMasters pattern)
    - Page title "Extraction Training Setup" → Tabs by field type (Invoice Number, GST Number, Amount, Date, etc.) using Ant Design Tabs type="card"
    - Each tab: "Add" button (top-right) → Table with columns (Field Name, Aliases as Tags, Regex pattern, Priority as colored Tag, Actions) → inline edit/delete buttons
    - Add/Edit form: Card below table (same pattern as SubMasters) with inline Form: Field Name input + Aliases input (comma-separated) + Regex input + Priority Select (High/Medium/Low) + Save/Cancel buttons
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 13.4 Implement Dashboard page
    - Filter card at top: DateRangePicker + Vendor Select + Status Select + Apply/Reset buttons
    - Summary row: Statistic cards in Row/Col grid — Total Vendors, Pending Approval, Active Vendors, Total ASNs, Pending Validation, Posted to ERP
    - Charts section: PieChart (Vendors by Status), BarChart (ASNs per month), LineChart (ASN value trend)
    - Exception Alerts: Tabs (Pending Approvals, Overdue ASNs, Failed Postings) each with small Table
    - _Requirements: All_

- [ ] 14. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Comprehensive testing
  - [ ] 15.1 Write property test for password generation
    - **Property 2: Generated passwords meet complexity requirements**
    - **Validates: Requirements 2.2**

  - [ ] 15.2 Write property tests for authentication
    - **Property 3: First-login password reset enforcement**
    - **Property 4: Authentication correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ] 15.3 Write property test for vendor data isolation
    - **Property 5: Vendor data isolation**
    - **Validates: Requirements 3.4**

  - [ ] 15.4 Write property test for vendor creation validation
    - **Property 1: Vendor creation succeeds if and only if all mandatory fields are valid**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ] 15.5 Write property tests for onboarding data
    - **Property 6: Core MDM fields are immutable by vendor**
    - **Property 7: Multi-entity storage invariant**
    - **Property 8: Onboarding submission validation**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

  - [ ] 15.6 Write property tests for vendor workflow
    - **Property 9: Workflow state machine correctness (vendor transitions)**
    - **Property 10: Rejection requires reason**
    - **Property 11: Soft delete preserves data**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**

  - [ ] 15.7 Write property tests for ASN creation
    - **Property 12: Invoice number global uniqueness**
    - **Property 13: Partial shipment cumulative quantity invariant**
    - **Validates: Requirements 6.3, 6.4, 6.5, 10.3**

  - [ ] 15.8 Write property test for ASN workflow
    - **Property 9: Workflow state machine correctness (ASN transitions)**
    - **Validates: Requirements 6.6, 7.4**

  - [ ] 15.9 Write property test for text normalization
    - **Property 14: Text normalization idempotence**
    - **Validates: Requirements 8.3**

  - [ ] 15.10 Write property tests for extraction config
    - **Property 16: Extraction config round-trip**
    - **Property 17: Extraction config priority ordering**
    - **Validates: Requirements 9.1, 9.3**

  - [ ] 15.11 Write property tests for extraction engine
    - **Property 15: Confidence score correctness**
    - **Property 19: Keyword alias matching**
    - **Validates: Requirements 8.2, 8.4, 8.5, 9.2**

  - [ ] 15.12 Write property test for validation engine
    - **Property 18: Invoice validation comparison correctness**
    - **Validates: Requirements 10.1, 10.2**

  - [ ] 15.13 Write unit tests for ERP mock
    - Test successful posting returns "Successfully Posted"
    - Test failure logging and retry capability
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 16. Final checkpoint - All tests passing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required (no optional markers)
- Testing is consolidated in task 15 to run after all implementation is complete
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The Python Document Intelligence service communicates with the backend via HTTP
- Frontend tasks (12, 13) can be parallelized with backend development
