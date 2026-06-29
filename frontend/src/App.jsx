import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FieldConfigProvider } from './contexts/FieldConfigContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import ASNs from './pages/ASNs';
import SubMasters from './pages/SubMasters';
import ProcurementSubMasters from './pages/ProcurementSubMasters';
import VendorOnboarding from './pages/VendorOnboarding';
import ChangePassword from './pages/ChangePassword';
import PurchaseOrders from './pages/PurchaseOrders';
import ExtractionConfig from './pages/ExtractionConfig';
import UserManagement from './pages/UserManagement';
import SystemSettings from './pages/SystemSettings';
import AuditManagement from './pages/AuditManagement';
import Tickets from './pages/Tickets';
import RiskDashboard from './pages/RiskDashboard';
import ESGTracking from './pages/ESGTracking';
import PriceBenchmarking from './pages/PriceBenchmarking';
import RFQ from './pages/RFQ';
import ItemMaster from './pages/ItemMaster';
import Inventory from './pages/Inventory';
import GRN from './pages/GRN';
import ItemImport from './pages/ItemImport';
import WorkflowEngine from './pages/WorkflowEngine';
import DocumentCenter from './pages/DocumentCenter';
import PR from './pages/PR';
import Contracts from './pages/Contracts';
import ExceptionsDashboard from './pages/ExceptionsDashboard';
import TraceabilityView from './pages/TraceabilityView';
import VendorPortalDashboard from './pages/VendorPortalDashboard';
import VendorPortalPerformance from './pages/VendorPortalPerformance';
import VendorPortalTransactions from './pages/VendorPortalTransactions';
import Reports from './pages/Reports';
import ProcurementOSAdmin from './pages/ProcurementOSAdmin';

function RequireAuth({ children }) {
  const token = localStorage.getItem('vendor_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// VAPT: defense-in-depth route guard. The real access-control boundary is the
// backend's requireRole() on every endpoint — this just stops a logged-in user
// from one role rendering another role's page (and firing its data requests)
// by typing the URL directly, instead of relying solely on the sidebar hiding links.
function RequireRole({ roles, children }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

const ALL_ROLES = ['system_admin', 'mdm_admin', 'procurement_admin', 'vendor'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><FeatureFlagsProvider><FieldConfigProvider><AppLayout /></FieldConfigProvider></FeatureFlagsProvider></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="vendors" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><Vendors /></RequireRole>} />
          <Route path="asns" element={<RequireRole roles={['mdm_admin', 'procurement_admin', 'vendor']}><ASNs /></RequireRole>} />
          <Route path="vendor-asns" element={<RequireRole roles={['mdm_admin', 'procurement_admin', 'vendor']}><ASNs /></RequireRole>} />
          <Route path="sub-masters" element={<RequireRole roles={['mdm_admin']}><SubMasters /></RequireRole>} />
          <Route path="procurement-sub-masters" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><ProcurementSubMasters /></RequireRole>} />
          <Route path="vendor-onboarding" element={<RequireRole roles={['vendor']}><VendorOnboarding /></RequireRole>} />
          <Route path="change-password" element={<RequireRole roles={ALL_ROLES}><ChangePassword /></RequireRole>} />
          <Route path="purchase-orders" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><PurchaseOrders /></RequireRole>} />
          <Route path="extraction-config" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><ExtractionConfig /></RequireRole>} />
          <Route path="user-management" element={<RequireRole roles={['mdm_admin', 'system_admin']}><UserManagement /></RequireRole>} />
          <Route path="system-settings" element={<RequireRole roles={['system_admin', 'mdm_admin', 'procurement_admin']}><SystemSettings /></RequireRole>} />
          <Route path="audit" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><AuditManagement /></RequireRole>} />
          <Route path="tickets" element={<RequireRole roles={['mdm_admin', 'procurement_admin', 'vendor']}><Tickets /></RequireRole>} />
          <Route path="risk" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><RiskDashboard /></RequireRole>} />
          <Route path="esg" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><ESGTracking /></RequireRole>} />
          <Route path="pricing" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><PriceBenchmarking /></RequireRole>} />
          <Route path="purchase-requisitions" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><PR /></RequireRole>} />
          <Route path="contracts" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><Contracts /></RequireRole>} />
          <Route path="rfq" element={<RequireRole roles={['mdm_admin', 'procurement_admin', 'vendor']}><RFQ /></RequireRole>} />
          <Route path="item-master" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><ItemMaster /></RequireRole>} />
          <Route path="inventory" element={<RequireRole roles={['system_admin', 'procurement_admin']}><Inventory /></RequireRole>} />
          <Route path="grn" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><GRN /></RequireRole>} />
          <Route path="item-import" element={<RequireRole roles={['mdm_admin', 'system_admin']}><ItemImport /></RequireRole>} />
          <Route path="workflow-engine" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><WorkflowEngine /></RequireRole>} />
          <Route path="documents" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><DocumentCenter /></RequireRole>} />
          <Route path="exceptions" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><ExceptionsDashboard /></RequireRole>} />
          <Route path="traceability" element={<RequireRole roles={['mdm_admin', 'procurement_admin']}><TraceabilityView /></RequireRole>} />
          <Route path="vendor/dashboard" element={<RequireRole roles={['vendor']}><VendorPortalDashboard /></RequireRole>} />
          <Route path="vendor/performance" element={<RequireRole roles={['vendor']}><VendorPortalPerformance /></RequireRole>} />
          <Route path="vendor/transactions" element={<RequireRole roles={['vendor']}><VendorPortalTransactions /></RequireRole>} />
          <Route path="reports" element={<RequireRole roles={ALL_ROLES}><Reports /></RequireRole>} />
          <Route path="procurement-os" element={<RequireRole roles={['system_admin', 'mdm_admin']}><ProcurementOSAdmin /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
