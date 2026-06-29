# ProcureTrack — Technical Design Document

**Version:** 1.0  
**Date:** June 2026  
**Audience:** Engineers, architects, technical reviewers

---

## 1. System Overview

ProcureTrack is a multi-tier web application for Procure-to-Pay (P2P) operations. It consists of three independently runnable services:

| Service | Technology | Default Port |
|---------|-----------|--------------|
| Frontend SPA | React 18 | 3000 |
| Backend REST API | Node.js + Express | 5000 |
| Document Intelligence | Python + FastAPI | 8000 |

Data is persisted in MySQL 8.4. File uploads are stored on the local filesystem (path-configurable via `UPLOAD_DIR`).

---

## 2. Technology Stack

### Frontend
- **React 18.3.1** — functional components with hooks throughout; no class components
- **React Router v6** — client-side routing, `<Outlet>`-based nested layouts
- **Ant Design 5.17** — component library and design system
- **Recharts 2.12** — dashboard charts (Pie, Bar)
- **Axios 1.7** — HTTP client with a shared instance and JWT interceptor
- **dayjs 1.11** — date parsing and formatting
- **Language:** JavaScript/JSX (no TypeScript)

### Backend
- **Node.js + Express 4.19** — REST API server
- **MySQL 8.4.7** — relational database via `mysql2` promise API
- **JWT (jsonwebtoken)** — stateless session tokens, HS256, 24-hour TTL
- **bcrypt 5.1** — password hashing, 12 rounds for admin/procurement users, 10 rounds for vendor auto-generated passwords
- **Multer 1.4** — multipart form / file upload handling
- **Nodemailer 6.9** — email notifications (SMTP-configurable, not active in current deployment)
- **UUID v4** — all primary keys
- **Language:** JavaScript (CommonJS modules)

### Document Intelligence Microservice
- **Python 3.x + FastAPI 0.111** — async REST API
- **pdfplumber 0.11** — PDF text extraction
- **rapidfuzz 3.9** — fuzzy string matching for field extraction
- **Uvicorn** — ASGI server

### Infrastructure
- Local filesystem for uploads (S3-compatible path abstraction for future migration)
- No container orchestration defined; all services run as bare Node/Python processes

---

## 3. Architecture Diagram

```
Browser
  │
  │  HTTP/REST (JSON)
  ▼
React SPA (port 3000)
  │
  │  Axios — JWT bearer token on every request
  ▼
Express API (port 5000)
  │            │
  │            │  HTTP POST /extract
  │            ▼
  │     FastAPI Doc Intelligence (port 8000)
  │            │
  │            └── pdfplumber → rapidfuzz → JSON results
  │
  │  mysql2 (connection pool)
  ▼
MySQL 8.4 (port 3306)
  │
  └── /uploads/   (local filesystem, served via /uploads static route)
```

---

## 4. Database Design

### Conventions
- **Primary keys:** UUID v4, stored as `VARCHAR(36)` or `CHAR(36)`
- **Soft deletes:** `is_active TINYINT(1)` flag (no physical deletes for reference data)
- **Timestamps:** `created_at`, `updated_at` on all tables, auto-managed
- **Enums:** MySQL `ENUM` type used for status/type columns to enforce valid states at DB level
- **JSON columns:** Used for flexible fields (extraction results, validation payloads)
- **Unique constraints:** Business keys — `email`, `invoice_number`, `po_number`, auto-number sequences

### Table Inventory

#### Core (Basic Mode)

| Table | Purpose |
|-------|---------|
| `users` | Authentication, role, `must_reset_password` flag |
| `vendors` | Vendor master, status state machine |
| `vendor_addresses` | 1:N addresses per vendor (Billing/Shipping/Registered) |
| `vendor_bank_accounts` | 1:N bank accounts per vendor |
| `vendor_documents` | Uploaded compliance documents with file paths |
| `purchase_orders` | PO master, status |
| `po_line_items` | Line items with qty and unit price |
| `asns` | Advanced Shipping Notices, invoice and logistics fields |
| `asn_line_items` | Per-line quantities linked to PO line items |
| `extraction_configs` | PDF extraction rules (aliases, regex, priority) |
| `sub_masters` | Reference data: companies, departments, categories, geo |

#### Advanced Mode

| Table | Purpose |
|-------|---------|
| `system_settings` | Feature flags — Basic vs. Advanced module activation |
| `audit_checklists` | Reusable audit templates |
| `audit_checklist_items` | Sequenced questions per checklist |
| `audit_schedules` | Audit planning with frequency and date range |
| `audit_executions` | Individual audit instances (planned, in-progress, closed) |
| `audit_responses` | Per-item Yes/No/NA responses with remarks |
| `audit_findings` | Findings with severity levels and corrective action tracking |
| `tickets` | Support tickets with lifecycle status |
| `ticket_vendors` | M:N assignment of vendors to tickets |
| `ticket_messages` | Threaded messages, sender role tagged |
| `vendor_risk_scores` | Calculated risk metrics and sub-scores |
| `vendor_esg` | ESG diversity and compliance flags |
| `price_history` | Historical pricing per item per vendor |

### Key State Machines

**Vendor Status:** `draft` → `submitted` → `under_review` → `approved` | `rejected` → `inactive`  
**ASN Status:** `submitted` → `validated` → `posted` | `rejected`  
**Ticket Status:** `initiated` → `in_progress` → `vendor_closed` → `closed`  
**Audit Execution Status:** `planned` → `in_progress` → `completed` → `closed`  
**Corrective Action Status:** `open` → `closed`

---

## 5. Backend API Design

### Structure

```
backend/
  src/
    config/
      db.js              # mysql2 pool, connection helper
      migrate.js         # Basic schema creation
      migrate-advanced.js
      seed.js
      seed-advanced.js
    middleware/
      auth.js            # JWT verify, role enforcement, vendor isolation
      rateLimiter.js     # express-rate-limit (10 req/min on /auth/login)
      security.js        # Helmet-equivalent headers, input sanitisation
    routes/
      auth.js
      vendors.js
      asns.js
      purchase-orders.js
      audit.js
      tickets.js
      risk.js
      esg.js
      pricing.js
      extraction-configs.js
      sub-masters.js
      users.js
      system.js
      dashboard.js
      upload.js
    app.js               # Express bootstrap, middleware order, route registration
    logger.js            # Structured JSON logger (4 log streams)
```

### Authentication & Authorization

- All protected routes go through `authMiddleware` which:
  1. Extracts the `Authorization: Bearer <token>` header
  2. Verifies the JWT with `JWT_SECRET`
  3. Attaches decoded `{ id, role, vendor_id }` to `req.user`
- Role guards are applied per-route: `requireRoles(['mdm_admin', 'procurement_admin'])`
- Vendor isolation: when `req.user.role === 'vendor'`, all DB queries are automatically filtered by `vendor_id = req.user.vendor_id`

### API Conventions

- All endpoints return `{ success: true, data: ... }` on success
- Errors return `{ success: false, message: '...' }` with appropriate HTTP status codes
- Paginated endpoints use `page` and `limit` query params
- File uploads return a relative URL path stored in DB; served via `/uploads/*` static route
- Auto-numbered fields (ASN numbers `ASN-XXXXXXX`, ticket numbers `TKT-00001`) use `MAX() + 1` queries with zero-padding

### Key API Modules

#### Auth (`/api/auth`)
- `POST /login` — rate-limited, returns JWT + user profile
- `POST /change-password` — validates new password (min 8 chars, upper+lower+digit), clears `must_reset_password` flag
- `POST /forgot-password`, `POST /reset-password` — token-based reset flow

#### Vendors (`/api/vendors`)
- Full CRUD with step-based onboarding endpoints
- Status transitions enforced server-side; invalid transitions return 400
- `GET /vendors/:id/full` returns vendor with all nested addresses, banks, documents, contacts in one response

#### ASNs (`/api/asns`)
- Available quantity check: `SELECT SUM(quantity) FROM asn_line_items WHERE po_line_item_id = ? AND asn_id IN (SELECT id FROM asns WHERE status != 'rejected')`
- Invoice number uniqueness enforced at DB level (UNIQUE constraint) and validated before insert

#### Audit (`/api/audit`)
- Schedule creation pre-computes all execution dates based on frequency and date range and bulk-inserts them as `planned` records
- Execution closure validates all findings are closed before allowing status change

#### Risk (`/api/risk`)
- `POST /api/risk/calculate` recalculates scores for all vendors
- Formula:
  ```
  delay_score    = MIN(late_asn_count * 10, 100)
  rejection_score = MIN(rejected_asn_count * 10, 100)
  audit_score    = MIN(open_finding_count * 15, 100)
  final_score    = (delay_score * 0.35) + (rejection_score * 0.40) + (audit_score * 0.25)
  ```
- Risk band: 0–30 = Low, 31–60 = Medium, 61–100 = High

---

## 6. Document Intelligence Service

### Extraction Pipeline

```
POST /extract
  ├── Receive: PDF bytes + extraction_configs[]
  ├── pdfplumber.open(pdf) → raw_text
  └── For each config field:
        1. Exact match: alias in raw_text → confidence 0.95
        2. Fuzzy match: partial_ratio(alias, raw_text) >= 80 → confidence 0.80
        3. Regex match: re.search(pattern, raw_text) → confidence 0.70
        4. Not found → confidence 0.0, flagged for review
  └── Return: { field_name, extracted_value, confidence, match_type }[]
```

### Extraction Config Schema

Each config record defines:
- `field_name` — logical name (e.g., `invoice_number`)
- `aliases[]` — list of label variants to search for (e.g., `["Invoice No", "Inv #", "Bill Number"]`)
- `regex_pattern` — fallback pattern if alias matching fails
- `priority` — ordering when multiple configs apply to the same document type

---

## 7. Frontend Architecture

### Routing & Layout

```
<App>
  <Router>
    /login               → <LoginPage>
    /change-password     → <ChangePasswordPage>
    /                    → <AuthLayout>  (sidebar + header shell)
      /dashboard         → <Dashboard>
      /vendors           → <Vendors>
      /vendors/:id       → <VendorDetail>
      /vendor-onboarding → <VendorOnboarding>
      /asns              → <ASNs>
      /asns/create       → <ASNCreate>
      /asns/:id          → <ASNDetail>
      /purchase-orders   → <PurchaseOrders>
      /audit             → <AuditManagement>
      /tickets           → <Tickets>
      /risk              → <RiskDashboard>
      /esg               → <ESGTracking>
      /pricing           → <PriceBenchmarking>
      /sub-masters       → <SubMasters>
      /users             → <UserManagement>
      /system            → <SystemSettings>
      /extraction-config → <ExtractionConfig>
```

### Auth Flow
1. On login, backend returns `{ token, user: { id, name, role, vendor_id } }`
2. Token and user stored in `localStorage`
3. Axios instance applies `Authorization: Bearer <token>` header via request interceptor
4. Response interceptor catches 401 and redirects to `/login`
5. First-login flag (`must_reset_password`) redirects vendor to `/change-password` before any other page

### State Management
- No global state library (Redux/Zustand); all state is local component state via `useState`/`useEffect`
- Data fetched on component mount; manual refresh triggered by user actions
- Forms use Ant Design `Form` with controlled fields

### Role-Based UI
- Sidebar menu items filtered by `user.role` at render time
- Pages not accessible to a role are not linked (no server enforcement at the page level — backend APIs are the enforcement layer)
- Vendors see a reduced sidebar: Onboarding, ASNs (their own), Tickets

---

## 8. Security Design

### Transport & Headers
- CORS configured with explicit `CORS_ORIGINS` allowlist; credentials enabled
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` header set
- `X-Powered-By` suppressed

### Input Validation
- HTML and script tags stripped from all string inputs before DB insertion
- Email format validated server-side (regex + max length)
- Password policy enforced: minimum 8 characters, at least one uppercase, one lowercase, one digit
- File uploads restricted by MIME type and size (Multer configuration)

### Rate Limiting
- Login endpoint: 10 requests per minute per IP (express-rate-limit)
- Rate limit violations logged to `security.log`

### Logging Architecture
Four structured JSON log streams written to disk:

| Log File | Contents |
|----------|---------|
| `app.log` | Every HTTP request: method, URL, status, duration, IP, user ID, role |
| `audit.log` | Business events: login, logout, password reset, vendor status changes |
| `security.log` | Failed logins, rate limit hits, suspicious patterns |
| `error.log` | Unhandled exceptions with full stack traces |

---

## 9. Deployment & Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_HOST` | 127.0.0.1 | MySQL host |
| `DB_PORT` | 3306 | MySQL port |
| `DB_USER` | — | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | — | Database name |
| `PORT` | 5000 | Express listen port |
| `UPLOAD_DIR` | ./uploads | Local file storage root |
| `CORS_ORIGINS` | localhost:3000 | Comma-separated allowed origins |
| `JWT_SECRET` | — | HMAC signing secret |
| `JWT_EXPIRES_IN` | 24h | Token TTL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | — | Email delivery (inactive) |

### Setup Sequence

```bash
# 1. Database
mysql -u root -p -e "CREATE DATABASE procuretrack;"

# 2. Backend
cd backend && npm install
node src/config/migrate.js           # Create core tables
node src/config/migrate-advanced.js  # Create advanced tables
node src/config/seed.js              # Seed reference data + default admin users
node src/config/seed-advanced.js     # Seed advanced module demo data
node src/app.js                      # Start API server

# 3. Frontend
cd frontend && npm install && npm start

# 4. Document Intelligence (optional)
cd document-intelligence
pip install -r requirements.txt
uvicorn main:app --port 8000
```

---

## 10. Known Gaps & Future Work

| Area | Current State | Recommended Next Step |
|------|-------------|----------------------|
| Document Intelligence wiring | Python service runs independently; not invoked during ASN creation | Wire ASN invoice upload to call `/extract` and store results in DB |
| ERP Integration | Mock endpoint — always returns success | Replace with real ERP adapter (SAP BAPI, Oracle REST, or webhook) |
| Excel Import | UI button exists for ASN line-item import; parsing not implemented | Add SheetJS parser; map columns to `asn_line_items` schema |
| Price History Population | Seeded manually | Auto-insert price records on PO creation from line-item data |
| Email Notifications | Nodemailer configured; SMTP credentials absent | Set SMTP credentials; wire send calls on key events (vendor approved, ASN rejected, ticket assigned) |
| File Storage | Local filesystem | Migrate `UPLOAD_DIR` to S3-compatible storage with signed URLs |
| Containerisation | None | Add `Dockerfile` per service + `docker-compose.yml` for local dev |
| TypeScript | Frontend and backend both in plain JS | Gradual migration starting with shared types (vendor, ASN, user) |
| Automated Tests | None present | Add Vitest unit tests for risk score formula; Supertest integration tests for auth and ASN flows |

> **Note on the above table (2026-06-27):** several rows are now stale relative to the live codebase — Automated Tests, Price History Population, and ERP Integration have all moved substantially since this table was last updated (61 Jest tests exist; `price_history` is populated automatically on RFQ award; ERP posting is now gated on a real GRN/Invoice 3-way match, not just a mock always-success call). This document was not kept in sync with `backend/src/modules/` the way `ProcureTrack_Product_Reference.md` was — treat the Product Reference as the source of truth for current state, and this file as historical-plus-the-new-design-sections below.

---

## 11. Payment Visibility

### Purpose
`payments`, `payment_schedule`, and `vendor_ledger` (built under the Procurement OS expansion — see `ProcureTrack_Product_Reference.md` §3 "Procurement OS Layer") already exist and are correct, but there is no dedicated screen for a **vendor** to answer "is my invoice paid, and if not, when/why," and no **finance-focused** view of payables exposure beyond the raw admin tables on the Procurement OS admin page. This closes that gap without changing any of the existing payment logic.

### Real-World Use Cases
- A vendor emails asking "where's my payment for INV-2031" instead of checking a portal, because there's nothing to check.
- Finance needs a same-day answer to "what's our total outstanding payable, and how much of it is 90+ days overdue" without writing a SQL query.
- An invoice is correctly matched and scheduled, but Finance wants to **hold** it (e.g., a dispute is in progress — see §12) without it being silently picked up by the next Payment Run.
- Finance wants to see expected cash outflow over the next several weeks before committing to a large new PO.

### Status Lifecycle
Extends the existing `payment_schedule.status` enum (`pending → partial/overdue → paid`) with one new value:
```
pending ──┬──────────────► partial ──────────────► paid
          ├──(overdue sweep, due_date passed)──► overdue
          └──(admin places a hold)─────────────► on_hold ──(release)──► pending
```
`on_hold` is the only new state — added specifically so a Payment Run (`POST /payments/run`) can `WHERE status NOT IN ('on_hold')`, which is a one-line change to the existing query, not new logic. `payments.status` (`processing → completed → reconciled`, plus `failed`) is unchanged.

### Data Model
```sql
ALTER TABLE payment_schedule
  MODIFY status ENUM('pending','partial','paid','overdue','on_hold') NOT NULL DEFAULT 'pending',
  ADD COLUMN hold_reason TEXT NULL,
  ADD COLUMN held_by VARCHAR(36) NULL,
  ADD COLUMN held_at TIMESTAMP NULL;
```
No new tables — `payments`, `payment_schedule`, `vendor_ledger`, `cashflow_projection` are reused exactly as built.

### API Design
| Endpoint | Role | Purpose |
|---|---|---|
| `GET /api/vendor-portal/payments` | vendor (self-scoped, same pattern as every other `vendor-portal` route) | Own `payment_schedule` joined to `invoices`/`payments` — invoice #, amount, due date, status, paid date |
| `PUT /api/payments/schedule/:id/hold` | `procurement_admin`, `system_admin` | Sets `status='on_hold'`, `hold_reason`, `held_by` |
| `PUT /api/payments/schedule/:id/release-hold` | `procurement_admin`, `system_admin` | Reverts to `pending` (re-evaluated by the next overdue sweep like any other row) |
| `GET /api/payments/cashflow-projection?weeks=12` | existing route, add a `weeks` param | Buckets `cashflow_projection` by week instead of by raw due date, for a chart-friendly response |

Existing and unchanged: `GET /payments/schedule`, `GET /payments`, `GET /payments/aging`, `POST /payments/run`, `PUT /payments/:id/reconcile`.

### UI/UX Design
- **Vendor Portal — "My Payments"** (`/vendor/payments`, new): same list-page pattern as `VendorPortalTransactions.jsx` — one table, no type switcher needed (there's only one resource). Status `Tag` colors: Pending=default, Partial=orange, Paid=green, Overdue=red, On Hold=purple (with the `hold_reason` shown as a tooltip, not a generic "contact support" message). Added to `vendorItems` in `Sidebar.jsx`, alongside My ASNs/RFQ & Bidding.
- **Procurement OS admin page — Payments tab** (extend existing): a **Hold**/**Release Hold** button per schedule row; a Recharts bar chart above the existing aging tiles, reading the new `weeks`-bucketed cashflow endpoint.

### Integration With Existing Modules
- **Invoice matching**: unchanged — `payment_schedule` is still only ever created off the `INVOICE_APPROVED` event (matched invoices only); a `blocked` invoice never reaches payment scheduling at all, which is already correct behavior, not a gap to close.
- **GRN**: no direct link — GRN's role ends at the 3-way match: this feature reads invoice/payment data downstream of it.
- **Exceptions**: add one new exception type, `payment_overdue`, raised by a new scheduled sweep (`POST /api/payments/escalations/check`, same shape as Workflow Engine's existing `POST /workflow/escalations/check`) for any `payment_schedule` row whose `due_date` has passed — surfaced on the Control Tower like every other exception type, no new UI needed there.

### Role-Wise Behavior
| Role | Can see | Can act |
|---|---|---|
| Vendor | Own payments only | Nothing (read-only) |
| `mdm_admin` | All payments (existing `INTERNAL_ROLES` read access) | Nothing — Run/Reconcile/Hold are `procurement_admin`/`system_admin` only today, unchanged |
| `procurement_admin`, `system_admin` | All | Run, Reconcile, Hold, Release Hold |

### Edge Cases & Validations
- Releasing a hold on a schedule that's already past `due_date` should land it in `overdue`, not `pending` — the release endpoint re-runs the same due-date check the sweep uses, rather than blindly setting `pending`.
- A schedule can't be put `on_hold` once `status='paid'` — return a 400, don't silently no-op.
- Partial payments already accumulate correctly (`payments.service.js`'s `runPayments()`); a held schedule that already has a partial payment keeps its `paid_amount` — holding only blocks *further* runs, it doesn't reverse what's already been paid.

### Decision Intelligence Impact
- `cashflow_projection` becomes genuinely actionable (visible, not just computed) — a Decision Engine rule (Procurement OS §3) could fire a `budget_alert` when projected outflow for an upcoming week exceeds a configurable threshold, reusing the existing `decision_rules` mechanism with no new engine code.
- A vendor with a pattern of `payment_overdue` exceptions is a *symptom of our own process*, not the vendor's — deliberately **not** factored into vendor risk scoring (unlike Dispute Management's vendor-caused disputes below).

---

## 12. Dispute Management

### Purpose
A GRN tolerance breach or invoice mismatch today only produces a `procurement_exceptions` row — a one-line message an admin resolves with a remarks field. There's no place for the **vendor** to see the dispute, respond to it, attach evidence, or for the resolution to record a concrete **outcome** (credit note vs. re-invoice vs. payment adjustment vs. rejected). This turns that single exception row into a full, two-sided workflow.

### Real-World Use Cases
- A GRN comes back with 8 units damaged out of 50 — procurement wants to formally dispute this with the vendor (not just log it internally) and track the vendor's response (replacement, credit note, etc.) to closure.
- A vendor receives an `invoice_mismatch` exception and wants to contest it ("we billed correctly, your PO price was outdated") rather than just having an admin silently resolve it from their side.
- Finance needs a resolution outcome (`credit_note` / `payment_adjustment`) that actually *changes* what's owed — not just a closed ticket.

### Dispute Types
`price_mismatch`, `quantity_shortage`, `quantity_excess`, `damage`, `delay`, `payment_issue`, `other` — the first four map directly onto the Enhanced GRN's new exception types (§14); `payment_issue` maps onto Payment Visibility (§11).

### Status Lifecycle
```
Open ──► In Review ──► Resolved ──► Closed
  ▲                        │
  └────── Reopened ◄───────┘   (vendor disagrees with the resolution — optional, see Edge Cases)
```

### Data Model
```sql
CREATE TABLE disputes (
  id VARCHAR(36) PRIMARY KEY,
  dispute_number VARCHAR(50) NOT NULL UNIQUE,
  dispute_type ENUM('price_mismatch','quantity_shortage','quantity_excess','damage','delay','payment_issue','other') NOT NULL,
  status ENUM('open','in_review','resolved','closed') NOT NULL DEFAULT 'open',
  source_module ENUM('grn','invoice','payment','po') NOT NULL,
  source_record_id VARCHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  raised_by VARCHAR(36) NOT NULL,
  raised_by_role ENUM('vendor','procurement_admin','mdm_admin','system_admin') NOT NULL,
  exception_id VARCHAR(36) NULL,           -- set when auto-created from an exception (see Integration)
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  resolution_outcome ENUM('credit_note','re_invoice','payment_adjustment','rejected','no_action') NULL,
  resolution_notes TEXT NULL,
  resolved_by VARCHAR(36) NULL,
  resolved_at TIMESTAMP NULL,
  sla_due_at TIMESTAMP NULL,
  transaction_chain_id VARCHAR(36) NULL,   -- inherited from the source record, same convention as every other module
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dispute_vendor (vendor_id), INDEX idx_dispute_status (status), INDEX idx_dispute_source (source_module, source_record_id)
);

CREATE TABLE dispute_attachments (
  id VARCHAR(36) PRIMARY KEY, dispute_id VARCHAR(36) NOT NULL,
  file_path VARCHAR(500) NOT NULL, file_name VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(36) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Same shape as the existing pr_audit_log — an append-only narrative, not a new convention.
CREATE TABLE dispute_history (
  id VARCHAR(36) PRIMARY KEY, dispute_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(36) NOT NULL, action VARCHAR(60) NOT NULL, remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Design
| Endpoint | Role | Notes |
|---|---|---|
| `POST /api/disputes` | vendor or admin | `raised_by`/`raised_by_role` set from `req.user`, not the request body |
| `GET /api/disputes` | all (vendor auto-filtered to `vendor_id = req.user.vendorId`, same isolation pattern as every other vendor-facing list) | Filterable by status/type/source_module |
| `GET /api/disputes/:id` | all (same isolation) | Includes attachments + history |
| `PUT /api/disputes/:id/status` | admin only for `resolved`/`closed`; vendor may set `in_review`→ nothing (vendors respond via Communication Threads, §13, not by transitioning status themselves) | Body: `{status, resolution_outcome, resolution_notes}` for the resolve transition |
| `POST /api/disputes/:id/attachments` | all (own dispute only) | Reuses the existing `/api/upload` file-handling convention |

### UI/UX Design
- **Admin**: new page `/disputes` — same list+detail shape as `ExceptionsDashboard.jsx` (summary tiles by status, filter card, table with a **View** action). A **Raise Dispute** button is added to the GRN card and Invoice card on the ASN detail page (`ASNs.jsx`), and to the PO detail page — each pre-fills `source_module`/`source_record_id`/`vendor_id` from the record already on screen.
- **Vendor Portal**: new page `/vendor/disputes` — own disputes list + a **Raise Dispute** button (vendor-initiated disputes, e.g. contesting an `invoice_mismatch`) + a **Communication** tab per dispute (§13) for back-and-forth without needing a status transition just to add a comment.
- Detail view shows the full `dispute_history` as a `Timeline` (the exact same component `TraceabilityView.jsx` already uses for its chronological view).

### Integration With Existing Modules
- **Exceptions**: a new event, `EXCEPTION_RAISED`, emitted from `exceptions.service.js`'s existing `raiseException()` (one extra `emitEvent()` call, same pattern as every Procurement OS event hook). A new subscriber auto-creates a `disputes` row (`status='open'`, `raised_by_role='system'`... no — `raised_by` needs a real user; use the same actor the exception itself recorded, or the system account) for exception types on a configurable auto-dispute allowlist (`grn_tolerance_breach`, `invoice_mismatch` initially). When a dispute reaches `resolved`/`closed`, it calls the existing `autoResolve(dedupKey, ...)` on the *linked* exception — closing the loop so the Control Tower doesn't show a stale open exception once its dispute is resolved.
- **SLA/escalation**: reuses the Workflow Engine's existing shape exactly — `sla_due_at` computed at creation from a new `dispute_sla_hours` setting (via the existing `getSetting()` helper), with a sweep that raises an `sla_breach` exception (same type already used by Workflow Engine — not a new exception type) when overdue.
- **Vendor risk scoring**: see Decision Intelligence Impact below.
- **Resolution outcomes that touch money**: `credit_note`/`payment_adjustment` should adjust `vendor_ledger` (Payment Visibility, §11) via the existing `recordLedgerEntry()` helper — a credit note is a credit entry against the vendor's payable balance, using the *same* function `payments.service.js` already calls for invoices/payments, not a new ledger-writing path.

### Role-Wise Behavior
| Action | Vendor | `procurement_admin` | `mdm_admin` | `system_admin` |
|---|---|---|---|---|
| Raise | ✅ (own) | ✅ | ✅ | ✅ |
| View | own only | all | all | all |
| Resolve/Close | ❌ | ✅ | ✅ (per the standing top-level-override convention) | ✅ |
| `payment_issue` resolution touching `vendor_ledger` | ❌ | ✅ | ❌ — finance-flavored outcomes stay `procurement_admin`/`system_admin`-only, same boundary already drawn for Payment Run/Reconcile | ✅ |

### Edge Cases & Validations
- A dispute can't be `closed` without `resolution_outcome` set — enforced server-side on the status-transition endpoint, same "no skipping required state" principle as PR's Line-Level Approval gate.
- Two disputes against the same `source_record_id` + `dispute_type` should be blocked (or merged) rather than allowed to spawn duplicates — check before insert, return the existing dispute's id instead of creating a near-duplicate.
- "Reopened" is deliberately **optional** in v1 (the lifecycle diagram above shows it as a dashed path) — if a vendor disagrees with a resolution, the practical v1 answer is "add a Communication Thread message and an admin manually re-opens it," not a fully automated reopen flow; building that out is a v2 decision, not a blocker for v1.

### Decision Intelligence Impact
- `calculateVendorRiskScore()`'s existing `rejection_score` dimension (one of its 7 weighted sub-scores) should be informed by dispute *outcomes*, not just raw counts — a vendor whose disputes mostly resolve `rejected` (i.e., the vendor was right, procurement's claim didn't hold up) shouldn't be penalized the same as one whose disputes mostly resolve `credit_note`/`payment_adjustment` (vendor was at fault). Recommend weighting `rejection_score` by the *resolved-against-vendor* dispute count specifically, not total dispute count — this keeps the composite at 7 dimensions rather than adding an 8th, and avoids the perverse incentive of penalizing vendors for disputes they didn't cause.

---

## 13. Communication Thread per PO/RFQ/ASN

### Purpose
Procurement collaboration currently happens over email/WhatsApp — outside the system, untracked, and unavailable to whoever picks up a transaction later. `tickets`/`ticket_messages` already prove the pattern works (a generic threaded-message table tied to one entity) — this generalizes that *exact* pattern to RFQ/PO/ASN/GRN/Invoice/Dispute instead of inventing a new messaging model.

### Real-World Use Cases
- A vendor asks a clarifying question on an RFQ line before bidding — today this happens over email and the other invited vendors (and future staff) never see it.
- Procurement needs to coordinate a delivery date change on a PO with the vendor, with a record of who agreed to what and when.
- An admin reviewing a GRN tolerance breach wants to ask the vendor "can you explain the damage" without leaving the GRN screen or opening a support ticket.

### Data Model
```sql
CREATE TABLE communication_threads (
  id VARCHAR(36) PRIMARY KEY,
  module_name ENUM('rfq','po','asn','grn','invoice','dispute') NOT NULL,
  record_id VARCHAR(36) NOT NULL,
  -- NULL = one shared thread for the record (PO/ASN/GRN/Invoice/Dispute — there's
  -- only one vendor on these anyway). Set = RFQ's per-invited-vendor thread,
  -- reusing the *exact* confidentiality principle RFQ bidding already enforces
  -- ("a vendor never sees other invitees or their bids") rather than inventing
  -- a different visibility model just for messaging.
  vendor_id VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_thread (module_name, record_id, vendor_id)
);

-- Same shape as the existing ticket_messages table, plus the two genuinely new
-- columns this brief asks for (attachments, convert-to-action).
CREATE TABLE communication_messages (
  id VARCHAR(36) PRIMARY KEY,
  thread_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  sender_role ENUM('vendor','procurement_admin','mdm_admin','system_admin') NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,   -- internal-only note, never returned to a vendor role
  attachment_path VARCHAR(500) NULL,
  converted_to_action VARCHAR(60) NULL,          -- e.g. 'dispute_raised', 'eta_updated'
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comm_thread (thread_id)
);
```
`is_internal` lives on the **message**, not the thread — an otherwise-shared PO thread can still carry one internal-only note without needing a second thread row.

### API Design
| Endpoint | Role | Notes |
|---|---|---|
| `GET /api/threads/:module/:recordId` | all | Vendor gets `vendor_id = req.user.vendorId`'s thread only (auto-created on first read if it doesn't exist yet, same lazy-create pattern `getGrnByAsnId` already uses for "no row yet ≠ error"); admin gets the shared thread (or picks a specific vendor's thread for RFQ via `?vendor_id=`) |
| `POST /api/threads/:module/:recordId/messages` | all | `is_internal` only honored when `sender_role !== 'vendor'` — a vendor can never post an internal note |
| `POST /api/threads/:module/:recordId/messages/:messageId/convert` | admin | `{action: 'raise_dispute'}` pre-fills a new Dispute's `description` from the message text and sets `converted_to_action` on the message |

### UI/UX Design
A single reusable `CommunicationPanel` component (not a new page) — chat-style (bubbles, sender name/role/timestamp, right-aligned for "my own" messages) since back-and-forth Q&A reads better than a flat comment list for this use case. Mounted as a new tab on: RFQ detail (per-vendor — admin sees a vendor `Select` to switch threads; a vendor sees only their own, no switcher), PO detail, ASN detail (shared tab covering GRN/Invoice discussion too, since they're sub-sections of the same ASN page already), and the new Dispute detail page (§12). An **Internal Note** toggle appears only for admin roles. A small unread-count `Badge` on the tab label itself (driven by `read_at IS NULL`) gives a passive signal without needing a notification system to exist yet.

### Notifications
Reuses the existing (currently unconfigured — SMTP credentials absent, per §10) Nodemailer setup: once configured, a new message triggers a notification to the *other* party (vendor → admin assigned to the record, admin → vendor) — exactly the kind of "wire send calls on key events" §10 already calls out as the next step, this is simply one more event to wire once that step happens. Until then, the unread-count badge above is the working fallback, not a placeholder.

### Integration With Existing Modules
- **RFQ confidentiality**: the per-vendor thread (`vendor_id` set) is the *only* new visibility rule introduced — everywhere else (PO/ASN/GRN/Invoice/Dispute) already has exactly one vendor, so "shared thread" and "vendor's own thread" are the same thing and need no extra rule.
- **Dispute Management (§12)**: the `convert` action is the explicit bridge — a message that describes a problem becomes a dispute's opening description, rather than the user re-typing it.
- **Audit/compliance**: messages are immutable — no edit/delete endpoint, append-only, mirroring `pr_audit_log`'s own immutability convention exactly.

### Role-Wise Behavior
Vendor: read/write own thread(s) only, can never see `is_internal=true` messages (filtered server-side) or another vendor's RFQ thread. Admin roles: read/write any thread, can post internal notes, can use `convert`.

### Edge Cases & Validations
- An RFQ thread for a vendor who was later *un-invited* (if that's ever possible) should remain readable (historical record) but not writable by that vendor — a `is_active` check against `rfq_vendors`, not a thread-level flag.
- Large attachment volume: reuse the existing `/api/upload` size/type limits as-is rather than defining new ones per-thread.
- A `converted_to_action` message should still render normally in the thread (with a small "→ Dispute #D-0042 raised" annotation), not disappear — the conversion is additive metadata, not a state transition on the message itself.

### Decision Intelligence Impact
None directly — communication threads are infrastructure for humans, not a new signal for the Decision/Action engines. The one indirect effect: faster, recorded vendor responses (instead of off-system email) shorten the *time-to-resolution* on disputes and exceptions, which is already what those modules' own SLA tracking measures — no new metric needed.

---

## 14. Enhanced GRN (Goods Receipt Note)

### Purpose
Today's GRN line captures `received_quantity`/`rejected_quantity`/`accepted_quantity` (derived) and a free-text `rejection_reason` — enough to gate ERP posting, but not enough to tell *why* a line was short, damaged, or over-delivered without reading the free-text field. This adds structured categorization without changing the existing tolerance/accept math.

### Data Model
```sql
ALTER TABLE grn_line_items
  ADD COLUMN shortage_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,  -- GREATEST(shipped - received, 0) — auto-calculated
  ADD COLUMN excess_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,    -- GREATEST(received - shipped, 0) — auto-calculated
  ADD COLUMN rejection_category ENUM('damage','quality','shortage','excess','other') NULL;  -- the one manually-entered field

ALTER TABLE procurement_exceptions
  MODIFY exception_type ENUM(
    'budget_breach','price_mismatch','quantity_mismatch','vendor_risk','compliance_expiry',
    'grn_tolerance_breach','invoice_mismatch','sla_breach',
    'damage_issue','shortage_issue','over_delivery','quality_rejection'  -- new
  ) NOT NULL;
```
Deliberately **not** trying to split `rejected_quantity` across multiple categories within one line — a line is rejected for one dominant reason in practice; a genuinely mixed-reason receipt is a line-splitting UI problem (the inspector enters it as two GRN lines against the same PO line), not a data-model problem to solve here.

### Validation Rules
- `received_quantity = accepted_quantity + rejected_quantity` — **unchanged**, already enforced by `grn.service.js`'s existing `acceptedQty = receivedQty - rejectedQty` formula when no explicit override is sent.
- `shortage_quantity`/`excess_quantity` are **always server-computed** from `shipped_quantity` vs `received_quantity` (`grn.service.js`, alongside the existing `deviationPct` calculation) — never accepted from the client, so they can't drift from the numbers that actually drove the tolerance check.
- `rejection_category` is **required** whenever `rejected_quantity > 0` (same "required when X" pattern `rejection_reason` already enforces) — `rejection_reason` stays as supplementary free text, not replaced.

### UI/UX Design
Extends the existing GRN entry table (`ASNs.jsx`'s GRN `InlineExpandPanel`) — no new page:
- A **Rejection Category** `Select` next to the existing Rejection Reason `Input`, enabled under the same condition (`rejected_quantity > 0`).
- Two **read-only** badges next to Received Qty, shown only when non-zero: "Shortage: N" (orange) when `shipped > received`, "Excess: N" (blue) when `received > shipped` — pure display, computed client-side from the same shipped/received values already on screen, confirmed by the server response after submit.
- The read-only GRN summary card (shown after creation) gains a **Category** column next to the existing Tolerance column.

### Exception Generation
Extends `grn.service.js`'s existing per-line tolerance-breach loop — instead of always raising `grn_tolerance_breach`, it raises the more specific type when one applies:
```
rejection_category = 'damage'  → damage_issue
rejection_category = 'quality' → quality_rejection
shortage_quantity > 0           → shortage_issue
excess_quantity > 0             → over_delivery
(none of the above, but still outside tolerance) → grn_tolerance_breach   (unchanged catch-all)
```
Same `raiseException()`/`autoResolve()` dedup-key pattern as today — only the `exception_type` selection logic changes, not the raise/resolve mechanism.

### Integration With Existing Modules
- **ASN**: `shipped_quantity` comparison is unchanged — shortage/excess are simply named instead of left implicit in the existing deviation-percentage number.
- **PO**: `ordered_quantity` already on `grn_line_items`, unaffected.
- **Invoice 3-way match**: unaffected — it already reads `accepted_quantity`, which keeps the same formula.
- **Inventory** (Procurement OS §3): `receiveStockFromGrn()` already adds `accepted_quantity` to stock — unaffected, and correctly so, since only accepted units should ever enter stock regardless of *why* the rest wasn't accepted.

### Edge Cases & Validations
- `damage` + `shortage_quantity > 0` on the same line is valid (a line can simultaneously be short *and* have some of what arrived be damaged) — `rejection_category` describes the *rejected* portion's dominant cause, it doesn't claim the line has only one problem.
- An `excess_quantity` line is **not** automatically rejected — over-delivery is usually still accepted (at the buyer's discretion) and flagged for visibility/negotiation, not refused outright; `excess_quantity > 0` can coexist with `rejected_quantity = 0`.
- Migrating existing `grn_line_items` rows: `rejection_category` is nullable and left `NULL` on every pre-existing row (no backfill guess at a reason that was never captured) — only new GRNs going forward get categorized.

### Decision Intelligence Impact
`calculateVendorRiskScore()`'s existing `rejection_score` dimension becomes category-aware rather than a flat count: weight `damage`/`quality` rejections more heavily than `shortage` (packaging/QC failures are a more direct signal of vendor quality than a fulfillment-accuracy miss). This is a formula change inside the existing dimension, not a new 8th dimension — keeps the composite score's shape stable while making it more informative. The same category breakdown also feeds a new line on the PR/RFQ Insights tab's existing Vendor Score card ("3 damage-related rejections in the last 90 days") rather than requiring a new report or dashboard.

---

> **Status of §11–14:** design only, not yet implemented — written against the actual current architecture (`backend/src/modules/<name>/`, the event bus from Procurement OS §2.11, `asyncHandler`/`AppError` conventions) so each is implementable as-is, in the same incremental, reuse-first style as every other module built this far. Recommended build order: §14 (Enhanced GRN) first since §12 (Dispute Management) explicitly depends on its new exception types; §11 (Payment Visibility) and §13 (Communication Threads) are independent of each other and of the other two.
