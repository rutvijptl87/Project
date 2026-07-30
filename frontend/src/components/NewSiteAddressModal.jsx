import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
import NewCustomerModal from './NewCustomerModal';
import NewLeadModal from './NewLeadModal';

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
        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
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
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
      />
    )}
    {helpText && <div className="text-[11px] text-gray-500 mt-1">{helpText}</div>}
  </div>
);

const NewSiteAddressModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  const [form, setForm] = useState({
    link_document_type: defaultData.link_document_type || 'Customer',
    link_name: defaultData.link_name || '',
    gstin: '',
    address_type: defaultData.address_type || 'Billing',
    gst_category: 'Unregistered',
    is_primary_address: false,
    is_shipping_address: false,
    is_your_company_address: defaultData.is_your_company_address || false,
    postal_code: '',
    city: '',
    address_line1: '',
    state: '',
    address_line2: '',
    country: 'India'
  });
  const [saving, setSaving] = useState(false);

  const fetchParties = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        api.get('/customers'),
        api.get('/leads')
      ]);
      setCustomers(cRes.data || []);
      setLeads(lRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchParties();
      setForm({
        link_document_type: defaultData.link_document_type || 'Customer',
        link_name: defaultData.link_name || '',
        gstin: '',
        address_type: defaultData.address_type || 'Billing',
        gst_category: 'Unregistered',
        is_primary_address: false,
        is_shipping_address: false,
        is_your_company_address: defaultData.is_your_company_address || false,
        postal_code: '',
        city: '',
        address_line1: '',
        state: '',
        address_line2: '',
        country: 'India'
      });
    }
  }, [open, defaultData]);

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  if (!open) return null;

  const handleSave = async () => {
    if (!form.address_line1 || !form.city || !form.state || !form.postal_code || !form.country) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = defaultData?.id ? await api.put(`/site-addresses/${defaultData.id}`, form) : await api.post('/site-addresses', form);
      toast.success('Address saved successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    navigate('/site-addresses/new', { state: { defaultData: form } });
    onClose();
  };

  const partyOptions = form.link_document_type === 'Customer'
    ? customers.map(c => typeof c === 'string' ? c : c.customer_name || c.name)
    : leads.map(l => typeof l === 'string' ? l : l.lead_name || l.name);

  return (
    <>
      <Modal title={defaultData?.id ? "Edit Site Address" : "New Site Address"} open={open} onClose={onClose} maxWidth="max-w-2xl">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">Link Document Type</label>
              <select
                value={form.link_document_type}
                onChange={e => updateForm('link_document_type', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Customer">Customer</option>
                <option value="Lead">Lead</option>
              </select>
            </div>

            <CustomFrappeSelect
              label={form.link_document_type}
              options={partyOptions}
              value={form.link_name}
              onChange={val => updateForm('link_name', val)}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                if (form.link_document_type === 'Customer') setShowCustomerModal(true);
                else setShowLeadModal(true);
              }}
            />
          </div>

          <Field 
            label="GSTIN / UIN" 
            value={form.gstin} 
            onChange={v => updateForm('gstin', v)} 
            helpText="Autofill party information by entering their GSTIN"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field 
              label="Address Type" 
              as="select" 
              value={form.address_type} 
              onChange={v => updateForm('address_type', v)} 
              options={['Billing', 'Shipping', 'Office', 'Personal', 'Plant', 'Postal', 'Shop', 'Subsidiary', 'Warehouse', 'Site', 'Other']}
              required 
            />
            
            <Field 
              label="GST Category" 
              as="select" 
              value={form.gst_category} 
              onChange={v => updateForm('gst_category', v)} 
              options={['Unregistered', 'Registered Regular', 'Registered Composition', 'UIN Holders', 'SEZ', 'Overseas']}
              required 
            />
          </div>

          <div>
            <div className="font-semibold text-[13px] text-gray-800 border-b pb-1 mb-3">Primary Address Details</div>
            
            <div className="grid grid-cols-2 gap-4 mb-2">
              <Field label="Preferred Billing Address" type="checkbox" value={form.is_primary_address} onChange={v => updateForm('is_primary_address', v)} />
              <Field label="Preferred Shipping Address" type="checkbox" value={form.is_shipping_address} onChange={v => updateForm('is_shipping_address', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label="Is Your Company Address" type="checkbox" value={form.is_your_company_address} onChange={v => updateForm('is_your_company_address', v)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Postal Code" value={form.postal_code} onChange={v => updateForm('postal_code', v)} required />
              <Field label="City/Town" value={form.city} onChange={v => updateForm('city', v)} required />
              <Field label="Title" value={form.title} onChange={v => setForm({ ...form, title: v })} helpText="Optional title for the site" />
              <Field label="Address Line 1" value={form.address_line1} onChange={v => updateForm('address_line1', v)} required />
              <CustomFrappeSelect
                label="State/Province"
                options={INDIAN_STATES}
                value={form.state}
                onChange={v => updateForm('state', v)}
                required
              />
              <Field label="Address Line 2" value={form.address_line2} onChange={v => updateForm('address_line2', v)} />
              <Field label="Country" value={form.country} onChange={v => updateForm('country', v)} required />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-4">
            <button 
              type="button"
              onClick={handleEditFullForm}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[13px] font-medium rounded transition-colors"
            >
              Edit Full Form
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {showCustomerModal && (
        <NewCustomerModal
          open={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          defaultData={newQuery}
          onSaved={(newC) => {
            const cName = typeof newC === 'string' ? newC : newC.customer_name || newC.name;
            setCustomers(prev => [...prev, cName]);
            updateForm('link_name', cName);
          }}
        />
      )}

      {showLeadModal && (
        <NewLeadModal
          open={showLeadModal}
          onClose={() => setShowLeadModal(false)}
          defaultData={newQuery}
          onSaved={(newL) => {
            const lName = typeof newL === 'string' ? newL : newL.lead_name || newL.name;
            setLeads(prev => [...prev, lName]);
            updateForm('link_name', lName);
          }}
        />
      )}
    </>
  );
};

export default NewSiteAddressModal;
