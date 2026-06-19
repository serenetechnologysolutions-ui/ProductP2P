# ProcureTrack — Complete Features Document

## 1. Application Overview

ProcureTrack is a Procure-to-Pay platform with two operating modes, plus a cross-cutting governance layer:

| Mode | Modules |
|------|---------|
| **Basic** | Vendor Onboarding, RFQ/Sourcing, Item Master, ASN Management, Purchase Orders, Document Intelligence, Sub Masters |
| **Advanced** | All Basic + Supplier Audit, Ticketing, Risk Scoring, ESG Tracking, Price Benchmarking |
| **Governance (always on)** | Workflow Engine, Document Center |

System Administrator controls which mode is active via Settings.

---

## 2. User Roles

| Role | Access |
|------|--------|
| System Admin | Platform settings, module activation, system usage, user management |
| MDM Admin | Full vendor lifecycle, RFQ/PO/ASN oversight, all advanced modules, governance workflows |
| Procurement Admin | RFQ execution, ASN validation, audit execution, tickets, risk, ESG, pricing |
| Vendor | Self-onboarding, RFQ bidding, ASN creation, ticket participation |

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
| bcrypt | Password hashing |
| Vendor data isolation | Vendors scoped to their own vendor_id everywhere — vendors, POs, ASNs, RFQ invitations/bids, tickets, documents |
| RFQ bid confidentiality | A vendor's RFQ responses never include other invitees' identities, counts, or bids — enforced server-side, not just hidden in the UI |
| Governance access control | Workflow step approval requires the role assigned to that step (or MDM Admin override); the cross-module Document Center is restricted to MDM/Procurement admins |
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
| Bulk import | Excel upload, per-row validation, created/skipped report |
| Auto-onboarding | Auto-generated password, user account created |
| Vendor list | Paginated, searchable, filterable by status/type/risk/lifecycle stage/blacklist |
| Detail view | Overview, Addresses, Bank Accounts, Governance & Risk tabs |
| Admin edit | All fields editable (business info, governance fields, addresses, banks) |
| Workflow | Draft → Submitted → Under Review → Approved / Rejected → Inactive |
| Rejection | Mandatory reason, vendor can re-edit and resubmit |
| Soft delete | Deactivate preserves data; hard delete blocked while transactional history exists |
| Classification | vendor_code (manual) + vendor_code_auto (system-generated), vendor_type, industry, registration_type — all sub-master backed |
| Compliance validation | GST and PAN numbers auto-validated against format rules (valid / invalid / pending) on every save |
| Financial governance | credit_rating, credit_limit, payment_terms (sub-master FK), currency_code |
| Risk & lifecycle | risk_category, blacklist_flag + blacklist_reason, preferred_vendor_flag, and an automatically-derived lifecycle_stage (onboarding / active / dormant / blocked) driven by approval status and blacklist state |
| Location | geo_latitude/geo_longitude, serviceable_regions (multi-select), account_manager_name |
| Compliance tracking | compliance_expiry_dates — a JSON map of document/certification name to expiry date |

---

## 6. Vendor Self-Onboarding (Basic)

| Feature | Description |
|---------|-------------|
| 5-step form | Business Info → Addresses → Bank Accounts → Documents → Contacts |
| Core fields locked | Vendor cannot edit MDM fields |
| Self-service classification | Vendor can set vendor_type, industry, registration_type, currency, geo-location, serviceable regions |
| Multiple addresses | With Billing/Shipping/Registered tags |
| Multiple banks | IFSC, Account, Holder, Bank, Branch, City, State, Country |
| 5 document uploads | PAN, GST Certificate, CIN, MSME Certificate, Bank Proof |
| Submit | Saves all data and submits for approval |

---

## 7. RFQ / Sourcing (Basic)

| Feature | Description |
|---------|-------------|
| RFQ header | Title, description, deadline, rfq_type (open/limited/single), procurement_category_id, budget_value |
| Line items | item_master_id link, item description, quantity, UOM, target price, technical_specifications (JSON), delivery_location_id, required_delivery_date |
| Vendor invitations | Multi-vendor invite, participation_status (invited/submitted/not_responded) |
| Lifecycle | Draft → Published → Closed → Awarded |
| Vendor bidding | Per-line-item unit price + lead time, plus taxes_included_flag, offered_payment_terms, warranty_period, deviation_flag, tco_value |
| Comparison engine | Price benchmarks per item, vendor risk scorecards, TCO ranking, configurable scoring_weight_config |
| Award | Auto-generates one PO per winning vendor, records price history |
| Confidentiality | Vendor-facing list/detail responses omit vendor_count, bid_count, and the invited-vendors list entirely |

---

## 8. Item Master (Basic)

| Feature | Description |
|---------|-------------|
| Item record | item_code, item_description/item_name, category_id/subcategory_id (sub-master FK), uom (free text) + uom_id (sub-master FK), hsn_sac_code, standard_cost, currency |
| Specifications | specification_template — free-form JSON attribute/value pairs |
| Preferred vendor mapping | Separate item_vendor_mapping table; link vendors to an item and flag preferred suppliers |
| Soft delete | is_active flag |

---

## 9. Purchase Orders (Basic)

| Feature | Description |
|---------|-------------|
| Create PO | Number, vendor, line items (description, HSN/SAC, qty, UOM, price, tax) |
| Commercial terms | contract_id, incoterms, cost_center, project_code, budget_code, retention_percentage |
| Delivery | delivery_schedule_json (milestone/date/quantity %), partial_delivery_allowed_flag |
| Fulfillment tracking | Available qty updated from ASN submissions |
| Filters | PO Number, Status (Open/Partially Fulfilled/Fulfilled/Closed) |
| RFQ-generated POs | Created automatically on RFQ award, with price history recorded |

---

## 10. ASN Management (Basic)

| Feature | Description |
|---------|-------------|
| Creation | Select PO → ASN details → attachments → invoice view |
| Available qty | Real-time: PO qty minus all non-rejected ASN quantities |
| Mandatory fields | Invoice # (unique), ETA, Amount, LR, Transporter, Driver |
| Logistics detail | shipment_mode (road/air/sea), vehicle_number, eway_bill_number, dispatch_date, actual_delivery_date |
| Financials | invoice_currency, exchange_rate, cgst_amount, sgst_amount, igst_amount, freight_charges |
| Attachments | Invoice PDF, Reference PDF, Excel |
| Status flow | Draft → Submitted → Validated / Rejected → Posted |
| Three-way match | Dedicated endpoint sets three_way_match_status (matched/mismatched/pending) + discrepancy_flag/discrepancy_reason, restricted to Procurement Admin |
| Admin actions | Validate → Post to ERP (mock) or Reject with reason |

---

## 11. Document Intelligence (Basic)

| Feature | Description |
|---------|-------------|
| Python microservice | FastAPI + pdfplumber + rapidfuzz |
| Extraction pipeline | Text → Normalize → Keyword match → Fuzzy → Regex |
| Confidence scoring | Exact 95%, Fuzzy 80%, Regex 70% |
| Admin config | Field name, aliases, regex, priority (CRUD) |

---

## 12. Supplier Audit Management (Advanced)

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
- Completion captures audit_score, compliance_percentage, and auditor_user_id (defaults to whoever completes it)
- evidence_attachment_group links to a Document Center group
- Findings: severity (Low/Medium/High/Critical), plus CAPA fields — capa_action_owner, capa_due_date, capa_closure_date
- Corrective actions: Track Open → Closed
- **Complete Audit**: Saves responses, marks done (findings can remain open)
- **Close Audit**: Requires all findings resolved first

---

## 13. Supplier Ticketing (Advanced)

| Feature | Description |
|---------|-------------|
| Create ticket | Subject, Description, Priority, Category, optional SLA (hours), Assign to vendors (required) |
| SLA breach | Computed live from sla_due_date + current status (no background job required) |
| Auto-number | TKT-00001, TKT-00002, etc. |
| Vendor assignment | Multi-vendor, reassign capability |
| Messages | Thread-based, timestamped, role-tagged |
| Vendor close | Vendor marks their part done with remarks |
| Admin close | Rating (1-5) + closure remarks + root_cause + resolution_type |
| Lifecycle | Initiated → In Progress → Vendor Closed → Closed |
| Reassign | Admin can reassign vendors at any time |

---

## 14. Supplier Risk Scoring (Advanced)

| Feature | Description |
|---------|-------------|
| Calculation | Weighted composite of 7 dimensions: rejection rate, shipment delays, audit findings, financial standing (credit/blacklist), supply dependency concentration, geographic exposure, ESG compliance |
| Score | 0-100, Level: Low (0-30), Medium (31-60), High (61-100) |
| Trend | risk_trend (improving/stable/worsening) vs. the vendor's previous score |
| Recalculate | Manual trigger button, all vendors at once |
| Dashboard | Summary cards + PieChart + vendor scores table with sub-score breakdown |
| No AI/ML | Simple rule-based scoring |

---

## 15. ESG Tracking (Advanced)

| Feature | Description |
|---------|-------------|
| Per-vendor data | Diversity flag, compliance status, remarks |
| Environmental scoring | carbon_emission_score, energy_consumption, waste_management_score |
| Certifications | certification_list (free-form tags, e.g. ISO14001) |
| Evidence | esg_document_group_id links to Document Center |
| Inline editing | Click row → full edit view (no popup) |

---

## 16. Price Benchmarking (Advanced)

| Feature | Description |
|---------|-------------|
| 3 tabs | Item Benchmarks, Vendor-wise Pricing, Item-wise Pricing |
| Item Benchmarks | Avg/Min/Max/Last price per item + bar chart |
| Vendor-wise | Cards per vendor with their items and prices |
| Item-wise | Cards per item showing all vendors, price comparison |
| Source | Historical PO line item prices, including prices recorded automatically on RFQ award |

---

## 17. Workflow Engine (Governance, all modes)

| Feature | Description |
|---------|-------------|
| Definitions | Name + module_name + ordered steps, each with step_name, approver_role, sla_hours |
| Instances | Started against any module/record_id; tracks current_step_id and status (in_progress/approved/rejected/cancelled) |
| Step enforcement | Only the role assigned to the current step (or MDM Admin override) may approve/reject it — enforced server-side |
| Audit trail | workflow_logs records every action (started/approved/rejected) with actor and remarks |
| Admin UI | Workflow Definitions tab (build workflows) + Instances tab (track and act on running approvals) |

---

## 18. Document Center (Governance, all modes)

| Feature | Description |
|---------|-------------|
| Generic storage | document_group_id, module_name, record_id, file_type, file_url, uploaded_by/at, expiry_date, verification_status |
| Use cases | Audit evidence, ESG certifications, ticket attachments, and any future module without a dedicated upload flow |
| Verification | pending → verified/rejected, admin-only |
| Access control | Restricted to MDM/Procurement admin — distinct from the existing vendor-onboarding and ASN upload flows, which are unchanged |

---

## 19. System Administration

| Feature | Description |
|---------|-------------|
| Module Settings | Toggle Basic/Advanced mode, enable/disable individual modules |
| System Usage | Total users, active users, vendors, ASNs, POs, tickets, DB size |
| User Management | Add/edit/deactivate users, assign roles, reset passwords |

---

## 20. Sub Masters

| Feature | Description |
|---------|-------------|
| Categories | Companies, Departments, Supplier Groups, Supplier Categories, Countries, States, Cities, Vendor Types, Industries, Registration Types, Payment Terms, Item Categories, Item Sub-Categories, UOM, Procurement Categories, Ticket Categories |
| CRUD | Add, edit, delete per category |
| Used in | Vendor, Item Master, RFQ, and Ticket forms |

---

## 21. UI/UX Design

| Feature | Description |
|---------|-------------|
| Ant Design 5 | Consistent component library |
| No popups | All pages use inline detail/edit views (list → detail → edit pattern) |
| Collapsible sidebar | Dark theme, role-based menu items, including a dedicated Governance group |
| Page descriptions | Descriptive text below every title |
| Filter cards | Search/filter above every table |
| Status tags | Color-coded throughout |
| Responsive | Row/Col grid layout |

---

## 22. Logging & Audit Trail

| File | Content |
|------|---------|
| app.log | All requests (method, URL, status, duration, IP, user, role) |
| audit.log | Login, password reset, vendor actions |
| security.log | Failed logins, rate limit violations |
| error.log | Unhandled errors with stack traces |
| workflow_logs (DB) | Every workflow approval/rejection action, with actor and remarks |

---

## 23. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Ant Design 5, Recharts, Axios, React Router v6, dayjs |
| Backend | Node.js, Express.js (JavaScript) |
| Database | MySQL 8 (127.0.0.1:3306) |
| PDF Processing | Python, FastAPI, pdfplumber, rapidfuzz |
| Auth | JWT, bcrypt |

---

## 24. API Endpoints (90+)

| Module | Endpoints |
|--------|-----------|
| Auth | POST /login, POST /reset-password, GET /me |
| Vendors | GET list, POST create, POST /import (Excel), GET/:id, PUT/:id (admin edit), PUT/:id/onboarding, POST submit/review/approve/reject, PUT deactivate, DELETE/:id |
| RFQ | GET list, POST create, GET/:id, PUT/:id/publish, PUT/:id/close, GET/:id/comparison, PUT/:id/scoring-config, POST/:id/bids, POST/:id/award |
| Item Master | GET list, POST create, PUT/:id, DELETE/:id, GET/POST/:itemId/vendors, DELETE/:itemId/vendors/:vendorId |
| ASNs | GET list, POST create, GET/:id, POST submit/validate/reject/post, PUT/:id/three-way-match |
| Purchase Orders | GET list, GET/:id (with available qty), POST create |
| Extraction Config | GET, POST, PUT/:id, DELETE/:id |
| Sub Masters | GET/:category, POST, PUT/:id, DELETE/:id |
| Dashboard | GET (role-based) |
| Upload | POST vendor-document, POST asn-invoice, POST file (generic) |
| Documents | GET list, POST upload, PUT/:id/verify, DELETE/:id |
| Workflow | GET/POST workflows, GET/PUT/DELETE/:id, POST/:id/instances, GET instances, GET instances/:id, POST instances/:id/advance |
| Users | GET, POST, PUT/:id, DELETE/:id |
| System | GET/PUT settings, GET usage |
| Audit | GET/POST checklists, GET/POST schedules, GET/POST executions, PUT start/complete/close/evidence, POST responses/findings, PUT findings/:id |
| Tickets | GET, POST, GET/:id, POST messages, PUT reassign/category, PUT vendor-close, PUT admin-close |
| Risk | GET scores, POST calculate, GET dashboard |
| ESG | GET, PUT/:vendorId |
| Pricing | GET benchmarks, GET history |

---

## 25. Database Tables (35+)

**Basic (16):** users, sub_masters, vendors, vendor_addresses, vendor_bank_accounts, vendor_documents, item_master, item_vendor_mapping, rfqs, rfq_vendors, rfq_line_items, vendor_bids, vendor_bid_items, purchase_orders, po_line_items, asns, asn_line_items, extraction_configs

**Advanced (13):** system_settings, audit_checklists, audit_checklist_items, audit_schedules, audit_executions, audit_responses, audit_findings, tickets, ticket_vendors, ticket_messages, vendor_risk_scores, vendor_esg, price_history

**Governance (5):** workflow_master, workflow_steps, workflow_instances, workflow_logs, documents

Most Basic/Advanced tables additionally carry a shared set of governance columns (approval_workflow_id, workflow_instance_id, sla_due_date, sla_breach_flag, escalation_level, external_source, data_source_reference_id, soft_delete_flag, audit_log_reference_id) so any record can plug into the Workflow Engine and SLA tracking consistently.

---

## 26. Role-Based Access Matrix

| Feature | System Admin | MDM Admin | Procurement Admin | Vendor |
|---------|:-----------:|:---------:|:-----------------:|:------:|
| System Settings | ✅ | ✗ | ✗ | ✗ |
| User Management | ✅ | ✅ | ✗ | ✗ |
| Vendor Create/Approve | ✗ | ✅ | ✗ | ✗ |
| Vendor Self-Edit | ✗ | ✗ | ✗ | ✅ |
| RFQ Create/Publish/Award | ✗ | ✅ | ✅ | ✗ |
| RFQ Bid | ✗ | ✗ | ✗ | ✅ |
| Item Master Manage | ✗ | ✅ | ✅ | ✗ |
| ASN Create | ✗ | ✗ | ✗ | ✅ |
| ASN Validate/Post/3-Way-Match | ✗ | ✅ | ✅ | ✗ |
| Audit Management | ✗ | ✅ | ✅ | ✗ |
| Ticket Create | ✗ | ✅ | ✅ | ✗ |
| Ticket Participate | ✗ | ✅ | ✅ | ✅ |
| Risk/ESG/Pricing | ✗ | ✅ | ✅ | ✗ |
| Workflow Definitions | ✗ | ✅ | ✅ | ✗ |
| Workflow Step Approval | ✗ | ✅ (any step) | ✅ (own steps only) | ✗ |
| Document Center | ✗ | ✅ | ✅ | ✗ |

---

## 27. Known Limitations

| Area | Status |
|------|--------|
| PDF extraction integration | Config CRUD complete; Python service defined but not wired into ASN flow |
| Excel import in ASN | Button present; parsing not implemented |
| ERP posting | Mock implementation (always succeeds) |
| Email notifications | Nodemailer configured but SMTP credentials not set |
| SLA breach for tickets | Computed live on read rather than a stored/refreshed flag, since there is no scheduled job in this app |
| Vendor lifecycle "Dormant" stage | Settable but not automatically triggered — would need an inactivity-detection job |
| Geographic risk score | Currently defaults to 0; no region-risk rating source exists yet to derive it from |

---

## 28. Setup & Run

```bash
# Backend
cd backend
npm install
npm run migrate     # runs migrate.js, migrate-rfq.js, migrate-v2.js, migrate-gap-fields.js
npm run seed         # runs seed.js, seed-rfq.js, seed-gap-fields.js
node src/config/migrate-advanced.js
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

## 29. Login Credentials

| Role | Email | Password |
|------|-------|----------|
| System Admin | sysadmin@procuretrack.com | SysAdmin@123 |
| MDM Admin | admin@vendorportal.com | Admin@123 |
| Procurement Admin | procurement@vendorportal.com | Proc@123 |
| Vendor | vendor1@tatasteel.com | Vendor@123 |
