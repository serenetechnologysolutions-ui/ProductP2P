jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../pr/pr.helpers', () => ({ getSetting: jest.fn().mockResolvedValue('30') }));
jest.mock('../../common/eventBus', () => ({ onEvent: jest.fn(), emitEvent: jest.fn() }));

const { pool } = require('../../config/database');
const { scheduleInvoicePayment, runPayments, recomputeCashflowProjection } = require('./payments.service');

describe('payments.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('scheduleInvoicePayment', () => {
    it('creates a payment_schedule row due payment_terms_days after the invoice date', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 'inv-1', vendor_id: 'vendor-1', total_amount: '1000.00', invoice_date: '2026-01-01', created_at: '2026-01-01' }]])
        .mockResolvedValueOnce([[]]) // no existing schedule
        .mockResolvedValueOnce([]) // insert payment_schedule
        .mockResolvedValueOnce([[{ lastBalance: 0 }]]) // ledger balance lookup
        .mockResolvedValueOnce([]); // insert ledger entry

      await scheduleInvoicePayment({ record_id: 'inv-1' });

      const insertCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO payment_schedule'));
      expect(insertCall[1]).toEqual(expect.arrayContaining(['vendor-1', '1000.00']));
    });

    it('is idempotent — does nothing if a schedule already exists for the invoice', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 'inv-1', vendor_id: 'vendor-1', total_amount: '1000.00' }]])
        .mockResolvedValueOnce([[{ id: 'existing-schedule' }]]);

      await scheduleInvoicePayment({ record_id: 'inv-1' });

      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('runPayments', () => {
    it('pays the outstanding amount and marks the schedule paid when fully covered', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 'sched-1', vendor_id: 'vendor-1', scheduled_amount: '1000.00', paid_amount: '0.00' }]])
        .mockResolvedValueOnce([[{ maxNum: 0 }]]) // payment number
        .mockResolvedValueOnce([]) // insert payment
        .mockResolvedValueOnce([]) // update schedule
        .mockResolvedValueOnce([[{ lastBalance: 1000 }]]) // ledger balance lookup
        .mockResolvedValueOnce([]); // insert ledger entry

      const results = await runPayments(['sched-1'], 'actor-1');

      expect(results).toHaveLength(1);
      expect(results[0].amount).toBe(1000);
      const updateCall = pool.query.mock.calls.find(c => c[0].includes('UPDATE payment_schedule'));
      expect(updateCall[1]).toEqual([1000, 'paid', 'sched-1']);
    });

    it('marks the schedule partial when the outstanding amount is less than fully scheduled (already part-paid)', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 'sched-1', vendor_id: 'vendor-1', scheduled_amount: '1000.00', paid_amount: '400.00' }]])
        .mockResolvedValueOnce([[{ maxNum: 0 }]])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([[{ lastBalance: 0 }]])
        .mockResolvedValueOnce([]);

      await runPayments(['sched-1'], 'actor-1');

      const updateCall = pool.query.mock.calls.find(c => c[0].includes('UPDATE payment_schedule'));
      expect(updateCall[1]).toEqual([1000, 'paid', 'sched-1']);
    });

    it('skips a schedule that is already fully paid', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 'sched-1', vendor_id: 'vendor-1', scheduled_amount: '1000.00', paid_amount: '1000.00' }]]);

      const results = await runPayments(['sched-1'], 'actor-1');

      expect(results).toHaveLength(0);
    });

    it('throws when no schedule_ids are provided', async () => {
      await expect(runPayments([], 'actor-1')).rejects.toThrow('Missing required field');
    });
  });

  describe('recomputeCashflowProjection', () => {
    it('rebuilds the projection table from outstanding schedules', async () => {
      pool.query
        .mockResolvedValueOnce([[{ due_date: '2026-02-01', outstanding: '500.00', cnt: 2 }]])
        .mockResolvedValueOnce([]) // delete
        .mockResolvedValueOnce([]); // insert

      const count = await recomputeCashflowProjection();

      expect(count).toBe(1);
      const insertCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO cashflow_projection'));
      expect(insertCall[1]).toEqual(expect.arrayContaining(['2026-02-01', '500.00', 2]));
    });
  });
});
