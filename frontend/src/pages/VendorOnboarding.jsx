import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Steps, Row, Col, Card, Typography, Divider, Select, Upload, Checkbox, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Title, Text } = Typography;
const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => ({ value: c, label: c }));

export default function VendorOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [vendor, setVendor] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subMasters, setSubMasters] = useState({});

  const user = (() => { try { return JSON.parse(localStorage.getItem('vendor_user')) || {}; } catch { return {}; } })();

  useEffect(() => {
    if (user.vendorId) {
      api.get(`/vendors/${user.vendorId}`).then(res => {
        const v = res.data.data;
        setVendor(v);
        const serviceableRegions = (() => {
          if (!v.serviceable_regions) return [];
          if (Array.isArray(v.serviceable_regions)) return v.serviceable_regions;
          try { return JSON.parse(v.serviceable_regions); } catch { return []; }
        })();
        form.setFieldsValue({ ...v, serviceable_regions: serviceableRegions });
        setAddresses(v.addresses || []);
        setBankAccounts(v.bank_accounts || []);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cats = ['city', 'state', 'country', 'vendor_type', 'industry', 'registration_type'];
        const results = {};
        for (const cat of cats) { const res = await api.get(`/sub-masters/${cat}`); results[cat] = res.data.data || []; }
        setSubMasters(results);
      } catch (_) {}
    })();
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Save all data first
      const values = form.getFieldsValue(true);
      await api.put(`/vendors/${user.vendorId}/onboarding`, { ...values, addresses, bank_accounts: bankAccounts });
      // Then submit for approval
      await api.post(`/vendors/${user.vendorId}/submit`);
      message.success('Submitted for approval');
      const res = await api.get(`/vendors/${user.vendorId}`);
      setVendor(res.data.data);
    } catch (err) { message.error(err.response?.data?.error || 'Submit failed'); }
    setLoading(false);
  };

  const addAddress = () => setAddresses([...addresses, { line1: '', line2: '', city: '', state: '', country: 'India', pin_code: '', tags: [] }]);
  const removeAddress = (i) => setAddresses(addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i, field, value) => setAddresses(addresses.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  const addBank = () => setBankAccounts([...bankAccounts, { ifsc_code: '', account_number: '', account_holder_name: '', bank_name: '', branch: '', city: '', state: '', country: 'India' }]);
  const removeBank = (i) => setBankAccounts(bankAccounts.filter((_, idx) => idx !== i));
  const updateBank = (i, field, value) => setBankAccounts(bankAccounts.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  const steps = [
    { title: 'Business Info' },
    { title: 'Addresses' },
    { title: 'Bank Accounts' },
    { title: 'Documents' },
    { title: 'Contacts' },
  ];

  return (
    <div>
      <Title level={4}>My Profile</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Complete your business information, addresses, bank details, and upload required documents. Submit for admin approval once all details are filled.</Text>
      {vendor && <Text type="secondary">Status: <strong>{vendor.status?.toUpperCase().replace('_', ' ')}</strong></Text>}
      <Card size="small" style={{ margin: '16px 0' }}>
        <Steps current={currentStep} items={steps} onChange={setCurrentStep} size="small" />
      </Card>
      <Card>
        <Form form={form} layout="vertical">
          {currentStep === 0 && (
            <div>
              <Title level={5}>Core Info (Read Only)</Title>
              <Row gutter={16}>
                <Col span={8}><Form.Item label="Vendor Name"><Input disabled value={vendor?.vendor_name} /></Form.Item></Col>
                <Col span={8}><Form.Item label="Email"><Input disabled value={vendor?.email} /></Form.Item></Col>
                <Col span={8}><Form.Item label="Phone"><Input disabled value={vendor?.phone} /></Form.Item></Col>
              </Row>
              <Divider />
              <Title level={5}>Business Information</Title>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="gst_number" label="GST Number"><Input placeholder="15-char GST" maxLength={15} /></Form.Item></Col>
                <Col span={6}><Form.Item name="pan_number" label="PAN Number"><Input placeholder="10-char PAN" maxLength={10} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="trade_name" label="Trade Name"><Input placeholder="Trade name" /></Form.Item></Col>
                <Col span={6}><Form.Item name="legal_name" label="Legal Name"><Input placeholder="Legal name" /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="msme_type" label="MSME Type"><Select placeholder="Select" options={[{ value: 'micro' }, { value: 'small' }, { value: 'medium' }]} allowClear /></Form.Item></Col>
                <Col span={6}><Form.Item name="itr_filing_status" label="ITR Filing"><Select placeholder="Select" options={[{ value: 'filed' }, { value: 'not_filed' }]} allowClear /></Form.Item></Col>
              </Row>
              <Divider />
              <Title level={5}>Classification</Title>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="vendor_type" label="Vendor Type"><Select showSearch placeholder="Select" options={(subMasters.vendor_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
                <Col span={6}><Form.Item name="industry" label="Industry"><Select showSearch placeholder="Select" options={(subMasters.industry || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
                <Col span={6}><Form.Item name="registration_type" label="Registration Type"><Select showSearch placeholder="Select" options={(subMasters.registration_type || []).map(s => ({ value: s.name, label: s.name }))} allowClear /></Form.Item></Col>
                <Col span={6}><Form.Item name="currency_code" label="Preferred Currency"><Select placeholder="Select" options={CURRENCY_OPTIONS} allowClear /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="geo_latitude" label="Geo Latitude"><InputNumber style={{ width: '100%' }} step={0.0000001} /></Form.Item></Col>
                <Col span={6}><Form.Item name="geo_longitude" label="Geo Longitude"><InputNumber style={{ width: '100%' }} step={0.0000001} /></Form.Item></Col>
                <Col span={12}><Form.Item name="serviceable_regions" label="Serviceable Regions"><Select mode="tags" placeholder="Type a region and press enter" /></Form.Item></Col>
              </Row>
            </div>
          )}
          {currentStep === 1 && (
            <div>
              <Title level={5}>Addresses</Title>
              {addresses.map((addr, i) => (
                <Card key={i} size="small" style={{ marginBottom: 12 }} extra={<Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeAddress(i)} />}>
                  <Row gutter={12}>
                    <Col span={12}><Input placeholder="Address Line 1" value={addr.line1} onChange={e => updateAddress(i, 'line1', e.target.value)} /></Col>
                    <Col span={12}><Input placeholder="Address Line 2" value={addr.line2} onChange={e => updateAddress(i, 'line2', e.target.value)} /></Col>
                  </Row>
                  <Row gutter={12} style={{ marginTop: 8 }}>
                    <Col span={4}><Select showSearch placeholder="City" value={addr.city || undefined} onChange={v => updateAddress(i, 'city', v)} options={(subMasters.city || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                    <Col span={4}><Select showSearch placeholder="State" value={addr.state || undefined} onChange={v => updateAddress(i, 'state', v)} options={(subMasters.state || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                    <Col span={4}><Select showSearch placeholder="Country" value={addr.country || undefined} onChange={v => updateAddress(i, 'country', v)} options={(subMasters.country || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                    <Col span={4}><Input placeholder="PIN Code" value={addr.pin_code} onChange={e => updateAddress(i, 'pin_code', e.target.value)} maxLength={6} /></Col>
                    <Col span={8}>
                      <Checkbox.Group value={addr.tags} onChange={v => updateAddress(i, 'tags', v)} options={[{ label: 'Billing', value: 'billing' }, { label: 'Shipping', value: 'shipping' }, { label: 'Registered', value: 'registered' }]} />
                    </Col>
                  </Row>
                </Card>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={addAddress} block>Add Address</Button>
            </div>
          )}
          {currentStep === 2 && (
            <div>
              <Title level={5}>Bank Accounts</Title>
              {bankAccounts.map((bank, i) => (
                <Card key={i} size="small" style={{ marginBottom: 12 }} extra={<Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeBank(i)} />}>
                  <Row gutter={12}>
                    <Col span={6}><Input placeholder="IFSC Code" value={bank.ifsc_code} onChange={e => updateBank(i, 'ifsc_code', e.target.value)} /></Col>
                    <Col span={6}><Input placeholder="Account Number" value={bank.account_number} onChange={e => updateBank(i, 'account_number', e.target.value)} /></Col>
                    <Col span={6}><Input placeholder="Account Holder" value={bank.account_holder_name} onChange={e => updateBank(i, 'account_holder_name', e.target.value)} /></Col>
                    <Col span={6}><Input placeholder="Bank Name" value={bank.bank_name} onChange={e => updateBank(i, 'bank_name', e.target.value)} /></Col>
                  </Row>
                  <Row gutter={12} style={{ marginTop: 8 }}>
                    <Col span={6}><Input placeholder="Branch" value={bank.branch} onChange={e => updateBank(i, 'branch', e.target.value)} /></Col>
                    <Col span={6}><Select showSearch placeholder="City" value={bank.city || undefined} onChange={v => updateBank(i, 'city', v)} options={(subMasters.city || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                    <Col span={6}><Select showSearch placeholder="State" value={bank.state || undefined} onChange={v => updateBank(i, 'state', v)} options={(subMasters.state || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                    <Col span={6}><Select showSearch placeholder="Country" value={bank.country || undefined} onChange={v => updateBank(i, 'country', v)} options={(subMasters.country || []).map(s => ({ value: s.name, label: s.name }))} style={{ width: '100%' }} allowClear /></Col>
                  </Row>
                </Card>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={addBank} block>Add Bank Account</Button>
            </div>
          )}
          {currentStep === 3 && (
            <div>
              <Title level={5}>Document Uploads</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Upload all 5 mandatory documents</Text>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small" title="PAN">
                    <Upload action={`http://localhost:5000/api/upload/vendor-document`} data={{ vendor_id: user.vendorId, doc_type: 'pan' }} headers={{ Authorization: `Bearer ${localStorage.getItem('vendor_token')}` }} maxCount={1}>
                      <Button icon={<UploadOutlined />} block>Upload PAN</Button>
                    </Upload>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="GST Certificate">
                    <Upload action={`http://localhost:5000/api/upload/vendor-document`} data={{ vendor_id: user.vendorId, doc_type: 'gst_certificate' }} headers={{ Authorization: `Bearer ${localStorage.getItem('vendor_token')}` }} maxCount={1}>
                      <Button icon={<UploadOutlined />} block>Upload GST Certificate</Button>
                    </Upload>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="CIN">
                    <Upload action={`http://localhost:5000/api/upload/vendor-document`} data={{ vendor_id: user.vendorId, doc_type: 'cin' }} headers={{ Authorization: `Bearer ${localStorage.getItem('vendor_token')}` }} maxCount={1}>
                      <Button icon={<UploadOutlined />} block>Upload CIN</Button>
                    </Upload>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="MSME Certificate">
                    <Upload action={`http://localhost:5000/api/upload/vendor-document`} data={{ vendor_id: user.vendorId, doc_type: 'msme_certificate' }} headers={{ Authorization: `Bearer ${localStorage.getItem('vendor_token')}` }} maxCount={1}>
                      <Button icon={<UploadOutlined />} block>Upload MSME Certificate</Button>
                    </Upload>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" title="Bank Proof">
                    <Upload action={`http://localhost:5000/api/upload/vendor-document`} data={{ vendor_id: user.vendorId, doc_type: 'bank_proof' }} headers={{ Authorization: `Bearer ${localStorage.getItem('vendor_token')}` }} maxCount={1}>
                      <Button icon={<UploadOutlined />} block>Upload Bank Proof</Button>
                    </Upload>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
          {currentStep === 4 && (
            <div>
              <Title level={5}>Contact Information</Title>
              <Row gutter={16}>
                <Col span={6}><Form.Item name="phone1" label="Phone 1"><Input placeholder="Primary phone" /></Form.Item></Col>
                <Col span={6}><Form.Item name="phone2" label="Phone 2"><Input placeholder="Alternate phone" /></Form.Item></Col>
                <Col span={6}><Form.Item name="email1" label="Email 1"><Input placeholder="Primary email" /></Form.Item></Col>
                <Col span={6}><Form.Item name="email2" label="Email 2"><Input placeholder="Alternate email" /></Form.Item></Col>
              </Row>
            </div>
          )}
        </Form>
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button disabled={currentStep === 0} onClick={() => setCurrentStep(s => s - 1)}>Previous</Button>
          <Space>
            {currentStep < 4 && <Button type="primary" onClick={() => setCurrentStep(s => s + 1)}>Next</Button>}
            {currentStep === 4 && (vendor?.status === 'draft' || vendor?.status === 'rejected') && <Button type="primary" size="large" onClick={handleSubmit}>Submit for Approval</Button>}
          </Space>
        </div>
      </Card>
    </div>
  );
}
