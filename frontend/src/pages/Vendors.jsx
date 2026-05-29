import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Tabs, Popconfirm, Typography, Divider, Statistic, Avatar, Modal, Checkbox, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EditOutlined, SearchOutlined, ClearOutlined, SaveOutlined, CheckOutlined, CloseOutlined, StopOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
const STATUS_COLOR = { draft: 'default', submitted: 'blue', under_review: 'orange', approved: 'green', rejected: 'red', inactive: '#8c8c8c' };

export default function Vendors() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [view, setView] = useState('list'); // list | detail | form | edit
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [searchName, setSearchName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [subMasters, setSubMasters] = useState({});
  const [addresses, setAddresses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (searchName) params.name = searchName;
      const res = await api.get('/vendors', { params });
      setData(res.data.data);
      setPagination({ current: page, pageSize, total: res.data.pagination.total });
    } catch (_) { message.error('Failed to load vendors'); }
    setLoading(false);
  }, [searchName]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const cats = ['company', 'department', 'supplier_group', 'supplier_category', 'state', 'city'];
        const results = {};
        for (const cat of cats) { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; }
        setSubMasters(results);
      } catch (_) {}
    })();
  }, []);

  const openDetail = async (record) => {
    try {
      const res = await api.get(`/vendors/${record.id}`);
      setSelected(res.data.data);
      setView('detail');
    } catch (_) { setSelected(record); setView('detail'); }
  };

  const openForm = () => { form.resetFields(); setSelected(null); setView('form'); };

  const openEdit = (vendor) => {
    form.setFieldsValue(vendor);
    setSelected(vendor);
    setAddresses(vendor.addresses || []);
    setBankAccounts(vendor.bank_accounts || []);
    setView('edit');
  };

  const goBack = () => { setView('list'); setSelected(null); setAddresses([]); setBankAccounts([]); };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/vendors', values);
      message.success('Vendor created');
      goBack(); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Save failed'); }
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      await api.put(`/vendors/${selected.id}`, { ...values, addresses, bank_accounts: bankAccounts });
      message.success('Vendor updated');
      goBack(); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Update failed'); }
  };

  const handleAction = async (action) => {
    try {
      if (action === 'reject') {
        if (!rejectReason.trim()) { message.error('Reason is required'); return; }
        await api.post(`/vendors/${selected.id}/reject`, { reason: rejectReason });
        setRejectModalOpen(false); setRejectReason('');
      } else if (action === 'approve') { await api.post(`/vendors/${selected.id}/approve`); }
      else if (action === 'review') { await api.post(`/vendors/${selected.id}/review`); }
      else if (action === 'deactivate') { await api.put(`/vendors/${selected.id}/deactivate`); }
      message.success('Action completed');
      const res = await api.get(`/vendors/${selected.id}`);
      setSelected(res.data.data);
      fetchData(pagination.current, pagination.pageSize);
    } catch (err) { message.error(err.response?.data?.error || 'Action failed'); }
  };

  // Address helpers
  const addAddress = () => setAddresses([...addresses, { line1: '', line2: '', city: '', state: '', country: 'India', pin_code: '', tags: [] }]);
  const removeAddress = (i) => setAddresses(addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i, field, value) => setAddresses(addresses.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  // Bank helpers
  const addBank = () => setBankAccounts([...bankAccounts, { ifsc_code: '', account_number: '', account_holder_name: '', bank_name: '', branch: '', city: '', state: '', country: 'India' }]);
  const removeBank = (i) => setBankAccounts(bankAccounts.filter((_, idx) => idx !== i));
  const updateBank = (i, field, value) => setBankAccounts(bankAccounts.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  // ─── LIST VIEW ───
  if (view === 'list') {
    const columns = [
      { title: 'Name', dataIndex: 'vendor_name', render: (t) => <Space><Avatar size="small" style={{ background: '#1890ff' }}>{t?.[0]}</Avatar><Text strong>{t}</Text></Space> },
      { title: 'Company', dataIndex: 'company_name' },
      { title: 'Category', dataIndex: 'supplier_category', render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
      { title: 'Email', dataIndex: 'email' },
      { title: 'Status', dataIndex: 'status', width: 120, render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase().replace('_', ' ')}</Tag> },
    ];
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Title level={4} style={{ margin: 0 }}>Vendor Master</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openForm}>Add Vendor</Button>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage vendor master data, onboarding workflows, and approval status. Create new vendors and track their lifecycle.</Text>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={12} align="middle">
            <Col flex="1"><Input placeholder="Search by Name" value={searchName} onChange={e => setSearchName(e.target.value)} onPressEnter={() => fetchData()} allowClear /></Col>
            <Col><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData()}>Search</Button></Col>
            <Col><Button icon={<ClearOutlined />} onClick={() => { setSearchName(''); fetchData(); }}>Clear</Button></Col>
          </Row>
        </Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: t => `${t} vendors`, onChange: (p, ps) => fetchData(p, ps) }}
          onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: 'pointer' } })} />
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (view === 'detail' && selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>{selected.vendor_name}</Title>
            <Tag color="purple">{selected.vendor_number}</Tag>
            <Tag color={STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase().replace('_', ' ')}</Tag>
          </Space>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(selected)}>Edit</Button>
            {selected.status === 'submitted' && <Button onClick={() => handleAction('review')}>Begin Review</Button>}
            {selected.status === 'under_review' && <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a' }} onClick={() => handleAction('approve')}>Approve</Button>}
            {selected.status === 'under_review' && <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalOpen(true)}>Reject</Button>}
            {selected.status === 'approved' && <Popconfirm title="Deactivate?" onConfirm={() => handleAction('deactivate')}><Button icon={<StopOutlined />}>Deactivate</Button></Popconfirm>}
          </Space>
        </div>
        <Tabs defaultActiveKey="overview" items={[
          { key: 'overview', label: 'Overview', children: (
            <Row gutter={[16, 16]}>
              <Col span={8}><Card><Statistic title="Email" value={selected.email} valueStyle={{ fontSize: 14 }} /></Card></Col>
              <Col span={8}><Card><Statistic title="Phone" value={selected.phone} valueStyle={{ fontSize: 14 }} /></Card></Col>
              <Col span={8}><Card><Statistic title="Company" value={selected.company_name} valueStyle={{ fontSize: 14 }} /></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Department</Text><br /><Text strong>{selected.department}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Supplier Group</Text><br /><Text strong>{selected.supplier_group}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Category</Text><br /><Text strong>{selected.supplier_category}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Location</Text><br /><Text strong>{selected.supplier_location}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">GST</Text><br /><Text strong>{selected.gst_number || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">PAN</Text><br /><Text strong>{selected.pan_number || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Trade Name</Text><br /><Text strong>{selected.trade_name || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Legal Name</Text><br /><Text strong>{selected.legal_name || '—'}</Text></Card></Col>
              {selected.rejection_reason && <Col span={24}><Card size="small" style={{ borderColor: '#ff4d4f' }}><Text type="secondary">Rejection Reason</Text><br /><Text strong style={{ color: '#ff4d4f' }}>{selected.rejection_reason}</Text></Card></Col>}
            </Row>
          )},
          { key: 'addresses', label: `Addresses (${selected.addresses?.length || 0})`, children: (
            <Row gutter={[16, 16]}>
              {(selected.addresses || []).map((addr, i) => (
                <Col span={12} key={i}>
                  <Card size="small" title={`Address ${i + 1}`} extra={(addr.tags ? JSON.parse(typeof addr.tags === 'string' ? addr.tags : JSON.stringify(addr.tags)) : []).map(t => <Tag key={t} color="blue">{t}</Tag>)}>
                    <Text>{addr.line1}</Text>{addr.line2 && <><br /><Text>{addr.line2}</Text></>}<br />
                    <Text strong>{[addr.city, addr.state, addr.pin_code].filter(Boolean).join(', ')}</Text><br />
                    <Text type="secondary">{addr.country}</Text>
                  </Card>
                </Col>
              ))}
              {(!selected.addresses || selected.addresses.length === 0) && <Col span={24}><Text type="secondary">No addresses added</Text></Col>}
            </Row>
          )},
          { key: 'bank', label: `Bank Accounts (${selected.bank_accounts?.length || 0})`, children: (
            <Row gutter={[16, 16]}>
              {(selected.bank_accounts || []).map((bank, i) => (
                <Col span={12} key={i}>
                  <Card size="small" title={bank.bank_name}>
                    <Row gutter={[8, 4]}>
                      <Col span={12}><Text type="secondary">Account #</Text><br /><Text strong>{bank.account_number}</Text></Col>
                      <Col span={12}><Text type="secondary">IFSC</Text><br /><Text strong>{bank.ifsc_code}</Text></Col>
                      <Col span={12}><Text type="secondary">Holder</Text><br /><Text strong>{bank.account_holder_name}</Text></Col>
                      <Col span={12}><Text type="secondary">Branch</Text><br /><Text strong>{bank.branch}</Text></Col>
                    </Row>
                  </Card>
                </Col>
              ))}
              {(!selected.bank_accounts || selected.bank_accounts.length === 0) && <Col span={24}><Text type="secondary">No bank accounts added</Text></Col>}
            </Row>
          )},
        ]} />
        <Modal title="Reject Vendor" open={rejectModalOpen} onCancel={() => setRejectModalOpen(false)} onOk={() => handleAction('reject')} okText="Reject" okButtonProps={{ danger: true }}>
          <Input.TextArea rows={3} placeholder="Enter rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </Modal>
      </div>
    );
  }

  // ─── EDIT VIEW (Admin can edit all fields) ───
  if (view === 'edit' && selected) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginRight: 12 }}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>Edit — {selected.vendor_name}</Title>
          <Tag color="purple" style={{ marginLeft: 12 }}>{selected.vendor_number}</Tag>
        </div>
        <Card>
          <Form form={form} layout="vertical">
            <Title level={5}>Core Information</Title>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="vendor_name" label={<span>Vendor Name<span className="form-label-desc">Company or individual</span></span>} rules={[{ required: true }]}><Input size="large" /></Form.Item></Col>
              <Col span={8}><Form.Item label="Email (read-only)"><Input disabled value={selected.email} /></Form.Item></Col>
              <Col span={8}><Form.Item name="phone" label="Phone" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="supplier_category" label="Category" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="supplier_location" label="Location" rules={[{ required: true }]}><Input /></Form.Item></Col>
            </Row>

            <Divider />
            <Title level={5}>Business Information</Title>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="gst_number" label="GST Number"><Input maxLength={15} /></Form.Item></Col>
              <Col span={6}><Form.Item name="pan_number" label="PAN Number"><Input maxLength={10} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
              <Col span={6}><Form.Item name="trade_name" label="Trade Name"><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="legal_name" label="Legal Name"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="msme_type" label="MSME Type"><Select placeholder="Select" options={[{ value: 'micro' }, { value: 'small' }, { value: 'medium' }]} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="itr_filing_status" label="ITR Filing"><Select placeholder="Select" options={[{ value: 'filed' }, { value: 'not_filed' }]} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="phone1" label="Phone 1"><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="phone2" label="Phone 2"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="email1" label="Email 1"><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="email2" label="Email 2"><Input /></Form.Item></Col>
            </Row>

            <Divider />
            <Title level={5}>Addresses</Title>
            {addresses.map((addr, i) => (
              <Card key={i} size="small" style={{ marginBottom: 12 }} extra={<Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeAddress(i)} />}>
                <Row gutter={12}>
                  <Col span={12}><Input placeholder="Address Line 1" value={addr.line1} onChange={e => updateAddress(i, 'line1', e.target.value)} /></Col>
                  <Col span={12}><Input placeholder="Address Line 2" value={addr.line2} onChange={e => updateAddress(i, 'line2', e.target.value)} /></Col>
                </Row>
                <Row gutter={12} style={{ marginTop: 8 }}>
                  <Col span={4}><Input placeholder="City" value={addr.city} onChange={e => updateAddress(i, 'city', e.target.value)} /></Col>
                  <Col span={4}><Input placeholder="State" value={addr.state} onChange={e => updateAddress(i, 'state', e.target.value)} /></Col>
                  <Col span={4}><Input placeholder="Country" value={addr.country} onChange={e => updateAddress(i, 'country', e.target.value)} /></Col>
                  <Col span={4}><Input placeholder="PIN Code" value={addr.pin_code} onChange={e => updateAddress(i, 'pin_code', e.target.value)} maxLength={6} /></Col>
                  <Col span={8}>
                    <Checkbox.Group value={Array.isArray(addr.tags) ? addr.tags : (typeof addr.tags === 'string' ? JSON.parse(addr.tags) : [])} onChange={v => updateAddress(i, 'tags', v)} options={[{ label: 'Billing', value: 'billing' }, { label: 'Shipping', value: 'shipping' }, { label: 'Registered', value: 'registered' }]} />
                  </Col>
                </Row>
              </Card>
            ))}
            <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addAddress} block>Add Address</Button>

            <Divider />
            <Title level={5}>Bank Accounts</Title>
            {bankAccounts.map((bank, i) => (
              <Card key={i} size="small" style={{ marginBottom: 12 }} extra={<Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeBank(i)} />}>
                <Row gutter={12}>
                  <Col span={6}><Input placeholder="IFSC Code" value={bank.ifsc_code} onChange={e => updateBank(i, 'ifsc_code', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="Account Number" value={bank.account_number} onChange={e => updateBank(i, 'account_number', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="Account Holder" value={bank.account_holder_name} onChange={e => updateBank(i, 'account_holder_name', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="Bank Name" value={bank.bank_name} onChange={e => updateBank(i, 'bank_name', e.target.value)} /></Col>
                </Row>
                <Row gutter={12} style={{ marginTop: 8 }}>
                  <Col span={6}><Input placeholder="Branch" value={bank.branch} onChange={e => updateBank(i, 'branch', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="City" value={bank.city} onChange={e => updateBank(i, 'city', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="State" value={bank.state} onChange={e => updateBank(i, 'state', e.target.value)} /></Col>
                  <Col span={6}><Input placeholder="Country" value={bank.country} onChange={e => updateBank(i, 'country', e.target.value)} /></Col>
                </Row>
              </Card>
            ))}
            <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addBank} block>Add Bank Account</Button>

            <Divider />
            <Space size="middle">
              <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleUpdate}>Save Changes</Button>
              <Button size="large" onClick={goBack}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      </div>
    );
  }

  // ─── CREATE FORM VIEW ───
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginRight: 12 }}>Back</Button>
        <Title level={4} style={{ margin: 0 }}>New Vendor</Title>
      </div>
      <Card>
        <Form form={form} layout="vertical">
          <Title level={5}>Basic Information</Title>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="vendor_name" label={<span>Vendor Name<span className="form-label-desc">Company or individual</span></span>} rules={[{ required: true }]}><Input size="large" placeholder="Vendor name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label={<span>Email<span className="form-label-desc">Login credentials sent here</span></span>} rules={[{ required: true, type: 'email' }]}><Input placeholder="email@company.com" /></Form.Item></Col>
            <Col span={8}><Form.Item name="phone" label={<span>Phone<span className="form-label-desc">Primary contact</span></span>} rules={[{ required: true }]}><Input placeholder="+91 XXXXXXXXXX" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_category" label="Category" rules={[{ required: true }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="supplier_location" label="Location" rules={[{ required: true }]}><Input placeholder="City / Location" /></Form.Item></Col>
          </Row>
          <Divider />
          <Space size="middle">
            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleCreate}>Create Vendor</Button>
            <Button size="large" onClick={goBack}>Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
