import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import ASNs from './pages/ASNs';
import SubMasters from './pages/SubMasters';
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
import WorkflowEngine from './pages/WorkflowEngine';
import DocumentCenter from './pages/DocumentCenter';

function RequireAuth({ children }) {
  const token = localStorage.getItem('vendor_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="asns" element={<ASNs />} />
          <Route path="vendor-asns" element={<ASNs />} />
          <Route path="sub-masters" element={<SubMasters />} />
          <Route path="vendor-onboarding" element={<VendorOnboarding />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="extraction-config" element={<ExtractionConfig />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="system-settings" element={<SystemSettings />} />
          <Route path="audit" element={<AuditManagement />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="risk" element={<RiskDashboard />} />
          <Route path="esg" element={<ESGTracking />} />
          <Route path="pricing" element={<PriceBenchmarking />} />
          <Route path="rfq" element={<RFQ />} />
          <Route path="item-master" element={<ItemMaster />} />
          <Route path="workflow-engine" element={<WorkflowEngine />} />
          <Route path="documents" element={<DocumentCenter />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
