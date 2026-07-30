import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Menu, Settings, Trash2 , X } from 'lucide-react';
import { formatINR } from '../lib/format';

const SalesTaxTemplateFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    company: 'Creator Consultant',
    tax_category: '',
    is_default: false,
    disabled: false,
    taxes: []
  });
  const [taxCategories, setTaxCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load Tax Categories for dropdown
    api.get('/tax-categories').then(r => setTaxCategories(r.data)).catch(console.error);

    if (isEdit) {
      api.get(`/sales-tax-templates/${id}`)
        .then(r => {
          setForm(r.data);
          setLoading(false);
        })
        .catch(e => {
          console.error(e);
          toast.error('Failed to load Template');
          navigate('/sales-tax-templates');
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
        await api.put(`/sales-tax-templates/${id}`, form);
        toast.success('Template updated');
      } else {
        const r = await api.post('/sales-tax-templates', form);
        toast.success('Template created');
        navigate(`/sales-tax-templates/${r.data.id}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save Template');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addRow = () => {
    setForm(p => ({
      ...p,
      taxes: [...p.taxes, { type: 'On Net Total', account_head: '', tax_rate: 0, amount: 0, total: 0 }]
    }));
  };

  const updateRow = (idx, key, val) => {
    setForm(p => {
      const newTaxes = [...p.taxes];
      newTaxes[idx] = { ...newTaxes[idx], [key]: val };
      return { ...p, taxes: newTaxes };
    });
  };

  const deleteRow = (idx) => {
    setForm(p => {
      const newTaxes = [...p.taxes];
      newTaxes.splice(idx, 1);
      return { ...p, taxes: newTaxes };
    });
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FBFCFB] flex flex-col font-sans pb-12">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales-tax-templates')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {isEdit ? form.title : 'New Sales Taxes and Charges Template'}
            {!isEdit ? <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Not Saved</span> : <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
          </h1>
        </div>
        <div>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="px-5 py-2 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Title <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={form.title} 
                onChange={e => updateForm('title', e.target.value)} 
                className="w-full bg-gray-50 border border-red-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => updateForm('is_default', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                  <span className="text-[13px] text-gray-700">Default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.disabled} onChange={e => updateForm('disabled', e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                  <span className="text-[13px] text-gray-700">Disabled</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Company <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={form.company} 
                onChange={e => updateForm('company', e.target.value)} 
                className="w-full bg-gray-100/50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 font-medium"
                readOnly
              />
              <div className="mt-4">
                <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Tax Category</label>
                <select
                  value={form.tax_category}
                  onChange={e => updateForm('tax_category', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                >
                  <option value="">Select Tax Category...</option>
                  {taxCategories.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-[14px] font-semibold text-gray-800 mb-1">Sales Taxes and Charges</h3>
          <p className="text-[12px] text-gray-500 mb-4">* Will be calculated in the transaction.</p>
          
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#111827] text-white">
                <tr>
                  <th className="px-3 py-2 w-10 text-center"><input type="checkbox" className="rounded-sm border-gray-300" /></th>
                  <th className="px-3 py-2 w-10 text-center font-medium ">No.</th>
                  <th className="px-3 py-2 font-medium ">Type <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2 font-medium ">Account Head <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2 font-medium text-right w-32">Tax Rate</th>
                  <th className="px-3 py-2 font-medium text-right w-32">Amount</th>
                  <th className="px-3 py-2 font-medium text-right w-32 border-r border-gray-200">Total</th>
                  <th className="px-2 py-2 w-10 text-center"><Settings size={14} className="mx-auto text-gray-400"/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.taxes.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="text-sm">No Data</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  form.taxes.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-3 py-2 text-center border-r border-gray-200">
                        <input type="checkbox" className="rounded-sm border-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <select 
                          value={row.type} 
                          onChange={e => updateRow(idx, 'type', e.target.value)}
                          className="w-full bg-transparent border-0 rounded px-2 py-1 text-[13px] hover:bg-white hover:ring-1 hover:ring-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="On Net Total">On Net Total</option>
                          <option value="On Previous Row Amount">On Previous Row Amount</option>
                          <option value="On Previous Row Total">On Previous Row Total</option>
                          <option value="Actual">Actual</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="text"
                          value={row.account_head} 
                          onChange={e => updateRow(idx, 'account_head', e.target.value)}
                          placeholder="Account Head..."
                          className="w-full bg-transparent border-0 rounded px-2 py-1 text-[13px] hover:bg-white hover:ring-1 hover:ring-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input 
                          type="number"
                          value={row.tax_rate} 
                          onChange={e => updateRow(idx, 'tax_rate', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-0 rounded px-2 py-1 text-[13px] text-right hover:bg-white hover:ring-1 hover:ring-gray-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {formatINR(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 border-r border-gray-200">
                        {formatINR(row.total)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => deleteRow(idx)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/30">
              <button 
                onClick={addRow}
                className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors border border-gray-200"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTaxTemplateFormPage;
