import { Card, Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Drawer/Modal replacement (UX_TRANSFORMATION_PLAN.md §2.3). Renders inline, in normal page
// flow, right where it's triggered from — never as an overlay/portal — so the rest of the page
// (and its context) stays visible and scrollable while the panel is open.
export default function InlineExpandPanel({
  open,
  title,
  description,
  children,
  onCancel,
  onSubmit,
  submitText = 'Save',
  submitDanger = false,
  loading = false,
  cancelText = 'Cancel',
  extraFooter,
  hideFooter = false,
  style,
}) {
  if (!open) return null;

  return (
    <Card
      size="small"
      title={title}
      style={{
        marginTop: 12,
        marginBottom: 16,
        borderLeft: `3px solid ${submitDanger ? '#ff4d4f' : '#1890ff'}`,
        ...style,
      }}
      extra={<Button type="text" size="small" icon={<CloseOutlined />} onClick={onCancel} />}
    >
      {description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{description}</Text>
      )}
      {children}
      {!hideFooter && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {extraFooter}
          <Button onClick={onCancel}>{cancelText}</Button>
          {onSubmit && (
            <Button type="primary" danger={submitDanger} loading={loading} onClick={onSubmit}>
              {submitText}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
