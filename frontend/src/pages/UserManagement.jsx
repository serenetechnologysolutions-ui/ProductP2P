import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Modal, Popconfirm, Typography, Switch, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const ROLE_COLOR = { mdm_admin: 'blue', procurement_admin: 'purple', vendor: 'green' };
const ROLE_LABEL = { mdm_admin: 'MDM Admin', procurement_admin: 'Procurement Admin', vendor: 'Vendor' };

export default function UserManagement() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState(undefined);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/users'); setData(res.data.data || []); } catch (_) { message.error('Failed to load users'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: 'mdm_admin' }); setModalOpen(true); };
  const openEdit = (record) => { setEditing(record); form.setFieldsValue({ ...record, password: '' }); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.put(`/users/${editing.id}`, values);
        message.success('User updated');
      } else {
        if (!values.password || values.password.length < 6) { message.error('Password must be at least 6 characters'); return; }
        await api.post('/users', values);
        message.success('User created');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('User deactivated');
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'full_name', render: (t) => <Space><UserOutlined style={{ color: '#1890ff' }} />{t}</Space> },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Role', dataIndex: 'role', width: 160, render: v => <Tag color={ROLE_COLOR[v]}>{ROLE_LABEL[v] || v}</Tag> },
    { title: 'Status', dataIndex: 'is_active', width: 80, render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Created', dataIndex: 'created_at', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Actions', width: 120, render: (_, r) => (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
        <Popconfirm title="Deactivate this user?" onConfirm={() => handleDelete(r.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add User</Button>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage system users, roles, and access. Add new users, edit permissions, or deactivate accounts.</Text>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="1"><Input placeholder="Search by Name/Email" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} allowClear /></Col>
          <Col>
            <Select placeholder="Role" value={filterRole} onChange={v => setFilterRole(v)} allowClear style={{ width: 180 }}>
              <Select.Option value="mdm_admin">MDM Admin</Select.Option>
              <Select.Option value="procurement_admin">Procurement Admin</Select.Option>
              <Select.Option value="vendor">Vendor</Select.Option>
            </Select>
          </Col>
          <Col><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData()}>Search</Button></Col>
          <Col><Button icon={<ClearOutlined />} onClick={() => { setFilterSearch(''); setFilterRole(undefined); fetchData(); }}>Clear</Button></Col>
        </Row>
      </Card>
      <Table columns={columns} dataSource={data.filter(item => {
        let match = true;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          match = match && (item.full_name?.toLowerCase().includes(s) || item.email?.toLowerCase().includes(s));
        }
        if (filterRole) match = match && item.role === filterRole;
        return match;
      })} rowKey="id" loading={loading} size="middle" />

      <Modal title={editing ? 'Edit User' : 'Add User'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} okText={editing ? 'Update' : 'Create'} width={500}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="email@example.com" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={[
              { value: 'mdm_admin', label: 'MDM Admin' },
              { value: 'procurement_admin', label: 'Procurement Admin' },
              { value: 'vendor', label: 'Vendor' },
            ]} />
          </Form.Item>
          <Form.Item name="password" label={editing ? 'New Password (leave blank to keep current)' : 'Password'} rules={editing ? [] : [{ required: true, min: 6 }]}>
            <Input.Password placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
