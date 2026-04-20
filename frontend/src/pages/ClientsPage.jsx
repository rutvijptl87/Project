import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUndo } from '../lib/undo';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Users, Phone, Mail } from 'lucide-react';

const emptyClient = { name: '', phone: '', email: '', company: '', address: '' };

const ClientsPage = () => {
  const { schedule } = useUndo();
  const [clients, setClients] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/clients');
      setClients(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyClient); setError(''); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...c }); setError(''); setModalOpen(true); };
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone || '',
        email: form.email || '',
        company: form.company || '',
        address: form.address || '',
      };
      if (editing) await api.put(`/clients/${editing.id}`, payload);
      else await api.post('/clients', payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (c) => {
    if (!window.confirm(`Are you sure you want to delete client "${c.name}"?\n\nAny projects linked to them will be unlinked (but not deleted).\n\nYou can undo within 60 seconds.`)) return;
    setHiddenIds((prev) => new Set([...prev, c.id]));
    schedule({
      label: `Client ${c.name} deleted`,
      onCommit: async () => {
        try {
          await api.delete(`/clients/${c.id}`);
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
          load();
        } catch {
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
        }
      },
      onUndo: () => {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
      },
    });
  };

  const visibleClients = clients.filter((c) => !hiddenIds.has(c.id));

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="clients-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Manage your client directory ({clients.length} total).</p>
        </div>
        <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-client"><Plus size={15}/> New Client</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="clients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Company</th>
                <th>Address</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : visibleClients.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <Users size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">No clients yet</div>
                  <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Add your first client to get started.</div>
                </td></tr>
              ) : visibleClients.map((c) => (
                <tr key={c.id} data-testid={`client-row-${c.id}`}>
                  <td className="font-medium">
                    <Link to={`/clients/${c.id}`} className="link-underline hover:opacity-80" data-testid={`client-link-${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="font-mono-data text-xs">{c.phone ? <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1"><Phone size={11}/>{c.phone}</a> : '—'}</td>
                  <td className="text-xs">{c.email ? <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{c.email}</a> : '—'}</td>
                  <td>{c.company || '—'}</td>
                  <td className="text-xs max-w-[200px]"><div className="line-clamp-2">{c.address || '—'}</div></td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(c)} className="btn btn-outline btn-sm" data-testid={`btn-edit-client-${c.id}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(c)} className="btn btn-danger btn-sm" data-testid={`btn-delete-client-${c.id}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} testId="client-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} data-testid="client-form-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98xxx xxxxx" data-testid="client-form-phone" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="client@example.com" data-testid="client-form-email" />
            </div>
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" value={form.company} onChange={(e) => update('company', e.target.value)} data-testid="client-form-company" />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="textarea" rows={2} value={form.address} onChange={(e) => update('address', e.target.value)} data-testid="client-form-address" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="client-form-save">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClientsPage;
