import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import { ArrowLeft, Phone, Mail, Eye, FileText, Users, Building2 } from 'lucide-react';

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/clients/${id}`);
        setData(r.data);
      } catch {
        navigate('/clients');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  if (loading) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;
  if (!data) return null;

  const { client: c, projects, stats } = data;
  const waPhone = c.phone ? String(c.phone).replace(/[^0-9]/g, '') : '';

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="client-detail-page">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3" data-testid="btn-back">
        <ArrowLeft size={14}/> Back to Clients
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-surface)' }}>
            <Users size={26} color="var(--cc-accent)"/>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Client</div>
            <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }} data-testid="client-name">{c.name}</h1>
            {c.company && <div className="inline-flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}><Building2 size={13}/> {c.company}</div>}
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 link-underline" data-testid="client-phone">
                  <Phone size={13}/> {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 link-underline" data-testid="client-email">
                  <Mail size={13}/> {c.email}
                </a>
              )}
              {waPhone && (
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: '#25D366' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              )}
            </div>
            {c.address && <div className="text-xs mt-2" style={{ color: 'var(--cc-text-muted)' }}>{c.address}</div>}
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
            Projects for {c.name} ({projects.length})
          </h2>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            {stats.outstanding_count} outstanding • {stats.settled_count} settled
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="client-projects-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Architect</th>
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
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>No projects linked to this client yet.</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} data-testid={`client-project-row-${p.project_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.project_code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.architect_name || <span className="text-gray-400">None</span>}</td>
                  <td className="max-w-[200px]"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                  <td className="num">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                  <td className="num">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold">{formatINR(p.outstanding_amount, { withSymbol: false })}</td>
                  <td>
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <Link to={`/projects/${p.id}`} className="btn btn-outline btn-sm">
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

export default ClientDetailPage;
