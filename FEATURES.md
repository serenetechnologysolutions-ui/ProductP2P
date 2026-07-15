# ProcureTrack — Complete Features Document (v7.0)

## 1. Application Overview

ProcureTrack is an enterprise-grade Procure-to-Pay (P2P) platform built for multi-company operations. It covers the complete procurement lifecycle from Purchase Requisition to Payment, with advanced analytics, governance, and ERP-grade inventory management.

| Layer | Modules |
|-------|---------|
| **Core Procurement** | Purchase Requisitions, RFQ/Sourcing, Purchase Orders, ASN Management, Goods Receipt (GRN), Invoicing, Contracts |
| **Inventory & Logistics** | Batch Inventory, Purchase Returns, Branch Orders (Stock Transfers), In-Transit Stock |
| **Vendor Management** | Vendor Onboarding, Vendor Portal, Company-Vendor Mapping, Lifecycle Management |
| **Master Data** | Item Master (with Company Scoping & Excel Import/Export), Sub Masters, HSN-Tax Mapping, Procurement OS (Companies, Cost Centres) |
| **Advanced Analytics** | Supplier Risk, ESG Tracking, Price Benchmarking, Procurement Insights, Exception Management |
| **Governance** | Workflow Engine, Document Center, Audit Management, Traceability, Control Tower |
| **Platform** | Multi-Company Isolation, Role-Based Dashboards, Decision Engine, Action Engine, SAP Connector, Reports |

---

## 2. Multi-Company Architecture

| Feature | Description |
|---------|-------------|
| Company Master | Full company CRUD via Procurement OS (name, code, address, GST, CIN, logo, status) |
| Company-scoped data | All transactional data (PR, PO, RFQ, ASN, GRN, Inventory) is company-isolated |
| User-Company mapping | Users assigned to one or more companies; `company_ids` stored in user record |
| Vendor-Company mapping | Vendors mapped to companies they serve; scoped dropdowns throughout |
| Cost Centre scoping | Cost centres belong to specific companies |
| Company selector | Header-level company switcher for multi-company users |
| Legacy data support | `OR company_id IS NULL` ensures pre-migration records remain visible |
| Vendor role bypass | Vendor users see only their own data via vendor_id (no company filter needed) |

---

## 3. User Roles

| Role | Access Scope |
|------|-------------|
| System Admin | Platform settings, module activation, system health, user management, all companies |
| MDM Admin | Vendor lifecycle, master data, company-scoped vendor management, bulk import |
| Procurement Admin | Full procurement cycle (PR → PO → ASN → GRN → Inventory), view masters (no add/edit/delete) |
| Vendor | Self-onboarding, RFQ bidding, ASN creation, ticket participation, vendor portal |

---

## 4. Authentication & Security

| Feature | Description |
|---------|-------------|
| JWT login | Email/username + password, token-based sessions |
| Role-based access | Middleware enforces per-endpoint access |
| Company access middleware | `resolveCompanyAccess` + `requireCompanyAccess` guards |
| Rate limiting | 10 login attempts/minute per IP |
| Security headers | X-Content-Type-Options, X-Frame-Options, HSTS, CSP, no X-Powered-By |
| Input sanitization | HTML/script tags stripped from all inputs |
| bcrypt | Password hashing with salt rounds |
| Vendor data isolation | Vendors scoped to their own vendor_id |
| RFQ bid confidentiality | Other vendors' bids/identities never exposed |
| Audit logging | Structured JSON logs (app, audit, security, error) |
| VAPT compliant | 10 security checks passing (SQL injection, XSS, CSRF, rate limiting, auth bypass, session, headers, file upload, error disclosure, data exposure) |

---

## 5. Role-Based Dashboards (Light Theme)

### System Admin Dashboard
- **KPI Strip**: Total Users, Active Sessions (Live), Vendors Onboarded, Transactions (PO+ASN), API Requests/min, Error Rate
- **System Health**: Response time chart + top slow endpoints
- **Module Usage**: Donut chart showing session distribution across modules
- **Security Overview**: Failed logins, rate limit violations, suspicious IPs blocked, DB metrics

### MDM Admin Dashboard
- **KPI Strip**: Total Vendors, Pending Approvals, Blacklisted Vendors, Preferred Vendors, Avg Risk Score, Compliance Expiry Alerts
- **Vendor Lifecycle Funnel**: Draft → Submitted → Under Review → Approved → Active → Dormant → Blocked
- **Risk Score Distribution**: Donut chart (Low/Medium/High) with total count
- **Top Risky Vendors**: Table with risk score and trend indicators
- **Compliance Expiring Soon**: Vendor, document, expiry date, days left
- **Missing Documents**: Vendor-document gaps
- **Recent Vendor Activity**: Timeline feed

### Procurement Admin Dashboard
- **KPI Strip**: Open RFQs, Active POs, ASN In Transit, Delayed Shipments, Pending Validations, SLA Breaches
- **Procurement Pipeline**: Visual flow (RFQ → Awarded → PO → ASN → Validated → Posted) with drop-off %
- **ASN Tracking**: Donut chart (In Transit, Delivered, Delayed, Cancelled)
- **Action Queue**: Priority-sorted action items
- **Spend by Category**: Horizontal bar chart
- **Top Vendors by Spend**: Progress bars with amounts
- **Recent ASN Activities**: Timeline feed

### Vendor Dashboard
- **KPI Strip**: Active POs, Pending ASNs, Payments Due, Delivered, Overdue Deliveries, Compliance Alerts
- **Recent Purchase Orders**: Table with PO details, amounts, status, due dates
- **ASN Status**: Cards showing in-transit, delivered, pending ASNs
- **Delivery Performance**: Stacked bar chart (On Time vs Delayed)
- **Compliance Status**: Document validity list with expiry dates
- **Payment History**: Invoice list with paid/pending/overdue status

---

## 6. Vendor Management

| Feature | Description |
|---------|-------------|
| Create vendor | Name, Email, Phone, Company, Department, Group, Category, Location, Company mapping |
| Bulk import | Excel upload with per-row validation and skip/create report |
| Auto-onboarding | Auto-generated password, user account created |
| Vendor list | Paginated, searchable, filterable by status/type/risk/lifecycle/blacklist |
| Detail view | Overview, Addresses, Bank Accounts, Governance & Risk tabs |
| Admin edit | All fields editable (business info, governance fields, addresses, banks) |
| Workflow | Draft → Submitted → Under Review → Approved / Rejected → Inactive |
| Company-vendor mapping | Map vendors to companies they serve |
| Classification | vendor_code, vendor_type, industry, registration_type (sub-master backed) |
| Compliance | GST/PAN auto-validation, compliance_expiry_dates JSON map |
| Risk & lifecycle | risk_category, blacklist_flag, preferred_vendor_flag, lifecycle_stage |
| Supplier group | Optional field (not mandatory) |

---

## 7. Vendor Self-Onboarding

| Feature | Description |
|---------|-------------|
| 5-step form | Business Info → Addresses → Bank Accounts → Documents → Contacts |
| Core fields locked | Vendor cannot edit MDM fields |
| Multiple addresses | Billing/Shipping/Registered tags |
| Multiple banks | IFSC, Account, Holder, Bank, Branch, City, State, Country |
| 5 document uploads | PAN, GST Certificate, CIN, MSME Certificate, Bank Proof |
| Submit for approval | Saves all data and triggers workflow |

---

## 8. Purchase Requisitions (PR)

| Feature | Description |
|---------|-------------|
| Create PR | Auto-numbered (PR-000001), company-scoped, cost centre, requester info |
| Line items | Item (from Item Master), quantity, UOM, estimated price, delivery date |
| Line-level approval | PRs above ₹50,00,000 threshold require line-level approval |
| Budget validation | Real-time budget balance check against cost centre |
| Workflow | Draft → Submitted → Approved → Sourced → Closed |
| PR closure | Auto-close when all lines are fully sourced to POs |
| Company name display | Joined from company_master for display |

---

## 9. RFQ / Sourcing

| Feature | Description |
|---------|-------------|
| RFQ header | Title, description, deadline, type (open/limited/single), category, budget |
| Line items | Item Master link, qty, UOM, target price, technical specs, delivery location |
| Vendor invitations | Multi-vendor invite with participation status tracking |
| Lifecycle | Draft → Published → Closed → Awarded |
| Vendor bidding | Per-line-item pricing, lead time, taxes, payment terms, warranty, TCO |
| Comparison engine | Price benchmarks, risk scorecards, TCO ranking, scoring weights |
| RFQ Comparison UI | Visual vendor comparison with progress bars, recommendation engine, scenario simulation slider |
| Award | Auto-generates PO per winning vendor with price history |
| Quantity validation | Cannot exceed PR quantity in RFQ/PO/GRN |
| Confidentiality | Vendor responses omit other vendors' data |

---

## 10. Purchase Orders

| Feature | Description |
|---------|-------------|
| Create PO | Auto-numbered, vendor, line items with HSN, qty, UOM, price, tax % |
| HSN-Tax mapping | Dropdown from sub-master with auto-filled tax percentage per line |
| Commercial terms | Contract, incoterms, cost center, project code, budget code, retention % |
| Delivery schedule | Milestone/date/quantity %, partial delivery flag |
| Fulfillment tracking | Available qty = PO qty minus all non-rejected ASN quantities |
| PDF generation | Company details, line-level tax from HSN mapping |
| Versioning | PO amendment tracking |
| RFQ-generated POs | Auto-created on RFQ award |

---

## 11. ASN Management

| Feature | Description |
|---------|-------------|
| Creation | Vendor selects PO → enters ASN details → attachments → invoice |
| Available qty | Real-time computation from PO line minus existing ASNs |
| Mandatory fields | Invoice # (unique), ETA, Amount, LR, Transporter, Driver |
| Logistics | Shipment mode, vehicle number, e-way bill, dispatch/actual delivery dates |
| Financials | Currency, exchange rate, CGST/SGST/IGST, freight charges |
| Attachments | Invoice PDF, Reference PDF, Excel |
| Status flow | Draft → Submitted → Validated / Rejected → Posted |
| Three-way match | PO vs ASN vs GRN quantity/amount matching |

---

## 12. Goods Receipt Note (GRN)

| Feature | Description |
|---------|-------------|
| Separate module | Standalone page under Procurement submenu |
| ASN-based | Select validated ASN to create GRN |
| ASN info display | Shows ASN details as read-only reference |
| Line items | Received Qty, Damage Qty, Shortage Qty, Excess Qty, Remarks |
| Quantity validation | Total must tally with ASN qty |
| Auto-batch creation | On GRN completion, triggers batch number generation per line item |
| Status flow | Pending → Completed |

---

## 13. Batch Inventory Management

| Feature | Description |
|---------|-------------|
| Auto-generation | Batch created on GRN completion (format: ItemCode-Location-YYYYMMDD-Seq) |
| Batch record | batch_number, item_id, grn_id, location_id, qty_received, qty_available, rate |
| Batch inventory view | Part Number, Item Name, Batch Number, Location, Quantity, Rate, Discount, Tax %, Total |
| Batch-controlled stock | All inventory operations reference batch numbers |
| Used in | Purchase Returns, Branch Orders, Traceability |

---

## 14. Purchase Returns

| Feature | Description |
|---------|-------------|
| Filters | GRN Date, Batch Number, Vendor Name |
| Header | Vendor, GRN Number, ASN Number, Return Date, Return Reason (mandatory) |
| Line items | Item, Batch Number, Location, GRN Qty, Available Qty, Return Qty, Rate, Discount, Tax %, Amount |
| Calculations | Line total = Qty × Rate - Discount + Tax, round-off, total return amount |
| Business rules | Return qty ≤ available batch qty, batch selection mandatory, no return of consumed stock |
| Inventory impact | Reduces stock at batch level and overall inventory |

---

## 15. Branch Orders (Stock Transfers)

| Feature | Description |
|---------|-------------|
| Header | Requesting Branch, From Location, To Location, Request Type (sub-master), Request Date |
| Line items | Item, Available Stock, Requested Quantity |
| Flow | Request Created → Approved → Stock Transfer → Receipt |
| Inventory logic | Approval: reduce source + add to in-transit; Receipt: add to destination |
| In-transit stock | Separate tracking table for goods in transit |

---

## 16. Item Master

| Feature | Description |
|---------|-------------|
| Item record | item_code, description, category/subcategory (sub-master), UOM, HSN/SAC, standard cost, currency |
| Company scoping | item_company_mapping table - items mapped to specific companies |
| Excel import/export | Bulk upload/download with validation |
| Specifications | Free-form JSON attribute/value pairs |
| Vendor mapping | item_vendor_mapping with preferred supplier flag |
| Company-scoped list | Users see only items mapped to their companies |

---

## 17. HSN-Tax Mapping

| Feature | Description |
|---------|-------------|
| HSN as sub-master | HSN codes managed in Sub Masters with tax_percentage field |
| HsnDropdown component | Reusable dropdown that auto-fills tax % on selection |
| PO integration | PO form uses HSN dropdown; tax auto-applied per line item |
| Multi-line tax | Different HSN codes = different tax rates per PO line |
| PDF inclusion | PO PDF shows item + tax percentage at line level |

---

## 18. Procurement OS (Companies & Cost Centres)

| Feature | Description |
|---------|-------------|
| Company CRUD | Create/edit companies with name, code, address, city/state (dropdown from sub-masters), country (sub-master), GST, CIN |
| Cost Centre management | Company-scoped cost centres with budget allocation |
| Budget tracking | Real-time budget balance displayed in PR form |

---

## 19. Supplier Audit Management

| Feature | Description |
|---------|-------------|
| Checklists | Create/edit/delete with sequenced items |
| Scheduling | Date range + frequency (One-time/Weekly/Monthly/Quarterly), auto-creates executions |
| Execution | Planned → In Progress → Complete / Close |
| Responses | Yes/No/NA per checklist item, mandatory remarks for "No" |
| Findings | Severity levels, CAPA fields, evidence attachments |
| Closure rules | All findings must be resolved before closing |

---

## 20. Supplier Ticketing

| Feature | Description |
|---------|-------------|
| Create ticket | Subject, Description, Priority, Category, SLA (hours), assign to vendors |
| SLA breach | Computed live from sla_due_date |
| Auto-number | TKT-00001, TKT-00002, etc. |
| Messages | Thread-based, timestamped, role-tagged |
| Lifecycle | Initiated → In Progress → Vendor Closed → Closed |
| Admin close | Rating (1-5) + root_cause + resolution_type |

---

## 21. Supplier Risk Scoring

| Feature | Description |
|---------|-------------|
| Calculation | Weighted composite of 7 dimensions |
| Score | 0-100, Levels: Low (0-30), Medium (31-60), High (61-100) |
| Trend | risk_trend (improving/stable/worsening) |
| Dashboard | Summary cards + PieChart + vendor scores + sub-score breakdown |
| Vendor filter | Select specific vendor to view their risk dashboard |

---

## 22. ESG Tracking

| Feature | Description |
|---------|-------------|
| Per-vendor data | Diversity flag, compliance status, remarks |
| Environmental | carbon_emission_score, energy_consumption, waste_management_score |
| Certifications | certification_list (tags, e.g., ISO14001) |
| Evidence | Links to Document Center |

---

## 23. Price Benchmarking

| Feature | Description |
|---------|-------------|
| 3 tabs | Item Benchmarks, Vendor-wise Pricing, Item-wise Pricing |
| Item filter | Filter by specific item for focused analysis |
| Charts | Avg/Min/Max/Last price per item with bar chart |
| Source | Historical PO line item prices + RFQ award prices |

---

## 24. Governance & Compliance

### Workflow Engine
- Workflow definitions with ordered steps and approver roles
- Instance tracking with current step and status
- Step enforcement: only assigned role (or MDM override) can approve
- Full audit trail in workflow_logs

### Document Center
- Generic document storage with module/record linking
- Verification workflow (pending → verified/rejected)
- Expiry tracking

### Traceability
- End-to-end document flow: PR → RFQ → PO → ASN → GRN → Invoice
- Visual node-based graph with status indicators
- Timeline view of chronological events
- Line-level detail panel (PR qty → PO qty → GRN qty)
- Exception highlighting (red badges for mismatches)

### Control Tower
- Attention alerts: SLA breaches, critical exceptions, budget risks, vendor risks
- KPI section with live data
- AI-driven insights (price variance, vendor performance, budget utilization)
- Spend by category + monthly trend charts

### Exception Management
- Auto-detected exceptions: budget breach, GRN mismatch, SLA breach, vendor risk, compliance expiry
- Severity classification and resolution tracking

---

## 25. Reports & Analytics

| Feature | Description |
|---------|-------------|
| Reports module | Centralized reporting across all modules |
| Procurement insights | Spend analytics, category trends |
| Decision Engine | Rule-based automated decisions |
| Action Engine | Automated action triggers based on events |

---

## 26. Contracts Management

| Feature | Description |
|---------|-------------|
| Contract CRUD | Create/manage vendor contracts |
| Consumption tracking | Track spend against contract limits |
| PO linkage | POs linked to contracts with commercial terms |

---

## 27. Integration & Connectors

| Feature | Description |
|---------|-------------|
| SAP Connector | Mock integration endpoint for ERP posting |
| Event Bus | Internal event system for cross-module communication |
| GRN → Batch | EventBus listener auto-creates batches on GRN_COMPLETED |

---

## 28. UI/UX Design

| Feature | Description |
|---------|-------------|
| Ant Design 5 | Consistent enterprise component library |
| Light theme dashboards | White card-based layout on light gray (#F8F9FA) background |
| Underline form fields | Bottom-border-only inputs (light gray #e5e7eb, blue #93c5fd focus) |
| Collapsible sidebar | Dark sidebar with "Collapse Menu" button at bottom + header toggle |
| Role-based menus | Different sidebar items per role |
| No popups | Inline detail/edit views (list → detail → edit pattern) |
| Responsive | Row/Col grid layout |
| Reusable components | StatusTag, PriorityBadge, InsightCard, MetricCard, ExceptionAlert, VendorScoreCard |
| Company selector | Header-level company switcher |

---

## 29. Logging & Audit Trail

| Target | Content |
|--------|---------|
| app.log | All requests (method, URL, status, duration, IP, user, role) |
| audit.log | Login, password reset, vendor actions |
| security.log | Failed logins, rate limit violations |
| error.log | Unhandled errors with stack traces |
| workflow_logs (DB) | Every workflow action with actor and remarks |
| Event Bus | Cross-module event tracking |

---

## 30. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Ant Design 5, Recharts, Axios, React Router v6, dayjs |
| Backend | Node.js, Express.js (JavaScript) |
| Database | MySQL 8 (127.0.0.1:3306) |
| PDF Processing | Python, FastAPI, pdfplumber, rapidfuzz |
| Auth | JWT, bcrypt |
| Testing | Jest 30, Supertest (103 unit tests, 10 VAPT checks, 22 API tests) |

---

## 31. Database Tables (90+)

**Core:** users, sub_masters, company_master, user_company_mapping, vendor_company_mapping, cost_centres

**Vendor:** vendors, vendor_addresses, vendor_bank_accounts, vendor_documents

**Procurement:** purchase_requisitions, pr_line_items, rfqs, rfq_vendors, rfq_line_items, vendor_bids, vendor_bid_items, purchase_orders, po_line_items, asns, asn_line_items, grn, grn_line_items, invoices

**Inventory:** inventory_stock, inventory_batches, stock_movements, purchase_returns, purchase_return_line_items, branch_orders, branch_order_line_items, in_transit_stock

**Item Master:** item_master, item_vendor_mapping, item_company_mapping

**Advanced:** audit_checklists, audit_checklist_items, audit_schedules, audit_executions, audit_responses, audit_findings, tickets, ticket_vendors, ticket_messages, vendor_risk_scores, vendor_esg, price_history

**Governance:** workflow_master, workflow_steps, workflow_instances, workflow_logs, documents, exceptions, decision_rules, action_rules

**Config:** system_settings, field_requirements, field_configs, feature_flags, extraction_configs, contracts, contract_consumption

---

## 32. API Endpoints (120+)

| Module | Base Route | Key Operations |
|--------|-----------|----------------|
| Auth | /api/auth | login, reset-password, me |
| Vendors | /api/vendors | CRUD, import, onboarding, submit, approve, reject, deactivate |
| Companies | /api/companies | CRUD, company master management |
| Vendor-Company | /api/vendor-company-mapping | Map/unmap vendors to companies |
| Item Master | /api/item-master | CRUD, import/export, company mapping |
| Sub Masters | /api/sub-masters | CRUD per category (including HSN with tax %) |
| PR | /api/pr | CRUD, submit, approve, close |
| RFQ | /api/rfq | CRUD, publish, close, bids, comparison, award |
| Purchase Orders | /api/purchase-orders | CRUD, PDF generation |
| ASNs | /api/asns | CRUD, submit, validate, reject, post, three-way-match |
| GRN | /api/grn | Create from ASN, complete |
| Inventory | /api/inventory | Stock levels, movements |
| Batches | /api/inventory/batches | Batch inventory view |
| Purchase Returns | /api/inventory/purchase-returns | CRUD, approve, complete |
| Branch Orders | /api/inventory/branch-orders | CRUD, approve, transfer, receive |
| Contracts | /api/contracts | CRUD, consumption tracking |
| Audit | /api/audit | Checklists, schedules, executions, findings |
| Tickets | /api/tickets | CRUD, messages, reassign, close |
| Risk | /api/risk | Scores, calculate, dashboard |
| ESG | /api/esg | Per-vendor ESG data |
| Pricing | /api/pricing | Benchmarks, history |
| Traceability | /api/traceability | Document flow tracking |
| Exceptions | /api/exceptions | Auto-detected exceptions |
| Insights | /api/insights | Procurement analytics |
| Reports | /api/reports | Cross-module reporting |
| Workflow | /api/workflow | Definitions, instances, advance |
| Documents | /api/documents | Upload, verify, delete |
| Users | /api/users | CRUD with company assignment |
| System | /api/system | Settings, usage |
| Dashboard | /api/dashboard | Role-based stats |
| Decision Engine | /api/decision-engine | Rule management |
| Action Engine | /api/action-engine | Action triggers |
| Events | /api/events | Event bus endpoints |
| Integration | /api/integration | SAP connector |
| Payments | /api/payments | Payment tracking |

---

## 33. Role-Based Access Matrix

| Feature | System Admin | MDM Admin | Procurement Admin | Vendor |
|---------|:-----------:|:---------:|:-----------------:|:------:|
| System Settings | ✅ | ✗ | ✗ | ✗ |
| User Management | ✅ | ✅ | ✗ | ✗ |
| Procurement OS | ✅ | ✗ | ✗ | ✗ |
| Vendor Create/Approve | ✗ | ✅ | ✗ | ✗ |
| Vendor Self-Edit | ✗ | ✗ | ✗ | ✅ |
| Masters (Add/Edit/Delete) | ✗ | ✅ | ✗ (view only) | ✗ |
| PR Create/Approve | ✗ | ✅ | ✅ | ✗ |
| RFQ Create/Publish/Award | ✗ | ✅ | ✅ | ✗ |
| RFQ Bid | ✗ | ✗ | ✗ | ✅ |
| PO Create | ✗ | ✅ | ✅ | ✗ |
| ASN Create | ✗ | ✗ | ✗ | ✅ |
| ASN Validate/Post | ✗ | ✅ | ✅ | ✗ |
| GRN Create/Complete | ✗ | ✅ | ✅ | ✗ |
| Inventory/Batches | ✅ | ✅ | ✅ | ✗ |
| Purchase Returns | ✗ | ✅ | ✅ | ✗ |
| Branch Orders | ✗ | ✅ | ✅ | ✗ |
| Audit Management | ✗ | ✅ | ✅ | ✗ |
| Tickets | ✗ | ✅ | ✅ | ✅ (participate) |
| Risk/ESG/Pricing | ✗ | ✅ | ✅ | ✗ |
| Workflow Engine | ✗ | ✅ | ✅ | ✗ |
| Document Center | ✗ | ✅ | ✅ | ✗ |
| Reports | ✅ | ✅ | ✅ | ✅ |

---

## 34. Setup & Run

```bash
# Backend
cd backend
npm install
npm run migrate     # Runs all migration scripts (30+)
npm run seed        # Seeds system settings, sub masters, workflows, etc.
node src/app.js     # http://localhost:5000

# Frontend
cd frontend
npm install
npm start           # http://localhost:3000

# Kill existing processes (if needed)
lsof -ti:5000 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Run tests
cd backend && npm test    # 103 unit tests
```

---

## 35. Login Credentials

| Company | Role | Username | Password |
|---------|------|----------|----------|
| — | System Admin | sysadmin | SysAdmin@123 |
| L&T | MDM Admin | lt_mdm | Raja%$321 |
| L&T | Procurement Admin | lt_procurement | Raja%$321 |
| L&T | Vendor | lt_vendor | Raja%$321 |
| Siemens | MDM Admin | siemens_mdm | Raja%$321 |
| Siemens | Procurement Admin | siemens_procurement | Raja%$321 |
| Siemens | Vendor | siemens_vendor | Raja%$321 |

---

## 36. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Company isolation via middleware | Consistent enforcement without modifying every query manually |
| Batch-controlled inventory | ERP-grade traceability from GRN to return/transfer |
| HSN as sub-master with tax % | Single source of truth for tax mapping |
| Event-driven batch creation | GRN_COMPLETED event triggers auto batch generation |
| Light theme dashboards | Clean enterprise look matching SAP/Coupa aesthetic |
| Underline form fields | Modern minimal design reducing visual clutter |
| No popups/modals | Inline navigation preserves context |
| PR line-level approval | Threshold-based escalation (₹50L+) |
| Vendor data isolation | Server-side enforcement, not just UI hiding |
| Legacy data (NULL company_id) | Backward-compatible queries include pre-migration records |

---

## 37. Known Limitations

| Area | Status |
|------|--------|
| PDF extraction integration | Config CRUD complete; Python service not wired into ASN flow |
| ERP posting | Mock implementation (always succeeds) |
| Email notifications | Nodemailer configured but SMTP not set |
| SLA breach | Computed live on read (no background job) |
| Vendor "Dormant" stage | Settable but no auto-detection job |
| Geographic risk score | Defaults to 0 (no region-risk source) |
| Real-time dashboard data | Dashboards use mock data for KPIs; API integration available but backend aggregation endpoints pending |
