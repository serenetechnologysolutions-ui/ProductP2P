import { Breadcrumb, Typography, Space, Button, Row, Col } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Shared page header: breadcrumb trail + title/subtitle + optional back
// button + an actions slot — used app-wide so every module gets the same
// "Header + breadcrumb" treatment instead of each page hand-rolling its own.
// `items` is an array of breadcrumb segments — plain strings or
// { title, onClick } for clickable ones; "Home" is prepended automatically.
export default function PageHeader({ items = [], title, subtitle, onBack, backText = 'Back', extra }) {
  const breadcrumbItems = [
    { title: <HomeOutlined /> },
    ...items.map(item => (typeof item === 'string' ? { title: item } : { title: item.title, onClick: item.onClick, href: item.onClick ? '#' : undefined })),
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 8 }} />
      <Row align="middle" justify="space-between" wrap={false} gutter={16}>
        <Col flex="auto">
          <Space align="center">
            {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>{backText}</Button>}
            <div>
              <Title level={3} style={{ margin: 0 }}>{title}</Title>
              {subtitle && <Text type="secondary">{subtitle}</Text>}
            </div>
          </Space>
        </Col>
        {extra && <Col>{extra}</Col>}
      </Row>
    </div>
  );
}
