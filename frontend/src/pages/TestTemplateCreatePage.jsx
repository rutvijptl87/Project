// TestTemplateCreatePage
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Save, Settings, Edit3, Heart, MessageSquare, FileText, Trash2, ChevronDown , X } from 'lucide-react';
import { toast } from 'react-toastify';
import { formatActivityDay } from '../lib/format';
import { CustomFrappeSelect } from '../components/CustomFrappeSelect';
import RichTextEditor from '../components/RichTextEditor';

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  let path = url;
  if (!path.startsWith('/') && !path.startsWith('api/')) {
    path = `/api/uploads/test-images/${path}`;
  } else if (path.startsWith('api/')) {
    path = `/${path}`;
  }
  const backendUrl = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
  if (backendUrl) {
    return `${backendUrl}${path}`;
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === '3000') {
      return `${protocol}//${hostname}:8000${path}`;
    }
  }
  return path;
};

const Section = ({ title, children, className = "" }) => (
  <div className={`mb-8 ${className}`}>
    <h3 className="text-[13px] font-bold text-gray-800 mb-3">{title}</h3>
    <div className="bg-white border border-gray-100 rounded-lg p-5">
      {children}
    </div>
  </div>
);

const Field = ({ label, type = "text", value, onChange, placeholder, disabled, as = "input", options = [] }) => (
  <div className="flex flex-col mb-4 w-full">
    <label className="text-[12px] text-gray-600 mb-1 font-medium flex items-center tracking-tight">
      {label}
    </label>
    {as === "select" ? (
      <select 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        disabled={disabled}
        className="w-full bg-gray-50/50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:bg-gray-100"
      >
        <option value="">Select {label}</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    ) : (
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-gray-50/50 border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:bg-gray-100 placeholder:text-gray-400"
      />
    )}
  </div>
);

const TestTemplateCreatePage = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [jobSubTypes, setJobSubTypes] = useState([]);
  const { user } = useAuth();
  const [showEditRowModal, setShowEditRowModal] = useState(null);

  const [form, setForm] = useState({
    test_name: '',
    job_type: '',
    job_sub_type: '',
    test_details: []
  });

  useEffect(() => {
    fetchJobTypes();
    fetchJobSubTypes();
    if (isEdit) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchJobTypes = async () => {
    try {
      const res = await api.get('/job-types');
      setJobTypes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchJobSubTypes = async () => {
    try {
      const res = await api.get('/job-sub-types');
      setJobSubTypes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/test-templates/${id}`);
      setForm(res.data);
    } catch (error) {
      toast.error('Failed to load test template');
      navigate('/test-templates');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.test_name) {
      toast.error('Test Name is required');
      return;
    }
    
    // validate rows
    for (let row of form.test_details) {
        if (!row.test_name || !row.points) {
            toast.error('Tests and Points are required for all rows in Test Details');
            return;
        }
    }

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/test-templates/${id}`, form);
        toast.success('Test Template updated successfully');
      } else {
        const res = await api.post('/test-templates', form);
        toast.success('Test Template created successfully');
        navigate(`/test-templates/${res.data.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save test template');
    } finally {
      setSaving(false);
    }
  };

  const addTestRow = () => {
    setForm({
      ...form,
      test_details: [...form.test_details, { test_name: '', points: '', test_image: '', test_description: '' }]
    });
  };

  const updateTestRow = (index, field, value) => {
    setForm(prev => {
      const newTests = (prev.test_details || []).map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      );
      return { ...prev, test_details: newTests };
    });
  };
  
  const removeTestRow = (index) => {
    setForm(prev => ({
      ...prev,
      test_details: (prev.test_details || []).filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = (index) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64Data = ev.target.result;
          try {
            const res = await api.post('/test-images/upload', {
              filename: file.name,
              base64: base64Data
            });
            if (res.data && res.data.url) {
              updateTestRow(index, 'test_image', res.data.url);
              toast.success('Image attached successfully');
            }
          } catch (err) {
            console.error(err);
            toast.error('Failed to upload image');
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto font-sans pb-32 px-3 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/test-templates')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {isEdit ? form.test_name : 'New Test Template'}
              {!isEdit ? <span className="text-[10px] uppercase tracking-wider font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Not Saved</span> : <span className="text-[10px] uppercase tracking-wider font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#111827] text-white text-[13px] font-medium rounded-md hover:bg-black transition-colors shadow-sm disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            <div className="max-w-xl">
              <Field label="Test Name *" value={form.test_name} onChange={v => updateForm('test_name', v)} />
              <CustomFrappeSelect
                label="Job Type"
                value={form.job_type}
                onChange={v => updateForm('job_type', v)}
                options={jobTypes.map(jt => ({ value: jt.name, label: jt.name }))}
              />
              <CustomFrappeSelect
                label="Job Sub Type"
                value={form.job_sub_type}
                onChange={v => updateForm('job_sub_type', v)}
                options={jobSubTypes
                  .filter(jst => !form.job_type || jst.parent_job_type_name === form.job_type)
                  .map(jt => ({ value: jt.name, label: jt.name }))}
              />
            </div>

            <div className="mt-8">
              <div className="mb-2 text-xs font-medium text-gray-600">Test Details</div>
              <div className="border border-gray-200 rounded mb-3 overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-[12px] font-medium w-10 text-center"><input type="checkbox" className="rounded-sm border-gray-300" /></th>
                      <th className="px-3 py-2 text-[12px] font-medium w-12 text-center">No.</th>
                      <th className="px-3 py-2 text-[12px] font-medium ">Tests <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 text-[12px] font-medium w-24 text-right">Points <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 w-10 text-center text-gray-400"><Edit3 size={14} className="mx-auto"/></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.test_details.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-3 py-10 text-center text-[12px] text-gray-500">
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <FileText size={32} strokeWidth={1} className="mb-2 text-gray-300" />
                            <span>No Data</span>
                          </div>
                        </td>
                      </tr>
                    ) : form.test_details.map((test, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center"><input type="checkbox" className="rounded-sm border-gray-300" /></td>
                        <td className="px-3 py-2 text-center text-[13px] text-gray-800">{index + 1}</td>
                        <td className="px-3 py-2 text-[13px] font-semibold text-gray-800">
                          <input 
                            type="text" 
                            value={test.test_name} 
                            onChange={e => updateTestRow(index, 'test_name', e.target.value)}
                            className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[13px] font-medium text-gray-800" 
                            placeholder="Test name"
                          />
                        </td>
                        <td className="px-3 py-2 text-[13px] font-semibold text-gray-800 text-right">
                          <input 
                            type="text" 
                            value={test.points} 
                            onChange={e => updateTestRow(index, 'points', e.target.value)}
                            className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[13px] font-medium text-gray-800 text-right" 
                            placeholder="Points"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setShowEditRowModal(index)} className="text-gray-400 hover:text-gray-600 focus:outline-none">
                            <Edit3 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                onClick={addTestRow} 
                className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {isEdit && (
          <div className="w-full lg:w-[280px] shrink-0">
             <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm space-y-6">
                <div>
                   <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Assigned To</h3>
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-sm">
                       {form.created_by_username ? form.created_by_username.charAt(0).toUpperCase() : 'A'}
                     </div>
                     <span className="text-[13px] font-medium text-gray-700">{form.created_by_username || 'Administrator'}</span>
                   </div>
                </div>
                <div>
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Timestamps</h3>
                    <div className="space-y-2">
                        {form.created_at && (
                        <p className="text-[12px] text-gray-500">
                            Created • {formatActivityDay(form.created_at)}
                        </p>
                        )}
                        {form.updated_at && (
                        <p className="text-[12px] text-gray-500">
                            Updated • {formatActivityDay(form.updated_at)}
                        </p>
                        )}
                    </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Row Edit Modal */}
      {showEditRowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="bg-white shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Editing Row #{showEditRowModal + 1}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => {removeTestRow(showEditRowModal); setShowEditRowModal(null)}} className="p-1.5 text-red-500 hover:bg-red-50 rounded bg-red-50 transition-colors mr-2">
                  <Trash2 size={16} />
                </button>
                <button className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">Insert Below</button>
                <button className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">Insert Above</button>
                <button className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">Duplicate</button>
                <button className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">Move <ChevronDown size={14}/></button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <button onClick={() => setShowEditRowModal(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
              <div className="max-w-2xl mb-8">
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Tests <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.test_details[showEditRowModal]?.test_name || ''} 
                    onChange={e => updateTestRow(showEditRowModal, 'test_name', e.target.value)} 
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  />
                </div>
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Points <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.test_details[showEditRowModal]?.points || ''} 
                    onChange={e => updateTestRow(showEditRowModal, 'points', e.target.value)} 
                    className="w-full bg-gray-50/50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  />
                </div>
                
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Test Image</label>
                  {form.test_details[showEditRowModal]?.test_image ? (
                    <div className="flex items-center gap-3 mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="relative w-20 h-20 border border-gray-300 rounded overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getImageUrl(form.test_details[showEditRowModal].test_image)} 
                          alt="Test" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleImageUpload(showEditRowModal)}
                          className="px-3 py-1 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors text-left shadow-sm"
                        >
                          Change Image
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTestRow(showEditRowModal, 'test_image', '')}
                          className="px-3 py-1 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded transition-colors text-left"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleImageUpload(showEditRowModal)}
                      className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Attach
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Test Description</label>
                  <RichTextEditor 
                    value={form.test_details[showEditRowModal]?.test_description || ''} 
                    onChange={v => updateTestRow(showEditRowModal, 'test_description', v)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-gray-200 flex justify-between bg-white items-center">
              <div className="flex gap-2">
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Shortcuts:</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Ctrl + Up</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Ctrl + Down</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">ESC</span>
              </div>
              <button onClick={() => setShowEditRowModal(null)} className="px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm transition-colors">
                Insert Below
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TestTemplateCreatePage;
