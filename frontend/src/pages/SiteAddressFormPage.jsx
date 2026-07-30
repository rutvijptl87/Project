import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Check, Save , X } from 'lucide-react';

const INDIAN_STATES = [
  "01-Jammu and Kashmir", "02-Himachal Pradesh", "03-Punjab", "04-Chandigarh", "05-Uttarakhand", "06-Haryana", "07-Delhi",
  "08-Rajasthan", "09-Uttar Pradesh", "10-Bihar", "11-Sikkim", "12-Arunachal Pradesh", "13-Nagaland", "14-Manipur",
  "15-Mizoram", "16-Tripura", "17-Meghalaya", "18-Assam", "19-West Bengal", "20-Jharkhand", "21-Odisha", "22-Chhattisgarh",
  "23-Madhya Pradesh", "24-Gujarat", "26-Dadra and Nagar Haveli and Daman and Diu", "27-Maharashtra", "28-Andhra Pradesh",
  "29-Karnataka", "30-Goa", "31-Lakshadweep", "32-Kerala", "33-Tamil Nadu", "34-Puducherry", "35-Andaman and Nicobar Islands",
  "36-Telangana", "37-Andhra Pradesh", "38-Ladakh", "96-Other Countries", "97-Other Territory"
];

const Field = ({ label, value, onChange, type = "text", options = [], disabled = false, required = false, as = "input", helpText = "" }) => (
  <div className="flex flex-col mb-4 w-full">
    <label className="text-[12px] text-gray-600 mb-1 font-medium flex items-center tracking-tight">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {as === "select" ? (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="frappe-form-control"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    ) : type === "checkbox" ? (
      <div className="flex items-center gap-2 mt-1">
        <input 
          type="checkbox" 
          checked={value}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="frappe-checkbox"
        />
        <span className="text-[13px] text-gray-700 font-medium cursor-pointer" onClick={() => !disabled && onChange(!value)}>
          {label}
        </span>
      </div>
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="frappe-form-control"
      />
    )}
    {helpText && <div className="text-[11px] text-gray-500 mt-1">{helpText}</div>}
  </div>
);

const Section = ({ title, children }) => {
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      <div className="text-[14px] font-semibold text-gray-800 mb-4 tracking-tight">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
        {children}
      </div>
    </div>
  );
};

const FullSection = ({ title, children }) => {
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      {title && <div className="text-[14px] font-semibold text-gray-800 mb-4 tracking-tight">{title}</div>}
      {children}
    </div>
  );
};

const SiteAddressFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    address_type: 'Billing',
    address_line1: '',
    address_line2: '',
    city: '',
    county: '',
    state: '',
    country: 'India',
    postal_code: '',
    email: '',
    phone: '',
    fax: '',
    tax_category: '',
    is_primary_address: false,
    is_shipping_address: false,
    is_your_company_address: false,
    disabled: false,
    gstin: '',
    gst_category: 'Unregistered',
    ...location.state?.defaultData
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/site-addresses/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load address'));
    }
  }, [id, isEdit]);

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.address_type || !form.address_line1 || !form.city || !form.state || !form.country || !form.postal_code || !form.gst_category) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/site-addresses/${id}`, form);
        toast.success('Site Address updated');
      } else {
        await api.post('/site-addresses', form);
        toast.success('Site Address created');
      }
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFCFB] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">
                  {isEdit ? form.title || id : 'New Site Address'}
                </h1>
                {!isEdit && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                    Not Saved
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="frappe-btn frappe-btn-primary">
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
            {/* Left Column */}
            <div>
              <Field label="Site Address Title" value={form.title} onChange={v => updateForm('title', v)} />
              <Field 
                label="Site Address Type" 
                as="select" 
                value={form.address_type} 
                onChange={v => updateForm('address_type', v)} 
                options={['Billing', 'Shipping', 'Office', 'Personal', 'Plant', 'Postal', 'Shop', 'Subsidiary', 'Warehouse', 'Site', 'Other']}
                required 
              />
              <Field label="Site Address Line 1" value={form.address_line1} onChange={v => updateForm('address_line1', v)} required />
              <Field label="Site Address Line 2" value={form.address_line2} onChange={v => updateForm('address_line2', v)} />
              <Field label="City/Town" value={form.city} onChange={v => updateForm('city', v)} required />
              <Field label="County" value={form.county} onChange={v => updateForm('county', v)} />
              <Field label="State/Province" as="select" options={INDIAN_STATES} value={form.state} onChange={v => updateForm('state', v)} required />
              <Field label="Country" value={form.country} onChange={v => updateForm('country', v)} required />
              <Field label="Postal Code" value={form.postal_code} onChange={v => updateForm('postal_code', v)} required />
            </div>
            
            {/* Right Column */}
            <div>
              <Field label="Email Site Address" value={form.email} onChange={v => updateForm('email', v)} />
              <Field label="Phone" value={form.phone} onChange={v => updateForm('phone', v)} />
              <Field label="Fax" value={form.fax} onChange={v => updateForm('fax', v)} />
              <Field label="Tax Category" value={form.tax_category} onChange={v => updateForm('tax_category', v)} />
              
              <div className="mt-6 space-y-3">
                <Field label="Preferred Billing Site Address" type="checkbox" value={form.is_primary_address} onChange={v => updateForm('is_primary_address', v)} />
                <Field label="Preferred Shipping Site Address" type="checkbox" value={form.is_shipping_address} onChange={v => updateForm('is_shipping_address', v)} />
                <Field label="Disabled" type="checkbox" value={form.disabled} onChange={v => updateForm('disabled', v)} />
              </div>
            </div>
          </div>

          <Section title="Tax Details">
            <Field label="GSTIN / UIN" value={form.gstin} onChange={v => updateForm('gstin', v)} />
            <Field 
              label="GST Category" 
              as="select" 
              value={form.gst_category} 
              onChange={v => updateForm('gst_category', v)} 
              options={['Unregistered', 'Registered Regular', 'Registered Composition', 'UIN Holders', 'SEZ', 'Overseas']}
              required 
            />
          </Section>

          <FullSection title="Reference">
            <div className="mb-6">
              <Field label="Is Your Company Site Address" type="checkbox" value={form.is_your_company_address} onChange={v => updateForm('is_your_company_address', v)} />
            </div>
          </FullSection>
        </div>
      </div>
    </div>
  );
};

export default SiteAddressFormPage;
