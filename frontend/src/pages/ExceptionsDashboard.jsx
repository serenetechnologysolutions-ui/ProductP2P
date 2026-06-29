import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Select, Button, Card, Row, Col, Statistic, Space, Typography, message, Input, Alert, Tabs, Progress, Empty } from 'antd';
import { CheckOutlined, ReloadOutlined, LinkOutlined, WarningOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api/axios';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;
const { TextArea } = Input;

const SEVERITY_COLOR = { low: 'blue', medium: 'orange', high: 'red', critical: 'magenta' };
const STATUS_COLOR = { open: 'orange', resolved: 'green' };

const EXCEPTION_TYPE_OPTIONS = [
  { value: 'budget_breach', label: 'Budget Breach' },
  { value: 'price_mismatch', label: 'Price Mismatch' },
  { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
  { value: 'vendor_risk', label: 'Vendor Risk' },
  { value: 'compliance_expiry', label: 'Compliance Expiry' },
  { value: 'grn_tolerance_breach', label: 'GRN Tolerance Breach' },
  { value: 'invoice_mismatch', label: 'Invoice Mismatch' },
  { value: 'sla_breach', label: 'SLA Breach' },
];
const typeLabel = (v) => EXCEPTION_TYPE_OPTIONS.find(o => o.value === v)?.label || v;

const MODULE_OPTIONS = [
  { value: 'purchase_requisition', label: 'Purchase Requisition' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'asn', label: 'ASN' },
  { value: 'vendor', label: 'Vendor' },
];
const moduleLabel = (v) => MODULE_OPTIONS.find(o => o.value === v)?.label || v;

// Where "View Source" navigates. vendor exceptions' record_id is always the
// vendor's own id, so those deep-link straight into Vendors. Everything else
// (purchase_requisition/purchase_order/asn) routes through Traceability
// instead of a flat list deep-link — record_id for grn_tolerance_breach/
// invoice_mismatch exceptions is the GRN's/invoice's OWN id, not the parent
// ASN's, and Traceability resolves any of those ids to the same full chain
// (and shows more context than a bare list page would anyway).

export default function ExceptionsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [filters, setFilters] = useState({ status: 'open', exception_type: undefined, severity: undefined, module_name: undefined });

  const [resolving, setResolving] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  const [budgetHealth, setBudgetHealth] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [topRiskVendors, setTopRiskVendors] = useState(null);
  const [opportunities, setOpportunities] = useState(null);
  const [riskTabLoading, setRiskTabLoading] = useState(false);
  const [riskTabLoaded, setRiskTabLoaded] = useState(false);

  const fetchBudgetHealth = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const res = await api.get('/exceptions/budget-health');
      setBudgetHealth(res.data.data || []);
    } catch { message.error('Failed to load budget health'); }
    setBudgetLoading(false);
  }, []);

  const fetchVendorRiskAndOpportunities = useCallback(async () => {
    setRiskTabLoading(true);
    try {
      const [riskRes, oppRes] = await Promise.all([
        api.get('/exceptions/vendor-risk'),
        api.get('/assistant/cost-saving-opportunities'),
      ]);
      setTopRiskVendors(riskRes.data.data || []);
      setOpportunities(oppRes.data.data || []);
    } catch { message.error('Failed to load vendor risk & opportunities'); }
    setRiskTabLoading(false);
    setRiskTabLoaded(true);
  }, []);

  const onTabChange = (key) => {
    if (key === 'budget' && !budgetHealth) fetchBudgetHealth();
    if (key === 'risk' && !riskTabLoaded) fetchVendorRiskAndOpportunities();
  };

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/exceptions/summary');
      setSummary(res.data.data);
    } catch { message.error('Failed to load exception summary'); }
    setSummaryLoading(false);
  }, []);

  const fetchList = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { ...filters, page, limit: pagination.limit };
      Object.keys(params).forEach(k => { if (params[k] === undefined || params[k] === '') delete params[k]; });
      const res = await api.get('/exceptions', { params });
      setData(res.data.data || []);
      setPagination(prev => ({ ...prev, page, total: res.data.pagination?.total || 0 }));
    } catch { message.error('Failed to load exceptions'); }
    setLoading(false);
  }, [filters, pagination.limit]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchList(1); }, [filters]);

  const openResolve = (record) => { setResolving(record); setResolutionRemarks(''); };

  const handleResolve = async () => {
    if (!resolutionRemarks.trim()) { message.error('Resolution remarks are required'); return; }
    setResolveLoading(true);
    try {
      await api.put(`/exceptions/${resolving.id}/resolve`, { resolution_remarks: resolutionRemarks });
      message.success('Exception resolved');
      setResolving(null);
      fetchList(pagination.page);
      fetchSummary();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to resolve exception'); }
    setResolveLoading(false);
  };

  const viewSource = (record) => {
    if (record.module_name === 'vendor') {
      navigate(`/vendors?id=${record.record_id}`);
      return;
    }
    navigate(`/traceability?id=${record.record_id}`);
  };

  const columns = [
    {
      title: 'Severity', dataIndex: 'severity', width: 100, render: v => <Tag color={SEVERITY_COLOR[v]}>{v?.toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.severity || '').localeCompare(String(b.severity || '')),
      filters: Object.keys(SEVERITY_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.severity === value,
    },
    {
      title: 'Type', dataIndex: 'exception_type', width: 170, render: v => <Tag>{typeLabel(v)}</Tag>,
      sorter: (a, b) => String(a.exception_type || '').localeCompare(String(b.exception_type || '')),
    },
    { title: 'Title', dataIndex: 'title', width: 220, ellipsis: true, sorter: (a, b) => String(a.title || '').localeCompare(String(b.title || '')) },
    { title: 'Message', dataIndex: 'message', ellipsis: true },
    {
      title: 'Source', key: 'source', width: 180,
      sorter: (a, b) => String(a.module_name || '').localeCompare(String(b.module_name || '')),
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{moduleLabel(r.module_name)}</Tag>
          {r.vendor_name && <Text type="secondary" style={{ fontSize: 12 }}>{r.vendor_name}</Text>}
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    { title: 'Raised', dataIndex: 'created_at', width: 150, render: v => v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '—', sorter: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
    {
      title: 'Actions', key: 'actions', width: 170, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<LinkOutlined />} onClick={() => viewSource(r)} title="View source document" />
          {r.status === 'open' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openResolve(r)}>Resolve</Button>}
        </Space>
      ),
    },
  ];

  const bySeverity = summary?.by_severity || {};

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Governance' }, { title: 'Control Tower' }]}
        title="Procurement Control Tower"
        subtitle="Centralized view of every budget, price, quantity, compliance, vendor-risk, and SLA exception raised across the platform."
        extra={<Button icon={<ReloadOutlined />} onClick={() => { fetchSummary(); fetchList(pagination.page); }}>Refresh</Button>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="Open" value={summary?.open_total ?? 0} valueStyle={{ color: summary?.open_total > 0 ? '#d48806' : undefined }} /></Card></Col>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="Critical" value={bySeverity.critical ?? 0} valueStyle={{ color: bySeverity.critical > 0 ? '#cf1322' : undefined }} /></Card></Col>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="High" value={bySeverity.high ?? 0} valueStyle={{ color: bySeverity.high > 0 ? '#ff4d4f' : undefined }} /></Card></Col>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="Medium" value={bySeverity.medium ?? 0} /></Card></Col>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="Low" value={bySeverity.low ?? 0} /></Card></Col>
        <Col span={4}><Card size="small" loading={summaryLoading}><Statistic title="Resolved Today" value={summary?.resolved_today ?? 0} valueStyle={{ color: '#3f8600' }} /></Card></Col>
      </Row>

      {(bySeverity.critical > 0) && (
        <Alert
          style={{ marginBottom: 16 }}
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message={`${bySeverity.critical} critical exception(s) need immediate attention`}
        />
      )}

      <Tabs
        onChange={onTabChange}
        items={[
          {
            key: 'exceptions',
            label: 'Exceptions',
            children: (
              <>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={12} align="middle">
                    <Col span={5}>
                      <Select
                        placeholder="Status" style={{ width: '100%' }} allowClear
                        value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))}
                        options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]}
                      />
                    </Col>
                    <Col span={6}>
                      <Select
                        placeholder="Exception Type" style={{ width: '100%' }} allowClear showSearch optionFilterProp="label"
                        value={filters.exception_type} onChange={v => setFilters(f => ({ ...f, exception_type: v }))}
                        options={EXCEPTION_TYPE_OPTIONS}
                      />
                    </Col>
                    <Col span={5}>
                      <Select
                        placeholder="Severity" style={{ width: '100%' }} allowClear
                        value={filters.severity} onChange={v => setFilters(f => ({ ...f, severity: v }))}
                        options={[{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]}
                      />
                    </Col>
                    <Col span={5}>
                      <Select
                        placeholder="Module" style={{ width: '100%' }} allowClear
                        value={filters.module_name} onChange={v => setFilters(f => ({ ...f, module_name: v }))}
                        options={MODULE_OPTIONS}
                      />
                    </Col>
                    <Col span={3}>
                      <Button block onClick={() => setFilters({ status: 'open', exception_type: undefined, severity: undefined, module_name: undefined })}>Reset</Button>
                    </Col>
                  </Row>
                </Card>

                <InlineExpandPanel
                  open={!!resolving}
                  title={`Resolve Exception — ${resolving?.title || ''}`}
                  description="Remarks are required so the audit trail shows why this exception is being closed."
                  submitText="Resolve"
                  loading={resolveLoading}
                  onCancel={() => setResolving(null)}
                  onSubmit={handleResolve}
                >
                  <TextArea rows={3} placeholder="Resolution remarks (required)" value={resolutionRemarks} onChange={e => setResolutionRemarks(e.target.value)} status={!resolutionRemarks.trim() ? 'warning' : undefined} />
                </InlineExpandPanel>

                <Card bodyStyle={{ padding: 0 }}>
                  <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    size="middle"
                    scroll={{ x: 1200 }}
                    pagination={{ current: pagination.page, pageSize: pagination.limit, total: pagination.total, onChange: fetchList }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'budget',
            label: 'Budget Health',
            children: (
              <Card bodyStyle={{ padding: 0 }} loading={budgetLoading}>
                {budgetHealth && budgetHealth.length === 0 && <Empty description="No budget allocations configured" style={{ padding: 40 }} />}
                {budgetHealth && budgetHealth.length > 0 && (
                  <Table
                    size="middle"
                    rowKey={(r) => `${r.cost_center}-${r.fiscal_year}`}
                    dataSource={budgetHealth}
                    pagination={false}
                    columns={[
                      { title: 'Cost Center', dataIndex: 'cost_center' },
                      { title: 'Fiscal Year', dataIndex: 'fiscal_year', width: 110 },
                      { title: 'Allocated', dataIndex: 'allocated_amount', width: 130, render: v => Number(v).toLocaleString() },
                      { title: 'Committed', dataIndex: 'committed_amount', width: 130, render: v => Number(v).toLocaleString() },
                      { title: 'Consumed', dataIndex: 'consumed_amount', width: 130, render: v => Number(v).toLocaleString() },
                      { title: 'Actual', dataIndex: 'actual_amount', width: 130, render: v => Number(v).toLocaleString() },
                      { title: 'Remaining', dataIndex: 'remaining_amount', width: 130, render: v => <Text strong style={{ color: Number(v) < 0 ? '#cf1322' : undefined }}>{Number(v).toLocaleString()}</Text> },
                      {
                        title: 'Utilization', dataIndex: 'utilization_pct', width: 200,
                        render: v => v == null ? '—' : <Progress percent={Math.min(v, 100)} status={v >= 100 ? 'exception' : v >= 85 ? 'active' : 'normal'} size="small" format={() => `${v}%`} />,
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'risk',
            label: 'Vendor Risk & Opportunities',
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="Top Risk Vendors" size="small" loading={riskTabLoading}>
                    {topRiskVendors && topRiskVendors.length === 0 && <Empty description="No high-risk vendors right now" />}
                    {topRiskVendors && topRiskVendors.length > 0 && (
                      <Table
                        size="small"
                        pagination={false}
                        rowKey="vendor_id"
                        dataSource={topRiskVendors}
                        onRow={(r) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/vendors?id=${r.vendor_id}`) })}
                        columns={[
                          { title: 'Vendor', dataIndex: 'vendor_name' },
                          { title: 'Category', dataIndex: 'supplier_category' },
                          { title: 'Risk Score', dataIndex: 'risk_score', width: 100 },
                          { title: 'Trend', dataIndex: 'risk_trend', width: 100, render: v => <Tag color={v === 'worsening' ? 'red' : v === 'improving' ? 'green' : 'default'}>{(v || '—').toUpperCase()}</Tag> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title={<span><DollarOutlined /> Cost Saving Opportunities</span>} size="small" loading={riskTabLoading}>
                    {opportunities && opportunities.length === 0 && <Empty description="No cost-saving opportunities identified right now" />}
                    {opportunities && opportunities.length > 0 && (
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        {opportunities.map((o, idx) => (
                          <Alert
                            key={idx}
                            type="info"
                            showIcon
                            message={<a onClick={() => navigate(`/purchase-requisitions?id=${o.pr_id}`)}>{o.pr_number}</a>}
                            description={
                              <Space direction="vertical" size={0}>
                                <Text style={{ fontSize: 13 }}>{o.message}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>Suggested: {o.recommended_action}</Text>
                              </Space>
                            }
                          />
                        ))}
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}
