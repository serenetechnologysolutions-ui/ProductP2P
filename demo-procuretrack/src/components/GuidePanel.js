import { useState } from 'react';
import { Typography, Progress } from 'antd';
import { BulbOutlined, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function GuidePanel({ step, total, title, description }) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        <div onClick={() => setCollapsed(false)} style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1890ff, #722ed1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <QuestionCircleOutlined style={{ color: '#fff', fontSize: 22 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="demo-guide">
      <div className="demo-guide-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><BulbOutlined style={{ marginRight: 8 }} />Step {step} of {total}</span>
        <CloseOutlined style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => setCollapsed(true)} />
      </div>
      <div className="demo-guide-body">
        <Progress percent={Math.round((step / total) * 100)} size="small" showInfo={false} style={{ marginBottom: 8 }} />
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{title}</Text>
        <div className="demo-guide-step">{description}</div>
      </div>
    </div>
  );
}
