import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Menu } from 'lucide-react';

const ItemFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    item_group: '',
    hsn_sac: '',
    standard_rate: 0,
    lumpsum_amount: 0,
    maintain_stock: false,
    is_fixed_asset: false,
    description: ''
  });

  useEffect(() => {
    if (!isNew) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const loadData = async () => {
    try {
      const res = await api.get(`/items/${id}`);
      if (res.data) {
        setForm({
          item_code: res.data.item_code || '',
          item_name: res.data.item_name || '',
          item_group: res.data.item_group || '',
          hsn_sac: res.data.hsn_sac || '',
          standard_rate: res.data.standard_rate || 0,
          lumpsum_amount: res.data.lumpsum_amount || 0,
          maintain_stock: res.data.maintain_stock || false,
          is_fixed_asset: res.data.is_fixed_asset || false,
          description: res.data.description || ''
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load item');
      navigate('/items');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.item_code || !form.item_group || !form.hsn_sac) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/items', form);
        toast.success('Item created');
      } else {
        await api.put(`/items/${id}`, form);
        toast.success('Item updated');
      }
      navigate('/items');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBFCFB] flex flex-col font-sans max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/items')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            {isNew ? 'New Item' : `Item - ${form.item_code}`}
            {!isNew ? <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Saved</span> : <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Not Saved</span>}
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
            
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Item Code <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={form.item_code} 
                  onChange={e => setForm({...form, item_code: e.target.value})} 
                  className={`w-full bg-gray-50 border ${!form.item_code ? 'border-red-200' : 'border-gray-200'} rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
                  autoFocus={isNew}
                  maxLength={30}
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Item Name</label>
                <input 
                  type="text" 
                  value={form.item_name} 
                  onChange={e => setForm({...form, item_name: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Item Group <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={form.item_group} 
                  onChange={e => setForm({...form, item_group: e.target.value})} 
                  className={`w-full bg-gray-50 border ${!form.item_group ? 'border-red-200' : 'border-gray-200'} rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
                />
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">HSN/SAC <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={form.hsn_sac} 
                  onChange={e => setForm({...form, hsn_sac: e.target.value})} 
                  className={`w-full bg-gray-50 border ${!form.hsn_sac ? 'border-red-200' : 'border-gray-200'} rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors`}
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Lumpsum Amount (INR)</label>
                <input 
                  type="number" 
                  value={form.lumpsum_amount} 
                  onChange={e => setForm({...form, lumpsum_amount: Number(e.target.value)})} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
            
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
             <div className="flex flex-col gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={form.maintain_stock} 
                   onChange={e => setForm({...form, maintain_stock: e.target.checked})} 
                   className="rounded border-gray-300 text-blue-600" 
                 />
                 <span className="text-[13px] text-gray-700">Maintain Stock</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={form.is_fixed_asset} 
                   onChange={e => setForm({...form, is_fixed_asset: e.target.checked})} 
                   className="rounded border-gray-300 text-blue-600" 
                 />
                 <span className="text-[13px] text-gray-700">Is Fixed Asset</span>
               </label>
             </div>
             
             <div>
               <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Description</label>
               <textarea 
                 value={form.description} 
                 onChange={e => setForm({...form, description: e.target.value})} 
                 className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors h-24 resize-y" 
               />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemFormPage;
