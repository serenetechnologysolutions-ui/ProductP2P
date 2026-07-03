import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag, Typography, Space, Row, Col, Statistic, message, DatePicker, Input, Select, InputNumber, Empty, Modal } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, CheckCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLOR = { draft: 'blue', confirmed: 'green', closed: 'default' };

export default function PurchaseReturns() {
  const [view, setView] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterVendor, setFilterVendor] = useState('');
  const [filterDateRange, setFilterDateRange] = useState(null);

  // Create state
  const [vendors, setVendors] = useState([]);
  const [eligibleBatches, setEligibleBatches] = useState([]);
  const [formData, setFormData] = useState({ vendor_id: null, grn_id: '', return_date: dayjs(), return_reason: '', round_off: 0 });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterVendor) params.vendor = filterVendor;
      if (filterDateRange && filterDateRange[0]) {
        params.date_from = filterDateRange[0].format('YYYY-MM-DD');
        params.date_to = filterDateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/inventory/purchase-returns', { params });
      setData(res.data.data || []);
    } catch { message.error('Failed to load purchase returns'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openDetail = async (record) => {
    try {
      const res = await api.get(`/inventory/purchase-returns/${record.id}`);
      setSelected(res.data.data);
    } catch { setSelected(record); }
    setView('detail');
  };

  const openCreate = async () => {
    try {
      const res = await api.get('/vendors', { params: { limit: 200 } });
      setVendors(res.data.data || []);
    } catch { setVendors([]); }
    setFormData({ vendor_id: null, grn_id: '', return_date: dayjs(), return_reason: '', round_off: 0 });
    setLineItems([]);
    setEligibleBatches([]);
    setView('create');
  };

  const fetchEligibleBatches = async (vendorId) => {
    try {
      const params = {};
      if (vendorId) params.vendor_id = vendorId;
      const res = await api.get('/inventory/purchase-returns/eligible-batches', { params });
      setEligibleBatches(res.data.data || []);
    } catch { setEligibleBatches([]); }
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      key: Date.now(),
      batch_id: null,
      batch_number: '',
      item_master_id: '',
      location_id: '',
      return_quantity: 1,
      rate: 0,
      discount_percentage: 0,
      tax_percentage: 0,
      line_amount: 0,
    }]);
  };

  const updateLine = (index, field, value) => {
    setLineItems(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      // If batch selected, populate fields from batch data
      if (field === 'batch_id') {
        const batch = eligibleBatches.find(b => b.id === value);
        if (batch) {
          updated.batch_number = batch.batch_number;
          updated.item_master_id = batch.item_master_id;
          updated.location_id = batch.location_id;
          updated.rate = Number(batch.rate) || 0;
          updated.discount_percentage = Number(batch.discount_percentage) || 0;
          updated.tax_percentage = Number(batch.tax_percentage) || 0;
        }
      }
      // Recalculate line amount
      const qty = Number(updated.return_quantity) || 0;
      const rate = Number(updated.rate) || 0;
      const disc = Number(updated.discount_percentage) || 0;
      const tax = Number(updated.tax_percentage) || 0;
      updated.line_amount = (qty * rate) * (1 - disc / 100) * (1 + tax / 100);
      return updated;
    }));
  };

  const removeLine = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.line_amount) || 0), 0) + Number(formData.round_off || 0);

  const handleCreate = async () => {
    if (!formData.vendor_id) { message.error('Select a vendor'); return; }
    if (!formData.return_date) { message.error('Return date is required'); return; }
    if (!formData.return_reason) { message.error('Return reason is required'); return; }
    if (lineItems.length === 0) { message.error('Add at least one line item'); return; }

    setSaving(true);
    try {
      await api.post('/inventory/purchase-returns', {
        vendor_id: formData.vendor_id,
        grn_id: formData.grn_id || undefined,
        return_date: formData.return_date.format('YYYY-MM-DD'),
        return_reason: formData.return_reason,
        round_off: formData.round_off || 0,
        line_items: lineItems.map(li => ({
          item_master_id: li.item_master_id,
          batch_id: li.batch_id,
          batch_number: li.batch_number,
          location_id: li.location_id,
          return_quantity: li.return_quantity,
          rate: li.rate,
          discount_percentage: li.discount_percentage,
          tax_percentage: li.tax_percentage,
        })),
      });
      message.success('Purchase return created successfully');
      setView('list');
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create purchase return'); }
    setSaving(false);
  };

  const handleConfirm = async (returnId) => {
    Modal.confirm({
      title: 'Confirm Purchase Return',
      content: 'This will adjust inventory. Are you sure?',
      onOk: async () => {
        try {
          await api.post(`/inventory/purchase-returns/${returnId}/confirm`);
          message.success('Purchase return confirmed');
          openDetail({ id: returnId });
        } catch (err) { message.error(err.response?.data?.error || 'Failed to confirm'); }
      },
    });
  };

  // ─── LIST VIEW ───
  if (view === 'list') {
    const draftCount = data.filter(d => d.status === 'draft').length;
    const confirmedCount = data.filter(d => d.status === 'confirmed').length;

    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Purchase Returns' }]}
          title="Purchase Returns"
          subtitle="Manage returns against specific batches"
          extra={<Button type="primary" icon={<RollbackOutlined />} onClick={openCreate}>Create Return</Button>}
        />

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Total" value={data.length} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Draft" value={draftCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Confirmed" value={confirmedCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        </Row>

        {/* Filters */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              placeholder="Status"
              value={filterStatus}
              onChange={v => { setFilterStatus(v); }}
              allowClear
              style={{ width: 140 }}
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Confirmed', value: 'confirmed' },
                { label: 'Closed', value: 'closed' },
              ]}
            />
            <Input placeholder="Vendor" value={filterVendor} onChange={e => setFilterVendor(e.target.value)} style={{ width: 160 }} allowClear />
            <RangePicker value={filterDateRange} onChange={setFilterDateRange} />
            <Button onClick={fetchData}>Search</Button>
          </Space>
        </Card>

        <Table
          columns={[
            { title: 'Return Number', dataIndex: 'return_number', width: 150, render: (v, r) => <Button type="link" onClick={() => openDetail(r)}>{v}</Button> },
            { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true },
            { title: 'GRN', dataIndex: 'grn_number', width: 130 },
            { title: 'Return Date', dataIndex: 'return_date', width: 120, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
            { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={STATUS_COLOR[v] || 'default'}>{(v || '').toUpperCase()}</Tag> },
            { title: 'Total Amount', dataIndex: 'total_amount', width: 130, render: v => `₹${Number(v || 0).toLocaleString()}` },
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
          items={[{ title: 'Procurement' }, { title: 'Purchase Returns', onClick: () => setView('list') }, { title: 'Create Return' }]}
          title="Create Purchase Return"
          onBack={() => setView('list')}
        />

        {/* Header Fields */}
        <Card size="small" style={{ marginBottom: 16 }} title="Return Details">
          <Row gutter={16}>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Vendor *</Text>
              <Select
                placeholder="Select vendor"
                value={formData.vendor_id}
                onChange={v => { setFormData(prev => ({ ...prev, vendor_id: v })); fetchEligibleBatches(v); }}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={vendors.map(v => ({ label: v.name || v.vendor_name, value: v.id }))}
              />
            </Col>
            <Col span={6}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>GRN Number</Text>
              <Input placeholder="GRN number" value={formData.grn_id} onChange={e => setFormData(prev => ({ ...prev, grn_id: e.target.value }))} />
            </Col>
            <Col span={4}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Return Date *</Text>
              <DatePicker value={formData.return_date} onChange={v => setFormData(prev => ({ ...prev, return_date: v }))} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Return Reason *</Text>
              <Input placeholder="Reason for return" value={formData.return_reason} onChange={e => setFormData(prev => ({ ...prev, return_reason: e.target.value }))} />
            </Col>
          </Row>
        </Card>

        {/* Line Items */}
        <Card size="small" title="Line Items" extra={<Button size="small" icon={<PlusOutlined />} onClick={addLineItem}>Add Line</Button>}>
          {lineItems.length === 0 ? (
            <Empty description="No line items added" />
          ) : (
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={lineItems}
              columns={[
                { title: 'Batch', width: 250, render: (_, r, i) => (
                  <Select
                    size="small"
                    placeholder="Select batch"
                    value={r.batch_id}
                    onChange={v => updateLine(i, 'batch_id', v)}
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    options={eligibleBatches.map(b => ({ label: `${b.batch_number} (Avail: ${b.qty_available})`, value: b.id }))}
                  />
                )},
                { title: 'Qty', width: 80, render: (_, r, i) => <InputNumber size="small" min={1} value={r.return_quantity} onChange={v => updateLine(i, 'return_quantity', v)} style={{ width: '100%' }} /> },
                { title: 'Rate', width: 100, render: (_, r) => `₹${Number(r.rate).toLocaleString()}` },
                { title: 'Disc %', width: 70, render: (_, r) => `${r.discount_percentage}%` },
                { title: 'Tax %', width: 70, render: (_, r) => `${r.tax_percentage}%` },
                { title: 'Amount', width: 120, render: (_, r) => `₹${Number(r.line_amount).toFixed(2)}` },
                { title: '', width: 60, render: (_, _r, i) => <Button size="small" danger onClick={() => removeLine(i)}>×</Button> },
              ]}
            />
          )}

          <Row style={{ marginTop: 12 }} justify="end">
            <Col span={6}>
              <Space>
                <Text>Round Off:</Text>
                <InputNumber size="small" value={formData.round_off} onChange={v => setFormData(prev => ({ ...prev, round_off: v }))} />
              </Space>
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              <Text strong>Total: ₹{totalAmount.toFixed(2)}</Text>
            </Col>
          </Row>

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={handleCreate}>Create Return</Button>
            <Button onClick={() => setView('list')}>Cancel</Button>
          </Space>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Purchase Returns', onClick: () => { setView('list'); setSelected(null); } }, { title: selected?.return_number }]}
        title={selected?.return_number}
        onBack={() => { setView('list'); setSelected(null); }}
        extra={
          <Space>
            <Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').toUpperCase()}</Tag>
            {selected?.status === 'draft' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(selected.id)}>Confirm Return</Button>
            )}
          </Space>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }} title="Return Information">
        <Row gutter={16}>
          <Col span={4}><Text type="secondary">Return Number</Text><br /><Text strong>{selected?.return_number || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Vendor</Text><br /><Text strong>{selected?.vendor_name || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">GRN</Text><br /><Text strong>{selected?.grn_number || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Return Date</Text><br /><Text strong>{selected?.return_date ? dayjs(selected.return_date).format('DD-MM-YYYY') : '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Total Amount</Text><br /><Text strong>₹{Number(selected?.total_amount || 0).toLocaleString()}</Text></Col>
          <Col span={4}><Text type="secondary">Status</Text><br /><Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').toUpperCase()}</Tag></Col>
        </Row>
        {selected?.return_reason && (
          <Row style={{ marginTop: 12 }}>
            <Col span={24}><Text type="secondary">Reason:</Text> {selected.return_reason}</Col>
          </Row>
        )}
      </Card>

      <Card size="small" title="Line Items">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={selected?.line_items || []}
          columns={[
            { title: 'Batch Number', dataIndex: 'batch_number', width: 220 },
            { title: 'Item', dataIndex: 'item_name', ellipsis: true },
            { title: 'Location', dataIndex: 'location_name', width: 140 },
            { title: 'Qty', dataIndex: 'return_quantity', width: 80 },
            { title: 'Rate', dataIndex: 'rate', width: 100, render: v => `₹${Number(v).toLocaleString()}` },
            { title: 'Disc %', dataIndex: 'discount_percentage', width: 70 },
            { title: 'Tax %', dataIndex: 'tax_percentage', width: 70 },
            { title: 'Amount', dataIndex: 'line_amount', width: 120, render: v => `₹${Number(v).toFixed(2)}` },
          ]}
        />
      </Card>
    </div>
  );
}
