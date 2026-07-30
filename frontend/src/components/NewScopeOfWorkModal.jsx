import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
import NewJobTypeModal from './NewJobTypeModal';
import NewJobSubTypeModal from './NewJobSubTypeModal';

const NewScopeOfWorkModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [jobTypes, setJobTypes] = useState([]);
  const [jobSubTypes, setJobSubTypes] = useState([]);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showJobSubTypeModal, setShowJobSubTypeModal] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    job_type_name: '',
    job_sub_type_name: '',
    details: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [jtRes, jstRes] = await Promise.all([
        api.get('/job-types'),
        api.get('/job-sub-types')
      ]);
      setJobTypes(jtRes.data || []);
      setJobSubTypes(jstRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setForm({
        name: typeof defaultData === 'string' ? defaultData : (defaultData.name || ''),
        job_type_name: typeof defaultData === 'object' ? (defaultData.job_type_name || defaultData.job_type || '') : '',
        job_sub_type_name: typeof defaultData === 'object' ? (defaultData.job_sub_type_name || defaultData.job_sub_type || '') : '',
        details: typeof defaultData === 'object' ? (defaultData.details || '') : '',
        is_active: true
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Template Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/scope-of-works', form);
      toast.success('Scope of Work Template created');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Scope of Work');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/scope-of-works/new', { state: { defaultData: form } });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="New Scope of Work Template" maxWidth="max-w-lg">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Standard NDT Scope, Structural Audit Complete..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomFrappeSelect
              label="Job Type"
              options={jobTypes.map(jt => jt.name)}
              value={form.job_type_name}
              onChange={(val) => setForm(prev => ({ ...prev, job_type_name: val }))}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                setShowJobTypeModal(true);
              }}
            />

            <CustomFrappeSelect
              label="Job Sub Type"
              options={jobSubTypes
                .filter(jst => !form.job_type_name || jst.parent_job_type_name === form.job_type_name)
                .map(jst => jst.name)}
              value={form.job_sub_type_name}
              onChange={(val) => setForm(prev => ({ ...prev, job_sub_type_name: val }))}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                setShowJobSubTypeModal(true);
              }}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Scope Details / Content
            </label>
            <textarea
              rows={4}
              value={form.details}
              onChange={(e) => setForm(prev => ({ ...prev, details: e.target.value }))}
              placeholder="Enter comprehensive scope of work points..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
            />
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
          defaultData={{ name: newQuery }}
          onSaved={(newJt) => {
            setJobTypes(prev => [...prev, newJt]);
            setForm(prev => ({ ...prev, job_type_name: newJt.name }));
          }}
        />
      )}

      {showJobSubTypeModal && (
        <NewJobSubTypeModal
          open={showJobSubTypeModal}
          onClose={() => setShowJobSubTypeModal(false)}
          defaultData={{ name: newQuery, parent_job_type_name: form.job_type_name }}
          onSaved={(newJst) => {
            setJobSubTypes(prev => [...prev, newJst]);
            setForm(prev => ({ ...prev, job_sub_type_name: newJst.name, job_type_name: newJst.parent_job_type_name || prev.job_type_name }));
          }}
        />
      )}
    </>
  );
};

export default NewScopeOfWorkModal;
