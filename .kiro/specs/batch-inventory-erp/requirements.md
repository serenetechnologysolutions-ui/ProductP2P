# Requirements Document

## Introduction

This feature introduces ERP-grade batch management and inventory expansion to ProcureTrack's P2P system. The system shifts from simple quantity-based inventory tracking to batch-controlled inventory, enabling full traceability from procurement through to returns and inter-location stock transfers. The feature set comprises: automated batch number generation upon GRN completion, a purchase return module operating at batch level, a batch-wise inventory view, and a branch order request (stock transfer) module for inter-location movement.

## Glossary

- **Batch_Manager**: The backend service responsible for generating, storing, and managing batch records
- **Batch_Number**: A unique identifier assigned to received goods, formatted as ItemCode-Location-YYYYMMDD-Sequence
- **GRN**: Goods Receipt Note — the formal record of what was physically received and inspected
- **Purchase_Return_Module**: The module handling creation and processing of purchase return documents against specific batches
- **Batch_Inventory_View**: The read-only view presenting inventory organized by batch with associated financial details
- **Branch_Order_Module**: The module managing inter-location stock transfer requests and their lifecycle
- **Location**: A warehouse or branch location where inventory is stored (maps to the existing warehouses table)
- **In_Transit_Stock**: Stock that has been dispatched from a source location but not yet received at the destination location
- **Available_Qty**: The quantity in a batch that has not been consumed, returned, or transferred out
- **Return_Invoice**: The financial document generated when goods are returned to a vendor, containing line-level calculations with discount and tax

## Requirements

### Requirement 1: Batch Number Auto-Generation

**User Story:** As a warehouse manager, I want batch numbers to be automatically generated when a GRN is completed, so that every received lot is uniquely identifiable for traceability.

#### Acceptance Criteria

1. WHEN a GRN status transitions to 'completed', THE Batch_Manager SHALL generate one batch record per accepted GRN line item
2. THE Batch_Manager SHALL format each batch number as {ItemCode}-{LocationCode}-{YYYYMMDD}-{SequenceNumber} where SequenceNumber is a zero-padded 3-digit number unique within the same item, location, and date
3. THE Batch_Manager SHALL store for each batch record: batch_number, item_master_id, grn_id, grn_line_item_id, location_id (warehouse_id), qty_received, qty_available, and rate
4. WHEN a batch record is created, THE Batch_Manager SHALL set qty_available equal to the accepted_quantity from the corresponding GRN line item
5. THE Batch_Manager SHALL derive the rate from the PO line item unit price linked through the GRN line item chain (grn_line_item → po_line_item → unit_price)
6. IF a batch number generation fails due to a duplicate sequence, THEN THE Batch_Manager SHALL increment the sequence number and retry until a unique batch number is produced
7. THE Batch_Manager SHALL record a stock_movement entry of type 'batch_in' for each batch created, referencing the batch_id and GRN

### Requirement 2: Purchase Return Creation

**User Story:** As a procurement officer, I want to create purchase returns against specific batches, so that returned goods are accurately tracked at the batch level and a return invoice is generated.

#### Acceptance Criteria

1. THE Purchase_Return_Module SHALL provide filters for GRN date range, batch number, and vendor name to locate eligible batches for return
2. WHEN a purchase return is initiated, THE Purchase_Return_Module SHALL require: vendor_id, grn_id, asn_number (display only), return_date, and return_reason in the header
3. WHEN a line item is added to a purchase return, THE Purchase_Return_Module SHALL require: item_master_id, batch_number, location_id, return_quantity, rate, discount_percentage, and tax_percentage
4. THE Purchase_Return_Module SHALL calculate each line amount as: (return_quantity × rate) minus discount amount, plus tax amount applied on the discounted value
5. THE Purchase_Return_Module SHALL calculate the return invoice total as the sum of all line amounts plus a configurable round-off value
6. IF the return_quantity exceeds the qty_available of the selected batch, THEN THE Purchase_Return_Module SHALL reject the line item with a validation error indicating the maximum returnable quantity
7. THE Purchase_Return_Module SHALL prevent returns against batches where qty_available is zero
8. WHEN a purchase return is confirmed, THE Purchase_Return_Module SHALL reduce the qty_available of each referenced batch by the corresponding return_quantity
9. WHEN a purchase return is confirmed, THE Purchase_Return_Module SHALL reduce the overall inventory_stock quantity_on_hand for the corresponding item and warehouse by the total returned quantity
10. WHEN a purchase return is confirmed, THE Purchase_Return_Module SHALL record a stock_movement entry of type 'return_out' for each returned line item, referencing the purchase_return_id

### Requirement 3: Batch Inventory View

**User Story:** As an inventory controller, I want to view inventory organized by batch with financial details, so that I can assess stock value and availability at the batch level.

#### Acceptance Criteria

1. THE Batch_Inventory_View SHALL display each batch record with: item_code (part number), item_name, batch_number, location_name, qty_available, rate, discount_percentage, tax_percentage, and total_amount
2. THE Batch_Inventory_View SHALL calculate total_amount per batch as: (qty_available × rate) minus discount, plus tax on the discounted value
3. THE Batch_Inventory_View SHALL support filtering by item_code, batch_number, and location
4. THE Batch_Inventory_View SHALL exclude batches where qty_available is zero from the default view
5. WHERE a user enables the show-exhausted-batches option, THE Batch_Inventory_View SHALL include batches with qty_available equal to zero

### Requirement 4: Branch Order Request Creation

**User Story:** As a branch manager, I want to request stock transfers from another location, so that inventory can be redistributed across branches based on demand.

#### Acceptance Criteria

1. WHEN a branch order request is created, THE Branch_Order_Module SHALL require: requesting_branch (current user location), from_location_id, to_location_id, request_type (from sub-master), and request_date
2. THE Branch_Order_Module SHALL display available stock per item at the from_location when adding line items
3. WHEN a line item is added, THE Branch_Order_Module SHALL require: item_master_id and requested_quantity
4. IF the requested_quantity exceeds the available stock at the from_location for the specified item, THEN THE Branch_Order_Module SHALL reject the line item with a validation error
5. THE Branch_Order_Module SHALL assign a status lifecycle of: created → approved → in_transit → received

### Requirement 5: Branch Order Approval and Stock Transfer

**User Story:** As an operations manager, I want approved branch orders to automatically adjust inventory at source and destination locations, so that stock levels remain accurate during transfers.

#### Acceptance Criteria

1. WHEN a branch order request transitions to 'approved' status, THE Branch_Order_Module SHALL reduce the inventory_stock quantity_on_hand at the from_location for each line item by the approved quantity
2. WHEN a branch order request transitions to 'approved' status, THE Branch_Order_Module SHALL create an in-transit stock record for each line item with the approved quantity, from_location, and to_location
3. WHEN a branch order request transitions to 'in_transit' status, THE Branch_Order_Module SHALL record a stock_movement of type 'transfer_out' at the from_location for each line item
4. WHEN a branch order receipt is confirmed (status transitions to 'received'), THE Branch_Order_Module SHALL increase the inventory_stock quantity_on_hand at the to_location for each line item by the received quantity
5. WHEN a branch order receipt is confirmed, THE Branch_Order_Module SHALL remove the corresponding in-transit stock record
6. WHEN a branch order receipt is confirmed, THE Branch_Order_Module SHALL record a stock_movement of type 'transfer_in' at the to_location for each line item
7. IF the received quantity differs from the approved quantity, THEN THE Branch_Order_Module SHALL log a transfer variance record with the difference

### Requirement 6: Batch Integration with Existing Inventory

**User Story:** As a system administrator, I want the batch system integrated with the existing inventory and GRN modules, so that all stock operations reference batch records and full traceability is maintained.

#### Acceptance Criteria

1. THE Batch_Manager SHALL extend the stock_movements table to support movement types: 'batch_in', 'return_out', 'transfer_out', 'transfer_in', and 'consumption' in addition to existing 'in' and 'out' types
2. WHEN stock is consumed via the existing consumption endpoint, THE Batch_Manager SHALL require a batch_id and reduce qty_available on the specified batch in addition to reducing overall inventory_stock
3. THE Batch_Manager SHALL maintain the traceability chain: PR → PO → ASN → GRN → Batch → Inventory → Return/Transfer by storing reference links (grn_id, po_line_id) in each batch record
4. WHEN a batch qty_available reaches zero, THE Batch_Manager SHALL mark the batch status as 'exhausted'
5. THE Batch_Manager SHALL enforce that the sum of qty_available across all batches for a given item and location equals the inventory_stock quantity_on_hand for that item and location

### Requirement 7: Purchase Return Number Generation

**User Story:** As a finance team member, I want each purchase return to have a unique sequential number, so that returns can be tracked and referenced in accounting.

#### Acceptance Criteria

1. THE Purchase_Return_Module SHALL auto-generate a purchase return number in the format PR-RET-{6-digit zero-padded sequence}
2. THE Purchase_Return_Module SHALL assign a status lifecycle of: draft → confirmed → closed
3. WHEN a purchase return is in 'draft' status, THE Purchase_Return_Module SHALL allow edits to header fields and line items
4. WHEN a purchase return transitions to 'confirmed' status, THE Purchase_Return_Module SHALL lock the document from further edits and trigger inventory adjustments
