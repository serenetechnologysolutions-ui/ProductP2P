import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Tag, Empty, Skeleton, Alert, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import notify from '../utils/notify';

const RISK_LEVEL_COLOR = { low: 'green', medium: 'orange', high: 'red' };
const TREND_ICON = { improving: <ArrowUpOutlined />, worsening: <ArrowDownOutlined />, stable: <MinusOutlined /> };
const TREND_COLOR = { improving: 'green', worsening: 'red', stable: 'default' };

// Vendor Portal 2.0 — self-service performance view. Reuses the exact same
// ProcurementInsightsService.getVendorScore() output an admin sees on the
// Vendors > Intelligence tab (via GET /vendor-portal/performance, scoped to
// the logged-in vendor's own id) — no separate scoring logic.
export default function VendorPortalPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/vendor-portal/performance')
      .then(res => setData(res.data?.data || null))
      .catch(() => notify.error('Could not load your performance score'))
      .finally(() => setLoading(false));
  }, []);

  const subScores = data ? [
    { name: 'Delay', value: data.risk.delay_score },
    { name: 'Rejection', value: data.risk.rejection_score },
    { name: 'Audit', value: data.risk.audit_score },
    { name: 'Financial', value: data.risk.financial_risk_score },
    { name: 'Dependency', value: data.risk.dependency_risk_score },
    { name: 'Geographic', value: data.risk.geographic_risk_score },
    { name: 'ESG', value: data.risk.esg_risk_score },
  ].filter(s => s.value != null) : [];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'My Portal' }, { title: 'Performance' }]}
        title="My Performance"
        subtitle="How your account is currently scored — the same scorecard procurement admins see for you."
      />

      {loading && <Skeleton active paragraph={{ rows: 6 }} />}
      {!loading && !data && <Empty description="Performance data is not available right now" />}

      {!loading && data && (
        <>
          {data.insights?.length > 0 && (
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={8}>
              {data.insights.map((i, idx) => (
                <Alert key={idx} type={i.severity === 'critical' ? 'error' : i.severity === 'warning' ? 'warning' : 'info'} showIcon message={i.message} />
              ))}
            </Space>
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="Performance Score" value={data.performance_score ?? '—'} suffix={data.performance_score != null ? '/ 100' : ''} /></Card></Col>
            <Col span={6}><Card><Statistic title="Risk Level" valueRender={() => <Tag color={RISK_LEVEL_COLOR[data.risk.risk_level]}>{(data.risk.risk_level || '—').toUpperCase()}</Tag>} /></Card></Col>
            <Col span={6}><Card><Statistic title="Score Trend" valueRender={() => <Tag icon={TREND_ICON[data.risk.risk_trend]} color={TREND_COLOR[data.risk.risk_trend]}>{(data.risk.risk_trend || '—').toUpperCase()}</Tag>} /></Card></Col>
            <Col span={6}><Card><Statistic title="Active Contract" valueRender={() => data.contract_summary.has_active_contract ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>} /></Card></Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card title="Risk Sub-Scores" size="small">
                {subScores.length === 0 ? <Empty description="Not enough data yet" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={subScores}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#1890ff" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Price Competitiveness" size="small">
                <Statistic title="Score" value={data.price_competitiveness.score ?? '—'} suffix={data.price_competitiveness.score != null ? '/ 100' : ''} />
                <Statistic title="Items Compared" value={data.price_competitiveness.items_compared} style={{ marginTop: 12 }} />
                {data.price_competitiveness.avg_deviation_from_market_pct != null && (
                  <Statistic
                    title="Avg. Deviation From Market"
                    value={data.price_competitiveness.avg_deviation_from_market_pct}
                    suffix="%" style={{ marginTop: 12 }}
                    valueStyle={{ color: data.price_competitiveness.avg_deviation_from_market_pct > 0 ? '#cf1322' : '#3f8600' }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
