const { validateImportRows } = require('./item-master.import');

describe('validateImportRows', () => {
  it('returns valid rows when all required fields are present', () => {
    const rows = [
      { item_code: 'ITEM-001', item_description: 'Widget A', uom: 'Kg' },
      { item_code: 'ITEM-002', item_description: 'Widget B' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      item_code: 'ITEM-001',
      item_description: 'Widget A',
      uom: 'Kg',
    });
    expect(result.valid[1]).toMatchObject({
      item_code: 'ITEM-002',
      item_description: 'Widget B',
      uom: 'Nos', // default
      currency: 'INR', // default
    });
  });

  it('rejects rows with missing item_code', () => {
    const rows = [
      { item_code: '', item_description: 'Widget A' },
      { item_description: 'Widget B' }, // item_code undefined
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toEqual({ row: 2, message: 'Missing required field: item_code' });
    expect(result.errors[1]).toEqual({ row: 3, message: 'Missing required field: item_code' });
  });

  it('rejects rows with missing item_description', () => {
    const rows = [
      { item_code: 'ITEM-001', item_description: '' },
      { item_code: 'ITEM-002' }, // item_description undefined
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toEqual({ row: 2, message: 'Missing required field: item_description' });
    expect(result.errors[1]).toEqual({ row: 3, message: 'Missing required field: item_description' });
  });

  it('skips rows with item_code already in existingCodes', () => {
    const rows = [
      { item_code: 'ITEM-001', item_description: 'Widget A' },
      { item_code: 'ITEM-002', item_description: 'Widget B' },
    ];
    const existingCodes = new Set(['ITEM-001']);

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].item_code).toBe('ITEM-002');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ row: 2, message: 'Duplicate item_code: ITEM-001' });
  });

  it('detects duplicate item_codes within the same file', () => {
    const rows = [
      { item_code: 'ITEM-001', item_description: 'Widget A' },
      { item_code: 'ITEM-001', item_description: 'Widget A Copy' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ row: 3, message: 'Duplicate item_code within file: ITEM-001' });
  });

  it('trims whitespace from item_code and item_description', () => {
    const rows = [
      { item_code: '  ITEM-001  ', item_description: '  Widget A  ' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].item_code).toBe('ITEM-001');
    expect(result.valid[0].item_description).toBe('Widget A');
  });

  it('treats whitespace-only fields as missing', () => {
    const rows = [
      { item_code: '   ', item_description: 'Widget A' },
      { item_code: 'ITEM-001', item_description: '   ' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toBe('Missing required field: item_code');
    expect(result.errors[1].message).toBe('Missing required field: item_description');
  });

  it('applies correct defaults for optional fields', () => {
    const rows = [
      { item_code: 'ITEM-001', item_description: 'Widget A' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid[0]).toEqual({
      item_code: 'ITEM-001',
      item_description: 'Widget A',
      item_name: 'Widget A', // defaults to item_description
      uom: 'Nos',
      category: null,
      standard_cost: 0,
      currency: 'INR',
    });
  });

  it('uses provided optional fields when available', () => {
    const rows = [
      {
        item_code: 'ITEM-001',
        item_description: 'Widget A',
        item_name: 'Custom Name',
        uom: 'Kg',
        category: 'Electronics',
        standard_cost: '150.50',
        currency: 'USD',
      },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid[0]).toEqual({
      item_code: 'ITEM-001',
      item_description: 'Widget A',
      item_name: 'Custom Name',
      uom: 'Kg',
      category: 'Electronics',
      standard_cost: 150.50,
      currency: 'USD',
    });
  });

  it('row numbers are 1-indexed starting at row 2 (row 1 is header)', () => {
    const rows = [
      { item_code: '', item_description: 'A' },  // row 2
      { item_code: 'X', item_description: 'B' }, // row 3 - valid
      { item_code: '', item_description: 'C' },  // row 4
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.errors[0].row).toBe(2);
    expect(result.errors[1].row).toBe(4);
  });

  it('returns empty arrays when given no rows', () => {
    const result = validateImportRows([], new Set());

    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('handles numeric item_code values by converting to string', () => {
    const rows = [
      { item_code: 12345, item_description: 'Numeric Code Item' },
    ];
    const existingCodes = new Set();

    const result = validateImportRows(rows, existingCodes);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].item_code).toBe('12345');
  });
});
