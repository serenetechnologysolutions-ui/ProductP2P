import { useState, useEffect } from 'react';
import { Table, Button, Form, Select, Switch, Tag, Row, Col, Card, Typography, Divider, Input, InputNumber, Space, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
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
    { title: 'Vendor Name', dataIndex: 'vendor_name' },
    { title: 'Diversity', dataIndex: 'diversity_flag', width: 100, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Compliance', dataIndex: 'compliance_status', width: 140, render: v => <Tag color={v === 'compliant' ? 'green' : v === 'pending' ? 'orange' : 'red'}>{v === 'compliant' ? 'Compliant' : v === 'pending' ? 'Pending' : 'Non-Compliant'}</Tag> },
    { title: 'Carbon Score', dataIndex: 'carbon_emission_score', width: 120, render: v => v ?? '—' },
    { title: 'Energy Use', dataIndex: 'energy_consumption', width: 120, render: v => v ?? '—' },
    { title: 'Waste Score', dataIndex: 'waste_management_score', width: 120, render: v => v ?? '—' },
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
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => setEditing(null)} style={{ marginBottom: 16 }}>Back to List</Button>
        <Title level={4}>Edit ESG — {editing.vendor_name}</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Update Environmental, Social, and Governance compliance data for this vendor.</Text>
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
  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>ESG Tracking</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Track supplier Environmental, Social, and Governance compliance status.</Text>
      <Divider style={{ margin: '12px 0' }} />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
        onRow={(record) => ({ onClick: () => openEdit(record), style: { cursor: 'pointer' } })} />
    </div>
  );
}
