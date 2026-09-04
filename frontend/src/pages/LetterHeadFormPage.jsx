import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Menu, ChevronUp , X } from 'lucide-react';

const LetterHeadFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    disabled: false,
    is_default: false,
    phone: '9987076241',
    email: 'project@creatorconsultant.net',
    address_line1: 'A-001, Siddhivinayak Park, Sector 8A,',
    address_line2: 'Plot No. 21, Airoli, Navi Mumbai - 400 708.',
    content: '',
    footer_content: ''
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/letter-heads/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load Letter Head'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/letter-heads/${id}`, form);
        toast.success('Letter Head updated');
      } else {
        const res = await api.post('/letter-heads', form);
        toast.success('Letter Head created');
        navigate(`/letter-heads/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save Letter Head');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen frappe-page flex flex-col font-sans pb-20">
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-3 w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/letter-heads')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">{isEdit ? form.name : 'New Letter Head'}</h1>
            {!isEdit ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-100/50">Not Saved</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">Saved</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="frappe-btn frappe-btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 border-b pb-2">Letter Head Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 flex items-center tracking-tight">
                Letter Head Name <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder="e.g. Standard Letterhead"
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>

            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.disabled}
                  onChange={e => updateForm('disabled', e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                />
                Disabled
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={e => updateForm('is_default', e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                />
                Is Default
              </label>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-1">Footer Contact Details (Printed on Letterhead)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => updateForm('phone', e.target.value)}
                placeholder="e.g. 9987076241"
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Email Address
              </label>
              <input
                type="text"
                value={form.email}
                onChange={e => updateForm('email', e.target.value)}
                placeholder="e.g. project@creatorconsultant.net"
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Address Line 1
              </label>
              <input
                type="text"
                value={form.address_line1}
                onChange={e => updateForm('address_line1', e.target.value)}
                placeholder="e.g. A-001, Siddhivinayak Park, Sector 8A,"
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-gray-600 mb-1 block">
                Address Line 2
              </label>
              <input
                type="text"
                value={form.address_line2}
                onChange={e => updateForm('address_line2', e.target.value)}
                placeholder="e.g. Plot No. 21, Airoli, Navi Mumbai - 400 708."
                className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
              />
            </div>
          </div>

          {/* Live Visual Preview of Letterhead Banner */}
          <div className="mt-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Live Letterhead Footer Preview</h4>
            <div className="relative w-full max-w-[800px] mx-auto bg-white rounded shadow border border-gray-200 overflow-hidden">
              <img src="/assets/footer_base.png" alt="Letterhead Base" className="w-full h-auto block select-none" />
              <div 
                className="absolute inset-0 flex flex-col justify-end pointer-events-none"
                style={{
                  paddingBottom: '2.5%',
                  paddingRight: '29%'
                }}
              >
                <div className="text-right text-white font-bold tracking-tight drop-shadow-sm leading-tight" style={{ fontSize: 'clamp(8px, 1.4vw, 13px)' }}>
                  <div className="mb-0.5">{form.phone || '9987076241'}</div>
                  <div className="mb-0.5">{form.email || 'project@creatorconsultant.net'}</div>
                  <div className="mb-0.5">{form.address_line1 || 'A-001, Siddhivinayak Park, Sector 8A,'}</div>
                  <div>{form.address_line2 || 'Plot No. 21, Airoli, Navi Mumbai - 400 708.'}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LetterHeadFormPage;
