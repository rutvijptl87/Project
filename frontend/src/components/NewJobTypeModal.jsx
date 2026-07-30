import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewJobTypeModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: defaultData.name || '',
    greetings: defaultData.greetings || '',
    scope_of_work_template: defaultData.scope_of_work_template || '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: typeof defaultData === 'string' ? defaultData : (defaultData.name || ''),
        greetings: defaultData.greetings || '',
        scope_of_work_template: defaultData.scope_of_work_template || '',
        is_active: true
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Job Type Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/job-types', form);
      toast.success('Job Type created successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Job Type');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/job-types/new', { state: { defaultData: form } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Job Type" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Job Type Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Structural Audit, Electrical Testing..."
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Default Greetings Text
          </label>
          <textarea
            rows={3}
            value={form.greetings}
            onChange={(e) => setForm(prev => ({ ...prev, greetings: e.target.value }))}
            placeholder="Default intro text when this job type is selected..."
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
            id="jt_active"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="jt_active" className="text-[13px] font-medium text-gray-700 cursor-pointer">
            Is Active
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

export default NewJobTypeModal;
