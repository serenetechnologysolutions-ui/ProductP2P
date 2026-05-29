import React from 'react';
import { Card, Button, Tag, Typography, Descriptions, Space, Divider, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const defaultVendor = {
  name: 'Tata Steel Ltd',
  email: 'vendor@tatasteel.com',
  phone: '+91 9876543210',
  company: 'Tata Group',
  department: 'Procurement',
  supplierGroup: 'Tier 1 - Strategic',
  category: 'Raw Materials',
  location: 'Mumbai, Maharashtra',
};

export default function VendorApprovePage({ demoData, updateData, onDone }) {
  const vendor = demoData?.vendor || defaultVendor;

  const handleApprove = () => {
    message.success('Vendor approved successfully! Vendor is now active.');
    updateData('vendorStatus', 'APPROVED');
    onDone();
  };

  const handleReject = () => {
    message.error('Vendor rejected.');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><UserOutlined /> Approve Vendor</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Review the vendor details and approve or reject the onboarding submission.
      </Text>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>{vendor.name}</Title>
          <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>SUBMITTED</Tag>
        </div>

        <Divider />

        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Email">{vendor.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{vendor.phone}</Descriptions.Item>
          <Descriptions.Item label="Company">{vendor.company}</Descriptions.Item>
          <Descriptions.Item label="Department">{vendor.department}</Descriptions.Item>
          <Descriptions.Item label="Supplier Group">{vendor.supplierGroup}</Descriptions.Item>
          <Descriptions.Item label="Category">{vendor.category}</Descriptions.Item>
          <Descriptions.Item label="Location" span={2}>{vendor.location}</Descriptions.Item>
        </Descriptions>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={handleApprove}
            >
              Approve
            </Button>
            <Button
              danger
              size="large"
              icon={<CloseCircleOutlined />}
              onClick={handleReject}
            >
              Reject
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
