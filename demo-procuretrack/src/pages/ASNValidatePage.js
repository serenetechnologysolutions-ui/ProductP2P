import React from 'react';
import { Card, Button, Tag, Typography, Descriptions, Divider, Space, message } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const defaultASN = {
  poNumber: 'PO-2024-001',
  invoiceNumber: 'INV-2024-001',
  eta: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: 150000,
  lrNumber: 'LR-78901',
  transporter: 'Blue Dart',
  driverName: 'Ramesh',
  vehicleNumber: 'MH-12-AB-1234',
};

export default function ASNValidatePage({ demoData, updateData, onDone }) {
  const asn = demoData?.asn || defaultASN;

  const handleValidate = () => {
    message.success('ASN validated successfully! Ready for ERP posting.');
    updateData('asnStatus', 'VALIDATED');
    onDone();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><SafetyCertificateOutlined /> Validate ASN</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Admin reviews and validates the ASN submitted by the vendor.
      </Text>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>ASN - {asn.invoiceNumber}</Title>
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>INITIATED</Tag>
        </div>

        <Divider />

        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="PO Number">{asn.poNumber}</Descriptions.Item>
          <Descriptions.Item label="Invoice Number">{asn.invoiceNumber}</Descriptions.Item>
          <Descriptions.Item label="ETA">{asn.eta}</Descriptions.Item>
          <Descriptions.Item label="Amount">₹{Number(asn.amount).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="LR Number">{asn.lrNumber}</Descriptions.Item>
          <Descriptions.Item label="Transporter">{asn.transporter}</Descriptions.Item>
          <Descriptions.Item label="Driver">{asn.driverName}</Descriptions.Item>
          <Descriptions.Item label="Vehicle">{asn.vehicleNumber}</Descriptions.Item>
        </Descriptions>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            <Button type="primary" size="large" onClick={handleValidate}>
              Validate ASN
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
