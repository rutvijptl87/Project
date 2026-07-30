import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
const NewCustomerModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [territories] = useState(['India', 'Rest of the World', 'Asia', 'Europe', 'North America']);
  const [form, setForm] = useState({
    customer_name: '',
    customer_type: 'Company',
    customer_group: 'Commercial',
    territory: 'India',
    tax_id: '',
    disabled: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        customer_name: typeof defaultData === 'string' ? defaultData : (defaultData.customer_name || defaultData.name || defaultData.party || ''),
        customer_type: typeof defaultData === 'object' ? (defaultData.customer_type || 'Company') : 'Company',
        customer_group: typeof defaultData === 'object' ? (defaultData.customer_group || 'Commercial') : 'Commercial',
        territory: typeof defaultData === 'object' ? (defaultData.territory || 'India') : 'India',
        tax_id: '',
        disabled: 0
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      toast.error('Customer Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.customer_name,
        party: form.customer_name
      };
      const res = await api.post('/customers', payload);
      toast.success('Customer created successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Customer');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/customers/new', { state: { defaultData: form } });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="New Customer" maxWidth="max-w-lg">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
              placeholder="e.g. Acme Corporation Pvt Ltd..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">
                Customer Type
              </label>
              <select
                value={form.customer_type}
                onChange={(e) => setForm(prev => ({ ...prev, customer_type: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Company">Company</option>
                <option value="Individual">Individual</option>
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership">Partnership</option>
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">
                Customer Group
              </label>
              <select
                value={form.customer_group}
                onChange={(e) => setForm(prev => ({ ...prev, customer_group: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Commercial">Commercial</option>
                <option value="Government">Government</option>
                <option value="Non Profit">Non Profit</option>
                <option value="Individual">Individual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomFrappeSelect
              label="Territory"
              options={territories.map(t => typeof t === 'string' ? t : t.territory_name || t.name)}
              value={form.territory}
              onChange={(val) => setForm(prev => ({ ...prev, territory: val }))}
            />

            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => setForm(prev => ({ ...prev, tax_id: e.target.value }))}
                placeholder="27ABCDE1234F1Z5"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
              />
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
    </>
  );
};

export default NewCustomerModal;
