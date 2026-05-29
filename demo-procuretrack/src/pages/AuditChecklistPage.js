import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Divider, Tag, Space, message } from 'antd';
import { OrderedListOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultChecklist = {
  name: 'Quality Compliance Audit',
  category: 'Quality',
  items: [
    'ISO 9001 certification valid',
    'QC process documented',
    'Incoming inspection process defined',
    'Non-conformance tracking system',
    'Corrective action process in place',
  ],
};

export default function AuditChecklistPage({ demoData, updateData, onDone }) {
  const [form] = Form.useForm();
  const [items, setItems] = useState(defaultChecklist.items);

  const handleUseDefault = () => {
    form.setFieldsValue({ name: defaultChecklist.name, category: defaultChecklist.category });
    setTimeout(() => {
      message.success('Audit checklist created with 5 items!');
      updateData('checklist', defaultChecklist);
      onDone();
    }, 600);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><OrderedListOutlined /> Create Audit Checklist</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Define the checklist items that will be used during vendor audits.
      </Text>

      <Card>
        <Form form={form} layout="vertical" initialValues={{ name: defaultChecklist.name, category: defaultChecklist.category }}>
          <Form.Item label="Checklist Name" name="name">
            <Input />
          </Form.Item>
          <Form.Item label="Category" name="category">
            <Select>
              <Option value="Quality">Quality</Option>
              <Option value="Safety">Safety</Option>
              <Option value="Environmental">Environmental</Option>
              <Option value="Compliance">Compliance</Option>
            </Select>
          </Form.Item>
        </Form>

        <Divider>Checklist Items</Divider>

        <Space direction="vertical" style={{ width: '100%' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
              <Tag color="blue">{idx + 1}</Tag>
              <Text>{item}</Text>
            </div>
          ))}
        </Space>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space size="large">
            <Button type="primary" size="large" onClick={handleUseDefault}>
              Use Default &amp; Proceed
            </Button>
            <Button size="large" onClick={onDone}>
              Next →
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
