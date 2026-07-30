import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewTermsAndConditionsModal = ({ open, onClose, onSave }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    terms: ''
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.title) {
      toast.error('Title is required');
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post('/terms-and-conditions', { ...form, disabled: false, selling: false, buying: false, hr: false });
      toast.success('Terms and Conditions created');
      onSave(res.data);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create Terms and Conditions');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/terms-and-conditions/new');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Terms and Conditions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
              Title <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-100 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            />
          </div>

          <div>
            <div className="text-[12px] font-medium text-gray-500 mb-2">Terms and Conditions</div>
            <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
              {/* Mock Toolbar */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 bg-gray-50/50 flex-wrap">
                <select className="text-[12px] bg-transparent border-0 font-medium text-gray-700 py-1 pl-1 pr-6 focus:ring-0">
                  <option>Normal</option>
                </select>
                <div className="h-4 w-px bg-gray-300"></div>
                <select className="text-[12px] bg-transparent border-0 font-medium text-gray-700 py-1 pl-1 pr-6 focus:ring-0">
                  <option>---</option>
                </select>
                <div className="h-4 w-px bg-gray-300"></div>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded"><span className="font-bold font-serif px-1">B</span></button>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded"><span className="italic font-serif px-1">I</span></button>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded"><span className="underline font-serif px-1">U</span></button>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded"><span className="line-through font-serif px-1">S</span></button>
                <div className="h-4 w-px bg-gray-300"></div>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded text-[14px]">A</button>
                <div className="h-4 w-px bg-gray-300"></div>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded text-[16px]">”</button>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded text-[12px] font-mono">{'</>'}</button>
                <div className="h-4 w-px bg-gray-300"></div>
                <button className="p-1 text-gray-600 hover:bg-gray-200 rounded text-[12px]">¶</button>
                <div className="h-4 w-px bg-gray-300"></div>
                <select className="text-[12px] bg-transparent border-0 font-medium text-gray-700 py-1 pl-1 pr-6 focus:ring-0">
                  <option>Table</option>
                </select>
              </div>
              <textarea
                value={form.terms}
                onChange={e => setForm({ ...form, terms: e.target.value })}
                rows={8}
                className="w-full bg-gray-50/30 border-0 focus:ring-0 text-[13px] text-gray-800 p-4 font-sans resize-y"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-lg">
          <button 
            onClick={handleEditFullForm} 
            className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-gray-200/80 hover:bg-gray-300/80 rounded-md transition-colors"
          >
            Edit Full Form
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="px-5 py-2 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTermsAndConditionsModal;
