import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Menu , X } from 'lucide-react';

const PrintHeadingFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    print_heading: '',
    description: ''
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/print-headings/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load Print Heading'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.print_heading) {
      toast.error('Print Heading is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/print-headings/${id}`, form);
        toast.success('Print Heading updated');
      } else {
        const res = await api.post('/print-headings', form);
        toast.success('Print Heading created');
        navigate(`/print-headings/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save Print Heading');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen frappe-page flex flex-col font-sans pb-20">
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-3 w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/print-headings')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">{isEdit ? form.print_heading : 'New Print Heading'}</h1>
            {!isEdit ? <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-100/50">Not Saved</span> : <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-100/50" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="frappe-btn frappe-btn-primary">
            Save
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-6">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm mb-6 overflow-hidden">
          
          <div className="p-6">
            <div className="mb-6 max-w-xl">
              <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
                Print Heading <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={form.print_heading}
                onChange={e => updateForm('print_heading', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-100 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </div>

            <div className="mb-6">
              <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                rows={6}
                className="w-full bg-gray-50 border border-gray-100 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors resize-y"
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default PrintHeadingFormPage;
