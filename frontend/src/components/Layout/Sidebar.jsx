import { useMemo } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, ShopOutlined, FileProtectOutlined, DatabaseOutlined,
  SettingOutlined, UserOutlined, SolutionOutlined, AuditOutlined,
  AlertOutlined, SafetyOutlined, GlobalOutlined, DollarOutlined,
  ReconciliationOutlined, ApartmentOutlined, FolderOpenOutlined,
  FileTextOutlined, FileDoneOutlined, RadarChartOutlined, NodeIndexOutlined,
  BarChartOutlined, HistoryOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import { useFeatureFlag } from '../../contexts/FeatureFlagsContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const vendorPortalV2Enabled = useFeatureFlag('vendor_portal_v2_enabled');

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
      { key: '/exceptions', icon: <RadarChartOutlined />, label: 'Control Tower' },
      { key: '/traceability', icon: <NodeIndexOutlined />, label: 'Traceability' },
      { key: '/workflow-engine', icon: <ApartmentOutlined />, label: 'Workflow Engine' },
      { key: '/documents', icon: <FolderOpenOutlined />, label: 'Document Center' },
    ],
  };

  // Master-data screens (Vendors, Item Master, Sub Masters) consolidated
  // under one "Masters" group rather than scattered across other groups —
  // each role keeps its own Sub Masters route (mdm_admin's /sub-masters vs
  // procurement_admin's /procurement-sub-masters are genuinely different
  // pages with different field scopes, not the same screen twice).
  const buildMastersGroup = (subMastersPath) => ({
    key: 'masters',
    icon: <DatabaseOutlined />,
    label: 'Masters',
    children: [
      { key: '/vendors', icon: <ShopOutlined />, label: 'Vendors' },
      { key: '/item-master', icon: <DatabaseOutlined />, label: 'Item Master' },
      { key: subMastersPath, icon: <DatabaseOutlined />, label: 'Sub Masters' },
    ],
  });

  const systemAdminItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/reports', icon: <FileExcelOutlined />, label: 'Reports' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: 'Inventory' },
    { key: '/system-settings', icon: <SettingOutlined />, label: 'System Settings' },
    { key: '/procurement-os', icon: <ApartmentOutlined />, label: 'Procurement OS' },
    { key: '/user-management', icon: <UserOutlined />, label: 'User Management' },
    { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
  ];

  // mdm_admin's sidebar is scoped to Dashboard/Reports/Masters only — every
  // other group (Advanced, Governance, Settings) that mdm_admin could
  // previously navigate to via the menu is intentionally omitted here per
  // explicit product direction. This is a menu-visibility change only: the
  // backend's own requireRole() on each endpoint is the real access boundary
  // (per the VAPT note in App.jsx) and was deliberately left untouched, so
  // this can be revisited without any backend follow-up if mdm_admin's
  // access needs to actually narrow too, not just what's link-able.
  const adminItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/reports', icon: <FileExcelOutlined />, label: 'Reports' },
    buildMastersGroup('/sub-masters'),
  ];

  const procurementItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/reports', icon: <FileExcelOutlined />, label: 'Reports' },
    buildMastersGroup('/procurement-sub-masters'),
    { key: 'procurement-mgmt', icon: <FileProtectOutlined />, label: 'Procurement', children: [
      { key: '/purchase-requisitions', icon: <FileTextOutlined />, label: 'Purchase Requisitions' },
      { key: '/rfq', icon: <ReconciliationOutlined />, label: 'RFQ & Negotiation' },
      { key: '/contracts', icon: <FileDoneOutlined />, label: 'Contracts' },
      { key: '/asns', icon: <FileProtectOutlined />, label: 'ASNs' },
      { key: '/grn', icon: <FileProtectOutlined />, label: 'Goods Receipt' },
      { key: '/purchase-orders', icon: <SolutionOutlined />, label: 'Purchase Orders' },
      { key: '/inventory', icon: <DatabaseOutlined />, label: 'Inventory' },
      { key: '/extraction-config', icon: <SettingOutlined />, label: 'Extraction Config' },
    ]},
    advancedMenuGroup,
    governanceMenuGroup,
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', children: [
      { key: '/system-settings', icon: <SettingOutlined />, label: 'System Settings' },
      { key: '/change-password', icon: <UserOutlined />, label: 'Change Password' },
    ]},
  ];

  const vendorPortalMenuGroup = {
    key: 'vendor-portal-v2',
    icon: <BarChartOutlined />,
    label: 'My Portal',
    children: [
      { key: '/vendor/dashboard', icon: <DashboardOutlined />, label: 'Portal Dashboard' },
      { key: '/vendor/performance', icon: <BarChartOutlined />, label: 'My Performance' },
      { key: '/vendor/transactions', icon: <HistoryOutlined />, label: 'My Transactions' },
    ],
  };

  const vendorItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/reports', icon: <FileExcelOutlined />, label: 'Reports' },
    { key: '/vendor-onboarding', icon: <UserOutlined />, label: 'My Profile' },
    { key: '/vendor-asns', icon: <FileProtectOutlined />, label: 'My ASNs' },
    { key: '/rfq', icon: <ReconciliationOutlined />, label: 'RFQ & Bidding' },
    { key: '/tickets', icon: <AlertOutlined />, label: 'Supplier Issues' },
    ...(vendorPortalV2Enabled ? [vendorPortalMenuGroup] : []),
    { key: '/change-password', icon: <SettingOutlined />, label: 'Change Password' },
  ];

  let items;
  if (user.role === 'vendor') items = vendorItems;
  else if (user.role === 'system_admin') items = systemAdminItems;
  else if (user.role === 'procurement_admin') items = procurementItems;
  else items = adminItems;

  const PATH_TO_GROUP = {
    '/vendors': 'masters', '/sub-masters': 'masters', '/item-master': 'masters', '/procurement-sub-masters': 'masters',
    '/purchase-requisitions': 'procurement-mgmt', '/rfq': 'procurement-mgmt', '/contracts': 'procurement-mgmt', '/asns': 'procurement-mgmt', '/grn': 'procurement-mgmt', '/purchase-orders': 'procurement-mgmt', '/extraction-config': 'procurement-mgmt', '/inventory': 'procurement-mgmt',
    '/change-password': 'settings', '/user-management': 'settings',
    '/audit': 'advanced', '/tickets': 'advanced', '/risk': 'advanced', '/esg': 'advanced', '/pricing': 'advanced',
    '/workflow-engine': 'governance', '/documents': 'governance', '/exceptions': 'governance', '/traceability': 'governance',
    '/vendor/dashboard': 'vendor-portal-v2', '/vendor/performance': 'vendor-portal-v2', '/vendor/transactions': 'vendor-portal-v2',
  };

  const openKeys = useMemo(() => {
    const group = PATH_TO_GROUP[location.pathname];
    return group ? [group] : [];
  }, [location.pathname]);

  return (
    <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} defaultOpenKeys={openKeys} items={items}
      onClick={({ key }) => { if (!['masters', 'procurement-mgmt', 'settings', 'advanced', 'governance', 'vendor-portal-v2'].includes(key)) navigate(key); }}
      style={{ height: '100%', borderRight: 0 }} />
  );
}
