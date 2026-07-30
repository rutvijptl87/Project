import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';

export default function NewOpportunityTypeModal({ open, onClose, defaultData, onSave }) {
  const [form, setForm] = useState({ name: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: defaultData?.name || '' });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Opportunity Type Name is required');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/opportunity-types', { name: form.name.trim() });
      toast.success('Opportunity Type Created');
      onSave(res.data);
      onClose();
    } catch (e) {
      toast.error('Failed to create Opportunity Type');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">New Opportunity Type</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4 flex-1">
          <div className="mb-4">
            <label className="block text-[12px] font-medium text-gray-700 mb-1">Opportunity Type Name <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              className="frappe-form-control"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              autoFocus
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={handleSave} disabled={loading} className="frappe-btn frappe-btn-primary">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
