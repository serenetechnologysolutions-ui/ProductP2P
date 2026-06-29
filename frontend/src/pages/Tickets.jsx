import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Typography, Statistic, Divider, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, SendOutlined, SwapOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_COLOR = { low: 'blue', medium: 'orange', high: 'red', critical: 'magenta' };
const STATUS_COLOR = { initiated: 'blue', in_progress: 'orange', vendor_closed: 'cyan', closed: 'green' };

function SlaBadge({ sla_breach_flag, sla_due_date }) {
  if (sla_breach_flag) return <Tag color="red">SLA BREACHED</Tag>;
  if (sla_due_date) return <Tag>Due: {dayjs(sla_due_date).format('DD-MM-YYYY HH:mm')}</Tag>;
  return null;
}

export default function Tickets() {
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  const [view, setView] = useState('list');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState([]);
  const [ticketCategories, setTicketCategories] = useState([]);

  // Messaging
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Reassign
  const [reassignVendorIds, setReassignVendorIds] = useState([]);
  const [reassigning, setReassigning] = useState(false);

  // Close ticket
  const [closePanelOpen, setClosePanelOpen] = useState(false);
  const [closeForm] = Form.useForm();

  const { isRequired } = useFieldConfig('ticket');
  const { isRequired: isCloseFieldRequired } = useFieldConfig('ticket_close');

  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const isAdmin = user.role !== 'vendor';

  // ─── DATA FETCHING ───
  const fetchTickets = async () => {
    setLoading(true);
    try { const res = await api.get('/tickets'); setTickets(res.data.data || []); } catch { message.error('Failed to load tickets'); }
    setLoading(false);
  };

  const fetchVendors = async () => {
    try { const res = await api.get('/vendors'); setVendors(res.data.data || []); } catch {}
  };

  const fetchTicketCategories = async () => {
    try { const res = await api.get('/sub-masters/ticket_category'); setTicketCategories(res.data.data || []); } catch {}
  };

  const fetchTicketDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicketDetail(res.data.data || res.data);
    } catch { message.error('Failed to load ticket details'); }
    setDetailLoading(false);
  };

  useEffect(() => { fetchTickets(); if (isAdmin) fetchVendors(); fetchTicketCategories(); }, []);

  // ─── ACTIONS ───
  const openCreate = () => {
    form.resetFields();
    setView('create');
  };

  const openDetail = (record) => {
    setSelectedTicket(record.id);
    fetchTicketDetail(record.id);
    setNewMessage('');
    setReassignVendorIds([]);
    setClosePanelOpen(false);
    setView('detail');
  };

  const backToList = () => {
    setView('list');
    setSelectedTicket(null);
    setTicketDetail(null);
    setNewMessage('');
    setReassignVendorIds([]);
    setClosePanelOpen(false);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/tickets', values);
      message.success('Ticket created');
      setView('list');
      fetchTickets();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create ticket'); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await api.post(`/tickets/${selectedTicket}/messages`, { message: newMessage });
      setNewMessage('');
      fetchTicketDetail(selectedTicket);
    } catch { message.error('Failed to send message'); }
    setSendingMessage(false);
  };

  const handleCloseTicket = async () => {
    try {
      const values = await closeForm.validateFields();
      await api.put(`/tickets/${selectedTicket}/close`, values);
      message.success('Ticket closed');
      setClosePanelOpen(false);
      fetchTicketDetail(selectedTicket);
      fetchTickets();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to close ticket'); }
  };

  const handleReassign = async () => {
    if (reassignVendorIds.length === 0) {
      message.warning('Please select at least one vendor');
      return;
    }
    setReassigning(true);
    try {
      await api.put(`/tickets/${selectedTicket}/reassign`, { vendor_ids: reassignVendorIds });
      message.success('Vendors reassigned');
      setReassignVendorIds([]);
      fetchTicketDetail(selectedTicket);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to reassign vendors'); }
    setReassigning(false);
  };

  // ─── TABLE COLUMNS ───
  const columns = [
    {
      title: 'Ticket #', dataIndex: 'ticket_number', width: 120, ellipsis: true,
      render: (v, r) => <Button type="link" onClick={() => openDetail(r)}>{v || `#${r.id}`}</Button>,
      sorter: (a, b) => String(a.ticket_number || '').localeCompare(String(b.ticket_number || ''), undefined, { numeric: true }),
    },
    { title: 'Subject', dataIndex: 'subject', width: 220, ellipsis: true, sorter: (a, b) => String(a.subject || '').localeCompare(String(b.subject || '')) },
    {
      title: 'Category', dataIndex: 'category', width: 110, render: v => v ? <Tag color="purple">{v}</Tag> : '—',
      sorter: (a, b) => String(a.category || '').localeCompare(String(b.category || '')),
      filters: ticketCategories.map(c => ({ text: c.name, value: c.name })),
      onFilter: (value, row) => row.category === value,
    },
    {
      title: 'Priority', dataIndex: 'priority', width: 100, render: v => <Tag color={PRIORITY_COLOR[v]}>{v?.toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.priority || '').localeCompare(String(b.priority || '')),
      filters: Object.keys(PRIORITY_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.priority === value,
    },
    {
      title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase().replace(/_/g, ' ')}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase().replace(/_/g, ' '), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    { title: 'SLA', width: 150, render: (_, r) => <SlaBadge sla_breach_flag={r.sla_breach_flag} sla_due_date={r.sla_due_date} /> },
    { title: 'Created', dataIndex: 'created_at', width: 110, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—', sorter: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
  ];

  const vendorStatusColumns = [
    { title: 'Vendor Name', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120, render: v => <Tag color={v === 'closed' ? 'green' : 'blue'}>{v?.toUpperCase()}</Tag> },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: v => v || '—' },
    { title: 'Closed At', dataIndex: 'closed_at', key: 'closed_at', width: 150, render: v => v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '—' },
  ];

  // ─── LIST VIEW ───
  if (view === 'list') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Advanced' }, { title: 'Supplier Issues' }]}
          title="Supplier Issues"
          subtitle="Track and resolve supplier issues with structured communication and accountability."
          extra={isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create Ticket</Button>}
        />

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small"><Statistic title="Total Tickets" value={tickets.length} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="Open" value={tickets.filter(t => t.status === 'initiated').length} valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="In Progress" value={tickets.filter(t => t.status === 'in_progress').length} valueStyle={{ color: '#fa8c16' }} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title="Closed" value={tickets.filter(t => t.status === 'closed').length} valueStyle={{ color: '#3f8600' }} /></Card>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={tickets}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          scroll={{ x: 930 }}
          onRow={(record) => ({ onClick: () => openDetail(record), style: { cursor: 'pointer' } })}
        />
      </div>
    );
  }

  // ─── CREATE VIEW ───
  if (view === 'create') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Advanced' }, { title: 'Supplier Issues', onClick: backToList }, { title: 'Create Ticket' }]}
          title="Create Ticket"
          onBack={backToList}
        />

        <Card size="small" title="Ticket Details">
          <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
            <Form.Item name="subject" label="Subject" rules={[{ required: isRequired('subject', true), message: 'Subject is required' }]}>
              <Input placeholder="Ticket subject" />
            </Form.Item>
            <Form.Item name="description" label="Description" rules={[{ required: isRequired('description', true), message: 'Description is required' }]}>
              <TextArea rows={3} placeholder="Describe the issue" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="priority" label="Priority" rules={[{ required: isRequired('priority', true), message: 'Priority is required' }]}>
                  <Select placeholder="Select priority">
                    <Select.Option value="low">Low</Select.Option>
                    <Select.Option value="medium">Medium</Select.Option>
                    <Select.Option value="high">High</Select.Option>
                    <Select.Option value="critical">Critical</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="category" label="Category" rules={[{ required: isRequired('category', false), message: 'Category is required' }]}>
                  <Select placeholder="Select category" allowClear>
                    {ticketCategories.map(c => <Select.Option key={c.id || c.name} value={c.name}>{c.name}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="vendor_ids" label="Vendors" rules={[{ required: isRequired('vendor_ids', true), message: 'Please select at least one vendor' }]}>
              <Select mode="multiple" placeholder="Select vendors" allowClear>
                {vendors.map(v => <Select.Option key={v.id} value={v.id}>{v.vendor_name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="sla_hours" label="SLA (hours)" rules={[{ required: isRequired('sla_hours', false), message: 'SLA (hours) is required' }]}>
              <Input type="number" min={1} placeholder="e.g. 48" />
            </Form.Item>
          </Form>
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>Create Ticket</Button>
            <Button onClick={backToList}>Cancel</Button>
          </Space>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  const t = ticketDetail;
  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Advanced' }, { title: 'Supplier Issues', onClick: backToList }, { title: t?.ticket_number || `#${selectedTicket}` }]}
        title={t?.subject || 'Ticket Detail'}
        onBack={backToList}
        extra={t && <Space>
          <Tag color={PRIORITY_COLOR[t.priority]}>{t.priority?.toUpperCase()}</Tag>
          <Tag color={STATUS_COLOR[t.status]}>{t.status?.toUpperCase().replace(/_/g, ' ')}</Tag>
        </Space>}
      />

      {!t ? (
        <Card loading={detailLoading} />
      ) : (
        <>
          {/* Ticket Information */}
          <Card size="small" style={{ marginBottom: 16 }} title="Ticket Information">
            <Row gutter={16}>
              <Col span={4}><Text type="secondary">Ticket #</Text><br /><Text strong>{t.ticket_number || `#${t.id}`}</Text></Col>
              <Col span={4}><Text type="secondary">Priority</Text><br /><Tag color={PRIORITY_COLOR[t.priority]}>{t.priority?.toUpperCase()}</Tag></Col>
              <Col span={4}><Text type="secondary">Status</Text><br /><Tag color={STATUS_COLOR[t.status]}>{t.status?.toUpperCase().replace(/_/g, ' ')}</Tag></Col>
              <Col span={4}><Text type="secondary">Category</Text><br /><Text strong>{t.category || '—'}</Text></Col>
              <Col span={4}><Text type="secondary">SLA</Text><br /><SlaBadge sla_breach_flag={t.sla_breach_flag} sla_due_date={t.sla_due_date} /></Col>
              <Col span={4}><Text type="secondary">Created</Text><br /><Text strong>{t.created_at ? dayjs(t.created_at).format('DD-MM-YYYY HH:mm') : '—'}</Text></Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary">Description:</Text>
            <div style={{ marginTop: 4 }}><Text>{t.description || '—'}</Text></div>
            {t.root_cause && <><Divider style={{ margin: '12px 0' }} /><Text type="secondary">Root Cause:</Text> <Text>{t.root_cause}</Text></>}
            {t.resolution_type && <><br /><Text type="secondary">Resolution Type:</Text> <Tag>{t.resolution_type}</Tag></>}
          </Card>

          {/* Vendor Assignments */}
          {(t.vendor_statuses || []).length > 0 && (
            <Card size="small" title="Vendor Assignments" style={{ marginBottom: 16 }}>
              <Table columns={vendorStatusColumns} dataSource={t.vendor_statuses} rowKey={(r, idx) => r.vendor_id || idx} pagination={false} size="small" scroll={{ x: 'max-content' }} />
            </Card>
          )}

          {/* Reassign Vendors */}
          {isAdmin && t.status !== 'closed' && (
            <Card size="small" title="Reassign Vendors" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {(t.vendor_statuses || []).length > 0 && (
                  <div>
                    <Text type="secondary" style={{ marginRight: 8 }}>Currently assigned:</Text>
                    {t.vendor_statuses.map((vs, idx) => (
                      <Tag key={vs.vendor_id || idx}>{vs.vendor_name}</Tag>
                    ))}
                  </div>
                )}
                <Row gutter={8} align="middle">
                  <Col flex="1">
                    <Select mode="multiple" placeholder="Select vendors to reassign" value={reassignVendorIds} onChange={setReassignVendorIds} style={{ width: '100%' }} allowClear>
                      {vendors.map(v => <Select.Option key={v.id} value={v.id}>{v.vendor_name}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<SwapOutlined />} onClick={handleReassign} loading={reassigning}>Reassign</Button>
                  </Col>
                </Row>
              </Space>
            </Card>
          )}

          {/* Messages Thread */}
          <Card size="small" title="Messages" style={{ marginBottom: 16 }}>
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
              {(t.messages || []).length === 0 && <Text type="secondary">No messages yet</Text>}
              {(t.messages || []).map((msg, idx) => (
                <div key={idx} style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong>{msg.sender_name || 'User'} <Tag style={{ marginLeft: 4 }}>{msg.sender_role || 'admin'}</Tag></Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{msg.created_at ? dayjs(msg.created_at).format('DD-MM-YYYY HH:mm') : ''}</Text>
                  </div>
                  <Text>{msg.message || msg.content}</Text>
                </div>
              ))}
            </div>
            {t.status !== 'closed' && (
              <Row gutter={8}>
                <Col flex="1"><TextArea rows={2} placeholder="Type your message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} /></Col>
                <Col><Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} loading={sendingMessage} style={{ height: '100%' }}>Send</Button></Col>
              </Row>
            )}
          </Card>

          {/* Action Buttons */}
          {t.status !== 'closed' && (
            <Card size="small" style={{ marginBottom: 16 }}>
              {!closePanelOpen ? (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => { closeForm.resetFields(); setClosePanelOpen(true); }}>Close Ticket</Button>
              ) : (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>Close Ticket</Text>
                  <Form form={closeForm} layout="vertical" style={{ maxWidth: 500 }}>
                    <Form.Item name="rating" label="Rating (1-5)" rules={[{ required: isCloseFieldRequired('rating', true), type: 'number', min: 1, max: 5, message: 'Rating is required' }]}>
                      <Select placeholder="Select rating">
                        {[1, 2, 3, 4, 5].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="closure_remarks" label="Closure Remarks" rules={[{ required: isCloseFieldRequired('closure_remarks', true), message: 'Closure Remarks is required' }]}>
                      <TextArea rows={3} placeholder="Describe how the issue was resolved" />
                    </Form.Item>
                    <Form.Item name="root_cause" label="Root Cause" rules={[{ required: isCloseFieldRequired('root_cause', false), message: 'Root Cause is required' }]}>
                      <TextArea rows={2} placeholder="What was the underlying cause?" />
                    </Form.Item>
                    <Form.Item name="resolution_type" label="Resolution Type" rules={[{ required: isCloseFieldRequired('resolution_type', false), message: 'Resolution Type is required' }]}>
                      <Input placeholder="e.g. Replaced, Refunded, Process Fix" />
                    </Form.Item>
                  </Form>
                  <Space>
                    <Button danger onClick={handleCloseTicket}>Close Ticket</Button>
                    <Button onClick={() => setClosePanelOpen(false)}>Cancel</Button>
                  </Space>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
