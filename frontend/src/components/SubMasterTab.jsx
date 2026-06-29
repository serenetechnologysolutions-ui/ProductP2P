import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, InputNumber, Tag, Space, Card, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api/axios';
import CompanySelector from './CompanySelector';

export default function SubMasterTab({ category }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const canManage = ['mdm_admin', 'system_admin'].includes(user.role);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [companyId, setCompanyId] = useState(null);
  const [taxPercentage, setTaxPercentage] = useState(null);
  const [companies, setCompanies] = useState([]);

  const needsCompany = category === 'cost_center';
  const isHsn = category === 'hsn_code';

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get(`/sub-masters/${category}`); setData(res.data.data || []); } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [category]);
  useEffect(() => {
    if (needsCompany) {
      api.get('/companies?active_only=true').then(r => setCompanies(r.data.data || [])).catch(() => {});
    }
  }, [needsCompany]);

  const getCompanyName = (id) => {
    if (!id) return null;
    const c = companies.find(co => co.id === id);
    return c ? c.company_name : id.substring(0, 8) + '...';
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (needsCompany && !companyId) {
        message.error('Please select a company for this cost centre');
        return;
      }
      const payload = { ...values, category };
      if (needsCompany) payload.company_id = companyId;
      if (isHsn) payload.tax_percentage = taxPercentage;
      if (editing) {
        const updatePayload = { ...values };
        if (needsCompany) updatePayload.company_id = companyId;
        if (isHsn) updatePayload.tax_percentage = taxPercentage;
        await api.put(`/sub-masters/${editing.id}`, updatePayload);
        message.success('Updated');
      } else {
        await api.post('/sub-masters', payload);
        message.success('Added');
      }
      setShowForm(false); setEditing(null); setCompanyId(null); setTaxPercentage(null); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Error'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code', width: 100, render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    ...(isHsn ? [{ title: 'Tax %', dataIndex: 'tax_percentage', width: 90, render: v => v != null ? `${v}%` : '—' }] : []),
    ...(needsCompany ? [{ title: 'Company', dataIndex: 'company_id', width: 200, render: v => v ? <Tag color="purple">{getCompanyName(v)}</Tag> : <Tag>All Companies</Tag> }] : []),
    ...(canManage ? [{ title: '', width: 100, render: (_, r) => (
      <Space>
        <Button icon={<EditOutlined />} size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setCompanyId(r.company_id || null); setTaxPercentage(r.tax_percentage ?? null); setShowForm(true); }} />
        <Popconfirm title="Remove?" onConfirm={async () => { await api.delete(`/sub-masters/${r.id}`); fetchData(); }}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>
      </Space>
    )}] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {canManage && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setCompanyId(null); setTaxPercentage(null); setShowForm(true); }}>Add</Button>}
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      {showForm && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Form form={form} layout="inline">
            {needsCompany && (
              <Form.Item label="Company" required>
                <CompanySelector value={companyId} onChange={setCompanyId} placeholder="Select company" style={{ width: 200 }} />
              </Form.Item>
            )}
            <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Name (e.g. Electrical Machinery)" style={{ width: 200 }} /></Form.Item>
            <Form.Item name="code"><Input placeholder="Code" style={{ width: 100 }} /></Form.Item>
            {isHsn && (
              <Form.Item label="Tax %">
                <InputNumber placeholder="Tax %" min={0} max={100} step={0.5} precision={2} style={{ width: 90 }} value={taxPercentage} onChange={setTaxPercentage} />
              </Form.Item>
            )}
            <Form.Item><Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button></Form.Item>
            <Form.Item><Button onClick={() => { setShowForm(false); setEditing(null); setCompanyId(null); setTaxPercentage(null); }}>Cancel</Button></Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}
