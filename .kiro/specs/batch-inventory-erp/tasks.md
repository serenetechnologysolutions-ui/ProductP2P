# Implementation Plan: Batch Inventory ERP

## Overview

This plan implements ERP-grade batch-controlled inventory management for ProcureTrack. It covers: a database migration for batch and related tables, batch auto-generation on GRN completion via event bus, a purchase return module with batch-level precision, a batch inventory view, and a branch order (stock transfer) module with full lifecycle tracking. The implementation integrates with existing inventory, GRN, and event-driven patterns.

## Tasks

- [x] 1. Database migration and schema changes
  - [x] 1.1 Create `migrate-batch-inventory-erp.js` migration file
    - Create `backend/src/config/migrate-batch-inventory-erp.js`
    - Create `inventory_batches` table with columns: id, batch_number (UNIQUE), item_master_id, grn_id, grn_line_item_id, location_id, qty_received, qty_available, rate, discount_percentage, tax_percentage, status ENUM('active','exhausted'), created_at, updated_at
    - Create `purchase_returns` table with columns: id, return_number (UNIQUE), vendor_id, grn_id, asn_number, return_date, return_reason, status ENUM('draft','confirmed','closed'), round_off, total_amount, created_by, confirmed_by, confirmed_at, created_at, updated_at
    - Create `purchase_return_line_items` table with columns: id, purchase_return_id, item_master_id, batch_id, batch_number, location_id, return_quantity, rate, discount_percentage, tax_percentage, line_amount
    - Create `branch_orders` table with columns: id, order_number (UNIQUE), from_location_id, to_location_id, requesting_branch, request_type, request_date, status ENUM('created','approved','in_transit','received'), remarks, created_by, approved_by, approved_at, dispatched_at, received_at, received_by, created_at, updated_at
    - Create `branch_order_line_items` table with columns: id, branch_order_id, item_master_id, requested_quantity, approved_quantity, received_quantity, variance
    - Create `in_transit_stock` table with columns: id, branch_order_id, branch_order_line_id, item_master_id, from_location_id, to_location_id, quantity, dispatched_at
    - Add foreign keys, indexes as defined in design document
    - ALTER `stock_movements` to extend movement_type ENUM with 'batch_in', 'return_out', 'transfer_out', 'transfer_in', 'consumption'
    - ALTER `stock_movements` to extend reference_type ENUM with 'batch', 'purchase_return', 'branch_order'
    - ALTER `stock_movements` to add `batch_id VARCHAR(36) NULL` column
    - Use idempotent `CREATE TABLE IF NOT EXISTS` pattern
    - Register migration in `package.json` migrate script
    - _Requirements: 1.1, 1.3, 6.1_

- [x] 2. Batch service — auto-generation on GRN completion
  - [x] 2.1 Create batch service module
    - Create `backend/src/modules/inventory/batch.service.js`
    - Implement `generateBatchNumber(itemCode, locationCode, date, conn)` — format: `{ItemCode}-{LocationCode}-{YYYYMMDD}-{Seq}`, retry on collision (max 10 retries)
    - Implement `generateBatchesFromGrn(grnPayload, conn)` — event handler that creates one batch per accepted GRN line item
    - Set `qty_available = accepted_quantity` from GRN line item
    - Derive `rate` from PO line item unit_price linked through GRN line item chain
    - Record stock_movement of type 'batch_in' for each batch created
    - Implement `getBatches(filters, conn)` — query with filters (item_code, location_id, batch_number, include_exhausted)
    - Implement `getBatchById(batchId, conn)` — fetch single batch with item and location details
    - Implement `consumeFromBatch(batchId, quantity, reference, actorId, conn)` — reduce qty_available, mark exhausted if zero, reduce inventory_stock
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.2, 6.4_

  - [x] 2.2 Register GRN_COMPLETED event listener
    - Modify `backend/src/modules/inventory/` to subscribe to `GRN_COMPLETED` event via existing eventBus
    - Call `generateBatchesFromGrn` within a transaction when event fires
    - Handle errors gracefully (log warning, do not block GRN completion)
    - _Requirements: 1.1, 6.3_

  - [ ]* 2.3 Write property tests for batch number generation and initialization
    - **Property 1: Batch Number Format Validity** — generate random item codes, location codes, and dates; verify format matches `^[A-Z0-9]+-[A-Z0-9]+-\d{8}-\d{3}$`
    - **Property 2: Batch Initialization Correctness** — verify qty_available equals accepted_quantity and rate equals PO unit_price
    - **Property 9: Batch Exhaustion Status** — verify status transitions to 'exhausted' when qty_available reaches zero
    - Install `fast-check` as dev dependency
    - **Validates: Requirements 1.2, 1.4, 1.5, 1.6, 6.4**

- [x] 3. Batch routes — API endpoints
  - [x] 3.1 Create batch routes file
    - Create `backend/src/modules/inventory/batch.routes.js`
    - Implement `GET /api/inventory/batches` — list batches with query filters (item_code, batch_number, location_id, include_exhausted)
    - Implement `GET /api/inventory/batches/:id` — get single batch detail
    - Implement `POST /api/inventory/batches/consume` — consume stock from a specific batch (requires batch_id, quantity, reference)
    - Apply `authenticate` middleware to all routes
    - Register routes in `backend/src/app.js`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 6.2_

  - [ ]* 3.2 Write property test for batch view filtering
    - **Property 11: Batch View Filtering Correctness** — generate random batch datasets and filter queries; verify returned results match filter criteria and exhausted batches excluded when include_exhausted is false
    - **Validates: Requirements 3.3, 3.4**

- [x] 4. Checkpoint - Batch generation and view working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Purchase return service
  - [x] 5.1 Create purchase return service module
    - Create `backend/src/modules/inventory/purchaseReturn.service.js`
    - Implement `generateReturnNumber(conn)` — format: `PR-RET-{6-digit zero-padded sequence}`
    - Implement `calculateLineAmount(qty, rate, discountPct, taxPct)` — pure function: `(qty * rate) * (1 - discount/100) * (1 + tax/100)`
    - Implement `createPurchaseReturn(input, actorId, conn)` — creates draft return with header and line items; validates batch availability (reject if return_quantity > qty_available or qty_available = 0)
    - Implement `updatePurchaseReturn(returnId, input, actorId, conn)` — updates draft return; rejects if not in draft status
    - Implement `confirmPurchaseReturn(returnId, actorId, conn)` — transitions to confirmed; reduces batch qty_available, reduces inventory_stock quantity_on_hand, records stock_movements of type 'return_out', marks batches exhausted if qty reaches zero
    - Implement `getPurchaseReturns(filters, conn)` — list with filters (status, vendor, date range)
    - Implement `getPurchaseReturnById(returnId, conn)` — fetch with line items and batch details
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 5.2 Write property tests for purchase return logic
    - **Property 3: Amount Calculation Formula** — generate random (qty, rate, discount, tax) tuples; verify formula `(qty * rate) * (1 - discount/100) * (1 + tax/100)`
    - **Property 4: Return Quantity Validation** — generate random (qty_available, return_quantity) pairs; verify rejection when return > available or available = 0
    - **Property 5: Return Confirmation Inventory Adjustment** — generate random batch states and return quantities; verify correct stock reductions after confirmation
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

- [x] 6. Purchase return routes — API endpoints
  - [x] 6.1 Create purchase return routes file
    - Create `backend/src/modules/inventory/purchaseReturn.routes.js`
    - Implement `GET /api/inventory/purchase-returns` — list with filters
    - Implement `GET /api/inventory/purchase-returns/:id` — get single return with lines
    - Implement `POST /api/inventory/purchase-returns` — create draft return
    - Implement `PUT /api/inventory/purchase-returns/:id` — update draft return
    - Implement `POST /api/inventory/purchase-returns/:id/confirm` — confirm return (triggers inventory adjustments)
    - Implement `GET /api/inventory/purchase-returns/eligible-batches` — get batches eligible for return with filters (grn_date_from, grn_date_to, batch_number, vendor_id)
    - Apply `authenticate` middleware to all routes
    - Register routes in `backend/src/app.js`
    - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.3, 7.4_

- [x] 7. Checkpoint - Purchase returns backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Branch order service
  - [x] 8.1 Create branch order service module
    - Create `backend/src/modules/inventory/branchOrder.service.js`
    - Implement `createBranchOrder(input, actorId, conn)` — creates order request; validates stock availability at source location; rejects if from/to locations are the same
    - Implement `approveBranchOrder(orderId, actorId, conn)` — transitions to approved; reduces source inventory_stock quantity_on_hand; creates in-transit stock records
    - Implement `dispatchBranchOrder(orderId, actorId, conn)` — transitions to in_transit; records stock_movement of type 'transfer_out' at from_location
    - Implement `receiveBranchOrder(orderId, receivedLines, actorId, conn)` — transitions to received; increases destination inventory_stock; removes in-transit records; records stock_movement of type 'transfer_in'; calculates and stores variance if received ≠ approved
    - Implement `getBranchOrders(filters, conn)` — list with filters (status, from/to location, date)
    - Implement `getBranchOrderById(orderId, conn)` — fetch with line items
    - Implement `getAvailableStockAtLocation(locationId, conn)` — returns stock per item at a location
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 8.2 Write property tests for branch order logic
    - **Property 6: Transfer Lifecycle Stock Conservation** — generate random transfer scenarios; verify total quantity across all locations (source + destination + in-transit) remains constant
    - **Property 7: Stock Movement Audit Trail Completeness** — verify each inventory-modifying operation creates exactly one stock_movement per line with correct type and quantity
    - **Property 10: Transfer Variance Detection** — generate random approved/received quantity pairs; verify variance = received - approved when they differ
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5, 5.7**

- [x] 9. Branch order routes — API endpoints
  - [x] 9.1 Create branch order routes file
    - Create `backend/src/modules/inventory/branchOrder.routes.js`
    - Implement `GET /api/inventory/branch-orders` — list with filters
    - Implement `GET /api/inventory/branch-orders/:id` — get single order with lines
    - Implement `POST /api/inventory/branch-orders` — create order request
    - Implement `POST /api/inventory/branch-orders/:id/approve` — approve order
    - Implement `POST /api/inventory/branch-orders/:id/dispatch` — mark as dispatched/in-transit
    - Implement `POST /api/inventory/branch-orders/:id/receive` — confirm receipt with received quantities
    - Implement `GET /api/inventory/branch-orders/available-stock/:locationId` — get available stock at a location
    - Apply `authenticate` middleware to all routes
    - Register routes in `backend/src/app.js`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.4_

- [x] 10. Checkpoint - All backend services and routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Cross-cutting property test — batch-inventory invariant
  - [ ]* 11.1 Write property test for batch-inventory consistency
    - Create `backend/src/modules/inventory/inventory.properties.test.js`
    - **Property 8: Batch-Inventory Consistency Invariant** — generate random sequences of operations (batch creation, consumption, return, transfer); verify sum of qty_available across all non-exhausted batches for an item/location equals inventory_stock.quantity_on_hand
    - **Validates: Requirements 6.5**

- [x] 12. Frontend — Batch Inventory View page
  - [x] 12.1 Create BatchInventory page component
    - Create `frontend/src/pages/BatchInventory.jsx`
    - Table displaying batch records with columns: Item Code, Item Name, Batch Number, Location, Qty Available, Rate, Discount %, Tax %, Total Amount
    - Filters: item_code (text input), batch_number (text input), location (dropdown from warehouses API)
    - Toggle: "Show Exhausted Batches" (default off)
    - Calculate and display total_amount per batch as `(qty_available × rate) × (1 - discount/100) × (1 + tax/100)`
    - Call `GET /api/inventory/batches` with filter params
    - Use Ant Design `Table`, `Input`, `Select`, `Switch` components
    - Add route and menu entry for the page
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 13. Frontend — Purchase Returns page
  - [x] 13.1 Create PurchaseReturns list page component
    - Create `frontend/src/pages/PurchaseReturns.jsx`
    - List view with status tags (draft/confirmed/closed) using Ant Design `Tag`
    - Filters: status dropdown, vendor dropdown, date range picker
    - Call `GET /api/inventory/purchase-returns` with filter params
    - Add "Create Return" button linking to create form
    - Add route and menu entry for the page
    - _Requirements: 2.1, 7.2_

  - [x] 13.2 Create PurchaseReturn form component (create/edit)
    - Create `frontend/src/pages/PurchaseReturnForm.jsx`
    - Header fields: vendor selector, GRN selector (filtered by vendor), ASN number (read-only from GRN), return_date picker, return_reason textarea
    - Dynamic line items table with columns: Item, Batch (searchable dropdown from eligible-batches API), Location, Quantity, Rate, Discount %, Tax %, Line Amount (auto-calculated)
    - Batch picker filters by GRN date range and vendor
    - Auto-calculate line amounts and invoice total (sum of lines + round_off)
    - Round-off input field
    - Save as draft (POST/PUT) and Confirm action with confirmation modal (POST confirm)
    - Disable editing when status is not 'draft'
    - Use Ant Design `Form`, `Table`, `Select`, `InputNumber`, `DatePicker`, `Modal`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.3_

- [x] 14. Frontend — Branch Orders page
  - [x] 14.1 Create BranchOrders list page component
    - Create `frontend/src/pages/BranchOrders.jsx`
    - List view with status lifecycle badges (created/approved/in_transit/received) using Ant Design `Tag`
    - Filters: status dropdown, from/to location dropdowns, date range
    - Call `GET /api/inventory/branch-orders` with filter params
    - Add "Create Branch Order" button linking to create form
    - Add route and menu entry for the page
    - _Requirements: 4.5_

  - [x] 14.2 Create BranchOrder form and lifecycle actions
    - Create `frontend/src/pages/BranchOrderForm.jsx`
    - Create form: from_location selector, to_location selector (must differ from source), request_type dropdown (from sub-master), request_date picker, remarks textarea
    - Line items table: item selector, requested_quantity input, available stock display (from available-stock API for from_location)
    - Validate requested_quantity does not exceed available stock (client-side)
    - Status progression action buttons: Approve, Dispatch, Receive (shown based on current status)
    - Receive form: editable table allowing entry of actual received quantities per line
    - Display variance after receipt (received vs approved)
    - Use Ant Design `Form`, `Table`, `Select`, `InputNumber`, `DatePicker`, `Button`, `Modal`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.4, 5.7_

- [x] 15. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The migration is additive-only — no existing columns or tables are dropped
- `fast-check` must be installed as a dev dependency before running property tests
- The event-driven batch creation integrates with the existing `eventBus` pattern used by GRN stock receipt
- All multi-table operations use MySQL transactions via `connection.beginTransaction()` / `commit()` / `rollback()`
- Stock movement ENUM extension is backward-compatible with existing 'in' and 'out' types
- Branch order `request_type` values come from the existing sub-master/dropdown framework

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "8.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "5.1", "9.1"] },
    { "id": 3, "tasks": ["3.2", "5.2", "6.1", "8.2"] },
    { "id": 4, "tasks": ["11.1", "12.1", "13.1", "14.1"] },
    { "id": 5, "tasks": ["13.2", "14.2"] }
  ]
}
```
