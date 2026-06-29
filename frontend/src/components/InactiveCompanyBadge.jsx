import { Tag } from 'antd';

/**
 * Simple presentational badge that indicates a company is inactive.
 * Renders a red Tag with "Inactive Company" text, or null if not shown.
 */
export default function InactiveCompanyBadge({ show }) {
  if (!show) return null;
  return <Tag color="red">Inactive Company</Tag>;
}
