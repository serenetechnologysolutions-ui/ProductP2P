# Requirements Document

## Introduction

This feature introduces company-scoped item master management for the ProcureTrack P2P system. It enables MDM administrators to bulk-import and export item master data via Excel files, enforces a many-to-many relationship between items and companies through a junction table, restricts item visibility to users of mapped companies, and adds multi-company assignment during user creation.

## Glossary

- **System**: The ProcureTrack P2P backend application (Node.js/Express)
- **Item_Master**: The database table storing master item records (item_code, item_description, uom, category, etc.)
- **Item_Company_Mapping**: A junction table establishing a many-to-many relationship between item_master and company_master
- **MDM_Admin**: A user with the role `mdm_admin` who manages master data; scoped to assigned companies
- **System_Admin**: A user with the role `system_admin` who has unrestricted access across all companies
- **User_Company_Access**: The existing table that maps users to their permitted companies
- **Company_Master**: The table containing company definitions
- **CompanySelector**: The existing React/Ant Design frontend component for selecting companies
- **ResolveCompanyAccess**: The existing Express middleware that attaches the user's accessible company IDs to `req.companyIds`
- **Import_Summary**: A response object reporting total rows processed, rows successfully imported, rows skipped, and per-row error details
- **Excel_File**: A `.xlsx` workbook file conforming to the expected template columns

## Requirements

### Requirement 1: Item Excel Import

**User Story:** As an MDM_Admin, I want to bulk-import items from an Excel file into item_master, so that I can onboard large catalogs without manual entry.

#### Acceptance Criteria

1. WHEN an MDM_Admin uploads an Excel_File to the import endpoint, THE System SHALL parse each row and validate that required fields (item_code, item_description) are present and non-empty.
2. WHEN a row contains a valid item_code that does not already exist in Item_Master, THE System SHALL insert the row as a new active item record.
3. WHEN a row contains an item_code that already exists in Item_Master, THE System SHALL skip that row and record a duplicate error in the Import_Summary.
4. WHEN a row is missing required fields or contains invalid data, THE System SHALL skip that row and record a validation error with the row number in the Import_Summary.
5. WHEN the file processing completes, THE System SHALL return an Import_Summary containing total_rows, successful_count, skipped_count, and an errors array with row-level details.
6. WHEN a non-MDM_Admin or non-System_Admin user attempts to access the import endpoint, THE System SHALL reject the request with a 403 Forbidden response.
7. THE System SHALL use the xlsx package to parse the uploaded Excel_File.

### Requirement 2: Item Excel Export

**User Story:** As an MDM_Admin, I want to export item_master data to an Excel file, so that I can review items offline or share with stakeholders.

#### Acceptance Criteria

1. WHEN an MDM_Admin requests an export of item_master data, THE System SHALL generate a .xlsx file containing all active items visible to that user.
2. WHILE an MDM_Admin is scoped to specific companies, THE System SHALL include only items that are mapped to the MDM_Admin's accessible companies in the exported file.
3. WHILE a System_Admin requests the export, THE System SHALL include all active items regardless of company mapping.
4. THE System SHALL set the response Content-Type to `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and include a Content-Disposition header for file download.
5. THE System SHALL use the xlsx package to generate the Excel_File.

### Requirement 3: Item-Company Mapping

**User Story:** As an MDM_Admin, I want items to be associated with one or more companies, so that each company sees only its relevant catalog.

#### Acceptance Criteria

1. THE System SHALL store item-to-company relationships in the Item_Company_Mapping junction table with columns: id (UUID primary key), item_id (foreign key to item_master), company_id (foreign key to company_master), and created_at timestamp.
2. THE System SHALL enforce a unique constraint on the combination of item_id and company_id in Item_Company_Mapping.
3. WHEN an MDM_Admin creates or imports an item, THE System SHALL accept an array of company_ids and create corresponding Item_Company_Mapping records.
4. WHEN an MDM_Admin updates an item's company mappings, THE System SHALL replace the existing mappings with the new set atomically within a transaction.
5. WHEN an MDM_Admin queries the item list, THE System SHALL return only items that have at least one Item_Company_Mapping record matching the MDM_Admin's accessible companies.
6. WHILE a System_Admin queries the item list, THE System SHALL return all active items regardless of company mapping.

### Requirement 4: User Company Assignment During Creation

**User Story:** As a System_Admin or MDM_Admin, I want to assign one or more companies to a user at creation time, so that the user's access scope is set from the start.

#### Acceptance Criteria

1. WHEN a POST /api/users request includes a company_ids array, THE System SHALL create User_Company_Access records for each company_id in the array.
2. WHEN the user creation and company assignment are processed, THE System SHALL execute both operations within a single database transaction so that either all records are created or none are persisted.
3. IF the company_ids array contains a company_id that does not exist in Company_Master, THEN THE System SHALL reject the request with a 400 validation error.
4. IF the company_ids array is empty or not provided, THEN THE System SHALL create the user without any company access records.
5. WHEN updating a user (PUT /api/users/:id), THE System SHALL support updating the company_ids by replacing existing User_Company_Access records for that user atomically.

### Requirement 5: MDM Admin Scoped Company Dropdowns

**User Story:** As an MDM_Admin, I want company dropdowns to show only my assigned companies, so that I cannot accidentally select a company outside my scope.

#### Acceptance Criteria

1. WHILE an MDM_Admin is logged in, THE System SHALL filter the GET /api/companies response to include only companies present in the MDM_Admin's User_Company_Access records.
2. WHILE a System_Admin is logged in, THE System SHALL return all companies from the GET /api/companies endpoint without filtering.
3. THE System SHALL apply the ResolveCompanyAccess middleware to the GET /api/companies endpoint to determine the user's accessible company set.
4. THE CompanySelector component SHALL display only the companies returned by the filtered GET /api/companies endpoint without additional client-side filtering logic.
