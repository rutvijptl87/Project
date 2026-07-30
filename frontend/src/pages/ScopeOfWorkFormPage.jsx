import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, Save, Menu, Plus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { CustomFrappeSelect } from '../components/CustomFrappeSelect';
import RichTextEditor from '../components/RichTextEditor';

const ScopeOfWorkFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [form, setForm] = useState({
    job_type_name: '',
    job_sub_type_name: '',
    details: ''
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [jobSubTypes, setJobSubTypes] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [jtRes, jstRes] = await Promise.all([
          api.get('/job-types'),
          api.get('/job-sub-types')
        ]);
        setJobTypes(jtRes.data || []);
        setJobSubTypes(jstRes.data || []);
      } catch (e) {
        console.error("Failed to load options", e);
      }
    };
    fetchOptions();

    if (!isNew) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/scope-of-works/${id}`);
      setForm({
        job_type_name: res.data.job_type_name || '',
        job_sub_type_name: res.data.job_sub_type_name || '',
        details: res.data.details || ''
      });
    } catch (e) {
      toast.error('Failed to load Scope of Work');
      navigate('/scope-of-works');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.job_type_name) {
      toast.error("Job Type is required");
      return;
    }
    if (!form.details) {
      toast.error("Scope of Work Details is required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await api.post('/scope-of-works', form);
        toast.success("Scope of Work created");
        navigate(`/scope-of-works/${res.data.id}`);
      } else {
        await api.put(`/scope-of-works/${id}`, form);
        toast.success("Scope of Work updated");
      }
    } catch (e) {
      toast.error('Error saving Scope of Work');
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
          <button onClick={() => navigate('/scope-of-works')} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
            <Menu size={20}/>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            {isNew ? 'New Scope of Work' : form.job_type_name + (form.job_sub_type_name ? '-' + form.job_sub_type_name : '')}
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
          <div className="mb-6 flex flex-col max-w-md">
            <CustomFrappeSelect 
              label="Job Type" 
              options={jobTypes.map(jt => jt.name)} 
              value={form.job_type_name} 
              onChange={v => setForm({ ...form, job_type_name: v })} 
              disabled={!isNew} 
              required 
              onCreateNew="/job-types/new"
            />
            
            <CustomFrappeSelect 
              label="Job Sub Type" 
              options={jobSubTypes.filter(jst => !form.job_type_name || jst.parent_job_type_name === form.job_type_name).map(jst => jst.name)} 
              value={form.job_sub_type_name} 
              onChange={v => setForm({ ...form, job_sub_type_name: v })} 
              disabled={!isNew} 
              onCreateNew="/job-sub-types/new"
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-600 mb-1 font-medium tracking-tight block">
              Scope of Work Details <span className="text-red-500">*</span>
            </label>
            <RichTextEditor 
              value={form.details} 
              onChange={v => setForm({ ...form, details: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScopeOfWorkFormPage;
