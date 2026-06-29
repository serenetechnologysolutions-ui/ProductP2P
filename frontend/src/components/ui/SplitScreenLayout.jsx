import { Row, Col } from 'antd';

// Default master-data layout (UX_TRANSFORMATION_PLAN.md §2.2) — list on the left, detail/edit on
// the right, both visible at once so selecting a different row never navigates away or loses
// the list's scroll/filter state.
export default function SplitScreenLayout({ list, detail, listSpan = 9 }) {
  return (
    <Row gutter={16}>
      <Col span={listSpan} style={{ minWidth: 0 }}>{list}</Col>
      <Col span={24 - listSpan} style={{ minWidth: 0 }}>{detail}</Col>
    </Row>
  );
}
