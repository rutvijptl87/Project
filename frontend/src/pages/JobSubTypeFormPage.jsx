import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save, Menu , X } from 'lucide-react';
import { toast } from 'react-toastify';

const Field = ({ label, value, onChange, type = "text", disabled = false, as = "input" }) => (
  <div className="flex flex-col mb-4">
    <label className="text-[12px] text-gray-600 mb-1 font-medium tracking-tight">
      {label}
    </label>
    {as === "textarea" ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded px-3 py-[5px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded px-3 py-[5px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
      />
    )}
  </div>
);

const JobSubTypeFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [form, setForm] = useState({
    name: '',
    parent_job_type_name: '',
    description: '',
    image: ''
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/job-sub-types/${id}`);
      setForm({
        name: res.data.name || '',
        parent_job_type_name: res.data.parent_job_type_name || '',
        description: res.data.description || '',
        image: res.data.image || ''
      });
    } catch (e) {
      toast.error('Failed to load Job Sub Type');
      navigate('/job-sub-types');
    } finally {
      setLoading(false);
    }
  };

  
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result;
      try {
        const res = await api.post('/auditjobs/upload', { base64: b64, filename: file.name });
        setForm(prev => ({ ...prev, image: res.data.url }));
        toast.success("Image uploaded!");
      } catch(err) {
        toast.error("Upload failed");
      }
    };
    reader.readAsDataURL(file);
  };


  const save = async () => {
    if (!form.name) {
      toast.error("Job Sub Type Name is required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await api.post('/job-sub-types', form);
        toast.success("Job Sub Type created");
        navigate(`/job-sub-types/${res.data.id}`);
      } else {
        await api.put(`/job-sub-types/${id}`, form);
        toast.success("Job Sub Type updated");
      }
    } catch (e) {
      toast.error('Error saving Job Sub Type');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/job-sub-types')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            {isNew ? 'New Job Sub Type' : form.name}
            {isNew ? <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-700">Not Saved</span> : <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-700" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 sm:p-6 max-w-5xl 2xl:max-w-[1400px] mx-auto w-full">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-4 sm:p-6">
          <div className="mb-6 max-w-md">
            <Field 
              label="Job Sub Type Name" 
              value={form.name} 
              onChange={v => setForm({ ...form, name: v })} 
            />
            <Field 
              label="Parent Job Type Name" 
              value={form.parent_job_type_name} 
              onChange={v => setForm({ ...form, parent_job_type_name: v })} 
            />
          </div>

          <div>
            <Field 
              label="Description"
              as="textarea"
              value={form.description} 
              onChange={v => setForm({ ...form, description: v })}
            />
          </div>
          {form.parent_job_type_name && form.parent_job_type_name.toLowerCase().includes('audit') && (
            <div className="flex flex-col mb-4 max-w-md">
              <label className="text-[12px] text-gray-600 mb-1 font-medium tracking-tight">Audit Image (Optional)</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-[13px] border border-gray-200 rounded p-1" />
              {form.image && (
                <div className="mt-2 relative inline-block group">
                  <img src={form.image.startsWith('http') ? form.image : `${process.env.REACT_APP_BACKEND_URL || ''}${form.image}`} alt="Audit" className="h-24 object-contain rounded border border-gray-200" />
                  <button onClick={() => setForm(prev => ({ ...prev, image: '' }))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobSubTypeFormPage;
