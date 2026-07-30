import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
import NewJobTypeModal from './NewJobTypeModal';

const NewJobSubTypeModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [jobTypes, setJobTypes] = useState([]);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [newJobTypeQuery, setNewJobTypeQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    parent_job_type_name: '',
    description: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  const fetchJobTypes = async () => {
    try {
      const res = await api.get('/job-types');
      setJobTypes(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchJobTypes();
      setForm({
        name: typeof defaultData === 'string' ? defaultData : (defaultData.name || ''),
        parent_job_type_name: typeof defaultData === 'object' ? (defaultData.parent_job_type_name || defaultData.job_type || '') : '',
        description: typeof defaultData === 'object' ? (defaultData.description || '') : '',
        is_active: true
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Job Sub Type Name is required');
      return;
    }
    if (!form.parent_job_type_name) {
      toast.error('Parent Job Type is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/job-sub-types', form);
      toast.success('Job Sub Type created successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Job Sub Type');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/job-sub-types/new', { state: { defaultData: form } });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="New Job Sub Type" maxWidth="max-w-md">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Job Sub Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Visual Inspection, Ultrasonic Test..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              autoFocus
            />
          </div>

          <div>
            <CustomFrappeSelect
              label="Parent Job Type"
              options={jobTypes.map(jt => jt.name)}
              value={form.parent_job_type_name}
              onChange={(val) => setForm(prev => ({ ...prev, parent_job_type_name: val }))}
              required
              onCreateNew={(initialQuery) => {
                setNewJobTypeQuery(typeof initialQuery === 'string' ? initialQuery : '');
                setShowJobTypeModal(true);
              }}
            />
          </div>

          
          {form.parent_job_type_name && form.parent_job_type_name.toLowerCase().includes('audit') && (
            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">
                Audit Image (Optional)
              </label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-[13px]" />
              {form.image && <div className="mt-1 text-[12px] text-green-600">Image uploaded successfully!</div>}
            </div>
          )}

          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional notes or scope description..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
              id="jst_active"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="jst_active" className="text-[13px] font-medium text-gray-700 cursor-pointer">
              Is Active
            </label>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-4">
            <button
              type="button"
              onClick={handleEditFullForm}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[13px] font-medium rounded transition-colors"
            >
              Edit Full Form
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {showJobTypeModal && (
        <NewJobTypeModal
          open={showJobTypeModal}
          onClose={() => setShowJobTypeModal(false)}
          defaultData={{ name: newJobTypeQuery }}
          onSaved={(newJt) => {
            setJobTypes(prev => [...prev, newJt]);
            setForm(prev => ({ ...prev, parent_job_type_name: newJt.name }));
          }}
        />
      )}
    </>
  );
};

export default NewJobSubTypeModal;
