import { useState, useEffect } from 'react';
import { Table, Button, Tag, Row, Col, Card, Statistic, Typography, Divider, Select, message } from 'antd';
import { ReloadOutlined, WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const { Title, Text } = Typography;

const RISK_COLOR = { low: '#52c41a', medium: '#faad14', high: '#ff4d4f' };
const RISK_TAG_COLOR = { low: 'green', medium: 'orange', high: 'red' };
const TREND_COLOR = { improving: 'green', stable: 'default', worsening: 'red' };
const TREND_ICON = { improving: <ArrowDownOutlined />, stable: <MinusOutlined />, worsening: <ArrowUpOutlined /> };

export default function RiskDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/risk/scores');
      setData(res.data.data || []);
    } catch { message.error('Failed to load risk data'); }
    setLoading(false);
  };

  useEffect(() => { fetchRiskData(); }, []);

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      await api.post('/risk/calculate');
      message.success('Risk scores recalculated');
      fetchRiskData();
    } catch { message.error('Failed to recalculate scores'); }
    setCalculating(false);
  };

  const filteredData = selectedVendor ? data.filter(d => d.vendor_id === selectedVendor) : data;
  const lowCount = filteredData.filter(d => d.risk_level === 'low').length;
  const mediumCount = filteredData.filter(d => d.risk_level === 'medium').length;
  const highCount = filteredData.filter(d => d.risk_level === 'high').length;

  const pieData = [
    { name: 'Low Risk', value: lowCount },
    { name: 'Medium Risk', value: mediumCount },
    { name: 'High Risk', value: highCount },
  ].filter(d => d.value > 0);

  const columns = [
    { title: 'Vendor Name', dataIndex: 'vendor_name', sorter: (a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')) },
    { title: 'Risk Score', dataIndex: 'risk_score', width: 110, render: v => <Text strong>{v ?? 0}</Text>, sorter: (a, b) => Number(a.risk_score || 0) - Number(b.risk_score || 0) },
    {
      title: 'Risk Level', dataIndex: 'risk_level', width: 120, render: v => <Tag color={RISK_TAG_COLOR[v]}>{v?.toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.risk_level || '').localeCompare(String(b.risk_level || '')),
      filters: Object.keys(RISK_TAG_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.risk_level === value,
    },
    { title: 'Trend', dataIndex: 'risk_trend', width: 120, render: v => <Tag color={TREND_COLOR[v] || 'default'} icon={TREND_ICON[v]}>{(v || 'stable').toUpperCase()}</Tag>, sorter: (a, b) => String(a.risk_trend || '').localeCompare(String(b.risk_trend || '')) },
    { title: 'Delay Score', dataIndex: 'delay_score', width: 110, sorter: (a, b) => Number(a.delay_score || 0) - Number(b.delay_score || 0) },
    { title: 'Rejection Score', dataIndex: 'rejection_score', width: 130, sorter: (a, b) => Number(a.rejection_score || 0) - Number(b.rejection_score || 0) },
    { title: 'Audit Score', dataIndex: 'audit_score', width: 110, sorter: (a, b) => Number(a.audit_score || 0) - Number(b.audit_score || 0) },
    { title: 'Financial Risk', dataIndex: 'financial_risk_score', width: 120, sorter: (a, b) => Number(a.financial_risk_score || 0) - Number(b.financial_risk_score || 0) },
    { title: 'Dependency Risk', dataIndex: 'dependency_risk_score', width: 130, sorter: (a, b) => Number(a.dependency_risk_score || 0) - Number(b.dependency_risk_score || 0) },
    { title: 'Geographic Risk', dataIndex: 'geographic_risk_score', width: 130, sorter: (a, b) => Number(a.geographic_risk_score || 0) - Number(b.geographic_risk_score || 0) },
    { title: 'ESG Risk', dataIndex: 'esg_risk_score', width: 100, sorter: (a, b) => Number(a.esg_risk_score || 0) - Number(b.esg_risk_score || 0) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Supplier Risk</Title>
          <Text type="secondary">Monitor supplier risk scores based on delivery performance, quality, and compliance.</Text>
        </div>
        <Button type="primary" icon={<ReloadOutlined />} onClick={handleRecalculate} loading={calculating}>
          Recalculate Scores
        </Button>
      </div>
      <Divider style={{ margin: '12px 0' }} />

      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ marginRight: 8 }}>Filter by Vendor:</Text>
        <Select
          showSearch allowClear
          placeholder="All Vendors"
          value={selectedVendor}
          onChange={setSelectedVendor}
          style={{ width: 300 }}
          optionFilterProp="label"
          options={data.map(d => ({ value: d.vendor_id, label: d.vendor_name }))}
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card>
            <Statistic title="Low Risk" value={lowCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: RISK_COLOR.low }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="Medium Risk" value={mediumCount} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: RISK_COLOR.medium }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="High Risk" value={highCount} prefix={<WarningOutlined />} valueStyle={{ color: RISK_COLOR.high }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Table columns={columns} dataSource={filteredData} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} />
        </Col>
        <Col xs={24} md={8}>
          <Card title="Risk Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === 'Low Risk' ? RISK_COLOR.low : entry.name === 'Medium Risk' ? RISK_COLOR.medium : RISK_COLOR.high} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
