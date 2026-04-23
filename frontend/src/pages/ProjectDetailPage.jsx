import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { useUndo } from '../lib/undo';
import { formatINR, formatDate } from '../lib/format';
import { downloadFile } from '../lib/download';
import RecordPaymentModal from '../components/RecordPaymentModal';
import {
  ArrowLeft, Pencil, Trash2, FileText, Download, Archive, Folder, Copy,
  Plus, MapPin, CreditCard, ClipboardList, Clock, Phone, Mail,
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

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schedule } = useUndo();
  const [project, setProject] = useState(null);
  const [payments, setPayments] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [showPay, setShowPay] = useState(false);
  const [newQuote, setNewQuote] = useState('');
  const [reviseReason, setReviseReason] = useState('');
  const [revising, setRevising] = useState(false);

  const load = useCallback(async () => {
    const [p, pay, rev, act] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get('/payments', { params: { project_id: id } }),
      api.get(`/projects/${id}/revisions`),
      api.get(`/projects/${id}/activity`),
    ]);
    setProject(p.data);
    setPayments(pay.data);
    setRevisions(rev.data);
    setActivity(act.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!project) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;

  const handleDelete = () => {
    const code = project.project_code;
    if (!window.confirm(`Are you sure you want to permanently DELETE project ${code}?\n\nThis will also delete all its payments, quote revisions and activity history.\n\nYou can undo within 60 seconds.\n\nTip: Use Archive instead to keep history.`)) return;
    schedule({
      label: `Project ${code} deleted`,
      onCommit: async () => {
        try { await api.delete(`/projects/${id}`); } catch { /* silent */ }
      },
      onUndo: () => { /* nothing to restore — API not yet called and we navigated away */ },
    });
    navigate('/');
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive project ${project.project_code}?`)) return;
    await api.post(`/projects/${id}/archive`);
    navigate('/');
  };

  const downloadInvoice = () => downloadFile(`${API}/projects/${id}/invoice`);
  const downloadExcel = () => downloadFile(`${API}/projects/${id}/export`);
  const downloadReceipt = (paymentId) => downloadFile(`${API}/payments/${paymentId}/receipt`);

  const handleDeletePayment = (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?\n\nProject totals will be recalculated.\n\nYou can undo within 60 seconds.')) return;
    // Optimistically hide the payment row
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    schedule({
      label: 'Payment deleted',
      onCommit: async () => {
        try { await api.delete(`/payments/${paymentId}`); load(); } catch { load(); }
      },
      onUndo: () => { load(); },
    });
  };

  const handleRevise = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newQuote);
    if (!amt && amt !== 0) return;
    setRevising(true);
    try {
      await api.post(`/projects/${id}/revise-quote`, { new_amount: amt, reason: reviseReason });
      setNewQuote('');
      setReviseReason('');
      load();
    } finally { setRevising(false); }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="project-detail-page">
      <Link to="/" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3"><ArrowLeft size={14}/> Back to Projects</Link>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-head text-4xl font-extrabold flex items-center gap-2 flex-wrap" style={{ color: 'var(--cc-dark-green)' }} data-testid="detail-name">
            {project.offer_type && (
              <span
                className="text-xs font-bold px-2 py-1 rounded"
                style={(() => {
                  const t = (project.offer_type || '').toLowerCase();
                  if (t === 'rcc') return { background: '#E0F2FE', color: '#075985', border: '1px solid #7DD3FC' };
                  if (t === 'steel') return { background: '#F3F4F6', color: '#374151', border: '1px solid #9CA3AF' };
                  if (t === 'audit') return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
                  if (t === 'pmc') return { background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD' };
                  return { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' };
                })()}
              >{project.offer_type}</span>
            )}
            {project.name}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm flex-wrap" style={{ color: 'var(--cc-text-muted)' }}>
            <span className="font-mono-data font-semibold" style={{ color: 'var(--cc-accent)' }} data-testid="detail-code">{project.project_code}</span>
            <span>·</span>
            {project.client_id ? (
              <Link to={`/clients/${project.client_id}`} className="link-underline" data-testid="detail-client-link">{project.client_name}</Link>
            ) : <span className="text-gray-400">No client</span>}
            <span>·</span>
            {project.architect_id ? (
              <Link to={`/architects/${project.architect_id}`} className="link-underline" data-testid="detail-architect-link">{project.architect_name}</Link>
            ) : <span className="text-gray-400">No architect</span>}
            {project.site_location && <><span>·</span><span className="inline-flex items-center gap-1"><MapPin size={12}/> {project.site_location}</span></>}
            <span>·</span>
            <span>Created {formatDate(project.created_at)}</span>
            <span className={`badge ml-2 ${project.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{project.status}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadExcel} className="btn btn-outline" data-testid="detail-btn-excel"><Download size={15}/> Export Excel</button>
          <button onClick={downloadInvoice} className="btn btn-outline" data-testid="detail-btn-invoice"><FileText size={15}/> Invoice PDF</button>
          <Link to={`/projects/${id}/edit`} className="btn btn-outline" data-testid="detail-btn-edit"><Pencil size={15}/> Edit</Link>
          <button onClick={handleArchive} className="btn btn-outline" data-testid="detail-btn-archive"><Archive size={15}/> Archive</button>
          <button onClick={handleDelete} className="btn btn-danger" data-testid="detail-btn-delete"><Trash2 size={15}/> Delete</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Current Quoted Amount" value={formatINR(project.quoted_amount)} color="var(--cc-dark-green)" />
        <KpiCard label="Total Received" value={formatINR(project.received_amount)} color="var(--cc-accent)" />
        <KpiCard label="Outstanding" value={formatINR(project.outstanding_amount)} color="#DC2626" />
      </div>

      {/* Contacts quick row */}
      {(project.client_phone || project.client_email || project.architect_phone || project.architect_email) && (
        <div className="card p-4 mb-6 flex items-center gap-6 flex-wrap text-sm" data-testid="detail-contact-bar">
          {project.client_name && (
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>Client</div>
              <div className="font-semibold">{project.client_name}</div>
              <div className="flex gap-3 mt-1">
                {project.client_phone && <a href={`tel:${project.client_phone}`} className="text-xs inline-flex items-center gap-1 link-underline"><Phone size={11}/> {project.client_phone}</a>}
                {project.client_email && <a href={`mailto:${project.client_email}`} className="text-xs inline-flex items-center gap-1 link-underline"><Mail size={11}/> {project.client_email}</a>}
              </div>
            </div>
          )}
          {project.architect_name && (
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>Architect</div>
              <div className="font-semibold">{project.architect_name}</div>
              <div className="flex gap-3 mt-1">
                {project.architect_phone && <a href={`tel:${project.architect_phone}`} className="text-xs inline-flex items-center gap-1 link-underline"><Phone size={11}/> {project.architect_phone}</a>}
                {project.architect_email && <a href={`mailto:${project.architect_email}`} className="text-xs inline-flex items-center gap-1 link-underline"><Mail size={11}/> {project.architect_email}</a>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linked offer */}
      {project.offer_code && (
        <div className="card p-5 mb-6" data-testid="linked-offer-card">
          <h2 className="font-head text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <FileText size={18}/> Linked Offer — {project.offer_code}
          </h2>
          {project.offer_file_path && (
            <div className="flex items-center gap-2 rounded-lg p-3 font-mono-data text-xs" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
              <Folder size={14} style={{ color: 'var(--cc-accent)' }}/>
              <span className="flex-1 break-all" data-testid="linked-offer-path">{project.offer_file_path}</span>
              <button onClick={() => { navigator.clipboard?.writeText(project.offer_file_path); }} className="btn btn-outline btn-sm"><Copy size={12}/> Copy</button>
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      <div className="card mb-6 overflow-hidden" data-testid="payments-card">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <CreditCard size={18}/> Payment Records ({payments.length})
          </h2>
          <button onClick={() => setShowPay(true)} className="btn btn-accent btn-sm" data-testid="btn-add-payment"><Plus size={14}/> Add Payment</button>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="payments-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th className="text-right">Amount (₹)</th>
                <th>Note</th>
                <th>Date &amp; Time</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No payments yet.</td></tr>
              ) : payments.map((p, i) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`}>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</td>
                  <td className="num font-semibold">{formatINR(p.amount, { withSymbol: false })}</td>
                  <td className="text-sm">{p.notes || '—'}</td>
                  <td className="text-xs font-mono-data">{formatDate(p.payment_date)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => downloadReceipt(p.id)} className="btn btn-outline btn-sm" data-testid={`btn-receipt-${p.id}`}><Download size={12}/> Receipt</button>
                      <button onClick={() => handleDeletePayment(p.id)} className="btn btn-danger btn-sm" data-testid={`btn-delete-payment-${p.id}`}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Revisions */}
      <div className="card mb-6 overflow-hidden" data-testid="revisions-card">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <ClipboardList size={18}/> Quote Revisions ({revisions.length})
          </h2>
        </div>
        <form onSubmit={handleRevise} className="p-5 border-b grid md:grid-cols-[1fr_2fr_auto] gap-3" style={{ borderColor: 'var(--cc-border)' }} data-testid="revise-form">
          <div>
            <label className="label">New Quoted Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={newQuote}
              onChange={(e) => setNewQuote(e.target.value)}
              placeholder="e.g. 275000"
              data-testid="revise-new-amount"
            />
          </div>
          <div>
            <label className="label">Reason</label>
            <input
              className="input"
              value={reviseReason}
              onChange={(e) => setReviseReason(e.target.value)}
              placeholder="e.g. Client discount applied"
              data-testid="revise-reason"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={revising || newQuote === ''} className="btn btn-accent w-full md:w-auto" data-testid="btn-revise">
              {revising ? 'Saving...' : 'Revise Quote'}
            </button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="revisions-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th className="text-right">Old Amount (₹)</th>
                <th className="text-right">New Amount (₹)</th>
                <th>Reason</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No revisions yet.</td></tr>
              ) : revisions.map((r, i) => (
                <tr key={r.id} data-testid={`revision-row-${r.id}`}>
                  <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>{i + 1}</td>
                  <td className="num">{formatINR(r.old_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{formatINR(r.new_amount, { withSymbol: false })}</td>
                  <td className="text-sm">{r.reason || '—'}</td>
                  <td className="text-xs font-mono-data">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity */}
      <div className="card overflow-hidden" data-testid="activity-card">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <Clock size={18}/> Activity History ({activity.length})
          </h2>
        </div>
        <div className="p-5 space-y-3" data-testid="activity-list">
          {activity.length === 0 ? (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--cc-text-muted)' }}>No activity yet.</div>
          ) : activity.map((a) => (
            <div key={a.id} className="flex items-start gap-3" data-testid={`activity-${a.id}`}>
              <span className="text-xs font-bold px-2 py-1 rounded whitespace-nowrap" style={actionStyle(a.action)}>
                {a.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm">{a.detail || <span className="text-gray-400">—</span>}</div>
                <div className="text-xs font-mono-data mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{formatDate(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RecordPaymentModal open={showPay} onClose={() => setShowPay(false)} defaultProjectId={id} onSaved={load} />
    </div>
  );
};

const KpiCard = ({ label, value, color }) => (
  <div className="card p-5 text-center" style={{ borderLeft: `3px solid ${color}` }}>
    <div className="font-mono-data text-3xl font-bold" style={{ color }}>{value}</div>
    <div className="text-xs uppercase tracking-widest mt-2" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
  </div>
);

export default ProjectDetailPage;
