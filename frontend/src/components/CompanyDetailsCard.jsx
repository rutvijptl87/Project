import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Building2, Save, Upload, CheckCircle2, AlertCircle, FileText, Trash2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const CompanyDetailsCard = () => {
  const [details, setDetails] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const qrFileRef = useRef(null);
  const logoFileRef = useRef(null);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const r = await api.get('/company-details');
      setDetails(r.data);
      setDraft(r.data);
    } catch (err) {
      console.error('Failed to load company details', err);
      setMsg({ type: 'error', text: 'Failed to load company details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, []);

  const handleInputChange = (field, value) => {
    setDraft(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
      setMsg({ type: 'error', text: 'Only images (JPG, JPEG, PNG, WEBP) or PDF files are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File size exceeds 5MB limit.' });
      return;
    }

    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/company-details/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDraft(prev => ({ ...prev, qr_code_url: r.data.url }));
      setMsg({ type: 'success', text: 'QR Code/PDF uploaded. Click "Save Details" to persist changes.' });
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to upload file.' });
    } finally {
      setUploading(false);
      if (qrFileRef.current) qrFileRef.current.value = '';
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
      setMsg({ type: 'error', text: 'Only images (JPG, JPEG, PNG, WEBP) or PDF files are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File size exceeds 5MB limit.' });
      return;
    }

    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/company-details/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDraft(prev => ({ ...prev, company_logo_url: r.data.url }));
      setMsg({ type: 'success', text: 'Company Logo uploaded. Click "Save Details" to persist changes.' });
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to upload file.' });
    } finally {
      setUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await api.put('/company-details', draft);
      setDetails(r.data);
      setDraft(r.data);
      setMsg({ type: 'success', text: 'Company details updated successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to update company details.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearQR = () => {
    setDraft(prev => ({ ...prev, qr_code_url: '' }));
    setMsg({ type: 'success', text: 'QR Code removed. Click "Save Details" to persist changes.' });
  };

  const handleClearLogo = () => {
    setDraft(prev => ({ ...prev, company_logo_url: '' }));
    setMsg({ type: 'success', text: 'Company Logo removed. Click "Save Details" to persist changes.' });
  };

  if (loading) {
    return (
      <div className="card p-6 mb-4" data-testid="company-details-card-loading">
        <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Building2 size={18}/> Company Details
        </h2>
        <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading company configuration…</p>
      </div>
    );
  }

  const isChanged = JSON.stringify(details) !== JSON.stringify(draft);
  const qrUrl = draft?.qr_code_url ? `${BACKEND}${draft.qr_code_url}` : '';
  const isPdf = draft?.qr_code_url?.toLowerCase().endsWith('.pdf');
  const logoUrl = draft?.company_logo_url ? `${BACKEND}${draft.company_logo_url}` : '';
  const isLogoPdf = draft?.company_logo_url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="card p-6 mb-4" data-testid="company-details-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <Building2 size={18}/> Company Details
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
        Configure company name, address, tax identification, bank details, and payment options for generating invoices.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Section 1: Contact Details */}
          <div className="space-y-4 p-4 rounded-lg" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
            <h3 className="font-head font-bold text-md mb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)' }}>
              1. Contact Details
            </h3>
            
            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                required
                className="input font-semibold"
                value={draft.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g. CREATOR RCC CONSULTANT LLP"
                data-testid="company-name-input"
              />
            </div>

            <div>
              <label className="label">Address</label>
              <textarea
                required
                rows={3}
                className="textarea text-sm"
                value={draft.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Full company address..."
                data-testid="company-address-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">GSTIN</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.gstin || ''}
                  onChange={(e) => handleInputChange('gstin', e.target.value)}
                  placeholder="GST Identification Number"
                  data-testid="company-gstin-input"
                />
              </div>
              <div>
                <label className="label">PAN Number</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.pan || ''}
                  onChange={(e) => handleInputChange('pan', e.target.value)}
                  placeholder="PAN"
                  data-testid="company-pan-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Mobile</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.mobile || ''}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  placeholder="Mobile Number"
                  data-testid="company-mobile-input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input text-sm"
                  value={draft.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Email Address"
                  data-testid="company-email-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bank Details */}
          <div className="space-y-4 p-4 rounded-lg" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
            <h3 className="font-head font-bold text-md mb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)' }}>
              2. Bank Details
            </h3>

            <div>
              <label className="label">Account Name</label>
              <input
                type="text"
                required
                className="input text-sm"
                value={draft.bank_account_name || ''}
                onChange={(e) => handleInputChange('bank_account_name', e.target.value)}
                placeholder="Beneficiary Account Name"
                data-testid="company-bank-acc-name-input"
              />
            </div>

            <div>
              <label className="label">Bank Name</label>
              <input
                type="text"
                required
                className="input text-sm"
                value={draft.bank_name || ''}
                onChange={(e) => handleInputChange('bank_name', e.target.value)}
                placeholder="e.g. Kotak Mahindra Bank"
                data-testid="company-bank-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">IFSC Code</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.bank_ifsc || ''}
                  onChange={(e) => handleInputChange('bank_ifsc', e.target.value)}
                  placeholder="IFSC"
                  data-testid="company-bank-ifsc-input"
                />
              </div>
              <div>
                <label className="label">Account No</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.bank_account_no || ''}
                  onChange={(e) => handleInputChange('bank_account_no', e.target.value)}
                  placeholder="Account Number"
                  data-testid="company-bank-acc-no-input"
                />
              </div>
            </div>

            <div>
              <label className="label">Bank & Branch Name</label>
              <textarea
                required
                rows={2}
                className="textarea text-sm"
                value={draft.bank_branch || ''}
                onChange={(e) => handleInputChange('bank_branch', e.target.value)}
                placeholder="e.g. Airoli Branch, Sector 8..."
                data-testid="company-bank-branch-input"
              />
            </div>
          </div>

          {/* Section 3: Payments & Assets Details */}
          <div className="space-y-4 p-4 rounded-lg flex flex-col justify-between" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
            <div className="space-y-4">
              <h3 className="font-head font-bold text-md mb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)' }}>
                3. Payments & Assets
              </h3>

              <div>
                <label className="label">UPI ID</label>
                <input
                  type="text"
                  required
                  className="input font-mono-data"
                  value={draft.upi_id || ''}
                  onChange={(e) => handleInputChange('upi_id', e.target.value)}
                  placeholder="e.g. user@bank"
                  data-testid="company-upi-id-input"
                />
              </div>

              {/* QR Upload */}
              <div>
                <label className="label">Payment QR Code (PDF or Image)</label>
                <input
                  ref={qrFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="company-qr-file-input"
                />
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => qrFileRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-outline w-full"
                    data-testid="btn-upload-qr"
                  >
                    <Upload size={14}/> {uploading ? 'Uploading…' : 'Upload QR Code / PDF'}
                  </button>
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="label">Company Logo (PDF or Image)</label>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="company-logo-file-input"
                />
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-outline w-full"
                    data-testid="btn-upload-logo"
                  >
                    <Upload size={14}/> {uploading ? 'Uploading…' : 'Upload Logo / PDF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Asset Previews */}
            <div className="mt-4 pt-4 border-t border-dashed space-y-4" style={{ borderColor: 'var(--cc-border)' }}>
              {/* QR Code / PDF Preview */}
              <div>
                <span className="text-[10px] block mb-1 font-bold" style={{ color: 'var(--cc-text-muted)' }}>QR Code Preview:</span>
                {draft.qr_code_url ? (
                  <div className="text-center">
                    {isPdf ? (
                      <div className="p-3 bg-white border rounded-md inline-flex flex-col items-center justify-center w-full min-h-[90px]">
                        <FileText size={30} className="text-red-500 mb-1" />
                        <a
                          href={qrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link-underline text-xs font-semibold"
                          data-testid="company-qr-pdf-link"
                        >
                          View QR Code PDF
                        </a>
                      </div>
                    ) : (
                      <div className="bg-white p-2 border rounded-md inline-block max-w-[120px]">
                        <img
                          src={qrUrl}
                          alt="Payment QR Code Preview"
                          className="max-h-[90px] w-auto mx-auto object-contain"
                          data-testid="company-qr-img-preview"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleClearQR}
                        className="btn btn-sm btn-outline text-red-600 border-red-200 py-0.5 px-2 text-[10px]"
                        data-testid="btn-remove-qr"
                      >
                        <Trash2 size={10}/> Remove QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs p-4 rounded border border-dashed bg-white flex flex-col items-center justify-center min-h-[90px]" style={{ color: 'var(--cc-text-muted)' }}>
                    No QR Code / PDF uploaded
                  </div>
                )}
              </div>

              {/* Company Logo Preview */}
              <div>
                <span className="text-[10px] block mb-1 font-bold" style={{ color: 'var(--cc-text-muted)' }}>Logo Preview:</span>
                {draft.company_logo_url ? (
                  <div className="text-center">
                    {isLogoPdf ? (
                      <div className="p-3 bg-white border rounded-md inline-flex flex-col items-center justify-center w-full min-h-[90px]">
                        <FileText size={30} className="text-red-500 mb-1" />
                        <a
                          href={logoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link-underline text-xs font-semibold"
                          data-testid="company-logo-pdf-link"
                        >
                          View Logo PDF
                        </a>
                      </div>
                    ) : (
                      <div className="bg-white p-2 border rounded-md inline-block max-w-[120px]">
                        <img
                          src={logoUrl}
                          alt="Company Logo Preview"
                          className="max-h-[90px] w-auto mx-auto object-contain"
                          data-testid="company-logo-img-preview"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="btn btn-sm btn-outline text-red-600 border-red-200 py-0.5 px-2 text-[10px]"
                        data-testid="btn-remove-logo"
                      >
                        <Trash2 size={10}/> Remove Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs p-4 rounded border border-dashed bg-white flex flex-col items-center justify-center min-h-[90px]" style={{ color: 'var(--cc-text-muted)' }}>
                    No Logo uploaded (Falls back to default)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action button and status message */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <button
            type="submit"
            disabled={saving || !isChanged}
            className="btn btn-primary px-6"
            data-testid="company-details-save-btn"
          >
            <Save size={16}/> {saving ? 'Saving…' : 'Save Details'}
          </button>
          
          {msg && (
            <div
              className="text-xs rounded-md p-2.5 flex items-center gap-1.5"
              style={msg.type === 'error'
                ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
                : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
              data-testid="company-details-msg"
            >
              {msg.type === 'success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
              {msg.text}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default CompanyDetailsCard;
