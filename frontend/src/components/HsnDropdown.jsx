import { useState, useEffect } from 'react';
import { Select } from 'antd';
import api from '../api/axios';

/**
 * Searchable HSN code dropdown.
 * Fetches HSN codes from sub_masters (category='hsn_code').
 * Emits onChange(selectedId, option) where option carries code, name, tax_percentage.
 */
export default function HsnDropdown({ value, onChange, style, disabled, ...rest }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/sub-masters/hsn_code')
      .then(res => {
        setOptions((res.data.data || []).map(r => ({
          value: r.code || r.name,
          label: `${r.code || r.name} — ${r.name} (${r.tax_percentage ?? 0}%)`,
          code: r.code || r.name,
          name: r.name,
          tax_percentage: r.tax_percentage,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Select
      showSearch
      allowClear
      placeholder="Select HSN Code"
      value={value}
      onChange={(val, option) => onChange(val, option)}
      loading={loading}
      style={style}
      disabled={disabled}
      filterOption={(input, option) => {
        const search = input.toLowerCase();
        return (
          (option.code || '').toLowerCase().includes(search) ||
          (option.name || '').toLowerCase().includes(search)
        );
      }}
      options={options}
      {...rest}
    />
  );
}
