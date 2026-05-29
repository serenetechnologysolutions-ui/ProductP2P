import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, InputNumber, DatePicker, Select, Tag, Space, Row, Col, Card, Typography, Divider, Steps, Upload, Modal, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, CheckOutlined, CloseOutlined, SendOutlined, EditOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const STATUS_COLOR = { draft: 'default', submitted: 'blue', validated: 'orange', posted: 'green', rejected: 'red' };
const STATUS_LABEL = { draft: 'DRAFT', submitted: 'INITIATED', validated: 'VALIDATED', posted: 'POSTED', rejected: 'REJECTED' };

export default function ASNs() {
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

  useEffect(() => { fetchData(); }, []);

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
    });
    fetchPOs();
    setLineItems(selected.line_items?.map(l => ({ po_line_id: l.po_line_id, description: l.description || l.po_description, quantity: l.quantity, amount: l.amount, max_qty: 9999 })) || []);
    setCurrentStep(0);
    setView('edit');
  };

  const openDetail = async (record) => {
    try { const res = await api.get(`/asns/${record.id}`); setSelected(res.data.data); } catch (_) { setSelected(record); }
    setView('detail');
  };

  const goBack = () => { setView('list'); setSelected(null); };

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
            {user.role !== 'vendor' && selected.status === 'submitted' && <Button danger icon={<CloseOutlined />} onClick={() => setRejectModalOpen(true)}>Reject</Button>}
            {user.role !== 'vendor' && selected.status === 'validated' && <Button type="primary" icon={<SendOutlined />} style={{ background: '#52c41a' }} onClick={() => handleAction('post')}>Post to ERP</Button>}
          </Space>
        </div>
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
          <Steps current={currentStep} items={steps} onChange={setCurrentStep} size="small" />
        </Card>
        <Card>
          <Form form={form} layout="vertical">
            {currentStep === 0 && (
              <div>
                <Title level={5}>Select Purchase Order</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="po_id" label={<span>Purchase Order<span className="form-label-desc">Select PO to create ASN against</span></span>} rules={[{ required: true }]}>
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
                  <Col span={8}><Form.Item name="invoice_number" label={<span>Invoice Number<span className="form-label-desc">Must be globally unique</span></span>} rules={[{ required: true }]}><Input placeholder="INV-2024-XXXX" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="eta" label={<span>ETA<span className="form-label-desc">Expected delivery date</span></span>} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="total_amount" label={<span>Total Amount<span className="form-label-desc">Invoice total (₹)</span></span>} rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="lr_number" label={<span>LR Number<span className="form-label-desc">Lorry receipt number</span></span>} rules={[{ required: true }]}><Input placeholder="LR-XXXXX" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="transporter_name" label={<span>Transporter<span className="form-label-desc">Transport company name</span></span>} rules={[{ required: true }]}><Input placeholder="Transporter name" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="driver_name" label={<span>Driver Name<span className="form-label-desc">Driver handling shipment</span></span>} rules={[{ required: true }]}><Input placeholder="Driver name" /></Form.Item></Col>
                </Row>
                <Divider />
                <Title level={5}>Optional Fields</Title>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="driver_number" label="Driver Phone"><Input placeholder="+91 XXXXXXXXXX" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info1" label="Additional Info 1"><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info2" label="Additional Info 2"><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="additional_info3" label="Additional Info 3"><Input placeholder="Optional" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="additional_info4" label="Additional Info 4"><Input placeholder="Optional" /></Form.Item></Col>
                  <Col span={18}><Form.Item name="remarks" label="Remarks / Comments"><Input placeholder="Any additional notes" /></Form.Item></Col>
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
                          const extractRes = await fetch('http://localhost:8000/extract', { method: 'POST', body: formData });
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
              {currentStep < 3 && <Button type="primary" onClick={() => setCurrentStep(s => s + 1)}>Next</Button>}
              {currentStep === 3 && <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveASN}>{view === 'edit' ? 'Update ASN' : 'Create ASN'}</Button>}
            </Space>
          </div>
        </Card>
      </div>
    );
  }

  // ─── LIST VIEW ───
  const columns = [
    { title: 'ASN #', dataIndex: 'asn_number', width: 140 },
    ...(user.role !== 'vendor' ? [{ title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true }] : []),
    { title: 'PO #', dataIndex: 'po_number' },
    { title: 'Invoice #', dataIndex: 'invoice_number' },
    { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v || 0).toLocaleString()}` },
    { title: 'ETA', dataIndex: 'eta', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Created', dataIndex: 'created_at', width: 100, sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at), defaultSortOrder: 'descend', render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s?.toUpperCase()}</Tag> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Title level={4} style={{ margin: 0 }}>{user.role === 'vendor' ? 'My ASNs' : 'ASN Management'}</Title>
        {user.role === 'vendor' && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create ASN</Button>}
        {(user.role === 'procurement_admin' || user.role === 'mdm_admin') && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create ASN</Button>}
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {user.role === 'vendor' ? 'View and manage your Advance Shipment Notices. Create new ASNs against your Purchase Orders.' : 'Review, validate, and post vendor ASNs to ERP. Track shipment status across all vendors.'}
      </Text>
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
      <Modal title="Reject ASN" open={rejectModalOpen} onCancel={() => setRejectModalOpen(false)} onOk={() => handleAction('reject')} okText="Reject" okButtonProps={{ danger: true }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Please provide a reason for rejecting this ASN.</Text>
        <Input.TextArea rows={3} placeholder="Enter rejection reason (mandatory)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
      </Modal>
    </div>
  );
}
