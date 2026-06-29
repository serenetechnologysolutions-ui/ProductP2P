import { useState, useEffect } from 'react';
import { Table, Button, Form, Select, Switch, Tag, Row, Col, Card, Divider, Input, InputNumber, Space, message, Statistic, Alert } from 'antd';
import { SaveOutlined, GlobalOutlined } from '@ant-design/icons';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
const { TextArea } = Input;

export default function ESGTracking() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/esg'); setData(res.data.data || []); } catch { message.error('Failed to load ESG data'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (record) => {
    setEditing(record);
    let certs = record.certification_list;
    if (typeof certs === 'string') { try { certs = JSON.parse(certs); } catch { certs = []; } }
    form.setFieldsValue({
      diversity_flag: record.diversity_flag ?? false,
      compliance_status: record.compliance_status || 'pending',
      remarks: record.remarks || '',
      carbon_emission_score: record.carbon_emission_score ?? null,
      energy_consumption: record.energy_consumption ?? null,
      waste_management_score: record.waste_management_score ?? null,
      certification_list: Array.isArray(certs) ? certs : [],
      esg_document_group_id: record.esg_document_group_id || '',
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await api.put(`/esg/${editing.vendor_id}`, values);
      message.success('ESG record updated');
      setEditing(null);
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to update'); }
  };

  const columns = [
    { title: 'Vendor Name', dataIndex: 'vendor_name', sorter: (a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')) },
    {
      title: 'Diversity', dataIndex: 'diversity_flag', width: 100, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
      filters: [{ text: 'Yes', value: true }, { text: 'No', value: false }],
      onFilter: (value, row) => !!row.diversity_flag === value,
    },
    {
      title: 'Compliance', dataIndex: 'compliance_status', width: 140, render: v => <Tag color={v === 'compliant' ? 'green' : v === 'pending' ? 'orange' : 'red'}>{v === 'compliant' ? 'Compliant' : v === 'pending' ? 'Pending' : 'Non-Compliant'}</Tag>,
      sorter: (a, b) => String(a.compliance_status || '').localeCompare(String(b.compliance_status || '')),
      filters: [{ text: 'Compliant', value: 'compliant' }, { text: 'Pending', value: 'pending' }, { text: 'Non-Compliant', value: 'non_compliant' }],
      onFilter: (value, row) => row.compliance_status === value,
    },
    { title: 'Carbon Score', dataIndex: 'carbon_emission_score', width: 120, render: v => v ?? '—', sorter: (a, b) => Number(a.carbon_emission_score || 0) - Number(b.carbon_emission_score || 0) },
    { title: 'Energy Use', dataIndex: 'energy_consumption', width: 120, render: v => v ?? '—', sorter: (a, b) => Number(a.energy_consumption || 0) - Number(b.energy_consumption || 0) },
    { title: 'Waste Score', dataIndex: 'waste_management_score', width: 120, render: v => v ?? '—', sorter: (a, b) => Number(a.waste_management_score || 0) - Number(b.waste_management_score || 0) },
    {
      title: 'Certifications', dataIndex: 'certification_list', ellipsis: true, render: v => {
        let certs = v;
        if (typeof certs === 'string') { try { certs = JSON.parse(certs); } catch { certs = []; } }
        return Array.isArray(certs) && certs.length > 0 ? certs.map(c => <Tag key={c}>{c}</Tag>) : '—';
      }
    },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true },
  ];

  // Edit view
  if (editing) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          items={[{ title: 'Sustainability' }, { title: 'ESG Tracking', onClick: () => setEditing(null) }, { title: editing.vendor_name }]}
          title={`Edit ESG — ${editing.vendor_name}`}
          subtitle="Update Environmental, Social, and Governance compliance data for this vendor."
          onBack={() => setEditing(null)}
          backText="Back to List"
        />
        <Card>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="diversity_flag" label="Diversity Flag" valuePropName="checked">
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="compliance_status" label="Compliance Status" rules={[{ required: true }]}>
                  <Select options={[{ value: 'compliant', label: 'Compliant' }, { value: 'non_compliant', label: 'Non-Compliant' }, { value: 'pending', label: 'Pending' }]} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="remarks" label="Remarks">
              <TextArea rows={3} placeholder="Additional remarks about ESG compliance" />
            </Form.Item>
            <Divider orientation="left">Environmental Metrics</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="carbon_emission_score" label="Carbon Emission Score (0-100)">
                  <InputNumber style={{ width: '100%' }} min={0} max={100} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="energy_consumption" label="Energy Consumption">
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="waste_management_score" label="Waste Management Score (0-100)">
                  <InputNumber style={{ width: '100%' }} min={0} max={100} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="certification_list" label="Certifications">
                  <Select mode="tags" placeholder="e.g. ISO14001, FairTrade" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="esg_document_group_id" label="Evidence Document Group ID">
                  <Input placeholder="Links to documents module" />
                </Form.Item>
              </Col>
            </Row>
            <Divider />
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save Changes</Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      </div>
    );
  }

  // List view
  const compliantCount = data.filter(d => d.compliance_status === 'compliant').length;
  const nonCompliantCount = data.filter(d => d.compliance_status === 'non_compliant').length;
  const scored = data.filter(d => d.carbon_emission_score != null);
  const avgCarbonScore = scored.length > 0 ? Math.round(scored.reduce((s, d) => s + Number(d.carbon_emission_score), 0) / scored.length) : null;

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Sustainability' }, { title: 'ESG Tracking' }]}
        title="ESG Tracking"
        subtitle="Track supplier Environmental, Social, and Governance compliance status."
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Tracked Vendors" value={data.length} prefix={<GlobalOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Compliant" value={compliantCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Non-Compliant" value={nonCompliantCount} valueStyle={nonCompliantCount > 0 ? { color: '#cf1322' } : undefined} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Avg Carbon Score" value={avgCarbonScore ?? '—'} /></Card></Col>
      </Row>

      {nonCompliantCount > 0 && (
        <Alert style={{ marginBottom: 16 }} type="warning" showIcon message={`${nonCompliantCount} vendor(s) are non-compliant`} description="Review their ESG record and request updated certifications." />
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          onRow={(record) => ({ onClick: () => openEdit(record), style: { cursor: 'pointer' } })} />
      </Card>
    </div>
  );
}
