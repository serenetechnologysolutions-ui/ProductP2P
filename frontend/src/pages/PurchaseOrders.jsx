import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, Row, Col, Card, Typography, Divider, Space, Tag, message } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;

export default function PurchaseOrders() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState([{ description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
  const [vendors, setVendors] = useState([]);
  const [filterPoNumber, setFilterPoNumber] = useState('');
  const [filterStatus, setFilterStatus] = useState(undefined);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/purchase-orders'); setData(res.data.data || []); } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); api.get('/vendors?limit=500').then(r => setVendors(r.data.data || [])).catch(() => {}); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const totalAmount = items.reduce((s, i) => s + (i.total_line_amount || 0), 0);
      await api.post('/purchase-orders', {
        ...values,
        po_date: values.po_date?.format('YYYY-MM-DD'),
        validity_date: values.validity_date?.format('YYYY-MM-DD'),
        total_amount: totalAmount,
        line_items: items,
      });
      message.success('PO created');
      setShowForm(false); form.resetFields();
      setItems([{ description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Error'); }
  };

  const updateItem = (i, field, value) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (['quantity', 'unit_price', 'tax_percent'].includes(field)) {
        updated.amount = (updated.quantity || 0) * (updated.unit_price || 0);
        updated.tax_amount = updated.amount * ((updated.tax_percent || 0) / 100);
        updated.total_line_amount = updated.amount + updated.tax_amount;
      }
      return updated;
    }));
  };

  const addItem = () => setItems([...items, { description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const columns = [
    { title: 'PO Number', dataIndex: 'po_number' },
    { title: 'PO Date', dataIndex: 'po_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Vendor', dataIndex: 'vendor_id', render: v => vendors.find(x => x.id === v)?.vendor_name || v },
    { title: 'Buyer', dataIndex: 'buyer_name', render: v => v || '—' },
    { title: 'GSTIN', dataIndex: 'gstin', render: v => v || '—' },
    { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v || 0).toLocaleString()}` },
    { title: 'Validity', dataIndex: 'validity_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'open' ? 'blue' : 'green'}>{v}</Tag> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Title level={4} style={{ margin: 0 }}>Purchase Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>Create PO</Button>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Create and manage Purchase Orders with buyer details, line items, and tax calculations.</Text>

      {!showForm ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={12} align="middle">
              <Col flex="1"><Input placeholder="PO Number" value={filterPoNumber} onChange={e => setFilterPoNumber(e.target.value)} allowClear /></Col>
              <Col>
                <Select placeholder="Status" value={filterStatus} onChange={v => setFilterStatus(v)} allowClear style={{ width: 180 }}>
                  <Select.Option value="open">Open</Select.Option>
                  <Select.Option value="partially_fulfilled">Partially Fulfilled</Select.Option>
                  <Select.Option value="fulfilled">Fulfilled</Select.Option>
                  <Select.Option value="closed">Closed</Select.Option>
                </Select>
              </Col>
              <Col><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData()}>Search</Button></Col>
              <Col><Button icon={<ClearOutlined />} onClick={() => { setFilterPoNumber(''); setFilterStatus(undefined); }}>Clear</Button></Col>
            </Row>
          </Card>
          <Table columns={columns} dataSource={data.filter(item => {
            let match = true;
            if (filterPoNumber) match = match && item.po_number?.toLowerCase().includes(filterPoNumber.toLowerCase());
            if (filterStatus) match = match && item.status === filterStatus;
            return match;
          })} rowKey="id" loading={loading} size="middle" />
        </>
      ) : (
        <Card>
          <Form form={form} layout="vertical">
            <Title level={5}>Buyer & PO Information</Title>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="po_number" label="PO Number" rules={[{ required: true }]}><Input placeholder="PO-2024-001" /></Form.Item></Col>
              <Col span={6}><Form.Item name="po_date" label="PO Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={6}><Form.Item name="vendor_id" label="Vendor (Supplier)" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select vendor" options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
              </Form.Item></Col>
              <Col span={6}><Form.Item name="validity_date" label="PO Validity Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="buyer_name" label="Buyer Name"><Input placeholder="Company buying goods" /></Form.Item></Col>
              <Col span={8}><Form.Item name="buyer_address" label="Buyer Address"><Input placeholder="Full address" /></Form.Item></Col>
              <Col span={4}><Form.Item name="gstin" label="GSTIN"><Input placeholder="22AAAAA0000A1Z5" maxLength={15} /></Form.Item></Col>
              <Col span={4}><Form.Item name="state_name" label="State Name"><Input placeholder="Maharashtra" /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={4}><Form.Item name="state_code" label="State Code"><Input placeholder="27" maxLength={4} /></Form.Item></Col>
              <Col span={8}><Form.Item name="terms_of_payment" label="Terms of Payment"><Input placeholder="Net 30 days" /></Form.Item></Col>
            </Row>

            <Divider />
            <Title level={5}>Purchase Lines</Title>
            <div style={{ overflowX: 'auto' }}>
              <Row gutter={8} style={{ marginBottom: 8, minWidth: 1000 }}>
                <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>Description</Text></Col>
                <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>HSN/SAC</Text></Col>
                <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Qty</Text></Col>
                <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>UOM</Text></Col>
                <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Unit Cost (₹)</Text></Col>
                <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Amount (₹)</Text></Col>
                <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Tax %</Text></Col>
                <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Tax (₹)</Text></Col>
                <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Total (₹)</Text></Col>
                <Col span={1}></Col>
              </Row>
              {items.map((item, i) => (
                <Row key={i} gutter={8} style={{ marginBottom: 8, minWidth: 1000 }} align="middle">
                  <Col span={4}><Input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} size="small" /></Col>
                  <Col span={2}><Input placeholder="HSN" value={item.hsn_sac} onChange={e => updateItem(i, 'hsn_sac', e.target.value)} size="small" /></Col>
                  <Col span={2}><InputNumber min={0} value={item.quantity} onChange={v => updateItem(i, 'quantity', v)} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={2}><Input placeholder="Nos" value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} size="small" /></Col>
                  <Col span={3}><InputNumber min={0} value={item.unit_price} onChange={v => updateItem(i, 'unit_price', v)} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={3}><InputNumber disabled value={item.amount} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={2}><InputNumber min={0} max={100} value={item.tax_percent} onChange={v => updateItem(i, 'tax_percent', v)} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={3}><InputNumber disabled value={Math.round(item.tax_amount * 100) / 100} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={2}><InputNumber disabled value={Math.round(item.total_line_amount * 100) / 100} size="small" style={{ width: '100%' }} /></Col>
                  <Col span={1}>{items.length > 1 && <Button icon={<DeleteOutlined />} danger size="small" onClick={() => removeItem(i)} />}</Col>
                </Row>
              ))}
            </div>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} block style={{ marginTop: 8 }}>Add Line</Button>

            <Card size="small" style={{ marginTop: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
              <Row gutter={24}>
                <Col span={8}><Text>Subtotal: <Text strong>₹{items.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</Text></Text></Col>
                <Col span={8}><Text>Total Tax: <Text strong>₹{Math.round(items.reduce((s, i) => s + (i.tax_amount || 0), 0) * 100 / 100).toLocaleString()}</Text></Text></Col>
                <Col span={8}><Text>Total PO Value: <Text strong style={{ fontSize: 16, color: '#1890ff' }}>₹{Math.round(items.reduce((s, i) => s + (i.total_line_amount || 0), 0) * 100 / 100).toLocaleString()}</Text></Text></Col>
              </Row>
            </Card>

            <Divider />
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Create PO</Button>
              <Button onClick={() => setShowForm(false)}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      )}
    </div>
  );
}
