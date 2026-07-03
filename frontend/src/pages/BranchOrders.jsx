import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag, Typography, Space, Row, Col, Statistic, message, DatePicker, Input, Select, InputNumber, Empty, Modal } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, CheckCircleOutlined, SendOutlined, SwapOutlined, CarOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;

const STATUS_COLOR = { created: 'blue', approved: 'orange', in_transit: 'purple', received: 'green' };

export default function BranchOrders() {
  const [view, setView] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Create state
  const [warehouses, setWarehouses] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({ from_location_id: null, to_location_id: null, request_type: '', request_date: dayjs(), remarks: '' });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Receive state
  const [receiveLines, setReceiveLines] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/branch-orders');
      setData(res.data.data || []);
    } catch { message.error('Failed to load branch orders'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openDetail = async (record) => {
    try {
      const res = await api.get(`/inventory/branch-orders/${record.id}`);
      setSelected(res.data.data);
    } catch { setSelected(record); }
    setView('detail');
  };

  const openCreate = async () => {
    try {
      const [whRes, itemRes] = await Promise.all([
        api.get('/inventory/warehouses'),
        api.get('/item-master', { params: { limit: 500 } }),
      ]);
      setWarehouses(whRes.data.data || whRes.data || []);
      setItems(itemRes.data.data || []);
    } catch { setWarehouses([]); setItems([]); }

    // Fetch request types from sub-masters
    try {
      const res = await api.get('/sub-masters', { params: { type: 'request_type' } });
      setRequestTypes(res.data.data || res.data || []);
    } catch { setRequestTypes([]); }

    setFormData({ from_location_id: null, to_location_id: null, request_type: '', request_date: dayjs(), remarks: '' });
    setLineItems([]);
    setView('create');
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { key: Date.now(), item_master_id: null, requested_quantity: 1 }]);
  };

  const updateLine = (index, field, value) => {
    setLineItems(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const removeLine = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!formData.from_location_id) { message.error('Select source location'); return; }
    if (!formData.to_location_id) { message.error('Select destination location'); return; }
    if (formData.from_location_id === formData.to_location_id) { message.error('Source and destination must be different'); return; }
    if (!formData.request_type) { message.error('Select request type'); return; }
    if (lineItems.length === 0) { message.error('Add at least one line item'); return; }

    setSaving(true);
    try {
      await api.post('/inventory/branch-orders', {
        from_location_id: formData.from_location_id,
        to_location_id: formData.to_location_id,
        request_type: formData.request_type,
        request_date: formData.request_date.format('YYYY-MM-DD'),
        remarks: formData.remarks || undefined,
        line_items: lineItems.map(li => ({
          item_master_id: li.item_master_id,
          requested_quantity: li.requested_quantity,
        })),
      });
      message.success('Branch order created successfully');
      setView('list');
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create branch order'); }
    setSaving(false);
  };

  const handleApprove = async (orderId) => {
    Modal.confirm({
      title: 'Approve Branch Order',
      content: 'This will reserve stock at the source location. Continue?',
      onOk: async () => {
        try {
          await api.post(`/inventory/branch-orders/${orderId}/approve`);
          message.success('Order approved');
          openDetail({ id: orderId });
        } catch (err) { message.error(err.response?.data?.error || 'Failed to approve'); }
      },
    });
  };

  const handleDispatch = async (orderId) => {
    Modal.confirm({
      title: 'Dispatch Order',
      content: 'Mark this order as dispatched / in transit?',
      onOk: async () => {
        try {
          await api.post(`/inventory/branch-orders/${orderId}/dispatch`);
          message.success('Order dispatched');
          openDetail({ id: orderId });
        } catch (err) { message.error(err.response?.data?.error || 'Failed to dispatch'); }
      },
    });
  };

  const handleReceive = async (orderId) => {
    if (receiveLines.length === 0) { message.error('Enter received quantities'); return; }
    try {
      await api.post(`/inventory/branch-orders/${orderId}/receive`, {
        received_lines: receiveLines.map(rl => ({
          line_item_id: rl.id,
          received_quantity: rl.received_quantity,
        })),
      });
      message.success('Order received');
      openDetail({ id: orderId });
    } catch (err) { message.error(err.response?.data?.error || 'Failed to receive'); }
  };

  // ─── LIST VIEW ───
  if (view === 'list') {
    const createdCount = data.filter(d => d.status === 'created').length;
    const inTransitCount = data.filter(d => d.status === 'in_transit').length;
    const receivedCount = data.filter(d => d.status === 'received').length;

    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Branch Orders' }]}
          title="Branch Orders"
          subtitle="Inter-location stock transfer requests"
          extra={<Button type="primary" icon={<SwapOutlined />} onClick={openCreate}>Create Order</Button>}
        />

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Total" value={data.length} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Created" value={createdCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="In Transit" value={inTransitCount} valueStyle={{ color: '#722ed1' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Received" value={receivedCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        </Row>

        <Table
          columns={[
            { title: 'Order Number', dataIndex: 'order_number', width: 140, render: (v, r) => <Button type="link" onClick={() => openDetail(r)}>{v}</Button> },
            { title: 'From Location', dataIndex: 'from_location_name', ellipsis: true },
            { title: 'To Location', dataIndex: 'to_location_name', ellipsis: true },
            { title: 'Request Type', dataIndex: 'request_type', width: 160 },
            { title: 'Request Date', dataIndex: 'request_date', width: 120, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
            { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={STATUS_COLOR[v] || 'default'}>{(v || '').replace('_', ' ').toUpperCase()}</Tag> },
          ]}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
        />
      </div>
    );
  }

  // ─── CREATE VIEW ───
  if (view === 'create') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Branch Orders', onClick: () => setView('list') }, { title: 'Create Order' }]}
          title="Create Branch Order"
          onBack={() => setView('list')}
        />

        <Card size="small" style={{ marginBottom: 16 }} title="Order Details">
          <Row gutter={16}>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>From Location *</Text>
              <Select
                placeholder="Source warehouse"
                value={formData.from_location_id}
                onChange={v => setFormData(prev => ({ ...prev, from_location_id: v }))}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={warehouses.map(w => ({ label: w.name || w.warehouse_name, value: w.id }))}
              />
            </Col>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>To Location *</Text>
              <Select
                placeholder="Destination warehouse"
                value={formData.to_location_id}
                onChange={v => setFormData(prev => ({ ...prev, to_location_id: v }))}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={warehouses.map(w => ({ label: w.name || w.warehouse_name, value: w.id }))}
              />
            </Col>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Request Type *</Text>
              <Select
                placeholder="Select type"
                value={formData.request_type}
                onChange={v => setFormData(prev => ({ ...prev, request_type: v }))}
                style={{ width: '100%' }}
                options={requestTypes.length > 0
                  ? requestTypes.map(rt => ({ label: rt.name || rt.value, value: rt.value || rt.name }))
                  : [
                    { label: 'Inter Branch Transfer', value: 'inter_branch_transfer' },
                    { label: 'Stock Replenishment', value: 'stock_replenishment' },
                    { label: 'Emergency Transfer', value: 'emergency_transfer' },
                  ]
                }
              />
            </Col>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Request Date</Text>
              <DatePicker value={formData.request_date} onChange={v => setFormData(prev => ({ ...prev, request_date: v }))} style={{ width: '100%' }} />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Remarks</Text>
              <Input placeholder="Optional remarks" value={formData.remarks} onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))} />
            </Col>
          </Row>
        </Card>

        {/* Line Items */}
        <Card size="small" title="Line Items" extra={<Button size="small" icon={<PlusOutlined />} onClick={addLineItem}>Add Item</Button>}>
          {lineItems.length === 0 ? (
            <Empty description="No line items added" />
          ) : (
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={lineItems}
              columns={[
                { title: 'Item', width: 300, render: (_, r, i) => (
                  <Select
                    size="small"
                    placeholder="Select item"
                    value={r.item_master_id}
                    onChange={v => updateLine(i, 'item_master_id', v)}
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    options={items.map(it => ({ label: `${it.item_code} — ${it.item_name}`, value: it.id }))}
                  />
                )},
                { title: 'Requested Qty', width: 140, render: (_, r, i) => (
                  <InputNumber size="small" min={1} value={r.requested_quantity} onChange={v => updateLine(i, 'requested_quantity', v)} style={{ width: '100%' }} />
                )},
                { title: '', width: 60, render: (_, _r, i) => <Button size="small" danger onClick={() => removeLine(i)}>×</Button> },
              ]}
            />
          )}

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={handleCreate}>Create Order</Button>
            <Button onClick={() => setView('list')}>Cancel</Button>
          </Space>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  const canApprove = selected?.status === 'created';
  const canDispatch = selected?.status === 'approved';
  const canReceive = selected?.status === 'in_transit';

  // Initialize receive lines when viewing an in_transit order
  useEffect(() => {
    if (view === 'detail' && selected?.status === 'in_transit' && selected?.line_items) {
      setReceiveLines(selected.line_items.map(li => ({
        ...li,
        received_quantity: li.approved_quantity || li.requested_quantity,
      })));
    }
  }, [view, selected]);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Branch Orders', onClick: () => { setView('list'); setSelected(null); } }, { title: selected?.order_number }]}
        title={selected?.order_number}
        onBack={() => { setView('list'); setSelected(null); }}
        extra={
          <Space>
            <Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').replace('_', ' ').toUpperCase()}</Tag>
            {canApprove && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(selected.id)}>Approve</Button>}
            {canDispatch && <Button type="primary" icon={<CarOutlined />} onClick={() => handleDispatch(selected.id)}>Dispatch</Button>}
          </Space>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }} title="Order Information">
        <Row gutter={16}>
          <Col span={4}><Text type="secondary">Order Number</Text><br /><Text strong>{selected?.order_number || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">From</Text><br /><Text strong>{selected?.from_location_name || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">To</Text><br /><Text strong>{selected?.to_location_name || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Request Type</Text><br /><Text strong>{(selected?.request_type || '').replace(/_/g, ' ')}</Text></Col>
          <Col span={4}><Text type="secondary">Request Date</Text><br /><Text strong>{selected?.request_date ? dayjs(selected.request_date).format('DD-MM-YYYY') : '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Status</Text><br /><Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').replace('_', ' ').toUpperCase()}</Tag></Col>
        </Row>
        {selected?.remarks && (
          <Row style={{ marginTop: 12 }}>
            <Col span={24}><Text type="secondary">Remarks:</Text> {selected.remarks}</Col>
          </Row>
        )}
      </Card>

      <Card size="small" title="Line Items">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={canReceive ? receiveLines : (selected?.line_items || [])}
          columns={[
            { title: 'Item', dataIndex: 'item_name', render: (v, r) => v || r.item_code || '—' },
            { title: 'Requested Qty', dataIndex: 'requested_quantity', width: 120 },
            { title: 'Approved Qty', dataIndex: 'approved_quantity', width: 120, render: v => v ?? '—' },
            ...(canReceive ? [{
              title: 'Received Qty', width: 140, render: (_, r, i) => (
                <InputNumber
                  size="small"
                  min={0}
                  value={r.received_quantity}
                  onChange={v => setReceiveLines(prev => prev.map((rl, idx) => idx === i ? { ...rl, received_quantity: v } : rl))}
                  style={{ width: '100%' }}
                />
              ),
            }] : [
              { title: 'Received Qty', dataIndex: 'received_quantity', width: 120, render: v => v ?? '—' },
            ]),
            { title: 'Variance', dataIndex: 'variance', width: 100, render: v => v != null ? <Text type={v < 0 ? 'danger' : 'success'}>{v}</Text> : '—' },
          ]}
        />
        {canReceive && (
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" icon={<InboxOutlined />} onClick={() => handleReceive(selected.id)}>Confirm Receipt</Button>
          </Space>
        )}
      </Card>
    </div>
  );
}
