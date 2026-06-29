# Requirements Document

## Introduction

This feature establishes a centralized HSN (Harmonized System of Nomenclature) code master within the existing `sub_masters` table, each record carrying a tax percentage. When creating or amending a Purchase Order, line item HSN selection changes from free-text input to a searchable dropdown populated from the HSN master. Selecting an HSN code auto-fills the corresponding tax percentage, reducing manual data-entry errors and ensuring tax consistency across all Purchase Orders.

## Glossary

- **System**: The ProcureTrack P2P application (backend API + frontend SPA)
- **Sub_Masters_Table**: The existing `sub_masters` MySQL table that stores reference/lookup data by category
- **HSN_Master**: Records in Sub_Masters_Table where category = 'hsn_code', representing the centralized HSN code registry
- **Tax_Percentage**: A DECIMAL(5,2) column on Sub_Masters_Table storing the GST/tax rate associated with an HSN code
- **SubMasterTab**: The reusable React component that renders CRUD UI for a given sub_masters category
- **PO_Line_Item_Form**: The Purchase Order line item entry form in the frontend, containing description, HSN, quantity, price, and tax fields
- **HSN_Dropdown**: A searchable Select component populated from HSN_Master records, replacing the previous free-text HSN input on PO_Line_Item_Form
- **Admin_User**: A user with role mdm_admin or system_admin who can manage sub_masters data

## Requirements

### Requirement 1: Schema Extension for Tax Percentage

**User Story:** As an Admin_User, I want each sub_masters record to optionally carry a tax percentage, so that HSN codes can store their associated tax rate directly in the master data.

#### Acceptance Criteria

1. THE System SHALL add a nullable column `tax_percentage DECIMAL(5,2)` to Sub_Masters_Table via an idempotent migration script.
2. WHEN the migration executes on a database that already contains the `tax_percentage` column, THE System SHALL skip the alteration without error.
3. THE System SHALL preserve all existing Sub_Masters_Table data unchanged after the migration completes.

### Requirement 2: HSN Code Master CRUD

**User Story:** As an Admin_User, I want to create, read, update, and deactivate HSN code records with an associated tax percentage, so that procurement teams have a single source of truth for HSN-to-tax mappings.

#### Acceptance Criteria

1. WHEN an Admin_User creates a sub_masters record with category 'hsn_code', THE System SHALL accept a `tax_percentage` value between 0.00 and 100.00 and persist it in the `tax_percentage` column.
2. WHEN an Admin_User updates a sub_masters record with category 'hsn_code', THE System SHALL allow modification of the `tax_percentage` value.
3. WHEN the GET /api/sub-masters/hsn_code endpoint is called, THE System SHALL return all active HSN_Master records including the `tax_percentage` field in each response object.
4. THE System SHALL store HSN_Master records with company_id as NULL, making HSN codes global and not scoped to any company.
5. IF an Admin_User submits a `tax_percentage` value less than 0 or greater than 100, THEN THE System SHALL reject the request with a validation error message.

### Requirement 3: SubMasterTab Enhancement for HSN Category

**User Story:** As an Admin_User, I want the SubMasterTab UI to display a tax percentage input field when managing the hsn_code category, so that I can maintain HSN-to-tax mappings from the existing admin interface.

#### Acceptance Criteria

1. WHILE the SubMasterTab component renders for category 'hsn_code', THE System SHALL display an additional numeric input field labeled "Tax %" in the add/edit form.
2. WHILE the SubMasterTab component renders for category 'hsn_code', THE System SHALL display a "Tax %" column in the data table showing each record's tax_percentage value.
3. WHEN an Admin_User submits the hsn_code add/edit form, THE System SHALL include the tax_percentage value in the API payload sent to the backend.
4. WHILE the SubMasterTab component renders for any category other than 'hsn_code', THE System SHALL hide the tax percentage input field and table column.

### Requirement 4: PO Line Item HSN Dropdown

**User Story:** As a procurement user, I want to select HSN codes from a searchable dropdown when creating or amending a Purchase Order, so that I can quickly find the correct HSN code without manual entry.

#### Acceptance Criteria

1. WHEN the PO_Line_Item_Form renders, THE System SHALL display an HSN_Dropdown component populated with all active HSN_Master records.
2. THE HSN_Dropdown SHALL support search/filter by HSN code name or code value as the user types.
3. WHEN a user selects an HSN code from HSN_Dropdown, THE System SHALL populate the line item's `hsn_sac` field with the selected record's code (the numeric HSN code value).
4. WHEN a user clears the HSN_Dropdown selection, THE System SHALL clear both the `hsn_sac` and auto-filled `tax_percent` values for that line item.

### Requirement 5: Tax Percentage Auto-Fill on HSN Selection

**User Story:** As a procurement user, I want the tax percentage to auto-fill when I select an HSN code, so that I do not need to manually look up and enter the tax rate for each line item.

#### Acceptance Criteria

1. WHEN a user selects an HSN code from HSN_Dropdown, THE System SHALL auto-fill the line item's `tax_percent` field with the selected HSN_Master record's `tax_percentage` value.
2. WHEN the tax_percent field is auto-filled from HSN selection, THE System SHALL allow the user to manually override the auto-filled value.
3. WHEN the tax_percent value changes (via auto-fill or manual override), THE System SHALL recalculate the line item's tax_amount and total_line_amount in real time.

### Requirement 6: HSN Master Data API Endpoint

**User Story:** As a frontend developer, I want a dedicated endpoint to fetch HSN codes with their tax percentages, so that the PO form dropdown can be populated efficiently.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/sub-masters/hsn_code, THE System SHALL return all active records where category = 'hsn_code' ordered by name.
2. THE System SHALL include `id`, `name`, `code`, and `tax_percentage` fields in each returned HSN_Master record.
3. WHEN no active HSN_Master records exist, THE System SHALL return an empty array with a success response.

### Requirement 7: PO Creation and Amendment Compatibility

**User Story:** As a procurement user, I want HSN selection to work seamlessly with both new PO creation and PO amendment workflows, so that tax mapping is consistent regardless of the PO lifecycle stage.

#### Acceptance Criteria

1. WHEN a new Purchase Order is created with line items containing HSN codes selected from HSN_Dropdown, THE System SHALL persist the `hsn_sac` and `tax_percent` values to po_line_items as it does today.
2. WHEN an existing Purchase Order is opened for amendment, THE System SHALL pre-populate the HSN_Dropdown with the currently stored `hsn_sac` value for each line item.
3. THE System SHALL continue to validate HSN/SAC format (4, 6, or 8 digits) on the backend via the existing `validateGstHsn` function regardless of whether the value came from HSN_Dropdown or manual entry.
