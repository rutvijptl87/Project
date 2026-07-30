import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewPriceListModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    price_list_name: '',
    currency: 'INR',
    buying: false,
    selling: true,
    enabled: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        price_list_name: typeof defaultData === 'string' ? defaultData : (defaultData.price_list_name || defaultData.name || ''),
        currency: typeof defaultData === 'object' ? (defaultData.currency || 'INR') : 'INR',
        buying: false,
        selling: true,
        enabled: true
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.price_list_name.trim()) {
      toast.error('Price List Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/price-lists', form);
      toast.success('Price List created');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Price List');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/price-lists/new', { state: { defaultData: form } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Price List" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Price List Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.price_list_name}
            onChange={(e) => setForm(prev => ({ ...prev, price_list_name: e.target.value }))}
            placeholder="e.g. Standard Selling, VIP Customer Price List..."
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Currency
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
          >
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AED">AED</option>
          </select>
        </div>

        <div className="flex items-center gap-6 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.selling}
              onChange={(e) => setForm(prev => ({ ...prev, selling: e.target.checked }))}
              id="pl_selling"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="pl_selling" className="text-[13px] font-medium text-gray-700 cursor-pointer">
              Selling
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.buying}
              onChange={(e) => setForm(prev => ({ ...prev, buying: e.target.checked }))}
              id="pl_buying"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="pl_buying" className="text-[13px] font-medium text-gray-700 cursor-pointer">
              Buying
            </label>
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
  );
};

export default NewPriceListModal;
