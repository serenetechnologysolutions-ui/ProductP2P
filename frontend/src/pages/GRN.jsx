import { useState, useEffect } from 'react';
import { Table, Button, Card, Tag, Typography, Space, Row, Col, Statistic, message, DatePicker, InputNumber, Input, Empty } from 'antd';
import { ArrowLeftOutlined, FileProtectOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;
const STATUS_COLOR = { completed: 'green', exception: 'red' };

export default function GRN() {
  const [view, setView] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Create GRN state
  const [asns, setAsns] = useState([]);
  const [selectedAsnId, setSelectedAsnId] = useState(null);
  const [asnDetail, setAsnDetail] = useState(null);
  const [grnDate, setGrnDate] = useState(dayjs());
  const [grnRemarks, setGrnRemarks] = useState('');
  const [grnLines, setGrnLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/grn'); setData(res.data.data || []); } catch { message.error('Failed to load GRN data'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openDetail = async (record) => {
    try {
      const res = await api.get(`/grn/${record.id}`);
      setSelected(res.data.data);
    } catch { setSelected(record); }
    setView('detail');
  };

  const openCreate = async () => {
    try {
      const res = await api.get('/asns', { params: { status: 'validated', limit: 100 } });
      setAsns((res.data.data || []).filter(a => !a.grn_status));
    } catch { setAsns([]); }
    setSelectedAsnId(null); setAsnDetail(null); setGrnDate(dayjs()); setGrnRemarks(''); setGrnLines([]);
    setView('create');
  };

  const selectAsn = async (asnId) => {
    setSelectedAsnId(asnId);
    try {
      const res = await api.get(`/asns/${asnId}`);
      const asn = res.data.data;
      setAsnDetail(asn);
      setGrnLines((asn.line_items || []).map(li => ({
        asn_line_item_id: li.id,
        description: li.description || li.po_description,
        asn_quantity: Number(li.quantity),
        received_quantity: Number(li.quantity),
        damage_quantity: 0,
        shortage_quantity: 0,
        excess_quantity: 0,
        remarks: '',
      })));
    } catch { message.error('Failed to load ASN details'); }
  };

  const updateLine = (i, field, value) => setGrnLines(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const handleCreateGrn = async () => {
    if (!selectedAsnId) { message.error('Select an ASN'); return; }
    if (!grnDate) { message.error('Received date is required'); return; }

    // Validate totals tally
    for (const line of grnLines) {
      const total = Number(line.received_quantity || 0) + Number(line.damage_quantity || 0) + Number(line.shortage_quantity || 0);
      const expected = line.asn_quantity + Number(line.excess_quantity || 0);
      if (total !== expected) {
        // Soft warning — allow submission
      }
    }

    setSaving(true);
    try {
      await api.post(`/asns/${selectedAsnId}/grn`, {
        received_date: grnDate.format('YYYY-MM-DD'),
        remarks: grnRemarks || undefined,
        line_items: grnLines.map(r => ({
          asn_line_item_id: r.asn_line_item_id,
          received_quantity: r.received_quantity,
          rejected_quantity: Number(r.damage_quantity || 0) + Number(r.shortage_quantity || 0),
          rejection_reason: r.remarks || undefined,
        })),
      });
      message.success('GRN created successfully');
      setView('list'); fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed to create GRN'); }
    setSaving(false);
  };

  // ─── LIST VIEW ───
  if (view === 'list') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Goods Receipt Notes' }]}
          title="Goods Receipt Notes"
          subtitle="Track received goods against ASN shipments"
          extra={<Button type="primary" icon={<FileProtectOutlined />} onClick={openCreate}>Create GRN</Button>}
        />
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Total GRNs" value={data.length} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Completed" value={data.filter(d => d.status === 'completed').length} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Exceptions" value={data.filter(d => d.status === 'exception').length} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        </Row>
        <Table
          columns={[
            { title: 'GRN Number', dataIndex: 'grn_number', width: 130, render: (v, r) => <Button type="link" onClick={() => openDetail(r)}>{v}</Button> },
            { title: 'ASN', dataIndex: 'asn_number', width: 140 },
            { title: 'PO', dataIndex: 'po_number', width: 120 },
            { title: 'Vendor', dataIndex: 'vendor_name' },
            { title: 'Received Date', dataIndex: 'received_date', width: 120, render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
            { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={STATUS_COLOR[v] || 'default'}>{(v || '').toUpperCase()}</Tag> },
          ]}
          dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 15 }}
        />
      </div>
    );
  }

  // ─── CREATE VIEW ───
  if (view === 'create') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'GRN', onClick: () => setView('list') }, { title: 'Create GRN' }]}
          title="Create Goods Receipt Note"
          onBack={() => setView('list')}
        />
        {/* ASN Selection */}
        <Card size="small" style={{ marginBottom: 16 }} title="Select ASN">
          {asns.length === 0 ? (
            <Empty description="No validated ASNs available for GRN creation" />
          ) : (
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={asns}
              rowClassName={(r) => r.id === selectedAsnId ? 'ant-table-row-selected' : ''}
              onRow={(r) => ({ onClick: () => selectAsn(r.id), style: { cursor: 'pointer' } })}
              columns={[
                { title: 'ASN Number', dataIndex: 'asn_number' },
                { title: 'PO', dataIndex: 'po_number' },
                { title: 'Vendor', dataIndex: 'vendor_name' },
                { title: 'Invoice', dataIndex: 'invoice_number' },
                { title: 'Amount', dataIndex: 'total_amount', render: v => `₹${Number(v).toLocaleString()}` },
                { title: 'ETA', dataIndex: 'eta', render: v => v ? dayjs(v).format('DD-MM-YYYY') : '—' },
              ]}
            />
          )}
        </Card>

        {/* ASN Info + GRN Entry */}
        {asnDetail && (
          <>
            {/* ASN Information View */}
            <Card size="small" style={{ marginBottom: 16 }} title="ASN Information">
              <Row gutter={16}>
                <Col span={4}><Text type="secondary">ASN Number</Text><br /><Text strong>{asnDetail.asn_number}</Text></Col>
                <Col span={4}><Text type="secondary">PO Number</Text><br /><Text strong>{asnDetail.po_number}</Text></Col>
                <Col span={4}><Text type="secondary">Vendor</Text><br /><Text strong>{asnDetail.vendor_name}</Text></Col>
                <Col span={4}><Text type="secondary">Invoice</Text><br /><Text strong>{asnDetail.invoice_number}</Text></Col>
                <Col span={4}><Text type="secondary">Total Amount</Text><br /><Text strong>₹{Number(asnDetail.total_amount).toLocaleString()}</Text></Col>
                <Col span={4}><Text type="secondary">ETA</Text><br /><Text strong>{asnDetail.eta ? dayjs(asnDetail.eta).format('DD-MM-YYYY') : '—'}</Text></Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={4}><Text type="secondary">LR Number</Text><br /><Text strong>{asnDetail.lr_number || '—'}</Text></Col>
                <Col span={4}><Text type="secondary">Transporter</Text><br /><Text strong>{asnDetail.transporter_name || '—'}</Text></Col>
                <Col span={4}><Text type="secondary">Driver</Text><br /><Text strong>{asnDetail.driver_name || '—'}</Text></Col>
              </Row>
            </Card>

            {/* GRN Entry */}
            <Card size="small" title="Goods Receipt Entry">
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Received Date *</Text>
                  <DatePicker value={grnDate} onChange={setGrnDate} style={{ width: '100%' }} />
                </Col>
              </Row>

              <Table
                size="small" rowKey="asn_line_item_id" pagination={false}
                dataSource={grnLines}
                columns={[
                  { title: 'Description', dataIndex: 'description', width: 200 },
                  { title: 'ASN Qty', dataIndex: 'asn_quantity', width: 80, render: v => <Text strong>{v}</Text> },
                  { title: 'Received', width: 100, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.received_quantity} onChange={v => updateLine(i, 'received_quantity', v)} /> },
                  { title: 'Damage', width: 90, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.damage_quantity} onChange={v => updateLine(i, 'damage_quantity', v)} /> },
                  { title: 'Shortage', width: 90, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.shortage_quantity} onChange={v => updateLine(i, 'shortage_quantity', v)} /> },
                  { title: 'Excess', width: 90, render: (_, r, i) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={r.excess_quantity} onChange={v => updateLine(i, 'excess_quantity', v)} /> },
                  { title: 'Total', width: 80, render: (_, r) => {
                    const total = Number(r.received_quantity || 0) + Number(r.damage_quantity || 0) + Number(r.shortage_quantity || 0) - Number(r.excess_quantity || 0);
                    const matches = total === r.asn_quantity;
                    return <Text type={matches ? 'success' : 'danger'} strong>{total}</Text>;
                  }},
                  { title: 'Remarks', render: (_, r, i) => <Input size="small" placeholder="Remarks" value={r.remarks} onChange={e => updateLine(i, 'remarks', e.target.value)} /> },
                ]}
              />

              <Input.TextArea rows={2} placeholder="General remarks (optional)" value={grnRemarks} onChange={e => setGrnRemarks(e.target.value)} style={{ marginTop: 12 }} />
              <Space style={{ marginTop: 12 }}>
                <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={handleCreateGrn}>Create GRN</Button>
                <Button onClick={() => setView('list')}>Cancel</Button>
              </Space>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'GRN', onClick: () => { setView('list'); setSelected(null); } }, { title: selected?.grn_number }]}
        title={selected?.grn_number}
        onBack={() => { setView('list'); setSelected(null); }}
        extra={<Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').toUpperCase()}</Tag>}
      />

      {/* ASN Info */}
      <Card size="small" style={{ marginBottom: 16 }} title="ASN Information">
        <Row gutter={16}>
          <Col span={4}><Text type="secondary">ASN</Text><br /><Text strong>{selected?.asn_number || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">PO</Text><br /><Text strong>{selected?.po_number || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Vendor</Text><br /><Text strong>{selected?.vendor_name || '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Received Date</Text><br /><Text strong>{selected?.received_date ? dayjs(selected.received_date).format('DD-MM-YYYY') : '—'}</Text></Col>
          <Col span={4}><Text type="secondary">Status</Text><br /><Tag color={STATUS_COLOR[selected?.status]}>{(selected?.status || '').toUpperCase()}</Tag></Col>
        </Row>
      </Card>

      {selected?.remarks && <Card size="small" style={{ marginBottom: 16 }}><Text type="secondary">Remarks:</Text> {selected.remarks}</Card>}

      <Card size="small" title="Receipt Line Items">
        <Table
          size="small" rowKey="id" pagination={false}
          dataSource={selected?.line_items || []}
          columns={[
            { title: 'Description', dataIndex: 'description', render: (_, r) => r.description || '—' },
            { title: 'Ordered', dataIndex: 'ordered_quantity', width: 80 },
            { title: 'Shipped', dataIndex: 'shipped_quantity', width: 80 },
            { title: 'Received', dataIndex: 'received_quantity', width: 80 },
            { title: 'Accepted', dataIndex: 'accepted_quantity', width: 80 },
            { title: 'Rejected', dataIndex: 'rejected_quantity', width: 80, render: v => v > 0 ? <Text type="danger">{v}</Text> : v },
            { title: 'Tolerance', dataIndex: 'tolerance_status', width: 140, render: v => <Tag color={v === 'within_tolerance' ? 'green' : 'red'}>{(v || '').replace(/_/g, ' ').toUpperCase()}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
