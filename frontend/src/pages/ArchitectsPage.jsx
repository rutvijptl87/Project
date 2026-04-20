import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUndo } from '../lib/undo';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Compass, Phone, Mail } from 'lucide-react';

const emptyA = { name: '', phone: '', email: '', firm: '' };

const ArchitectsPage = () => {
  const { schedule } = useUndo();
  const [items, setItems] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/architects'); setItems(r.data); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyA); setError(''); setModalOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ ...a }); setError(''); setModalOpen(true); };
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone || '', email: form.email || '', firm: form.firm || '',
      };
      if (editing) await api.put(`/architects/${editing.id}`, payload);
      else await api.post('/architects', payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (a) => {
    if (!window.confirm(`Are you sure you want to delete architect "${a.name}"?\n\nAny projects linked to them will be unlinked (but not deleted).\n\nYou can undo within 60 seconds.`)) return;
    setHiddenIds((prev) => new Set([...prev, a.id]));
    schedule({
      label: `Architect ${a.name} deleted`,
      onCommit: async () => {
        try {
          await api.delete(`/architects/${a.id}`);
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
          load();
        } catch {
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
        }
      },
      onUndo: () => {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
      },
    });
  };

  const visibleItems = items.filter((a) => !hiddenIds.has(a.id));

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="architects-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Architects</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Manage architect contacts ({items.length} total).</p>
        </div>
        <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-architect"><Plus size={15}/> New Architect</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="architects-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Firm</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : visibleItems.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12">
                  <Compass size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">No architects yet</div>
                </td></tr>
              ) : visibleItems.map((a) => (
                <tr key={a.id} data-testid={`architect-row-${a.id}`}>
                  <td className="font-medium">
                    <Link to={`/architects/${a.id}`} className="link-underline hover:opacity-80" data-testid={`architect-link-${a.id}`}>
                      {a.name}
                    </Link>
                  </td>
                  <td className="font-mono-data text-xs">{a.phone ? <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1"><Phone size={11}/>{a.phone}</a> : '—'}</td>
                  <td className="text-xs">{a.email ? <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{a.email}</a> : '—'}</td>
                  <td>{a.firm || '—'}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(a)} className="btn btn-outline btn-sm" data-testid={`btn-edit-architect-${a.id}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(a)} className="btn btn-danger btn-sm" data-testid={`btn-delete-architect-${a.id}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Architect' : 'New Architect'} testId="architect-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} data-testid="architect-form-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} data-testid="architect-form-phone" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} data-testid="architect-form-email" />
            </div>
          </div>
          <div>
            <label className="label">Firm</label>
            <input className="input" value={form.firm} onChange={(e) => update('firm', e.target.value)} data-testid="architect-form-firm" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="architect-form-save">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ArchitectsPage;
