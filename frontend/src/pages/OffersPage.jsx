import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { formatINR, formatDate } from '../lib/format';
import {
  Plus, Pencil, Trash2, FileText, Copy, CheckCircle2, XCircle, Clock,
  ArrowRight, Search, Folder,
} from 'lucide-react';

const OFFER_TYPES = ['RCC', 'Steel', 'Audit', 'PMC', 'Retrofitting', 'Other'];
const STATUS_FILTERS = ['All', 'Pending', 'Accepted', 'Rejected'];

const emptyOffer = {
  offer_type: 'RCC',
  custom_type: '',
  client_id: '',
  description: '',
  site_location: '',
  base_amount: 0,
  gst_percent: 18,
  file_path: '',
  status: 'Pending',
  offer_date: new Date().toISOString().slice(0, 10),
  reference_no: '',
  notes: '',
};

const typeColor = (t) => {
  const k = (t || '').toLowerCase();
  if (k === 'rcc') return { bg: '#E0F2FE', fg: '#075985', bd: '#7DD3FC' };
  if (k === 'steel') return { bg: '#F3F4F6', fg: '#374151', bd: '#9CA3AF' };
  if (k === 'audit') return { bg: '#FEF3C7', fg: '#92400E', bd: '#FCD34D' };
  if (k === 'pmc') return { bg: '#EDE9FE', fg: '#5B21B6', bd: '#C4B5FD' };
  return { bg: '#D1FAE5', fg: '#065F46', bd: '#34D399' }; // default green for custom
};

const statusBadge = (s) => {
  if (s === 'Accepted') return { cls: 'badge-settled', icon: CheckCircle2 };
  if (s === 'Rejected') return { cls: '', style: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }, icon: XCircle };
  return { cls: 'badge-outstanding', icon: Clock };
};

const OffersPage = () => {
  const [offers, setOffers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOffer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search) params.search = search;
      const [o, c] = await Promise.all([api.get('/offers', { params }), api.get('/clients')]);
      setOffers(o.data);
      setClients(c.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyOffer, offer_date: new Date().toISOString().slice(0, 10) });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({
      offer_type: OFFER_TYPES.includes(o.offer_type) ? o.offer_type : 'Other',
      custom_type: o.custom_type || (OFFER_TYPES.includes(o.offer_type) ? '' : o.effective_type),
      client_id: o.client_id || '',
      description: o.description || '',
      site_location: o.site_location || '',
      base_amount: o.base_amount || 0,
      gst_percent: o.gst_percent || 18,
      file_path: o.file_path || '',
      status: o.status || 'Pending',
      offer_date: o.offer_date ? o.offer_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      reference_no: o.reference_no || '',
      notes: o.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.offer_type) return setError('Offer type is required');
    if (form.offer_type === 'Other' && !form.custom_type.trim()) return setError('Please enter the custom type');
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_amount: parseFloat(form.base_amount || 0),
        gst_percent: parseFloat(form.gst_percent || 0),
        offer_date: form.offer_date ? new Date(form.offer_date).toISOString() : null,
      };
      if (editing) await api.put(`/offers/${editing.id}`, payload);
      else await api.post('/offers', payload);
      setModalOpen(false);
      showToast(editing ? 'Offer updated' : 'Offer created');
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (o) => {
    if (!window.confirm(`Delete offer ${o.offer_code}? This cannot be undone.`)) return;
    try {
      await api.delete(`/offers/${o.id}`);
      showToast('Offer deleted');
      load();
    } catch { showToast('Delete failed', 'error'); }
  };

  const handleConvert = async (o) => {
    if (!window.confirm(`Convert offer ${o.offer_code} to a Project?\n\nThis will create a new project with quoted amount ${formatINR(o.total_amount)} (GST inclusive) and mark the offer as Accepted.`)) return;
    try {
      const r = await api.post(`/offers/${o.id}/convert-to-project`);
      showToast(`Project ${r.data.project_code} created!`);
      load();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Convert failed', 'error');
    }
  };

  const copyPath = (path) => {
    if (!path) return;
    navigator.clipboard?.writeText(path);
    showToast('Path copied to clipboard');
  };

  // Live GST preview in form
  const base = parseFloat(form.base_amount || 0);
  const gst = parseFloat(form.gst_percent || 0);
  const gstAmt = (base * gst) / 100;
  const grand = base + gstAmt;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="offers-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Offers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Track proposals before they become projects. Convert accepted offers to projects with one click.</p>
        </div>
        <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-offer"><Plus size={15}/> New Offer</button>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex gap-2 items-center flex-wrap" data-testid="offers-filters">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
              data-testid={`filter-${s}`}
            >{s}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex-1 flex gap-2 min-w-[250px]">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by offer ID, reference, client, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="offers-search-input"
            />
          </div>
          <button type="submit" className="btn btn-accent">Search</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="offers-table">
            <thead>
              <tr>
                <th>Offer ID</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Client</th>
                <th>Description</th>
                <th className="text-right">Base (₹)</th>
                <th className="text-right">Total incl. GST (₹)</th>
                <th>Status</th>
                <th>File</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading offers...</td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <FileText size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-head font-semibold" style={{ color: 'var(--cc-dark-green)' }}>No offers yet</div>
                  <div className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>Create your first offer to get started.</div>
                  <button onClick={openNew} className="btn btn-primary inline-flex"><Plus size={14}/> New Offer</button>
                </td></tr>
              ) : offers.map((o) => {
                const tc = typeColor(o.effective_type);
                const sb = statusBadge(o.status);
                const StatusIcon = sb.icon;
                return (
                <tr key={o.id} data-testid={`offer-row-${o.offer_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{o.offer_code}</td>
                  <td>
                    <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: tc.bg, color: tc.fg, border: `1px solid ${tc.bd}` }}>
                      {o.effective_type}
                    </span>
                  </td>
                  <td className="text-xs font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>{o.reference_no || '—'}</td>
                  <td className="text-sm">{o.client_name || <span className="text-gray-400">—</span>}</td>
                  <td className="max-w-[240px]"><div className="line-clamp-2 text-xs">{o.description || '—'}</div></td>
                  <td className="num">{formatINR(o.base_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold">{formatINR(o.total_amount, { withSymbol: false })}</td>
                  <td>
                    <span className={`badge ${sb.cls || ''}`} style={sb.style || {}}>
                      <StatusIcon size={10}/> {o.status}
                    </span>
                    {o.linked_project_code && (
                      <div className="text-[10px] mt-1" style={{ color: 'var(--cc-accent)' }}>
                        → <Link to={`/projects/${o.linked_project_id}`} className="link-underline font-mono-data">{o.linked_project_code}</Link>
                      </div>
                    )}
                  </td>
                  <td>
                    {o.file_path ? (
                      <button
                        onClick={() => copyPath(o.file_path)}
                        className="text-xs inline-flex items-center gap-1 link-underline"
                        title={`Copy path: ${o.file_path}`}
                        data-testid={`copy-path-${o.offer_code}`}
                      >
                        <Folder size={11}/> Copy
                      </button>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      {!o.linked_project_id && o.status !== 'Rejected' && (
                        <button onClick={() => handleConvert(o)} className="btn btn-accent btn-sm" title="Convert to Project" data-testid={`btn-convert-${o.offer_code}`}>
                          <ArrowRight size={13}/> Convert
                        </button>
                      )}
                      <button onClick={() => openEdit(o)} className="btn btn-outline btn-sm" data-testid={`btn-edit-offer-${o.offer_code}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(o)} className="btn btn-danger btn-sm" data-testid={`btn-delete-offer-${o.offer_code}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Offer ${editing.offer_code}` : 'New Offer'} testId="offer-modal" maxWidth="640px">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Offer Type *</label>
              <select className="select" value={form.offer_type} onChange={(e) => update('offer_type', e.target.value)} data-testid="offer-form-type">
                {OFFER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.offer_type === 'Other' ? (
              <div>
                <label className="label">Custom Type *</label>
                <input className="input" value={form.custom_type} onChange={(e) => update('custom_type', e.target.value)} placeholder="e.g. Peer Review" data-testid="offer-form-custom-type" />
              </div>
            ) : (
              <div>
                <label className="label">Reference No.</label>
                <input className="input" value={form.reference_no} onChange={(e) => update('reference_no', e.target.value)} placeholder="STR/AUDIT/2026/023" data-testid="offer-form-ref" />
              </div>
            )}
          </div>

          {form.offer_type === 'Other' && (
            <div>
              <label className="label">Reference No.</label>
              <input className="input" value={form.reference_no} onChange={(e) => update('reference_no', e.target.value)} placeholder="STR/OTH/2026/001" />
            </div>
          )}

          <div>
            <label className="label">Client</label>
            <select className="select" value={form.client_id} onChange={(e) => update('client_id', e.target.value)} data-testid="offer-form-client">
              <option value="">-- Select a client --</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Description / Scope</label>
            <textarea className="textarea" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="e.g. RCC-Basic-Audit with NDT tests (Rebound Hammer, UPV...)" data-testid="offer-form-desc" />
          </div>

          <div>
            <label className="label">Site Location</label>
            <input className="input" value={form.site_location} onChange={(e) => update('site_location', e.target.value)} placeholder="Plot/Sector/City" data-testid="offer-form-site" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Base Amount (₹)</label>
              <input type="number" step="0.01" className="input" value={form.base_amount} onChange={(e) => update('base_amount', e.target.value)} data-testid="offer-form-base" />
            </div>
            <div>
              <label className="label">GST %</label>
              <input type="number" step="0.01" className="input" value={form.gst_percent} onChange={(e) => update('gst_percent', e.target.value)} data-testid="offer-form-gst" />
            </div>
            <div>
              <label className="label">Offer Date</label>
              <input type="date" className="input" value={form.offer_date} onChange={(e) => update('offer_date', e.target.value)} data-testid="offer-form-date" />
            </div>
          </div>

          {/* Live GST preview */}
          <div className="rounded-lg p-3 text-sm grid grid-cols-3 gap-2" style={{ background: 'var(--cc-surface)' }}>
            <div><span className="text-gray-500 text-xs">Base</span><div className="font-mono-data font-semibold">{formatINR(base)}</div></div>
            <div><span className="text-gray-500 text-xs">GST ({gst}%)</span><div className="font-mono-data font-semibold">{formatINR(gstAmt)}</div></div>
            <div><span className="text-gray-500 text-xs">Grand Total</span><div className="font-mono-data font-bold" style={{ color: 'var(--cc-dark-green)' }}>{formatINR(grand)}</div></div>
          </div>

          <div>
            <label className="label">File Path (where saved on your PC)</label>
            <div className="relative">
              <Folder size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                className="input pl-8 font-mono-data text-xs"
                value={form.file_path}
                onChange={(e) => update('file_path', e.target.value)}
                placeholder="D:\CreatorConsultant\Offers\2026\STR-AUDIT-2026-023.pdf"
                data-testid="offer-form-path"
              />
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--cc-text-muted)' }}>Paste the full path. You can copy it back anytime from the list.</div>
          </div>

          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)} data-testid="offer-form-status">
              <option value="Pending">Pending</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} data-testid="offer-form-notes" />
          </div>

          {error && <div className="text-sm text-red-600" data-testid="offer-form-error">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--cc-border)' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="offer-form-save">{saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Offer')}</button>
          </div>
        </form>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50"
          style={{ background: toast.type === 'error' ? '#DC2626' : 'var(--cc-dark-green)', color: '#fff' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default OffersPage;
