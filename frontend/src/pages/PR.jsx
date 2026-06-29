import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table, Button, Tag, Space, Card, Typography, Row, Col, Tabs,
  Form, Input, InputNumber, DatePicker, Select, Divider, Checkbox, Upload,
  message, Statistic, Alert, Timeline, Popconfirm, Badge, Empty, Tooltip, Dropdown, Skeleton, Steps,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, ApartmentOutlined, NodeIndexOutlined, AuditOutlined,
  DeleteOutlined, ShoppingCartOutlined, FileDoneOutlined, EditOutlined,
  UploadOutlined, PaperClipOutlined, FilePdfOutlined, BulbOutlined,
  MoreOutlined, WarningOutlined, DownOutlined, StopOutlined,
} from '@ant-design/icons';
import DecisionPanel from '../components/DecisionPanel';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { API_BASE_URL } from '../config';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import SmartAssistantPanel from '../components/SmartAssistantPanel';
import PageHeader from '../components/ui/PageHeader';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import CompanySelector from '../components/CompanySelector';
import CostCentreDropdown from '../components/CostCentreDropdown';
import VendorDropdown from '../components/VendorDropdown';
import InactiveCompanyBadge from '../components/InactiveCompanyBadge';

const UPLOAD_BASE = `${API_BASE_URL}/`;

function AttachmentLink({ path, name }) {
  if (!path) return null;
  return <a href={`${UPLOAD_BASE}${path}`} target="_blank" rel="noopener noreferrer"><PaperClipOutlined /> {name || 'View attachment'}</a>;
}

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Aligned to the app-wide status palette: green = approved/success, blue = in
// progress, orange = attention required, red = rejected/error, grey = draft/inactive.
const STATUS_COLOR = { draft: 'default', submitted: 'blue', approved: 'green', partially_approved: 'green', sourcing: 'blue', closed: 'green', rejected: 'red' };
// "Critical" (not "Urgent") to match the same top-severity wording used by
// Tickets and Audit Findings elsewhere in the app.
const PRIORITY_COLOR = { Low: 'default', Medium: 'blue', High: 'orange', Critical: 'red' };
const SOURCING_LABELS = {
  RFQ_REQUIRED: 'RFQ Required',
  DIRECT_PO_ALLOWED: 'Direct PO Allowed',
  AUTO_PO: 'Auto PO',
  CONTRACT_BASED: 'Contract Based',
};
const BUDGET_COLOR = { within_budget: 'green', exceeds_budget: 'red', not_configured: 'default' };

// PR List "Insight" column + row-priority border — a single, ranked rule
// derived entirely from data the list already carries (rfq_line_count /
// blocking_line_count, both additive read-only subqueries on the existing
// list endpoint) plus a one-time bulk fetch of open budget_breach exceptions
// (the existing Exception Engine — no per-row API calls, no new detection
// logic). First matching rule wins; this is the same priority order used for
// both the badge text and the row's highlight class.
function getPrInsight(row, hasBudgetBreach) {
  if (Number(row.blocking_line_count) > 0) {
    return { label: `${row.blocking_line_count} line(s) need approval`, severity: 'warning', action: 'approve_lines' };
  }
  if (row.status === 'submitted') {
    return { label: 'Pending Approval', severity: 'warning', action: 'approve' };
  }
  if (hasBudgetBreach) {
    return { label: 'Budget Exceeded', severity: 'critical', action: 'view' };
  }
  if (row.sourcing_strategy === 'RFQ_REQUIRED' && ['approved', 'sourcing'].includes(row.status) && Number(row.rfq_line_count) === 0) {
    return { label: 'RFQ Required — Not Created', severity: 'critical', action: 'create_rfq' };
  }
  if (['approved', 'sourcing'].includes(row.status) && row.sourcing_strategy !== 'RFQ_REQUIRED') {
    return { label: 'Ready for PO', severity: 'healthy', action: 'create_po' };
  }
  if (row.status === 'closed' || row.status === 'approved') {
    return { label: 'Completed', severity: 'healthy', action: 'view' };
  }
  return { label: null, severity: 'healthy', action: 'view' };
}

const INSIGHT_SEVERITY_TAG_COLOR = { critical: 'red', warning: 'orange', healthy: 'green' };
const INSIGHT_ROW_CLASS = { critical: 'row-highlight-critical', warning: 'row-highlight-warning', healthy: 'row-highlight-healthy' };

// PR Detail "Next Best Action" — same ranked-rule idea as getPrInsight, but
// computed from the full detail payload (every line item, not just the
// list's two count subqueries) plus the eagerly-fetched Intelligence data,
// since the detail page has both already loaded.
function getNextBestAction(pr, prDetail, intelligence) {
  // No actions for terminal states
  if (['closed', 'rejected'].includes(pr?.status)) {
    return { action: null, label: 'No action needed', reason: 'This requisition is closed.' };
  }

  const lines = prDetail?.line_items || [];
  const blockingCount = lines.filter(li => li.requires_line_approval && li.approval_status === 'pending').length;
  const hasRfq = lines.some(li => li.linked_rfq_ids?.length > 0);

  if (blockingCount > 0) {
    return { action: 'approve_lines', label: `Review ${blockingCount} line(s) needing approval`, reason: 'These lines exceeded the value/category threshold and need individual sign-off before this requisition can finalize.' };
  }
  if (pr?.status === 'submitted') {
    return { action: 'approve', label: 'Approve this requisition', reason: 'This requisition is awaiting your approval.' };
  }
  if (intelligence?.budget?.budget_status === 'exceeds_budget' && ['draft', 'submitted'].includes(pr?.status)) {
    return { action: 'resolve_budget', label: 'Resolve budget breach', reason: `This requisition exceeds the remaining budget (remaining: ${Number(intelligence.budget.remaining_amount ?? 0).toLocaleString()}).` };
  }
  if (pr?.sourcing_strategy === 'RFQ_REQUIRED' && ['approved', 'sourcing'].includes(pr?.status) && !hasRfq) {
    return { action: 'create_rfq', label: 'Create RFQ (Recommended)', reason: 'Sourcing strategy requires an RFQ and none has been created from this requisition yet.' };
  }
  if (['approved', 'sourcing'].includes(pr?.status) && pr?.sourcing_strategy !== 'RFQ_REQUIRED') {
    return { action: 'create_po', label: 'Create PO (Recommended)', reason: 'This requisition is approved and ready for purchase order creation.' };
  }
  return { action: null, label: 'No action needed', reason: 'This requisition is on track — nothing is blocking it right now.' };
}

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
          <Col span={6}><Text type="secondary">Company / Plant</Text><br /><Text strong>{[pr.company_name, pr.plant].filter(Boolean).join(' / ') || '—'}</Text></Col>
        </Row>
      </Card>

      {pr.status === 'rejected' && pr.rejection_reason && (
        <Alert type="error" showIcon message="Requisition rejected" description={pr.rejection_reason} />
      )}
      {pr.status === 'closed' && pr.closure_reason && (
        <Alert type="warning" showIcon message="Requisition closed without further processing" description={pr.closure_reason} />
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

// Line-Level Approval: lines flagged requires_line_approval (value/category
// threshold, decided at submit time) carry their own approve/reject controls
// here, independent of the requisition-wide Approve/Reject buttons in the
// Overview tab — those buttons refuse to finalize while any such line is
// still pending (see /:id/approve's blocking-line check on the backend).
function LineItemsTab({ lineItems, pr, isApprover, actionLoading, onApproveLine, onOpenRejectLine }) {
  const canActOnLines = pr?.status === 'submitted' && isApprover;
  // Tooltip explainability: the line-approval value threshold is the only
  // piece of "why" a line was flagged that isn't already on the line row
  // itself (the other trigger, category match, is item-master-side — if a
  // line's value is under threshold but still flagged, category must be why,
  // so no second lookup is needed to give an accurate explanation either way).
  const [valueThreshold, setValueThreshold] = useState(null);
  useEffect(() => {
    api.get('/system/settings/pr_line_approval_value_threshold')
      .then(res => setValueThreshold(Number(res.data?.data?.value ?? 200000)))
      .catch(() => setValueThreshold(200000));
  }, []);

  return (
    <Table
      size="middle"
      pagination={false}
      rowKey="id"
      dataSource={lineItems || []}
      rowClassName={(r) => (r.requires_line_approval && r.approval_status === 'pending' ? 'pr-line-needs-approval' : '')}
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
        {
          title: 'Line Approval', key: 'line_approval', width: 240,
          render: (_, r) => {
            if (!r.requires_line_approval) return <Text type="secondary">Not required</Text>;
            const color = r.approval_status === 'approved' ? 'green' : r.approval_status === 'rejected' ? 'red' : 'orange';
            const exceedsValue = valueThreshold != null && Number(r.estimated_total_price || 0) >= valueThreshold;
            const whyTitle = exceedsValue
              ? `Line value (${Number(r.estimated_total_price).toLocaleString()}) meets or exceeds the ₹${valueThreshold.toLocaleString()} line-approval threshold.`
              : "This item's category is on the restricted list and always requires individual approval, regardless of value.";
            const tag = (r.approval_status || 'pending') === 'pending'
              ? (
                <Tooltip title={whyTitle}>
                  <Badge status="warning" text={<Tag color={color} style={{ marginLeft: 2 }}>APPROVAL REQUIRED</Tag>} />
                </Tooltip>
              )
              : <Tag color={color}>{r.approval_status.toUpperCase()}</Tag>;
            if (!canActOnLines || r.approval_status !== 'pending') {
              return r.approval_status === 'rejected' && r.rejection_remarks
                ? <Space direction="vertical" size={0}>{tag}<Text type="secondary" style={{ fontSize: 12 }}>{r.rejection_remarks}</Text></Space>
                : tag;
            }
            return (
              <Space>
                {tag}
                <Button size="small" icon={<CheckOutlined />} loading={actionLoading} onClick={() => onApproveLine(r.id)} />
                <Button size="small" danger icon={<CloseOutlined />} loading={actionLoading} onClick={() => onOpenRejectLine(r)} />
              </Space>
            );
          },
        },
      ]}
    />
  );
}

// PR Intelligence Panel — composes ProcurementInsightsService.getPRInsights():
// live budget position, sourcing-strategy sanity check, the resolved vendor's
// score, and a per-line table of last purchase price / price variance /
// preferred vendors / contract availability for every line on the requisition.
function IntelligenceTab({ data, loading, prId }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>;
  if (!data) return <Empty description="No intelligence data available" />;

  const panel = data.intelligence_panel || [];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <SmartAssistantPanel entityType="pr" entityId={prId} />

      {data.insights?.length > 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {data.insights.map((insight, idx) => (
            <Alert
              key={idx}
              type={insight.severity === 'critical' ? 'error' : insight.severity === 'warning' ? 'warning' : 'info'}
              showIcon
              message={insight.message}
            />
          ))}
        </Space>
      )}

      <Row gutter={16}>
        <Col span={6}><Statistic title="Live Budget Status" valueRender={() => <Tag color={BUDGET_COLOR[data.budget?.budget_status] || 'default'}>{(data.budget?.budget_status || 'not_configured').replace('_', ' ').toUpperCase()}</Tag>} /></Col>
        <Col span={6}><Statistic title="Remaining Budget" value={data.budget?.remaining_amount ?? '—'} /></Col>
        <Col span={6}><Statistic title="Recommended Sourcing" valueRender={() => <Tag color="purple">{SOURCING_LABELS[data.sourcing_recommendation?.recommended_strategy] || '—'}</Tag>} /></Col>
        <Col span={6}>
          <Statistic title="Contract Opportunity" valueRender={() => (
            data.contract_usage?.contract_available_not_used
              ? <Tag color="orange">Unused contract available</Tag>
              : <Tag color="default">—</Tag>
          )} />
        </Col>
      </Row>

      {data.vendor_score && (
        <Card title={`Vendor Score — ${data.vendor_score.vendor.vendor_name}`} size="small">
          <Row gutter={16}>
            <Col span={6}><Statistic title="Performance Score" value={data.vendor_score.performance_score ?? '—'} suffix={data.vendor_score.performance_score != null ? '/ 100' : ''} /></Col>
            <Col span={6}><Statistic title="Risk Level" valueRender={() => <Tag color={data.vendor_score.risk.risk_level === 'high' ? 'red' : data.vendor_score.risk.risk_level === 'medium' ? 'orange' : 'green'}>{(data.vendor_score.risk.risk_level || '—').toUpperCase()}</Tag>} /></Col>
            <Col span={6}><Statistic title="Price Competitiveness" value={data.vendor_score.price_competitiveness.score ?? '—'} suffix={data.vendor_score.price_competitiveness.score != null ? '/ 100' : ''} /></Col>
            <Col span={6}><Statistic title="Active Contract" valueRender={() => <Tag color={data.vendor_score.contract_summary.has_active_contract ? 'green' : 'default'}>{data.vendor_score.contract_summary.has_active_contract ? 'YES' : 'NO'}</Tag>} /></Col>
          </Row>
        </Card>
      )}

      <Card title="Line-Level Intelligence" size="small">
        <Table
          size="small"
          pagination={false}
          rowKey="pr_line_item_id"
          dataSource={panel}
          columns={[
            { title: 'Description', dataIndex: 'description' },
            { title: 'Qty', dataIndex: 'quantity', width: 80, render: v => Number(v).toLocaleString() },
            { title: 'Est. Unit Price', dataIndex: 'estimated_unit_price', width: 120, render: v => v != null ? Number(v).toLocaleString() : <Text type="secondary">—</Text> },
            { title: 'Last Purchase Price', dataIndex: 'last_purchase_price', width: 140, render: v => v != null ? Number(v).toLocaleString() : <Text type="secondary">No history</Text> },
            {
              title: 'Price Variance', dataIndex: 'price_variance_pct', width: 120,
              render: v => v == null ? <Text type="secondary">—</Text> : (
                <Tag color={Math.abs(v) >= 10 ? (v > 0 ? 'red' : 'blue') : 'green'}>{v > 0 ? '+' : ''}{v}%</Tag>
              ),
            },
            {
              title: 'Preferred Vendors', key: 'preferred_vendors', width: 240,
              render: (_, record) => {
                const tags = [];
                if (record.line_preferred_vendor) {
                  tags.push(<Tag key={`line-${record.line_preferred_vendor.vendor_id}`} color="gold">{record.line_preferred_vendor.vendor_name} (line pick)</Tag>);
                }
                (record.preferred_vendors || [])
                  .filter(v => v.vendor_id !== record.line_preferred_vendor?.vendor_id)
                  .forEach(v => tags.push(<Tag key={v.vendor_id} color={v.is_preferred ? 'purple' : 'default'}>{v.vendor_name}{!v.usable ? ' ⚠' : ''}</Tag>));
                return tags.length ? <Space size={4} wrap>{tags}</Space> : <Text type="secondary">None mapped</Text>;
              },
            },
            {
              title: 'Contract Availability', key: 'contract_availability', width: 160,
              render: (_, record) => record.contract_availability?.has_active_contract
                ? <Tag color="green">{record.contract_availability.vendors_with_contract.length} vendor(s)</Tag>
                : <Tag color="default">None</Tag>,
            },
          ]}
        />
      </Card>
    </Space>
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
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');

  const [view, setView] = useState('list'); // list | detail | create
  const [prList, setPrList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [filters, setFilters] = useState({ status: undefined, department: undefined, priority: undefined });
  const [subMasters, setSubMasters] = useState({});
  const [prCompanies, setPrCompanies] = useState([]);
  const [budgetBreachPrIds, setBudgetBreachPrIds] = useState(new Set());
  const [expandedRowData, setExpandedRowData] = useState({}); // prId -> { loading, detail }

  useEffect(() => {
    (async () => {
      const cats = ['document_type', 'priority', 'account_assignment_category', 'currency', 'department', 'plant', 'cost_center', 'city', 'storage_location'];
      const results = {};
      for (const cat of cats) {
        try { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; } catch { results[cat] = []; }
      }
      setSubMasters(results);
    })();
    api.get('/companies?active_only=true').then(r => setPrCompanies(r.data.data || [])).catch(() => {});
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
  const [intelligence, setIntelligence] = useState(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [attachments, setAttachments] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const [lineActionLoading, setLineActionLoading] = useState(false);
  const [lineRejectTarget, setLineRejectTarget] = useState(null);
  const [lineRejectRemarks, setLineRejectRemarks] = useState('');

  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [rfqVendorIds, setRfqVendorIds] = useState([]);
  const [rfqDeadline, setRfqDeadline] = useState(null);
  const [rfqLineSelections, setRfqLineSelections] = useState([]);

  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poVendorId, setPoVendorId] = useState(null);
  const [poLineSelections, setPoLineSelections] = useState([]);
  const [poCompanyId, setPoCompanyId] = useState(null);

  // Create / edit page
  const [createForm] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [createLineItems, setCreateLineItems] = useState([emptyLineItem()]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [itemMasterList, setItemMasterList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [insights, setInsights] = useState({ recommendation: null, budget: null });
  const [createStep, setCreateStep] = useState(0); // 0 Basic Info | 1 Line Items | 2 Review & Insights | 3 Submit
  const [lineBenchmarks, setLineBenchmarks] = useState({}); // line idx -> { last_price, preferred_vendors } | 'loading'
  const [preferredVendorScore, setPreferredVendorScore] = useState(null);
  const [preferredVendorScoreLoading, setPreferredVendorScoreLoading] = useState(false);

  // ── Fetch list ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [listRes, exceptionsRes] = await Promise.all([
        api.get('/pr', { params }),
        // One bulk call (reuses the existing Exception Engine, no per-row
        // calls) so the Insight column can flag "Budget Exceeded" rows.
        api.get('/exceptions', { params: { module_name: 'purchase_requisition', exception_type: 'budget_breach', status: 'open', limit: 100 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setPrList(listRes.data.data || []);
      setBudgetBreachPrIds(new Set((exceptionsRes.data.data || []).map(e => e.record_id)));
    } catch { message.error('Failed to load requisitions'); }
    setListLoading(false);
  }, [filters]);

  useEffect(() => { if (view === 'list') fetchList(); }, [view, fetchList]);

  // ── Fetch detail ──────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    let detail = null;
    try {
      const res = await api.get(`/pr/${id}`);
      detail = res.data.data;
      setPrDetail(detail);
    } catch { message.error('Failed to load requisition'); }
    setDetailLoading(false);
    return detail;
  }, []);

  // `autoOpenAction` ('rfq' | 'po' | 'close' | undefined) lets the list's own
  // Create RFQ/PO/Close buttons jump straight into that panel, pre-populated,
  // instead of just landing on the Overview tab and leaving the user to find
  // and click the same button again — the panel needs the freshly-fetched PR
  // (line items, allocation), not the thin list row, so it's opened off the
  // fetchDetail() result rather than relying on state timing.
  const openDetail = (pr, autoOpenAction) => {
    setSelectedPr(pr);
    setPrDetail(null);
    setWorkflowTimeline(null);
    setDocumentFlow(null);
    setAuditLogs(null);
    setAttachments(null);
    setIntelligence(null);
    setActiveTab('overview');
    setView('detail');
    fetchDetail(pr.id).then(detail => {
      if (!detail) return;
      if (autoOpenAction === 'rfq') openCreateRfqModal(detail);
      else if (autoOpenAction === 'close') setCloseModalOpen(true);
      else if (autoOpenAction === 'po') openCreatePoModal(detail);
    });
    // Eager (not lazy-on-tab-click) — the Decision Bar and Next Best Action
    // section above the tabs need budget/sourcing/insight data immediately,
    // not only once the user clicks into the Insights tab.
    fetchIntelligence(pr.id);
  };

  const refreshDetail = () => selectedPr && fetchDetail(selectedPr.id);

  const handleBack = () => { setView('list'); setSelectedPr(null); setPrDetail(null); };

  // Deep-link support — e.g. the Control Tower's "View Source" action lands
  // here as /purchase-requisitions?id=<pr_id> and should jump straight to
  // that record's detail view rather than the list.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) openDetail({ id: deepLinkId });
  }, []);

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

  const fetchIntelligence = async (id) => {
    const prId = id || prDetail?.id;
    if (!prId) return;
    setIntelligenceLoading(true);
    try {
      const res = await api.get(`/insights/pr/${prId}`);
      setIntelligence(res.data.data);
    } catch { message.error('Failed to load PR intelligence'); }
    setIntelligenceLoading(false);
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
    if (key === 'insights' && !intelligence) fetchIntelligence();
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

  // Manual closure with a reason, at any point before the requisition is
  // already closed/rejected — distinct from Reject (pre-approval only) and
  // from the automatic closure that fires once every line is fully allocated
  // to RFQ/PO.
  const handleClosePr = async () => {
    if (!closeReason.trim()) { message.error('Closure reason is required'); return; }
    setActionLoading(true);
    try {
      await api.post(`/pr/${prDetail.id}/close`, { reason: closeReason });
      message.success('Requisition closed');
      setCloseModalOpen(false);
      setCloseReason('');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to close requisition'); }
    setActionLoading(false);
  };

  const handleApproveLine = async (lineId) => {
    setLineActionLoading(true);
    try {
      await api.put(`/pr/${prDetail.id}/lines/${lineId}/approve`);
      message.success('Line item approved');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to approve line item'); }
    setLineActionLoading(false);
  };

  const openLineReject = (line) => { setLineRejectTarget(line); setLineRejectRemarks(''); };

  const handleRejectLine = async () => {
    if (!lineRejectRemarks.trim()) { message.error('Rejection remarks are required'); return; }
    setLineActionLoading(true);
    try {
      await api.put(`/pr/${prDetail.id}/lines/${lineRejectTarget.id}/reject`, { remarks: lineRejectRemarks });
      message.success('Line item rejected');
      setLineRejectTarget(null);
      setLineRejectRemarks('');
      refreshDetail();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to reject line item'); }
    setLineActionLoading(false);
  };

  // ── Create RFQ / PO modals ───────────────────────────────────────────────

  const fetchAllocationSelections = async (prId) => {
    const res = await api.get(`/pr/${prId}/allocation`);
    return (res.data.data.lines || [])
      .filter(l => l.remaining_quantity > 0)
      .map(l => ({ pr_line_item_id: l.pr_line_item_id, description: l.description, max: l.remaining_quantity, quantity: l.remaining_quantity, selected: true }));
  };

  const buildLinesPayload = (selections) => selections.filter(s => s.selected && s.quantity > 0).map(s => ({ pr_line_item_id: s.pr_line_item_id, quantity: s.quantity }));

  const openCreateRfqModal = async (prOverride) => {
    const targetPr = prOverride || prDetail;
    if (!targetPr) { message.warning('Please wait for PR details to load'); return; }
    if (vendors.length === 0) {
      try { const res = await api.get('/vendors', { params: { limit: 500 } }); setVendors(res.data.data || []); } catch { /* ignore */ }
    }
    setRfqVendorIds([]);
    setRfqDeadline(null);
    try { setRfqLineSelections(await fetchAllocationSelections(targetPr.id)); } catch { setRfqLineSelections([]); }
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

  const openCreatePoModal = async (prOverride) => {
    const targetPr = prOverride || prDetail;
    if (!targetPr) return;
    if (vendors.length === 0) {
      try { const res = await api.get('/vendors', { params: { limit: 500 } }); setVendors(res.data.data || []); } catch { /* ignore */ }
    }
    setPoVendorId(targetPr?.preferred_vendor_id || null);
    try { setPoLineSelections(await fetchAllocationSelections(targetPr.id)); } catch { setPoLineSelections([]); }
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
    setCreateStep(0);
    setLineBenchmarks({});
    setPreferredVendorScore(null);
    setSelectedCompanyId(null);
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
    setCreateStep(0);
    setLineBenchmarks({});
    setPreferredVendorScore(null);
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

    // Real-time intelligence: last purchase price + preferred vendors for
    // this item, reusing the same ProcurementInsightsService.
    // getItemPriceBenchmark() the Item Master Price Insights tab and PR's
    // own Intelligence tab already call — no new computation.
    if (!itemMasterId) { setLineBenchmarks(prev => { const next = { ...prev }; delete next[idx]; return next; }); return; }
    setLineBenchmarks(prev => ({ ...prev, [idx]: 'loading' }));
    api.get(`/insights/items/${itemMasterId}/price-benchmark`)
      .then(res => setLineBenchmarks(prev => ({ ...prev, [idx]: res.data.data })))
      .catch(() => setLineBenchmarks(prev => ({ ...prev, [idx]: null })));
  };

  // Real-time intelligence: vendor risk score the moment a Preferred Vendor
  // is chosen in Sourcing & Account Assignment — reuses getVendorScore()
  // verbatim (same function Vendors' Intelligence tab and the Smart
  // Assistant call).
  const onPreferredVendorChange = (vendorId) => {
    if (!vendorId) { setPreferredVendorScore(null); return; }
    setPreferredVendorScoreLoading(true);
    api.get(`/insights/vendors/${vendorId}/score`)
      .then(res => setPreferredVendorScore(res.data.data))
      .catch(() => setPreferredVendorScore(null))
      .finally(() => setPreferredVendorScoreLoading(false));
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

  // Maps each create-form field to the wizard step it lives on, so a
  // validation failure — whether thrown client-side by AntD or returned by
  // the backend's own required-field check — can jump the user straight to
  // the right step instead of leaving them stuck on Step 3 wondering what's wrong.
  const PR_FIELD_TO_STEP = {
    department: 0, justification: 0, document_type: 0, priority: 0, required_date: 0,
    company_code: 0, plant: 0, cost_center: 0, project_code: 0,
    line_items: 1,
    sourcing_strategy: 2, account_assignment_category: 2, currency: 2, preferred_vendor_id: 2, contract_id: 2,
  };
  const PR_FIELD_LABELS = {
    department: 'Department', justification: 'Justification', line_items: 'Line Items',
    sourcing_strategy: 'Sourcing Strategy', cost_center: 'Cost Center', required_date: 'Required Date',
    company_code: 'Company Code', plant: 'Plant', project_code: 'Project Code',
    document_type: 'Document Type', priority: 'Priority',
    account_assignment_category: 'Account Assignment', currency: 'Currency',
    preferred_vendor_id: 'Preferred Vendor', contract_id: 'Contract',
  };

  const handlePrSaveError = (e, fallbackMsg) => {
    if (e.lineItemError) { message.error('Enter description and quantity for every line item'); setCreateStep(1); return; }
    if (e.errorFields) {
      const firstField = e.errorFields[0]?.name?.[0];
      const label = PR_FIELD_LABELS[firstField] || firstField;
      message.error(label ? `${label} is required` : 'Please complete the highlighted required fields');
      const step = PR_FIELD_TO_STEP[firstField];
      if (step !== undefined) setCreateStep(step);
      return;
    }
    const fields = e.response?.data?.fields;
    if (Array.isArray(fields) && fields.length > 0) {
      message.error(`Missing required: ${fields.map(f => PR_FIELD_LABELS[f] || f).join(', ')}`);
      const step = PR_FIELD_TO_STEP[fields[0]];
      if (step !== undefined) setCreateStep(step);
      return;
    }
    message.error(e.response?.data?.error || fallbackMsg);
  };

  const buildPayload = async () => {
    const values = await createForm.validateFields();
    if (createLineItems.some(li => !li.description || !li.quantity)) {
      throw { lineItemError: true };
    }
    return {
      ...values,
      company_id: selectedCompanyId || undefined,
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
      handlePrSaveError(e, 'Failed to save requisition');
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
      handlePrSaveError(e, 'Failed to save requisition');
    }
    setSaving(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════

  const isApproverOf = (row) => row.current_approver_role ? (user.role === row.current_approver_role || user.role === 'mdm_admin') : user.role === 'mdm_admin';

  const onExpandRow = async (expanded, row) => {
    if (!expanded || expandedRowData[row.id]) return;
    setExpandedRowData(prev => ({ ...prev, [row.id]: { loading: true, detail: null } }));
    try {
      const res = await api.get(`/pr/${row.id}`);
      setExpandedRowData(prev => ({ ...prev, [row.id]: { loading: false, detail: res.data.data } }));
    } catch {
      setExpandedRowData(prev => ({ ...prev, [row.id]: { loading: false, detail: null } }));
    }
  };

  const expandedRowRender = (row) => {
    const entry = expandedRowData[row.id];
    if (!entry || entry.loading) return <Skeleton active paragraph={{ rows: 2 }} />;
    if (!entry.detail) return <Text type="secondary">Could not load preview.</Text>;
    const lines = (entry.detail.line_items || []).slice(0, 3);
    const insight = getPrInsight(row, budgetBreachPrIds.has(row.id));
    return (
      <Row gutter={24}>
        <Col span={12}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>TOP LINE ITEMS</Text>
          <div style={{ marginTop: 6 }}>
            {lines.length === 0 && <Text type="secondary">No line items</Text>}
            {lines.map(li => (
              <div key={li.id} style={{ marginBottom: 4 }}>
                <Text>{li.description}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {Number(li.quantity).toLocaleString()} {li.uom} × {li.estimated_unit_price != null ? Number(li.estimated_unit_price).toLocaleString() : '—'}
                </Text>
              </div>
            ))}
            {row.item_count > 3 && <Text type="secondary" style={{ fontSize: 12 }}>+{row.item_count - 3} more</Text>}
          </div>
        </Col>
        <Col span={6}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>BUDGET STATUS</Text>
          <div style={{ marginTop: 6 }}>
            {budgetBreachPrIds.has(row.id) ? <Tag color="red">EXCEEDS BUDGET</Tag> : <Tag color="green">WITHIN BUDGET</Tag>}
          </div>
        </Col>
        <Col span={6}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>SUGGESTED NEXT ACTION</Text>
          <div style={{ marginTop: 6 }}>
            <Button size="small" type="primary" onClick={() => openDetail(row)}>
              {insight.action === 'approve' ? 'Review & Approve' : insight.action === 'create_rfq' ? 'Create RFQ' : insight.action === 'create_po' ? 'Create PO' : insight.action === 'approve_lines' ? 'Review Lines' : 'View Details'}
            </Button>
          </div>
        </Col>
      </Row>
    );
  };

  const columns = [
    {
      title: 'PR No.', dataIndex: 'pr_number', width: 220,
      render: (v, row) => (
        <Space size={4}>
          <a onClick={() => openDetail(row)}><Text strong>{v}</Text></a>
          {row.justification?.startsWith('Auto-generated:') && <Tag color="gold" title={row.justification}>Auto-Generated</Tag>}
        </Space>
      ),
      sorter: (a, b) => String(a.pr_number || '').localeCompare(String(b.pr_number || ''), undefined, { numeric: true }),
    },
    {
      title: 'Requester', dataIndex: 'requester_name', render: v => v || <Text type="secondary">—</Text>,
      sorter: (a, b) => String(a.requester_name || '').localeCompare(String(b.requester_name || '')),
    },
    {
      title: 'Department', dataIndex: 'department',
      sorter: (a, b) => String(a.department || '').localeCompare(String(b.department || '')),
      filters: (subMasters.department || []).map(s => ({ text: s.name, value: s.name })),
      onFilter: (value, row) => row.department === value,
    },
    {
      title: 'Value', dataIndex: 'total_value', render: v => Number(v || 0).toLocaleString(),
      sorter: (a, b) => Number(a.total_value || 0) - Number(b.total_value || 0),
    },
    {
      title: 'Status', dataIndex: 'status', render: s => <StatusTag status={s} />,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: ['draft', 'submitted', 'approved', 'partially_approved', 'sourcing', 'closed', 'rejected'].map(s => ({ text: s.replace('_', ' '), value: s })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Priority', dataIndex: 'priority', render: v => <Tag color={PRIORITY_COLOR[v]}>{v}</Tag>,
      sorter: (a, b) => String(a.priority || '').localeCompare(String(b.priority || '')),
      filters: (subMasters.priority || []).map(s => ({ text: s.name, value: s.name })),
      onFilter: (value, row) => row.priority === value,
    },
    {
      title: 'Sourcing', dataIndex: 'sourcing_strategy', render: v => SOURCING_LABELS[v] || v,
      sorter: (a, b) => String(a.sourcing_strategy || '').localeCompare(String(b.sourcing_strategy || '')),
      filters: Object.entries(SOURCING_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value, row) => row.sourcing_strategy === value,
    },
    {
      title: 'Insight', key: 'insight', width: 200,
      render: (_, row) => {
        const insight = getPrInsight(row, budgetBreachPrIds.has(row.id));
        if (!insight.label) return <Text type="secondary">—</Text>;
        return (
          <Tag color={INSIGHT_SEVERITY_TAG_COLOR[insight.severity]} icon={insight.severity === 'critical' ? <WarningOutlined /> : undefined}>
            {insight.label}
          </Tag>
        );
      },
    },
    {
      title: 'Company', key: 'company', width: 140, ellipsis: true,
      render: (_, row) => (
        <Space size={4}>
          {row.company_name || <Text type="secondary">—</Text>}
          <InactiveCompanyBadge show={row.company_is_active === false} />
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, row) => {
        const insight = getPrInsight(row, budgetBreachPrIds.has(row.id));
        const overflowItems = [];
        if (insight.action !== 'create_rfq' && ['approved', 'sourcing'].includes(row.status) && row.sourcing_strategy !== 'CONTRACT_BASED') {
          overflowItems.push({ key: 'rfq', icon: <FileTextOutlined />, label: 'Create RFQ', onClick: () => openDetail(row, 'rfq') });
        }
        if (insight.action !== 'create_po' && ['approved', 'sourcing'].includes(row.status) && row.sourcing_strategy !== 'RFQ_REQUIRED') {
          overflowItems.push({ key: 'po', icon: <ShoppingCartOutlined />, label: 'Create PO', onClick: () => openDetail(row, 'po') });
        }
        overflowItems.push({ key: 'pdf', icon: <FilePdfOutlined />, label: 'Download PDF', onClick: () => downloadPrPdf(row) });
        if (insight.action !== 'view') overflowItems.push({ key: 'view', icon: <FileTextOutlined />, label: 'View', onClick: () => openDetail(row) });
        if (!['closed', 'rejected'].includes(row.status)) {
          overflowItems.push({ key: 'close', icon: <StopOutlined />, label: 'Close', danger: true, onClick: () => openDetail(row, 'close') });
        }

        let primaryButton;
        if (insight.action === 'approve' && isApproverOf(row)) {
          primaryButton = (
            <Popconfirm title="Approve this requisition?" onConfirm={async () => { await api.post(`/pr/${row.id}/approve`); message.success('Approved'); fetchList(); }}>
              <Button size="small" type="primary" icon={<CheckOutlined />}>Approve</Button>
            </Popconfirm>
          );
        } else if (insight.action === 'create_rfq') {
          primaryButton = <Button size="small" type="primary" icon={<FileTextOutlined />} onClick={() => openDetail(row, 'rfq')}>Create RFQ</Button>;
        } else if (insight.action === 'create_po') {
          primaryButton = <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={() => openDetail(row, 'po')}>Create PO</Button>;
        } else if (insight.action === 'approve_lines') {
          primaryButton = <Button size="small" type="primary" onClick={() => openDetail(row)}>Review Lines</Button>;
        } else {
          primaryButton = <Button size="small" type="primary" onClick={() => openDetail(row)}>View</Button>;
        }

        return (
          <Space size={4}>
            {primaryButton}
            <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  if (view === 'list') {
    return (
      <div style={{ padding: '24px' }}>
        {uiImprovementsEnabled ? (
          <PageHeader
            items={[{ title: 'Procurement' }, { title: 'Purchase Requisitions' }]}
            title="Purchase Requisitions"
            subtitle="Single source of truth for procurement demand"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreatePage}>New Requisition</Button>}
          />
        ) : (
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Title level={3} style={{ margin: 0 }}>Purchase Requisitions</Title>
              <Text type="secondary">Single source of truth for procurement demand</Text>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePage}>New Requisition</Button>
            </Col>
          </Row>
        )}

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
          <Table
            columns={columns}
            dataSource={prList}
            rowKey="id"
            loading={listLoading}
            size="middle"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 'max-content' }}
            rowClassName={(row) => INSIGHT_ROW_CLASS[getPrInsight(row, budgetBreachPrIds.has(row.id)).severity]}
            expandable={{ expandedRowRender, onExpand: onExpandRow }}
          />
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
      <div style={{ padding: '24px', paddingBottom: 0 }}>
        <div style={{ paddingBottom: 88 }}>
          {uiImprovementsEnabled ? (
            <PageHeader
              items={[{ title: 'Procurement' }, { title: 'Purchase Requisitions' }]}
              title={editingId ? 'Edit Requisition' : 'New Requisition'}
              onBack={() => setView('list')}
            />
          ) : (
            <Row align="middle" style={{ marginBottom: 16 }}>
              <Col><Button icon={<ArrowLeftOutlined />} onClick={() => setView('list')} style={{ marginRight: 12 }}>Back</Button></Col>
              <Col flex="auto"><Title level={4} style={{ margin: 0 }}>{editingId ? 'Edit Requisition' : 'New Requisition'}</Title></Col>
            </Row>
          )}

          <Steps
            current={createStep}
            onChange={(target) => { if (target < createStep) setCreateStep(target); }}
            size="small"
            style={{ marginBottom: 24, maxWidth: 800 }}
            items={[
              { title: 'Basic Info' },
              { title: 'Line Items' },
              { title: 'Review & Insights' },
              { title: 'Submit' },
            ]}
          />

          {/* Kept mounted (just hidden) rather than conditionally rendered across
              steps — these Form.Items must stay registered with createForm at
              all times, otherwise validateFields() at final Submit (step 3,
              where nothing else is mounted) validates nothing and silently
              drops these fields' values from the payload. */}
          <Card title="Basic Information" size="small" style={{ marginBottom: 16, display: createStep === 0 ? 'block' : 'none' }}>
            <Form form={createForm} layout="vertical" onValuesChange={refreshInsights}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="document_type" label="Document Type" initialValue="Standard" rules={[{ required: isRequired('document_type', false) }]}>
                    <Select options={(subMasters.document_type || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="department" label="Department" rules={[{ required: isRequired('department', true), message: 'Department is required' }]}>
                    <Select showSearch placeholder="Select department" options={(subMasters.department || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="priority" label="Priority" initialValue="Medium" rules={[{ required: isRequired('priority', false) }]}>
                    <Select options={(subMasters.priority || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="required_date" label="Required Date" rules={[{ required: isRequired('required_date', false) }]}>
                    <DatePicker style={{ width: '100%' }} disabledDate={d => d && d.isBefore(dayjs().startOf('day'))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="company_id" label="Company" rules={[{ required: isRequired('company_code', false) }]}>
                    <CompanySelector
                      value={selectedCompanyId}
                      onChange={(val) => {
                        setSelectedCompanyId(val);
                        createForm.setFieldsValue({ company_id: val, cost_center: undefined });
                      }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="cost_center" label="Cost Centre" rules={[{ required: isRequired('cost_center', false) }]}>
                    <CostCentreDropdown
                      companyId={selectedCompanyId}
                      value={createForm.getFieldValue('cost_center')}
                      onChange={(val) => createForm.setFieldsValue({ cost_center: val })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  {insights.budget && createForm.getFieldValue('cost_center') && (
                    <Tag color={insights.budget.budget_status === 'within_budget' ? 'green' : insights.budget.budget_status === 'exceeds_budget' ? 'red' : 'default'} style={{ marginTop: -12, marginBottom: 8 }}>
                      {insights.budget.budget_status === 'not_configured' ? 'No budget configured' : `Balance: ₹${Number(insights.budget.remaining_amount ?? 0).toLocaleString()}`}
                    </Tag>
                  )}
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="plant" label="Plant" rules={[{ required: isRequired('plant', false) }]}>
                    <Select allowClear showSearch placeholder="Select plant" options={(subMasters.plant || []).map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="project_code" label="Project Code" rules={[{ required: isRequired('project_code', false) }]}><Input /></Form.Item>
                </Col>
              </Row>
              <Form.Item name="justification" label="Justification" rules={[{ required: isRequired('justification', true), message: 'Justification is required' }]}>
                <TextArea rows={2} placeholder="Why is this requisition needed?" />
              </Form.Item>
            </Form>
          </Card>
          {createStep === 0 && (
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <Button type="primary" onClick={async () => {
                try { await createForm.validateFields(['department', 'justification']); setCreateStep(1); }
                catch { /* AntD already highlights the invalid fields */ }
              }}>
                Next: Line Items
              </Button>
            </div>
          )}

          <Card title="Sourcing & Account Assignment" size="small" style={{ marginBottom: 16, display: createStep === 2 ? 'block' : 'none' }}>
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
                      onChange={onPreferredVendorChange}
                      options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
                  </Form.Item>
                  {preferredVendorScoreLoading && <Skeleton active paragraph={false} title={{ width: 120 }} />}
                  {!preferredVendorScoreLoading && preferredVendorScore && (
                    <Tag color={preferredVendorScore.risk.risk_level === 'high' ? 'red' : preferredVendorScore.risk.risk_level === 'medium' ? 'orange' : 'green'}>
                      Risk: {(preferredVendorScore.risk.risk_level || '—').toUpperCase()} · Score: {preferredVendorScore.performance_score ?? '—'}/100
                    </Tag>
                  )}
                </Col>
                <Col span={12}>
                  <Form.Item name="contract_id" label="Contract" rules={[{ required: isRequired('contract_id', false) }]}>
                    <Select allowClear showSearch placeholder="Required for Contract-Based sourcing" optionFilterProp="label"
                      options={contracts.map(c => ({ value: c.id, label: `${c.contract_number} — ${c.title}` }))} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {createStep === 1 && (
          <Card
            title="Line Items"
            size="small"
            style={{ marginBottom: 16 }}
            extra={<Text type="secondary" style={{ fontSize: 13 }}>{createLineItems.length} line{createLineItems.length === 1 ? '' : 's'} · Total <Text strong>{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></Text>}
          >
            <Form form={createForm} layout="vertical" component={false} onValuesChange={refreshInsights}>
              {createLineItems.map((li, idx) => {
                const lineTotal = Number(li.quantity || 0) * Number(li.estimated_unit_price || 0);
                return (
                  <div key={idx} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <Row align="middle" style={{ marginBottom: 4 }}>
                      <Col flex="auto"><Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>LINE {idx + 1}</Text></Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>Line Total: </Text>
                        <Text strong style={{ fontSize: 13 }}>{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                      </Col>
                    </Row>
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
                    {lineBenchmarks[idx] === 'loading' && <Skeleton active paragraph={false} title={{ width: 200 }} style={{ marginTop: 6 }} />}
                    {lineBenchmarks[idx] && lineBenchmarks[idx] !== 'loading' && (
                      <Space wrap size={6} style={{ marginTop: 6 }}>
                        {lineBenchmarks[idx].benchmark?.last_price != null && (() => {
                          const lastPrice = Number(lineBenchmarks[idx].benchmark.last_price);
                          const current = Number(li.estimated_unit_price || 0);
                          const deviationPct = lastPrice > 0 ? Math.round(((current - lastPrice) / lastPrice) * 10000) / 100 : null;
                          return (
                            <Tag color={deviationPct == null ? 'default' : Math.abs(deviationPct) >= 10 ? (deviationPct > 0 ? 'red' : 'blue') : 'green'}>
                              Last Purchase Price: {lastPrice.toLocaleString()}{deviationPct != null && ` (${deviationPct > 0 ? '+' : ''}${deviationPct}%)`}
                            </Tag>
                          );
                        })()}
                        {(lineBenchmarks[idx].preferred_vendors || []).slice(0, 3).map(v => (
                          <Tag key={v.vendor_id} color={v.is_preferred ? 'purple' : 'default'}>{v.vendor_name}</Tag>
                        ))}
                      </Space>
                    )}
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
                );
              })}
              <Button type="dashed" icon={<PlusOutlined />} onClick={addLineItem} block>Add Line Item</Button>
            </Form>
          </Card>
          )}
          {createStep === 1 && (
            <Row justify="space-between" style={{ marginBottom: 16 }}>
              <Col><Button onClick={() => setCreateStep(0)}>Back</Button></Col>
              <Col>
                <Button type="primary" onClick={() => {
                  if (createLineItems.some(li => !li.description || !li.quantity)) { message.error('Enter description and quantity for every line item'); return; }
                  setCreateStep(2);
                }}>
                  Next: Review &amp; Insights
                </Button>
              </Col>
            </Row>
          )}

          {createStep === 2 && (
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
            {insights.budget?.budget_status === 'exceeds_budget' && (
              <Alert style={{ marginTop: 12 }} type="warning" showIcon message="This requisition exceeds the remaining budget for the selected cost center — it may be hard-blocked at submit, or routed as a tracked exception, depending on the configured enforcement mode." />
            )}
            {insights.recommendation && createForm.getFieldValue('sourcing_strategy') && insights.recommendation.recommended_strategy !== createForm.getFieldValue('sourcing_strategy') && (
              <Alert
                style={{ marginTop: 12 }} type="info" showIcon
                message={`Selected sourcing strategy (${SOURCING_LABELS[createForm.getFieldValue('sourcing_strategy')]}) differs from the recommended ${SOURCING_LABELS[insights.recommendation.recommended_strategy]}.`}
                description={insights.recommendation.reason}
              />
            )}
          </Card>
          )}
          {createStep === 2 && (
            <Row justify="space-between" style={{ marginBottom: 16 }}>
              <Col><Button onClick={() => setCreateStep(1)}>Back</Button></Col>
              <Col><Button type="primary" onClick={() => setCreateStep(3)}>Next: Submit</Button></Col>
            </Row>
          )}

          {createStep === 3 && (
          <Card title="Final Review" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title="Department" valueRender={() => <Text strong>{createForm.getFieldValue('department') || '—'}</Text>} /></Col>
              <Col span={6}><Statistic title="Line Items" value={createLineItems.length} /></Col>
              <Col span={6}><Statistic title="Total Value" value={totalValue} precision={2} /></Col>
              <Col span={6}>
                <Statistic title="Budget" valueRender={() => insights.budget?.budget_status ? <Tag color={BUDGET_COLOR[insights.budget.budget_status]}>{insights.budget.budget_status.replace('_', ' ').toUpperCase()}</Tag> : <Text type="secondary">—</Text>} />
              </Col>
            </Row>
            <Divider />
            <Text type="secondary">Justification</Text>
            <br />
            <Text>{createForm.getFieldValue('justification') || '—'}</Text>
            {insights.budget?.budget_status === 'exceeds_budget' && (
              <Alert style={{ marginTop: 16 }} type="warning" showIcon message="Heads up: this requisition still exceeds budget. You can still save as a draft, or submit through exception approval if your organization allows it." />
            )}
          </Card>
          )}
          {createStep === 3 && (
            <Row style={{ marginBottom: 16 }}>
              <Col><Button onClick={() => setCreateStep(2)}>Back</Button></Col>
            </Row>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '16px 24px', margin: '0 -24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary">Total Value: <Text strong>{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></Text>
          <Space>
            <Button onClick={() => setView('list')}>Cancel</Button>
            <Button icon={<EditOutlined />} loading={saving} onClick={handleSaveDraft}>Save as Draft</Button>
            <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={handleSaveAndSubmit}>Save & Submit</Button>
          </Space>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════

  const pr = prDetail || selectedPr;
  const isApprover = pr ? isApproverOf(pr) : false;
  // Editable only while draft/rejected — once approved (or beyond), the
  // approval already recorded against this exact set of values/lines would
  // otherwise be silently undermined by further edits. The backend enforces
  // this too (PUT /pr/:id) — this just decides whether to show the button.
  const canEditPr = ['draft', 'rejected'].includes(pr?.status);

  // Tab order follows the decision-first reading order: Overview, then
  // Insights (why this PR needs attention) right up front rather than buried
  // 3rd, then the operational tabs.
  const tabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab pr={pr} isApprover={isApprover} onSubmit={handleSubmit} onApprove={handleApprove} onOpenReject={() => setRejectModalOpen(o => !o)} onOpenCreateRfq={openCreateRfqModal} onOpenCreatePo={openCreatePoModal} actionLoading={actionLoading} /> },
    { key: 'insights', label: <span><BulbOutlined /> Insights</span>, children: <IntelligenceTab data={intelligence} loading={intelligenceLoading} prId={pr?.id} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={prDetail?.line_items} pr={pr} isApprover={isApprover} actionLoading={lineActionLoading} onApproveLine={handleApproveLine} onOpenRejectLine={openLineReject} /> },
    { key: 'workflow', label: <span><ApartmentOutlined /> Workflow</span>, children: <WorkflowTimelineTab timeline={workflowTimeline} loading={timelineLoading} /> },
    { key: 'document-flow', label: <span><NodeIndexOutlined /> Document Flow</span>, children: <DocumentFlowTab flow={documentFlow} loading={flowLoading} /> },
    { key: 'attachments', label: <span><PaperClipOutlined /> Attachments</span>, children: <AttachmentsTab attachments={attachments} loading={attachmentsLoading} uploading={uploadingAttachment} onUpload={uploadOverallAttachment} onDelete={deleteAttachment} /> },
    { key: 'audit', label: <span><AuditOutlined /> Audit Log</span>, children: <AuditLogTab logs={auditLogs} loading={auditLoading} /> },
  ];

  const nextBestAction = getNextBestAction(pr, prDetail, intelligence);
  const recommendationCount = intelligence?.insights?.length || 0;
  const needsAction = nextBestAction.action != null;

  return (
    <div style={{ padding: '24px' }}>
      {/* Sticky Summary Header — PR value/status/budget/CTA stay visible while
          scrolling through a long detail page with several tabs below. */}
      <Row
        align="middle"
        style={{
          marginBottom: 16, position: 'sticky', top: 0, zIndex: 10, background: '#fff',
          padding: '12px 0', borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Col><Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginRight: 12 }}>Back</Button></Col>
        <Col flex="auto">
          <Title level={4} style={{ margin: 0 }}>{pr?.pr_number} — {pr?.department}</Title>
        </Col>
        <Col>
          <Space size="large">
            <Statistic title="Value" value={Number(pr?.total_value || 0)} valueStyle={{ fontSize: 18 }} />
            {intelligence?.budget?.budget_status && (
              <Statistic
                title="Budget" valueStyle={{ fontSize: 14 }}
                valueRender={() => <Tag color={BUDGET_COLOR[intelligence.budget.budget_status]}>{intelligence.budget.budget_status.replace('_', ' ').toUpperCase()}</Tag>}
              />
            )}
            <StatusTag status={pr?.status} />
            {pr && (
              <Button icon={<FilePdfOutlined />} onClick={() => downloadPrPdf(pr)}>PDF</Button>
            )}
            {pr && canEditPr && (
              <Button icon={<EditOutlined />} onClick={() => openEditPage(prDetail)}>Edit</Button>
            )}
            {pr && !['closed', 'rejected'].includes(pr.status) && (
              <Button danger icon={<StopOutlined />} onClick={() => setCloseModalOpen(true)}>Close</Button>
            )}
            {needsAction && (
              <Button type="primary" onClick={() => {
                if (nextBestAction.action === 'approve') handleApprove();
                else if (nextBestAction.action === 'create_rfq') openCreateRfqModal();
                else if (nextBestAction.action === 'create_po') openCreatePoModal();
                else setActiveTab(nextBestAction.action === 'approve_lines' ? 'items' : 'insights');
              }}>
                {nextBestAction.label}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Top Decision Bar — the at-a-glance read before opening any tab. */}
      <Space size={8} wrap style={{ marginBottom: 16 }}>
        <Tag color="purple">{SOURCING_LABELS[pr?.sourcing_strategy] || pr?.sourcing_strategy || '—'}</Tag>
        {intelligence?.budget?.budget_status && (
          <Tag color={BUDGET_COLOR[intelligence.budget.budget_status]}>
            {intelligence.budget.budget_status === 'exceeds_budget' ? 'Over Budget' : intelligence.budget.budget_status === 'within_budget' ? 'Within Budget' : 'Budget Not Configured'}
          </Tag>
        )}
        <Tag color={recommendationCount > 0 ? 'blue' : 'default'}>{recommendationCount} Recommendation{recommendationCount === 1 ? '' : 's'}</Tag>
        <Tag color={needsAction ? 'orange' : 'green'} icon={needsAction ? <WarningOutlined /> : undefined}>{needsAction ? 'Action Needed' : 'On Track'}</Tag>
      </Space>

      {/* Next Best Action */}
      <Card size="small" style={{ marginBottom: 16, background: needsAction ? '#fff7e6' : '#f6ffed', border: `1px solid ${needsAction ? '#ffd591' : '#b7eb8f'}` }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Text strong style={{ fontSize: 14 }}>{needsAction ? '🎯 Next Best Action' : '✅ All Clear'}</Text>
            <br />
            <Text type="secondary">{nextBestAction.reason}</Text>
          </Col>
          {needsAction && (
            <Col>
              <Button type="primary" onClick={() => {
                if (nextBestAction.action === 'approve') handleApprove();
                else if (nextBestAction.action === 'create_rfq') openCreateRfqModal();
                else if (nextBestAction.action === 'create_po') openCreatePoModal();
                else setActiveTab(nextBestAction.action === 'approve_lines' ? 'items' : 'insights');
              }}>
                {nextBestAction.label}
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={18}>
          <Tabs activeKey={activeTab} onChange={onTabChange} items={tabs} type="card" loading={detailLoading} />
        </Col>
        <Col span={6}>
          <DecisionPanel entityType="pr" entityId={pr?.id} sticky />
        </Col>
      </Row>

      <InlineExpandPanel
        open={rejectModalOpen}
        title="Reject Requisition"
        description="Remarks are required so the requester knows what to fix."
        submitText="Reject"
        submitDanger
        loading={actionLoading}
        onCancel={() => setRejectModalOpen(false)}
        onSubmit={handleReject}
      >
        <TextArea rows={3} placeholder="Reason for rejection (required)" value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)} status={!rejectRemarks.trim() ? 'warning' : undefined} />
      </InlineExpandPanel>

      <InlineExpandPanel
        open={closeModalOpen}
        title="Close Requisition"
        description="Ends this requisition without further processing (no RFQ/PO will be created from it). A reason is required for the audit trail; any committed budget is released back to the cost center."
        submitText="Close Requisition"
        submitDanger
        loading={actionLoading}
        onCancel={() => setCloseModalOpen(false)}
        onSubmit={handleClosePr}
      >
        <TextArea rows={3} placeholder="Reason for closure (required)" value={closeReason} onChange={e => setCloseReason(e.target.value)} status={!closeReason.trim() ? 'warning' : undefined} />
      </InlineExpandPanel>

      <InlineExpandPanel
        open={!!lineRejectTarget}
        title={`Reject Line Item${lineRejectTarget ? ` — ${lineRejectTarget.description}` : ''}`}
        description="Remarks are required so the requester knows what to fix."
        submitText="Reject Line"
        submitDanger
        loading={lineActionLoading}
        onCancel={() => setLineRejectTarget(null)}
        onSubmit={handleRejectLine}
      >
        <TextArea rows={3} placeholder="Reason for rejection (required)" value={lineRejectRemarks} onChange={e => setLineRejectRemarks(e.target.value)} status={!lineRejectRemarks.trim() ? 'warning' : undefined} />
      </InlineExpandPanel>

      <InlineExpandPanel
        open={rfqModalOpen}
        title="Create RFQ from Requisition"
        submitText="Create RFQ"
        loading={actionLoading}
        onCancel={() => setRfqModalOpen(false)}
        onSubmit={handleCreateRfq}
      >
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
      </InlineExpandPanel>

      <InlineExpandPanel
        open={poModalOpen}
        title="Create PO from Requisition"
        submitText="Create PO"
        loading={actionLoading}
        onCancel={() => setPoModalOpen(false)}
        onSubmit={handleCreatePo}
      >
        {pr?.sourcing_strategy === 'CONTRACT_BASED' ? (
          <Alert type="info" showIcon message="Vendor and payment terms will be pulled automatically from the linked contract." style={{ marginBottom: 16 }} />
        ) : (
          <Form layout="vertical">
            <Form.Item label="Company">
              <CompanySelector
                value={poCompanyId}
                onChange={(val) => { setPoCompanyId(val); setPoVendorId(null); }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Vendor" required>
              <VendorDropdown
                companyId={poCompanyId}
                value={poVendorId}
                onChange={setPoVendorId}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Form>
        )}
        <Form layout="vertical">
          <Form.Item label="Line Items & Quantities">
            <LineSelectionTable selections={poLineSelections} setSelections={setPoLineSelections} />
          </Form.Item>
        </Form>
      </InlineExpandPanel>
    </div>
  );
}
