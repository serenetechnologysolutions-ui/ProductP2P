import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Tag, Space, Badge } from 'antd';
import {
  FileTextOutlined, ReconciliationOutlined, SolutionOutlined, DatabaseOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, DollarOutlined, SafetyOutlined,
  WarningOutlined, BulbOutlined, ArrowUpOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text, Title } = Typography;

// Mock data
const MOCK_SPEND_BY_CATEGORY = [
  { category: 'Raw Materials', amount: 4500000 },
  { category: 'Equipment', amount: 2800000 },
  { category: 'Services', amount: 1900000 },
  { category: 'IT', amount: 1200000 },
  { category: 'Packaging', amount: 800000 },
  { category: 'Office Supplies', amount: 450000 },
];

const MOCK_MONTHLY_TREND = [
  { month: 'Jan', spend: 1800000, orders: 12 },
  { month: 'Feb', spend: 2100000, orders: 15 },
  { month: 'Mar', spend: 1950000, orders: 14 },
  { month: 'Apr', spend: 2400000, orders: 18 },
  { month: 'May', spend: 2700000, orders: 21 },
  { month: 'Jun', spend: 3100000, orders: 24 },
  { month: 'Jul', spend: 2800000, orders: 20 },
];

const ATTENTION_ITEMS = [
  { key: 'sla', icon: <ClockCircleOutlined style={{ fontSize: 28 }} />, count: 5, label: 'Pending Approvals > SLA', description: '5 PRs awaiting approval beyond SLA deadline', color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7' },
  { key: 'exceptions', icon: <ExclamationCircleOutlined style={{ fontSize: 28 }} />, count: 3, label: 'Critical Exceptions', description: '3 unresolved critical exceptions require immediate action', color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7' },
  { key: 'budget', icon: <DollarOutlined style={{ fontSize: 28 }} />, count: 2, label: 'Budget at Risk', description: '2 cost centers projected to exceed allocation this quarter', color: '#faad14', bg: '#fffbe6', border: '#ffe58f' },
  { key: 'vendor', icon: <SafetyOutlined style={{ fontSize: 28 }} />, count: 4, label: 'Vendor Risk Alerts', description: '4 vendors flagged high-risk requiring review', color: '#faad14', bg: '#fffbe6', border: '#ffe58f' },
];

export default function ControlTowerDashboard() {
  const [kpis, setKpis] = useState({ totalPRs: 0, activeRFQs: 0, openPOs: 0, inventoryValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      setLoading(true);
      try {
        const [prRes, rfqRes, poRes, stockRes] = await Promise.all([
          api.get('/pr').catch(() => ({ data: { data: [] } })),
          api.get('/rfq').catch(() => ({ data: { data: [] } })),
          api.get('/purchase-orders').catch(() => ({ data: { data: [] } })),
          api.get('/inventory/stock').catch(() => ({ data: { data: [] } })),
        ]);

        const prs = prRes.data.data || [];
        const rfqs = rfqRes.data.data || [];
        const pos = poRes.data.data || [];
        const stock = stockRes.data.data || [];

        setKpis({
          totalPRs: prs.length,
          activeRFQs: rfqs.filter(r => ['draft', 'published'].includes(r.status)).length,
          openPOs: pos.filter(p => ['open', 'partially_fulfilled'].includes(p.status)).length,
          inventoryValue: stock.reduce((sum, s) => sum + (Number(s.quantity_on_hand) * (Number(s.standard_cost) || 100)), 0),
        });
      } catch {
        setKpis({ totalPRs: 24, activeRFQs: 7, openPOs: 15, inventoryValue: 12500000 });
      }
      setLoading(false);
    };
    fetchKPIs();
  }, []);

  const handleDrillDown = (key) => {
    console.log(`Drill-down clicked: ${key}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Governance' }, { title: 'Control Tower Dashboard' }]}
        title="Procurement Control Tower"
        subtitle="Real-time overview of procurement operations, AI-driven insights, and spend analytics"
      />

      {/* ─── 1. WHAT NEEDS ATTENTION ─── */}
      <Card size="small" style={{ marginBottom: 20, background: '#fafafa' }}>
        <Title level={5} style={{ margin: '0 0 12px 0' }}>
          <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
          What Needs Attention
        </Title>
        <Row gutter={[12, 12]}>
          {ATTENTION_ITEMS.map(item => (
            <Col xs={24} sm={12} md={6} key={item.key}>
              <Card
                size="small"
                hoverable
                onClick={() => handleDrillDown(item.key)}
                style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 8 }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <Space align="start" size={12}>
                  <div style={{ color: item.color }}>{item.icon}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 20, color: item.color }}>{item.count}</Text>
                      <Text strong style={{ fontSize: 12 }}>{item.label}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.description}</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ─── 2. KPI SECTION ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => handleDrillDown('totalPRs')} loading={loading}>
            <Statistic
              title="Total PRs"
              value={kpis.totalPRs}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>All purchase requisitions</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => handleDrillDown('activeRFQs')} loading={loading}>
            <Statistic
              title="Active RFQs"
              value={kpis.activeRFQs}
              prefix={<ReconciliationOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Draft + Published</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => handleDrillDown('openPOs')} loading={loading}>
            <Statistic
              title="Open POs"
              value={kpis.openPOs}
              prefix={<SolutionOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Awaiting fulfillment</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => handleDrillDown('inventoryValue')} loading={loading}>
            <Statistic
              title="Inventory Value"
              value={kpis.inventoryValue}
              prefix={<DatabaseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => `₹${Number(v).toLocaleString('en-IN')}`}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>Total stock value</Text>
          </Card>
        </Col>
      </Row>

      {/* ─── 3. AI INSIGHTS PANEL ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <Card size="small" hoverable onClick={() => handleDrillDown('priceVariance')} style={{ borderLeft: '4px solid #ff4d4f' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space><DollarOutlined style={{ color: '#ff4d4f' }} /><Text strong>Price Variance Alert</Text><Tag color="red">HIGH</Tag></Space>
              <Text>3 items show &gt;15% price increase from last quarter. Steel Plates (+22%), Polymer Granules (+18%), Hydraulic Pumps (+16%).</Text>
              <Text type="secondary" style={{ fontSize: 11 }}><BulbOutlined /> Renegotiate with vendors or explore alternate sources via RFQ.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" hoverable onClick={() => handleDrillDown('vendorPerformance')} style={{ borderLeft: '4px solid #faad14' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space><WarningOutlined style={{ color: '#faad14' }} /><Text strong>Vendor Performance</Text><Tag color="orange">MEDIUM</Tag></Space>
              <Text>2 vendors have on-time delivery below 70%. L&T (65%), Siemens (68%). Average lead time increased by 3 days.</Text>
              <Text type="secondary" style={{ fontSize: 11 }}><BulbOutlined /> Schedule vendor review or consider alternative sourcing.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" hoverable onClick={() => handleDrillDown('budgetInsight')} style={{ borderLeft: '4px solid #1890ff' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space><ArrowUpOutlined style={{ color: '#1890ff' }} /><Text strong>Budget Utilization</Text><Tag color="blue">INFO</Tag></Space>
              <Text>Operations cost center at 78% utilization (₹15.6L of ₹20L). Projected to exceed by end of quarter.</Text>
              <Text type="secondary" style={{ fontSize: 11 }}><BulbOutlined /> Review uncommitted PRs and defer non-critical procurement.</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ─── 4. CHARTS SECTION ─── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Spend by Category" size="small" hoverable onClick={() => handleDrillDown('spendByCategory')}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={MOCK_SPEND_BY_CATEGORY} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Spend']} />
                <Bar dataKey="amount" fill="#1890ff" name="Spend" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Monthly Procurement Trend" size="small" hoverable onClick={() => handleDrillDown('monthlyTrend')}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={MOCK_MONTHLY_TREND} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(v, name) => [name === 'Spend' ? `₹${Number(v).toLocaleString('en-IN')}` : v, name]} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#1890ff" strokeWidth={2} name="Spend" dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#52c41a" strokeWidth={2} name="Orders" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
