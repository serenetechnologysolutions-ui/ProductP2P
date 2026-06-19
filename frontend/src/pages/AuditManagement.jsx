import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, Tag, Space, Row, Col, Card, Modal, Typography, Tabs, DatePicker, Divider, Popconfirm, Radio, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;
const SEVERITY_COLOR = { low: 'blue', medium: 'orange', high: 'red', critical: 'magenta' };

export default function AuditManagement() {
  const [checklists, setChecklists] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistModal, setChecklistModal] = useState(false);
  const [checklistForm] = Form.useForm();
  const [checklistItems, setChecklistItems] = useState(['']);
  const [editingChecklist, setEditingChecklist] = useState(null);

  const [schedules, setSchedules] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm] = Form.useForm();

  const [executions, setExecutions] = useState([]);
  const [executionLoading, setExecutionLoading] = useState(false);

  // Execution detail state
  const [executionDetail, setExecutionDetail] = useState(null);
  const [executionItems, setExecutionItems] = useState([]);
  const [responses, setResponses] = useState({});
  const [findings, setFindings] = useState([]);
  const [findingModal, setFindingModal] = useState(false);
  const [findingForm] = Form.useForm();
  const [completeModal, setCompleteModal] = useState(false);
  const [completeForm] = Form.useForm();

  const [vendors, setVendors] = useState([]);

  const fetchChecklists = async () => {
    setChecklistLoading(true);
    try { const res = await api.get('/audit/checklists'); setChecklists(res.data.data || []); } catch { message.error('Failed to load checklists'); }
    setChecklistLoading(false);
  };
  const fetchSchedules = async () => {
    setScheduleLoading(true);
    try { const res = await api.get('/audit/schedules'); setSchedules(res.data.data || []); } catch { message.error('Failed to load schedules'); }
    setScheduleLoading(false);
  };
  const fetchExecutions = async () => {
    setExecutionLoading(true);
    try { const res = await api.get('/audit/executions'); setExecutions(res.data.data || []); } catch { message.error('Failed to load executions'); }
    setExecutionLoading(false);
  };
  const fetchVendors = async () => {
    try { const res = await api.get('/vendors'); setVendors(res.data.data || []); } catch {}
  };

  useEffect(() => { fetchChecklists(); fetchVendors(); }, []);

  // ─── CHECKLIST HANDLERS ───
  const [checklistDetail, setChecklistDetail] = useState(null);

  const openAddChecklist = () => { setEditingChecklist(null); checklistForm.resetFields(); setChecklistItems(['']); setChecklistModal(true); };
  const openEditChecklist = (record) => {
    setEditingChecklist(record);
    checklistForm.setFieldsValue({ name: record.name, description: record.description, category: record.category });
    setChecklistItems((record.items || []).map(i => i.item_text || i));
    setChecklistModal(true);
    setChecklistDetail(null);
  };
  const openChecklistDetail = (record) => { setChecklistDetail(record); };
  const handleSaveChecklist = async () => {
    try {
      const values = await checklistForm.validateFields();
      const items = checklistItems.filter(i => i.trim());
      if (items.length === 0) { message.error('Add at least one item'); return; }
      if (editingChecklist) {
        await api.put(`/audit/checklists/${editingChecklist.id}`, { ...values, items });
        message.success('Checklist updated');
      } else {
        await api.post('/audit/checklists', { ...values, items });
        message.success('Checklist created');
      }
      setChecklistModal(false); setChecklistDetail(null); fetchChecklists();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };
  const handleDeleteChecklist = async (id) => {
    try { await api.delete(`/audit/checklists/${id}`); message.success('Deleted'); setChecklistDetail(null); fetchChecklists(); } catch { message.error('Failed'); }
  };

  // ─── SCHEDULE HANDLERS ───
  const handleCreateSchedule = async () => {
    try {
      const values = await scheduleForm.validateFields();
      await api.post('/audit/schedules', {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      });
      message.success('Schedule created with planned audits');
      setScheduleModal(false); fetchSchedules(); fetchExecutions();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  // ─── EXECUTION HANDLERS ───
  const handleStartExecution = async (executionId) => {
    try {
      // Update the planned execution to in_progress
      await api.put(`/audit/executions/${executionId}/start`);
      message.success('Audit started');
      fetchExecutions(); fetchSchedules();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const openExecutionDetail = async (executionId, scheduleId) => {
    try {
      const res = await api.get(`/audit/executions/${executionId}`);
      const data = res.data.data;
      setExecutionItems(data.checklist_items || []);
      setExecutionDetail(data);
      // Populate saved responses
      const savedResponses = {};
      (data.responses || []).forEach(r => {
        savedResponses[r.checklist_item_id] = { response: r.response, remarks: r.remarks || '' };
      });
      setResponses(savedResponses);
      // Populate saved findings
      setFindings(data.findings || []);
    } catch {
      // Fallback: use local data
      const schedule = schedules.find(s => s.id === scheduleId);
      let items = [];
      if (schedule?.checklist_id) {
        const cl = checklists.find(c => c.id === schedule.checklist_id);
        items = cl?.items || [];
      }
      if (items.length === 0) {
        try {
          const clRes = await api.get('/audit/checklists');
          const cl = (clRes.data.data || []).find(c => c.id === schedule?.checklist_id);
          items = cl?.items || [];
        } catch {}
      }
      setExecutionItems(items);
      setExecutionDetail({ id: executionId, schedule_id: scheduleId, checklist_name: schedule?.checklist_name });
      setResponses({});
      setFindings([]);
    }
  };

  const handleResponseChange = (itemId, field, value) => {
    setResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleSaveResponses = async () => {
    // Validate: "No" answers must have remarks
    for (const item of executionItems) {
      const r = responses[item.id];
      if (r?.response === 'no' && (!r?.remarks || !r.remarks.trim())) {
        message.error(`Remarks are mandatory for "No" response on: ${item.item_text}`);
        return;
      }
    }
    const responseArray = executionItems.map(item => ({
      checklist_item_id: item.id,
      response: responses[item.id]?.response || 'na',
      remarks: responses[item.id]?.remarks || null,
    })).filter(r => r.response);

    try {
      await api.post(`/audit/executions/${executionDetail.id}/responses`, { responses: responseArray });
      message.success('Responses saved');
    } catch (err) { message.error(err.response?.data?.error || 'Failed to save responses'); }
  };

  const handleAddFinding = async () => {
    try {
      const values = await findingForm.validateFields();
      const payload = { ...values, capa_due_date: values.capa_due_date ? values.capa_due_date.format('YYYY-MM-DD') : null };
      await api.post(`/audit/executions/${executionDetail.id}/findings`, payload);
      message.success('Finding added');
      setFindingModal(false);
      // Refresh findings
      setFindings(prev => [...prev, { ...payload, id: Date.now(), status: 'open' }]);
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const handleCloseFinding = async (findingId, capaClosureDate) => {
    try {
      const payload = { status: 'closed', capa_closure_date: capaClosureDate ? capaClosureDate.format('YYYY-MM-DD') : undefined };
      await api.put(`/audit/findings/${findingId}`, payload);
      message.success('Finding closed');
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status: 'closed', capa_closure_date: payload.capa_closure_date || dayjs().format('YYYY-MM-DD') } : f));
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const openCompleteModal = () => { completeForm.resetFields(); setCompleteModal(true); };

  const handleCompleteExecution = async () => {
    // Save responses first
    try {
      await handleSaveResponses();
    } catch {}
    try {
      const values = await completeForm.validateFields();
      await api.put(`/audit/executions/${executionDetail.id}/complete`, values);
      message.success('Audit completed — findings remain open for follow-up');
      setCompleteModal(false);
      setExecutionDetail(null);
      fetchExecutions(); fetchSchedules();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const handleCloseExecution = async () => {
    const openFindings = findings.filter(f => f.status === 'open');
    if (openFindings.length > 0) {
      message.error(`Cannot close: ${openFindings.length} open finding(s) remain. Close all findings first.`);
      return;
    }
    try {
      await api.put(`/audit/executions/${executionDetail.id}/close`);
      message.success('Audit closed — all findings resolved');
      setExecutionDetail(null);
      fetchExecutions(); fetchSchedules();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  // ─── EXECUTION DETAIL VIEW ───
  if (executionDetail) {
    return (
      <div>
        <Button onClick={() => setExecutionDetail(null)} style={{ marginBottom: 16 }}>← Back to Audit Management</Button>
        <Title level={4}>Audit Execution — {executionDetail.checklist_name || 'Audit'}</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Complete the checklist responses. Remarks are mandatory for "No" answers.</Text>
        {(executionDetail.audit_score != null || executionDetail.compliance_percentage != null) && (
          <Space style={{ marginBottom: 16 }}>
            {executionDetail.audit_score != null && <Tag color="blue">Audit Score: {executionDetail.audit_score}</Tag>}
            {executionDetail.compliance_percentage != null && <Tag color="green">Compliance: {executionDetail.compliance_percentage}%</Tag>}
          </Space>
        )}

        <Card title="Checklist Responses" style={{ marginBottom: 16 }}>
          {executionItems.length === 0 && <Text type="secondary">No checklist items found</Text>}
          {executionItems.map((item, idx) => (
            <Card key={item.id} size="small" style={{ marginBottom: 8, background: responses[item.id]?.response === 'no' ? '#fff2f0' : '#fafafa' }}>
              <Row gutter={16} align="middle">
                <Col span={1}><Text strong>{idx + 1}.</Text></Col>
                <Col span={9}><Text>{item.item_text}</Text></Col>
                <Col span={6}>
                  <Radio.Group value={responses[item.id]?.response} onChange={e => handleResponseChange(item.id, 'response', e.target.value)}>
                    <Radio.Button value="yes" style={{ color: '#52c41a' }}>Yes</Radio.Button>
                    <Radio.Button value="no" style={{ color: '#ff4d4f' }}>No</Radio.Button>
                    <Radio.Button value="na">N/A</Radio.Button>
                  </Radio.Group>
                </Col>
                <Col span={8}>
                  <Input placeholder={responses[item.id]?.response === 'no' ? 'Remarks (mandatory)' : 'Remarks (optional)'} value={responses[item.id]?.remarks || ''} onChange={e => handleResponseChange(item.id, 'remarks', e.target.value)} />
                </Col>
              </Row>
            </Card>
          ))}
          {executionItems.length > 0 && (
            <Button type="primary" onClick={handleSaveResponses} style={{ marginTop: 12 }}>Save Responses</Button>
          )}
        </Card>

        <Card title="Findings & Corrective Actions" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { findingForm.resetFields(); setFindingModal(true); }}>Add Finding</Button>}>
          {findings.length === 0 && <Text type="secondary">No findings recorded</Text>}
          {findings.map((f, idx) => (
            <Card key={f.id} size="small" style={{ marginBottom: 8 }}>
              <Row gutter={16} align="middle">
                <Col span={12}><Text>{f.description}</Text></Col>
                <Col span={4}><Tag color={SEVERITY_COLOR[f.severity]}>{f.severity?.toUpperCase()}</Tag></Col>
                <Col span={4}><Tag color={f.status === 'open' ? 'red' : 'green'}>{f.status?.toUpperCase()}</Tag></Col>
                <Col span={4}>
                  {f.status === 'open' && <Popconfirm title="Close this finding? CAPA closure date will be set to today." onConfirm={() => handleCloseFinding(f.id, dayjs())}><Button size="small" type="primary">Close</Button></Popconfirm>}
                </Col>
              </Row>
              {(f.capa_action_owner || f.capa_due_date || f.capa_closure_date) && (
                <Row gutter={16} style={{ marginTop: 8 }}>
                  {f.capa_action_owner && <Col span={8}><Text type="secondary">CAPA Owner: </Text><Text>{f.capa_action_owner}</Text></Col>}
                  {f.capa_due_date && <Col span={8}><Text type="secondary">CAPA Due: </Text><Text>{dayjs(f.capa_due_date).format('DD-MM-YYYY')}</Text></Col>}
                  {f.capa_closure_date && <Col span={8}><Text type="secondary">CAPA Closed: </Text><Text>{dayjs(f.capa_closure_date).format('DD-MM-YYYY')}</Text></Col>}
                </Row>
              )}
            </Card>
          ))}
        </Card>

        <Divider />
        <Space>
          <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={openCompleteModal}>Complete Audit</Button>
          <Popconfirm title="Close this audit? All findings must be resolved." onConfirm={handleCloseExecution}>
            <Button size="large" danger icon={<CheckCircleOutlined />}>Close Audit</Button>
          </Popconfirm>
          <Button size="large" onClick={() => setExecutionDetail(null)}>Cancel</Button>
        </Space>

        <Modal title="Add Finding" open={findingModal} onCancel={() => setFindingModal(false)} onOk={handleAddFinding} okText="Add">
          <Form form={findingForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="description" label="Finding Description" rules={[{ required: true }]}><TextArea rows={3} placeholder="Describe the finding" /></Form.Item>
            <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
              <Select placeholder="Select severity" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }]} />
            </Form.Item>
            <Form.Item name="assigned_to" label="Assign Corrective Action To"><Input placeholder="Person or team responsible" /></Form.Item>
            <Form.Item name="capa_action_owner" label="CAPA Action Owner"><Input placeholder="Person or team accountable for the corrective action" /></Form.Item>
            <Form.Item name="capa_due_date" label="CAPA Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          </Form>
        </Modal>

        <Modal title="Complete Audit" open={completeModal} onCancel={() => setCompleteModal(false)} onOk={handleCompleteExecution} okText="Complete">
          <Form form={completeForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="audit_score" label="Audit Score (0-100)"><InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="Overall audit score" /></Form.Item>
            <Form.Item name="compliance_percentage" label="Compliance Percentage (0-100)"><InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="Compliance %" /></Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  // ─── MAIN VIEW WITH TABS ───
  const checklistColumns = [
    { title: 'Name', dataIndex: 'name', render: v => <Text strong>{v}</Text> },
    { title: 'Category', dataIndex: 'category', render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: 'Items Count', render: (_, r) => (r.items || []).length },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
  ];

  const scheduleColumns = [
    { title: 'Checklist', dataIndex: 'checklist_name' },
    { title: 'Vendor/Group', render: (_, r) => r.vendor_id ? vendors.find(v => v.id === r.vendor_id)?.vendor_name || '—' : <Tag>{r.vendor_group || 'All'}</Tag> },
    { title: 'Frequency', dataIndex: 'frequency', render: v => <Tag color="purple">{v?.replace('_', ' ')?.toUpperCase()}</Tag> },
    { title: 'From', dataIndex: 'start_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'To', dataIndex: 'end_date', width: 100, render: v => v ? dayjs(v).format('DD-MM-YY') : '—' },
    { title: 'Audits', render: (_, r) => <Text>{r.completed_audits || 0} / {r.total_audits || 1}</Text> },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'completed' ? 'green' : v === 'in_progress' ? 'blue' : 'default'}>{v?.toUpperCase().replace('_', ' ')}</Tag> },
  ];

  const executionColumns = [
    { title: 'Checklist', dataIndex: 'checklist_name' },
    { title: 'Vendor', dataIndex: 'vendor_name', render: v => v || '—' },
    { title: 'Due Date', dataIndex: 'started_at', width: 110, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
    { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'closed' ? 'default' : v === 'completed' ? 'green' : v === 'in_progress' ? 'blue' : 'orange'}>{v?.toUpperCase().replace('_', ' ')}</Tag> },
    { title: 'Completed', dataIndex: 'completed_at', width: 130, render: v => v ? dayjs(v).format('DD-MM-YY HH:mm') : '—' },
    { title: 'Actions', width: 140, render: (_, r) => (
      <Space>
        {r.status === 'planned' && <Button size="small" type="primary" onClick={() => handleStartExecution(r.id)}>Start</Button>}
        {r.status === 'in_progress' && <Button size="small" icon={<EyeOutlined />} onClick={() => openExecutionDetail(r.id, r.schedule_id)}>Execute</Button>}
        {r.status === 'completed' && <Button size="small" danger onClick={() => openExecutionDetail(r.id, r.schedule_id)}>Close</Button>}
        {r.status === 'closed' && <Tag color="green">Closed</Tag>}
      </Space>
    )},
  ];

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>Audit Management</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Create checklists, schedule audits, execute with checklist responses, and track findings.</Text>
      <Divider style={{ margin: '12px 0' }} />
      <Tabs defaultActiveKey="checklists" onChange={(key) => {
        if (key === 'schedules' && schedules.length === 0) fetchSchedules();
        if (key === 'executions' && executions.length === 0) fetchExecutions();
      }} items={[
        { key: 'checklists', label: 'Checklists', children: (
          <div>
            {checklistDetail ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Space>
                    <Button onClick={() => setChecklistDetail(null)}>← Back to List</Button>
                    <Title level={5} style={{ margin: 0 }}>{checklistDetail.name}</Title>
                    {checklistDetail.category && <Tag color="blue">{checklistDetail.category}</Tag>}
                  </Space>
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditChecklist(checklistDetail)}>Edit</Button>
                    <Popconfirm title="Delete this checklist?" onConfirm={() => handleDeleteChecklist(checklistDetail.id)}>
                      <Button icon={<DeleteOutlined />} danger>Delete</Button>
                    </Popconfirm>
                  </Space>
                </div>
                {checklistDetail.description && <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{checklistDetail.description}</Text>}
                <Card title="Checklist Items" size="small">
                  {(checklistDetail.items || []).map((item, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                      <Text>{i + 1}. {item.item_text || item}</Text>
                    </div>
                  ))}
                  {(!checklistDetail.items || checklistDetail.items.length === 0) && <Text type="secondary">No items</Text>}
                </Card>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><Button type="primary" icon={<PlusOutlined />} onClick={openAddChecklist}>Add Checklist</Button></div>
                <Table columns={checklistColumns} dataSource={checklists} rowKey="id" loading={checklistLoading} size="middle"
                  onRow={(record) => ({ onClick: () => openChecklistDetail(record), style: { cursor: 'pointer' } })} />
              </div>
            )}
          </div>
        )},
        { key: 'schedules', label: 'Schedules', children: (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => { scheduleForm.resetFields(); setScheduleModal(true); }}>Create Schedule</Button></div>
            <Table columns={scheduleColumns} dataSource={schedules} rowKey="id" loading={scheduleLoading} size="middle" />
          </div>
        )},
        { key: 'executions', label: 'Executions', children: (
          <Table columns={executionColumns} dataSource={executions} rowKey="id" loading={executionLoading} size="middle" />
        )},
      ]} />

      {/* Checklist Modal */}
      <Modal title={editingChecklist ? 'Edit Checklist' : 'Create Checklist'} open={checklistModal} onCancel={() => setChecklistModal(false)} onOk={handleSaveChecklist} okText={editingChecklist ? 'Update' : 'Create'} width={600}>
        <Form form={checklistForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Checklist Name" rules={[{ required: true }]}><Input placeholder="e.g. Quality Compliance Audit" /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} placeholder="Description" /></Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select" options={[{ value: 'quality', label: 'Quality' }, { value: 'compliance', label: 'Compliance' }, { value: 'safety', label: 'Safety' }, { value: 'environmental', label: 'Environmental' }, { value: 'general', label: 'General' }]} />
          </Form.Item>
          <Divider orientation="left">Checklist Items</Divider>
          {checklistItems.map((item, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
              <Col flex="1"><Input placeholder={`Item ${idx + 1}`} value={item} onChange={e => { const u = [...checklistItems]; u[idx] = e.target.value; setChecklistItems(u); }} /></Col>
              <Col><Button icon={<DeleteOutlined />} danger onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))} disabled={checklistItems.length === 1} /></Col>
            </Row>
          ))}
          <Button type="dashed" onClick={() => setChecklistItems([...checklistItems, ''])} icon={<PlusOutlined />} block>Add Item</Button>
        </Form>
      </Modal>

      {/* Schedule Modal */}
      <Modal title="Create Schedule" open={scheduleModal} onCancel={() => setScheduleModal(false)} onOk={handleCreateSchedule} okText="Create" width={500}>
        <Form form={scheduleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="checklist_id" label="Checklist" rules={[{ required: true }]}><Select placeholder="Select" options={checklists.map(c => ({ value: c.id, label: c.name }))} /></Form.Item>
          <Form.Item name="vendor_id" label="Vendor (optional)"><Select placeholder="Select vendor" allowClear options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} /></Form.Item>
          <Form.Item name="vendor_group" label="Or Vendor Group"><Input placeholder="e.g. Tier 1" /></Form.Item>
          <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
            <Select placeholder="Select" options={[{ value: 'one_time', label: 'One Time' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="start_date" label="From Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_date" label="To Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
