import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Save, Menu , X } from 'lucide-react';

const TermsAndConditionsFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    disabled: false,
    selling: false,
    buying: false,
    hr: false,
    terms: ''
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/terms-and-conditions/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load Terms and Conditions'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/terms-and-conditions/${id}`, form);
        toast.success('Terms and Conditions updated');
      } else {
        const res = await api.post('/terms-and-conditions', form);
        toast.success('Terms and Conditions created');
        navigate(`/terms-and-conditions/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save Terms and Conditions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen frappe-page flex flex-col font-sans pb-20">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/terms-and-conditions')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">{isEdit ? form.title : 'New Terms and Conditions'}</h1>
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
                Title <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => updateForm('title', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-100 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.disabled}
                  onChange={e => updateForm('disabled', e.target.checked)}
                  className="frappe-checkbox"
                />
                <span className="text-[13px] text-gray-800 font-medium tracking-tight">Disabled</span>
              </label>
            </div>
          </div>
          
          <div className="border-t border-gray-100 p-6">
            <h3 className="text-[14px] font-bold text-gray-900 mb-4 tracking-tight">Applicable Modules</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.selling}
                  onChange={e => updateForm('selling', e.target.checked)}
                  className="frappe-checkbox"
                />
                <span className="text-[13px] text-gray-800 font-medium tracking-tight">Selling</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.buying}
                  onChange={e => updateForm('buying', e.target.checked)}
                  className="frappe-checkbox"
                />
                <span className="text-[13px] text-gray-800 font-medium tracking-tight">Buying</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.hr}
                  onChange={e => updateForm('hr', e.target.checked)}
                  className="frappe-checkbox"
                />
                <span className="text-[13px] text-gray-800 font-medium tracking-tight">HR</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-100 p-6">
            <div className="text-[12px] font-medium text-gray-500 mb-2">Terms and Conditions</div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden bg-white mb-6">
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
                onChange={e => updateForm('terms', e.target.value)}
                rows={15}
                className="w-full bg-gray-50/30 border-0 focus:ring-0 text-[13px] text-gray-800 p-4 font-sans resize-y"
              />
            </div>

            <div className="prose prose-sm max-w-none text-gray-600 mt-8">
              <h4 className="text-gray-900 font-bold mb-2">Standard Terms and Conditions Example</h4>
              <pre className="bg-transparent p-0 text-[12px] text-gray-500 font-mono mb-6 whitespace-pre-wrap">
Delivery Terms for Order number {'{{ name }}'}{'\n\n'}
-Order Date : {'{{ transaction_date }}'}{'\n'}
-Expected Delivery Date : {'{{ delivery_date }}'}
              </pre>

              <h4 className="text-gray-900 font-bold mb-2">How to get fieldnames</h4>
              <p className="text-[12px] mb-6">
              </p>

              <h4 className="text-gray-900 font-bold mb-2">Templating</h4>
              <p className="text-[12px]">
                Templates are compiled using the Jinja Templating Language. To learn more about Jinja, <strong>read this documentation.</strong>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditionsFormPage;
