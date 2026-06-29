import { useEffect, useState, useCallback } from 'react';
import { Table, Select, Tag, Card, Row, Col } from 'antd';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import notify from '../utils/notify';

const TYPE_OPTIONS = [
  { value: 'rfq', label: 'RFQs Participated' },
  { value: 'purchase_order', label: 'Purchase Orders Received' },
  { value: 'asn', label: 'ASNs Submitted' },
];

const COLUMNS = {
  rfq: [
    { title: 'RFQ Number', dataIndex: 'rfq_number', width: 160, sorter: (a, b) => String(a.rfq_number || '').localeCompare(String(b.rfq_number || ''), undefined, { numeric: true }) },
    { title: 'Title', dataIndex: 'title', ellipsis: true, sorter: (a, b) => String(a.title || '').localeCompare(String(b.title || '')) },
    {
      title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag>{(v || '').toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: ['draft', 'published', 'closed', 'negotiation', 'awarded'].map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Participation', dataIndex: 'participation_status', width: 140, render: v => <Tag color={v === 'submitted' ? 'green' : v === 'not_responded' ? 'red' : 'blue'}>{(v || '').replace('_', ' ').toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.participation_status || '').localeCompare(String(b.participation_status || '')),
    },
    { title: 'Invited', dataIndex: 'invited_at', width: 130, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—', sorter: (a, b) => new Date(a.invited_at || 0) - new Date(b.invited_at || 0) },
  ],
  purchase_order: [
    { title: 'PO Number', dataIndex: 'po_number', width: 160, sorter: (a, b) => String(a.po_number || '').localeCompare(String(b.po_number || ''), undefined, { numeric: true }) },
    {
      title: 'Status', dataIndex: 'status', width: 140, render: v => <Tag>{(v || '').replace('_', ' ').toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: ['open', 'partially_fulfilled', 'fulfilled', 'closed'].map(v => ({ text: v.replace('_', ' ').toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    { title: 'Total Value', dataIndex: 'total_value', width: 140, render: v => v != null ? Number(v).toFixed(2) : '—', sorter: (a, b) => Number(a.total_value || 0) - Number(b.total_value || 0) },
    { title: 'Created', dataIndex: 'created_at', width: 130, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—', sorter: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
  ],
  asn: [
    { title: 'ASN Number', dataIndex: 'asn_number', width: 160, sorter: (a, b) => String(a.asn_number || '').localeCompare(String(b.asn_number || ''), undefined, { numeric: true }) },
    {
      title: 'Status', dataIndex: 'status', width: 140, render: v => <Tag>{(v || '').toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: ['draft', 'submitted', 'validated', 'posted', 'rejected'].map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    { title: 'Created', dataIndex: 'created_at', width: 130, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—', sorter: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
  ],
};

// Vendor Portal 2.0 — self-service transaction history (RFQs participated,
// POs received, ASNs submitted), each filtered and paginated server-side via
// GET /vendor-portal/transactions. Read-only — does not touch the existing
// ASN/RFQ submission flows those records were created through.
export default function VendorPortalTransactions() {
  const [type, setType] = useState('rfq');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback((page = 1) => {
    setLoading(true);
    api.get('/vendor-portal/transactions', { params: { type, page, limit: pagination.limit } })
      .then(res => {
        setRows(res.data?.data || []);
        setPagination(prev => ({ ...prev, page, total: res.data?.pagination?.total || 0 }));
      })
      .catch(() => notify.error('Could not load your transactions'))
      .finally(() => setLoading(false));
  }, [type, pagination.limit]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'My Portal' }, { title: 'Transactions' }]}
        title="My Transactions"
        subtitle="Your history across RFQs, purchase orders, and ASNs."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col span={6}>
            <Select style={{ width: '100%' }} value={type} onChange={setType} options={TYPE_OPTIONS} />
          </Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={COLUMNS[type]}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 600 }}
          pagination={{ current: pagination.page, pageSize: pagination.limit, total: pagination.total, onChange: fetchRows }}
        />
      </Card>
    </div>
  );
}
