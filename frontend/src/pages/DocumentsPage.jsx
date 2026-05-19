import React, { useEffect, useMemo, useState } from 'react';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import InlinePicker from '../components/InlinePicker';
import { logger } from '../lib/logger';
import { Plus, Search, FileText, Pencil, Trash2, Archive, ArchiveRestore, FileSignature } from 'lucide-react';

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
  const [showArchived, setShowArchived] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(new Set());

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, showArchived]);

  const visible = useMemo(() => docs.filter((d) => !hiddenIds.has(d.id)), [docs, hiddenIds]);

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

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 flex gap-2 flex-wrap" data-testid="documents-search-form">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, client, plot, contact…" data-testid="documents-search-input" />
        </div>
        <select className="select max-w-[260px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-testid="documents-type-filter">
          <option value="">All types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn btn-outline" type="submit" data-testid="documents-search-btn">Search</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="documents-table">
            <thead>
              <tr>
                <th>Document No.</th>
                <th>Type</th>
                <th>Client</th>
                <th>Architect</th>
                <th>Plot / Place</th>
                <th>Contact</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <FileSignature size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{showArchived ? 'No archived documents' : 'No documents yet'}</div>
                  <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Click "New Document" to generate your first one.</div>
                </td></tr>
              ) : visible.map((d) => (
                <tr key={d.id} data-testid={`document-row-${d.doc_number.replace(/[^a-zA-Z0-9]/g, '-')}`}>
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
                  <td>
                    <div className="flex gap-1 justify-end flex-wrap">
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
              ))}
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
              <label className="label">Phase</label>
              <input className="input" value={form.phase} onChange={(e) => update('phase', e.target.value)} placeholder="e.g. Phase 1" data-testid="document-form-phase" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Number</label>
              <input className="input font-mono-data" value={form.number_field} onChange={(e) => update('number_field', e.target.value)} placeholder="e.g. CLC/2546/kjh/451" data-testid="document-form-number-field" />
            </div>
            <div>
              <label className="label">Update Date</label>
              <input type="date" className="input" value={form.update_date} onChange={(e) => update('update_date', e.target.value)} data-testid="document-form-update-date" />
            </div>
          </div>

          <div>
            <label className="label">Remark</label>
            <input className="input" value={form.remark} onChange={(e) => update('remark', e.target.value)} placeholder="Short note shown on PDF" data-testid="document-form-remark" />
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
