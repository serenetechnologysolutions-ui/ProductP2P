import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Form, Input, InputNumber, DatePicker, Select, Tag, Space, Row, Col, Card, Typography, Divider, Steps, Upload, Checkbox, message, Alert } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, CheckOutlined, CloseOutlined, SendOutlined, EditOutlined, SaveOutlined, UploadOutlined, AuditOutlined, FileProtectOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { DOCUMENT_INTELLIGENCE_URL } from '../config';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import InactiveCompanyBadge from '../components/InactiveCompanyBadge';

const { Title, Text } = Typography;
const STATUS_COLOR = { draft: 'default', submitted: 'blue', validated: 'orange', posted: 'green', rejected: 'red' };
const STATUS_LABEL = { draft: 'DRAFT', submitted: 'INITIATED', validated: 'VALIDATED', posted: 'POSTED', rejected: 'REJECTED' };
const MATCH_STATUS_COLOR = { matched: 'green', mismatched: 'red', pending: 'default' };

// Field names that live on each wizard step's <Form.Item>s — validated before allowing
// the wizard to advance, so a step with an unfilled mandatory field can't be skipped.
const STEP_FIELDS = [
  ['po_id'],
  ['invoice_number', 'eta', 'total_amount', 'lr_number', 'transporter_name', 'driver_name',
    'driver_number', 'additional_info1', 'additional_info2', 'additional_info3', 'additional_info4', 'remarks',
    'shipment_mode', 'vehicle_number', 'eway_bill_number', 'dispatch_date', 'actual_delivery_date',
    'invoice_currency', 'exchange_rate', 'freight_charges', 'cgst_amount', 'sgst_amount', 'igst_amount'],
  [],
];

export default function ASNs() {
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [view, setView] = useState('list'); // list | detail | create | edit
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [pos, setPos] = useState([]);
  const [poLines, setPoLines] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [extractionResults, setExtractionResults] = useState([]);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchStatus, setMatchStatus] = useState('matched');
  const [matchDiscrepancyFlag, setMatchDiscrepancyFlag] = useState(false);
  const [matchDiscrepancyReason, setMatchDiscrepancyReason] = useState('');
  const { isRequired } = useFieldConfig('asn');
  const [subMasters, setSubMasters] = useState({ shipment_mode: [], currency: [] });

  // GRN (Goods Receipt Note) + Invoice — the formal stages between ASN
  // validation and ERP posting (see asn/grn.service.js, asn/invoice.service.js).
  const [grn, setGrn] = useState(null);
  const [grnLoading, setGrnLoading] = useState(false);
  const [grnPanelOpen, setGrnPanelOpen] = useState(false);
  const [grnReceivedDate, setGrnReceivedDate] = useState(null);
  const [grnRemarks, setGrnRemarks] = useState('');
  const [grnLineInputs, setGrnLineInputs] = useState([]);
  const [grnSaving, setGrnSaving] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceCreating, setInvoiceCreating] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await api.get('/asns', { params: { page, limit: pageSize } });
      setData(res.data.data);
      setPagination({ current: page, pageSize, total: res.data.pagination.total });
    } catch (_) { message.error('Failed to load ASNs'); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    (async () => {
      const cats = ['shipment_mode', 'currency'];
      const results = {};
      for (const cat of cats) {
        try { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; } catch { results[cat] = []; }
      }
      setSubMasters(results);
    })();
  }, []);

  const fetchPOs = async () => {
    try { const res = await api.get('/purchase-orders'); setPos(res.data.data || []); } catch (_) {}
  };

  const handlePOChange = async (poId) => {
    try {
      const res = await api.get(`/purchase-orders/${poId}`);
      const lines = res.data.data.line_items || [];
      setPoLines(lines);
      setLineItems(lines.map(l => ({
        po_line_id: l.id,
        description: l.description,
        quantity: 0,
        amount: 0,
        max_qty: l.available_quantity != null ? l.available_quantity : (l.quantity - (l.consumed_quantity || l.fulfilled_quantity || 0)),
      })));
    } catch (_) { setPoLines([]); setLineItems([]); }
  };

  const openCreate = () => {
    form.resetFields();
    setLineItems([]);
    setPoLines([]);
    setCurrentStep(0);
    setInvoicePdfUrl(null);
    fetchPOs();
    setView('create');
  };

  const openEdit = () => {
    form.setFieldsValue({
      ...selected,
      eta: selected.eta ? dayjs(selected.eta) : null,
      dispatch_date: selected.dispatch_date ? dayjs(selected.dispatch_date) : null,
      actual_delivery_date: selected.actual_delivery_date ? dayjs(selected.actual_delivery_date) : null,
    });
    fetchPOs();
    setLineItems(selected.line_items?.map(l => ({ po_line_id: l.po_line_id, description: l.description || l.po_description, quantity: l.quantity, amount: l.amount, max_qty: 9999 })) || []);
    setCurrentStep(0);
    setView('edit');
  };

  const openDetail = async (record, autoOpenGrn = false) => {
    let asn = record;
    try { const res = await api.get(`/asns/${record.id}`); asn = res.data.data; setSelected(asn); } catch (_) { setSelected(record); }
    setView('detail');
    fetchGrn(asn.id);
    fetchInvoice(asn.id);
    if (autoOpenGrn) openGrnPanel(asn);
  };

  const goBack = () => { setView('list'); setSelected(null); setGrn(null); setInvoice(null); };

  const fetchGrn = async (asnId) => {
    setGrnLoading(true);
    try { const res = await api.get(`/asns/${asnId}/grn`); setGrn(res.data.data); } catch (_) { setGrn(null); }
    setGrnLoading(false);
  };

  const fetchInvoice = async (asnId) => {
    setInvoiceLoading(true);
    try { const res = await api.get(`/asns/${asnId}/invoice`); setInvoice(res.data.data); } catch (_) { setInvoice(null); }
    setInvoiceLoading(false);
  };

  const openGrnPanel = async (asnOverride) => {
    let source = asnOverride || selected;
    if (!source || !source.id) { message.warning('Please select an ASN first'); return; }
    // Always fetch fresh detail to ensure line_items are loaded
    try {
      const res = await api.get(`/asns/${source.id}`);
      source = res.data.data;
      setSelected(source);
    } catch (err) { message.error('Failed to load ASN details'); return; }
    setGrnReceivedDate(dayjs());
    setGrnRemarks('');
    setGrnLineInputs((source.line_items || []).map(li => ({
      asn_line_item_id: li.id,
      description: li.description || li.po_description,
      shipped_quantity: Number(li.quantity),
      received_quantity: Number(li.quantity),
      rejected_quantity: 0,
      rejection_reason: '',
    })));
    setGrnPanelOpen(true);
  };

  const updateGrnLine = (i, field, value) => setGrnLineInputs(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const handleSaveGrn = async () => {
    if (!grnReceivedDate) { message.error('Received Date is required'); return; }
    const missingReason = grnLineInputs.find(r => Number(r.rejected_quantity) > 0 && !r.rejection_reason.trim());
    if (missingReason) { message.error(`Rejection reason is required for "${missingReason.description}"`); return; }
    setGrnSaving(true);
    try {
      const res = await api.post(`/asns/${selected.id}/grn`, {
        received_date: grnReceivedDate.format('YYYY-MM-DD'),
        remarks: grnRemarks || undefined,
        line_items: grnLineInputs.map(r => ({
          asn_line_item_id: r.asn_line_item_id,
          received_quantity: r.received_quantity,
          rejected_quantity: r.rejected_quantity || 0,
          rejection_reason: r.rejection_reason || undefined,
        })),
      });
      message.success(res.data.data.status === 'exception' ? 'GRN created — tolerance exceeded on one or more lines' : 'GRN created');
      setGrnPanelOpen(false);
      fetchGrn(selected.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create GRN'); }
    setGrnSaving(false);
  };

  const handleCreateInvoice = async () => {
    setInvoiceCreating(true);
    try {
      const res = await api.post(`/asns/${selected.id}/invoice`);
      message[res.data.data.match_status === 'blocked' ? 'warning' : 'success'](
        res.data.data.match_status === 'blocked' ? 'Invoice created — blocked on 3-way match' : 'Invoice created and matched'
      );
      fetchInvoice(selected.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create invoice'); }
    setInvoiceCreating(false);
  };

  // Deep-link support — e.g. the Control Tower's "View Source" action lands
  // here as /asns?id=<asn_id> and should jump straight to that record.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) openDetail({ id: deepLinkId });
  }, []);

  const handleSaveASN = async () => {
    try {
      const values = form.getFieldsValue(true);
      if (!values.po_id) { message.error('Select a Purchase Order'); setCurrentStep(0); return; }
      if (!values.invoice_number || !values.eta || !values.total_amount || !values.lr_number || !values.transporter_name || !values.driver_name) {
        message.error('Fill all mandatory fields in Step 2'); setCurrentStep(1); return;
      }
      const validLines = lineItems.filter(l => l.quantity > 0);
      if (validLines.length === 0) { message.error('Add at least one line item with quantity > 0'); setCurrentStep(3); return; }

      const payload = {
        po_id: values.po_id,
        eta: values.eta.format('YYYY-MM-DD'),
        invoice_number: values.invoice_number,
        total_amount: values.total_amount,
        lr_number: values.lr_number,
        transporter_name: values.transporter_name,
        driver_name: values.driver_name,
        driver_number: values.driver_number || null,
        remarks: values.remarks || null,
        line_items: validLines.map(l => ({ po_line_id: l.po_line_id, description: l.description, quantity: l.quantity, amount: l.amount })),
        shipment_mode: values.shipment_mode || null,
        vehicle_number: values.vehicle_number || null,
        eway_bill_number: values.eway_bill_number || null,
        dispatch_date: values.dispatch_date ? values.dispatch_date.format('YYYY-MM-DD') : null,
        actual_delivery_date: values.actual_delivery_date ? values.actual_delivery_date.format('YYYY-MM-DD') : null,
        invoice_currency: values.invoice_currency || 'INR',
        exchange_rate: values.exchange_rate ?? 1,
        cgst_amount: values.cgst_amount ?? 0,
        sgst_amount: values.sgst_amount ?? 0,
        igst_amount: values.igst_amount ?? 0,
        freight_charges: values.freight_charges ?? 0,
      };

      if (view === 'edit') {
        // For edit, we'd need a PUT endpoint — for now just show message
        message.info('ASN update not yet supported via API. Submit the ASN instead.');
      } else {
        await api.post('/asns', payload);
        message.success('ASN created successfully');
      }
      goBack();
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to save ASN'); }
  };

  const handleAction = async (action) => {
    try {
      if (action === 'reject') {
        if (!rejectReason.trim()) { message.error('Rejection reason is required'); return; }
        await api.post(`/asns/${selected.id}/${action}`, { reason: rejectReason });
        setRejectModalOpen(false);
        setRejectReason('');
      } else {
        await api.post(`/asns/${selected.id}/${action}`);
      }
      message.success(`ASN ${action} successful`);
      const res = await api.get(`/asns/${selected.id}`);
      setSelected(res.data.data);
      fetchData(pagination.current, pagination.pageSize);
    } catch (err) { message.error(err.response?.data?.error || 'Action failed'); }
  };

  const openMatchModal = () => {
    setMatchStatus(selected.three_way_match_status || 'matched');
    setMatchDiscrepancyFlag(!!selected.discrepancy_flag);
    setMatchDiscrepancyReason(selected.discrepancy_reason || '');
    setMatchModalOpen(true);
  };

  const handleThreeWayMatch = async () => {
    try {
      await api.put(`/asns/${selected.id}/three-way-match`, {
        three_way_match_status: matchStatus,
        discrepancy_flag: matchDiscrepancyFlag,
        discrepancy_reason: matchDiscrepancyReason || null,
      });
      message.success('Three-way match status updated');
      setMatchModalOpen(false);
      const res = await api.get(`/asns/${selected.id}`);
      setSelected(res.data.data);
      fetchData(pagination.current, pagination.pageSize);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to update match status'); }
  };

  const goToNextStep = async () => {
    try {
      await form.validateFields(STEP_FIELDS[currentStep]);
      setCurrentStep(s => s + 1);
    } catch {
      message.error('Please fill all mandatory fields on this step before continuing');
    }
  };

  // Steps indicator: always allow jumping back to review a previous step, but
  // jumping ahead must go through goToNextStep so mandatory fields get checked.
  const handleStepsChange = (target) => { if (target < currentStep) setCurrentStep(target); };

  const updateLineItem = (i, field, value) => {
    setLineItems(lineItems.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity') updated.amount = value * (poLines[i]?.unit_price || 0);
      return updated;
    }));
  };

  // ─── DETAIL VIEW ───
  if (view === 'detail' && selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>{selected.asn_number}</Title>
            <Tag color={STATUS_COLOR[selected.status]}>{STATUS_LABEL[selected.status] || selected.status?.toUpperCase()}</Tag>
          </Space>
          <Space>
            {user.role === 'vendor' && selected.status === 'draft' && <Button icon={<EditOutlined />} onClick={openEdit}>Edit</Button>}
            {user.role === 'vendor' && selected.status === 'draft' && <Button type="primary" onClick={() => handleAction('submit')}>Submit ASN</Button>}
            {user.role !== 'vendor' && selected.status === 'submitted' && <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAction('validate')}>Validate</Button>}
            {user.role !== 'vendor' && selected.status === 'submitted' && <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalOpen(o => !o)}>Reject</Button>}
            {user.role !== 'vendor' && selected.status === 'validated' && !grn && <Button icon={<FileProtectOutlined />} onClick={() => openGrnPanel(selected)}>Create GRN</Button>}
            {user.role !== 'vendor' && grn && !invoice && <Button icon={<FileTextOutlined />} loading={invoiceCreating} onClick={handleCreateInvoice}>Create Invoice</Button>}
            {user.role !== 'vendor' && selected.status === 'validated' && <Button type="primary" icon={<SendOutlined />} style={{ background: '#52c41a' }} onClick={() => handleAction('post')}>Post to ERP</Button>}
            {user.role === 'procurement_admin' && <Button icon={<AuditOutlined />} onClick={() => (matchModalOpen ? setMatchModalOpen(false) : openMatchModal())}>3-Way Match</Button>}
          </Space>
        </div>

        <InlineExpandPanel
          open={rejectModalOpen}
          title="Reject ASN"
          description="Please provide a reason for rejecting this ASN."
          submitText="Reject"
          submitDanger
          onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
          onSubmit={() => handleAction('reject')}
        >
          <Input.TextArea rows={3} placeholder="Enter rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </InlineExpandPanel>

        <InlineExpandPanel
          open={matchModalOpen}
          title="3-Way Match — PO vs ASN vs Invoice"
          onCancel={() => setMatchModalOpen(false)}
          onSubmit={handleThreeWayMatch}
          submitText="Save"
        >
          <Form layout="vertical">
            <Form.Item label="Match Status">
              <Select value={matchStatus} onChange={setMatchStatus} options={[
                { value: 'matched', label: 'Matched' },
                { value: 'mismatched', label: 'Mismatched' },
                { value: 'pending', label: 'Pending' },
              ]} />
            </Form.Item>
            <Form.Item>
              <Checkbox checked={matchDiscrepancyFlag} onChange={e => setMatchDiscrepancyFlag(e.target.checked)}>Discrepancy Found</Checkbox>
            </Form.Item>
            <Form.Item label="Discrepancy Reason">
              <Input.TextArea rows={3} placeholder="Describe the discrepancy (if any)" value={matchDiscrepancyReason} onChange={e => setMatchDiscrepancyReason(e.target.value)} />
            </Form.Item>
          </Form>
        </InlineExpandPanel>

        <InlineExpandPanel
          open={grnPanelOpen}
          title="Create Goods Receipt Note"
          description="Capture what was actually received and inspected per line. A line deviating from the shipped quantity by more than the configured tolerance, or with any rejected quantity, will flag the GRN for exception review and block ERP posting until resolved."
          submitText="Create GRN"
          loading={grnSaving}
          onCancel={() => setGrnPanelOpen(false)}
          onSubmit={handleSaveGrn}
        >
          <Form.Item label="Received Date" required>
            <DatePicker style={{ width: 240 }} value={grnReceivedDate} onChange={setGrnReceivedDate} />
          </Form.Item>
          <Table
            size="small"
            pagination={false}
            rowKey="asn_line_item_id"
            dataSource={grnLineInputs}
            columns={[
              { title: 'Description', dataIndex: 'description' },
              { title: 'Shipped', dataIndex: 'shipped_quantity', width: 90 },
              {
                title: 'Received', key: 'received', width: 110,
                render: (_, r, i) => <InputNumber min={0} style={{ width: '100%' }} value={r.received_quantity} onChange={v => updateGrnLine(i, 'received_quantity', v)} />,
              },
              {
                title: 'Rejected', key: 'rejected', width: 110,
                render: (_, r, i) => <InputNumber min={0} max={r.received_quantity} style={{ width: '100%' }} value={r.rejected_quantity} onChange={v => updateGrnLine(i, 'rejected_quantity', v)} />,
              },
              { title: 'Accepted', key: 'accepted', width: 90, render: (_, r) => Math.max(0, Number(r.received_quantity || 0) - Number(r.rejected_quantity || 0)) },
              {
                title: 'Rejection Reason', key: 'reason',
                render: (_, r, i) => <Input placeholder={Number(r.rejected_quantity) > 0 ? 'Required' : 'Not applicable'} disabled={!r.rejected_quantity} value={r.rejection_reason} onChange={e => updateGrnLine(i, 'rejection_reason', e.target.value)} />,
              },
            ]}
            style={{ marginBottom: 16 }}
          />
          <Input.TextArea rows={2} placeholder="Remarks (optional)" value={grnRemarks} onChange={e => setGrnRemarks(e.target.value)} />
        </InlineExpandPanel>

        <Row gutter={[16, 16]}>
          <Col span={8}><Card size="small"><Text type="secondary">PO Number</Text><br /><Text strong>{selected.po_number || '—'}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">Invoice Number</Text><br /><Text strong>{selected.invoice_number}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">Total Amount</Text><br /><Text strong>₹{Number(selected.total_amount || 0).toLocaleString()}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">ETA</Text><br /><Text strong>{selected.eta ? dayjs(selected.eta).format('DD-MM-YYYY') : '—'}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">Transporter</Text><br /><Text strong>{selected.transporter_name}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">Driver</Text><br /><Text strong>{selected.driver_name}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">LR Number</Text><br /><Text strong>{selected.lr_number}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">ERP Status</Text><br /><Text strong>{selected.erp_posting_status || '—'}</Text></Card></Col>
          <Col span={8}><Card size="small"><Text type="secondary">Vendor</Text><br /><Text strong>{selected.vendor_name || '—'}</Text></Card></Col>
        </Row>
        <Card title="Shipment &amp; Tax Details" size="small" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}><Text type="secondary">Shipment Mode</Text><br /><Text strong>{selected.shipment_mode ? selected.shipment_mode.toUpperCase() : '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Vehicle Number</Text><br /><Text strong>{selected.vehicle_number || '—'}</Text></Col>
            <Col span={6}><Text type="secondary">E-Way Bill Number</Text><br /><Text strong>{selected.eway_bill_number || '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Dispatch Date</Text><br /><Text strong>{selected.dispatch_date ? dayjs(selected.dispatch_date).format('DD-MM-YYYY') : '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Actual Delivery Date</Text><br /><Text strong>{selected.actual_delivery_date ? dayjs(selected.actual_delivery_date).format('DD-MM-YYYY') : '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Invoice Currency</Text><br /><Text strong>{selected.invoice_currency || 'INR'}</Text></Col>
            <Col span={6}><Text type="secondary">Exchange Rate</Text><br /><Text strong>{selected.exchange_rate ?? 1}</Text></Col>
            <Col span={6}><Text type="secondary">Freight Charges</Text><br /><Text strong>₹{Number(selected.freight_charges || 0).toLocaleString()}</Text></Col>
            <Col span={6}><Text type="secondary">CGST</Text><br /><Text strong>₹{Number(selected.cgst_amount || 0).toLocaleString()}</Text></Col>
            <Col span={6}><Text type="secondary">SGST</Text><br /><Text strong>₹{Number(selected.sgst_amount || 0).toLocaleString()}</Text></Col>
            <Col span={6}><Text type="secondary">IGST</Text><br /><Text strong>₹{Number(selected.igst_amount || 0).toLocaleString()}</Text></Col>
            <Col span={6}><Text type="secondary">3-Way Match Status</Text><br /><Tag color={MATCH_STATUS_COLOR[selected.three_way_match_status] || 'default'}>{(selected.three_way_match_status || 'pending').toUpperCase()}</Tag></Col>
            {!!selected.discrepancy_flag && <Col span={24}><Card size="small" style={{ borderColor: '#ff4d4f' }}><Text type="secondary">Discrepancy Reason</Text><br /><Text strong style={{ color: '#ff4d4f' }}>{selected.discrepancy_reason || '—'}</Text></Card></Col>}
          </Row>
        </Card>
        {selected.line_items?.length > 0 && (
          <Card title="Line Items" size="small" style={{ marginTop: 16 }}>
            <Table size="small" dataSource={selected.line_items} rowKey="id" pagination={false} columns={[
              { title: '#', dataIndex: 'line_number', width: 50 },
              { title: 'Description', dataIndex: 'description', render: (v, r) => v || r.po_description },
              { title: 'Quantity', dataIndex: 'quantity' },
              { title: 'Amount', dataIndex: 'amount', render: v => `₹${Number(v).toLocaleString()}` },
            ]} />
          </Card>
        )}

        {/* Goods Receipt Note — what was actually received & inspected, distinct
            from the ASN's own (vendor-declared) shipped quantity above. */}
        {(grnLoading || grn) && (
          <Card
            title="Goods Receipt Note"
            size="small"
            style={{ marginTop: 16 }}
            loading={grnLoading}
            extra={grn && <Tag color={grn.status === 'completed' ? 'green' : grn.status === 'exception' ? 'red' : 'default'}>{grn.status?.toUpperCase()}</Tag>}
          >
            {grn && (
              <>
                <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
                  <Col span={8}><Text type="secondary">GRN Number</Text><br /><Text strong>{grn.grn_number}</Text></Col>
                  <Col span={8}><Text type="secondary">Received Date</Text><br /><Text strong>{grn.received_date ? dayjs(grn.received_date).format('DD-MM-YYYY') : '—'}</Text></Col>
                </Row>
                {grn.status === 'exception' && (
                  <Alert type="error" showIcon style={{ marginBottom: 12 }} message="One or more lines exceeded quantity tolerance or had rejections — ERP posting is blocked until resolved." />
                )}
                <Table
                  size="small" pagination={false} rowKey="id" dataSource={grn.line_items || []}
                  columns={[
                    { title: 'Shipped', dataIndex: 'shipped_quantity', width: 90 },
                    { title: 'Received', dataIndex: 'received_quantity', width: 90 },
                    { title: 'Accepted', dataIndex: 'accepted_quantity', width: 90 },
                    { title: 'Rejected', dataIndex: 'rejected_quantity', width: 90 },
                    { title: 'Rejection Reason', dataIndex: 'rejection_reason', render: v => v || <Text type="secondary">—</Text> },
                    { title: 'Tolerance', dataIndex: 'tolerance_status', width: 130, render: v => <Tag color={v === 'within_tolerance' ? 'green' : 'red'}>{v === 'within_tolerance' ? 'Within Tolerance' : 'Exceeds Tolerance'}</Tag> },
                  ]}
                />
              </>
            )}
          </Card>
        )}

        {/* Invoice — formalizes the ASN's own invoice fields and runs the real
            PO vs. GRN vs. Invoice 3-way match (separate from the simpler manual
            3-Way Match action above, which only compares PO vs. ASN). */}
        {(invoiceLoading || invoice) && (
          <Card
            title="Invoice"
            size="small"
            style={{ marginTop: 16 }}
            loading={invoiceLoading}
            extra={invoice && <Tag color={invoice.match_status === 'matched' ? 'green' : invoice.match_status === 'blocked' ? 'red' : 'default'}>{invoice.match_status?.toUpperCase()}</Tag>}
          >
            {invoice && (
              <>
                <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
                  <Col span={8}><Text type="secondary">Invoice Number</Text><br /><Text strong>{invoice.invoice_number}</Text></Col>
                  <Col span={8}><Text type="secondary">Total Amount</Text><br /><Text strong>₹{Number(invoice.total_amount || 0).toLocaleString()}</Text></Col>
                </Row>
                {invoice.match_status === 'blocked' && (
                  <Alert type="error" showIcon style={{ marginBottom: 12 }} message="3-way match blocked" description={invoice.blocked_reason} />
                )}
                <Table
                  size="small" pagination={false} rowKey="id" dataSource={invoice.line_items || []}
                  columns={[
                    { title: 'Quantity', dataIndex: 'quantity', width: 100 },
                    { title: 'Unit Price', dataIndex: 'unit_price', width: 120, render: v => `₹${Number(v).toLocaleString()}` },
                    { title: 'Amount', dataIndex: 'amount', width: 120, render: v => `₹${Number(v).toLocaleString()}` },
                    { title: 'Price Deviation', dataIndex: 'price_deviation_pct', render: v => v == null ? <Text type="secondary">No PO price to compare</Text> : <Tag color={Math.abs(v) > 2 ? 'red' : 'green'}>{v > 0 ? '+' : ''}{v}%</Tag> },
                  ]}
                />
              </>
            )}
          </Card>
        )}
      </div>
    );
  }

  // ─── CREATE / EDIT VIEW ───
  if (view === 'create' || view === 'edit') {
    const steps = [{ title: 'Select PO' }, { title: 'ASN Details' }, { title: 'Attachments' }, { title: 'Invoice View' }];
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginRight: 12 }}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>{view === 'edit' ? 'Edit ASN' : 'Create New ASN'}</Title>
        </div>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Steps current={currentStep} items={steps} onChange={handleStepsChange} size="small" />
        </Card>
        <Card>
          <Form form={form} layout="vertical">
            {currentStep === 0 && (
              <div>
                <Title level={5}>Select Purchase Order</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="po_id" label={<span>Purchase Order<span className="form-label-desc">Select PO to create ASN against</span></span>} rules={[{ required: isRequired('po_id', true), message: 'Purchase Order is required' }]}>
                      <Select showSearch optionFilterProp="label" placeholder="Search PO..." onChange={handlePOChange}
                        options={pos.map(p => ({ value: p.id, label: `${p.po_number} — ₹${Number(p.total_amount).toLocaleString()} (${p.status})` }))} />
                    </Form.Item>
                  </Col>
                </Row>
                {poLines.length > 0 && (
                  <Card size="small" title="PO Line Items" style={{ marginTop: 12 }}>
                    <Table size="small" dataSource={poLines} rowKey="id" pagination={false} columns={[
                      { title: '#', dataIndex: 'line_number', width: 40 },
                      { title: 'Description', dataIndex: 'description' },
                      { title: 'PO Qty', dataIndex: 'quantity', width: 80 },
                      { title: 'Used in ASNs', dataIndex: 'consumed_quantity', width: 100, render: v => <span style={{ color: v > 0 ? '#fa8c16' : '#8c8c8c' }}>{v || 0}</span> },
                      { title: 'Available', dataIndex: 'available_quantity', width: 90, render: v => <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v ?? 0}</span> },
                      { title: 'Unit Price', dataIndex: 'unit_price', width: 100, render: v => `₹${Number(v).toLocaleString()}` },
                    ]} />
                  </Card>
                )}
              </div>
            )}
            {currentStep === 1 && (
              <div>
                <Title level={5}>ASN Details (Mandatory)</Title>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="invoice_number" label={<span>Invoice Number<span className="form-label-desc">Must be globally unique</span></span>} rules={[{ required: isRequired('invoice_number', true), message: 'Invoice Number is required' }]}><Input placeholder="INV-2024-XXXX" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="eta" label={<span>ETA<span className="form-label-desc">Expected delivery date</span></span>} rules={[{ required: isRequired('eta', true), message: 'ETA is required' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="total_amount" label={<span>Total Amount<span className="form-label-desc">Invoice total (₹)</span></span>} rules={[{ required: isRequired('total_amount', true), message: 'Total Amount is required' }]}><InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="lr_number" label={<span>LR Number<span className="form-label-desc">Lorry receipt number</span></span>} rules={[{ required: isRequired('lr_number', true), message: 'LR Number is required' }]}><Input placeholder="LR-XXXXX" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="transporter_name" label={<span>Transporter<span className="form-label-desc">Transport company name</span></span>} rules={[{ required: isRequired('transporter_name', true), message: 'Transporter is required' }]}><Input placeholder="Transporter name" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="driver_name" label={<span>Driver Name<span className="form-label-desc">Driver handling shipment</span></span>} rules={[{ required: isRequired('driver_name', true), message: 'Driver Name is required' }]}><Input placeholder="Driver name" /></Form.Item></Col>
                </Row>
                <Divider />
                <Title level={5}>Optional Fields</Title>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="driver_number" label="Driver Phone" rules={[{ required: isRequired('driver_number', false), message: 'Driver Phone is required' }]}><Input placeholder="+91 XXXXXXXXXX" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info1" label="Additional Info 1" rules={[{ required: isRequired('additional_info1', false), message: 'Additional Info 1 is required' }]}><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info2" label="Additional Info 2" rules={[{ required: isRequired('additional_info2', false), message: 'Additional Info 2 is required' }]}><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info3" label="Additional Info 3" rules={[{ required: isRequired('additional_info3', false), message: 'Additional Info 3 is required' }]}><Input placeholder="Optional" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="additional_info4" label="Additional Info 4" rules={[{ required: isRequired('additional_info4', false), message: 'Additional Info 4 is required' }]}><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={18}><Form.Item name="remarks" label="Remarks / Comments" rules={[{ required: isRequired('remarks', false), message: 'Remarks is required' }]}><Input placeholder="Any additional notes" /></Form.Item></Col>
                </Row>
                <Divider />
                <Title level={5}>Shipment Details</Title>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="shipment_mode" label="Shipment Mode" rules={[{ required: isRequired('shipment_mode', false), message: 'Shipment Mode is required' }]}><Select allowClear placeholder="Select mode" options={(subMasters.shipment_mode || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="vehicle_number" label="Vehicle Number" rules={[{ required: isRequired('vehicle_number', false), message: 'Vehicle Number is required' }]}><Input placeholder="e.g. MH12AB1234" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="eway_bill_number" label="E-Way Bill Number" rules={[{ required: isRequired('eway_bill_number', false), message: 'E-Way Bill Number is required' }]}><Input placeholder="E-way bill #" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="dispatch_date" label="Dispatch Date" rules={[{ required: isRequired('dispatch_date', false), message: 'Dispatch Date is required' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="actual_delivery_date" label="Actual Delivery Date" rules={[{ required: isRequired('actual_delivery_date', false), message: 'Actual Delivery Date is required' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Divider />
                <Title level={5}>Invoice &amp; Tax Details</Title>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="invoice_currency" label="Invoice Currency" initialValue="INR" rules={[{ required: isRequired('invoice_currency', false), message: 'Invoice Currency is required' }]}><Select options={(subMasters.currency || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="exchange_rate" label="Exchange Rate" initialValue={1} rules={[{ required: isRequired('exchange_rate', false), message: 'Exchange Rate is required' }]}><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="freight_charges" label="Freight Charges" initialValue={0} rules={[{ required: isRequired('freight_charges', false), message: 'Freight Charges is required' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="cgst_amount" label="CGST Amount" initialValue={0} rules={[{ required: isRequired('cgst_amount', false), message: 'CGST Amount is required' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="sgst_amount" label="SGST Amount" initialValue={0} rules={[{ required: isRequired('sgst_amount', false), message: 'SGST Amount is required' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="igst_amount" label="IGST Amount" initialValue={0} rules={[{ required: isRequired('igst_amount', false), message: 'IGST Amount is required' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </div>
            )}
            {currentStep === 2 && (
              <div>
                <Title level={5}>Attachments & PDF Extraction</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="Invoice Document (PDF)">
                      <Upload accept=".pdf" maxCount={1} beforeUpload={async (file) => {
                        const url = URL.createObjectURL(file);
                        setInvoicePdfUrl(url);
                        setExtractionResults([]);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const configRes = await api.get('/extraction-configs');
                          const configs = (configRes.data.data || []).map(c => ({
                            field_name: c.field_name,
                            aliases: typeof c.aliases === 'string' ? JSON.parse(c.aliases) : c.aliases,
                            regex_pattern: c.regex_pattern,
                            priority: c.priority,
                          }));
                          formData.append('configs', JSON.stringify(configs));
                          const extractRes = await fetch(`${DOCUMENT_INTELLIGENCE_URL}/extract`, { method: 'POST', body: formData });
                          const extractData = await extractRes.json();
                          if (extractData.success && extractData.data) {
                            setExtractionResults(extractData.data);
                            message.success(`Extracted ${extractData.data.filter(r => r.match_type !== 'not_found').length} field(s) from PDF`);
                            // Auto-fill line items if quantity found
                            const qtyResult = extractData.data.find(r => r.field_name?.toLowerCase().includes('quantity'));
                            if (qtyResult?.extracted_value && lineItems.length > 0) {
                              const qty = parseInt(qtyResult.extracted_value);
                              if (!isNaN(qty) && qty > 0) {
                                setLineItems(prev => prev.map((item, idx) => idx === 0 ? { ...item, quantity: Math.min(qty, item.max_qty), amount: Math.min(qty, item.max_qty) * (poLines[0]?.unit_price || 0) } : item));
                              }
                            }
                          }
                        } catch (err) {
                          message.warning('PDF extraction service not available. Upload saved.');
                        }
                        return false;
                      }} onRemove={() => { setInvoicePdfUrl(null); setExtractionResults([]); }}>
                        <Button icon={<UploadOutlined />} block>Upload Invoice PDF</Button>
                      </Upload>
                    </Card>
                    <Card size="small" title="Other Reference (PDF)" style={{ marginTop: 12 }}>
                      <Upload accept=".pdf" beforeUpload={() => false} maxCount={1}>
                        <Button icon={<UploadOutlined />} block>Upload Reference PDF</Button>
                      </Upload>
                    </Card>
                    <Card size="small" title="Excel Attachment" style={{ marginTop: 12 }}>
                      <Upload accept=".xls,.xlsx,.csv" beforeUpload={() => false} maxCount={1}>
                        <Button icon={<UploadOutlined />} block>Attach Excel</Button>
                      </Upload>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="Extracted from Invoice PDF" style={{ minHeight: 300 }}>
                      {extractionResults.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                          <UploadOutlined style={{ fontSize: 32, marginBottom: 12 }} />
                          <br /><Text type="secondary">Upload an invoice PDF to extract product descriptions and quantities automatically.</Text>
                        </div>
                      )}
                      {extractionResults.length > 0 && (
                        <Table size="small" dataSource={extractionResults} rowKey="field_name" pagination={false} columns={[
                          { title: 'Field', dataIndex: 'field_name', width: 130 },
                          { title: 'Extracted Value', dataIndex: 'extracted_value', render: v => v || <Text type="secondary">Not found</Text> },
                          { title: 'Confidence', dataIndex: 'confidence', width: 90, render: v => {
                            const color = v >= 90 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f';
                            return <Tag color={color}>{v}%</Tag>;
                          }},
                          { title: 'Status', dataIndex: 'needs_review', width: 80, render: v => v ? <Tag color="orange">Review</Tag> : <Tag color="green">OK</Tag> },
                        ]} />
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
            {currentStep === 3 && (
              <div>
                <Title level={5}>Invoice View</Title>
                <Row gutter={16}>
                  {/* Left: Invoice PDF Preview */}
                  <Col span={12}>
                    <Card title="Invoice PDF" size="small" style={{ height: 500 }}>
                      {invoicePdfUrl ? (
                        <iframe src={invoicePdfUrl} style={{ width: '100%', height: 440, border: 'none', borderRadius: 6 }} title="Invoice PDF Preview" />
                      ) : (
                        <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 6, border: '1px dashed #d9d9d9' }}>
                          <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                            <UploadOutlined style={{ fontSize: 40, marginBottom: 12 }} />
                            <br />
                            <Text type="secondary">No invoice PDF uploaded yet.</Text>
                            <br />
                            <Text type="secondary">Upload in Step 3 (Attachments) to preview here.</Text>
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>
                  {/* Right: Line Items Table + Excel Import */}
                  <Col span={12}>
                    <Card title="Line Items — Quantities to Ship" size="small" extra={
                      <Upload accept=".xls,.xlsx,.csv" beforeUpload={(file) => {
                        message.info(`Excel file "${file.name}" selected. Parsing quantities...`);
                        return false;
                      }} showUploadList={false}>
                        <Button icon={<UploadOutlined />} size="small" type="primary">Import Excel</Button>
                      </Upload>
                    }>
                      <Table size="small" dataSource={lineItems} rowKey="po_line_id" pagination={false} columns={[
                        { title: 'Description', dataIndex: 'description', ellipsis: true },
                        { title: 'Available', dataIndex: 'max_qty', width: 80 },
                        { title: 'Ship Qty', width: 100, render: (_, record, i) => (
                          <InputNumber min={0} max={record.max_qty} value={record.quantity} onChange={v => updateLineItem(i, 'quantity', v)} size="small" style={{ width: '100%' }} />
                        )},
                        { title: 'Amount (₹)', dataIndex: 'amount', width: 100, render: v => Number(v || 0).toLocaleString() },
                      ]} />
                      {lineItems.length === 0 && <div style={{ padding: 20, textAlign: 'center' }}><Text type="secondary">Select a PO in Step 1 to see line items</Text></div>}
                      {lineItems.length > 0 && (
                        <Card size="small" style={{ marginTop: 12, background: '#fffbe6', border: '1px solid #ffe58f' }}>
                          <Text>Total Ship Amount: <Text strong style={{ fontSize: 16 }}>₹{lineItems.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</Text></Text>
                        </Card>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
          </Form>
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button disabled={currentStep === 0} onClick={() => setCurrentStep(s => s - 1)}>Previous</Button>
            <Space>
              {currentStep < 3 && <Button type="primary" onClick={goToNextStep}>Next</Button>}
              {currentStep === 3 && <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveASN}>{view === 'edit' ? 'Update ASN' : 'Create ASN'}</Button>}
            </Space>
          </div>
        </Card>
      </div>
    );
  }

  // ─── LIST VIEW ───
  const columns = [
    { title: 'ASN #', dataIndex: 'asn_number', width: 140, sorter: (a, b) => String(a.asn_number || '').localeCompare(String(b.asn_number || ''), undefined, { numeric: true }) },
    ...(user.role !== 'vendor' ? [{ title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, sorter: (a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')) }] : []),
    { title: 'PO #', dataIndex: 'po_number', sorter: (a, b) => String(a.po_number || '').localeCompare(String(b.po_number || ''), undefined, { numeric: true }) },
    { title: 'Invoice #', dataIndex: 'invoice_number', sorter: (a, b) => String(a.invoice_number || '').localeCompare(String(b.invoice_number || '')) },
    { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v || 0).toLocaleString()}`, sorter: (a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0) },
    { title: 'ETA', dataIndex: 'eta', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—', sorter: (a, b) => new Date(a.eta || 0) - new Date(b.eta || 0) },
    { title: 'Created', dataIndex: 'created_at', width: 100, sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at), defaultSortOrder: 'descend', render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    {
      title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s?.toUpperCase()}</Tag>,
      filters: Object.entries(STATUS_LABEL).map(([value, text]) => ({ text, value })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Company', dataIndex: 'company_name', width: 130, ellipsis: true,
      render: (v, row) => (
        <Space size={4}>
          {v || <Text type="secondary">—</Text>}
          <InactiveCompanyBadge show={row.company_is_active === false} />
        </Space>
      ),
    },
    ...(user.role !== 'vendor' ? [{
      title: 'Receipt', key: 'grn_status', width: 150,
      render: (_, row) => {
        if (row.grn_status === 'completed') return <Tag color="green">GRN Completed</Tag>;
        if (row.grn_status === 'exception') return <Tag color="red">GRN Exception</Tag>;
        if (row.status === 'validated') {
          return (
            <Button size="small" type="link" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); openDetail(row, true); }}>
              Create GRN
            </Button>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    }] : []),
  ];

  const asnListTitle = user.role === 'vendor' ? 'My ASNs' : 'ASN Management';
  const asnListSubtitle = user.role === 'vendor'
    ? 'View and manage your Advance Shipment Notices. Create new ASNs against your Purchase Orders.'
    : 'Review, validate, and post vendor ASNs to ERP. Track shipment status across all vendors.';
  const asnListActions = (user.role === 'vendor' || user.role === 'procurement_admin' || user.role === 'mdm_admin')
    && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create ASN</Button>;

  return (
    <div>
      {uiImprovementsEnabled ? (
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'ASNs' }]}
          title={asnListTitle}
          subtitle={asnListSubtitle}
          extra={asnListActions}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0 }}>{asnListTitle}</Title>
            {asnListActions}
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{asnListSubtitle}</Text>
        </>
      )}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="1"><Input placeholder="Search by Invoice #" allowClear onPressEnter={() => fetchData()} /></Col>
          <Col flex="1"><Input placeholder="Search by PO #" allowClear onPressEnter={() => fetchData()} /></Col>
          <Col flex="1">
            <Select placeholder="Filter by Status" allowClear style={{ width: '100%' }} options={[
              { value: 'submitted', label: 'Initiated' }, { value: 'validated', label: 'Validated' }, { value: 'posted', label: 'Posted' }, { value: 'rejected', label: 'Rejected' },
            ]} />
          </Col>
          <Col><Button type="primary" onClick={() => fetchData()}>Search</Button></Col>
          <Col><Button onClick={() => fetchData()}>Clear</Button></Col>
        </Row>
      </Card>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
        pagination={{ ...pagination, showSizeChanger: true, showTotal: t => `${t} ASNs`, onChange: (p, ps) => fetchData(p, ps) }}
        onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: 'pointer' } })} />
    </div>
  );
}
