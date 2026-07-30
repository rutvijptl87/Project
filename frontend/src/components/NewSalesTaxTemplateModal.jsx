import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewSalesTaxTemplateModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    company: 'Padma Technologies',
    tax_category: '',
    is_default: false,
    taxes: [
      {
        charge_type: 'On Net Total',
        account_head: 'Output GST - PT',
        rate: 18,
        description: 'GST @ 18%'
      }
    ]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: typeof defaultData === 'string' ? defaultData : (defaultData.title || defaultData.name || ''),
        company: typeof defaultData === 'object' ? (defaultData.company || 'Padma Technologies') : 'Padma Technologies',
        tax_category: typeof defaultData === 'object' ? (defaultData.tax_category || '') : '',
        is_default: false,
        taxes: [
          {
            charge_type: 'On Net Total',
            account_head: 'Output GST - PT',
            rate: 18,
            description: 'GST @ 18%'
          }
        ]
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Tax Template Title is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/sales-tax-templates', form);
      toast.success('Sales Tax Template created');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Sales Tax Template');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/sales-tax-templates/new', { state: { defaultData: form } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Sales Tax Template" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Template Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. In-State GST 18%, Out-State IGST 18%..."
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Default Tax Rate (%)
          </label>
          <input
            type="number"
            value={form.taxes[0].rate}
            onChange={(e) => setForm(prev => ({
              ...prev,
              taxes: [{ ...prev.taxes[0], rate: Number(e.target.value), description: `GST @ ${e.target.value}%` }]
            }))}
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm(prev => ({ ...prev, is_default: e.target.checked }))}
            id="stt_default"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="stt_default" className="text-[13px] font-medium text-gray-700 cursor-pointer">
            Set as Default Tax Template
          </label>
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

export default NewSalesTaxTemplateModal;
