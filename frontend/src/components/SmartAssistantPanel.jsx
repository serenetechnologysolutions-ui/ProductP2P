import { useEffect, useState } from 'react';
import { Card, Alert, Tag, Space, Typography, Empty, Skeleton } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import api from '../api/axios';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';

const { Text } = Typography;

const SEVERITY_TO_ALERT_TYPE = { high: 'error', medium: 'warning', low: 'info' };
const TYPE_COLOR = { cost_saving: 'green', risk: 'red', compliance: 'purple', recommendation: 'blue' };
const TYPE_LABEL = { cost_saving: 'Cost Saving', risk: 'Risk', compliance: 'Compliance', recommendation: 'Recommendation' };

// Reusable, read-only Smart Procurement Assistant panel. Renders whatever
// GET /assistant/{pr|rfq|vendor}/:id returns — a flat, explainable
// {insights: [{type, severity, message, action, confidence}]} list — and
// nothing else; it never blocks or alters the page it's embedded in. Hidden
// entirely while smart_assistant_enabled is off, so dropping this component
// into a page is always safe regardless of the flag's state.
export default function SmartAssistantPanel({ entityType, entityId }) {
  const enabled = useFeatureFlag('smart_assistant_enabled');
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !entityId) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/assistant/${entityType}/${entityId}`)
      .then(res => { if (!cancelled) setInsights(res.data?.data?.insights || []); })
      .catch(() => { if (!cancelled) setInsights([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, entityType, entityId]);

  if (!enabled || !entityId) return null;

  return (
    <Card size="small" title={<span><BulbOutlined /> Smart Assistant</span>} style={{ marginBottom: 16 }}>
      {loading && <Skeleton active paragraph={{ rows: 2 }} />}
      {!loading && insights?.length === 0 && <Empty description="No insights right now" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      {!loading && insights?.length > 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {insights.map((i, idx) => (
            <Alert
              key={idx}
              type={SEVERITY_TO_ALERT_TYPE[i.severity] || 'info'}
              showIcon
              message={
                <Space size={6} wrap>
                  <Tag color={TYPE_COLOR[i.type] || 'default'}>{TYPE_LABEL[i.type] || i.type}</Tag>
                  <Text>{i.message}</Text>
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  {i.action && <Text type="secondary" style={{ fontSize: 12 }}>Suggested action: {i.action}</Text>}
                  <Text type="secondary" style={{ fontSize: 11 }}>Confidence: {i.confidence}%</Text>
                </Space>
              }
            />
          ))}
        </Space>
      )}
    </Card>
  );
}
