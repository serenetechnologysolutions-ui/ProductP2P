import React, { useState } from 'react';
import { Layout, Typography, Avatar, Dropdown, Space, Badge, Breadcrumb, Tooltip } from 'antd';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  UserOutlined, LogoutOutlined, DownOutlined, BellOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined,
} from '@ant-design/icons';
import Sidebar from './Sidebar';
import ErrorBoundary from '../ErrorBoundary';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// Route → breadcrumb label mapping
const ROUTE_LABELS = {
  '/': 'Dashboard',
  '/vendors': 'Vendors',
  '/item-master': 'Item Master',
  '/sub-masters': 'Sub Masters',
  '/procurement-sub-masters': 'Sub Masters',
  '/purchase-requisitions': 'Purchase Requisitions',
  '/rfq': 'RFQ & Negotiation',
  '/contracts': 'Contracts',
  '/purchase-orders': 'Purchase Orders',
  '/asns': 'ASNs',
  '/grn': 'Goods Receipt',
  '/batch-inventory': 'Batch Inventory',
  '/purchase-returns': 'Purchase Returns',
  '/branch-orders': 'Branch Orders',
  '/inventory': 'Inventory',
  '/audit': 'Audit Management',
  '/tickets': 'Supplier Issues',
  '/risk': 'Supplier Risk',
  '/esg': 'ESG Tracking',
  '/pricing': 'Price Insights',
  '/exceptions': 'Exceptions',
  '/control-tower': 'Control Tower',
  '/traceability': 'Traceability',
  '/traceability-graph': 'Traceability Graph',
  '/rfq-comparison': 'RFQ Comparison',
  '/workflow-engine': 'Workflow Engine',
  '/documents': 'Document Center',
  '/system-settings': 'System Settings',
  '/user-management': 'User Management',
  '/procurement-os': 'Procurement OS',
  '/reports': 'Reports',
  '/change-password': 'Change Password',
  '/item-import': 'Item Import',
  '/extraction-config': 'Extraction Config',
  '/vendor-onboarding': 'My Profile',
  '/vendor-asns': 'My ASNs',
};

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
    { key: 'settings', icon: <SettingOutlined />, label: 'Change Password', onClick: () => navigate('/change-password') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true, onClick: handleLogout },
  ];

  const notificationItems = [
    { key: '1', label: <Text style={{ fontSize: 12 }}>PR-000003 approved and ready for sourcing</Text> },
    { key: '2', label: <Text style={{ fontSize: 12 }}>ASN-MQYWN153 validated — create GRN</Text> },
    { key: '3', label: <Text style={{ fontSize: 12 }}>Budget alert: Operations at 78% utilization</Text> },
  ];

  // Breadcrumb generation
  const pathLabel = ROUTE_LABELS[location.pathname] || '';
  const breadcrumbItems = [
    { title: <Link to="/">Home</Link> },
    ...(location.pathname !== '/' && pathLabel ? [{ title: pathLabel }] : []),
  ];

  const ROLE_COLORS = {
    system_admin: { bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' },
    mdm_admin: { bg: '#e6f7ff', color: '#096dd9', border: '#91d5ff' },
    procurement_admin: { bg: '#f9f0ff', color: '#531dab', border: '#d3adf7' },
    vendor: { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
  };
  const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.vendor;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ─── SIDEBAR ─── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={230}
        trigger={null}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 16, letterSpacing: 1 }}>
            {collapsed ? 'PT' : '⚡ ProcureTrack'}
          </Text>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Sidebar />
        </div>
        {/* Collapse Menu toggle at bottom of sidebar */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span>Collapse Menu</span>}
        </div>
      </Sider>

      <Layout>
        {/* ─── HEADER ─── */}
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* Left: collapse toggle + breadcrumb */}
          <Space size={16}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
                onClick: () => setCollapsed(!collapsed),
                style: { fontSize: 18, cursor: 'pointer', color: '#595959' },
              })}
            </Tooltip>
            <Breadcrumb items={breadcrumbItems} />
          </Space>

          {/* Right: notifications + user profile */}
          <Space size={20}>
            <Dropdown menu={{ items: notificationItems }} trigger={['click']} placement="bottomRight">
              <Badge count={3} size="small">
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#595959' }} />
              </Badge>
            </Dropdown>

            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                <Text strong style={{ fontSize: 13 }}>{user.full_name || user.email || 'User'}</Text>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: roleStyle.bg,
                  color: roleStyle.color,
                  border: `1px solid ${roleStyle.border}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                }}>
                  {(user.role || '').toUpperCase().replace(/_/g, ' ')}
                </span>
                <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* ─── CONTENT ─── */}
        <Content style={{
          margin: 0,
          padding: 0,
          minHeight: 280,
          background: '#f5f5f5',
          overflowY: 'auto',
          height: 'calc(100vh - 56px)',
        }}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
