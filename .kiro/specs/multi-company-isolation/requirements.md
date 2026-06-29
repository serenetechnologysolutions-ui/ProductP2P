# Requirements Document

## Introduction

Multi-Company Isolation enforces strict data boundaries within ProcureTrack so that each company's procurement transactions, vendors, cost centres, and master data are visible only to users explicitly mapped to that company. The feature also enriches company master data with statutory fields (CIN, PAN, certificate), relocates company management from System Admin to MDM Admin, introduces vendor-company mapping, and adds an RFQ Comparison-to-PO conversion shortcut.

## Glossary

- **System**: The ProcureTrack application (backend API + frontend UI)
- **MDM_Admin**: Master Data Management Administrator role — manages company records, vendor lifecycle, and master data for mapped companies
- **Procurement_Admin**: Procurement Administrator role — creates and manages PRs, POs, RFQs, and inventory for mapped companies
- **System_Admin**: System Administrator role — manages platform configuration, users, and settings; unrestricted by company boundaries
- **Company_Master**: The `company_master` database table representing a legal entity within the organization
- **User_Company_Access**: The `user_company_access` junction table mapping users to companies they may operate on
- **Vendor_Company_Mapping**: A new junction table mapping vendors to companies they serve
- **Cost_Centre**: A sub-master record representing a department cost allocation unit, scoped to a specific company
- **Inactive_Company**: A company record with `is_active = false` whose linked transactional data becomes read-only
- **RFQ_Comparison**: The pricing comparison page where bids are evaluated across vendors for an RFQ

## Requirements

### Requirement 1: Company Management Role Transfer

**User Story:** As an MDM Admin, I want to manage company records (create, edit, inactivate) so that company master data governance is centralised under my role instead of requiring System Admin intervention.

#### Acceptance Criteria

1. THE System SHALL restrict company creation, editing, and inactivation endpoints to MDM_Admin and System_Admin roles only.
2. WHEN a Procurement_Admin attempts to create, edit, or inactivate a company record, THE System SHALL reject the request with a 403 Forbidden response.
3. WHEN an MDM_Admin is mapped to one or more companies via User_Company_Access, THE System SHALL allow that MDM_Admin to edit or inactivate only the companies to which the MDM_Admin is mapped.
4. THE System SHALL allow System_Admin to manage all company records regardless of User_Company_Access mappings.

### Requirement 2: Company Master Data Enrichment

**User Story:** As an MDM Admin, I want to record statutory details (CIN, PAN, certificate, address) on a company so that compliance documentation is captured and available for printed documents.

#### Acceptance Criteria

1. THE System SHALL store the following additional fields on Company_Master: CIN (Corporate Identity Number, alphanumeric up to 21 characters), PAN (Permanent Account Number, alphanumeric exactly 10 characters), certificate file attachment (single file upload), company address (text), city (text up to 100 characters), state (text up to 100 characters), and PIN code (numeric exactly 6 digits).
2. WHEN an MDM_Admin submits a company form with a PAN value that does not match the 10-character alphanumeric format, THE System SHALL reject the submission with a validation error identifying the PAN field.
3. WHEN an MDM_Admin submits a company form with a PIN code that does not match the 6-digit numeric format, THE System SHALL reject the submission with a validation error identifying the PIN code field.
4. WHEN an MDM_Admin uploads a certificate attachment, THE System SHALL accept files of type PDF, PNG, or JPEG with a maximum size of 5 MB.

### Requirement 3: Company Details on Printed Documents

**User Story:** As a Procurement Admin, I want PR and PO PDF exports to include the issuing company's details so that printed procurement documents identify the legal entity.

#### Acceptance Criteria

1. WHEN a PR PDF is generated and the PR has an associated company_id, THE System SHALL include in the PDF header the company name, address, city, state, PIN code, CIN, PAN, and GSTIN from Company_Master.
2. WHEN a PO PDF is generated and the PO has an associated company_id, THE System SHALL include in the PDF header the company name, address, city, state, PIN code, CIN, PAN, and GSTIN from Company_Master.
3. IF a PR or PO has no associated company_id, THEN THE System SHALL generate the PDF without a company details section.

### Requirement 4: Company Inactivation

**User Story:** As an MDM Admin, I want to inactivate a company so that no new transactions are created for that company while historical data remains accessible.

#### Acceptance Criteria

1. WHEN an MDM_Admin sets a company's is_active flag to false, THE System SHALL mark the company as inactive in Company_Master.
2. WHILE a company is inactive, THE System SHALL reject creation of new Purchase Requisitions, Purchase Orders, RFQs, and ASNs with that company's ID, returning a 400 error stating the company is inactive.
3. WHILE a company is inactive, THE System SHALL display all linked transactional records (PRs, POs, RFQs, ASNs) as read-only with a visible "Inactive Company" badge in the UI.
4. WHILE a company is inactive, THE System SHALL exclude that company from the company selection dropdown on PR, PO, and RFQ creation forms.
5. WHEN a user views the company list, THE System SHALL display inactive companies with a visual indicator distinguishing them from active companies.

### Requirement 5: Company-wise Cost Centre Filtering

**User Story:** As a Procurement Admin, I want the cost centre dropdown to show only cost centres belonging to the selected company so that I cannot accidentally assign a cost centre from a different company.

#### Acceptance Criteria

1. WHEN a user selects a company on the PR creation or edit form, THE System SHALL populate the cost centre dropdown exclusively with Cost_Centre records associated with that selected company.
2. WHEN no company is selected on the PR form, THE System SHALL display an empty cost centre dropdown with a prompt to select a company first.
3. THE System SHALL associate each Cost_Centre record with exactly one company via a company_id foreign key.

### Requirement 6: User-Company Access Mapping

**User Story:** As a System Admin, I want to map Procurement Admins and MDM Admins to one or more companies so that each user operates only within assigned company boundaries.

#### Acceptance Criteria

1. THE System SHALL support many-to-many mapping between users (Procurement_Admin and MDM_Admin roles) and companies via the User_Company_Access table.
2. WHEN a System_Admin assigns a company to a user, THE System SHALL create a User_Company_Access record linking that user to the specified company.
3. WHEN a System_Admin removes a company mapping from a user, THE System SHALL delete the corresponding User_Company_Access record.
4. THE System SHALL allow multiple companies to be mapped to a single user.
5. THE System SHALL allow multiple users to be mapped to a single company.
6. THE System SHALL enforce that System_Admin remains unrestricted by company mappings across all modules.

### Requirement 7: Vendor-Company Mapping

**User Story:** As an MDM Admin, I want to map vendors to specific companies so that each company sees only the vendors that serve them.

#### Acceptance Criteria

1. THE System SHALL store vendor-to-company relationships in a Vendor_Company_Mapping junction table with vendor_id and company_id foreign keys.
2. THE System SHALL support many-to-many relationships between vendors and companies (one vendor mapped to multiple companies, one company mapped to multiple vendors).
3. WHEN an MDM_Admin creates or edits a vendor-company mapping, THE System SHALL validate that both the vendor and company exist and are active.
4. WHEN a user queries the vendor list, THE System SHALL filter results to show only vendors mapped to companies the requesting user has access to via User_Company_Access.
5. WHEN a System_Admin queries the vendor list, THE System SHALL return all vendors regardless of Vendor_Company_Mapping.

### Requirement 8: PR Company Isolation

**User Story:** As a Procurement Admin, I want to create PRs only for companies I am mapped to so that procurement requests are properly scoped to my authorised companies.

#### Acceptance Criteria

1. WHEN a Procurement_Admin creates a PR, THE System SHALL restrict the company selection dropdown to companies the Procurement_Admin is mapped to via User_Company_Access.
2. WHEN a Procurement_Admin submits a PR with a company_id not present in the Procurement_Admin's User_Company_Access records, THE System SHALL reject the submission with a 403 Forbidden response.
3. WHEN a Procurement_Admin views the PR list, THE System SHALL display only PRs whose company_id matches one of the Procurement_Admin's mapped companies.
4. WHEN a System_Admin views the PR list, THE System SHALL display all PRs regardless of company_id.

### Requirement 9: PO Company Isolation

**User Story:** As a Procurement Admin, I want to create POs only for my mapped companies and see only vendors available to those companies so that purchasing is properly isolated.

#### Acceptance Criteria

1. WHEN a Procurement_Admin creates a PO, THE System SHALL restrict the company selection dropdown to companies the Procurement_Admin is mapped to via User_Company_Access.
2. WHEN a Procurement_Admin selects a company on the PO form, THE System SHALL populate the vendor dropdown exclusively with vendors mapped to that company via Vendor_Company_Mapping.
3. WHEN a Procurement_Admin submits a PO with a company_id not present in the Procurement_Admin's User_Company_Access records, THE System SHALL reject the submission with a 403 Forbidden response.
4. WHEN a Procurement_Admin views the PO list, THE System SHALL display only POs whose company_id matches one of the Procurement_Admin's mapped companies.
5. WHEN a System_Admin views the PO list, THE System SHALL display all POs regardless of company_id.

### Requirement 10: Application-wide Company Filtering

**User Story:** As a Procurement Admin, I want all procurement modules (RFQ, ASN, Inventory) filtered by my company access so that I see only data relevant to my assigned companies.

#### Acceptance Criteria

1. WHEN a Procurement_Admin views RFQ records, THE System SHALL display only RFQs whose company_id matches one of the Procurement_Admin's mapped companies.
2. WHEN a Procurement_Admin views ASN records, THE System SHALL display only ASNs whose company_id matches one of the Procurement_Admin's mapped companies.
3. WHEN a Procurement_Admin views Inventory records, THE System SHALL display only inventory associated with companies the Procurement_Admin is mapped to.
4. WHEN a System_Admin views any module's records, THE System SHALL display all records regardless of company_id.
5. WHEN an MDM_Admin views vendor or master data records, THE System SHALL display only records associated with companies the MDM_Admin is mapped to via User_Company_Access.

### Requirement 11: MDM Admin Company-scoped Master Data

**User Story:** As an MDM Admin, I want to manage master data (vendors, items, sub-masters) scoped to my mapped companies so that master data governance respects company boundaries.

#### Acceptance Criteria

1. WHEN an MDM_Admin is mapped to specific companies, THE System SHALL restrict vendor management (create, edit, approve) to vendors mapped to those companies via Vendor_Company_Mapping.
2. WHEN an MDM_Admin creates a new vendor, THE System SHALL require at least one company mapping from the MDM_Admin's accessible companies.
3. WHEN an MDM_Admin views the vendor list, THE System SHALL display only vendors that have at least one Vendor_Company_Mapping to a company the MDM_Admin is mapped to.
4. WHEN a System_Admin manages master data, THE System SHALL allow unrestricted access to all records regardless of company mappings.

### Requirement 12: Inventory Module Role Reassignment

**User Story:** As a Procurement Admin, I want to access the Inventory module under my role so that inventory management is consolidated with other procurement activities.

#### Acceptance Criteria

1. THE System SHALL grant Procurement_Admin role access to all Inventory module endpoints (warehouses, stock, stock movements).
2. THE System SHALL remove exclusive System_Admin restriction from Inventory module access, allowing Procurement_Admin access alongside System_Admin.
3. WHEN a Procurement_Admin accesses Inventory endpoints, THE System SHALL filter inventory data by the Procurement_Admin's mapped companies.
4. THE System SHALL render the Inventory menu item under the Procurement Admin sidebar section in the frontend navigation.

### Requirement 13: RFQ Comparison to PO Conversion

**User Story:** As a Procurement Admin, I want to create a PO directly from the RFQ comparison page so that I can quickly convert an awarded bid into a purchase order without re-entering data.

#### Acceptance Criteria

1. WHEN an RFQ has at least one awarded vendor on the comparison page, THE System SHALL display a "Create PO" button for that vendor's awarded bid.
2. WHEN a Procurement_Admin clicks the "Create PO" button on the RFQ comparison page, THE System SHALL create a draft PO pre-filled with the RFQ's company_id, the awarded vendor, line items with awarded quantities and bid prices, and payment terms from the winning bid.
3. WHEN the draft PO is created from the RFQ comparison page, THE System SHALL navigate the user to the PO detail page for review and final submission.
4. IF the awarded vendor is not mapped to the RFQ's company via Vendor_Company_Mapping, THEN THE System SHALL reject PO creation with an error indicating the vendor is not available for the selected company.
5. WHEN a PO is created from the RFQ comparison page, THE System SHALL link the PO to the source RFQ via the existing rfq_id reference field.
