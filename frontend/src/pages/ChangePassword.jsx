import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title } = Typography;

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    if (values.newPassword !== values.confirmPassword) { message.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { newPassword: values.newPassword });
      message.success('Password changed successfully');
      form.resetFields();
      // Update local storage
      const user = JSON.parse(localStorage.getItem('vendor_user') || '{}');
      user.mustResetPassword = false;
      localStorage.setItem('vendor_user', JSON.stringify(user));
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <Title level={4}>Change Password</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="New password" size="large" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">Update Password</Button>
        </Form>
      </Card>
    </div>
  );
}
