import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { CustomFrappeSelect } from './CustomFrappeSelect';
import NewCustomerModal from './NewCustomerModal';
import NewLeadModal from './NewLeadModal';

const Field = ({ label, value, onChange, type = "text", options = [], disabled = false, required = false, as = "input", helpText = "" }) => (
  <div className="flex flex-col mb-4 w-full">
    <label className="text-[12px] text-gray-600 mb-1 font-medium flex items-center tracking-tight">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {as === "select" ? (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    ) : type === "checkbox" ? (
      <div className="flex items-center gap-2 mt-1">
        <input 
          type="checkbox" 
          checked={value}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-[13px] text-gray-700 font-medium cursor-pointer" onClick={() => !disabled && onChange(!value)}>
          {label}
        </span>
      </div>
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white"
      />
    )}
    {helpText && <div className="text-[11px] text-gray-500 mt-1">{helpText}</div>}
  </div>
);

const NewContactModal = ({ open, onClose, defaultData = {}, onSaved }) => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    status: 'Passive',
    salutation: '',
    designation: '',
    gender: '',
    company_name: defaultData.link_name || '',
    emails: [],
    numbers: [],
    links: [
      {
        link_document_type: defaultData.link_document_type || 'Customer',
        link_name: defaultData.link_name || '',
        link_title: ''
      }
    ]
  });
  const [saving, setSaving] = useState(false);

  const fetchParties = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        api.get('/customers'),
        api.get('/leads')
      ]);
      setCustomers(cRes.data || []);
      setLeads(lRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchParties();
      setForm({
        first_name: '',
        last_name: '',
        status: 'Passive',
        salutation: '',
        designation: '',
        gender: '',
        company_name: defaultData.link_name || '',
        emails: [],
        numbers: [],
        links: [
          {
            link_document_type: defaultData.link_document_type || 'Customer',
            link_name: defaultData.link_name || '',
            link_title: ''
          }
        ]
      });
    }
  }, [open, defaultData]);

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const updateLink = (key, val) => {
    setForm(prev => {
      const copy = [...prev.links];
      copy[0] = { ...copy[0], [key]: val };
      return { ...prev, links: copy, company_name: key === 'link_name' ? val : prev.company_name };
    });
  };

  if (!open) return null;

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      toast.error('First Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/contacts', form);
      toast.success('Contact saved successfully');
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFullForm = () => {
    navigate('/contacts/new', { state: { defaultData: form } });
    onClose();
  };

  const currentDocType = form.links[0]?.link_document_type || 'Customer';
  const currentLinkName = form.links[0]?.link_name || '';
  const partyOptions = currentDocType === 'Customer'
    ? customers.map(c => typeof c === 'string' ? c : c.customer_name || c.name)
    : leads.map(l => typeof l === 'string' ? l : l.lead_name || l.name);

  return (
    <>
      <Modal open={open} onClose={onClose} title="New Contact" maxWidth="max-w-xl">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-gray-700 mb-1 block">Link Document Type</label>
              <select
                value={currentDocType}
                onChange={e => updateLink('link_document_type', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-[7px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-500"
              >
                <option value="Customer">Customer</option>
                <option value="Lead">Lead</option>
              </select>
            </div>

            <CustomFrappeSelect
              label={currentDocType}
              options={partyOptions}
              value={currentLinkName}
              onChange={val => updateLink('link_name', val)}
              onCreateNew={(q) => {
                setNewQuery(typeof q === 'string' ? q : '');
                if (currentDocType === 'Customer') setShowCustomerModal(true);
                else setShowLeadModal(true);
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" value={form.first_name} onChange={v => updateForm('first_name', v)} required />
            <Field label="Last Name" value={form.last_name} onChange={v => updateForm('last_name', v)} />
            <Field label="Salutation" value={form.salutation} onChange={v => updateForm('salutation', v)} />
            <Field label="Gender" as="select" value={form.gender} onChange={v => updateForm('gender', v)} options={['Male', 'Female', 'Other']} />
            <Field label="Designation" value={form.designation} onChange={v => updateForm('designation', v)} />
            <Field label="Status" as="select" value={form.status} onChange={v => updateForm('status', v)} options={['Passive', 'Active']} />
          </div>
          
          <Field label="Company Name" value={form.company_name} onChange={v => updateForm('company_name', v)} />

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

      {showCustomerModal && (
        <NewCustomerModal
          open={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          defaultData={newQuery}
          onSaved={(newC) => {
            const cName = typeof newC === 'string' ? newC : newC.customer_name || newC.name;
            setCustomers(prev => [...prev, cName]);
            updateLink('link_name', cName);
          }}
        />
      )}

      {showLeadModal && (
        <NewLeadModal
          open={showLeadModal}
          onClose={() => setShowLeadModal(false)}
          defaultData={newQuery}
          onSaved={(newL) => {
            const lName = typeof newL === 'string' ? newL : newL.lead_name || newL.name;
            setLeads(prev => [...prev, lName]);
            updateLink('link_name', lName);
          }}
        />
      )}
    </>
  );
};

export default NewContactModal;
