import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Tag, Space, Row, Col, Card, Modal, Typography, Divider, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_COLOR = { low: 'blue', medium: 'orange', high: 'red', critical: 'magenta' };
const STATUS_COLOR = { initiated: 'blue', in_progress: 'orange', vendor_closed: 'cyan', closed: 'green' };

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reassignVendorIds, setReassignVendorIds] = useState([]);
  const [reassigning, setReassigning] = useState(false);

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

  const fetchTicketDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicketDetail(res.data.data || res.data);
    } catch { message.error('Failed to load ticket details'); }
    setDetailLoading(false);
  };

  useEffect(() => { fetchTickets(); if (isAdmin) fetchVendors(); }, []);

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

  const handleCloseTicket = async () => {
    try {
      await api.put(`/tickets/${selectedTicket}/close`, { rating: 5, closure_remarks: 'Closed by admin' });
      message.success('Ticket closed');
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
    { title: 'Priority', dataIndex: 'priority', width: 100, render: v => <Tag color={PRIORITY_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase().replace(/_/g, ' ')}</Tag> },
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
                <Text type="secondary">Created: {t.created_at ? dayjs(t.created_at).format('DD-MM-YYYY HH:mm') : '—'}</Text>
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
          <Button danger onClick={handleCloseTicket}>Close Ticket</Button>
        )}
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

      {/* Create Modal */}
      <Modal title="Create Ticket" open={createModal} onCancel={() => setCreateModal(false)} onOk={handleCreate} okText="Create" width={600}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input placeholder="Ticket subject" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe the issue" />
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <Select placeholder="Select priority">
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="vendor_ids" label="Vendors" rules={[{ required: true, message: 'Please select at least one vendor' }]}>
            <Select mode="multiple" placeholder="Select vendors" allowClear>
              {vendors.map(v => <Select.Option key={v.id} value={v.id}>{v.vendor_name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
