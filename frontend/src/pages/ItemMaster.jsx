import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, Tag, Space, Card, Typography, Popconfirm, message, Row, Col, Checkbox, Divider, Tabs, Statistic, Alert, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, TeamOutlined, PlusCircleOutlined, ZoomInOutlined, BulbOutlined, DatabaseOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../api/axios';
import { API_BASE_URL } from '../config';
import CompanySelector from '../components/CompanySelector';
import { useFieldConfig } from '../contexts/FieldConfigContext';
import InlineExpandPanel from '../components/ui/InlineExpandPanel';
import PageHeader from '../components/ui/PageHeader';

const { Title, Text } = Typography;

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export default function ItemMaster() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();
  const canManage = ['mdm_admin', 'system_admin'].includes(user.role);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [subMasters, setSubMasters] = useState({ item_category: [], item_subcategory: [], uom: [], currency: [] });
  const [specRows, setSpecRows] = useState([]);

  // Company mapping state for create/edit
  const [companyIds, setCompanyIds] = useState([]);

  // Preferred vendors panel state
  const [itemVendors, setItemVendors] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [newVendorId, setNewVendorId] = useState(null);
  const [newVendorPreferred, setNewVendorPreferred] = useState(false);
  const [vendorMappingLoading, setVendorMappingLoading] = useState(false);
  const { isRequired } = useFieldConfig('item_master');

  // Price Insights tab — ProcurementInsightsService.getItemPriceBenchmark
  const [priceBenchmark, setPriceBenchmark] = useState(null);
  const [priceBenchmarkLoading, setPriceBenchmarkLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');

  const fetchData = useCallback(async (searchValue) => {
    setLoading(true);
    try {
      const res = await api.get('/item-master', { params: searchValue ? { search: searchValue } : {} });
      setData(res.data.data || []);
    } catch { message.error('Failed to load items'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const cats = ['item_category', 'item_subcategory', 'uom', 'currency'];
        const results = {};
        for (const cat of cats) { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; }
        setSubMasters(results);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSearch = () => fetchData(search);
  const handleClear = () => { setSearch(''); fetchData(); };

  const openCreate = () => { setEditing(null); setSelected(null); form.resetFields(); setSpecRows([]); setCompanyIds([]); setShowForm(true); };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    const specObj = parseMaybeJson(record.specification_template) || {};
    setSpecRows(Object.entries(specObj).map(([key, value]) => ({ key, value })));
    // Fetch existing company mappings for this item
    api.get(`/item-master/${record.id}/companies`).then(res => {
      setCompanyIds((res.data.data || []).map(c => c.company_id));
    }).catch(() => setCompanyIds([]));
    setShowForm(true);
  };

  const selectRow = (record) => { setSelected(record); setShowForm(false); setDetailTab('overview'); setPriceBenchmark(null); };

  const fetchPriceBenchmark = async (itemId) => {
    setPriceBenchmarkLoading(true);
    try {
      const res = await api.get(`/insights/items/${itemId}/price-benchmark`);
      setPriceBenchmark(res.data.data);
    } catch { message.error('Failed to load price insights'); }
    setPriceBenchmarkLoading(false);
  };

  const ensureVendorOptionsLoaded = async () => {
    if (vendorOptions.length > 0) return;
    try {
      const res = await api.get('/vendors', { params: { limit: 200 } });
      setVendorOptions(res.data.data || []);
    } catch { /* ignore */ }
  };

  const onDetailTabChange = (key) => {
    setDetailTab(key);
    if (key === 'insights' && !priceBenchmark && selected) fetchPriceBenchmark(selected.id);
    if (key === 'vendors' && selected) { fetchItemVendors(selected.id); ensureVendorOptionsLoaded(); }
  };

  // specification_template key/value helpers (mirrors Vendors.jsx complianceDates pattern)
  const addSpecRow = () => setSpecRows([...specRows, { key: '', value: '' }]);
  const removeSpecRow = (i) => setSpecRows(specRows.filter((_, idx) => idx !== i));
  const updateSpecRow = (i, field, value) => setSpecRows(specRows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const specification_template = specRows.reduce((acc, r) => { if (r.key) acc[r.key] = r.value; return acc; }, {});
      const payload = { ...values, specification_template };
      if (editing) {
        await api.put(`/item-master/${editing.id}`, payload);
        // Update company mappings separately
        if (companyIds.length > 0) {
          await api.put(`/item-master/${editing.id}/companies`, { company_ids: companyIds });
        }
        message.success('Item updated');
      } else {
        payload.company_ids = companyIds;
        await api.post('/item-master', payload);
        message.success('Item created');
      }
      setShowForm(false);
      setEditing(null);
      setSelected(null);
      setSpecRows([]);
      setCompanyIds([]);
      fetchData(search);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save item');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/item-master/${id}`);
      message.success('Item removed');
      if (selected?.id === id) setSelected(null);
      fetchData(search);
    } catch { message.error('Failed to remove item'); }
  };

  // ─── Preferred Vendors — quick-access shortcut straight to the detail
  // view's Vendors tab, bypassing the Overview tab ───
  const openVendorPanel = async (record) => {
    setSelected(record);
    setShowForm(false);
    setDetailTab('vendors');
    setNewVendorId(null);
    setNewVendorPreferred(false);
    await fetchItemVendors(record.id);
    await ensureVendorOptionsLoaded();
  };

  const fetchItemVendors = async (itemId) => {
    setVendorMappingLoading(true);
    try {
      const res = await api.get(`/item-master/${itemId}/vendors`);
      setItemVendors(res.data.data || []);
    } catch { message.error('Failed to load vendor mappings'); }
    setVendorMappingLoading(false);
  };

  const handleAddVendorMapping = async () => {
    if (!newVendorId) { message.error('Select a vendor'); return; }
    try {
      await api.post(`/item-master/${selected.id}/vendors`, { vendor_id: newVendorId, is_preferred: newVendorPreferred });
      message.success('Vendor mapping saved');
      setNewVendorId(null);
      setNewVendorPreferred(false);
      fetchItemVendors(selected.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to save mapping'); }
  };

  const handleRemoveVendorMapping = async (vendorId) => {
    try {
      await api.delete(`/item-master/${selected.id}/vendors/${vendorId}`);
      message.success('Vendor mapping removed');
      fetchItemVendors(selected.id);
    } catch { message.error('Failed to remove mapping'); }
  };

  const columns = [
    { title: 'Item Code', dataIndex: 'item_code', width: 130, render: v => <Tag color="blue">{v}</Tag>, sorter: (a, b) => String(a.item_code || '').localeCompare(String(b.item_code || ''), undefined, { numeric: true }) },
    { title: 'Description', dataIndex: 'item_description', width: 220, ellipsis: true, sorter: (a, b) => String(a.item_description || '').localeCompare(String(b.item_description || '')) },
    { title: 'UOM', dataIndex: 'uom', width: 90, sorter: (a, b) => String(a.uom || '').localeCompare(String(b.uom || '')) },
    { title: 'Standard Cost', dataIndex: 'standard_cost', width: 120, render: (v, r) => v != null ? `${r.currency || 'INR'} ${v}` : <Text type="secondary">—</Text>, sorter: (a, b) => Number(a.standard_cost || 0) - Number(b.standard_cost || 0) },
    {
      title: 'Actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<ZoomInOutlined />} size="small" title="View" onClick={() => selectRow(record)} />
          {canManage && <Button icon={<TeamOutlined />} size="small" title="Preferred Vendors" onClick={() => openVendorPanel(record)} />}
          {canManage && <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />}
          {canManage && <Popconfirm title="Remove this item?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>}
        </Space>
      ),
    },
  ];

  // ─── CREATE / EDIT VIEW (full page) ───
  if (showForm) {
    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Item Master', onClick: () => { setShowForm(false); setEditing(null); setSpecRows([]); setCompanyIds([]); } }, { title: editing ? 'Edit Item' : 'Add Item' }]}
          title={editing ? 'Edit Item' : 'Add Item'}
          onBack={() => { setShowForm(false); setEditing(null); setSpecRows([]); setCompanyIds([]); }}
        />
        <Card size="small">
      <Form form={form} layout="vertical">
        <Title level={5} style={{ marginTop: 0 }}>Primary</Title>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="item_code" label="Item Code" rules={[{ required: isRequired('item_code', true), message: 'Enter item code' }]}>
              <Input placeholder="e.g. ITM-001" disabled={!!editing} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="item_description" label="Item Description" rules={[{ required: isRequired('item_description', true), message: 'Enter description' }]}>
              <Input placeholder="e.g. Steel Rod 12mm" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="item_name" label="Item Name" rules={[{ required: isRequired('item_name', false), message: 'Item Name is required' }]}>
              <Input placeholder="Optional short name" />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <Title level={5}>Company Mappings</Title>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="Assign to Companies">
              <CompanySelector
                mode="multiple"
                value={companyIds}
                onChange={setCompanyIds}
                placeholder="Select companies to assign this item to"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <Title level={5}>Secondary <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(optional)</Text></Title>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="uom" label="UOM (free text)" initialValue="Nos" rules={[{ required: isRequired('uom', false), message: 'UOM is required' }]}>
              <Input placeholder="Nos" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="category" label="Category (free text)" rules={[{ required: isRequired('category', false), message: 'Category is required' }]}>
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="category_id" label="Category (master)" rules={[{ required: isRequired('category_id', false), message: 'Category (Master) is required' }]}>
              <Select allowClear showSearch placeholder="Select category" optionFilterProp="label" options={(subMasters.item_category || []).map(s => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="subcategory_id" label="Subcategory (master)" rules={[{ required: isRequired('subcategory_id', false), message: 'Subcategory (Master) is required' }]}>
              <Select allowClear showSearch placeholder="Select subcategory" optionFilterProp="label" options={(subMasters.item_subcategory || []).map(s => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="uom_id" label="UOM (master)" rules={[{ required: isRequired('uom_id', false), message: 'UOM (Master) is required' }]}>
              <Select allowClear showSearch placeholder="Select UOM" optionFilterProp="label" options={(subMasters.uom || []).map(s => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="hsn_sac_code" label="HSN/SAC Code" rules={[{ required: isRequired('hsn_sac_code', false), message: 'HSN/SAC Code is required' }]}>
              <Input placeholder="Optional" maxLength={20} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="standard_cost" label="Standard Cost" rules={[{ required: isRequired('standard_cost', false), message: 'Standard Cost is required' }]}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="currency" label="Currency" initialValue="INR" rules={[{ required: isRequired('currency', false), message: 'Currency is required' }]}>
              <Select options={(subMasters.currency || []).map(s => ({ value: s.name, label: s.name }))} />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <Title level={5} style={{ marginTop: 0 }}>Specification Template <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(attribute name / value pairs)</Text></Title>
        {specRows.map((row, i) => (
          <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
            <Col span={11}><Input placeholder="Attribute name (e.g. Material)" value={row.key} onChange={e => updateSpecRow(i, 'key', e.target.value)} /></Col>
            <Col span={11}><Input placeholder="Value (e.g. Stainless Steel)" value={row.value} onChange={e => updateSpecRow(i, 'value', e.target.value)} /></Col>
            <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeSpecRow(i)} /></Col>
          </Row>
        ))}
        <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addSpecRow} block>Add Attribute</Button>

        <Divider />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
          <Button onClick={() => { setShowForm(false); setEditing(null); setSpecRows([]); setCompanyIds([]); }}>Cancel</Button>
        </Space>
      </Form>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW (full page) ───
  if (selected) {
    const benchmark = priceBenchmark?.benchmark;
    const overviewTab = (
      <Card>
        <Row gutter={[16, 16]}>
          <Col span={8}><Text type="secondary">Item Name</Text><br /><Text strong>{selected.item_name || '—'}</Text></Col>
          <Col span={8}><Text type="secondary">UOM</Text><br /><Text strong>{selected.uom || '—'}</Text></Col>
          <Col span={8}><Text type="secondary">Category</Text><br /><Text strong>{selected.category || '—'}</Text></Col>
          <Col span={8}><Text type="secondary">HSN/SAC</Text><br /><Text strong>{selected.hsn_sac_code || '—'}</Text></Col>
          <Col span={8}><Text type="secondary">Standard Cost</Text><br /><Text strong>{selected.standard_cost != null ? `${selected.currency || 'INR'} ${selected.standard_cost}` : '—'}</Text></Col>
        </Row>
        <Divider />
        <Title level={5}>Specification Template</Title>
        {Object.entries(parseMaybeJson(selected.specification_template) || {}).length === 0 && <Text type="secondary">None recorded</Text>}
        <Row gutter={[8, 8]}>
          {Object.entries(parseMaybeJson(selected.specification_template) || {}).map(([key, value]) => (
            <Col span={8} key={key}><Text type="secondary">{key}</Text><br /><Text strong>{value || '—'}</Text></Col>
          ))}
        </Row>
      </Card>
    );

    const insightsTab = priceBenchmarkLoading ? <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div> : !benchmark ? <Empty description="No price insights available" /> : (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Alert
          type={priceBenchmark.insight.level === 'warning' ? 'warning' : 'info'}
          showIcon
          message={priceBenchmark.insight.message}
        />
        <Card size="small" title="Market Benchmark">
          <Row gutter={16}>
            <Col span={6}><Statistic title="Records" value={benchmark.record_count} /></Col>
            <Col span={6}><Statistic title="Avg Price" value={benchmark.avg_price ?? '—'} /></Col>
            <Col span={6}><Statistic title="Min / Max" value={benchmark.min_price != null ? `${benchmark.min_price} / ${benchmark.max_price}` : '—'} /></Col>
            <Col span={6}><Statistic title="Last Price" value={benchmark.last_price ?? '—'} /></Col>
          </Row>
        </Card>
        <Card size="small" title="Cost Deviation vs Standard Cost">
          <Tag color={priceBenchmark.cost_deviation.status === 'above_standard' ? 'red' : priceBenchmark.cost_deviation.status === 'below_standard' ? 'blue' : 'green'}>
            {priceBenchmark.cost_deviation.status.replace('_', ' ').toUpperCase()}
          </Tag>
          {priceBenchmark.cost_deviation.deviation_pct != null && <Text style={{ marginLeft: 8 }}>{priceBenchmark.cost_deviation.deviation_pct}% deviation</Text>}
        </Card>
        {priceBenchmark.vendor_breakdown.length > 0 && (
          <Card size="small" title="Price by Vendor">
            <Table
              size="small" pagination={false} rowKey="vendor_id"
              dataSource={priceBenchmark.vendor_breakdown}
              columns={[
                { title: 'Vendor', dataIndex: 'vendor_name' },
                { title: 'Records', dataIndex: 'record_count', width: 90 },
                { title: 'Avg Price', dataIndex: 'avg_price', width: 110 },
                { title: 'Last Price', dataIndex: 'last_price', width: 110 },
              ]}
            />
          </Card>
        )}
      </Space>
    );

    const vendorsTab = (
      <Card size="small">
        <Table
          size="small"
          rowKey="vendor_id"
          loading={vendorMappingLoading}
          dataSource={itemVendors}
          pagination={false}
          columns={[
            { title: 'Vendor', dataIndex: 'vendor_name', render: v => v || <Text type="secondary">—</Text> },
            { title: 'Preferred', dataIndex: 'is_preferred', width: 90, render: v => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
            {
              title: '', width: 60, render: (_, record) => (
                <Popconfirm title="Remove this mapping?" onConfirm={() => handleRemoveVendorMapping(record.vendor_id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              ),
            },
          ]}
          style={{ marginBottom: 16 }}
        />
        <Divider style={{ margin: '12px 0' }} />
        <Row gutter={12} align="middle">
          <Col span={14}>
            <Select showSearch placeholder="Select vendor to add" optionFilterProp="label" style={{ width: '100%' }}
              value={newVendorId} onChange={setNewVendorId} options={vendorOptions.map(v => ({ value: v.id, label: v.vendor_name }))} />
          </Col>
          <Col span={6}><Checkbox checked={newVendorPreferred} onChange={e => setNewVendorPreferred(e.target.checked)}>Preferred</Checkbox></Col>
          <Col span={4}><Button type="primary" block onClick={handleAddVendorMapping}>Add</Button></Col>
        </Row>
      </Card>
    );

    return (
      <div style={{ padding: '24px' }}>
        <PageHeader
          items={[{ title: 'Procurement' }, { title: 'Item Master', onClick: () => setSelected(null) }, { title: selected.item_code }]}
          title={selected.item_code}
          subtitle={selected.item_description}
          onBack={() => setSelected(null)}
          extra={canManage && <Button type="primary" icon={<EditOutlined />} onClick={() => openEdit(selected)}>Edit</Button>}
        />

        <Tabs
          activeKey={detailTab}
          onChange={onDetailTabChange}
          type="card"
          items={[
            { key: 'overview', label: 'Overview', children: overviewTab },
            { key: 'insights', label: <span><BulbOutlined /> Price Insights</span>, children: insightsTab },
            { key: 'vendors', label: <span><TeamOutlined /> Preferred Vendors</span>, children: vendorsTab },
          ]}
        />
      </div>
    );
  }

  // ─── LIST VIEW (full page) ───
  const withStandardCost = data.filter(i => i.standard_cost != null).length;
  const withoutCategory = data.filter(i => !i.category && !i.category_id).length;

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Item Master' }]}
        title="Item Master"
        subtitle="Master list of items used to drive RFQ and procurement line items"
        extra={<Space><Button icon={<DownloadOutlined />} onClick={() => window.open(`${API_BASE_URL}/api/item-master/export`)}>Export to Excel</Button>{canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Item</Button>}</Space>}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Items" value={data.length} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="With Standard Cost" value={withStandardCost} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Without Category" value={withoutCategory} valueStyle={withoutCategory > 0 ? { color: '#d48806' } : undefined} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Showing" value={data.length} suffix={search ? `(filtered: "${search}")` : ''} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input placeholder="Search by code or description" value={search} onChange={e => setSearch(e.target.value)} onPressEnter={handleSearch} style={{ width: 280 }} />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
          <Button onClick={handleClear}>Clear</Button>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} scroll={{ x: 670 }} />
      </Card>
    </div>
  );
}
