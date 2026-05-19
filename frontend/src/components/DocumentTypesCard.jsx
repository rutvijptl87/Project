import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { logger } from '../lib/logger';
import { FileSignature, Plus, Pencil, Trash2, Save, X } from 'lucide-react';

const blankType = { name: '', prefix: '', description: '', year_reset: true };

const DocumentTypesCard = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // id of row being edited, or 'new'
  const [draft, setDraft] = useState(blankType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [startFrom, setStartFrom] = useState({}); // map of typeId -> string input value
  const [savingStart, setSavingStart] = useState(null); // typeId being saved
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/document-types'); setTypes(r.data); }
    catch (e) { logger.error('Document types load failed:', e); }
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

  // Edit the auto-increment counter directly (= "Last Number Used"). After
  // saving counter=N, the next generated number will be N+1.
  const [lastUsed, setLastUsed] = useState({}); // typeId -> string input value
  const [savingLast, setSavingLast] = useState(null);

  const applyLastUsed = async (t) => {
    const raw = lastUsed[t.id];
    if (raw === undefined || raw === '') return;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num < 0) {
      showToast('Enter a non-negative number', 'error');
      return;
    }
    setSavingLast(t.id);
    try {
      await api.put(`/document-types/${t.id}/counter`, null, {
        params: { counter: num, last_year: new Date().getFullYear() },
      });
      setLastUsed((p) => ({ ...p, [t.id]: '' }));
      load();
      const nextN = num + 1;
      showToast(`Next ${t.name} will be CC/${t.prefix}/${new Date().getFullYear()}/${String(nextN).padStart(3, '0')}`);
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed to update', 'error');
    } finally { setSavingLast(null); }
  };

  // "Start From" — user types the next document number to issue (e.g. 51 means the
  // next document will be CC/PREFIX/YYYY/051). We persist that as counter = N-1.
  const nextNumberFor = (t) => (t.counter > 0 ? (t.counter + 1) : 1);

  const applyStartFrom = async (t) => {
    const raw = startFrom[t.id];
    if (raw === undefined || raw === '') return;
    const num = parseInt(raw, 10);
    if (Number.isNaN(num) || num < 1) {
      showToast('Enter a number ≥ 1', 'error');
      return;
    }
    const wouldOverwrite = t.counter > 0 && num <= t.counter;
    if (wouldOverwrite) {
      const ok = window.confirm(
        `Heads up: this type has already used up to #${t.counter}.\n` +
        `Setting "Start From" to ${num} means the next document will reuse number ${num}, ` +
        `which may clash with an existing one.\n\nProceed anyway?`
      );
      if (!ok) return;
    }
    setSavingStart(t.id);
    try {
      await api.put(`/document-types/${t.id}/counter`, null, {
        params: { counter: num - 1, last_year: new Date().getFullYear() },
      });
      setStartFrom((p) => ({ ...p, [t.id]: '' }));
      load();
      showToast(`Next ${t.name} number will be CC/${t.prefix}/${new Date().getFullYear()}/${String(num).padStart(3, '0')}`);
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed to update', 'error');
    } finally { setSavingStart(null); }
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
            <br/>
            <span className="text-[11px]">Tip: edit "<b>Last Number Used</b>" to manually set the counter (next document will be that number + 1). Or use "<b>Start From</b>" to specify exactly what the next document should be.</span>
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
              <th>Start From (Next Number)</th>
              <th>Reset yearly?</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--cc-text-muted)' }}>Loading…</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--cc-text-muted)' }}>No document types yet.</td></tr>
            ) : types.map((t) => {
              const isEd = editing === t.id;
              if (isEd) {
                return (
                  <tr key={t.id} data-testid={`doc-type-row-${t.prefix}-edit`}>
                    <td><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid={`doc-type-edit-name-${t.prefix}`}/></td>
                    <td><input className="input font-mono-data" value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })} data-testid={`doc-type-edit-prefix-${t.prefix}`}/></td>
                    <td className="font-mono-data text-xs">CC/{draft.prefix || t.prefix}/{t.last_year || new Date().getFullYear()}/{String(t.counter || 0).padStart(3, '0')}</td>
                    <td className="font-mono-data text-xs text-gray-400">—</td>
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
              const placeholder = String(nextNumberFor(t)).padStart(3, '0');
              return (
                <tr key={t.id} data-testid={`doc-type-row-${t.prefix}`}>
                  <td className="text-sm font-medium">{t.name}</td>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-accent)' }}>{t.prefix}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="font-mono-data text-xs whitespace-nowrap text-gray-500">
                        CC/{t.prefix}/{t.last_year || new Date().getFullYear()}/
                      </span>
                      <input
                        type="number"
                        min={0}
                        className="input font-mono-data"
                        style={{ width: 80, padding: '4px 8px' }}
                        placeholder={String(t.counter || 0).padStart(3, '0')}
                        value={lastUsed[t.id] ?? ''}
                        onChange={(e) => setLastUsed((p) => ({ ...p, [t.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyLastUsed(t); }}
                        data-testid={`doc-type-lastused-${t.prefix}`}
                      />
                      <button
                        onClick={() => applyLastUsed(t)}
                        disabled={savingLast === t.id || lastUsed[t.id] === undefined || lastUsed[t.id] === ''}
                        className="btn btn-primary btn-sm"
                        title="Save last used number"
                        data-testid={`doc-type-lastused-save-${t.prefix}`}
                      >
                        <Save size={11}/>
                      </button>
                    </div>
                    {t.counter > 0 && (
                      <div className="text-[10px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
                        currently <span className="font-mono-data">{String(t.counter).padStart(3, '0')}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        className="input font-mono-data"
                        style={{ width: 90, padding: '4px 8px' }}
                        placeholder={placeholder}
                        value={startFrom[t.id] ?? ''}
                        onChange={(e) => setStartFrom((p) => ({ ...p, [t.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyStartFrom(t); }}
                        data-testid={`doc-type-startfrom-${t.prefix}`}
                      />
                      <button
                        onClick={() => applyStartFrom(t)}
                        disabled={savingStart === t.id || !startFrom[t.id]}
                        className="btn btn-primary btn-sm"
                        title="Set next number"
                        data-testid={`doc-type-startfrom-save-${t.prefix}`}
                      >
                        <Save size={11}/>
                      </button>
                    </div>
                  </td>
                  <td className="text-xs">{t.year_reset ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
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
