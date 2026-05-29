# ProcureTrack — Complete Features Document

## 1. Application Overview

ProcureTrack is a Procure-to-Pay platform with two operating modes:

| Mode | Modules |
|------|---------|
| **Basic** | Vendor Onboarding, ASN Management, Purchase Orders, Document Intelligence, Sub Masters |
| **Advanced** | All Basic + Supplier Audit, Ticketing, Risk Scoring, ESG Tracking, Price Benchmarking |

System Administrator controls which mode is active via Settings.

---

## 2. User Roles

| Role | Access |
|------|--------|
| System Admin | Platform settings, module activation, system usage, user management |
| MDM Admin | Full vendor lifecycle, ASN review, all advanced modules |
| Procurement Admin | ASN validation, audit execution, tickets, risk, ESG, pricing |
| Vendor | Self-onboarding, ASN creation, ticket participation |

---

## 3. Authentication & Security

| Feature | Description |
|---------|-------------|
| JWT login | Email + password, token-based sessions |
| Role-based access | Middleware enforces per-endpoint |
| First-login reset | Vendors must change auto-generated password |
| Rate limiting | 10 login attempts/minute |
| Security headers | X-Content-Type-Options, X-Frame-Options, HSTS, no X-Powered-By |
| Input sanitization | HTML/script tags stripped |
| bcrypt (12 rounds) | Password hashing |
| Audit logging | Login, actions, security events to structured JSON files |

---

## 4. Role-Based Dashboards

| Role | Dashboard Content |
|------|------------------|
| System Admin | System Settings + Usage stats |
| MDM Admin | Vendor stats, ASN stats, charts (Pie/Bar), recent vendors |
| Procurement Admin | ASN pipeline stats, charts, recent ASNs |
| Vendor | Profile status, my ASNs count, recent ASNs |

---

## 5. Vendor Management (Basic)

| Feature | Description |
|---------|-------------|
| Create vendor | Name, Email, Phone, Company, Department, Group, Category, Location |
| Auto-onboarding | 10-char password generated, user account created |
| Vendor list | Paginated, searchable, filterable by status |
| Detail view | Overview, Addresses, Bank Accounts tabs |
| Admin edit | All fields editable (business info, addresses, banks) |
| Workflow | Draft → Submitted → Under Review → Approved / Rejected → Inactive |
| Rejection | Mandatory reason, vendor can re-edit and resubmit |
| Soft delete | Deactivate preserves data |

---

## 6. Vendor Self-Onboarding (Basic)

| Feature | Description |
|---------|-------------|
| 5-step form | Business Info → Addresses → Bank Accounts → Documents → Contacts |
| Core fields locked | Vendor cannot edit MDM fields |
| Multiple addresses | With Billing/Shipping/Registered tags |
| Multiple banks | IFSC, Account, Holder, Bank, Branch, City, State, Country |
| 5 document uploads | PAN, GST Certificate, CIN, MSME Certificate, Bank Proof |
| Submit | Saves all data and submits for approval (no draft) |

---

## 7. ASN Management (Basic)

| Feature | Description |
|---------|-------------|
| 4-step creation | Select PO → ASN Details → Attachments → Invoice View |
| Available qty | Real-time: PO qty minus all non-rejected ASN quantities |
| Mandatory fields | Invoice # (unique), ETA, Amount, LR, Transporter, Driver |
| Optional fields | Driver Phone, Additional Info 1-4, Remarks |
| Attachments | Invoice PDF, Reference PDF, Excel |
| Invoice View | Left: PDF preview, Right: line items with Excel import |
| Auto-submit | Created directly as "Initiated" status |
| Admin actions | Validate → Post to ERP (mock) or Reject with reason |
| Status labels | Initiated, Validated, Posted, Rejected |

---

## 8. Purchase Orders (Basic)

| Feature | Description |
|---------|-------------|
| Create PO | Number, Vendor, Line items (description, qty, price) |
| Fulfillment tracking | Available qty updated from ASN submissions |
| Filters | PO Number, Status (Open/Partially Fulfilled/Fulfilled/Closed) |

---

## 9. Document Intelligence (Basic)

| Feature | Description |
|---------|-------------|
| Python microservice | FastAPI + pdfplumber + rapidfuzz |
| Extraction pipeline | Text → Normalize → Keyword match → Fuzzy → Regex |
| Confidence scoring | Exact 95%, Fuzzy 80%, Regex 70% |
| Admin config | Field name, aliases, regex, priority (CRUD) |

---

## 10. Supplier Audit Management (Advanced)

### Checklists
- Create/edit/delete with multiple items (sequenced)
- Detail view with all items listed, edit/delete in header

### Scheduling
- From Date + To Date + Frequency (One-time/Weekly/Monthly/Quarterly)
- Auto-calculates total audits needed (e.g., Jan-May monthly = 5 audits)
- Pre-creates all planned execution records
- Shows progress: "2 / 5 completed"

### Execution
- Planned → Start (user decides when) → In Progress → Complete / Close
- Checklist responses: Yes / No / NA per item
- Mandatory remarks for "No" answers
- Findings: Add with severity (Low/Medium/High/Critical)
- Corrective actions: Track Open → Closed
- **Complete Audit**: Saves responses, marks done (findings can remain open)
- **Close Audit**: Requires all findings resolved first

---

## 11. Supplier Ticketing (Advanced)

| Feature | Description |
|---------|-------------|
| Create ticket | Subject, Description, Priority, Assign to vendors (required) |
| Auto-number | TKT-00001, TKT-00002, etc. |
| Vendor assignment | Multi-vendor, reassign capability |
| Messages | Thread-based, timestamped, role-tagged |
| Vendor close | Vendor marks their part done with remarks |
| Admin close | Rating (1-5) + closure remarks |
| Lifecycle | Initiated → In Progress → Vendor Closed → Closed |
| Reassign | Admin can reassign vendors at any time |

---

## 12. Supplier Risk Scoring (Advanced)

| Feature | Description |
|---------|-------------|
| Calculation | ASN delays (40%) + Rejections (35%) + Audit findings (25%) |
| Score | 0-100, Level: Low (0-30), Medium (31-60), High (61-100) |
| Recalculate | Manual trigger button |
| Dashboard | Summary cards + PieChart + vendor scores table |
| No AI/ML | Simple rule-based scoring |

---

## 13. ESG Tracking (Advanced)

| Feature | Description |
|---------|-------------|
| Per-vendor data | Diversity flag (Yes/No), Compliance status, Remarks |
| Inline editing | Click row → full edit view (no popup) |
| Manual entry | Procurement Admin inputs data |

---

## 14. Price Benchmarking (Advanced)

| Feature | Description |
|---------|-------------|
| 3 tabs | Item Benchmarks, Vendor-wise Pricing, Item-wise Pricing |
| Item Benchmarks | Avg/Min/Max/Last price per item + bar chart |
| Vendor-wise | Cards per vendor with their items and prices |
| Item-wise | Cards per item showing all vendors, price comparison |
| Source | Historical PO line item prices |

---

## 15. System Administration

| Feature | Description |
|---------|-------------|
| Module Settings | Toggle Basic/Advanced mode, enable/disable individual modules |
| System Usage | Total users, active users, vendors, ASNs, POs, tickets, DB size |
| User Management | Add/edit/deactivate users, assign roles, reset passwords |

---

## 16. Sub Masters

| Feature | Description |
|---------|-------------|
| Categories | Companies, Departments, Supplier Groups, Categories, Countries, States, Cities |
| CRUD | Add, edit, delete per category |
| Used in | Vendor creation dropdowns, onboarding forms |

---

## 17. UI/UX Design

| Feature | Description |
|---------|-------------|
| Ant Design 5 | Consistent component library |
| No popups | All pages use inline detail/edit views (list → detail → edit pattern) |
| Collapsible sidebar | Dark theme, role-based menu items |
| Page descriptions | Descriptive text below every title |
| Filter cards | Search/filter above every table |
| Status tags | Color-coded throughout |
| Responsive | Row/Col grid layout |

---

## 18. Logging & Audit Trail

| File | Content |
|------|---------|
| app.log | All requests (method, URL, status, duration, IP, user, role) |
| audit.log | Login, password reset, vendor actions |
| security.log | Failed logins, rate limit violations |
| error.log | Unhandled errors with stack traces |

---

## 19. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Ant Design 5, Recharts, Axios, React Router v6, dayjs |
| Backend | Node.js, Express.js (JavaScript) |
| Database | MySQL 8 (127.0.0.1:3306) |
| PDF Processing | Python, FastAPI, pdfplumber, rapidfuzz |
| Auth | JWT, bcrypt |

---

## 20. API Endpoints (50+)

| Module | Endpoints |
|--------|-----------|
| Auth | POST /login, POST /reset-password, GET /me |
| Vendors | GET list, POST create, GET/:id, PUT/:id (admin edit), PUT/:id/onboarding, POST submit/review/approve/reject, PUT deactivate |
| ASNs | GET list, POST create, GET/:id, POST submit/validate/reject/post |
| Purchase Orders | GET list, GET/:id (with available qty), POST create |
| Extraction Config | GET, POST, PUT/:id, DELETE/:id |
| Sub Masters | GET/:category, POST, PUT/:id, DELETE/:id |
| Dashboard | GET (role-based) |
| Upload | POST vendor-document, POST asn-invoice |
| Users | GET, POST, PUT/:id, DELETE/:id |
| System | GET/PUT settings, GET usage |
| Audit | GET/POST checklists, GET/POST schedules, GET/POST executions, PUT start/complete/close, POST responses/findings, PUT findings/:id |
| Tickets | GET, POST, GET/:id, POST messages, PUT reassign, PUT vendor-close, PUT admin-close |
| Risk | GET scores, POST calculate, GET dashboard |
| ESG | GET, PUT/:vendorId |
| Pricing | GET benchmarks, GET history |

---

## 21. Database Tables (24)

**Basic (11):** users, sub_masters, vendors, vendor_addresses, vendor_bank_accounts, vendor_documents, purchase_orders, po_line_items, asns, asn_line_items, extraction_configs

**Advanced (13):** system_settings, audit_checklists, audit_checklist_items, audit_schedules, audit_executions, audit_responses, audit_findings, tickets, ticket_vendors, ticket_messages, vendor_risk_scores, vendor_esg, price_history

---

## 22. Role-Based Access Matrix

| Feature | System Admin | MDM Admin | Procurement Admin | Vendor |
|---------|:-----------:|:---------:|:-----------------:|:------:|
| System Settings | ✅ | ✗ | ✗ | ✗ |
| User Management | ✅ | ✅ | ✗ | ✗ |
| Vendor Create/Approve | ✗ | ✅ | ✗ | ✗ |
| Vendor Self-Edit | ✗ | ✗ | ✗ | ✅ |
| ASN Create | ✗ | ✗ | ✗ | ✅ |
| ASN Validate/Post | ✗ | ✅ | ✅ | ✗ |
| Audit Management | ✗ | ✅ | ✅ | ✗ |
| Ticket Create | ✗ | ✅ | ✅ | ✗ |
| Ticket Participate | ✗ | ✅ | ✅ | ✅ |
| Risk/ESG/Pricing | ✗ | ✅ | ✅ | ✗ |

---

## 23. Known Limitations

| Area | Status |
|------|--------|
| PDF extraction integration | Config CRUD complete; Python service defined but not wired into ASN flow |
| Excel import in ASN | Button present; parsing not implemented |
| Price history auto-population | Seeded manually; not auto-populated from PO creation |
| ERP posting | Mock implementation (always succeeds) |
| Email notifications | Nodemailer configured but SMTP credentials not set |

---

## 24. Setup & Run

```bash
# Backend
cd backend
npm install
node src/config/migrate.js
node src/config/migrate-advanced.js
node src/config/seed.js
node src/config/seed-advanced.js
node src/app.js                    # http://localhost:5000

# Frontend
cd frontend
npm install
npm start                          # http://localhost:3000

# Document Intelligence (optional)
cd document-intelligence
pip install -r requirements.txt
uvicorn main:app --port 8000
```

---

## 25. Login Credentials

| Role | Email | Password |
|------|-------|----------|
| System Admin | sysadmin@procuretrack.com | SysAdmin@123 |
| MDM Admin | admin@vendorportal.com | Admin@123 |
| Procurement Admin | procurement@vendorportal.com | Proc@123 |
| Vendor | vendor1@tatasteel.com | Vendor@123 |
