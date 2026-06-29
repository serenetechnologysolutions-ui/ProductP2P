import { useState, useEffect } from 'react';
import { Select } from 'antd';
import api from '../api/axios';

/**
 * Company-scoped vendor dropdown.
 * Fetches vendors mapped to the selected company.
 * Shows placeholder when no company is selected.
 */
export default function VendorDropdown({
  companyId,
  value,
  onChange,
  placeholder = 'Select Vendor',
  style,
  disabled,
}) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!companyId) {
      setVendors([]);
      return;
    }

    const fetchVendors = async () => {
      setLoading(true);
      try {
        const res = await api.get('/vendors', {
          params: { company_id: companyId, limit: 500 },
        });
        if (!cancelled) {
          setVendors(res.data.data || []);
        }
      } catch {
        if (!cancelled) setVendors([]);
      }
      if (!cancelled) setLoading(false);
    };
    fetchVendors();
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
      options={vendors.map((v) => ({
        value: v.id,
        label: v.vendor_name,
      }))}
    />
  );
}
