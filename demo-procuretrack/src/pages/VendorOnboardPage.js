import React, { useState } from 'react';
import { Card, Steps, Form, Input, Button, Row, Col, Typography, Divider, Space, message } from 'antd';
import { SolutionOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const onboardingData = {
  gst: '27AAACT2727Q1ZV',
  pan: 'AAACT2727Q',
  tradeName: 'Tata Steel Limited',
  cin: 'L27100MH1907PLC000260',
  registeredAddress: 'Bombay House, 24 Homi Mody Street, Mumbai 400001',
  plantAddress: 'Jamshedpur Works, Jamshedpur, Jharkhand 831001',
  bankName: 'State Bank of India',
  accountNo: '30987654321',
  ifsc: 'SBIN0000001',
  branch: 'Mumbai Main Branch',
  contactName: 'Rajesh Kumar',
  contactEmail: 'rajesh.kumar@tatasteel.com',
  contactPhone: '+91 9876543211',
};

export default function VendorOnboardPage({ demoData, updateData, onDone }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();

  const handleUseDefault = () => {
    setCurrentStep(4);
    form.setFieldsValue(onboardingData);
    setTimeout(() => {
      message.success('Onboarding submitted for approval');
      updateData('onboarding', onboardingData);
      onDone();
    }, 800);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><SolutionOutlined /> Vendor Onboarding</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Vendor completes their onboarding by providing business information, addresses, bank details, documents, and contacts.
      </Text>

      <Card>
        <Steps
          current={currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Business Info' },
            { title: 'Addresses' },
            { title: 'Bank' },
            { title: 'Documents' },
            { title: 'Contacts' },
          ]}
        />

        <Divider />

        <Form form={form} layout="vertical" initialValues={onboardingData}>
          <Title level={5}>Business Information</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="GST Number" name="gst">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="PAN Number" name="pan">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Trade Name" name="tradeName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="CIN" name="cin">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5}>Addresses</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Registered Address" name="registeredAddress">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Plant Address" name="plantAddress">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5}>Bank Details</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Bank Name" name="bankName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Account Number" name="accountNo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="IFSC Code" name="ifsc">
                <Input />
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
