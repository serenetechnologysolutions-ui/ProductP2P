import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, DatePicker, Select, Tag, Space, Row, Col, Card, Tabs, Popconfirm, Typography, Divider, Statistic, Avatar, Drawer, Checkbox, Upload, Alert, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EditOutlined, SearchOutlined, ClearOutlined, SaveOutlined, CheckOutlined, CloseOutlined, StopOutlined, DeleteOutlined, PlusCircleOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';

const { Title, Text } = Typography;
const STATUS_COLOR = { draft: 'default', submitted: 'blue', under_review: 'orange', approved: 'green', rejected: 'red', inactive: '#8c8c8c' };
const LIFECYCLE_COLOR = { onboarding: 'blue', active: 'green', dormant: 'gold', blocked: '#8c8c8c' };
const RISK_COLOR = { low: 'green', medium: 'orange', high: 'red' };

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [complianceDates, setComplianceDates] = useState([]);
  const { isRequired } = useFieldConfig('vendor');

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
        const cats = ['company', 'department', 'supplier_group', 'supplier_category', 'state', 'city', 'country', 'vendor_type', 'industry', 'registration_type', 'payment_terms', 'msme_type', 'currency'];
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
    form.setFieldsValue({ ...vendor, serviceable_regions: parseMaybeJson(vendor.serviceable_regions) || [] });
    setSelected(vendor);
    setAddresses(vendor.addresses || []);
    setBankAccounts(vendor.bank_accounts || []);
    const complianceObj = parseMaybeJson(vendor.compliance_expiry_dates) || {};
    setComplianceDates(Object.entries(complianceObj).map(([label, expiry_date]) => ({ label, expiry_date })));
    setView('edit');
  };

  const goBack = () => { setView('list'); setSelected(null); setAddresses([]); setBankAccounts([]); setComplianceDates([]); };

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
      const compliance_expiry_dates = complianceDates.reduce((acc, c) => { if (c.label) acc[c.label] = c.expiry_date ? dayjs(c.expiry_date).format('YYYY-MM-DD') : null; return acc; }, {});
      await api.put(`/vendors/${selected.id}`, { ...values, addresses, bank_accounts: bankAccounts, compliance_expiry_dates });
      message.success('Vendor updated');
      goBack(); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Update failed'); }
  };

  // Compliance expiry date helpers
  const addComplianceDate = () => setComplianceDates([...complianceDates, { label: '', expiry_date: null }]);
  const removeComplianceDate = (i) => setComplianceDates(complianceDates.filter((_, idx) => idx !== i));
  const updateComplianceDate = (i, field, value) => setComplianceDates(complianceDates.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

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

  const handleDelete = async (vendorId) => {
    try {
      await api.delete(`/vendors/${vendorId}`);
      message.success('Vendor deleted');
      if (view === 'detail') goBack();
      fetchData(pagination.current, pagination.pageSize);
    } catch (err) { message.error(err.response?.data?.message || 'Delete failed — vendor may have existing transactions'); }
  };

  const handleImport = async () => {
    if (!importFile) { message.error('Choose an Excel file first'); return; }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/vendors/import', formData);
      setImportResult(res.data.data);
      message.success(`Imported ${res.data.data.created.length} of ${res.data.data.total} vendors`);
      fetchData();
    } catch (err) { message.error(err.response?.data?.message || 'Import failed'); }
    setImporting(false);
  };

  const closeImportModal = () => { setImportModalOpen(false); setImportFile(null); setImportResult(null); };

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
      { title: 'Lifecycle', dataIndex: 'lifecycle_stage', width: 110, render: s => s ? <Tag color={LIFECYCLE_COLOR[s]}>{s.toUpperCase()}</Tag> : '—' },
      { title: 'Risk', dataIndex: 'risk_category', width: 90, render: r => r ? <Tag color={RISK_COLOR[r]}>{r.toUpperCase()}</Tag> : '—' },
      {
        title: 'Actions', width: 80, render: (_, record) => (
          <Popconfirm title="Delete this vendor?" description="This cannot be undone." onConfirm={(e) => { e?.stopPropagation?.(); handleDelete(record.id); }} onCancel={(e) => e?.stopPropagation?.()}>
            <Button icon={<DeleteOutlined />} size="small" danger onClick={e => e.stopPropagation()} />
          </Popconfirm>
        ),
      },
    ];
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Title level={4} style={{ margin: 0 }}>Vendor Master</Title>
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>Import Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openForm}>Add Vendor</Button>
          </Space>
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

        <Drawer title="Import Vendors from Excel" open={importModalOpen} onClose={closeImportModal} width={480} destroyOnClose>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            File must have a header row with columns: Vendor Name, Email, Phone, Company Name, Department, Supplier Group, Supplier Category, Supplier Location.
          </Text>
          <Upload.Dragger
            accept=".xlsx,.xls"
            maxCount={1}
            beforeUpload={(file) => { setImportFile(file); setImportResult(null); return false; }}
            onRemove={() => setImportFile(null)}
            fileList={importFile ? [{ uid: '1', name: importFile.name }] : []}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p>Click or drag an Excel file to this area</p>
          </Upload.Dragger>

          {importResult && (
            <div style={{ marginTop: 16 }}>
              <Alert
                type={importResult.skipped.length > 0 ? 'warning' : 'success'}
                showIcon
                message={`${importResult.created.length} of ${importResult.total} rows imported`}
              />
              {importResult.skipped.length > 0 && (
                <Card size="small" title="Skipped rows" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {importResult.skipped.map(s => <div key={s.row}><Text type="secondary">Row {s.row}:</Text> {s.reason}</div>)}
                </Card>
              )}
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={closeImportModal}>Close</Button>
              <Button type="primary" icon={<UploadOutlined />} loading={importing} onClick={handleImport}>Upload &amp; Import</Button>
            </Space>
          </div>
        </Drawer>
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
            {selected.vendor_code && <Tag color="geekblue">{selected.vendor_code}</Tag>}
            <Tag color={STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase().replace('_', ' ')}</Tag>
            {selected.lifecycle_stage && <Tag color={LIFECYCLE_COLOR[selected.lifecycle_stage]}>{selected.lifecycle_stage.toUpperCase()}</Tag>}
            {!!selected.blacklist_flag && <Tag color="red">BLACKLISTED</Tag>}
          </Space>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(selected)}>Edit</Button>
            {selected.status === 'submitted' && <Button onClick={() => handleAction('review')}>Begin Review</Button>}
            {selected.status === 'under_review' && <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a' }} onClick={() => handleAction('approve')}>Approve</Button>}
            {selected.status === 'under_review' && <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalOpen(true)}>Reject</Button>}
            {selected.status === 'approved' && <Popconfirm title="Deactivate?" onConfirm={() => handleAction('deactivate')}><Button icon={<StopOutlined />}>Deactivate</Button></Popconfirm>}
            <Popconfirm title="Delete this vendor?" description="This cannot be undone. Vendors with existing transactions cannot be deleted." onConfirm={() => handleDelete(selected.id)}>
              <Button icon={<DeleteOutlined />} danger>Delete</Button>
            </Popconfirm>
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
          { key: 'governance', label: 'Governance & Risk', children: (
            <Row gutter={[16, 16]}>
              <Col span={6}><Card size="small"><Text type="secondary">Vendor Code (Manual)</Text><br /><Text strong>{selected.vendor_code || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Vendor Code (Auto)</Text><br /><Text strong>{selected.vendor_code_auto || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Vendor Type</Text><br /><Text strong>{selected.vendor_type || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Industry</Text><br /><Text strong>{selected.industry || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Registration Type</Text><br /><Text strong>{selected.registration_type || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">GST Validation</Text><br /><Tag color={selected.gst_validation_status === 'valid' ? 'green' : selected.gst_validation_status === 'invalid' ? 'red' : 'default'}>{(selected.gst_validation_status || 'pending').toUpperCase()}</Tag></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">PAN Validation</Text><br /><Tag color={selected.pan_validation_status === 'valid' ? 'green' : selected.pan_validation_status === 'invalid' ? 'red' : 'default'}>{(selected.pan_validation_status || 'pending').toUpperCase()}</Tag></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Preferred Vendor</Text><br /><Text strong>{selected.preferred_vendor_flag ? 'Yes' : 'No'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Credit Rating</Text><br /><Text strong>{selected.credit_rating || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Credit Limit</Text><br /><Text strong>{selected.credit_limit != null ? `${selected.currency_code || 'INR'} ${selected.credit_limit}` : '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Currency</Text><br /><Text strong>{selected.currency_code || 'INR'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Risk Category</Text><br />{selected.risk_category ? <Tag color={RISK_COLOR[selected.risk_category]}>{selected.risk_category.toUpperCase()}</Tag> : '—'}</Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Account Manager</Text><br /><Text strong>{selected.account_manager_name || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Geo Coordinates</Text><br /><Text strong>{selected.geo_latitude != null && selected.geo_longitude != null ? `${selected.geo_latitude}, ${selected.geo_longitude}` : '—'}</Text></Card></Col>
              <Col span={12}><Card size="small"><Text type="secondary">Serviceable Regions</Text><br />{(parseMaybeJson(selected.serviceable_regions) || []).length > 0 ? (parseMaybeJson(selected.serviceable_regions) || []).map(r => <Tag key={r}>{r}</Tag>) : '—'}</Card></Col>
              {!!selected.blacklist_flag && <Col span={24}><Card size="small" style={{ borderColor: '#ff4d4f' }}><Text type="secondary">Blacklist Reason</Text><br /><Text strong style={{ color: '#ff4d4f' }}>{selected.blacklist_reason || '—'}</Text></Card></Col>}
              <Col span={24}>
                <Card size="small" title="Compliance Expiry Dates">
                  {Object.entries(parseMaybeJson(selected.compliance_expiry_dates) || {}).length === 0 && <Text type="secondary">None recorded</Text>}
                  <Row gutter={[8, 8]}>
                    {Object.entries(parseMaybeJson(selected.compliance_expiry_dates) || {}).map(([label, date]) => (
                      <Col span={6} key={label}><Text type="secondary">{label}</Text><br /><Text strong>{date || '—'}</Text></Col>
                    ))}
                  </Row>
                </Card>
              </Col>
            </Row>
          )},
        ]} />
        <Drawer title="Reject Vendor" open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} width={420} footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button type="primary" danger onClick={() => handleAction('reject')}>Reject</Button>
          </Space>
        }>
          <Input.TextArea rows={3} placeholder="Enter rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </Drawer>
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
              <Col span={8}><Form.Item name="vendor_name" label={<span>Vendor Name<span className="form-label-desc">Company or individual</span></span>} rules={[{ required: isRequired('vendor_name', true), message: 'Vendor Name is required' }]}><Input size="large" /></Form.Item></Col>
              <Col span={8}><Form.Item label="Email (read-only)"><Input disabled value={selected.email} /></Form.Item></Col>
              <Col span={8}><Form.Item name="phone" label="Phone" rules={[{ required: isRequired('phone', true), message: 'Phone is required' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: isRequired('company_name', true), message: 'Company is required' }]}><Select showSearch placeholder="Select" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: isRequired('supplier_group', true), message: 'Supplier Group is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="supplier_category" label="Category" rules={[{ required: isRequired('supplier_category', true), message: 'Category is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="supplier_location" label="Location" rules={[{ required: isRequired('supplier_location', true), message: 'Location is required' }]}><Input /></Form.Item></Col>
            </Row>

            <Divider />
            <Title level={5}>Business Information</Title>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="gst_number" label="GST Number" rules={[{ required: isRequired('gst_number', false), message: 'GST Number is required' }]}><Input maxLength={15} /></Form.Item></Col>
              <Col span={6}><Form.Item name="pan_number" label="PAN Number" rules={[{ required: isRequired('pan_number', false), message: 'PAN Number is required' }]}><Input maxLength={10} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
              <Col span={6}><Form.Item name="trade_name" label="Trade Name" rules={[{ required: isRequired('trade_name', false), message: 'Trade Name is required' }]}><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="legal_name" label="Legal Name" rules={[{ required: isRequired('legal_name', false), message: 'Legal Name is required' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="msme_type" label="MSME Type" rules={[{ required: isRequired('msme_type', false), message: 'MSME Type is required' }]}><Select placeholder="Select" options={(subMasters.msme_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="itr_filing_status" label="ITR Filing" rules={[{ required: isRequired('itr_filing_status', false), message: 'ITR Filing Status is required' }]}><Select placeholder="Select" options={[{ value: 'filed' }, { value: 'not_filed' }]} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="phone1" label="Phone 1" rules={[{ required: isRequired('phone1', false), message: 'Phone 1 is required' }]}><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="phone2" label="Phone 2" rules={[{ required: isRequired('phone2', false), message: 'Phone 2 is required' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="email1" label="Email 1" rules={[{ required: isRequired('email1', false), message: 'Email 1 is required' }]}><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="email2" label="Email 2" rules={[{ required: isRequired('email2', false), message: 'Email 2 is required' }]}><Input /></Form.Item></Col>
            </Row>

            <Divider />
            <Title level={5}>Classification &amp; Governance</Title>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="vendor_code" label={<span>Vendor Code<span className="form-label-desc">ERP-friendly, manual entry</span></span>} rules={[{ required: isRequired('vendor_code', false), message: 'Vendor Code is required' }]}><Input placeholder="e.g. ERP-VND-001" /></Form.Item></Col>
              <Col span={6}><Form.Item label="Vendor Code (Auto)"><Input disabled value={selected.vendor_code_auto} /></Form.Item></Col>
              <Col span={6}><Form.Item name="vendor_type" label="Vendor Type" rules={[{ required: isRequired('vendor_type', false), message: 'Vendor Type is required' }]}><Select showSearch placeholder="Select" options={(subMasters.vendor_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="industry" label="Industry" rules={[{ required: isRequired('industry', false), message: 'Industry is required' }]}><Select showSearch placeholder="Select" options={(subMasters.industry || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="registration_type" label="Registration Type" rules={[{ required: isRequired('registration_type', false), message: 'Registration Type is required' }]}><Select showSearch placeholder="Select" options={(subMasters.registration_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="payment_terms_id" label="Payment Terms" rules={[{ required: isRequired('payment_terms_id', false), message: 'Payment Terms is required' }]}><Select showSearch placeholder="Select" options={(subMasters.payment_terms || []).map(s => ({ value: s.id, label: s.name }))} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="currency_code" label="Currency" rules={[{ required: isRequired('currency_code', false), message: 'Currency is required' }]}><Select options={(subMasters.currency || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="account_manager_name" label="Account Manager" rules={[{ required: isRequired('account_manager_name', false), message: 'Account Manager is required' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="credit_rating" label={<span>Credit Rating<span className="form-label-desc">e.g. AA+, BB</span></span>} rules={[{ required: isRequired('credit_rating', false), message: 'Credit Rating is required' }]}><Input maxLength={10} /></Form.Item></Col>
              <Col span={6}><Form.Item name="credit_limit" label="Credit Limit" rules={[{ required: isRequired('credit_limit', false), message: 'Credit Limit is required' }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              <Col span={6}><Form.Item name="risk_category" label="Risk Category" rules={[{ required: isRequired('risk_category', false), message: 'Risk Category is required' }]}><Select placeholder="Select" options={[{ value: 'low' }, { value: 'medium' }, { value: 'high' }]} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="preferred_vendor_flag" label=" " valuePropName="checked"><Checkbox>Preferred Vendor</Checkbox></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="geo_latitude" label="Geo Latitude" rules={[{ required: isRequired('geo_latitude', false), message: 'Geo Latitude is required' }]}><InputNumber style={{ width: '100%' }} step={0.0000001} /></Form.Item></Col>
              <Col span={6}><Form.Item name="geo_longitude" label="Geo Longitude" rules={[{ required: isRequired('geo_longitude', false), message: 'Geo Longitude is required' }]}><InputNumber style={{ width: '100%' }} step={0.0000001} /></Form.Item></Col>
              <Col span={12}><Form.Item name="serviceable_regions" label="Serviceable Regions" rules={[{ required: isRequired('serviceable_regions', false), message: 'Serviceable Regions is required' }]}><Select mode="tags" placeholder="Type a region and press enter" /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="blacklist_flag" label=" " valuePropName="checked"><Checkbox>Blacklisted</Checkbox></Form.Item></Col>
              <Col span={18}><Form.Item name="blacklist_reason" label="Blacklist Reason"><Input placeholder="Required if blacklisted" /></Form.Item></Col>
            </Row>

            <Title level={5} style={{ marginTop: 8 }}>Compliance Expiry Dates</Title>
            {complianceDates.map((c, i) => (
              <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
                <Col span={10}><Input placeholder="Document / certification name" value={c.label} onChange={e => updateComplianceDate(i, 'label', e.target.value)} /></Col>
                <Col span={8}><DatePicker style={{ width: '100%' }} value={c.expiry_date ? dayjs(c.expiry_date) : null} onChange={d => updateComplianceDate(i, 'expiry_date', d)} /></Col>
                <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeComplianceDate(i)} /></Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addComplianceDate} block>Add Compliance Date</Button>

            <Divider />
            <Title level={5}>Addresses</Title>
            {addresses.map((addr, i) => (
              <Card key={i} size="small" style={{ marginBottom: 12 }} extra={<Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeAddress(i)} />}>
                <Row gutter={12}>
                  <Col span={12}><Input placeholder="Address Line 1" value={addr.line1} onChange={e => updateAddress(i, 'line1', e.target.value)} /></Col>
                  <Col span={12}><Input placeholder="Address Line 2" value={addr.line2} onChange={e => updateAddress(i, 'line2', e.target.value)} /></Col>
                </Row>
                <Row gutter={12} style={{ marginTop: 8 }}>
                  <Col span={4}><Select showSearch placeholder="City" value={addr.city || undefined} onChange={v => updateAddress(i, 'city', v)} options={(subMasters.city || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                  <Col span={4}><Select showSearch placeholder="State" value={addr.state || undefined} onChange={v => updateAddress(i, 'state', v)} options={(subMasters.state || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                  <Col span={4}><Select showSearch placeholder="Country" value={addr.country || undefined} onChange={v => updateAddress(i, 'country', v)} options={(subMasters.country || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
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
                  <Col span={6}><Select showSearch placeholder="City" value={bank.city || undefined} onChange={v => updateBank(i, 'city', v)} options={(subMasters.city || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                  <Col span={6}><Select showSearch placeholder="State" value={bank.state || undefined} onChange={v => updateBank(i, 'state', v)} options={(subMasters.state || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                  <Col span={6}><Select showSearch placeholder="Country" value={bank.country || undefined} onChange={v => updateBank(i, 'country', v)} options={(subMasters.country || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
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
            <Col span={8}><Form.Item name="vendor_name" label={<span>Vendor Name<span className="form-label-desc">Company or individual</span></span>} rules={[{ required: isRequired('vendor_name', true), message: 'Vendor Name is required' }]}><Input size="large" placeholder="Vendor name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label={<span>Email<span className="form-label-desc">Login credentials sent here</span></span>} rules={[{ required: isRequired('email', true), message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}><Input placeholder="email@company.com" /></Form.Item></Col>
            <Col span={8}><Form.Item name="phone" label={<span>Phone<span className="form-label-desc">Primary contact</span></span>} rules={[{ required: isRequired('phone', true), message: 'Phone is required' }]}><Input placeholder="+91 XXXXXXXXXX" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: isRequired('company_name', true), message: 'Company is required' }]}><Select showSearch placeholder="Select" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: isRequired('supplier_group', true), message: 'Supplier Group is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_category" label="Category" rules={[{ required: isRequired('supplier_category', true), message: 'Category is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="supplier_location" label="Location" rules={[{ required: isRequired('supplier_location', true), message: 'Location is required' }]}><Input placeholder="City / Location" /></Form.Item></Col>
          </Row>

          <Divider />
          <Title level={5}>Additional Information <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(optional — can be completed later)</Text></Title>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="vendor_code" label={<span>Vendor Code<span className="form-label-desc">ERP-friendly, manual entry</span></span>} rules={[{ required: isRequired('vendor_code', false), message: 'Vendor Code is required' }]}><Input placeholder="e.g. ERP-VND-001" /></Form.Item></Col>
            <Col span={6}><Form.Item name="vendor_type" label="Vendor Type" rules={[{ required: isRequired('vendor_type', false), message: 'Vendor Type is required' }]}><Select showSearch placeholder="Select" options={(subMasters.vendor_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
            <Col span={6}><Form.Item name="industry" label="Industry" rules={[{ required: isRequired('industry', false), message: 'Industry is required' }]}><Select showSearch placeholder="Select" options={(subMasters.industry || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
            <Col span={6}><Form.Item name="registration_type" label="Registration Type" rules={[{ required: isRequired('registration_type', false), message: 'Registration Type is required' }]}><Select showSearch placeholder="Select" options={(subMasters.registration_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="currency_code" label="Currency" initialValue="INR" rules={[{ required: isRequired('currency_code', false), message: 'Currency is required' }]}><Select options={(subMasters.currency || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="account_manager_name" label="Account Manager" rules={[{ required: isRequired('account_manager_name', false), message: 'Account Manager is required' }]}><Input /></Form.Item></Col>
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
