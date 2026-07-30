import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { ArrowLeft, Save, Trash2, FileText, Settings, Menu, Edit2, Plus, X, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';

const Modal = ({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", disabled = false, required = false, helpText = "", step, placeholder = "" }) => {
  if (type === "checkbox") {
    return (
      <div className="flex flex-col mb-4 w-full">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={value}
            onChange={e => onChange(e.target.checked)}
            disabled={disabled}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-[13px] text-gray-800 font-medium tracking-tight">
            {label}
          </span>
        </label>
        {helpText && <div className="text-[12px] text-gray-500 mt-1">{helpText}</div>}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col mb-4 w-full">
      <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500 font-mono"
      />
    </div>
  );
};

const FrappeLinkSelect = ({ value, onChange, options = [], placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    const name = typeof opt === 'string' ? opt : opt.payment_term_name || opt.name || '';
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelect = (optName) => {
    setQuery(optName);
    onChange(optName);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus-within:bg-white border border-gray-200 rounded-md px-3 py-1.5 flex items-center justify-between cursor-text transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent border-none focus:outline-none text-[13px] text-gray-800 placeholder-gray-400 font-mono"
        />
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => {
              const name = typeof opt === 'string' ? opt : opt.payment_term_name || opt.name || '';
              const desc = typeof opt === 'object' ? opt.description : '';
              return (
                <div
                  key={i}
                  onClick={() => handleSelect(name)}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex flex-col"
                >
                  <span className="text-[13px] font-medium text-gray-800 font-mono">{name}</span>
                  {desc && <span className="text-[11px] text-gray-500 truncate">{desc}</span>}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-[12px] text-gray-400 italic">
              No matching terms found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PaymentTermsTemplateFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [masterTerms, setMasterTerms] = useState([]);
  const [activeModalRow, setActiveModalRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  
  const [form, setForm] = useState({
    template_name: '',
    allocate_payment_based_on_payment_terms: false,
    terms: [],
    ...location.state?.defaultData
  });

  useEffect(() => {
    api.get('/payment-terms').then(res => {
      setMasterTerms(res.data || []);
    }).catch(e => console.error('Failed to fetch payment terms master', e));

    if (isEdit) {
      api.get(`/payment-terms-templates/${id}`).then(res => {
        setForm(prev => ({ ...prev, ...res.data }));
      }).catch(() => toast.error('Failed to load template'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.template_name || !form.template_name.trim()) {
      toast.error('Template Name is required');
      return;
    }

    setSaving(true);
    try {
      const cleanedTerms = form.terms.map(t => ({
        ...t,
        invoice_portion: parseFloat(t.invoice_portion) || 0,
        credit_days: parseInt(t.credit_days, 10) || 0,
        credit_months: parseInt(t.credit_months, 10) || 0,
        discount: parseFloat(t.discount) || 0,
        discount_validity: parseInt(t.discount_validity, 10) || 0
      }));

      const payload = { ...form, terms: cleanedTerms };

      if (isEdit) {
        await api.put(`/payment-terms-templates/${id}`, payload);
        toast.success('Template updated successfully');
      } else {
        const res = await api.post('/payment-terms-templates', payload);
        toast.success('Template created successfully');
        navigate(`/payment-terms-templates/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const addTerm = () => {
    updateForm('terms', [
      ...form.terms, 
      { 
        payment_term: '', 
        description: '', 
        invoice_portion: 0, 
        due_date_based_on: 'Day(s) after invoice date', 
        credit_days: 0,
        credit_months: 0,
        discount_type: '',
        discount: 0,
        discount_validity_based_on: 'Day(s) after invoice date',
        discount_validity: 0
      }
    ]);
  };

  const removeTerm = (idx) => {
    updateForm('terms', form.terms.filter((_, i) => i !== idx));
    setSelectedRows(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
    if (activeModalRow === idx) setActiveModalRow(null);
  };

  const deleteSelectedRows = () => {
    if (selectedRows.length === 0) return;
    updateForm('terms', form.terms.filter((_, i) => !selectedRows.includes(i)));
    setSelectedRows([]);
  };

  const updateTerm = (idx, k, v) => updateForm('terms', form.terms.map((t, i) => i === idx ? { ...t, [k]: v } : t));

  const handleSelectMasterTerm = (idx, termName) => {
    const pt = masterTerms.find(m => (m.payment_term_name || m.payment_term || m.id) === termName);
    if (pt) {
      updateForm('terms', form.terms.map((t, i) => i === idx ? {
        ...t,
        payment_term: pt.payment_term_name || pt.payment_term || termName,
        description: pt.description || t.description || '',
        invoice_portion: pt.invoice_portion !== undefined ? pt.invoice_portion : t.invoice_portion,
        due_date_based_on: pt.due_date_based_on || t.due_date_based_on || 'Day(s) after invoice date',
        credit_days: pt.credit_days !== undefined ? pt.credit_days : t.credit_days,
        credit_months: pt.credit_months !== undefined ? pt.credit_months : t.credit_months,
        discount_type: pt.discount_type || t.discount_type || '',
        discount: pt.discount !== undefined ? pt.discount : t.discount,
        discount_validity_based_on: pt.discount_validity_based_on || t.discount_validity_based_on || 'Day(s) after invoice date',
        discount_validity: pt.discount_validity !== undefined ? pt.discount_validity : t.discount_validity
      } : t));
    } else {
      updateTerm(idx, 'payment_term', termName);
    }
  };

  const toggleRowSelect = (idx) => {
    setSelectedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const toggleAllSelect = (e) => {
    if (e.target.checked) {
      setSelectedRows(form.terms.map((_, i) => i));
    } else {
      setSelectedRows([]);
    }
  };

  const totalPortion = form.terms.reduce((acc, t) => acc + (parseFloat(t.invoice_portion) || 0), 0);
  const isHundred = Math.abs(totalPortion - 100) < 0.001;

  return (
    <div className="min-h-screen frappe-page flex flex-col font-sans pb-20">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/payment-terms-templates')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">{isEdit ? form.template_name : 'New Payment Terms Template'}</h1>
            {!isEdit ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-100/50">Not Saved</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">Saved</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1d4ed8] hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm disabled:opacity-50">
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-6">
        <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
          
          <div className="mb-6">
            <Field label="Template Name" value={form.template_name} onChange={v => updateForm('template_name', v)} required placeholder="e.g., Standard Payment Schedule, 50-50 Split" />
          </div>

          <div className="mb-8">
            <Field 
              label="Allocate Payment Based On Payment Terms" 
              type="checkbox" 
              value={form.allocate_payment_based_on_payment_terms} 
              onChange={v => updateForm('allocate_payment_based_on_payment_terms', v)}
              helpText="If this checkbox is checked, paid amount will be splitted and allocated as per the amounts in payment schedule against each payment term"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-gray-700 tracking-tight">Payment Terms</div>
              {form.terms.length > 0 && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isHundred ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {isHundred ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  Total Portion: {totalPortion.toFixed(2)}%
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-visible mb-4 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-gray-200 text-gray-600 font-medium text-[12px]">
                    <th className="px-3 py-2.5 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={form.terms.length > 0 && selectedRows.length === form.terms.length}
                        onChange={toggleAllSelect}
                        disabled={form.terms.length === 0}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      />
                    </th>
                    <th className="px-3 py-2.5 w-12 text-center">No.</th>
                    <th className="px-3 py-2.5 min-w-[220px]">Payment Term</th>
                    <th className="px-3 py-2.5 min-w-[180px]">Description</th>
                    <th className="px-3 py-2.5 w-36 text-right">Invoice Portion (%) <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2.5 w-52">Due Date Based On <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2.5 w-28 text-right">Credit Days</th>
                    <th className="px-3 py-2.5 w-20 text-center"><Edit2 size={14} className="mx-auto text-gray-500" title="Actions" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {form.terms.map((t, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50/20 transition-colors ${selectedRows.includes(idx) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedRows.includes(idx)}
                          onChange={() => toggleRowSelect(idx)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        />
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-gray-500 text-center font-mono">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <FrappeLinkSelect
                          value={t.payment_term || ''}
                          onChange={(val) => handleSelectMasterTerm(idx, val)}
                          options={masterTerms}
                          placeholder="Payment Term"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input 
                          type="text" 
                          value={t.description || ''} 
                          onChange={(ev) => updateTerm(idx, 'description', ev.target.value)} 
                          placeholder="Description" 
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-500 rounded text-[13px] px-2 py-1 text-gray-700 placeholder-gray-400 focus:outline-none transition-all" 
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input 
                          type="number" 
                          step="any" 
                          value={t.invoice_portion} 
                          onChange={(ev) => updateTerm(idx, 'invoice_portion', ev.target.value)} 
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-500 rounded text-[13px] px-2 py-1 text-right font-semibold text-gray-800 focus:outline-none transition-all font-mono" 
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select 
                          value={t.due_date_based_on || 'Day(s) after invoice date'} 
                          onChange={(ev) => updateTerm(idx, 'due_date_based_on', ev.target.value)} 
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-500 rounded text-[13px] px-2 py-1 text-gray-700 font-medium focus:outline-none transition-all"
                        >
                          <option value="Day(s) after invoice date">Day(s) after invoice date</option>
                          <option value="Day(s) after the end of the invoice month">Day(s) after the end of the invoice month</option>
                          <option value="Month(s) after the end of the invoice month">Month(s) after the end of the invoice month</option>
                          <option value="Day(s) after quotation date">Day(s) after quotation date</option>
                          <option value="Day(s) after sales order date">Day(s) after sales order date</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input 
                          type="number" 
                          value={t.credit_days || 0} 
                          onChange={(ev) => updateTerm(idx, 'credit_days', ev.target.value)} 
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-500 rounded text-[13px] px-2 py-1 text-right text-gray-800 focus:outline-none transition-all font-mono" 
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button" 
                            onClick={() => setActiveModalRow(idx)} 
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                            title="Edit Row Details & Discounts"
                          >
                            <Edit2 size={14}/>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => removeTerm(idx)} 
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                            title="Delete Row"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {form.terms.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center text-gray-400">
                        <FileText size={28} className="mx-auto mb-2 opacity-30" />
                        <div className="text-[13px] font-medium text-gray-600">No payment terms in this template</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">Click "Add Row" below to insert your first schedule term</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button 
                type="button"
                onClick={addTerm} 
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3.5 py-1.5 rounded transition-colors shadow-2xs cursor-pointer"
              >
                <Plus size={14} /> Add Row
              </button>

              {selectedRows.length > 0 && (
                <button 
                  type="button"
                  onClick={deleteSelectedRows}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded transition-colors cursor-pointer"
                >
                  <Trash2 size={14} /> Delete Selected ({selectedRows.length})
                </button>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Row Detailed Settings Modal */}
      {activeModalRow !== null && form.terms[activeModalRow] && (
        <Modal title={`Edit Row #${activeModalRow + 1} Details`} isOpen={true} onClose={() => setActiveModalRow(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block tracking-tight">Payment Term</label>
              <FrappeLinkSelect
                value={form.terms[activeModalRow].payment_term || ''}
                onChange={(val) => handleSelectMasterTerm(activeModalRow, val)}
                options={masterTerms}
                placeholder="Payment Term"
              />
            </div>

            <Field
              label="Description"
              value={form.terms[activeModalRow].description || ''}
              onChange={v => updateTerm(activeModalRow, 'description', v)}
            />

            <Field
              label="Credit Months"
              type="number"
              value={form.terms[activeModalRow].credit_months || 0}
              onChange={v => updateTerm(activeModalRow, 'credit_months', v)}
            />

            <div>
              <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">Discount Type</label>
              <select
                value={form.terms[activeModalRow].discount_type || ''}
                onChange={e => updateTerm(activeModalRow, 'discount_type', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">None</option>
                <option value="Percentage">Percentage (%)</option>
                <option value="Amount">Amount (INR)</option>
              </select>
            </div>

            {form.terms[activeModalRow].discount_type && (
              <>
                <Field
                  label="Discount Value"
                  type="number"
                  step="any"
                  value={form.terms[activeModalRow].discount || 0}
                  onChange={v => updateTerm(activeModalRow, 'discount', v)}
                />

                <div>
                  <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">Discount Validity Based On</label>
                  <select
                    value={form.terms[activeModalRow].discount_validity_based_on || 'Day(s) after invoice date'}
                    onChange={e => updateTerm(activeModalRow, 'discount_validity_based_on', e.target.value)}
                    className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Day(s) after invoice date">Day(s) after invoice date</option>
                    <option value="Day(s) after the end of the invoice month">Day(s) after the end of the invoice month</option>
                    <option value="Month(s) after the end of the invoice month">Month(s) after the end of the invoice month</option>
                  </select>
                </div>

                <Field
                  label="Discount Validity (Days/Months)"
                  type="number"
                  value={form.terms[activeModalRow].discount_validity || 0}
                  onChange={v => updateTerm(activeModalRow, 'discount_validity', v)}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setActiveModalRow(null)} className="bg-[#1d4ed8] text-white px-4 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 shadow-sm cursor-pointer">
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentTermsTemplateFormPage;
