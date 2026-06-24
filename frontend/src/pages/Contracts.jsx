import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, Tag, Space, Card, Typography, message, Row, Col } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';

const { Title, Text } = Typography;
const STATUS_COLOR = { active: 'green', expired: 'default', terminated: 'red' };

export default function Contracts() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const { isRequired } = useFieldConfig('contract');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/contracts');
      setData(res.data.data || []);
    } catch { message.error('Failed to load contracts'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/vendors', { params: { limit: 500 } }).then(r => setVendors(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/payment_terms').then(r => setPaymentTerms(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/currency').then(r => setCurrencies(r.data.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { form.resetFields(); setShowForm(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/contracts', {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      });
      message.success('Contract created');
      setShowForm(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Failed to save contract');
    }
  };

  const columns = [
    { title: 'Contract No.', dataIndex: 'contract_number', width: 130, render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Vendor', dataIndex: 'vendor_name', render: v => v || <Text type="secondary">—</Text> },
    { title: 'Validity', render: (_, r) => `${dayjs(r.start_date).format('DD MMM YYYY')} – ${dayjs(r.end_date).format('DD MMM YYYY')}` },
    { title: 'Payment Terms', dataIndex: 'payment_terms', render: v => v || <Text type="secondary">—</Text> },
    { title: 'Value', render: (_, r) => r.contract_value != null ? `${r.currency || 'INR'} ${Number(r.contract_value).toLocaleString()}` : <Text type="secondary">—</Text> },
    { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Contracts</Title>
          <Text type="secondary">Vendor contracts used for contract-based PR sourcing</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Contract</Button>
        </Col>
      </Row>

      {showForm && (
        <Card size="small" title="New Contract" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="vendor_id" label="Vendor" rules={[{ required: isRequired('vendor_id', true), message: 'Select a vendor' }]}>
                  <Select showSearch placeholder="Select vendor" optionFilterProp="label" options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="title" label="Title" rules={[{ required: isRequired('title', true), message: 'Enter a title' }]}>
                  <Input placeholder="e.g. Annual rate contract — packaging materials" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="currency" label="Currency" initialValue="INR" rules={[{ required: isRequired('currency', false) }]}>
                  <Select options={currencies.map(c => ({ value: c.name, label: c.name }))} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="start_date" label="Start Date" rules={[{ required: isRequired('start_date', true), message: 'Select start date' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="end_date" label="End Date" rules={[{ required: isRequired('end_date', true), message: 'Select end date' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="payment_terms" label="Payment Terms" rules={[{ required: isRequired('payment_terms', false) }]}>
                  <Select allowClear showSearch placeholder="Select terms" optionFilterProp="label" options={paymentTerms.map(p => ({ value: p.name, label: p.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="contract_value" label="Contract Value" rules={[{ required: isRequired('contract_value', false) }]}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
                </Form.Item>
              </Col>
            </Row>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
              <Button onClick={() => setShowForm(false)}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} />
      </Card>
    </div>
  );
}
