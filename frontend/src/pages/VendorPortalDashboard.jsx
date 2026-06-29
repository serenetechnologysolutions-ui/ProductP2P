import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Alert, List, Tag, Empty, Skeleton } from 'antd';
import {
  ReconciliationOutlined, SolutionOutlined, FileProtectOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import notify from '../utils/notify';

const TYPE_META = {
  rfq: { label: 'RFQ', icon: <ReconciliationOutlined />, color: 'purple' },
  purchase_order: { label: 'Purchase Order', icon: <SolutionOutlined />, color: 'cyan' },
  asn: { label: 'ASN', icon: <FileProtectOutlined />, color: 'orange' },
};

// Vendor Portal 2.0 — self-service dashboard. New page, new route, new
// backend module (vendor-portal.routes.js) — entirely additive, does not
// touch the existing vendor onboarding/ASN/RFQ submission flows.
export default function VendorPortalDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/vendor-portal/dashboard')
      .then(res => setData(res.data?.data || null))
      .catch(() => notify.error('Could not load your dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'My Portal' }, { title: 'Dashboard' }]}
        title="Vendor Dashboard"
        subtitle="A snapshot of your active sourcing events, orders, shipments, and compliance status."
      />

      {loading && <Skeleton active paragraph={{ rows: 6 }} />}

      {!loading && !data && <Empty description="Dashboard data is not available right now" />}

      {!loading && data && (
        <>
          {data.alerts?.compliance_blocked && (
            <Alert
              style={{ marginBottom: 16 }} type="error" showIcon
              message="Your account is currently blocked from new sourcing"
              description="One or more compliance documents have expired. Please update them from your profile."
            />
          )}
          {!data.alerts?.compliance_blocked && data.alerts?.compliance_documents_at_risk?.length > 0 && (
            <Alert
              style={{ marginBottom: 16 }} type="warning" showIcon
              message="One or more compliance documents are expiring soon"
            />
          )}
          {data.alerts?.open_exception_count > 0 && (
            <Alert
              style={{ marginBottom: 16 }} type="warning" showIcon
              message={`${data.alerts.open_exception_count} open exception(s) on your account`}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="Active RFQs" value={data.active_rfqs} prefix={<ReconciliationOutlined />} /></Card></Col>
            <Col span={6}><Card><Statistic title="Open POs" value={data.open_pos} prefix={<SolutionOutlined />} /></Card></Col>
            <Col span={6}><Card><Statistic title="Pending ASNs" value={data.pending_asns} prefix={<FileProtectOutlined />} /></Card></Col>
            <Col span={6}><Card><Statistic title="Invoiced (Total)" value={data.payment_status?.total_invoiced ?? 0} precision={2} prefix={<DollarOutlined />} /></Card></Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Card title="Payment Status" size="small">
                <Statistic title="Matched" value={data.payment_status?.matched_amount ?? 0} precision={2} valueStyle={{ color: '#3f8600' }} />
                <Statistic title="Pending" value={data.payment_status?.pending_amount ?? 0} precision={2} style={{ marginTop: 12 }} />
                <Statistic title="Blocked" value={data.payment_status?.blocked_amount ?? 0} precision={2} style={{ marginTop: 12 }} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={16}>
              <Card title="Recent Activity" size="small">
                {(!data.recent_activity || data.recent_activity.length === 0)
                  ? <Empty description="No recent activity" />
                  : (
                    <List
                      size="small"
                      dataSource={data.recent_activity}
                      renderItem={item => (
                        <List.Item>
                          <Tag color={TYPE_META[item.type]?.color}>{TYPE_META[item.type]?.icon} {TYPE_META[item.type]?.label}</Tag>
                          <span style={{ flex: 1, marginLeft: 8 }}>{item.number}</span>
                          <Tag>{(item.status || '').replace(/_/g, ' ').toUpperCase()}</Tag>
                          <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>{item.at ? dayjs(item.at).format('DD MMM YYYY') : '—'}</span>
                        </List.Item>
                      )}
                    />
                  )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
