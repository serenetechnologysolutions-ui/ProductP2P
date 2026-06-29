import { Tag } from 'antd';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';

// Centralizes the cross-module status color convention documented in the
// product reference (§4.7): green = good/approved, red = bad/rejected,
// blue = neutral/in-motion, orange = needs attention, grey = inert.
// This is a NEW, opt-in component — it does not replace any page's existing
// local `*_COLOR` constant or its own <Tag> usage. Pages adopt it by passing
// their status string through `colorMap` (or relying on the default map
// below for the common verbs shared across modules); existing pages are left
// untouched unless explicitly migrated, so there is zero risk of this
// changing a color anyone is already relying on.
const DEFAULT_COLOR_MAP = {
  draft: 'default', pending: 'orange', submitted: 'blue', under_review: 'orange',
  approved: 'green', partially_approved: 'green', rejected: 'red', closed: 'green',
  open: 'blue', published: 'blue', negotiation: 'purple', awarded: 'green',
  validated: 'orange', posted: 'green', exception: 'red', completed: 'green',
  matched: 'green', blocked: 'red', active: 'green', inactive: 'default',
  expired: 'red', expiring_soon: 'orange', ok: 'green',
};

function formatLabel(status) {
  return String(status || '').replace(/_/g, ' ').toUpperCase() || '—';
}

export default function StatusTag({ status, colorMap, fallbackColor = 'default' }) {
  const uiImprovementsEnabled = useFeatureFlag('ui_improvements_enabled');
  if (!uiImprovementsEnabled) return <Tag>{formatLabel(status)}</Tag>;

  const map = colorMap || DEFAULT_COLOR_MAP;
  const color = map[status] ?? fallbackColor;
  return <Tag color={color}>{formatLabel(status)}</Tag>;
}
