import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, Typography, Table, Tag } from 'antd';
import { ShopOutlined, FileProtectOutlined, CheckCircleOutlined, ClockCircleOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const COLORS = ['#1890ff', '#faad14', '#52c41a', '#ff4d4f', '#722ed1', '#8c8c8c'];
const STATUS_COLOR = { draft: 'default', submitted: 'blue', under_review: 'orange', approved: 'green', rejected: 'red', inactive: '#8c8c8c', validated: 'orange', posted: 'green' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();

  useEffect(() => {
    api.get('/dashboard').then(res => setData(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin spinning size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;
  if (!data) return <Card><Text type="secondary">Unable to load dashboard data</Text></Card>;

  // ─── VENDOR DASHBOARD ───
  if (data.role === 'vendor') {
    const s = data.summary || {};
    return (
      <div>
        <Title level={4}>Welcome, {s.vendor_name}</Title>
        <Tag color={STATUS_COLOR[s.vendor_status]} style={{ fontSize: 13, padding: '4px 12px', marginBottom: 20 }}>
          Profile Status: {s.vendor_status?.toUpperCase().replace('_', ' ')}
        </Tag>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}><Card><Statistic title="My ASNs" value={s.total_asns ?? 0} prefix={<FileProtectOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Submitted" value={s.submitted_asns ?? 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Posted to ERP" value={s.posted_asns ?? 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Purchase Orders" value={s.total_pos ?? 0} prefix={<SendOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        </Row>
        {data.recent_asns?.length > 0 && (
          <Card title="Recent ASNs" style={{ marginTop: 24 }}>
            <Table size="small" dataSource={data.recent_asns} rowKey="asn_number" pagination={false} columns={[
              { title: 'ASN #', dataIndex: 'asn_number' },
              { title: 'Invoice', dataIndex: 'invoice_number' },
              { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v || 0).toLocaleString()}` },
              { title: 'Status', dataIndex: 'status', render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase()}</Tag> },
              { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('DD-MM-YYYY') },
            ]} />
          </Card>
        )}
      </div>
    );
  }

  // ─── PROCUREMENT ADMIN DASHBOARD ───
  if (data.role === 'procurement_admin') {
    const s = data.summary || {};
    const charts = data.charts || {};
    return (
      <div>
        <Title level={4}>Procurement Dashboard</Title>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}><Card><Statistic title="Total ASNs" value={s.total_asns ?? 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title="Pending Validation" value={s.pending_validation ?? 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title="Validated" value={s.validated ?? 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title="Posted to ERP" value={s.posted_erp ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card><Statistic title="Rejected" value={s.rejected ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} md={12}>
            <Card title="ASNs by Status">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart><Pie data={charts.asns_by_status || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label>
                  {(charts.asns_by_status || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /><Legend /></PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="ASNs by Month">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts.asns_by_month || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#722ed1" /></BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
        {data.recent_asns?.length > 0 && (
          <Card title="Recent ASNs" style={{ marginTop: 24 }}>
            <Table size="small" dataSource={data.recent_asns} rowKey="asn_number" pagination={false} columns={[
              { title: 'ASN #', dataIndex: 'asn_number' },
              { title: 'Vendor', dataIndex: 'vendor_name' },
              { title: 'Invoice', dataIndex: 'invoice_number' },
              { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v || 0).toLocaleString()}` },
              { title: 'Status', dataIndex: 'status', render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase()}</Tag> },
              { title: 'Date', dataIndex: 'created_at', render: v => dayjs(v).format('DD-MM-YYYY') },
            ]} />
          </Card>
        )}
      </div>
    );
  }

  // ─── MDM ADMIN DASHBOARD ───
  const s = data.summary || {};
  const charts = data.charts || {};
  return (
    <div>
      <Title level={4}>Admin Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Total Vendors" value={s.total_vendors ?? 0} prefix={<ShopOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Pending Approval" value={s.pending_approval ?? 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Active Vendors" value={s.active_vendors ?? 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Total ASNs" value={s.total_asns ?? 0} prefix={<FileProtectOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Pending Validation" value={s.pending_validation ?? 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card><Statistic title="Posted to ERP" value={s.posted_erp ?? 0} prefix={<SendOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Vendors by Status">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart><Pie data={charts.vendors_by_status || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label>
                {(charts.vendors_by_status || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="ASNs by Month">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.asns_by_month || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#1890ff" /></BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
      {data.recent_vendors?.length > 0 && (
        <Card title="Recent Vendors" style={{ marginTop: 24 }}>
          <Table size="small" dataSource={data.recent_vendors} rowKey="vendor_number" pagination={false} columns={[
            { title: 'Vendor #', dataIndex: 'vendor_number' },
            { title: 'Name', dataIndex: 'vendor_name' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Status', dataIndex: 'status', render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase().replace('_', ' ')}</Tag> },
            { title: 'Created', dataIndex: 'created_at', render: v => dayjs(v).format('DD-MM-YYYY') },
          ]} />
        </Card>
      )}
    </div>
  );
}
