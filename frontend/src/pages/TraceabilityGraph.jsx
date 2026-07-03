import { useState } from 'react';
import { Row, Col, Card, Tag, Badge, Timeline, Table, Typography, Space, Divider } from 'antd';
import {
  FileTextOutlined, ReconciliationOutlined, SolutionOutlined, FileProtectOutlined,
  CheckCircleOutlined, FileDoneOutlined, ArrowRightOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/ui/PageHeader';

const { Text, Title } = Typography;

// Mock transaction chain data
const MOCK_CHAIN = {
  pr: { id: 'PR-000003', status: 'closed', date: '2026-06-15', department: 'Operations', totalValue: 1542000 },
  rfq: { id: 'RFQ-000003', status: 'awarded', date: '2026-06-18', vendors: 4, awardedTo: 'L&T Engineering' },
  po: { id: 'PO-000004', status: 'open', date: '2026-06-22', vendor: 'L&T Engineering', amount: 1500000 },
  asn: { id: 'ASN-MQZ4X2', status: 'validated', date: '2026-06-28', transporter: 'Blue Dart', invoice: 'INV-2026-401' },
  grn: { id: 'GRN-000004', status: 'exception', date: '2026-07-01', exception: 'Quantity mismatch: received 10, shipped 12 (deviation -16.7%)' },
  invoice: { id: 'INV-000004', status: 'matched', date: '2026-07-02', amount: 1500000, matchStatus: 'matched' },
};

const MOCK_LINE_ITEMS = [
  { key: '1', item: 'ACB Panel 630A', prQty: 12, poQty: 12, asnQty: 12, grnQty: 10, invoiceQty: 12, status: 'mismatch' },
  { key: '2', item: 'MCB 32A Single Pole', prQty: 50, poQty: 50, asnQty: 50, grnQty: 50, invoiceQty: 50, status: 'ok' },
  { key: '3', item: 'Cable Tray 300mm', prQty: 20, poQty: 20, asnQty: 20, grnQty: 20, invoiceQty: 20, status: 'ok' },
];

const MOCK_TIMELINE = [
  { date: '2026-06-15 09:30', event: 'PR-000003 created by Procurement Admin', color: 'blue' },
  { date: '2026-06-15 14:00', event: 'PR-000003 submitted for approval', color: 'blue' },
  { date: '2026-06-16 10:15', event: 'PR-000003 approved', color: 'green' },
  { date: '2026-06-18 11:00', event: 'RFQ-000003 created from PR-000003', color: 'blue' },
  { date: '2026-06-20 16:30', event: '4 vendor bids received', color: 'blue' },
  { date: '2026-06-21 09:00', event: 'L&T Engineering awarded RFQ-000003', color: 'green' },
  { date: '2026-06-22 10:00', event: 'PO-000004 created from RFQ award', color: 'blue' },
  { date: '2026-06-28 08:45', event: 'ASN-MQZ4X2 submitted by vendor', color: 'blue' },
  { date: '2026-06-28 15:00', event: 'ASN-MQZ4X2 validated', color: 'green' },
  { date: '2026-07-01 10:30', event: 'GRN-000004 created — EXCEPTION: quantity mismatch on ACB Panel', color: 'red' },
  { date: '2026-07-02 09:00', event: 'INV-000004 created and 3-way matched', color: 'green' },
];

const STATUS_COLOR = {
  draft: 'default', submitted: 'blue', approved: 'green', closed: 'default',
  published: 'blue', awarded: 'green', open: 'blue', partially_fulfilled: 'orange',
  validated: 'cyan', posted: 'green', exception: 'red', matched: 'green', blocked: 'red',
};

const NODE_ICONS = {
  pr: <FileTextOutlined style={{ fontSize: 20 }} />,
  rfq: <ReconciliationOutlined style={{ fontSize: 20 }} />,
  po: <SolutionOutlined style={{ fontSize: 20 }} />,
  asn: <FileProtectOutlined style={{ fontSize: 20 }} />,
  grn: <CheckCircleOutlined style={{ fontSize: 20 }} />,
  invoice: <FileDoneOutlined style={{ fontSize: 20 }} />,
};

const NODE_LABELS = { pr: 'Purchase Requisition', rfq: 'RFQ', po: 'Purchase Order', asn: 'ASN', grn: 'Goods Receipt', invoice: 'Invoice' };

function FlowNode({ type, data, isException, onClick }) {
  const borderColor = isException ? '#ff4d4f' : data.status === 'matched' || data.status === 'approved' || data.status === 'awarded' || data.status === 'green' ? '#52c41a' : '#d9d9d9';

  return (
    <Badge count={isException ? <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} /> : 0}>
      <Card
        size="small"
        hoverable
        onClick={() => onClick(type, data)}
        style={{
          width: 150,
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          background: isException ? '#fff2f0' : '#fff',
          textAlign: 'center',
        }}
        bodyStyle={{ padding: '10px 8px' }}
      >
        <div style={{ color: isException ? '#ff4d4f' : '#1890ff', marginBottom: 4 }}>
          {NODE_ICONS[type]}
        </div>
        <Text strong style={{ fontSize: 11, display: 'block' }}>{NODE_LABELS[type]}</Text>
        <Text style={{ fontSize: 12, display: 'block' }}>{data.id}</Text>
        <Tag color={STATUS_COLOR[data.status] || 'default'} style={{ fontSize: 10, marginTop: 4 }}>
          {(data.status || '').toUpperCase()}
        </Tag>
        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{data.date}</Text>
      </Card>
    </Badge>
  );
}

function FlowArrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
      <ArrowRightOutlined style={{ fontSize: 18, color: '#bfbfbf' }} />
    </div>
  );
}

export default function TraceabilityGraph() {
  const [selectedNode, setSelectedNode] = useState(null);

  const handleNodeClick = (type, data) => {
    setSelectedNode({ type, data });
    console.log('Node clicked:', type, data);
  };

  const lineColumns = [
    { title: 'Item', dataIndex: 'item', width: 200 },
    { title: 'PR Qty', dataIndex: 'prQty', width: 80, align: 'center' },
    { title: 'PO Qty', dataIndex: 'poQty', width: 80, align: 'center' },
    { title: 'ASN Qty', dataIndex: 'asnQty', width: 80, align: 'center' },
    {
      title: 'GRN Qty', dataIndex: 'grnQty', width: 80, align: 'center',
      render: (v, r) => <Text type={r.status === 'mismatch' ? 'danger' : undefined} strong={r.status === 'mismatch'}>{v}</Text>,
    },
    { title: 'Invoice Qty', dataIndex: 'invoiceQty', width: 90, align: 'center' },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: v => v === 'mismatch' ? <Tag color="red">MISMATCH</Tag> : <Tag color="green">OK</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Governance' }, { title: 'Traceability Graph' }]}
        title="Procurement Traceability Graph"
        subtitle="End-to-end document flow visualization — PR → RFQ → PO → ASN → GRN → Invoice"
      />

      {/* ─── TOP: GRAPH VIEW ─── */}
      <Card size="small" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 1000, padding: '16px 0' }}>
          <FlowNode type="pr" data={MOCK_CHAIN.pr} onClick={handleNodeClick} />
          <FlowArrow />
          <FlowNode type="rfq" data={MOCK_CHAIN.rfq} onClick={handleNodeClick} />
          <FlowArrow />
          <FlowNode type="po" data={MOCK_CHAIN.po} onClick={handleNodeClick} />
          <FlowArrow />
          <FlowNode type="asn" data={MOCK_CHAIN.asn} onClick={handleNodeClick} />
          <FlowArrow />
          <FlowNode type="grn" data={MOCK_CHAIN.grn} isException onClick={handleNodeClick} />
          <FlowArrow />
          <FlowNode type="invoice" data={MOCK_CHAIN.invoice} onClick={handleNodeClick} />
        </div>

        {/* Exception callout */}
        {MOCK_CHAIN.grn.exception && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ fontSize: 12 }}>
              Exception at GRN: {MOCK_CHAIN.grn.exception}
            </Tag>
          </div>
        )}
      </Card>

      {/* ─── BOTTOM: Timeline + Details ─── */}
      <Row gutter={16}>
        {/* Timeline */}
        <Col xs={24} lg={10}>
          <Card size="small" title="Chronological Events" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <Timeline
              items={MOCK_TIMELINE.map(t => ({
                color: t.color,
                children: (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{t.date}</Text>
                    <br />
                    <Text style={{ fontSize: 13 }}>{t.event}</Text>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>

        {/* Line-Level Details */}
        <Col xs={24} lg={14}>
          <Card size="small" title="Line-Level Item Flow (Quantity Traceability)">
            <Table
              columns={lineColumns}
              dataSource={MOCK_LINE_ITEMS}
              size="small"
              pagination={false}
              rowClassName={r => r.status === 'mismatch' ? 'ant-table-row-selected' : ''}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> ACB Panel 630A: GRN received 10 units vs ASN shipped 12 units (deviation: -16.7%, exceeds 5% tolerance)
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> MCB 32A and Cable Tray: All quantities matched across the chain
              </Text>
            </Space>
          </Card>

          {/* Selected node detail */}
          {selectedNode && (
            <Card size="small" title={`Selected: ${NODE_LABELS[selectedNode.type]}`} style={{ marginTop: 16 }}>
              <Space direction="vertical" size={4}>
                <Text><Text strong>Document:</Text> {selectedNode.data.id}</Text>
                <Text><Text strong>Status:</Text> <Tag color={STATUS_COLOR[selectedNode.data.status]}>{selectedNode.data.status?.toUpperCase()}</Tag></Text>
                <Text><Text strong>Date:</Text> {selectedNode.data.date}</Text>
                {selectedNode.data.vendor && <Text><Text strong>Vendor:</Text> {selectedNode.data.vendor}</Text>}
                {selectedNode.data.amount && <Text><Text strong>Amount:</Text> ₹{Number(selectedNode.data.amount).toLocaleString('en-IN')}</Text>}
                {selectedNode.data.exception && <Text type="danger"><Text strong>Exception:</Text> {selectedNode.data.exception}</Text>}
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
