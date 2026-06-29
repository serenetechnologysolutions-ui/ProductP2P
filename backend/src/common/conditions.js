// Shared condition evaluator — a JSON array of {field, operator, value}
// clauses, AND-combined. Used by both the Workflow Engine (conditional
// workflow steps) and Field Configuration (conditional mandatory fields),
// so "value/category/vendor risk" and similar context dimensions are
// evaluated identically everywhere rather than reimplemented per module.
// No rules (null/empty) always passes — every config defined before a given
// feature adopted conditions keeps behaving exactly as it did.
const OPERATORS = {
  '>': (a, b) => Number(a) > Number(b),
  '>=': (a, b) => Number(a) >= Number(b),
  '<': (a, b) => Number(a) < Number(b),
  '<=': (a, b) => Number(a) <= Number(b),
  '=': (a, b) => String(a) === String(b),
  '!=': (a, b) => String(a) !== String(b),
  in: (a, b) => Array.isArray(b) && b.map(String).includes(String(a)),
};

function evaluateConditions(rules, context) {
  if (!rules) return true;
  const parsed = typeof rules === 'string' ? JSON.parse(rules) : rules;
  if (!Array.isArray(parsed) || parsed.length === 0) return true;
  const ctx = context || {};
  return parsed.every(rule => {
    const op = OPERATORS[rule.operator];
    if (!op) return true; // unknown operator — fail open rather than silently blocking
    const actual = ctx[rule.field];
    if (actual == null) return false; // condition references context we weren't given — treat as not matching
    return op(actual, rule.value);
  });
}

module.exports = { evaluateConditions };
