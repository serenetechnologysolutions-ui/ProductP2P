jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../../config/database');
const { maybeCreateIntercompanySalesOrder, getUserCompanyIds } = require('./company.helpers');

describe('maybeCreateIntercompanySalesOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when the vendor is not an internal company', async () => {
    pool.query.mockResolvedValueOnce([[{ internal_company_id: null }]]);

    const result = await maybeCreateIntercompanySalesOrder('vendor-1', 'po-1', 1000, 'company-buyer');

    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('creates a mirrored sales order when the vendor is an internal company', async () => {
    pool.query
      .mockResolvedValueOnce([[{ internal_company_id: 'company-seller' }]])
      .mockResolvedValueOnce([[{ maxNum: 5 }]])
      .mockResolvedValueOnce([]);

    const result = await maybeCreateIntercompanySalesOrder('vendor-1', 'po-1', 1000, 'company-buyer');

    expect(result).toEqual(expect.objectContaining({ so_number: 'SO-000006' }));
    const insertCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO sales_orders'));
    expect(insertCall[1]).toEqual(expect.arrayContaining(['company-seller', 'company-buyer', 'po-1', 1000]));
  });

  it('falls back to the default company when no buying company is given', async () => {
    pool.query
      .mockResolvedValueOnce([[{ internal_company_id: 'company-seller' }]])
      .mockResolvedValueOnce([[{ id: 'default-company-id' }]])
      .mockResolvedValueOnce([[{ maxNum: 0 }]])
      .mockResolvedValueOnce([]);

    await maybeCreateIntercompanySalesOrder('vendor-1', 'po-1', 500, null);

    const insertCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO sales_orders'));
    expect(insertCall[1]).toEqual(expect.arrayContaining(['default-company-id']));
  });

  it('never throws — a failure here must not roll back the PO itself', async () => {
    pool.query.mockRejectedValueOnce(new Error('db exploded'));
    await expect(maybeCreateIntercompanySalesOrder('vendor-1', 'po-1', 1000, 'company-buyer')).resolves.toBeNull();
  });
});

describe('getUserCompanyIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null (unrestricted) for system_admin without querying the database', async () => {
    const result = await getUserCompanyIds('user-1', 'system_admin');
    expect(result).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('queries user_company_access for mdm_admin (no longer unrestricted)', async () => {
    pool.query.mockResolvedValueOnce([[{ company_id: 'co-1' }, { company_id: 'co-3' }]]);
    const result = await getUserCompanyIds('user-1', 'mdm_admin');
    expect(result).toEqual(['co-1', 'co-3']);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT company_id FROM user_company_access WHERE user_id = ?',
      ['user-1']
    );
  });

  it('returns the granted company ids for a restricted role', async () => {
    pool.query.mockResolvedValueOnce([[{ company_id: 'co-1' }, { company_id: 'co-2' }]]);
    const result = await getUserCompanyIds('user-1', 'procurement_admin');
    expect(result).toEqual(['co-1', 'co-2']);
  });

  it('returns an empty array, not null, when a restricted role has no grants at all', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const result = await getUserCompanyIds('user-1', 'procurement_admin');
    expect(result).toEqual([]);
  });
});

describe('getCompanyDetails', () => {
  const { getCompanyDetails } = require('./company.helpers');

  beforeEach(() => jest.clearAllMocks());

  it('returns null when companyId is falsy', async () => {
    const result = await getCompanyDetails(null);
    expect(result).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns null when companyId is empty string', async () => {
    const result = await getCompanyDetails('');
    expect(result).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns the company details when found', async () => {
    const mockCompany = {
      company_name: 'Acme Corp',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pin_code: '400001',
      cin: 'U12345MH2020PTC123456',
      pan: 'ABCDE1234F',
      gstin: '27ABCDE1234F1Z5',
    };
    pool.query.mockResolvedValueOnce([[mockCompany]]);
    const result = await getCompanyDetails('company-1');
    expect(result).toEqual(mockCompany);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT company_name'),
      ['company-1']
    );
  });

  it('returns null when company is not found', async () => {
    pool.query.mockResolvedValueOnce([[undefined]]);
    const result = await getCompanyDetails('non-existent');
    expect(result).toBeNull();
  });
});
