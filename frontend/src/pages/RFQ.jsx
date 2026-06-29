import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Table, Button, Tag, Space, Card, Typography, Row, Col, Tabs,
  Form, Input, InputNumber, DatePicker, Select, Divider, Popconfirm,
  message, Tooltip, Badge, Statistic, Alert, Radio, Empty, Upload, Checkbox,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SendOutlined, TrophyOutlined,
  FileTextOutlined, TeamOutlined, BarChartOutlined, CheckCircleOutlined,
  DeleteOutlined, EditOutlined, UploadOutlined, PaperClipOutlined, ReloadOutlined, HistoryOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import { API_BASE_URL } from '../config';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import SmartAssistantPanel from '../components/SmartAssistantPanel';
import DecisionPanel from '../components/DecisionPanel';
import VendorSuggestionPanel from '../components/VendorSuggestionPanel';
import PageHeader from '../components/ui/PageHeader';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import CompanySelector from '../components/CompanySelector';
import InactiveCompanyBadge from '../components/InactiveCompanyBadge';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const UPLOAD_BASE = `${API_BASE_URL}/`;

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR = { draft: 'default', published: 'blue', negotiation: 'purple', closed: 'orange', awarded: 'green' };
const PARTICIPATION_COLOR = { invited: 'default', submitted: 'green', not_responded: 'red' };

function StatusTag({ status }) {
  return <Tag color={STATUS_COLOR[status] || 'default'}>{(status || '').toUpperCase()}</Tag>;
}

function AttachmentLink({ path, name }) {
  if (!path) return <Text type="secondary">—</Text>;
  return (
    <a href={`${UPLOAD_BASE}${path}`} target="_blank" rel="noopener noreferrer">
      <PaperClipOutlined /> {name || 'View attachment'}
    </a>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e8e8e8', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' };

// ═══════════════════════════════════════════════════════════════════════════
// Tab components — defined OUTSIDE the page component so they keep a stable
// identity across re-renders. Defining them inline inside RFQ() caused every
// keystroke in a controlled input (My Bid, Award) to remount the whole tab
// and drop focus after a single character.
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ rfq, rfqDetail, isVendor, isDraft, isPublished, isClosed, isAwarded, isNegotiating, handlePublish, handleClose, onOpenNegotiate }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {!isVendor && <SmartAssistantPanel entityType="rfq" entityId={rfq?.id} />}

      <Row gutter={[16, 16]}>
        <Col span={6}><Statistic title="RFQ Number" value={rfq?.rfq_number} /></Col>
        <Col span={6}><Statistic title="Status" valueRender={() => <StatusTag status={rfq?.status} />} /></Col>
        <Col span={6}><Statistic title="Deadline" value={rfq?.submission_deadline ? dayjs(rfq.submission_deadline).format('DD MMM YYYY HH:mm') : '—'} /></Col>
        <Col span={6}><Statistic title="Negotiation Round" value={rfq?.current_round ?? 1} /></Col>
        {!isVendor && <Col span={6}><Statistic title="Vendors Invited" value={rfqDetail?.vendors?.length ?? '—'} /></Col>}
      </Row>

      {isNegotiating && (
        <Alert
          type="warning" showIcon
          message={`Negotiation round ${rfq?.current_round} in progress`}
          description="Invited vendors can submit revised bids until the new deadline. Close the RFQ again once ready to finalize this round."
        />
      )}

      {rfq?.pr_number && (
        <Card title={<Space><Tag color="purple">Source PR: {rfq.pr_number}</Tag></Space>} size="small">
          <Row gutter={[16, 8]}>
            <Col span={6}><Text type="secondary">Department</Text><br /><Text strong>{rfq.pr_department || '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Priority</Text><br /><Text strong>{rfq.pr_priority || '—'}</Text></Col>
            <Col span={6}><Text type="secondary">Required Date</Text><br /><Text strong>{rfq.pr_required_date ? dayjs(rfq.pr_required_date).format('DD MMM YYYY') : '—'}</Text></Col>
            <Col span={24}><Text type="secondary">Justification</Text><br /><Text>{rfq.pr_justification || '—'}</Text></Col>
          </Row>
        </Card>
      )}

      <Card title="Description" size="small">
        <Text>{rfq?.description || <Text type="secondary">No description provided.</Text>}</Text>
      </Card>

      {!isVendor && rfqDetail?.vendors && (
        <Card title="Invited Vendors" size="small">
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={rfqDetail.vendors}
            columns={[
              { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
              { title: 'Company', dataIndex: 'company_name', key: 'company_name' },
              { title: 'Status', dataIndex: 'participation_status', key: 'participation_status', render: s => <Tag color={PARTICIPATION_COLOR[s]}>{(s || '').replace('_', ' ').toUpperCase()}</Tag> },
            ]}
          />
        </Card>
      )}

      {!isVendor && (
        <Space wrap>
          {isDraft && <Button type="primary" onClick={handlePublish}>Publish RFQ</Button>}
          {isPublished && (
            <Popconfirm title="Close RFQ?" description="No more bids can be submitted after closing. Proceed?" okText="Close RFQ" okButtonProps={{ danger: true }} onConfirm={handleClose}>
              <Button danger>Close RFQ</Button>
            </Popconfirm>
          )}
          {isClosed && !isAwarded && (
            <>
              <Alert type="info" showIcon message="RFQ is closed. Go to Comparison tab to evaluate bids, then Award — or start another negotiation round." />
              <Button icon={<ReloadOutlined />} onClick={onOpenNegotiate}>Start New Round</Button>
            </>
          )}
          {isAwarded && <Alert type="success" showIcon message="RFQ awarded. Purchase Orders have been generated." />}
        </Space>
      )}
    </Space>
  );
}

function LineItemsTab({ lineItems, cityOptions }) {
  const cityName = (id) => (cityOptions || []).find(c => c.id === id)?.name;
  return (
    <Table
      size="middle"
      pagination={false}
      rowKey="id"
      dataSource={lineItems || []}
      columns={[
        { title: '#', dataIndex: 'sequence', key: 'seq', width: 50 },
        { title: 'Item Description', dataIndex: 'item_description', key: 'desc' },
        { title: 'Quantity', dataIndex: 'quantity', key: 'qty', width: 100, render: v => Number(v).toLocaleString() },
        { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 80 },
        { title: 'Target Price', dataIndex: 'target_price', key: 'target', width: 130, render: v => v ? `₹ ${Number(v).toLocaleString()}` : <Text type="secondary">—</Text> },
        { title: 'Delivery Location', dataIndex: 'delivery_location_id', key: 'delivery_location', width: 140, render: v => v ? (cityName(v) || v) : <Text type="secondary">—</Text> },
        { title: 'Required Delivery Date', dataIndex: 'required_delivery_date', key: 'required_delivery_date', width: 160, render: v => v ? dayjs(v).format('DD MMM YYYY') : <Text type="secondary">—</Text> },
        { title: 'Tech Specs', dataIndex: 'technical_specifications', key: 'tech_specs', render: v => v?.notes || <Text type="secondary">—</Text> },
        { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: v => v || <Text type="secondary">—</Text> },
        { title: 'Attachment', key: 'attachment', width: 160, render: (_, r) => <AttachmentLink path={r.attachment_path} name={r.attachment_name} /> },
      ]}
    />
  );
}

function ResponsesTab({ rfqDetail }) {
  if (!rfqDetail?.bids?.length) return <Empty description="No bids submitted yet" />;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {rfqDetail.bids.map(bid => (
        <Card
          key={bid.id}
          title={<Space><TeamOutlined /><Text strong>{bid.vendor_name}</Text><Tag color={bid.status === 'revised' ? 'orange' : 'green'}>{bid.status.toUpperCase()}</Tag></Space>}
          size="small"
          extra={<Text type="secondary">Submitted: {dayjs(bid.submitted_at).format('DD MMM YYYY HH:mm')}</Text>}
        >
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={bid.bid_items}
            columns={[
              {
                title: 'Item',
                key: 'item',
                render: (_, row) => {
                  const li = rfqDetail.line_items.find(l => l.id === row.rfq_line_item_id);
                  return li?.item_description || '—';
                },
              },
              { title: 'Unit Price', dataIndex: 'unit_price', key: 'price', width: 120, render: v => `₹ ${Number(v).toLocaleString()}` },
              { title: 'Lead Time (days)', dataIndex: 'lead_time_days', key: 'lead', width: 140, render: v => v || '—' },
              { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: v => v || '—' },
              { title: 'Attachment', key: 'attachment', width: 160, render: (_, r) => <AttachmentLink path={r.attachment_path} name={r.attachment_name} /> },
            ]}
          />
          {bid.remarks && <div style={{ marginTop: 8 }}><Text type="secondary">Bid remarks: </Text><Text>{bid.remarks}</Text></div>}
          <Space size="large" wrap style={{ marginTop: 8 }}>
            <Text><Text strong>Total Bid Value: </Text>₹ {Number(bid.total_value).toLocaleString()}</Text>
            {bid.tco_value != null && <Text><Text strong>TCO Value: </Text>₹ {Number(bid.tco_value).toLocaleString()}</Text>}
            {bid.offered_payment_terms && <Text><Text strong>Payment Terms: </Text>{bid.offered_payment_terms}</Text>}
            {bid.warranty_period && <Text><Text strong>Warranty: </Text>{bid.warranty_period}</Text>}
            {!!bid.taxes_included_flag && <Tag color="blue">Taxes Included</Tag>}
            {!!bid.deviation_flag && <Tag color="orange">Has Deviations</Tag>}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

// Multi-Round Negotiation — every prior round's bids persist permanently
// (see migrate-rfq-negotiation.js); this renders each round's bids side by
// side so procurement can see exactly how vendors moved between rounds.
function NegotiationHistoryTab({ history, loading }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading negotiation history…</div>;
  if (!history) return <Empty description="No negotiation history yet" />;

  const roundNumbers = Object.keys(history.rounds || {}).map(Number).sort((a, b) => a - b);
  if (roundNumbers.length === 0) return <Empty description="No bids submitted in any round yet" />;

  // Cross-round comparison: every vendor who bid in any round, with their
  // total value per round, so a price trend across negotiation is visible at a glance.
  const vendorIds = [...new Set(roundNumbers.flatMap(r => (history.rounds[r] || []).map(b => b.vendor_id)))];
  const vendorNames = {};
  roundNumbers.forEach(r => (history.rounds[r] || []).forEach(b => { vendorNames[b.vendor_id] = b.vendor_name; }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {roundNumbers.length > 1 && (
        <Card title="Cross-Round Bid Comparison" size="small">
          <Table
            size="small" pagination={false} rowKey="vendor_id"
            dataSource={vendorIds.map(vendor_id => ({ vendor_id, vendor_name: vendorNames[vendor_id] }))}
            columns={[
              { title: 'Vendor', dataIndex: 'vendor_name' },
              ...roundNumbers.map(r => ({
                title: `Round ${r}${r === history.current_round ? ' (current)' : ''}`,
                key: `round_${r}`,
                render: (_, row) => {
                  const bid = (history.rounds[r] || []).find(b => b.vendor_id === row.vendor_id);
                  return bid ? `₹ ${Number(bid.total_value).toLocaleString()}` : <Text type="secondary">No bid</Text>;
                },
              })),
            ]}
          />
        </Card>
      )}

      {roundNumbers.slice().reverse().map(r => (
        <Card key={r} title={<Space><HistoryOutlined /><Text strong>Round {r}</Text>{r === history.current_round && <Tag color="purple">CURRENT</Tag>}</Space>} size="small">
          <Table
            size="small" pagination={false} rowKey="id"
            dataSource={history.rounds[r] || []}
            columns={[
              { title: 'Vendor', dataIndex: 'vendor_name' },
              { title: 'Total Value', dataIndex: 'total_value', render: v => `₹ ${Number(v).toLocaleString()}` },
              { title: 'TCO Value', dataIndex: 'tco_value', render: v => v != null ? `₹ ${Number(v).toLocaleString()}` : <Text type="secondary">—</Text> },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'revised' ? 'orange' : 'green'}>{v?.toUpperCase()}</Tag> },
              { title: 'Submitted', dataIndex: 'submitted_at', render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—' },
            ]}
          />
        </Card>
      ))}
    </Space>
  );
}

function ComparisonTab({ comparison, compLoading, scoringConfig, setScoringConfig, savingScoringConfig, handleSaveScoringConfig }) {
  if (compLoading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading comparison…</div>;
  if (!comparison) return <Empty description="Comparison data unavailable" />;

  const { line_items, bids, benchmarks, risk_scores, tco_ranking } = comparison;

  if (!bids.length) return <Empty description="No bids submitted yet — comparison will appear once vendors respond" />;

  // Build bid matrix: bidMatrix[lineItemId][vendorId] = unit_price
  const bidMatrix = {};
  bids.forEach(bid => {
    bid.bid_items.forEach(bi => {
      if (!bidMatrix[bi.rfq_line_item_id]) bidMatrix[bi.rfq_line_item_id] = {};
      bidMatrix[bi.rfq_line_item_id][bid.vendor_id] = { unit_price: bi.unit_price, lead_time_days: bi.lead_time_days, should_cost_comparison: bi.should_cost_comparison };
    });
  });

  // Per-item lowest and highest price
  const itemMinMax = {};
  line_items.forEach(li => {
    const prices = bids.map(b => {
      const bi = bidMatrix[li.id]?.[b.vendor_id];
      return bi ? Number(bi.unit_price) : null;
    }).filter(p => p !== null);
    itemMinMax[li.id] = { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null };
  });

  // Vendor scorecards
  const scorecards = bids.map(bid => {
    const risk = risk_scores[bid.vendor_id];
    const deliveryScore = risk ? Math.max(0, 100 - Number(risk.delay_score)) : null;
    const qualityScore = risk ? Math.max(0, 100 - Number(risk.audit_score)) : null;
    const totalBid = bid.bid_items.reduce((sum, bi) => {
      const li = line_items.find(l => l.id === bi.rfq_line_item_id);
      return sum + (Number(bi.unit_price) * (li ? Number(li.quantity) : 1));
    }, 0);
    return { ...bid, deliveryScore, qualityScore, riskScore: risk ? Number(risk.risk_score) : null, riskLevel: risk?.risk_level, totalBid };
  });

  // Lowest TCO vendor (for badge highlight)
  const lowestTcoVendorId = tco_ranking && tco_ranking.length ? tco_ranking[0].vendor_id : null;

  // Price rank (lower total = better score)
  const sortedByBid = [...scorecards].sort((a, b) => a.totalBid - b.totalBid);
  sortedByBid.forEach((s, i) => { s.priceRank = i + 1; s.priceScore = Math.max(0, 100 - i * (100 / (sortedByBid.length || 1))).toFixed(0); });

  // Weighted final score: price 40%, delivery 35%, quality 25%
  scorecards.forEach(s => {
    if (s.deliveryScore !== null && s.qualityScore !== null) {
      s.finalScore = (Number(s.priceScore) * 0.40 + s.deliveryScore * 0.35 + s.qualityScore * 0.25).toFixed(1);
    } else {
      s.finalScore = s.priceScore;
    }
  });
  const rankedCards = [...scorecards].sort((a, b) => Number(b.finalScore) - Number(a.finalScore));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={24}>

      {/* Price Comparison Table */}
      <Card title="Price Comparison" size="small">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Target Price</th>
                {bids.map(b => <th key={b.vendor_id} style={thStyle}>{b.vendor_name}</th>)}
                <th style={{ ...thStyle, background: '#e6f4ff' }}>Avg Bid</th>
              </tr>
            </thead>
            <tbody>
              {line_items.map(li => {
                const prices = bids.map(b => bidMatrix[li.id]?.[b.vendor_id]?.unit_price).filter(p => p != null).map(Number);
                const avgBid = prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null;
                return (
                  <tr key={li.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}>{li.item_description}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(li.quantity).toLocaleString()} {li.uom}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#8c8c8c' }}>{li.target_price ? `₹ ${Number(li.target_price).toLocaleString()}` : '—'}</td>
                    {bids.map(b => {
                      const bi = bidMatrix[li.id]?.[b.vendor_id];
                      const price = bi ? Number(bi.unit_price) : null;
                      const isLowest = price !== null && price === itemMinMax[li.id].min;
                      const isHighest = price !== null && price === itemMinMax[li.id].max && bids.length > 1;
                      const sc = bi?.should_cost_comparison;
                      const deviationPct = sc?.deviation_pct;
                      const absDeviation = deviationPct != null ? Math.abs(deviationPct) : null;
                      const deviationColor = absDeviation == null ? null : absDeviation <= 5 ? '#52c41a' : absDeviation <= 15 ? '#fa8c16' : '#ff4d4f';
                      return (
                        <td key={b.vendor_id} style={{ ...tdStyle, textAlign: 'right', background: isLowest ? '#f6ffed' : isHighest ? '#fff2f0' : undefined, fontWeight: isLowest ? 600 : undefined, color: isLowest ? '#389e0d' : isHighest ? '#cf1322' : undefined }}>
                          {price != null ? `₹ ${price.toLocaleString()}` : <Text type="secondary">—</Text>}
                          {isLowest && <Tooltip title="Lowest bid"><CheckCircleOutlined style={{ marginLeft: 4, color: '#52c41a' }} /></Tooltip>}
                          {deviationPct != null && (
                            <Tooltip title={`${deviationPct > 0 ? '+' : ''}${deviationPct}% vs should-cost benchmark${sc.status === 'high_deviation' ? ' — high deviation' : ''}`}>
                              <Tag color={deviationColor} style={{ marginLeft: 4, fontSize: 10 }}>
                                {sc.status === 'high_deviation' && <WarningOutlined style={{ marginRight: 2 }} />}
                                {deviationPct > 0 ? '+' : ''}{deviationPct}%
                              </Tag>
                            </Tooltip>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'right', background: '#e6f4ff' }}>{avgBid ? `₹ ${Number(avgBid).toLocaleString()}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                <td style={tdStyle} colSpan={3}>Total Bid Value</td>
                {scorecards.map(s => <td key={s.vendor_id} style={{ ...tdStyle, textAlign: 'right' }}>₹ {Number(s.totalBid).toLocaleString()}</td>)}
                <td style={{ ...tdStyle, background: '#e6f4ff' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Historical Benchmarks */}
      <Card title="Historical Price Benchmarks" size="small">
        <Table
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={line_items}
          columns={[
            { title: 'Item', dataIndex: 'item_description', key: 'desc' },
            { title: 'Avg (Historical)', key: 'avg', render: (_, r) => benchmarks[r.id]?.avg_price ? `₹ ${Number(benchmarks[r.id].avg_price).toLocaleString()}` : <Text type="secondary">No data</Text> },
            { title: 'Min (Historical)', key: 'min', render: (_, r) => benchmarks[r.id]?.min_price ? `₹ ${Number(benchmarks[r.id].min_price).toLocaleString()}` : '—' },
            { title: 'Max (Historical)', key: 'max', render: (_, r) => benchmarks[r.id]?.max_price ? `₹ ${Number(benchmarks[r.id].max_price).toLocaleString()}` : '—' },
            { title: 'Last Purchase Price', key: 'last', render: (_, r) => benchmarks[r.id]?.last_price ? `₹ ${Number(benchmarks[r.id].last_price).toLocaleString()}` : '—' },
          ]}
        />
      </Card>

      {/* Vendor Scorecard */}
      <Card title="Vendor Scorecard & Ranking" size="small">
        <Table
          size="small"
          pagination={false}
          rowKey="vendor_id"
          dataSource={rankedCards}
          columns={[
            { title: 'Rank', key: 'rank', width: 60, render: (_, __, idx) => idx === 0 ? <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} /> : idx + 1 },
            {
              title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor',
              render: (v, s) => (
                <Space>
                  <Text>{v}</Text>
                  {s.vendor_id === lowestTcoVendorId && <Tag color="gold">Lowest TCO</Tag>}
                </Space>
              ),
            },
            { title: 'Total Bid', key: 'total', render: s => `₹ ${Number(s.totalBid).toLocaleString()}` },
            { title: 'TCO Value', key: 'tco', render: s => s.tco_value != null ? `₹ ${Number(s.tco_value).toLocaleString()}` : <Text type="secondary">—</Text> },
            { title: 'Price Score', key: 'price', render: s => <Tag color="blue">{s.priceScore}</Tag> },
            { title: 'Delivery Score', key: 'delivery', render: s => s.deliveryScore != null ? <Tag color={s.deliveryScore >= 70 ? 'green' : 'orange'}>{s.deliveryScore.toFixed(0)}</Tag> : <Tag>N/A</Tag> },
            { title: 'Quality Score', key: 'quality', render: s => s.qualityScore != null ? <Tag color={s.qualityScore >= 70 ? 'green' : 'orange'}>{s.qualityScore.toFixed(0)}</Tag> : <Tag>N/A</Tag> },
            { title: 'Risk Level', key: 'risk', render: s => s.riskLevel ? <Tag color={{ low: 'green', medium: 'orange', high: 'red' }[s.riskLevel]}>{s.riskLevel.toUpperCase()}</Tag> : <Tag>N/A</Tag> },
            { title: 'Final Score', key: 'final', render: s => <Text strong style={{ color: '#1677ff' }}>{s.finalScore}</Text> },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          Final score = Price (40%) + Delivery Performance (35%) + Quality (25%)
        </Text>
      </Card>

      {/* TCO Ranking */}
      {tco_ranking && tco_ranking.length > 0 && (
        <Card title="Total Cost of Ownership (TCO) Ranking" size="small">
          <Table
            size="small"
            pagination={false}
            rowKey="vendor_id"
            dataSource={tco_ranking}
            columns={[
              { title: 'Rank', key: 'rank', width: 60, render: (_, __, idx) => idx === 0 ? <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} /> : idx + 1 },
              { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor' },
              { title: 'TCO Value', key: 'tco', render: r => <Text strong={r.vendor_id === lowestTcoVendorId}>₹ {Number(r.tco_value).toLocaleString()}</Text> },
            ]}
          />
        </Card>
      )}

      {/* Scoring Weight Configuration */}
      {scoringConfig && (
        <Card title="Scoring Weight Configuration" size="small" extra={<Text type="secondary" style={{ fontSize: 11 }}>Used to weight final vendor scores</Text>}>
          <Row gutter={16} align="bottom">
            <Col span={6}>
              <Text type="secondary">Price Weight</Text>
              <InputNumber
                style={{ width: '100%' }}
                min={0} max={1} step={0.05}
                value={scoringConfig.price}
                onChange={v => setScoringConfig(prev => ({ ...prev, price: v }))}
              />
            </Col>
            <Col span={6}>
              <Text type="secondary">Lead Time Weight</Text>
              <InputNumber
                style={{ width: '100%' }}
                min={0} max={1} step={0.05}
                value={scoringConfig.lead_time}
                onChange={v => setScoringConfig(prev => ({ ...prev, lead_time: v }))}
              />
            </Col>
            <Col span={6}>
              <Text type="secondary">Risk Score Weight</Text>
              <InputNumber
                style={{ width: '100%' }}
                min={0} max={1} step={0.05}
                value={scoringConfig.risk_score}
                onChange={v => setScoringConfig(prev => ({ ...prev, risk_score: v }))}
              />
            </Col>
            <Col span={6}>
              <Button type="primary" loading={savingScoringConfig} onClick={handleSaveScoringConfig} block>Save Weights</Button>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  );
}

function MyBidTab({ rfq, rfqDetail, isPublished, bidItems, bidRemarks, setBidRemarks, updateBidItem, handleSubmitBid, submittingBid, uploadBidAttachment, bidTerms, setBidTerms, cityOptions, overallBidAttachment, setOverallBidAttachment, uploadingOverallBid, uploadOverallBidAttachment }) {
  const hasBid = !!rfqDetail?.my_bid;
  const canBid = isPublished && new Date(rfq?.submission_deadline) > new Date();
  const cityName = (id) => (cityOptions || []).find(c => c.id === id)?.name;

  if (!canBid && !hasBid) {
    return <Alert type="warning" showIcon message="Bid submission is not available." description={!isPublished ? 'This RFQ is not published yet.' : 'The submission deadline has passed.'} />;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {hasBid && <Alert type="success" showIcon message={`Bid ${rfqDetail.my_bid.status === 'revised' ? 'revised' : 'submitted'}. You can update it until the deadline.`} />}
      {!canBid && hasBid && <Alert type="info" showIcon message="Deadline has passed. Your bid is locked." />}

      <Card title="Your Bid" size="small">
        <Row gutter={12} style={{ marginBottom: 8 }}>
          <Col span={7}><Text type="secondary" strong>Item</Text></Col>
          <Col span={4}><Text type="secondary" strong>Unit Price</Text></Col>
          <Col span={3}><Text type="secondary" strong>Lead Days</Text></Col>
          <Col span={6}><Text type="secondary" strong>Remarks</Text></Col>
          <Col span={4}><Text type="secondary" strong>Attachment</Text></Col>
        </Row>
        {bidItems.map((bi, idx) => (
          <div key={bi.rfq_line_item_id} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
          <Row gutter={12} align="middle">
            <Col span={7}><Text strong>{bi.item_description}</Text><br /><Text type="secondary">{Number(bi.quantity).toLocaleString()} {bi.uom}</Text></Col>
            <Col span={4}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                prefix="₹"
                placeholder="Unit price"
                value={bi.unit_price}
                onChange={v => updateBidItem(idx, 'unit_price', v)}
                disabled={!canBid}
              />
            </Col>
            <Col span={3}>
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                placeholder="Lead days"
                value={bi.lead_time_days}
                onChange={v => updateBidItem(idx, 'lead_time_days', v)}
                disabled={!canBid}
              />
            </Col>
            <Col span={6}>
              <Input
                placeholder="Remarks (optional)"
                value={bi.remarks}
                onChange={e => updateBidItem(idx, 'remarks', e.target.value)}
                disabled={!canBid}
              />
            </Col>
            <Col span={4}>
              {bi.attachment_path ? (
                <Space>
                  <AttachmentLink path={bi.attachment_path} name={bi.attachment_name} />
                  {canBid && <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => updateBidItem(idx, 'attachment_path', null)} />}
                </Space>
              ) : (
                <Upload
                  disabled={!canBid}
                  showUploadList={false}
                  customRequest={({ file, onSuccess, onError }) => uploadBidAttachment(idx, file, onSuccess, onError)}
                >
                  <Button size="small" icon={<UploadOutlined />} disabled={!canBid}>Attach</Button>
                </Upload>
              )}
            </Col>
          </Row>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={24}>
              <Space size="middle" wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Delivery: </Text>
                  {bi.delivery_location_id ? (cityName(bi.delivery_location_id) || bi.delivery_location_id) : '—'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Required by: </Text>
                  {bi.required_delivery_date ? dayjs(bi.required_delivery_date).format('DD MMM YYYY') : '—'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Tech Specs: </Text>
                  {bi.technical_specifications?.notes || '—'}
                </Text>
                {bi.spec_attachment_path && (
                  <Text style={{ fontSize: 12 }}>
                    <Text strong style={{ fontSize: 12 }}>Spec: </Text>
                    <AttachmentLink path={bi.spec_attachment_path} name={bi.spec_attachment_name} />
                  </Text>
                )}
              </Space>
            </Col>
          </Row>
          </div>
        ))}
        <Divider />
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Text type="secondary" strong>Offered Payment Terms</Text>
            <Input
              placeholder="e.g. Net 30"
              value={bidTerms.offered_payment_terms}
              onChange={e => setBidTerms(prev => ({ ...prev, offered_payment_terms: e.target.value }))}
              disabled={!canBid}
            />
          </Col>
          <Col span={6}>
            <Text type="secondary" strong>Warranty Period</Text>
            <Input
              placeholder="e.g. 12 months"
              value={bidTerms.warranty_period}
              onChange={e => setBidTerms(prev => ({ ...prev, warranty_period: e.target.value }))}
              disabled={!canBid}
            />
          </Col>
          <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <Checkbox
              checked={bidTerms.taxes_included_flag}
              onChange={e => setBidTerms(prev => ({ ...prev, taxes_included_flag: e.target.checked }))}
              disabled={!canBid}
            >
              Taxes included in price
            </Checkbox>
          </Col>
          <Col span={6} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
            <Checkbox
              checked={bidTerms.deviation_flag}
              onChange={e => setBidTerms(prev => ({ ...prev, deviation_flag: e.target.checked }))}
              disabled={!canBid}
            >
              I have deviations from RFQ terms
            </Checkbox>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Text type="secondary" strong>Supporting Documents (overall — e.g. covering quotation)</Text><br />
            {overallBidAttachment.path ? (
              <Space>
                <AttachmentLink path={overallBidAttachment.path} name={overallBidAttachment.name} />
                {canBid && <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setOverallBidAttachment({ path: null, name: null })} />}
              </Space>
            ) : (
              <Upload disabled={!canBid} showUploadList={false} customRequest={({ file, onSuccess, onError }) => uploadOverallBidAttachment(file, onSuccess, onError)}>
                <Button size="small" icon={<UploadOutlined />} loading={uploadingOverallBid} disabled={!canBid}>Attach Document</Button>
              </Upload>
            )}
          </Col>
        </Row>
        <Row gutter={12} align="middle">
          <Col span={16}>
            <Input.TextArea
              placeholder="Overall bid remarks (optional)"
              rows={2}
              value={bidRemarks}
              onChange={e => setBidRemarks(e.target.value)}
              disabled={!canBid}
            />
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Total Bid Value: </Text>
              <Text>
                ₹ {bidItems.reduce((sum, bi) => sum + ((Number(bi.unit_price) || 0) * Number(bi.quantity)), 0).toLocaleString()}
              </Text>
            </div>
            {canBid && (
              <Button type="primary" icon={<SendOutlined />} loading={submittingBid} onClick={handleSubmitBid}>
                {hasBid ? 'Update Bid' : 'Submit Bid'}
              </Button>
            )}
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

function AwardTab({ isClosed, isAwarded, bidderVendors, hasBids, awardMode, setAwardMode, singleAwardVendor, setSingleAwardVendor, awardLines, awardItems, addAwardSplit, removeAwardItem, updateAwardItem, handleAward, awarding, rfqId, onCreatePoFromRfq }) {
  if (!isClosed) return <Alert type="info" showIcon message="RFQ must be closed before awarding." />;
  if (isAwarded) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Alert type="success" showIcon message="This RFQ has already been awarded." />
        <Card title="Create Purchase Orders" size="small">
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Generate POs for awarded vendors:</Text>
          {bidderVendors.map(v => (
            <Row key={v.vendor_id} gutter={16} align="middle" style={{ marginBottom: 8 }}>
              <Col flex="auto"><Text strong>{v.vendor_name}</Text></Col>
              <Col><Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => onCreatePoFromRfq(v.vendor_id)}>Create PO</Button></Col>
            </Row>
          ))}
        </Card>
      </Space>
    );
  }
  if (!hasBids) return <Alert type="warning" showIcon message="No bids received. Cannot award." />;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title="Award Decision" size="small">
        <Form layout="vertical">
          <Form.Item label="Award Mode">
            <Radio.Group value={awardMode} onChange={e => setAwardMode(e.target.value)}>
              <Radio value="single">Single Vendor — award all items to one vendor</Radio>
              <Radio value="split">Multi-Vendor Split — assign vendor(s) and quantity per item, can split one line across vendors</Radio>
            </Radio.Group>
          </Form.Item>

          {awardMode === 'single' && (
            <Form.Item label="Select Winning Vendor">
              <Select
                placeholder="Choose vendor"
                value={singleAwardVendor}
                onChange={setSingleAwardVendor}
                style={{ maxWidth: 400 }}
              >
                {bidderVendors.map(v => <Option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Divider orientation="left">Final Quantities & Negotiated Prices</Divider>
          {awardLines.filter(l => l.remaining_to_award > 0).map(line => {
            const rows = awardItems.filter(ai => ai.rfq_line_item_id === line.rfq_line_item_id);
            return (
              <div key={line.rfq_line_item_id} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
                  <Col flex="auto"><Text strong>{line.item_description}</Text></Col>
                  <Col><Text type="secondary">Remaining to award: {line.remaining_to_award.toLocaleString()}</Text></Col>
                  {awardMode === 'split' && (
                    <Col><Button size="small" type="dashed" onClick={() => addAwardSplit(line.rfq_line_item_id)}>+ Split vendor</Button></Col>
                  )}
                </Row>
                {rows.map(ai => (
                  <Row key={ai.id} gutter={12} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={4}>
                      <InputNumber style={{ width: '100%' }} min={0.001} placeholder="Final qty" value={ai.quantity} onChange={v => updateAwardItem(ai.id, 'quantity', v)} />
                    </Col>
                    <Col span={4}>
                      <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="Final price" value={ai.unit_price} onChange={v => updateAwardItem(ai.id, 'unit_price', v)} />
                    </Col>
                    {awardMode === 'split' && (
                      <Col span={10}>
                        <Select
                          style={{ width: '100%' }}
                          placeholder="Select vendor"
                          value={ai.vendor_id || undefined}
                          onChange={v => updateAwardItem(ai.id, 'vendor_id', v)}
                        >
                          {bidderVendors.map(v => <Option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</Option>)}
                        </Select>
                      </Col>
                    )}
                    {awardMode === 'split' && rows.length > 1 && (
                      <Col span={2}><Button icon={<DeleteOutlined />} danger size="small" onClick={() => removeAwardItem(ai.id)} /></Col>
                    )}
                  </Row>
                ))}
              </div>
            );
          })}

          <div style={{ marginTop: 16 }}>
            <Alert
              type="warning"
              showIcon
              message="Awarding will auto-generate Purchase Orders and cannot be undone."
              style={{ marginBottom: 12 }}
            />
            <Button type="primary" icon={<TrophyOutlined />} loading={awarding} onClick={handleAward} size="large">
              Award & Generate Purchase Orders
            </Button>
          </div>
        </Form>
      </Card>
    </Space>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════

export default function RFQ() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const isVendor = user.role === 'vendor';
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');

  const [view, setView] = useState('list'); // list | detail | create
  const [rfqList, setRfqList] = useState([]);
  // Conditional Mandatory Fields: budget_value doubles as this RFQ's
  // "total_value" context — e.g. Description becomes required once budget
  // value exceeds the configured threshold (seeded: > 10L). Omitting context
  // (no budget value entered yet) falls back to the static is_mandatory flag.
  const [createFormBudgetValue, setCreateFormBudgetValue] = useState(null);
  const { isRequired } = useFieldConfig('rfq', createFormBudgetValue != null ? { total_value: createFormBudgetValue } : undefined);
  const { isRequired: isBidFieldRequired } = useFieldConfig('rfq_bid');
  const [loading, setLoading] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Detail state
  const [rfqDetail, setRfqDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  // Bid form
  const [bidItems, setBidItems] = useState([]);
  const [bidRemarks, setBidRemarks] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidTerms, setBidTerms] = useState({ taxes_included_flag: false, offered_payment_terms: '', warranty_period: '', deviation_flag: false });
  const [overallBidAttachment, setOverallBidAttachment] = useState({ path: null, name: null });
  const [uploadingOverallBid, setUploadingOverallBid] = useState(false);

  // Comparison — scoring weight config (admin-editable)
  const [scoringConfig, setScoringConfig] = useState(null);
  const [savingScoringConfig, setSavingScoringConfig] = useState(false);

  // Multi-Round Negotiation
  const [negotiatePanelOpen, setNegotiatePanelOpen] = useState(false);
  const [negotiateVendorIds, setNegotiateVendorIds] = useState([]);
  const [negotiateDeadline, setNegotiateDeadline] = useState(null);
  const [negotiateRemarks, setNegotiateRemarks] = useState('');
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationHistory, setNegotiationHistory] = useState(null);
  const [negotiationHistoryLoading, setNegotiationHistoryLoading] = useState(false);

  // Award form
  const [awardMode, setAwardMode] = useState('single');
  const [singleAwardVendor, setSingleAwardVendor] = useState(null);
  const [awardLines, setAwardLines] = useState([]);
  const [awardItems, setAwardItems] = useState([]);
  const [awarding, setAwarding] = useState(false);

  // Create page
  const [createForm] = Form.useForm();
  // Form.useWatch (not getFieldValue) so anything reading vendor_ids
  // re-renders immediately after a programmatic setFieldsValue call —
  // getFieldValue alone wouldn't trigger a re-render. Must be called
  // unconditionally (Rules of Hooks), even though it's only consumed by the
  // 'create' view below.
  const watchedVendorIds = Form.useWatch('vendor_ids', createForm) || [];
  const [createLineItems, setCreateLineItems] = useState([{ item_master_id: null, item_description: '', quantity: 1, uom: 'Nos', target_price: '', remarks: '', attachment_path: null, attachment_name: null, delivery_location_id: null, required_delivery_date: null, technical_specifications: '' }]);
  const [vendors, setVendors] = useState([]);
  const [itemMasterList, setItemMasterList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingRfqId, setEditingRfqId] = useState(null);
  const [procurementCategories, setProcurementCategories] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [rfqTypeOptions, setRfqTypeOptions] = useState([]);
  const [rfqSelectedCompanyId, setRfqSelectedCompanyId] = useState(null);

  // Create RFQ from PR
  const [prSourceModalOpen, setPrSourceModalOpen] = useState(false);
  const [availablePrs, setAvailablePrs] = useState([]);
  const [sourcePrId, setSourcePrId] = useState(null);
  const [prLineSelections, setPrLineSelections] = useState([]);
  const [prSourceVendorIds, setPrSourceVendorIds] = useState([]);
  const [prSourceDeadline, setPrSourceDeadline] = useState(null);
  const [creatingFromPr, setCreatingFromPr] = useState(false);

  // ── Fetch list ─────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rfq');
      setRfqList(res.data.data);
    } catch { message.error('Failed to load RFQs'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Deep-link support — e.g. the Control Tower / Traceability view's "View
  // Source" action lands here as /rfq?id=<rfq_id> and should jump straight
  // to that record's detail view rather than the list.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) openDetail({ id: deepLinkId });
  }, []);

  // ── Fetch detail ───────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/rfq/${id}`);
      const detail = res.data.data;
      setRfqDetail(detail);

      // Pre-fill bid form from my_bid if vendor has already bid
      if (isVendor && detail.my_bid) {
        setBidItems(
          detail.line_items.map(li => {
            const existing = detail.my_bid.bid_items.find(bi => bi.rfq_line_item_id === li.id);
            return {
              rfq_line_item_id: li.id, item_description: li.item_description, quantity: li.quantity, uom: li.uom,
              delivery_location_id: li.delivery_location_id, required_delivery_date: li.required_delivery_date,
              technical_specifications: li.technical_specifications, spec_attachment_path: li.attachment_path, spec_attachment_name: li.attachment_name,
              unit_price: existing ? existing.unit_price : '', lead_time_days: existing ? existing.lead_time_days : '',
              remarks: existing ? existing.remarks : '',
              attachment_path: existing ? existing.attachment_path : null, attachment_name: existing ? existing.attachment_name : null,
            };
          })
        );
        setBidRemarks(detail.my_bid.remarks || '');
        setBidTerms({
          taxes_included_flag: !!detail.my_bid.taxes_included_flag,
          offered_payment_terms: detail.my_bid.offered_payment_terms || '',
          warranty_period: detail.my_bid.warranty_period || '',
          deviation_flag: !!detail.my_bid.deviation_flag,
        });
        setOverallBidAttachment({ path: detail.my_bid.overall_attachment_path || null, name: detail.my_bid.overall_attachment_name || null });
      } else if (isVendor) {
        setBidItems(detail.line_items.map(li => ({
          rfq_line_item_id: li.id, item_description: li.item_description, quantity: li.quantity, uom: li.uom,
          delivery_location_id: li.delivery_location_id, required_delivery_date: li.required_delivery_date,
          technical_specifications: li.technical_specifications, spec_attachment_path: li.attachment_path, spec_attachment_name: li.attachment_name,
          unit_price: '', lead_time_days: '', remarks: '', attachment_path: null, attachment_name: null,
        })));
        setBidRemarks('');
        setBidTerms({ taxes_included_flag: false, offered_payment_terms: '', warranty_period: '', deviation_flag: false });
        setOverallBidAttachment({ path: null, name: null });
      }

    } catch { message.error('Failed to load RFQ details'); }
    setDetailLoading(false);
  }, [isVendor]);

  // ── Fetch award allocation (remaining-to-award per line) ───────────────────

  const fetchAwardAllocation = useCallback(async (id) => {
    try {
      const res = await api.get(`/rfq/${id}/allocation`);
      const lines = res.data.data.lines || [];
      setAwardLines(lines);
      setAwardItems(
        lines.filter(l => l.remaining_to_award > 0).map(l => ({
          id: `${l.rfq_line_item_id}-0`, rfq_line_item_id: l.rfq_line_item_id, quantity: l.remaining_to_award, unit_price: '', vendor_id: '',
        }))
      );
    } catch { /* non-critical */ }
  }, []);

  // ── Fetch comparison ───────────────────────────────────────────────────────

  const fetchComparison = useCallback(async (id) => {
    setCompLoading(true);
    try {
      const res = await api.get(`/rfq/${id}/comparison`);
      setComparison(res.data.data);
      const existingConfig = res.data.data?.rfq?.scoring_weight_config;
      setScoringConfig(existingConfig || { price: 0.5, lead_time: 0.3, risk_score: 0.2 });
    } catch { message.error('Failed to load comparison data'); }
    setCompLoading(false);
  }, []);

  // ── Fetch vendors / item master for create page ───────────────────────────

  const fetchVendors = useCallback(async () => {
    try {
      // Vendor Segmentation: sort_by_segment surfaces Strategic/Preferred
      // vendors first in the Invite Vendors picker — opt-in param, every
      // other /vendors caller is unaffected and keeps its default ordering.
      const res = await api.get('/vendors?status=approved&limit=1000&sort_by_segment=true');
      setVendors(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchItemMaster = useCallback(async () => {
    try {
      const res = await api.get('/item-master');
      setItemMasterList(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchProcurementCategories = useCallback(async () => {
    try {
      const res = await api.get('/sub-masters/procurement_category');
      setProcurementCategories(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchCities = useCallback(async () => {
    try {
      const res = await api.get('/sub-masters/city');
      setCityOptions(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchRfqTypes = useCallback(async () => {
    try {
      const res = await api.get('/sub-masters/rfq_type');
      setRfqTypeOptions(res.data.data || []);
    } catch { /* non-critical */ }
  }, []);

  // ── Create RFQ from PR ──────────────────────────────────────────────────────

  const openPrSourceModal = async () => {
    setSourcePrId(null);
    setPrLineSelections([]);
    setPrSourceVendorIds([]);
    setPrSourceDeadline(null);
    if (vendors.length === 0) fetchVendors();
    try {
      // Fetch every non-terminal status, not just approved/sourcing, so a PR
      // that's still pending approval (the most common reason it "doesn't show
      // up") is visible in the list — just disabled, with the reason why.
      const statuses = ['draft', 'submitted', 'approved', 'partially_approved', 'sourcing'];
      const results = await Promise.all(statuses.map(status => api.get('/pr', { params: { status } })));
      const prs = results.flatMap(r => r.data.data || []).filter(p => p.sourcing_strategy !== 'CONTRACT_BASED');
      setAvailablePrs(prs);
    } catch { message.error('Failed to load requisitions'); }
    setPrSourceModalOpen(o => !o);
  };

  const prSourceEligible = (p) => ['approved', 'sourcing'].includes(p.status);
  const prSourceStatusReason = (p) => {
    if (p.status === 'draft') return 'not yet submitted';
    if (p.status === 'submitted') return `awaiting approval${p.current_approver_role ? ` (${p.current_approver_role})` : ''}`;
    if (p.status === 'partially_approved') return 'partially approved';
    return null;
  };

  const handleSelectSourcePr = async (prId) => {
    setSourcePrId(prId);
    try {
      const res = await api.get(`/pr/${prId}/allocation`);
      const lines = (res.data.data.lines || []).filter(l => l.remaining_quantity > 0);
      setPrLineSelections(lines.map(l => ({ pr_line_item_id: l.pr_line_item_id, description: l.description, max: l.remaining_quantity, quantity: l.remaining_quantity, selected: true })));
    } catch { message.error('Failed to load requisition lines'); setPrLineSelections([]); }
  };

  const toggleSourcePrLine = (id, checked) => setPrLineSelections(prev => prev.map(l => l.pr_line_item_id === id ? { ...l, selected: checked } : l));
  const updateSourcePrLineQty = (id, qty) => setPrLineSelections(prev => prev.map(l => l.pr_line_item_id === id ? { ...l, quantity: qty } : l));

  const handleCreateRfqFromPr = async () => {
    if (!sourcePrId) { message.error('Select a requisition'); return; }
    if (!prSourceVendorIds.length || !prSourceDeadline) { message.error('Select vendors and a submission deadline'); return; }
    const lines = prLineSelections.filter(l => l.selected && l.quantity > 0).map(l => ({ pr_line_item_id: l.pr_line_item_id, quantity: l.quantity }));
    if (lines.length === 0) { message.error('Select at least one line item'); return; }
    setCreatingFromPr(true);
    try {
      const res = await api.post(`/pr/${sourcePrId}/create-rfq`, {
        vendor_ids: prSourceVendorIds,
        submission_deadline: prSourceDeadline.toISOString(),
        lines,
      });
      message.success(`RFQ ${res.data.data.rfq_number} created`);
      setPrSourceModalOpen(false);
      fetchList();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to create RFQ'); }
    setCreatingFromPr(false);
  };

  // ── Open detail ────────────────────────────────────────────────────────────

  const openDetail = (rfq) => {
    setSelectedRfq(rfq);
    setActiveTab('overview');
    setComparison(null);
    setNegotiationHistory(null);
    setView('detail');
    fetchDetail(rfq.id);
    if (cityOptions.length === 0) fetchCities();
  };

  const handleBack = () => {
    setView('list');
    setSelectedRfq(null);
    setRfqDetail(null);
    setComparison(null);
    setNegotiationHistory(null);
    setScoringConfig(null);
    fetchList();
  };

  // ── Scoring weight config ──────────────────────────────────────────────────

  const handleSaveScoringConfig = async () => {
    if (!selectedRfq || !scoringConfig) return;
    setSavingScoringConfig(true);
    try {
      await api.put(`/rfq/${selectedRfq.id}/scoring-config`, { scoring_weight_config: scoringConfig });
      message.success('Scoring weights updated');
    } catch (e) { message.error(e.response?.data?.error || 'Failed to update scoring weights'); }
    setSavingScoringConfig(false);
  };

  // ── Tab change ─────────────────────────────────────────────────────────────

  const onTabChange = (key) => {
    setActiveTab(key);
    if (key === 'comparison' && !comparison && selectedRfq) {
      fetchComparison(selectedRfq.id);
    }
    if (key === 'award' && selectedRfq) {
      fetchAwardAllocation(selectedRfq.id);
    }
    if (key === 'negotiation-history' && !negotiationHistory && selectedRfq) {
      fetchNegotiationHistory();
    }
  };

  // ── Status actions ─────────────────────────────────────────────────────────

  const handlePublish = async () => {
    try {
      await api.put(`/rfq/${selectedRfq.id}/publish`);
      message.success('RFQ published — vendors can now submit bids');
      fetchDetail(selectedRfq.id);
    } catch (e) { message.error(e.response?.data?.message || 'Failed to publish'); }
  };

  const handleClose = async () => {
    try {
      await api.put(`/rfq/${selectedRfq.id}/close`);
      message.success('RFQ closed');
      fetchDetail(selectedRfq.id);
    } catch (e) { message.error(e.response?.data?.message || 'Failed to close'); }
  };

  // ── Multi-Round Negotiation ──────────────────────────────────────────────

  const openNegotiatePanel = () => {
    if (vendors.length === 0) fetchVendors();
    setNegotiateVendorIds(bidderVendors.map(v => v.vendor_id));
    setNegotiateDeadline(null);
    setNegotiateRemarks('');
    setNegotiatePanelOpen(true);
  };

  const handleStartNegotiation = async () => {
    if (!negotiateDeadline) { message.error('Select a new submission deadline'); return; }
    if (negotiateVendorIds.length === 0) { message.error('Select at least one vendor to invite to this round'); return; }
    setNegotiating(true);
    try {
      const res = await api.post(`/rfq/${selectedRfq.id}/negotiate`, {
        vendor_ids: negotiateVendorIds,
        submission_deadline: negotiateDeadline.toISOString(),
        remarks: negotiateRemarks || undefined,
      });
      message.success(`Negotiation round ${res.data.data.round_number} opened — ${res.data.data.invited_vendor_count} vendor(s) invited`);
      setNegotiatePanelOpen(false);
      setNegotiationHistory(null);
      fetchDetail(selectedRfq.id);
    } catch (e) { message.error(e.response?.data?.error || 'Failed to start negotiation round'); }
    setNegotiating(false);
  };

  const fetchNegotiationHistory = async () => {
    setNegotiationHistoryLoading(true);
    try {
      const res = await api.get(`/rfq/${selectedRfq.id}/negotiation-history`);
      setNegotiationHistory(res.data.data);
    } catch { message.error('Failed to load negotiation history'); }
    setNegotiationHistoryLoading(false);
  };

  // ── Bid submission ─────────────────────────────────────────────────────────

  const handleSubmitBid = async () => {
    for (const bi of bidItems) {
      if (bi.unit_price === '' || bi.unit_price == null) {
        message.error(`Enter unit price for: ${bi.item_description}`);
        return;
      }
    }
    if (isBidFieldRequired('offered_payment_terms', false) && !bidTerms.offered_payment_terms?.trim()) {
      message.error('Offered Payment Terms is required'); return;
    }
    if (isBidFieldRequired('warranty_period', false) && !bidTerms.warranty_period?.trim()) {
      message.error('Warranty Period is required'); return;
    }
    if (isBidFieldRequired('bid_remarks', false) && !bidRemarks?.trim()) {
      message.error('Overall Bid Remarks is required'); return;
    }
    setSubmittingBid(true);
    try {
      await api.post(`/rfq/${selectedRfq.id}/bids`, {
        bid_items: bidItems.map(bi => ({
          rfq_line_item_id: bi.rfq_line_item_id,
          unit_price: bi.unit_price,
          lead_time_days: bi.lead_time_days || null,
          remarks: bi.remarks || null,
          attachment_path: bi.attachment_path || null,
          attachment_name: bi.attachment_name || null,
        })),
        remarks: bidRemarks || null,
        taxes_included_flag: bidTerms.taxes_included_flag,
        offered_payment_terms: bidTerms.offered_payment_terms || null,
        warranty_period: bidTerms.warranty_period || null,
        deviation_flag: bidTerms.deviation_flag,
        overall_attachment_path: overallBidAttachment.path || null,
        overall_attachment_name: overallBidAttachment.name || null,
      });
      message.success('Bid submitted successfully');
      fetchDetail(selectedRfq.id);
    } catch (e) { message.error(e.response?.data?.message || 'Failed to submit bid'); }
    setSubmittingBid(false);
  };

  const updateBidItem = (idx, field, value) => {
    setBidItems(prev => prev.map((bi, i) => i === idx ? { ...bi, [field]: value } : bi));
  };

  const uploadBidAttachment = async (idx, file, onSuccess, onError) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/file', formData);
      updateBidItem(idx, 'attachment_path', res.data.data.file_path);
      updateBidItem(idx, 'attachment_name', res.data.data.file_name);
      message.success('Attachment uploaded');
      onSuccess(res.data);
    } catch (err) {
      message.error('Attachment upload failed');
      onError(err);
    }
  };

  // Overall (bid-level, not per-line) supporting document — e.g. a covering quotation PDF.
  const uploadOverallBidAttachment = async (file, onSuccess, onError) => {
    setUploadingOverallBid(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/file', formData);
      setOverallBidAttachment({ path: res.data.data.file_path, name: res.data.data.file_name });
      message.success('Attachment uploaded');
      onSuccess(res.data);
    } catch (err) {
      message.error('Attachment upload failed');
      onError(err);
    }
    setUploadingOverallBid(false);
  };

  // ── Award ──────────────────────────────────────────────────────────────────

  const handleAward = async () => {
    let payload;
    if (awardMode === 'single') {
      if (!singleAwardVendor) { message.error('Select a vendor to award'); return; }
      payload = awardItems.map(ai => ({
        rfq_line_item_id: ai.rfq_line_item_id,
        vendor_id: singleAwardVendor,
        unit_price: ai.unit_price,
        quantity: ai.quantity,
      }));
    } else {
      payload = awardItems.map(ai => ({
        rfq_line_item_id: ai.rfq_line_item_id,
        vendor_id: ai.vendor_id,
        unit_price: ai.unit_price,
        quantity: ai.quantity,
      }));
    }

    for (const ai of payload) {
      if (!ai.quantity || ai.quantity <= 0) { message.error('Enter a quantity greater than zero for each award row'); return; }
      if (!ai.vendor_id) { message.error('Assign a vendor for each award row'); return; }
      if (!ai.unit_price) { message.error('Enter final price for each award row'); return; }
    }

    setAwarding(true);
    try {
      const res = await api.post(`/rfq/${selectedRfq.id}/award`, { award_items: payload });
      const pos = res.data.data.purchase_orders;
      message.success(`Awarded! ${pos.length} PO(s) generated: ${pos.map(p => p.po_number).join(', ')}`);
      fetchDetail(selectedRfq.id);
      setActiveTab('overview');
    } catch (e) { message.error(e.response?.data?.message || 'Award failed'); }
    setAwarding(false);
  };

  const updateAwardItem = (rowId, field, value) => {
    setAwardItems(prev => prev.map(ai => ai.id === rowId ? { ...ai, [field]: value } : ai));
  };

  const handleCreatePoFromRfq = async (vendorId) => {
    try {
      const res = await api.post(`/rfqs/${selectedRfq.id}/create-po`, { vendor_id: vendorId });
      const poId = res.data.data?.po_id || res.data.data?.id;
      const poNumber = res.data.data?.po_number || 'PO';
      message.success(`PO ${poNumber} created successfully`);
      if (poId) {
        window.location.href = `/purchase-orders?id=${poId}`;
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.message || 'Failed to create PO from RFQ');
    }
  };

  // Splits a line across an additional vendor — only meaningful in 'split'
  // mode, where each row gets its own vendor + quantity.
  const addAwardSplit = (rfqLineItemId) => {
    setAwardItems(prev => [...prev, { id: `${rfqLineItemId}-${Date.now()}`, rfq_line_item_id: rfqLineItemId, quantity: '', unit_price: '', vendor_id: '' }]);
  };

  const removeAwardItem = (rowId) => setAwardItems(prev => prev.filter(ai => ai.id !== rowId));

  // ── Create RFQ (full page, no popup) ───────────────────────────────────────

  const openCreatePage = () => {
    setEditingRfqId(null);
    fetchVendors();
    fetchItemMaster();
    fetchProcurementCategories();
    fetchRfqTypes();
    fetchCities();
    setCreateLineItems([{ item_master_id: null, item_description: '', quantity: 1, uom: 'Nos', target_price: '', remarks: '', attachment_path: null, attachment_name: null, delivery_location_id: null, required_delivery_date: null, technical_specifications: '' }]);
    createForm.resetFields();
    setRfqSelectedCompanyId(null);
    setView('create');
  };

  // Edit is allowed at any RFQ status — line items carry their existing id so
  // the PUT can update them in place (preserving bids/award links) instead of
  // recreating them.
  const openEditRfqPage = (rfqToEdit, detail) => {
    setEditingRfqId(rfqToEdit.id);
    fetchVendors();
    fetchItemMaster();
    fetchProcurementCategories();
    fetchRfqTypes();
    fetchCities();
    createForm.setFieldsValue({
      title: rfqToEdit.title,
      description: rfqToEdit.description,
      submission_deadline: dayjs(rfqToEdit.submission_deadline),
      rfq_type: rfqToEdit.rfq_type,
      procurement_category_id: rfqToEdit.procurement_category_id || undefined,
      budget_value: rfqToEdit.budget_value || undefined,
      vendor_ids: (detail?.vendors || []).map(v => v.vendor_id),
    });
    setCreateLineItems((detail?.line_items || []).map(li => ({
      id: li.id,
      item_master_id: li.item_master_id || null,
      item_description: li.item_description,
      quantity: li.quantity,
      uom: li.uom,
      target_price: li.target_price || '',
      remarks: li.remarks || '',
      attachment_path: li.attachment_path || null,
      attachment_name: li.attachment_name || null,
      delivery_location_id: li.delivery_location_id || null,
      required_delivery_date: li.required_delivery_date ? dayjs(li.required_delivery_date) : null,
      technical_specifications: li.technical_specifications?.notes || '',
    })));
    setView('create');
  };

  const addCreateLineItem = () => {
    setCreateLineItems(prev => [...prev, { item_master_id: null, item_description: '', quantity: 1, uom: 'Nos', target_price: '', remarks: '', attachment_path: null, attachment_name: null, delivery_location_id: null, required_delivery_date: null, technical_specifications: '' }]);
  };

  const removeCreateLineItem = (idx) => {
    setCreateLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCreateLineItem = (idx, field, value) => {
    setCreateLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const selectCreateLineItemMaster = (idx, itemMasterId) => {
    const item = itemMasterList.find(im => im.id === itemMasterId);
    setCreateLineItems(prev => prev.map((li, i) => i === idx ? {
      ...li,
      item_master_id: itemMasterId,
      item_description: item ? item.item_description : li.item_description,
      uom: item ? item.uom : li.uom,
    } : li));
  };

  const uploadCreateLineItemAttachment = async (idx, file, onSuccess, onError) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/file', formData);
      updateCreateLineItem(idx, 'attachment_path', res.data.data.file_path);
      updateCreateLineItem(idx, 'attachment_name', res.data.data.file_name);
      message.success('Attachment uploaded');
      onSuccess(res.data);
    } catch (err) {
      message.error('Attachment upload failed');
      onError(err);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      if (createLineItems.some(li => !li.item_master_id || !li.quantity)) {
        message.error('Select an item and enter quantity for every line item');
        return;
      }
      setCreating(true);
      const payload = {
        title: values.title,
        description: values.description,
        submission_deadline: values.submission_deadline.toISOString(),
        vendor_ids: values.vendor_ids,
        company_id: rfqSelectedCompanyId || undefined,
        rfq_type: values.rfq_type || 'Limited',
        procurement_category_id: values.procurement_category_id || null,
        budget_value: values.budget_value || null,
        line_items: createLineItems.map(li => ({
          ...li,
          required_delivery_date: li.required_delivery_date ? li.required_delivery_date.format('YYYY-MM-DD') : null,
          technical_specifications: li.technical_specifications ? { notes: li.technical_specifications } : null,
        })),
      };
      if (editingRfqId) {
        await api.put(`/rfq/${editingRfqId}`, payload);
        message.success('RFQ updated');
        setView('detail');
        fetchDetail(editingRfqId);
      } else {
        await api.post('/rfq', payload);
        message.success('RFQ created as draft');
        setView('list');
        fetchList();
      }
    } catch (e) {
      if (e.errorFields) { setCreating(false); return; }
      message.error(e.response?.data?.error || e.response?.data?.message || 'Failed to save RFQ');
    }
    setCreating(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const columns = [
    { title: 'RFQ Number', dataIndex: 'rfq_number', key: 'rfq_number', render: v => <Text strong>{v}</Text>, sorter: (a, b) => String(a.rfq_number || '').localeCompare(String(b.rfq_number || ''), undefined, { numeric: true }) },
    { title: 'Source PR', dataIndex: 'pr_number', key: 'pr_number', width: 110, render: v => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>, sorter: (a, b) => String(a.pr_number || '').localeCompare(String(b.pr_number || ''), undefined, { numeric: true }) },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true, sorter: (a, b) => String(a.title || '').localeCompare(String(b.title || '')) },
    {
      title: 'Status', dataIndex: 'status', key: 'status', render: s => <StatusTag status={s} />, width: 110,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: ['draft', 'published', 'closed', 'negotiation', 'awarded'].map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Deadline',
      dataIndex: 'submission_deadline',
      key: 'deadline',
      width: 140,
      sorter: (a, b) => new Date(a.submission_deadline || 0) - new Date(b.submission_deadline || 0),
      render: d => {
        const dt = dayjs(d);
        const past = dt.isBefore(dayjs());
        return <span style={{ color: past ? '#ff4d4f' : undefined }}>{dt.format('DD MMM YYYY')}</span>;
      },
    },
    { title: 'Items', dataIndex: 'item_count', key: 'item_count', width: 70, sorter: (a, b) => Number(a.item_count || 0) - Number(b.item_count || 0) },
    ...(isVendor ? [{ title: 'My Status', dataIndex: 'participation_status', key: 'participation_status', render: s => <Tag color={PARTICIPATION_COLOR[s]}>{(s || '').replace('_', ' ').toUpperCase()}</Tag> }] : [
      { title: 'Vendors', dataIndex: 'vendor_count', key: 'vendor_count', width: 80, render: v => <Badge count={v} showZero color="blue" />, sorter: (a, b) => Number(a.vendor_count || 0) - Number(b.vendor_count || 0) },
      { title: 'Bids', dataIndex: 'bid_count', key: 'bid_count', width: 70, sorter: (a, b) => Number(a.bid_count || 0) - Number(b.bid_count || 0) },
    ]),
    {
      title: 'Company', dataIndex: 'company_name', key: 'company_name', width: 130, ellipsis: true,
      render: (v, row) => (
        <Space size={4}>
          {v || <Text type="secondary">—</Text>}
          <InactiveCompanyBadge show={row.company_is_active === false} />
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, row) => <Button type="link" size="small" onClick={() => openDetail(row)}>View →</Button>,
    },
  ];

  if (view === 'list') {
    const rfqListActions = !isVendor && (
      <Space>
        <Button icon={<FileTextOutlined />} onClick={openPrSourceModal}>Create RFQ from PR</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePage}>Create RFQ</Button>
      </Space>
    );
    return (
      <div style={{ padding: '24px' }}>
        {uiImprovementsEnabled ? (
          <PageHeader
            items={[{ title: 'Procurement' }, { title: 'RFQ & Negotiation' }]}
            title="RFQ Management"
            subtitle="Request for Quotation — Supplier Negotiation"
            extra={rfqListActions}
          />
        ) : (
          <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
            <Col>
              <Title level={3} style={{ margin: 0 }}>RFQ Management</Title>
              <Text type="secondary">Request for Quotation — Supplier Negotiation</Text>
            </Col>
            {!isVendor && <Col>{rfqListActions}</Col>}
          </Row>
        )}

        <InlineExpandPanel
          open={prSourceModalOpen}
          title="Create RFQ from Purchase Requisition"
          onCancel={() => setPrSourceModalOpen(false)}
          onSubmit={handleCreateRfqFromPr}
          submitText="Create RFQ"
          loading={creatingFromPr}
        >
          <Form layout="vertical">
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="Only approved (or already-sourcing) requisitions can be used here."
              description="A requisition still pending approval shows up below, grayed out, with the reason — approve it first, then come back."
            />
            <Form.Item label="Requisition" required>
              <Select
                showSearch placeholder="Select an approved/sourcing requisition" optionFilterProp="label"
                value={sourcePrId} onChange={handleSelectSourcePr}
                options={availablePrs.map(p => {
                  const reason = prSourceStatusReason(p);
                  return {
                    value: p.id,
                    disabled: !prSourceEligible(p),
                    label: `${p.pr_number} — ${p.department}${reason ? ` (${reason})` : ''}`,
                  };
                })}
              />
            </Form.Item>
            {sourcePrId && (
              <>
                <Form.Item label="Invite Vendors" required>
                  <Select mode="multiple" placeholder="Select vendors" value={prSourceVendorIds} onChange={setPrSourceVendorIds} optionFilterProp="label"
                    options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
                </Form.Item>
                <Form.Item label="Submission Deadline" required>
                  <DatePicker showTime style={{ width: '100%' }} value={prSourceDeadline} onChange={setPrSourceDeadline} disabledDate={d => d && d.isBefore(dayjs())} />
                </Form.Item>
                <Form.Item label="Line Items & Quantities (remaining on requisition)">
                  {prLineSelections.length === 0 ? <Empty description="No remaining quantity on this requisition" /> : (
                    <Table
                      size="small" pagination={false} rowKey="pr_line_item_id" dataSource={prLineSelections}
                      columns={[
                        { title: '', width: 40, render: (_, row) => <Checkbox checked={row.selected} onChange={e => toggleSourcePrLine(row.pr_line_item_id, e.target.checked)} /> },
                        { title: 'Line', dataIndex: 'description' },
                        { title: 'Remaining', dataIndex: 'max', width: 100, render: v => Number(v).toLocaleString() },
                        { title: 'Quantity', width: 130, render: (_, row) => <InputNumber size="small" style={{ width: '100%' }} min={0.001} max={row.max} value={row.quantity} disabled={!row.selected} onChange={v => updateSourcePrLineQty(row.pr_line_item_id, v)} /> },
                      ]}
                    />
                  )}
                </Form.Item>
              </>
            )}
          </Form>
        </InlineExpandPanel>

        <Card bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={rfqList}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 15, showSizeChanger: false }}
          />
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW (full page — no modal)
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'create') {
    const estimatedTotal = createLineItems.reduce((sum, li) => sum + Number(li.quantity || 0) * Number(li.target_price || 0), 0);
    return (
      <div style={{ padding: '24px', paddingBottom: 0 }}>
        <div style={{ paddingBottom: 88 }}>
          {uiImprovementsEnabled ? (
            <PageHeader
              items={[{ title: 'Procurement' }, { title: 'RFQ & Negotiation' }]}
              title={editingRfqId ? 'Edit RFQ' : 'Create RFQ'}
              onBack={() => setView(editingRfqId ? 'detail' : 'list')}
            />
          ) : (
            <Row align="middle" style={{ marginBottom: 16 }}>
              <Col>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setView(editingRfqId ? 'detail' : 'list')} style={{ marginRight: 12 }}>Back</Button>
              </Col>
              <Col flex="auto">
                <Title level={4} style={{ margin: 0 }}>{editingRfqId ? 'Edit RFQ' : 'Create RFQ'}</Title>
              </Col>
            </Row>
          )}

          <Card title="RFQ Details" size="small" style={{ marginBottom: 16 }}>
            <Form form={createForm} layout="vertical" onValuesChange={(changed) => { if ('budget_value' in changed) setCreateFormBudgetValue(changed.budget_value); }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="company_id" label="Company">
                    <CompanySelector
                      value={rfqSelectedCompanyId}
                      onChange={(val) => {
                        setRfqSelectedCompanyId(val);
                        createForm.setFieldsValue({ company_id: val });
                      }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item name="title" label="RFQ Title" rules={[{ required: isRequired('title', true), message: 'Enter a title' }]}>
                    <Input placeholder="e.g. Q3 Steel Components Supply" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="submission_deadline" label="Bid Deadline" rules={[{ required: isRequired('submission_deadline', true), message: 'Select deadline' }]}>
                    <DatePicker showTime style={{ width: '100%' }} disabledDate={d => d && d.isBefore(dayjs())} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="description" label="Description"
                rules={[{ required: isRequired('description', false), message: 'Description is required (mandatory for RFQs above the configured value threshold)' }]}
              >
                <TextArea rows={2} placeholder="Scope and context for this RFQ" />
              </Form.Item>
              <Form.Item name="vendor_ids" label="Invite Vendors" rules={[{ required: isRequired('vendor_ids', true), message: 'Select at least one vendor' }]}>
                <Select mode="multiple" placeholder="Select approved vendors to invite" optionFilterProp="children">
                  {vendors.map(v => <Option key={v.id} value={v.id}>{v.vendor_name} — {v.company_name}</Option>)}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="rfq_type" label="RFQ Type" initialValue="Limited" rules={[{ required: isRequired('rfq_type', false), message: 'RFQ Type is required' }]}>
                    <Select placeholder="Select RFQ type" options={rfqTypeOptions.map(s => ({ value: s.name, label: s.name }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="procurement_category_id" label="Procurement Category" rules={[{ required: isRequired('procurement_category_id', false), message: 'Procurement Category is required' }]}>
                    <Select placeholder="Select category" allowClear optionFilterProp="children">
                      {procurementCategories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="budget_value" label="Budget Value" rules={[{ required: isRequired('budget_value', false), message: 'Budget Value is required' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="Estimated budget" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card
            title="Line Items"
            size="small"
            style={{ marginBottom: 16 }}
            extra={<Text type="secondary" style={{ fontSize: 13 }}>{createLineItems.length} line{createLineItems.length === 1 ? '' : 's'} · Est. Total <Text strong>₹{estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></Text>}
          >
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>Second row per item: delivery location, required delivery date, technical specifications (all optional).</Text>

            {createLineItems.map((li, idx) => {
              const lineTotal = Number(li.quantity || 0) * Number(li.target_price || 0);
              return (
                <div key={idx} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <Row align="middle" style={{ marginBottom: 4 }}>
                    <Col flex="auto"><Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>LINE {idx + 1}</Text></Col>
                    <Col>
                      <Text type="secondary" style={{ fontSize: 12 }}>Est. Line Value: </Text>
                      <Text strong style={{ fontSize: 13 }}>₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </Col>
                  </Row>
                  <Row gutter={8} align="middle">
                    <Col span={6}>
                      <Select
                        showSearch
                        placeholder="Select item"
                        value={li.item_master_id || undefined}
                        onChange={v => selectCreateLineItemMaster(idx, v)}
                        optionFilterProp="children"
                        style={{ width: '100%' }}
                      >
                        {itemMasterList.map(im => <Option key={im.id} value={im.id}>{im.item_code} — {im.item_description}</Option>)}
                      </Select>
                    </Col>
                    <Col span={2}>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0.001}
                        placeholder="Qty"
                        value={li.quantity}
                        onChange={v => updateCreateLineItem(idx, 'quantity', v)}
                      />
                    </Col>
                    <Col span={2}>
                      <Input
                        placeholder="UOM"
                        value={li.uom}
                        onChange={e => updateCreateLineItem(idx, 'uom', e.target.value)}
                      />
                    </Col>
                    <Col span={3}>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        placeholder="Target price"
                        prefix="₹"
                        value={li.target_price || undefined}
                        onChange={v => updateCreateLineItem(idx, 'target_price', v)}
                      />
                    </Col>
                    <Col span={5}>
                      <Input
                        placeholder="Remarks (optional)"
                        value={li.remarks}
                        onChange={e => updateCreateLineItem(idx, 'remarks', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      {li.attachment_path ? (
                        <Space>
                          <AttachmentLink path={li.attachment_path} name={li.attachment_name} />
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => updateCreateLineItem(idx, 'attachment_path', null)} />
                        </Space>
                      ) : (
                        <Upload showUploadList={false} customRequest={({ file, onSuccess, onError }) => uploadCreateLineItemAttachment(idx, file, onSuccess, onError)}>
                          <Button size="small" icon={<UploadOutlined />}>Attach</Button>
                        </Upload>
                      )}
                    </Col>
                    <Col span={2}>
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        type="text"
                        onClick={() => removeCreateLineItem(idx)}
                        disabled={createLineItems.length === 1}
                      />
                    </Col>
                  </Row>
                  <Row gutter={8} align="middle" style={{ marginTop: 8 }}>
                    <Col span={5}>
                      <Select
                        placeholder="Delivery location"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        value={li.delivery_location_id || undefined}
                        onChange={v => updateCreateLineItem(idx, 'delivery_location_id', v || null)}
                        style={{ width: '100%' }}
                      >
                        {cityOptions.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                      </Select>
                    </Col>
                    <Col span={4}>
                      <DatePicker
                        placeholder="Required delivery date"
                        style={{ width: '100%' }}
                        value={li.required_delivery_date || null}
                        onChange={v => updateCreateLineItem(idx, 'required_delivery_date', v)}
                      />
                    </Col>
                    <Col span={15}>
                      <TextArea
                        placeholder="Technical specifications (optional)"
                        rows={1}
                        value={li.technical_specifications}
                        onChange={e => updateCreateLineItem(idx, 'technical_specifications', e.target.value)}
                      />
                    </Col>
                  </Row>
                  <VendorSuggestionPanel
                    itemMasterId={li.item_master_id}
                    addedVendorIds={watchedVendorIds}
                    onAddVendor={(vendorId) => {
                      if (watchedVendorIds.includes(vendorId)) return;
                      createForm.setFieldsValue({ vendor_ids: [...watchedVendorIds, vendorId] });
                      message.success('Vendor added to invite list');
                    }}
                  />
                </div>
              );
            })}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addCreateLineItem} block style={{ marginTop: 4 }}>
              Add Line Item
            </Button>
          </Card>
        </div>

        <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #f0f0f0', padding: '16px 24px', margin: '0 -24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary">Est. Total: <Text strong>₹{estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></Text>
          <Space size="middle">
            <Button onClick={() => setView(editingRfqId ? 'detail' : 'list')}>Cancel</Button>
            <Button type="primary" icon={<SendOutlined />} loading={creating} onClick={handleCreate}>{editingRfqId ? 'Save Changes' : 'Create RFQ'}</Button>
          </Space>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const rfq = rfqDetail || selectedRfq;
  // Multi-Round Negotiation: a 'negotiation'-status RFQ behaves like
  // 'published' for bidding/closing purposes — vendors can still submit bids
  // and the admin can still close it to end the round.
  const isNegotiating = rfq?.status === 'negotiation';
  const isPublished = rfq?.status === 'published' || isNegotiating;
  const isClosed = rfq?.status === 'closed';
  const isAwarded = rfq?.status === 'awarded';
  const isDraft = rfq?.status === 'draft';

  const bidderVendors = rfqDetail?.bids?.map(b => ({ vendor_id: b.vendor_id, vendor_name: b.vendor_name })) || [];

  const adminTabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab rfq={rfq} rfqDetail={rfqDetail} isVendor={isVendor} isDraft={isDraft} isPublished={isPublished} isClosed={isClosed} isAwarded={isAwarded} isNegotiating={isNegotiating} handlePublish={handlePublish} handleClose={handleClose} onOpenNegotiate={openNegotiatePanel} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={rfqDetail?.line_items} cityOptions={cityOptions} /> },
    { key: 'responses', label: <span><TeamOutlined /> Vendor Responses {rfqDetail?.bids?.length ? <Badge count={rfqDetail.bids.length} style={{ marginLeft: 4 }} /> : null}</span>, children: <ResponsesTab rfqDetail={rfqDetail} /> },
    ...(rfqDetail?.bids?.length > 0 ? [{ key: 'comparison', label: <span><BarChartOutlined /> Comparison</span>, children: <ComparisonTab comparison={comparison} compLoading={compLoading} scoringConfig={scoringConfig} setScoringConfig={setScoringConfig} savingScoringConfig={savingScoringConfig} handleSaveScoringConfig={handleSaveScoringConfig} /> }] : []),
    ...((rfq?.current_round || 1) > 1 ? [{ key: 'negotiation-history', label: <span><HistoryOutlined /> Negotiation History</span>, children: <NegotiationHistoryTab history={negotiationHistory} loading={negotiationHistoryLoading} /> }] : []),
    ...(isClosed ? [{ key: 'award', label: <span><TrophyOutlined /> Award</span>, children: <AwardTab isClosed={isClosed} isAwarded={isAwarded} bidderVendors={bidderVendors} hasBids={!!rfqDetail?.bids?.length} awardMode={awardMode} setAwardMode={setAwardMode} singleAwardVendor={singleAwardVendor} setSingleAwardVendor={setSingleAwardVendor} awardLines={awardLines} awardItems={awardItems} addAwardSplit={addAwardSplit} removeAwardItem={removeAwardItem} updateAwardItem={updateAwardItem} handleAward={handleAward} awarding={awarding} rfqId={rfq?.id} onCreatePoFromRfq={handleCreatePoFromRfq} /> }] : []),
  ];

  const vendorTabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab rfq={rfq} rfqDetail={rfqDetail} isVendor={isVendor} isDraft={isDraft} isPublished={isPublished} isClosed={isClosed} isAwarded={isAwarded} handlePublish={handlePublish} handleClose={handleClose} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={rfqDetail?.line_items} cityOptions={cityOptions} /> },
    { key: 'bid', label: <span><EditOutlined /> My Bid</span>, children: <MyBidTab rfq={rfq} rfqDetail={rfqDetail} isPublished={isPublished} bidItems={bidItems} bidRemarks={bidRemarks} setBidRemarks={setBidRemarks} updateBidItem={updateBidItem} handleSubmitBid={handleSubmitBid} submittingBid={submittingBid} uploadBidAttachment={uploadBidAttachment} bidTerms={bidTerms} setBidTerms={setBidTerms} cityOptions={cityOptions} overallBidAttachment={overallBidAttachment} setOverallBidAttachment={setOverallBidAttachment} uploadingOverallBid={uploadingOverallBid} uploadOverallBidAttachment={uploadOverallBidAttachment} /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Sticky summary header — same decision-first pattern as the PR Detail
          page (§4.10): RFQ number/title, status, and the Edit CTA stay
          visible while the tabs below scroll. */}
      <Row
        align="middle"
        style={{
          marginBottom: 16, position: 'sticky', top: 0, zIndex: 10, background: '#fff',
          padding: '12px 0', borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginRight: 12 }}>Back</Button>
        </Col>
        <Col flex="auto">
          <Title level={4} style={{ margin: 0 }}>{rfq?.rfq_number} — {rfq?.title}</Title>
        </Col>
        <Col>
          {!isVendor && (
            <Button icon={<EditOutlined />} style={{ marginRight: 8 }} onClick={() => openEditRfqPage(rfq, rfqDetail)}>Edit RFQ</Button>
          )}
          <StatusTag status={rfq?.status} />
        </Col>
      </Row>

      <InlineExpandPanel
        open={negotiatePanelOpen}
        title="Start New Negotiation Round"
        description="Re-invites the selected vendors to submit a revised bid by a new deadline. Every prior round's bids remain permanently on file — see Negotiation History once this round opens."
        submitText="Start Round"
        loading={negotiating}
        onCancel={() => setNegotiatePanelOpen(false)}
        onSubmit={handleStartNegotiation}
      >
        <Form layout="vertical">
          <Form.Item label="Invite Vendors" required>
            <Select
              mode="multiple" placeholder="Select vendors to invite to this round" optionFilterProp="label"
              value={negotiateVendorIds} onChange={setNegotiateVendorIds}
              options={vendors.map(v => ({ value: v.id, label: `${v.vendor_name} — ${v.company_name}` }))}
            />
            {bidderVendors.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>Defaulted to the {bidderVendors.length} vendor(s) who bid in the round just closed.</Text>}
          </Form.Item>
          <Form.Item label="New Submission Deadline" required>
            <DatePicker showTime style={{ width: '100%' }} value={negotiateDeadline} onChange={setNegotiateDeadline} disabledDate={d => d && d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item label="Remarks">
            <TextArea rows={2} placeholder="Optional note for the audit trail (e.g. why this round was opened)" value={negotiateRemarks} onChange={e => setNegotiateRemarks(e.target.value)} />
          </Form.Item>
        </Form>
      </InlineExpandPanel>

      {isVendor ? (
        <Tabs activeKey={activeTab} onChange={onTabChange} items={vendorTabs} type="card" loading={detailLoading} />
      ) : (
        <Row gutter={16}>
          <Col span={18}>
            <Tabs activeKey={activeTab} onChange={onTabChange} items={adminTabs} type="card" loading={detailLoading} />
          </Col>
          <Col span={6}>
            <DecisionPanel entityType="rfq" entityId={rfq?.id} sticky />
          </Col>
        </Row>
      )}
    </div>
  );
}
