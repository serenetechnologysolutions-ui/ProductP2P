import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Card, Typography, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;

export default function ExtractionConfig() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/extraction-configs'); setData(res.data.data || []); } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const aliases = values.aliases_text.split(',').map(a => a.trim()).filter(Boolean);
      const payload = { field_name: values.field_name, aliases, regex_pattern: values.regex_pattern, priority: values.priority };
      if (editing) { await api.put(`/extraction-configs/${editing.id}`, payload); message.success('Updated'); }
      else { await api.post('/extraction-configs', payload); message.success('Added'); }
      setShowForm(false); setEditing(null); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Error'); }
  };

  const PRIORITY_COLOR = { high: 'red', medium: 'orange', low: 'blue' };

  const columns = [
    { title: 'Field Name', dataIndex: 'field_name' },
    { title: 'Aliases', dataIndex: 'aliases', render: v => { const arr = typeof v === 'string' ? JSON.parse(v) : v; return (arr || []).map((a, i) => <Tag key={i}>{a}</Tag>); } },
    { title: 'Regex', dataIndex: 'regex_pattern', render: v => v ? <code>{v}</code> : '—' },
    { title: 'Priority', dataIndex: 'priority', render: v => <Tag color={PRIORITY_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    { title: '', width: 100, render: (_, r) => (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => {
          const aliases = typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases;
          setEditing(r); form.setFieldsValue({ ...r, aliases_text: (aliases || []).join(', ') }); setShowForm(true);
        }} />
        <Popconfirm title="Remove?" onConfirm={async () => { await api.delete(`/extraction-configs/${r.id}`); fetchData(); }}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Extraction Training Setup</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ priority: 'medium' }); setShowForm(true); }}>Add Rule</Button>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Configure field extraction rules for invoice PDF processing. Define aliases, regex patterns, and priority for each field.</Text>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" />
      {showForm && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Form form={form} layout="vertical">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="field_name" label="Field Name" rules={[{ required: true }]}><Input placeholder="e.g. Invoice Number" /></Form.Item>
              <Form.Item name="aliases_text" label="Aliases (comma-separated)" rules={[{ required: true }]}><Input placeholder="invoice no, inv no, bill no" /></Form.Item>
              <Form.Item name="regex_pattern" label="Regex Pattern (optional)"><Input placeholder="e.g. [A-Z0-9\\-]+" /></Form.Item>
              <Form.Item name="priority" label="Priority" rules={[{ required: true }]}><Select options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} /></Form.Item>
              <Space>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
                <Button onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              </Space>
            </Space>
          </Form>
        </Card>
      )}
    </div>
  );
}
