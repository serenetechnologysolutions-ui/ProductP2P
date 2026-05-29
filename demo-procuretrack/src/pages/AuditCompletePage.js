import React, { useState } from 'react';
import { Card, Button, Typography, Tag, Divider, Descriptions, Space, Table, message } from 'antd';
import { CheckSquareOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function AuditCompletePage({ demoData, updateData, onDone }) {
  const [findingClosed, setFindingClosed] = useState(false);

  const findings = [
    {
      key: '1',
      item: 'Non-conformance tracking system',
      finding: 'Process not documented',
      severity: 'High',
      status: findingClosed ? 'Closed' : 'Open',
    },
  ];

  const columns = [
    { title: 'Checklist Item', dataIndex: 'item', key: 'item' },
    { title: 'Finding', dataIndex: 'finding', key: 'finding' },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (v) => <Tag color="red">{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <Tag color={v === 'Open' ? 'orange' : 'green'}>{v}</Tag>,
    },
  ];

  const handleCloseFinding = () => {
    setFindingClosed(true);
    message.info('Finding marked as closed.');
  };

  const handleComplete = () => {
    message.success('Audit completed successfully! All findings resolved.');
    updateData('auditStatus', 'COMPLETED');
    onDone();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><CheckSquareOutlined /> Complete Audit</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Review audit findings, close open items, and complete the audit cycle.
      </Text>

      <Card>
        <Title level={5}>Audit Summary</Title>
        <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Total Items">5</Descriptions.Item>
          <Descriptions.Item label="Compliant (Yes)">
            <Tag color="green">4</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Non-Compliant (No)">
            <Tag color="red">1</Tag>
          </Descriptions.Item>
        </Descriptions>

        <Divider>Findings</Divider>

        <Table
          dataSource={findings}
          columns={columns}
          pagination={false}
          size="small"
        />

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            {!findingClosed && (
              <Button
                icon={<CloseCircleOutlined />}
                onClick={handleCloseFinding}
              >
                Close Finding
              </Button>
            )}
            <Button
              type="primary"
              size="large"
              icon={<CheckSquareOutlined />}
              onClick={handleComplete}
              disabled={!findingClosed}
            >
              Complete Audit
            </Button>
            <Button size="large" onClick={onDone}>
              Next →
            </Button>
          </Space>
          {!findingClosed && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Close the finding first to complete the audit</Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
