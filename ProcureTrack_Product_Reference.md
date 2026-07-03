# ProcureTrack — Product Reference

**Version:** 6.0  
**Date:** 2026-07-03  
**Database:** `vendor_portal` (MySQL 8.x)  
**Backend:** Node.js 18+ / Express 4 on port 5000  
**Frontend:** React 18 / Ant Design 5 on port 3000  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Modules](#3-modules)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Roles & Permissions](#6-roles--permissions)
7. [Key Features](#7-key-features)
8. [Login Credentials](#8-login-credentials)

---

## 1. Product Overview

ProcureTrack is a full-lifecycle **Procure-to-Pay (P2P)** platform that manages:

- Internal purchase requisitions with configurable approval workflows
- Vendor onboarding, compliance, risk scoring, and lifecycle management
- Sourcing events (RFQ) with multi-round negotiation and bid comparison
- Purchase order creation, amendment/versioning, and fulfillment tracking
- Shipment management (ASN), goods receipt (GRN), invoice 3-way matching
- Batch-controlled inventory with purchase returns and inter-branch transfers
- Budget commitment tracking (4-stage funnel)
- Decision intelligence (price benchmarking, exception detection, traceability)
- Multi-company data isolation with organization hierarchy

The platform operates in two modes:

- **Basic Mode** — Vendors, PRs, RFQ, Item Master, Contracts, POs, ASN/GRN/Invoice, Inventory
- **Advanced Mode** — Everything in Basic + Audits, Ticketing, Risk Scoring, ESG, Price Benchmarking

A cross-cutting **Governance layer** (workflow engine, document center, exception management, traceability) and **Decision Intelligence layer** (insights, alerts, vendor scoring) are available regardless of mode.

---

## 2. Architecture & Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4.19 |
| Database | MySQL 8.x (`mysql2` driver) |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing |
| File Upload | Multer |
| PDF Generation | PDFKit |
| Excel Import/Export | SheetJS (`xlsx`) |
| Email | Nodemailer |
| Unique IDs | UUID v4 |
| Testing | Jest + Supertest |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3 (Create React App) |
| UI Library | Ant Design 5.17 + @ant-design/icons |
| Routing | React Router DOM 6 |
| HTTP Client | Axios |
| Charts | Recharts |
| Date Handling | Day.js |
| Testing | React Testing Library |

### Project Structure

```
P2P/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express app + route registration
│   │   ├── common/                   # Shared utilities (db, eventBus, middleware, pdf, logger)
│   │   ├── config/                   # Migrations (migrate-*.js) + Seeds (seed-*.js)
│   │   └── modules/                  # Feature modules (34 modules)
│   │       ├── action-engine/        # Next Best Action rules
│   │       ├── asn/                  # ASN + GRN routes
│   │       ├── assistant/            # Smart procurement assistant
│   │       ├── audit/                # Audit checklists, schedules, execution
│   │       ├── auth/                 # Login, JWT, password reset
│   │       ├── company/              # Multi-company management
│   │       ├── contracts/            # Contract master + consumption
│   │       ├── dashboard/            # Dashboard statistics
│   │       ├── decision-engine/      # Decision rules engine
│   │       ├── documents/            # Document center
│   │       ├── esg/                  # ESG tracking
│   │       ├── events/               # Event log (event bus)
│   │       ├── exceptions/           # Procurement exceptions / control tower
│   │       ├── extraction/           # Document extraction config
│   │       ├── insights/             # Procurement insights & scoring
│   │       ├── inventory/            # Stock, batches, returns, branch orders
│   │       ├── item-master/          # Item master + company mapping
│   │       ├── payments/             # Payment schedule & lifecycle
│   │       ├── pr/                   # Purchase requisitions
│   │       ├── pricing/              # Price benchmarking & history
│   │       ├── purchase-orders/      # PO management + versioning
│   │       ├── reports/              # Reporting
│   │       ├── rfq/                  # RFQ, bidding, negotiation, award
│   │       ├── risk/                 # Vendor risk scoring
│   │       ├── sap-connector/        # SAP integration (mock)
│   │       ├── sub-masters/          # Sub-master reference data
│   │       ├── system/               # System settings, field config, budget
│   │       ├── tickets/              # Supplier issue tickets
│   │       ├── traceability/         # Document traceability engine
│   │       ├── upload/               # File upload handling
│   │       ├── users/                # User CRUD
│   │       ├── vendor/               # Vendor CRUD + company mapping
│   │       ├── vendor-portal/        # Vendor portal V2 APIs
│   │       └── workflow/             # Workflow engine
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Routes + role guards
│   │   ├── components/Layout/        # AppLayout, Sidebar, Header
│   │   ├── contexts/                 # FieldConfig, FeatureFlags contexts
│   │   └── pages/                    # 37 page components
│   └── package.json
└── document-intelligence/            # Optional Python/FastAPI service (port 8000)
```

---

## 3. Modules

### 3.1 Multi-Company Management

- Organization → Company → Business Unit hierarchy
- Company master with statutory fields (GSTIN, CIN, PAN, address, certificate)
- `user_company_access` maps users to allowed companies (data isolation)
- `vendor_company_mapping` maps vendors to companies they serve
- `item_company_mapping` scopes items to specific companies
- Company-scoped sub_masters and warehouses (`company_id` column)
- Intercompany sales orders (mirror POs between org-internal companies)
- SAP company code mapping per company

### 3.2 User Management

- Four roles: `system_admin`, `mdm_admin`, `procurement_admin`, `vendor`
- JWT-based authentication with bcrypt password hashing
- Mandatory password reset on first login (`must_reset_password` flag)
- Rate limiting on login (10 attempts/minute)
- Role-based route guards (frontend) + `requireRole()` middleware (backend)
- User activation/deactivation
- Company access assignment per user

### 3.3 Vendor Management

- Full vendor lifecycle: Draft → Submitted → Under Review → Approved → (Inactive)
- Self-registration (vendor role) or admin-created
- Multi-address support with tags (billing, shipping, registered)
- Bank account details with IFSC validation
- Document uploads (PAN, GST certificate, CIN, MSME, bank proof)
- Vendor 360 Profile (total spend, active POs, on-time delivery %, rejection rate)
- Vendor segmentation (strategic / preferred / approved / tactical)
- Compliance engine (document expiry tracking, auto-blocking of non-compliant vendors)
- Lifecycle stage computation (Onboarding / Active / Dormant / Blocked)
- Blacklist flag support
- Vendor-company mapping for multi-company isolation

### 3.4 Item Master

- Item code, description, UOM, category, standard cost, currency
- Company-scoped via `item_company_mapping` (many-to-many)
- Item-vendor mapping with preferred vendor flag
- Excel import/export capability
- Used by PR line items, RFQ line items, inventory, batch tracking

### 3.5 Sub Masters (Reference Data)

Admin-editable dropdown reference data used across the platform. Categories include:

| Category | Examples |
|----------|---------|
| company | Serene Technology, ABC Corp |
| department | Procurement, Finance, Operations, Logistics |
| supplier_group | Raw Materials, Services, Equipment, Packaging |
| supplier_category | Tier 1, Tier 2, Tier 3 |
| country | India, USA, UK |
| state | Maharashtra, Karnataka, Tamil Nadu, Delhi, Gujarat |
| city | Mumbai, Pune, Bangalore, Chennai, Delhi |
| cost_center | (admin-defined) |
| uom | Nos, Kg, Box, Roll, etc. |
| hsn_code | HSN codes with associated tax percentage |
| currency | INR, USD, EUR |
| incoterms | CIF, FOB, EXW, etc. |
| payment_terms | Net 30, Net 60, etc. |
| document_type | Standard, Capex, Service |
| priority | Low, Medium, High, Urgent |

Company-scoped via optional `company_id` column.

### 3.6 Purchase Requisitions (PR)

- Document types: Standard, Capex, Service
- Fields: department, cost center, project code, justification, priority, required date
- Line items linked to Item Master with estimated pricing
- Sourcing strategy: `RFQ_REQUIRED`, `DIRECT_PO_ALLOWED`, `AUTO_PO`, `CONTRACT_BASED`
- Budget check on submit (hard/soft enforcement configurable)
- Line-level approval (value threshold + category-based flagging)
- Workflow-driven approval with conditional/parallel steps
- Status flow: draft → submitted → approved/partially_approved → sourcing → closed
- Manual close with reason (releases budget commitment)
- Auto-creates PO for AUTO_PO strategy with preferred vendor
- PR audit log for full action trail
- Conversion to RFQ or PO (partial line consumption tracked)

### 3.7 RFQ & Negotiation

- Create standalone or from PR (carries lines/quantities forward)
- Vendor invitation with suggestion engine (ranks by history, score, risk)
- Multi-round negotiation (reopen closed RFQ for new rounds)
- Vendor bidding per line item (price, lead time, payment terms, warranty, deviations)
- Bid comparison matrix with TCO ranking, historical benchmarks, should-cost analysis
- Admin-configurable scoring weights
- Single-vendor or split-vendor award
- Auto-generates PO(s) on award
- Records awarded prices to price_history for future benchmarking

### 3.8 Purchase Orders (PO)

- Create manually, from PR, or from awarded RFQ
- GST + HSN/SAC validation (GSTIN 15-char format, HSN 4/6/8 digits)
- Tax at line level (HSN code → tax % mapping)
- PO versioning / amendment workflow (propose → approve/reject by different user)
- Version history with JSON diff per change
- Contract consumption tracking (enforces contract validity/value caps)
- Fulfillment tracking from ASN (open → partially_fulfilled → fulfilled)
- Multi-company fields (organization_id, company_id, business_unit_id)
- Department, account assignment, plant fields carried from PR

### 3.9 Advance Shipment Notice (ASN)

- Created by vendors against POs
- Shipment details: LR number, transporter, driver, ETA
- Invoice fields (number, amount, tax) on ASN header
- Line items mapped to PO lines with shipped quantities
- Status flow: Draft → Submitted → Validated → Posted (or Rejected)
- Three-way match (PO vs ASN price/quantity check)
- ERP posting gated on GRN completion + Invoice match (configurable)
- PDF generation with shipment details

### 3.10 Goods Receipt Note (GRN)

- Separate module (not embedded in ASN) with its own list/detail views
- Created from validated ASN — captures actual receipt inspection
- Per-line: received qty, rejected qty, accepted qty (computed), rejection reason
- Tolerance rule: deviation beyond `grn_quantity_tolerance_pct` (default 5%) → exception
- GRN status: draft, completed, exception
- Auto-generates inventory batches on completion
- Batch number auto-generated (format: `BATCH-{itemCode}-{timestamp}`)
- Feeds into inventory stock and stock_movements

### 3.11 Invoice Management

- Created from ASN (after GRN exists)
- 3-way match: PO price vs GRN accepted qty vs Invoice billed amount
- Price tolerance: `invoice_price_tolerance_pct` (default 2%)
- Match status: pending, matched, blocked
- Blocked invoices raise `invoice_mismatch` exception
- GST breakdown: CGST, SGST, IGST, freight charges
- Currency + exchange rate support
- Feeds payment schedule creation

### 3.12 Batch Inventory

- Auto-generated batches from GRN line items
- Batch fields: batch_number, item, GRN reference, location, qty_received, qty_available, rate, discount %, tax %
- Batch status: active / exhausted
- Batch-wise stock tracking per warehouse/location
- Stock deduction on purchase returns and branch order dispatch
- Batch selection during returns (FIFO or manual)
- Frontend page: `/batch-inventory` with batch list, filters, and stock view

### 3.13 Purchase Returns

- Return against a specific GRN (header linked to GRN + vendor)
- Per-line: item, batch selection, return quantity, rate, discount %, tax %, computed line amount
- Round-off field + total amount computation
- Status flow: draft → confirmed → closed
- Confirmation deducts qty_available from selected batch(es)
- Creates `return_out` stock movement records
- Batch auto-marked `exhausted` when qty_available reaches 0
- Return number auto-generated (format: `RET-{sequence}`)

### 3.14 Branch Orders / Stock Transfers

- Inter-location inventory transfers between warehouses
- Fields: from_location, to_location, requesting_branch, request_type, request_date
- Line items: item, requested_quantity, approved_quantity, received_quantity, variance
- Status flow: created → approved → in_transit → received
- Approval step with approved_by tracking
- Dispatch creates `in_transit_stock` records + `transfer_out` stock movements
- Receipt at destination creates `transfer_in` stock movements
- Variance tracking (received vs dispatched)

### 3.15 Inventory

- Warehouse master (code, name, location, company-scoped)
- `inventory_stock` per warehouse × item (quantity_on_hand, reorder_level, reorder_qty)
- `stock_movements` ledger: in, out, batch_in, return_out, transfer_out, transfer_in, consumption
- Reference types: grn, consumption, adjustment, batch, purchase_return, branch_order
- Reorder alerts when stock falls below reorder_level
- Frontend page: `/inventory` with stock levels, movement history

### 3.16 Budget & Cost Centre Management

- Budget allocations per cost_center × fiscal_year
- 4-stage commitment funnel:
  - `allocated_amount` → set by admin
  - `committed_amount` → PR approved (commitBudget)
  - `consumed_amount` → PO created (releaseCommitment + consumeBudget)
  - `actual_amount` → ASN posted to ERP (releaseConsumption + recordActual)
- Remaining = allocated − committed − consumed − actual
- Hard/soft enforcement modes (configurable via `pr_budget_enforcement` setting)
- Budget breach raises `budget_breach` exception
- Admin UI for managing allocations on System Settings page

### 3.17 Workflow Engine

- Generic approval engine (used by PR, extensible to any module)
- Workflow master → workflow steps (ordered, conditional, parallel)
- Conditional steps: `condition_rule` (JSON array of field/operator/value)
- Parallel approvals: multiple steps at same step_order (AND-join)
- SLA escalation: `sla_hours` per step → `sla_due_at` computation → breach detection
- Workflow instances track active approval progress
- Per-step approval tracking (`workflow_instance_step_approvals`)
- Auto-resolve when no conditional steps apply
- Escalation role visibility on SLA breach

### 3.18 Decision Engine & Action Rules

**Decision Engine:**
- Admin-configurable rules per module (PR, RFQ, PO, Invoice)
- Conditions → output types: best_vendor, risk_alert, budget_alert, cost_insight
- Priority-ordered rule evaluation
- Decision outputs stored per record for audit

**Action Engine (Next Best Action):**
- Event-triggered rules (tied to event bus events)
- Conditions → recommended action + payload
- Priority-ordered, active/inactive toggle
- Feeds into procurement assistant suggestions

### 3.19 Audit Management

- Audit checklists (name, description, category, sequenced items)
- Audit schedules (checklist × vendor/group, frequency: one_time/monthly/quarterly)
- Audit execution with per-item responses (yes/no/na + remarks)
- Audit findings (severity: low/medium/high/critical, assignee, status tracking)
- Feeds into vendor risk scoring (audit_score dimension)

### 3.20 Supplier Issues (Tickets)

- Create tickets against one or more vendors
- Fields: subject, description, priority, status
- Status flow: initiated → in_progress → vendor_closed → closed
- Per-vendor tracking within a ticket
- Message thread (sender_id, role, timestamp)
- Rating on closure
- Vendor can view and respond to assigned tickets

### 3.21 Supplier Risk

- 7-dimension composite risk scoring:
  - Delay score, Rejection score, Audit findings score
  - Financial risk, Dependency risk, Geographic risk, ESG risk
- Risk levels: low / medium / high
- Risk trend tracking (improving/stable/worsening)
- Auto-raises `vendor_risk` exception for high-risk vendors
- Feeds into RFQ vendor comparison scorecards
- Risk Dashboard page with portfolio-level view

### 3.22 ESG Tracking

- Per-vendor ESG record
- Diversity flag (boolean)
- Compliance status: compliant / non_compliant / pending
- Remarks and last-updated tracking
- Contributes to risk scoring and vendor evaluation

### 3.23 Price Insights & Benchmarking

- Price history recording from PO/RFQ awards
- Item-level price trends and benchmarks
- Vendor price competitiveness scoring
- Should-cost analysis (market average vs bid price)
- Deviation flagging (green ≤5%, orange 5-15%, red >15%)
- Sourcing recommendation computation (strategy suggestion for PRs)
- Vendor scoring (blend of risk, price, contract status)

### 3.24 Document Traceability

- `transaction_chain_id` links all documents in a procurement chain
- Full chain walk: PR → RFQ → PO → ASN → GRN → Invoice
- `document_flow_mapping` ledger tracks quantity hand-offs per line
- API: `GET /api/traceability/:documentId` resolves any document in the chain
- Visualized as document flow diagram + chronological timeline
- Cross-referenced from exceptions (View Source action)

### 3.25 Control Tower (Exceptions)

- Central `procurement_exceptions` table for all detected anomalies
- Exception types: budget_breach, price_mismatch, quantity_mismatch, vendor_risk, compliance_expiry, grn_tolerance_breach, invoice_mismatch, sla_breach
- Severity levels: low / medium / high / critical
- Dedup key prevents duplicate exceptions
- Auto-resolve when condition clears
- Manual resolve with remarks
- Summary endpoint (Open/Critical/High/Medium/Low/Resolved Today)
- Deep-link to source (vendor page or traceability view)

### 3.26 Contracts

- Contract master: number, vendor, title, start/end dates, payment terms, value
- Status: active / expired / terminated
- Consumption tracking: `consumed_value` accumulates as POs are created
- `remaining_value` computed (never stored): contract_value − consumed_value
- Default unit price (optional rate-card pricing)
- Validity enforcement at PO creation time
- Currency support (default INR)

### 3.27 Reports

- Accessible to all roles
- Frontend page with reporting views
- Data aggregation across modules

### 3.28 Vendor Portal (V2)

- Feature-flag gated (`vendor_portal_v2_enabled`)
- Three dedicated vendor-facing pages:
  - Portal Dashboard (`/vendor/dashboard`)
  - My Performance (`/vendor/performance`)
  - My Transactions (`/vendor/transactions`)
- Backend API: `/api/vendor-portal/`
- Vendor sees: their ASNs, RFQ invitations/bidding, ticket responses, profile

### 3.29 SAP Connector (Mock)

- Mocked ERP integration with retry/dead-letter-queue handling
- `integration_logs` table (request/response, status, attempt count)
- `integration_dlq` table (failed messages, retry count, resolution tracking)
- Company-SAP mapping (`company_sap_mapping`)
- ASN ERP posting triggers SAP integration flow
- Outbound/inbound direction tracking

### 3.30 Procurement OS Admin

- Admin page (`/procurement-os`) for system_admin and mdm_admin
- Manages: Decision Engine rules, Action Engine rules, Event Log, Integration status
- Overview of all Procurement OS expansion capabilities

### 3.31 Procurement Control Tower Dashboard

- Real-time operational dashboard at `/control-tower`
- "What Needs Attention" section: SLA breaches, critical exceptions, budget at risk, vendor risk alerts (color-coded cards)
- KPI cards: Total PRs, Active RFQs, Open POs, Inventory Value (live from APIs)
- AI Insights panel: Price variance alerts, Vendor performance warnings, Budget utilization projections
- Charts: Spend by category (bar), Monthly procurement trend (dual-axis line)
- All cards clickable for drill-down

### 3.32 RFQ Vendor Comparison

- Advanced comparison UI at `/rfq-comparison`
- Weighted scoring: Price (30%), Delivery (25%), Risk (20%), ESG (15%), Quality (10%)
- Progress bars for each score dimension
- Scenario simulation: quantity slider recalculates total cost live
- Recommendation engine panel: best vendor, reasons, risk warnings
- "Award Vendor" button with confirmation

### 3.33 Procurement Traceability Graph

- Visual document flow at `/traceability-graph`
- Node-based horizontal layout: PR → RFQ → PO → ASN → GRN → Invoice
- Each node: card with document ID, status tag, date, clickable
- Exception highlighting (red badge on GRN for quantity mismatch)
- Chronological timeline (Ant Design Timeline component)
- Line-level quantity flow table (PR qty → PO qty → GRN qty with mismatch detection)

### 3.34 Event-Driven Architecture

- In-process event bus (`backend/src/common/eventBus.js`)
- `event_log` table persists all emitted events (survives restart)
- Event types map to module actions (e.g., PR approved, PO created, ASN posted)
- Subscribers react to events (e.g., budget commit, stock receipt, batch creation)
- No external message broker (deliberate simplicity for single-process architecture)
- `GET /api/events/log` for event history

### 3.32 Document Center

- Unified document repository
- Documents linked to modules via module_name/record_id
- Upload, search, and retrieval
- Document extraction configuration (regex-based field extraction)

### 3.33 Payment Lifecycle (API only)

- Payment schedule (from matched invoices)
- Payment execution (bank_transfer / cheque / other)
- Payment status: processing → completed → failed → reconciled
- Vendor ledger (debit/credit running balance per vendor)
- Cashflow projection (bucketed by date)
- Backend tables and APIs exist; no dedicated frontend page yet

### 3.34 Smart Procurement Assistant

- AI-assisted procurement recommendations
- Backend API: `/api/assistant/`
- Feature-flag gated (`smart_assistant_enabled`)

---

## 4. Database Schema

**Total: 90+ tables** across all migrations. Grouped by module:

### Core / Auth
| Table | Purpose |
|-------|---------|
| `users` | All platform users (email, role, vendor_id, password_hash) |
| `system_settings` | Key-value configuration store |
| `feature_flags` | Feature toggle keys (stored in system_settings) |

### Multi-Company
| Table | Purpose |
|-------|---------|
| `organization_master` | Top-level org (org_code, org_name) |
| `company_master` | Companies within org (GSTIN, CIN, PAN, address) |
| `business_unit_master` | BUs within company |
| `company_sap_mapping` | SAP company code per company |
| `user_company_access` | User ↔ company access mapping |
| `vendor_company_mapping` | Vendor ↔ company mapping |
| `item_company_mapping` | Item ↔ company mapping |
| `sales_orders` | Intercompany mirror POs |

### Vendor
| Table | Purpose |
|-------|---------|
| `vendors` | Vendor master (status, lifecycle, compliance, segmentation) |
| `vendor_addresses` | Multi-address per vendor |
| `vendor_bank_accounts` | Bank details per vendor |
| `vendor_documents` | Uploaded documents (PAN, GST, etc.) |
| `vendor_risk_scores` | 7-dimension composite risk score |
| `vendor_esg` | ESG tracking per vendor |

### Sub Masters
| Table | Purpose |
|-------|---------|
| `sub_masters` | Reference data (category + name + code, company-scoped) |

### Item Master
| Table | Purpose |
|-------|---------|
| `item_master` | Items (code, description, UOM, category, standard_cost) |
| `item_vendor_mapping` | Item ↔ vendor with preferred flag |
| `item_company_mapping` | Item ↔ company scoping |

### Purchase Requisitions
| Table | Purpose |
|-------|---------|
| `purchase_requisitions` | PR header (department, cost center, sourcing strategy, budget status) |
| `pr_line_items` | PR lines (item, qty, estimated price, consumed qty) |
| `pr_approval_rules` | Value/dept/type → workflow routing |
| `pr_audit_log` | Action trail per PR |
| `budget_allocations` | Cost center budgets (allocated/committed/consumed/actual) |

### RFQ / Sourcing
| Table | Purpose |
|-------|---------|
| `rfqs` | RFQ header (title, deadline, status, current_round, pr_id) |
| `rfq_line_items` | RFQ lines (item, qty, UOM, target price, pr_line_item_id) |
| `rfq_vendors` | Invited vendors per RFQ |
| `vendor_bids` | Bid header per vendor per RFQ |
| `vendor_bid_items` | Bid line items (price, lead time, terms) |

### Purchase Orders
| Table | Purpose |
|-------|---------|
| `purchase_orders` | PO header (vendor, amount, status, version, pr_id, rfq_id, contract_id) |
| `po_line_items` | PO lines (description, qty, unit_price, HSN, tax, fulfilled_qty) |
| `po_versions` | Amendment history (change_log JSON, snapshot, approval) |

### Contracts
| Table | Purpose |
|-------|---------|
| `contracts` | Contract master (vendor, dates, value, consumed_value, default_unit_price) |

### ASN / GRN / Invoice
| Table | Purpose |
|-------|---------|
| `asns` | ASN header (PO, vendor, LR, transporter, ERP status) |
| `asn_line_items` | ASN lines mapped to PO lines |
| `goods_receipt_notes` | GRN header (ASN ref, received_date, status) |
| `grn_line_items` | GRN lines (shipped/received/accepted/rejected qty, tolerance) |
| `invoices` | Invoice (3-way match status, GST breakdown, currency) |
| `invoice_line_items` | Invoice lines (qty, price, deviation %) |

### Inventory / Batch / Returns / Transfers
| Table | Purpose |
|-------|---------|
| `warehouses` | Warehouse/location master (company-scoped) |
| `inventory_stock` | Stock per warehouse × item (qty_on_hand, reorder level) |
| `stock_movements` | Stock movement ledger (type, reference, batch_id) |
| `inventory_batches` | Batch records (GRN-generated, qty_received/available, rate, tax) |
| `purchase_returns` | Return header (vendor, GRN, reason, status, total) |
| `purchase_return_line_items` | Return lines (batch, qty, rate, discount, tax) |
| `branch_orders` | Inter-location transfer header (from/to location, status) |
| `branch_order_line_items` | Transfer lines (item, requested/approved/received qty) |
| `in_transit_stock` | Stock currently in transit between locations |

### Payments
| Table | Purpose |
|-------|---------|
| `payment_schedule` | Scheduled payments from invoices |
| `payments` | Payment execution records |
| `vendor_ledger` | Vendor debit/credit running balance |
| `cashflow_projection` | Bucketed expected outflows |

### Workflow Engine
| Table | Purpose |
|-------|---------|
| `workflow_master` | Workflow definitions |
| `workflow_steps` | Steps (order, role, SLA, condition_rule, is_parallel) |
| `workflow_instances` | Active workflow instances |
| `workflow_instance_step_approvals` | Per-step approval tracking |
| `workflow_logs` | Step action history |

### Audit
| Table | Purpose |
|-------|---------|
| `audit_checklists` | Checklist definitions |
| `audit_checklist_items` | Items within checklists |
| `audit_schedules` | Planned audits (frequency, vendor/group) |
| `audit_executions` | In-progress/completed audit runs |
| `audit_responses` | Per-item responses |
| `audit_findings` | Identified issues (severity, status, assignee) |

### Tickets
| Table | Purpose |
|-------|---------|
| `tickets` | Issue tickets (subject, priority, status) |
| `ticket_vendors` | Vendors linked to tickets |
| `ticket_messages` | Message thread per ticket |

### Pricing
| Table | Purpose |
|-------|---------|
| `price_history` | Historical prices per item × vendor |

### Governance & Intelligence
| Table | Purpose |
|-------|---------|
| `procurement_exceptions` | Exception records (type, severity, dedup, resolution) |
| `document_flow_mapping` | Quantity hand-off ledger (PR→RFQ→PO line tracing) |
| `documents` | Document center records |
| `extraction_configs` | Field extraction rules (aliases, regex) |
| `field_requirements` | Conditional mandatory field config |

### Decision & Action Engines
| Table | Purpose |
|-------|---------|
| `decision_rules` | Configurable decision rules per module |
| `decision_outputs` | Computed decision outputs per record |
| `action_rules` | Event-triggered next-best-action rules |

### Integration & Logging
| Table | Purpose |
|-------|---------|
| `event_log` | Persisted event bus entries |
| `integration_logs` | SAP/external integration request/response log |
| `integration_dlq` | Dead letter queue for failed integrations |
| `audit_logs` | Generic actor-action-before/after audit trail |

---

## 5. API Endpoints

All endpoints are prefixed with `/api/`. Auth required unless noted.

| Prefix | Module | Key Operations |
|--------|--------|---------------|
| `/api/auth` | Authentication | login, refresh, change-password |
| `/api/vendors` | Vendors | CRUD, approve, reject, compliance, 360 summary |
| `/api/vendor-company-mapping` | Vendor-Company | map/unmap vendors to companies |
| `/api/asns` | ASN | CRUD, submit, validate, post, three-way-match |
| `/api/grn` | GRN | create, list, get by ASN |
| `/api/sub-masters` | Sub Masters | CRUD by category |
| `/api/purchase-orders` | POs | CRUD, amend, version approve/reject |
| `/api/extraction-configs` | Extraction | CRUD for document field extraction rules |
| `/api/dashboard` | Dashboard | Statistics and summaries |
| `/api/upload` | Uploads | File upload handling |
| `/api/users` | Users | CRUD, activate/deactivate |
| `/api/system` | Settings | system settings, field-config, budget allocations |
| `/api/audit` | Audits | checklists, schedules, execute, findings |
| `/api/tickets` | Tickets | CRUD, messages, vendor close, admin close |
| `/api/risk` | Risk | vendor risk scores, recalculate |
| `/api/esg` | ESG | vendor ESG records |
| `/api/pricing` | Pricing | price history, benchmarks |
| `/api/rfq` | RFQ | CRUD, publish, bids, negotiate, compare, award |
| `/api/item-master` | Items | CRUD, import/export, vendor mapping |
| `/api/workflow` | Workflow | CRUD masters/steps, instances, approve, escalations |
| `/api/documents` | Documents | upload, list, download |
| `/api/pr` | PRs | CRUD, submit, approve, reject, close, create-rfq, create-po |
| `/api/contracts` | Contracts | CRUD, consumption tracking |
| `/api/insights` | Insights | vendor score, sourcing recommendation |
| `/api/exceptions` | Exceptions | list, summary, resolve |
| `/api/traceability` | Traceability | full chain lookup by any document ID |
| `/api/assistant` | Assistant | AI procurement suggestions |
| `/api/vendor-portal` | Vendor Portal V2 | dashboard, performance, transactions |
| `/api/reports` | Reports | data exports and aggregations |
| `/api/events` | Events | event log query |
| `/api/companies` | Companies | CRUD org/company/BU hierarchy |
| `/api/payments` | Payments | schedule, execute, ledger, cashflow |
| `/api/inventory` | Inventory | stock levels, movements |
| `/api/inventory/batches` | Batches | batch list, detail, stock view |
| `/api/inventory/purchase-returns` | Returns | CRUD, confirm |
| `/api/inventory/branch-orders` | Transfers | CRUD, approve, dispatch, receive |
| `/api/integration` | SAP | integration logs, DLQ, retry |
| `/api/decision-engine` | Decisions | CRUD rules, evaluate |
| `/api/action-engine` | Actions | CRUD action rules |
| `/api/health` | Health | `GET` returns `{ status: "ok" }` (no auth) |

---

## 6. Roles & Permissions

### Role Hierarchy

| Role | Access Level |
|------|-------------|
| `system_admin` | Platform-wide: system settings, user management, inventory, Procurement OS, reports |
| `mdm_admin` | Master data: vendors, item master, sub masters, reports. Override on all approval steps. |
| `procurement_admin` | Full procurement cycle: PR, RFQ, PO, ASN, GRN, inventory, batches, returns, transfers, audits, tickets, risk, ESG, pricing, contracts, workflow, exceptions, traceability, documents, reports, settings |
| `vendor` | Self-service: onboarding profile, ASN creation, RFQ bidding, tickets, vendor portal, reports |

### Detailed Access Matrix

| Page / Feature | system_admin | mdm_admin | procurement_admin | vendor |
|---------------|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✓ | ✓ |
| Vendors | — | ✓ | ✓ | — |
| Item Master | — | ✓ | ✓ | — |
| Sub Masters | — | ✓ (full) | ✓ (procurement) | — |
| Purchase Requisitions | — | ✓ | ✓ | — |
| RFQ & Negotiation | — | ✓ | ✓ | ✓ (bid) |
| Contracts | — | ✓ | ✓ | — |
| Purchase Orders | — | ✓ | ✓ | — |
| ASNs | — | ✓ | ✓ | ✓ (own) |
| GRN | — | ✓ | ✓ | — |
| Batch Inventory | — | ✓ | ✓ | — |
| Purchase Returns | — | ✓ | ✓ | — |
| Branch Orders | — | ✓ | ✓ | — |
| Inventory | ✓ | — | ✓ | — |
| Audit Management | — | ✓ | ✓ | — |
| Supplier Issues | — | ✓ | ✓ | ✓ |
| Supplier Risk | — | ✓ | ✓ | — |
| ESG Tracking | — | ✓ | ✓ | — |
| Price Insights | — | ✓ | ✓ | — |
| Control Tower | — | ✓ | ✓ | — |
| Traceability | — | ✓ | ✓ | — |
| Workflow Engine | — | ✓ | ✓ | — |
| Document Center | — | ✓ | ✓ | — |
| System Settings | ✓ | ✓ | ✓ | — |
| User Management | ✓ | ✓ | — | — |
| Procurement OS | ✓ | ✓ | — | — |
| Vendor Portal V2 | — | — | — | ✓ |
| Vendor Onboarding | — | — | — | ✓ |
| Item Import | ✓ | ✓ | — | — |

---

## 7. Key Features

### Multi-Company Data Isolation
- All transactional data (PR, PO, ASN) carries organization_id/company_id
- Items, sub-masters, warehouses are company-scoped
- Users can only access data for their assigned companies
- Vendors can be mapped to multiple companies

### Batch-Controlled Inventory
- Batches auto-generated from GRN (no manual batch creation needed)
- Each batch tracks: rate, discount %, tax %, received qty, available qty
- Purchase returns deduct from specific batches
- Branch orders transfer batch-level stock between locations
- Full batch lifecycle: active → exhausted

### HSN-Tax Mapping
- HSN/SAC codes stored at PO line item level
- Tax percentage derivable from HSN code (via sub_masters hsn_code category)
- GSTIN format validation (15-char pattern)
- GST breakdown on invoices (CGST + SGST or IGST)

### Budget Commitment Model (4-Stage Funnel)
```
Allocated → Committed (PR approved) → Consumed (PO created) → Actual (ASN posted)
```
- Each stage reclassifies (not accumulates) — no double-counting
- Hard/soft enforcement modes
- Automatic release on PR close or rejection
- Admin-managed allocations per cost center × fiscal year

### Event-Driven Architecture
- Synchronous in-process event bus (no broker overhead)
- All events persisted to `event_log` (queryable history)
- Subscribers trigger side effects (budget commit, stock receipt, batch creation, exception raising)
- Foundation for Decision Engine and Action Engine rules

### PDF Generation
- Purchase orders, ASNs generated as PDFs
- Includes company details (name, GSTIN, address from company_master)
- PDFKit-based server-side generation

### Excel Import/Export
- Item master bulk import via Excel (.xlsx)
- SheetJS library for parsing and generation
- Template-based import with validation

### Full Document Traceability
```
PR → RFQ → PO → ASN → GRN → Batch → Inventory → Return/Transfer
```
- `transaction_chain_id` links entire procurement chain
- `document_flow_mapping` tracks line-level quantity allocation
- Any document ID resolves to its full chain (upstream + downstream)
- Visual flow diagram on Traceability page

### Configurable Approval Workflows
- Conditional routing (value thresholds, categories, risk levels)
- Parallel approval waves (AND-join)
- SLA tracking with automatic escalation
- Role-based step assignment
- Line-level approval for high-value items

### Feature Flags
- Toggle features on/off without code deployment
- Stored in `system_settings` (key-value)
- Current flags: `smart_assistant_enabled`, `vendor_portal_v2_enabled`, `ui_improvements_enabled`
- Frontend reads via FeatureFlagsContext

### Security (VAPT Hardened)
- JWT auth with secure secret enforcement
- bcrypt password hashing (10 rounds)
- Rate limiting on auth endpoints
- CORS restricted to allowed origins
- Security headers (X-Powered-By disabled)
- Input sanitization middleware
- Role-based route guards (frontend + backend)
- Self-approval prevention on PO amendments

---

## 8. Login Credentials

Default demo accounts seeded by `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| MDM Admin | `admin@vendorportal.com` | `Admin@123` |
| Procurement Admin | `procurement@vendorportal.com` | `Proc@123` |
| Vendor (Tata Steel) | `vendor1@tatasteel.com` | `Vendor@123` |
| Vendor (Reliance) | `vendor2@reliance.com` | `Vendor@123` |
| Vendor (Infosys) | `vendor3@infosys.com` | `Vendor@123` |
| Vendor (Mahindra) | `vendor4@mahindra.com` | `Vendor@123` |
| Vendor (Hindustan) | `vendor5@hinpack.com` | `Vendor@123` |
| Vendor (Bharat Elec) | `vendor6@bel.com` | `Vendor@123` |
| Vendor (Godrej) | `vendor7@godrej.com` | `Vendor@123` |
| Vendor (L&T) | `vendor8@lnt.com` | `Vendor@123` |

> **Note:** The `system_admin` role is created via the Procurement OS seed script. Check `seed-procurement-os.js` for that account, or create one manually after migration.

---

## 9. Frontend Pages (Routes)

| Route | Page Component | Roles |
|-------|---------------|-------|
| `/` | Dashboard | All |
| `/vendors` | Vendors | mdm_admin, procurement_admin |
| `/item-master` | ItemMaster | mdm_admin, procurement_admin |
| `/sub-masters` | SubMasters | mdm_admin |
| `/procurement-sub-masters` | ProcurementSubMasters | mdm_admin, procurement_admin |
| `/purchase-requisitions` | PR | mdm_admin, procurement_admin |
| `/rfq` | RFQ | mdm_admin, procurement_admin, vendor |
| `/contracts` | Contracts | mdm_admin, procurement_admin |
| `/purchase-orders` | PurchaseOrders | mdm_admin, procurement_admin |
| `/asns` | ASNs | mdm_admin, procurement_admin, vendor |
| `/grn` | GRN | mdm_admin, procurement_admin |
| `/batch-inventory` | BatchInventory | mdm_admin, procurement_admin |
| `/purchase-returns` | PurchaseReturns | mdm_admin, procurement_admin |
| `/branch-orders` | BranchOrders | mdm_admin, procurement_admin |
| `/inventory` | Inventory | system_admin, procurement_admin |
| `/item-import` | ItemImport | mdm_admin, system_admin |
| `/audit` | AuditManagement | mdm_admin, procurement_admin |
| `/tickets` | Tickets | mdm_admin, procurement_admin, vendor |
| `/risk` | RiskDashboard | mdm_admin, procurement_admin |
| `/esg` | ESGTracking | mdm_admin, procurement_admin |
| `/pricing` | PriceBenchmarking | mdm_admin, procurement_admin |
| `/exceptions` | ExceptionsDashboard | mdm_admin, procurement_admin |
| `/traceability` | TraceabilityView | mdm_admin, procurement_admin |
| `/traceability-graph` | TraceabilityGraph | mdm_admin, procurement_admin |
| `/control-tower` | ControlTowerDashboard | mdm_admin, procurement_admin, system_admin |
| `/rfq-comparison` | RFQComparison | mdm_admin, procurement_admin |
| `/workflow-engine` | WorkflowEngine | mdm_admin, procurement_admin |
| `/documents` | DocumentCenter | mdm_admin, procurement_admin |
| `/extraction-config` | ExtractionConfig | mdm_admin, procurement_admin |
| `/system-settings` | SystemSettings | system_admin, mdm_admin, procurement_admin |
| `/user-management` | UserManagement | mdm_admin, system_admin |
| `/procurement-os` | ProcurementOSAdmin | system_admin, mdm_admin |
| `/reports` | Reports | All |
| `/vendor-onboarding` | VendorOnboarding | vendor |
| `/vendor-asns` | ASNs | vendor |
| `/vendor/dashboard` | VendorPortalDashboard | vendor |
| `/vendor/performance` | VendorPortalPerformance | vendor |
| `/vendor/transactions` | VendorPortalTransactions | vendor |
| `/change-password` | ChangePassword | All |
| `/login` | Login | Public |

---

## 10. How to Run

```bash
# Prerequisites: Node.js 18+, MySQL 8.x running

# 1. Backend setup
cd backend
npm install
npm run migrate    # Creates DB + all tables (30+ migration scripts)
npm run seed       # Seeds demo data + user accounts

# 2. Start backend
npm run dev        # Port 5000 (nodemon auto-restart)

# 3. Frontend setup
cd frontend
npm install
npm start          # Port 3000

# 4. Open http://localhost:3000 and login
```

---

*End of document.*
