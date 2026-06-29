const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');

// Contract Consumption Tracking. contract_value is the cap (nullable — a
// contract with no value cap is open/unlimited), consumed_value accumulates
// as POs are created against it, remaining_value is always computed rather
// than stored, so the two numbers can never drift out of sync.

async function getContractOrThrow(contractId, conn) {
  const c = conn || pool;
  const [[contract]] = await c.query('SELECT * FROM contracts WHERE id = ?', [contractId]);
  if (!contract) throw new NotFoundError('Contract not found');
  return contract;
}

function computeRemainingValue(contract) {
  if (contract.contract_value == null) return null; // uncapped contract
  return Number(contract.contract_value) - Number(contract.consumed_value);
}

// Enforce Contract Usage — called before a PO is actually created against a
// contract: the contract must be active, within its validity window, and
// (if value-capped) this PO must not push consumption past contract_value.
async function assertContractUsable(contractId, poAmount, conn) {
  const contract = await getContractOrThrow(contractId, conn);
  if (contract.status !== 'active') throw new ValidationError(`Contract ${contract.contract_number} is not active (status: ${contract.status})`);

  const today = new Date();
  if (today < new Date(contract.start_date) || today > new Date(contract.end_date)) {
    throw new ValidationError(`Contract ${contract.contract_number} is outside its validity period`);
  }

  const remaining = computeRemainingValue(contract);
  if (remaining != null && Number(poAmount) > remaining) {
    throw new ValidationError(`PO amount ${poAmount} exceeds the contract's remaining value (${remaining}) on ${contract.contract_number}`);
  }
  return contract;
}

// Update on PO creation — the other half of enforcement, called right after
// a PO is actually inserted against a contract.
async function recordContractConsumption(contractId, amount, conn) {
  if (!contractId || !amount) return;
  const c = conn || pool;
  await c.query('UPDATE contracts SET consumed_value = consumed_value + ? WHERE id = ?', [amount, contractId]);
}

async function getContractConsumption(contractId, conn) {
  const contract = await getContractOrThrow(contractId, conn);
  return {
    contract_id: contract.id,
    contract_number: contract.contract_number,
    contract_value: contract.contract_value,
    consumed_value: contract.consumed_value,
    remaining_value: computeRemainingValue(contract),
    default_unit_price: contract.default_unit_price,
  };
}

module.exports = {
  getContractOrThrow,
  computeRemainingValue,
  assertContractUsable,
  recordContractConsumption,
  getContractConsumption,
};
