import { useState, useEffect } from 'react';
import { Table, Tag, Space, Row, Col, Card, Typography, Tabs, Divider, Statistic, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const { Title, Text } = Typography;

export default function PriceBenchmarking() {
  const [benchmarks, setBenchmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBenchmarks = async () => {
    setLoading(true);
    try { const res = await api.get('/pricing/benchmarks'); setBenchmarks(res.data.data || []); } catch { message.error('Failed to load'); }
    setLoading(false);
  };
  const fetchHistory = async () => {
    try { const res = await api.get('/pricing/history'); setHistory(res.data.data || []); } catch {}
  };

  useEffect(() => { fetchBenchmarks(); fetchHistory(); }, []);

  const formatPrice = (v) => v != null ? `₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  // Group history by vendor
  const vendorMap = {};
  history.forEach(h => {
    if (!vendorMap[h.vendor_name || h.vendor_id]) vendorMap[h.vendor_name || h.vendor_id] = [];
    vendorMap[h.vendor_name || h.vendor_id].push(h);
  });
  const vendorGroups = Object.entries(vendorMap).map(([vendor, items]) => ({
    vendor,
    items,
    avg_price: items.reduce((s, i) => s + Number(i.unit_price), 0) / items.length,
    total_items: items.length,
  }));

  // Group history by item
  const itemMap = {};
  history.forEach(h => {
    if (!itemMap[h.item_description]) itemMap[h.item_description] = [];
    itemMap[h.item_description].push(h);
  });
  const itemGroups = Object.entries(itemMap).map(([item, records]) => ({
    item,
    records,
    vendors: [...new Set(records.map(r => r.vendor_name || r.vendor_id))],
    avg_price: records.reduce((s, r) => s + Number(r.unit_price), 0) / records.length,
    min_price: Math.min(...records.map(r => Number(r.unit_price))),
    max_price: Math.max(...records.map(r => Number(r.unit_price))),
  }));

  const benchmarkColumns = [
    { title: 'Item Description', dataIndex: 'item_description' },
    { title: 'Records', dataIndex: 'record_count', width: 90 },
    { title: 'Avg Price', dataIndex: 'avg_price', width: 120, render: formatPrice },
    { title: 'Min Price', dataIndex: 'min_price', width: 120, render: v => <Text style={{ color: '#52c41a' }}>{formatPrice(v)}</Text> },
    { title: 'Max Price', dataIndex: 'max_price', width: 120, render: v => <Text style={{ color: '#ff4d4f' }}>{formatPrice(v)}</Text> },
    { title: 'Last Price', dataIndex: 'last_price', width: 120, render: formatPrice },
  ];

  const vendorColumns = [
    { title: 'Item', dataIndex: 'item_description' },
    { title: 'Unit Price', dataIndex: 'unit_price', width: 120, render: formatPrice },
    { title: 'Quantity', dataIndex: 'quantity', width: 100 },
    { title: 'Date', dataIndex: 'recorded_at', width: 110, render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  const itemDetailColumns = [
    { title: 'Vendor', dataIndex: 'vendor_name', render: v => v || '—' },
    { title: 'Unit Price', dataIndex: 'unit_price', width: 120, render: formatPrice },
    { title: 'Quantity', dataIndex: 'quantity', width: 100 },
    { title: 'Date', dataIndex: 'recorded_at', width: 110, render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>Price Insights</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Compare supplier pricing trends and benchmark across vendors and items.</Text>
      <Divider style={{ margin: '12px 0' }} />

      <Tabs defaultActiveKey="overview" items={[
        { key: 'overview', label: 'Item Benchmarks', children: (
          <div>
            {benchmarks.length > 0 && (
              <Card title="Price Comparison" size="small" style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={benchmarks.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="item_description" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
                    <Bar dataKey="avg_price" fill="#1890ff" name="Avg Price" />
                    <Bar dataKey="min_price" fill="#52c41a" name="Min Price" />
                    <Bar dataKey="max_price" fill="#ff4d4f" name="Max Price" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Table columns={benchmarkColumns} dataSource={benchmarks} rowKey="item_description" loading={loading} size="middle" />
          </div>
        )},
        { key: 'vendor', label: 'Vendor-wise Pricing', children: (
          <div>
            {vendorGroups.map(vg => (
              <Card key={vg.vendor} title={vg.vendor} size="small" style={{ marginBottom: 16 }} extra={<Tag color="blue">{vg.total_items} items</Tag>}>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}><Statistic title="Avg Price" value={formatPrice(vg.avg_price)} valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={8}><Statistic title="Total Records" value={vg.total_items} valueStyle={{ fontSize: 16 }} /></Col>
                </Row>
                <Table columns={vendorColumns} dataSource={vg.items} rowKey="id" size="small" pagination={{ pageSize: 5 }} />
              </Card>
            ))}
            {vendorGroups.length === 0 && <Text type="secondary">No pricing data available</Text>}
          </div>
        )},
        { key: 'item', label: 'Item-wise Pricing', children: (
          <div>
            {itemGroups.map(ig => (
              <Card key={ig.item} title={ig.item} size="small" style={{ marginBottom: 16 }} extra={<Space>{ig.vendors.map(v => <Tag key={v}>{v}</Tag>)}</Space>}>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={6}><Statistic title="Avg" value={formatPrice(ig.avg_price)} valueStyle={{ fontSize: 14 }} /></Col>
                  <Col span={6}><Statistic title="Min" value={formatPrice(ig.min_price)} valueStyle={{ fontSize: 14, color: '#52c41a' }} /></Col>
                  <Col span={6}><Statistic title="Max" value={formatPrice(ig.max_price)} valueStyle={{ fontSize: 14, color: '#ff4d4f' }} /></Col>
                  <Col span={6}><Statistic title="Vendors" value={ig.vendors.length} valueStyle={{ fontSize: 14 }} /></Col>
                </Row>
                <Table columns={itemDetailColumns} dataSource={ig.records} rowKey="id" size="small" pagination={{ pageSize: 5 }} />
              </Card>
            ))}
            {itemGroups.length === 0 && <Text type="secondary">No pricing data available</Text>}
          </div>
        )},
      ]} />
    </div>
  );
}
