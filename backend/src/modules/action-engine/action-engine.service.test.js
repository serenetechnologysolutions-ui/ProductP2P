jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../../config/database');
const { getNextBestActionsForPr, evaluateActionRules } = require('./action-engine.service');

describe('getNextBestActionsForPr', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recommends creating an RFQ when approved, RFQ_REQUIRED, and no RFQ exists yet', async () => {
    pool.query
      .mockResolvedValueOnce([[{ rfqCount: 0 }]])
      .mockResolvedValueOnce([[]]); // no admin action_rules

    const actions = await getNextBestActionsForPr({ id: 'pr-1', status: 'approved', sourcing_strategy: 'RFQ_REQUIRED', total_value: 1000 });

    expect(actions).toEqual(expect.arrayContaining([expect.objectContaining({ recommended_action: 'create_rfq' })]));
  });

  it('does not recommend an RFQ when one already exists', async () => {
    pool.query
      .mockResolvedValueOnce([[{ rfqCount: 1 }]])
      .mockResolvedValueOnce([[]]);

    const actions = await getNextBestActionsForPr({ id: 'pr-1', status: 'approved', sourcing_strategy: 'RFQ_REQUIRED', total_value: 1000 });

    expect(actions.find(a => a.recommended_action === 'create_rfq')).toBeUndefined();
  });

  it('does not check for an RFQ at all when sourcing strategy is not RFQ_REQUIRED', async () => {
    pool.query.mockResolvedValueOnce([[]]); // only the admin action_rules query runs

    await getNextBestActionsForPr({ id: 'pr-1', status: 'approved', sourcing_strategy: 'DIRECT_PO_ALLOWED', total_value: 1000 });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('includes matching admin-defined action_rules alongside the built-in check', async () => {
    pool.query
      .mockResolvedValueOnce([[{ rfqCount: 1 }]]) // RFQ already exists, built-in check produces nothing
      .mockResolvedValueOnce([[{ recommended_action: 'flag_for_review', action_payload: JSON.stringify({ message: 'High value PR' }), rule_name: 'admin rule', conditions: JSON.stringify([{ field: 'total_value', operator: '>', value: 500 }]) }]]);

    const actions = await getNextBestActionsForPr({ id: 'pr-1', status: 'approved', sourcing_strategy: 'RFQ_REQUIRED', total_value: 1000 });

    expect(actions).toEqual([expect.objectContaining({ recommended_action: 'flag_for_review', message: 'High value PR' })]);
  });
});

describe('evaluateActionRules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns nothing when no rules match the trigger event', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const actions = await evaluateActionRules('SOME_EVENT', {});
    expect(actions).toEqual([]);
  });
});
