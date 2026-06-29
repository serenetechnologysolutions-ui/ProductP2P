import { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, message } from 'antd';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;

export default function Inventory() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/stock');
      setStock(res.data.data || []);
    } catch { message.error('Failed to load inventory data'); }
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const fetchMovements = async (itemMasterId) => {
    setMovementsLoading(true);
    try {
      const res = await api.get('/inventory/movements', { params: { item_master_id: itemMasterId } });
      setMovements(res.data.data || []);
    } catch { setMovements([]); }
    setMovementsLoading(false);
  };

  const handleRowClick = (record) => {
    setSelectedItem(record);
    fetchMovements(record.item_master_id);
  };

  return (
    <div>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Inventory' }]}
        title="Inventory"
        subtitle="Stock on hand — click a row to view inward transactions"
      />
      <Card size="small" loading={loading} style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Stock On Hand</Text>
        <Table
          size="small"
          rowKey="id"
          pagination={{ pageSize: 20 }}
          dataSource={stock}
          onRow={(record) => ({ onClick: () => handleRowClick(record), style: { cursor: 'pointer' } })}
          rowClassName={(record) => selectedItem?.id === record.id ? 'ant-table-row-selected' : ''}
          columns={[
            { title: 'Item Code', dataIndex: 'item_code', width: 120 },
            { title: 'Description', dataIndex: 'item_description' },
            { title: 'Warehouse', dataIndex: 'warehouse_name', width: 150 },
            { title: 'On Hand', dataIndex: 'quantity_on_hand', width: 100, sorter: (a, b) => a.quantity_on_hand - b.quantity_on_hand },
            { title: 'Reorder Level', dataIndex: 'reorder_level', width: 120 },
            { title: 'Reorder Qty', dataIndex: 'reorder_quantity', width: 110 },
            { title: 'Status', key: 'status', width: 100, render: (_, r) => Number(r.quantity_on_hand) < Number(r.reorder_level) ? <Tag color="red">Low</Tag> : <Tag color="green">OK</Tag> },
          ]}
        />
      </Card>
      {selectedItem && (
        <Card size="small" loading={movementsLoading} title={`Transactions — ${selectedItem.item_code} (${selectedItem.item_description})`}>
          {movements.length === 0 && !movementsLoading ? (
            <Text type="secondary">No transactions recorded for this item yet.</Text>
          ) : (
            <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={movements} columns={[
              { title: 'Date', dataIndex: 'created_at', width: 150, render: v => v ? new Date(v).toLocaleString() : '—' },
              { title: 'Type', dataIndex: 'movement_type', width: 80, render: v => <Tag color={v === 'in' ? 'green' : 'orange'}>{v?.toUpperCase()}</Tag> },
              { title: 'Qty', dataIndex: 'quantity', width: 80 },
              { title: 'Reference', dataIndex: 'reference_type', width: 120, render: v => <Tag>{v?.toUpperCase()}</Tag> },
              { title: 'Warehouse', dataIndex: 'warehouse_name', width: 150 },
            ]} />
          )}
        </Card>
      )}
    </div>
  );
}
