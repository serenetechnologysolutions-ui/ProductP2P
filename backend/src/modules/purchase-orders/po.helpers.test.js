jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../../config/database');
const { recomputePoFulfillmentStatus } = require('./po.helpers');

describe('recomputePoFulfillmentStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets status to open when nothing has been fulfilled', async () => {
    pool.query
      .mockResolvedValueOnce([[{ quantity: '10.000', fulfilled_quantity: '0.000' }]])
      .mockResolvedValueOnce([]);

    await recomputePoFulfillmentStatus('po-1');

    expect(pool.query).toHaveBeenLastCalledWith(
      "UPDATE purchase_orders SET status = ? WHERE id = ? AND status != 'closed'",
      ['open', 'po-1']
    );
  });

  it('sets status to partially_fulfilled when some but not all lines are short', async () => {
    pool.query
      .mockResolvedValueOnce([[
        { quantity: '10.000', fulfilled_quantity: '10.000' },
        { quantity: '5.000', fulfilled_quantity: '2.000' },
      ]])
      .mockResolvedValueOnce([]);

    await recomputePoFulfillmentStatus('po-2');

    expect(pool.query).toHaveBeenLastCalledWith(
      "UPDATE purchase_orders SET status = ? WHERE id = ? AND status != 'closed'",
      ['partially_fulfilled', 'po-2']
    );
  });

  it('sets status to fulfilled when every line meets or exceeds its ordered quantity', async () => {
    pool.query
      .mockResolvedValueOnce([[
        { quantity: '10.000', fulfilled_quantity: '10.000' },
        { quantity: '5.000', fulfilled_quantity: '5.000' },
      ]])
      .mockResolvedValueOnce([]);

    await recomputePoFulfillmentStatus('po-3');

    expect(pool.query).toHaveBeenLastCalledWith(
      "UPDATE purchase_orders SET status = ? WHERE id = ? AND status != 'closed'",
      ['fulfilled', 'po-3']
    );
  });

  it('never reopens a PO that is already closed (guarded in the UPDATE itself)', async () => {
    pool.query
      .mockResolvedValueOnce([[{ quantity: '10.000', fulfilled_quantity: '0.000' }]])
      .mockResolvedValueOnce([]);

    await recomputePoFulfillmentStatus('po-4');

    const updateCall = pool.query.mock.calls[1];
    expect(updateCall[0]).toContain("status != 'closed'");
  });

  it('does nothing when the PO has no line items', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    await recomputePoFulfillmentStatus('po-5');

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('uses the provided connection instead of the pool when one is passed', async () => {
    const conn = { query: jest.fn() };
    conn.query
      .mockResolvedValueOnce([[{ quantity: '1.000', fulfilled_quantity: '1.000' }]])
      .mockResolvedValueOnce([]);

    await recomputePoFulfillmentStatus('po-6', conn);

    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
