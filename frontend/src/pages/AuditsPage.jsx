import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { formatINR } from '../lib/format';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import InlinePicker from '../components/InlinePicker';
import { logger } from '../lib/logger';
import Pagination from '../components/Pagination';
import {
  Plus, Search, Eye, Pencil, Trash2, IndianRupee, FileText, Archive, ArchiveRestore,
  ArrowUpDown, ArrowUp, ArrowDown, Phone, Mail, ClipboardCheck, X } from 'lucide-react';

const SORTABLE_COLUMNS = {
  audit_offer: 'Audit Offer Number',
  report_id: 'Report ID',
  client_name: 'Name',
  total_amount: 'Total',
  received_amount: 'Received',
  outstanding_amount: 'Outstanding',
  status: 'Status',
};

const COL_CLASSES = {
  report_id: 'hidden md:table-cell',
  client_name: 'hidden sm:table-cell',
  total_amount: 'hidden sm:table-cell',
  received_amount: 'hidden md:table-cell',
  status: 'hidden md:table-cell',
};

const emptyAudit = {
  audit_code: '',
  audit_offer: '',
  report_id: '',
  client_id: '',
  client_name_override: '',
  client_phone_override: '',
  client_email_override: '',
  total_amount: '',
  status: 'Outstanding',
  address: '',
  audit_offer_path: '',
  report_path: '',
};

const StructuralAuditTaskModal = ({ open, onClose, audit, users = [], onSave }) => {
  const userList = Array.isArray(users) ? users : (users?.data || []);
  const [form, setForm] = useState({
    audit_offer_no: '',
    description: '',
    site_visit_date: '',
    preparation_date: '',
    submission_date: '',
    assigned_to_user_id: '',
    assigned_to_accountant_id: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && audit) {
      setForm({
        audit_offer_no: audit.audit_offer || '',
        description: '',
        site_visit_date: '',
        preparation_date: '',
        submission_date: '',
        assigned_to_user_id: '',
        assigned_to_accountant_id: ''
      });
      setError('');
    }
  }, [open, audit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError('Description is required for task work'); return; }
    setSaving(true);
    try {
      await api.post('/tasks', {
        category: 'structural',
        audit_id: audit.id,
        audit_offer_no: audit.audit_offer || '',
        work: 'Structural Audit',
        description: form.description.trim(),
        site_visit_date: form.site_visit_date || null,
        preparation_date: form.preparation_date || null,
        submission_date: form.submission_date || null,
        assigned_to_user_id: form.assigned_to_user_id || null,
        assigned_to_accountant_id: form.assigned_to_accountant_id || null
      });
      await onSave();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Confirm Audit ${audit?.audit_code || ''}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">Audit Offer No</label>
          <input className="input bg-gray-50 text-gray-500" value={form.audit_offer_no} disabled />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Assign Engineer</label>
            <select className="select" value={form.assigned_to_user_id} onChange={(e) => setForm({ ...form, assigned_to_user_id: e.target.value })}>
              <option value="">— Unassigned —</option>
              {userList.filter(u => ['admin', 'engineer', 'draftsman'].includes(u.role)).map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assign Accountant</label>
            <select className="select" value={form.assigned_to_accountant_id} onChange={(e) => setForm({ ...form, assigned_to_accountant_id: e.target.value })}>
              <option value="">— Unassigned —</option>
              {userList.filter(u => ['admin', 'account', 'accountant'].includes(u.role)).map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description <span className="text-red-500">*</span></label>
          <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Site Visit Date</label>
            <input type="date" className="input" value={form.site_visit_date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm({ ...form, site_visit_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Preparation Date</label>
            <input type="date" className="input" value={form.preparation_date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm({ ...form, preparation_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Submission Date</label>
            <input type="date" className="input" value={form.submission_date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm({ ...form, submission_date: e.target.value })} />
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="submit" disabled={saving || !form.description.trim()} className="btn btn-primary">
            {saving ? 'Saving...' : 'Confirm & Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AuditsPage = () => {
  const { schedule } = useUndo();
  const [audits, setAudits] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const [modalOpen, setModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [confirmingAudit, setConfirmingAudit] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAudit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payAuditId, setPayAuditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [offerPreview, setOfferPreview] = useState('');

  // Fetch the upcoming Audit Offer Number from the year-based counter so the
  // engineer sees the auto-generated value as a placeholder on the New Audit form.
  const loadOfferPreview = async () => {
    try {
      const r = await api.get('/audits/next-offer-preview');
      setOfferPreview(r.data?.number || '');
    } catch (err) {
      console.warn('Audit offer preview unavailable', err);
      setOfferPreview('');
    }
  };

  const load = async (overrideSearch, overridePage) => {
    setLoading(true);
    try {
      const currentPage = typeof overridePage === 'number' ? overridePage : page;
      const params = {
        page: currentPage,
        limit,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      const activeSearch = typeof overrideSearch === 'string' ? overrideSearch : search;
      if (activeSearch) params.search = activeSearch;
      if (showArchived) params.archived = true;
      const [a, c, u] = await Promise.all([
        api.get('/audits/paginated', { params }),
        api.get('/clients').catch(() => ({ data: [] })),
        api.get('/auth/users/directory').catch(() => ({ data: [] })),
      ]);
      setAudits(a.data?.data || []);
      setTotal(a.data?.total || 0);
      setClients(c.data || []);
      if (u?.data) setUsers(u.data);
    } catch (e) { logger.error('Audits load failed:', e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showArchived, page, sortBy, sortDir]);

  const sortedAudits = useMemo(() => {
    return audits.filter((a) => !hiddenIds.has(a.id));
  }, [audits, hiddenIds]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); setPage(1); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="inline ml-1 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />;
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyAudit);
    setFormError('');
    loadOfferPreview();
    setModalOpen(true);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      audit_code: a.audit_code || '',
      audit_offer: a.audit_offer || '',
      report_id: a.report_id || '',
      client_id: a.client_id || '',
      client_name_override: a.client_name_override || '',
      client_phone_override: a.client_phone_override || '',
      client_email_override: a.client_email_override || '',
      total_amount: a.total_amount != null ? String(a.total_amount) : '',
      status: a.status || 'Outstanding',
      address: a.address || '',
      audit_offer_path: a.audit_offer_path || '',
      report_path: a.report_path || a.file_path || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        audit_code: (form.audit_code || '').trim(),
        audit_offer: form.audit_offer.trim(),
        report_id: (form.report_id || '').trim(),
        client_id: form.client_id || null,
        client_name_override: (form.client_name_override || '').trim(),
        client_phone_override: (form.client_phone_override || '').trim(),
        client_email_override: (form.client_email_override || '').trim(),
        total_amount: parseFloat(form.total_amount) || 0,
        status: form.status || 'Outstanding',
        address: form.address || '',
        audit_offer_path: (form.audit_offer_path || '').trim(),
        report_path: (form.report_path || '').trim(),
      };
      if (editing) {
        await api.put(`/audits/${editing.id}`, payload);
        load();
      } else {
        await api.post('/audits', payload);
        setSearch('');
        setPage(1);
        load('', 1);
      }
      setModalOpen(false);
      showToast(editing ? 'Audit updated' : 'Audit created');
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (a) => {
    
    setHiddenIds((prev) => new Set([...prev, a.id]));
    schedule({
      label: `Audit ${a.audit_code} deleted`,
      onCommit: async () => {
        try {
          await api.delete(`/audits/${a.id}`);
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
          load();
        } catch {
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
          showToast('Delete failed', 'error');
        }
      },
      onUndo: () => {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
        showToast(`Audit ${a.audit_code} restored`);
      },
    });
  };

  const handleArchive = async (a) => {
    
    try { await api.post(`/audits/${a.id}/archive`); showToast('Audit archived'); load(); }
    catch { showToast('Failed to archive', 'error'); }
  };

  const handleUnarchive = async (a) => {
    try { await api.post(`/audits/${a.id}/unarchive`); showToast(`Audit ${a.audit_code} restored`); load(); }
    catch { showToast('Failed to restore', 'error'); }
  };

  const handleStatusChange = async (audit, newStatus) => {
    if (newStatus === 'Confirm') {
      setConfirmingAudit(audit);
      setTaskModalOpen(true);
      return;
    }
    
    // Optimistically update UI for Outstanding/Cancelled
    const previousStatus = audit.status;
    setAudits(prev => prev.map(a => a.id === audit.id ? { ...a, status: newStatus } : a));
    
    try {
      await api.put(`/audits/${audit.id}`, {
        ...audit,
        status: newStatus
      });
      showToast(`Status changed to ${newStatus}`);
    } catch (err) {
      setAudits(prev => prev.map(a => a.id === audit.id ? { ...a, status: previousStatus } : a));
      showToast('Failed to update status', 'error');
    }
  };

  const handleTaskModalSave = async () => {
    try {
      await api.put(`/audits/${confirmingAudit.id}`, {
        ...confirmingAudit,
        status: 'Confirm'
      });
      setTaskModalOpen(false);
      setConfirmingAudit(null);
      showToast('Audit confirmed and Task created!');
      load();
    } catch (err) {
      showToast('Task created but failed to update Audit status', 'error');
    }
  };

  const openPay = (id) => { setPayAuditId(id); setPayOpen(true); };
  const downloadInvoice = (id) => downloadFile(`${API}/audits/${id}/invoice`);

  const contactCell = (a) => (
    <div className="text-xs space-y-0.5">
      {a.client_phone ? (
        <a href={`tel:${a.client_phone}`} className="inline-flex items-center gap-1 link-underline"><Phone size={11}/>{a.client_phone}</a>
      ) : null}
      {a.client_email ? (
        <a href={`mailto:${a.client_email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{a.client_email}</a>
      ) : null}
      {!a.client_phone && !a.client_email && <span className="text-gray-400">—</span>}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="audits-page">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Audits</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Track structural audits, reports and payments ({total} total).</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">
          <button
            onClick={() => { setShowArchived(v => !v); setPage(1); }}
            className={`btn btn-outline ${showArchived ? 'opacity-90' : ''}`}
            data-testid="btn-toggle-archived-audits"
          >
            <Archive size={14}/> {showArchived ? 'Viewing Archived — Show Active' : 'Show Archived'}
          </button>
          <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-audit"><Plus size={15}/> New Audit</button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="mb-4 flex flex-col sm:flex-row gap-2" data-testid="audits-search-form">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input
            className="input pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by audit code, offer, report ID, client..."
            data-testid="audits-search-input"
          />
        </div>
        <button className="btn btn-outline w-full sm:w-auto" type="submit" data-testid="audits-search-btn">Search</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="audits-table">
            <thead>
              <tr>
                {Object.entries(SORTABLE_COLUMNS).map(([k, label]) => (
                  <th key={k} className={`cursor-pointer select-none ${COL_CLASSES[k] || ''}`} onClick={() => toggleSort(k)} data-testid={`audit-sort-${k}`}>
                    {label}<SortIcon col={k}/>
                  </th>
                ))}
                <th className="hidden md:table-cell">Contact</th>
                <th className="hidden lg:table-cell">Address</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : sortedAudits.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <ClipboardCheck size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{showArchived ? 'No archived audits' : 'No audits yet'}</div>
                  <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Create your first audit to get started.</div>
                </td></tr>
              ) : sortedAudits.map((a) => (
                <tr key={a.id} data-testid={`audit-row-${a.audit_code}`}>
                  <td className="font-medium"><Link to={`/audits/${a.id}`} className="link-underline" data-testid={`audit-offer-link-${a.audit_code}`}>{a.audit_offer || '—'}</Link></td>
                  <td className="font-mono-data text-xs hidden md:table-cell">{a.report_id || '—'}</td>
                  <td className="hidden sm:table-cell">{a.client_name ? <Link to={`/clients/${a.client_id}`} className="link-underline">{a.client_name}</Link> : <span className="text-gray-400">—</span>}</td>
                  <td className="font-mono-data text-sm hidden sm:table-cell">{formatINR(a.total_amount)}</td>
                  <td className="font-mono-data text-sm hidden md:table-cell" style={{ color: '#92400E' }}>{formatINR(a.received_amount)}</td>
                  <td className="font-mono-data text-sm font-semibold" style={{ color: a.outstanding_amount > 0 ? '#DC2626' : '#065F46' }}>{formatINR(a.outstanding_amount)}</td>
                  <td className="hidden md:table-cell">
                    <select
                      className={`text-xs font-semibold py-1 pl-2 pr-6 rounded-full border appearance-none outline-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all shadow-sm ${a.status === 'Confirm' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : a.status === 'Cancelled' ? 'bg-gray-100 text-gray-800 border-gray-300' : a.status === 'Settled' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-red-50 text-red-800 border-red-300'}`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.4rem center',
                        backgroundSize: '0.8em 0.8em',
                      }}
                      value={a.status || 'Outstanding'}
                      onChange={(e) => handleStatusChange(a, e.target.value)}
                    >
                      <option value="Outstanding">Outstanding</option>
                      <option value="Confirm">Confirm</option>
                      <option value="Cancelled">Cancelled</option>
                      {a.status === 'Settled' && <option value="Settled">Settled</option>}
                    </select>
                  </td>
                  <td className="hidden md:table-cell">{contactCell(a)}</td>
                  <td className="text-xs max-w-[160px] hidden lg:table-cell"><div className="line-clamp-2">{a.address || '—'}</div></td>
                  <td>
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Link to={`/audits/${a.id}`} className="btn btn-outline btn-sm" title="View details" data-testid={`btn-view-audit-${a.audit_code}`}><Eye size={13}/></Link>
                      {!a.archived && (
                        <button onClick={() => openPay(a.id)} className="btn btn-accent btn-sm" title="Record Payment" data-testid={`btn-pay-audit-${a.audit_code}`}><IndianRupee size={13}/> Pay</button>
                      )}
                      <button onClick={() => openEdit(a)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-edit-audit-${a.audit_code}`}><Pencil size={13}/></button>
                      {a.archived && (
                        <button onClick={() => handleUnarchive(a)} className="btn btn-outline btn-sm" title="Restore" data-testid={`btn-restore-audit-${a.audit_code}`}><ArchiveRestore size={13}/></button>
                      )}
                      <button onClick={() => handleDelete(a)} className="btn btn-danger btn-sm" title="Delete permanently" data-testid={`btn-delete-audit-${a.audit_code}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 border-t border-gray-100 bg-white">
          <Pagination page={page} setPage={setPage} limit={limit} total={total} />
        </div>
      </div>

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Audit ${editing.audit_code}` : 'New Audit'} testId="audit-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">Report ID</label>
            <input className="input font-mono-data" value={form.report_id} onChange={(e) => update('report_id', e.target.value)} placeholder={`Auto (RPT-${new Date().getFullYear()}-001) — or type custom`} data-testid="audit-form-report-id" />
          </div>
          <div>
            <label className="label">Audit Offer Number</label>
            <input
              className="input font-mono-data"
              value={form.audit_offer}
              onChange={(e) => update('audit_offer', e.target.value)}
              placeholder={offerPreview ? `Auto (${offerPreview}) — leave blank to auto-fill` : 'Auto STR/AUD-OFR/YYYY/NNN — or type custom'}
              data-testid="audit-form-offer"
            />
            <div className="text-[11px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
              Auto-generated as <strong>STR/AUD-OFR/YYYY/NNN</strong> if left blank. Type your own to override.
            </div>
          </div>
          <div>
            <label className="label">Name (Client)</label>
            <InlinePicker
              entityType="client"
              value={form.client_id}
              onChange={(v) => update('client_id', v)}
              items={clients}
              onItemsChange={setClients}
              testIdPrefix="audit-form-client-"
            />
            <div className="text-[11px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
              Pick an existing client OR leave blank and fill the fields below to record a one-off contact for this audit.
            </div>
          </div>

          {/* Direct contact fields — override the linked client's contact, or
              record an ad-hoc contact when no client is selected. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Client Name</label>
              <input
                className="input"
                value={form.client_name_override}
                onChange={(e) => update('client_name_override', e.target.value)}
                placeholder="e.g. Vijay Mishra"
                data-testid="audit-form-client-name"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={form.client_phone_override}
                onChange={(e) => update('client_phone_override', e.target.value)}
                placeholder="+91 98xxxxxxxx"
                data-testid="audit-form-client-phone"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.client_email_override}
                onChange={(e) => update('client_email_override', e.target.value)}
                placeholder="name@example.com"
                data-testid="audit-form-client-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Total Amount (₹)</label>
              <input type="number" step="0.01" className="input" value={form.total_amount} onChange={(e) => update('total_amount', e.target.value)} placeholder="0.00" data-testid="audit-form-total" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)} data-testid="audit-form-status">
                <option value="Outstanding">Outstanding</option>
                <option value="Confirm">Confirm</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Settled">Settled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="textarea" rows={3} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Site Location / Address" data-testid="audit-form-address" />
          </div>
          <div>
            <label className="label">Audit Offer Path <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(path of the audit offer on your PC)</span></label>
            <input
              className="input font-mono-data text-xs"
              value={form.audit_offer_path}
              onChange={(e) => update('audit_offer_path', e.target.value)}
              placeholder={`e.g. D:\\CreatorConsultant\\Offers\\2026\\STR-AUDIT-2026-006.pdf`}
              data-testid="audit-form-audit-offer-path"
            />
          </div>
          <div>
            <label className="label">Report Path <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(path of the audit report on your PC)</span></label>
            <input
              className="input font-mono-data text-xs"
              value={form.report_path}
              onChange={(e) => update('report_path', e.target.value)}
              placeholder={`e.g. D:\\CreatorConsultant\\Audits\\2026\\STR-AUDIT-2026-006.pdf`}
              data-testid="audit-form-report-path"
            />
          </div>
          {formError && <div className="text-sm text-red-600" data-testid="audit-form-error">{formError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="audit-form-save">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      {/* Task Modal */}
      <StructuralAuditTaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        audit={confirmingAudit}
        users={users}
        onSave={handleTaskModalSave}
      />

      <RecordPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        entityType="audit"
        defaultAuditId={payAuditId}
        onSaved={() => { load(); showToast('Payment recorded'); }}
      />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
          style={toast.type === 'error'
            ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="audit-toast"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AuditsPage;
