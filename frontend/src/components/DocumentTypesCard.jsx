import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { FileSignature, Plus, Pencil, Trash2, RotateCcw, Save, X } from 'lucide-react';

const blankType = { name: '', prefix: '', description: '', year_reset: true };

const DocumentTypesCard = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // id of row being edited, or 'new'
  const [draft, setDraft] = useState(blankType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/document-types'); setTypes(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing('new'); setDraft(blankType); setError(''); };
  const startEdit = (t) => {
    setEditing(t.id);
    setDraft({ name: t.name, prefix: t.prefix, description: t.description || '', year_reset: !!t.year_reset });
    setError('');
  };
  const cancel = () => { setEditing(null); setDraft(blankType); setError(''); };

  const handleSave = async () => {
    setError('');
    if (!draft.name.trim()) return setError('Name is required');
    if (!draft.prefix.trim()) return setError('Prefix is required (used in CC/PREFIX/YYYY/001)');
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post('/document-types', draft);
        showToast('Type added');
      } else {
        await api.put(`/document-types/${editing}`, draft);
        showToast('Type updated');
      }
      cancel(); load();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete document type "${t.name}"?\n\nThis only works if no documents have been created with this type.`)) return;
    try { await api.delete(`/document-types/${t.id}`); load(); showToast('Type deleted'); }
    catch (e) { alert(e?.response?.data?.detail || 'Failed to delete'); }
  };

  const resetCounter = async (t) => {
    const v = window.prompt(`Reset counter for "${t.name}".\nCurrent: ${t.counter} (year ${t.last_year || '—'})\n\nEnter new counter value (0 = start fresh next time):`, String(t.counter || 0));
    if (v === null) return;
    const num = parseInt(v, 10);
    if (Number.isNaN(num) || num < 0) return alert('Enter a non-negative integer');
    try {
      await api.put(`/document-types/${t.id}/counter`, null, { params: { counter: num, last_year: new Date().getFullYear() } });
      load();
      showToast('Counter reset');
    } catch (e) { alert(e?.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="card p-6" data-testid="document-types-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <FileSignature size={18}/> Document Number Series
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Each document type has its own auto-incrementing number. Format: <span className="font-mono-data">CC/PREFIX/YYYY/001</span>
          </p>
        </div>
        {editing !== 'new' && (
          <button onClick={startNew} className="btn btn-outline btn-sm" data-testid="btn-doc-type-add">
            <Plus size={13}/> Add Type
          </button>
        )}
      </div>

      {editing === 'new' && (
        <div className="rounded-lg border p-4 mb-4" style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }} data-testid="doc-type-new-editor">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. RERA Certificate" data-testid="doc-type-new-name" />
            </div>
            <div>
              <label className="label">Prefix *</label>
              <input className="input font-mono-data" value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })} placeholder="e.g. RERA" data-testid="doc-type-new-prefix" />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={draft.year_reset} onChange={(e) => setDraft({ ...draft, year_reset: e.target.checked })} data-testid="doc-type-new-yearreset"/>
            Reset counter every year
          </label>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={cancel} className="btn btn-outline btn-sm"><X size={13}/> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" data-testid="doc-type-new-save"><Save size={13}/> {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="cc-table" data-testid="doc-types-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Last Number Used</th>
              <th>Reset yearly?</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--cc-text-muted)' }}>Loading…</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--cc-text-muted)' }}>No document types yet.</td></tr>
            ) : types.map((t) => {
              const isEd = editing === t.id;
              if (isEd) {
                return (
                  <tr key={t.id} data-testid={`doc-type-row-${t.prefix}-edit`}>
                    <td><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid={`doc-type-edit-name-${t.prefix}`}/></td>
                    <td><input className="input font-mono-data" value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })} data-testid={`doc-type-edit-prefix-${t.prefix}`}/></td>
                    <td className="font-mono-data text-xs">CC/{draft.prefix || t.prefix}/{t.last_year || new Date().getFullYear()}/{String(t.counter || 0).padStart(3, '0')}</td>
                    <td><input type="checkbox" checked={draft.year_reset} onChange={(e) => setDraft({ ...draft, year_reset: e.target.checked })} /></td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={cancel} className="btn btn-outline btn-sm"><X size={12}/></button>
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm"><Save size={12}/></button>
                      </div>
                      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={t.id} data-testid={`doc-type-row-${t.prefix}`}>
                  <td className="text-sm font-medium">{t.name}</td>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-accent)' }}>{t.prefix}</td>
                  <td className="font-mono-data text-xs">
                    {t.counter > 0
                      ? `CC/${t.prefix}/${t.last_year}/${String(t.counter).padStart(3, '0')}`
                      : <span className="text-gray-400">— unused —</span>}
                  </td>
                  <td className="text-xs">{t.year_reset ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => resetCounter(t)} className="btn btn-outline btn-sm" title="Reset counter" data-testid={`doc-type-reset-${t.prefix}`}><RotateCcw size={12}/></button>
                      <button onClick={() => startEdit(t)} className="btn btn-outline btn-sm" title="Edit prefix/name" data-testid={`doc-type-edit-${t.prefix}`}><Pencil size={12}/></button>
                      <button onClick={() => handleDelete(t)} className="btn btn-danger btn-sm" title="Delete" data-testid={`doc-type-delete-${t.prefix}`}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
          style={toast.type === 'error'
            ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default DocumentTypesCard;
