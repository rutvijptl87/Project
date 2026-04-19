import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import { ArrowLeft, Phone, Mail, Pencil, FileText, Eye, Compass, IndianRupee, Briefcase } from 'lucide-react';

const ArchitectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/architects/${id}`);
        setData(r.data);
      } catch {
        navigate('/architects');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  if (loading) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;
  if (!data) return null;

  const { architect: a, projects, stats } = data;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="architect-detail-page">
      <Link to="/architects" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3" data-testid="btn-back">
        <ArrowLeft size={14}/> Back to Architects
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-surface)' }}>
            <Compass size={26} color="var(--cc-accent)"/>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Architect</div>
            <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }} data-testid="architect-name">{a.name}</h1>
            {a.firm && <div className="inline-flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}><Briefcase size={13}/> {a.firm}</div>}
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              {a.phone && (
                <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 link-underline" data-testid="architect-phone">
                  <Phone size={13}/> {a.phone}
                </a>
              )}
              {a.email && (
                <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 link-underline" data-testid="architect-email">
                  <Mail size={13}/> {a.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total Projects" value={stats.total_projects} />
        <Kpi label="Total Quoted" value={formatINR(stats.total_quoted)} />
        <Kpi label="Received" value={formatINR(stats.total_received)} color="var(--cc-accent)" />
        <Kpi label="Outstanding" value={formatINR(stats.total_outstanding)} color="#DC2626" />
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>
            Projects by {a.name} ({projects.length})
          </h2>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            {stats.outstanding_count} outstanding • {stats.settled_count} settled
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="architect-projects-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Client</th>
                <th>Site Location</th>
                <th className="text-right">Quoted (₹)</th>
                <th className="text-right">Received (₹)</th>
                <th className="text-right">Outstanding (₹)</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>No projects linked to this architect yet.</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} data-testid={`arch-project-row-${p.project_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.project_code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.client_name || <span className="text-gray-400">None</span>}</td>
                  <td className="max-w-[200px]"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                  <td className="num">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                  <td className="num">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold">{formatINR(p.outstanding_amount, { withSymbol: false })}</td>
                  <td>
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <Link to={`/projects/${p.id}`} className="btn btn-outline btn-sm" data-testid={`arch-view-${p.project_code}`}>
                        <Eye size={13}/> View
                      </Link>
                      <a href={`${API}/projects/${p.id}/invoice`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" title="Invoice PDF">
                        <FileText size={13}/>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, color }) => (
  <div className="card p-4">
    <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
    <div className="font-mono-data text-2xl font-semibold mt-1" style={{ color: color || 'var(--cc-dark-green)' }}>{value}</div>
  </div>
);

export default ArchitectDetailPage;
