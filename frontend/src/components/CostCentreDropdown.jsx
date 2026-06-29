import { useState, useEffect } from 'react';
import { Select } from 'antd';
import api from '../api/axios';

/**
 * Company-scoped cost centre dropdown.
 * Fetches cost centres for the selected company.
 * Shows placeholder when no company is selected.
 */
export default function CostCentreDropdown({
  companyId,
  value,
  onChange,
  placeholder = 'Select Cost Centre',
  style,
  disabled,
}) {
  const [costCentres, setCostCentres] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!companyId) {
      setCostCentres([]);
      return;
    }

    const fetchCostCentres = async () => {
      setLoading(true);
      try {
        const res = await api.get('/sub-masters/cost-centre', {
          params: { company_id: companyId },
        });
        if (!cancelled) {
          setCostCentres(res.data.data || []);
        }
      } catch {
        if (!cancelled) setCostCentres([]);
      }
      if (!cancelled) setLoading(false);
    };
    fetchCostCentres();
    return () => { cancelled = true; };
  }, [companyId]);

  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={onChange}
      placeholder={companyId ? placeholder : 'Select a company first'}
      style={style}
      disabled={disabled || !companyId}
      loading={loading}
      optionFilterProp="label"
      options={costCentres.map((cc) => ({
        value: cc.name,
        label: cc.code ? `${cc.name} — ${cc.code}` : cc.name,
      }))}
    />
  );
}
