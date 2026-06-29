import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, Row, Col, Card, Typography, Divider, Space, Tag, Checkbox, Radio, Empty, Alert, Tabs, Statistic, message } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, SearchOutlined, ClearOutlined, PlusCircleOutlined, FileTextOutlined, ArrowLeftOutlined, FilePdfOutlined, ZoomInOutlined, EditOutlined, CheckOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';
import DecisionPanel from '../components/DecisionPanel';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import InactiveCompanyBadge from '../components/InactiveCompanyBadge';
import HsnDropdown from '../components/HsnDropdown';

const { Title, Text } = Typography;

const VERSION_STATUS_COLOR = { pending_approval: 'orange', approved: 'green', rejected: 'red' };
const PO_STATUS_COLOR = { open: 'blue', partially_fulfilled: 'orange', fulfilled: 'green', closed: 'default' };

function formatChangeLog(changeLog) {
  if (!changeLog) return [];
  const parsed = typeof changeLog === 'string' ? JSON.parse(changeLog) : changeLog;
  const lines = [];
  Object.entries(parsed.header || {}).forEach(([field, { from, to }]) => {
    lines.push(`${field}: ${from ?? '—'} → ${to ?? '—'}`);
  });
  (parsed.line_items || []).forEach(li => {
    Object.entries(li.fields || {}).forEach(([field, { from, to }]) => {
      lines.push(`"${li.description}" ${field}: ${from ?? '—'} → ${to ?? '—'}`);
    });
  });
  return lines;
}

export default function PurchaseOrders() {
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState([{ description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filterPoNumber, setFilterPoNumber] = useState('');
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [deliverySchedule, setDeliverySchedule] = useState([]);
  const [subMasters, setSubMasters] = useState({ incoterms: [], account_assignment_category: [] });
  const [poRequirePrReference, setPoRequirePrReference] = useState(false);
  const { isRequired } = useFieldConfig('purchase_order');

  // Detail view + PO Versioning / Amendment Workflow
  const [view, setView] = useState('list'); // list | detail (layered on top of the existing showForm toggle for create)
  const [selectedPo, setSelectedPo] = useState(null);
  const [poDetailLoading, setPoDetailLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [poVersions, setPoVersions] = useState(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [amendPanelOpen, setAmendPanelOpen] = useState(false);
  const [amendHeader, setAmendHeader] = useState({});
  const [amendLineInputs, setAmendLineInputs] = useState([]);
  const [amendReason, setAmendReason] = useState('');
  const [amending, setAmending] = useState(false);
  const [versionActionLoading, setVersionActionLoading] = useState(false);

  // Create PO from PR/RFQ
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceType, setSourceType] = useState('PR'); // 'PR' | 'RFQ'
  const [sourceRecords, setSourceRecords] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [sourceLines, setSourceLines] = useState([]);
  const [creatingFromSource, setCreatingFromSource] = useState(false);
  const [sourceRfqVendors, setSourceRfqVendors] = useState(null); // null = no RFQ context → fall back to all vendors

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/purchase-orders'); setData(res.data.data || []); } catch (_) {}
    setLoading(false);
  };

  const downloadPoPdf = async (po) => {
    try {
      const res = await api.get(`/purchase-orders/${po.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${po.po_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      message.error('Failed to download PO PDF');
    }
  };

  // ── Detail view + PO Versioning ──────────────────────────────────────────

  const openPoDetail = async (record) => {
    setPoVersions(null);
    setActiveDetailTab('overview');
    setPoDetailLoading(true);
    try {
      const res = await api.get(`/purchase-orders/${record.id}`);
      setSelectedPo(res.data.data);
    } catch (_) { setSelectedPo(record); }
    setPoDetailLoading(false);
    setView('detail');
  };

  const goBackFromDetail = () => { setView('list'); setSelectedPo(null); setPoVersions(null); };

  const fetchVersions = async (poId) => {
    setVersionsLoading(true);
    try {
      const res = await api.get(`/purchase-orders/${poId}/versions`);
      setPoVersions(res.data.data);
    } catch { message.error('Failed to load version history'); }
    setVersionsLoading(false);
  };

  const onDetailTabChange = (key) => {
    setActiveDetailTab(key);
    if (key === 'versions' && !poVersions && selectedPo) fetchVersions(selectedPo.id);
  };

  const openAmendPanel = () => {
    setAmendHeader({
      validity_date: selectedPo.validity_date ? dayjs(selectedPo.validity_date) : null,
      terms_of_payment: selectedPo.terms_of_payment || '',
      incoterms: selectedPo.incoterms || null,
      retention_percentage: selectedPo.retention_percentage ?? null,
    });
    setAmendLineInputs((selectedPo.line_items || []).map(li => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      hsn_sac: li.hsn_sac || '',
      tax_percent: li.tax_percent ?? 0,
    })));
    setAmendReason('');
    setAmendPanelOpen(true);
  };

  const updateAmendLine = (i, field, value) => setAmendLineInputs(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const handleProposeAmendment = async () => {
    if (!amendReason.trim()) { message.error('Change reason is required'); return; }
    setAmending(true);
    try {
      await api.post(`/purchase-orders/${selectedPo.id}/amend`, {
        changes: {
          header: {
            validity_date: amendHeader.validity_date ? amendHeader.validity_date.format('YYYY-MM-DD') : null,
            terms_of_payment: amendHeader.terms_of_payment || null,
            incoterms: amendHeader.incoterms || null,
            retention_percentage: amendHeader.retention_percentage,
          },
          line_items: amendLineInputs,
        },
        change_reason: amendReason,
      });
      message.success('Amendment proposed — awaiting approval from a different user');
      setAmendPanelOpen(false);
      openPoDetail(selectedPo);
      fetchVersions(selectedPo.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to propose amendment'); }
    setAmending(false);
  };

  const handleApproveVersion = async (versionId) => {
    setVersionActionLoading(true);
    try {
      await api.post(`/purchase-orders/${selectedPo.id}/versions/${versionId}/approve`);
      message.success('Amendment approved and applied');
      openPoDetail(selectedPo);
      fetchVersions(selectedPo.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to approve amendment'); }
    setVersionActionLoading(false);
  };

  const handleRejectVersion = async (versionId) => {
    setVersionActionLoading(true);
    try {
      await api.post(`/purchase-orders/${selectedPo.id}/versions/${versionId}/reject`, { remarks: 'Rejected from PO detail view' });
      message.success('Amendment rejected');
      openPoDetail(selectedPo);
      fetchVersions(selectedPo.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to reject amendment'); }
    setVersionActionLoading(false);
  };

  // Deep-link support — Control Tower / Traceability "View Source" lands
  // here as /purchase-orders?id=<po_id> and should jump straight to detail.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) openPoDetail({ id: deepLinkId });
  }, []);

  useEffect(() => {
    fetchData();
    api.get('/vendors?limit=500').then(r => setVendors(r.data.data || [])).catch(() => {});
    api.get('/companies?active_only=true').then(r => setCompanies(r.data.data || [])).catch(() => {});
    (async () => {
      const cats = ['incoterms', 'account_assignment_category', 'department', 'plant', 'cost_center'];
      const results = {};
      for (const cat of cats) {
        try { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; } catch { results[cat] = []; }
      }
      setSubMasters(results);
    })();
    api.get('/system/settings/po_require_pr_reference').then(r => {
      setPoRequirePrReference(r.data.data.value === 'true');
    }).catch(() => {});
  }, []);

  // ── Create PO from PR/RFQ ─────────────────────────────────────────────────

  // A PR/RFQ can fail to be selectable for two independent reasons — wrong
  // status (not yet approved) or wrong sourcing_strategy (RFQ_REQUIRED PRs
  // can't go straight to a PO) — surface both instead of just omitting it.
  const prSourceEligible = (p) => ['approved', 'sourcing'].includes(p.status) && ['DIRECT_PO_ALLOWED', 'AUTO_PO', 'CONTRACT_BASED'].includes(p.sourcing_strategy);
  const prSourceReason = (p) => {
    if (!['approved', 'sourcing'].includes(p.status)) {
      if (p.status === 'draft') return 'not yet submitted';
      if (p.status === 'submitted') return `awaiting approval${p.current_approver_role ? ` (${p.current_approver_role})` : ''}`;
      if (p.status === 'partially_approved') return 'partially approved';
    }
    if (p.sourcing_strategy === 'RFQ_REQUIRED') return 'RFQ required — use Create RFQ from PR instead';
    return null;
  };

  const loadSourceRecords = async (type) => {
    try {
      if (type === 'PR') {
        const statuses = ['draft', 'submitted', 'approved', 'partially_approved', 'sourcing'];
        const results = await Promise.all(statuses.map(status => api.get('/pr', { params: { status } })));
        setSourceRecords(results.flatMap(r => r.data.data || []));
      } else {
        const res = await api.get('/rfq');
        setSourceRecords((res.data.data || []).filter(r => r.status === 'closed'));
      }
    } catch { message.error('Failed to load source documents'); }
  };

  const openSourceModal = () => {
    setSourceType('PR');
    setSelectedSourceId(null);
    setSourceLines([]);
    setSourceRfqVendors(null);
    setSourceModalOpen(o => !o);
    loadSourceRecords('PR');
  };

  const handleSourceTypeChange = (type) => {
    setSourceType(type);
    setSelectedSourceId(null);
    setSourceLines([]);
    setSourceRfqVendors(null);
    loadSourceRecords(type);
  };

  const handleSelectSource = async (id) => {
    setSelectedSourceId(id);
    setSourceRfqVendors(null);
    try {
      if (sourceType === 'PR') {
        const res = await api.get(`/pr/${id}/allocation`);
        const lines = (res.data.data.lines || []).filter(l => l.remaining_quantity > 0);
        setSourceLines(lines.map(l => ({ id: l.pr_line_item_id, description: l.description, max: l.remaining_quantity, quantity: l.remaining_quantity, unit_price: l.estimated_unit_price || 0, vendor_id: null, selected: true })));
      } else {
        const [allocRes, rfqRes] = await Promise.all([
          api.get(`/rfq/${id}/allocation`),
          api.get(`/rfq/${id}`),
        ]);
        const lines = (allocRes.data.data.lines || []).filter(l => l.remaining_to_award > 0);
        setSourceLines(lines.map(l => ({ id: l.rfq_line_item_id, description: l.item_description, max: l.remaining_to_award, quantity: l.remaining_to_award, unit_price: l.target_price || 0, vendor_id: null, selected: true })));
        // Only vendors actually invited to this RFQ should be assignable — not the entire vendor master.
        const invited = (rfqRes.data.data.vendors || []).map(v => ({ id: v.vendor_id, vendor_name: v.vendor_name || v.company_name }));
        setSourceRfqVendors(invited);
      }
    } catch { message.error('Failed to load line items'); setSourceLines([]); }
  };

  const toggleSourceLine = (id, checked) => setSourceLines(prev => prev.map(l => l.id === id ? { ...l, selected: checked } : l));
  const updateSourceLine = (id, field, value) => setSourceLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const handleCreateFromSource = async () => {
    const selected = sourceLines.filter(l => l.selected && l.quantity > 0);
    if (selected.length === 0) { message.error('Select at least one line item'); return; }
    if (sourceType === 'RFQ' && selected.some(l => !l.vendor_id || !l.unit_price)) {
      message.error('Assign a vendor and price for each selected line');
      return;
    }
    setCreatingFromSource(true);
    try {
      if (sourceType === 'PR') {
        // Group by vendor so a split (different vendors per line) becomes one PO per vendor.
        const byVendor = {};
        for (const l of selected) {
          const key = l.vendor_id || '__default__';
          (byVendor[key] ||= []).push(l);
        }
        const created = [];
        for (const [vendorKey, lines] of Object.entries(byVendor)) {
          const res = await api.post(`/pr/${selectedSourceId}/create-po`, {
            vendor_id: vendorKey === '__default__' ? undefined : vendorKey,
            lines: lines.map(l => ({ pr_line_item_id: l.id, quantity: l.quantity, unit_price: l.unit_price || undefined })),
          });
          created.push(res.data.data.po_number);
        }
        message.success(`Created PO(s): ${created.join(', ')}`);
      } else {
        const res = await api.post(`/rfq/${selectedSourceId}/award`, {
          award_items: selected.map(l => ({ rfq_line_item_id: l.id, vendor_id: l.vendor_id, unit_price: l.unit_price, quantity: l.quantity })),
        });
        const pos = res.data.data.purchase_orders;
        message.success(`Created PO(s): ${pos.map(p => p.po_number).join(', ')}`);
      }
      setSourceModalOpen(false);
      fetchData();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to create PO'); }
    setCreatingFromSource(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const totalAmount = items.reduce((s, i) => s + (i.total_line_amount || 0), 0);
      const delivery_schedule_json = deliverySchedule
        .filter(d => d.milestone || d.date || d.quantity_percent)
        .map(d => ({ milestone: d.milestone || '', date: d.date ? dayjs(d.date).format('YYYY-MM-DD') : null, quantity_percent: d.quantity_percent ?? null }));
      await api.post('/purchase-orders', {
        ...values,
        po_date: values.po_date?.format('YYYY-MM-DD'),
        validity_date: values.validity_date?.format('YYYY-MM-DD'),
        total_amount: totalAmount,
        line_items: items,
        delivery_schedule_json: delivery_schedule_json.length > 0 ? delivery_schedule_json : null,
      });
      message.success('PO created');
      setShowForm(false); form.resetFields();
      setItems([{ description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
      setDeliverySchedule([]);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Error'); }
  };

  // Delivery schedule helpers (mirrors complianceDates pattern in Vendors.jsx)
  const addDeliveryMilestone = () => setDeliverySchedule([...deliverySchedule, { milestone: '', date: null, quantity_percent: null }]);
  const removeDeliveryMilestone = (i) => setDeliverySchedule(deliverySchedule.filter((_, idx) => idx !== i));
  const updateDeliveryMilestone = (i, field, value) => setDeliverySchedule(deliverySchedule.map((d, idx) => idx === i ? { ...d, [field]: value } : d));

  const updateItem = (i, field, value) => {
    setItems(items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (['quantity', 'unit_price', 'tax_percent'].includes(field)) {
        updated.amount = (updated.quantity || 0) * (updated.unit_price || 0);
        updated.tax_amount = updated.amount * ((updated.tax_percent || 0) / 100);
        updated.total_line_amount = updated.amount + updated.tax_amount;
      }
      return updated;
    }));
  };

  const addItem = () => setItems([...items, { description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const columns = [
    { title: 'PO Number', dataIndex: 'po_number', width: 120, fixed: 'left', sorter: (a, b) => String(a.po_number || '').localeCompare(String(b.po_number || ''), undefined, { numeric: true }) },
    { title: 'Source PR', dataIndex: 'pr_number', width: 110, render: v => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>, sorter: (a, b) => String(a.pr_number || '').localeCompare(String(b.pr_number || ''), undefined, { numeric: true }) },
    { title: 'Source RFQ', dataIndex: 'rfq_number', width: 110, render: v => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>, sorter: (a, b) => String(a.rfq_number || '').localeCompare(String(b.rfq_number || ''), undefined, { numeric: true }) },
    { title: 'PO Date', dataIndex: 'po_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : <Text type="secondary">—</Text>, sorter: (a, b) => new Date(a.po_date || 0) - new Date(b.po_date || 0) },
    { title: 'Vendor', dataIndex: 'vendor_id', width: 180, ellipsis: true, render: v => vendors.find(x => x.id === v)?.vendor_name || v, sorter: (a, b) => String(vendors.find(x => x.id === a.vendor_id)?.vendor_name || '').localeCompare(String(vendors.find(x => x.id === b.vendor_id)?.vendor_name || '')) },
    { title: 'Buyer', dataIndex: 'buyer_name', width: 140, ellipsis: true, render: v => v || <Text type="secondary">—</Text>, sorter: (a, b) => String(a.buyer_name || '').localeCompare(String(b.buyer_name || '')) },
    { title: 'GSTIN', dataIndex: 'gstin', width: 140, render: v => v || <Text type="secondary">—</Text> },
    { title: 'Amount', dataIndex: 'total_amount', width: 130, align: 'right', render: v => `₹${Number(v || 0).toLocaleString()}`, sorter: (a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0) },
    { title: 'Validity', dataIndex: 'validity_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : <Text type="secondary">—</Text>, sorter: (a, b) => new Date(a.validity_date || 0) - new Date(b.validity_date || 0) },
    { title: 'Incoterms', dataIndex: 'incoterms', width: 100, render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Cost Center', dataIndex: 'cost_center', width: 120, render: v => v || <Text type="secondary">—</Text>,
      sorter: (a, b) => String(a.cost_center || '').localeCompare(String(b.cost_center || '')),
    },
    {
      title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={PO_STATUS_COLOR[v] || 'default'}>{v?.replace(/_/g, ' ')}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: Object.keys(PO_STATUS_COLOR).map(v => ({ text: v.replace(/_/g, ' ').toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Company', dataIndex: 'company_name', width: 140, ellipsis: true,
      render: (v, row) => (
        <Space size={4}>
          {v || <Text type="secondary">—</Text>}
          <InactiveCompanyBadge show={row.company_is_active === false} />
        </Space>
      ),
    },
    {
      title: 'Actions', key: 'action', width: 140, fixed: 'right',
      render: (_, po) => (
        <Space>
          <Button size="small" icon={<ZoomInOutlined />} title="View" onClick={() => openPoDetail(po)} />
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadPoPdf(po)}>PDF</Button>
        </Space>
      ),
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedPo) {
    const po = selectedPo;
    const hasPendingAmendment = po.amendment_status === 'pending_approval';

    const overviewTab = (
      <Row gutter={[16, 16]}>
        <Col span={6}><Card size="small"><Text type="secondary">Vendor</Text><br /><Text strong>{vendors.find(v => v.id === po.vendor_id)?.vendor_name || po.vendor_id}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">PO Date</Text><br /><Text strong>{po.po_date ? dayjs(po.po_date).format('DD-MM-YYYY') : '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Validity Date</Text><br /><Text strong>{po.validity_date ? dayjs(po.validity_date).format('DD-MM-YYYY') : '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Total Amount</Text><br /><Text strong>₹{Number(po.total_amount || 0).toLocaleString()}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Terms of Payment</Text><br /><Text strong>{po.terms_of_payment || '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Incoterms</Text><br /><Text strong>{po.incoterms || '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Cost Center</Text><br /><Text strong>{po.cost_center || '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Retention %</Text><br /><Text strong>{po.retention_percentage != null ? `${po.retention_percentage}%` : '—'}</Text></Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Source PR</Text><br />{po.pr_number ? <Tag color="purple">{po.pr_number}</Tag> : <Text type="secondary">—</Text>}</Card></Col>
        <Col span={6}><Card size="small"><Text type="secondary">Source RFQ</Text><br />{po.rfq_number ? <Tag color="blue">{po.rfq_number}</Tag> : <Text type="secondary">—</Text>}</Card></Col>
      </Row>
    );

    const lineItemsTab = (
      <Table
        size="small" pagination={false} rowKey="id" dataSource={po.line_items || []}
        columns={[
          { title: '#', dataIndex: 'line_number', width: 50 },
          { title: 'Description', dataIndex: 'description' },
          { title: 'HSN/SAC', dataIndex: 'hsn_sac', width: 100, render: v => v || <Text type="secondary">—</Text> },
          { title: 'Qty', dataIndex: 'quantity', width: 90 },
          { title: 'Unit Price', dataIndex: 'unit_price', width: 110, render: v => `₹${Number(v).toLocaleString()}` },
          { title: 'Tax %', dataIndex: 'tax_percent', width: 80, render: v => v != null ? `${v}%` : '—' },
          { title: 'Total', dataIndex: 'total_line_amount', width: 120, render: (v, r) => `₹${Number(v ?? r.amount).toLocaleString()}` },
          { title: 'Fulfilled', dataIndex: 'fulfilled_quantity', width: 90, render: v => Number(v || 0) },
        ]}
      />
    );

    const versionsTab = versionsLoading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div> : !poVersions ? <Empty description="No version history" /> : (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Row gutter={16}>
          <Col span={6}><Card size="small"><Statistic title="Current Version" value={poVersions.po.version} /></Card></Col>
        </Row>
        <Table
          size="small" pagination={false} rowKey="id"
          dataSource={(poVersions.versions || []).slice().reverse()}
          columns={[
            { title: 'Version', dataIndex: 'version_number', width: 80 },
            { title: 'Status', dataIndex: 'status', width: 130, render: v => <Tag color={VERSION_STATUS_COLOR[v]}>{v?.replace('_', ' ').toUpperCase()}</Tag> },
            { title: 'Change Log', key: 'change_log', render: (_, r) => {
              const lines = formatChangeLog(r.change_log);
              return lines.length === 0 ? <Text type="secondary">Baseline</Text> : <Space direction="vertical" size={0}>{lines.map((l, i) => <Text key={i} style={{ fontSize: 12 }}>{l}</Text>)}</Space>;
            } },
            { title: 'Reason', dataIndex: 'change_reason', render: v => v || <Text type="secondary">—</Text> },
            { title: 'Requested', dataIndex: 'requested_at', width: 150, render: v => v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '—' },
            { title: 'Decided', dataIndex: 'decided_at', width: 150, render: v => v ? dayjs(v).format('DD-MM-YYYY HH:mm') : <Text type="secondary">—</Text> },
            {
              title: 'Actions', key: 'actions', width: 160,
              render: (_, r) => r.status === 'pending_approval' ? (
                <Space>
                  <Button size="small" type="primary" icon={<CheckOutlined />} loading={versionActionLoading} onClick={() => handleApproveVersion(r.id)}>Approve</Button>
                  <Button size="small" danger icon={<CloseOutlined />} loading={versionActionLoading} onClick={() => handleRejectVersion(r.id)}>Reject</Button>
                </Space>
              ) : null,
            },
          ]}
        />
      </Space>
    );

    return (
      <div style={{ padding: '24px' }}>
        {/* Sticky summary header — same decision-first pattern as PR/RFQ
            Detail (§4.10): PO number/vendor, PDF/Amend CTAs stay visible
            while the tabs below scroll. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
          <PageHeader
            items={[{ title: 'Procurement' }, { title: 'Purchase Orders', onClick: goBackFromDetail }, { title: po.po_number }]}
            title={po.po_number}
            subtitle={vendors.find(v => v.id === po.vendor_id)?.vendor_name}
            onBack={goBackFromDetail}
            extra={
              <Space>
                <Button icon={<FilePdfOutlined />} onClick={() => downloadPoPdf(po)}>PDF</Button>
                <Button icon={<EditOutlined />} disabled={hasPendingAmendment} onClick={openAmendPanel}>Amend PO</Button>
              </Space>
            }
          />
        </div>

        {hasPendingAmendment && (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning" showIcon
            message="An amendment is pending approval"
            description="A different user must approve or reject it from the Versions tab before another amendment can be proposed."
          />
        )}

        <InlineExpandPanel
          open={amendPanelOpen}
          title="Propose PO Amendment"
          description="Changes are applied only after a different user approves them from the Versions tab. GST/HSN format is re-validated at approval time."
          submitText="Propose Amendment"
          loading={amending}
          onCancel={() => setAmendPanelOpen(false)}
          onSubmit={handleProposeAmendment}
        >
          <Title level={5} style={{ marginTop: 0 }}>Commercial Terms</Title>
          <Row gutter={16}>
            <Col span={6}><Form.Item label="Validity Date"><DatePicker style={{ width: '100%' }} value={amendHeader.validity_date} onChange={v => setAmendHeader(h => ({ ...h, validity_date: v }))} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Terms of Payment"><Input value={amendHeader.terms_of_payment} onChange={e => setAmendHeader(h => ({ ...h, terms_of_payment: e.target.value }))} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Incoterms"><Select allowClear value={amendHeader.incoterms} onChange={v => setAmendHeader(h => ({ ...h, incoterms: v }))} options={(subMasters.incoterms || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Retention %"><InputNumber style={{ width: '100%' }} min={0} max={100} value={amendHeader.retention_percentage} onChange={v => setAmendHeader(h => ({ ...h, retention_percentage: v }))} /></Form.Item></Col>
          </Row>

          <Title level={5}>Line Items</Title>
          <Table
            size="small" pagination={false} rowKey="id" dataSource={amendLineInputs}
            columns={[
              { title: 'Description', dataIndex: 'description' },
              { title: 'HSN/SAC', key: 'hsn', width: 110, render: (_, r, i) => <Input size="small" value={r.hsn_sac} onChange={e => updateAmendLine(i, 'hsn_sac', e.target.value)} /> },
              { title: 'Qty', key: 'qty', width: 90, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.quantity} onChange={v => updateAmendLine(i, 'quantity', v)} /> },
              { title: 'Unit Price', key: 'price', width: 110, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.unit_price} onChange={v => updateAmendLine(i, 'unit_price', v)} /> },
              { title: 'Tax %', key: 'tax', width: 90, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} max={100} value={r.tax_percent} onChange={v => updateAmendLine(i, 'tax_percent', v)} /> },
            ]}
            style={{ marginBottom: 16 }}
          />
          <Input.TextArea rows={2} placeholder="Change reason (required)" value={amendReason} onChange={e => setAmendReason(e.target.value)} status={!amendReason.trim() ? 'warning' : undefined} />
        </InlineExpandPanel>

        <Row gutter={16}>
          <Col span={18}>
            <Tabs
              activeKey={activeDetailTab}
              onChange={onDetailTabChange}
              type="card"
              loading={poDetailLoading}
              items={[
                { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: overviewTab },
                { key: 'items', label: 'Line Items', children: lineItemsTab },
                { key: 'versions', label: <span><HistoryOutlined /> Versions{po.version > 1 ? <Tag color="purple" style={{ marginLeft: 6 }}>v{po.version}</Tag> : null}</span>, children: versionsTab },
              ]}
            />
          </Col>
          <Col span={6}>
            <DecisionPanel entityType="po" entityId={po.id} sticky />
          </Col>
        </Row>
      </div>
    );
  }

  const poListActions = (
    <Space>
      <Button icon={<FileTextOutlined />} onClick={openSourceModal}>Create PO from PR/RFQ</Button>
      {!poRequirePrReference && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>Create PO</Button>
      )}
    </Space>
  );

  return (
    <div style={{ paddingBottom: showForm ? 0 : undefined }}>
      {!showForm ? (
        uiImprovementsEnabled ? (
          <PageHeader
            items={[{ title: 'Procurement' }, { title: 'Purchase Orders' }]}
            title="Purchase Orders"
            subtitle="Create and manage Purchase Orders with buyer details, line items, and tax calculations."
            extra={poListActions}
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Title level={4} style={{ margin: 0 }}>Purchase Orders</Title>
              {poListActions}
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Create and manage Purchase Orders with buyer details, line items, and tax calculations.</Text>
          </>
        )
      ) : uiImprovementsEnabled ? (
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Purchase Orders' }]}
          title="Create Purchase Order"
          onBack={() => setShowForm(false)}
        />
      ) : (
        <Row align="middle" style={{ marginBottom: 16 }}>
          <Col><Button icon={<ArrowLeftOutlined />} onClick={() => setShowForm(false)} style={{ marginRight: 12 }}>Back</Button></Col>
          <Col flex="auto"><Title level={4} style={{ margin: 0 }}>Create Purchase Order</Title></Col>
        </Row>
      )}

      {!showForm ? (
        <>
          <InlineExpandPanel
            open={sourceModalOpen}
            title="Create PO from PR / RFQ"
            onCancel={() => setSourceModalOpen(false)}
            onSubmit={handleCreateFromSource}
            submitText="Create PO(s)"
            loading={creatingFromSource}
          >
            <Form layout="vertical">
              <Form.Item label="Source Document">
                <Radio.Group value={sourceType} onChange={e => handleSourceTypeChange(e.target.value)}>
                  <Radio.Button value="PR">Purchase Requisition</Radio.Button>
                  <Radio.Button value="RFQ">RFQ (Award)</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {sourceType === 'PR' && (
                <Alert
                  type="info" showIcon style={{ marginBottom: 16 }}
                  message="Only approved/sourcing requisitions with DIRECT_PO_ALLOWED, AUTO_PO, or CONTRACT_BASED sourcing can be used here."
                  description="A requisition that isn't eligible yet shows up below, grayed out, with the reason."
                />
              )}
              <Form.Item label={sourceType === 'PR' ? 'Select Requisition' : 'Select RFQ (closed)'} required>
                <Select
                  showSearch placeholder={sourceType === 'PR' ? 'Select an eligible requisition' : 'Select a closed RFQ'} optionFilterProp="label"
                  value={selectedSourceId} onChange={handleSelectSource}
                  options={sourceType === 'PR'
                    ? sourceRecords.map(p => {
                        const reason = prSourceReason(p);
                        return { value: p.id, disabled: !prSourceEligible(p), label: `${p.pr_number} — ${p.department} (${reason || p.sourcing_strategy})` };
                      })
                    : sourceRecords.map(r => ({ value: r.id, label: `${r.rfq_number} — ${r.title}` }))}
                />
              </Form.Item>
              {selectedSourceId && (
                sourceLines.length === 0 ? <Empty description="No remaining quantity available" /> : (
                  <Table
                    size="small" pagination={false} rowKey="id" dataSource={sourceLines}
                    columns={[
                      { title: '', width: 36, render: (_, row) => <Checkbox checked={row.selected} onChange={e => toggleSourceLine(row.id, e.target.checked)} /> },
                      { title: 'Line', dataIndex: 'description' },
                      { title: 'Remaining', dataIndex: 'max', width: 90, render: v => Number(v).toLocaleString() },
                      { title: 'Qty', width: 100, render: (_, row) => <InputNumber size="small" style={{ width: '100%' }} min={0.001} max={row.max} disabled={!row.selected} value={row.quantity} onChange={v => updateSourceLine(row.id, 'quantity', v)} /> },
                      { title: 'Unit Price', width: 110, render: (_, row) => <InputNumber size="small" style={{ width: '100%' }} min={0} disabled={!row.selected} value={row.unit_price} onChange={v => updateSourceLine(row.id, 'unit_price', v)} /> },
                      {
                        title: 'Vendor', width: 180,
                        render: (_, row) => (
                          <Select
                            size="small" style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" disabled={!row.selected}
                            placeholder={sourceType === 'PR' ? 'Default (from PR)' : 'Select vendor'}
                            value={row.vendor_id || undefined} onChange={v => updateSourceLine(row.id, 'vendor_id', v)}
                            options={(sourceType === 'RFQ' && sourceRfqVendors ? sourceRfqVendors : vendors).map(v => ({ value: v.id, label: v.vendor_name }))}
                          />
                        ),
                      },
                    ]}
                  />
                )
              )}
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                {sourceType === 'PR'
                  ? 'Assigning different vendors per line creates one PO per vendor. Leave vendor blank to use the requisition\'s default (preferred vendor / contract vendor).'
                  : 'Splitting a line across multiple vendors requires awarding it in separate rows — use the RFQ\'s own Award tab for that. Here, one vendor per line creates one PO per vendor.'}
              </Text>
            </Form>
          </InlineExpandPanel>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={12} align="middle">
              <Col flex="1"><Input placeholder="PO Number" value={filterPoNumber} onChange={e => setFilterPoNumber(e.target.value)} allowClear /></Col>
              <Col>
                <Select placeholder="Status" value={filterStatus} onChange={v => setFilterStatus(v)} allowClear style={{ width: 180 }}>
                  <Select.Option value="open">Open</Select.Option>
                  <Select.Option value="partially_fulfilled">Partially Fulfilled</Select.Option>
                  <Select.Option value="fulfilled">Fulfilled</Select.Option>
                  <Select.Option value="closed">Closed</Select.Option>
                </Select>
              </Col>
              <Col><Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData()}>Search</Button></Col>
              <Col><Button icon={<ClearOutlined />} onClick={() => { setFilterPoNumber(''); setFilterStatus(undefined); }}>Clear</Button></Col>
            </Row>
          </Card>
          <Table columns={columns} dataSource={data.filter(item => {
            let match = true;
            if (filterPoNumber) match = match && item.po_number?.toLowerCase().includes(filterPoNumber.toLowerCase());
            if (filterStatus) match = match && item.status === filterStatus;
            return match;
          })} rowKey="id" loading={loading} size="middle" scroll={{ x: 1540 }} />
        </>
      ) : (
        <div style={{ paddingBottom: 88 }}>
          <Form form={form} layout="vertical">
            <Card title="Buyer & PO Information" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="po_number" label="PO Number" rules={[{ required: isRequired('po_number', true), message: 'PO Number is required' }]}><Input placeholder="PO-2024-001" /></Form.Item></Col>
                <Col span={6}><Form.Item name="po_date" label="PO Date" rules={[{ required: isRequired('po_date', true), message: 'PO Date is required' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="vendor_id" label="Vendor (Supplier)" rules={[{ required: isRequired('vendor_id', true), message: 'Vendor is required' }]}>
                  <Select showSearch optionFilterProp="label" placeholder="Select vendor" options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
                </Form.Item></Col>
                <Col span={6}><Form.Item name="validity_date" label="PO Validity Date" rules={[{ required: isRequired('validity_date', false), message: 'PO Validity Date is required' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Form.Item name="buyer_name" label="Buyer Name" rules={[{ required: isRequired('buyer_name', false), message: 'Buyer Name is required' }]}><Input placeholder="Company buying goods" /></Form.Item></Col>
                <Col span={8}><Form.Item name="buyer_address" label="Buyer Address" rules={[{ required: isRequired('buyer_address', false), message: 'Buyer Address is required' }]}><Input placeholder="Full address" /></Form.Item></Col>
                <Col span={4}><Form.Item name="gstin" label="GSTIN" rules={[{ required: isRequired('gstin', false), message: 'GSTIN is required' }]}><Input placeholder="22AAAAA0000A1Z5" maxLength={15} /></Form.Item></Col>
                <Col span={4}><Form.Item name="state_name" label="State Name" rules={[{ required: isRequired('state_name', false), message: 'State Name is required' }]}><Input placeholder="Maharashtra" /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={4}><Form.Item name="state_code" label="State Code" rules={[{ required: isRequired('state_code', false), message: 'State Code is required' }]}><Input placeholder="27" maxLength={4} /></Form.Item></Col>
                <Col span={8}><Form.Item name="terms_of_payment" label="Terms of Payment" rules={[{ required: isRequired('terms_of_payment', false), message: 'Terms of Payment is required' }]}><Input placeholder="Net 30 days" /></Form.Item></Col>
              </Row>
            </Card>

            <Card title="Contract & Commercial Terms" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="contract_id" label="Contract ID" rules={[{ required: isRequired('contract_id', false), message: 'Contract ID is required' }]}><Input placeholder="Linked contract reference" /></Form.Item></Col>
                <Col span={6}><Form.Item name="incoterms" label="Incoterms" rules={[{ required: isRequired('incoterms', false), message: 'Incoterms is required' }]}><Select allowClear placeholder="Select Incoterms" options={(subMasters.incoterms || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
                <Col span={6}><Form.Item name="cost_center" label="Cost Center" rules={[{ required: isRequired('cost_center', false), message: 'Cost Center is required' }]}>
                  <Select allowClear showSearch placeholder="Select cost center" options={(subMasters.cost_center || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item></Col>
                <Col span={6}><Form.Item name="project_code" label="Project Code" rules={[{ required: isRequired('project_code', false), message: 'Project Code is required' }]}><Input placeholder="e.g. PRJ-2024-01" /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="budget_code" label="Budget Code" rules={[{ required: isRequired('budget_code', false), message: 'Budget Code is required' }]}><Input placeholder="e.g. BUD-2024-01" /></Form.Item></Col>
                <Col span={6}><Form.Item name="retention_percentage" label="Retention %" rules={[{ required: isRequired('retention_percentage', false), message: 'Retention % is required' }]}><InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" /></Form.Item></Col>
                <Col span={6}><Form.Item name="partial_delivery_allowed_flag" label=" " valuePropName="checked" initialValue={true}><Checkbox defaultChecked>Partial Delivery Allowed</Checkbox></Form.Item></Col>
              </Row>
            </Card>

            <Card title={<>Account Assignment <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(optional — aligned with Purchase Requisition fields)</Text></>} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="department" label="Department">
                  <Select allowClear showSearch placeholder="Select department" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item></Col>
                <Col span={6}><Form.Item name="account_assignment_category" label="Account Assignment"><Select allowClear options={(subMasters.account_assignment_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
                <Col span={6}><Form.Item name="company_code" label="Company Code">
                  <Select allowClear showSearch placeholder="Select company" options={(companies || []).map(c => ({ value: c.company_name, label: c.company_name }))} />
                </Form.Item></Col>
                <Col span={6}><Form.Item name="plant" label="Plant">
                  <Select allowClear showSearch placeholder="Select plant" options={(subMasters.plant || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item></Col>
              </Row>
            </Card>

            <Card title="Delivery Schedule" size="small" style={{ marginBottom: 16 }}>
              {deliverySchedule.map((d, i) => (
                <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
                  <Col span={10}><Input placeholder="Milestone (e.g. First Lot)" value={d.milestone} onChange={e => updateDeliveryMilestone(i, 'milestone', e.target.value)} /></Col>
                  <Col span={8}><DatePicker style={{ width: '100%' }} placeholder="Delivery date" value={d.date ? dayjs(d.date) : null} onChange={val => updateDeliveryMilestone(i, 'date', val)} /></Col>
                  <Col span={4}><InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="Qty %" value={d.quantity_percent} onChange={val => updateDeliveryMilestone(i, 'quantity_percent', val)} /></Col>
                  <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeDeliveryMilestone(i)} /></Col>
                </Row>
              ))}
              <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addDeliveryMilestone} block>Add Delivery Milestone</Button>
            </Card>

            <Card
              title="Purchase Lines"
              size="small"
              style={{ marginBottom: 16 }}
              extra={<Text type="secondary" style={{ fontSize: 13 }}>Total PO Value: <Text strong style={{ color: '#1890ff' }}>₹{Math.round(items.reduce((s, i) => s + (i.total_line_amount || 0), 0) * 100 / 100).toLocaleString()}</Text></Text>}
            >
              <div style={{ overflowX: 'auto' }}>
                <Row gutter={8} style={{ marginBottom: 8, minWidth: 1000 }}>
                  <Col span={4}><Text type="secondary" style={{ fontSize: 11 }}>Description</Text></Col>
                  <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>HSN/SAC</Text></Col>
                  <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Qty</Text></Col>
                  <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>UOM</Text></Col>
                  <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Unit Cost (₹)</Text></Col>
                  <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Amount (₹)</Text></Col>
                  <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Tax %</Text></Col>
                  <Col span={3}><Text type="secondary" style={{ fontSize: 11 }}>Tax (₹)</Text></Col>
                  <Col span={2}><Text type="secondary" style={{ fontSize: 11 }}>Total (₹)</Text></Col>
                  <Col span={1}></Col>
                </Row>
                {items.map((item, i) => (
                  <Row key={i} gutter={8} style={{ marginBottom: 8, minWidth: 1000 }} align="middle">
                    <Col span={4}><Input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} size="small" /></Col>
                    <Col span={2}><HsnDropdown value={item.hsn_sac || undefined} onChange={(val, option) => { updateItem(i, 'hsn_sac', val || ''); if (option?.tax_percentage != null) updateItem(i, 'tax_percent', option.tax_percentage); else if (!val) updateItem(i, 'tax_percent', 0); }} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={2}><InputNumber min={0} value={item.quantity} onChange={v => updateItem(i, 'quantity', v)} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={2}><Input placeholder="Nos" value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} size="small" /></Col>
                    <Col span={3}><InputNumber min={0} value={item.unit_price} onChange={v => updateItem(i, 'unit_price', v)} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={3}><InputNumber disabled value={item.amount} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={2}><InputNumber min={0} max={100} value={item.tax_percent} onChange={v => updateItem(i, 'tax_percent', v)} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={3}><InputNumber disabled value={Math.round(item.tax_amount * 100) / 100} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={2}><InputNumber disabled value={Math.round(item.total_line_amount * 100) / 100} size="small" style={{ width: '100%' }} /></Col>
                    <Col span={1}>{items.length > 1 && <Button icon={<DeleteOutlined />} danger size="small" onClick={() => removeItem(i)} />}</Col>
                  </Row>
                ))}
              </div>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} block style={{ marginTop: 8 }}>Add Line</Button>

              <Card size="small" style={{ marginTop: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                <Row gutter={24}>
                  <Col span={8}><Text>Subtotal: <Text strong>₹{items.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</Text></Text></Col>
                  <Col span={8}><Text>Total Tax: <Text strong>₹{Math.round(items.reduce((s, i) => s + (i.tax_amount || 0), 0) * 100 / 100).toLocaleString()}</Text></Text></Col>
                  <Col span={8}><Text>Total PO Value: <Text strong style={{ fontSize: 16, color: '#1890ff' }}>₹{Math.round(items.reduce((s, i) => s + (i.total_line_amount || 0), 0) * 100 / 100).toLocaleString()}</Text></Text></Col>
                </Row>
              </Card>
            </Card>
          </Form>
        </div>
      )}
      {showForm && (
        <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '16px 24px', margin: '0 -24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Space>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Create PO</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
