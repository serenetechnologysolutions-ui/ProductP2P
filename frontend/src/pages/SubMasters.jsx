import { Tabs, Typography } from 'antd';
import SubMasterTab from '../components/SubMasterTab';

const { Title, Text } = Typography;

const CATEGORIES = [
  // ── Vendor classification ──
  { key: 'department', label: 'Departments' },
  { key: 'supplier_group', label: 'Supplier Groups' },
  { key: 'supplier_category', label: 'Categories' },
  { key: 'vendor_type', label: 'Vendor Types' },
  { key: 'industry', label: 'Industries' },
  { key: 'registration_type', label: 'Registration Types' },
  { key: 'msme_type', label: 'MSME Types' },
  { key: 'payment_terms', label: 'Payment Terms' },

  // ── Geography ──
  { key: 'country', label: 'Countries' },
  { key: 'state', label: 'States' },
  { key: 'city', label: 'Cities' },

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
  { key: 'hsn_code', label: 'HSN Codes' },
  { key: 'document_type', label: 'PR Document Types' },
  { key: 'priority', label: 'Priorities' },
  { key: 'account_assignment_category', label: 'Account Assignment' },
  { key: 'currency', label: 'Currencies' },
  { key: 'incoterms', label: 'Incoterms' },

  // ── Logistics ──
  { key: 'shipment_mode', label: 'Shipment Modes' },
  { key: 'ticket_category', label: 'Ticket Categories' },
];

export default function SubMasters() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Sub Masters</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage vendor-related lookup data — companies, departments, supplier groups, classification, and locations.</Text>
      <Tabs items={CATEGORIES.map(c => ({ key: c.key, label: c.label, children: <SubMasterTab category={c.key} /> }))} type="card" />
    </div>
  );
}
