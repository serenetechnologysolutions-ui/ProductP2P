const { pool } = require('../../config/database');
const { evaluateConditions } = require('../../common/conditions');

// Module 7: Next Best Action engine — "pull" style (computed live from the
// record's current state), so it plugs directly into the existing
// DecisionPanel/SmartAssistantService "Recommendations" bucket rather than
// needing its own UI surface. Includes the brief's own worked example
// (PR approved, RFQ required, no RFQ created yet -> suggest RFQ) as a
// concrete built-in check, plus evaluation of any admin-defined action_rules
// for the same trigger event.

async function getNextBestActionsForPr(pr, conn) {
  const c = conn || pool;
  const actions = [];

  if (['approved', 'partially_approved'].includes(pr.status) && pr.sourcing_strategy === 'RFQ_REQUIRED') {
    const [[{ rfqCount }]] = await c.query('SELECT COUNT(*) as rfqCount FROM rfqs WHERE pr_id = ?', [pr.id]);
    if (rfqCount === 0) {
      actions.push({
        recommended_action: 'create_rfq',
        message: 'This requisition is approved and requires RFQ sourcing, but no RFQ has been created yet.',
        rule_name: 'built_in:pr_approved_rfq_required_no_rfq',
      });
    }
  }

  const context = { status: pr.status, sourcing_strategy: pr.sourcing_strategy, total_value: pr.total_value };
  const adminActions = await evaluateActionRules('PR_APPROVED', context, c);
  actions.push(...adminActions);

  return actions;
}

async function evaluateActionRules(triggerEvent, context, conn) {
  const c = conn || pool;
  const [rules] = await c.query(
    'SELECT * FROM action_rules WHERE trigger_event = ? AND is_active = TRUE ORDER BY priority ASC',
    [triggerEvent]
  );

  const matched = [];
  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, context)) continue;
    const payload = rule.action_payload ? (typeof rule.action_payload === 'string' ? JSON.parse(rule.action_payload) : rule.action_payload) : {};
    matched.push({ recommended_action: rule.recommended_action, message: payload.message || rule.rule_name, rule_name: rule.rule_name, ...payload });
  }
  return matched;
}

module.exports = { getNextBestActionsForPr, evaluateActionRules };
