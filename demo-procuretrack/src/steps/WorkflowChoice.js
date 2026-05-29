import { Card, Typography, Row, Col } from 'antd';
import { ShopOutlined, FileProtectOutlined, AuditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function WorkflowChoice({ onSelect }) {
  const options = [
    { key: 'vendor', icon: <ShopOutlined style={{ fontSize: 48, color: '#1890ff' }} />, title: 'Vendor Creation', desc: 'Create a vendor, complete onboarding, and approve' },
    { key: 'asn', icon: <FileProtectOutlined style={{ fontSize: 48, color: '#52c41a' }} />, title: 'Create ASN', desc: 'Create PO, submit ASN, validate, and post to ERP' },
    { key: 'audit', icon: <AuditOutlined style={{ fontSize: 48, color: '#722ed1' }} />, title: 'Audit Management', desc: 'Create checklist, schedule audit, execute, and close' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 900, width: '100%', padding: '0 16px' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>Which process would you like to explore?</Title>
        <Row gutter={24}>
          {options.map(opt => (
            <Col span={8} key={opt.key}>
              <Card hoverable onClick={() => onSelect(opt.key)} style={{ textAlign: 'center', borderRadius: 12, minHeight: 220, cursor: 'pointer' }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                {opt.icon}
                <Title level={4} style={{ marginTop: 16 }}>{opt.title}</Title>
                <Text type="secondary">{opt.desc}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
