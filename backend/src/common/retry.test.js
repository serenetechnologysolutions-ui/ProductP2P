jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../config/database');
const { withRetry, retryDlqEntry } = require('./retry');

describe('withRetry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the result on the first successful attempt without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { integrationType: 'test', recordId: 'r1' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('retries up to maxAttempts and succeeds on a later attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok-on-retry');

    const result = await withRetry(fn, { maxAttempts: 3, integrationType: 'test', recordId: 'r1' });

    expect(result).toBe('ok-on-retry');
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it('writes to the dead-letter queue and re-throws after exhausting all attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permanent failure'));

    await expect(withRetry(fn, { maxAttempts: 2, integrationType: 'test', recordId: 'r1', payload: { foo: 'bar' } }))
      .rejects.toThrow('permanent failure');

    expect(fn).toHaveBeenCalledTimes(2);
    const dlqInsert = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO integration_dlq'));
    expect(dlqInsert[1]).toEqual(expect.arrayContaining(['test', 'r1', JSON.stringify({ foo: 'bar' }), 'permanent failure', 2]));
  }, 10000);
});

describe('retryDlqEntry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks the entry resolved when the retry succeeds', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'dlq-1', resolved: 0, payload: JSON.stringify({ a: 1 }) }]])
      .mockResolvedValueOnce([]);

    const fn = jest.fn().mockResolvedValue('done');
    const result = await retryDlqEntry('dlq-1', fn);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledWith({ a: 1 });
    const updateCall = pool.query.mock.calls.find(c => c[0].includes('resolved = TRUE'));
    expect(updateCall[1]).toEqual(['dlq-1']);
  });

  it('throws if the entry was already resolved', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 'dlq-1', resolved: 1, payload: null }]]);
    await expect(retryDlqEntry('dlq-1', jest.fn())).rejects.toThrow('already been resolved');
  });

  it('throws if the entry does not exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(retryDlqEntry('missing', jest.fn())).rejects.toThrow('not found');
  });

  it('increments retry_count and re-throws when the retry itself fails again', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'dlq-1', resolved: 0, payload: null }]])
      .mockResolvedValueOnce([]);

    const fn = jest.fn().mockRejectedValue(new Error('still failing'));
    await expect(retryDlqEntry('dlq-1', fn)).rejects.toThrow('still failing');

    const updateCall = pool.query.mock.calls.find(c => c[0].includes('retry_count = retry_count + 1'));
    expect(updateCall[1]).toEqual(['still failing', 'dlq-1']);
  });
});
