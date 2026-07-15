import React from 'react';
import { Row, Col, Card, Table, Tag, Typography, Progress } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import api from '../api/axios';

const { Title, Text } = Typography;

// ─── Design Tokens ───
const T = {
  bg: '#F8F9FA',
  card: '#FFFFFF',
  border: '#E8ECF0',
  textPrimary: '#1A1F36',
  textSecondary: '#6B7280',
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  cardRadius: 12,
  padding: 24,
};

// ─── Styles ───
const styles = {
  page: {
    background: T.bg,
    minHeight: '100vh',
    padding: T.padding,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.cardRadius,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'all 0.2s ease',
  },
  cardHover: {
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    borderColor: '#d1d5db',
  },
  sectionTitle: {
    color: T.textPrimary,
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
    letterSpacing: '-0.3px',
  },
  kpiValue: {
    color: T.textPrimary,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.1,
    margin: 0,
  },
  kpiLabel: {
    color: T.textSecondary,
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 8,
  },
};

// ─── Mock Data ───
const kpiData = [
  { label: 'Open RFQs', value: 23, trend: '+4', trendUp: true, color: T.primary },
  { label: 'Active POs', value: 156, trend: '+12', trendUp: true, color: T.primary },
  { label: 'ASN In Transit', value: 48, trend: null, color: T.success },
  { label: 'Delayed Shipments', value: 17, trend: null, color: T.warning, isWarning: true },
  { label: 'Pending Validations', value: 21, trend: null, color: T.primary },
  { label: 'SLA Breaches', value: 3, trend: null, color: T.danger, isDanger: true },
];

const pipelineStages = [
  { label: 'RFQ', count: 23, color: T.primary },
  { label: 'Awarded', count: 17, color: '#8B5CF6' },
  { label: 'PO', count: 156, color: T.primary },
  { label: 'ASN', count: 89, color: T.warning },
  { label: 'Validated', count: 34, color: T.success },
  { label: 'Posted', count: 72, color: '#10B981' },
];

const asnTrackingData = [
  { name: 'In Transit', value: 48, color: T.primary },
  { name: 'Delivered (Not Validated)', value: 21, color: T.warning },
  { name: 'Delayed', value: 17, color: T.danger },
  { name: 'Cancelled', value: 3, color: '#6B7280' },
];

const actionQueueData = [
  { key: '1', action: 'ASN Validation Pending', count: '21 ASNs', priority: 'High', icon: '📋' },
  { key: '2', action: 'RFQ Closing Today', count: '8 RFQs', priority: 'High', icon: '⏰' },
  { key: '3', action: 'Vendor Responses Missing', count: '6 vendors', priority: 'High', icon: '📨' },
  { key: '4', action: 'PO Deliveries Delayed', count: '17 POs', priority: 'Medium', icon: '🚚' },
  { key: '5', action: 'Tickets Awaiting Resolution', count: '12 tickets', priority: 'Medium', icon: '🎫' },
];

const spendByCategoryData = [
  { category: 'Raw Materials', spend: 248, display: '₹2.48 Cr' },
  { category: 'Equipment', spend: 130, display: '₹1.30 Cr' },
  { category: 'Consumables', spend: 116, display: '₹1.16 Cr' },
  { category: 'Logistics', spend: 96, display: '₹0.96 Cr' },
  { category: 'Services', spend: 94, display: '₹0.94 Cr' },
  { category: 'IT', spend: 64, display: '₹0.64 Cr' },
];

const topVendors = [
  { name: 'Tata Steel Ltd', spend: '₹1.12 Cr', pct: 92 },
  { name: 'Reliance Industries', spend: '₹0.87 Cr', pct: 72 },
  { name: 'Mahindra Logistics', spend: '₹0.64 Cr', pct: 53 },
  { name: 'JSW Paints', spend: '₹0.48 Cr', pct: 40 },
  { name: 'Adani Wilmar', spend: '₹0.36 Cr', pct: 30 },
];

const recentASNActivities = [
  { id: 1, text: 'ASN-2024-0891 validated by procurement team', time: '12 min ago', type: 'success' },
  { id: 2, text: 'ASN-2024-0889 delayed — ETA revised to 18 Jan', time: '34 min ago', type: 'warning' },
  { id: 3, text: 'ASN-2024-0887 posted to SAP successfully', time: '1 hr ago', type: 'success' },
  { id: 4, text: 'New ASN-2024-0892 submitted by Tata Steel', time: '2 hr ago', type: 'info' },
  { id: 5, text: 'ASN-2024-0885 rejected — qty mismatch', time: '3 hr ago', type: 'danger' },
];

// ─── Helper Components ───
function HoverCard({ children, style = {} }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        ...style,
        ...(hovered ? styles.cardHover : {}),
      }}
    >
      {children}
    </div>
  );
}

function KPICard({ item }) {
  const borderTop = item.isDanger && item.value > 0
    ? `3px solid ${T.danger}`
    : item.isWarning
      ? `3px solid ${T.warning}`
      : '3px solid transparent';

  return (
    <HoverCard style={{ borderTop, paddingTop: 16 }}>
      <div style={styles.kpiLabel}>{item.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <span style={{ ...styles.kpiValue, color: item.isDanger && item.value > 0 ? T.danger : item.isWarning ? T.warning : T.textPrimary }}>
          {item.value}
        </span>
        {item.trend && (
          <span style={{ fontSize: 13, fontWeight: 500, color: item.trendUp ? T.success : T.danger, display: 'flex', alignItems: 'center', gap: 2 }}>
            {item.trendUp ? <ArrowUpOutlined style={{ fontSize: 11 }} /> : <ArrowDownOutlined style={{ fontSize: 11 }} />}
            {item.trend} vs last month
          </span>
        )}
      </div>
    </HoverCard>
  );
}

function PipelineArrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: T.textSecondary }}>
      <RightOutlined style={{ fontSize: 14 }} />
    </div>
  );
}

function PipelineNode({ stage, nextStage }) {
  const dropOff = nextStage ? Math.round(((stage.count - nextStage.count) / stage.count) * 100) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
      <div style={{
        background: `${stage.color}15`,
        border: `1px solid ${stage.color}40`,
        borderRadius: 12,
        padding: '16px 12px',
        textAlign: 'center',
        width: '100%',
        minWidth: 90,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: stage.color }}>{stage.count}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {stage.label}
        </div>
      </div>
      {dropOff !== null && dropOff > 0 && (
        <div style={{ fontSize: 10, color: T.danger, marginTop: 6, fontWeight: 500 }}>
          -{dropOff}% drop
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip for Charts ───
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 500 }}>{name}</div>
      <div style={{ color: T.textSecondary, fontSize: 12 }}>{value}</div>
    </div>
  );
}

function SpendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { category, display } = payload[0].payload;
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 500 }}>{category}</div>
      <div style={{ color: T.textSecondary, fontSize: 12 }}>{display}</div>
    </div>
  );
}

// ─── Main Component ───
export default function ProcurementDashboard() {
  const actionColumns = [
    {
      title: '',
      dataIndex: 'icon',
      width: 40,
      render: (icon) => <span style={{ fontSize: 18 }}>{icon}</span>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (text) => <span style={{ color: T.textPrimary, fontWeight: 500, fontSize: 13 }}>{text}</span>,
    },
    {
      title: 'Items',
      dataIndex: 'count',
      render: (text) => <span style={{ color: T.textSecondary, fontSize: 13 }}>{text}</span>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (p) => (
        <Tag
          style={{
            background: p === 'High' ? `${T.danger}20` : `${T.warning}20`,
            color: p === 'High' ? T.danger : T.warning,
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          {p}
        </Tag>
      ),
    },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: T.textPrimary, fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
          Procurement Dashboard
        </h2>
        <p style={{ color: T.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
          Real-time overview of procurement operations
        </p>
      </div>

      {/* ─── Section 1: KPI Strip ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpiData.map((item, idx) => (
          <KPICard key={idx} item={item} />
        ))}
      </div>

      {/* ─── Section 2: Procurement Pipeline ─── */}
      <HoverCard style={{ marginBottom: 24 }}>
        <div style={styles.sectionTitle}>Procurement Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
          {pipelineStages.map((stage, idx) => (
            <React.Fragment key={idx}>
              <PipelineNode stage={stage} nextStage={pipelineStages[idx + 1]} />
              {idx < pipelineStages.length - 1 && <PipelineArrow />}
            </React.Fragment>
          ))}
        </div>
      </HoverCard>

      {/* ─── Section 3 & 4: ASN Tracking + Action Queue ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* ASN Tracking Donut */}
        <HoverCard>
          <div style={styles.sectionTitle}>ASN Tracking Overview</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={asnTrackingData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                stroke="none"
              >
                {asnTrackingData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={40}
                formatter={(value) => <span style={{ color: T.textSecondary, fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div style={{ position: 'relative', marginTop: -180, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.textPrimary }}>89</div>
            <div style={{ fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
          </div>
        </HoverCard>

        {/* Action Queue */}
        <HoverCard>
          <div style={styles.sectionTitle}>Action Queue</div>
          <Table
            dataSource={actionQueueData}
            columns={actionColumns}
            pagination={false}
            size="small"
            showHeader={false}
            style={{ background: 'transparent' }}
            rowClassName={() => 'dark-table-row'}
          />
          <style>{`
            .dark-table-row td { 
              background: transparent !important; 
              border-bottom: 1px solid ${T.border} !important;
              padding: 12px 8px !important;
            }
            .dark-table-row:hover td { 
              background: rgba(59, 130, 246, 0.03) !important; 
            }
            .dark-table-row:last-child td {
              border-bottom: none !important;
            }
          `}</style>
        </HoverCard>
      </div>

      {/* ─── Section 5 & 6: Spend by Category + Top Vendors ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Spend by Category - Horizontal Bar */}
        <HoverCard>
          <div style={styles.sectionTitle}>Spend by Category</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spendByCategoryData} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fill: T.textSecondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip content={<SpendTooltip />} />
              <Bar dataKey="spend" fill={T.primary} radius={[0, 6, 6, 0]} barSize={22}>
                {spendByCategoryData.map((entry, idx) => (
                  <Cell key={idx} fill={idx === 0 ? T.primary : idx < 3 ? '#6366F1' : '#8B5CF6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </HoverCard>

        {/* Top Vendors */}
        <HoverCard>
          <div style={styles.sectionTitle}>Top Vendors by Spend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            {topVendors.map((vendor, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: T.textPrimary, fontSize: 13, fontWeight: 500 }}>{vendor.name}</span>
                  <span style={{ color: T.textSecondary, fontSize: 12 }}>{vendor.spend}</span>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${vendor.pct}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${T.primary}, #6366F1)`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </HoverCard>
      </div>

      {/* ─── Section 7: Recent ASN Activities ─── */}
      <HoverCard>
        <div style={styles.sectionTitle}>Recent ASN Activities</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {recentASNActivities.map((activity, idx) => {
            const dotColor = activity.type === 'success' ? T.success
              : activity.type === 'warning' ? T.warning
              : activity.type === 'danger' ? T.danger
              : T.primary;
            return (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: idx < recentASNActivities.length - 1 ? `1px solid ${T.border}` : 'none',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dotColor,
                  marginTop: 5,
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${dotColor}60`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 400, lineHeight: 1.4 }}>
                    {activity.text}
                  </div>
                  <div style={{ color: T.textSecondary, fontSize: 11, marginTop: 4 }}>
                    {activity.time}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </HoverCard>
    </div>
  );
}
