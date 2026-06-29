import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Tag, Space, Card, Typography, Upload, message, Row, Col, Statistic, Alert } from 'antd';
import { UploadOutlined, SearchOutlined, ClearOutlined, CheckOutlined, CloseOutlined, InboxOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { API_BASE_URL } from '../config';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;

const MODULE_OPTIONS = ['vendor', 'purchase_requisition', 'purchase_order', 'asn', 'rfq', 'ticket', 'audit', 'esg'].map(m => ({ value: m, label: m.replace('_', ' ').toUpperCase() }));
const STATUS_COLOR = { pending: 'default', verified: 'green', rejected: 'red' };

export default function DocumentCenter() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ module_name: undefined, record_id: '', document_group_id: '' });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const { isRequired } = useFieldConfig('document');

  const fetchData = useCallback(async (overrideFilters) => {
    setLoading(true);
    try {
      const f = overrideFilters || filters;
      const params = {};
      if (f.module_name) params.module_name = f.module_name;
      if (f.record_id) params.record_id = f.record_id;
      if (f.document_group_id) params.document_group_id = f.document_group_id;
      const res = await api.get('/documents', { params });
      setData(res.data.data || []);
    } catch { message.error('Failed to load documents'); }
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchData(); }, []);

  const handleSearch = () => fetchData(filters);
  const handleClear = () => { const cleared = { module_name: undefined, record_id: '', document_group_id: '' }; setFilters(cleared); fetchData(cleared); };

  const openUploadModal = () => { form.resetFields(); setUploadFile(null); setUploadModalOpen(o => !o); };
  const closeUploadModal = () => { setUploadModalOpen(false); setUploadFile(null); };

  const handleUpload = async () => {
    if (!uploadFile) { message.error('Choose a file first'); return; }
    try {
      const values = await form.validateFields();
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('module_name', values.module_name);
      if (values.record_id) formData.append('record_id', values.record_id);
      if (values.file_type) formData.append('file_type', values.file_type);
      if (values.document_group_id) formData.append('document_group_id', values.document_group_id);
      if (values.expiry_date) formData.append('expiry_date', values.expiry_date.format('YYYY-MM-DD'));
      await api.post('/documents', formData);
      message.success('Document uploaded');
      closeUploadModal();
      fetchData();
    } catch (err) {
      if (err.errorFields) { setUploading(false); return; }
      message.error(err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleVerify = async (id, verification_status) => {
    try {
      await api.put(`/documents/${id}/verify`, { verification_status });
      message.success(`Document ${verification_status}`);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to update status'); }
  };

  const columns = [
    { title: 'File Name', dataIndex: 'file_name', render: (v, r) => <a href={`${API_BASE_URL}/uploads/${r.file_url?.split(/[\\/]/).pop()}`} target="_blank" rel="noreferrer">{v}</a>, sorter: (a, b) => String(a.file_name || '').localeCompare(String(b.file_name || '')) },
    {
      title: 'Module', dataIndex: 'module_name', width: 120, render: v => <Tag color="blue">{v}</Tag>,
      sorter: (a, b) => String(a.module_name || '').localeCompare(String(b.module_name || '')),
      filters: [...new Set((data || []).map(d => d.module_name).filter(Boolean))].map(v => ({ text: v, value: v })),
      onFilter: (value, row) => row.module_name === value,
    },
    { title: 'Record ID', dataIndex: 'record_id', width: 200, ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    { title: 'File Type', dataIndex: 'file_type', width: 110, render: v => v || <Text type="secondary">—</Text>, sorter: (a, b) => String(a.file_type || '').localeCompare(String(b.file_type || '')) },
    { title: 'Uploaded At', dataIndex: 'uploaded_at', width: 170, render: v => v ? new Date(v).toLocaleString() : '—', sorter: (a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0) },
    { title: 'Expiry', dataIndex: 'expiry_date', width: 110, render: v => v ? dayjs(v).format('YYYY-MM-DD') : <Text type="secondary">—</Text>, sorter: (a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0) },
    {
      title: 'Status', dataIndex: 'verification_status', width: 110, render: v => <Tag color={STATUS_COLOR[v]}>{(v || 'pending').toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.verification_status || '').localeCompare(String(b.verification_status || '')),
      filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => (row.verification_status || 'pending') === value,
    },
    {
      title: 'Actions', width: 120, render: (_, record) => (
        record.verification_status === 'pending' ? (
          <Space>
            <Button icon={<CheckOutlined />} size="small" style={{ color: '#52c41a' }} onClick={() => handleVerify(record.id, 'verified')} />
            <Button icon={<CloseOutlined />} size="small" danger onClick={() => handleVerify(record.id, 'rejected')} />
          </Space>
        ) : null
      ),
    },
  ];

  const pendingCount = data.filter(d => (d.verification_status || 'pending') === 'pending').length;
  const expiringSoonCount = data.filter(d => d.expiry_date && dayjs(d.expiry_date).diff(dayjs(), 'day') >= 0 && dayjs(d.expiry_date).diff(dayjs(), 'day') <= 30).length;

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'Document Center' }]}
        title="Document Center"
        subtitle="Generic document storage for modules without dedicated upload flows — tickets, audit evidence, ESG certificates, and more."
        extra={<Button type="primary" icon={<UploadOutlined />} onClick={openUploadModal}>Upload Document</Button>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title="Total Documents" value={data.length} prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Pending Verification" value={pendingCount} valueStyle={pendingCount > 0 ? { color: '#d48806' } : undefined} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Expiring Within 30 Days" value={expiringSoonCount} valueStyle={expiringSoonCount > 0 ? { color: '#cf1322' } : undefined} /></Card></Col>
      </Row>

      {pendingCount > 0 && (
        <Alert style={{ marginBottom: 16 }} type="warning" showIcon message={`${pendingCount} document(s) awaiting verification`} />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col span={5}>
            <Select
              placeholder="Module"
              allowClear
              style={{ width: '100%' }}
              options={MODULE_OPTIONS}
              value={filters.module_name}
              onChange={v => setFilters({ ...filters, module_name: v })}
            />
          </Col>
          <Col span={5}>
            <Input placeholder="Record ID" value={filters.record_id} onChange={e => setFilters({ ...filters, record_id: e.target.value })} allowClear />
          </Col>
          <Col span={6}>
            <Input placeholder="Document Group ID" value={filters.document_group_id} onChange={e => setFilters({ ...filters, document_group_id: e.target.value })} allowClear />
          </Col>
          <Col><Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>Search</Button></Col>
          <Col><Button icon={<ClearOutlined />} onClick={handleClear}>Clear</Button></Col>
        </Row>
      </Card>

      <InlineExpandPanel
        open={uploadModalOpen}
        title="Upload Document"
        onCancel={closeUploadModal}
        onSubmit={handleUpload}
        submitText="Upload"
        loading={uploading}
      >
        <Upload.Dragger
          maxCount={1}
          beforeUpload={(file) => { setUploadFile(file); return false; }}
          onRemove={() => setUploadFile(null)}
          fileList={uploadFile ? [{ uid: '1', name: uploadFile.name }] : []}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Click or drag a file to this area</p>
        </Upload.Dragger>

        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="module_name" label="Module" rules={[{ required: isRequired('module_name', true), message: 'Select a module' }]}>
            <Select placeholder="Select module" options={MODULE_OPTIONS} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="record_id" label="Record ID" rules={[{ required: isRequired('record_id', false), message: 'Record ID is required' }]}>
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="file_type" label="File Type" rules={[{ required: isRequired('file_type', false), message: 'File Type is required' }]}>
                <Input placeholder="e.g. pdf, image, certificate" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="document_group_id" label="Document Group ID" rules={[{ required: isRequired('document_group_id', false), message: 'Document Group ID is required' }]}>
                <Input placeholder="Optional — leave blank to create a new group" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiry_date" label="Expiry Date" rules={[{ required: isRequired('expiry_date', false), message: 'Expiry Date is required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </InlineExpandPanel>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} />
    </div>
  );
}
