import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, InputNumber, Select, Tag, Space, Card, Typography, Popconfirm, message, Row, Col, Modal, Checkbox, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, TeamOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => ({ value: c, label: c }));

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export default function ItemMaster() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [subMasters, setSubMasters] = useState({ item_category: [], item_subcategory: [], uom: [] });
  const [specRows, setSpecRows] = useState([]);

  // Preferred vendors modal state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorModalItem, setVendorModalItem] = useState(null);
  const [itemVendors, setItemVendors] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [newVendorId, setNewVendorId] = useState(null);
  const [newVendorPreferred, setNewVendorPreferred] = useState(false);
  const [vendorMappingLoading, setVendorMappingLoading] = useState(false);

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
        const cats = ['item_category', 'item_subcategory', 'uom'];
        const results = {};
        for (const cat of cats) { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; }
        setSubMasters(results);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSearch = () => fetchData(search);
  const handleClear = () => { setSearch(''); fetchData(); };

  const openCreate = () => { setEditing(null); form.resetFields(); setSpecRows([]); setShowForm(true); };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    const specObj = parseMaybeJson(record.specification_template) || {};
    setSpecRows(Object.entries(specObj).map(([key, value]) => ({ key, value })));
    setShowForm(true);
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
        message.success('Item updated');
      } else {
        await api.post('/item-master', payload);
        message.success('Item created');
      }
      setShowForm(false);
      setEditing(null);
      setSpecRows([]);
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
      fetchData(search);
    } catch { message.error('Failed to remove item'); }
  };

  // ─── Preferred Vendors modal ───
  const openVendorModal = async (record) => {
    setVendorModalItem(record);
    setVendorModalOpen(true);
    setNewVendorId(null);
    setNewVendorPreferred(false);
    await fetchItemVendors(record.id);
    if (vendorOptions.length === 0) {
      try {
        const res = await api.get('/vendors', { params: { limit: 200 } });
        setVendorOptions(res.data.data || []);
      } catch { /* ignore */ }
    }
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
      await api.post(`/item-master/${vendorModalItem.id}/vendors`, { vendor_id: newVendorId, is_preferred: newVendorPreferred });
      message.success('Vendor mapping saved');
      setNewVendorId(null);
      setNewVendorPreferred(false);
      fetchItemVendors(vendorModalItem.id);
    } catch (err) { message.error(err.response?.data?.error || 'Failed to save mapping'); }
  };

  const handleRemoveVendorMapping = async (vendorId) => {
    try {
      await api.delete(`/item-master/${vendorModalItem.id}/vendors/${vendorId}`);
      message.success('Vendor mapping removed');
      fetchItemVendors(vendorModalItem.id);
    } catch { message.error('Failed to remove mapping'); }
  };

  const closeVendorModal = () => { setVendorModalOpen(false); setVendorModalItem(null); setItemVendors([]); };

  const columns = [
    { title: 'Item Code', dataIndex: 'item_code', width: 130, render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Description', dataIndex: 'item_description' },
    { title: 'Item Name', dataIndex: 'item_name', width: 160, render: v => v || <Text type="secondary">—</Text> },
    { title: 'UOM', dataIndex: 'uom', width: 90 },
    { title: 'Category', dataIndex: 'category', width: 140, render: v => v || <Text type="secondary">—</Text> },
    { title: 'HSN/SAC', dataIndex: 'hsn_sac_code', width: 100, render: v => v || <Text type="secondary">—</Text> },
    { title: 'Standard Cost', dataIndex: 'standard_cost', width: 130, render: (v, r) => v != null ? `${r.currency || 'INR'} ${v}` : <Text type="secondary">—</Text> },
    {
      title: 'Actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button icon={<TeamOutlined />} size="small" title="Preferred Vendors" onClick={() => openVendorModal(record)} />
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="Remove this item?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Item Master</Title>
          <Text type="secondary">Master list of items used to drive RFQ and procurement line items</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Item</Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search by code or description"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 280 }}
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
          <Button onClick={handleClear}>Clear</Button>
        </Space>
      </Card>

      {showForm && (
        <Card size="small" title={editing ? 'Edit Item' : 'Add Item'} style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="item_code" label="Item Code" rules={[{ required: true, message: 'Enter item code' }]}>
                  <Input placeholder="e.g. ITM-001" disabled={!!editing} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="item_description" label="Item Description" rules={[{ required: true, message: 'Enter description' }]}>
                  <Input placeholder="e.g. Steel Rod 12mm" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="item_name" label="Item Name">
                  <Input placeholder="Optional short name" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={4}>
                <Form.Item name="uom" label="UOM (free text)" initialValue="Nos">
                  <Input placeholder="Nos" />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="category" label="Category (free text)">
                  <Input placeholder="Optional" />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="category_id" label="Category (master)">
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select category"
                    optionFilterProp="label"
                    options={(subMasters.item_category || []).map(s => ({ value: s.id, label: s.name }))}
                  />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="subcategory_id" label="Subcategory (master)">
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select subcategory"
                    optionFilterProp="label"
                    options={(subMasters.item_subcategory || []).map(s => ({ value: s.id, label: s.name }))}
                  />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name="uom_id" label="UOM (master)">
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select UOM"
                    optionFilterProp="label"
                    options={(subMasters.uom || []).map(s => ({ value: s.id, label: s.name }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="hsn_sac_code" label="HSN/SAC Code">
                  <Input placeholder="Optional" maxLength={20} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="standard_cost" label="Standard Cost">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="currency" label="Currency" initialValue="INR">
                  <Select options={CURRENCY_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5} style={{ marginTop: 0 }}>Specification Template <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>(attribute name / value pairs)</Text></Title>
            {specRows.map((row, i) => (
              <Row gutter={12} key={i} style={{ marginBottom: 8 }} align="middle">
                <Col span={10}><Input placeholder="Attribute name (e.g. Material)" value={row.key} onChange={e => updateSpecRow(i, 'key', e.target.value)} /></Col>
                <Col span={10}><Input placeholder="Value (e.g. Stainless Steel)" value={row.value} onChange={e => updateSpecRow(i, 'value', e.target.value)} /></Col>
                <Col span={2}><Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeSpecRow(i)} /></Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addSpecRow} block>Add Attribute</Button>

            <Divider />
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
              <Button onClick={() => { setShowForm(false); setEditing(null); setSpecRows([]); }}>Cancel</Button>
            </Space>
          </Form>
        </Card>
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={vendorModalItem ? `Preferred Vendors — ${vendorModalItem.item_description}` : 'Preferred Vendors'}
        open={vendorModalOpen}
        onCancel={closeVendorModal}
        footer={<Button onClick={closeVendorModal}>Close</Button>}
        destroyOnClose
      >
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
            <Select
              showSearch
              placeholder="Select vendor to add"
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={newVendorId}
              onChange={setNewVendorId}
              options={vendorOptions.map(v => ({ value: v.id, label: v.vendor_name }))}
            />
          </Col>
          <Col span={6}>
            <Checkbox checked={newVendorPreferred} onChange={e => setNewVendorPreferred(e.target.checked)}>Preferred</Checkbox>
          </Col>
          <Col span={4}>
            <Button type="primary" block onClick={handleAddVendorMapping}>Add</Button>
          </Col>
        </Row>
      </Modal>
    </div>
  );
}
