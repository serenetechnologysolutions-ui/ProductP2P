jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([]) } }));

const { pool } = require('../config/database');
const { emitEvent, onEvent, getEventSubscribers } = require('./eventBus');

describe('eventBus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists every emitted event to event_log', async () => {
    await emitEvent('TEST_EVENT', { module_name: 'test', record_id: 'abc-123', foo: 'bar' });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO event_log'),
      expect.arrayContaining(['TEST_EVENT', 'test', 'abc-123'])
    );
  });

  it('dispatches to a registered in-process subscriber synchronously', async () => {
    const handler = jest.fn();
    onEvent('TEST_DISPATCH', 'unitTestHandler', handler);

    await emitEvent('TEST_DISPATCH', { record_id: 'xyz' });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ record_id: 'xyz' }));
  });

  it('registers subscribers visibly for the admin endpoint', () => {
    onEvent('TEST_VISIBILITY', 'someHandler', () => {});
    const subs = getEventSubscribers();
    expect(subs).toEqual(expect.arrayContaining([{ event_type: 'TEST_VISIBILITY', handler_name: 'someHandler' }]));
  });

  it('does not throw when a subscriber handler rejects', async () => {
    onEvent('TEST_FAILURE', 'failingHandler', () => { throw new Error('boom'); });
    await expect(emitEvent('TEST_FAILURE', {})).resolves.toBeDefined();
  });

  it('still dispatches to listeners even if the event_log insert fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));
    const handler = jest.fn();
    onEvent('TEST_DB_DOWN', 'resilientHandler', handler);

    await emitEvent('TEST_DB_DOWN', {});

    expect(handler).toHaveBeenCalled();
  });
});
