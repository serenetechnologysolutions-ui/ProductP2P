import React, { useState } from 'react';
import { Layout, Typography, Avatar, Dropdown, Space } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import Sidebar from './Sidebar';
import ErrorBoundary from '../ErrorBoundary';

const { Sider, Header, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; }
    catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('vendor_token');
    localStorage.removeItem('vendor_user');
    navigate('/login');
  };

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true, onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={220}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: collapsed ? 12 : 14 }}>
            {collapsed ? 'PT' : 'ProcureTrack'}
          </Typography.Text>
        </div>
        <Sidebar />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>ProcureTrack</Typography.Title>
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              <span style={{ fontWeight: 500 }}>{user.full_name || user.email || 'User'}</span>
              <span style={{ fontSize: 11, background: '#e6f7ff', color: '#096dd9', border: '1px solid #91d5ff', borderRadius: 4, padding: '1px 6px' }}>
                {user.role?.toUpperCase().replace('_', ' ')}
              </span>
              <DownOutlined style={{ fontSize: 11 }} />
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <ErrorBoundary key={location.pathname}><Outlet /></ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
