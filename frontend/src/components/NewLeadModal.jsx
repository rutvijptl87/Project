import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';

const NewLeadModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [leadSources] = useState(['Cold Calling', 'Existing Customer', 'Referral', 'Website', 'Walk-In', 'Trade Show', 'Other']);
  const [form, setForm] = useState({
    lead_name: '',
    company_name: '',
    email_id: '',
    mobile_no: '',
    status: 'Lead',
    source: 'Cold Calling'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        lead_name: typeof defaultData === 'string' ? defaultData : (defaultData.lead_name || defaultData.name || defaultData.party || ''),
        company_name: typeof defaultData === 'object' ? (defaultData.company_name || defaultData.company || '') : '',
        email_id: typeof defaultData === 'object' ? (defaultData.email_id || '') : '',
        mobile_no: typeof defaultData === 'object' ? (defaultData.mobile_no || '') : '',
        status: 'Lead',
        source: typeof defaultData === 'object' ? (defaultData.source || 'Cold Calling') : 'Cold Calling'
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.lead_name.trim()) {
      toast.error('Lead Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.lead_name,
        party: form.lead_name
      };
      const res = await api.post('/leads', payload);
      toast.success('Lead created successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Lead');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/leads/new', { state: { defaultData: form } });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Lead" maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="text-[12px] font-medium text-gray-700 mb-1 block">
            Lead Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.lead_name}
            onChange={(e) => setForm(prev => ({ ...prev, lead_name: e.target.value }))}
            placeholder="e.g. John Doe / Global Tech..."
            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Company Name
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Company name..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
            >
              <option value="Lead">Lead</option>
              <option value="Open">Open</option>
              <option value="Replied">Replied</option>
              <option value="Opportunity">Opportunity</option>
              <option value="Quotation">Quotation</option>
              <option value="Lost Quotation">Lost Quotation</option>
              <option value="Interested">Interested</option>
              <option value="Converted">Converted</option>
              <option value="Do Not Contact">Do Not Contact</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Email Address
            </label>
            <input
              type="email"
              value={form.email_id}
              onChange={(e) => setForm(prev => ({ ...prev, email_id: e.target.value }))}
              placeholder="john@example.com"
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Mobile Number
            </label>
            <input
              type="tel"
              value={form.mobile_no}
              onChange={(e) => setForm(prev => ({ ...prev, mobile_no: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
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
  );
};

export default NewLeadModal;
