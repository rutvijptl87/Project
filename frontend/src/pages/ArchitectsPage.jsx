import React, { useEffect, useMemo, useState } from 'react';
import Pagination from '../components/Pagination';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUndo } from '../lib/undo';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Compass, Phone, Mail, Search , X } from 'lucide-react';
import { toast } from 'react-toastify';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

const GST_STATE_CODES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh (Old)",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

const formatPlaceOfSupply = (pos, gstin) => {
  let code = pos;
  if (!code && gstin && gstin.length >= 2) {
    code = gstin.substring(0, 2);
  }
  if (!code) return '—';
  const paddedCode = code.toString().padStart(2, '0');
  return GST_STATE_CODES[paddedCode] || code;
};

const emptyA = { name: '', phone: '', email: '', firm: '', address: '', gstin: '', pan: '', place_of_supply: '' };

const ArchitectsPage = () => {
  const { schedule } = useUndo();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetchingGstin, setFetchingGstin] = useState(false);

  const handleFetchGSTIN = async () => {
    if (!form.gstin || !GSTIN_REGEX.test(form.gstin)) {
      toast.error('Invalid GSTIN format');
      return;
    }
    setFetchingGstin(true);
    try {
      const { data } = await api.get(`/clients/verify-gstin/${form.gstin}`);
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        firm: data.name || prev.firm,
        pan: data.pan || prev.pan,
        place_of_supply: data.place_of_supply || prev.place_of_supply,
        address: data.principal_address || prev.address,
      }));
      toast.success('GSTIN details fetched successfully');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch GSTIN details');
    } finally {
      setFetchingGstin(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try { 
      const r = await api.get('/architects/paginated', { params: { page, limit, q: debouncedSearch } }); 
      setItems(r.data.data || []); 
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally { 
      setLoading(false); 
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearch]);

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
        address: form.address || '', gstin: form.gstin || '', pan: form.pan || '', place_of_supply: form.place_of_supply || ''
      };
      if (editing) await api.put(`/architects/${editing.id}`, payload);
      else await api.post('/architects', payload);
      setModalOpen(false);
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to save';
      setError(detail);
    } finally { setSaving(false); }
  };

  const handleDelete = (a) => {
    
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

  const visibleItems = useMemo(() => {
    return items.filter((a) => !hiddenIds.has(a.id));
  }, [items, hiddenIds]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="architects-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Architects</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Manage architect contacts ({total} total).</p>
        </div>
        <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-architect"><Plus size={15}/> New Architect</button>
      </div>

      <div className="mb-4 relative w-full sm:max-w-md">
        <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
        <input
          className="input pl-9 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search architects by name, firm, phone, or email…"
          data-testid="architects-search-input"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="architects-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="hidden sm:table-cell">Email</th>
                <th className="hidden md:table-cell">Firm</th>
                <th className="hidden lg:table-cell">GSTIN/UIN of Recipient</th>
                <th className="whitespace-nowrap">Place of Supply</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : visibleItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <Compass size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{search ? `No architects match "${search}"` : 'No architects yet'}</div>
                </td></tr>
              ) : visibleItems.map((a) => (
                <tr key={a.id} data-testid={`architect-row-${a.id}`}>
                  <td className="font-medium">
                    <Link to={`/architects/${a.id}`} className="link-underline hover:opacity-80" data-testid={`architect-link-${a.id}`}>
                      {a.name}
                    </Link>
                  </td>
                  <td className="font-mono-data text-xs">{a.phone ? <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1"><Phone size={11}/>{a.phone}</a> : '—'}</td>
                  <td className="text-xs hidden sm:table-cell">{a.email ? <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{a.email}</a> : '—'}</td>
                  <td className="hidden md:table-cell">{a.firm || '—'}</td>
                  <td className="hidden lg:table-cell font-mono-data text-xs">{a.gstin || '—'}</td>
                  <td className="text-xs whitespace-nowrap">{formatPlaceOfSupply(a.place_of_supply, a.gstin)}</td>
                  <td>
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(a)} className="btn btn-outline btn-sm" data-testid={`btn-edit-architect-${a.id}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(a)} className="btn btn-danger btn-sm" data-testid={`btn-delete-architect-${a.id}`}><Trash2 size={13}/></button>
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
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} data-testid="architect-form-address" placeholder="e.g. 123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">GSTIN</label>
              <div className="flex gap-2">
                <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} data-testid="architect-form-gstin" placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} />
                <button type="button" onClick={handleFetchGSTIN} disabled={fetchingGstin || !form.gstin} className="btn btn-outline whitespace-nowrap">
                  {fetchingGstin ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">PAN</label>
              <input className="input" value={form.pan} onChange={(e) => update('pan', e.target.value)} data-testid="architect-form-pan" placeholder="e.g. AAAAA0000A" />
            </div>
          </div>
          <div>
            <label className="label">Place of Supply (Code or State)</label>
            <input className="input" value={form.place_of_supply} onChange={(e) => update('place_of_supply', e.target.value)} data-testid="architect-form-pos" placeholder="e.g. 27 or Maharashtra" />
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
