const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { withRetry } = require('../../common/retry');
const { onEvent } = require('../../common/eventBus');
const { mockSapRequest, mockSapPaymentStatusPull, mockSapVendorPull } = require('./sap-mock.service');
const { syncPaymentStatusFromErp } = require('../payments/payments.service');

// Module 4: SAP Connector (mocked) — every outbound sync goes through the
// same path: call the mock SAP service, retry up to 3 times on failure
// (Module 11), log every attempt's outcome to integration_logs (Module 12),
// and let a final failure land in integration_dlq for manual retry. Wired
// to the four named events from the brief (PR_APPROVED/PO_APPROVED/
// GRN_COMPLETED/INVOICE_APPROVED) via the event bus (Module 8) — this module
// doesn't need pr.routes.js, po.routes.js, etc. to know it exists.

async function syncToSap(integrationType, recordId, payload, conn) {
  const c = conn || pool;
  try {
    const response = await withRetry(
      () => mockSapRequest(integrationType, recordId, payload),
      { maxAttempts: 3, integrationType, recordId, payload, conn: c }
    );
    await c.query(
      'INSERT INTO integration_logs (id, integration_type, direction, record_id, request_payload, response_payload, status, attempt_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), integrationType, 'outbound', recordId || null, JSON.stringify(payload), JSON.stringify(response), 'success', 1]
    );
    return response;
  } catch (err) {
    await c.query(
      'INSERT INTO integration_logs (id, integration_type, direction, record_id, request_payload, response_payload, status, attempt_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), integrationType, 'outbound', recordId || null, JSON.stringify(payload), JSON.stringify({ error: err.message }), 'failed', 3]
    );
    // Swallowed deliberately: a failed ERP sync (now sitting in the DLQ for
    // manual retry) must never fail the business action that triggered it —
    // the PR/PO/GRN/Invoice is real either way.
    return null;
  }
}

function registerSapEventSubscribers() {
  onEvent('PR_APPROVED', 'syncPrToSap', (payload) => syncToSap('sap_pr_sync', payload.record_id, payload));
  onEvent('PO_APPROVED', 'syncPoToSap', (payload) => syncToSap('sap_po_sync', payload.record_id, payload));
  onEvent('GRN_COMPLETED', 'syncGrnToSap', (payload) => syncToSap('sap_grn_post', payload.record_id, payload));
  onEvent('INVOICE_APPROVED', 'syncInvoiceToSap', (payload) => syncToSap('sap_invoice_post', payload.record_id, payload));
  onEvent('PAYMENT_COMPLETED', 'syncPaymentToSap', (payload) => syncToSap('sap_payment_status', payload.record_id, payload));
}

// Inbound: pull a payment's status from "SAP" and write it through the
// existing payments service (single write path — see payments.service.js).
async function pullPaymentStatusFromSap(paymentId, conn) {
  const c = conn || pool;
  const [[payment]] = await c.query('SELECT payment_number FROM payments WHERE id = ?', [paymentId]);
  if (!payment) throw new Error('Payment not found');

  const response = await mockSapPaymentStatusPull(payment.payment_number);
  await c.query(
    'INSERT INTO integration_logs (id, integration_type, direction, record_id, response_payload, status) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'sap_payment_status', 'inbound', paymentId, JSON.stringify(response), 'success']
  );
  await syncPaymentStatusFromErp(paymentId, response.status, c);
  return response;
}

// Bi-directional vendor sync.
async function pushVendorToSap(vendorId, conn) {
  const c = conn || pool;
  const [[vendor]] = await c.query('SELECT id, vendor_code, vendor_name, gst_number FROM vendors WHERE id = ?', [vendorId]);
  if (!vendor) throw new Error('Vendor not found');
  return syncToSap('sap_vendor_sync', vendorId, vendor, c);
}

async function pullVendorFromSap(sapVendorCode, conn) {
  const c = conn || pool;
  const response = await mockSapVendorPull(sapVendorCode);
  await c.query(
    'INSERT INTO integration_logs (id, integration_type, direction, response_payload, status) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), 'sap_vendor_sync', 'inbound', JSON.stringify(response), 'success']
  );
  return response;
}

module.exports = {
  registerSapEventSubscribers,
  syncToSap,
  pullPaymentStatusFromSap,
  pushVendorToSap,
  pullVendorFromSap,
};
