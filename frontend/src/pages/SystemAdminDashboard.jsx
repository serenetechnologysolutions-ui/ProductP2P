import React, { useState, useEffect } from 'react';
import {
  ArrowUpOutlined, ArrowDownOutlined, UserOutlined, ThunderboltOutlined,
  TeamOutlined, SwapOutlined, ApiOutlined, BugOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
  { label: 'Total Users', value: '1,248', trend: '+12.5%', trendUp: true, icon: <UserOutlined />, color: T.primary },
  { label: 'Active Sessions (Live)', value: '156', trend: '+8.3%', trendUp: true, icon: <ThunderboltOutlined />, color: T.success },
  { label: 'Vendors Onboarded', value: '342', trend: '+18.7%', trendUp: true, icon: <TeamOutlined />, color: T.purple },
  { label: 'Transactions (PO + ASN)', value: '2,589', trend: '+15.2%', trendUp: true, icon: <SwapOutlined />, color: T.primary },
  { label: 'API Requests (per min)', value: '512', trend: '+6.1%', trendUp: true, icon: <ApiOutlined />, color: T.cyan },
  { label: 'Error Rate', value: '0.32%', trend: '+0.08%', trendUp: false, icon: <BugOutlined />, color: T.danger },
];

// ─── System Health Chart Data ───
const responseTimeData = [
  { date: '01 May', time: 120 },
  { date: '08 May', time: 145 },
  { date: '15 May', time: 130 },
  { date: '22 May', time: 160 },
  { date: '29 May', time: 138 },
];

const topSlowEndpoints = [
  { endpoint: '/api/rfq/comparison', time: '830 ms' },
  { endpoint: '/api/asn/validate', time: '560 ms' },
  { endpoint: '/api/vendors/import', time: '480 ms' },
  { endpoint: '/api/audit/execution', time: '410 ms' },
];

// ─── Module Usage Data ───
const moduleUsageData = [
  { name: 'Vendors', value: 26.5, color: T.primary },
  { name: 'RFQ / Sourcing', value: 21.3, color: T.purple },
  { name: 'ASN Management', value: 17.8, color: T.success },
  { name: 'Purchase Orders', value: 14.6, color: T.warning },
  { name: 'Audit Management', value: 9.9, color: T.cyan },
  { name: 'Others', value: 9.9, color: '#6B7280' },
];

// ─── Security Data ───
const securityData = {
  failedLogins: { value: 128, trend: '+15.4%' },
  rateViolations: { value: 78, trend: '+7.4%' },
  suspiciousIPs: { value: 36, trend: '+10.9%' },
  dbSize: '2.45 GB',
  avgQueryTime: '32 ms',
  storageUsed: 68,
};

export default function SystemAdminDashboard() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>
          System Admin Dashboard
        </h2>
        <p style={{ color: T.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
          Platform overview, system health and usage insights
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
                <div style={{ color: T.textPrimary, fontSize: 26, fontWeight: 700, marginTop: 6, lineHeight: 1.1 }}>
                  {item.value}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: item.label === 'Error Rate' ? T.danger : T.success, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {item.trendUp ? <ArrowUpOutlined style={{ fontSize: 9 }} /> : <ArrowDownOutlined style={{ fontSize: 9 }} />}
                    {item.trend}
                  </span>
                  <span style={{ color: T.textSecondary, fontSize: 10 }}>vs Apr 2025</span>
                </div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${item.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, fontSize: 15 }}>
                {item.icon}
              </div>
            </div>
          </HoverCard>
        ))}
      </div>

      {/* ─── System Health + Module Usage + Security ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* System Health */}
        <HoverCard>
          <div style={styles.sectionTitle}>System Health</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: T.textSecondary, fontSize: 11, marginBottom: 8 }}>— Response Time (ms)</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fill: T.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textSecondary, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="time" stroke={T.primary} strokeWidth={2} dot={{ r: 3, fill: T.primary }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Top Slow Endpoints</div>
            {topSlowEndpoints.map((ep, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: idx < topSlowEndpoints.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <span style={{ color: T.textPrimary, fontSize: 12 }}>{ep.endpoint}</span>
                <span style={{ color: T.warning, fontSize: 12, fontWeight: 600 }}>{ep.time}</span>
              </div>
            ))}
          </div>
        </HoverCard>

        {/* Module Usage */}
        <HoverCard>
          <div style={styles.sectionTitle}>Module Usage (Sessions)</div>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={moduleUsageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {moduleUsageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Usage']} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>12,846</div>
              <div style={{ fontSize: 10, color: T.textSecondary }}>Total</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {moduleUsageData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                <span style={{ color: T.textSecondary, fontSize: 10 }}>{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </HoverCard>

        {/* Security Overview */}
        <HoverCard>
          <div style={styles.sectionTitle}>Security Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: '12px 8px', background: '#FEF2F2', borderRadius: 8 }}>
              <div style={{ color: T.danger, fontSize: 20, fontWeight: 700 }}>{securityData.failedLogins.value}</div>
              <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 4 }}>Failed Logins</div>
              <div style={{ fontSize: 10, color: T.danger, marginTop: 2 }}>↑ 15.4%</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 8px', background: '#FFFBEB', borderRadius: 8 }}>
              <div style={{ color: T.warning, fontSize: 20, fontWeight: 700 }}>{securityData.rateViolations.value}</div>
              <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 4 }}>Rate Limit Violations</div>
              <div style={{ fontSize: 10, color: T.warning, marginTop: 2 }}>↑ 7.4%</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 8px', background: '#F5F3FF', borderRadius: 8 }}>
              <div style={{ color: T.purple, fontSize: 20, fontWeight: 700 }}>{securityData.suspiciousIPs.value}</div>
              <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 4 }}>Suspicious IPs</div>
              <div style={{ fontSize: 10, color: T.purple, marginTop: 2 }}>↑ 10.9%</div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
            <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 500, marginBottom: 12 }}>Database & Infrastructure</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ color: T.textSecondary, fontSize: 10 }}>Database Size</div>
                <div style={{ color: T.textPrimary, fontSize: 15, fontWeight: 600 }}>{securityData.dbSize}</div>
                <div style={{ fontSize: 10, color: T.success }}>↑ 6.2%</div>
              </div>
              <div>
                <div style={{ color: T.textSecondary, fontSize: 10 }}>Avg. Query Time</div>
                <div style={{ color: T.textPrimary, fontSize: 15, fontWeight: 600 }}>{securityData.avgQueryTime}</div>
                <div style={{ fontSize: 10, color: T.success }}>↓ 5.2%</div>
              </div>
              <div>
                <div style={{ color: T.textSecondary, fontSize: 10 }}>Storage Used</div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ background: '#E5E7EB', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${securityData.storageUsed}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${T.primary}, ${T.purple})` }} />
                  </div>
                  <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 4 }}>{securityData.storageUsed}%</div>
                </div>
              </div>
            </div>
          </div>
        </HoverCard>
      </div>
    </div>
  );
}
