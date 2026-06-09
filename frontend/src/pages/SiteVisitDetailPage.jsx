import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { ArrowLeft, FileText, Edit3, Trash2, Share2, ImageIcon, ClipboardList, MapPin, Calendar, User, Pin, PinOff, Phone, MessageCircle, IndianRupee, ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useUndo } from '../lib/undo';
import { downloadFile } from '../lib/download';
import { formatINR } from '../lib/format';
import PhotoMap from '../components/PhotoMap';
import SiteVisitPdfDownloadButton from '../components/SiteVisitPdfDownloadButton';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Pill = ({ children, color }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: color, color: 'white' }}>{children}</span>
);

const SiteVisitDetailPage = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const undo = useUndo();

  const [v, setV] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/site-visits/${id}`);
        setV(r.data);
        // Pull linked project for the financials card (admin/staff only — engineers
        // are RBAC-blocked from project detail anyway, but they can still read summary).
        if (r.data?.project_id) {
          try {
            const pr = await api.get(`/projects/${r.data.project_id}`);
            setProject(pr.data);
          } catch {}
        }
      } catch (e) {
        setErr('Site visit not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onDelete = () => {
    if (!v) return;
    if (!window.confirm(`Delete ${v.visit_code}? You can undo within 60s.`)) return;
    undo.schedule({
      label: `Site visit ${v.visit_code} deleted`,
      onCommit: async () => { try { await api.delete(`/site-visits/${id}`); } catch {} },
      onUndo: () => {},
    });
    nav('/site-visits');
  };

  const togglePin = async () => {
    if (!v) return;
    const next = !v.is_pinned;
    setV({ ...v, is_pinned: next });   // optimistic
    try {
      await api.post(`/site-visits/${id}/pin`, { pinned: next });
    } catch (e) {
      setV({ ...v, is_pinned: !next }); // revert
      alert(e?.response?.data?.detail || 'Could not toggle pin');
    }
  };

  const buildWhatsAppLink = () => {
    if (!v) return '';
    const pdfUrl = `${BACKEND}/api/site-visits/public/${v.public_token}/pdf`;
    const lines = [
      `Site Visit Report — ${v.visit_code}`,
      v.inspection_title ? `Inspection: ${v.inspection_title}` : null,
      v.project_code ? `Project: ${v.project_code} — ${v.project_name || ''}` : null,
      v.visit_date ? `Date: ${String(v.visit_date).slice(0, 10)}` : null,
      v.plot_no ? `Plot: ${v.plot_no}` : null,
      '',
      `View / download PDF: ${pdfUrl}`,
    ].filter(Boolean);
    const msg = encodeURIComponent(lines.join('\n'));
    const digits = (phone || '').replace(/[^0-9]/g, '');
    return digits ? `https://wa.me/${digits}?text=${msg}` : `https://wa.me/?text=${msg}`;
  };

  if (user?.role === 'account') return <Navigate to="/" replace />;
  if (loading) return <div className="max-w-[1100px] mx-auto px-4 py-8 text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>;
  if (err || !v) return (
    <div className="max-w-[1100px] mx-auto px-4 py-8">
      <button onClick={() => nav(-1)} className="text-sm hover:underline mb-3 inline-flex items-center gap-1"><ArrowLeft size={14}/> Back</button>
      <div className="card p-6 text-sm" style={{ color: '#991B1B' }}>{err || 'Not found'}</div>
    </div>
  );

  const isEngineer = user?.role === 'engineer';
  const isAccount = user?.role === 'account';
  const canDelete = !isEngineer && !isAccount;
  const canEdit = !isAccount;

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8" data-testid="site-visit-detail-page">
      <Link to="/site-visits" className="text-sm flex items-center gap-1 mb-3 hover:underline" style={{ color: 'var(--cc-text-muted)' }}>
        <ArrowLeft size={14}/> All site visits
      </Link>

      {/* Header */}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono-data text-sm font-bold" style={{ color: 'var(--cc-dark-green)' }} data-testid="detail-visit-code">
                {v.visit_code}{v.job_no ? ` · Job ${v.job_no}` : ''}
              </span>
              <Pill color={v.status === 'draft' ? '#9CA3AF' : '#10B981'}>{(v.status || 'submitted').toUpperCase()}</Pill>
              {v.template_name && <Pill color="#0A2E1F">{v.template_name}</Pill>}
              {v.is_pinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: '#FEF3C7', color: '#92400E' }} data-testid="pinned-badge">
                  <Pin size={10}/> Pinned
                </span>
              )}
            </div>
            <h1 className="font-head text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
              {v.inspection_title || 'Site Visit'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Cross-device download — picks blob-save on desktop and
                synchronous anchor on mobile/PWA. See component for details. */}
            <SiteVisitPdfDownloadButton visit={v} variant="primary" />
            <button onClick={togglePin} className="btn btn-outline" title={v.is_pinned ? 'Unpin this visit from the project page' : 'Pin to the project page'} data-testid="btn-toggle-pin">
              {v.is_pinned ? <><PinOff size={14}/> Unpin</> : <><Pin size={14}/> Pin to project</>}
            </button>
            <button onClick={() => setShowShare(true)} className="btn btn-accent" data-testid="btn-share-whatsapp">
              <Share2 size={14}/> Share via WhatsApp
            </button>
            {canEdit && (
              <Link to={`/site-visits/${v.id}/edit`} className="btn btn-outline" data-testid="btn-edit-visit"><Edit3 size={14}/> Edit</Link>
            )}
            {canDelete && (
              <button onClick={onDelete} className="btn btn-outline" style={{ color: '#B91C1C' }} data-testid="btn-delete-visit"><Trash2 size={14}/> Delete</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          {[
            { icon: Calendar, label: 'Visit Date', value: (v.visit_date || '').slice(0, 10) || '—' },
            { icon: User, label: 'Customer', value: v.customer || '—' },
            { icon: MapPin, label: 'Site Location', value: v.site_location || v.plot_no || '—' },
            { icon: ClipboardList, label: 'Job No', value: v.job_no || '—' },
          ].map((m, i) => (
            <div key={i} className="rounded-md p-2.5" style={{ background: 'var(--cc-surface)' }}>
              <div className="flex items-center gap-1 mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>
                <m.icon size={11}/><span className="uppercase tracking-wide" style={{ fontSize: '10px' }}>{m.label}</span>
              </div>
              <div className="font-semibold text-sm" style={{ color: 'var(--cc-dark-green)' }}>{m.value}</div>
            </div>
          ))}
        </div>
        {(v.latitude != null && v.longitude != null) && (
          <div className="mt-3 text-xs flex items-center gap-2" data-testid="detail-gps-row">
            <MapPin size={12} style={{ color: 'var(--cc-accent)' }} />
            <strong>GPS:</strong>
            <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="font-mono-data hover:underline" style={{ color: 'var(--cc-dark-green)' }}>
              {v.latitude.toFixed(6)}, {v.longitude.toFixed(6)}
            </a>
            {v.geo_accuracy != null && <span style={{ color: 'var(--cc-text-muted)' }}>±{Math.round(v.geo_accuracy)} m</span>}
          </div>
        )}

        {(v.project_code || v.drg_no || v.revision) && (
          <div className="mt-3 text-xs flex flex-wrap gap-4" style={{ color: 'var(--cc-text-muted)' }}>
            {v.project_code && <div><strong>Project:</strong> <Link to={`/projects/${v.project_id}`} className="font-mono-data hover:underline" style={{ color: 'var(--cc-dark-green)' }}>{v.project_code}</Link> — {v.project_name}</div>}
            {v.drg_no && <div><strong>DRG:</strong> <span className="font-mono-data">{v.drg_no}</span></div>}
            {v.revision && <div><strong>Rev:</strong> {v.revision}</div>}
          </div>
        )}
      </div>

      {/* Linked Project Accounting (admin/staff only — engineers don't need to see money) */}
      {project && !isEngineer && (
        <div className="card p-5 mb-4" data-testid="detail-project-financials">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--cc-text-muted)' }}>Linked Project</div>
              <Link to={`/projects/${project.id}`} className="font-head text-lg font-bold link-underline inline-flex items-center gap-1.5"
                    style={{ color: 'var(--cc-dark-green)' }} data-testid="detail-project-link">
                {project.name} <ExternalLink size={13}/>
              </Link>
              <div className="text-xs mt-0.5 flex flex-wrap items-center gap-2" style={{ color: 'var(--cc-text-muted)' }}>
                <span className="font-mono-data">{project.project_code}</span>
                {project.job_no && (
                  <>
                    <span>·</span>
                    <span className="font-mono-data px-1.5 py-0.5 rounded" style={{ background: 'var(--cc-surface)' }}>Job {project.job_no}</span>
                  </>
                )}
                {project.client_name && <><span>·</span><span>{project.client_name}</span></>}
              </div>
            </div>
            <Pill color={project.status === 'Settled' ? '#10B981' : '#F59E0B'}>{project.status || 'Outstanding'}</Pill>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
            {[
              { label: 'Quoted', value: project.quoted_amount, color: 'var(--cc-dark-green)' },
              { label: 'Received', value: project.received_amount, color: '#0E7490' },
              { label: 'Outstanding', value: project.outstanding_amount, color: (project.outstanding_amount || 0) > 0 ? '#B91C1C' : '#10B981' },
            ].map((m, i) => (
              <div key={i} className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
                <div className="uppercase tracking-wide mb-1" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>{m.label}</div>
                <div className="font-head font-bold text-base inline-flex items-center gap-0.5" style={{ color: m.color }}>
                  <IndianRupee size={13}/>{formatINR(m.value || 0).replace('₹', '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {Array.isArray(v.checklist) && v.checklist.length > 0 && (
        <div className="card p-5 mb-4" data-testid="detail-checklist">
          <h2 className="font-head text-lg font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }}>
                  <th className="text-left px-2 py-2">Description</th>
                  <th className="text-center px-2 py-2 w-24">Compliance</th>
                  <th className="text-left px-2 py-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {v.checklist.map((c, i) => {
                  const color = c.compliance === 'yes' ? '#10B981' : c.compliance === 'no' ? '#DC2626' : '#9CA3AF';
                  return (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--cc-border)' }}>
                      <td className="px-2 py-2">{c.label}</td>
                      <td className="px-2 py-2 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: color, color: 'white' }}>{(c.compliance || 'yes').toUpperCase()}</span>
                      </td>
                      <td className="px-2 py-2 text-xs" style={{ color: 'var(--cc-text-muted)' }}>{c.remark || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Observations */}
      {Array.isArray(v.observations) && v.observations.length > 0 && (
        <div className="card p-5 mb-4">
          <h2 className="font-head text-lg font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Observations</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {v.observations.map((o, i) => <li key={i}>{o}</li>)}
          </ol>
        </div>
      )}

      {/* Photos */}
      {Array.isArray(v.photos) && v.photos.length > 0 && (
        <div className="card p-5 mb-4" data-testid="detail-photos">
          <h2 className="font-head text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}><ImageIcon size={16}/> Photos ({v.photos.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {v.photos.map((p, i) => {
              const src = p.url ? `${BACKEND}${p.url}` : p.data_url;
              const hasGps = p.latitude != null && p.longitude != null;
              return (
                <div key={i} className="block rounded-md overflow-hidden relative" style={{ border: '1px solid var(--cc-border)' }}>
                  <a href={src} target="_blank" rel="noreferrer" className="block">
                    <img src={src} alt={p.caption || `photo-${i+1}`} className="w-full h-32 object-cover" />
                    {p.caption && <div className="text-[11px] px-1.5 py-1 truncate" style={{ background: 'var(--cc-surface)' }}>{p.caption}</div>}
                  </a>
                  {hasGps && (
                    <a
                      href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase shadow"
                      style={{ background: 'rgba(10,46,31,0.85)', color: 'white' }}
                      title={`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`}
                      data-testid={`detail-photo-gps-${i}`}
                    >
                      <MapPin size={9}/> GPS
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Site walk-around map (photo GPS pins + visit GPS star) */}
      <PhotoMap
        photos={v.photos || []}
        visitGps={v.latitude != null ? { latitude: v.latitude, longitude: v.longitude, accuracy: v.geo_accuracy } : null}
      />

      {/* Signatures */}
      {(v.engineer_signature || v.site_person_signature || v.engineer_name || v.site_person_name) && (
        <div className="card p-5 mb-4">
          <h2 className="font-head text-lg font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Signatures</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['Structural Engineer', v.engineer_name, v.engineer_signature, null],
              ['Site Person', v.site_person_name, v.site_person_signature, v.site_person_phone],
            ].map(([label, name, sig, phone], i) => (
              <div key={i} className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
                <div className="bg-white rounded h-20 flex items-center justify-center overflow-hidden" style={{ border: '1px dashed var(--cc-border)' }}>
                  {sig ? <img src={sig} alt="signature" className="max-h-full" /> : <span className="text-xs italic" style={{ color: 'var(--cc-text-muted)' }}>Not signed</span>}
                </div>
                <div className="text-xs mt-2">{name || '—'}</div>
                {phone && (
                  <div className="text-xs mt-1 flex flex-wrap items-center gap-2" data-testid="site-person-contact">
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:opacity-70"
                       style={{ color: 'var(--cc-accent)' }} data-testid="site-person-call">
                      <Phone size={11}/> {phone}
                    </a>
                    <a href={`https://wa.me/${String(phone).replace(/[^0-9]/g, '')}`}
                       target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 hover:opacity-70"
                       style={{ color: '#25D366' }} data-testid="site-person-whatsapp">
                      <MessageCircle size={11}/> WhatsApp
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity history */}
      <ActivityCard visitId={v.id} />

      {/* WhatsApp share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowShare(false)} data-testid="share-modal">
          <div className="bg-white rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-head text-lg font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>Share via WhatsApp</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--cc-text-muted)' }}>The PDF link is public (anyone with the URL can view). Add a recipient phone (optional) to open the chat directly.</p>
            <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>Phone number (with country code, optional)</label>
            <input type="tel" className="input w-full mt-1 mb-3" placeholder="91xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="share-phone"/>
            <div className="text-xs mb-3 break-all p-2 rounded" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}>
              {`${BACKEND}/api/site-visits/public/${v.public_token}/pdf`}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowShare(false)} className="btn btn-outline" data-testid="share-cancel">Cancel</button>
              <a href={buildWhatsAppLink()} target="_blank" rel="noreferrer" className="btn btn-accent" onClick={() => setShowShare(false)} data-testid="share-open-whatsapp">
                <Share2 size={14}/> Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteVisitDetailPage;

const ActivityCard = ({ visitId }) => {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    api.get(`/site-visits/${visitId}/activity`).then((r) => setItems(r.data || [])).catch(() => setItems([]));
  }, [visitId]);

  if (!items.length) return null;
  const styleForAction = (a) => {
    const u = (a || '').toLowerCase();
    if (u.includes('created')) return { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' };
    if (u.includes('deleted')) return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' };
    if (u.includes('status')) return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
    return { background: '#E0F2FE', color: '#075985', border: '1px solid #93C5FD' };
  };

  return (
    <div className="card p-5 mb-4" data-testid="sv-activity-card">
      <h2 className="font-head text-lg font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Activity History</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }}>
              <th className="text-left px-2 py-2 w-36">When</th>
              <th className="text-left px-2 py-2 w-32">Who</th>
              <th className="text-left px-2 py-2">Action</th>
              <th className="text-left px-2 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t" style={{ borderColor: 'var(--cc-border)' }} data-testid={`sv-activity-row-${a.action}`}>
                <td className="px-2 py-2 text-xs font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                <td className="px-2 py-2 text-xs">{a.username || 'system'}</td>
                <td className="px-2 py-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={styleForAction(a.action)}>{a.action}</span>
                </td>
                <td className="px-2 py-2 text-xs" style={{ color: 'var(--cc-text-muted)' }}>{a.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
