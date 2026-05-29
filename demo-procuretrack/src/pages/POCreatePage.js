import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Table, Typography, Row, Col, Divider, Space, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultLineItems = [
  { key: '1', item: 'Steel Plates 10mm', qty: 100, rate: 1500, amount: 150000 },
  { key: '2', item: 'Steel Rods 8mm', qty: 200, rate: 500, amount: 100000 },
];

const defaultPO = {
  poNumber: 'PO-2024-001',
  vendor: 'Tata Steel Ltd',
  date: '2024-01-15',
  deliveryDate: '2024-02-15',
  lineItems: defaultLineItems,
  totalAmount: 250000,
};

export default function POCreatePage({ demoData, updateData, onDone }) {
  const [form] = Form.useForm();
  const [lineItems] = useState(defaultLineItems);

  const columns = [
    { title: 'Item Description', dataIndex: 'item', key: 'item' },
    { title: 'Quantity', dataIndex: 'qty', key: 'qty', align: 'center' },
    { title: 'Rate (₹)', dataIndex: 'rate', key: 'rate', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { title: 'Amount (₹)', dataIndex: 'amount', key: 'amount', align: 'right', render: v => `₹${v.toLocaleString()}` },
  ];

  const handleUseDefault = () => {
    form.setFieldsValue({ poNumber: defaultPO.poNumber, vendor: defaultPO.vendor });
    setTimeout(() => {
      message.success('Purchase Order PO-2024-001 created successfully!');
      updateData('po', defaultPO);
      onDone();
    }, 600);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><FileTextOutlined /> Create Purchase Order</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Admin creates a Purchase Order for the approved vendor with line items and delivery details.
      </Text>

      <Card>
        <Form form={form} layout="vertical" initialValues={{ poNumber: defaultPO.poNumber, vendor: defaultPO.vendor }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="PO Number" name="poNumber">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Vendor" name="vendor">
                <Select>
                  <Option value="Tata Steel Ltd">Tata Steel Ltd</Option>
                  <Option value="JSW Steel">JSW Steel</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Delivery Date" name="deliveryDate">
                <Input placeholder="2024-02-15" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>Line Items</Divider>

        <Table
          dataSource={lineItems}
          columns={columns}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center"><strong>300</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} align="right"><strong>₹2,50,000</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />

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
