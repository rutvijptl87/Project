import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save, Menu , X } from 'lucide-react';
import { toast } from 'react-toastify';
import RichTextEditor from '../components/RichTextEditor';
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



const JobTypeFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [form, setForm] = useState({
    name: '',
    greetings: ''
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
      const res = await api.get(`/job-types/${id}`);
      setForm({
        name: res.data.name || '',
        greetings: res.data.greetings || ''
      });
    } catch (e) {
      toast.error('Failed to load Job Type');
      navigate('/job-types');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.name) {
      toast.error("Job Type Name is required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await api.post('/job-types', form);
        toast.success("Job Type created");
        navigate(`/job-types/${res.data.id}`);
      } else {
        await api.put(`/job-types/${id}`, form);
        toast.success("Job Type updated");
      }
    } catch (e) {
      toast.error('Error saving Job Type');
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
          <button onClick={() => navigate('/job-types')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            {isNew ? 'New Job Type' : form.name}
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
              label="Job Type Name" 
              value={form.name} 
              onChange={v => setForm({ ...form, name: v })} 
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-600 mb-1 font-medium tracking-tight block">
              Greetings
            </label>
            <RichTextEditor 
              value={form.greetings} 
              onChange={v => setForm({ ...form, greetings: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobTypeFormPage;
