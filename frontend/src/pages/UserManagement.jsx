import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Popconfirm, Switch, message, Statistic, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SearchOutlined, ClearOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import CompanySelector from '../components/CompanySelector';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

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
  const [companyIds, setCompanyIds] = useState([]);
  const { isRequired } = useFieldConfig('user_management');

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/users'); setData(res.data.data || []); } catch (_) { message.error('Failed to load users'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: 'mdm_admin' }); setCompanyIds([]); setModalOpen(o => !o); };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record, password: '' });
    // Fetch existing company access for this user
    api.get(`/companies/user-access/${record.id}`).then(res => {
      setCompanyIds((res.data.data || []).map(c => c.company_id));
    }).catch(() => setCompanyIds([]));
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, company_ids: companyIds };
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        message.success('User updated');
      } else {
        if (!values.password || values.password.length < 6) { message.error('Password must be at least 6 characters'); return; }
        await api.post('/users', payload);
        message.success('User created');
      }
      setModalOpen(false);
      setCompanyIds([]);
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
    { title: 'Name', dataIndex: 'full_name', render: (t) => <Space><UserOutlined style={{ color: '#1890ff' }} />{t}</Space>, sorter: (a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')) },
    { title: 'Email', dataIndex: 'email', sorter: (a, b) => String(a.email || '').localeCompare(String(b.email || '')) },
    {
      title: 'Role', dataIndex: 'role', width: 160, render: v => <Tag color={ROLE_COLOR[v]}>{ROLE_LABEL[v] || v}</Tag>,
      sorter: (a, b) => String(a.role || '').localeCompare(String(b.role || '')),
      filters: Object.keys(ROLE_LABEL).map(v => ({ text: ROLE_LABEL[v], value: v })),
      onFilter: (value, row) => row.role === value,
    },
    {
      title: 'Status', dataIndex: 'is_active', width: 80, render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
      filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }],
      onFilter: (value, row) => !!row.is_active === value,
    },
    { title: 'Created', dataIndex: 'created_at', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—', sorter: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
    { title: 'Actions', width: 120, render: (_, r) => (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
        <Popconfirm title="Deactivate this user?" onConfirm={() => handleDelete(r.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      </Space>
    )},
  ];

  const activeCount = data.filter(u => u.is_active).length;
  const adminCount = data.filter(u => u.role === 'mdm_admin').length;
  const vendorCount = data.filter(u => u.role === 'vendor').length;

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'User Management' }]}
        title="User Management"
        subtitle="Manage system users, roles, and access. Add new users, edit permissions, or deactivate accounts."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add User</Button>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Users" value={data.length} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={activeCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="MDM Admins" value={adminCount} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Vendor Logins" value={vendorCount} /></Card></Col>
      </Row>

      {adminCount === 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="error"
          showIcon
          message="No MDM Admin users configured"
          description="At least one active MDM Admin is needed to manage workflows, field configuration, and system settings."
        />
      )}

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

      <InlineExpandPanel
        open={modalOpen}
        title={editing ? 'Edit User' : 'Add User'}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSave}
        submitText={editing ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={[{ required: isRequired('full_name', true), message: 'Full Name is required' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: isRequired('email', true), message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="email@example.com" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: isRequired('role', true), message: 'Role is required' }]}>
            <Select options={[
              { value: 'mdm_admin', label: 'MDM Admin' },
              { value: 'procurement_admin', label: 'Procurement Admin' },
              { value: 'vendor', label: 'Vendor' },
            ]} />
          </Form.Item>
          <Form.Item name="password" label={editing ? 'New Password (leave blank to keep current)' : 'Password'} rules={editing ? [] : [{ required: isRequired('password', true), min: 6, message: 'Password is required (min 6 characters)' }]}>
            <Input.Password placeholder={editing ? 'Leave blank to keep current' : 'Min 6 characters'} />
          </Form.Item>
          <Form.Item label="Company Access">
            <CompanySelector
              mode="multiple"
              value={companyIds}
              onChange={setCompanyIds}
              placeholder="Select companies this user can access"
              style={{ width: '100%' }}
            />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          )}
        </Form>
      </InlineExpandPanel>

      <Table columns={columns} dataSource={data.filter(item => {
        let match = true;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          match = match && (item.full_name?.toLowerCase().includes(s) || item.email?.toLowerCase().includes(s));
        }
        if (filterRole) match = match && item.role === filterRole;
        return match;
      })} rowKey="id" loading={loading} size="middle" />
    </div>
  );
}
