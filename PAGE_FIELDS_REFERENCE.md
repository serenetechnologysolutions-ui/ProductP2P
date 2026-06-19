# ProcureTrack — Page & Field Reference

Inventory of every frontend page (`frontend/src/pages/`), its route, and the
fields/columns/inputs present on it. Generated from the codebase as of
2026-06-17 (updated same day after the Vendor Master / Item Master / RFQ rework).

---

## 1. Dashboard
**Route:** `/` · **Component:** `Dashboard.jsx` · **Nav:** "Dashboard"

Three role-based variants:

**Vendor view**
- Stat cards: My ASNs (total), Submitted, Posted to ERP, Purchase Orders
- Profile Status tag (Draft / Submitted / Under Review / Approved / Rejected / Inactive)
- Recent ASNs table: ASN #, Invoice, Amount (₹), Status, Date

**Procurement Admin view**
- Stat cards: Total ASNs, Pending Validation, Validated, Posted to ERP, Rejected
- Charts: ASNs by Status (pie), ASNs by Month (bar)
- Recent ASNs table: ASN #, Vendor, Invoice, Amount (₹), Status, Date

**MDM Admin view (default)**
- Stat cards: Total Vendors, Pending Approval, Active Vendors, Total ASNs, Pending Validation, Posted to ERP
- Charts: Vendors by Status (pie), ASNs by Month (bar)
- Recent Vendors table: Vendor #, Name, Email, Status, Created

---

## 2. Vendor Master
**Route:** `/vendors` · **Component:** `Vendors.jsx` · **Nav:** "Vendors"

**List view**
- Table: Name (with avatar), Company, Category, Email, Status (tag), Actions (Delete)
- Search by name, pagination
- "Import Excel" button → modal: drag-and-drop `.xlsx`/`.xls` upload, posts to `POST /api/vendors/import`; shows per-row created/skipped results with reasons (header row must be Vendor Name, Email, Phone, Company Name, Department, Supplier Group, Supplier Category, Supplier Location)

**Detail view (tabs)**
- Overview: Email, Phone, Company, Department, Supplier Group, Category, Location, GST, PAN, Trade Name, Legal Name, Rejection Reason
- Addresses: list with Billing/Shipping/Registered tags — Line 1, Line 2, City, State, Country, Pin Code
- Bank Accounts: Account #, IFSC, Holder Name, Branch

**Edit view**
- Same fields as detail, editable; nested Address and Bank Account arrays with add/remove rows
- City/State/Country are now **searchable Select dropdowns** sourced from Sub Masters (`/api/sub-masters/city|state|country`), both in Addresses and Bank Accounts

**Create form**
- Name, Email, Phone, Company (dropdown), Department, Supplier Group, Supplier Category, Location

**Actions:** Approve, Reject (with reason), Begin Review, Deactivate, **Delete** (hard delete — blocked with a clear message if the vendor has POs, ASNs, tickets, RFQ invitations/bids, or price history; deactivate instead in that case)

---

## 3. Vendor Onboarding
**Route:** `/vendor-onboarding` · **Component:** `VendorOnboarding.jsx` · **Nav:** (vendor self-service)

Multi-step form:
- **Step 1 — Company Info:** GST Number, PAN Number, Trade Name, Legal Name, MSME Type, ITR Filing Status
- **Addresses step:** Line 1, Line 2, City/State/Country (Select dropdowns sourced from Sub Masters), Pin Code, tags
- **Step 2 — Bank Accounts (repeatable):** IFSC Code, Account Number, Account Holder, Bank Name, Branch, **City** (Select dropdown), **State** (Select dropdown), Country (Select dropdown)
- **Document uploads:** PAN, GST Certificate, CIN, MSME Certificate, Bank Proof — each an Antd `Upload` hitting `POST /api/upload/vendor-document` with `doc_type`
- Action: Submit for Approval

---

## 4. ASNs (Advance Shipment Notice)
**Route:** `/asns` (also aliased `/vendor-asns`) · **Component:** `ASNs.jsx` · **Nav:** "ASN"

View states: `list | detail | create | edit` (no popups — full-page views)

**List view**
- Filters: Invoice #, PO # (search inputs), Status (select)
- Table: ASN #, Vendor (admin only), PO #, Invoice #, Amount, ETA, Created, Status

**Create/Edit — 4-step wizard:**
1. Select PO — dropdown + PO Line Items table (line #, description, PO qty, consumed, available, unit price)
2. ASN Details — Invoice Number, ETA, Total Amount, LR Number, Transporter Name, Driver Name (required); Driver Number, Additional Info 1–4, Remarks (optional)
3. Attachments — Invoice PDF (with auto-extraction), Reference PDF, Excel file
4. Invoice View — PDF preview (left) + Line Items table with editable Ship Qty per row (right), running total

**Detail view**
- Header: ASN #, Status tag, action buttons (Submit / Validate / Reject / Post depending on role+status)
- Info cards: PO #, Invoice #, Amount, ETA, Transporter, Driver, LR #, ERP Status, Vendor
- Line items table: line #, description, quantity, amount

---

## 5. Purchase Orders
**Route:** `/purchase-orders` · **Component:** `PurchaseOrders.jsx` · **Nav:** "Purchase Orders"

**List view**
- Filters: PO Number (input), Status (select: Open / Partially Fulfilled / Fulfilled / Closed)
- Table: PO Number, PO Date, Vendor, Buyer, GSTIN, Amount (₹), Validity, Status

**Create PO form**
- Buyer & PO info: PO Number, PO Date, Vendor (select), PO Validity Date, Buyer Name, Buyer Address, GSTIN, State Name, State Code, Terms of Payment
- Purchase Lines (dynamic table): Description, HSN/SAC, Qty, UOM, Unit Cost ₹, Amount ₹ (auto), Tax %, Tax ₹ (auto), Total ₹ (auto), delete row
- Summary: Subtotal, Total Tax, Total PO Value

---

## 6. RFQ & Negotiation
**Route:** `/rfq` · **Component:** `RFQ.jsx` · **Nav:** "RFQ & Negotiation"

View states: `list | create | detail` — full pages only, **no modal/popup** for creation.

**List view**
- Table: RFQ Number, Title, Status, Deadline, Vendors (count), Items (count), My Status (vendor) / Bids (admin), Actions (View)
- "Create RFQ" button → navigates to the full-page Create view

**Create view (full page)**
- Title, Bid Deadline (date+time), Description, Invite Vendors (multi-select, all approved vendors)
- Line items (repeatable), with an explicit aligned header row: **Item (Master)** — searchable Select sourced from Item Master (auto-fills description + UOM), Qty, UOM, Target Price, Remarks, Attachment (per-item file upload), delete row
- Back/Cancel return to the list without saving

**Detail view — Admin tabs:** Overview | Line Items | Vendor Responses | Comparison (shown as soon as any bid exists, regardless of status) | Award (closed only)
- Overview: RFQ #, Status, Deadline, Vendors Invited stat cards; Description; Invited Vendors table; Publish/Close buttons
- Line Items: #, Item Description, Quantity, UOM, Target Price, Remarks, Attachment (link)
- Vendor Responses: per-vendor card — bid items table (Item, Unit Price, Lead Time, Remarks, Attachment), total bid value
- Comparison: Price Comparison matrix (item × vendor), Historical Benchmarks, Vendor Scorecard & Ranking (price/delivery/quality/risk/final score)
- Award: Award Mode (Single vendor / Multi-vendor split), winning vendor select, per-item final qty + final price (+ vendor select if split)

**Detail view — Vendor tabs:** Overview | Line Items | My Bid
- My Bid: per line item — Unit Price, Lead Time (days), Remarks, Attachment (file upload); overall bid remarks; running total; Submit/Update Bid

---

## 6a. Item Master
**Route:** `/item-master` · **Component:** `ItemMaster.jsx` · **Nav:** "Item Master" (under Procurement)

- Search bar: by item code or description
- Table: Item Code (tag), Description, UOM, Category, Actions (Edit/Delete)
- Add/Edit form: Item Code (required, immutable on edit), Item Description (required), UOM (default "Nos"), Category (optional free text)
- Drives the "Item" dropdown on RFQ line items — selecting an item auto-fills description and UOM

---

## 7. Sub Masters
**Route:** `/sub-masters` · **Component:** `SubMasters.jsx` · **Nav:** "Sub Masters"

Tab per category: `company, department, supplier_group, supplier_category, country, state, city`
- Each tab: table (Name, Code, Edit/Delete) + inline Add form (Name required, Code optional)

---

## 8. Extraction Config
**Route:** `/extraction-config` · **Component:** `ExtractionConfig.jsx` · **Nav:** "Extraction Config"

- Table: Field Name, Aliases (tags), Regex (code), Priority (High/Medium/Low)
- Add/Edit inline form: Field Name, Aliases (comma-separated), Regex Pattern (optional), Priority (select)

---

## 9. User Management
**Route:** `/user-management` · **Component:** `UserManagement.jsx` · **Nav:** "User Management"

**List view**
- Filters: Search by Name/Email, Role (select)
- Table: Name, Email, Role (tag), Status (Active/Inactive), Created, Actions (Edit/Delete)

**Add/Edit modal**
- Full Name, Email (disabled on edit), Role (select), Password (required on add, optional on edit, min 6 chars), Active toggle (edit only)

---

## 10. System Settings
**Route:** `/system-settings` · **Component:** `SystemSettings.jsx` · **Nav:** "System Settings"

**Module Settings tab** — toggles: Platform Mode (Basic/Advanced), Audit Management, Supplier Ticketing, Risk Scoring, ESG Tracking, Price Benchmarking

**System Usage tab** — stat cards: Total Users, Active Users, Total Vendors, Total ASNs, Total POs, Total Tickets, DB Size (MB)

---

## 11. Audit Management
**Route:** `/audit` · **Component:** `AuditManagement.jsx` · **Nav:** "Audit Management"

**Checklists tab**
- Table: Name, Category, Items Count, Description
- Add/Edit modal: Checklist Name, Description, Category (Quality/Compliance/Safety/Environmental/General), Checklist Items (dynamic list)

**Schedules tab**
- Table: Checklist, Vendor/Group, Frequency, From, To, Audits (completed/total), Status
- Create modal: Checklist (select), Vendor (select, optional), Vendor Group, Frequency (One Time/Weekly/Monthly/Quarterly), Start Date, End Date

**Executions tab**
- Table: Checklist, Vendor, Due Date, Status, Completed, Actions
- Execution detail: Checklist Responses (item + Yes/No/N/A radio + remarks); Findings (Description, Severity, Status, Assigned To) with Add Finding modal

---

## 12. Supplier Issues (Tickets)
**Route:** `/tickets` · **Component:** `Tickets.jsx` · **Nav:** "Supplier Issues"

**List view**
- Table: Ticket # (link), Subject, Priority (tag), Status (tag), Created
- "Create Ticket" button (admin only)

**Detail view**
- Header: Subject, Ticket #, Description, Priority, Status, Created
- Vendor Statuses table: Vendor Name, Status, Remarks, Closed At
- Reassign Vendors (admin only): multi-select + Reassign button
- Messages thread: sender + role tag + timestamp + content; reply textarea
- Close Ticket action

**Create Ticket modal (admin only)**
- Subject, Description, Priority (select), Vendors (multi-select)

---

## 13. Supplier Risk
**Route:** `/risk` · **Component:** `RiskDashboard.jsx` · **Nav:** "Supplier Risk"

- Stat cards: Low / Medium / High Risk counts
- Pie chart: Risk Distribution
- Table: Vendor Name, Risk Score, Risk Level (tag), Delay Score, Rejection Score, Audit Score
- Action: Recalculate Scores

---

## 14. ESG Tracking
**Route:** `/esg` · **Component:** `ESGTracking.jsx` · **Nav:** "ESG Tracking"

**List view**
- Table: Vendor Name, Diversity (Yes/No), Compliance (Compliant/Pending/Non-Compliant), Remarks

**Edit view**
- Diversity Flag (switch), Compliance Status (select), Remarks (textarea)

---

## 15. Price Insights
**Route:** `/pricing` · **Component:** `PriceBenchmarking.jsx` · **Nav:** "Price Insights"

**Item Benchmarks tab**
- Bar chart: Top 10 items by Avg/Min/Max price
- Table: Item Description, Records, Avg Price, Min Price, Max Price, Last Price

**Vendor-wise Pricing tab**
- Per-vendor card (Avg Price, Total Records) + table: Item, Unit Price, Quantity, Date

**Item-wise Pricing tab**
- Per-item card (Avg, Min, Max, Vendor count) + table: Vendor, Unit Price, Quantity, Date

---

## 16. Change Password
**Route:** `/change-password` · **Component:** `ChangePassword.jsx` · **Nav:** "Change Password"

- New Password, Confirm Password → Update Password button

---

## 17. Login
**Route:** `/login` · **Component:** `Login.jsx` · **Nav:** (no sidebar, public)

- Sign-in form: Email, Password → Sign In button; error alert on failure
- Demo credentials table (clickable rows pre-fill the form): Role, Email, Password

---

## Notes on patterns observed (updated 2026-06-17)
- City/State/Country are now **Select dropdowns** sourced from Sub Masters (`country`, `state`, `city` categories) on Vendor Master (Addresses + Bank Accounts) and Vendor Onboarding (Addresses + Bank Accounts).
- File uploads: Vendor Onboarding (5 document types), ASN (Invoice PDF / Reference PDF / Excel), Vendor Excel import (`POST /api/vendors/import`), and a new generic attachment endpoint `POST /api/upload/file` used by RFQ line items and vendor bid items (returns a path/name pair the caller links to its own record).
- RFQ creation is now a **full page** (`view: 'create'`), matching the ASN/Purchase Orders pattern — no modal.
- Item Master (`/item-master`) now exists and drives RFQ line item selection (item code/description/UOM); PO line items remain free-text for now.
- RFQ's Comparison tab unlocks as soon as any bid exists, not only after the RFQ is closed/awarded.
- Vendor Master supports a hard **Delete** (blocked when transactional history exists) in addition to the existing Deactivate.
