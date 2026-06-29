import { Fragment, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Statistic, Input, Button, Tag, Space, Typography, message, Timeline, Empty } from 'antd';
import {
  SearchOutlined, ArrowRightOutlined, FileTextOutlined, ReconciliationOutlined,
  SolutionOutlined, FileProtectOutlined, AuditOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;

const TYPE_META = {
  purchase_requisition: { label: 'Purchase Requisition', icon: <FileTextOutlined />, color: '#1890ff', route: (id) => `/purchase-requisitions?id=${id}` },
  rfq: { label: 'RFQ', icon: <ReconciliationOutlined />, color: '#722ed1', route: (id) => `/rfq?id=${id}` },
  purchase_order: { label: 'Purchase Order', icon: <SolutionOutlined />, color: '#13c2c2', route: (id) => `/purchase-orders?id=${id}` },
  asn: { label: 'ASN', icon: <FileProtectOutlined />, color: '#fa8c16', route: (id) => `/asns?id=${id}` },
  goods_receipt_note: { label: 'GRN', icon: <AuditOutlined />, color: '#52c41a', route: (id, doc) => `/asns?id=${doc.asn_id}` },
  invoice: { label: 'Invoice', icon: <FileDoneOutlined />, color: '#eb2f96', route: (id, doc) => `/asns?id=${doc.asn_id}` },
};

const STATUS_COLOR = {
  draft: 'default', submitted: 'blue', under_review: 'orange', approved: 'green', partially_approved: 'green', rejected: 'red',
  sourcing: 'cyan', closed: 'orange', published: 'blue', negotiation: 'purple', awarded: 'green',
  open: 'blue', partially_fulfilled: 'orange', fulfilled: 'green',
  validated: 'orange', posted: 'green', exception: 'red', completed: 'green', pending: 'default', matched: 'green', blocked: 'red',
};

function NodeCard({ type, doc, numberField, onOpen }) {
  const meta = TYPE_META[type];
  return (
    <Card
      size="small"
      hoverable
      onClick={() => onOpen(type, doc)}
      style={{ marginBottom: 8, borderLeft: `3px solid ${meta.color}` }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Space size={6}>{meta.icon}<Text strong style={{ fontSize: 13 }}>{doc[numberField]}</Text></Space>
        <Tag color={STATUS_COLOR[doc.status] || 'default'} style={{ marginTop: 2 }}>{(doc.status || '').replace('_', ' ').toUpperCase() || '—'}</Tag>
      </Space>
    </Card>
  );
}

function FlowColumn({ title, type, docs, numberField, onOpen }) {
  if (!docs || docs.length === 0) return null;
  return (
    <Col flex="1 1 160px" style={{ minWidth: 160 }}>
      <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{title} ({docs.length})</Text>
      <div style={{ marginTop: 8 }}>
        {docs.map(doc => <NodeCard key={doc.id} type={type} doc={doc} numberField={numberField} onOpen={onOpen} />)}
      </div>
    </Col>
  );
}

export default function TraceabilityView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [lookupId, setLookupId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTraceability = useCallback(async (id) => {
    if (!id || !id.trim()) { message.error('Enter a document ID'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/traceability/${id.trim()}`);
      setData(res.data.data);
    } catch (err) {
      setData(null);
      message.error(err.response?.data?.error || 'Document not found in any traceable module');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) { setLookupId(deepLinkId); fetchTraceability(deepLinkId); }
  }, [searchParams, fetchTraceability]);

  const onOpenNode = (type, doc) => {
    const meta = TYPE_META[type];
    navigate(meta.route(doc.id, doc));
  };

  const columns = data ? [
    { title: 'Purchase Requisitions', type: 'purchase_requisition', docs: data.documents.purchase_requisitions, numberField: 'pr_number' },
    { title: 'RFQs', type: 'rfq', docs: data.documents.rfqs, numberField: 'rfq_number' },
    { title: 'Purchase Orders', type: 'purchase_order', docs: data.documents.purchase_orders, numberField: 'po_number' },
    { title: 'ASNs', type: 'asn', docs: data.documents.asns, numberField: 'asn_number' },
    { title: 'GRNs', type: 'goods_receipt_note', docs: data.documents.goods_receipt_notes, numberField: 'grn_number' },
    { title: 'Invoices', type: 'invoice', docs: data.documents.invoices, numberField: 'invoice_number' },
  ].filter(c => c.docs && c.docs.length > 0) : [];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Governance' }, { title: 'Traceability' }]}
        title="Document Traceability"
        subtitle="Look up any PR, RFQ, PO, ASN, GRN, or Invoice id to see its full procure-to-pay chain — every related document, how they connect, and a chronological timeline."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 520 }}>
          <Input
            placeholder="Enter a PR / RFQ / PO / ASN / GRN / Invoice ID"
            value={lookupId}
            onChange={e => setLookupId(e.target.value)}
            onPressEnter={() => fetchTraceability(lookupId)}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => fetchTraceability(lookupId)}>Trace</Button>
        </Space.Compact>
      </Card>

      {!data && !loading && <Empty description="Enter a document ID above to view its full traceability chain" />}

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}><Card size="small"><Statistic title="PRs" value={data.summary.purchase_requisition_count} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="RFQs" value={data.summary.rfq_count} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="POs" value={data.summary.purchase_order_count} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="ASNs" value={data.summary.asn_count} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="Total PO Value" value={data.summary.total_po_value} precision={0} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="Total ASN Value" value={data.summary.total_asn_value} precision={0} /></Card></Col>
          </Row>

          <Card title="Document Flow" size="small" style={{ marginBottom: 16 }}>
            <Row align="top" wrap gutter={4} style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
              {columns.map((col, i) => (
                <Fragment key={col.type}>
                  <FlowColumn title={col.title} type={col.type} docs={col.docs} numberField={col.numberField} onOpen={onOpenNode} />
                  {i < columns.length - 1 && (
                    <Col flex="0 0 32px" style={{ textAlign: 'center', paddingTop: 24 }}>
                      <ArrowRightOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />
                    </Col>
                  )}
                </Fragment>
              ))}
            </Row>
          </Card>

          <Card title="Timeline" size="small">
            <Timeline
              items={(data.timeline || []).map(ev => ({
                color: TYPE_META[ev.type]?.color,
                children: (
                  <Space direction="vertical" size={0}>
                    <a onClick={() => onOpenNode(ev.type, ev)}>
                      <Space size={6}>{TYPE_META[ev.type]?.icon}<Text strong>{ev.number}</Text></Space>
                    </a>
                    <Text type="secondary" style={{ fontSize: 12 }}>{TYPE_META[ev.type]?.label} — <Tag color={STATUS_COLOR[ev.status] || 'default'} style={{ marginLeft: 2 }}>{(ev.status || '').replace('_', ' ').toUpperCase() || '—'}</Tag></Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{ev.at ? dayjs(ev.at).format('DD MMM YYYY HH:mm') : '—'}</Text>
                  </Space>
                ),
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
