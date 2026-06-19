import { useMemo } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, ShopOutlined, FileProtectOutlined, DatabaseOutlined,
  SettingOutlined, UserOutlined, SolutionOutlined, AuditOutlined,
  AlertOutlined, SafetyOutlined, GlobalOutlined, DollarOutlined,
  ReconciliationOutlined, ApartmentOutlined, FolderOpenOutlined,
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

  const governanceMenuGroup = {
    key: 'governance',
    icon: <ApartmentOutlined />,
    label: 'Governance',
    children: [
      { key: '/workflow-engine', icon: <ApartmentOutlined />, label: 'Workflow Engine' },
      { key: '/documents', icon: <FolderOpenOutlined />, label: 'Document Center' },
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
    { key: 'procurement-mgmt', icon: <FileProtectOutlined />, label: 'Procurement', children: [
      { key: '/rfq', icon: <ReconciliationOutlined />, label: 'RFQ & Negotiation' },
      { key: '/item-master', icon: <DatabaseOutlined />, label: 'Item Master' },
      { key: '/asns', icon: <FileProtectOutlined />, label: 'ASNs' },
      { key: '/purchase-orders', icon: <SolutionOutlined />, label: 'Purchase Orders' },
      { key: '/extraction-config', icon: <SettingOutlined />, label: 'Extraction Config' },
    ]},
    advancedMenuGroup,
    governanceMenuGroup,
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', children: [
      { key: '/user-management', icon: <UserOutlined />, label: 'User Management' },
      { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
    ]},
  ];

  const procurementItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'procurement-mgmt', icon: <FileProtectOutlined />, label: 'Procurement', children: [
      { key: '/rfq', icon: <ReconciliationOutlined />, label: 'RFQ & Negotiation' },
      { key: '/item-master', icon: <DatabaseOutlined />, label: 'Item Master' },
      { key: '/asns', icon: <FileProtectOutlined />, label: 'ASNs' },
      { key: '/purchase-orders', icon: <SolutionOutlined />, label: 'Purchase Orders' },
      { key: '/extraction-config', icon: <SettingOutlined />, label: 'Extraction Config' },
    ]},
    { key: '/vendors', icon: <ShopOutlined />, label: 'Vendors' },
    advancedMenuGroup,
    governanceMenuGroup,
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', children: [
      { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
    ]},
  ];

  const vendorItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/vendor-onboarding', icon: <UserOutlined />, label: 'My Profile' },
    { key: '/vendor-asns', icon: <FileProtectOutlined />, label: 'My ASNs' },
    { key: '/rfq', icon: <ReconciliationOutlined />, label: 'RFQ & Bidding' },
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
    '/rfq': 'procurement-mgmt', '/item-master': 'procurement-mgmt', '/asns': 'procurement-mgmt', '/purchase-orders': 'procurement-mgmt', '/extraction-config': 'procurement-mgmt',
    '/change-password': 'settings', '/user-management': 'settings',
    '/audit': 'advanced', '/tickets': 'advanced', '/risk': 'advanced', '/esg': 'advanced', '/pricing': 'advanced',
    '/workflow-engine': 'governance', '/documents': 'governance',
  };

  const openKeys = useMemo(() => {
    const group = PATH_TO_GROUP[location.pathname];
    return group ? [group] : [];
  }, [location.pathname]);

  return (
    <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} defaultOpenKeys={openKeys} items={items}
      onClick={({ key }) => { if (!['vendor-mgmt', 'procurement-mgmt', 'settings', 'advanced', 'governance'].includes(key)) navigate(key); }}
      style={{ height: '100%', borderRight: 0 }} />
  );
}
