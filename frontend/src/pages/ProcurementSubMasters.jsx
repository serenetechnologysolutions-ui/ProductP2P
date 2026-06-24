import { Tabs, Typography } from 'antd';
import SubMasterTab from '../components/SubMasterTab';

const { Title, Text } = Typography;

const CATEGORIES = [
  // ── Item Master ──
  { key: 'item_category', label: 'Item Categories' },
  { key: 'item_subcategory', label: 'Item Subcategories' },
  { key: 'uom', label: 'Units of Measure' },

  // ── Org / Plant / Cost Assignment ──
  { key: 'plant', label: 'Plants' },
  { key: 'cost_center', label: 'Cost Centers' },
  { key: 'storage_location', label: 'Storage Locations' },

  // ── Sourcing & Procurement ──
  { key: 'procurement_category', label: 'Procurement Categories' },
  { key: 'rfq_type', label: 'RFQ Types' },
  { key: 'document_type', label: 'PR Document Types' },
  { key: 'priority', label: 'Priorities' },
  { key: 'account_assignment_category', label: 'Account Assignment Categories' },
  { key: 'currency', label: 'Currencies' },
  { key: 'incoterms', label: 'Incoterms' },

  // ── Logistics & Support ──
  { key: 'shipment_mode', label: 'Shipment Modes' },
  { key: 'ticket_category', label: 'Ticket Categories' },
];

export default function ProcurementSubMasters() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Sub Masters</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage procurement-related lookup data — item classification, sourcing/PR/PO reference fields, and logistics dropdowns.</Text>
      <Tabs items={CATEGORIES.map(c => ({ key: c.key, label: c.label, children: <SubMasterTab category={c.key} /> }))} type="card" />
    </div>
  );
}
