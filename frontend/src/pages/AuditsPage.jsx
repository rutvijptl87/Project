import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { formatINR } from '../lib/format';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import InlinePicker from '../components/InlinePicker';
import { logger } from '../lib/logger';
import {
  Plus, Search, Eye, Pencil, Trash2, IndianRupee, FileText, Archive, ArchiveRestore,
  ArrowUpDown, ArrowUp, ArrowDown, Phone, Mail, ClipboardCheck,
} from 'lucide-react';

const SORTABLE_COLUMNS = {
  audit_offer: 'Audit Offer Number',
  report_id: 'Report ID',
  client_name: 'Name',
  total_amount: 'Total',
  received_amount: 'Received',
  outstanding_amount: 'Outstanding',
  status: 'Status',
};

const emptyAudit = {
  audit_code: '',
  audit_offer: '',
  report_id: '',
  client_id: '',
  client_name_override: '',
  client_phone_override: '',
  client_email_override: '',
  total_amount: '',
  status: 'Outstanding',
  notes: '',
  file_path: '',
};

const AuditsPage = () => {
  const { schedule } = useUndo();
  const [audits, setAudits] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [hiddenIds, setHiddenIds] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAudit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payAuditId, setPayAuditId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (showArchived) params.archived = true;
      const [a, c] = await Promise.all([
        api.get('/audits', { params }),
        api.get('/clients'),
      ]);
      setAudits(a.data);
      setClients(c.data);
    } catch (e) { logger.error('Audits load failed:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showArchived]);

  const sortedAudits = useMemo(() => {
    const visible = audits.filter((a) => !hiddenIds.has(a.id));
    const arr = [...visible];
    arr.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [audits, sortBy, sortDir, hiddenIds]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="inline ml-1 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />;
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyAudit);
    setFormError('');
    setModalOpen(true);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      audit_code: a.audit_code || '',
      audit_offer: a.audit_offer || '',
      report_id: a.report_id || '',
      client_id: a.client_id || '',
      client_name_override: a.client_name_override || '',
      client_phone_override: a.client_phone_override || '',
      client_email_override: a.client_email_override || '',
      total_amount: a.total_amount != null ? String(a.total_amount) : '',
      status: a.status || 'Outstanding',
      notes: a.notes || '',
      file_path: a.file_path || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        audit_code: (form.audit_code || '').trim(),
        audit_offer: form.audit_offer.trim(),
        report_id: (form.report_id || '').trim(),
        client_id: form.client_id || null,
        client_name_override: (form.client_name_override || '').trim(),
        client_phone_override: (form.client_phone_override || '').trim(),
        client_email_override: (form.client_email_override || '').trim(),
        total_amount: parseFloat(form.total_amount) || 0,
        status: form.status || 'Outstanding',
        notes: form.notes || '',
        file_path: (form.file_path || '').trim(),
      };
      if (editing) await api.put(`/audits/${editing.id}`, payload);
      else await api.post('/audits', payload);
      setModalOpen(false);
      showToast(editing ? 'Audit updated' : 'Audit created');
      load();
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (a) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE audit ${a.audit_code}?\n\nThis will also delete all its payments and activity history.\n\nYou can undo within 60 seconds.`)) return;
    setHiddenIds((prev) => new Set([...prev, a.id]));
    schedule({
      label: `Audit ${a.audit_code} deleted`,
      onCommit: async () => {
        try {
          await api.delete(`/audits/${a.id}`);
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
          load();
        } catch {
          setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
          showToast('Delete failed', 'error');
        }
      },
      onUndo: () => {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(a.id); return n; });
        showToast(`Audit ${a.audit_code} restored`);
      },
    });
  };

  const handleArchive = async (a) => {
    if (!window.confirm(`Archive audit ${a.audit_code}? It will be hidden from the main list but can be restored.`)) return;
    try { await api.post(`/audits/${a.id}/archive`); showToast('Audit archived'); load(); }
    catch { showToast('Failed to archive', 'error'); }
  };

  const handleUnarchive = async (a) => {
    try { await api.post(`/audits/${a.id}/unarchive`); showToast(`Audit ${a.audit_code} restored`); load(); }
    catch { showToast('Failed to restore', 'error'); }
  };

  const openPay = (id) => { setPayAuditId(id); setPayOpen(true); };
  const downloadInvoice = (id) => downloadFile(`${API}/audits/${id}/invoice`);

  const contactCell = (a) => (
    <div className="text-xs space-y-0.5">
      {a.client_phone ? (
        <a href={`tel:${a.client_phone}`} className="inline-flex items-center gap-1 link-underline"><Phone size={11}/>{a.client_phone}</a>
      ) : null}
      {a.client_email ? (
        <a href={`mailto:${a.client_email}`} className="inline-flex items-center gap-1 link-underline"><Mail size={11}/>{a.client_email}</a>
      ) : null}
      {!a.client_phone && !a.client_email && <span className="text-gray-400">—</span>}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="audits-page">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>Audits</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Track structural audits, reports and payments ({audits.length} total).</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowArchived(v => !v)}
            className={`btn btn-outline ${showArchived ? 'opacity-90' : ''}`}
            data-testid="btn-toggle-archived-audits"
          >
            <Archive size={14}/> {showArchived ? 'Viewing Archived — Show Active' : 'Show Archived'}
          </button>
          <button onClick={openNew} className="btn btn-primary" data-testid="btn-new-audit"><Plus size={15}/> New Audit</button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 flex gap-2 flex-wrap" data-testid="audits-search-form">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by audit code, offer, report ID, client..."
            data-testid="audits-search-input"
          />
        </div>
        <button className="btn btn-outline" type="submit" data-testid="audits-search-btn">Search</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="audits-table">
            <thead>
              <tr>
                {Object.entries(SORTABLE_COLUMNS).map(([k, label]) => (
                  <th key={k} className="cursor-pointer select-none" onClick={() => toggleSort(k)} data-testid={`audit-sort-${k}`}>
                    {label}<SortIcon col={k}/>
                  </th>
                ))}
                <th>Contact</th>
                <th>Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading...</td></tr>
              ) : sortedAudits.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <ClipboardCheck size={32} className="mx-auto mb-2 text-gray-400"/>
                  <div className="font-semibold">{showArchived ? 'No archived audits' : 'No audits yet'}</div>
                  <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Create your first audit to get started.</div>
                </td></tr>
              ) : sortedAudits.map((a) => (
                <tr key={a.id} data-testid={`audit-row-${a.audit_code}`}>
                  <td className="font-medium"><Link to={`/audits/${a.id}`} className="link-underline" data-testid={`audit-offer-link-${a.audit_code}`}>{a.audit_offer || '—'}</Link></td>
                  <td className="font-mono-data text-xs">{a.report_id || '—'}</td>
                  <td>{a.client_name ? <Link to={`/clients/${a.client_id}`} className="link-underline">{a.client_name}</Link> : <span className="text-gray-400">—</span>}</td>
                  <td className="font-mono-data text-sm">{formatINR(a.total_amount)}</td>
                  <td className="font-mono-data text-sm" style={{ color: '#92400E' }}>{formatINR(a.received_amount)}</td>
                  <td className="font-mono-data text-sm font-semibold" style={{ color: a.outstanding_amount > 0 ? '#DC2626' : '#065F46' }}>{formatINR(a.outstanding_amount)}</td>
                  <td>
                    <span className={`badge ${a.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{a.status}</span>
                  </td>
                  <td>{contactCell(a)}</td>
                  <td className="text-xs max-w-[160px]"><div className="line-clamp-2">{a.notes || '—'}</div></td>
                  <td>
                    <div className="flex gap-1 justify-end flex-wrap">
                      <Link to={`/audits/${a.id}`} className="btn btn-outline btn-sm" title="View details" data-testid={`btn-view-audit-${a.audit_code}`}><Eye size={13}/></Link>
                      <button onClick={() => downloadInvoice(a.id)} className="btn btn-outline btn-sm" title="Download Invoice PDF" data-testid={`btn-invoice-audit-${a.audit_code}`}><FileText size={13}/></button>
                      {!a.archived && (
                        <button onClick={() => openPay(a.id)} className="btn btn-accent btn-sm" title="Record Payment" data-testid={`btn-pay-audit-${a.audit_code}`}><IndianRupee size={13}/> Pay</button>
                      )}
                      <button onClick={() => openEdit(a)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-edit-audit-${a.audit_code}`}><Pencil size={13}/></button>
                      {a.archived ? (
                        <button onClick={() => handleUnarchive(a)} className="btn btn-outline btn-sm" title="Restore" data-testid={`btn-restore-audit-${a.audit_code}`}><ArchiveRestore size={13}/></button>
                      ) : (
                        <button onClick={() => handleArchive(a)} className="btn btn-outline btn-sm" title="Archive" data-testid={`btn-archive-audit-${a.audit_code}`}><Archive size={13}/></button>
                      )}
                      <button onClick={() => handleDelete(a)} className="btn btn-danger btn-sm" title="Delete permanently" data-testid={`btn-delete-audit-${a.audit_code}`}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Audit ${editing.audit_code}` : 'New Audit'} testId="audit-modal">
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">Report ID</label>
            <input className="input font-mono-data" value={form.report_id} onChange={(e) => update('report_id', e.target.value)} placeholder={`Auto (RPT-${new Date().getFullYear()}-001) — or type custom`} data-testid="audit-form-report-id" />
          </div>
          <div>
            <label className="label">Audit Offer Number</label>
            <input
              className="input font-mono-data"
              value={form.audit_offer}
              onChange={(e) => update('audit_offer', e.target.value)}
              placeholder="Type Audit Offer Number (e.g. STR/AUD-OFR/2026/007)"
              data-testid="audit-form-offer"
            />
            <div className="text-[11px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
              Enter the Audit Offer Number manually.
            </div>
          </div>
          <div>
            <label className="label">Name (Client)</label>
            <InlinePicker
              entityType="client"
              value={form.client_id}
              onChange={(v) => update('client_id', v)}
              items={clients}
              onItemsChange={setClients}
              testIdPrefix="audit-form-client-"
            />
            <div className="text-[11px] mt-1" style={{ color: 'var(--cc-text-muted)' }}>
              Pick an existing client OR leave blank and fill the fields below to record a one-off contact for this audit.
            </div>
          </div>

          {/* Direct contact fields — override the linked client's contact, or
              record an ad-hoc contact when no client is selected. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Client Name</label>
              <input
                className="input"
                value={form.client_name_override}
                onChange={(e) => update('client_name_override', e.target.value)}
                placeholder="e.g. Vijay Mishra"
                data-testid="audit-form-client-name"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={form.client_phone_override}
                onChange={(e) => update('client_phone_override', e.target.value)}
                placeholder="+91 98xxxxxxxx"
                data-testid="audit-form-client-phone"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.client_email_override}
                onChange={(e) => update('client_email_override', e.target.value)}
                placeholder="name@example.com"
                data-testid="audit-form-client-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Total Amount (₹)</label>
              <input type="number" step="0.01" className="input" value={form.total_amount} onChange={(e) => update('total_amount', e.target.value)} placeholder="0.00" data-testid="audit-form-total" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => update('status', e.target.value)} data-testid="audit-form-status">
                <option value="Outstanding">Outstanding</option>
                <option value="Settled">Settled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="textarea" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Initial site visit completed, half-cell test pending, etc." data-testid="audit-form-notes" />
          </div>
          <div>
            <label className="label">File Path <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(path of the audit report PDF / Excel on your PC)</span></label>
            <input
              className="input font-mono-data text-xs"
              value={form.file_path}
              onChange={(e) => update('file_path', e.target.value)}
              placeholder={`e.g. D:\\CreatorConsultant\\Audits\\2026\\STR-AUDIT-2026-006.pdf`}
              data-testid="audit-form-file-path"
            />
          </div>
          {formError && <div className="text-sm text-red-600" data-testid="audit-form-error">{formError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid="audit-form-save">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      <RecordPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        entityType="audit"
        defaultAuditId={payAuditId}
        onSaved={() => { load(); showToast('Payment recorded'); }}
      />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
          style={toast.type === 'error'
            ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="audit-toast"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AuditsPage;
