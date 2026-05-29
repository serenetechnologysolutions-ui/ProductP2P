import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Tag, Space, Card, Tabs, Popconfirm, Typography, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
const CATEGORIES = [
  { key: 'company', label: 'Companies' },
  { key: 'department', label: 'Departments' },
  { key: 'supplier_group', label: 'Supplier Groups' },
  { key: 'supplier_category', label: 'Categories' },
  { key: 'country', label: 'Countries' },
  { key: 'state', label: 'States' },
  { key: 'city', label: 'Cities' },
];

function SubMasterTab({ category }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get(`/sub-masters/${category}`); setData(res.data.data || []); } catch (_) {}
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [category]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) { await api.put(`/sub-masters/${editing.id}`, values); message.success('Updated'); }
      else { await api.post('/sub-masters', { ...values, category }); message.success('Added'); }
      setShowForm(false); setEditing(null); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Error'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code', width: 100, render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: '', width: 100, render: (_, r) => (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setShowForm(true); }} />
        <Popconfirm title="Remove?" onConfirm={async () => { await api.delete(`/sub-masters/${r.id}`); fetchData(); }}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setShowForm(true); }}>Add</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      {showForm && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Form form={form} layout="inline">
            <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Name" style={{ width: 200 }} /></Form.Item>
            <Form.Item name="code"><Input placeholder="Code" style={{ width: 80 }} /></Form.Item>
            <Form.Item><Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button></Form.Item>
            <Form.Item><Button onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button></Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}

export default function SubMasters() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Sub Masters</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage lookup data used across the system — companies, departments, supplier groups, categories, locations.</Text>
      <Tabs items={CATEGORIES.map(c => ({ key: c.key, label: c.label, children: <SubMasterTab category={c.key} /> }))} type="card" />
    </div>
  );
}
