import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, Tag, Space, Tabs, Popconfirm, Typography, Timeline, message, Row, Col, Divider, Card, Checkbox, Statistic, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, PlusCircleOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, ApartmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../api/axios';
import SplitScreenLayout from '../components/ui/SplitScreenLayout';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = { in_progress: 'orange', approved: 'green', rejected: 'red', cancelled: 'default' };
const APPROVAL_STATUS_COLOR = { pending: 'orange', approved: 'green', rejected: 'red' };

const MODULE_OPTIONS = ['vendor', 'purchase_requisition', 'purchase_order', 'rfq', 'asn', 'item_master', 'contract', 'ticket', 'audit', 'esg']
  .map(m => ({ value: m, label: m.replace('_', ' ').toUpperCase() }));

const APPROVER_ROLE_OPTIONS = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'mdm_admin', label: 'MDM Admin' },
  { value: 'procurement_admin', label: 'Procurement Admin' },
  { value: 'vendor', label: 'Vendor' },
];

const CONDITION_FIELD_OPTIONS = [
  { value: 'total_value', label: 'Value' },
  { value: 'category', label: 'Category' },
  { value: 'vendor_risk_level', label: 'Vendor Risk Level' },
];
const CONDITION_OPERATOR_OPTIONS = [
  { value: '>', label: '>' }, { value: '>=', label: '>=' }, { value: '<', label: '<' }, { value: '<=', label: '<=' },
  { value: '=', label: '=' }, { value: '!=', label: '!=' }, { value: 'in', label: 'in (comma-separated)' },
];

const moduleLabel = (v) => MODULE_OPTIONS.find(m => m.value === v)?.label || v;
const approverRoleLabel = (v) => APPROVER_ROLE_OPTIONS.find(r => r.value === v)?.label || v;

function formatConditionRule(rule) {
  if (!rule) return null;
  const parsed = typeof rule === 'string' ? JSON.parse(rule) : rule;
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.map(c => `${c.field} ${c.operator} ${Array.isArray(c.value) ? c.value.join(',') : c.value}`).join(' AND ');
}

const emptyStep = () => ({
  step_name: '', approver_role: '', sla_hours: 24,
  parallel_with_previous: false, escalation_role: null,
  condition_field: null, condition_operator: '>', condition_value: '',
});

function WorkflowDefinitions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form] = Form.useForm();
  const [steps, setSteps] = useState([emptyStep()]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflow');
      setData(res.data.data || []);
    } catch { message.error('Failed to load workflows'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    form.resetFields();
    setSteps([emptyStep()]);
    setPanelOpen(o => !o);
  };

  const addStep = () => setSteps([...steps, emptyStep()]);
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i, field, value) => setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const cleanSteps = steps.filter(s => s.step_name && s.approver_role);
      if (cleanSteps.length === 0) { message.error('Add at least one step with step name and approver role'); return; }

      // Conditional Workflows + Parallel Approvals: step_order is derived
      // purely from "run in parallel with previous step" — steps sharing an
      // order are marked is_parallel automatically (AND-join on the backend).
      let order = 0;
      const withOrder = cleanSteps.map((s, idx) => {
        if (idx === 0 || !s.parallel_with_previous) order++;
        return { ...s, step_order: order };
      });
      const orderCounts = {};
      withOrder.forEach(s => { orderCounts[s.step_order] = (orderCounts[s.step_order] || 0) + 1; });
      const finalSteps = withOrder.map(s => ({
        step_name: s.step_name,
        approver_role: s.approver_role,
        sla_hours: s.sla_hours || 24,
        step_order: s.step_order,
        is_parallel: orderCounts[s.step_order] > 1,
        escalation_role: s.escalation_role || null,
        condition_rule: s.condition_field
          ? [{ field: s.condition_field, operator: s.condition_operator, value: s.condition_operator === 'in' ? String(s.condition_value).split(',').map(v => v.trim()) : (s.condition_field === 'total_value' ? Number(s.condition_value) : s.condition_value) }]
          : null,
      }));

      await api.post('/workflow', { ...values, steps: finalSteps });
      message.success('Workflow created');
      setPanelOpen(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Failed to save workflow');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/workflow/${id}`);
      message.success('Workflow deleted');
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to delete workflow'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', sorter: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
    {
      title: 'Module', dataIndex: 'module_name', width: 160, render: v => <Tag color="blue">{moduleLabel(v)}</Tag>,
      sorter: (a, b) => String(a.module_name || '').localeCompare(String(b.module_name || '')),
      filters: MODULE_OPTIONS.map(o => ({ text: o.label, value: o.value })),
      onFilter: (value, row) => row.module_name === value,
    },
    { title: 'Steps', dataIndex: 'steps', width: 90, render: v => (v || []).length, sorter: (a, b) => (a.steps || []).length - (b.steps || []).length },
    {
      title: 'Active', dataIndex: 'is_active', width: 90, render: v => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
      filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }],
      onFilter: (value, row) => !!row.is_active === value,
    },
    {
      title: 'Actions', width: 90, render: (_, record) => (
        <Popconfirm title="Delete this workflow?" onConfirm={() => handleDelete(record.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Workflow</Button>
      </div>

      <InlineExpandPanel
        open={panelOpen}
        title="New Workflow"
        description="Steps run in order. Mark a step 'parallel with previous' to require simultaneous sign-off from both before advancing. A condition restricts a step to only apply when it matches (value/category/vendor risk) — skipped silently otherwise."
        onCancel={() => setPanelOpen(false)}
        onSubmit={handleSave}
        submitText="Create"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Workflow Name" rules={[{ required: true, message: 'Enter a workflow name' }]}>
                <Input placeholder="e.g. Vendor Onboarding Approval" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="module_name" label="Module Name" rules={[{ required: true, message: 'Select the module this workflow applies to' }]}>
                <Select placeholder="Select module" options={MODULE_OPTIONS} showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>

        <Divider />
        <Title level={5} style={{ marginTop: 0 }}>Approval Steps</Title>
        {steps.map((step, i) => (
          <Card key={i} size="small" style={{ marginBottom: 10, background: '#fafafa' }}>
            <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
              <Col span={2}><Text strong>{i + 1}.</Text></Col>
              <Col span={8}><Input placeholder="Step name" value={step.step_name} onChange={e => updateStep(i, 'step_name', e.target.value)} /></Col>
              <Col span={6}>
                <Select placeholder="Approver role" value={step.approver_role || undefined} onChange={v => updateStep(i, 'approver_role', v)} options={APPROVER_ROLE_OPTIONS} style={{ width: '100%' }} />
              </Col>
              <Col span={4}><InputNumber style={{ width: '100%' }} min={1} addonAfter="hrs SLA" value={step.sla_hours} onChange={v => updateStep(i, 'sla_hours', v)} /></Col>
              <Col span={4}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeStep(i)} block>Remove</Button></Col>
            </Row>
            <Row gutter={12} align="middle">
              {i > 0 && (
                <Col span={6}>
                  <Checkbox checked={!!step.parallel_with_previous} onChange={e => updateStep(i, 'parallel_with_previous', e.target.checked)}>
                    Parallel with previous
                  </Checkbox>
                </Col>
              )}
              <Col span={i > 0 ? 6 : 8}>
                <Select allowClear placeholder="Escalate to (on SLA breach)" value={step.escalation_role || undefined} onChange={v => updateStep(i, 'escalation_role', v)} options={APPROVER_ROLE_OPTIONS} style={{ width: '100%' }} />
              </Col>
              <Col span={4}>
                <Select allowClear placeholder="If field" value={step.condition_field || undefined} onChange={v => updateStep(i, 'condition_field', v)} options={CONDITION_FIELD_OPTIONS} style={{ width: '100%' }} />
              </Col>
              <Col span={4}>
                <Select value={step.condition_operator} onChange={v => updateStep(i, 'condition_operator', v)} options={CONDITION_OPERATOR_OPTIONS} style={{ width: '100%' }} disabled={!step.condition_field} />
              </Col>
              <Col span={i > 0 ? 4 : 8}>
                <Input placeholder="value" value={step.condition_value} onChange={e => updateStep(i, 'condition_value', e.target.value)} disabled={!step.condition_field} />
              </Col>
            </Row>
          </Card>
        ))}
        <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addStep} block>Add Step</Button>
      </InlineExpandPanel>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record) => (
            <Table
              size="small"
              dataSource={record.steps || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Order', dataIndex: 'step_order', width: 70 },
                { title: 'Step Name', dataIndex: 'step_name' },
                { title: 'Approver Role', dataIndex: 'approver_role', render: approverRoleLabel },
                { title: 'SLA (hrs)', dataIndex: 'sla_hours', width: 90 },
                { title: 'Parallel', dataIndex: 'is_parallel', width: 90, render: v => v ? <Tag color="purple">Parallel</Tag> : <Text type="secondary">—</Text> },
                { title: 'Condition', dataIndex: 'condition_rule', width: 220, render: v => formatConditionRule(v) || <Text type="secondary">Always applies</Text> },
                { title: 'Escalates To', dataIndex: 'escalation_role', width: 140, render: v => v ? approverRoleLabel(v) : <Text type="secondary">—</Text> },
              ]}
            />
          ),
        }}
      />
    </div>
  );
}

function WorkflowInstances() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [checkingSla, setCheckingSla] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflow/instances');
      setData(res.data.data || []);
    } catch { message.error('Failed to load workflow instances'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (record) => {
    setSelectedId(record.id);
    setDetailLoading(true);
    setRemarks('');
    try {
      const res = await api.get(`/workflow/instances/${record.id}`);
      setDetail(res.data.data);
    } catch {
      setDetail(record);
      message.error('Failed to load instance detail');
    }
    setDetailLoading(false);
  };

  // SLA Escalation: no background scheduler exists, so this is a manual
  // sweep — also runs lazily on the backend whenever this list loads.
  const handleCheckSla = async () => {
    setCheckingSla(true);
    try {
      const res = await api.post('/workflow/escalations/check');
      const count = res.data.data?.escalated_count || 0;
      message[count > 0 ? 'warning' : 'success'](count > 0 ? `${count} step(s) newly escalated for SLA breach` : 'No new SLA breaches found');
      fetchData();
    } catch { message.error('Failed to run SLA escalation check'); }
    setCheckingSla(false);
  };

  const handleAdvance = async (action, stepId) => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/workflow/instances/${detail.id}/advance`, { action, remarks, step_id: stepId });
      message.success(action === 'approve' ? 'Step approved' : 'Instance rejected');
      setSelectedId(null);
      setDetail(null);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Action failed'); }
    setActionLoading(false);
  };

  const pendingApprovals = (detail?.approvals || []).filter(a => a.status === 'pending');
  const escalatedPending = pendingApprovals.filter(a => a.escalated);
  const inProgressCount = data.filter(d => d.status === 'in_progress').length;

  const columns = [
    {
      title: 'Module', dataIndex: 'module_name', width: 140, render: v => <Tag color="blue">{moduleLabel(v)}</Tag>,
      sorter: (a, b) => String(a.module_name || '').localeCompare(String(b.module_name || '')),
      filters: MODULE_OPTIONS.map(o => ({ text: o.label, value: o.value })),
      onFilter: (value, row) => row.module_name === value,
    },
    { title: 'Record ID', dataIndex: 'record_id', width: 220, ellipsis: true },
    { title: 'Workflow', dataIndex: 'workflow_name', width: 160, ellipsis: true, sorter: (a, b) => String(a.workflow_name || '').localeCompare(String(b.workflow_name || '')) },
    { title: 'Current Step', dataIndex: 'current_step_name', width: 160, ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Status', dataIndex: 'status', width: 120, render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase().replace('_', ' ')}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase().replace('_', ' '), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    { title: 'Started', dataIndex: 'started_at', width: 180, render: v => v ? new Date(v).toLocaleString() : '—', sorter: (a, b) => new Date(a.started_at || 0) - new Date(b.started_at || 0) },
  ];

  const listPane = (
    <>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}><Card size="small"><Statistic title="Total Instances" value={data.length} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="In Progress" value={inProgressCount} valueStyle={{ color: '#d48806' }} /></Card></Col>
        <Col span={8}>
          <Card size="small">
            <Button icon={<ReloadOutlined />} loading={checkingSla} onClick={handleCheckSla} block>Run SLA Escalation Check</Button>
          </Card>
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 980 }}
        onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: 'pointer', background: selectedId === record.id ? '#e6f7ff' : undefined } })}
      />
    </>
  );

  const detailPane = !selectedId ? (
    <Card style={{ textAlign: 'center', padding: '80px 24px' }}>
      <Text type="secondary">Select an instance from the list to view its history and act on it.</Text>
    </Card>
  ) : (
    <Card loading={detailLoading}>
      {detail && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="text" icon={<CloseOutlined />} title="Close" onClick={() => { setSelectedId(null); setDetail(null); }} />
          </div>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Text type="secondary">Module</Text>
            <Tag color="blue">{moduleLabel(detail.module_name)}</Tag>
            <Text type="secondary">Workflow</Text>
            <Text strong>{detail.workflow_name}</Text>
            <Text type="secondary">Record ID</Text>
            <Text code>{detail.record_id}</Text>
            <Text type="secondary">Status</Text>
            <Tag color={STATUS_COLOR[detail.status]}>{detail.status?.toUpperCase().replace('_', ' ')}</Tag>
          </Space>

          {escalatedPending.length > 0 && (
            <Alert
              type="error" showIcon icon={<ClockCircleOutlined />}
              style={{ marginBottom: 16 }}
              message="SLA breached"
              description={`${escalatedPending.length} pending approval(s) in the current wave are overdue.${escalatedPending.some(a => a.escalation_role) ? ` Escalated to: ${[...new Set(escalatedPending.map(a => a.escalation_role).filter(Boolean))].map(approverRoleLabel).join(', ')}.` : ''}`}
            />
          )}

          {pendingApprovals.length > 0 && (
            <>
              <Divider />
              <Title level={5}><ApartmentOutlined /> Current Wave{pendingApprovals.length > 1 ? ` — ${pendingApprovals.length} parallel approval(s) required` : ''}</Title>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={detail.approvals || []}
                columns={[
                  { title: 'Step', dataIndex: 'step_name' },
                  { title: 'Approver Role', dataIndex: 'approver_role', render: approverRoleLabel },
                  { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={APPROVAL_STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag> },
                  { title: 'SLA Due', dataIndex: 'sla_due_at', width: 160, render: (v, r) => v ? <Text type={r.escalated ? 'danger' : undefined}>{new Date(v).toLocaleString()}{r.escalated ? ' (overdue)' : ''}</Text> : '—' },
                  {
                    title: 'Action', key: 'action', width: 160,
                    render: (_, row) => row.status === 'pending' ? (
                      <Space>
                        <Button size="small" type="primary" icon={<CheckOutlined />} loading={actionLoading} onClick={() => handleAdvance('approve', row.step_id)} />
                        <Button size="small" danger icon={<CloseOutlined />} loading={actionLoading} onClick={() => handleAdvance('reject', row.step_id)} />
                      </Space>
                    ) : <Text type="secondary">{row.actor_name || '—'}</Text>,
                  },
                ]}
              />
              <TextArea rows={2} placeholder="Remarks (applies to whichever action you take above)" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ marginTop: 12 }} />
            </>
          )}

          <Divider />
          <Title level={5}>History</Title>
          <Timeline
            items={(detail.logs || []).map(log => ({
              color: log.action === 'rejected' ? 'red' : log.action === 'approved' ? 'green' : 'blue',
              children: (
                <>
                  <Text strong>{log.action?.toUpperCase()}</Text>
                  {log.step_name && <Text type="secondary"> — {log.step_name}</Text>}
                  <br />
                  {log.remarks && <Text>{log.remarks}</Text>}
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</Text>
                </>
              ),
            }))}
          />
          {(!detail.logs || detail.logs.length === 0) && <Text type="secondary">No log entries yet</Text>}
        </>
      )}
    </Card>
  );

  return <SplitScreenLayout list={listPane} detail={detailPane} listSpan={11} />;
}

export default function WorkflowEngine() {
  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'Workflow Engine' }]}
        title="Workflow Engine"
        subtitle="Define multi-step, conditional, and parallel approval workflows, and track running instances with SLA escalation."
      />
      <Tabs
        type="card"
        items={[
          { key: 'definitions', label: 'Workflow Definitions', children: <WorkflowDefinitions /> },
          { key: 'instances', label: 'Instances', children: <WorkflowInstances /> },
        ]}
      />
    </div>
  );
}
