import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Tag, Space, Tabs, Popconfirm, Typography, Drawer, Timeline, message, Row, Col, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, PlusCircleOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = { in_progress: 'orange', approved: 'green', rejected: 'red', cancelled: 'default' };

function WorkflowDefinitions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [steps, setSteps] = useState([{ step_name: '', approver_role: '', sla_hours: 24 }]);

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
    setSteps([{ step_name: '', approver_role: '', sla_hours: 24 }]);
    setModalOpen(true);
  };

  const addStep = () => setSteps([...steps, { step_name: '', approver_role: '', sla_hours: 24 }]);
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i, field, value) => setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const cleanSteps = steps.filter(s => s.step_name && s.approver_role);
      if (cleanSteps.length === 0) { message.error('Add at least one step with step name and approver role'); return; }
      await api.post('/workflow', { ...values, steps: cleanSteps });
      message.success('Workflow created');
      setModalOpen(false);
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
    { title: 'Name', dataIndex: 'name' },
    { title: 'Module', dataIndex: 'module_name', width: 160, render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Steps', dataIndex: 'steps', width: 90, render: v => (v || []).length },
    { title: 'Active', dataIndex: 'is_active', width: 90, render: v => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag> },
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
                { title: 'Order', dataIndex: 'step_order', width: 80 },
                { title: 'Step Name', dataIndex: 'step_name' },
                { title: 'Approver Role', dataIndex: 'approver_role' },
                { title: 'SLA (hrs)', dataIndex: 'sla_hours', width: 100 },
              ]}
            />
          ),
        }}
      />

      <Drawer title="New Workflow" open={modalOpen} onClose={() => setModalOpen(false)} width={700} destroyOnClose footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button type="primary" onClick={handleSave}>Create</Button>
        </Space>
      }>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Workflow Name" rules={[{ required: true, message: 'Enter a workflow name' }]}>
                <Input placeholder="e.g. Vendor Onboarding Approval" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="module_name" label="Module Name" rules={[{ required: true, message: 'Enter the module this workflow applies to' }]}>
                <Input placeholder="e.g. vendor, purchase_order, rfq" />
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
          <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
            <Col span={2}><Text strong>{i + 1}.</Text></Col>
            <Col span={9}><Input placeholder="Step name" value={step.step_name} onChange={e => updateStep(i, 'step_name', e.target.value)} /></Col>
            <Col span={7}><Input placeholder="Approver role" value={step.approver_role} onChange={e => updateStep(i, 'approver_role', e.target.value)} /></Col>
            <Col span={4}><InputNumber style={{ width: '100%' }} min={1} placeholder="SLA hrs" value={step.sla_hours} onChange={v => updateStep(i, 'sla_hours', v)} /></Col>
            <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeStep(i)} /></Col>
          </Row>
        ))}
        <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addStep} block>Add Step</Button>
      </Drawer>
    </div>
  );
}

function WorkflowInstances() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
    setDrawerOpen(true);
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

  const closeDrawer = () => { setDrawerOpen(false); setDetail(null); setRemarks(''); };

  const handleAdvance = async (action) => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await api.post(`/workflow/instances/${detail.id}/advance`, { action, remarks });
      message.success(action === 'approve' ? 'Step approved' : 'Instance rejected');
      closeDrawer();
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Action failed'); }
    setActionLoading(false);
  };

  const columns = [
    { title: 'Module', dataIndex: 'module_name', width: 140, render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Record ID', dataIndex: 'record_id', width: 220, ellipsis: true },
    { title: 'Workflow', dataIndex: 'workflow_name' },
    { title: 'Current Step', dataIndex: 'current_step_name', render: v => v || <Text type="secondary">—</Text> },
    { title: 'Status', dataIndex: 'status', width: 120, render: s => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase().replace('_', ' ')}</Tag> },
    { title: 'Started', dataIndex: 'started_at', width: 180, render: v => v ? new Date(v).toLocaleString() : '—' },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: 'pointer' } })}
      />

      <Drawer title="Workflow Instance" open={drawerOpen} onClose={closeDrawer} width={480} loading={detailLoading}>
        {detail && (
          <>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Text type="secondary">Module</Text>
              <Tag color="blue">{detail.module_name}</Tag>
              <Text type="secondary">Workflow</Text>
              <Text strong>{detail.workflow_name}</Text>
              <Text type="secondary">Record ID</Text>
              <Text code>{detail.record_id}</Text>
              <Text type="secondary">Status</Text>
              <Tag color={STATUS_COLOR[detail.status]}>{detail.status?.toUpperCase().replace('_', ' ')}</Tag>
              {detail.current_step_name && (
                <>
                  <Text type="secondary">Current Step</Text>
                  <Text strong>{detail.current_step_name}</Text>
                </>
              )}
            </Space>

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

            {detail.status === 'in_progress' && (
              <>
                <Divider />
                <Title level={5}>Take Action</Title>
                <TextArea rows={3} placeholder="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ marginBottom: 12 }} />
                <Space>
                  <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a' }} loading={actionLoading} onClick={() => handleAdvance('approve')}>Approve</Button>
                  <Button danger icon={<CloseOutlined />} loading={actionLoading} onClick={() => handleAdvance('reject')}>Reject</Button>
                </Space>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

export default function WorkflowEngine() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Workflow Engine</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Define multi-step approval workflows and track their running instances across modules.</Text>
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
