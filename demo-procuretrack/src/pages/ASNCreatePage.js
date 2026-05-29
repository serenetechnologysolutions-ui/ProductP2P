import React, { useState } from 'react';
import { Card, Steps, Form, Input, Select, Button, Row, Col, Typography, Divider, Space, message } from 'antd';
import { TruckOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultASN = {
  poNumber: 'PO-2024-001',
  invoiceNumber: 'INV-2024-001',
  eta: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: 150000,
  lrNumber: 'LR-78901',
  transporter: 'Blue Dart',
  driverName: 'Ramesh',
  driverPhone: '+91 9988776655',
  vehicleNumber: 'MH-12-AB-1234',
};

export default function ASNCreatePage({ demoData, updateData, onDone }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();

  const handleUseDefault = () => {
    form.setFieldsValue(defaultASN);
    setCurrentStep(3);
    setTimeout(() => {
      message.success('ASN created successfully! Vendor shipment notification sent.');
      updateData('asn', defaultASN);
      onDone();
    }, 800);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><TruckOutlined /> Create ASN (Advance Shipping Notice)</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Vendor creates an ASN against the Purchase Order with shipment and invoice details.
      </Text>

      <Card>
        <Steps
          current={currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Select PO' },
            { title: 'ASN Details' },
            { title: 'Attachments' },
            { title: 'Invoice View' },
          ]}
        />

        <Divider />

        <Form form={form} layout="vertical" initialValues={defaultASN}>
          <Title level={5}>PO Selection</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Purchase Order" name="poNumber">
                <Select>
                  <Option value="PO-2024-001">PO-2024-001 - Tata Steel Ltd</Option>
                  <Option value="PO-2024-002">PO-2024-002 - JSW Steel</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Invoice Number" name="invoiceNumber">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5}>Shipment Details</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="ETA" name="eta">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Amount (₹)" name="amount">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="LR Number" name="lrNumber">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Transporter" name="transporter">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Driver Name" name="driverName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Vehicle Number" name="vehicleNumber">
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
