import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const FieldConfigContext = createContext(null);

export function FieldConfigProvider({ children }) {
  const [configs, setConfigs] = useState({});
  const pending = useRef({});

  const loadModule = useCallback((moduleKey) => {
    if (configs[moduleKey] || pending.current[moduleKey]) return;
    pending.current[moduleKey] = true;
    api.get(`/system/field-config/${moduleKey}`)
      .then(res => setConfigs(prev => ({ ...prev, [moduleKey]: res.data.data || res.data || {} })))
      .catch(() => { /* keep using per-field fallbacks on error */ })
      .finally(() => { delete pending.current[moduleKey]; });
  }, [configs]);

  return (
    <FieldConfigContext.Provider value={{ configs, loadModule }}>
      {children}
    </FieldConfigContext.Provider>
  );
}

// Returns isRequired(fieldKey, fallback) reading the admin-configured mandatory
// flag for `moduleKey`, falling back to the form's own default while the config
// is still loading (or if it failed to load) so behavior never silently relaxes.
export function useFieldConfig(moduleKey) {
  const ctx = useContext(FieldConfigContext);
  if (!ctx) throw new Error('useFieldConfig must be used within a FieldConfigProvider');
  const { configs, loadModule } = ctx;

  useEffect(() => { loadModule(moduleKey); }, [moduleKey, loadModule]);

  const moduleConfig = configs[moduleKey];
  const isRequired = useCallback((fieldKey, fallback = false) => {
    if (!moduleConfig || !(fieldKey in moduleConfig)) return fallback;
    return moduleConfig[fieldKey];
  }, [moduleConfig]);

  return { isRequired, loading: !moduleConfig };
}
