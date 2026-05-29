import { Menu } from 'antd';
import { DashboardOutlined, ShopOutlined, FileProtectOutlined, AuditOutlined, SolutionOutlined } from '@ant-design/icons';

export default function Sidebar({ currentPage, workflow }) {
  const vendorItems = [
    { key: 'vendor-create', icon: <ShopOutlined />, label: 'Create Vendor' },
    { key: 'vendor-onboard', icon: <ShopOutlined />, label: 'Vendor Onboarding' },
    { key: 'vendor-approve', icon: <ShopOutlined />, label: 'Approve Vendor' },
  ];
  const asnItems = [
    { key: 'po-create', icon: <SolutionOutlined />, label: 'Create PO' },
    { key: 'asn-create', icon: <FileProtectOutlined />, label: 'Create ASN' },
    { key: 'asn-validate', icon: <FileProtectOutlined />, label: 'Validate ASN' },
    { key: 'asn-post', icon: <FileProtectOutlined />, label: 'Post to ERP' },
  ];
  const auditItems = [
    { key: 'audit-checklist', icon: <AuditOutlined />, label: 'Create Checklist' },
    { key: 'audit-schedule', icon: <AuditOutlined />, label: 'Schedule Audit' },
    { key: 'audit-execute', icon: <AuditOutlined />, label: 'Execute Audit' },
    { key: 'audit-complete', icon: <AuditOutlined />, label: 'Complete Audit' },
  ];

  let items = [];
  if (workflow === 'vendor') items = vendorItems;
  else if (workflow === 'asn') items = asnItems;
  else if (workflow === 'audit') items = auditItems;

  return <Menu theme="dark" mode="inline" selectedKeys={[currentPage]} items={items} style={{ height: '100%' }} />;
}
