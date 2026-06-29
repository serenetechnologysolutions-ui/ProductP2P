import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const FieldConfigContext = createContext(null);

export function FieldConfigProvider({ children }) {
  const [configs, setConfigs] = useState({});
  const pending = useRef({});

  // `context` (e.g. { total_value: 1200000 }) drives Conditional Mandatory
  // Fields — a distinct context gets its own cache entry since the
  // effective mandatory map can differ per context (omit it for the common
  // case of a module with no conditional fields, which caches exactly like before).
  const loadModule = useCallback((moduleKey, context) => {
    const contextKey = context ? JSON.stringify(context) : '';
    const cacheKey = contextKey ? `${moduleKey}::${contextKey}` : moduleKey;
    if (!configs[cacheKey] && !pending.current[cacheKey]) {
      pending.current[cacheKey] = true;
      api.get(`/system/field-config/${moduleKey}`, { params: context || {} })
        .then(res => setConfigs(prev => ({ ...prev, [cacheKey]: res.data.data || res.data || {} })))
        .catch(() => { /* keep using per-field fallbacks on error */ })
        .finally(() => { delete pending.current[cacheKey]; });
    }

    const visKey = `${moduleKey}::visibility`;
    if (!configs[visKey] && !pending.current[visKey]) {
      pending.current[visKey] = true;
      api.get(`/system/field-config/${moduleKey}/visibility`)
        .then(res => setConfigs(prev => ({ ...prev, [visKey]: res.data.data || res.data || {} })))
        .catch(() => { /* keep using per-field fallbacks on error */ })
        .finally(() => { delete pending.current[visKey]; });
    }
  }, [configs]);

  return (
    <FieldConfigContext.Provider value={{ configs, loadModule }}>
      {children}
    </FieldConfigContext.Provider>
  );
}

// Returns isRequired(fieldKey, fallback) reading the admin-configured mandatory
// flag for `moduleKey` (Conditional Mandatory Fields: true if statically
// required OR a condition_rule matches `context`), falling back to the
// form's own default while the config is still loading (or if it failed to
// load) so behavior never silently relaxes. Also returns isVisible(fieldKey,
// fallback) for Role-Based Visibility — defaults to visible (fallback=true)
// since most fields aren't role-restricted.
export function useFieldConfig(moduleKey, context) {
  const ctx = useContext(FieldConfigContext);
  if (!ctx) throw new Error('useFieldConfig must be used within a FieldConfigProvider');
  const { configs, loadModule } = ctx;

  const contextKey = context ? JSON.stringify(context) : '';
  useEffect(() => { loadModule(moduleKey, context); }, [moduleKey, contextKey, loadModule]);

  const moduleConfig = configs[contextKey ? `${moduleKey}::${contextKey}` : moduleKey];
  const visibilityConfig = configs[`${moduleKey}::visibility`];

  const isRequired = useCallback((fieldKey, fallback = false) => {
    if (!moduleConfig || !(fieldKey in moduleConfig)) return fallback;
    return moduleConfig[fieldKey];
  }, [moduleConfig]);

  const isVisible = useCallback((fieldKey, fallback = true) => {
    if (!visibilityConfig || !(fieldKey in visibilityConfig)) return fallback;
    return visibilityConfig[fieldKey];
  }, [visibilityConfig]);

  return { isRequired, isVisible, loading: !moduleConfig };
}
