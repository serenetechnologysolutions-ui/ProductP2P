import { useState, useEffect } from 'react';
import { Card, Select, DatePicker, InputNumber, Input, Button, Table, Space, Typography, message, Empty, Tag } from 'antd';
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Generic report viewer — every report type is driven entirely by the
// backend's declarative registry (reports/report-definitions.js): the filter
// form, the preview table, and the Excel export all read the same
// {filters, columns} config, so a new report type needs no frontend changes.
export default function Reports() {
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [filterValues, setFilterValues] = useState({});
  const [subMasterOptions, setSubMasterOptions] = useState({});
  const [previewRows, setPreviewRows] = useState(null);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/reports/types').then(res => {
      const types = res.data.data || [];
      setReportTypes(types);
      if (types.length > 0) setSelectedType(types[0].key);
    }).catch(() => message.error('Failed to load report types'));
  }, []);

  const currentDef = reportTypes.find(t => t.key === selectedType);

  useEffect(() => {
    setFilterValues({});
    setPreviewRows(null);
    setPreviewColumns([]);
    // Fetch sub-master options for any optionsFrom filter the newly-selected report
    // needs. Always re-fetches on type switch rather than caching, so this effect's
    // only real dependency is reportTypes/selectedType.
    const def = reportTypes.find(t => t.key === selectedType);
    (def?.filters || []).forEach(f => {
      if (f.optionsFrom) {
        api.get(`/sub-masters/${f.optionsFrom}`).then(res => {
          setSubMasterOptions(prev => ({ ...prev, [f.optionsFrom]: (res.data.data || []).map(s => ({ value: s.name, label: s.name })) }));
        }).catch(() => {});
      }
    });
  }, [selectedType, reportTypes]);

  const buildParams = () => {
    const params = {};
    (currentDef?.filters || []).forEach(f => {
      const v = filterValues[f.key];
      if (v === undefined || v === null || v === '') return;
      if (f.type === 'date_range' && Array.isArray(v)) {
        params.date_from = v[0].format('YYYY-MM-DD');
        params.date_to = v[1].format('YYYY-MM-DD');
      } else if (f.type === 'value_range') {
        if (v.min != null) params.min_value = v.min;
        if (v.max != null) params.max_value = v.max;
      } else {
        params[f.key] = v;
      }
    });
    return params;
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${selectedType}/preview`, { params: buildParams() });
      setPreviewRows(res.data.data || []);
      setPreviewColumns(res.data.columns || currentDef?.columns || []);
      setTruncated(!!res.data.truncated);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load report');
    }
    setLoading(false);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/reports/${selectedType}/export`, { params: buildParams(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedType}-${dayjs().format('YYYY-MM-DD')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      message.error('Failed to export report');
    }
    setExporting(false);
  };

  const renderFilterControl = (f) => {
    const value = filterValues[f.key];
    const setValue = (v) => setFilterValues(prev => ({ ...prev, [f.key]: v }));

    if (f.type === 'date_range') {
      return <RangePicker style={{ width: 260 }} value={value} onChange={setValue} />;
    }
    if (f.type === 'value_range') {
      return (
        <Space.Compact>
          <InputNumber placeholder="Min" style={{ width: 110 }} value={value?.min} onChange={v => setValue({ ...value, min: v })} />
          <InputNumber placeholder="Max" style={{ width: 110 }} value={value?.max} onChange={v => setValue({ ...value, max: v })} />
        </Space.Compact>
      );
    }
    if (f.type === 'select') {
      const options = f.optionsFrom ? (subMasterOptions[f.optionsFrom] || []) : (f.options || []).map(o => ({ value: o, label: o.replace(/_/g, ' ') }));
      return <Select allowClear showSearch placeholder={f.label} style={{ width: 180 }} value={value} onChange={setValue} options={options} />;
    }
    return <Input placeholder={f.label} style={{ width: 180 }} value={value} onChange={e => setValue(e.target.value)} />;
  };

  return (
    <div style={{ padding: '24px' }}>
      {uiImprovementsEnabled ? (
        <PageHeader
          items={[{ title: 'Reports' }]}
          title="Reports"
          subtitle="Pick a report, set parameters, preview on screen, then export to Excel."
        />
      ) : (
        <Typography.Title level={4} style={{ marginBottom: 16 }}>Reports</Typography.Title>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap align="start">
          <Select
            style={{ width: 240 }}
            value={selectedType}
            onChange={setSelectedType}
            options={reportTypes.map(t => ({ value: t.key, label: t.label }))}
            placeholder="Select report"
          />
          {(currentDef?.filters || []).map(f => (
            <div key={f.key}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{f.label}</Text>
              {renderFilterControl(f)}
            </div>
          ))}
        </Space>
        <div style={{ marginTop: 16 }}>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={runPreview}>View Report</Button>
            <Button icon={<FileExcelOutlined />} loading={exporting} onClick={exportExcel}>Export to Excel</Button>
          </Space>
        </div>
      </Card>

      <Card size="small" bodyStyle={{ padding: previewRows === null ? 0 : undefined }}>
        {previewRows === null ? (
          <Empty description="Set parameters and click “View Report” to preview results" style={{ padding: '48px 0' }} />
        ) : (
          <>
            {truncated && (
              <Tag color="orange" style={{ marginBottom: 12 }}>
                Showing the first 200 rows on screen — export to Excel for the full result set
              </Tag>
            )}
            <Table
              size="small"
              rowKey={(_, idx) => idx}
              dataSource={previewRows}
              loading={loading}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 20, showTotal: t => `${t} rows` }}
              columns={previewColumns.map(c => ({
                title: c.label,
                dataIndex: c.key,
                sorter: (a, b) => String(a[c.key] ?? '').localeCompare(String(b[c.key] ?? ''), undefined, { numeric: true }),
                render: v => v === null || v === undefined || v === '' ? <Text type="secondary">—</Text> : String(v),
              }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
