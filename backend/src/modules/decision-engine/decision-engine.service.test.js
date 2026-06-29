jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../../config/database');
const { evaluateDecisionRules } = require('./decision-engine.service');

describe('evaluateDecisionRules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('produces an output and stores it when a rule\'s conditions match', async () => {
    pool.query
      .mockResolvedValueOnce([[{
        id: 'rule-1', rule_name: 'High value', conditions: JSON.stringify([{ field: 'total_value', operator: '>', value: 100 }]),
        output_type: 'cost_insight', output_template: JSON.stringify({ message: 'flagged' }),
      }]])
      .mockResolvedValueOnce([]); // insert decision_outputs

    const outputs = await evaluateDecisionRules('pr', { record_id: 'pr-1', total_value: 500 });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toEqual(expect.objectContaining({ message: 'flagged', output_type: 'cost_insight', rule_name: 'High value' }));
    const insertCall = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO decision_outputs'));
    expect(insertCall[1]).toEqual(expect.arrayContaining(['rule-1', 'pr', 'pr-1']));
  });

  it('skips a rule whose conditions do not match', async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 'rule-1', rule_name: 'High value', conditions: JSON.stringify([{ field: 'total_value', operator: '>', value: 100000 }]),
      output_type: 'cost_insight', output_template: null,
    }]]);

    const outputs = await evaluateDecisionRules('pr', { record_id: 'pr-1', total_value: 500 });

    expect(outputs).toHaveLength(0);
    expect(pool.query).toHaveBeenCalledTimes(1); // no decision_outputs insert
  });

  it('treats a rule with no conditions as always matching', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 'rule-1', rule_name: 'Always', conditions: null, output_type: 'risk_alert', output_template: null }]])
      .mockResolvedValueOnce([]);

    const outputs = await evaluateDecisionRules('pr', { record_id: 'pr-1' });

    expect(outputs).toHaveLength(1);
  });

  it('only evaluates active rules for the requested module (filtered server-side by the query itself)', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const outputs = await evaluateDecisionRules('invoice', {});

    expect(outputs).toEqual([]);
    expect(pool.query.mock.calls[0][1]).toEqual(['invoice']);
  });
});
