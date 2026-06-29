import { useEffect, useState } from 'react';
import { Table, Tag, Button, Typography, Empty, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Text } = Typography;

const RISK_COLOR = { low: 'green', medium: 'orange', high: 'red' };

// Reuses the existing, already-built GET /rfq/vendor-suggestions/:itemMasterId
// (ProcurementInsightsService.suggestVendorsForItem) — ranks candidate
// vendors for the line's selected catalogue item by item history + vendor
// score + risk, already sorted by suggestion_score DESC server-side.
export default function VendorSuggestionPanel({ itemMasterId, onAddVendor, addedVendorIds = [] }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemMasterId) { setSuggestions(null); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/rfq/vendor-suggestions/${itemMasterId}`)
      .then(res => { if (!cancelled) setSuggestions(res.data?.data?.suggestions || []); })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [itemMasterId]);

  if (!itemMasterId) return null;
  if (loading) return <Skeleton active paragraph={{ rows: 1 }} style={{ marginTop: 8 }} />;
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>SUGGESTED VENDORS FOR THIS ITEM</Text>
      <Table
        size="small"
        pagination={false}
        rowKey="vendor_id"
        dataSource={suggestions}
        style={{ marginTop: 4 }}
        columns={[
          { title: 'Vendor', dataIndex: 'vendor_name' },
          { title: 'Score', dataIndex: 'suggestion_score', width: 70, render: v => v ?? '—' },
          { title: 'Risk', dataIndex: 'risk_level', width: 80, render: v => <Tag color={RISK_COLOR[v] || 'default'}>{(v || '—').toUpperCase()}</Tag> },
          { title: 'Price Competitiveness', key: 'price', width: 140, render: (_, r) => r.item_history ? `Avg ₹${Number(r.item_history.avg_price).toLocaleString()}` : <Text type="secondary">No history</Text> },
          {
            title: '', key: 'action', width: 90,
            render: (_, r) => addedVendorIds.includes(r.vendor_id)
              ? <Tag color="green">Added</Tag>
              : <Button size="small" icon={<PlusOutlined />} onClick={() => onAddVendor(r.vendor_id)}>Add</Button>,
          },
        ]}
      />
    </div>
  );
}
