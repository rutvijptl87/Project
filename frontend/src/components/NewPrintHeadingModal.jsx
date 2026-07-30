import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewPrintHeadingModal = ({ open, onClose, onSave }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    print_heading: ''
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.print_heading) {
      toast.error('Print Heading is required');
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post('/print-headings', form);
      toast.success('Print Heading created');
      onSave(res.data);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create Print Heading');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/print-headings/new');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Print Heading</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-2">
            <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
              Print Heading <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={form.print_heading}
              onChange={e => setForm({ ...form, print_heading: e.target.value })}
              className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-100 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            />
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

export default NewPrintHeadingModal;
