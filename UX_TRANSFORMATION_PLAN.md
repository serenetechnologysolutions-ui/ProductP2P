# ProcureTrack UX Transformation — Overlay-Free Design System

## Objective

Transform ProcureTrack into a world-class procurement UX by eliminating all Drawer and Modal dependencies and replacing them with scalable, context-preserving interaction patterns.

---

## 1. Remove Overlay-Based UX

### Eliminate:

* All Drawer-based interactions (create, edit, reject, upload, etc.)
* All Modal-based flows (except optional delete confirmation)

### Reason:

Overlays break workflow continuity, reduce visibility of context, and do not scale for enterprise procurement complexity.

---

## 2. Adopt Core Interaction Patterns

### 2.1 Full-Page Task Flows (Primary Pattern)

All major actions must be full-page flows:

Examples:

* Create Vendor → `/vendors/create`
* Create RFQ from PR → `/rfq/create-from-pr/:id`
* Create PO → `/purchase-orders/create`

Structure:

* Header (Title + Status)
* Step-based flow (if needed)
* Context panel (optional)
* Sticky action bar (Save / Submit)

---

### 2.2 Split-Screen Layout (Default for Master Data)

Apply to:

* Vendors
* Item Master
* Tickets
* Contracts

Layout:

* Left: List (30–40%)
* Right: Detail/Edit (60–70%)

Benefits:

* No navigation switching
* Faster operations
* Continuous context

---

### 2.3 Inline Expand Panels (Replace Drawers)

Use for:

* Reject actions
* Add comments
* Add audit findings
* Quick updates

Pattern:

* Button click expands inline section below trigger
* Contains form fields + action buttons

---

### 2.4 Side Context Panel (Insights Layer)

Optional collapsible panel on right:

Use for:

* Vendor risk
* Price insights
* Audit history
* Document references

Must be:

* Non-blocking
* Toggleable
* Persistent per page

---

### 2.5 Inline Table Editing

All table-based edits must support:

* Inline field editing
* Row-level save/cancel
* Validation on edit

No navigation or overlay required.

---

## 3. Page Layout Standardization

Every page must follow:

1. Header

   * Dynamic title
   * Breadcrumbs
   * Status tag
   * Primary actions

2. Summary Panel

   * KPIs / key info

3. Tabs

   * Details
   * Activity
   * Documents
   * History

4. Main Content

5. Sticky Action Bar

---

## 4. Interaction Rules

* No blocking UI for non-critical actions
* All edits must preserve context
* Navigation must be predictable
* Actions must be visible at all times

---

## 5. Expected Outcome

* Reduced cognitive load
* Faster procurement workflows
* Enterprise-grade usability
* Scalable UX for complex features

---

## 6. Success Criteria

* Zero dependency on Drawer/Modal for core flows
* All workflows accessible within 1–2 navigation steps
* Users can complete PR → RFQ → PO without context switching

---

This system establishes ProcureTrack as a modern, enterprise-grade procurement experience aligned with global SaaS standards.

---

## Implementation Notes (added during execution)

This plan is being executed incrementally against the existing codebase (see git history for
this file's directory). Two shared components anchor the rollout:

- `frontend/src/components/ui/InlineExpandPanel.jsx` — the Drawer/Modal replacement for
  §2.3 (and, pragmatically, for simple single-record "create" forms on plain list pages where a
  dedicated route would be overkill — it expands in place above/below the trigger instead of
  navigating away).
- `frontend/src/components/ui/SplitScreenLayout.jsx` — the §2.2 list+detail shell, applied first
  to Vendors and Item Master.

Full-page task flows (§2.1) were already the dominant pattern for the big multi-step documents
(Vendors, ASNs, RFQ, PR, Purchase Orders all already swap to a full-page create/edit view rather
than a route) — that part of the objective was largely in place already; the work here is
removing the *remaining* Drawer/Modal usage on top of and alongside that pattern, and applying
split-screen where the spec calls for it.

---

## V2 Addendum — World-Class UX Transformation Prompt

A follow-up, larger-scope spec was provided expanding this plan. Recorded verbatim below for
reference; see "Execution status" beneath it for what's actually been built vs. deferred.

# ProcureTrack — World-Class UX Transformation Prompt (V1)

## Objective

Transform ProcureTrack from a form-driven internal tool into a **world-class, decision-driven procurement platform** by redesigning the UI/UX system across all modules.

---

# 1. Application Shell (Header + Sidebar)

## 1.1 Dynamic Header (MANDATORY)

Replace static header ("ProcureTrack") with contextual header:

Format:

* Module Name / Record ID
* Example: `Purchase Requisition / PR-1024`

Include:

* Status tag (color-coded)
* Primary actions (Approve, Reject, Submit)

---

## 1.2 Breadcrumb Navigation

Add breadcrumb below header:

Format:
`Procurement > Purchase Requisitions > PR-1024`

Purpose:

* Clear navigation hierarchy
* Easy backtracking

---

## 1.3 Sidebar Intelligence

Enhance sidebar with real-time indicators:

Add:

* Pending approvals count (badge)
* Alerts (red indicators)
* Active module highlight

---

## 1.4 Branding Upgrade

Replace text logo with:

* Proper logo (icon + wordmark)
* Consistent brand identity across login + app

---

# 2. Navigation Architecture

## 2.1 Replace Role-Based Static Menus

Remove hardcoded role menus.

Implement:

* Permission-driven dynamic menu rendering

---

## 2.2 Smart Navigation Layer

Add top-level sections:

* My Work
* Pending Approvals
* Recent Items

---

## 2.3 Favorites / Pinning

Allow users to:

* Pin PR / RFQ / Vendor / PO
* Access pinned items from sidebar/top bar

---

# 3. Page Structure Standardization (MANDATORY)

All modules MUST follow this layout:

## 3.1 Page Template

1. Header

   * Title (dynamic)
   * Status tag
   * Breadcrumb
   * Actions

2. Summary Panel

   * Key KPIs (value, vendor, budget, status)

3. Tabs

   * Details
   * Activity
   * Documents
   * History

4. Main Content Area

5. Sticky Action Bar (top/right)

---

## 3.2 Sticky Actions

All key actions must be:

* Always visible
* Never hidden at bottom

---

# 4. Forms UX (CRITICAL)

## 4.1 Convert Forms → Guided Flows

Replace long forms with:

* Progressive disclosure
* Step-based flow (where needed)

---

## 4.2 Inline Intelligence (MANDATORY)

Embed insights directly in forms:

Examples:

* Last purchase price
* Budget impact
* Suggested vendor
* Contract availability

---

## 4.3 Required vs Optional Fields

Replace simple asterisk system with:

* Primary Section → Required fields
* Secondary Section → Optional fields

---

## 4.4 Standardize Step Behavior

All multi-step flows must:

* Enforce step validation before proceeding
* Prevent skipping ahead

Apply consistent step logic across:

* ASN
* Vendor onboarding
* RFQ creation

---

# 5. Tables & Data Density

## 5.1 Smart Columns

Enhance tables with:

* Vendor → Risk score + rating
* PR → Budget status + alerts
* RFQ → Participation + price deviation

---

## 5.2 Row Highlighting

Apply visual priority:

* Overdue → Red highlight
* High value → Bold/emphasis
* Risky vendor → Warning indicator

---

## 5.3 Inline Actions

Enable:

* Edit
* Approve
* Reject

Directly from table rows

---

# 6. Status & Color System (MANDATORY FIX)

Standardize across ALL modules:

| Meaning            | Color  |
| ------------------ | ------ |
| Approved / Success | Green  |
| In Progress        | Blue   |
| Attention Required | Orange |
| Rejected / Error   | Red    |
| Draft / Inactive   | Grey   |

---

## 6.1 Fix Inconsistencies

* PR module must align with global standard
* Replace "Urgent" vs "Critical" with one standard

---

# 7. Overlay Removal (CRITICAL UX SHIFT)

## 7.1 Remove:

* All Drawer usage
* All Modal usage (except optional delete confirm)

---

## 7.2 Replace with:

### A. Full Page Flows

* Create / Edit PR, RFQ, PO, Vendor

### B. Inline Expand Panels

Use for:

* Reject actions
* Comments
* Small forms

### C. Split-Screen Layout

Use for:

* Vendor
* Item Master
* Tickets

Layout:
Left → List
Right → Detail/Edit

---

# 8. Decision UX Layer (BIGGEST DIFFERENTIATOR)

## 8.1 Insights Panel

Add contextual insights:

* "Vendor risk increased"
* "Price is 12% higher than last PO"
* "Contract available but not used"

---

## 8.2 Alerts System

Show inline alerts for:

* Budget exceeded
* Vendor blocked
* Compliance issues

---

# 9. Feedback & Messaging

## 9.1 Balance Toast Messages

Use:

* Success
* Warning
* Info
* Error

Avoid overuse of error messages

---

## 9.2 Inline Feedback

Show validation and messages:

* Inside forms
* Near fields

Not only as toast

---

# 10. Responsiveness

## 10.1 Improve Layout

* Tablet-friendly grids
* Collapsible sections
* Adaptive tables

---

# 11. Dashboard UX Upgrade

## 11.1 Make Actionable

Replace passive stats:

"Total ASNs: 24" -> "5 ASNs pending validation -> [Go]"

---

## 11.2 Add Priority Panels

* Urgent approvals
* High-risk vendors
* Budget alerts

---

# 12. Design System (FOUNDATION FIX)

## 12.1 Remove global.css overrides

Migrate to:

* Ant Design Token System

---

## 12.2 Create Component System

Standardize:

* Buttons
* Tables
* Forms
* Status tags
* Cards

---

# Priority Roadmap

## P0 (Immediate)

* Status color standardization
* Dynamic header + breadcrumbs
* Page layout standardization
* Remove Drawer/Modal
* Step flow consistency
* Decision insights (PR/RFQ)

---

## P1 (High Impact)

* Dashboard actionability
* Smart tables
* Vendor 360 UI
* Messaging improvements

---

## P2 (Polish)

* Design system tokens
* Responsiveness
* Empty state improvements

---

# Success Criteria

* Zero dependency on Drawer/Modal for core workflows
* All actions completed without losing context
* Procurement decisions supported by system insights
* UX consistency across all modules

---

## Execution status (this is the actual tracking — read this, not the roadmap above, for what's real)

**In progress now, unchanged from V1:** §7 Overlay Removal — `InlineExpandPanel` and
`SplitScreenLayout` shared components built; Vendors.jsx migrated (Import Excel + Reject drawers
→ inline panels, list+detail → split-screen); remaining pages being migrated one at a time
(ASNs, ItemMaster, AuditManagement, Tickets, UserManagement, WorkflowEngine, DocumentCenter, PR,
RFQ, PurchaseOrders).

**Picked up next:** §6 Status & Color System — concrete, well-defined, no backend dependency.

**Explicitly deferred — each of these is a separate, large effort in its own right and needs a
scoping decision before code gets written, not a guess:**
- §1.1/1.2/3 Dynamic header + breadcrumbs + full page-template standardization on *every* page —
  large, mechanical, but touches every single page file; sequencing this against the overlay
  migration (same files) needs a decision on order.
- §1.3 Sidebar badges (pending-approvals count, alerts) — needs new backend aggregation queries.
- §2.1 Permission-driven dynamic menus replacing the hardcoded per-role arrays — an architecture
  change to how the sidebar/route-guarding works, not a styling change.
- §2.2/2.3 My Work / Recent Items / Pinning — needs new backend tables (no `pinned_items` /
  recently-viewed tracking exists today).
- §4.2 and §8 Inline intelligence / Decision UX layer ("price 12% higher than last PO", "vendor
  risk increased", contract-availability nudges) — needs new backend comparison/delta endpoints;
  the raw data (price_history, vendor_risk_scores, contracts) exists but nothing computes or
  serves these deltas yet.
- §11 Dashboard actionability — same as above, needs backend aggregation beyond current counts.
- §12 Replacing `global.css` with Ant Design's theme-token system — a full design-system
  migration, independent of and not blocking the overlay work.
- §5 Smart columns / row highlighting / inline table editing, §10 responsiveness — large,
  cross-cutting, lower risk than the above but still substantial per-table work.
