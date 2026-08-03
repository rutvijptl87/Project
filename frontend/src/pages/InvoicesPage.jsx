import React, { useEffect, useState, useRef } from 'react';
import Pagination from '../components/Pagination';
import { api, API } from '../lib/api';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import {
  FileText,
  Receipt,
  ChevronLeft,
  Download,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building,
  User,
  Percent,
  IndianRupee,
  Pencil,
  Upload,
  Briefcase
, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// Flat Read-Only Field component (no input border focus/active states, normal cursor, no hover)
const FlatReadOnlyField = ({ label, value }) => (
  <div>
    <label className="label">{label}</label>
    <div
      className="py-2.5 px-3 bg-gray-50/50 border rounded-md text-sm font-mono-data text-gray-700 select-all"
      style={{ cursor: 'default', borderColor: 'var(--cc-border)' }}
    >
      {value || '—'}
    </div>
  </div>
);

const InvoicesPage = () => {
  // Navigation views: "dashboard", "proforma_list", "tax_list", "create_form"
  const [view, setView] = useState('dashboard');
  const [formType, setFormType] = useState('proforma');
  const [editingId, setEditingId] = useState(null); // null when creating, invoice ID when editing

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [company, setCompany] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportDates, setExportDates] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  
  const [ledgerModal, setLedgerModal] = useState(false);
  const [ledgerClientId, setLedgerClientId] = useState("");
  const [downloadingLedger, setDownloadingLedger] = useState(false);
  
  const downloadLedger = async () => {
    if (!ledgerClientId) return;
    setDownloadingLedger(true);
    try {
      const c = clients.find(cl => cl.id === ledgerClientId);
      const filename = c ? `Ledger_${c.name.replace(/[^A-Za-z0-9_]/g, '_')}.xlsx` : 'Ledger.xlsx';
      await downloadFile(`/clients/${ledgerClientId}/ledger/export`, filename);
      setLedgerModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to download ledger');
    } finally {
      setDownloadingLedger(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let url = `/invoices/export/excel`;
      const params = new URLSearchParams();
      if (exportDates.start) params.append('start_date', exportDates.start);
      if (exportDates.end) params.append('end_date', exportDates.end);
      if (params.toString()) url += `?${params.toString()}`;
      
      await downloadFile(url, `Tax_Invoices_Export.xlsx`);
      setExportModal(false);
    } catch (err) {
      toast.error('Failed to export invoices.');
    } finally {
      setExporting(false);
    }
  };
  const tableRef = useRef(null);
  const fileInputRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [tdsPercent, setTdsPercent] = useState(10);
  const [tdsSection, setTdsSection] = useState('194J');

  // Search state for client autocomplete
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isDropdownFocused, setIsDropdownFocused] = useState(false);

  // Pagination and List Search
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Form Draft State (using empty strings for numbers to support backspacing)
  const initialForm = {
    expiry_date: '',
    hsn_code: '998332',
    po_number: '',
    client_id: '',
    client_name: '',
    client_company: '',
    client_address: '',
    client_gstin: '',
    client_mobile: '',
    client_pan: '',
    place_of_supply: 'Maharashtra',
    project_id: '',
    items: [{
      service_description: 'Structural Design and Consultancy Charges for ',
      qty: 1,
      rate: ''
    }],
    gst_percent: 18,
    tds_percent: 10,
    tds_section: '194J',
    received_amount: 0
  };
  const [draft, setDraft] = useState(initialForm);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const clientSearchRef = useRef(clientSearch);
  clientSearchRef.current = clientSearch;

  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on search change
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (view === 'dashboard' || view.endsWith('_list')) {
      const loadInvoices = async () => {
        try {
          setLoading(true);
          const r = await api.get('/invoices/paginated', {
            params: { page, limit, q: debouncedSearch, type: formType }
          });
          setInvoices(r.data.data || []);
          setTotal(r.data.total || 0);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadInvoices();
    }
  }, [page, debouncedSearch, formType, view, refreshKey]);

  useEffect(() => {
    const loadStaticData = async () => {
      try {
        const [clientRes, companyRes, projectRes, architectRes] = await Promise.all([
          api.get('/clients'),
          api.get('/company-details'),
          api.get('/projects'),
          api.get('/architects')
        ]);
        const clientsData = (clientRes.data || []).map(c => ({ ...c, isArchitect: false }));
        const architectsData = (architectRes.data || []).map(a => ({ ...a, isArchitect: true }));
        setClients([...clientsData, ...architectsData]);
        setCompany(companyRes.data || null);
        setProjects(projectRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadStaticData();
  }, []);

  const handleCreateClick = (type) => {
    setFormType(type);
    setEditingId(null);
    setDraft({
      ...initialForm,
      expiry_date: type === 'proforma' ? getDefaultExpiryDate() : ''
    });
    setClientSearch('');
    setView('create_form');
    setMsg(null);
  };

  const handleEditClick = (inv) => {
    setFormType(inv.type);
    setEditingId(inv.id);
    setDraft({
      expiry_date: inv.expiry_date || '',
      hsn_code: inv.hsn_code || '998332',
      po_number: inv.po_number || '',
      client_id: inv.client_id || '',
      client_name: inv.client_name || '',
      client_company: inv.client_company || '',
      client_address: inv.client_address || '',
      client_gstin: inv.client_gstin || '',
      client_mobile: inv.client_mobile || '',
      client_pan: inv.client_pan || '',
      place_of_supply: inv.place_of_supply || 'Maharashtra',
      project_id: inv.project_id || '',
      items: inv.items?.length ? inv.items : [{
        service_description: inv.service_description || '',
        qty: inv.qty === 0 ? '' : inv.qty,
        rate: inv.rate === 0 ? '' : inv.rate,
      }],
      gst_percent: inv.gst_percent ?? 18,
      tds_percent: inv.tds_percent ?? 10,
      tds_section: inv.tds_section || '194J',
      received_amount: inv.received_amount ?? 0
    });
    setClientSearch(inv.client_name);
    setView('create_form');
    setMsg(null);
  };

  const submitConversion = async () => {
    if (!convertModal) return;
    setSaving(true);
    try {
      const payload = {
        hsn_code: convertModal.hsn_code || '998332',
        client_id: convertModal.client_id || '',
        client_name: convertModal.client_name || '',
        client_company: convertModal.client_company || '',
        client_address: convertModal.client_address || '',
        client_gstin: convertModal.client_gstin || '',
        client_mobile: convertModal.client_mobile || '',
        client_pan: convertModal.client_pan || '',
        place_of_supply: convertModal.place_of_supply || 'Maharashtra',
        project_id: convertModal.project_id || '',
        items: convertModal.items?.length ? convertModal.items : [{
          service_description: convertModal.service_description || '',
          qty: convertModal.qty === '' ? 1 : parseFloat(convertModal.qty) || 0,
          rate: convertModal.rate === '' ? 0 : parseFloat(convertModal.rate) || 0,
        }],
        gst_percent: convertModal.gst_percent || 18,
        tds_percent: tdsApplicable ? tdsPercent : 0,
        tds_section: tdsApplicable ? tdsSection : '',
        received_amount: convertModal.received_amount || 0,
        type: 'tax',
        invoice_date: new Date().toISOString().split('T')[0]
      };

      const r = await api.post('/invoices', payload);
      toast.success(`Proforma converted to Tax Invoice ${r.data.invoice_no}`);
      setConvertModal(null);
      setRefreshKey(prev => prev + 1);
      setFormType('tax');
      setView('tax_list');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to convert invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToTax = (prof) => {
    setConvertModal(prof);
    setTdsApplicable(false);
    setTdsPercent(10);
    setTdsSection('194J');
  };

  const getDefaultExpiryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const handleSelectClient = (client) => {
    setDraft(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
      client_company: client.company || client.firm || '',
      client_address: client.address || client.firm || '',
      client_gstin: client.gstin || '',
      client_mobile: client.phone || '',
      client_pan: client.pan || client.gstin?.substring(2, 12) || '',
      place_of_supply: client.place_of_supply || 'Maharashtra',
      project_id: ''
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const handleInputChange = (field, val) => {
    setDraft(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'client_gstin' && val.length >= 12 && !prev.client_pan) {
        updated.client_pan = val.substring(2, 12).toUpperCase();
      }
      return updated;
    });
  };

  const handleDelete = async (id, no) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete invoice ${no}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/invoices/${id}`);
      toast.success(`Invoice ${no} has been deleted.`);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete invoice.');
    }
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const r = await api.post(`/invoices/bulk-import-b2b?type=${formType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(r.data.message || 'Import Successful');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to import invoices.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!draft.client_name) {
      setMsg({ type: 'error', text: 'Please select or enter a valid client.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        ...draft,
        items: draft.items.map(it => ({
          ...it,
          qty: it.qty === '' ? 1 : parseFloat(it.qty) || 0,
          rate: it.rate === '' ? 0 : parseFloat(it.rate) || 0,
        })),
        tds_percent: draft.tds_percent === '' ? 0 : parseInt(draft.tds_percent, 10) || 0,
        type: formType,
        invoice_date: new Date().toISOString().split('T')[0]
      };

      let r;
      if (editingId) {
        r = await api.put(`/invoices/${editingId}`, payload);
        setInvoices(prev => prev.map(inv => inv.id === editingId ? r.data : inv));
        setMsg({ type: 'success', text: `Invoice ${r.data.invoice_no} updated successfully!` });
      } else {
        r = await api.post('/invoices', payload);
        setInvoices(prev => [r.data, ...prev]);
        setMsg({ type: 'success', text: `Invoice ${r.data.invoice_no} generated successfully!` });
      }

      const [clientRes, projectRes, architectRes] = await Promise.all([api.get('/clients'), api.get('/projects'), api.get('/architects')]);
      const clientsData = (clientRes.data || []).map(c => ({ ...c, isArchitect: false }));
      const architectsData = (architectRes.data || []).map(a => ({ ...a, isArchitect: true }));
      setClients([...clientsData, ...architectsData]);
      setProjects(projectRes.data || []);
      setView(formType === 'proforma' ? 'proforma_list' : 'tax_list');
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to submit invoice.' });
    } finally {
      setSaving(false);
    }
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatINRRound = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(val));
  };

  // Safe numerical parses
  const baseValue = draft.items ? draft.items.reduce((acc, it) => {
    const q = it.qty === '' ? 1 : parseFloat(it.qty) || 0;
    const r = it.rate === '' ? 0 : parseFloat(it.rate) || 0;
    return acc + (q * r);
  }, 0) : 0;
  const gstAmount = baseValue * (draft.gst_percent / 100);
  const totalWithGst = baseValue + gstAmount;
  const tdsAmount = formType === 'proforma' ? 0 : baseValue * (draft.tds_percent / 100);
  const payableAmount = totalWithGst - tdsAmount;

  // Filter clients based on name or GSTIN
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.gstin && c.gstin.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  const filteredInvoices = invoices;

  if (loading && view === 'dashboard') {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-12 text-center">
        <div className="text-sm font-semibold" style={{ color: 'var(--cc-text-muted)' }}>Loading Invoices Module…</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="invoices-page">

      {/* 1. Dashboard View */}
      {view === 'dashboard' && (
        <div className="min-h-[60vh] flex flex-col justify-center items-center">
          <div className="text-center mb-8">
            <h1 className="font-head text-3xl md:text-4xl font-extrabold mb-2" style={{ color: 'var(--cc-dark-green)' }}>
              Invoices Module
            </h1>
            <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
              Generate, edit, and manage proforma and official tax invoices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
            {/* Proforma Selector */}
            <div
              onClick={() => { setFormType('proforma'); setView('proforma_list'); setMsg(null); }}
              className="card p-8 flex flex-col items-center justify-between cursor-pointer hover:shadow-lg transition-all border hover:border-emerald-500 hover:scale-[1.02] text-center"
              data-testid="selector-proforma"
            >
              <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <FileText size={36} />
              </div>
              <h2 className="font-head text-xl font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>
                Proforma Invoices
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--cc-text-muted)' }}>
                Estimates/offers sent to clients before billing. Tracks validity period and expiry dates.
              </p>
              <button className="btn btn-primary w-full pointer-events-none text-white">
                Open Proformas
              </button>
            </div>

            {/* Tax Invoice Selector */}
            <div
              onClick={() => { setFormType('tax'); setView('tax_list'); setMsg(null); }}
              className="card p-8 flex flex-col items-center justify-between cursor-pointer hover:shadow-lg transition-all border hover:border-emerald-500 hover:scale-[1.02] text-center"
              data-testid="selector-tax"
            >
              <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Receipt size={36} />
              </div>
              <h2 className="font-head text-xl font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>
                Tax Invoices
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--cc-text-muted)' }}>
                Official GST tax invoices. Features automatic CC-ARL numbering sequencing and tax calculations.
              </p>
              <button className="btn btn-primary w-full pointer-events-none text-white">
                Open Tax Invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Lists View */}
      {(view === 'proforma_list' || view === 'tax_list') && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <button
                onClick={() => setView('dashboard')}
                className="btn btn-outline btn-sm mb-2"
                data-testid="btn-back-dashboard"
              >
                <ChevronLeft size={14} /> Back to Menu
              </button>
              <h1 className="font-head text-3xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
                {formType === 'proforma' ? 'Proforma Invoices' : 'Tax Invoices'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
                Manage, edit, and download previously generated {formType} invoices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">
              {formType === 'tax' && (
                <button
                  onClick={() => setLedgerModal(true)}
                  className="btn btn-primary"
                  data-testid="btn-open-ledger-modal"
                >
                  <FileText size={16} /> Ledger
                </button>
              )}
              {(formType === 'tax' || formType === 'proforma') && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBulkImport}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="btn btn-outline"
                    data-testid="btn-bulk-import-b2b"
                  >
                    <Upload size={16} /> {importing ? 'Importing...' : 'Bulk Import'}
                  </button>
                </>
              )}
              {formType === 'tax' && (
                <button
                  onClick={() => setExportModal(true)}
                  disabled={exporting}
                  className="btn btn-outline"
                >
                  <Download size={16} /> {exporting ? 'Exporting...' : 'Export to Excel'}
                </button>
              )}
              <button
                onClick={() => handleCreateClick(formType)}
                className="btn btn-primary"
                data-testid="btn-new-invoice"
              >
                <Plus size={16} /> Generate New {formType === 'proforma' ? 'Proforma' : 'Tax Invoice'}
              </button>
            </div>
          </div>

          {msg && (
            <div
              className="text-xs rounded-md p-3 mb-4 flex items-center gap-2"
              style={msg.type === 'error'
                ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
                : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
              data-testid="list-notification"
            >
              {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {msg.text}
            </div>
          )}

          <div className="mb-4 relative w-full sm:max-w-md">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              className="input pl-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices by number or client name…"
              data-testid="invoices-search-input"
            />
          </div>

          {/* List Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="cc-table" data-testid="invoices-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Client</th>
                    <th className="hidden sm:table-cell">Date</th>
                    {formType === 'proforma' && <th className="hidden sm:table-cell">Expiry</th>}
                    <th className="num hidden lg:table-cell" style={{ textAlign: 'right' }}>Base Amount</th>
                    <th className="num hidden sm:table-cell" style={{ textAlign: 'right' }}>Tax (GST)</th>
                    <th className="num" style={{ textAlign: 'right' }}>Payable</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={formType === 'proforma' ? 8 : 7} className="text-center py-12" style={{ color: 'var(--cc-text-muted)' }}>
                        No {formType} invoices generated yet. Click the button above to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const base = inv.items && inv.items.length > 0
                        ? inv.items.reduce((s, it) => s + (it.qty * it.rate), 0)
                        : (inv.qty * inv.rate);
                      const tax = base * (inv.gst_percent / 100);
                      const tdsDeduction = formType === 'proforma' ? 0 : (base * (inv.tds_percent / 100));
                      const payable = (base + tax) - tdsDeduction;
                      return (
                        <tr key={inv.id} data-testid={`invoice-row-${inv.invoice_no}`}>
                          <td className="font-mono-data font-semibold text-sm">{inv.invoice_no}</td>
                          <td className="font-medium">{inv.client_name}</td>
                          <td className="text-xs font-mono-data hidden sm:table-cell">{inv.invoice_date}</td>
                          {formType === 'proforma' && (
                            <td className="text-xs font-mono-data text-red-600 hidden sm:table-cell">{inv.expiry_date || '—'}</td>
                          )}
                          <td className="num font-mono-data hidden lg:table-cell">{formatINR(base)}</td>
                          <td className="num font-mono-data text-xs hidden sm:table-cell" style={{ color: 'var(--cc-text-muted)' }}>
                            {formatINR(tax)} ({inv.gst_percent}%)
                          </td>
                          <td className="num font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>
                            {formatINR(payable)}
                          </td>
                          <td>
                            <div className="flex gap-2 justify-center items-center">
                              {formType === 'proforma' && (
                                <button
                                  onClick={() => handleConvertToTax(inv)}
                                  className="btn btn-outline btn-sm px-2 text-xs flex items-center gap-1"
                                  title="Convert to Tax Invoice"
                                  style={{ borderColor: 'var(--cc-border)', color: 'var(--cc-dark-green)' }}
                                  data-testid={`btn-convert-tax-${inv.id}`}
                                >
                                  <Receipt size={12} /> Convert
                                </button>
                              )}
                              <button
                                onClick={() => handleEditClick(inv)}
                                className="btn btn-outline btn-sm px-2.5"
                                title="Edit Invoice"
                                data-testid={`btn-edit-${inv.id}`}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => downloadFile(`${API}/invoices/${inv.id}/pdf`)}
                                className="btn btn-outline btn-sm px-2.5"
                                title="Download PDF"
                                data-testid={`btn-download-${inv.id}`}
                              >
                                <Download size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(inv.id, inv.invoice_no)}
                                className="btn btn-danger btn-sm px-2.5"
                                title="Delete Invoice"
                                data-testid={`btn-delete-${inv.id}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 border-t border-gray-100 bg-white">
            <Pagination page={page} setPage={setPage} limit={limit} total={total} />
          </div>
          </div>
        </div>
      )}

      {/* 3. Invoice Form View (Create/Edit) */}
      {view === 'create_form' && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setView(formType === 'proforma' ? 'proforma_list' : 'tax_list')}
              className="btn btn-outline btn-sm"
              data-testid="btn-cancel-form"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <h1 className="font-head text-2xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>
              {editingId ? 'Edit' : 'Generate'} {formType === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice'}
            </h1>
          </div>

          {msg && (
            <div
              className="text-xs rounded-md p-3 mb-4 flex items-center gap-2"
              style={msg.type === 'error'
                ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
                : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
              data-testid="form-notification"
            >
              {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Form Fields Column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Box 1: Core metadata (Flat Read Only fields) */}
              <div className="card p-6 space-y-4">
                <h3 className="font-head font-bold text-sm border-b pb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)', borderColor: 'var(--cc-border)' }}>
                  <Calendar size={14} /> Invoice Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Flat Read-Only Date */}
                  <FlatReadOnlyField
                    label="Invoice Date"
                    value={editingId ? draft.invoice_date : new Date().toLocaleDateString('en-IN')}
                  />

                  {/* Editable HSN Code */}
                  <div>
                    <label className="label">HSN Code</label>
                    <input
                      type="text"
                      required
                      className="input font-mono-data"
                      value={draft.hsn_code}
                      onChange={(e) => handleInputChange('hsn_code', e.target.value)}
                      placeholder="e.g. 998332"
                      data-testid="hsn-code-input"
                    />
                  </div>

                  {/* PO Number (optional, alphanumeric — sits between HSN and PAN NO on the PDF) */}
                  <div>
                    <label className="label">PO Number</label>
                    <input
                      type="text"
                      className="input font-mono-data"
                      value={draft.po_number || ''}
                      onChange={(e) => handleInputChange('po_number', e.target.value)}
                      placeholder="Optional (e.g. PO/2026/001)"
                      data-testid="po-number-input"
                    />
                  </div>

                  {formType === 'proforma' && (
                    <div>
                      <label className="label">Expiry Date</label>
                      <input
                        type="date"
                        required
                        className="input font-mono-data"
                        value={draft.expiry_date}
                        onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                        data-testid="expiry-date-input"
                      />
                    </div>
                  )}

                  {/* Flat Read-Only PAN */}
                  <FlatReadOnlyField
                    label="PAN Number (Company)"
                    value={company?.pan || 'AASFC7539E'}
                  />
                </div>
              </div>

              {/* Box 2: Bill To Client */}
              <div className="card p-6 space-y-4">
                <h3 className="font-head font-bold text-sm border-b pb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)', borderColor: 'var(--cc-border)' }}>
                  <Building size={14} /> Bill To Client
                </h3>

                <div className="relative">
                  <label className="label">Search/Select Client</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="input pl-9 font-semibold"
                      placeholder="Select Client... (Displays GST number if available)"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (!e.target.value) {
                          setDraft(prev => ({
                            ...prev,
                            client_id: '',
                            client_name: '',
                            client_company: '',
                            client_address: '',
                            client_gstin: '',
                            client_mobile: '',
                            client_pan: '',
                            place_of_supply: 'Maharashtra',
                            project_id: ''
                          }));
                        }
                      }}
                      onFocus={() => {
                        setShowClientDropdown(true);
                        setIsDropdownFocused(true);
                      }}
                      onBlur={() => {
                        // Delay closing so click triggers first
                        setTimeout(() => {
                          setShowClientDropdown(false);
                          setIsDropdownFocused(false);
                          
                          // If a client from the DB has already been successfully selected, do nothing
                          if (draftRef.current.client_id) {
                            return;
                          }
                          
                          const latestSearch = clientSearchRef.current || '';
                          
                          // Check if latest search matches any client name in our DB (case-insensitive)
                          const matchedClient = clientsRef.current.find(
                            c => c.name.toLowerCase() === latestSearch.trim().toLowerCase()
                          );
                          if (matchedClient) {
                            handleSelectClient(matchedClient);
                          } else {
                            // If it does not match, clear search field and client draft info
                            setClientSearch('');
                            setDraft(prev => ({
                              ...prev,
                              client_id: '',
                              client_name: '',
                              client_company: '',
                              client_address: '',
                              client_gstin: '',
                              client_mobile: '',
                              client_pan: '',
                              place_of_supply: 'Maharashtra',
                              project_id: ''
                            }));
                          }
                        }, 250);
                      }}
                      data-testid="client-autocomplete-input"
                    />
                  </div>

                  {showClientDropdown && (
                    <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-xs text-gray-500 hover:bg-gray-50">
                          No matching clients.  <strong>"{clientSearch}"</strong>
                        </div>
                      ) : (
                        filteredClients.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="p-2.5 text-sm cursor-pointer hover:bg-emerald-50 border-b border-gray-50 flex flex-col"
                            data-testid={`autocomplete-item-${c.name}`}
                          >
                            <span className="font-semibold text-gray-900 flex items-center gap-2">
                              <span>{c.name} {c.gstin ? `(GSTIN: ${c.gstin})` : ''}</span>
                              {c.isArchitect && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Architect</span>}
                            </span>
                            <span className="text-xs text-gray-500">{c.company || c.firm || 'No Company'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Billing Address and specific fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Company Name</label>
                    <input
                      type="text"
                      className={`input text-sm ${draft.client_id ? 'bg-gray-100/70 text-gray-500 cursor-not-allowed' : ''}`}
                      value={draft.client_company || ''}
                      onChange={(e) => handleInputChange('client_company', e.target.value)}
                      placeholder="Company Name"
                      readOnly={!!draft.client_id}
                      data-testid="billing-company-input"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">Client Billing Address</label>
                    <textarea
                      required
                      rows={2}
                      className={`textarea text-sm ${draft.client_id ? 'bg-gray-100/70 text-gray-500 cursor-not-allowed' : ''}`}
                      value={draft.client_address}
                      onChange={(e) => handleInputChange('client_address', e.target.value)}
                      placeholder="Billing Address..."
                      readOnly={!!draft.client_id}
                      data-testid="billing-address-input"
                    />
                  </div>

                  {/* Flat Read-Only Client GSTIN */}
                  <FlatReadOnlyField
                    label="Client GSTIN"
                    value={draft.client_gstin}
                  />

                  <div>
                    <label className="label">Place of Supply (Code or State)</label>
                    <input
                      type="text"
                      required
                      className={`input ${draft.client_id ? 'bg-gray-100/70 text-gray-500 cursor-not-allowed' : ''}`}
                      value={draft.place_of_supply}
                      onChange={(e) => handleInputChange('place_of_supply', e.target.value)}
                      placeholder="e.g. 27 or Maharashtra"
                      readOnly={!!draft.client_id}
                      data-testid="billing-supply-input"
                    />
                  </div>

                  {/* Flat Read-Only Client PAN */}
                  <FlatReadOnlyField
                    label="Client PAN Number"
                    value={draft.client_pan}
                  />

                  <div>
                    <label className="label">Client Mobile</label>
                    <input
                      type="text"
                      className={`input font-mono-data ${draft.client_id ? 'bg-gray-100/70 text-gray-500 cursor-not-allowed' : ''}`}
                      value={draft.client_mobile}
                      onChange={(e) => handleInputChange('client_mobile', e.target.value)}
                      placeholder="Mobile Number"
                      readOnly={!!draft.client_id}
                      data-testid="billing-mobile-input"
                    />
                  </div>
                </div>
              </div>
              
              {/* Box 3: Project Link (Optional) */}
              {draft.client_id && (
                <div className="card p-6 space-y-4">
                  <h3 className="font-head font-bold text-sm border-b pb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)', borderColor: 'var(--cc-border)' }}>
                    <Briefcase size={14} /> Link to Project (Optional)
                  </h3>
                  <div className="space-y-4">
                    <SearchableSelect
                      options={projects
                        .filter(p => p.client_id === draft.client_id)
                        .map(p => ({ value: p.id, label: `- ${p.name}  (${p.project_code})` }))}
                      value={draft.project_id || ''}
                      onChange={(val) => handleInputChange('project_id', val)}
                      placeholder="Search and select project..."
                    />
                    {draft.project_id && (
                      (() => {
                        const sel = projects.find(p => p.id === draft.project_id);
                        if (!sel) return null;
                        return (
                          <div className="flex flex-wrap gap-4 text-xs font-mono-data p-3 rounded bg-gray-50 border border-gray-200">
                            <div><span className="text-gray-500">Total:</span> <span className="font-semibold text-gray-800">{formatINR(sel.quoted_amount)}</span></div>
                            <div><span className="text-gray-500">Received:</span> <span className="font-semibold text-green-600">{formatINR(sel.received_amount)}</span></div>
                            <div><span className="text-gray-500">Outstanding:</span> <span className="font-semibold text-red-500">{formatINR(sel.outstanding_amount)}</span></div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              )}

              {/* Box 4: Invoice Items */}
              <div className="card p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--cc-border)' }}>
                  <h3
                    className="font-head font-bold text-sm flex items-center gap-1.5 cursor-pointer hover:opacity-80"
                    style={{ color: 'var(--cc-dark-green)' }}
                    onClick={() => {
                      setDraft(prev => ({
                        ...prev,
                        items: [...prev.items, { service_description: '', qty: 1, rate: '' }]
                      }));
                    }}
                    title="Add another service"
                  >
                    <Plus size={14} /> Description & Pricing
                  </h3>
                </div>

                <div className="space-y-4">
                  {draft.items.map((item, idx) => (
                    <div key={idx} className="p-4 border rounded relative">
                      {draft.items.length > 1 && (
                        <button
                          type="button"
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          onClick={() => {
                            const newItems = [...draft.items];
                            newItems.splice(idx, 1);
                            setDraft(prev => ({ ...prev, items: newItems }));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div>
                        <label className="label">Service Description</label>
                        <textarea
                          required
                          rows={2}
                          className="textarea text-sm"
                          value={item.service_description}
                          onChange={(e) => {
                            const newItems = [...draft.items];
                            newItems[idx].service_description = e.target.value;
                            setDraft(prev => ({ ...prev, items: newItems }));
                          }}
                          placeholder="Describe the services..."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="label">Quantity</label>
                          <input
                            type="text"
                            required
                            className="input font-mono-data"
                            value={item.qty}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*$/.test(val)) {
                                const newItems = [...draft.items];
                                newItems[idx].qty = val;
                                setDraft(prev => ({ ...prev, items: newItems }));
                              }
                            }}
                            placeholder="1"
                          />
                        </div>

                        <div>
                          <label className="label">Rate (INR)</label>
                          <input
                            type="text"
                            required
                            className="input font-mono-data"
                            value={item.rate}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*$/.test(val)) {
                                const newItems = [...draft.items];
                                newItems[idx].rate = val;
                                setDraft(prev => ({ ...prev, items: newItems }));
                              }
                            }}
                            placeholder="Enter Rate..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div>
                      <label className="label">GST Rate</label>
                      <div className="relative">
                        <input
                          type="number"
                          className="input font-mono-data pr-8"
                          value={draft.gst_percent}
                          onChange={(e) => handleInputChange('gst_percent', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="18"
                          data-testid="item-gst-input"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500 font-medium">
                          %
                        </div>
                      </div>
                    </div>

                    {formType !== 'proforma' && (
                      <div>
                        <label className="label">TDS Rate (%)</label>
                        <input
                          type="text"
                          required
                          className="input font-mono-data"
                          value={draft.tds_percent}
                          onChange={(e) => handleInputChange('tds_percent', e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                          placeholder="e.g. 10"
                          data-testid="item-tds-input"
                        />
                      </div>
                    )}
                  </div>

                  {formType !== 'proforma' && (
                    <div>
                      <label className="label">TDS Section Code</label>
                      <input
                        type="text"
                        className="input font-mono-data"
                        value={draft.tds_section}
                        onChange={(e) => handleInputChange('tds_section', e.target.value)}
                        placeholder="e.g. 194J"
                        data-testid="item-tds-section-input"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Calculations Breakdown Column */}
            <div className="space-y-6">
              <div className="card p-6 space-y-4 sticky top-24" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
                <h3 className="font-head font-bold text-sm border-b pb-2 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)', borderColor: 'var(--cc-border)' }}>
                  <Percent size={14} /> Calculations Summary
                </h3>

                <div className="space-y-2 text-sm font-mono-data">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxable Base:</span>
                    <span className="font-bold">{formatINR(baseValue)}</span>
                  </div>

                  <div className="flex justify-between border-b pb-2 border-dashed">
                    <span className="text-gray-500">CGST ({draft.gst_percent / 2}%):</span>
                    <span>{formatINR(gstAmount / 2)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2 border-dashed">
                    <span className="text-gray-500">SGST ({draft.gst_percent / 2}%):</span>
                    <span>{formatINR(gstAmount / 2)}</span>
                  </div>

                  <div className="flex justify-between font-bold text-gray-900 border-b pb-2">
                    <span>Invoice Total (with GST):</span>
                    <span>{formatINR(totalWithGst)}</span>
                  </div>

                  {formType !== 'proforma' && (
                    <div className="flex justify-between text-red-600 border-b pb-2 border-dashed">
                      <span>TDS Deduction (-{draft.tds_percent}%):</span>
                      <span>-{formatINR(tdsAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-lg text-emerald-700 pt-2 border-t">
                    <span>Net Amount Payable:</span>
                    <span>{formatINRRound(payableAmount)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary w-full"
                    data-testid="btn-submit-invoice"
                  >
                    <IndianRupee size={14} /> {saving ? 'Submitting…' : `${editingId ? 'Update' : 'Generate'} ${formType === 'proforma' ? 'Proforma' : 'Tax Invoice'}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setView(formType === 'proforma' ? 'proforma_list' : 'tax_list')}
                    className="btn btn-outline w-full"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <Modal open={!!convertModal} onClose={() => setConvertModal(null)} title="Convert to Tax Invoice" testId="convert-tax-modal">
        <div className="space-y-4">
          <p className="text-sm">You are converting Proforma Invoice <strong>{convertModal?.invoice_no}</strong> to a Tax Invoice.</p>
          <div>
            <label className="label">Is TDS applicable for this invoice?</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={tdsApplicable} onChange={() => setTdsApplicable(true)} /> Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" checked={!tdsApplicable} onChange={() => setTdsApplicable(false)} /> No
              </label>
            </div>
          </div>

          {tdsApplicable && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="label">TDS Rate (%)</label>
                <input
                  type="number"
                  className="input"
                  value={tdsPercent}
                  onChange={(e) => setTdsPercent(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className="label">TDS Section</label>
                <input
                  type="text"
                  className="input"
                  value={tdsSection}
                  onChange={(e) => setTdsSection(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setConvertModal(null)} className="btn btn-outline">Cancel</button>
            <button type="button" onClick={submitConversion} disabled={saving} className="btn btn-primary">
              {saving ? 'Converting...' : 'Convert'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={exportModal} onClose={() => !exporting && setExportModal(false)} title="Export Tax Invoices">
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Select a date range to export Tax Invoices. Leave dates blank to export all records.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={exportDates.start}
                onChange={(e) => setExportDates(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input"
                value={exportDates.end}
                min={exportDates.start}
                onChange={(e) => setExportDates(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setExportModal(false)} disabled={exporting} className="btn btn-outline">Cancel</button>
            <button onClick={handleExport} disabled={exporting} className="btn btn-primary">
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={ledgerModal} onClose={() => !downloadingLedger && setLedgerModal(false)} title="Download Client Ledger" maxWidth="700px" overflow="visible">
        <div className="p-6 space-y-6">
          <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Select a client to download their complete ledger (payment history and balances).
          </p>
          <div>
            <label className="label">Client</label>
            <SearchableSelect
              options={clients.map(c => ({ value: c.id, label: c.name }))}
              value={ledgerClientId}
              onChange={setLedgerClientId}
              placeholder="Search and select a client..."
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setLedgerModal(false)} disabled={downloadingLedger} className="btn btn-outline">Cancel</button>
            <button onClick={downloadLedger} disabled={downloadingLedger || !ledgerClientId} className="btn btn-primary">
              {downloadingLedger ? 'Exporting...' : 'Download Ledger'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default InvoicesPage;
