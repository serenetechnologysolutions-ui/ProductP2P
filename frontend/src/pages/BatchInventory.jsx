import { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Statistic, Input, Select, Switch, Space, Tag, message } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

export default function BatchInventory() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);

  // Filters
  const [itemCode, setItemCode] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [locationId, setLocationId] = useState(null);
  const [showExhausted, setShowExhausted] = useState(false);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/inventory/warehouses');
      setWarehouses(res.data.data || res.data || []);
    } catch { /* ignore */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { include_exhausted: showExhausted };
      if (itemCode) params.item_code = itemCode;
      if (batchNumber) params.batch_number = batchNumber;
      if (locationId) params.location_id = locationId;
      const res = await api.get('/inventory/batches', { params });
      setData(res.data.data || []);
    } catch {
      message.error('Failed to load batch inventory');
    }
    setLoading(false);
  };

  useEffect(() => { fetchWarehouses(); }, []);
  useEffect(() => { fetchData(); }, [itemCode, batchNumber, locationId, showExhausted]);

  const activeBatches = data.filter(d => d.status === 'active');
  const exhaustedBatches = data.filter(d => d.status === 'exhausted');

  const columns = [
    { title: 'Item Code', dataIndex: 'item_code', width: 120 },
    { title: 'Item Name', dataIndex: 'item_name', ellipsis: true },
    { title: 'Batch Number', dataIndex: 'batch_number', width: 220 },
    { title: 'Location', dataIndex: 'location_name', width: 150 },
    { title: 'Qty Available', dataIndex: 'qty_available', width: 120, render: v => Number(v).toLocaleString() },
    { title: 'Rate', dataIndex: 'rate', width: 100, render: v => `₹${Number(v).toLocaleString()}` },
    { title: 'Discount %', dataIndex: 'discount_percentage', width: 100, render: v => `${v}%` },
    { title: 'Tax %', dataIndex: 'tax_percentage', width: 80, render: v => `${v}%` },
    { title: 'Total Amount', dataIndex: 'total_amount', width: 130, render: v => `₹${Number(v).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', width: 100, render: v => (
      <Tag color={v === 'active' ? 'green' : 'default'}>{(v || '').toUpperCase()}</Tag>
    )},
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Batch Inventory' }]}
        title="Batch Inventory"
        subtitle="View inventory organized by batch with financial valuations"
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Batches" value={data.length} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={activeBatches.length} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Exhausted" value={exhaustedBatches.length} valueStyle={{ color: '#999' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Item Code"
            value={itemCode}
            onChange={e => setItemCode(e.target.value)}
            style={{ width: 160 }}
            allowClear
          />
          <Input
            placeholder="Batch Number"
            value={batchNumber}
            onChange={e => setBatchNumber(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="Location"
            value={locationId}
            onChange={setLocationId}
            allowClear
            style={{ width: 180 }}
            options={warehouses.map(w => ({ label: w.name || w.warehouse_name, value: w.id }))}
          />
          <Space>
            <Switch checked={showExhausted} onChange={setShowExhausted} />
            <span>Show Exhausted Batches</span>
          </Space>
        </Space>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 15 }}
      />
    </div>
  );
}
