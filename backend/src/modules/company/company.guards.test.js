const { assertCompanyActive } = require('./company.guards');
const { ValidationError } = require('../../common/errors');

describe('assertCompanyActive', () => {
  it('should pass through when companyId is null', async () => {
    await expect(assertCompanyActive(null)).resolves.toBeUndefined();
  });

  it('should pass through when companyId is undefined', async () => {
    await expect(assertCompanyActive(undefined)).resolves.toBeUndefined();
  });

  it('should pass through when companyId is empty string', async () => {
    await expect(assertCompanyActive('')).resolves.toBeUndefined();
  });

  it('should throw ValidationError when company is not found', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[]])
    };

    await expect(assertCompanyActive('non-existent-id', mockConn))
      .rejects.toThrow(ValidationError);

    await expect(assertCompanyActive('non-existent-id', mockConn))
      .rejects.toThrow('Company not found');
  });

  it('should throw ValidationError when company is inactive', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ is_active: 0 }]])
    };

    await expect(assertCompanyActive('inactive-company-id', mockConn))
      .rejects.toThrow(ValidationError);

    await expect(assertCompanyActive('inactive-company-id', mockConn))
      .rejects.toThrow('Company is inactive. New transactions cannot be created.');
  });

  it('should not throw when company is active', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ is_active: 1 }]])
    };

    await expect(assertCompanyActive('active-company-id', mockConn))
      .resolves.toBeUndefined();
  });

  it('should query with the correct company ID', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ is_active: 1 }]])
    };

    await assertCompanyActive('test-company-123', mockConn);

    expect(mockConn.query).toHaveBeenCalledWith(
      'SELECT is_active FROM company_master WHERE id = ?',
      ['test-company-123']
    );
  });

  it('should include company_id in ValidationError fields when company not found', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[]])
    };

    try {
      await assertCompanyActive('missing-id', mockConn);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.statusCode).toBe(400);
      expect(err.fields).toEqual(['company_id']);
    }
  });

  it('should include company_id in ValidationError fields when company is inactive', async () => {
    const mockConn = {
      query: jest.fn().mockResolvedValue([[{ is_active: 0 }]])
    };

    try {
      await assertCompanyActive('inactive-id', mockConn);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.statusCode).toBe(400);
      expect(err.fields).toEqual(['company_id']);
    }
  });
});
