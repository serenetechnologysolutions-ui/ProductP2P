const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { evaluateConditions } = require('../../common/conditions');

// Module 6: Decision Engine expansion — an admin-configurable rules layer
// (decision_rules) sitting alongside, not replacing, the existing
// ProcurementInsightsService/SmartAssistantService hardcoded logic. Reuses
// the same condition shape/evaluator Workflow Engine and Field Configuration
// already use (common/conditions.js), so "if total_value > X" reads
// identically everywhere in the app rather than three different dialects.

async function evaluateDecisionRules(moduleName, context, conn) {
  const c = conn || pool;
  const [rules] = await c.query(
    'SELECT * FROM decision_rules WHERE module_name = ? AND is_active = TRUE ORDER BY priority ASC',
    [moduleName]
  );

  const outputs = [];
  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, context)) continue;

    const template = rule.output_template ? (typeof rule.output_template === 'string' ? JSON.parse(rule.output_template) : rule.output_template) : {};
    const output = { ...template, output_type: rule.output_type, rule_name: rule.rule_name };

    const outputId = uuidv4();
    await c.query(
      'INSERT INTO decision_outputs (id, rule_id, module_name, record_id, output) VALUES (?, ?, ?, ?, ?)',
      [outputId, rule.id, moduleName, context.record_id || null, JSON.stringify(output)]
    );
    outputs.push({ id: outputId, ...output });
  }
  return outputs;
}

module.exports = { evaluateDecisionRules };
