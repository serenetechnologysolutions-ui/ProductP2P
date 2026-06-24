import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography, Row, Col, Tabs,
  Form, Input, InputNumber, DatePicker, Select, Divider, Modal, Checkbox, Upload,
  message, Statistic, Alert, Timeline, Collapse, Popconfirm, Badge, Empty,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, ApartmentOutlined, NodeIndexOutlined, AuditOutlined,
  DeleteOutlined, ShoppingCartOutlined, FileDoneOutlined, EditOutlined,
  UploadOutlined, PaperClipOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { API_BASE_URL } from '../config';

const UPLOAD_BASE = `${API_BASE_URL}/`;

function AttachmentLink({ path, name }) {
  if (!path) return null;
  return <a href={`${UPLOAD_BASE}${path}`} target="_blank" rel="noopener noreferrer"><PaperClipOutlined /> {name || 'View attachment'}</a>;
}

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_COLOR = { draft: 'default', submitted: 'orange', approved: 'blue', partially_approved: 'blue', sourcing: 'cyan', closed: 'green', rejected: 'red' };
const PRIORITY_COLOR = { Low: 'default', Medium: 'blue', High: 'orange', Urgent: 'red' };
const SOURCING_LABELS = {
  RFQ_REQUIRED: 'RFQ Required',
  DIRECT_PO_ALLOWED: 'Direct PO Allowed',
  AUTO_PO: 'Auto PO',
  CONTRACT_BASED: 'Contract Based',
};
const BUDGET_COLOR = { within_budget: 'green', exceeds_budget: 'red', not_configured: 'default' };

function StatusTag({ status }) {
  return <Tag color={STATUS_COLOR[status] || 'default'}>{(status || '').replace('_', ' ').toUpperCase()}</Tag>;
}

const emptyLineItem = () => ({
  item_master_id: null, description: '', quantity: 1, uom: 'Nos', estimated_unit_price: null,
  delivery_date: null, delivery_location: '', plant: '', storage_location: '',
  gr_required: true, ir_required: true, partial_delivery_allowed: true,
  attachment_path: null, attachment_name: null,
});

// ═══════════════════════════════════════════════════════════════════════════
// Tab components — defined outside the page component so controlled inputs
// (reject remarks, etc.) don't lose focus on every parent re-render.
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ pr, isApprover, onSubmit, onApprove, onOpenReject, onOpenCreateRfq, onOpenCreatePo, actionLoading }) {
  if (!pr) return null;
  const isDraftOrRejected = ['draft', 'rejected'].includes(pr.status);
  const isSubmitted = pr.status === 'submitted';
  const canSource = ['approved', 'sourcing'].includes(pr.status);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Row gutter={16}>
        <Col span={5}><Statistic title="Total Value" value={pr.total_value} prefix={pr.currency || '₹'} precision={2} /></Col>
        <Col span={5}><Statistic title="Status" valueRender={() => <StatusTag status={pr.status} />} /></Col>
        <Col span={5}><Statistic title="Sourcing Strategy" valueRender={() => <Tag>{SOURCING_LABELS[pr.sourcing_strategy] || pr.sourcing_strategy}</Tag>} /></Col>
        <Col span={5}><Statistic title="Budget Status" valueRender={() => <Tag color={BUDGET_COLOR[pr.budget_status]}>{(pr.budget_status || 'not_configured').replace('_', ' ').toUpperCase()}</Tag>} /></Col>
        <Col span={4}><Statistic title="Priority" valueRender={() => <Tag color={PRIORITY_COLOR[pr.priority]}>{pr.priority}</Tag>} /></Col>
      </Row>

      <Card title="Justification" size="small"><Text>{pr.justification}</Text></Card>

      <Card title="Requisition Details" size="small">
        <Row gutter={[16, 8]}>
          <Col span={6}><Text type="secondary">Requester</Text><br /><Text strong>{pr.requester_name || '—'}</Text></Col>
          <Col span={6}><Text type="secondary">Department</Text><br /><Text strong>{pr.department}</Text></Col>
          <Col span={6}><Text type="secondary">Document Type</Text><br /><Text strong>{pr.document_type}</Text></Col>
          <Col span={6}><Text type="secondary">Required Date</Text><br /><Text strong>{pr.required_date ? dayjs(pr.required_date).format('DD MMM YYYY') : '—'}</Text></Col>
          <Col span={6}><Text type="secondary">Cost Center</Text><br /><Text strong>{pr.cost_center || '—'}</Text></Col>
          <Col span={6}><Text type="secondary">Project Code</Text><br /><Text strong>{pr.project_code || '—'}</Text></Col>
          <Col span={6}><Text type="secondary">Account Assignment</Text><br /><Text strong>{pr.account_assignment_category}</Text></Col>
          <Col span={6}><Text type="secondary">Company / Plant</Text><br /><Text strong>{[pr.company_code, pr.plant].filter(Boolean).join(' / ') || '—'}</Text></Col>
        </Row>
      </Card>

      {pr.status === 'rejected' && pr.rejection_reason && (
        <Alert type="error" showIcon message="Requisition rejected" description={pr.rejection_reason} />
      )}
      {isSubmitted && (
        <Alert
          type="info"
          showIcon
          message={isApprover ? 'Awaiting your approval' : `Awaiting approval — ${pr.current_step_name || 'next step'} (${pr.current_approver_role || 'pending'})`}
        />
      )}

      <Space wrap>
        {isDraftOrRejected && (
          <Popconfirm title="Submit this requisition for approval?" onConfirm={onSubmit}>
            <Button type="primary" icon={<SendOutlined />} loading={actionLoading}>Submit for Approval</Button>
          </Popconfirm>
        )}
        {isSubmitted && isApprover && (
          <>
            <Popconfirm title="Approve this requisition?" onConfirm={onApprove}>
              <Button type="primary" icon={<CheckOutlined />} loading={actionLoading}>Approve</Button>
            </Popconfirm>
            <Button danger icon={<CloseOutlined />} onClick={onOpenReject}>Reject</Button>
          </>
        )}
        {canSource && (
          <>
            <Button
              icon={<FileTextOutlined />}
              disabled={pr.sourcing_strategy === 'CONTRACT_BASED'}
              title={pr.sourcing_strategy === 'CONTRACT_BASED' ? 'Contract-based requisitions skip RFQ sourcing' : undefined}
              onClick={onOpenCreateRfq}
            >
              Create RFQ
            </Button>
            <Button
              icon={<ShoppingCartOutlined />}
              disabled={pr.sourcing_strategy === 'RFQ_REQUIRED'}
              title={pr.sourcing_strategy === 'RFQ_REQUIRED' ? 'RFQ sourcing is required for this requisition' : undefined}
              onClick={onOpenCreatePo}
            >
              Create PO
            </Button>
          </>
        )}
        {pr.status === 'closed' && <Alert type="success" showIcon message="Requisition fully sourced and closed." />}
      </Space>
    </Space>
  );
}

function LineItemsTab({ lineItems }) {
  return (
    <Table
      size="middle"
      pagination={false}
      rowKey="id"
      dataSource={lineItems || []}
      columns={[
        { title: '#', dataIndex: 'sequence', width: 50 },
        { title: 'Description', dataIndex: 'description' },
        { title: 'Qty', dataIndex: 'quantity', width: 90, render: v => Number(v).toLocaleString() },
        { title: 'UOM', dataIndex: 'uom', width: 80 },
        { title: 'Est. Unit Price', dataIndex: 'estimated_unit_price', width: 130, render: v => v != null ? Number(v).toLocaleString() : <Text type="secondary">—</Text> },
        { title: 'Est. Total', dataIndex: 'estimated_total_price', width: 130, render: v => v != null ? Number(v).toLocaleString() : <Text type="secondary">—</Text> },
        { title: 'Consumed', dataIndex: 'consumed_quantity', width: 100, render: v => Number(v || 0).toLocaleString() },
        { title: 'Remaining', dataIndex: 'remaining_quantity', width: 100, render: v => Number(v || 0).toLocaleString() },
        { title: 'RFQs', key: 'rfqs', width: 80, render: (_, r) => r.linked_rfq_ids?.length ? <Badge count={r.linked_rfq_ids.length} color="blue" /> : <Text type="secondary">—</Text> },
        { title: 'POs', key: 'pos', width: 80, render: (_, r) => r.linked_po_ids?.length ? <Badge count={r.linked_po_ids.length} color="green" /> : <Text type="secondary">—</Text> },
        { title: 'Attachment', key: 'attachment', width: 150, render: (_, r) => r.attachment_path ? <AttachmentLink path={r.attachment_path} name={r.attachment_name} /> : <Text type="secondary">—</Text> },
      ]}
    />
  );
}

function WorkflowTimelineTab({ timeline, loading }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>;
  if (!timeline) return <Empty description="No approval workflow has started yet" />;
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text type="secondary">Workflow: </Text><Text strong>{timeline.workflow_name}</Text>
      {timeline.current_step_name && <><Divider type="vertical" /><Text type="secondary">Current Step: </Text><Text strong>{timeline.current_step_name}</Text></>}
      <Divider style={{ margin: '12px 0' }} />
      <Timeline
        items={(timeline.logs || []).map(log => ({
          color: log.action === 'rejected' ? 'red' : log.action === 'approved' ? 'green' : 'blue',
          children: (
            <>
              <Text strong>{log.action?.toUpperCase()}</Text>
              {log.step_name && <Text type="secondary"> — {log.step_name}</Text>}
              <br />
              {log.remarks && <Text>{log.remarks}</Text>}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{log.created_at ? dayjs(log.created_at).format('DD MMM YYYY HH:mm') : ''}</Text>
            </>
          ),
        }))}
      />
      {(!timeline.logs || timeline.logs.length === 0) && <Text type="secondary">No log entries yet</Text>}
    </Space>
  );
}

function DocumentFlowTab({ flow, loading }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>;
  if (!flow || (!flow.rfqs?.length && !flow.purchase_orders?.length)) return <Empty description="No RFQs or POs created from this requisition yet" />;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {flow.rfqs?.length > 0 && (
        <Card title="RFQs" size="small">
          <Table
            size="small" pagination={false} rowKey="id" dataSource={flow.rfqs}
            columns={[
              { title: 'RFQ Number', dataIndex: 'rfq_number' },
              { title: 'Status', dataIndex: 'status', render: v => <Tag>{(v || '').toUpperCase()}</Tag> },
              { title: 'Line Items', key: 'count', render: (_, r) => r.line_items?.length || 0 },
              { title: 'Deadline', dataIndex: 'submission_deadline', render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
            ]}
          />
        </Card>
      )}
      {flow.purchase_orders?.length > 0 && (
        <Card title="Purchase Orders" size="small">
          <Table
            size="small" pagination={false} rowKey="id" dataSource={flow.purchase_orders}
            columns={[
              { title: 'PO Number', dataIndex: 'po_number' },
              { title: 'Status', dataIndex: 'status', render: v => <Tag>{(v || '').toUpperCase()}</Tag> },
              { title: 'Total Amount', dataIndex: 'total_amount', render: v => Number(v).toLocaleString() },
              { title: 'Line Items', key: 'count', render: (_, r) => r.line_items?.length || 0 },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}

function AuditLogTab({ logs, loading }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>;
  if (!logs?.length) return <Empty description="No audit entries yet" />;
  return (
    <Timeline
      items={logs.map(log => ({
        children: (
          <>
            <Text strong>{log.action?.replace(/_/g, ' ').toUpperCase()}</Text>
            <Text type="secondary"> — {log.actor_name || log.actor_email || 'system'}</Text>
            {log.remarks && <><br /><Text>{log.remarks}</Text></>}
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(log.created_at).format('DD MMM YYYY HH:mm')}</Text>
          </>
        ),
      }))}
    />
  );
}

function AttachmentsTab({ attachments, loading, uploading, onUpload, onDelete }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Upload showUploadList={false} customRequest={({ file, onSuccess, onError }) => onUpload(file, onSuccess, onError)}>
        <Button icon={<UploadOutlined />} loading={uploading}>Upload Attachment</Button>
      </Upload>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div> : !attachments?.length ? (
        <Empty description="No attachments uploaded yet" />
      ) : (
        <Table
          size="small" pagination={false} rowKey="id" dataSource={attachments}
          columns={[
            { title: 'File', dataIndex: 'file_name', render: (v, r) => <AttachmentLink path={r.file_url} name={v} /> },
            { title: 'Uploaded', dataIndex: 'uploaded_at', width: 160, render: v => dayjs(v).format('DD MMM YYYY HH:mm') },
            { title: '', width: 60, render: (_, r) => <Popconfirm title="Remove this attachment?" onConfirm={() => onDelete(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm> },
          ]}
        />
      )}
    </Space>
  );
}

// Checkbox + editable-quantity table used by the Create RFQ / Create PO
// modals so a user can send a partial quantity per line instead of always
// the full remaining amount. `selections` is [{ pr_line_item_id, description,
// max, quantity, selected }].
function LineSelectionTable({ selections, setSelections }) {
  const toggle = (id, checked) => setSelections(prev => prev.map(s => s.pr_line_item_id === id ? { ...s, selected: checked } : s));
  const updateQty = (id, qty) => setSelections(prev => prev.map(s => s.pr_line_item_id === id ? { ...s, quantity: qty } : s));

  if (selections.length === 0) return <Empty description="No remaining quantity available on this requisition" />;

  return (
    <Table
      size="small"
      pagination={false}
      rowKey="pr_line_item_id"
      dataSource={selections}
      columns={[
        { title: '', width: 40, render: (_, row) => <Checkbox checked={row.selected} onChange={e => toggle(row.pr_line_item_id, e.target.checked)} /> },
        { title: 'Line', dataIndex: 'description' },
        { title: 'Remaining', dataIndex: 'max', width: 100, render: v => Number(v).toLocaleString() },
        {
          title: 'Quantity', width: 130,
          render: (_, row) => (
            <InputNumber
              size="small" style={{ width: '100%' }} min={0.001} max={row.max}
              value={row.quantity} disabled={!row.selected}
              onChange={v => updateQty(row.pr_line_item_id, v)}
            />
          ),
        },
      ]}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════

export default function PR() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const { isRequired } = useFieldConfig('purchase_requisition');

  const [view, setView] = useState('list'); // list | detail | create
  const [prList, setPrList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [filters, setFilters] = useState({ status: undefined, department: undefined, priority: undefined });
  const [subMasters, setSubMasters] = useState({});

  useEffect(() => {
    (async () => {
      const cats = ['document_type', 'priority', 'account_assignment_category', 'currency', 'department', 'company', 'plant', 'cost_center', 'city', 'storage_location'];
      const results = {};
      for (const cat of cats) {
        try { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; } catch { results[cat] = []; }
      }
      setSubMasters(results);
    })();
  }, []);

  const [selectedPr, setSelectedPr] = useState(null);
  const [prDetail, setPrDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const [workflowTimeline, setWorkflowTimeline] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [documentFlow, setDocumentFlow] = useState(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [attachments, setAttachments] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [rfqVendorIds, setRfqVendorIds] = useState([]);
  const [rfqDeadline, setRfqDeadline] = useState(null);
  const [rfqLineSelections, setRfqLineSelections] = useState([]);

  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poVendorId, setPoVendorId] = useState(null);
  const [poLineSelections, setPoLineSelections] = useState([]);

  // Create / edit page
  const [createForm] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [createLineItems, setCreateLineItems] = useState([emptyLineItem()]);
  const [vendors, setVendors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [itemMasterList, setItemMasterList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [insights, setInsights] = useState({ recommendation: null, budget: null });

  // ── Fetch list ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/pr', { params });
      setPrList(res.data.data || []);
    } catch { message.error('Failed to load requisitions'); }
    setListLoading(false);
  }, [filters]);

  useEffect(() => { if (view === 'list') fetchList(); }, [view, fetchList]);

  // ── Fetch detail ──────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/pr/${id}`);
      setPrDetail(res.data.data);
    } catch { message.error('Failed to load requisition'); }
    setDetailLoading(false);
  }, []);

  const openDetail = (pr) => {
    setSelectedPr(pr);
    setPrDetail(null);
    setWorkflowTimeline(null);
    setDocumentFlow(null);
    setAuditLogs(null);
    setAttachments(null);
    setActiveTab('overview');
    setView('detail');
    fetchDetail(pr.id);
  };

  const refreshDetail = () => selectedPr && fetchDetail(selectedPr.id);

  const handleBack = () => { setView('list'); setSelectedPr(null); setPrDetail(null); };

  // ── Tab data ──────────────────────────────────────────────────────────────

  const fetchWorkflowTimeline = async () => {
    if (!prDetail?.workflow_instance_id) return;
    setTimelineLoading(true);
    try {
      const res = await api.get(`/workflow/instances/${prDetail.workflow_instance_id}`);
      setWorkflowTimeline(res.data.data);
    } catch { message.error('Failed to load workflow timeline'); }
    setTimelineLoading(false);
  };

  const fetchDocumentFlow = async () => {
    setFlowLoading(true);
    try {
      const res = await api.get(`/pr/${prDetail.id}/document-flow`);
      setDocumentFlow(res.data.data);
    } catch { message.error('Failed to load document flow'); }
    setFlowLoading(false);
  };

  const fetchAuditLog = async () => {
    setAuditLoading(true);
    try {
      const res = await api.get(`/pr/${prDetail.id}/audit-log`);
      setAuditLogs(res.data.data);
    } catch { message.error('Failed to load audit log'); }
    setAuditLoading(false);
  };

  const fetchAttachments = async () => {
    setAttachmentsLoading(true);
    try {
      const res = await api.get('/documents', { params: { module_name: 'purchase_requisition', record_id: prDetail.id } });
      setAttachments(res.data.data || []);
    } catch { message.error('Failed to load attachments'); }
    setAttachmentsLoading(false);
  };

  const uploadOverallAttachment = async (file, onSuccess, onError) => {
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module_name', 'purchase_requisition');
      formData.append('record_id', prDetail.id);
      const res = await api.post('/documents', formData);
      message.success('Attachment uploaded');
      onSuccess(res.data);
      fetchAttachments();
    } catch (err) {
      message.error('Attachment upload failed');
      onError(err);
    }
    setUploadingAttachment(false);
  };

  const deleteAttachment = async (id) => {
    try { await api.delete(`/documents/${id}`); message.success('Attachment removed'); fetchAttachments(); }
    catch { message.error('Failed to remove attachment'); }
  };

  const onTabChange = (key) => {
    setActiveTab(key);
    if (key === 'workflow' && !workflowTimeline) fetchWorkflowTimeline();
    if (key === 'document-flow' && !documentFlow) fetchDocumentFlow();
    if (key === 'audit' && !auditLogs) fetchAuditLog();
    if (key === 'attachments' && !attachments) fetchAttachments();
  };

  // ── Status actions ───────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api.post(`/pr/${prDetail.id}/submit`);
      message.success('Requisition submitted for approval');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to submit'); }
    setActionLoading(false);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/pr/${prDetail.id}/approve`);
      message.success(res.data.message || 'Approved');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to approve'); }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) { message.error('Rejection remarks are required'); return; }
    setActionLoading(true);
    try {
      await api.post(`/pr/${prDetail.id}/reject`, { remarks: rejectRemarks });
      message.success('Requisition rejected');
      setRejectModalOpen(false);
      setRejectRemarks('');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to reject'); }
    setActionLoading(false);
  };

  // ── Create RFQ / PO modals ───────────────────────────────────────────────

  const fetchAllocationSelections = async (prId) => {
    const res = await api.get(`/pr/${prId}/allocation`);
    return (res.data.data.lines || [])
      .filter(l => l.remaining_quantity > 0)
      .map(l => ({ pr_line_item_id: l.pr_line_item_id, description: l.description, max: l.remaining_quantity, quantity: l.remaining_quantity, selected: true }));
  };

  const buildLinesPayload = (selections) => selections.filter(s => s.selected && s.quantity > 0).map(s => ({ pr_line_item_id: s.pr_line_item_id, quantity: s.quantity }));

  const openCreateRfqModal = async () => {
    if (vendors.length === 0) {
      try { const res = await api.get('/vendors', { params: { limit: 500 } }); setVendors(res.data.data || []); } catch { /* ignore */ }
    }
    setRfqVendorIds([]);
    setRfqDeadline(null);
    try { setRfqLineSelections(await fetchAllocationSelections(prDetail.id)); } catch { setRfqLineSelections([]); }
    setRfqModalOpen(true);
  };

  const handleCreateRfq = async () => {
    if (!rfqVendorIds.length || !rfqDeadline) { message.error('Select vendors and a submission deadline'); return; }
    const lines = buildLinesPayload(rfqLineSelections);
    if (lines.length === 0) { message.error('Select at least one line item'); return; }
    setActionLoading(true);
    try {
      const res = await api.post(`/pr/${prDetail.id}/create-rfq`, {
        vendor_ids: rfqVendorIds,
        submission_deadline: rfqDeadline.toISOString(),
        lines,
      });
      message.success(`RFQ ${res.data.data.rfq_number} created`);
      setRfqModalOpen(false);
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to create RFQ'); }
    setActionLoading(false);
  };

  const openCreatePoModal = async () => {
    if (vendors.length === 0) {
      try { const res = await api.get('/vendors', { params: { limit: 500 } }); setVendors(res.data.data || []); } catch { /* ignore */ }
    }
    setPoVendorId(prDetail?.preferred_vendor_id || null);
    try { setPoLineSelections(await fetchAllocationSelections(prDetail.id)); } catch { setPoLineSelections([]); }
    setPoModalOpen(true);
  };

  const handleCreatePo = async () => {
    if (prDetail.sourcing_strategy !== 'CONTRACT_BASED' && !poVendorId) { message.error('Select a vendor'); return; }
    const lines = buildLinesPayload(poLineSelections);
    if (lines.length === 0) { message.error('Select at least one line item'); return; }
    setActionLoading(true);
    try {
      const res = await api.post(`/pr/${prDetail.id}/create-po`, { vendor_id: poVendorId || undefined, lines });
      message.success(`PO ${res.data.data.po_number} created`);
      setPoModalOpen(false);
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to create PO'); }
    setActionLoading(false);
  };

  // ── Create / edit page ───────────────────────────────────────────────────

  const computeTotal = (items) => items.reduce((sum, li) => sum + Number(li.quantity || 0) * Number(li.estimated_unit_price || 0), 0);

  const openCreatePage = () => {
    setEditingId(null);
    createForm.resetFields();
    setCreateLineItems([emptyLineItem()]);
    setInsights({ recommendation: null, budget: null });
    if (vendors.length === 0) api.get('/vendors', { params: { limit: 500 } }).then(r => setVendors(r.data.data || [])).catch(() => {});
    if (contracts.length === 0) api.get('/contracts', { params: { status: 'active' } }).then(r => setContracts(r.data.data || [])).catch(() => {});
    if (itemMasterList.length === 0) api.get('/item-master').then(r => setItemMasterList(r.data.data || [])).catch(() => {});
    setView('create');
  };

  const downloadPrPdf = async (prToDownload) => {
    try {
      const res = await api.get(`/pr/${prToDownload.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prToDownload.pr_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      message.error('Failed to download PR PDF');
    }
  };

  const openEditPage = (pr) => {
    setEditingId(pr.id);
    createForm.setFieldsValue({
      ...pr,
      required_date: pr.required_date ? dayjs(pr.required_date) : null,
    });
    setCreateLineItems((pr.line_items || []).map(li => ({ ...li, delivery_date: li.delivery_date ? dayjs(li.delivery_date) : null })));
    if (vendors.length === 0) api.get('/vendors', { params: { limit: 500 } }).then(r => setVendors(r.data.data || [])).catch(() => {});
    if (contracts.length === 0) api.get('/contracts', { params: { status: 'active' } }).then(r => setContracts(r.data.data || [])).catch(() => {});
    if (itemMasterList.length === 0) api.get('/item-master').then(r => setItemMasterList(r.data.data || [])).catch(() => {});
    setView('create');
  };

  const addLineItem = () => setCreateLineItems(prev => [...prev, emptyLineItem()]);
  const removeLineItem = (idx) => setCreateLineItems(prev => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx, field, value) => setCreateLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  const selectLineItemMaster = (idx, itemMasterId) => {
    const item = itemMasterList.find(im => im.id === itemMasterId);
    setCreateLineItems(prev => prev.map((li, i) => i === idx ? {
      ...li, item_master_id: itemMasterId,
      description: item ? item.item_description : li.description,
      uom: item ? item.uom : li.uom,
      estimated_unit_price: item?.standard_cost ?? li.estimated_unit_price,
    } : li));
  };

  const uploadLineItemAttachment = async (idx, file, onSuccess, onError) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/file', formData);
      updateLineItem(idx, 'attachment_path', res.data.data.file_path);
      updateLineItem(idx, 'attachment_name', res.data.data.file_name);
      message.success('Attachment uploaded');
      onSuccess(res.data);
    } catch (err) {
      message.error('Attachment upload failed');
      onError(err);
    }
  };

  // Live "System Insights" — refetch the stateless recommendation/budget
  // endpoints whenever the inputs that feed them change.
  useEffect(() => {
    if (view !== 'create') return;
    refreshInsights();
  }, [view, createLineItems]);

  const refreshInsights = () => {
    const totalValue = computeTotal(createLineItems);
    const costCenter = createForm.getFieldValue('cost_center');
    const preferredVendorId = createForm.getFieldValue('preferred_vendor_id');
    const contractId = createForm.getFieldValue('contract_id');
    api.get('/pr/recommend-sourcing', { params: { total_value: totalValue, preferred_vendor_id: preferredVendorId, contract_id: contractId } })
      .then(r => setInsights(prev => ({ ...prev, recommendation: r.data.data }))).catch(() => {});
    api.get('/pr/budget-check', { params: { cost_center: costCenter, total_value: totalValue } })
      .then(r => setInsights(prev => ({ ...prev, budget: r.data.data }))).catch(() => {});
  };

  const buildPayload = async () => {
    const values = await createForm.validateFields();
    if (createLineItems.some(li => !li.description || !li.quantity)) {
      throw { lineItemError: true };
    }
    return {
      ...values,
      required_date: values.required_date ? values.required_date.format('YYYY-MM-DD') : null,
      line_items: createLineItems.map(li => ({ ...li, delivery_date: li.delivery_date ? li.delivery_date.format('YYYY-MM-DD') : null })),
    };
  };

  const handleSaveDraft = async () => {
    try {
      const payload = await buildPayload();
      setSaving(true);
      if (editingId) {
        await api.put(`/pr/${editingId}`, payload);
        message.success('Requisition updated');
      } else {
        await api.post('/pr', payload);
        message.success('Requisition saved as draft');
      }
      setView('list');
    } catch (e) {
      if (e.lineItemError) { message.error('Enter description and quantity for every line item'); return; }
      if (e.errorFields) return;
      message.error(e.response?.data?.error || 'Failed to save requisition');
    }
    setSaving(false);
  };

  const handleSaveAndSubmit = async () => {
    try {
      const payload = await buildPayload();
      setSaving(true);
      let id = editingId;
      if (id) await api.put(`/pr/${id}`, payload);
      else { const res = await api.post('/pr', payload); id = res.data.data.id; }
      try {
        await api.post(`/pr/${id}/submit`);
        message.success('Requisition saved and submitted for approval');
      } catch (submitErr) {
        message.warning(submitErr.response?.data?.error || 'Saved as draft, but submission failed');
      }
      setView('list');
    } catch (e) {
      if (e.lineItemError) { message.error('Enter description and quantity for every line item'); return; }
      if (e.errorFields) return;
      message.error(e.response?.data?.error || 'Failed to save requisition');
    }
    setSaving(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════

  const isApproverOf = (row) => row.current_approver_role ? (user.role === row.current_approver_role || user.role === 'mdm_admin') : user.role === 'mdm_admin';

  const columns = [
    { title: 'PR No.', dataIndex: 'pr_number', render: (v, row) => <a onClick={() => openDetail(row)}><Text strong>{v}</Text></a> },
    { title: 'Requester', dataIndex: 'requester_name', render: v => v || <Text type="secondary">—</Text> },
    { title: 'Department', dataIndex: 'department' },
    { title: 'Value', dataIndex: 'total_value', render: v => Number(v || 0).toLocaleString() },
    { title: 'Status', dataIndex: 'status', render: s => <StatusTag status={s} /> },
    { title: 'Priority', dataIndex: 'priority', render: v => <Tag color={PRIORITY_COLOR[v]}>{v}</Tag> },
    { title: 'Sourcing', dataIndex: 'sourcing_strategy', render: v => SOURCING_LABELS[v] || v },
    {
      title: 'Quick Actions',
      key: 'actions',
      render: (_, row) => (
        <Space>
          {row.status === 'submitted' && isApproverOf(row) && (
            <Popconfirm title="Approve this requisition?" onConfirm={async () => { await api.post(`/pr/${row.id}/approve`); message.success('Approved'); fetchList(); }}>
              <Button size="small" icon={<CheckOutlined />}>Approve</Button>
            </Popconfirm>
          )}
          {['approved', 'sourcing'].includes(row.status) && row.sourcing_strategy !== 'CONTRACT_BASED' && (
            <Button size="small" icon={<FileTextOutlined />} onClick={() => openDetail(row)}>RFQ</Button>
          )}
          {['approved', 'sourcing'].includes(row.status) && row.sourcing_strategy !== 'RFQ_REQUIRED' && (
            <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => openDetail(row)}>PO</Button>
          )}
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadPrPdf(row)}>PDF</Button>
          <Button size="small" type="link" onClick={() => openDetail(row)}>View →</Button>
        </Space>
      ),
    },
  ];

  if (view === 'list') {
    return (
      <div style={{ padding: '24px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>Purchase Requisitions</Title>
            <Text type="secondary">Single source of truth for procurement demand</Text>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePage}>New Requisition</Button>
          </Col>
        </Row>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Select allowClear placeholder="Status" style={{ width: 160 }} value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))}
              options={['draft', 'submitted', 'approved', 'partially_approved', 'sourcing', 'closed', 'rejected'].map(s => ({ value: s, label: s.replace('_', ' ') }))} />
            <Select allowClear showSearch placeholder="Department" style={{ width: 160 }} value={filters.department} onChange={v => setFilters(f => ({ ...f, department: v }))}
              options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} />
            <Select allowClear placeholder="Priority" style={{ width: 140 }} value={filters.priority} onChange={v => setFilters(f => ({ ...f, priority: v }))}
              options={(subMasters.priority || []).map(s => ({ value: s.name, label: s.name }))} />
            <Button onClick={fetchList}>Apply</Button>
            <Button onClick={() => setFilters({ status: undefined, department: undefined, priority: undefined })}>Clear</Button>
          </Space>
        </Card>

        <Card bodyStyle={{ padding: 0 }}>
          <Table columns={columns} dataSource={prList} rowKey="id" loading={listLoading} size="middle" pagination={{ pageSize: 15 }} />
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CREATE / EDIT VIEW
  // ═══════════════════════════════════════════════════════════════════════

  if (view === 'create') {
    const totalValue = computeTotal(createLineItems);
    return (
      <div style={{ padding: '24px' }}>
        <Row align="middle" style={{ marginBottom: 16 }}>
          <Col><Button icon={<ArrowLeftOutlined />} onClick={() => setView('list')} style={{ marginRight: 12 }}>Back</Button></Col>
          <Col flex="auto"><Title level={4} style={{ margin: 0 }}>{editingId ? 'Edit Requisition' : 'New Requisition'}</Title></Col>
        </Row>

        <Card title="Basic Information" size="small" style={{ marginBottom: 16 }}>
          <Form form={createForm} layout="vertical" onValuesChange={refreshInsights}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="document_type" label="Document Type" initialValue="Standard" rules={[{ required: isRequired('document_type', false) }]}>
                  <Select options={(subMasters.document_type || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}>
                  <Select showSearch placeholder="Select department" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="priority" label="Priority" initialValue="Medium" rules={[{ required: isRequired('priority', false) }]}>
                  <Select options={(subMasters.priority || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="required_date" label="Required Date" rules={[{ required: isRequired('required_date', false) }]}>
                  <DatePicker style={{ width: '100%' }} disabledDate={d => d && d.isBefore(dayjs().startOf('day'))} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="company_code" label="Company Code" rules={[{ required: isRequired('company_code', false) }]}>
                  <Select allowClear showSearch placeholder="Select company" options={(subMasters.company || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="plant" label="Plant" rules={[{ required: isRequired('plant', false) }]}>
                  <Select allowClear showSearch placeholder="Select plant" options={(subMasters.plant || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="cost_center" label="Cost Center" rules={[{ required: isRequired('cost_center', false) }]}>
                  <Select allowClear showSearch placeholder="Select cost center" options={(subMasters.cost_center || []).map(s => ({ value: s.name, label: s.name }))} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="project_code" label="Project Code" rules={[{ required: isRequired('project_code', false) }]}><Input /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="justification" label="Justification" rules={[{ required: isRequired('justification', true), message: 'Justification is required' }]}>
              <TextArea rows={2} placeholder="Why is this requisition needed?" />
            </Form.Item>

            <Divider orientation="left">Line Items</Divider>
            {createLineItems.map((li, idx) => (
              <div key={idx} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                <Row gutter={8} align="middle">
                  <Col span={5}>
                    <Select showSearch allowClear placeholder="Item (master, optional)" optionFilterProp="children" style={{ width: '100%' }}
                      value={li.item_master_id || undefined} onChange={v => selectLineItemMaster(idx, v)}>
                      {itemMasterList.map(im => <Option key={im.id} value={im.id}>{im.item_code} — {im.item_description}</Option>)}
                    </Select>
                  </Col>
                  <Col span={5}><Input placeholder="Description" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} /></Col>
                  <Col span={2}><InputNumber style={{ width: '100%' }} min={0.001} placeholder="Qty" value={li.quantity} onChange={v => updateLineItem(idx, 'quantity', v)} /></Col>
                  <Col span={2}><Input placeholder="UOM" value={li.uom} onChange={e => updateLineItem(idx, 'uom', e.target.value)} /></Col>
                  <Col span={3}><InputNumber style={{ width: '100%' }} min={0} placeholder="Est. unit price" value={li.estimated_unit_price} onChange={v => updateLineItem(idx, 'estimated_unit_price', v)} /></Col>
                  <Col span={4}><DatePicker style={{ width: '100%' }} placeholder="Delivery date" value={li.delivery_date} onChange={v => updateLineItem(idx, 'delivery_date', v)} /></Col>
                  <Col span={2}><Button icon={<DeleteOutlined />} danger type="text" onClick={() => removeLineItem(idx)} disabled={createLineItems.length === 1} /></Col>
                </Row>
                <Row gutter={8} align="middle" style={{ marginTop: 8 }}>
                  <Col span={5}>
                    <Select allowClear showSearch placeholder="Delivery location" style={{ width: '100%' }}
                      value={li.delivery_location || undefined} onChange={v => updateLineItem(idx, 'delivery_location', v)}
                      options={(subMasters.city || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Col>
                  <Col span={4}>
                    <Select allowClear showSearch placeholder="Storage location" style={{ width: '100%' }}
                      value={li.storage_location || undefined} onChange={v => updateLineItem(idx, 'storage_location', v)}
                      options={(subMasters.storage_location || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Col>
                  <Col span={4}>
                    {li.attachment_path ? (
                      <Space>
                        <AttachmentLink path={li.attachment_path} name={li.attachment_name} />
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => updateLineItem(idx, 'attachment_path', null)} />
                      </Space>
                    ) : (
                      <Upload showUploadList={false} customRequest={({ file, onSuccess, onError }) => uploadLineItemAttachment(idx, file, onSuccess, onError)}>
                        <Button size="small" icon={<UploadOutlined />}>Attach</Button>
                      </Upload>
                    )}
                  </Col>
                  <Col span={11}>
                    <Space size="middle">
                      <Checkbox checked={li.gr_required} onChange={e => updateLineItem(idx, 'gr_required', e.target.checked)}>GR Required</Checkbox>
                      <Checkbox checked={li.ir_required} onChange={e => updateLineItem(idx, 'ir_required', e.target.checked)}>IR Required</Checkbox>
                      <Checkbox checked={li.partial_delivery_allowed} onChange={e => updateLineItem(idx, 'partial_delivery_allowed', e.target.checked)}>Partial Delivery OK</Checkbox>
                    </Space>
                  </Col>
                </Row>
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addLineItem} block>Add Line Item</Button>
          </Form>
        </Card>

        <Collapse style={{ marginBottom: 16 }} items={[{
          key: 'smart',
          label: 'Smart Controls — Sourcing Strategy & Account Assignment',
          children: (
            <Form form={createForm} layout="vertical" component={false} onValuesChange={refreshInsights}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="sourcing_strategy" label="Sourcing Strategy" initialValue="RFQ_REQUIRED" rules={[{ required: isRequired('sourcing_strategy', true) }]}>
                    <Select options={Object.entries(SOURCING_LABELS).map(([value, label]) => ({ value, label }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="account_assignment_category" label="Account Assignment" initialValue="Cost Center" rules={[{ required: isRequired('account_assignment_category', false) }]}>
                    <Select options={(subMasters.account_assignment_category || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="currency" label="Currency" initialValue="INR" rules={[{ required: isRequired('currency', false) }]}>
                    <Select options={(subMasters.currency || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="preferred_vendor_id" label="Preferred Vendor" rules={[{ required: isRequired('preferred_vendor_id', false) }]}>
                    <Select allowClear showSearch placeholder="Used for Direct PO / Auto PO" optionFilterProp="label"
                      options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="contract_id" label="Contract" rules={[{ required: isRequired('contract_id', false) }]}>
                    <Select allowClear showSearch placeholder="Required for Contract-Based sourcing" optionFilterProp="label"
                      options={contracts.map(c => ({ value: c.id, label: `${c.contract_number} — ${c.title}` }))} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          ),
        }]} />

        <Card title="System Insights" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}><Statistic title="Total Value" value={totalValue} precision={2} /></Col>
            <Col span={9}>
              <Text type="secondary">Budget Status</Text><br />
              {insights.budget ? (
                <>
                  <Tag color={BUDGET_COLOR[insights.budget.budget_status]}>{insights.budget.budget_status.replace('_', ' ').toUpperCase()}</Tag>
                  {insights.budget.remaining_amount != null && <Text type="secondary"> — remaining: {Number(insights.budget.remaining_amount).toLocaleString()}</Text>}
                </>
              ) : <Text type="secondary">—</Text>}
            </Col>
            <Col span={9}>
              <Text type="secondary">Sourcing Recommendation</Text><br />
              {insights.recommendation ? (
                <>
                  <Tag color="purple">{SOURCING_LABELS[insights.recommendation.recommended_strategy]}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}> {insights.recommendation.reason}</Text>
                </>
              ) : <Text type="secondary">—</Text>}
            </Col>
          </Row>
        </Card>

        <Space>
          <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={handleSaveAndSubmit}>Save & Submit</Button>
          <Button icon={<EditOutlined />} loading={saving} onClick={handleSaveDraft}>Save as Draft</Button>
          <Button onClick={() => setView('list')}>Cancel</Button>
        </Space>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════

  const pr = prDetail || selectedPr;
  const isApprover = pr ? isApproverOf(pr) : false;
  // Editable at any status, right up until a PO has actually been created
  // from one of its lines (the backend enforces this too — this just decides
  // whether to show the button).
  const hasPoCreated = !!prDetail?.line_items?.some(li => li.linked_po_ids?.length > 0);

  const tabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab pr={pr} isApprover={isApprover} onSubmit={handleSubmit} onApprove={handleApprove} onOpenReject={() => setRejectModalOpen(true)} onOpenCreateRfq={openCreateRfqModal} onOpenCreatePo={openCreatePoModal} actionLoading={actionLoading} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={prDetail?.line_items} /> },
    { key: 'workflow', label: <span><ApartmentOutlined /> Workflow Timeline</span>, children: <WorkflowTimelineTab timeline={workflowTimeline} loading={timelineLoading} /> },
    { key: 'document-flow', label: <span><NodeIndexOutlined /> Document Flow</span>, children: <DocumentFlowTab flow={documentFlow} loading={flowLoading} /> },
    { key: 'attachments', label: <span><PaperClipOutlined /> Attachments</span>, children: <AttachmentsTab attachments={attachments} loading={attachmentsLoading} uploading={uploadingAttachment} onUpload={uploadOverallAttachment} onDelete={deleteAttachment} /> },
    { key: 'audit', label: <span><AuditOutlined /> Audit Log</span>, children: <AuditLogTab logs={auditLogs} loading={auditLoading} /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col><Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginRight: 12 }}>Back</Button></Col>
        <Col flex="auto"><Title level={4} style={{ margin: 0 }}>{pr?.pr_number} — {pr?.department}</Title></Col>
        <Col>
          {pr && (
            <Button icon={<FilePdfOutlined />} style={{ marginRight: 8 }} onClick={() => downloadPrPdf(pr)}>PDF</Button>
          )}
          {pr && !hasPoCreated && (
            <Button icon={<EditOutlined />} style={{ marginRight: 8 }} onClick={() => openEditPage(prDetail)}>Edit</Button>
          )}
          <StatusTag status={pr?.status} />
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={onTabChange} items={tabs} type="card" loading={detailLoading} />

      <Modal title="Reject Requisition" open={rejectModalOpen} onCancel={() => setRejectModalOpen(false)} onOk={handleReject} okText="Reject" okButtonProps={{ danger: true, loading: actionLoading }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Remarks are required so the requester knows what to fix.</Text>
        <TextArea rows={3} placeholder="Reason for rejection (required)" value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)} status={!rejectRemarks.trim() ? 'warning' : undefined} />
      </Modal>

      <Modal title="Create RFQ from Requisition" open={rfqModalOpen} onCancel={() => setRfqModalOpen(false)} onOk={handleCreateRfq} okText="Create RFQ" okButtonProps={{ loading: actionLoading }} width={640}>
        <Form layout="vertical">
          <Form.Item label="Invite Vendors" required>
            <Select mode="multiple" placeholder="Select vendors" value={rfqVendorIds} onChange={setRfqVendorIds} optionFilterProp="label"
              options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
          </Form.Item>
          <Form.Item label="Submission Deadline" required>
            <DatePicker showTime style={{ width: '100%' }} value={rfqDeadline} onChange={setRfqDeadline} disabledDate={d => d && d.isBefore(dayjs())} />
          </Form.Item>
          <Form.Item label="Line Items & Quantities">
            <LineSelectionTable selections={rfqLineSelections} setSelections={setRfqLineSelections} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Create PO from Requisition" open={poModalOpen} onCancel={() => setPoModalOpen(false)} onOk={handleCreatePo} okText="Create PO" okButtonProps={{ loading: actionLoading }} width={640}>
        {pr?.sourcing_strategy === 'CONTRACT_BASED' ? (
          <Alert type="info" showIcon message="Vendor and payment terms will be pulled automatically from the linked contract." style={{ marginBottom: 16 }} />
        ) : (
          <Form layout="vertical">
            <Form.Item label="Vendor" required>
              <Select showSearch placeholder="Select vendor" value={poVendorId} onChange={setPoVendorId} optionFilterProp="label"
                options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
            </Form.Item>
          </Form>
        )}
        <Form layout="vertical">
          <Form.Item label="Line Items & Quantities">
            <LineSelectionTable selections={poLineSelections} setSelections={setPoLineSelections} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
