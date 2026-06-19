# ProcureTrack — Product Features

**Version:** 2.0
**Date:** June 2026
**Audience:** Business stakeholders, product managers, prospective customers

---

## Overview

ProcureTrack is a Procure-to-Pay (P2P) platform that helps enterprises manage their supplier relationships end-to-end — from sourcing and onboarding new vendors to issuing purchase orders, processing shipments, running compliance audits, and benchmarking prices. It provides procurement teams and vendors with a single, structured workspace to reduce manual coordination, improve visibility, and lower supply chain risk.

The platform is available in two modes:

- **Basic Mode** — Vendor onboarding, sourcing (RFQ), item master, purchase order management, shipment tracking, document intelligence, and master data.
- **Advanced Mode** — Everything in Basic, plus supplier audits, ticketing, risk scoring, ESG tracking, and price benchmarking.

A cross-cutting **Governance layer** (configurable approval workflows and a unified document repository) is available regardless of mode.

---

## User Roles

| Role | Who They Are |
|------|-------------|
| System Admin | Manages the platform itself — users, settings, and feature activation |
| MDM Admin | Manages vendor lifecycle, reviews onboarding submissions, oversees advanced modules and governance |
| Procurement Admin | Runs sourcing events, validates shipments, runs audits, manages tickets, tracks risk and pricing |
| Vendor | Self-onboards, responds to RFQs, creates shipment notices, participates in tickets |

---

## Core Features (Basic Mode)

### 1. Vendor Onboarding & Master Data

Structured, guided onboarding that keeps both the internal team and the supplier on the same page, backed by a full vendor governance profile.

- Procurement team creates a vendor record and issues login credentials to the supplier; the team can also **bulk-import vendors from an Excel file**, with row-by-row validation and a skipped-rows report
- Suppliers complete a **5-step self-onboarding form**: business information, addresses, bank accounts, compliance documents, and contacts
- Supports multiple addresses per vendor (billing, shipping, registered office) and multiple bank accounts
- Vendors upload compliance documents: PAN card, GST certificate, CIN, MSME certificate, bank proof
- Submission triggers a review workflow — the internal team can approve, reject with feedback, or send back for correction
- Rejected vendors can revise and resubmit
- Clear status trail at every step: **Draft → Submitted → Under Review → Approved / Rejected → Inactive**
- **Vendor classification & governance** — every vendor record carries:
  - A manually-entered, ERP-friendly vendor code alongside a system-generated unique vendor code
  - Vendor type (manufacturer / trader / service), industry, and legal registration type
  - Automatic GST and PAN format validation (valid / invalid / pending) as numbers are entered
  - Credit rating, credit limit, preferred payment terms, and base currency
  - Risk category (low / medium / high) and a preferred-vendor flag for sourcing priority
  - Blacklist control with a mandatory reason — a blacklisted vendor is automatically locked out of the active pipeline
  - Compliance document expiry tracking (e.g. certification renewal dates)
  - Geolocation (latitude/longitude) and serviceable regions for logistics planning
  - Named account manager
  - **Automatic lifecycle stage** (Onboarding / Active / Dormant / Blocked) — derived from approval status and blacklist state, not manually set, so it can't drift out of sync with reality
- **Master data** — companies, departments, supplier groups, supplier/item categories, item sub-categories, units of measure, payment terms, registration types, procurement categories, and geographic data (countries, states, cities), used consistently across vendor, item, PO, ASN, and RFQ forms

### 2. Sourcing & RFQ (Request for Quotation)

A full request-for-quotation and negotiation workflow that turns vendor bids directly into purchase orders.

- Create RFQs as **open, limited, or single-vendor** sourcing events, with a procurement category and an indicative budget value
- Add line items with technical specifications, required delivery location and date, target price, and quantity — optionally linked to an Item Master record
- Invite any number of vendors; track each invitee's participation status (Invited / Submitted / Not Responded)
- Vendors submit (and revise) bids per line item with unit price and lead time, plus commercial terms: taxes-included flag, offered payment terms, warranty period, and any deviations from the RFQ terms
- **RFQ lifecycle:** Draft → Published → Closed → Awarded
- **Comparison engine** for procurement: side-by-side bid comparison, historical price benchmarks per item, vendor risk scorecards, a Total Cost of Ownership (TCO) ranking across bids, and a configurable scoring-weight model (e.g. price vs. lead time vs. risk) used to evaluate vendors consistently
- **Award flow** automatically generates one Purchase Order per winning vendor and records the awarded prices in price history for future benchmarking
- **Bid confidentiality by design** — a vendor only ever sees their own bid and their own participation status; the number of other invitees, who they are, and their bids are never exposed to a vendor, in the API or the UI

### 3. Item Master

Centralized catalogue of purchasable items, decoupled from any single vendor or PO.

- Item code, name/description, category and sub-category, unit of measure, HSN/SAC code, standard cost, and currency
- Free-form specification templates (attribute/value pairs) per item for technical requirements
- **Preferred vendor mapping** — link one or more vendors to an item and flag preferred suppliers, so sourcing teams know who to approach first
- Feeds directly into RFQ line items for consistent, reusable item definitions across sourcing events

### 4. Purchase Order Management

Central register for all purchase orders issued to vendors, whether created directly or generated from an awarded RFQ.

- Create POs with multiple line items (item, HSN/SAC, quantity, UOM, unit price, tax)
- Commercial terms: linked contract, incoterms, cost center, project code, budget code, and a retention percentage
- Structured delivery schedules (milestone, date, quantity %) with a partial-delivery-allowed flag
- Track fulfillment in real time against shipped quantities
- Status automatically reflects fulfillment progress: **Open → Partially Fulfilled → Fulfilled → Closed**
- Vendors can see only the POs assigned to them

### 5. Advanced Shipment Notices (ASN)

Structured shipment declarations that give procurement teams advance visibility into incoming goods, with full logistics and tax detail.

- Vendors create ASNs directly from their open purchase orders
- System automatically calculates how much quantity remains available to ship, preventing over-shipment
- Each ASN captures: invoice number, expected arrival date, logistics details (shipment mode, vehicle number, e-way bill number, LR number, transporter, driver, dispatch and actual delivery dates), invoice currency and exchange rate, CGST/SGST/IGST breakdown, freight charges, total amount, and line-item quantities
- Vendors attach supporting documents: PDF invoice, reference document, and additional attachments
- ASNs go through a validation workflow, including a dedicated **three-way match** check (PO vs. ASN vs. invoice) that records a matched/mismatched/pending status and discrepancy reason, before being posted to the ERP
- Status flow: **Draft → Submitted → Validated / Rejected → Posted**
- Auto-generated ASN reference numbers for easy tracking

### 6. Document Intelligence

Reduces manual data entry by automatically extracting information from uploaded supplier documents.

- Configurable extraction rules for any document type (invoices, certificates, bank statements)
- Three-tier extraction strategy: exact match, fuzzy match, and pattern-based extraction
- Each extracted field is returned with a confidence score
- Teams can review and refine extraction rules over time to improve accuracy
- Particularly useful for invoice verification and compliance document review

---

## Advanced Features (Advanced Mode)

### 7. Supplier Audit Management

End-to-end audit capability — from planning to corrective action tracking.

- Create reusable **audit checklists** with sequenced questions (Yes / No / N/A responses)
- Schedule audits for individual vendors or entire supplier groups with configurable frequency: one-time, weekly, monthly, or quarterly
- System pre-plans all future audit instances based on the schedule
- During execution, auditors record responses, mandatory remarks for non-conformances, and severity-rated findings
- Completed audits capture an **audit score** and a **compliance percentage**, with the assigned auditor recorded automatically
- Findings can be linked to a supporting evidence document group
- Track **corrective and preventive actions (CAPA)** per finding — owner, due date, and closure date — through to closure (Open → Closed)
- Audits cannot be closed until all findings are resolved

### 8. Ticketing & Supplier Communication

Structured, traceable communication channel between procurement teams and suppliers.

- Raise tickets and assign them to one or multiple vendors, with a category and an optional SLA target
- SLA breach is calculated live against the ticket's due date and current status, so dashboards are always accurate without a background job
- Thread-based messaging keeps all conversations in context
- Each assigned vendor can close their portion of the ticket with remarks
- Ticket automatically transitions to **Vendor Closed** when all assigned vendors have responded
- Admin closes with a rating (1–5 stars), root cause, resolution type, and final remarks
- Auto-generated ticket numbers for easy reference (TKT-00001, TKT-00002, …)

### 9. Supplier Risk Scoring

Quantitative, automatic risk assessment for every vendor, combining operational performance with financial, dependency, geographic, and ESG signals.

- Composite risk score blends seven weighted dimensions: shipment rejections, shipment delays, open audit findings, financial standing (credit/blacklist status), supply dependency concentration, geographic exposure, and ESG compliance
- Risk levels: **Low (0–30)**, **Medium (31–60)**, **High (61–100)**
- Each vendor also shows a **risk trend** (improving / stable / worsening) versus its previous score
- Scores can be recalculated on demand for all vendors at once
- Gives procurement teams an at-a-glance view of which vendors need attention, and feeds directly into the RFQ comparison engine

### 10. ESG Tracking

Monitor supplier sustainability and compliance commitments alongside operational performance.

- Track diversity status and compliance indicators per vendor
- Carbon emission score, energy consumption, and waste management score per vendor
- Free-form certification list (e.g. ISO 14001) and a linked evidence document group
- Inline editing keeps updates fast
- Feeds the ESG component of the overall supplier risk score

### 11. Price Benchmarking

Cross-vendor price analytics to support smarter purchasing decisions.

- View historical pricing for any item across all vendors, including prices recorded automatically when an RFQ is awarded
- Analytics per item: average, minimum, maximum, and most recent price
- Vendor-by-vendor pricing comparison for the same item
- Item-by-item comparison across vendors
- Helps identify pricing outliers and negotiate better terms

---

## Governance Layer (All Modes)

### 12. Workflow Engine

Configurable, multi-step approval workflows that any module can plug into.

- Define a workflow per business module (e.g. vendor approval, high-value PO sign-off) with an ordered sequence of steps, each assigned an approver role and an SLA in hours
- Start a workflow instance against any record; the system tracks which step it's on and its overall status (In Progress / Approved / Rejected / Cancelled)
- Each step can only be approved or rejected by the role assigned to it (or by MDM Admin as a top-level override) — enforced on the server, not just hidden in the UI
- A full timestamped history (who acted, what they decided, and any remarks) is kept per instance for audit purposes

### 13. Document Center

A unified document repository for modules that don't have a dedicated upload flow of their own (audit evidence, ESG certifications, ticket attachments, and similar), distinct from the existing vendor-onboarding and ASN document flows.

- Upload any file against a module name and record, optionally grouped under a shared document-group id so several files can be tracked together (e.g. one audit's full evidence pack)
- Track file type, upload date, expiry date, and a verification status (pending / verified / rejected)
- Filterable by module, record, or document group
- Restricted to procurement/MDM admin roles, since it spans records across every vendor and module

---

## Platform-Wide Features

### Role-Based Dashboards

Each user role sees a dashboard tailored to their responsibilities:

- KPI cards showing counts of active vendors, open POs, pending ASNs, open tickets, and more
- Charts for status distribution (pie) and monthly trends (bar)
- Quick access to recently updated records

### User Management

- System admins can create, edit, and deactivate users
- Assign roles at user creation
- Reset passwords for any user
- First-time login forces vendors to set their own password

### Vendor Data Isolation

- Vendors see only their own purchase orders, ASNs, RFQ invitations and bids, tickets, and documents
- Vendors never see which other suppliers were invited to or bid on the same RFQ, or how many were invited
- No cross-vendor data exposure by design

### Audit Logging

- All significant actions (logins, vendor status changes, ASN submissions, audit closures, workflow approvals) are recorded
- Useful for compliance reviews and dispute resolution

---

## Modes at a Glance

| Feature | Basic | Advanced |
|---------|-------|----------|
| Vendor Onboarding & Governance | Yes | Yes |
| Sourcing (RFQ) | Yes | Yes |
| Item Master | Yes | Yes |
| Purchase Orders | Yes | Yes |
| ASN Management | Yes | Yes |
| Document Intelligence | Yes | Yes |
| Master Data | Yes | Yes |
| Supplier Audits | — | Yes |
| Ticketing | — | Yes |
| Risk Scoring | — | Yes |
| ESG Tracking | — | Yes |
| Price Benchmarking | — | Yes |
| Workflow Engine | Yes | Yes |
| Document Center | Yes | Yes |
