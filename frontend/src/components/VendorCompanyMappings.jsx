import { useState, useEffect } from 'react';
import { Table, Button, Select, Space, Card, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api/axios';

/**
 * Vendor-Company Mapping management panel.
 * Allows MDM_Admin/System_Admin to add/remove company mappings for a vendor.
 * Shows only companies the current user has access to.
 */
export default function VendorCompanyMappings({ vendorId }) {
  const [mappings, setMappings] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  const fetchMappings = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const res = await api.get('/vendor-company-mapping', { params: { vendor_id: vendorId } });
      setMappings(res.data.data || []);
    } catch {
      setMappings([]);
    }
    setLoading(false);
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies', { params: { active_only: true } });
      setCompanies(res.data.data || []);
    } catch {
      setCompanies([]);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchCompanies();
  }, [vendorId]);

  const handleAdd = async () => {
    if (!selectedCompanyId) {
      message.warning('Select a company to add');
      return;
    }
    setAdding(true);
    try {
      await api.post('/vendor-company-mapping', {
        vendor_id: vendorId,
        company_id: selectedCompanyId,
      });
      message.success('Company mapping added');
      setSelectedCompanyId(null);
      fetchMappings();
    } catch (e) {
      message.error(e.response?.data?.error || e.response?.data?.message || 'Failed to add mapping');
    }
    setAdding(false);
  };

  const handleRemove = async (mappingId) => {
    try {
      await api.delete(`/vendor-company-mapping/${mappingId}`);
      message.success('Mapping removed');
      fetchMappings();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to remove mapping');
    }
  };

  // Filter out companies that are already mapped
  const mappedCompanyIds = new Set(mappings.map(m => m.company_id));
  const availableCompanies = companies.filter(c => !mappedCompanyIds.has(c.id));

  const columns = [
    {
      title: 'Company',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (v) => v || '—',
    },
    {
      title: 'Company Code',
      dataIndex: 'company_code',
      key: 'company_code',
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Added',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="Remove this company mapping?"
          onConfirm={() => handleRemove(record.id)}
          okText="Remove"
          cancelText="Cancel"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card title="Company Mappings" size="small">
      <Space style={{ marginBottom: 12 }}>
        <Select
          showSearch
          allowClear
          placeholder="Select company to add"
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
          style={{ width: 300 }}
          optionFilterProp="label"
          options={availableCompanies.map(c => ({
            value: c.id,
            label: `${c.company_name}${c.company_code ? ` (${c.company_code})` : ''}`,
          }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={adding}
          onClick={handleAdd}
          disabled={!selectedCompanyId}
        >
          Add Mapping
        </Button>
      </Space>
      <Table
        size="small"
        rowKey="id"
        dataSource={mappings}
        columns={columns}
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'No company mappings yet' }}
      />
    </Card>
  );
}
