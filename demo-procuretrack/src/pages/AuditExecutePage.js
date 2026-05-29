import React, { useState } from 'react';
import { Card, Button, Typography, Radio, Input, Space, Divider, Tag, message } from 'antd';
import { FormOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const checklistItems = [
  { id: 1, text: 'ISO 9001 certification valid' },
  { id: 2, text: 'QC process documented' },
  { id: 3, text: 'Incoming inspection process defined' },
  { id: 4, text: 'Non-conformance tracking system' },
  { id: 5, text: 'Corrective action process in place' },
];

const defaultResponses = [
  { id: 1, answer: 'Yes', remarks: '' },
  { id: 2, answer: 'Yes', remarks: '' },
  { id: 3, answer: 'Yes', remarks: '' },
  { id: 4, answer: 'No', remarks: 'Process not documented' },
  { id: 5, answer: 'Yes', remarks: '' },
];

export default function AuditExecutePage({ demoData, updateData, onDone }) {
  const [responses, setResponses] = useState(
    checklistItems.map((item, idx) => ({
      ...item,
      answer: defaultResponses[idx].answer,
      remarks: defaultResponses[idx].remarks,
    }))
  );

  const handleUseDefault = () => {
    setResponses(checklistItems.map((item, idx) => ({
      ...item,
      answer: defaultResponses[idx].answer,
      remarks: defaultResponses[idx].remarks,
    })));
    setTimeout(() => {
      message.success('Audit responses saved! 4 compliant, 1 non-compliant.');
      updateData('auditResponses', defaultResponses);
      onDone();
    }, 600);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={3}><FormOutlined /> Execute Audit</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Auditor evaluates each checklist item and records findings during the vendor audit.
      </Text>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Tag color="blue">Quality Compliance Audit</Tag>
          <Tag color="purple">Tata Steel Ltd</Tag>
          <Tag>January 2026</Tag>
        </div>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {responses.map((item, idx) => (
            <div
              key={item.id}
              style={{
                padding: '12px 16px',
                background: item.answer === 'No' ? '#fff2f0' : '#f6ffed',
                borderRadius: 8,
                border: `1px solid ${item.answer === 'No' ? '#ffccc7' : '#b7eb8f'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>{idx + 1}. {item.text}</Text>
                <Radio.Group value={item.answer} size="small">
                  <Radio.Button value="Yes">Yes</Radio.Button>
                  <Radio.Button value="No">No</Radio.Button>
                  <Radio.Button value="NA">NA</Radio.Button>
                </Radio.Group>
              </div>
              {item.answer === 'No' && (
                <Input
                  size="small"
                  placeholder="Remarks"
                  value={item.remarks}
                  style={{ marginTop: 4 }}
                  readOnly
                />
              )}
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
