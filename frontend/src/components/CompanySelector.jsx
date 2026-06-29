import { useState, useEffect } from 'react';
import { Select } from 'antd';
import api from '../api/axios';

/**
 * Reusable company selector dropdown.
 * Fetches active companies the current user has access to (API handles filtering).
 * Emits onChange with selected company_id for dependent dropdowns.
 */
export default function CompanySelector({
  value,
  onChange,
  placeholder = 'Select Company',
  style,
  disabled,
  mode,
}) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCompanies = async () => {
      setLoading(true);
      try {
        const res = await api.get('/companies', { params: { active_only: true } });
        if (!cancelled) {
          setCompanies(res.data.data || []);
        }
      } catch {
        if (!cancelled) setCompanies([]);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCompanies();
    return () => { cancelled = true; };
  }, []);

  return (
    <Select
      showSearch
      allowClear
      mode={mode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      loading={loading}
      optionFilterProp="label"
      options={companies.map((c) => ({
        value: c.id,
        label: c.company_name,
      }))}
    />
  );
}
