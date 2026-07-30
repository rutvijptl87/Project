import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewCurrencyModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currency_name: '',
    symbol: '₹',
    fraction: 'Paisa',
    enabled: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        currency_name: typeof defaultData === 'string' ? defaultData.toUpperCase() : (defaultData.currency_name || defaultData.name || ''),
        symbol: typeof defaultData === 'object' ? (defaultData.symbol || '₹') : '₹',
        fraction: typeof defaultData === 'object' ? (defaultData.fraction || 'Cents') : 'Cents',
        enabled: true
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.currency_name.trim()) {
      toast.error('Currency Name (e.g. AUD, SGD) is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/currencies', { ...form, name: form.currency_name });
      toast.success('Currency created');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Currency');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/currencies/new', { state: { defaultData: form } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Currency" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Currency Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.currency_name}
              onChange={(e) => setForm(prev => ({ ...prev, currency_name: e.target.value.toUpperCase() }))}
              placeholder="e.g. AUD, CAD"
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white uppercase font-bold"
              autoFocus
              maxLength={4}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Symbol
            </label>
            <input
              type="text"
              value={form.symbol}
              onChange={(e) => setForm(prev => ({ ...prev, symbol: e.target.value }))}
              placeholder="$ / € / ¥"
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white text-center font-bold"
            />
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Subdivision / Fraction
          </label>
          <input
            type="text"
            value={form.fraction}
            onChange={(e) => setForm(prev => ({ ...prev, fraction: e.target.value }))}
            placeholder="e.g. Cents, Paisa"
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
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

export default NewCurrencyModal;
