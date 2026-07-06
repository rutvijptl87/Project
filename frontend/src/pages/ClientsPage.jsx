import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUndo } from '../lib/undo';
import Modal from '../components/Modal';
import { Plus, Pencil, Trash2, Users, Phone, Mail, Search, Upload, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

const GST_STATE_CODES = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

const formatPlaceOfSupply = (pos, gstin) => {
  let code = pos;
  if (!code && gstin && gstin.length >= 2) {
    code = gstin.substring(0, 2);
  }
  if (!code) return '—';
  // Handle numbers that might be stored without leading zero
  const paddedCode = code.toString().padStart(2, '0');
  return GST_STATE_CODES[paddedCode] || code;
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const emptyClient = { name: '', phone: '', email: '', company: '', address: '', gstin: '', pan: '', place_of_supply: '', gst_type: '' };

const ClientsPage = () => {
  const { schedule } = useUndo();
  const [clients, setClients] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [fetchingGstin, setFetchingGstin] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 when search changes
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/clients/paginated', { params: { page, limit, q: debouncedSearch } });
      setClients(r.data.data);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [page, debouncedSearch]);

  const openNew = () => { setEditing(null); setForm(emptyClient); setError(''); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...c }); setError(''); setModalOpen(true); };
  const openView = (c) => { setViewing(c); setViewModalOpen(true); };
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFetchGSTIN = async () => {
    if (!form.gstin || !GSTIN_REGEX.test(form.gstin)) {
      toast.error('Invalid GSTIN format');
      setForm((prev) => ({ ...prev, name: '', company: '', pan: '', gst_type: '', place_of_supply: '', address: '' }));
      return;
    }
    setFetchingGstin(true);
    try {
      const { data } = await api.get(`/clients/verify-gstin/${form.gstin}`);
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        company: data.name || prev.company,
        pan: data.pan || prev.pan,
        gst_type: data.gst_type || prev.gst_type,
        place_of_supply: data.place_of_supply || prev.place_of_supply,
        address: data.principal_address || prev.address,
      }));
      toast.success('GSTIN details fetched successfully');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch GSTIN details');
      setForm((prev) => ({ ...prev, name: '', company: '', pan: '', gst_type: '', place_of_supply: '', address: '' }));
    } finally {
      setFetchingGstin(false);
    }
  };

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
        gstin: form.gstin || '',
        pan: form.pan || '',
        place_of_supply: form.place_of_supply || '',
        gst_type: form.gst_type || '',
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

  const handleBulkImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const r = await api.post('/clients/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { total_scanned, imported, skipped, duplicates_in_db, duplicates_in_file } = r.data;
      
      let html = `<div style="text-align: left; font-size: 14px;">
        <p><b>Total Scanned:</b> ${total_scanned}</p>
        <p><b>Successfully Imported:</b> <span style="color: green;">${imported}</span></p>
        <p><b>Total Skipped (Duplicates):</b> <span style="color: red;">${skipped}</span></p>`;
        
      if (duplicates_in_db?.length > 0) {
        html += `<div style="margin-top: 15px;">
          <strong>Duplicates found in Database:</strong>
          <ul style="max-height: 150px; overflow-y: auto; background: #f9fafb; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 13px;">
            ${duplicates_in_db.map(d => `<li>${d.name} ${d.gstin ? `(${d.gstin})` : ''}</li>`).join('')}
          </ul>
        </div>`;
      }

      if (duplicates_in_file?.length > 0) {
        html += `<div style="margin-top: 15px;">
          <strong>Duplicates found within the Excel file itself:</strong>
          <ul style="max-height: 150px; overflow-y: auto; background: #f9fafb; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 13px;">
            ${duplicates_in_file.map(d => `<li>${d.name} ${d.gstin ? `(${d.gstin})` : ''}</li>`).join('')}
          </ul>
        </div>`;
      }
      
      html += `</div>`;

      Swal.fire({
        title: 'Import Summary',
        html: html,
        icon: imported > 0 ? 'success' : 'info',
        width: '600px'
      });
      
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to import clients');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const visibleClients = useMemo(() => {
    return clients.filter((c) => !hiddenIds.has(c.id));
  }, [clients, hiddenIds]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="clients-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Manage your client directory ({clients.length} total).</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkImport} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importing}
            className="btn btn-outline" 
            data-testid="btn-bulk-import"
          >
            <Upload size={15}/> {importing ? 'Importing...' : 'Bulk Import'}
          </button>
          <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-client"><Plus size={15}/> New Client</button>
        </div>
      </div>

      <div className="mb-4 relative w-full sm:max-w-md">
        <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
        <input
          className="input pl-9 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients by name, company, phone, email, or address…"
          data-testid="clients-search-input"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="clients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th className="hidden sm:table-cell">Email</th>
                <th className="hidden lg:table-cell">GSTIN/UIN of Recipient</th>
                <th className="whitespace-nowrap">Place of Supply</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : visibleClients.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <Users size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{search ? `No clients match "${search}"` : 'No clients yet'}</div>
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
                  <td className="text-xs hidden sm:table-cell">{c.email ? <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{c.email}</a> : '—'}</td>
                  <td className="hidden lg:table-cell font-mono-data text-xs">{c.gstin || '—'}</td>
                  <td className="text-xs whitespace-nowrap">{formatPlaceOfSupply(c.place_of_supply, c.gstin)}</td>
                  <td>
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openView(c)} className="btn btn-outline btn-sm" data-testid={`btn-view-client-${c.id}`}><Eye size={13}/></button>
                      <button onClick={() => openEdit(c)} className="btn btn-outline btn-sm" data-testid={`btn-edit-client-${c.id}`}><Pencil size={13}/></button>
                      <button onClick={() => handleDelete(c)} className="btn btn-danger btn-sm" data-testid={`btn-delete-client-${c.id}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row-reverse justify-between items-center p-4 border-t gap-4" style={{ borderColor: 'var(--cc-border)' }}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="bg-black text-white px-3 py-1 rounded text-sm font-semibold min-w-[32px] text-center">
              {page}
            </div>
            <button 
              onClick={() => setPage(p => p + 1)} 
              disabled={page * limit >= total}
              className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} testId="client-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">GSTIN / UIN</label>
              <div className="flex gap-2">
                <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} placeholder="e.g. 27AAAAA0000A1Z5" data-testid="client-form-gstin" maxLength={15} />
                <button type="button" onClick={handleFetchGSTIN} disabled={fetchingGstin || !form.gstin} className="btn btn-outline whitespace-nowrap">
                  {fetchingGstin ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">PAN Number</label>
              <input className="input" value={form.pan} onChange={(e) => update('pan', e.target.value)} placeholder="e.g. AAAAA0000A" data-testid="client-form-pan" />
            </div>
          </div>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. John Doe" data-testid="client-form-name" />
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
            <input className="input" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="e.g. Acme Corp" data-testid="client-form-company" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">GST Type</label>
              <input className="input" value={form.gst_type || ''} onChange={(e) => update('gst_type', e.target.value)} placeholder="e.g. Regular" data-testid="client-form-gst-type" />
            </div>
            <div>
              <label className="label">Place of Supply</label>
              <input className="input" value={form.place_of_supply} onChange={(e) => update('place_of_supply', e.target.value)} placeholder="e.g. 27 or Maharashtra" data-testid="client-form-pos" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="textarea" rows={2} value={form.address || ''} onChange={(e) => update('address', e.target.value)} placeholder="e.g. 123 Main St, City, State, ZIP" data-testid="client-form-address" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="client-form-save">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Client Details" testId="view-client-modal">
        {viewing && (
          <div className="space-y-4 text-sm mt-2">
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Name</div>
                <div className="font-medium">{viewing.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Company</div>
                <div>{viewing.company || '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Phone</div>
                <div>{viewing.phone || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Email</div>
                <div>{viewing.email || '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>GSTIN / UIN</div>
                <div className="font-mono-data">{viewing.gstin || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>PAN Number</div>
                <div className="font-mono-data">{viewing.pan || '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>GST Type</div>
                <div>{viewing.gst_type || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Place of Supply</div>
                <div>{formatPlaceOfSupply(viewing.place_of_supply, viewing.gstin)}</div>
              </div>
            </div>
            <div className="border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>Address</div>
              <div className="whitespace-pre-wrap leading-relaxed">{viewing.address || '—'}</div>
            </div>
            <div className="flex justify-end pt-4">
              <button type="button" onClick={() => setViewModalOpen(false)} className="btn btn-outline">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClientsPage;
