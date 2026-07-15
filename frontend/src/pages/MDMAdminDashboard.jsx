import React, { useState } from 'react';
import {
  ArrowUpOutlined, ArrowDownOutlined, TeamOutlined, ClockCircleOutlined,
  StopOutlined, StarOutlined, SafetyOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Design Tokens (Light Theme) ───
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
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  orange: '#F97316',
  cardRadius: 12,
  padding: 24,
};

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
  sectionTitle: {
    color: T.textPrimary,
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 16,
    letterSpacing: '-0.3px',
  },
};

function HoverCard({ children, style = {} }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        ...style,
        ...(hovered ? { boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderColor: '#d1d5db' } : {}),
      }}
    >
      {children}
    </div>
  );
}

// ─── KPI Data ───
const kpiData = [
  { label: 'Total Vendors', value: '1,082', trend: '+9.6%', trendUp: true, icon: <TeamOutlined />, color: T.primary },
  { label: 'Pending Approvals', value: '64', trend: '+12.5%', trendUp: true, icon: <ClockCircleOutlined />, color: T.warning },
  { label: 'Blacklisted Vendors', value: '18', trend: '+2.7%', trendUp: true, icon: <StopOutlined />, color: T.danger },
  { label: 'Preferred Vendors', value: '156', trend: '+6.1%', trendUp: true, icon: <StarOutlined />, color: T.success },
  { label: 'Avg Risk Score', value: '38.7', trend: '+3.4%', trendUp: true, icon: <SafetyOutlined />, color: T.warning, badge: 'Medium' },
  { label: 'Compliance Expiry Alerts', value: '27', trend: null, icon: <WarningOutlined />, color: T.orange, badge: 'Urgent', isDanger: true },
];

// ─── Vendor Lifecycle Funnel ───
const funnelData = [
  { stage: 'Draft', count: 162, pct: '11.8%', color: '#6B7280' },
  { stage: 'Submitted', count: 128, pct: '9.4%', color: T.primary },
  { stage: 'Under Review', count: 64, pct: '4.7%', color: T.warning },
  { stage: 'Approved', count: 728, pct: '53.5%', color: T.success },
  { stage: 'Active', count: 612, pct: '44.9%', color: T.success },
  { stage: 'Dormant', count: 32, pct: '2.4%', color: T.purple },
  { stage: 'Blocked', count: 18, pct: '1.3%', color: T.danger },
];

// ─── Risk Score Distribution ───
const riskDistribution = [
  { name: 'Low (0-30)', value: 42.1, color: T.success },
  { name: 'Medium (31-60)', value: 37.5, color: T.warning },
  { name: 'High (61-100)', value: 20.4, color: T.danger },
];

// ─── Top Risky Vendors ───
const riskyVendors = [
  { name: 'Steel Corp Ltd', score: 92, trend: 'Worsening' },
  { name: 'Global Supplies Inc', score: 78, trend: 'Stable' },
  { name: 'BuildWell Pvt Ltd', score: 68, trend: 'Improving' },
  { name: 'Infra Solutions', score: 65, trend: 'Worsening' },
  { name: 'Alpha Traders', score: 62, trend: 'Stable' },
];

// ─── Compliance Expiring ───
const complianceExpiring = [
  { vendor: 'Jay Ambe Pvt Ltd', document: 'ISO 14001', expiry: '05 Jun 2025', daysLeft: 5 },
  { vendor: 'Shree Suppliers', document: 'GST Certificate', expiry: '12 Jun 2025', daysLeft: 12 },
  { vendor: 'Reliable Industries', document: 'MSME Certificate', expiry: '18 Jun 2025', daysLeft: 18 },
];

// ─── Missing Documents ───
const missingDocuments = [
  { vendor: 'Tata Steel', document: 'CIN Certificate', status: 'Missing' },
  { vendor: 'Om Industries', document: 'Bank Proof', status: 'Missing' },
  { vendor: 'Prima Traders', document: 'MSME Certificate', status: 'Missing' },
];

// ─── Recent Activity ───
const recentActivity = [
  { text: 'New vendor "GreenField Pvt Ltd" submitted for approval', time: '2 hours ago', type: 'info' },
  { text: 'Vendor "Steel Corp Ltd" rejected. Reason: Incomplete Documents', time: '5 hours ago', type: 'danger' },
  { text: 'Vendor "BuildWell Pvt Ltd" approved', time: '1 day ago', type: 'success' },
  { text: 'Vendor "Shree Suppliers" updated bank details', time: '1 day ago', type: 'info' },
];

export default function MDMAdminDashboard() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>
          MDM Admin Dashboard
        </h2>
        <p style={{ color: T.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
          Vendor lifecycle, compliance and risk overview
        </p>
      </div>

      {/* ─── KPI Strip ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpiData.map((item, idx) => (
          <HoverCard key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {item.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ color: T.textPrimary, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
                    {item.value}
                  </span>
                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: item.isDanger ? '#FFF7ED' : '#FFFBEB',
                      color: item.isDanger ? T.orange : T.warning,
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.trend && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: T.success, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <ArrowUpOutlined style={{ fontSize: 9 }} />
                      {item.trend}
                    </span>
                    <span style={{ color: T.textSecondary, fontSize: 10 }}>vs Apr 2025</span>
                  </div>
                )}
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${item.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontSize: 15 }}>
                {item.icon}
              </div>
            </div>
          </HoverCard>
        ))}
      </div>

      {/* ─── Vendor Lifecycle Funnel ─── */}
      <HoverCard style={{ marginBottom: 24 }}>
        <div style={styles.sectionTitle}>Vendor Lifecycle Funnel</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {funnelData.map((stage, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{
                background: `${stage.color}08`,
                border: `1px solid ${stage.color}30`,
                borderRadius: 10,
                padding: '14px 8px',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: stage.color }}>{stage.count}</div>
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, fontWeight: 500 }}>
                  {stage.stage}
                </div>
              </div>
              <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 6 }}>{stage.pct}</div>
            </div>
          ))}
        </div>
      </HoverCard>

      {/* ─── Risk Distribution + Top Risky Vendors ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Risk Score Distribution */}
        <HoverCard>
          <div style={styles.sectionTitle}>Risk Score Distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: '55%' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {riskDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>1,082</div>
                <div style={{ fontSize: 10, color: T.textSecondary }}>Total</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {riskDistribution.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                  <span style={{ color: T.textSecondary, fontSize: 12, flex: 1 }}>{item.name}</span>
                  <span style={{ color: T.textPrimary, fontSize: 12, fontWeight: 600 }}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </HoverCard>

        {/* Top Risky Vendors */}
        <HoverCard>
          <div style={styles.sectionTitle}>Top Risky Vendors</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500 }}>Vendor</span>
            <span style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500 }}>Risk Score</span>
            <span style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500 }}>Trend</span>
          </div>
          {riskyVendors.map((vendor, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, padding: '9px 0', borderBottom: idx < riskyVendors.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center' }}>
              <span style={{ color: T.textPrimary, fontSize: 13 }}>{vendor.name}</span>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: vendor.score >= 80 ? T.danger : vendor.score >= 60 ? T.warning : T.success,
              }}>
                {vendor.score}
              </span>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 10,
                background: vendor.trend === 'Worsening' ? '#FEF2F2' : vendor.trend === 'Improving' ? '#ECFDF5' : '#EFF6FF',
                color: vendor.trend === 'Worsening' ? T.danger : vendor.trend === 'Improving' ? T.success : T.primary,
                display: 'inline-block',
                fontWeight: 500,
              }}>
                {vendor.trend}
              </span>
            </div>
          ))}
        </HoverCard>
      </div>

      {/* ─── Compliance + Missing Documents + Recent Activity ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Compliance Expiring */}
        <HoverCard>
          <div style={styles.sectionTitle}>Compliance Expiring Soon (Next 30 Days)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.5fr', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Vendor</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Document</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Expiry Date</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Days Left</span>
          </div>
          {complianceExpiring.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.5fr', gap: 6, padding: '8px 0', borderBottom: idx < complianceExpiring.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center' }}>
              <span style={{ color: T.textPrimary, fontSize: 12 }}>{item.vendor}</span>
              <span style={{ color: T.textSecondary, fontSize: 12 }}>{item.document}</span>
              <span style={{ color: T.textSecondary, fontSize: 11 }}>{item.expiry}</span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: item.daysLeft <= 7 ? T.danger : item.daysLeft <= 14 ? T.warning : T.success,
              }}>
                {item.daysLeft}
              </span>
            </div>
          ))}
        </HoverCard>

        {/* Missing Documents */}
        <HoverCard>
          <div style={styles.sectionTitle}>Missing Documents</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Vendor</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Missing Document</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Status</span>
          </div>
          {missingDocuments.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 6, padding: '10px 0', borderBottom: idx < missingDocuments.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center' }}>
              <span style={{ color: T.textPrimary, fontSize: 12 }}>{item.vendor}</span>
              <span style={{ color: T.textSecondary, fontSize: 12 }}>{item.document}</span>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 10,
                background: '#FEF2F2',
                color: T.danger,
                display: 'inline-block',
                fontWeight: 500,
              }}>
                {item.status}
              </span>
            </div>
          ))}
        </HoverCard>

        {/* Recent Vendor Activity */}
        <HoverCard>
          <div style={styles.sectionTitle}>Recent Vendor Activity</div>
          {recentActivity.map((activity, idx) => {
            const dotColor = activity.type === 'success' ? T.success : activity.type === 'danger' ? T.danger : T.primary;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: idx < recentActivity.length - 1 ? `1px solid ${T.border}` : 'none',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dotColor,
                  marginTop: 5,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.textPrimary, fontSize: 12, lineHeight: 1.4 }}>
                    {activity.text}
                  </div>
                  <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 3 }}>
                    {activity.time}
                  </div>
                </div>
              </div>
            );
          })}
        </HoverCard>
      </div>
    </div>
  );
}
