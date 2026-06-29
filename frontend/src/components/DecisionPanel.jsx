import { useEffect, useState } from 'react';
import { Card, Alert, Tag, Space, Typography, Empty, Skeleton, Badge, Button } from 'antd';
import {
  WarningOutlined, ThunderboltOutlined, DollarOutlined, BulbOutlined,
  LeftOutlined, RightOutlined,
} from '@ant-design/icons';
import api from '../api/axios';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';

const { Text } = Typography;

const SEVERITY_TO_ALERT_TYPE = { high: 'error', medium: 'warning', low: 'info' };
const SOURCE_COLOR = { exception: 'red', insight: 'blue', assistant: 'purple' };

const SECTIONS = [
  { key: 'critical_alerts', label: 'Critical Alerts', icon: <WarningOutlined />, emptyAlertType: 'error' },
  { key: 'risks', label: 'Risks', icon: <ThunderboltOutlined />, emptyAlertType: 'warning' },
  { key: 'cost_saving_opportunities', label: 'Cost Saving Opportunities', icon: <DollarOutlined />, emptyAlertType: 'success' },
  { key: 'recommendations', label: 'Recommendations', icon: <BulbOutlined />, emptyAlertType: 'info' },
];

export default function DecisionPanel({ entityType, entityId, sticky = false }) {
  const enabled = useFeatureFlag('smart_assistant_enabled');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!enabled || !entityId) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/assistant/decision-panel/${entityType}/${entityId}`)
      .then(res => { if (!cancelled) setData(res.data?.data || null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, entityType, entityId]);

  // Reset index when data changes
  useEffect(() => { setCurrentIndex(0); }, [data]);

  if (!enabled || !entityId) return null;

  // Flatten all items across sections into one ordered list for carousel navigation
  const allItems = data ? SECTIONS.flatMap(section =>
    (data[section.key] || []).map(item => ({ ...item, sectionLabel: section.label, sectionIcon: section.icon }))
  ) : [];
  const totalCount = allItems.length;

  const handlePrev = () => setCurrentIndex(i => (i - 1 + totalCount) % totalCount);
  const handleNext = () => setCurrentIndex(i => (i + 1) % totalCount);

  return (
    <Card
      size="small"
      title={<span><BulbOutlined /> Decision Panel</span>}
      style={sticky ? { position: 'sticky', top: 24 } : undefined}
      extra={!loading && data && <Badge count={totalCount} showZero color={totalCount > 0 ? '#faad14' : '#52c41a'} />}
    >
      {loading && <Skeleton active paragraph={{ rows: 3 }} />}
      {!loading && !data && <Empty description="No decision data available" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      {!loading && data && totalCount === 0 && (
        <Alert type="success" showIcon message="No outstanding concerns right now." />
      )}
      {!loading && data && totalCount > 0 && (() => {
        const item = allItems[currentIndex];
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {item.sectionIcon} {item.sectionLabel}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {currentIndex + 1} / {totalCount}
              </Text>
            </div>
            <Alert
              type={SEVERITY_TO_ALERT_TYPE[item.severity] || 'info'}
              showIcon
              message={
                <Space size={6} wrap>
                  <Tag color={SOURCE_COLOR[item.source] || 'default'} style={{ fontSize: 10 }}>{(item.source || '').toUpperCase()}</Tag>
                  <Text>{item.message}</Text>
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  {item.recommended_action && <Text type="secondary" style={{ fontSize: 12 }}>Suggested action: {item.recommended_action}</Text>}
                  <Text type="secondary" style={{ fontSize: 11 }}>Confidence: {item.confidence_score}%</Text>
                </Space>
              }
            />
            {totalCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                <Button size="small" icon={<LeftOutlined />} onClick={handlePrev} />
                <Button size="small" icon={<RightOutlined />} onClick={handleNext} />
              </div>
            )}
          </div>
        );
      })()}
    </Card>
  );
}
