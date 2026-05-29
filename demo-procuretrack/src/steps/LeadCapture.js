import { Card, Form, Input, Button, Typography } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, BankOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function LeadCapture({ onSubmit }) {
  const [form] = Form.useForm();

  const handleFinish = (values) => {
    const subject = encodeURIComponent('ProcureTrack Demo Registration');
    const body = encodeURIComponent(`Demo registration:\n\nName: ${values.full_name}\nEmail: ${values.email}\nPhone: ${values.phone}\nCompany: ${values.company}`);
    window.open(`mailto:info@serenetechnology.in?subject=${subject}&body=${body}`, '_blank');
    onSubmit(values);
  };

  const handleUseDefault = () => {
    form.setFieldsValue({ full_name: 'Demo User', email: 'demo@company.com', phone: '+91 9876543210', company: 'Demo Corp' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 480, borderRadius: 12 }}>
        <Title level={3} style={{ textAlign: 'center' }}>Register for ProcureTrack Demo</Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>Experience the Procure-to-Pay platform in action</Text>
        <Form form={form} layout="vertical" onFinish={handleFinish} size="large">
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="Your full name" />
          </Form.Item>
          <Form.Item name="email" label="Email ID" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} placeholder="you@company.com" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true }]}>
            <Input prefix={<PhoneOutlined />} placeholder="+91 XXXXXXXXXX" />
          </Form.Item>
          <Form.Item name="company" label="Company Name" rules={[{ required: true }]}>
            <Input prefix={<BankOutlined />} placeholder="Your company name" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">Start Demo</Button>
          <Button type="link" block onClick={handleUseDefault} style={{ marginTop: 8 }}>Use Default & Proceed</Button>
        </Form>
      </Card>
    </div>
  );
}
