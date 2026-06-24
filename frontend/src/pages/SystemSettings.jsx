import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Switch, Typography, Tabs, Space, Divider, message, Spin, Collapse, Table, Tag, Input, InputNumber } from 'antd';
import { SettingOutlined, UserOutlined, ShopOutlined, FileProtectOutlined, DatabaseOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;

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

  useEffect(() => { fetchSettings(); }, []);

  const handleToggle = async (key, checked) => {
    const value = key === 'module_mode' ? (checked ? 'advanced' : 'basic') : (checked ? 'true' : 'false');
    try {
      await api.put('/system/settings', { key, value });
      setSettings(prev => ({ ...prev, [key]: value }));
      message.success('Setting updated');
    } catch { message.error('Failed to update setting'); }
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
            Mark any field below as Mandatory or Optional. Changes apply immediately across the app.
          </Text>
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
                        { title: 'Field', dataIndex: 'field_label' },
                        { title: 'Key', dataIndex: 'field_key', render: v => <Text code>{v}</Text> },
                        { title: 'Section', dataIndex: 'section', render: v => v ? <Tag>{v}</Tag> : '—' },
                        {
                          title: 'Mandatory', dataIndex: 'is_mandatory', width: 140,
                          render: (v, row) => (
                            <Switch
                              checked={!!v}
                              checkedChildren="Mandatory"
                              unCheckedChildren="Optional"
                              onChange={(checked) => handleToggleMandatory(row, checked)}
                            />
                          ),
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
    <div>
      <Title level={4} style={{ margin: 0 }}>System Settings</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Configure platform modules and view system usage statistics.
      </Text>
      <Divider style={{ margin: '12px 0' }} />
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
