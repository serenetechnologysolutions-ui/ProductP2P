import React, { useState } from 'react';
import {
  ArrowUpOutlined, FileTextOutlined, TruckOutlined,
  DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
  { label: 'Active POs', value: '12', trend: '+3', icon: <FileTextOutlined />, color: T.primary },
  { label: 'Pending ASNs', value: '5', trend: '+2', icon: <TruckOutlined />, color: T.warning },
  { label: 'Payments Due', value: '₹18.4L', trend: null, icon: <DollarOutlined />, color: T.success },
  { label: 'Delivered', value: '48', trend: '+8', icon: <CheckCircleOutlined />, color: T.success },
  { label: 'Overdue Deliveries', value: '3', trend: null, icon: <ClockCircleOutlined />, color: T.danger, isDanger: true },
  { label: 'Compliance Alerts', value: '2', trend: null, icon: <WarningOutlined />, color: T.orange, isDanger: true },
];

// ─── Recent POs ───
const recentPOs = [
  { poNumber: 'PO-2025-00156', items: 'Steel Plates (500 MT)', amount: '₹12.5L', status: 'open', dueDate: '28 Jun 2025' },
  { poNumber: 'PO-2025-00148', items: 'Polymer Granules (200 KG)', amount: '₹4.8L', status: 'partially_fulfilled', dueDate: '15 Jun 2025' },
  { poNumber: 'PO-2025-00142', items: 'Hydraulic Pumps (25 Units)', amount: '₹8.2L', status: 'open', dueDate: '22 Jun 2025' },
  { poNumber: 'PO-2025-00138', items: 'Copper Wire (1000 M)', amount: '₹3.6L', status: 'fulfilled', dueDate: '05 Jun 2025' },
  { poNumber: 'PO-2025-00131', items: 'Safety Equipment (100 Sets)', amount: '₹2.1L', status: 'fulfilled', dueDate: '01 Jun 2025' },
];

// ─── ASN Status ───
const asnStatus = [
  { asnNumber: 'ASN-2025-0234', po: 'PO-2025-00156', status: 'in_transit', eta: '20 Jun 2025' },
  { asnNumber: 'ASN-2025-0231', po: 'PO-2025-00148', status: 'delivered', eta: '14 Jun 2025' },
  { asnNumber: 'ASN-2025-0228', po: 'PO-2025-00142', status: 'pending_creation', eta: '-' },
];

// ─── Monthly Delivery Chart ───
const deliveryData = [
  { month: 'Jan', onTime: 8, delayed: 1 },
  { month: 'Feb', onTime: 10, delayed: 2 },
  { month: 'Mar', onTime: 12, delayed: 0 },
  { month: 'Apr', onTime: 9, delayed: 3 },
  { month: 'May', onTime: 14, delayed: 1 },
  { month: 'Jun', onTime: 6, delayed: 2 },
];

// ─── Compliance Status ───
const complianceItems = [
  { document: 'GST Certificate', status: 'Valid', expiry: '15 Mar 2026', color: T.success },
  { document: 'ISO 9001', status: 'Valid', expiry: '22 Sep 2025', color: T.success },
  { document: 'MSME Certificate', status: 'Expiring Soon', expiry: '28 Jun 2025', color: T.warning },
  { document: 'Bank Guarantee', status: 'Valid', expiry: '10 Dec 2025', color: T.success },
  { document: 'PAN Verification', status: 'Missing', expiry: '-', color: T.danger },
];

// ─── Payment History ───
const paymentHistory = [
  { invoice: 'INV-2025-0089', amount: '₹4.8L', status: 'Paid', date: '10 Jun 2025' },
  { invoice: 'INV-2025-0082', amount: '₹6.2L', status: 'Paid', date: '28 May 2025' },
  { invoice: 'INV-2025-0078', amount: '₹3.1L', status: 'Pending', date: '18 Jun 2025' },
  { invoice: 'INV-2025-0071', amount: '₹8.5L', status: 'Overdue', date: '05 Jun 2025' },
];

const statusColors = {
  open: { bg: '#EFF6FF', color: T.primary, text: 'Open' },
  partially_fulfilled: { bg: '#FFFBEB', color: T.warning, text: 'Partial' },
  fulfilled: { bg: '#ECFDF5', color: T.success, text: 'Fulfilled' },
  in_transit: { bg: '#EFF6FF', color: T.primary, text: 'In Transit' },
  delivered: { bg: '#ECFDF5', color: T.success, text: 'Delivered' },
  pending_creation: { bg: '#FFFBEB', color: T.warning, text: 'Pending' },
};

export default function VendorDashboard() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 700, margin: 0 }}>
          Vendor Dashboard
        </h2>
        <p style={{ color: T.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
          Your orders, deliveries, payments and compliance at a glance
        </p>
      </div>

      {/* ─── KPI Strip ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpiData.map((item, idx) => (
          <HoverCard key={idx} style={{ borderTop: item.isDanger ? `3px solid ${item.color}` : '3px solid transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {item.label}
                </div>
                <div style={{ color: item.isDanger ? item.color : T.textPrimary, fontSize: 26, fontWeight: 700, marginTop: 6, lineHeight: 1.1 }}>
                  {item.value}
                </div>
                {item.trend && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: T.success, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <ArrowUpOutlined style={{ fontSize: 9 }} />
                      {item.trend} this month
                    </span>
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

      {/* ─── Recent POs + ASN Status ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Recent Purchase Orders */}
        <HoverCard>
          <div style={styles.sectionTitle}>Recent Purchase Orders</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>PO Number</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Items</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Amount</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Status</span>
            <span style={{ color: T.textSecondary, fontSize: 10, fontWeight: 500 }}>Due Date</span>
          </div>
          {recentPOs.map((po, idx) => {
            const st = statusColors[po.status] || statusColors.open;
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 8, padding: '9px 0', borderBottom: idx < recentPOs.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center' }}>
                <span style={{ color: T.primary, fontSize: 12, fontWeight: 500 }}>{po.poNumber}</span>
                <span style={{ color: T.textPrimary, fontSize: 12 }}>{po.items}</span>
                <span style={{ color: T.textPrimary, fontSize: 12, fontWeight: 600 }}>{po.amount}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600, display: 'inline-block' }}>{st.text}</span>
                <span style={{ color: T.textSecondary, fontSize: 11 }}>{po.dueDate}</span>
              </div>
            );
          })}
        </HoverCard>

        {/* ASN Status */}
        <HoverCard>
          <div style={styles.sectionTitle}>ASN Status</div>
          {asnStatus.map((asn, idx) => {
            const st = statusColors[asn.status] || statusColors.pending_creation;
            return (
              <div key={idx} style={{ padding: '14px 0', borderBottom: idx < asnStatus.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ color: T.primary, fontSize: 13, fontWeight: 500 }}>{asn.asnNumber}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{st.text}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: T.textSecondary, fontSize: 11 }}>Against: {asn.po}</span>
                  <span style={{ color: T.textSecondary, fontSize: 11 }}>ETA: {asn.eta}</span>
                </div>
              </div>
            );
          })}
        </HoverCard>
      </div>

      {/* ─── Delivery Performance + Compliance + Payments ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Delivery Performance */}
        <HoverCard>
          <div style={styles.sectionTitle}>Delivery Performance</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deliveryData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="onTime" stackId="a" fill={T.success} name="On Time" />
              <Bar dataKey="delayed" stackId="a" fill={T.danger} radius={[4, 4, 0, 0]} name="Delayed" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: T.success }} />
              <span style={{ color: T.textSecondary, fontSize: 11 }}>On Time</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: T.danger }} />
              <span style={{ color: T.textSecondary, fontSize: 11 }}>Delayed</span>
            </div>
          </div>
        </HoverCard>

        {/* Compliance Status */}
        <HoverCard>
          <div style={styles.sectionTitle}>Compliance Status</div>
          {complianceItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: idx < complianceItems.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div>
                <div style={{ color: T.textPrimary, fontSize: 13 }}>{item.document}</div>
                <div style={{ color: T.textSecondary, fontSize: 11, marginTop: 2 }}>Expires: {item.expiry}</div>
              </div>
              <span style={{
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 10,
                background: item.color === T.success ? '#ECFDF5' : item.color === T.warning ? '#FFFBEB' : '#FEF2F2',
                color: item.color,
                fontWeight: 600,
              }}>
                {item.status}
              </span>
            </div>
          ))}
        </HoverCard>

        {/* Payment History */}
        <HoverCard>
          <div style={styles.sectionTitle}>Payment History</div>
          {paymentHistory.map((payment, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: idx < paymentHistory.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div>
                <div style={{ color: T.primary, fontSize: 12, fontWeight: 500 }}>{payment.invoice}</div>
                <div style={{ color: T.textSecondary, fontSize: 11, marginTop: 2 }}>{payment.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600 }}>{payment.amount}</div>
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: payment.status === 'Paid' ? '#ECFDF5' : payment.status === 'Pending' ? '#FFFBEB' : '#FEF2F2',
                  color: payment.status === 'Paid' ? T.success : payment.status === 'Pending' ? T.warning : T.danger,
                  fontWeight: 600,
                }}>
                  {payment.status}
                </span>
              </div>
            </div>
          ))}
        </HoverCard>
      </div>
    </div>
  );
}
