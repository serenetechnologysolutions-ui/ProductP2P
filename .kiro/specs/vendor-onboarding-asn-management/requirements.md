# Requirements Document

## Introduction

A Vendor Management & Procurement Collaboration Platform that digitizes vendor onboarding through MDM-driven workflows, enables vendor self-service data completion, streamlines ASN (Advance Shipment Notice) creation, validates invoice and PO data, and prepares data for ERP posting. The platform ensures data accuracy, workflow governance, and seamless vendor interaction.

## Glossary

- **MDM_Admin**: Master Data Management administrator with full control to create, edit, and approve vendors
- **Vendor**: External supplier who completes self-onboarding data and creates ASNs
- **Procurement_Admin**: Internal user responsible for ASN validation and approval
- **ASN**: Advance Shipment Notice — a document sent by a vendor to notify of an upcoming shipment
- **PO**: Purchase Order — a document issued to a vendor authorizing a purchase
- **ERP**: Enterprise Resource Planning system for invoice posting
- **Sub_Master**: A configurable lookup list (e.g., Company, Department, City, State)
- **Document_Intelligence_Engine**: Python-based PDF extraction and validation module
- **Vendor_Portal**: Web interface for vendor self-service operations
- **Extraction_Config**: Admin-configurable rules for PDF field extraction (aliases, regex, priority)

## Requirements

### Requirement 1: Vendor Master Data Creation

**User Story:** As an MDM_Admin, I want to create a new vendor record with core master data fields, so that the vendor onboarding process can be initiated.

#### Acceptance Criteria

1. THE MDM_Admin SHALL provide Vendor Name, Email ID, Phone Number, Company Name, Department, Supplier Group, Supplier Category, and Supplier Location when creating a vendor record
2. WHEN any mandatory field is missing, THE System SHALL prevent vendor record creation and display a validation error
3. WHEN a vendor record is successfully created, THE System SHALL store the record with a unique vendor identifier
4. THE System SHALL validate Email ID format before accepting the vendor record

### Requirement 2: Vendor Onboarding Email Trigger

**User Story:** As an MDM_Admin, I want the system to automatically send onboarding credentials to a newly created vendor, so that the vendor can access the portal without manual intervention.

#### Acceptance Criteria

1. WHEN a vendor record is successfully created, THE System SHALL send an email to the vendor's registered Email ID containing a login URL, username (equal to Email ID), and an auto-generated 10-character random password
2. WHEN the onboarding email is triggered, THE System SHALL generate a password containing a mix of uppercase, lowercase, digits, and special characters
3. IF the email delivery fails, THEN THE System SHALL log the failure and allow the MDM_Admin to re-trigger the email

### Requirement 3: Vendor Portal Authentication

**User Story:** As a Vendor, I want to log in to the portal using my credentials, so that I can complete my onboarding data and manage ASNs.

#### Acceptance Criteria

1. WHEN a vendor logs in for the first time, THE System SHALL enforce a password reset before granting access to any portal features
2. WHEN valid credentials are provided, THE System SHALL authenticate the vendor and grant access to the Vendor_Portal
3. WHEN invalid credentials are provided, THE System SHALL deny access and display an authentication error
4. THE System SHALL restrict vendor access to only their own data and ASN records

### Requirement 4: Vendor Self-Onboarding Data Capture

**User Story:** As a Vendor, I want to complete my business, bank, compliance, and contact information through the portal, so that my onboarding profile is complete for approval.

#### Acceptance Criteria

1. THE Vendor_Portal SHALL present editable fields for GST Number, PAN Number, Address (Line 1, Line 2, City, State, Country, Pin Code), Trade Name, and Legal Name
2. THE Vendor_Portal SHALL allow the vendor to add multiple addresses with tagging as Billing, Shipping, or Registered
3. THE Vendor_Portal SHALL require IFSC Code, Account Number, Account Holder Name, Bank Name, Branch, City, State, and Country for each bank account entry
4. THE Vendor_Portal SHALL allow the vendor to add multiple bank accounts
5. THE Vendor_Portal SHALL require upload of PAN, GST Certificate, CIN, MSME Certificate, and Bank Proof documents
6. THE Vendor_Portal SHALL prevent the vendor from editing core MDM fields (Vendor Name, Email ID, Phone Number, Company Name, Department, Supplier Group, Supplier Category, Supplier Location)
7. WHEN a vendor submits onboarding data, THE System SHALL validate that all mandatory fields are completed before accepting the submission

### Requirement 5: Vendor Approval Workflow

**User Story:** As an MDM_Admin, I want to review and approve or reject vendor submissions, so that only validated vendors become active in the system.

#### Acceptance Criteria

1. WHEN a vendor submits their onboarding data, THE System SHALL transition the vendor status from Draft to Submitted
2. WHEN an MDM_Admin begins review, THE System SHALL transition the vendor status from Submitted to Under Review
3. WHEN an MDM_Admin approves a vendor, THE System SHALL transition the vendor status to Approved and mark the vendor as active
4. WHEN an MDM_Admin rejects a vendor, THE System SHALL require a mandatory rejection reason before completing the rejection
5. WHEN a vendor is rejected, THE System SHALL notify the vendor via email with the rejection reason and enable re-edit and resubmit
6. THE MDM_Admin SHALL view a list of all initiated vendors with their current status (Draft, Submitted, Under Review, Approved, Rejected)
7. THE MDM_Admin SHALL mark a vendor as Inactive (soft delete) without permanently removing the record

### Requirement 6: ASN Creation by Vendor

**User Story:** As a Vendor, I want to create an Advance Shipment Notice against a Purchase Order, so that I can notify the buyer of an upcoming shipment.

#### Acceptance Criteria

1. WHEN creating an ASN, THE Vendor_Portal SHALL require the vendor to select a valid Purchase Order
2. WHEN creating an ASN, THE Vendor_Portal SHALL require ETA, Invoice Number, Total Amount, Invoice PDF upload, LR Number, Transporter Name, and Driver Name
3. THE System SHALL validate that the Invoice Number is globally unique across all vendors and submissions
4. THE System SHALL support partial shipment — allowing multiple ASNs against a single PO
5. THE System SHALL support partial quantity per line item within an ASN
6. WHEN an ASN is submitted, THE System SHALL transition its status to Submitted

### Requirement 7: ASN Validation and Admin Review

**User Story:** As a Procurement_Admin, I want to validate and approve or reject ASNs, so that only accurate shipment data is posted to the ERP.

#### Acceptance Criteria

1. THE Procurement_Admin SHALL view all submitted ASNs with their current status (Draft, Submitted, Validated, Posted)
2. WHEN validating an ASN, THE System SHALL check for invoice number uniqueness and flag duplicates
3. THE Procurement_Admin SHALL approve or reject an ASN after validation
4. WHEN an ASN is approved, THE System SHALL transition its status to Validated

### Requirement 8: Document Intelligence — PDF Extraction

**User Story:** As a Procurement_Admin, I want the system to automatically extract key fields from uploaded invoice PDFs, so that manual data entry is minimized and validation is faster.

#### Acceptance Criteria

1. WHEN an invoice PDF is uploaded, THE Document_Intelligence_Engine SHALL extract Invoice Number, Invoice Date, Line Items, Quantity, and Amount from the document
2. THE Document_Intelligence_Engine SHALL use configurable alias keywords and optional regex patterns to locate field values in the PDF text
3. THE Document_Intelligence_Engine SHALL normalize extracted text (lowercase, remove extra spaces) before performing keyword matching
4. THE Document_Intelligence_Engine SHALL return a confidence score for each extracted field (Exact match 95%, Fuzzy match 80%, Regex fallback 70%)
5. WHEN extraction fails for a field, THE Document_Intelligence_Engine SHALL flag the field for manual review
6. THE System SHALL display extracted data with confidence scores and allow manual correction by the user

### Requirement 9: Extraction Configuration Management

**User Story:** As a Procurement_Admin, I want to configure extraction rules (aliases, regex, priority) for PDF fields, so that the system can adapt to different vendor invoice formats.

#### Acceptance Criteria

1. THE Procurement_Admin SHALL configure field name, alias keywords, optional regex pattern, and priority for each extraction rule
2. WHEN a new alias or regex is added, THE Document_Intelligence_Engine SHALL use the updated configuration for subsequent extractions
3. THE System SHALL store extraction configurations persistently and apply them in priority order during extraction

### Requirement 10: Invoice Validation Engine

**User Story:** As a Procurement_Admin, I want the system to compare extracted invoice data against PO and ASN data, so that discrepancies are identified before ERP posting.

#### Acceptance Criteria

1. WHEN validating an invoice, THE System SHALL compare extracted Invoice Number, Quantity, and Amount against the corresponding PO and ASN records
2. WHEN a mismatch is detected (quantity or amount), THE System SHALL highlight the discrepancy on screen for admin review
3. THE System SHALL handle partial shipment scenarios by validating cumulative quantities against PO line totals

### Requirement 11: ERP Integration (Phase 1 — Mock)

**User Story:** As a Procurement_Admin, I want to simulate posting validated invoices to the ERP, so that the workflow is complete and ready for future real integration.

#### Acceptance Criteria

1. WHEN a validated ASN is posted, THE System SHALL simulate the ERP posting and return a status of "Successfully Posted"
2. THE System SHALL track posting status for each ASN (Posted, Failed, Pending)
3. WHEN posting fails in simulation, THE System SHALL log the failure reason and allow retry
