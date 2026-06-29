const { REPORT_DEFINITIONS } = require('./report-definitions');

describe('REPORT_DEFINITIONS registry', () => {
  const adminUser = { role: 'system_admin', vendorId: null };
  const vendorUser = { role: 'vendor', vendorId: 'vendor-123' };

  it('every report defines label, roles, filters, columns, and buildQuery', () => {
    Object.entries(REPORT_DEFINITIONS).forEach(([key, def]) => {
      expect(typeof def.label).toBe('string');
      expect(Array.isArray(def.roles)).toBe(true);
      expect(def.roles.length).toBeGreaterThan(0);
      expect(Array.isArray(def.filters)).toBe(true);
      expect(Array.isArray(def.columns)).toBe(true);
      expect(def.columns.length).toBeGreaterThan(0);
      expect(typeof def.buildQuery).toBe('function');
    });
  });

  it('every column has a key and a label', () => {
    Object.values(REPORT_DEFINITIONS).forEach(def => {
      def.columns.forEach(col => {
        expect(typeof col.key).toBe('string');
        expect(typeof col.label).toBe('string');
      });
    });
  });

  it('buildQuery returns a SELECT with no filters applied', () => {
    Object.entries(REPORT_DEFINITIONS).forEach(([key, def]) => {
      const { sql, params } = def.buildQuery({}, adminUser);
      expect(sql.trim().toUpperCase()).toMatch(/^SELECT/);
      expect(Array.isArray(params)).toBe(true);
    });
  });

  it('every column key is selectable from buildQuery\'s base SQL (no typo\'d aliases)', () => {
    Object.entries(REPORT_DEFINITIONS).forEach(([key, def]) => {
      const { sql } = def.buildQuery({}, adminUser);
      def.columns.forEach(col => {
        // every column key should appear in the query, either as a bare
        // column name or as an `AS <key>` alias
        const pattern = new RegExp(`(\\b${col.key}\\b|as ${col.key}\\b)`, 'i');
        expect(sql).toMatch(pattern);
      });
    });
  });

  it('scopes purchase_orders/asns/tickets to the vendor\'s own id when the caller is a vendor', () => {
    ['purchase_orders', 'asns', 'tickets'].forEach(key => {
      const def = REPORT_DEFINITIONS[key];
      expect(def.roles).toContain('vendor');
      const { sql, params } = def.buildQuery({}, vendorUser);
      expect(params).toContain('vendor-123');
      expect(sql.toLowerCase()).toMatch(/vendor_id|vendor-123|ticket_vendors/);
    });
  });

  it('applies date_range, select, and value_range filters as parameterized conditions, never inlined', () => {
    const pr = REPORT_DEFINITIONS.purchase_requisitions;
    const { sql, params } = pr.buildQuery(
      { date_from: '2026-01-01', date_to: '2026-12-31', status: 'approved', min_value: 100, max_value: 5000 },
      adminUser
    );
    expect(sql).not.toMatch(/2026-01-01|approved|100|5000/);
    expect(params).toEqual(['2026-01-01', '2026-12-31', 'approved', 100, 5000]);
  });

  it('budget_allocations computes remaining as allocated - committed - consumed - actual', () => {
    const def = REPORT_DEFINITIONS.budget_allocations;
    const { sql } = def.buildQuery({}, adminUser);
    expect(sql).toMatch(/allocated_amount - committed_amount - consumed_amount - actual_amount/);
  });
});
