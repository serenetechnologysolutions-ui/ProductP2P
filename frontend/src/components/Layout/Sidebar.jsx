import React, { useMemo } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, ShopOutlined, FileProtectOutlined, DatabaseOutlined,
  SettingOutlined, UserOutlined, SolutionOutlined, AuditOutlined,
  AlertOutlined, SafetyOutlined, GlobalOutlined, DollarOutlined,
} from '@ant-design/icons';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; }
  })();

  const advancedMenuGroup = {
    key: 'advanced',
    icon: <SafetyOutlined />,
    label: 'Advanced',
    children: [
      { key: '/audit', icon: <AuditOutlined />, label: 'Audit Management' },
      { key: '/tickets', icon: <AlertOutlined />, label: 'Supplier Issues' },
      { key: '/risk', icon: <SafetyOutlined />, label: 'Supplier Risk' },
      { key: '/esg', icon: <GlobalOutlined />, label: 'ESG Tracking' },
      { key: '/pricing', icon: <DollarOutlined />, label: 'Price Insights' },
    ],
  };

  const systemAdminItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/system-settings', icon: <SettingOutlined />, label: 'System Settings' },
    { key: '/user-management', icon: <UserOutlined />, label: 'User Management' },
    { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
  ];

  const adminItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'vendor-mgmt', icon: <ShopOutlined />, label: 'Vendor Management', children: [
      { key: '/vendors', icon: <ShopOutlined />, label: 'Vendors' },
      { key: '/sub-masters', icon: <DatabaseOutlined />, label: 'Sub Masters' },
    ]},
    { key: 'asn-mgmt', icon: <FileProtectOutlined />, label: 'ASN Management', children: [
      { key: '/asns', icon: <FileProtectOutlined />, label: 'ASNs' },
      { key: '/purchase-orders', icon: <SolutionOutlined />, label: 'Purchase Orders' },
      { key: '/extraction-config', icon: <SettingOutlined />, label: 'Extraction Config' },
    ]},
    advancedMenuGroup,
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', children: [
      { key: '/user-management', icon: <UserOutlined />, label: 'User Management' },
      { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
    ]},
  ];

  const procurementItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'asn-mgmt', icon: <FileProtectOutlined />, label: 'ASN Management', children: [
      { key: '/asns', icon: <FileProtectOutlined />, label: 'ASNs' },
      { key: '/purchase-orders', icon: <SolutionOutlined />, label: 'Purchase Orders' },
      { key: '/extraction-config', icon: <SettingOutlined />, label: 'Extraction Config' },
    ]},
    { key: '/vendors', icon: <ShopOutlined />, label: 'Vendors' },
    advancedMenuGroup,
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', children: [
      { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
    ]},
  ];

  const vendorItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/vendor-onboarding', icon: <UserOutlined />, label: 'My Profile' },
    { key: '/vendor-asns', icon: <FileProtectOutlined />, label: 'My ASNs' },
    { key: '/tickets', icon: <AlertOutlined />, label: 'Supplier Issues' },
    { key: '/change-password', icon: <SettingOutlined />, label: 'Change Password' },
  ];

  let items;
  if (user.role === 'vendor') items = vendorItems;
  else if (user.role === 'system_admin') items = systemAdminItems;
  else if (user.role === 'procurement_admin') items = procurementItems;
  else items = adminItems;

  const PATH_TO_GROUP = {
    '/vendors': 'vendor-mgmt', '/sub-masters': 'vendor-mgmt',
    '/asns': 'asn-mgmt', '/purchase-orders': 'asn-mgmt', '/extraction-config': 'asn-mgmt',
    '/change-password': 'settings', '/user-management': 'settings',
    '/audit': 'advanced', '/tickets': 'advanced', '/risk': 'advanced', '/esg': 'advanced', '/pricing': 'advanced',
  };

  const openKeys = useMemo(() => {
    const group = PATH_TO_GROUP[location.pathname];
    return group ? [group] : [];
  }, [location.pathname]);

  return (
    <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} defaultOpenKeys={openKeys} items={items}
      onClick={({ key }) => { if (!['vendor-mgmt', 'asn-mgmt', 'settings', 'advanced'].includes(key)) navigate(key); }}
      style={{ height: '100%', borderRight: 0 }} />
  );
}
