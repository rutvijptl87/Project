import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import InlinePicker from '../components/InlinePicker';
import { logger } from '../lib/logger';
import { Plus, Search, FileText, Pencil, Trash2, Archive, ArchiveRestore, FileSignature, CheckCircle2, RotateCcw, ArrowUp, ArrowDown, Link2, PauseCircle, XCircle, ArrowRightLeft } from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyDoc = {
  doc_type_id: '',
  doc_number: '',
  document_date: todayISO(),
  client_id: '',
  architect_id: '',
  plot_place: '',
  phase: '',
  number_field: '',
  remark: '',
  contact_person: '',
  mobile: '',
  other_comments: '',
  update_date: '',
};

const DocumentsPage = () => {
  const { schedule } = useUndo();
  const [types, setTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [architects, setArchitects] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [architectFilter, setArchitectFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [sortKey, setSortKey] = useState('document_date');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // Confirm-order modal
  const [confirmModal, setConfirmModal] = useState(null); // the document being confirmed, or null
  const [projects, setProjects] = useState([]);
  const [audits, setAudits] = useState([]);
  const [projectQuery, setProjectQuery] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [linkKind, setLinkKind] = useState('project'); // 'project' | 'audit'

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyDoc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter) params.type_id = typeFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (architectFilter) params.architect_id = architectFilter;
      if (search) params.search = search;
      if (showArchived) params.archived = true;
      const [t, c, ar, d] = await Promise.all([
        api.get('/document-types'),
        api.get('/clients'),
        api.get('/architects'),
        api.get('/documents', { params }),
      ]);
      setTypes(t.data);
      setClients(c.data);
      setArchitects(ar.data);
      setDocs(d.data);
    } catch (e) { logger.error('Documents load failed:', e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, clientFilter, architectFilter, showArchived]);

  // Client-side date range filter (backend doesn't yet expose date filtering on documents)
  const visible = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    const filtered = docs.filter((d) => {
      if (hiddenIds.has(d.id)) return false;
      if (fromTs || toTs) {
        const ts = d.document_date ? new Date(d.document_date).getTime() : null;
        if (!ts) return false;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
    const getKey = (d) => {
      switch (sortKey) {
        case 'doc_number': return d.doc_number || '';
        case 'doc_type_name': return d.doc_type_name || '';
        case 'client_name': return (d.client_name || '').toLowerCase();
        case 'architect_name': return (d.architect_name || '').toLowerCase();
        case 'plot_place': return (d.plot_place || '').toLowerCase();
        case 'contact_person': return (d.contact_person || '').toLowerCase();
        case 'status': {
          // Pending → Confirmed → On Hold → Cancelled (consistent order, easy to scan)
          const order = { pending: 0, confirmed: 1, on_hold: 2, cancelled: 3 };
          const s = (d.status || (d.confirmed ? 'confirmed' : 'pending')).toLowerCase();
          return order[s] ?? 99;
        }
        case 'document_date':
        default:
          return d.document_date ? new Date(d.document_date).getTime() : 0;
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const ka = getKey(a); const kb = getKey(b);
      if (ka < kb) return sortDir === 'asc' ? -1 : 1;
      if (ka > kb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [docs, hiddenIds, dateFrom, dateTo, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'document_date' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ label, sk, className = '' }) => (
    <th
      onClick={() => onSort(sk)}
      className={`cursor-pointer select-none ${className}`}
      data-testid={`documents-sort-${sk}`}
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sk ? (sortDir === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>) : <span className="opacity-30"><ArrowDown size={11}/></span>}
      </span>
    </th>
  );

  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setClientFilter('');
    setArchitectFilter(''); setDateFrom(''); setDateTo('');
    // useEffect triggers reload when filter states change
  };

  const activeFiltersCount = [search, typeFilter, clientFilter, architectFilter, dateFrom, dateTo].filter(Boolean).length;

  const typeById = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...emptyDoc,
      doc_type_id: typeFilter || (types[0]?.id || ''),
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      doc_type_id: d.doc_type_id || '',
      doc_number: d.doc_number || '',
      document_date: (d.document_date || '').slice(0, 10) || todayISO(),
      client_id: d.client_id || '',
      architect_id: d.architect_id || '',
      plot_place: d.plot_place || '',
      phase: d.phase || '',
      number_field: d.number_field || '',
      remark: d.remark || '',
      contact_person: d.contact_person || '',
      mobile: d.mobile || '',
      other_comments: d.other_comments || '',
      update_date: (d.update_date || '').slice(0, 10) || '',
    });
    setError('');
    setModalOpen(true);
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.doc_type_id) return setError('Please select a document type');
    setSaving(true);
    try {
      const payload = {
        ...form,
        document_date: form.document_date ? new Date(form.document_date).toISOString() : null,
        update_date: form.update_date ? new Date(form.update_date).toISOString() : null,
        client_id: form.client_id || null,
        architect_id: form.architect_id || null,
      };
      if (editing) {
        await api.put(`/documents/${editing.id}`, payload);
        showToast('Document updated');
      } else {
        const r = await api.post('/documents', payload);
        showToast(`Document ${r.data.doc_number} created`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (d) => {
    if (!window.confirm(`Permanently delete document ${d.doc_number}?\n\nYou can undo within 60 seconds.`)) return;
    setHiddenIds((p) => new Set([...p, d.id]));
    schedule({
      label: `Document ${d.doc_number} deleted`,
      onCommit: async () => {
        try { await api.delete(`/documents/${d.id}`); load(); }
        catch { showToast('Delete failed', 'error'); load(); }
        finally { setHiddenIds((p) => { const n = new Set(p); n.delete(d.id); return n; }); }
      },
      onUndo: () => {
        setHiddenIds((p) => { const n = new Set(p); n.delete(d.id); return n; });
        showToast(`Document ${d.doc_number} restored`);
      },
    });
  };

  const handleArchive = async (d) => {
    if (!window.confirm(`Archive document ${d.doc_number}?`)) return;
    try { await api.post(`/documents/${d.id}/archive`); load(); showToast('Archived'); }
    catch { showToast('Failed to archive', 'error'); }
  };

  const handleUnarchive = async (d) => {
    try { await api.post(`/documents/${d.id}/unarchive`); load(); showToast(`${d.doc_number} restored`); }
    catch { showToast('Failed to restore', 'error'); }
  };

  const openConfirm = async (d) => {
    // Auto-detect: audit-related doc types default to audit picker; everything else to project.
    const auditPrefixes = ['AUD-RPT'];
    const type = types.find((t) => t.id === d.doc_type_id);
    const isAuditDoc = type && auditPrefixes.includes((type.prefix || '').toUpperCase());
    // For "Move" (already-confirmed doc), keep the existing link kind.
    if (d.status === 'confirmed' && d.linked_audit_id) {
      setLinkKind('audit');
    } else if (d.status === 'confirmed' && d.linked_project_id) {
      setLinkKind('project');
    } else {
      setLinkKind(isAuditDoc ? 'audit' : 'project');
    }
    setConfirmModal(d);
    setProjectQuery('');
    try {
      const [pr, ar] = await Promise.all([
        projects.length === 0 ? api.get('/projects') : Promise.resolve({ data: projects }),
        audits.length === 0 ? api.get('/audits') : Promise.resolve({ data: audits }),
      ]);
      if (projects.length === 0) setProjects(pr.data);
      if (audits.length === 0) setAudits(ar.data);
    } catch (e) { logger.warn('Failed to load picker data:', e); }
  };

  const performConfirm = async (targetId) => {
    if (!confirmModal) return;
    const wasConfirmed = confirmModal.status === 'confirmed';
    setConfirmBusy(true);
    try {
      const payload = targetId
        ? (linkKind === 'audit' ? { audit_id: targetId } : { project_id: targetId })
        : {};
      await api.post(`/documents/${confirmModal.id}/confirm`, payload);
      setConfirmModal(null);
      load();
      const linkLabel = wasConfirmed
        ? (targetId ? `Moved to new ${linkKind}` : 'Unlinked')
        : (targetId ? `Order confirmed and linked to ${linkKind}` : 'Order confirmed');
      showToast(linkLabel);
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed', 'error');
    } finally { setConfirmBusy(false); }
  };

  const unconfirm = async (d) => {
    if (!window.confirm(`Reset ${d.doc_number} to Pending?\n\nThis will clear the linked project/audit.`)) return;
    try {
      await api.post(`/documents/${d.id}/status`, { status: 'pending' });
      load();
      showToast('Reset to Pending');
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed', 'error'); }
  };

  const setHold = async (d) => {
    if (!window.confirm(`Put ${d.doc_number} ON HOLD?`)) return;
    try {
      await api.post(`/documents/${d.id}/status`, { status: 'on_hold' });
      load();
      showToast('Marked On Hold');
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed', 'error'); }
  };

  const setCancelled = async (d) => {
    if (!window.confirm(`CANCEL ${d.doc_number}?\n\nLinked project/audit will be cleared. You can reset to Pending later.`)) return;
    try {
      await api.post(`/documents/${d.id}/status`, { status: 'cancelled' });
      load();
      showToast('Marked Cancelled');
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed', 'error'); }
  };

  const statusOf = (d) => (d.status || (d.confirmed ? 'confirmed' : 'pending')).toLowerCase();

  const STATUS_STYLE = {
    pending: { label: 'Pending', bg: '#F3F4F6', fg: '#374151', rowBg: undefined, icon: null },
    confirmed: { label: 'Confirmed', bg: '#D1FAE5', fg: '#065F46', rowBg: 'rgba(16, 185, 129, 0.08)', icon: CheckCircle2 },
    on_hold: { label: 'On Hold', bg: '#FEF3C7', fg: '#92400E', rowBg: 'rgba(245, 158, 11, 0.10)', icon: PauseCircle },
    cancelled: { label: 'Cancelled', bg: '#FEE2E2', fg: '#991B1B', rowBg: 'rgba(220, 38, 38, 0.08)', icon: XCircle },
  };

  const filteredPickerItems = useMemo(() => {
    if (!confirmModal) return [];
    const q = projectQuery.trim().toLowerCase();
    if (linkKind === 'audit') {
      const rows = audits;
      if (!q) return rows.slice(0, 50);
      return rows.filter((a) => (
        (a.audit_code || '').toLowerCase().includes(q) ||
        (a.audit_offer || '').toLowerCase().includes(q) ||
        (a.client_name || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q)
      )).slice(0, 50);
    }
    const rows = projects;
    if (!q) return rows.slice(0, 50);
    return rows.filter((p) => (
      (p.project_code || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.client_name || '').toLowerCase().includes(q) ||
      (p.architect_name || '').toLowerCase().includes(q) ||
      (p.site_location || '').toLowerCase().includes(q)
    )).slice(0, 50);
  }, [projects, audits, projectQuery, confirmModal, linkKind]);

  const downloadPdf = (d) => downloadFile(`${API}/documents/${d.id}/pdf`);

  const selectedType = typeById[form.doc_type_id];
  const previewNextNumber = selectedType
    ? `STR/${selectedType.prefix}/${new Date().getFullYear()}/${String(((selectedType.last_year === new Date().getFullYear()) ? selectedType.counter : 0) + 1).padStart(3, '0')}`
    : '';

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="documents-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Documents</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Generate certificates, letters, quotations and reports with auto-numbered series ({docs.length} total).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="btn btn-outline"
            data-testid="btn-toggle-archived-documents"
          >
            <Archive size={14}/> {showArchived ? 'Viewing Archived — Show Active' : 'Show Archived'}
          </button>
          <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-document">
            <Plus size={15}/> New Document
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 space-y-2" data-testid="documents-search-form">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, client, plot, contact…" data-testid="documents-search-input" />
          </div>
          <select className="select max-w-[220px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-testid="documents-type-filter">
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="select max-w-[220px]" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} data-testid="documents-client-filter">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select max-w-[220px]" value={architectFilter} onChange={(e) => setArchitectFilter(e.target.value)} data-testid="documents-architect-filter">
            <option value="">All architects</option>
            {architects.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="btn btn-outline" type="submit" data-testid="documents-search-btn">Search</button>
        </div>
        <div className="flex gap-2 items-center flex-wrap text-sm">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Date range</span>
          <input
            type="date"
            className="input"
            style={{ width: 170, padding: '6px 10px' }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            data-testid="documents-date-from"
          />
          <span style={{ color: 'var(--cc-text-muted)' }}>to</span>
          <input
            type="date"
            className="input"
            style={{ width: 170, padding: '6px 10px' }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            data-testid="documents-date-to"
          />
          {activeFiltersCount > 0 && (
            <>
              <span className="ml-2 text-xs" style={{ color: 'var(--cc-accent)' }}>
                {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} active · showing {visible.length} of {docs.length}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-outline btn-sm"
                data-testid="documents-clear-filters"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="documents-table">
            <thead>
              <tr>
                <SortHeader label="Document No." sk="doc_number"/>
                <SortHeader label="Type" sk="doc_type_name"/>
                <SortHeader label="Client" sk="client_name"/>
                <SortHeader label="Architect" sk="architect_name"/>
                <SortHeader label="Plot / Place" sk="plot_place"/>
                <SortHeader label="Contact" sk="contact_person"/>
                <SortHeader label="Date" sk="document_date"/>
                <SortHeader label="Status" sk="status"/>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12">
                  <FileSignature size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{showArchived ? 'No archived documents' : 'No documents yet'}</div>
                  <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Click "New Document" to generate your first one.</div>
                </td></tr>
              ) : visible.map((d) => {
                const st = statusOf(d);
                const style = STATUS_STYLE[st] || STATUS_STYLE.pending;
                const StatusIcon = style.icon;
                return (
                <tr
                  key={d.id}
                  data-testid={`document-row-${d.doc_number.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  style={style.rowBg ? { background: style.rowBg } : undefined}
                >
                  <td className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{d.doc_number}</td>
                  <td className="text-sm">{d.doc_type_name}</td>
                  <td className="text-sm">{d.client_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm">{d.architect_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm max-w-[220px]"><div className="line-clamp-2">{d.plot_place || '—'}</div></td>
                  <td className="text-xs">
                    {d.contact_person && <div>{d.contact_person}</div>}
                    {d.mobile && <div className="font-mono-data text-gray-500">{d.mobile}</div>}
                    {!d.contact_person && !d.mobile && <span className="text-gray-400">—</span>}
                  </td>
                  <td className="text-xs font-mono-data">{(d.document_date || '').slice(0, 10) || '—'}</td>
                  <td className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit"
                        style={{ background: style.bg, color: style.fg }}
                        data-testid={`doc-status-${st}-${d.id}`}
                      >
                        {StatusIcon ? <StatusIcon size={12}/> : null} {style.label}
                      </span>
                      {st === 'confirmed' && d.linked_project_code && (
                        <Link to={`/projects/${d.linked_project_id}`} className="inline-flex items-center gap-1 link-underline text-[11px]" data-testid={`doc-linked-project-${d.id}`} style={{ color: 'var(--cc-accent)' }}>
                          <Link2 size={10}/> <span className="font-mono-data">{d.linked_project_code}</span>
                        </Link>
                      )}
                      {st === 'confirmed' && d.linked_audit_code && (
                        <Link to={`/audits/${d.linked_audit_id}`} className="inline-flex items-center gap-1 link-underline text-[11px]" data-testid={`doc-linked-audit-${d.id}`} style={{ color: 'var(--cc-accent)' }}>
                          <Link2 size={10}/> <span className="font-mono-data">{d.linked_audit_code}</span>
                        </Link>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end flex-wrap">
                      {st !== 'confirmed' && (
                        <button onClick={() => openConfirm(d)} className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: '1px solid #10B981' }} title="Confirm order" data-testid={`btn-confirm-${d.id}`}>
                          <CheckCircle2 size={13}/>
                        </button>
                      )}
                      {st === 'confirmed' && (d.linked_project_id || d.linked_audit_id) && (
                        <button onClick={() => openConfirm(d)} className="btn btn-outline btn-sm" title="Move to another project / audit" data-testid={`btn-move-${d.id}`}>
                          <ArrowRightLeft size={13}/>
                        </button>
                      )}
                      {st !== 'on_hold' && (
                        <button onClick={() => setHold(d)} className="btn btn-sm" style={{ background: '#F59E0B', color: '#fff', border: '1px solid #F59E0B' }} title="Put on hold" data-testid={`btn-hold-${d.id}`}>
                          <PauseCircle size={13}/>
                        </button>
                      )}
                      {st !== 'cancelled' && (
                        <button onClick={() => setCancelled(d)} className="btn btn-sm" style={{ background: '#DC2626', color: '#fff', border: '1px solid #DC2626' }} title="Cancel" data-testid={`btn-cancel-${d.id}`}>
                          <XCircle size={13}/>
                        </button>
                      )}
                      {st !== 'pending' && (
                        <button onClick={() => unconfirm(d)} className="btn btn-outline btn-sm" title="Reset to Pending" data-testid={`btn-reset-${d.id}`}>
                          <RotateCcw size={13}/>
                        </button>
                      )}
                      <button onClick={() => downloadPdf(d)} className="btn btn-outline btn-sm" title="Download PDF" data-testid={`btn-doc-pdf-${d.id}`}><FileText size={13}/></button>
                      <button onClick={() => openEdit(d)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-doc-edit-${d.id}`}><Pencil size={13}/></button>
                      {d.archived ? (
                        <button onClick={() => handleUnarchive(d)} className="btn btn-outline btn-sm" title="Restore" data-testid={`btn-doc-restore-${d.id}`}><ArchiveRestore size={13}/></button>
                      ) : (
                        <button onClick={() => handleArchive(d)} className="btn btn-outline btn-sm" title="Archive" data-testid={`btn-doc-archive-${d.id}`}><Archive size={13}/></button>
                      )}
                      <button onClick={() => handleDelete(d)} className="btn btn-danger btn-sm" title="Delete" data-testid={`btn-doc-delete-${d.id}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.doc_number}` : 'New Document'} testId="document-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Document Type *</label>
              <select className="select" value={form.doc_type_id} onChange={(e) => update('doc_type_id', e.target.value)} data-testid="document-form-type">
                <option value="">-- Select type --</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.prefix})</option>)}
              </select>
              {!editing && previewNextNumber && (
                <div className="text-xs mt-1 font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>
                  Next number: <span style={{ color: 'var(--cc-accent)' }}>{previewNextNumber}</span>
                </div>
              )}
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.document_date} onChange={(e) => update('document_date', e.target.value)} data-testid="document-form-date" />
            </div>
          </div>

          <div>
            <label className="label">Client Name</label>
            <InlinePicker
              entityType="client"
              value={form.client_id}
              onChange={(v) => update('client_id', v)}
              items={clients}
              onItemsChange={setClients}
              testIdPrefix="document-form-client-"
            />
          </div>

          <div>
            <label className="label">Architect</label>
            <InlinePicker
              entityType="architect"
              value={form.architect_id}
              onChange={(v) => update('architect_id', v)}
              items={architects}
              onItemsChange={setArchitects}
              testIdPrefix="document-form-architect-"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Plot No / Place</label>
              <input className="input" value={form.plot_place} onChange={(e) => update('plot_place', e.target.value)} placeholder="e.g. 5874/44D Chandigarh" data-testid="document-form-plot" />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.phase} onChange={(e) => update('phase', e.target.value)} placeholder="e.g. Andheri West, Mumbai" data-testid="document-form-location" />
            </div>
          </div>

          <div>
            <label className="label">Path of Folder</label>
            <input className="input font-mono-data" value={form.remark} onChange={(e) => update('remark', e.target.value)} placeholder="e.g. D:/Projects/2026/ACCP-003" data-testid="document-form-folder-path" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Person Name</label>
              <input className="input" value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} placeholder="e.g. Vicky Sharma" data-testid="document-form-contact" />
            </div>
            <div>
              <label className="label">Mobile No</label>
              <input className="input font-mono-data" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} placeholder="10-digit number" data-testid="document-form-mobile" />
            </div>
          </div>

          <div>
            <label className="label">Any Other Comments</label>
            <textarea className="textarea" rows={3} value={form.other_comments} onChange={(e) => update('other_comments', e.target.value)} placeholder="Free-form notes (printed on PDF)" data-testid="document-form-comments" />
          </div>

          {editing && (
            <div>
              <label className="label">Document Number (manual override)</label>
              <input className="input font-mono-data" value={form.doc_number} onChange={(e) => update('doc_number', e.target.value)} data-testid="document-form-number" />
            </div>
          )}

          {error && <div className="text-sm text-red-600" data-testid="document-form-error">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="document-form-save">{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Document')}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal ? (confirmModal.status === 'confirmed' ? `Move ${confirmModal.doc_number} to another ${linkKind}` : `Confirm order for ${confirmModal.doc_number}`) : ''}
        testId="confirm-order-modal"
        maxWidth="640px"
      >
        {confirmModal && (
          <div className="space-y-3">
            <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
              <div><span style={{ color: 'var(--cc-text-muted)' }}>Document:</span> <span className="font-mono-data font-semibold">{confirmModal.doc_number}</span> · {confirmModal.doc_type_name}</div>
              {confirmModal.client_name && <div><span style={{ color: 'var(--cc-text-muted)' }}>Client:</span> {confirmModal.client_name}</div>}
              {confirmModal.architect_name && <div><span style={{ color: 'var(--cc-text-muted)' }}>Architect:</span> {confirmModal.architect_name}</div>}
              {confirmModal.plot_place && <div><span style={{ color: 'var(--cc-text-muted)' }}>Plot:</span> {confirmModal.plot_place}</div>}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="label mb-0">Link to:</label>
                <div className="inline-flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--cc-border)' }}>
                  <button
                    type="button"
                    onClick={() => { setLinkKind('project'); setProjectQuery(''); }}
                    className="px-3 py-1.5"
                    style={linkKind === 'project'
                      ? { background: 'var(--cc-dark-green)', color: '#fff' }
                      : { background: '#fff', color: 'var(--cc-dark-green)' }}
                    data-testid="confirm-link-kind-project"
                  >
                    Project
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLinkKind('audit'); setProjectQuery(''); }}
                    className="px-3 py-1.5 border-l"
                    style={linkKind === 'audit'
                      ? { background: 'var(--cc-dark-green)', color: '#fff', borderColor: 'var(--cc-dark-green)' }
                      : { background: '#fff', color: 'var(--cc-dark-green)', borderColor: 'var(--cc-border)' }}
                    data-testid="confirm-link-kind-audit"
                  >
                    Audit
                  </button>
                </div>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--cc-text-muted)' }}>
                Pick an existing {linkKind}, or confirm without linking. The document row will turn green either way.
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
                <input
                  className="input pl-9"
                  value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  placeholder={linkKind === 'audit'
                    ? 'Search audits by code, offer, client, location…'
                    : 'Search projects by code, name, client, architect, location…'}
                  autoFocus
                  data-testid="confirm-project-search"
                />
              </div>
              <div className="rounded-lg border mt-2 max-h-72 overflow-y-auto" style={{ borderColor: 'var(--cc-border)' }}>
                {filteredPickerItems.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--cc-text-muted)' }}>
                    {(linkKind === 'audit' ? audits : projects).length === 0
                      ? `Loading ${linkKind}s…`
                      : `No ${linkKind}s match "${projectQuery}"`}
                  </div>
                ) : linkKind === 'audit' ? (
                  filteredPickerItems.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => performConfirm(a.id)}
                      disabled={confirmBusy}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center gap-3"
                      style={{ borderColor: 'var(--cc-border)' }}
                      data-testid={`confirm-audit-pick-${a.audit_code}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-accent)' }}>{a.audit_code}</span>
                          <span className="ml-2">{a.audit_offer || 'Audit'}</span>
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>
                          {a.client_name || 'No client'}{a.location ? ` · ${a.location}` : ''}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  filteredPickerItems.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => performConfirm(p.id)}
                      disabled={confirmBusy}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center gap-3"
                      style={{ borderColor: 'var(--cc-border)' }}
                      data-testid={`confirm-project-pick-${p.project_code}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-accent)' }}>{p.project_code}</span>
                          <span className="ml-2">{p.name}</span>
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>
                          {p.client_name || 'No client'}{p.site_location ? ` · ${p.site_location}` : ''}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => performConfirm(null)}
                disabled={confirmBusy}
                className="btn btn-outline"
                data-testid="confirm-without-link"
              >
                Confirm without linking
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmModal(null)} className="btn btn-outline">Cancel</button>
              </div>
            </div>
            {confirmBusy && <div className="text-xs text-center" style={{ color: 'var(--cc-text-muted)' }}>Saving…</div>}
          </div>
        )}
      </Modal>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
          style={toast.type === 'error'
            ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="document-toast"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
