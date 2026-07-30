import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Menu , X } from 'lucide-react';

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const TaxCategoryFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    source_state: '',
    disabled: false,
    is_inter_state: false,
    is_reverse_charge: false
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.get(`/tax-categories/${id}`)
        .then(r => {
          setForm(r.data);
          setLoading(false);
        })
        .catch(e => {
          console.error(e);
          toast.error('Failed to load Tax Category');
          navigate('/tax-categories');
        });
    }
  }, [id, navigate, isEdit]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/tax-categories/${id}`, form);
        toast.success('Tax Category updated');
      } else {
        const r = await api.post('/tax-categories', form);
        toast.success('Tax Category created');
        navigate(`/tax-categories/${r.data.id}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save Tax Category');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FBFCFB] flex flex-col font-sans max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/tax-categories')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            {isEdit ? form.title : 'New Tax Category'}
            {!isEdit ? <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Not Saved</span> : <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
          </h1>
        </div>
        <div>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 max-w-5xl 2xl:max-w-[1400px] mx-auto w-full">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Title <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={form.title} 
                onChange={e => updateForm('title', e.target.value)} 
                className="w-full bg-gray-50 border border-red-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Source State</label>
              <select
                value={form.source_state}
                onChange={e => updateForm('source_state', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="">Select State...</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.disabled} onChange={e => updateForm('disabled', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
              <span className="text-[13px] text-gray-700">Disabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_inter_state} onChange={e => updateForm('is_inter_state', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
              <span className="text-[13px] text-gray-700">Is Inter State</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_reverse_charge} onChange={e => updateForm('is_reverse_charge', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
              <span className="text-[13px] text-gray-700">Is Reverse Charge</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxCategoryFormPage;
