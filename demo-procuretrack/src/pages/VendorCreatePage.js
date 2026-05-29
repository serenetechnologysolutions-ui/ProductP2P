import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Typography, Space, message } from 'antd';
import { ShopOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultData = {
  name: 'Tata Steel Ltd',
  email: 'vendor@tatasteel.com',
  phone: '+91 9876543210',
  company: 'Tata Group',
  department: 'Procurement',
  supplierGroup: 'Tier 1 - Strategic',
  category: 'Raw Materials',
  location: 'Mumbai, Maharashtra',
};

export default function VendorCreatePage({ demoData, updateData, onDone }) {
  const [form] = Form.useForm();
  const [filled, setFilled] = useState(false);

  const handleUseDefault = () => {
    form.setFieldsValue(defaultData);
    setFilled(true);
    setTimeout(() => {
      message.success('Vendor created! Onboarding email sent.');
      updateData('vendor', defaultData);
      onDone();
    }, 600);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><ShopOutlined /> Create Vendor</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Admin creates a new vendor in the system. An onboarding invitation email will be sent automatically.
      </Text>

      <Card>
        <Form form={form} layout="vertical" initialValues={{}}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Vendor Name" name="name">
                <Input placeholder="Enter vendor name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Email" name="email">
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Company" name="company">
                <Select placeholder="Select company">
                  <Option value="Tata Group">Tata Group</Option>
                  <Option value="Reliance Industries">Reliance Industries</Option>
                  <Option value="Adani Group">Adani Group</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Department" name="department">
                <Select placeholder="Select department">
                  <Option value="Procurement">Procurement</Option>
                  <Option value="Finance">Finance</Option>
                  <Option value="Operations">Operations</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Supplier Group" name="supplierGroup">
                <Input placeholder="Enter supplier group" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Category" name="category">
                <Input placeholder="Enter category" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Location" name="location">
                <Input placeholder="Enter location" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

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
