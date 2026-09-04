import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { formatINR, formatDate, formatActivityDay } from '../lib/format';
import { downloadFile } from '../lib/download';
import { useUserDirectory } from '../lib/userDirectory';
import InitialsBadge from '../components/InitialsBadge';
import RecordPaymentModal from '../components/RecordPaymentModal';
import Modal from '../components/Modal';
import InlinePicker from '../components/InlinePicker';
import { logger } from '../lib/logger';
import {
  ArrowLeft, Pencil, Trash2, FileText, Download, Archive,
  Plus, CreditCard, ClipboardList, Clock, Phone, Mail, MessageCircle,
  StickyNote, Save, X, ClipboardCheck, FolderOpen, Copy, Check,
} from 'lucide-react';

const actionStyle = (action) => {
  const a = (action || '').toLowerCase();
  if (a.includes('created')) return { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' };
  if (a.includes('payment added')) return { background: '#E0F2FE', color: '#075985', border: '1px solid #7DD3FC' };
  if (a.includes('deleted')) return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' };
  if (a.includes('revised') || a.includes('updated')) return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
  if (a.includes('archived') || a.includes('restored')) return { background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD' };
  return { background: '#F3F4F6', color: '#374151', border: '1px solid #9CA3AF' };
};

const KpiCard = ({ label, value, color }) => (
  <div className="card p-5 text-center" style={{ borderLeft: `3px solid ${color}` }}>
    <div className="font-mono-data text-3xl font-bold" style={{ color }}>{value}</div>
    <div className="text-xs uppercase tracking-widest mt-2" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
  </div>
);

const AuditDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schedule } = useUndo();
  const { byUsername } = useUserDirectory();
  const [audit, setAudit] = useState(null);
  const [payments, setPayments] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [clients, setClients] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const [copiedOffer, setCopiedOffer] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Edit audit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Quote revision form
  const [newAmount, setNewAmount] = useState('');
  const [reviseReason, setReviseReason] = useState('');
  const [revising, setRevising] = useState(false);

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, pay, rev, act, c] = await Promise.all([
        api.get(`/audits/${id}`),
        api.get('/audit-payments', { params: { audit_id: id } }).catch(() => ({ data: [] })),
        api.get(`/audits/${id}/revisions`).catch(() => ({ data: [] })),
        api.get(`/audits/${id}/activity`).catch(() => ({ data: [] })),
        api.get('/clients').catch(() => ({ data: [] })),
      ]);
      setAudit(a.data);
      setPayments(pay.data || []);
      setRevisions(rev.data || []);
      setActivity(act.data || []);
      setClients(c.data || []);
    } catch (e) {
      logger.error('Failed to load audit:', e);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!audit) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;

  const copyToClipboard = (text, type) => {
    navigator.clipboard?.writeText(text).then(() => {
      if (type === 'offer') {
        setCopiedOffer(true);
        setTimeout(() => setCopiedOffer(false), 2000);
      } else {
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 2000);
      }
    }).catch(() => {});
  };

  const openEditModal = () => {
    setEditForm({
      audit_code: audit.audit_code || '',
      audit_offer: audit.audit_offer || '',
      report_id: audit.report_id || '',
      client_id: audit.client_id || '',
      client_name_override: audit.client_name_override || '',
      client_phone_override: audit.client_phone_override || '',
      client_email_override: audit.client_email_override || '',
      total_amount: audit.total_amount != null ? String(audit.total_amount) : '',
      status: audit.status || 'Outstanding',
      address: audit.address || '',
      audit_offer_path: audit.audit_offer_path || '',
      report_path: audit.report_path || audit.file_path || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const updateEditForm = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload = {
        audit_code: (editForm.audit_code || '').trim(),
        audit_offer: (editForm.audit_offer || '').trim(),
        report_id: (editForm.report_id || '').trim(),
        client_id: editForm.client_id || null,
        client_name_override: (editForm.client_name_override || '').trim(),
        client_phone_override: (editForm.client_phone_override || '').trim(),
        client_email_override: (editForm.client_email_override || '').trim(),
        total_amount: parseFloat(editForm.total_amount) || 0,
        status: editForm.status || 'Outstanding',
        address: editForm.address || '',
        audit_offer_path: (editForm.audit_offer_path || '').trim(),
        report_path: (editForm.report_path || '').trim(),
      };
      await api.put(`/audits/${id}`, payload);
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err?.response?.data?.detail || 'Failed to save audit');
    } finally {
      setEditSaving(false);
    }
  };

  const startEditAddress = () => { setAddressDraft(audit?.address || ''); setEditingNotes(true); };
  const cancelEditNotes = () => { setEditingNotes(false); setAddressDraft(''); };
  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.put(`/audits/${id}`, {
        ...audit,
        address: addressDraft,
      });
      setAudit((a) => ({ ...a, address: addressDraft }));
      setEditingNotes(false);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save address');
    } finally { setSavingNotes(false); }
  };

  const handleDelete = () => {
    const code = audit.audit_code;
    
    schedule({
      label: `Audit ${code} deleted`,
      onCommit: async () => { try { await api.delete(`/audits/${id}`); } catch (e) { logger.error('Audit delete failed:', e); } },
      onUndo: () => { /* nothing to restore — we navigated away before API */ },
    });
    navigate('/audits');
  };

  const handleArchive = async () => {
    
    await api.post(`/audits/${id}/archive`);
    navigate('/audits');
  };

  const downloadInvoice = () => downloadFile(`${API}/audits/${id}/invoice`);
  const downloadExcel = () => downloadFile(`${API}/audits/${id}/export`);
  const downloadReceipt = (paymentId) => downloadFile(`${API}/audit-payments/${paymentId}/receipt`);

  const handleDeletePayment = (paymentId) => {
    
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    schedule({
      label: 'Payment deleted',
      onCommit: async () => { try { await api.delete(`/audit-payments/${paymentId}`); load(); } catch { load(); } },
      onUndo: () => { load(); },
    });
  };

  const handleRevise = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!amt && amt !== 0) return;
    setRevising(true);
    try {
      await api.post(`/audits/${id}/revise-quote`, { new_amount: amt, reason: reviseReason });
      setNewAmount('');
      setReviseReason('');
      load();
    } finally { setRevising(false); }
  };

  const waLink = audit.client_phone
    ? `https://wa.me/${(audit.client_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hi ${audit.client_name || ''}, regarding our audit (${audit.audit_code}) — `
      )}`
    : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="audit-detail-page">
      <Link to="/audits" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3"><ArrowLeft size={14}/> Back to Audits</Link>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-head text-4xl font-extrabold flex items-center gap-2 flex-wrap" style={{ color: 'var(--cc-dark-green)' }} data-testid="audit-detail-name">
            <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
              <ClipboardCheck size={11} className="inline mr-1"/>AUDIT
            </span>
            {audit.audit_offer || 'Audit'}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm flex-wrap" style={{ color: 'var(--cc-text-muted)' }}>
            <span className="font-mono-data font-semibold" style={{ color: 'var(--cc-accent)' }} data-testid="audit-detail-code">{audit.audit_code}</span>
            {audit.report_id && <><span>·</span><span className="font-mono-data text-xs">Report: {audit.report_id}</span></>}
            <span>·</span>
            {audit.client_id ? (
              <Link to={`/clients/${audit.client_id}`} className="link-underline" data-testid="audit-detail-client-link">{audit.client_name}</Link>
            ) : <span className="text-gray-400">No client</span>}
            <span>·</span>
            <span>Created {formatDate(audit.created_at)}</span>
            {audit.last_edited_by_username && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5" data-testid="audit-detail-last-edited-by">
                  <span>Last edited by</span>
                  <InitialsBadge
                    username={audit.last_edited_by_username}
                    color={byUsername(audit.last_edited_by_username)?.color}
                    size="xs"
                  />
                  <span className="font-mono-data text-xs">{audit.last_edited_by_username}</span>
                  {audit.last_edited_at && <span>· {formatDate(audit.last_edited_at)}</span>}
                </span>
              </>
            )}
            <span className={`badge ml-2 ${audit.status === 'Confirm' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : audit.status === 'Cancelled' ? 'bg-gray-100 text-gray-800 border-gray-300' : audit.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{audit.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">
          <button onClick={downloadExcel} className="btn btn-outline" data-testid="audit-detail-btn-excel"><Download size={15}/> Export Excel</button>
          <button onClick={downloadInvoice} className="btn btn-outline" data-testid="audit-detail-btn-invoice"><FileText size={15}/> Invoice PDF</button>
          <button onClick={openEditModal} className="btn btn-outline" data-testid="audit-detail-btn-edit"><Pencil size={15}/> Edit</button>
          <button onClick={handleDelete} className="btn btn-danger" data-testid="audit-detail-btn-delete"><Trash2 size={15}/> Delete</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Amount" value={formatINR(audit.total_amount)} color="var(--cc-dark-green)" />
        <KpiCard label="Received" value={formatINR(audit.received_amount)} color="var(--cc-accent)" />
        <KpiCard label="Outstanding" value={formatINR(audit.outstanding_amount)} color="#DC2626" />
      </div>

      {/* Contact bar */}
      {(audit.client_phone || audit.client_email) && (
        <div className="card p-4 mb-6 flex items-center gap-6 flex-wrap text-sm" data-testid="audit-detail-contact-bar">
          {audit.client_name && (
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>Client</div>
              <div className="font-semibold">{audit.client_name}</div>
              <div className="flex gap-3 mt-1">
                {audit.client_phone && <a href={`tel:${audit.client_phone}`} className="text-xs inline-flex items-center gap-1 link-underline"><Phone size={11}/> {audit.client_phone}</a>}
                {audit.client_email && <a href={`mailto:${audit.client_email}`} className="text-xs inline-flex items-center gap-1 link-underline"><Mail size={11}/> {audit.client_email}</a>}
                {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 link-underline" data-testid="audit-detail-wa"><MessageCircle size={11}/> WhatsApp</a>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Offer Path */}
      {audit.audit_offer_path && (
        <div
          className="card p-3 mb-3 flex items-center justify-between gap-3 flex-wrap"
          data-testid="audit-detail-offer-path"
        >
          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-gray-500">Offer Path:</span>
            <FolderOpen size={14} style={{ color: 'var(--cc-accent)', flexShrink: 0 }}/>
            <span className="font-mono-data truncate" title={audit.audit_offer_path}>{audit.audit_offer_path}</span>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(audit.audit_offer_path, 'offer')}
            className="btn btn-outline btn-sm"
            title="Copy path"
            data-testid="audit-detail-copy-offer-path"
          >
            {copiedOffer ? <><Check size={12} className="text-emerald-600"/> Copied!</> : <><Copy size={12}/> Copy</>}
          </button>
        </div>
      )}

      {/* Report Path */}
      {(audit.report_path || audit.file_path) && (
        <div
          className="card p-3 mb-6 flex items-center justify-between gap-3 flex-wrap"
          data-testid="audit-detail-report-path"
        >
          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-gray-500">Report Path:</span>
            <FolderOpen size={14} style={{ color: 'var(--cc-accent)', flexShrink: 0 }}/>
            <span className="font-mono-data truncate" title={audit.report_path || audit.file_path}>{audit.report_path || audit.file_path}</span>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(audit.report_path || audit.file_path, 'report')}
            className="btn btn-outline btn-sm"
            title="Copy path"
            data-testid="audit-detail-copy-report-path"
          >
            {copiedReport ? <><Check size={12} className="text-emerald-600"/> Copied!</> : <><Copy size={12}/> Copy</>}
          </button>
        </div>
      )}

      {/* Address */}
      <div className="card p-5 mb-6" data-testid="audit-address-card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-head font-bold text-lg" style={{ color: 'var(--cc-dark-green)' }}>Address</h2>
          {!editingNotes && (
            <button onClick={startEditAddress} className="btn btn-outline btn-sm" data-testid="audit-btn-edit-address">
              <Pencil size={13}/> {audit.address ? 'Edit' : 'Add address'}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2" data-testid="audit-address-editor">
            <textarea 
              className="textarea" 
              rows={4} 
              value={addressDraft} 
              onChange={(e) => setAddressDraft(e.target.value)}
              placeholder="Site Location / Address..."
              data-testid="audit-address-textarea"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelEditNotes} className="btn btn-outline" data-testid="audit-btn-cancel-address"><X size={14}/> Cancel</button>
              <button onClick={saveNotes} disabled={savingNotes} className="btn btn-primary" data-testid="audit-btn-save-address">
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : audit.address ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--cc-text)' }} data-testid="audit-address-text">
            {audit.address}
          </div>
        ) : (
          <div className="text-sm italic" style={{ color: 'var(--cc-text-muted)' }} data-testid="audit-address-empty">
            No address yet. Click "Add address" to jot down the site location.
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="card mb-6 overflow-hidden" data-testid="audit-payments-card">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <CreditCard size={18}/> Payment Records ({payments.length})
          </h2>
          <button onClick={() => setShowPay(true)} className="btn btn-accent btn-sm" data-testid="audit-btn-add-payment"><Plus size={14}/> Add Payment</button>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="audit-payments-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th className="text-right">Amount (₹)</th>
                <th className="hidden sm:table-cell">Note</th>
                <th className="hidden md:table-cell">Date &amp; Time</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No payments yet.</td></tr>
              ) : payments.map((p, i) => (
                <tr key={p.id} data-testid={`audit-payment-row-${p.id}`}>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</td>
                  <td className="num font-semibold">{formatINR(p.amount, { withSymbol: false })}</td>
                  <td className="text-sm hidden sm:table-cell">{p.notes || '—'}</td>
                  <td className="text-xs font-mono-data hidden md:table-cell">{formatDate(p.payment_date)}</td>
                  <td>
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => downloadReceipt(p.id)} className="btn btn-outline btn-sm" data-testid={`audit-btn-receipt-${p.id}`}><Download size={12}/> Receipt</button>
                      <button onClick={() => handleDeletePayment(p.id)} className="btn btn-danger btn-sm" data-testid={`audit-btn-delete-payment-${p.id}`}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Revisions */}
      <div className="card mb-6 overflow-hidden" data-testid="audit-revisions-card">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <ClipboardList size={18}/> Quote Revisions ({revisions.length})
          </h2>
        </div>
        <form onSubmit={handleRevise} className="p-5 border-b grid md:grid-cols-[1fr_2fr_auto] gap-3" style={{ borderColor: 'var(--cc-border)' }} data-testid="audit-revise-form">
          <div>
            <label className="label">New Total Amount (₹)</label>
            <input type="number" step="0.01" className="input" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="e.g. 60000" data-testid="audit-revise-new-amount"/>
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input" value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} placeholder="e.g. Added rebound hammer test" data-testid="audit-revise-reason"/>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={revising || newAmount === ''} className="btn btn-accent w-full md:w-auto" data-testid="audit-btn-revise">
              {revising ? 'Saving...' : 'Revise Total'}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="audit-revisions-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th className="text-right hidden sm:table-cell">Old Amount (₹)</th>
                <th className="text-right">New Amount (₹)</th>
                <th className="hidden md:table-cell">Reason</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No revisions yet.</td></tr>
              ) : revisions.map((r, i) => (
                <tr key={r.id} data-testid={`audit-revision-row-${r.id}`}>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</td>
                  <td className="num hidden sm:table-cell">{formatINR(r.old_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{formatINR(r.new_amount, { withSymbol: false })}</td>
                  <td className="text-sm hidden md:table-cell">{r.reason || '—'}</td>
                  <td className="text-xs font-mono-data">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity */}
      <div className="card overflow-hidden" data-testid="audit-activity-card">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <Clock size={18}/> Activity History ({activity.length})
          </h2>
        </div>
        <div className="p-5 space-y-3" data-testid="audit-activity-list">
          {activity.length === 0 ? (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--cc-text-muted)' }}>No activity yet.</div>
          ) : activity.map((a) => {
            const u = byUsername(a.username);
            return (
              <div key={a.id} className="flex items-start gap-3" data-testid={`audit-activity-${a.id}`}>
                <InitialsBadge
                  username={a.username}
                  color={u?.color}
                  title={u ? `${u.username}${u.name ? ` (${u.name})` : ''} — ${a.action}` : (a.username || 'system')}
                  size="sm"
                  testId={`audit-activity-user-${a.id}`}
                />
                <span className="text-xs font-bold px-2 py-1 rounded whitespace-nowrap" style={actionStyle(a.action)}>{a.action}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.detail || <span className="text-gray-400">—</span>}</div>
                  <div className="text-xs font-mono-data mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{formatActivityDay(a.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Audit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Audit ${audit.audit_code}`} testId="audit-detail-edit-modal">
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div>
            <label className="label">Report ID</label>
            <input className="input font-mono-data" value={editForm.report_id || ''} onChange={(e) => updateEditForm('report_id', e.target.value)} placeholder="Report ID" data-testid="audit-detail-edit-report-id" />
          </div>
          <div>
            <label className="label">Audit Offer Number</label>
            <input
              className="input font-mono-data"
              value={editForm.audit_offer || ''}
              onChange={(e) => updateEditForm('audit_offer', e.target.value)}
              placeholder="Audit Offer Number"
              data-testid="audit-detail-edit-offer"
            />
          </div>
          <div>
            <label className="label">Name (Client)</label>
            <InlinePicker
              entityType="client"
              value={editForm.client_id}
              onChange={(v) => updateEditForm('client_id', v)}
              items={clients}
              onItemsChange={setClients}
              testIdPrefix="audit-detail-edit-client-"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Client Name</label>
              <input
                className="input"
                value={editForm.client_name_override || ''}
                onChange={(e) => updateEditForm('client_name_override', e.target.value)}
                placeholder="e.g. Vijay Mishra"
                data-testid="audit-detail-edit-client-name"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={editForm.client_phone_override || ''}
                onChange={(e) => updateEditForm('client_phone_override', e.target.value)}
                placeholder="+91 98xxxxxxxx"
                data-testid="audit-detail-edit-client-phone"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={editForm.client_email_override || ''}
                onChange={(e) => updateEditForm('client_email_override', e.target.value)}
                placeholder="name@example.com"
                data-testid="audit-detail-edit-client-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Total Amount (₹)</label>
              <input type="number" step="0.01" className="input" value={editForm.total_amount || ''} onChange={(e) => updateEditForm('total_amount', e.target.value)} placeholder="0.00" data-testid="audit-detail-edit-total" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={editForm.status || 'Outstanding'} onChange={(e) => updateEditForm('status', e.target.value)} data-testid="audit-detail-edit-status">
                <option value="Outstanding">Outstanding</option>
                <option value="Confirm">Confirm</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Settled">Settled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="textarea" rows={3} value={editForm.address || ''} onChange={(e) => updateEditForm('address', e.target.value)} placeholder="Site Location / Address" data-testid="audit-detail-edit-address" />
          </div>
          <div>
            <label className="label">Audit Offer Path <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(path of the audit offer on your PC)</span></label>
            <input
              className="input font-mono-data text-xs"
              value={editForm.audit_offer_path || ''}
              onChange={(e) => updateEditForm('audit_offer_path', e.target.value)}
              placeholder={`e.g. D:\\CreatorConsultant\\Offers\\2026\\STR-AUDIT-2026-006.pdf`}
              data-testid="audit-detail-edit-offer-path"
            />
          </div>
          <div>
            <label className="label">Report Path <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(path of the audit report on your PC)</span></label>
            <input
              className="input font-mono-data text-xs"
              value={editForm.report_path || ''}
              onChange={(e) => updateEditForm('report_path', e.target.value)}
              placeholder={`e.g. D:\\CreatorConsultant\\Audits\\2026\\STR-AUDIT-2026-006.pdf`}
              data-testid="audit-detail-edit-report-path"
            />
          </div>
          {editError && <div className="text-sm text-red-600" data-testid="audit-detail-edit-error">{editError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn btn-primary" data-testid="audit-detail-edit-save">{editSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <RecordPaymentModal open={showPay} onClose={() => setShowPay(false)} entityType="audit" defaultAuditId={id} onSaved={load} />
    </div>
  );
};

export default AuditDetailPage;
