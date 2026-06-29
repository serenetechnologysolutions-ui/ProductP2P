jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../common/eventBus', () => ({ onEvent: jest.fn(), emitEvent: jest.fn() }));
jest.mock('../payments/payments.service', () => ({ syncPaymentStatusFromErp: jest.fn() }));
jest.mock('./sap-mock.service', () => ({
  mockSapRequest: jest.fn(),
  mockSapPaymentStatusPull: jest.fn(),
  mockSapVendorPull: jest.fn(),
}));

const { pool } = require('../../config/database');
const { syncPaymentStatusFromErp } = require('../payments/payments.service');
const { mockSapRequest, mockSapPaymentStatusPull, mockSapVendorPull } = require('./sap-mock.service');
const { syncToSap, pullPaymentStatusFromSap, pushVendorToSap, pullVendorFromSap } = require('./sap-connector.service');

describe('sap-connector.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('syncToSap', () => {
    it('logs a successful sync to integration_logs', async () => {
      mockSapRequest.mockResolvedValue({ status: 'acknowledged' });

      const result = await syncToSap('sap_pr_sync', 'pr-1', { foo: 'bar' });

      expect(result).toEqual({ status: 'acknowledged' });
      const logInsert = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO integration_logs'));
      expect(logInsert[1]).toEqual(expect.arrayContaining(['sap_pr_sync', 'outbound', 'pr-1', JSON.stringify({ foo: 'bar' }), JSON.stringify({ status: 'acknowledged' }), 'success', 1]));
    });

    it('logs a failure and returns null rather than throwing (never blocks the caller)', async () => {
      mockSapRequest.mockRejectedValue(new Error('sap down'));
      pool.query.mockResolvedValue([]); // every query (including the DLQ insert from withRetry) succeeds

      const result = await syncToSap('sap_po_sync', 'po-1', {});

      expect(result).toBeNull();
      const logInsert = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO integration_logs'));
      expect(logInsert[1][6]).toBe('failed');
    }, 10000);
  });

  describe('pullPaymentStatusFromSap', () => {
    it('writes the inbound log and pushes the status through payments.service', async () => {
      pool.query.mockResolvedValueOnce([[{ payment_number: 'PAY-000001' }]]).mockResolvedValueOnce([]);
      mockSapPaymentStatusPull.mockResolvedValue({ reference: 'PAY-000001', status: 'completed' });

      const result = await pullPaymentStatusFromSap('pay-1');

      expect(result.status).toBe('completed');
      expect(syncPaymentStatusFromErp).toHaveBeenCalledWith('pay-1', 'completed', pool);
    });

    it('throws if the payment does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(pullPaymentStatusFromSap('missing')).rejects.toThrow('Payment not found');
    });
  });

  describe('vendor sync', () => {
    it('pushVendorToSap throws when the vendor does not exist', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(pushVendorToSap('missing-vendor')).rejects.toThrow('Vendor not found');
    });

    it('pullVendorFromSap logs the inbound pull', async () => {
      mockSapVendorPull.mockResolvedValue({ sap_vendor_code: 'V123', vendor_name: 'Vendor V123' });
      pool.query.mockResolvedValueOnce([]);

      const result = await pullVendorFromSap('V123');

      expect(result.vendor_name).toBe('Vendor V123');
      const logInsert = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO integration_logs'));
      expect(logInsert[1]).toEqual(expect.arrayContaining(['sap_vendor_sync', 'inbound']));
    });
  });
});
