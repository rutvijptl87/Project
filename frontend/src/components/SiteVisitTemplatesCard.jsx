import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ClipboardList, Plus, Trash2, Save, X, Edit3 } from 'lucide-react';

const blank = { name: '', description: '', checklist: [''] };

const SiteVisitTemplatesCard = () => {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/site-visit-templates');
      setItems(r.data || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing('new'); setForm(blank); setMsg(''); };
  const startEdit = (t) => { setEditing(t.id); setForm({ name: t.name, description: t.description || '', checklist: [...(t.checklist || []), ''] }); setMsg(''); };
  const cancel = () => { setEditing(null); setForm(blank); setMsg(''); };

  const updateItem = (idx, val) => setForm((f) => ({ ...f, checklist: f.checklist.map((c, i) => (i === idx ? val : c)) }));
  const addItem = () => setForm((f) => ({ ...f, checklist: [...f.checklist, ''] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));

  const save = async () => {
    if (!form.name.trim()) { setMsg('Template name is required'); return; }
    const cleaned = form.checklist.map((s) => s.trim()).filter(Boolean);
    setBusy(true); setMsg('');
    try {
      const body = { name: form.name.trim(), description: form.description, checklist: cleaned };
      if (editing === 'new') await api.post('/site-visit-templates', body);
      else await api.put(`/site-visit-templates/${editing}`, body);
      await load();
      cancel();
    } catch (e) {
      setMsg(e?.response?.data?.detail || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"? Existing visits keep their saved checklist.`)) return;
    try { await api.delete(`/site-visit-templates/${t.id}`); await load(); }
    catch (err) { console.error('Template delete failed', err); }
  };

  return (
    <div className="card p-6" data-testid="sv-templates-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <ClipboardList size={18}/> Site Visit Checklist Templates
        </h2>
        {editing == null && <button onClick={startNew} className="btn btn-accent btn-sm" data-testid="btn-new-sv-template"><Plus size={13}/> New template</button>}
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--cc-text-muted)' }}>
        Engineers pick one of these templates to auto-load checklist items during a site visit.
      </p>

      {editing != null && (
        <div className="rounded-md p-3 mb-4" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Template name</label>
              <input className="input w-full mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="sv-template-name"/>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Description</label>
              <input className="input w-full mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="sv-template-desc"/>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Checklist items</label>
            {form.checklist.map((it, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-xs mt-2.5 font-mono-data w-5 text-right">{idx + 1}.</span>
                <input className="input flex-1" value={it} onChange={(e) => updateItem(idx, e.target.value)} placeholder="e.g. Clear cover to reinforcement" data-testid={`sv-template-item-${idx}`}/>
                <button type="button" onClick={() => removeItem(idx)} className="btn btn-outline btn-sm" data-testid={`sv-template-item-remove-${idx}`}><Trash2 size={12}/></button>
              </div>
            ))}
            <button type="button" onClick={addItem} className="btn btn-outline btn-sm" data-testid="sv-template-add-item"><Plus size={12}/> Add item</button>
          </div>
          {msg && <div className="text-xs mt-2" style={{ color: '#B91C1C' }}>{msg}</div>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancel} className="btn btn-outline btn-sm" data-testid="sv-template-cancel"><X size={12}/> Cancel</button>
            <button onClick={save} disabled={busy} className="btn btn-accent btn-sm" data-testid="sv-template-save"><Save size={12}/> Save</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((t) => (
          <div key={t.id} className="rounded-md p-3" style={{ border: '1px solid var(--cc-border)' }} data-testid={`sv-template-row-${t.name}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm" style={{ color: 'var(--cc-dark-green)' }}>{t.name}</span>
              <div className="flex gap-1">
                <button onClick={() => startEdit(t)} className="btn btn-outline btn-sm" title="Edit"><Edit3 size={12}/></button>
                <button onClick={() => del(t)} className="btn btn-outline btn-sm" title="Delete"><Trash2 size={12}/></button>
              </div>
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--cc-text-muted)' }}>{t.description || '—'}</div>
            <div className="text-[11px] font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>{(t.checklist || []).length} item(s)</div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>No templates yet.</div>}
      </div>
    </div>
  );
};

export default SiteVisitTemplatesCard;
