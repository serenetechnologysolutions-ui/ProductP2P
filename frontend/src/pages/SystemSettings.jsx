import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Switch, Typography, Tabs, Space, Divider, message, Spin } from 'antd';
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

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);

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
        onChange={(key) => { if (key === 'usage' && !usage) fetchUsage(); }}
      />
    </div>
  );
}
