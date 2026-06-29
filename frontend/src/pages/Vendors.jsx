import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Table, Button, Form, Input, InputNumber, DatePicker, Select, Tag, Space, Row, Col, Card, Tabs, Popconfirm, Typography, Divider, Statistic, Avatar, Checkbox, Upload, Alert, Empty, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EditOutlined, SearchOutlined, ClearOutlined, SaveOutlined, CheckOutlined, CloseOutlined, StopOutlined, DeleteOutlined, PlusCircleOutlined, UploadOutlined, InboxOutlined, ZoomInOutlined, BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import SmartAssistantPanel from '../components/SmartAssistantPanel';
import PageHeader from '../components/ui/PageHeader';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import VendorCompanyMappings from '../components/VendorCompanyMappings';
import CompanySelector from '../components/CompanySelector';

const { Title, Text } = Typography;
const STATUS_COLOR = { draft: 'default', submitted: 'blue', under_review: 'orange', approved: 'green', rejected: 'red', inactive: '#8c8c8c' };
const LIFECYCLE_COLOR = { onboarding: 'blue', active: 'green', dormant: 'gold', blocked: '#8c8c8c' };
const RISK_COLOR = { low: 'green', medium: 'orange', high: 'red' };
const SEGMENT_OPTIONS = [
  { value: 'strategic', label: 'Strategic' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'approved', label: 'Approved' },
  { value: 'tactical', label: 'Tactical' },
];
const SEGMENT_COLOR = { strategic: 'gold', preferred: 'blue', approved: 'default', tactical: 'orange' };
const TREND_COLOR = { improving: 'green', stable: 'default', worsening: 'red' };
const ACTION_LABEL = { replace_vendor: 'Replace Vendor', reduce_dependency: 'Reduce Dependency', trigger_audit: 'Trigger Audit' };
const COMPLIANCE_DOC_STATUS_COLOR = { ok: 'green', expiring_soon: 'orange', expired: 'red' };

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export default function Vendors() {
  const navigate = useNavigate();
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [view, setView] = useState('list'); // list | detail | form | edit — each a full page, navigated via the row's View action
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [searchName, setSearchName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [subMasters, setSubMasters] = useState({});
  const [companies, setCompanies] = useState([]); // Procurement OS: for the optional "Internal Company" field below
  const [addresses, setAddresses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [complianceDates, setComplianceDates] = useState([]);
  const [vendorSummary, setVendorSummary] = useState(null);
  const [vendorSummaryLoading, setVendorSummaryLoading] = useState(false);

  // Vendor Intelligence Panel — compliance status (computed, not just the
  // raw expiry-date editor) + ProcurementInsightsService.getVendorScore
  // (risk trend, performance score, contract status, actionable insights).
  const [compliance, setCompliance] = useState(null);
  const [vendorScore, setVendorScore] = useState(null);
  const [riskActions, setRiskActions] = useState([]);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceLoaded, setIntelligenceLoaded] = useState(false);
  const { isRequired, isVisible } = useFieldConfig('vendor');

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
        const cats = ['department', 'supplier_group', 'supplier_category', 'state', 'city', 'country', 'vendor_type', 'industry', 'registration_type', 'payment_terms', 'msme_type', 'currency'];
        const results = {};
        for (const cat of cats) { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; }
        setSubMasters(results);
      } catch (_) {}
    })();
    api.get('/companies').then(res => setCompanies(res.data.data || [])).catch(() => {});
  }, []);

  // Triggered by the row's View (zoom) action — navigates to the full-page detail view.
  const openDetail = async (record) => {
    try {
      const res = await api.get(`/vendors/${record.id}`);
      setSelected(res.data.data);
    } catch (_) { setSelected(record); }
    setView('detail');
    setCompliance(null);
    setVendorScore(null);
    setIntelligenceLoaded(false);
    fetchVendorSummary(record.id);
  };

  // Deep-link support — e.g. the Control Tower's "View Source" action lands
  // here as /vendors?id=<vendor_id> and should jump straight to that record.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) openDetail({ id: deepLinkId });
  }, []);

  // Vendor 360 Profile — fetched separately from the main detail payload since
  // it's a derived/computed view, not part of the vendor record itself.
  const fetchVendorSummary = async (vendorId) => {
    setVendorSummary(null);
    setVendorSummaryLoading(true);
    try {
      const res = await api.get(`/vendors/${vendorId}/summary`);
      setVendorSummary(res.data.data);
    } catch (_) { /* non-critical — panel just stays empty */ }
    setVendorSummaryLoading(false);
  };

  const fetchIntelligence = async (vendorId) => {
    setIntelligenceLoading(true);
    try {
      const [complianceRes, scoreRes, actionsRes] = await Promise.all([
        api.get(`/vendors/${vendorId}/compliance`),
        api.get(`/insights/vendors/${vendorId}/score`),
        api.get(`/vendors/${vendorId}/risk-actions`),
      ]);
      setCompliance(complianceRes.data.data);
      setVendorScore(scoreRes.data.data);
      setRiskActions(actionsRes.data.data || []);
    } catch (_) { /* non-critical — panel just stays empty */ }
    setIntelligenceLoading(false);
    setIntelligenceLoaded(true);
  };

  const onDetailTabChange = (key) => {
    if (key === 'intelligence' && !intelligenceLoaded && selected) fetchIntelligence(selected.id);
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

  const goBack = () => { setView('list'); setSelected(null); setVendorSummary(null); setAddresses([]); setBankAccounts([]); setComplianceDates([]); setCompliance(null); setVendorScore(null); setRiskActions([]); setIntelligenceLoaded(false); };

  // Mirrors the backend's own validateAddressRows/validateBankAccountRows
  // (vendor.routes.js) — addresses/bank accounts are plain state-bound rows,
  // not AntD Form.Items, so form.validateFields() never sees them. Without
  // this, an incomplete row (e.g. bank account missing City/State) only
  // failed once it reached the server's NOT NULL columns, as an opaque
  // error after the user had already clicked Save.
  const validateAddressAndBankRows = () => {
    const addrRequired = ['line1', 'city', 'state', 'country', 'pin_code'];
    const addrLabels = { line1: 'Address Line 1', city: 'City', state: 'State', country: 'Country', pin_code: 'PIN Code' };
    for (let i = 0; i < addresses.length; i++) {
      const missing = addrRequired.filter(f => !addresses[i][f]);
      if (missing.length > 0) { message.error(`Address ${i + 1} is missing: ${missing.map(f => addrLabels[f]).join(', ')}`); return false; }
    }
    const bankRequired = ['ifsc_code', 'account_number', 'account_holder_name', 'bank_name', 'branch', 'city', 'state', 'country'];
    const bankLabels = { ifsc_code: 'IFSC Code', account_number: 'Account Number', account_holder_name: 'Account Holder', bank_name: 'Bank Name', branch: 'Branch', city: 'City', state: 'State', country: 'Country' };
    for (let i = 0; i < bankAccounts.length; i++) {
      const missing = bankRequired.filter(f => !bankAccounts[i][f]);
      if (missing.length > 0) { message.error(`Bank account ${i + 1} is missing: ${missing.map(f => bankLabels[f]).join(', ')}`); return false; }
    }
    return true;
  };

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
      if (!validateAddressAndBankRows()) return;
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
        setRejectPanelOpen(false); setRejectReason('');
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
      if (selected?.id === vendorId) goBack();
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

  const closeImportPanel = () => { setImportPanelOpen(false); setImportFile(null); setImportResult(null); };

  // Address helpers
  const addAddress = () => setAddresses([...addresses, { line1: '', line2: '', city: '', state: '', country: 'India', pin_code: '', tags: [] }]);
  const removeAddress = (i) => setAddresses(addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i, field, value) => setAddresses(addresses.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  // Bank helpers
  const addBank = () => setBankAccounts([...bankAccounts, { ifsc_code: '', account_number: '', account_holder_name: '', bank_name: '', branch: '', city: '', state: '', country: 'India' }]);
  const removeBank = (i) => setBankAccounts(bankAccounts.filter((_, idx) => idx !== i));
  const updateBank = (i, field, value) => setBankAccounts(bankAccounts.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  // ─── LIST VIEW (full page — View action navigates to the detail page) ───
  if (view === 'list') {
    const columns = [
      {
        title: 'Name', dataIndex: 'vendor_name', width: 180, ellipsis: true, render: (t) => <Space style={{ maxWidth: '100%', overflow: 'hidden' }}><Avatar size="small" style={{ background: '#1890ff', flexShrink: 0 }}>{t?.[0]}</Avatar><Text strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</Text></Space>,
        sorter: (a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')),
      },
      { title: 'Company', dataIndex: 'company_name', width: 150, ellipsis: true, sorter: (a, b) => String(a.company_name || '').localeCompare(String(b.company_name || '')) },
      {
        title: 'Category', dataIndex: 'supplier_category', width: 120, render: v => v ? <Tag color="blue">{v}</Tag> : '—',
        sorter: (a, b) => String(a.supplier_category || '').localeCompare(String(b.supplier_category || '')),
      },
      { title: 'Email', dataIndex: 'email', width: 200, ellipsis: true, sorter: (a, b) => String(a.email || '').localeCompare(String(b.email || '')) },
      {
        title: 'Status', dataIndex: 'status', width: 120, render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase().replace('_', ' ')}</Tag>,
        sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
        filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase().replace('_', ' '), value: v })),
        onFilter: (value, row) => row.status === value,
      },
      {
        title: 'Lifecycle', dataIndex: 'lifecycle_stage', width: 110, render: s => s ? <Tag color={LIFECYCLE_COLOR[s]}>{s.toUpperCase()}</Tag> : '—',
        sorter: (a, b) => String(a.lifecycle_stage || '').localeCompare(String(b.lifecycle_stage || '')),
        filters: Object.keys(LIFECYCLE_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
        onFilter: (value, row) => row.lifecycle_stage === value,
      },
      {
        title: 'Risk', dataIndex: 'risk_category', width: 90, render: r => r ? <Tag color={RISK_COLOR[r]}>{r.toUpperCase()}</Tag> : '—',
        sorter: (a, b) => String(a.risk_category || '').localeCompare(String(b.risk_category || '')),
        filters: Object.keys(RISK_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
        onFilter: (value, row) => row.risk_category === value,
      },
      {
        title: 'Actions', width: 100, fixed: 'right', render: (_, record) => (
          <Space>
            <Button icon={<ZoomInOutlined />} size="small" title="View" onClick={() => openDetail(record)} />
            <Popconfirm title="Delete this vendor?" description="This cannot be undone." onConfirm={() => handleDelete(record.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
    const canManageVendors = ['mdm_admin', 'system_admin'].includes(user.role);

    const vendorListActions = canManageVendors ? (
      <Space>
        <Button icon={<UploadOutlined />} onClick={() => setImportPanelOpen(o => !o)}>Import Excel</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openForm}>Add Vendor</Button>
      </Space>
    ) : null;
    return (
      <div>
        {uiImprovementsEnabled ? (
          <PageHeader
            items={[{ title: 'Vendor Management' }, { title: 'Vendors' }]}
            title="Vendor Master"
            subtitle="Manage vendor master data, onboarding workflows, and approval status. Create new vendors and track their lifecycle."
            extra={vendorListActions}
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Title level={4} style={{ margin: 0 }}>Vendor Master</Title>
              {vendorListActions}
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Manage vendor master data, onboarding workflows, and approval status. Create new vendors and track their lifecycle.</Text>
          </>
        )}

        <InlineExpandPanel
          open={importPanelOpen}
          title="Import Vendors from Excel"
          onCancel={closeImportPanel}
          onSubmit={handleImport}
          submitText="Upload & Import"
          loading={importing}
        >
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
        </InlineExpandPanel>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={12} align="middle">
            <Col flex="1"><Input placeholder="Search by Name" value={searchName} onChange={e => setSearchName(e.target.value)} onPressEnter={() => fetchData()} allowClear /></Col>
            <Col><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData()}>Search</Button></Col>
            <Col><Button icon={<ClearOutlined />} onClick={() => { setSearchName(''); fetchData(); }}>Clear</Button></Col>
          </Row>
        </Card>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" scroll={{ x: 1070 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: t => `${t} vendors`, onChange: (p, ps) => fetchData(p, ps) }} />
      </div>
    );
  }

  // ─── DETAIL VIEW (full page) ───
  if (view === 'detail' && selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>{selected.vendor_name}</Title>
            <Tag color="purple">{selected.vendor_number}</Tag>
            {selected.vendor_code && <Tag color="geekblue">{selected.vendor_code}</Tag>}
            <Tag color={STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase().replace('_', ' ')}</Tag>
            {selected.lifecycle_stage && <Tag color={LIFECYCLE_COLOR[selected.lifecycle_stage]}>{selected.lifecycle_stage.toUpperCase()}</Tag>}
            {!!selected.blacklist_flag && <Tag color="red">BLACKLISTED</Tag>}
          </Space>
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={() => openEdit(selected)}>Edit</Button>
            {selected.status === 'submitted' && <Button onClick={() => handleAction('review')}>Begin Review</Button>}
            {selected.status === 'under_review' && <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a' }} onClick={() => handleAction('approve')}>Approve</Button>}
            {selected.status === 'under_review' && <Button danger icon={<CloseOutlined />} onClick={() => setRejectPanelOpen(o => !o)}>Reject</Button>}
            {selected.status === 'approved' && <Popconfirm title="Deactivate?" onConfirm={() => handleAction('deactivate')}><Button icon={<StopOutlined />}>Deactivate</Button></Popconfirm>}
            <Popconfirm title="Delete this vendor?" description="This cannot be undone. Vendors with existing transactions cannot be deleted." onConfirm={() => handleDelete(selected.id)}>
              <Button icon={<DeleteOutlined />} danger>Delete</Button>
            </Popconfirm>
          </Space>
        </div>

        {/* Vendor 360 Profile — every figure here is computed on read
            (GET /vendors/:id/summary), nothing is stored on the vendor record. */}
        <Card size="small" loading={vendorSummaryLoading} style={{ marginBottom: 16, background: '#fafafa' }}>
          {vendorSummary && (
            <Row gutter={16}>
              <Col span={5}><Statistic title="Total Spend" value={vendorSummary.total_spend ?? 0} prefix="₹" valueStyle={{ fontSize: 18 }} /></Col>
              <Col span={4}><Statistic title="Active POs" value={vendorSummary.active_po_count} valueStyle={{ fontSize: 18 }} /></Col>
              <Col span={5}>
                <Statistic title="On-Time Delivery" value={vendorSummary.on_time_delivery_pct ?? '—'} suffix={vendorSummary.on_time_delivery_pct != null ? '%' : ''}
                  valueStyle={{ fontSize: 18, color: vendorSummary.on_time_delivery_pct == null ? undefined : vendorSummary.on_time_delivery_pct >= 90 ? '#52c41a' : vendorSummary.on_time_delivery_pct >= 70 ? '#faad14' : '#ff4d4f' }} />
                {vendorSummary.sample_sizes?.delivery_evaluated > 0 && <Text type="secondary" style={{ fontSize: 11 }}>{vendorSummary.sample_sizes.delivery_evaluated} ASN(s) evaluated</Text>}
              </Col>
              <Col span={5}>
                <Statistic title="Rejection Rate" value={vendorSummary.rejection_rate ?? '—'} suffix={vendorSummary.rejection_rate != null ? '%' : ''}
                  valueStyle={{ fontSize: 18, color: vendorSummary.rejection_rate == null ? undefined : vendorSummary.rejection_rate === 0 ? '#52c41a' : vendorSummary.rejection_rate < 10 ? '#faad14' : '#ff4d4f' }} />
              </Col>
              <Col span={5}><Statistic title="Last Transaction" value={vendorSummary.last_transaction_date ? dayjs(vendorSummary.last_transaction_date).format('DD-MM-YYYY') : '—'} valueStyle={{ fontSize: 18 }} /></Col>
            </Row>
          )}
          {!vendorSummaryLoading && !vendorSummary && <Text type="secondary">No transaction history yet.</Text>}
        </Card>

        <InlineExpandPanel
          open={rejectPanelOpen}
          title="Reject Vendor"
          submitText="Reject"
          submitDanger
          onCancel={() => { setRejectPanelOpen(false); setRejectReason(''); }}
          onSubmit={() => handleAction('reject')}
        >
          <Input.TextArea rows={3} placeholder="Enter rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </InlineExpandPanel>

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
              {isVisible('credit_rating') && <Col span={6}><Card size="small"><Text type="secondary">Credit Rating</Text><br /><Text strong>{selected.credit_rating || '—'}</Text></Card></Col>}
              {isVisible('credit_limit') && <Col span={6}><Card size="small"><Text type="secondary">Credit Limit</Text><br /><Text strong>{selected.credit_limit != null ? `${selected.currency_code || 'INR'} ${selected.credit_limit}` : '—'}</Text></Card></Col>}
              <Col span={6}><Card size="small"><Text type="secondary">Currency</Text><br /><Text strong>{selected.currency_code || 'INR'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Risk Category</Text><br />{selected.risk_category ? <Tag color={RISK_COLOR[selected.risk_category]}>{selected.risk_category.toUpperCase()}</Tag> : '—'}</Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Vendor Segment</Text><br />{selected.vendor_segment ? <Tag color={SEGMENT_COLOR[selected.vendor_segment]}>{selected.vendor_segment.toUpperCase()}</Tag> : <Tag>APPROVED</Tag>}</Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Account Manager</Text><br /><Text strong>{selected.account_manager_name || '—'}</Text></Card></Col>
              <Col span={6}><Card size="small"><Text type="secondary">Internal Company</Text><br />{selected.internal_company_id ? <Tag color="purple">{companies.find(c => c.id === selected.internal_company_id)?.company_name || 'Linked'}</Tag> : <Text type="secondary">External vendor</Text>}</Card></Col>
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
          { key: 'company-mappings', label: 'Company Mappings', children: (
            <VendorCompanyMappings vendorId={selected.id} />
          )},
          { key: 'intelligence', label: <span><BulbOutlined /> Intelligence</span>, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <SmartAssistantPanel entityType="vendor" entityId={selected.id} />

              {intelligenceLoading && <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>}

              {!intelligenceLoading && (compliance?.is_blocked || !!selected.blacklist_flag) && (
                <Alert
                  type="error" showIcon
                  message="This vendor is blocked from new sourcing"
                  description={[
                    !!selected.blacklist_flag && 'Blacklisted.',
                    compliance?.is_blocked && 'Has an expired compliance document.',
                  ].filter(Boolean).join(' ')}
                />
              )}
              {!intelligenceLoading && !compliance?.is_blocked && !selected.blacklist_flag && compliance?.documents?.some(d => d.status === 'expiring_soon') && (
                <Alert type="warning" showIcon message="One or more compliance documents are expiring soon" />
              )}

              {!intelligenceLoading && compliance && (
                <Card title="Compliance Status" size="small">
                  {compliance.documents.length === 0 ? <Text type="secondary">No compliance expiry dates recorded</Text> : (
                    <Table
                      size="small" pagination={false} rowKey="label"
                      dataSource={compliance.documents}
                      columns={[
                        { title: 'Document', dataIndex: 'label' },
                        { title: 'Expiry Date', dataIndex: 'expiry_date' },
                        { title: 'Days Remaining', dataIndex: 'days_remaining', render: v => v < 0 ? <Text type="danger">{v} (expired)</Text> : v },
                        { title: 'Status', dataIndex: 'status', render: v => <Tag color={COMPLIANCE_DOC_STATUS_COLOR[v]}>{v.replace('_', ' ').toUpperCase()}</Tag> },
                      ]}
                    />
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>Alert window: {compliance.alert_days} days before expiry.</Text>
                </Card>
              )}

              {!intelligenceLoading && vendorScore && (
                <Card title="Risk & Performance" size="small">
                  <Row gutter={16}>
                    <Col span={6}><Statistic title="Performance Score" value={vendorScore.performance_score ?? '—'} suffix={vendorScore.performance_score != null ? '/ 100' : ''} /></Col>
                    <Col span={6}>
                      <Statistic title="Risk Level" valueRender={() => <Tag color={vendorScore.risk.risk_level === 'high' ? 'red' : vendorScore.risk.risk_level === 'medium' ? 'orange' : 'green'}>{(vendorScore.risk.risk_level || '—').toUpperCase()}</Tag>} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="Risk Trend" valueRender={() => <Tag color={TREND_COLOR[vendorScore.risk.risk_trend]}>{(vendorScore.risk.risk_trend || '—').toUpperCase()}</Tag>} />
                    </Col>
                    <Col span={6}><Statistic title="Price Competitiveness" value={vendorScore.price_competitiveness.score ?? '—'} suffix={vendorScore.price_competitiveness.score != null ? '/ 100' : ''} /></Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 12 }}>
                    <Col span={6}><Statistic title="Active Contract" valueRender={() => <Tag color={vendorScore.contract_summary.has_active_contract ? 'green' : 'default'}>{vendorScore.contract_summary.has_active_contract ? 'YES' : 'NO'}</Tag>} /></Col>
                  </Row>
                </Card>
              )}

              {!intelligenceLoading && vendorScore?.insights?.length > 0 && (
                <Card title="Insights" size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {vendorScore.insights.map((insight, idx) => (
                      <Alert
                        key={idx}
                        type={insight.severity === 'critical' ? 'error' : insight.severity === 'warning' ? 'warning' : 'info'}
                        showIcon
                        message={insight.message}
                      />
                    ))}
                  </Space>
                </Card>
              )}

              {!intelligenceLoading && riskActions.length > 0 && (
                <Card title="Recommended Actions" size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {riskActions.map((a, idx) => (
                      <Alert
                        key={idx}
                        type="warning"
                        showIcon
                        message={ACTION_LABEL[a.action] || a.action}
                        description={
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Text>{a.reason}</Text>
                            {a.action === 'replace_vendor' && a.suggested_vendors?.length > 0 && (
                              <Space wrap size={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Suggested alternatives:</Text>
                                {a.suggested_vendors.map(v => <Tag key={v.vendor_id}>{v.vendor_name}</Tag>)}
                              </Space>
                            )}
                            {a.action === 'trigger_audit' && (
                              <Button size="small" onClick={() => navigate('/audit')}>Go to Audit Management</Button>
                            )}
                          </Space>
                        }
                      />
                    ))}
                  </Space>
                </Card>
              )}

              {!intelligenceLoading && !compliance && !vendorScore && <Empty description="No intelligence data available" />}
            </Space>
          )},
        ]} onChange={onDetailTabChange} />
      </div>
    );
  }

  // ─── EDIT VIEW (full-page task flow — Admin can edit all fields) ───
  if (view === 'edit' && selected) {
    return (
      <div style={{ paddingBottom: 0 }}>
        <div style={{ paddingBottom: 88 }}>
          {uiImprovementsEnabled ? (
            <PageHeader
              items={[{ title: 'Vendor Management' }, { title: 'Vendors' }]}
              title={<>Edit — {selected.vendor_name} <Tag color="purple" style={{ marginLeft: 8 }}>{selected.vendor_number}</Tag></>}
              onBack={goBack}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginRight: 12 }}>Back</Button>
              <Title level={4} style={{ margin: 0 }}>Edit — {selected.vendor_name}</Title>
              <Tag color="purple" style={{ marginLeft: 12 }}>{selected.vendor_number}</Tag>
            </div>
          )}
        <Card>
          <Form form={form} layout="vertical">
            <Title level={5}>Core Information</Title>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="vendor_name" label={<span>Vendor Name<span className="form-label-desc">Company or individual</span></span>} rules={[{ required: isRequired('vendor_name', true), message: 'Vendor Name is required' }]}><Input size="large" /></Form.Item></Col>
              <Col span={8}><Form.Item label="Email (read-only)"><Input disabled value={selected.email} /></Form.Item></Col>
              <Col span={8}><Form.Item name="phone" label="Phone" rules={[{ required: isRequired('phone', true), message: 'Phone is required' }]}><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: isRequired('company_name', true), message: 'Company is required' }]}><Select showSearch placeholder="Select" options={(companies || []).map(c => ({ value: c.company_name, label: c.company_name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: isRequired('supplier_group', false), message: 'Supplier Group is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
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
              {isVisible('credit_rating') && <Col span={6}><Form.Item name="credit_rating" label={<span>Credit Rating<span className="form-label-desc">e.g. AA+, BB</span></span>} rules={[{ required: isRequired('credit_rating', false), message: 'Credit Rating is required' }]}><Input maxLength={10} /></Form.Item></Col>}
              {isVisible('credit_limit') && <Col span={6}><Form.Item name="credit_limit" label="Credit Limit" rules={[{ required: isRequired('credit_limit', false), message: 'Credit Limit is required' }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>}
              <Col span={6}><Form.Item name="risk_category" label="Risk Category" rules={[{ required: isRequired('risk_category', false), message: 'Risk Category is required' }]}><Select placeholder="Select" options={[{ value: 'low' }, { value: 'medium' }, { value: 'high' }]} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="vendor_segment" label={<span>Vendor Segment<span className="form-label-desc">Used for RFQ sourcing priority and recommendations</span></span>} rules={[{ required: isRequired('vendor_segment', false), message: 'Vendor Segment is required' }]}><Select placeholder="Select" options={SEGMENT_OPTIONS} allowClear /></Form.Item></Col>
              <Col span={6}><Form.Item name="preferred_vendor_flag" label=" " valuePropName="checked"><Checkbox>Preferred Vendor</Checkbox></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="internal_company_id" label={<span>Internal Company<span className="form-label-desc">Set only if this vendor is one of the organization's own companies (Procurement OS Intercompany)</span></span>}>
                  <Select placeholder="None — external vendor" allowClear options={companies.map(c => ({ value: c.id, label: c.company_name }))} />
                </Form.Item>
              </Col>
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
          </Form>
        </Card>
        </div>

        <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '16px 24px', margin: '0 -24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Space size="middle">
            <Button onClick={goBack}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleUpdate}>Save Changes</Button>
          </Space>
        </div>
      </div>
    );
  }

  // ─── CREATE FORM VIEW (full-page task flow) ───
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
            <Col span={6}><Form.Item name="company_name" label="Company" rules={[{ required: isRequired('company_name', true), message: 'Company is required' }]}><Select showSearch placeholder="Select" options={(companies || []).map(c => ({ value: c.company_name, label: c.company_name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}><Select showSearch placeholder="Select" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_group" label="Supplier Group" rules={[{ required: isRequired('supplier_group', false), message: 'Supplier Group is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_group || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="supplier_category" label="Category" rules={[{ required: isRequired('supplier_category', true), message: 'Category is required' }]}><Select showSearch placeholder="Select" options={(subMasters.supplier_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="supplier_location" label="Location" rules={[{ required: isRequired('supplier_location', true), message: 'Location is required' }]}><Input placeholder="City / Location" /></Form.Item></Col>
            <Col span={16}><Form.Item name="company_ids" label="Company Access (assign to companies)" rules={[{ required: true, message: 'At least one company is required' }]}><CompanySelector mode="multiple" placeholder="Select companies this vendor serves" style={{ width: '100%' }} /></Form.Item></Col>
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
