import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR, formatDate } from '../lib/format';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { ArrowLeft, Pencil, IndianRupee, Trash2, FileText, Download, Archive } from 'lucide-react';

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [payments, setPayments] = useState([]);
  const [showPay, setShowPay] = useState(false);

  const load = async () => {
    const [p, pay] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get('/payments', { params: { project_id: id } }),
    ]);
    setProject(p.data);
    setPayments(pay.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!project) return <div className="max-w-4xl mx-auto p-8">Loading...</div>;

  const handleDelete = async () => {
    if (!window.confirm(`Permanently DELETE project ${project.project_code}? Use Archive to keep history.`)) return;
    await api.delete(`/${'projects'}/${id}`);
    navigate('/');
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive project ${project.project_code}?`)) return;
    await api.post(`/projects/${id}/archive`);
    navigate('/');
  };

  const downloadInvoice = () => window.open(`${API}/projects/${id}/invoice`, '_blank');
  const downloadReceipt = (paymentId) => window.open(`${API}/payments/${paymentId}/receipt`, '_blank');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="project-detail-page">
      <Link to="/" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3"><ArrowLeft size={14}/> Back to Projects</Link>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="font-mono-data text-sm font-semibold" style={{ color: 'var(--cc-accent)' }} data-testid="detail-code">{project.project_code}</div>
          <h1 className="font-head text-3xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }} data-testid="detail-name">{project.name}</h1>
          <div className="mt-2">
            <span className={`badge ${project.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{project.status}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPay(true)} className="btn btn-accent" data-testid="detail-btn-pay"><IndianRupee size={15}/> Record Payment</button>
          <button onClick={downloadInvoice} className="btn btn-outline" data-testid="detail-btn-invoice"><FileText size={15}/> Invoice PDF</button>
          <Link to={`/projects/${id}/edit`} className="btn btn-outline" data-testid="detail-btn-edit"><Pencil size={15}/> Edit</Link>
          <button onClick={handleArchive} className="btn btn-outline" data-testid="detail-btn-archive"><Archive size={15}/> Archive</button>
          <button onClick={handleDelete} className="btn btn-danger" data-testid="detail-btn-delete"><Trash2 size={15}/></button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>Quoted</div>
          <div className="font-mono-data text-2xl font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{formatINR(project.quoted_amount)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>Received</div>
          <div className="font-mono-data text-2xl font-semibold" style={{ color: 'var(--cc-accent)' }}>{formatINR(project.received_amount)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--cc-text-muted)' }}>Outstanding</div>
          <div className="font-mono-data text-2xl font-semibold" style={{ color: '#DC2626' }}>{formatINR(project.outstanding_amount)}</div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-head text-lg font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Project Info</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <Info label="Client" value={project.client_name || '—'} />
          <Info label="Architect" value={project.architect_name || '—'} />
          <Info label="Site Location" value={project.site_location || '—'} full />
          <Info label="Notes" value={project.notes || '—'} full />
          <Info label="Created" value={formatDate(project.created_at)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg font-bold" style={{ color: 'var(--cc-dark-green)' }}>Payment History ({payments.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Amount (₹)</th>
                <th>Notes</th>
                <th className="text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No payments recorded yet.</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td className="num font-semibold">{formatINR(p.amount, { withSymbol: false })}</td>
                  <td className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>{p.notes || '—'}</td>
                  <td className="text-right">
                    <button onClick={() => downloadReceipt(p.id)} className="btn btn-outline btn-sm" data-testid={`btn-receipt-${p.id}`}>
                      <Download size={12}/> Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecordPaymentModal open={showPay} onClose={() => setShowPay(false)} defaultProjectId={id} onSaved={load} />
    </div>
  );
};

const Info = ({ label, value, full }) => (
  <div className={full ? 'md:col-span-2' : ''}>
    <div className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
    <div style={{ color: 'var(--cc-text)' }}>{value}</div>
  </div>
);

export default ProjectDetailPage;
