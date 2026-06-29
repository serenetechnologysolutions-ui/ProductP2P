// The "SAP side" of the connector — a pure simulation (Module 13's "Mock
// services: SAP simulation" requirement), since there is no real SAP system
// to integrate with. Always succeeds by default; forceFailure lets a test
// (or an admin exercising the retry/DLQ path deliberately) make it fail on
// purpose without touching the real connector logic.
let forceFailure = false;

function setMockFailureMode(on) {
  forceFailure = !!on;
}

async function mockSapRequest(integrationType, recordId, payload) {
  // A real connector would await an HTTP/RFC/OData call here; this just
  // simulates network latency and an ack so the rest of the pipeline
  // (logging, retry, DLQ) behaves exactly as it would against a real system.
  await new Promise(r => setTimeout(r, 10));
  if (forceFailure) {
    throw new Error(`Mock SAP rejected ${integrationType} for ${recordId}`);
  }
  return { sap_document_number: `SAP-${integrationType.toUpperCase()}-${Date.now()}`, status: 'acknowledged' };
}

// Inbound mocks — "SAP" reporting something back to us.
async function mockSapPaymentStatusPull(paymentReference) {
  await new Promise(r => setTimeout(r, 10));
  return { reference: paymentReference, status: 'completed' };
}

async function mockSapVendorPull(sapVendorCode) {
  await new Promise(r => setTimeout(r, 10));
  return { sap_vendor_code: sapVendorCode, vendor_name: `Vendor ${sapVendorCode}`, status: 'active' };
}

module.exports = { mockSapRequest, mockSapPaymentStatusPull, mockSapVendorPull, setMockFailureMode };
