import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Check, Save, Plus, Settings, Trash, FileText , X } from 'lucide-react';
import { CustomFrappeSelect } from '../components/CustomFrappeSelect';

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
        className="frappe-form-control"
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
          className="frappe-checkbox"
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
        className="frappe-form-control"
      />
    )}
    {helpText && <div className="text-[11px] text-gray-500 mt-1">{helpText}</div>}
  </div>
);

const Section = ({ title, children }) => {
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      {title && <div className="text-[14px] font-semibold text-gray-800 mb-4 tracking-tight">{title}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
        {children}
      </div>
    </div>
  );
};

const FullSection = ({ title, children }) => {
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      {title && <div className="text-[14px] font-semibold text-gray-800 mb-4 tracking-tight">{title}</div>}
      {children}
    </div>
  );
};

const ContactFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    status: 'Passive',
    salutation: '',
    designation: '',
    gender: '',
    user_id: '',
    address: '',
    company_name: '',
    sync_with_google_contacts: false,
    emails: [],
    numbers: [],
    links: [],
    is_primary_contact: false,
    is_billing_contact: false,
    department: '',
    unsubscribed: false,
    ...location.state?.defaultData
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/contacts/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load contact'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.first_name) {
      toast.error('First Name is required');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/contacts/${id}`, form);
        toast.success('Contact updated');
      } else {
        const res = await api.post('/contacts', form);
        toast.success('Contact created');
        navigate(`/contacts/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => updateForm('emails', [...form.emails, { email_id: '', is_primary: false }]);
  const removeEmail = (idx) => updateForm('emails', form.emails.filter((_, i) => i !== idx));
  const updateEmail = (idx, k, v) => updateForm('emails', form.emails.map((e, i) => i === idx ? { ...e, [k]: v } : e));

  const addNumber = () => updateForm('numbers', [...form.numbers, { number: '', is_primary_phone: false, is_primary_mobile: false }]);
  const removeNumber = (idx) => updateForm('numbers', form.numbers.filter((_, i) => i !== idx));
  const updateNumber = (idx, k, v) => updateForm('numbers', form.numbers.map((n, i) => i === idx ? { ...n, [k]: v } : n));

  const addLink = () => updateForm('links', [...form.links, { link_document_type: 'Customer', link_name: '', link_title: '' }]);
  const removeLink = (idx) => updateForm('links', form.links.filter((_, i) => i !== idx));
  const updateLink = (idx, k, v) => updateForm('links', form.links.map((l, i) => i === idx ? { ...l, [k]: v } : l));

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans pb-20">
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 bg-white border-b border-gray-200 sticky top-16 z-10 gap-3 w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/contacts')} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-[16px] font-bold text-gray-900">{isEdit ? form.first_name + ' ' + (form.last_name || '') : 'New Contact'}</h1>
            {!isEdit ? <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">Not Saved</span> : <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200" style={{backgroundColor: "#dbeafe", color: "#1d4ed8"}}>Saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="frappe-btn frappe-btn-primary">
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        <div className="frappe-card">
          
          <Section>
            <div>
              <Field label="First Name" value={form.first_name} onChange={v => updateForm('first_name', v)} required />
              <Field label="Middle Name" value={form.middle_name} onChange={v => updateForm('middle_name', v)} />
              <Field label="Last Name" value={form.last_name} onChange={v => updateForm('last_name', v)} />
              <Field label="User Id" value={form.user_id} onChange={v => updateForm('user_id', v)} />
              <Field label="Address" value={form.address} onChange={v => updateForm('address', v)} />
            </div>
            <div>
              <Field label="Status" as="select" value={form.status} onChange={v => updateForm('status', v)} options={['Passive', 'Active']} />
              <Field label="Salutation" value={form.salutation} onChange={v => updateForm('salutation', v)} />
              <Field label="Designation" value={form.designation} onChange={v => updateForm('designation', v)} />
              <Field label="Gender" as="select" value={form.gender} onChange={v => updateForm('gender', v)} options={['Male', 'Female', 'Other']} />
              <Field label="Company Name" value={form.company_name} onChange={v => updateForm('company_name', v)} />
            </div>
          </Section>

          <FullSection>
            <div className="mb-6">
              <Field label="Sync with Google Contacts" type="checkbox" value={form.sync_with_google_contacts} onChange={v => updateForm('sync_with_google_contacts', v)} />
            </div>
          </FullSection>

          <FullSection title="Contact Details">
            <div className="text-[12px] font-medium text-gray-600 mb-2">Email IDs</div>
            <div className="border border-gray-200 rounded overflow-hidden mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-[11px] font-medium w-10 text-center"><input type="checkbox" disabled className="rounded border-gray-300" /></th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center">No.</th>
                    <th className="px-3 py-2 text-[11px] font-medium ">Email ID <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2 text-[11px] font-medium w-24 text-center">Is Primary</th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center"><Settings size={12} className="mx-auto" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.emails.map((e, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-3 py-2 text-[12px] text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-3 py-1">
                        <input type="text" value={e.email_id} onChange={(ev) => updateEmail(idx, 'email_id', ev.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-[13px] px-0 py-1" placeholder="email@example.com" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={e.is_primary} onChange={(ev) => updateEmail(idx, 'is_primary', ev.target.checked)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeEmail(idx)} className="text-gray-400 hover:text-red-500"><Trash size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {form.emails.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                        <FileText size={24} className="mx-auto mb-2 opacity-50" />
                        <div className="text-[13px]">No Data</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                <button onClick={addEmail} className="text-[12px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 transition-colors">Add Row</button>
              </div>
            </div>

            <div className="text-[12px] font-medium text-gray-600 mb-2">Contact Numbers</div>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-[11px] font-medium w-10 text-center"><input type="checkbox" disabled className="rounded border-gray-300" /></th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center">No.</th>
                    <th className="px-3 py-2 text-[11px] font-medium ">Number <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2 text-[11px] font-medium w-32 text-center">Is Primary Phone</th>
                    <th className="px-3 py-2 text-[11px] font-medium w-32 text-center">Is Primary Mobile</th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center"><Settings size={12} className="mx-auto" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.numbers.map((n, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-3 py-2 text-[12px] text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-3 py-1">
                        <input type="text" value={n.number} onChange={(ev) => updateNumber(idx, 'number', ev.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-[13px] px-0 py-1" placeholder="+91 1234567890" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={n.is_primary_phone} onChange={(ev) => updateNumber(idx, 'is_primary_phone', ev.target.checked)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={n.is_primary_mobile} onChange={(ev) => updateNumber(idx, 'is_primary_mobile', ev.target.checked)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeNumber(idx)} className="text-gray-400 hover:text-red-500"><Trash size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {form.numbers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                        <FileText size={24} className="mx-auto mb-2 opacity-50" />
                        <div className="text-[13px]">No Data</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                <button onClick={addNumber} className="text-[12px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 transition-colors">Add Row</button>
              </div>
            </div>
          </FullSection>

          <FullSection title="Reference">
            <div className="text-[12px] font-medium text-gray-600 mb-2">Links</div>
            <div className="border border-gray-200 rounded overflow-hidden mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-[11px] font-medium w-10 text-center"><input type="checkbox" disabled className="rounded border-gray-300" /></th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center">No.</th>
                    <th className="px-3 py-2 text-[11px] font-medium ">Link Document Type <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2 text-[11px] font-medium ">Link Name <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2 text-[11px] font-medium">Link Title</th>
                    <th className="px-3 py-2 text-[11px] font-medium w-12 text-center"><Settings size={12} className="mx-auto" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.links.map((l, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-3 py-2 text-[12px] text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-3 py-1">
                        <select value={l.link_document_type} onChange={(ev) => updateLink(idx, 'link_document_type', ev.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-[13px] px-0 py-1">
                          <option value="Customer">Customer</option>
                          <option value="Company">Company</option>
                          <option value="Supplier">Supplier</option>
                          <option value="Lead">Lead</option>
                        </select>
                      </td>
                      <td className="px-3 py-1">
                        <input type="text" value={l.link_name} onChange={(ev) => updateLink(idx, 'link_name', ev.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-[13px] px-0 py-1" placeholder="Name" />
                      </td>
                      <td className="px-3 py-1">
                        <input type="text" value={l.link_title} onChange={(ev) => updateLink(idx, 'link_title', ev.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-[13px] px-0 py-1" placeholder="Title" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeLink(idx)} className="text-gray-400 hover:text-red-500"><Trash size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {form.links.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                        <FileText size={24} className="mx-auto mb-2 opacity-50" />
                        <div className="text-[13px]">No Data</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                <button onClick={addLink} className="text-[12px] font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 transition-colors">Add Row</button>
              </div>
            </div>
            
            <div className="space-y-4">
              <Field label="Is Primary Contact" type="checkbox" value={form.is_primary_contact} onChange={v => updateForm('is_primary_contact', v)} />
              <Field label="Is Billing Contact" type="checkbox" value={form.is_billing_contact} onChange={v => updateForm('is_billing_contact', v)} />
            </div>
          </FullSection>

          <Section title="More Information">
            <Field label="Department" value={form.department} onChange={v => updateForm('department', v)} />
            <Field label="Unsubscribed" type="checkbox" value={form.unsubscribed} onChange={v => updateForm('unsubscribed', v)} />
          </Section>
          
        </div>
      </div>
    </div>
  );
}

export default ContactFormPage;
