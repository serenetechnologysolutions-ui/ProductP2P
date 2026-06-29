import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const FeatureFlagsContext = createContext(null);

// Mirrors FieldConfigContext's shape: one provider wraps the authenticated
// app shell, fetches each flag's current value from the existing
// GET /system/settings/:key endpoint (open to any authenticated role), and
// caches it for the session. Missing/unreachable = enabled, matching the
// backend's isFeatureEnabled() default — a flag can only ever turn a
// capability off, never accidentally hide one that forgot to seed its row.
const FLAG_KEYS = ['smart_assistant_enabled', 'vendor_portal_v2_enabled', 'ui_improvements_enabled'];

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(FLAG_KEYS.map(key =>
      api.get(`/system/settings/${key}`)
        .then(res => [key, res.data?.data?.value !== 'false'])
        .catch(() => [key, true])
    )).then(entries => {
      if (cancelled) return;
      setFlags(Object.fromEntries(entries));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loaded }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// Returns true/false for a given flag key. Defaults to true (enabled) while
// still loading, on error, or for an unknown key — same "only ever turns
// something off" guarantee as the backend helper.
export function useFeatureFlag(key) {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlag must be used within a FeatureFlagsProvider');
  return ctx.flags[key] !== false;
}
