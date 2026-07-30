import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
import NewJobTypeModal from './NewJobTypeModal';
import NewJobSubTypeModal from './NewJobSubTypeModal';
import { Plus, Trash2 } from 'lucide-react';

const NewTestTemplateModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [jobTypes, setJobTypes] = useState([]);
  const [jobSubTypes, setJobSubTypes] = useState([]);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showJobSubTypeModal, setShowJobSubTypeModal] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  const [form, setForm] = useState({
    test_name: '',
    job_type: '',
    job_sub_type: '',
    test_details: [
      { test_name: '', points: 10, test_description: '' }
    ]
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
        test_name: typeof defaultData === 'string' ? defaultData : (defaultData.test_name || defaultData.name || ''),
        job_type: typeof defaultData === 'object' ? (defaultData.job_type || '') : '',
        job_sub_type: typeof defaultData === 'object' ? (defaultData.job_sub_type || '') : '',
        test_details: (typeof defaultData === 'object' && defaultData.test_details && defaultData.test_details.length > 0)
          ? defaultData.test_details
          : [{ test_name: typeof defaultData === 'string' ? defaultData : (defaultData.test_name || 'Standard Test'), points: 10, test_description: '' }]
      });
    }
  }, [open, defaultData]);

  if (!open) return null;

  const handleAddDetail = () => {
    setForm(prev => ({
      ...prev,
      test_details: [...prev.test_details, { test_name: '', points: 10, test_description: '' }]
    }));
  };

  const handleDetailChange = (index, key, val) => {
    setForm(prev => {
      const copy = [...prev.test_details];
      copy[index] = { ...copy[index], [key]: val };
      return { ...prev, test_details: copy };
    });
  };

  const handleRemoveDetail = (index) => {
    if (form.test_details.length <= 1) return;
    setForm(prev => ({
      ...prev,
      test_details: prev.test_details.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!form.test_name.trim()) {
      toast.error('Test Template Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/test-templates', form);
      toast.success('Test Template created successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Test Template');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    onClose();
    navigate('/test-templates/new', { state: { defaultData: form } });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="New Test Template" maxWidth="max-w-xl">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-gray-700 mb-1 block">
              Test Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.test_name}
              onChange={(e) => setForm(prev => ({ ...prev, test_name: e.target.value }))}
              placeholder="e.g. Concrete Compression Test 7-Day..."
              className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomFrappeSelect
              label="Job Type"
              options={jobTypes.map(jt => jt.name)}
              value={form.job_type}
              onChange={(val) => setForm(prev => ({ ...prev, job_type: val }))}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                setShowJobTypeModal(true);
              }}
            />

            <CustomFrappeSelect
              label="Job Sub Type"
              options={jobSubTypes
                .filter(jst => !form.job_type || jst.parent_job_type_name === form.job_type)
                .map(jst => jst.name)}
              value={form.job_sub_type}
              onChange={(val) => setForm(prev => ({ ...prev, job_sub_type: val }))}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                setShowJobSubTypeModal(true);
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-gray-800">Test Items / Parameters</label>
              <button
                type="button"
                onClick={handleAddDetail}
                className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={13} /> Add Test Item
              </button>
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {form.test_details.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded border border-gray-200">
                  <input
                    type="text"
                    value={item.test_name}
                    onChange={(e) => handleDetailChange(idx, 'test_name', e.target.value)}
                    placeholder="Parameter name..."
                    className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={item.points}
                    onChange={(e) => handleDetailChange(idx, 'points', Number(e.target.value))}
                    placeholder="Points"
                    className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-blue-500 text-center"
                  />
                  {form.test_details.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDetail(idx)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
            setForm(prev => ({ ...prev, job_type: newJt.name }));
          }}
        />
      )}

      {showJobSubTypeModal && (
        <NewJobSubTypeModal
          open={showJobSubTypeModal}
          onClose={() => setShowJobSubTypeModal(false)}
          defaultData={{ name: newQuery, parent_job_type_name: form.job_type }}
          onSaved={(newJst) => {
            setJobSubTypes(prev => [...prev, newJst]);
            setForm(prev => ({ ...prev, job_sub_type: newJst.name, job_type: newJst.parent_job_type_name || prev.job_type }));
          }}
        />
      )}
    </>
  );
};

export default NewTestTemplateModal;
