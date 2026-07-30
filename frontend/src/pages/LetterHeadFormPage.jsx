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
  const [showScripts, setShowScripts] = useState(true);
  
  const [form, setForm] = useState({
    name: '',
    disabled: false,
    is_default: false,
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
                Letter Head Name <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-100 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </div>
          </div>
          
          <div className="border-t border-gray-100">
            <button 
              onClick={() => setShowScripts(!showScripts)} 
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-[14px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Scripts
                <ChevronUp size={16} className={`text-gray-400 transition-transform ${showScripts ? '' : 'rotate-180'}`} />
              </h3>
            </button>
            
            {showScripts && (
              <div className="p-6 pt-0 border-t border-gray-100 mt-2">
                <h4 className="text-[15px] font-bold text-gray-900 mb-2 mt-4">Letter Head Scripts</h4>
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
                
                <p className="text-[13px] text-gray-600 mb-6">You can also access wkhtmltopdf variables (valid only in PDF print):</p>
                
                <div className="bg-gray-50 border border-gray-100 rounded-md p-4">
                  <pre className="text-[12px] text-gray-500 font-mono whitespace-pre-wrap overflow-x-auto">
{`// Get Header and Footer wkhtmltopdf variables
// Snippet and more variables: https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
var vars = {};
var query_strings_from_url = document.location.search.substring(1).split('&');
for (var query_string in query_strings_from_url) {
    if (query_strings_from_url.hasOwnProperty(query_string)) {
        var temp_var = query_strings_from_url[query_string].split('=', 2);
        vars[temp_var[0]] = decodeURI(temp_var[1]);
    }
}
var el = document.getElementsByClassName("header-content");
if (el.length > 0 && vars["page"] == 1) {
    el[0].textContent += " : " + vars["date"];
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default LetterHeadFormPage;
