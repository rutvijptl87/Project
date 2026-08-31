import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import InlinePicker from '../components/InlinePicker';
import CustomSelect from '../components/CustomSelect';
import CustomDatePicker from '../components/CustomDatePicker';
import { logger } from '../lib/logger';
import Pagination from '../components/Pagination';
import { Plus, Search, FileText, Pencil, Trash2, Archive, ArchiveRestore, FileSignature, CheckCircle2, RotateCcw, ArrowUp, ArrowDown, Link2, PauseCircle, XCircle, ArrowRightLeft , X } from 'lucide-react';

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
  audit_offer_path: '',
  audit_report_path: '',
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

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
      const params = {
        page,
        limit,
        sort_by: sortKey,
        sort_dir: sortDir,
      };
      if (typeFilter) params.type_id = typeFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (architectFilter) params.architect_id = architectFilter;
      if (search) params.search = search;
      if (showArchived) params.archived = true;
      const [t, c, ar, d] = await Promise.all([
        api.get('/document-types'),
        api.get('/clients'),
        api.get('/architects'),
        api.get('/documents/paginated', { params }),
      ]);
      setTypes(t.data);
      setClients(c.data);
      setArchitects(ar.data);
      setDocs(d.data.data);
      setTotal(d.data.total);
    } catch (e) { logger.error('Documents load failed:', e); } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, clientFilter, architectFilter, showArchived, page, sortKey, sortDir]);

  // Client-side date range filter (backend doesn't yet expose date filtering on documents)
  const visible = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    return docs.filter((d) => {
      if (hiddenIds.has(d.id)) return false;
      if (fromTs || toTs) {
        const ts = d.document_date ? new Date(d.document_date).getTime() : null;
        if (!ts) return false;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [docs, hiddenIds, dateFrom, dateTo]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'document_date' ? 'desc' : 'asc');
      setPage(1);
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

  const typeList = Array.isArray(types) ? types : (types?.data || []);
  const clientList = Array.isArray(clients) ? clients : (clients?.data || []);
  const architectList = Array.isArray(architects) ? architects : (architects?.data || []);

  const typeById = useMemo(() => Object.fromEntries(typeList.map((t) => [t.id, t])), [typeList]);

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
      audit_offer_path: d.audit_offer_path || '',
      audit_report_path: d.audit_report_path || '',
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
    
    try {
      await api.post(`/documents/${d.id}/status`, { status: 'pending' });
      load();
      showToast('Reset to Pending');
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed', 'error'); }
  };

  const setHold = async (d) => {
    
    try {
      await api.post(`/documents/${d.id}/status`, { status: 'on_hold' });
      load();
      showToast('Marked On Hold');
    } catch (e) { showToast(e?.response?.data?.detail || 'Failed', 'error'); }
  };

  const setCancelled = async (d) => {
    
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
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8" data-testid="documents-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Documents</h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Generate certificates, letters, quotations and reports with auto-numbered series ({docs.length} total).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="btn btn-outline flex-1 sm:flex-none"
            data-testid="btn-toggle-archived-documents"
          >
            <Archive size={14}/> <span className="hidden xs:inline sm:inline">{showArchived ? 'Show Active' : 'Show Archived'}</span><span className="xs:hidden sm:hidden">{showArchived ? 'Active' : 'Archived'}</span>
          </button>
          <button onClick={openNew} className="btn btn-primary flex-1 sm:flex-none" data-testid="btn-new-document">
            <Plus size={15}/> New Document
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 space-y-2" data-testid="documents-search-form">
        {/* Row 1: Search + dropdowns + button */}
        <div className="flex flex-col gap-2 md:grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-center">
          {/* Search — full width on mobile, first col on desktop */}
          <div className="relative md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            <input className="input pl-9 w-full" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, client, plot…" data-testid="documents-search-input" />
          </div>
          {/* Three selects: 2-col on mobile/sm, each own col on md+ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:contents">
            <CustomSelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              options={typeList.map((t) => ({ value: String(t.id), label: t.name }))}
              placeholder="All types"
              data-testid="documents-type-filter"
            />
            <CustomSelect
              value={clientFilter}
              onChange={(v) => setClientFilter(v)}
              options={clientList.map((c) => ({ value: String(c.id), label: c.name }))}
              placeholder="All clients"
              data-testid="documents-client-filter"
            />
            <CustomSelect
              value={architectFilter}
              onChange={(v) => setArchitectFilter(v)}
              options={architectList.map((a) => ({ value: String(a.id), label: a.name }))}
              placeholder="All architects"
              className="col-span-2 sm:col-span-1"
              data-testid="documents-architect-filter"
            />
          </div>
          <button className="btn btn-outline w-full md:w-auto whitespace-nowrap" type="submit" data-testid="documents-search-btn">
            <Search size={14} /> Search
          </button>
        </div>

        {/* Row 2: Date range + active filter info */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-widest shrink-0" style={{ color: 'var(--cc-text-muted)' }}>Date</span>
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 items-center flex-1 sm:flex-none">
            <CustomDatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder="From date"
              data-testid="documents-date-from"
            />
            <CustomDatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder="To date"
              data-testid="documents-date-to"
            />
          </div>
          {activeFiltersCount > 0 && (
            <>
              <span className="text-xs shrink-0" style={{ color: 'var(--cc-accent)' }}>
                {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} · {visible.length}/{docs.length}
              </span>
              <button type="button" onClick={clearFilters} className="btn btn-outline btn-sm" data-testid="documents-clear-filters">Clear</button>
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
                <SortHeader label="Type" sk="doc_type_name" className="hidden sm:table-cell"/>
                <SortHeader label="Client" sk="client_name" className="hidden lg:table-cell"/>
                <SortHeader label="Architect" sk="architect_name" className="hidden md:table-cell"/>
                <SortHeader label="Plot / Place" sk="plot_place" className="hidden md:table-cell"/>
                <SortHeader label="Contact" sk="contact_person" className="hidden md:table-cell"/>
                <SortHeader label="Date" sk="document_date" className="hidden sm:table-cell"/>
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
                // Only real quotations (QT / PMC-QT) get the confirm/hold/cancel
                // /download-PDF workflow. Every other doc type is a simple
                // record — just Edit + Delete (+ Restore when archived).
                const docPrefix = (typeById[d.doc_type_id]?.prefix || d.prefix || '').toUpperCase();
                const docTypeName = (d.doc_type_name || typeById[d.doc_type_id]?.name || '').toLowerCase();
                const isQuotation = ['QT', 'PMC-QT'].includes(docPrefix) || docTypeName.includes('quotation');
                return (
                <tr
                  key={d.id}
                  data-testid={`document-row-${d.doc_number.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  style={style.rowBg ? { background: style.rowBg } : undefined}
                >
                  <td className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{d.doc_number}</td>
                  <td className="text-sm hidden sm:table-cell">{d.doc_type_name}</td>
                  <td className="text-sm hidden lg:table-cell">{d.client_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm hidden md:table-cell">{d.architect_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm max-w-[220px] hidden md:table-cell"><div className="line-clamp-2">{d.plot_place || '—'}</div></td>
                  <td className="text-xs hidden md:table-cell">
                    {d.client_name && <div>{d.client_name}</div>}
                    {d.client_phone && <div className="font-mono-data text-gray-500">{d.client_phone}</div>}
                    {!d.client_name && !d.client_phone && <span className="text-gray-400">—</span>}
                  </td>
                  <td className="text-xs font-mono-data hidden sm:table-cell">{(d.document_date || '').slice(0, 10) || '—'}</td>
                  <td className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit"
                        style={{ background: style.bg, color: style.fg }}
                        data-testid={`doc-status-${st}-${d.id}`}
                      >
                        {StatusIcon ? <StatusIcon size={12}/> : null} {style.label}
                      </span>
                      {st === 'confirmed' && d.linked_project_id && (
                        <Link to={`/projects/${d.linked_project_id}`} className="inline-flex items-center gap-1 link-underline text-[11px]" data-testid={`doc-linked-project-${d.id}`} style={{ color: 'var(--cc-accent)' }}>
                          <Link2 size={10}/> <span>View Project</span>
                        </Link>
                      )}
                      {st === 'confirmed' && d.linked_audit_id && (
                        <Link to={`/audits/${d.linked_audit_id}`} className="inline-flex items-center gap-1 link-underline text-[11px]" data-testid={`doc-linked-audit-${d.id}`} style={{ color: 'var(--cc-accent)' }}>
                          <Link2 size={10}/> <span>View Audit</span>
                        </Link>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end flex-nowrap">
                      {isQuotation && st !== 'pending' && (
                        <button onClick={() => unconfirm(d)} className="btn btn-outline btn-sm" title="Mark as Pending" data-testid={`btn-reset-${d.id}`}>
                          <RotateCcw size={13}/>
                        </button>
                      )}
                      {isQuotation && st !== 'confirmed' && (
                        <button onClick={() => openConfirm(d)} className="btn btn-sm" style={{ background: '#10B981', color: '#fff', border: '1px solid #10B981' }} title="Confirm order" data-testid={`btn-confirm-${d.id}`}>
                          <CheckCircle2 size={13}/>
                        </button>
                      )}
                      {isQuotation && st !== 'cancelled' && (
                        <button onClick={() => setCancelled(d)} className="btn btn-sm" style={{ background: '#DC2626', color: '#fff', border: '1px solid #DC2626' }} title="Cancel" data-testid={`btn-cancel-${d.id}`}>
                          <XCircle size={13}/>
                        </button>
                      )}
                      <button onClick={() => openEdit(d)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-doc-edit-${d.id}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(d)} className="btn btn-danger btn-sm" title="Delete" data-testid={`btn-doc-delete-${d.id}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        <div className="mt-2 sm:mt-4 border-t border-gray-100 bg-white">
          <Pagination page={page} setPage={setPage} limit={limit} total={total} />
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.doc_number}` : 'New Document'} testId="document-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Document Type *</label>
              <CustomSelect
                value={form.doc_type_id}
                onChange={(v) => update('doc_type_id', v)}
                options={typeList.map((t) => ({ value: String(t.id), label: `${t.name} (${t.prefix})` }))}
                placeholder="-- Select type --"
                data-testid="document-form-type"
              />
              {!editing && previewNextNumber && (
                <div className="text-xs mt-1 font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>
                  Next: <span style={{ color: 'var(--cc-accent)' }}>{previewNextNumber}</span>
                </div>
              )}
            </div>
            <div>
              <label className="label">Date</label>
              <CustomDatePicker
                value={form.document_date}
                onChange={(v) => update('document_date', v)}
                placeholder="Select date"
                data-testid="document-form-date"
              />
            </div>
          </div>

          <div>
            <label className="label">Client Name</label>
            <InlinePicker entityType="client" value={form.client_id} onChange={(v) => update('client_id', v)} items={clients} onItemsChange={setClients} testIdPrefix="document-form-client-" />
          </div>

          <div>
            <label className="label">Architect</label>
            <InlinePicker entityType="architect" value={form.architect_id} onChange={(v) => update('architect_id', v)} items={architects} onItemsChange={setArchitects} testIdPrefix="document-form-architect-" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Plot No / Place</label>
              <input className="input w-full" value={form.plot_place} onChange={(e) => update('plot_place', e.target.value)} placeholder="e.g. 5874/44D Chandigarh" data-testid="document-form-plot" />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input w-full" value={form.phase} onChange={(e) => update('phase', e.target.value)} placeholder="e.g. Andheri West, Mumbai" data-testid="document-form-location" />
            </div>
          </div>

          <div>
            <label className="label">Audit Offer Path</label>
            <input className="input font-mono-data w-full" value={form.audit_offer_path} onChange={(e) => update('audit_offer_path', e.target.value)} placeholder="e.g. D:/Projects/2026/ACCP-003-Offer" data-testid="document-form-audit-offer-path" />
          </div>

          <div>
            <label className="label">Audit Report Path</label>
            <input className="input font-mono-data w-full" value={form.audit_report_path} onChange={(e) => update('audit_report_path', e.target.value)} placeholder="e.g. D:/Projects/2026/ACCP-003-Report" data-testid="document-form-audit-report-path" />
          </div>

          <div>
            <label className="label">Any Other Comments</label>
            <textarea className="textarea w-full" rows={3} value={form.other_comments} onChange={(e) => update('other_comments', e.target.value)} placeholder="Free-form notes (printed on PDF)" data-testid="document-form-comments" />
          </div>

          {editing && (
            <div>
              <label className="label">Document Number (manual override)</label>
              <input className="input font-mono-data w-full" value={form.doc_number} onChange={(e) => update('doc_number', e.target.value)} data-testid="document-form-number" />
            </div>
          )}

          {error && <div className="text-sm text-red-600" data-testid="document-form-error">{error}</div>}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto" data-testid="document-form-save">{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Document')}</button>
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
                          <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-accent)' }}>{p.job_no || 'Project'}</span>
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

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => performConfirm(null)}
                disabled={confirmBusy}
                className="btn btn-outline w-full sm:w-auto"
                data-testid="confirm-without-link"
              >
                Confirm without linking
              </button>
              <button type="button" onClick={() => setConfirmModal(null)} className="btn btn-outline w-full sm:w-auto">Cancel</button>
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
