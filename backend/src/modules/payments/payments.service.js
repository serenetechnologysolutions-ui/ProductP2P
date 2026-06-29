const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { getSetting } = require('../pr/pr.helpers');
const { onEvent, emitEvent } = require('../../common/eventBus');

// Module 2: Payment Lifecycle — Invoice -> Payment Due -> Payment Run -> Bank -> Reconciliation.
// Scheduling is event-driven off INVOICE_APPROVED (Module 8) rather than a
// direct call from invoice.service.js, so neither module needs to know
// about the other.

async function autoPaymentNumber(conn) {
  const c = conn || pool;
  const [[{ maxNum }]] = await c.query(
    "SELECT MAX(CAST(SUBSTRING(payment_number, 5) AS UNSIGNED)) as maxNum FROM payments WHERE payment_number LIKE 'PAY-%'"
  );
  return `PAY-${String((maxNum || 0) + 1).padStart(6, '0')}`;
}

async function scheduleInvoicePayment(payload, conn) {
  const c = conn || pool;
  const [[invoice]] = await c.query('SELECT * FROM invoices WHERE id = ?', [payload.record_id]);
  if (!invoice) return;

  const [existing] = await c.query('SELECT id FROM payment_schedule WHERE invoice_id = ?', [invoice.id]);
  if (existing.length > 0) return; // already scheduled — idempotent

  const termsDays = Number(await getSetting('payment_terms_days', '30', c));
  const baseDate = new Date(invoice.invoice_date || invoice.created_at);
  baseDate.setDate(baseDate.getDate() + termsDays);
  const dueDate = baseDate.toISOString().slice(0, 10);

  await c.query(
    'INSERT INTO payment_schedule (id, invoice_id, vendor_id, due_date, scheduled_amount) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), invoice.id, invoice.vendor_id, dueDate, invoice.total_amount]
  );
  // The invoice itself is the point the payable obligation is recognized —
  // a debit (increases what we owe this vendor) until a payment credits it.
  await recordLedgerEntry(invoice.vendor_id, 'invoice', invoice.id, invoice.total_amount, 0, c);
}

// Registered once at app startup (see payments.routes.js's require side-effect).
function registerPaymentEventSubscribers() {
  onEvent('INVOICE_APPROVED', 'scheduleInvoicePayment', (payload) => scheduleInvoicePayment(payload));
}

async function markOverdueSchedules(conn) {
  const c = conn || pool;
  await c.query(
    "UPDATE payment_schedule SET status = 'overdue' WHERE status IN ('pending','partial') AND due_date < CURDATE()"
  );
}

// A "Payment Run" pays a batch of schedule rows in one go — each gets its
// own payments row (so partial/multiple payments per schedule are normal,
// not an edge case) and a paired vendor_ledger entry.
async function runPayments(scheduleIds, actorId, conn) {
  const c = conn || pool;
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw new ValidationError('Missing required field', ['schedule_ids']);
  }

  const results = [];
  for (const scheduleId of scheduleIds) {
    const [[schedule]] = await c.query('SELECT * FROM payment_schedule WHERE id = ?', [scheduleId]);
    if (!schedule) continue;
    const outstanding = Number(schedule.scheduled_amount) - Number(schedule.paid_amount);
    if (outstanding <= 0) continue;

    const paymentId = uuidv4();
    const paymentNumber = await autoPaymentNumber(c);
    await c.query(
      'INSERT INTO payments (id, payment_number, payment_schedule_id, vendor_id, amount, payment_date, status, created_by) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?)',
      [paymentId, paymentNumber, scheduleId, schedule.vendor_id, outstanding, 'completed', actorId]
    );

    const newPaid = Number(schedule.paid_amount) + outstanding;
    const newStatus = newPaid >= Number(schedule.scheduled_amount) ? 'paid' : 'partial';
    await c.query('UPDATE payment_schedule SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, scheduleId]);

    await recordLedgerEntry(schedule.vendor_id, 'payment', paymentId, 0, outstanding, c);
    await emitEvent('PAYMENT_COMPLETED', { module_name: 'payments', record_id: paymentId, payment_number: paymentNumber, vendor_id: schedule.vendor_id, amount: outstanding }, c);

    results.push({ payment_id: paymentId, payment_number: paymentNumber, schedule_id: scheduleId, amount: outstanding });
  }
  return results;
}

async function reconcilePayment(paymentId, bankReference, conn) {
  const c = conn || pool;
  const [[payment]] = await c.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  if (!payment) throw new NotFoundError('Payment not found');
  await c.query("UPDATE payments SET status = 'reconciled', bank_reference = ? WHERE id = ?", [bankReference || null, paymentId]);
  return { ...payment, status: 'reconciled', bank_reference: bankReference || null };
}

// Mock ERP push: when the (mocked) SAP connector reports a payment's status
// back, this is the single write path for it — Module 4 calls this, not the
// other way around, keeping the connector a thin caller of payments, not the
// other way around.
async function syncPaymentStatusFromErp(paymentId, status, conn) {
  const c = conn || pool;
  const validStatuses = ['processing', 'completed', 'failed', 'reconciled'];
  if (!validStatuses.includes(status)) throw new ValidationError(`Invalid status: ${status}`);
  const [existing] = await c.query('SELECT id FROM payments WHERE id = ?', [paymentId]);
  if (existing.length === 0) throw new NotFoundError('Payment not found');
  await c.query('UPDATE payments SET status = ? WHERE id = ?', [status, paymentId]);
}

async function recordLedgerEntry(vendorId, transactionType, referenceId, debit, credit, conn) {
  const c = conn || pool;
  const [[{ lastBalance }]] = await c.query(
    'SELECT COALESCE((SELECT running_balance FROM vendor_ledger WHERE vendor_id = ? ORDER BY created_at DESC, id DESC LIMIT 1), 0) as lastBalance',
    [vendorId]
  );
  const newBalance = Number(lastBalance) + Number(debit) - Number(credit);
  await c.query(
    'INSERT INTO vendor_ledger (id, vendor_id, transaction_type, reference_id, debit, credit, running_balance, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())',
    [uuidv4(), vendorId, transactionType, referenceId, debit, credit, newBalance]
  );
}

async function recomputeCashflowProjection(conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    `SELECT due_date, SUM(scheduled_amount - paid_amount) as outstanding, COUNT(*) as cnt
     FROM payment_schedule WHERE status IN ('pending','partial','overdue') GROUP BY due_date`
  );
  await c.query('DELETE FROM cashflow_projection');
  for (const row of rows) {
    await c.query(
      'INSERT INTO cashflow_projection (id, bucket_date, expected_outflow, schedule_count) VALUES (?, ?, ?, ?)',
      [uuidv4(), row.due_date, row.outstanding, row.cnt]
    );
  }
  return rows.length;
}

module.exports = {
  registerPaymentEventSubscribers,
  scheduleInvoicePayment,
  markOverdueSchedules,
  runPayments,
  reconcilePayment,
  syncPaymentStatusFromErp,
  recordLedgerEntry,
  recomputeCashflowProjection,
};
