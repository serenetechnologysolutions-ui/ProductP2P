import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import ProcurementDashboard from './ProcurementDashboard';
import SystemAdminDashboard from './SystemAdminDashboard';
import MDMAdminDashboard from './MDMAdminDashboard';
import VendorDashboard from './VendorDashboard';

// ─── Dashboard Router ───
export default function Dashboard() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('vendor_user') || '{}');
      setRole(user.role || null);
    } catch {
      setRole(null);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <Spin spinning size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;
  }

  switch (role) {
    case 'system_admin':
      return <SystemAdminDashboard />;
    case 'mdm_admin':
      return <MDMAdminDashboard />;
    case 'procurement_admin':
      return <ProcurementDashboard />;
    case 'vendor':
      return <VendorDashboard />;
    default:
      return <ProcurementDashboard />;
  }
}
