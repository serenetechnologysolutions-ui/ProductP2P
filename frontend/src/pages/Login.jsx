import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Table, Tag } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const { Title, Text } = Typography;

const DEMO_CREDENTIALS = [
  { role: 'System Admin', email: 'sysadmin@procuretrack.com', password: 'SysAdmin@123', color: 'red' },
  { role: 'MDM Admin', email: 'admin@vendorportal.com', password: 'Admin@123', color: 'blue' },
  { role: 'Procurement Admin', email: 'procurement@vendorportal.com', password: 'Proc@123', color: 'purple' },
  { role: 'Vendor', email: 'vendor1@tatasteel.com', password: 'Vendor@123', color: 'green' },
];

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', { email: values.email, password: values.password });
      localStorage.setItem('vendor_token', res.data.token);
      localStorage.setItem('vendor_user', JSON.stringify(res.data.user));
      if (res.data.user.mustResetPassword) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    } catch (err) { setError(err.response?.data?.error || 'Login failed'); }
    setLoading(false);
  };

  const quickLogin = (record) => {
    form.setFieldsValue({ email: record.email, password: record.password });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #001529 0%, #003a70 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <ShopOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <Title level={2} style={{ color: '#fff', margin: '12px 0 4px' }}>ProcureTrack</Title>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>Procure to Pay Platform</Text>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Login Form */}
          <Card style={{ borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: 380 }}>
            <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>Sign In</Title>
            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
            <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="off">
              <Form.Item name="email" rules={[{ required: true, message: 'Enter your email' }]}>
                <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Email" size="large" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]}>
                <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Password" size="large" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" size="large" loading={loading} block>Sign In</Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Credentials Table */}
          <Card style={{ borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: 480 }} title="Demo Credentials (click to auto-fill)">
            <Table size="small" dataSource={DEMO_CREDENTIALS} rowKey="email" pagination={false}
              onRow={(record) => ({ onClick: () => quickLogin(record), style: { cursor: 'pointer' } })}
              columns={[
                { title: 'Role', dataIndex: 'role', width: 140, render: (v, r) => <Tag color={r.color}>{v}</Tag> },
                { title: 'Email', dataIndex: 'email', render: v => <Text copyable style={{ fontSize: 12 }}>{v}</Text> },
                { title: 'Password', dataIndex: 'password', render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
