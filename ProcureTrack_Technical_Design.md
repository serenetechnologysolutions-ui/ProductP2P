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
