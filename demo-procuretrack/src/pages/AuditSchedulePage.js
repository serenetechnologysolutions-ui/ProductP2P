import React from 'react';
import { Card, Form, Input, Select, Button, Typography, Row, Col, Divider, Tag, Space, message } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultSchedule = {
  checklist: 'Quality Compliance Audit',
  vendor: 'Tata Steel Ltd',
  frequency: 'Monthly',
  fromDate: 'January 2026',
  toDate: 'May 2026',
  auditsCount: 5,
};

export default function AuditSchedulePage({ demoData, updateData, onDone }) {
  const [form] = Form.useForm();

  const handleUseDefault = () => {
    form.setFieldsValue(defaultSchedule);
    setTimeout(() => {
      message.success('Audit schedule created! 5 audits will be generated.');
      updateData('auditSchedule', defaultSchedule);
      onDone();
    }, 600);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><CalendarOutlined /> Schedule Audit</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Schedule recurring audits for a vendor using the defined checklist.
      </Text>

      <Card>
        <Form form={form} layout="vertical" initialValues={defaultSchedule}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Checklist" name="checklist">
                <Select>
                  <Option value="Quality Compliance Audit">Quality Compliance Audit</Option>
                  <Option value="Safety Audit">Safety Audit</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Vendor" name="vendor">
                <Select>
                  <Option value="Tata Steel Ltd">Tata Steel Ltd</Option>
                  <Option value="JSW Steel">JSW Steel</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Frequency" name="frequency">
                <Select>
                  <Option value="Weekly">Weekly</Option>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Quarterly">Quarterly</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="From Date" name="fromDate">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="To Date" name="toDate">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center', padding: '16px', background: '#f6ffed', borderRadius: 8, marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            <Tag color="green" style={{ fontSize: 14, marginRight: 8 }}>5</Tag>
            audits will be created (Monthly from Jan 2026 to May 2026)
          </Text>
        </div>

        <div style={{ textAlign: 'center' }}>
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
