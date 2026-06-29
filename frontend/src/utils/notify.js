import { message } from 'antd';

// Opt-in structured wrapper around antd's message API for new components
// (SmartAssistantPanel, Vendor Portal 2.0, and anything else built going
// forward). It intentionally does NOT replace the message.error/success
// calls already scattered across the existing pages — swapping those out
// page-by-page is a separate, isolated migration each page owner can opt
// into later; doing it as one sweeping change here would touch dozens of
// files for a purely cosmetic gain and is exactly the kind of broad,
// non-isolated change the rest of this feature set was built to avoid.
//
// Usage: notify.success('PO amendment proposed'); notify.error('Could not
// resolve exception', err.response?.data?.error);
function buildContent(title, detail) {
  return detail ? `${title} — ${detail}` : title;
}

export const notify = {
  success: (title, detail) => message.success(buildContent(title, detail)),
  error: (title, detail) => message.error(buildContent(title, detail)),
  warning: (title, detail) => message.warning(buildContent(title, detail)),
  info: (title, detail) => message.info(buildContent(title, detail)),
};

export default notify;
