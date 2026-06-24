import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Drawer, Typography, Divider, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';

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
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState([]);
  const [ticketCategories, setTicketCategories] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reassignVendorIds, setReassignVendorIds] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [closeForm] = Form.useForm();
  const { isRequired } = useFieldConfig('ticket');
  const { isRequired: isCloseFieldRequired } = useFieldConfig('ticket_close');

  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const isAdmin = user.role !== 'vendor';

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

  const openCreate = () => { form.resetFields(); setCreateModal(true); };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/tickets', values);
      message.success('Ticket created');
      setCreateModal(false);
      fetchTickets();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create ticket'); }
  };

  const handleViewTicket = (record) => {
    setSelectedTicket(record.id);
    fetchTicketDetail(record.id);
  };

  const handleBack = () => {
    setSelectedTicket(null);
    setTicketDetail(null);
    setNewMessage('');
    setReassignVendorIds([]);
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

  const openCloseModal = () => { closeForm.resetFields(); setCloseModal(true); };

  const handleCloseTicket = async () => {
    try {
      const values = await closeForm.validateFields();
      await api.put(`/tickets/${selectedTicket}/close`, values);
      message.success('Ticket closed');
      setCloseModal(false);
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

  const columns = [
    { title: 'Ticket #', dataIndex: 'ticket_number', render: (v, r) => <Button type="link" onClick={() => handleViewTicket(r)}>{v || `#${r.id}`}</Button> },
    { title: 'Subject', dataIndex: 'subject' },
    { title: 'Category', dataIndex: 'category', width: 110, render: v => v ? <Tag color="purple">{v}</Tag> : '—' },
    { title: 'Priority', dataIndex: 'priority', width: 100, render: v => <Tag color={PRIORITY_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase().replace(/_/g, ' ')}</Tag> },
    { title: 'SLA', width: 150, render: (_, r) => <SlaBadge sla_breach_flag={r.sla_breach_flag} sla_due_date={r.sla_due_date} /> },
    { title: 'Created', dataIndex: 'created_at', width: 110, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
  ];

  const vendorStatusColumns = [
    { title: 'Vendor Name', dataIndex: 'vendor_name', key: 'vendor_name' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: v => <Tag color={v === 'closed' ? 'green' : 'blue'}>{v?.toUpperCase()}</Tag>
    },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: v => v || '—' },
    {
      title: 'Closed At', dataIndex: 'closed_at', key: 'closed_at', width: 150,
      render: v => v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '—'
    },
  ];

  // Detail view
  if (selectedTicket && ticketDetail) {
    const t = ticketDetail;
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 16 }}>Back to Tickets</Button>
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Title level={5} style={{ margin: 0 }}>{t.subject}</Title>
              <Text type="secondary">{t.ticket_number || `#${t.id}`}</Text>
              <Divider style={{ margin: '12px 0' }} />
              <Text>{t.description}</Text>
            </Col>
            <Col span={8}>
              <Space direction="vertical" size="small">
                <Text type="secondary">Priority: <Tag color={PRIORITY_COLOR[t.priority]}>{t.priority?.toUpperCase()}</Tag></Text>
                <Text type="secondary">Status: <Tag color={STATUS_COLOR[t.status]}>{t.status?.toUpperCase().replace(/_/g, ' ')}</Tag></Text>
                {t.category && <Text type="secondary">Category: <Tag color="purple">{t.category}</Tag></Text>}
                {(t.sla_breach_flag || t.sla_due_date) && <Text type="secondary">SLA: <SlaBadge sla_breach_flag={t.sla_breach_flag} sla_due_date={t.sla_due_date} /></Text>}
                <Text type="secondary">Created: {t.created_at ? dayjs(t.created_at).format('DD-MM-YYYY HH:mm') : '—'}</Text>
                {t.root_cause && <Text type="secondary">Root Cause: <Text>{t.root_cause}</Text></Text>}
                {t.resolution_type && <Text type="secondary">Resolution Type: <Tag>{t.resolution_type}</Tag></Text>}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Vendor Statuses */}
        {(t.vendor_statuses || []).length > 0 && (
          <Card title="Vendor Statuses" style={{ marginBottom: 16 }}>
            <Table
              columns={vendorStatusColumns}
              dataSource={t.vendor_statuses}
              rowKey={(r, idx) => r.vendor_id || idx}
              pagination={false}
              size="small"
            />
          </Card>
        )}

        {/* Reassign Vendors */}
        {isAdmin && t.status !== 'closed' && (
          <Card title="Reassign Vendors" style={{ marginBottom: 16 }}>
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
                  <Select
                    mode="multiple"
                    placeholder="Select vendors to reassign"
                    value={reassignVendorIds}
                    onChange={setReassignVendorIds}
                    style={{ width: '100%' }}
                    allowClear
                  >
                    {vendors.map(v => <Select.Option key={v.id} value={v.id}>{v.vendor_name}</Select.Option>)}
                  </Select>
                </Col>
                <Col>
                  <Button type="primary" icon={<SwapOutlined />} onClick={handleReassign} loading={reassigning}>
                    Reassign
                  </Button>
                </Col>
              </Row>
            </Space>
          </Card>
        )}

        {/* Messages Thread */}
        <Card title="Messages" style={{ marginBottom: 16 }}>
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
              <Col flex="1">
                <TextArea
                  rows={2}
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
              </Col>
              <Col>
                <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage} loading={sendingMessage} style={{ height: '100%' }}>
                  Send
                </Button>
              </Col>
            </Row>
          )}
        </Card>

        {t.status !== 'closed' && (
          <Button danger onClick={openCloseModal}>Close Ticket</Button>
        )}

        {/* Close Ticket Drawer */}
        <Drawer title="Close Ticket" open={closeModal} onClose={() => setCloseModal(false)} width={480} footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCloseModal(false)}>Cancel</Button>
            <Button type="primary" onClick={handleCloseTicket}>Close Ticket</Button>
          </Space>
        }>
          <Form form={closeForm} layout="vertical" style={{ marginTop: 16 }}>
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
        </Drawer>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Supplier Issues</Title>
          <Text type="secondary">Track and resolve supplier issues with structured communication and accountability.</Text>
        </div>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create Ticket</Button>}
      </div>
      <Table columns={columns} dataSource={tickets} rowKey="id" loading={loading} size="middle" />

      {/* Create Drawer */}
      <Drawer title="Create Ticket" open={createModal} onClose={() => setCreateModal(false)} width={600} footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button type="primary" onClick={handleCreate}>Create</Button>
        </Space>
      }>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="subject" label="Subject" rules={[{ required: isRequired('subject', true), message: 'Subject is required' }]}>
            <Input placeholder="Ticket subject" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: isRequired('description', true), message: 'Description is required' }]}>
            <TextArea rows={3} placeholder="Describe the issue" />
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: isRequired('priority', true), message: 'Priority is required' }]}>
            <Select placeholder="Select priority">
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="vendor_ids" label="Vendors" rules={[{ required: isRequired('vendor_ids', true), message: 'Please select at least one vendor' }]}>
            <Select mode="multiple" placeholder="Select vendors" allowClear>
              {vendors.map(v => <Select.Option key={v.id} value={v.id}>{v.vendor_name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: isRequired('category', false), message: 'Category is required' }]}>
            <Select placeholder="Select category" allowClear>
              {ticketCategories.map(c => <Select.Option key={c.id || c.name} value={c.name}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="sla_hours" label="SLA (hours)" rules={[{ required: isRequired('sla_hours', false), message: 'SLA (hours) is required' }]}>
            <Input type="number" min={1} placeholder="e.g. 48" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
