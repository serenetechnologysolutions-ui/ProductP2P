# Design Document: HSN Tax Mapping

## Overview

This feature establishes a centralized HSN code master with tax percentages in the existing `sub_masters` table. The PO line item form's free-text HSN input is replaced with a searchable dropdown that auto-fills tax rates, reducing data-entry errors and ensuring tax consistency.

## Architecture

This feature extends the existing sub-masters infrastructure to support a `tax_percentage` column, adds HSN-specific CRUD logic, and replaces the free-text HSN input in the PO line item form with a searchable dropdown that auto-fills tax rates.

The architecture follows the project's established patterns:
- **Backend**: Express route handlers in the existing `sub-masters.routes.js` module, extended with validation for HSN-specific fields
- **Frontend**: Enhanced `SubMasterTab` component for admin CRUD; new `HsnDropdown` component consumed by `PurchaseOrders.jsx`
- **Database**: Idempotent ALTER TABLE migration adding the `tax_percentage` column to `sub_masters`

No new microservices, tables, or external dependencies are introduced.

---

## Components and Interfaces

### 1. Database Migration — `migrate-hsn-tax.js`

A new idempotent migration script that adds `tax_percentage DECIMAL(5,2) NULL` to the `sub_masters` table.

```javascript
// backend/src/config/migrate-hsn-tax.js
const { pool } = require('../config/database');

async function migrateHsnTax() {
  const connection = await pool.getConnection();
  try {
    // Check if column already exists (idempotent)
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sub_masters' AND COLUMN_NAME = 'tax_percentage'`
    );
    if (columns.length === 0) {
      await connection.query('ALTER TABLE sub_masters ADD COLUMN tax_percentage DECIMAL(5,2) NULL');
      console.log('  + sub_masters.tax_percentage column added');
    } else {
      console.log('  ✓ sub_masters.tax_percentage already exists — skipping');
    }
  } finally {
    connection.release();
  }
}

module.exports = migrateHsnTax;
```

### 2. Backend — Sub-Masters Routes Extension

Extend `sub-masters.routes.js` to handle `tax_percentage` in POST and PUT operations, with validation for the `hsn_code` category.

#### Validation Logic

```javascript
// Validation helper added to sub-masters.routes.js
function validateHsnPayload(category, tax_percentage) {
  if (category === 'hsn_code' && tax_percentage != null) {
    const val = Number(tax_percentage);
    if (isNaN(val) || val < 0 || val > 100) {
      throw new ValidationError('tax_percentage must be between 0.00 and 100.00');
    }
  }
}
```

#### Modified POST `/api/sub-masters`

```javascript
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { category, name, code, company_id, tax_percentage } = req.body;
  validateHsnPayload(category, tax_percentage);
  const id = uuidv4();
  // HSN codes are always global (company_id = NULL)
  const effectiveCompanyId = category === 'hsn_code' ? null : (company_id || null);
  await pool.query(
    'INSERT INTO sub_masters (id, category, name, code, company_id, tax_percentage) VALUES (?, ?, ?, ?, ?, ?)',
    [id, category, name, code || null, effectiveCompanyId, category === 'hsn_code' ? (tax_percentage ?? null) : null]
  );
  res.status(201).json({ success: true, data: { id, category, name, code, company_id: effectiveCompanyId, tax_percentage: category === 'hsn_code' ? tax_percentage : undefined } });
}));
```

#### Modified PUT `/api/sub-masters/:id`

```javascript
router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { name, code, is_active, company_id, tax_percentage } = req.body;
  // Fetch record to determine category
  const [[record]] = await pool.query('SELECT category FROM sub_masters WHERE id = ?', [req.params.id]);
  if (!record) throw new NotFoundError('Record not found');
  
  validateHsnPayload(record.category, tax_percentage);
  
  if (record.category === 'hsn_code') {
    await pool.query(
      'UPDATE sub_masters SET name = ?, code = ?, is_active = ?, tax_percentage = ? WHERE id = ?',
      [name, code, is_active !== false, tax_percentage ?? null, req.params.id]
    );
  } else if (company_id !== undefined) {
    await pool.query(
      'UPDATE sub_masters SET name = ?, code = ?, is_active = ?, company_id = ? WHERE id = ?',
      [name, code, is_active !== false, company_id || null, req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE sub_masters SET name = ?, code = ?, is_active = ? WHERE id = ?',
      [name, code, is_active !== false, req.params.id]
    );
  }
  res.json({ success: true, message: 'Updated' });
}));
```

### 3. Frontend — `SubMasterTab` Enhancement

The existing `SubMasterTab` component is extended with conditional rendering for the `hsn_code` category.

#### Changes:
- **Table column**: Add a "Tax %" column (conditionally visible when `category === 'hsn_code'`)
- **Form field**: Add an `InputNumber` for `tax_percentage` (conditionally visible when `category === 'hsn_code'`)
- **Payload**: Include `tax_percentage` in POST/PUT requests when category is `hsn_code`

```javascript
// Conditional column added to the columns array
const isHsn = category === 'hsn_code';

const columns = [
  { title: 'Name', dataIndex: 'name' },
  { title: 'Code', dataIndex: 'code', width: 100, render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
  ...(isHsn ? [{ title: 'Tax %', dataIndex: 'tax_percentage', width: 90, render: v => v != null ? `${v}%` : '—' }] : []),
  // ... existing columns (company, actions)
];

// Conditional form field
{isHsn && (
  <Form.Item name="tax_percentage" rules={[{ type: 'number', min: 0, max: 100, message: 'Must be 0-100' }]}>
    <InputNumber placeholder="Tax %" min={0} max={100} step={0.01} precision={2} style={{ width: 100 }} />
  </Form.Item>
)}
```

### 4. Frontend — `HsnDropdown` Component

A new reusable component that wraps Ant Design's `Select` with `showSearch` and `filterOption` for searching HSN records by name or code.

```javascript
// frontend/src/components/HsnDropdown.jsx
import { useState, useEffect } from 'react';
import { Select } from 'antd';
import api from '../api/axios';

export default function HsnDropdown({ value, onChange, style, ...rest }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/sub-masters/hsn_code')
      .then(res => {
        const records = res.data.data || [];
        setOptions(records.map(r => ({
          value: r.id,
          label: `${r.code} — ${r.name}`,
          code: r.code,
          name: r.name,
          tax_percentage: r.tax_percentage,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Select
      showSearch
      allowClear
      placeholder="Select HSN"
      value={value}
      onChange={(val, option) => onChange(val, option)}
      loading={loading}
      style={style}
      filterOption={(input, option) => {
        const search = input.toLowerCase();
        return (
          option.code?.toLowerCase().includes(search) ||
          option.name?.toLowerCase().includes(search)
        );
      }}
      options={options}
      {...rest}
    />
  );
}
```

### 5. Frontend — PO Line Item Form Integration

In `PurchaseOrders.jsx`, replace the free-text `<Input>` for HSN with `<HsnDropdown>`.

#### Selection Handler

```javascript
const handleHsnSelect = (index, selectedId, option) => {
  if (!selectedId) {
    // Cleared
    updateItem(index, 'hsn_sac', '');
    updateItem(index, 'tax_percent', 0);
  } else {
    updateItem(index, 'hsn_sac', option.code);
    updateItem(index, 'tax_percent', option.tax_percentage ?? 0);
  }
};
```

#### Tax Recalculation (existing `updateItem` pattern extended)

```javascript
const updateItem = (index, field, value) => {
  const updated = [...items];
  updated[index] = { ...updated[index], [field]: value };
  // Recalculate derived amounts
  const qty = updated[index].quantity || 0;
  const price = updated[index].unit_price || 0;
  const taxPct = updated[index].tax_percent || 0;
  const amount = qty * price;
  const taxAmount = amount * (taxPct / 100);
  updated[index].amount = amount;
  updated[index].tax_amount = taxAmount;
  updated[index].total_line_amount = amount + taxAmount;
  setItems(updated);
};
```

#### Amendment Panel

The amendment panel's HSN column also uses `HsnDropdown` to allow changing the HSN selection during amendments. Pre-population loads the stored `hsn_sac` code and finds the matching option.

---

## Data Models

### Modified Table: `sub_masters`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | VARCHAR(36) | NO | Primary key (UUID) |
| category | VARCHAR(100) | NO | Record category (e.g., 'hsn_code') |
| name | VARCHAR(255) | NO | Display name (e.g., "Electrical Machinery") |
| code | VARCHAR(50) | YES | Numeric HSN code (e.g., "8501") |
| tax_percentage | DECIMAL(5,2) | YES | Associated tax rate (0.00–100.00) |
| company_id | VARCHAR(36) | YES | Always NULL for hsn_code category |
| is_active | BOOLEAN | NO | Soft-delete flag (default TRUE) |
| created_at | TIMESTAMP | NO | Auto-set on creation |

### Existing Table: `po_line_items` (no changes)

| Column | Type | Description |
|--------|------|-------------|
| hsn_sac | VARCHAR | Stores the HSN/SAC code value (4/6/8 digits) |
| tax_percent | DECIMAL | Tax percentage for the line item |
| tax_amount | DECIMAL | Computed: amount × (tax_percent / 100) |
| total_line_amount | DECIMAL | Computed: amount + tax_amount |

No schema changes to `po_line_items` — the dropdown simply populates existing columns.

---

## Interfaces / API Contracts

### GET `/api/sub-masters/hsn_code`

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Electrical Machinery", "code": "8501", "tax_percentage": 18.00, "category": "hsn_code", "is_active": true, "company_id": null },
    ...
  ]
}
```

Records are ordered alphabetically by `name`. Only active records are returned.

### POST `/api/sub-masters`

**Request (hsn_code category):**
```json
{
  "category": "hsn_code",
  "name": "Electrical Machinery",
  "code": "8501",
  "tax_percentage": 18.00
}
```

**Validation:** `tax_percentage` must be between 0.00 and 100.00 (inclusive). `company_id` is forced to NULL for `hsn_code` category.

### PUT `/api/sub-masters/:id`

**Request (hsn_code record):**
```json
{
  "name": "Electrical Machinery",
  "code": "8501",
  "tax_percentage": 12.00
}
```

### POST `/api/purchase-orders` (unchanged contract)

Line items continue to accept `hsn_sac` (string) and `tax_percent` (number). The frontend now sources these values from the dropdown selection rather than free-text entry.

---

## Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| tax_percentage < 0 or > 100 | 400 | "tax_percentage must be between 0.00 and 100.00" |
| tax_percentage not a number | 400 | "tax_percentage must be between 0.00 and 100.00" |
| HSN/SAC format invalid (not 4/6/8 digits) | 400 | "Invalid GST/HSN format: ... HSN/SAC must be 4, 6, or 8 digits." |
| Missing HSN name or code on create | 400 | Standard Ant Design form validation (frontend) |
| Network error fetching HSN list | — | Dropdown shows empty; user can retry or type manually (graceful degradation) |

---

## Testing Strategy

- **Unit tests**: Validate specific scenarios — migration idempotency, form rendering with/without hsn_code category, dropdown clearing behavior, manual override after auto-fill
- **Property tests**: Verify universal properties across randomized inputs — CRUD round-trips, validation boundary behavior, tax recalculation arithmetic, HSN format validation
- **Integration tests**: End-to-end PO creation with HSN selection, amendment pre-population

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: HSN CRUD Round-Trip

For any valid HSN record with a name, code (4/6/8 digits), and tax_percentage in [0.00, 100.00], creating the record via POST and then retrieving it via GET `/api/sub-masters/hsn_code` SHALL return a record with matching name, code, tax_percentage, and company_id = NULL.

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 2: Tax Percentage Validation Rejects Out-of-Range Values

For any numeric value less than 0 or greater than 100, submitting it as `tax_percentage` in a POST or PUT request for an hsn_code record SHALL result in a 400 validation error response and no database mutation.

**Validates: Requirements 2.5**

### Property 3: GET HSN Endpoint Returns Correct Active Records

For any set of sub_masters records with category 'hsn_code' (some active, some inactive), a GET request to `/api/sub-masters/hsn_code` SHALL return only the active records, each including `id`, `name`, `code`, and `tax_percentage` fields, ordered alphabetically by name.

**Validates: Requirements 2.3, 6.1, 6.2**

### Property 4: HSN Dropdown Filter Matches Name or Code

For any search string typed into the HSN dropdown, the displayed options SHALL be exactly those HSN records where the name or code contains the search string (case-insensitive).

**Validates: Requirements 4.2**

### Property 5: HSN Selection Populates Line Item Fields

For any HSN record selected from the dropdown, the line item's `hsn_sac` field SHALL equal the selected record's `code`, and the line item's `tax_percent` field SHALL equal the selected record's `tax_percentage`.

**Validates: Requirements 4.3, 5.1**

### Property 6: Line Item Tax Amount Recalculation

For any line item with quantity Q, unit_price P, and tax_percent T, the computed tax_amount SHALL equal (Q × P × T / 100) and total_line_amount SHALL equal (Q × P) + tax_amount.

**Validates: Requirements 5.3**

### Property 7: PO Line Item HSN Persistence Round-Trip

For any Purchase Order created with line items containing `hsn_sac` and `tax_percent` values, retrieving the PO via GET `/api/purchase-orders/:id` SHALL return line items with the same `hsn_sac` and `tax_percent` values that were submitted.

**Validates: Requirements 7.1**

### Property 8: HSN/SAC Format Validation

For any string value in `hsn_sac`, the `validateGstHsn` function SHALL accept it if and only if it matches the regex `^\d{4}(\d{2}){0,2}$` (exactly 4, 6, or 8 digits). All other non-empty strings SHALL be rejected with a validation error.

**Validates: Requirements 7.3**

### Property 9: Non-HSN Categories Hide Tax Percentage UI

For any category value other than 'hsn_code', the SubMasterTab component SHALL NOT render the "Tax %" input field or table column.

**Validates: Requirements 3.4**
