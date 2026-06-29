import { useState } from 'react';
import { Upload, Button, Card, Table, Row, Col, Statistic, Space, message, Typography, Alert } from 'antd';
import { UploadOutlined, InboxOutlined, CheckCircleOutlined, WarningOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../api/axios';
import CompanySelector from '../components/CompanySelector';
import PageHeader from '../components/ui/PageHeader';

const { Dragger } = Upload;
const { Text } = Typography;

export default function ItemImport() {
  const [file, setFile] = useState(null);
  const [companyIds, setCompanyIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      message.error('Please select an .xlsx file');
      return;
    }
    if (!companyIds || companyIds.length === 0) {
      message.error('Please select at least one company');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_ids', JSON.stringify(companyIds));

    setUploading(true);
    setSummary(null);
    try {
      const res = await api.post('/item-master/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(res.data.data);
      message.success('Import completed');
    } catch (err) {
      message.error(err.response?.data?.error || err.response?.data?.message || 'Import failed');
    }
    setUploading(false);
  };

  const uploadProps = {
    accept: '.xlsx',
    maxCount: 1,
    beforeUpload: (f) => {
      setFile(f);
      return false; // prevent auto-upload
    },
    onRemove: () => {
      setFile(null);
    },
    fileList: file ? [file] : [],
  };

  const errorColumns = [
    { title: 'Row', dataIndex: 'row', width: 80 },
    { title: 'Error', dataIndex: 'message' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        items={[{ title: 'Procurement' }, { title: 'Item Master Import' }]}
        title="Item Master Import"
        subtitle="Bulk import items from an Excel (.xlsx) file"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Assign Companies</Text>
            <CompanySelector
              mode="multiple"
              value={companyIds}
              onChange={setCompanyIds}
              placeholder="Select companies to assign to imported items"
              style={{ width: '100%' }}
            />
          </div>

          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag an .xlsx file here</p>
            <p className="ant-upload-hint">Only .xlsx files are accepted</p>
          </Dragger>

          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            disabled={!file || companyIds.length === 0}
          >
            Import
          </Button>
        </Space>
      </Card>

      {summary && (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Rows"
                  value={summary.total_rows}
                  prefix={<FileExcelOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Successful"
                  value={summary.successful_count}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Skipped"
                  value={summary.skipped_count}
                  valueStyle={summary.skipped_count > 0 ? { color: '#d48806' } : undefined}
                  prefix={<WarningOutlined />}
                />
              </Col>
            </Row>
          </Card>

          {summary.errors && summary.errors.length > 0 && (
            <Card size="small" title="Import Errors">
              <Table
                dataSource={summary.errors}
                columns={errorColumns}
                rowKey={(r, i) => `${r.row}-${i}`}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          )}

          {summary.errors && summary.errors.length === 0 && (
            <Alert type="success" showIcon message="All rows imported successfully — no errors." />
          )}
        </>
      )}
    </div>
  );
}
