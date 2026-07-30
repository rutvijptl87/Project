import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { ArrowLeft, Save, Trash2, FileText, Menu, Layers } from 'lucide-react';
import Swal from 'sweetalert2';

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
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
      />
      {helpText && <div className="text-[11px] text-gray-400 mt-1">{helpText}</div>}
    </div>
  );
};

const PaymentTermFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    payment_term_name: '',
    invoice_portion: 100,
    due_date_based_on: 'Day(s) after invoice date',
    credit_days: 0,
    credit_months: 0,
    mode_of_payment: '',
    description: '',
    discount_type: '',
    discount: 0,
    discount_validity_based_on: 'Day(s) after invoice date',
    discount_validity: 0,
    ...location.state?.defaultData
  });

  useEffect(() => {
    if (isEdit) {
      api.get(`/payment-terms/${id}`).then(res => {
        setForm(prev => ({ 
          ...prev, 
          ...res.data,
          payment_term_name: res.data.payment_term_name || res.data.payment_term || ''
        }));
      }).catch(() => toast.error('Failed to load Payment Term'));
    }
  }, [id, isEdit]);

  const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.payment_term_name || !form.payment_term_name.trim()) {
      toast.error('Payment Term Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        payment_term_name: form.payment_term_name.trim(),
        payment_term: form.payment_term_name.trim(),
        invoice_portion: parseFloat(form.invoice_portion) || 0,
        credit_days: parseInt(form.credit_days, 10) || 0,
        credit_months: parseInt(form.credit_months, 10) || 0,
        mode_of_payment: form.mode_of_payment || '',
        discount: parseFloat(form.discount) || 0,
        discount_validity: parseInt(form.discount_validity, 10) || 0
      };

      if (isEdit) {
        await api.put(`/payment-terms/${id}`, payload);
        toast.success('Payment Term updated successfully');
      } else {
        const res = await api.post('/payment-terms', payload);
        toast.success('Payment Term created successfully');
        navigate(`/payment-terms/${res.data.id}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      const errDetail = e?.response?.data?.detail;
      if (errDetail) {
        toast.error(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
      } else {
        toast.error('Failed to save Payment Term');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to delete "${form.payment_term_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/payment-terms/${id}`);
      toast.success('Deleted successfully');
      navigate('/payment-terms');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans pb-20 text-[#1e293b] max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-3.5 bg-white border-b border-gray-200 sticky top-16 z-10 shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => navigate('/payment-terms')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors" title="Back to List">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              {isEdit ? form.payment_term_name : 'New Payment Term'}
            </h1>
            {!isEdit ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-100">Not Saved</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">Saved</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && (
            <button 
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-xs font-medium transition-colors shadow-sm"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 bg-[#1d4ed8] hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Form Content Area */}
      <div className="max-w-4xl 2xl:max-w-[1400px] mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        
        {/* Section 1: Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <span>Payment Term Details</span>
            <span className="text-xs font-normal text-gray-400">Master settings for payment scheduling</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Field 
                label="Payment Term Name" 
                value={form.payment_term_name} 
                onChange={v => updateForm('payment_term_name', v)} 
                required 
                helpText="e.g., '50% Advance', '30 Days Credit', 'On Delivery'"
              />
            </div>
            <div>
              <Field 
                label="Invoice Portion (%)" 
                type="number" 
                step="any"
                value={form.invoice_portion} 
                onChange={v => updateForm('invoice_portion', v)} 
                required 
                helpText="Percentage of invoice amount due under this term"
              />
            </div>

            <div>
              <Field 
                label="Mode of Payment" 
                value={form.mode_of_payment} 
                onChange={v => updateForm('mode_of_payment', v)} 
                placeholder="e.g., Cash, Bank Transfer, Cheque"
                helpText="Default mode of payment for this term"
              />
            </div>

            <div>
              <label className="text-[12px] text-gray-500 mb-1 flex items-center tracking-tight">
                Due Date Based On <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={form.due_date_based_on}
                onChange={e => updateForm('due_date_based_on', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="Day(s) after invoice date">Day(s) after invoice date</option>
                <option value="Day(s) after the end of the invoice month">Day(s) after the end of the invoice month</option>
                <option value="Month(s) after the end of the invoice month">Month(s) after the end of the invoice month</option>
                <option value="Day(s) after quotation date">Day(s) after quotation date</option>
                <option value="Day(s) after sales order date">Day(s) after sales order date</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field 
                label="Credit Days" 
                type="number" 
                value={form.credit_days} 
                onChange={v => updateForm('credit_days', v)} 
              />
              <Field 
                label="Credit Months" 
                type="number" 
                value={form.credit_months} 
                onChange={v => updateForm('credit_months', v)} 
              />
            </div>
          </div>
        </div>

        {/* Section 2: Discount Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <span>Discount Settings</span>
            <span className="text-xs font-normal text-gray-400">Optional early payment discount rules</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block tracking-tight">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={e => updateForm('discount_type', e.target.value)}
                className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">None</option>
                <option value="Percentage">Percentage (%)</option>
                <option value="Amount">Amount (INR)</option>
              </select>
            </div>

            {form.discount_type && (
              <div>
                <Field 
                  label={`Discount (${form.discount_type === 'Percentage' ? '%' : 'INR'})`} 
                  type="number" 
                  step="any"
                  value={form.discount} 
                  onChange={v => updateForm('discount', v)} 
                />
              </div>
            )}

            {form.discount_type && (
              <>
                <div>
                  <label className="text-[12px] text-gray-500 mb-1 block tracking-tight">Discount Validity Based On</label>
                  <select
                    value={form.discount_validity_based_on}
                    onChange={e => updateForm('discount_validity_based_on', e.target.value)}
                    className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md px-3 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Day(s) after invoice date">Day(s) after invoice date</option>
                    <option value="Day(s) after the end of the invoice month">Day(s) after the end of the invoice month</option>
                    <option value="Month(s) after the end of the invoice month">Month(s) after the end of the invoice month</option>
                  </select>
                </div>

                <div>
                  <Field 
                    label="Discount Validity (Days / Months)" 
                    type="number" 
                    value={form.discount_validity} 
                    onChange={v => updateForm('discount_validity', v)} 
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 3: Description */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Description
          </h3>
          <div className="flex flex-col w-full">
            <label className="text-[12px] text-gray-500 mb-1">Text shown on Invoice / Document Schedule</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="Enter detailed notes or description for this payment term..."
              className="w-full bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-md p-3 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 transition-colors min-h-[100px]"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default PaymentTermFormPage;
