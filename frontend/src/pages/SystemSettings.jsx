import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Switch, Typography, Tabs, Space, message, Spin, Collapse, Table, Tag, Input, InputNumber, Button, Select } from 'antd';
import { SettingOutlined, UserOutlined, ShopOutlined, FileProtectOutlined, DatabaseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../api/axios';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;

const CONDITION_FIELD_OPTIONS = [
  { value: 'total_value', label: 'Value' },
  { value: 'category', label: 'Category' },
  { value: 'vendor_risk_level', label: 'Vendor Risk Level' },
];
const CONDITION_OPERATOR_OPTIONS = [
  { value: '>', label: '>' }, { value: '>=', label: '>=' }, { value: '<', label: '<' }, { value: '<=', label: '<=' },
  { value: '=', label: '=' }, { value: '!=', label: '!=' }, { value: 'in', label: 'in (comma-separated)' },
];
const ROLE_OPTIONS = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'mdm_admin', label: 'MDM Admin' },
  { value: 'procurement_admin', label: 'Procurement Admin' },
  { value: 'vendor', label: 'Vendor' },
];

function formatConditionRule(rule) {
  if (!rule) return null;
  const parsed = typeof rule === 'string' ? JSON.parse(rule) : rule;
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.map(c => `${c.field} ${c.operator} ${Array.isArray(c.value) ? c.value.join(',') : c.value}`).join(' AND ');
}

const MODULE_LABELS = {
  module_mode: 'Platform Mode (Basic / Advanced)',
  modules_audit: 'Audit Management',
  modules_ticketing: 'Supplier Ticketing',
  modules_risk: 'Risk Scoring',
  modules_esg: 'ESG Tracking',
  modules_pricing: 'Price Benchmarking',
};

const FIELD_MODULE_LABELS = {
  vendor: 'Vendor Master / Onboarding',
  asn: 'ASN (Advance Shipment Notice)',
  purchase_order: 'Purchase Orders',
  rfq: 'RFQ & Negotiation',
  rfq_bid: 'RFQ — Vendor Bid',
  item_master: 'Item Master',
  user_management: 'User Management',
  ticket: 'Supplier Issues — Create Ticket',
  ticket_close: 'Supplier Issues — Close Ticket',
  audit_checklist: 'Audit Management — Checklist',
  audit_schedule: 'Audit Management — Schedule',
  audit_finding: 'Audit Management — Finding',
  audit_complete: 'Audit Management — Complete Audit',
  document: 'Document Center — Upload',
};

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [fieldRows, setFieldRows] = useState([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [flagStatus, setFlagStatus] = useState([]);
  const [flagLoading, setFlagLoading] = useState(false);
  const [budgetRows, setBudgetRows] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [costCenterOptions, setCostCenterOptions] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudgetRow, setEditingBudgetRow] = useState(null); // null = create mode, object = edit mode
  const [budgetForm, setBudgetForm] = useState({ cost_center: null, fiscal_year: String(new Date().getFullYear()), allocated_amount: 0 });
  const [budgetSaving, setBudgetSaving] = useState(false);

  const fetchFlagStatus = async () => {
    setFlagLoading(true);
    try {
      const res = await api.get('/system/feature-flags/status');
      setFlagStatus(res.data.data || []);
    } catch { message.error('Failed to load feature flag status'); }
    setFlagLoading(false);
  };

  const fetchBudgetAllocations = async () => {
    setBudgetLoading(true);
    try {
      const res = await api.get('/system/budget-allocations');
      setBudgetRows(res.data.data || []);
    } catch { message.error('Failed to load budget allocations'); }
    setBudgetLoading(false);
  };

  const fetchCostCenterOptions = async () => {
    try {
      const res = await api.get('/sub-masters/cost_center');
      setCostCenterOptions((res.data.data || []).map(s => ({ value: s.name, label: s.code ? `${s.name} — ${s.code}` : s.name })));
    } catch { setCostCenterOptions([]); }
  };

  const openCreateBudget = () => {
    setEditingBudgetRow(null);
    setBudgetForm({ cost_center: null, fiscal_year: String(new Date().getFullYear()), allocated_amount: 0 });
    setShowBudgetForm(true);
  };

  const openEditBudget = (row) => {
    setEditingBudgetRow(row);
    setBudgetForm({ cost_center: row.cost_center, fiscal_year: row.fiscal_year, allocated_amount: Number(row.allocated_amount) });
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async () => {
    if (!editingBudgetRow && (!budgetForm.cost_center || !budgetForm.fiscal_year)) {
      message.error('Cost Center and Fiscal Year are required');
      return;
    }
    setBudgetSaving(true);
    try {
      if (editingBudgetRow) {
        const res = await api.put(`/system/budget-allocations/${editingBudgetRow.id}`, { allocated_amount: budgetForm.allocated_amount });
        setBudgetRows(prev => prev.map(r => r.id === editingBudgetRow.id ? res.data.data : r));
        message.success('Budget allocation updated');
      } else {
        const res = await api.post('/system/budget-allocations', budgetForm);
        setBudgetRows(prev => [res.data.data, ...prev]);
        message.success('Budget allocation created');
      }
      setShowBudgetForm(false);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to save budget allocation');
    }
    setBudgetSaving(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/settings');
      const map = {};
      (res.data.data || res.data || []).forEach(s => { map[s.setting_key || s.key] = s.setting_value || s.value; });
      setSettings(map);
    } catch { message.error('Failed to load settings'); }
    setLoading(false);
  };

  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const res = await api.get('/system/usage');
      setUsage(res.data.data || res.data);
    } catch { message.error('Failed to load usage stats'); }
    setUsageLoading(false);
  };

  const fetchFieldConfig = async () => {
    setFieldLoading(true);
    try {
      const res = await api.get('/system/field-config');
      setFieldRows(res.data.data || res.data || []);
    } catch { message.error('Failed to load field settings'); }
    setFieldLoading(false);
  };

  const handleToggleMandatory = async (row, checked) => {
    try {
      await api.put(`/system/field-config/${row.id}`, { is_mandatory: checked });
      setFieldRows(prev => prev.map(r => r.id === row.id ? { ...r, is_mandatory: checked } : r));
      message.success(`"${row.field_label}" is now ${checked ? 'mandatory' : 'optional'}`);
    } catch { message.error('Failed to update field setting'); }
  };

  // Conditional Mandatory Fields + Role-Based Visibility — editable per field
  // from this same table, alongside the existing static Mandatory toggle.
  const [editingFieldRow, setEditingFieldRow] = useState(null);
  const [conditionField, setConditionField] = useState(null);
  const [conditionOperator, setConditionOperator] = useState('>');
  const [conditionValue, setConditionValue] = useState('');
  const [visibleRoles, setVisibleRoles] = useState([]);

  const openFieldRuleEditor = (row) => {
    setEditingFieldRow(row);
    const existing = row.condition_rule ? (typeof row.condition_rule === 'string' ? JSON.parse(row.condition_rule) : row.condition_rule) : null;
    const firstRule = Array.isArray(existing) ? existing[0] : null;
    setConditionField(firstRule?.field || null);
    setConditionOperator(firstRule?.operator || '>');
    setConditionValue(firstRule ? (Array.isArray(firstRule.value) ? firstRule.value.join(',') : String(firstRule.value)) : '');
    const existingRoles = row.visible_roles ? (typeof row.visible_roles === 'string' ? JSON.parse(row.visible_roles) : row.visible_roles) : [];
    setVisibleRoles(Array.isArray(existingRoles) ? existingRoles : []);
  };

  const handleSaveFieldRule = async () => {
    const condition_rule = conditionField
      ? [{ field: conditionField, operator: conditionOperator, value: conditionOperator === 'in' ? conditionValue.split(',').map(v => v.trim()) : (conditionField === 'total_value' ? Number(conditionValue) : conditionValue) }]
      : null;
    try {
      await api.put(`/system/field-config/${editingFieldRow.id}`, {
        is_mandatory: editingFieldRow.is_mandatory,
        condition_rule,
        visible_roles: visibleRoles.length > 0 ? visibleRoles : null,
      });
      setFieldRows(prev => prev.map(r => r.id === editingFieldRow.id ? { ...r, condition_rule, visible_roles: visibleRoles.length > 0 ? visibleRoles : null } : r));
      message.success(`Rules updated for "${editingFieldRow.field_label}"`);
      setEditingFieldRow(null);
    } catch { message.error('Failed to update field rules'); }
  };

  useEffect(() => { fetchSettings(); fetchFlagStatus(); fetchBudgetAllocations(); fetchCostCenterOptions(); }, []);

  const handleToggle = async (key, checked) => {
    const value = key === 'module_mode' ? (checked ? 'advanced' : 'basic') : (checked ? 'true' : 'false');
    try {
      await api.put('/system/settings', { key, value });
      setSettings(prev => ({ ...prev, [key]: value }));
      message.success('Setting updated');
    } catch { message.error('Failed to update setting'); }
  };

  const handleFlagToggle = async (flag, checked) => {
    const value = `${checked ? 'true' : 'false'}:${flag.lifecycle}`;
    try {
      await api.put('/system/settings', { key: flag.key, value });
      setFlagStatus(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: checked } : f));
      message.success('Feature flag updated');
    } catch { message.error('Failed to update feature flag'); }
  };

  const handleFlagLifecycleChange = async (flag, lifecycle) => {
    const value = `${flag.enabled ? 'true' : 'false'}:${lifecycle}`;
    try {
      await api.put('/system/settings', { key: flag.key, value });
      setFlagStatus(prev => prev.map(f => f.key === flag.key ? { ...f, lifecycle } : f));
      message.success('Lifecycle stage updated');
    } catch { message.error('Failed to update lifecycle stage'); }
  };

  const isChecked = (key) => {
    if (key === 'module_mode') return settings[key] === 'advanced';
    return settings[key] === 'true';
  };

  const handleTextSave = async (key, value) => {
    try {
      await api.put('/system/settings', { key, value: String(value) });
      setSettings(prev => ({ ...prev, [key]: String(value) }));
      message.success('Setting updated');
    } catch { message.error('Failed to update setting'); }
  };

  const tabItems = [
    {
      key: 'modules',
      label: 'Module Settings',
      children: (
        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            {Object.keys(MODULE_LABELS).map(key => (
              <Col xs={24} sm={12} md={8} key={key}>
                <Card size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{MODULE_LABELS[key]}</Text>
                    <Switch
                      checked={isChecked(key)}
                      onChange={(checked) => handleToggle(key, checked)}
                      checkedChildren={key === 'module_mode' ? 'Advanced' : 'On'}
                      unCheckedChildren={key === 'module_mode' ? 'Basic' : 'Off'}
                    />
                  </div>
                  {key === 'module_mode' && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                      Switch between basic and advanced platform features
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>
      ),
    },
    {
      key: 'budget-allocations',
      label: 'Budget Allocations',
      children: (
        <Spin spinning={budgetLoading}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Set each department/cost center's allocated budget per fiscal year. Committed, Consumed, and Actual are
            system-managed by the Budget Commitment Funnel (PR approval → PO → invoice) and update automatically as
            transactions flow through — only Allocated is editable here.
          </Text>

          <Button type="dashed" icon={<PlusOutlined />} onClick={openCreateBudget} style={{ marginBottom: 12 }}>
            New Budget Allocation
          </Button>

          <InlineExpandPanel
            open={showBudgetForm}
            title={editingBudgetRow ? `Revise Budget — ${editingBudgetRow.cost_center} / ${editingBudgetRow.fiscal_year}` : 'New Budget Allocation'}
            description={editingBudgetRow ? 'Cost Center and Fiscal Year cannot be changed once created — create a new allocation instead if a budget needs to move.' : undefined}
            onCancel={() => setShowBudgetForm(false)}
            onSubmit={handleSaveBudget}
            loading={budgetSaving}
          >
            <Row gutter={12}>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Cost Center / Department</Text>
                {editingBudgetRow ? (
                  <Text>{editingBudgetRow.cost_center}</Text>
                ) : (
                  <Select
                    showSearch
                    allowClear
                    placeholder="Select cost center"
                    value={budgetForm.cost_center}
                    onChange={v => setBudgetForm(f => ({ ...f, cost_center: v }))}
                    options={costCenterOptions}
                    style={{ width: '100%' }}
                  />
                )}
              </Col>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Fiscal Year</Text>
                {editingBudgetRow ? (
                  <Text>{editingBudgetRow.fiscal_year}</Text>
                ) : (
                  <Input
                    placeholder="e.g. 2026"
                    value={budgetForm.fiscal_year}
                    onChange={e => setBudgetForm(f => ({ ...f, fiscal_year: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                )}
              </Col>
              <Col span={8}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>Allocated Amount</Text>
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  value={budgetForm.allocated_amount}
                  onChange={v => setBudgetForm(f => ({ ...f, allocated_amount: v }))}
                  formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/₹\s?|,/g, '')}
                />
              </Col>
            </Row>
          </InlineExpandPanel>

          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={budgetRows}
            columns={[
              { title: 'Cost Center / Department', dataIndex: 'cost_center', sorter: (a, b) => String(a.cost_center || '').localeCompare(String(b.cost_center || '')) },
              { title: 'Fiscal Year', dataIndex: 'fiscal_year', width: 100, sorter: (a, b) => String(a.fiscal_year || '').localeCompare(String(b.fiscal_year || '')) },
              { title: 'Allocated', dataIndex: 'allocated_amount', width: 140, render: v => `₹${Number(v).toLocaleString('en-IN')}`, sorter: (a, b) => Number(a.allocated_amount || 0) - Number(b.allocated_amount || 0) },
              { title: 'Committed', dataIndex: 'committed_amount', width: 130, render: v => `₹${Number(v).toLocaleString('en-IN')}`, sorter: (a, b) => Number(a.committed_amount || 0) - Number(b.committed_amount || 0) },
              { title: 'Consumed', dataIndex: 'consumed_amount', width: 130, render: v => `₹${Number(v).toLocaleString('en-IN')}`, sorter: (a, b) => Number(a.consumed_amount || 0) - Number(b.consumed_amount || 0) },
              { title: 'Actual', dataIndex: 'actual_amount', width: 130, render: v => `₹${Number(v).toLocaleString('en-IN')}`, sorter: (a, b) => Number(a.actual_amount || 0) - Number(b.actual_amount || 0) },
              {
                title: 'Remaining', width: 140,
                sorter: (a, b) => (Number(a.allocated_amount) - Number(a.committed_amount) - Number(a.consumed_amount) - Number(a.actual_amount)) - (Number(b.allocated_amount) - Number(b.committed_amount) - Number(b.consumed_amount) - Number(b.actual_amount)),
                render: (_, row) => {
                  const remaining = Number(row.allocated_amount) - Number(row.committed_amount) - Number(row.consumed_amount) - Number(row.actual_amount);
                  return <Text type={remaining < 0 ? 'danger' : undefined} strong>₹{remaining.toLocaleString('en-IN')}</Text>;
                },
              },
              {
                title: '', width: 50,
                render: (_, row) => <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditBudget(row)} />,
              },
            ]}
          />
        </Spin>
      ),
    },
    {
      key: 'feature-flags',
      label: 'Feature Flags',
      children: (
        <Spin spinning={flagLoading}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Experimental flags are visible to system_admin only; Beta is live for everyone; Stable means the flag has graduated and the gate can eventually be removed from the code.
          </Text>
          <Table
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={flagStatus}
            columns={[
              { title: 'Flag', dataIndex: 'key', sorter: (a, b) => String(a.key || '').localeCompare(String(b.key || '')) },
              {
                title: 'Lifecycle', dataIndex: 'lifecycle', width: 220,
                render: (v, row) => (
                  <Select
                    size="small" style={{ width: 160 }} value={v}
                    onChange={(lifecycle) => handleFlagLifecycleChange(row, lifecycle)}
                    options={[
                      { value: 'experimental', label: 'Experimental' },
                      { value: 'beta', label: 'Beta' },
                      { value: 'stable', label: 'Stable' },
                    ]}
                  />
                ),
              },
              {
                title: 'Enabled', dataIndex: 'enabled', width: 100,
                render: (v, row) => <Switch checked={v} checkedChildren="On" unCheckedChildren="Off" onChange={(checked) => handleFlagToggle(row, checked)} />,
              },
            ]}
          />
        </Spin>
      ),
    },
    {
      key: 'procurement',
      label: 'Procurement Rules',
      children: (
        <Spin spinning={loading}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Configure the Purchase Requisition sourcing decision engine and budget enforcement.
          </Text>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card size="small">
                <Text strong style={{ display: 'block', marginBottom: 8 }}>PR Number Prefix</Text>
                <Input
                  key={settings.pr_number_prefix}
                  defaultValue={settings.pr_number_prefix || 'PR'}
                  onBlur={e => handleTextSave('pr_number_prefix', e.target.value)}
                  style={{ width: 160 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small">
                <Text strong style={{ display: 'block', marginBottom: 8 }}>RFQ Threshold Value</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>PRs above this value must use RFQ_REQUIRED sourcing.</Text>
                <InputNumber
                  key={settings.pr_rfq_threshold_value}
                  defaultValue={Number(settings.pr_rfq_threshold_value) || 0}
                  min={0}
                  style={{ width: 200 }}
                  onBlur={e => handleTextSave('pr_rfq_threshold_value', e.target.value)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small">
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Budget Enforcement</Text>
                <Switch
                  checked={settings.pr_budget_enforcement === 'hard'}
                  checkedChildren="Hard Stop"
                  unCheckedChildren="Soft Warning"
                  onChange={checked => handleTextSave('pr_budget_enforcement', checked ? 'hard' : 'soft')}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card size="small">
                <Text strong style={{ display: 'block', marginBottom: 8 }}>PO Creation</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>When strict, the standalone "Create PO" button is disabled — every PO must reference a Requisition or RFQ.</Text>
                <Switch
                  checked={settings.po_require_pr_reference === 'true'}
                  checkedChildren="Strict (PR/RFQ only)"
                  unCheckedChildren="Unrestricted"
                  onChange={checked => handleTextSave('po_require_pr_reference', checked ? 'true' : 'false')}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    },
    {
      key: 'usage',
      label: 'System Usage',
      children: (
        <Spin spinning={usageLoading}>
          {usage && (
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Total Users" value={usage.totalUsers ?? usage.total_users ?? 0} prefix={<UserOutlined />} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Active Users" value={usage.activeUsers ?? usage.active_users ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Total Vendors" value={usage.totalVendors ?? usage.total_vendors ?? 0} prefix={<ShopOutlined />} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Total ASNs" value={usage.totalASNs ?? usage.total_asns ?? 0} prefix={<FileProtectOutlined />} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Total POs" value={usage.totalPOs ?? usage.total_pos ?? 0} prefix={<DatabaseOutlined />} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="Total Tickets" value={usage.totalTickets ?? usage.total_tickets ?? 0} /></Card></Col>
              <Col xs={12} sm={8} md={6}><Card><Statistic title="DB Size (MB)" value={usage.dbSizeMB ?? usage.db_size_mb ?? 0} suffix="MB" /></Card></Col>
            </Row>
          )}
        </Spin>
      ),
    },
    {
      key: 'fields',
      label: 'Field Settings',
      children: (
        <Spin spinning={fieldLoading}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Mark any field below as Mandatory or Optional, or set a conditional rule (e.g. "Value &gt; 10,00,000") and/or restrict which roles see it. Changes apply immediately across the app.
          </Text>

          <InlineExpandPanel
            open={!!editingFieldRow}
            title={`Field Rules — ${editingFieldRow?.field_label || ''}`}
            description="A condition makes this field mandatory whenever it matches, on top of the static toggle above. Restricting visible roles hides the field entirely from any other role."
            onCancel={() => setEditingFieldRow(null)}
            onSubmit={handleSaveFieldRule}
          >
            <Text strong>Conditional Mandatory Rule</Text>
            <Row gutter={12} style={{ marginTop: 8, marginBottom: 16 }}>
              <Col span={8}>
                <Select allowClear placeholder="If field" value={conditionField || undefined} onChange={setConditionField} options={CONDITION_FIELD_OPTIONS} style={{ width: '100%' }} />
              </Col>
              <Col span={6}>
                <Select value={conditionOperator} onChange={setConditionOperator} options={CONDITION_OPERATOR_OPTIONS} style={{ width: '100%' }} disabled={!conditionField} />
              </Col>
              <Col span={10}>
                <Input placeholder="value" value={conditionValue} onChange={e => setConditionValue(e.target.value)} disabled={!conditionField} />
              </Col>
            </Row>
            <Text strong>Visible To Roles</Text>
            <Select
              mode="multiple"
              allowClear
              placeholder="Visible to every role (default)"
              value={visibleRoles}
              onChange={setVisibleRoles}
              options={ROLE_OPTIONS}
              style={{ width: '100%', marginTop: 8 }}
            />
          </InlineExpandPanel>

          <Collapse
            items={Object.keys(FIELD_MODULE_LABELS)
              .filter(moduleKey => fieldRows.some(r => r.module_key === moduleKey))
              .map(moduleKey => {
                const rows = fieldRows.filter(r => r.module_key === moduleKey);
                return {
                  key: moduleKey,
                  label: <Space><Text strong>{FIELD_MODULE_LABELS[moduleKey]}</Text><Tag>{rows.length} fields</Tag></Space>,
                  children: (
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={rows}
                      pagination={false}
                      columns={[
                        { title: 'Field', dataIndex: 'field_label', sorter: (a, b) => String(a.field_label || '').localeCompare(String(b.field_label || '')) },
                        { title: 'Key', dataIndex: 'field_key', render: v => <Text code>{v}</Text>, sorter: (a, b) => String(a.field_key || '').localeCompare(String(b.field_key || '')) },
                        {
                          title: 'Section', dataIndex: 'section', render: v => v ? <Tag>{v}</Tag> : '—',
                          sorter: (a, b) => String(a.section || '').localeCompare(String(b.section || '')),
                        },
                        {
                          title: 'Mandatory', dataIndex: 'is_mandatory', width: 140,
                          filters: [{ text: 'Mandatory', value: true }, { text: 'Optional', value: false }],
                          onFilter: (value, row) => !!row.is_mandatory === value,
                          render: (v, row) => (
                            <Switch
                              checked={!!v}
                              checkedChildren="Mandatory"
                              unCheckedChildren="Optional"
                              onChange={(checked) => handleToggleMandatory(row, checked)}
                            />
                          ),
                        },
                        {
                          title: 'Conditional Rule', dataIndex: 'condition_rule', width: 220,
                          render: v => formatConditionRule(v) ? <Tag color="purple">{formatConditionRule(v)}</Tag> : <Text type="secondary">—</Text>,
                        },
                        {
                          title: 'Visible To', dataIndex: 'visible_roles', width: 160,
                          render: v => {
                            const roles = v ? (typeof v === 'string' ? JSON.parse(v) : v) : [];
                            return Array.isArray(roles) && roles.length > 0 ? roles.map(r => <Tag key={r}>{ROLE_OPTIONS.find(o => o.value === r)?.label || r}</Tag>) : <Text type="secondary">Everyone</Text>;
                          },
                        },
                        {
                          title: '', width: 50,
                          render: (_, row) => <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFieldRuleEditor(row)} />,
                        },
                      ]}
                    />
                  ),
                };
              })}
          />
        </Spin>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Administration' }, { title: 'System Settings' }]}
        title="System Settings"
        subtitle="Configure platform modules, field rules, and view system usage statistics."
      />
      <Tabs
        defaultActiveKey="modules"
        items={tabItems}
        onChange={(key) => {
          if (key === 'usage' && !usage) fetchUsage();
          if (key === 'fields' && fieldRows.length === 0) fetchFieldConfig();
        }}
      />
    </div>
  );
}
