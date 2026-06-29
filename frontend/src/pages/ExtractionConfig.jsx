import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Popconfirm, message, Row, Col, Card, Statistic } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api/axios';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const PRIORITY_COLOR = { high: 'red', medium: 'orange', low: 'blue' };

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

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ priority: 'medium' }); setShowForm(true); };
  const openEdit = (r) => {
    const aliases = typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases;
    setEditing(r); form.setFieldsValue({ ...r, aliases_text: (aliases || []).join(', ') }); setShowForm(true);
  };

  const columns = [
    { title: 'Field Name', dataIndex: 'field_name' },
    { title: 'Aliases', dataIndex: 'aliases', render: v => { const arr = typeof v === 'string' ? JSON.parse(v) : v; return (arr || []).map((a, i) => <Tag key={i}>{a}</Tag>); } },
    { title: 'Regex', dataIndex: 'regex_pattern', render: v => v ? <code>{v}</code> : '—' },
    { title: 'Priority', dataIndex: 'priority', render: v => <Tag color={PRIORITY_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    {
      title: '', width: 100, render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          <Popconfirm title="Remove?" onConfirm={async () => { await api.delete(`/extraction-configs/${r.id}`); fetchData(); }}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const highCount = data.filter(d => d.priority === 'high').length;
  const mediumCount = data.filter(d => d.priority === 'medium').length;
  const lowCount = data.filter(d => d.priority === 'low').length;

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'Extraction Training Setup' }]}
        title="Extraction Training Setup"
        subtitle="Configure field extraction rules for invoice PDF processing. Define aliases, regex patterns, and priority for each field."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Rule</Button>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Rules" value={data.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="High Priority" value={highCount} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Medium Priority" value={mediumCount} valueStyle={{ color: '#d48806' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Low Priority" value={lowCount} /></Card></Col>
      </Row>

      <InlineExpandPanel
        open={showForm}
        title={editing ? 'Edit Extraction Rule' : 'Add Extraction Rule'}
        onCancel={() => { setShowForm(false); setEditing(null); }}
        onSubmit={handleSave}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="field_name" label="Field Name" rules={[{ required: true }]}><Input placeholder="e.g. Invoice Number" /></Form.Item>
          <Form.Item name="aliases_text" label="Aliases (comma-separated)" rules={[{ required: true }]}><Input placeholder="invoice no, inv no, bill no" /></Form.Item>
          <Form.Item name="regex_pattern" label="Regex Pattern (optional)"><Input placeholder="e.g. [A-Z0-9\-]+" /></Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}><Select options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} /></Form.Item>
        </Form>
      </InlineExpandPanel>

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" />
      </Card>
    </div>
  );
}
