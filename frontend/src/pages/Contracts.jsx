import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, DatePicker, Tag, Space, Card, Typography, message, Row, Col, Statistic, Tabs, Alert, Progress, Empty } from 'antd';
import { PlusOutlined, ZoomInOutlined, FileProtectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Text } = Typography;
const STATUS_COLOR = { active: 'green', expired: 'default', terminated: 'red' };
const NEAR_EXPIRY_DAYS = 30;
const LOW_REMAINING_PCT = 10;

export default function Contracts() {
  const [view, setView] = useState('list'); // list | detail
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const { isRequired } = useFieldConfig('contract');

  const [selected, setSelected] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/contracts');
      setData(res.data.data || []);
    } catch { message.error('Failed to load contracts'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/vendors', { params: { limit: 500 } }).then(r => setVendors(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/payment_terms').then(r => setPaymentTerms(r.data.data || [])).catch(() => {});
    api.get('/sub-masters/currency').then(r => setCurrencies(r.data.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { form.resetFields(); setShowForm(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/contracts', {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
      });
      message.success('Contract created');
      setShowForm(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Failed to save contract');
    }
  };

  const openDetail = async (record) => {
    setSelected(record);
    setView('detail');
    setDetailLoading(true);
    try {
      const res = await api.get(`/contracts/${record.id}/consumption`);
      setConsumption(res.data.data);
    } catch { message.error('Failed to load contract consumption'); }
    setDetailLoading(false);
  };

  const goBack = () => { setView('list'); setSelected(null); setConsumption(null); };

  // ── Decision intelligence: near-expiry / low-remaining-value summary used
  // both for the list's own insight count and for each contract's own alerts.
  const daysToExpiry = (contract) => dayjs(contract.end_date).diff(dayjs(), 'day');
  const remainingPct = (contract) => contract.contract_value
    ? (Number(contract.remaining_value ?? contract.contract_value) / Number(contract.contract_value)) * 100
    : null;
  const isNearExpiry = (c) => c.status === 'active' && daysToExpiry(c) >= 0 && daysToExpiry(c) <= NEAR_EXPIRY_DAYS;
  const isLowRemaining = (c) => c.status === 'active' && remainingPct(c) != null && remainingPct(c) <= LOW_REMAINING_PCT;

  const activeContracts = data.filter(c => c.status === 'active');
  const totalValue = data.reduce((s, c) => s + Number(c.contract_value || 0), 0);
  const totalRemaining = activeContracts.reduce((s, c) => s + Number(c.remaining_value ?? c.contract_value ?? 0), 0);
  const nearExpiryCount = activeContracts.filter(isNearExpiry).length;
  const lowRemainingCount = activeContracts.filter(isLowRemaining).length;

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selected) {
    const tabs = [
      {
        key: 'overview',
        label: 'Overview',
        children: (
          <Card size="small">
            <Row gutter={[16, 12]}>
              <Col span={8}><Text type="secondary">Vendor</Text><br /><Text strong>{selected.vendor_name || '—'}</Text></Col>
              <Col span={8}><Text type="secondary">Validity</Text><br /><Text strong>{dayjs(selected.start_date).format('DD MMM YYYY')} – {dayjs(selected.end_date).format('DD MMM YYYY')}</Text></Col>
              <Col span={8}><Text type="secondary">Status</Text><br /><Tag color={STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase()}</Tag></Col>
              <Col span={8}><Text type="secondary">Payment Terms</Text><br /><Text strong>{selected.payment_terms || '—'}</Text></Col>
              <Col span={8}><Text type="secondary">Default Unit Price</Text><br /><Text strong>{consumption?.default_unit_price != null ? Number(consumption.default_unit_price).toLocaleString() : '—'}</Text></Col>
            </Row>
          </Card>
        ),
      },
      {
        key: 'consumption',
        label: 'Consumption',
        children: detailLoading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div> : !consumption ? <Empty description="No consumption data" /> : (
          <Card size="small">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="Contract Value" value={consumption.contract_value ?? '—'} prefix={selected.currency || 'INR'} /></Col>
              <Col span={8}><Statistic title="Consumed Value" value={consumption.consumed_value ?? 0} prefix={selected.currency || 'INR'} /></Col>
              <Col span={8}><Statistic title="Remaining Value" value={consumption.remaining_value ?? '—'} prefix={selected.currency || 'INR'} valueStyle={remainingPct(selected) != null && remainingPct(selected) <= LOW_REMAINING_PCT ? { color: '#cf1322' } : undefined} /></Col>
            </Row>
            {consumption.contract_value != null && (
              <Progress
                percent={Math.round(100 - (remainingPct({ ...selected, remaining_value: consumption.remaining_value }) ?? 0))}
                status={isLowRemaining({ ...selected, remaining_value: consumption.remaining_value }) ? 'exception' : 'active'}
                format={() => `${Math.round(remainingPct({ ...selected, remaining_value: consumption.remaining_value }) ?? 0)}% remaining`}
              />
            )}
          </Card>
        ),
      },
    ];

    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Contracts', onClick: goBack }, { title: selected.contract_number }]}
          title={selected.contract_number}
          subtitle={selected.title}
          onBack={goBack}
          extra={<Tag color={STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase()}</Tag>}
        />

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {isNearExpiry(selected) && (
            <Alert type="warning" showIcon message={`Expires in ${daysToExpiry(selected)} day(s)`} description="Consider renewing or replacing this contract before it lapses." />
          )}
          {isLowRemaining({ ...selected, remaining_value: consumption?.remaining_value }) && (
            <Alert type="error" showIcon message="Remaining value is low" description={`Less than ${LOW_REMAINING_PCT}% of the contract's value remains — new POs against it may be rejected once it's exhausted.`} />
          )}

          <Tabs items={tabs} type="card" />
        </Space>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════
  const columns = [
    { title: 'Contract No.', dataIndex: 'contract_number', width: 130, render: v => <Tag color="blue">{v}</Tag>, sorter: (a, b) => String(a.contract_number || '').localeCompare(String(b.contract_number || ''), undefined, { numeric: true }) },
    { title: 'Title', dataIndex: 'title', ellipsis: true, sorter: (a, b) => String(a.title || '').localeCompare(String(b.title || '')) },
    { title: 'Vendor', dataIndex: 'vendor_name', width: 180, ellipsis: true, render: v => v || <Text type="secondary">—</Text>, sorter: (a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')) },
    { title: 'Validity', width: 220, render: (_, r) => `${dayjs(r.start_date).format('DD MMM YYYY')} – ${dayjs(r.end_date).format('DD MMM YYYY')}`, sorter: (a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0) },
    { title: 'Value', width: 150, render: (_, r) => r.contract_value != null ? `${r.currency || 'INR'} ${Number(r.contract_value).toLocaleString()}` : <Text type="secondary">—</Text>, sorter: (a, b) => Number(a.contract_value || 0) - Number(b.contract_value || 0) },
    { title: 'Remaining', width: 150, render: (_, r) => r.remaining_value != null ? `${r.currency || 'INR'} ${Number(r.remaining_value).toLocaleString()}` : <Text type="secondary">—</Text>, sorter: (a, b) => Number(a.remaining_value || 0) - Number(b.remaining_value || 0) },
    {
      title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag>,
      sorter: (a, b) => String(a.status || '').localeCompare(String(b.status || '')),
      filters: Object.keys(STATUS_COLOR).map(v => ({ text: v.toUpperCase(), value: v })),
      onFilter: (value, row) => row.status === value,
    },
    {
      title: 'Alerts', key: 'alerts', width: 130,
      render: (_, r) => (
        <Space size={4}>
          {isNearExpiry(r) && <Tag color="orange">Expiring</Tag>}
          {isLowRemaining(r) && <Tag color="red">Low value</Tag>}
        </Space>
      ),
    },
    { title: 'Actions', key: 'actions', width: 80, fixed: 'right', render: (_, r) => <Button type="text" icon={<ZoomInOutlined />} onClick={() => openDetail(r)} /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Contracts' }]}
        title="Contracts"
        subtitle="Vendor contracts used for contract-based PR sourcing"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Contract</Button>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Contracts" value={data.length} prefix={<FileProtectOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={activeContracts.length} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Value" value={totalValue} precision={0} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Remaining (Active)" value={totalRemaining} precision={0} /></Card></Col>
      </Row>

      {(nearExpiryCount > 0 || lowRemainingCount > 0) && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="Contracts need attention"
          description={[
            nearExpiryCount > 0 ? `${nearExpiryCount} contract(s) expiring within ${NEAR_EXPIRY_DAYS} days.` : null,
            lowRemainingCount > 0 ? `${lowRemainingCount} contract(s) have less than ${LOW_REMAINING_PCT}% of their value remaining.` : null,
          ].filter(Boolean).join(' ')}
        />
      )}

      <InlineExpandPanel
        open={showForm}
        title="New Contract"
        submitText="Save"
        onCancel={() => setShowForm(false)}
        onSubmit={handleSave}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="vendor_id" label="Vendor" rules={[{ required: isRequired('vendor_id', true), message: 'Select a vendor' }]}>
                <Select showSearch placeholder="Select vendor" optionFilterProp="label" options={vendors.map(v => ({ value: v.id, label: v.vendor_name }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="title" label="Title" rules={[{ required: isRequired('title', true), message: 'Enter a title' }]}>
                <Input placeholder="e.g. Annual rate contract — packaging materials" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="currency" label="Currency" initialValue="INR" rules={[{ required: isRequired('currency', false) }]}>
                <Select options={currencies.map(c => ({ value: c.name, label: c.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: isRequired('start_date', true), message: 'Select start date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="end_date" label="End Date" rules={[{ required: isRequired('end_date', true), message: 'Select end date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="payment_terms" label="Payment Terms" rules={[{ required: isRequired('payment_terms', false) }]}>
                <Select allowClear showSearch placeholder="Select terms" optionFilterProp="label" options={paymentTerms.map(p => ({ value: p.name, label: p.name }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="contract_value" label="Contract Value" rules={[{ required: isRequired('contract_value', false) }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="default_unit_price" label="Default Unit Price" tooltip="Optional flat rate used as the default price on PO lines created against this contract when no other price is specified.">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
          </Form.Item>
        </Form>
      </InlineExpandPanel>

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} scroll={{ x: 1250 }} />
      </Card>
    </div>
  );
}
