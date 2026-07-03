import { useState } from 'react';
import { Row, Col, Card, Table, Tag, Progress, Typography, Space, Button, Slider, Alert, Divider, message } from 'antd';
import { TrophyOutlined, WarningOutlined, CheckCircleOutlined, BulbOutlined, StarFilled } from '@ant-design/icons';
import PageHeader from '../components/ui/PageHeader';

const { Text, Title } = Typography;

// Mock RFQ vendor data
const MOCK_VENDORS = [
  { id: 'v1', name: 'L&T Engineering', unitPrice: 1250, leadTimeDays: 14, riskScore: 18, esgScore: 82, deliveryScore: 92, priceCompetitiveness: 95, qualityScore: 88 },
  { id: 'v2', name: 'Siemens India', unitPrice: 1380, leadTimeDays: 10, riskScore: 12, esgScore: 91, deliveryScore: 96, priceCompetitiveness: 78, qualityScore: 94 },
  { id: 'v3', name: 'Tata Steel', unitPrice: 1180, leadTimeDays: 21, riskScore: 25, esgScore: 75, deliveryScore: 78, priceCompetitiveness: 100, qualityScore: 82 },
  { id: 'v4', name: 'Bharat Electronics', unitPrice: 1420, leadTimeDays: 12, riskScore: 22, esgScore: 70, deliveryScore: 88, priceCompetitiveness: 72, qualityScore: 86 },
  { id: 'v5', name: 'Godrej Industries', unitPrice: 1310, leadTimeDays: 16, riskScore: 15, esgScore: 88, deliveryScore: 90, priceCompetitiveness: 85, qualityScore: 90 },
];

const RFQ_DETAILS = { rfqNumber: 'RFQ-000003', title: 'Q4 Steel Components', baseQuantity: 500 };

function computeOverallScore(vendor) {
  // Weighted scoring: Price 30%, Delivery 25%, Risk 20% (inverse), ESG 15%, Quality 10%
  const riskInverse = 100 - vendor.riskScore;
  return Math.round(
    vendor.priceCompetitiveness * 0.30 +
    vendor.deliveryScore * 0.25 +
    riskInverse * 0.20 +
    vendor.esgScore * 0.15 +
    vendor.qualityScore * 0.10
  );
}

function getPriceTag(price, minPrice) {
  const deviation = ((price - minPrice) / minPrice) * 100;
  if (deviation <= 5) return <Tag color="green">₹{price.toLocaleString()} <Text style={{ fontSize: 10 }}>(Best)</Text></Tag>;
  if (deviation <= 15) return <Tag color="gold">₹{price.toLocaleString()} <Text style={{ fontSize: 10 }}>(+{deviation.toFixed(0)}%)</Text></Tag>;
  return <Tag color="red">₹{price.toLocaleString()} <Text style={{ fontSize: 10 }}>(+{deviation.toFixed(0)}%)</Text></Tag>;
}

export default function RFQComparison() {
  const [quantity, setQuantity] = useState(RFQ_DETAILS.baseQuantity);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Compute scores
  const vendors = MOCK_VENDORS.map(v => ({ ...v, overallScore: computeOverallScore(v) }));
  const sortedByScore = [...vendors].sort((a, b) => b.overallScore - a.overallScore);
  const bestVendor = sortedByScore[0];
  const minPrice = Math.min(...vendors.map(v => v.unitPrice));

  const handleAward = () => {
    const vendor = selectedVendor || bestVendor;
    message.success(`Vendor "${vendor.name}" awarded for ${RFQ_DETAILS.rfqNumber}`);
    console.log('Award Vendor:', vendor);
  };

  // Table columns
  const columns = [
    {
      title: 'Vendor Name', dataIndex: 'name', width: 180,
      render: (v, r) => (
        <Space>
          {r.id === bestVendor.id && <StarFilled style={{ color: '#faad14' }} />}
          <Text strong={r.id === bestVendor.id}>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Unit Price', dataIndex: 'unitPrice', width: 160,
      render: v => getPriceTag(v, minPrice),
      sorter: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      title: 'Total Cost', key: 'totalCost', width: 130,
      render: (_, r) => <Text strong>₹{(r.unitPrice * quantity).toLocaleString('en-IN')}</Text>,
      sorter: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      title: 'Lead Time', dataIndex: 'leadTimeDays', width: 100,
      render: v => `${v} days`,
      sorter: (a, b) => a.leadTimeDays - b.leadTimeDays,
    },
    {
      title: 'Price Score', key: 'priceScore', width: 140,
      render: (_, r) => <Progress percent={r.priceCompetitiveness} size="small" strokeColor={r.priceCompetitiveness > 85 ? '#52c41a' : r.priceCompetitiveness > 70 ? '#faad14' : '#ff4d4f'} />,
      sorter: (a, b) => a.priceCompetitiveness - b.priceCompetitiveness,
    },
    {
      title: 'Delivery Score', key: 'deliveryScore', width: 140,
      render: (_, r) => <Progress percent={r.deliveryScore} size="small" strokeColor={r.deliveryScore > 85 ? '#52c41a' : r.deliveryScore > 70 ? '#faad14' : '#ff4d4f'} />,
      sorter: (a, b) => a.deliveryScore - b.deliveryScore,
    },
    {
      title: 'Risk Score', dataIndex: 'riskScore', width: 130,
      render: v => <Progress percent={100 - v} size="small" strokeColor={v < 20 ? '#52c41a' : v < 30 ? '#faad14' : '#ff4d4f'} format={() => `${v}%`} />,
      sorter: (a, b) => a.riskScore - b.riskScore,
    },
    {
      title: 'ESG Score', dataIndex: 'esgScore', width: 100,
      render: v => <Tag color={v >= 80 ? 'green' : v >= 60 ? 'gold' : 'red'}>{v}</Tag>,
      sorter: (a, b) => a.esgScore - b.esgScore,
    },
    {
      title: 'Overall', key: 'overall', width: 100, fixed: 'right',
      render: (_, r) => (
        <Text strong style={{ fontSize: 16, color: r.id === bestVendor.id ? '#52c41a' : '#333' }}>
          {r.overallScore}
        </Text>
      ),
      sorter: (a, b) => a.overallScore - b.overallScore,
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'RFQ' }, { title: 'Vendor Comparison' }]}
        title={`Vendor Comparison — ${RFQ_DETAILS.rfqNumber}`}
        subtitle={RFQ_DETAILS.title}
      />

      <Row gutter={16}>
        {/* ─── LEFT: Comparison Table (70%) ─── */}
        <Col xs={24} lg={17}>
          {/* Scenario Simulation */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Scenario Simulation — Adjust Quantity</Text>
              <Row gutter={16} align="middle">
                <Col span={16}>
                  <Slider
                    min={100}
                    max={2000}
                    step={50}
                    value={quantity}
                    onChange={setQuantity}
                    marks={{ 100: '100', 500: '500', 1000: '1K', 2000: '2K' }}
                  />
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: 16 }}>Qty: {quantity.toLocaleString()}</Text>
                  <br />
                  <Text type="secondary">Best total: ₹{(minPrice * quantity).toLocaleString('en-IN')}</Text>
                </Col>
              </Row>
            </Space>
          </Card>

          {/* Vendor Table */}
          <Card size="small" title="Vendor Bids Comparison">
            <Table
              columns={columns}
              dataSource={vendors}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1200 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedVendor ? [selectedVendor.id] : [bestVendor.id],
                onChange: (_, rows) => setSelectedVendor(rows[0]),
              }}
              rowClassName={(r) => r.id === bestVendor.id ? 'ant-table-row-selected' : ''}
            />
          </Card>
        </Col>

        {/* ─── RIGHT: Recommendation Panel (30%) ─── */}
        <Col xs={24} lg={7}>
          <Card
            size="small"
            title={<Space><TrophyOutlined style={{ color: '#faad14' }} /><span>Recommendation Engine</span></Space>}
            style={{ position: 'sticky', top: 24 }}
          >
            {/* Recommended Vendor */}
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>RECOMMENDED VENDOR</Text>
                  <Title level={5} style={{ margin: 0 }}>{bestVendor.name}</Title>
                  <Text strong style={{ color: '#52c41a' }}>Score: {bestVendor.overallScore}/100</Text>
                </div>
              </Space>
            </div>

            {/* Reasons */}
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <BulbOutlined /> Why this vendor?
            </Text>
            <ul style={{ paddingLeft: 20, margin: '0 0 16px 0', fontSize: 13 }}>
              <li>Best price competitiveness ({bestVendor.priceCompetitiveness}%)</li>
              <li>Strong delivery track record ({bestVendor.deliveryScore}% on-time)</li>
              <li>Low risk profile (risk score: {bestVendor.riskScore}%)</li>
              {bestVendor.esgScore >= 80 && <li>Good ESG compliance (score: {bestVendor.esgScore})</li>}
              <li>Total cost: ₹{(bestVendor.unitPrice * quantity).toLocaleString('en-IN')} for {quantity} units</li>
            </ul>

            <Divider style={{ margin: '12px 0' }} />

            {/* Risk Warnings */}
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <WarningOutlined style={{ color: '#faad14' }} /> Risk Warnings
            </Text>
            {vendors.filter(v => v.riskScore > 20).length > 0 ? (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {vendors.filter(v => v.riskScore > 20).map(v => (
                  <Alert key={v.id} type="warning" showIcon message={`${v.name}: Risk score ${v.riskScore}% (elevated)`} style={{ fontSize: 11 }} />
                ))}
              </Space>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>No high-risk vendors in this comparison.</Text>
            )}

            {vendors.filter(v => v.leadTimeDays > 18).length > 0 && (
              <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                {vendors.filter(v => v.leadTimeDays > 18).map(v => (
                  <Alert key={v.id} type="info" showIcon message={`${v.name}: Lead time ${v.leadTimeDays} days (above average)`} style={{ fontSize: 11 }} />
                ))}
              </Space>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Award Button */}
            <Button
              type="primary"
              size="large"
              block
              icon={<TrophyOutlined />}
              onClick={handleAward}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Award {(selectedVendor || bestVendor).name}
            </Button>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 11, marginTop: 8 }}>
              Total: ₹{((selectedVendor || bestVendor).unitPrice * quantity).toLocaleString('en-IN')} for {quantity} units
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
