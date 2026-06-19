import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography, Row, Col, Tabs,
  Form, Input, InputNumber, DatePicker, Select, Divider, Modal,
  message, Tooltip, Badge, Statistic, Alert, Radio, Empty, Upload, Checkbox,
} from 'antd';
import {
  PlusOutlined, ArrowLeftOutlined, SendOutlined, TrophyOutlined,
  FileTextOutlined, TeamOutlined, BarChartOutlined, CheckCircleOutlined,
  DeleteOutlined, EditOutlined, UploadOutlined, PaperClipOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const UPLOAD_BASE = 'http://localhost:5000/';

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR = { draft: 'default', published: 'blue', closed: 'orange', awarded: 'green' };
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

function OverviewTab({ rfq, rfqDetail, isVendor, isDraft, isPublished, isClosed, isAwarded, handlePublish, handleClose }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Row gutter={16}>
        <Col span={6}><Statistic title="RFQ Number" value={rfq?.rfq_number} /></Col>
        <Col span={6}><Statistic title="Status" valueRender={() => <StatusTag status={rfq?.status} />} /></Col>
        <Col span={6}><Statistic title="Deadline" value={rfq?.submission_deadline ? dayjs(rfq.submission_deadline).format('DD MMM YYYY HH:mm') : '—'} /></Col>
        {!isVendor && <Col span={6}><Statistic title="Vendors Invited" value={rfqDetail?.vendors?.length ?? '—'} /></Col>}
      </Row>

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
        <Space>
          {isDraft && <Button type="primary" onClick={handlePublish}>Publish RFQ</Button>}
          {isPublished && <Button danger onClick={handleClose}>Close RFQ</Button>}
          {isClosed && !isAwarded && (
            <Alert type="info" showIcon message="RFQ is closed. Go to Comparison tab to evaluate bids, then Award." />
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
      bidMatrix[bi.rfq_line_item_id][bid.vendor_id] = { unit_price: bi.unit_price, lead_time_days: bi.lead_time_days };
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
                      return (
                        <td key={b.vendor_id} style={{ ...tdStyle, textAlign: 'right', background: isLowest ? '#f6ffed' : isHighest ? '#fff2f0' : undefined, fontWeight: isLowest ? 600 : undefined, color: isLowest ? '#389e0d' : isHighest ? '#cf1322' : undefined }}>
                          {price != null ? `₹ ${price.toLocaleString()}` : <Text type="secondary">—</Text>}
                          {isLowest && <Tooltip title="Lowest bid"><CheckCircleOutlined style={{ marginLeft: 4, color: '#52c41a' }} /></Tooltip>}
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

function MyBidTab({ rfq, rfqDetail, isPublished, bidItems, bidRemarks, setBidRemarks, updateBidItem, handleSubmitBid, submittingBid, uploadBidAttachment, bidTerms, setBidTerms }) {
  const hasBid = !!rfqDetail?.my_bid;
  const canBid = isPublished && new Date(rfq?.submission_deadline) > new Date();

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
          <Row key={bi.rfq_line_item_id} gutter={12} align="middle" style={{ marginBottom: 12 }}>
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

function AwardTab({ isClosed, isAwarded, bidderVendors, hasBids, awardMode, setAwardMode, singleAwardVendor, setSingleAwardVendor, awardItems, updateAwardItem, handleAward, awarding }) {
  if (!isClosed) return <Alert type="info" showIcon message="RFQ must be closed before awarding." />;
  if (isAwarded) return <Alert type="success" showIcon message="This RFQ has already been awarded and Purchase Orders have been generated." />;
  if (!hasBids) return <Alert type="warning" showIcon message="No bids received. Cannot award." />;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title="Award Decision" size="small">
        <Form layout="vertical">
          <Form.Item label="Award Mode">
            <Radio.Group value={awardMode} onChange={e => setAwardMode(e.target.value)}>
              <Radio value="single">Single Vendor — award all items to one vendor</Radio>
              <Radio value="split">Multi-Vendor Split — select a vendor per item</Radio>
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
          {awardItems.map((ai, idx) => (
            <Row key={ai.rfq_line_item_id} gutter={12} align="middle" style={{ marginBottom: 12 }}>
              <Col span={8}><Text strong>{ai.item_description}</Text></Col>
              <Col span={4}>
                <InputNumber style={{ width: '100%' }} min={0.001} placeholder="Final qty" value={ai.quantity} onChange={v => updateAwardItem(idx, 'quantity', v)} />
              </Col>
              <Col span={4}>
                <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="Final price" value={ai.unit_price} onChange={v => updateAwardItem(idx, 'unit_price', v)} />
              </Col>
              {awardMode === 'split' && (
                <Col span={8}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Select vendor"
                    value={ai.vendor_id || undefined}
                    onChange={v => updateAwardItem(idx, 'vendor_id', v)}
                  >
                    {bidderVendors.map(v => <Option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</Option>)}
                  </Select>
                </Col>
              )}
            </Row>
          ))}

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

  const [view, setView] = useState('list'); // list | detail | create
  const [rfqList, setRfqList] = useState([]);
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

  // Comparison — scoring weight config (admin-editable)
  const [scoringConfig, setScoringConfig] = useState(null);
  const [savingScoringConfig, setSavingScoringConfig] = useState(false);

  // Award form
  const [awardMode, setAwardMode] = useState('single');
  const [singleAwardVendor, setSingleAwardVendor] = useState(null);
  const [awardItems, setAwardItems] = useState([]);
  const [awarding, setAwarding] = useState(false);

  // Create page
  const [createForm] = Form.useForm();
  const [createLineItems, setCreateLineItems] = useState([{ item_master_id: null, item_description: '', quantity: 1, uom: 'Nos', target_price: '', remarks: '', attachment_path: null, attachment_name: null, delivery_location_id: null, required_delivery_date: null, technical_specifications: '' }]);
  const [vendors, setVendors] = useState([]);
  const [itemMasterList, setItemMasterList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [procurementCategories, setProcurementCategories] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

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
      } else if (isVendor) {
        setBidItems(detail.line_items.map(li => ({ rfq_line_item_id: li.id, item_description: li.item_description, quantity: li.quantity, uom: li.uom, unit_price: '', lead_time_days: '', remarks: '', attachment_path: null, attachment_name: null })));
        setBidRemarks('');
        setBidTerms({ taxes_included_flag: false, offered_payment_terms: '', warranty_period: '', deviation_flag: false });
      }

      // Pre-fill award items
      if (!isVendor) {
        setAwardItems(detail.line_items.map(li => ({ rfq_line_item_id: li.id, item_description: li.item_description, quantity: li.quantity, uom: li.uom, unit_price: '', vendor_id: '' })));
      }
    } catch { message.error('Failed to load RFQ details'); }
    setDetailLoading(false);
  }, [isVendor]);

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
      const res = await api.get('/vendors?status=approved&limit=1000');
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

  // ── Open detail ────────────────────────────────────────────────────────────

  const openDetail = (rfq) => {
    setSelectedRfq(rfq);
    setActiveTab('overview');
    setComparison(null);
    setView('detail');
    fetchDetail(rfq.id);
    if (cityOptions.length === 0) fetchCities();
  };

  const handleBack = () => {
    setView('list');
    setSelectedRfq(null);
    setRfqDetail(null);
    setComparison(null);
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
    Modal.confirm({
      title: 'Close RFQ?',
      content: 'No more bids can be submitted after closing. Proceed?',
      okText: 'Close RFQ',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.put(`/rfq/${selectedRfq.id}/close`);
          message.success('RFQ closed');
          fetchDetail(selectedRfq.id);
        } catch (e) { message.error(e.response?.data?.message || 'Failed to close'); }
      },
    });
  };

  // ── Bid submission ─────────────────────────────────────────────────────────

  const handleSubmitBid = async () => {
    for (const bi of bidItems) {
      if (bi.unit_price === '' || bi.unit_price == null) {
        message.error(`Enter unit price for: ${bi.item_description}`);
        return;
      }
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
      if (!ai.vendor_id) { message.error('Assign a vendor for each line item'); return; }
      if (!ai.unit_price) { message.error('Enter final price for each line item'); return; }
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

  const updateAwardItem = (idx, field, value) => {
    setAwardItems(prev => prev.map((ai, i) => i === idx ? { ...ai, [field]: value } : ai));
  };

  // ── Create RFQ (full page, no popup) ───────────────────────────────────────

  const openCreatePage = () => {
    fetchVendors();
    fetchItemMaster();
    fetchProcurementCategories();
    fetchCities();
    setCreateLineItems([{ item_master_id: null, item_description: '', quantity: 1, uom: 'Nos', target_price: '', remarks: '', attachment_path: null, attachment_name: null, delivery_location_id: null, required_delivery_date: null, technical_specifications: '' }]);
    createForm.resetFields();
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
      await api.post('/rfq', {
        title: values.title,
        description: values.description,
        submission_deadline: values.submission_deadline.toISOString(),
        vendor_ids: values.vendor_ids,
        rfq_type: values.rfq_type || 'limited',
        procurement_category_id: values.procurement_category_id || null,
        budget_value: values.budget_value || null,
        line_items: createLineItems.map(li => ({
          ...li,
          required_delivery_date: li.required_delivery_date ? li.required_delivery_date.format('YYYY-MM-DD') : null,
          technical_specifications: li.technical_specifications ? { notes: li.technical_specifications } : null,
        })),
      });
      message.success('RFQ created as draft');
      setView('list');
      fetchList();
    } catch (e) {
      if (e.errorFields) { setCreating(false); return; }
      message.error(e.response?.data?.message || 'Failed to create RFQ');
    }
    setCreating(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const columns = [
    { title: 'RFQ Number', dataIndex: 'rfq_number', key: 'rfq_number', render: v => <Text strong>{v}</Text> },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => <StatusTag status={s} />, width: 110 },
    {
      title: 'Deadline',
      dataIndex: 'submission_deadline',
      key: 'deadline',
      width: 140,
      render: d => {
        const dt = dayjs(d);
        const past = dt.isBefore(dayjs());
        return <span style={{ color: past ? '#ff4d4f' : undefined }}>{dt.format('DD MMM YYYY')}</span>;
      },
    },
    { title: 'Items', dataIndex: 'item_count', key: 'item_count', width: 70 },
    ...(isVendor ? [{ title: 'My Status', dataIndex: 'participation_status', key: 'participation_status', render: s => <Tag color={PARTICIPATION_COLOR[s]}>{(s || '').replace('_', ' ').toUpperCase()}</Tag> }] : [
      { title: 'Vendors', dataIndex: 'vendor_count', key: 'vendor_count', width: 80, render: v => <Badge count={v} showZero color="blue" /> },
      { title: 'Bids', dataIndex: 'bid_count', key: 'bid_count', width: 70 },
    ]),
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, row) => <Button type="link" size="small" onClick={() => openDetail(row)}>View →</Button>,
    },
  ];

  if (view === 'list') {
    return (
      <div style={{ padding: '24px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>RFQ Management</Title>
            <Text type="secondary">Request for Quotation — Supplier Negotiation</Text>
          </Col>
          {!isVendor && (
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePage}>Create RFQ</Button>
            </Col>
          )}
        </Row>

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
    return (
      <div style={{ padding: '24px' }}>
        <Row align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setView('list')} style={{ marginRight: 12 }}>Back</Button>
          </Col>
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>Create RFQ</Title>
          </Col>
        </Row>

        <Card>
          <Form form={createForm} layout="vertical">
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item name="title" label="RFQ Title" rules={[{ required: true, message: 'Enter a title' }]}>
                  <Input placeholder="e.g. Q3 Steel Components Supply" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="submission_deadline" label="Bid Deadline" rules={[{ required: true, message: 'Select deadline' }]}>
                  <DatePicker showTime style={{ width: '100%' }} disabledDate={d => d && d.isBefore(dayjs())} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="Description">
              <TextArea rows={2} placeholder="Scope and context for this RFQ" />
            </Form.Item>
            <Form.Item name="vendor_ids" label="Invite Vendors" rules={[{ required: true, message: 'Select at least one vendor' }]}>
              <Select mode="multiple" placeholder="Select approved vendors to invite" optionFilterProp="children">
                {vendors.map(v => <Option key={v.id} value={v.id}>{v.vendor_name} — {v.company_name}</Option>)}
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="rfq_type" label="RFQ Type" initialValue="limited">
                  <Select placeholder="Select RFQ type">
                    <Option value="open">Open</Option>
                    <Option value="limited">Limited</Option>
                    <Option value="single">Single</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="procurement_category_id" label="Procurement Category">
                  <Select placeholder="Select category" allowClear optionFilterProp="children">
                    {procurementCategories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="budget_value" label="Budget Value">
                  <InputNumber style={{ width: '100%' }} min={0} prefix="₹" placeholder="Estimated budget" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Line Items</Divider>

            <Row gutter={8} style={{ marginBottom: 8, paddingLeft: 4 }}>
              <Col span={6}><Text type="secondary" strong>Item (Master)</Text></Col>
              <Col span={2}><Text type="secondary" strong>Qty</Text></Col>
              <Col span={2}><Text type="secondary" strong>UOM</Text></Col>
              <Col span={3}><Text type="secondary" strong>Target Price</Text></Col>
              <Col span={5}><Text type="secondary" strong>Remarks</Text></Col>
              <Col span={4}><Text type="secondary" strong>Attachment</Text></Col>
              <Col span={2}></Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 11 }}>Second row per item: delivery location, required delivery date, technical specifications (all optional).</Text>

            {createLineItems.map((li, idx) => (
              <div key={idx} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, marginBottom: 8 }}>
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
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addCreateLineItem} block style={{ marginTop: 4 }}>
              Add Line Item
            </Button>

            <Divider />
            <Space size="middle">
              <Button type="primary" size="large" icon={<SendOutlined />} loading={creating} onClick={handleCreate}>Create RFQ</Button>
              <Button size="large" onClick={() => setView('list')}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const rfq = rfqDetail || selectedRfq;
  const isPublished = rfq?.status === 'published';
  const isClosed = rfq?.status === 'closed';
  const isAwarded = rfq?.status === 'awarded';
  const isDraft = rfq?.status === 'draft';

  const bidderVendors = rfqDetail?.bids?.map(b => ({ vendor_id: b.vendor_id, vendor_name: b.vendor_name })) || [];

  const adminTabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab rfq={rfq} rfqDetail={rfqDetail} isVendor={isVendor} isDraft={isDraft} isPublished={isPublished} isClosed={isClosed} isAwarded={isAwarded} handlePublish={handlePublish} handleClose={handleClose} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={rfqDetail?.line_items} cityOptions={cityOptions} /> },
    { key: 'responses', label: <span><TeamOutlined /> Vendor Responses {rfqDetail?.bids?.length ? <Badge count={rfqDetail.bids.length} style={{ marginLeft: 4 }} /> : null}</span>, children: <ResponsesTab rfqDetail={rfqDetail} /> },
    ...(rfqDetail?.bids?.length > 0 ? [{ key: 'comparison', label: <span><BarChartOutlined /> Comparison</span>, children: <ComparisonTab comparison={comparison} compLoading={compLoading} scoringConfig={scoringConfig} setScoringConfig={setScoringConfig} savingScoringConfig={savingScoringConfig} handleSaveScoringConfig={handleSaveScoringConfig} /> }] : []),
    ...(isClosed ? [{ key: 'award', label: <span><TrophyOutlined /> Award</span>, children: <AwardTab isClosed={isClosed} isAwarded={isAwarded} bidderVendors={bidderVendors} hasBids={!!rfqDetail?.bids?.length} awardMode={awardMode} setAwardMode={setAwardMode} singleAwardVendor={singleAwardVendor} setSingleAwardVendor={setSingleAwardVendor} awardItems={awardItems} updateAwardItem={updateAwardItem} handleAward={handleAward} awarding={awarding} /> }] : []),
  ];

  const vendorTabs = [
    { key: 'overview', label: <span><FileTextOutlined /> Overview</span>, children: <OverviewTab rfq={rfq} rfqDetail={rfqDetail} isVendor={isVendor} isDraft={isDraft} isPublished={isPublished} isClosed={isClosed} isAwarded={isAwarded} handlePublish={handlePublish} handleClose={handleClose} /> },
    { key: 'items', label: 'Line Items', children: <LineItemsTab lineItems={rfqDetail?.line_items} cityOptions={cityOptions} /> },
    { key: 'bid', label: <span><EditOutlined /> My Bid</span>, children: <MyBidTab rfq={rfq} rfqDetail={rfqDetail} isPublished={isPublished} bidItems={bidItems} bidRemarks={bidRemarks} setBidRemarks={setBidRemarks} updateBidItem={updateBidItem} handleSubmitBid={handleSubmitBid} submittingBid={submittingBid} uploadBidAttachment={uploadBidAttachment} bidTerms={bidTerms} setBidTerms={setBidTerms} /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginRight: 12 }}>Back</Button>
        </Col>
        <Col flex="auto">
          <Title level={4} style={{ margin: 0 }}>{rfq?.rfq_number} — {rfq?.title}</Title>
        </Col>
        <Col>
          <StatusTag status={rfq?.status} />
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        items={isVendor ? vendorTabs : adminTabs}
        type="card"
        loading={detailLoading}
      />
    </div>
  );
}
