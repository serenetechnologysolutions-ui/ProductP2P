import { Tag, Badge, Card, Space, Typography, Progress, Alert } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined,
  CheckCircleOutlined, StarFilled, BulbOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

// ─── 1. StatusTag ────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', approved: 'green', rejected: 'red',
  closed: 'default', open: 'blue', published: 'blue', awarded: 'green',
  validated: 'cyan', posted: 'green', exception: 'red', matched: 'green',
  blocked: 'red', initiated: 'blue', in_progress: 'orange', vendor_closed: 'cyan',
  active: 'green', inactive: 'default', exhausted: 'default',
  created: 'blue', in_transit: 'purple', received: 'green',
  confirmed: 'green', partially_fulfilled: 'orange', fulfilled: 'green',
  under_review: 'orange',
};

export function StatusTag({ status, style }) {
  const color = STATUS_COLORS[status] || 'default';
  const label = (status || '').replace(/_/g, ' ').toUpperCase();
  return <Tag color={color} style={style}>{label}</Tag>;
}

// ─── 2. PriorityBadge ────────────────────────────────────────────────────────
const PRIORITY_COLORS = { low: '#1890ff', medium: '#faad14', high: '#ff7a45', critical: '#ff4d4f', urgent: '#ff4d4f' };
const PRIORITY_BG = { low: '#e6f7ff', medium: '#fffbe6', high: '#fff7e6', critical: '#fff2f0', urgent: '#fff2f0' };

export function PriorityBadge({ priority, style }) {
  const color = PRIORITY_COLORS[priority] || '#999';
  const bg = PRIORITY_BG[priority] || '#fafafa';
  const label = (priority || '').toUpperCase();
  return (
    <Badge
      count={label}
      style={{ backgroundColor: bg, color, border: `1px solid ${color}`, fontWeight: 600, fontSize: 10, ...style }}
    />
  );
}

// ─── 3. InsightCard ──────────────────────────────────────────────────────────
export function InsightCard({ title, description, icon, severity = 'info', onClick, style }) {
  const borderColors = { critical: '#ff4d4f', high: '#ff7a45', medium: '#faad14', low: '#1890ff', info: '#1890ff' };
  const borderColor = borderColors[severity] || '#d9d9d9';

  return (
    <Card
      size="small"
      hoverable={!!onClick}
      onClick={onClick}
      style={{ borderLeft: `4px solid ${borderColor}`, ...style }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Space align="start" size={12}>
        <div style={{ fontSize: 20, color: borderColor }}>{icon || <BulbOutlined />}</div>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 2 }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
        </div>
      </Space>
    </Card>
  );
}

// ─── 4. MetricCard ───────────────────────────────────────────────────────────
const TREND_ICONS = { up: <ArrowUpOutlined />, down: <ArrowDownOutlined />, stable: <MinusOutlined /> };
const TREND_COLORS = { up: '#52c41a', down: '#ff4d4f', stable: '#8c8c8c' };

export function MetricCard({ label, value, trend, trendValue, prefix, suffix, onClick, loading, style }) {
  const trendColor = TREND_COLORS[trend] || '#8c8c8c';
  const trendIcon = TREND_ICONS[trend] || null;

  return (
    <Card size="small" hoverable={!!onClick} onClick={onClick} loading={loading} style={style}>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      <Space align="baseline" size={4}>
        {prefix && <Text type="secondary">{prefix}</Text>}
        <Title level={4} style={{ margin: 0 }}>{value}</Title>
        {suffix && <Text type="secondary">{suffix}</Text>}
      </Space>
      {trend && (
        <div style={{ marginTop: 4 }}>
          <Text style={{ color: trendColor, fontSize: 12 }}>
            {trendIcon} {trendValue || ''}
          </Text>
        </div>
      )}
    </Card>
  );
}

// ─── 5. ExceptionAlert ───────────────────────────────────────────────────────
const SEVERITY_MAP = { critical: 'error', high: 'error', medium: 'warning', low: 'info' };
const SEVERITY_ICONS = {
  critical: <ExclamationCircleOutlined />,
  high: <WarningOutlined />,
  medium: <WarningOutlined />,
  low: <InfoCircleOutlined />,
};

export function ExceptionAlert({ severity = 'medium', message: msg, description, onClose, style }) {
  const type = SEVERITY_MAP[severity] || 'info';

  return (
    <Alert
      type={type}
      showIcon
      icon={SEVERITY_ICONS[severity]}
      message={
        <Space>
          <Tag color={severity === 'critical' || severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'blue'}>
            {(severity || '').toUpperCase()}
          </Tag>
          <Text>{msg}</Text>
        </Space>
      }
      description={description}
      closable={!!onClose}
      onClose={onClose}
      style={{ marginBottom: 8, ...style }}
    />
  );
}

// ─── 6. VendorScoreCard ──────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
}

function ratingStars(overall) {
  const stars = Math.round(overall / 20); // 0-100 → 0-5 stars
  return Array.from({ length: 5 }, (_, i) => (
    <StarFilled key={i} style={{ color: i < stars ? '#faad14' : '#d9d9d9', fontSize: 14 }} />
  ));
}

export function VendorScoreCard({ vendorName, priceScore, riskScore, deliveryScore, esgScore, overallRating, onClick, style }) {
  const overall = overallRating ?? Math.round((priceScore + (100 - riskScore) + deliveryScore + (esgScore || 0)) / (esgScore != null ? 4 : 3));

  return (
    <Card size="small" hoverable={!!onClick} onClick={onClick} style={{ minWidth: 240, ...style }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>{vendorName}</Text>
          <div>{ratingStars(overall)}</div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 12 }}>Price Competitiveness</Text>
            <Text style={{ fontSize: 12 }}>{priceScore}%</Text>
          </div>
          <Progress percent={priceScore} size="small" showInfo={false} strokeColor={scoreColor(priceScore)} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 12 }}>Delivery Score</Text>
            <Text style={{ fontSize: 12 }}>{deliveryScore}%</Text>
          </div>
          <Progress percent={deliveryScore} size="small" showInfo={false} strokeColor={scoreColor(deliveryScore)} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 12 }}>Risk Score</Text>
            <Text style={{ fontSize: 12 }}>{riskScore}%</Text>
          </div>
          <Progress percent={100 - riskScore} size="small" showInfo={false} strokeColor={scoreColor(100 - riskScore)} />
        </div>

        {esgScore != null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 12 }}>ESG Score</Text>
              <Text style={{ fontSize: 12 }}>{esgScore}%</Text>
            </div>
            <Progress percent={esgScore} size="small" showInfo={false} strokeColor={scoreColor(esgScore)} />
          </div>
        )}

        <div style={{ textAlign: 'center', paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
          <Text strong style={{ color: scoreColor(overall) }}>Overall: {overall}/100</Text>
        </div>
      </Space>
    </Card>
  );
}

// End of ProcurementUI components
