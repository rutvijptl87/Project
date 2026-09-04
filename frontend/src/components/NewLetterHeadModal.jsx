import React, { useState } from 'react';
import { X, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const NewLetterHeadModal = ({ open, onClose, onSave }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '9987076241',
    email: 'project@creatorconsultant.net',
    address_line1: 'A-001, Siddhivinayak Park, Sector 8A,',
    address_line2: 'Plot No. 21, Airoli, Navi Mumbai - 400 708.'
  });
  const [saving, setSaving] = useState(false);
  const [showScripts, setShowScripts] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Name is required');
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post('/letter-heads', { ...form, disabled: false, is_default: false });
      toast.success('Letter Head created');
      onSave(res.data);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create Letter Head');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/letter-heads/new');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Letter Head</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-gray-600 mb-1 flex items-center tracking-tight">
              Letter Head Name <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Standard Letterhead"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 9987076241"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Email
              </label>
              <input
                type="text"
                placeholder="e.g. project@creatorconsultant.net"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
              Address Line 1
            </label>
            <input
              type="text"
              placeholder="e.g. A-001, Siddhivinayak Park, Sector 8A,"
              value={form.address_line1}
              onChange={e => setForm({ ...form, address_line1: e.target.value })}
              className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
              Address Line 2
            </label>
            <input
              type="text"
              placeholder="e.g. Plot No. 21, Airoli, Navi Mumbai - 400 708."
              value={form.address_line2}
              onChange={e => setForm({ ...form, address_line2: e.target.value })}
              className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
            />
          </div>
          
          <div className="border border-gray-100 rounded-md overflow-hidden">
            <button 
              onClick={() => setShowScripts(!showScripts)} 
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-[14px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Scripts
                <ChevronUp size={16} className={`text-gray-400 transition-transform ${showScripts ? '' : 'rotate-180'}`} />
              </h3>
            </button>
            
            {showScripts && (
              <div className="p-6 pt-4 border-t border-gray-100">
                <h4 className="text-[15px] font-bold text-gray-900 mb-2">Letter Head Scripts</h4>
                <p className="text-[13px] text-gray-600 mb-6">Header/Footer scripts can be used to add dynamic behaviours.</p>
                
                <div className="bg-gray-50 border border-gray-100 rounded-md p-4 mb-6">
                  <pre className="text-[12px] text-gray-500 font-mono whitespace-pre-wrap overflow-x-auto">
{`// The following Header Script will add the current date to an element in 'Header HTML' with class 'header-content'
var el = document.getElementsByClassName("header-content");
if (el.length > 0) {
    el[0].textContent += " " + new Date().toGMTString();
}`}
                  </pre>
                </div>
              </div>
            )}
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

export default NewLetterHeadModal;
