import { useState, useEffect } from 'react';
import { Card, Row, Col, Tabs, Table, Tag, Button, Space, Input, InputNumber, Select, Switch, Upload, message, Typography, Statistic, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, DollarOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';

const { Text } = Typography;
const { TextArea } = Input;

// --- Client-side validators matching backend rules ---
function validatePAN(pan) {
  if (!pan) return null;
  const regex = /^[A-Z0-9]{10}$/;
  if (!regex.test(pan)) return 'PAN must be exactly 10 alphanumeric uppercase characters';
  return null;
}

function validatePINCode(pinCode) {
  if (!pinCode) return null;
  const regex = /^[0-9]{6}$/;
  if (!regex.test(pinCode)) return 'PIN code must be exactly 6 digits';
  return null;
}

function validateCertificateFile(file) {
  if (!file) return null;
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (!allowedTypes.includes(file.type)) return 'Certificate must be PDF, PNG, or JPEG';
  if (file.size > maxSize) return 'Certificate file must not exceed 5 MB';
  return null;
}

// Admin surface for the Procurement OS expansion (multi-company, payments,
// inventory, the mocked SAP connector, and the decision/next-best-action
// rule engines) — one consolidated page with a tab per module rather than
// six separate pages, since these are all admin-configuration screens used
// far less often than the core transactional pages.

const INITIAL_FORM = {
  organization_id: null,
  company_code: '',
  company_name: '',
  cin: '',
  pan: '',
  address: '',
  city: '',
  state: '',
  pin_code: '',
  is_active: true,
};

function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [certificateFile, setCertificateFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([api.get('/companies'), api.get('/companies/organizations')]);
      setCompanies(c.data.data || []);
      setOrgs(o.data.data || []);
    } catch { message.error('Failed to load companies'); }
    // Load dropdown options
    api.get('/sub-masters/city').then(r => setCities(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/state').then(r => setStates(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/country').then(r => setCountries(r.data.data || [])).catch(() => {});
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const resetPanel = () => {
    setPanelOpen(false);
    setEditingId(null);
    setForm({ ...INITIAL_FORM });
    setCertificateFile(null);
    setErrors({});
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setForm({
      organization_id: record.organization_id,
      company_code: record.company_code,
      company_name: record.company_name,
      cin: record.cin || '',
      pan: record.pan || '',
      address: record.address || '',
      city: record.city || '',
      state: record.state || '',
      pin_code: record.pin_code || '',
      is_active: record.is_active !== false,
    });
    setCertificateFile(null);
    setErrors({});
    setPanelOpen(true);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.organization_id) newErrors.organization_id = 'Organization is required';
    if (!form.company_code) newErrors.company_code = 'Company Code is required';
    if (!form.company_name) newErrors.company_name = 'Company Name is required';

    const panErr = validatePAN(form.pan);
    if (panErr) newErrors.pan = panErr;

    const pinErr = validatePINCode(form.pin_code);
    if (pinErr) newErrors.pin_code = pinErr;

    if (form.cin && form.cin.length > 21) newErrors.cin = 'CIN must be max 21 characters';

    if (certificateFile) {
      const certErr = validateCertificateFile(certificateFile);
      if (certErr) newErrors.certificate = certErr;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      message.error('Please fix validation errors');
      return;
    }
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`/companies/${editingId}`, payload);
        // Upload certificate if provided
        if (certificateFile) {
          const formData = new FormData();
          formData.append('certificate', certificateFile);
          await api.post(`/companies/${editingId}/certificate`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        message.success('Company updated');
      } else {
        const res = await api.post('/companies', payload);
        // Upload certificate if provided and we have a company id
        if (certificateFile && res.data.data?.id) {
          const formData = new FormData();
          formData.append('certificate', certificateFile);
          await api.post(`/companies/${res.data.data.id}/certificate`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        message.success('Company created');
      }
      resetPanel();
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} company`);
    }
  };

  const beforeUpload = (file) => {
    const err = validateCertificateFile(file);
    if (err) {
      message.error(err);
      return Upload.LIST_IGNORE;
    }
    setCertificateFile(file);
    return false; // Prevent auto-upload
  };

  return (
    <Card size="small" loading={loading}>
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => { resetPanel(); setPanelOpen(true); }} style={{ marginBottom: 12 }}>New Company</Button>
      <InlineExpandPanel
        open={panelOpen}
        title={editingId ? 'Edit Company' : 'New Company'}
        onCancel={resetPanel}
        onSubmit={handleSubmit}
        submitText={editingId ? 'Update' : 'Save'}
      >
        {/* Row 1: Organization, Code, Name */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Organization *</Text>
            <Select style={{ width: '100%' }} value={form.organization_id} onChange={v => setForm(f => ({ ...f, organization_id: v }))}
              options={orgs.map(o => ({ value: o.id, label: o.org_name }))} status={errors.organization_id ? 'error' : undefined} />
            {errors.organization_id && <Text type="danger" style={{ fontSize: 12 }}>{errors.organization_id}</Text>}
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Company Code *</Text>
            <Input value={form.company_code} onChange={e => setForm(f => ({ ...f, company_code: e.target.value }))} status={errors.company_code ? 'error' : undefined} />
            {errors.company_code && <Text type="danger" style={{ fontSize: 12 }}>{errors.company_code}</Text>}
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Company Name *</Text>
            <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} status={errors.company_name ? 'error' : undefined} />
            {errors.company_name && <Text type="danger" style={{ fontSize: 12 }}>{errors.company_name}</Text>}
          </Col>
        </Row>

        {/* Row 2: CIN, PAN, is_active */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>CIN</Text>
            <Input value={form.cin} maxLength={21} onChange={e => setForm(f => ({ ...f, cin: e.target.value }))} placeholder="Corporate Identity Number" status={errors.cin ? 'error' : undefined} />
            {errors.cin && <Text type="danger" style={{ fontSize: 12 }}>{errors.cin}</Text>}
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>PAN</Text>
            <Input value={form.pan} maxLength={10} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="e.g. ABCDE1234F" status={errors.pan ? 'error' : undefined} />
            {errors.pan && <Text type="danger" style={{ fontSize: 12 }}>{errors.pan}</Text>}
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Active</Text>
            <Switch checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} checkedChildren="Active" unCheckedChildren="Inactive" />
          </Col>
        </Row>

        {/* Row 3: Address */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={24}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Address</Text>
            <TextArea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
          </Col>
        </Row>

        {/* Row 4: City, State, Country, PIN Code */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>City</Text>
            <Select showSearch allowClear value={form.city || undefined} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Select City" style={{ width: '100%' }} options={cities.map(c => ({ value: c.name, label: c.name }))} />
          </Col>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>State</Text>
            <Select showSearch allowClear value={form.state || undefined} onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="Select State" style={{ width: '100%' }} options={states.map(s => ({ value: s.name, label: s.name }))} />
          </Col>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Country</Text>
            <Select showSearch allowClear value={form.country || undefined} onChange={v => setForm(f => ({ ...f, country: v }))} placeholder="Select Country" style={{ width: '100%' }} options={countries.map(c => ({ value: c.name, label: c.name }))} />
          </Col>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>PIN Code</Text>
            <Input value={form.pin_code} maxLength={6} onChange={e => setForm(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))} placeholder="6-digit PIN" status={errors.pin_code ? 'error' : undefined} />
            {errors.pin_code && <Text type="danger" style={{ fontSize: 12 }}>{errors.pin_code}</Text>}
          </Col>
        </Row>

        {/* Row 5: Certificate Upload */}
        <Row gutter={12}>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Certificate</Text>
            <Upload
              beforeUpload={beforeUpload}
              accept=".pdf,.png,.jpg,.jpeg"
              maxCount={1}
              fileList={certificateFile ? [{ uid: '-1', name: certificateFile.name, status: 'done' }] : []}
              onRemove={() => setCertificateFile(null)}
            >
              <Button icon={<UploadOutlined />}>Upload Certificate (PDF/PNG/JPEG, max 5MB)</Button>
            </Upload>
            {errors.certificate && <Text type="danger" style={{ fontSize: 12 }}>{errors.certificate}</Text>}
          </Col>
        </Row>
      </InlineExpandPanel>
      <Table size="small" rowKey="id" pagination={false} dataSource={companies} columns={[
        { title: 'Code', dataIndex: 'company_code', sorter: (a, b) => a.company_code.localeCompare(b.company_code) },
        { title: 'Name', dataIndex: 'company_name', sorter: (a, b) => a.company_name.localeCompare(b.company_name) },
        { title: 'Organization', dataIndex: 'org_name' },
        { title: 'GSTIN', dataIndex: 'gstin', render: v => v || <Text type="secondary">—</Text> },
        { title: 'PAN', dataIndex: 'pan', render: v => v || <Text type="secondary">—</Text> },
        { title: 'City', dataIndex: 'city', render: v => v || <Text type="secondary">—</Text> },
        { title: 'Status', dataIndex: 'is_active', render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
        {
          title: '', width: 60,
          render: (_, record) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />,
        },
      ]} />
    </Card>
  );
}

function PaymentsTab() {
  const [schedule, setSchedule] = useState([]);
  const [payments, setPayments] = useState([]);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, p, a] = await Promise.all([api.get('/payments/schedule'), api.get('/payments'), api.get('/payments/aging')]);
      setSchedule(s.data.data || []);
      setPayments(p.data.data || []);
      setAging(a.data.data || []);
    } catch { message.error('Failed to load payment data'); }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const runPayments = async () => {
    if (selectedKeys.length === 0) { message.error('Select at least one due schedule'); return; }
    try {
      await api.post('/payments/run', { schedule_ids: selectedKeys });
      message.success('Payment run completed');
      setSelectedKeys([]);
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Payment run failed'); }
  };

  const reconcile = async (id) => {
    try {
      await api.put(`/payments/${id}/reconcile`, { bank_reference: `BANK-${Date.now()}` });
      message.success('Marked reconciled');
      fetchAll();
    } catch { message.error('Failed to reconcile'); }
  };

  const pullStatusFromSap = async (id) => {
    try {
      const res = await api.post(`/integration/payments/${id}/pull-status`);
      message.success(`SAP reports this payment as "${res.data.data.status}"`);
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to pull status from SAP'); }
  };

  return (
    <Card size="small" loading={loading}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {aging.map(row => (
          <Col span={6} key={row.vendor_id}>
            <Card size="small">
              <Statistic title={row.vendor_name} prefix={<DollarOutlined />}
                value={Number(row.bucket_0_30) + Number(row.bucket_31_60) + Number(row.bucket_61_90) + Number(row.bucket_90_plus)}
                valueStyle={{ color: Number(row.bucket_90_plus) > 0 ? '#cf1322' : undefined }} />
              <Text type="secondary" style={{ fontSize: 12 }}>90+ days: ₹{Number(row.bucket_90_plus).toLocaleString()}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Payment Schedule</Text>
      <Button type="primary" style={{ marginBottom: 12 }} onClick={runPayments} disabled={selectedKeys.length === 0}>
        Run Payment ({selectedKeys.length})
      </Button>
      <Table
        size="small" rowKey="id" pagination={false} dataSource={schedule}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, getCheckboxProps: r => ({ disabled: r.status === 'paid' }) }}
        columns={[
          { title: 'Invoice', dataIndex: 'invoice_number' },
          { title: 'Vendor', dataIndex: 'vendor_name' },
          { title: 'Due Date', dataIndex: 'due_date', render: v => new Date(v).toLocaleDateString() },
          { title: 'Scheduled', dataIndex: 'scheduled_amount', render: v => `₹${Number(v).toLocaleString()}` },
          { title: 'Paid', dataIndex: 'paid_amount', render: v => `₹${Number(v).toLocaleString()}` },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'paid' ? 'green' : v === 'overdue' ? 'red' : v === 'partial' ? 'orange' : 'default'}>{v.toUpperCase()}</Tag> },
        ]}
        style={{ marginBottom: 24 }}
      />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Payments</Text>
      <Table size="small" rowKey="id" pagination={false} dataSource={payments} columns={[
        { title: 'Payment #', dataIndex: 'payment_number' },
        { title: 'Vendor', dataIndex: 'vendor_name' },
        { title: 'Amount', dataIndex: 'amount', render: v => `₹${Number(v).toLocaleString()}` },
        { title: 'Date', dataIndex: 'payment_date', render: v => new Date(v).toLocaleDateString() },
        { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'reconciled' ? 'green' : v === 'completed' ? 'blue' : 'default'}>{v.toUpperCase()}</Tag> },
        {
          title: '', render: (_, r) => r.status === 'completed' ? (
            <Space>
              <Button size="small" onClick={() => reconcile(r.id)}>Reconcile</Button>
              <Button size="small" onClick={() => pullStatusFromSap(r.id)}>Pull Status from SAP</Button>
            </Space>
          ) : null,
        },
      ]} />
    </Card>
  );
}

function InventoryTab() {
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([api.get('/inventory/stock'), api.get('/inventory/movements')]);
      setStock(s.data.data || []);
      setMovements(m.data.data || []);
    } catch { message.error('Failed to load inventory data'); }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  return (
    <Card size="small" loading={loading}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Stock On Hand</Text>
      <Table size="small" rowKey="id" pagination={false} dataSource={stock} columns={[
        { title: 'Item', dataIndex: 'item_code' },
        { title: 'Description', dataIndex: 'item_description' },
        { title: 'Warehouse', dataIndex: 'warehouse_name' },
        { title: 'On Hand', dataIndex: 'quantity_on_hand', sorter: (a, b) => a.quantity_on_hand - b.quantity_on_hand },
        { title: 'Reorder Level', dataIndex: 'reorder_level' },
        {
          title: 'Status', render: (_, r) => Number(r.quantity_on_hand) < Number(r.reorder_level)
            ? <Tag color="red">Below Reorder</Tag> : <Tag color="green">OK</Tag>,
        },
      ]} style={{ marginBottom: 24 }} />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Recent Movements</Text>
      <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={movements} columns={[
        { title: 'Item', dataIndex: 'item_code' },
        { title: 'Warehouse', dataIndex: 'warehouse_name' },
        { title: 'Type', dataIndex: 'movement_type', render: v => <Tag color={v === 'in' ? 'green' : 'orange'}>{v.toUpperCase()}</Tag> },
        { title: 'Qty', dataIndex: 'quantity' },
        { title: 'Reference', dataIndex: 'reference_type' },
        { title: 'Date', dataIndex: 'created_at', render: v => new Date(v).toLocaleString() },
      ]} />
    </Card>
  );
}

function IntegrationTab() {
  const [logs, setLogs] = useState([]);
  const [dlq, setDlq] = useState([]);
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pushVendorId, setPushVendorId] = useState(null);
  const [pullSapCode, setPullSapCode] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [l, d, e, a, v] = await Promise.all([
        api.get('/integration/logs'),
        api.get('/integration/dlq', { params: { resolved: false } }),
        api.get('/events/log'),
        api.get('/integration/audit-logs'),
        api.get('/vendors', { params: { limit: 100 } }),
      ]);
      setLogs(l.data.data || []);
      setDlq(d.data.data || []);
      setEvents(e.data.data || []);
      setAuditLogs(a.data.data || []);
      setVendors(v.data.data || []);
    } catch { message.error('Failed to load integration data'); }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const retry = async (id) => {
    try {
      await api.post(`/integration/dlq/${id}/retry`);
      message.success('Retry succeeded');
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Retry failed again'); }
  };

  const pushVendor = async () => {
    if (!pushVendorId) { message.error('Select a vendor to push'); return; }
    setSyncBusy(true);
    try {
      await api.post(`/integration/vendors/${pushVendorId}/push`);
      message.success('Vendor pushed to SAP');
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Push failed'); }
    setSyncBusy(false);
  };

  const pullVendor = async () => {
    if (!pullSapCode) { message.error('Enter a SAP vendor code to pull'); return; }
    setSyncBusy(true);
    try {
      const res = await api.post(`/integration/vendors/pull/${pullSapCode}`);
      message.success(`Pulled "${res.data.data.vendor_name}" from SAP`);
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Pull failed'); }
    setSyncBusy(false);
  };

  return (
    <Card size="small" loading={loading} extra={<Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>SAP Vendor Sync (bi-directional)</Text>
      <Space wrap style={{ marginBottom: 24 }}>
        <Select style={{ width: 240 }} placeholder="Select vendor to push" value={pushVendorId} onChange={setPushVendorId}
          options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
        <Button onClick={pushVendor} loading={syncBusy}>Push to SAP</Button>
        <Input style={{ width: 200 }} placeholder="SAP vendor code (e.g. V123)" value={pullSapCode} onChange={e => setPullSapCode(e.target.value)} />
        <Button onClick={pullVendor} loading={syncBusy}>Pull from SAP</Button>
      </Space>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Dead Letter Queue (unresolved)</Text>
      <Table size="small" rowKey="id" pagination={false} dataSource={dlq} columns={[
        { title: 'Type', dataIndex: 'integration_type' },
        { title: 'Record', dataIndex: 'record_id' },
        { title: 'Error', dataIndex: 'error_message', ellipsis: true },
        { title: 'Retries', dataIndex: 'retry_count' },
        { title: '', render: (_, r) => <Popconfirm title="Retry this sync now?" onConfirm={() => retry(r.id)}><Button size="small" type="primary">Retry</Button></Popconfirm> },
      ]} style={{ marginBottom: 24 }} />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Integration Logs</Text>
      <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={logs} columns={[
        { title: 'Type', dataIndex: 'integration_type' },
        { title: 'Direction', dataIndex: 'direction', render: v => <Tag>{v}</Tag> },
        { title: 'Record', dataIndex: 'record_id' },
        { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'success' ? 'green' : 'red'}>{v.toUpperCase()}</Tag> },
        { title: 'When', dataIndex: 'created_at', render: v => new Date(v).toLocaleString() },
      ]} style={{ marginBottom: 24 }} />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Event Log</Text>
      <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={events} columns={[
        { title: 'Event', dataIndex: 'event_type', render: v => <Tag color="blue">{v}</Tag> },
        { title: 'Module', dataIndex: 'module_name' },
        { title: 'Record', dataIndex: 'record_id' },
        { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'processed' ? 'green' : 'red'}>{v}</Tag> },
        { title: 'When', dataIndex: 'created_at', render: v => new Date(v).toLocaleString() },
      ]} style={{ marginBottom: 24 }} />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Audit Logs</Text>
      <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={auditLogs} columns={[
        { title: 'Action', dataIndex: 'action', render: v => <Tag>{v}</Tag> },
        { title: 'Module', dataIndex: 'module_name' },
        { title: 'Record', dataIndex: 'record_id' },
        { title: 'Actor', dataIndex: 'actor_id' },
        { title: 'When', dataIndex: 'created_at', render: v => new Date(v).toLocaleString() },
      ]} />
    </Card>
  );
}

function RulesTab({ kind }) {
  // kind: 'decision' | 'action' — same shape of screen for both engines.
  const isDecision = kind === 'decision';
  const [rules, setRules] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState({});

  const listUrl = isDecision ? '/decision-engine/rules' : '/action-engine/rules';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get(listUrl);
      setRules(res.data.data || []);
      if (isDecision) {
        const out = await api.get('/decision-engine/outputs');
        setOutputs(out.data.data || []);
      }
    } catch { message.error('Failed to load rules'); }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    try {
      await api.post(listUrl, {
        rule_name: form.rule_name,
        module_name: isDecision ? form.module_name : undefined,
        trigger_event: !isDecision ? form.trigger_event : undefined,
        output_type: isDecision ? form.output_type : undefined,
        recommended_action: !isDecision ? form.recommended_action : undefined,
        conditions: form.field ? [{ field: form.field, operator: form.operator || '>', value: form.value }] : null,
        priority: form.priority || 100,
      });
      message.success('Rule created');
      setPanelOpen(false);
      setForm({});
      fetchAll();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create rule'); }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`${listUrl}/${rule.id}`, { is_active: !rule.is_active });
      fetchAll();
    } catch { message.error('Failed to update rule'); }
  };

  return (
    <Card size="small" loading={loading}>
      <Button type="dashed" icon={<PlusOutlined />} onClick={() => setPanelOpen(true)} style={{ marginBottom: 12 }}>
        New {isDecision ? 'Decision' : 'Action'} Rule
      </Button>
      <InlineExpandPanel open={panelOpen} title={`New ${isDecision ? 'Decision' : 'Action'} Rule`} onCancel={() => { setPanelOpen(false); setForm({}); }} onSubmit={handleCreate}>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Rule Name</Text>
            <Input value={form.rule_name} onChange={e => setForm(f => ({ ...f, rule_name: e.target.value }))} />
          </Col>
          {isDecision ? (
            <>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Module</Text>
                <Select style={{ width: '100%' }} value={form.module_name} onChange={v => setForm(f => ({ ...f, module_name: v }))}
                  options={['pr', 'rfq', 'po', 'invoice'].map(v => ({ value: v, label: v.toUpperCase() }))} />
              </Col>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Output Type</Text>
                <Select style={{ width: '100%' }} value={form.output_type} onChange={v => setForm(f => ({ ...f, output_type: v }))}
                  options={['best_vendor', 'risk_alert', 'budget_alert', 'cost_insight'].map(v => ({ value: v, label: v.replace('_', ' ') }))} />
              </Col>
            </>
          ) : (
            <>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Trigger Event</Text>
                <Input placeholder="e.g. PR_APPROVED" value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))} />
              </Col>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Recommended Action</Text>
                <Input placeholder="e.g. create_rfq" value={form.recommended_action} onChange={e => setForm(f => ({ ...f, recommended_action: e.target.value }))} />
              </Col>
            </>
          )}
        </Row>
        <Text strong>Condition (optional)</Text>
        <Row gutter={12} style={{ marginTop: 8 }}>
          <Col span={8}><Input placeholder="field, e.g. total_value" value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} /></Col>
          <Col span={6}>
            <Select style={{ width: '100%' }} value={form.operator || '>'} onChange={v => setForm(f => ({ ...f, operator: v }))}
              options={['>', '>=', '<', '<=', '=', '!='].map(v => ({ value: v, label: v }))} />
          </Col>
          <Col span={10}><InputNumber style={{ width: '100%' }} placeholder="value" value={form.value} onChange={v => setForm(f => ({ ...f, value: v }))} /></Col>
        </Row>
      </InlineExpandPanel>
      <Table size="small" rowKey="id" pagination={false} dataSource={rules} columns={[
        { title: 'Name', dataIndex: 'rule_name' },
        { title: isDecision ? 'Module' : 'Trigger Event', dataIndex: isDecision ? 'module_name' : 'trigger_event' },
        { title: isDecision ? 'Output Type' : 'Recommended Action', dataIndex: isDecision ? 'output_type' : 'recommended_action' },
        { title: 'Priority', dataIndex: 'priority' },
        { title: 'Active', dataIndex: 'is_active', render: (v, r) => <Button size="small" type={v ? 'primary' : 'default'} onClick={() => toggleActive(r)}>{v ? 'Active' : 'Inactive'}</Button> },
      ]} />

      {isDecision && (
        <>
          <Text strong style={{ display: 'block', margin: '24px 0 8px' }}>Recent Outputs — what fired, for which record, and why (debugging/audit trail)</Text>
          <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={outputs} columns={[
            { title: 'Module', dataIndex: 'module_name' },
            { title: 'Record', dataIndex: 'record_id' },
            { title: 'Output Type', render: (_, r) => <Tag color="purple">{r.output?.output_type}</Tag> },
            { title: 'Message', render: (_, r) => r.output?.message },
            { title: 'Rule', render: (_, r) => r.output?.rule_name },
            { title: 'When', dataIndex: 'created_at', render: v => new Date(v).toLocaleString() },
          ]} />
        </>
      )}
    </Card>
  );
}

export default function ProcurementOSAdmin() {
  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'Procurement OS' }]}
        title="Procurement OS"
        subtitle="Multi-company, payments, inventory, the SAP connector, and the decision/next-best-action rule engines."
      />
      <Tabs
        defaultActiveKey="companies"
        items={[
          { key: 'companies', label: 'Companies', children: <CompaniesTab /> },
          { key: 'payments', label: 'Payments', children: <PaymentsTab /> },
          { key: 'inventory', label: 'Inventory', children: <InventoryTab /> },
          { key: 'integration', label: 'Integration', children: <IntegrationTab /> },
          { key: 'decision-rules', label: 'Decision Rules', children: <RulesTab kind="decision" /> },
          { key: 'action-rules', label: 'Action Rules', children: <RulesTab kind="action" /> },
        ]}
      />
    </div>
  );
}
