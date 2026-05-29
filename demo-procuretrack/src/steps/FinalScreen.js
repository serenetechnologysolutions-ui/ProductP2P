import { Card, Button, Typography, Space, Divider } from 'antd';
import { CheckCircleFilled, CalendarOutlined, PhoneOutlined, SmileOutlined, ShopOutlined, FileProtectOutlined, AuditOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LABELS = { vendor: 'Vendor Creation', asn: 'ASN Process', audit: 'Audit Management' };

export default function FinalScreen({ workflow, onRestart, onTryOtherFlow }) {
  const others = ['vendor', 'asn', 'audit'].filter(w => w !== workflow);
  const ICONS = { vendor: <ShopOutlined />, asn: <FileProtectOutlined />, audit: <AuditOutlined /> };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #52c41a22 0%, #1890ff11 100%)' }}>
      <Card style={{ maxWidth: 640, textAlign: 'center', borderRadius: 16, padding: 32 }}>
        <CheckCircleFilled style={{ fontSize: 72, color: '#52c41a', marginBottom: 16 }} />
        <Title level={2}><SmileOutlined style={{ color: '#1890ff', marginRight: 8 }} />Demo Complete!</Title>
        <Paragraph style={{ fontSize: 16, color: '#434343' }}>
          You've experienced the <Text strong>{LABELS[workflow]}</Text> flow in ProcureTrack.
        </Paragraph>
        <Paragraph style={{ fontSize: 16, color: '#434343' }}>
          ProcureTrack streamlines your entire Procure-to-Pay lifecycle — from vendor onboarding to ASN validation, audit compliance, and ERP posting.
        </Paragraph>
        <Divider />
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {others.map(w => (
            <Button key={w} size="large" icon={ICONS[w]} block onClick={() => onTryOtherFlow(w)} style={{ borderColor: '#1890ff', color: '#1890ff' }}>
              Try {LABELS[w]} Flow
            </Button>
          ))}
          <Button type="primary" size="large" icon={<CalendarOutlined />} block onClick={() => window.location.href = 'mailto:info@serenetechnology.in?subject=ProcureTrack Demo Request'}>
            Book a Live Demo
          </Button>
          <Button size="large" icon={<PhoneOutlined />} block>Talk to Sales: +91 9842575300</Button>
          <Button type="link" onClick={onRestart}>Restart Demo</Button>
        </Space>
      </Card>
    </div>
  );
}
