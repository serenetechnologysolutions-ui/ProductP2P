import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, Row, Col, Card, Typography, Divider, Space, Tag, Checkbox, Modal, Radio, Empty, Alert, message } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, SearchOutlined, ClearOutlined, PlusCircleOutlined, FileTextOutlined, ArrowLeftOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';

const { Title, Text } = Typography;

export default function PurchaseOrders() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState([{ description: '', hsn_sac: '', quantity: 1, uom: 'Nos', unit_price: 0, tax_percent: 18, amount: 0, tax_amount: 0, total_line_amount: 0 }]);
  const [vendors, setVendors] = useState([]);
  const [filterPoNumber, setFilterPoNumber] = useState('');
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [deliverySchedule, setDeliverySchedule] = useState([]);
  const [subMasters, setSubMasters] = useState({ incoterms: [], account_assignment_category: [] });
  const [poRequirePrReference, setPoRequirePrReference] = useState(false);
  const { isRequired } = useFieldConfig('purchase_order');

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

  useEffect(() => {
    fetchData();
    api.get('/vendors?limit=500').then(r => setVendors(r.data.data || [])).catch(() => {});
    (async () => {
      const cats = ['incoterms', 'account_assignment_category', 'department', 'company', 'plant', 'cost_center'];
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
    setSourceModalOpen(true);
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
    { title: 'PO Number', dataIndex: 'po_number', width: 120, fixed: 'left' },
    { title: 'Source PR', dataIndex: 'pr_number', width: 110, render: v => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Source RFQ', dataIndex: 'rfq_number', width: 110, render: v => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'PO Date', dataIndex: 'po_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : <Text type="secondary">—</Text> },
    { title: 'Vendor', dataIndex: 'vendor_id', width: 180, ellipsis: true, render: v => vendors.find(x => x.id === v)?.vendor_name || v },
    { title: 'Buyer', dataIndex: 'buyer_name', width: 140, ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    { title: 'GSTIN', dataIndex: 'gstin', width: 140, render: v => v || <Text type="secondary">—</Text> },
    { title: 'Amount', dataIndex: 'total_amount', width: 130, align: 'right', render: v => `₹${Number(v || 0).toLocaleString()}` },
    { title: 'Validity', dataIndex: 'validity_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : <Text type="secondary">—</Text> },
    { title: 'Incoterms', dataIndex: 'incoterms', width: 100, render: v => v || <Text type="secondary">—</Text> },
    { title: 'Cost Center', dataIndex: 'cost_center', width: 120, render: v => v || <Text type="secondary">—</Text> },
    { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={v === 'open' ? 'blue' : 'green'}>{v}</Tag> },
    {
      title: 'Action', key: 'action', width: 90, fixed: 'right',
      render: (_, po) => (
        <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadPoPdf(po)}>PDF</Button>
      ),
    },
  ];

  return (
    <div>
      {!showForm ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0 }}>Purchase Orders</Title>
            <Space>
              <Button icon={<FileTextOutlined />} onClick={openSourceModal}>Create PO from PR/RFQ</Button>
              {!poRequirePrReference && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>Create PO</Button>
              )}
            </Space>
          </div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Create and manage Purchase Orders with buyer details, line items, and tax calculations.</Text>
        </>
      ) : (
        <Row align="middle" style={{ marginBottom: 16 }}>
          <Col><Button icon={<ArrowLeftOutlined />} onClick={() => setShowForm(false)} style={{ marginRight: 12 }}>Back</Button></Col>
          <Col flex="auto"><Title level={4} style={{ margin: 0 }}>Create Purchase Order</Title></Col>
        </Row>
      )}

      {!showForm ? (
        <>
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
        <Card>
          <Form form={form} layout="vertical">
            <Title level={5}>Buyer & PO Information</Title>
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

            <Divider />
            <Title level={5}>Contract &amp; Commercial Terms</Title>
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

            <Divider />
            <Title level={5}>Account Assignment <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(optional — aligned with Purchase Requisition fields)</Text></Title>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="department" label="Department">
                <Select allowClear showSearch placeholder="Select department" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} />
              </Form.Item></Col>
              <Col span={6}><Form.Item name="account_assignment_category" label="Account Assignment"><Select allowClear options={(subMasters.account_assignment_category || []).map(s => ({ value: s.name, label: s.name }))} /></Form.Item></Col>
              <Col span={6}><Form.Item name="company_code" label="Company Code">
                <Select allowClear showSearch placeholder="Select company" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} />
              </Form.Item></Col>
              <Col span={6}><Form.Item name="plant" label="Plant">
                <Select allowClear showSearch placeholder="Select plant" options={(subMasters.plant || []).map(s => ({ value: s.name, label: s.name }))} />
              </Form.Item></Col>
            </Row>

            <Title level={5} style={{ marginTop: 8 }}>Delivery Schedule</Title>
            {deliverySchedule.map((d, i) => (
              <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
                <Col span={10}><Input placeholder="Milestone (e.g. First Lot)" value={d.milestone} onChange={e => updateDeliveryMilestone(i, 'milestone', e.target.value)} /></Col>
                <Col span={8}><DatePicker style={{ width: '100%' }} placeholder="Delivery date" value={d.date ? dayjs(d.date) : null} onChange={val => updateDeliveryMilestone(i, 'date', val)} /></Col>
                <Col span={4}><InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="Qty %" value={d.quantity_percent} onChange={val => updateDeliveryMilestone(i, 'quantity_percent', val)} /></Col>
                <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeDeliveryMilestone(i)} /></Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addDeliveryMilestone} block>Add Delivery Milestone</Button>

            <Divider />
            <Title level={5}>Purchase Lines</Title>
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
                  <Col span={2}><Input placeholder="HSN" value={item.hsn_sac} onChange={e => updateItem(i, 'hsn_sac', e.target.value)} size="small" /></Col>
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

            <Divider />
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Create PO</Button>
              <Button onClick={() => setShowForm(false)}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      )}

      <Modal
        title="Create PO from PR / RFQ"
        open={sourceModalOpen}
        onCancel={() => setSourceModalOpen(false)}
        onOk={handleCreateFromSource}
        okText="Create PO(s)"
        okButtonProps={{ loading: creatingFromSource }}
        width={760}
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
      </Modal>
    </div>
  );
}
