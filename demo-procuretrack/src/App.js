import { useState } from 'react';
import { Layout, Typography, Avatar, Space } from 'antd';
import { UserOutlined, RocketOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import GuidePanel from './components/GuidePanel';
import LeadCapture from './steps/LeadCapture';
import WorkflowChoice from './steps/WorkflowChoice';
import FinalScreen from './steps/FinalScreen';
import VendorCreatePage from './pages/VendorCreatePage';
import VendorOnboardPage from './pages/VendorOnboardPage';
import VendorApprovePage from './pages/VendorApprovePage';
import POCreatePage from './pages/POCreatePage';
import ASNCreatePage from './pages/ASNCreatePage';
import ASNValidatePage from './pages/ASNValidatePage';
import ASNPostPage from './pages/ASNPostPage';
import AuditChecklistPage from './pages/AuditChecklistPage';
import AuditSchedulePage from './pages/AuditSchedulePage';
import AuditExecutePage from './pages/AuditExecutePage';
import AuditCompletePage from './pages/AuditCompletePage';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Button, Card } = require('antd');

export default function App() {
  const [phase, setPhase] = useState('landing');
  const [workflow, setWorkflow] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [guideStep, setGuideStep] = useState(0);
  const [demoData, setDemoData] = useState({});

  const updateData = (key, value) => setDemoData(prev => ({ ...prev, [key]: value }));

  const handleLeadSubmit = () => setPhase('workflow');
  const handleWorkflowSelect = (type) => {
    setWorkflow(type);
    setPhase('app');
    setGuideStep(0);
    if (type === 'vendor') setCurrentPage('vendor-create');
    else if (type === 'asn') setCurrentPage('po-create');
    else setCurrentPage('audit-checklist');
  };
  const handleComplete = () => setPhase('final');

  // Landing
  if (phase === 'landing') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <Card style={{ maxWidth: 520, textAlign: 'center', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <RocketOutlined style={{ fontSize: 56, color: '#1890ff', marginBottom: 16 }} />
          <Title level={2} style={{ marginBottom: 8 }}>ProcureTrack — Guided Demo</Title>
          <Paragraph style={{ fontSize: 15, color: '#595959' }}>
            Experience the Procure-to-Pay platform in action. Explore vendor creation, ASN management, or audit workflows.
          </Paragraph>
          <div style={{ margin: '20px 0', padding: '8px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f', display: 'inline-block' }}>
            <Text style={{ color: '#52c41a', fontWeight: 600 }}><CheckCircleOutlined style={{ marginRight: 6 }} />Interactive guided simulation — no login required</Text>
          </div>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" size="large" onClick={() => setPhase('lead')} style={{ height: 50, fontSize: 16, paddingInline: 48 }}>
              Start Guided Demo
            </Button>
          </div>
          <div style={{ marginTop: 20 }}><Text type="secondary">Powered by Serene Technology</Text></div>
        </Card>
      </div>
    );
  }

  if (phase === 'lead') return <LeadCapture onSubmit={handleLeadSubmit} />;
  if (phase === 'workflow') return <WorkflowChoice onSelect={handleWorkflowSelect} />;
  if (phase === 'final') return <FinalScreen workflow={workflow} onRestart={() => { setPhase('landing'); setDemoData({}); }} onTryOtherFlow={(type) => { setDemoData({}); handleWorkflowSelect(type); }} />;

  // Steps per workflow
  const vendorSteps = [
    { page: 'vendor-create', title: 'Step 1: Create Vendor', desc: 'Admin creates a new vendor with basic details. System sends onboarding email.' },
    { page: 'vendor-onboard', title: 'Step 2: Vendor Onboarding', desc: 'Vendor completes business info, addresses, bank details, and documents.' },
    { page: 'vendor-approve', title: 'Step 3: Approve Vendor', desc: 'Admin reviews and approves the vendor submission.' },
  ];
  const asnSteps = [
    { page: 'po-create', title: 'Step 1: Create Purchase Order', desc: 'Admin creates a PO with line items for the vendor.' },
    { page: 'asn-create', title: 'Step 2: Create ASN', desc: 'Vendor creates an Advance Shipment Notice against the PO.' },
    { page: 'asn-validate', title: 'Step 3: Validate ASN', desc: 'Procurement admin validates the submitted ASN.' },
    { page: 'asn-post', title: 'Step 4: Post to ERP', desc: 'Admin posts the validated ASN to the ERP system.' },
  ];
  const auditSteps = [
    { page: 'audit-checklist', title: 'Step 1: Create Checklist', desc: 'Define audit checklist items for vendor compliance.' },
    { page: 'audit-schedule', title: 'Step 2: Schedule Audit', desc: 'Schedule recurring audits with frequency and date range.' },
    { page: 'audit-execute', title: 'Step 3: Execute Audit', desc: 'Auditor evaluates each checklist item during the audit.' },
    { page: 'audit-complete', title: 'Step 4: Complete Audit', desc: 'Close findings and complete the audit cycle.' },
  ];

  const steps = workflow === 'vendor' ? vendorSteps : workflow === 'asn' ? asnSteps : auditSteps;
  const currentGuide = steps[guideStep] || null;

  const advanceGuide = () => {
    const next = guideStep + 1;
    if (next >= steps.length) { handleComplete(); return; }
    setGuideStep(next);
    setCurrentPage(steps[next].page);
  };

  const renderPage = () => {
    const props = { demoData, updateData, onDone: advanceGuide };
    switch (currentPage) {
      case 'vendor-create': return <VendorCreatePage {...props} />;
      case 'vendor-onboard': return <VendorOnboardPage {...props} />;
      case 'vendor-approve': return <VendorApprovePage {...props} />;
      case 'po-create': return <POCreatePage {...props} />;
      case 'asn-create': return <ASNCreatePage {...props} />;
      case 'asn-validate': return <ASNValidatePage {...props} />;
      case 'asn-post': return <ASNPostPage {...props} />;
      case 'audit-checklist': return <AuditChecklistPage {...props} />;
      case 'audit-schedule': return <AuditSchedulePage {...props} />;
      case 'audit-execute': return <AuditExecutePage {...props} />;
      case 'audit-complete': return <AuditCompletePage {...props} />;
      default: return <div style={{ padding: 40, textAlign: 'center' }}><Title level={4}>Select a step to continue</Title></div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: 14 }}>ProcureTrack</Typography.Text>
        </div>
        <Sidebar currentPage={currentPage} workflow={workflow} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>ProcureTrack — Guided Demo</Typography.Title>
          <Space><Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} /><span>Demo User</span></Space>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          {renderPage()}
        </Content>
      </Layout>
      {currentGuide && <GuidePanel step={guideStep + 1} total={steps.length} title={currentGuide.title} description={currentGuide.desc} />}
    </Layout>
  );
}
