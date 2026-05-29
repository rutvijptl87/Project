import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, API } from '../lib/api';
import { Plus, Search, Eye, FileText, Trash2, ClipboardList, MapPin, Calendar, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useUndo } from '../lib/undo';
import { downloadFile } from '../lib/download';
import MySvWeeklyChart from '../components/MySvWeeklyChart';

const StatusBadge = ({ status }) => {
  const cls = status === 'draft' ? 'badge-pending' : 'badge-settled';
  return <span className={`badge ${cls}`} style={{ fontSize: '10px' }}>{(status || 'submitted').toUpperCase()}</span>;
};

const SiteVisitsPage = () => {
  const { user } = useAuth();
  const undo = useUndo();
  const isEngineer = user?.role === 'engineer';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') || '').toLowerCase();
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/site-visits', { params: { mine: isEngineer ? true : undefined } });
      setItems(r.data || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    let arr = items;
    if (statusFilter) {
      arr = arr.filter((v) => (v.status || 'submitted').toLowerCase() === statusFilter);
    }
    const k = q.trim().toLowerCase();
    if (!k) return arr;
    return arr.filter((v) =>
      [v.visit_code, v.inspection_title, v.job_no, v.customer, v.plot_no, v.site_location, v.project_code, v.project_name]
        .some((f) => (f || '').toLowerCase().includes(k)),
    );
  }, [q, items, statusFilter]);

  const setStatus = (s) => {
    if (!s) {
      searchParams.delete('status');
    } else {
      searchParams.set('status', s);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const removeVisit = (v) => {
    if (!window.confirm(`Delete site visit ${v.visit_code}? You can undo within 60s.`)) return;
    setItems((cur) => cur.filter((x) => x.id !== v.id));
    undo.schedule({
      label: `Site visit ${v.visit_code} deleted`,
      onCommit: async () => { try { await api.delete(`/site-visits/${v.id}`); } catch {} },
      onUndo: () => setItems((cur) => [v, ...cur]),
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8" data-testid="site-visits-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-head text-2xl sm:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
            Site Visits
          </h1>
          <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Mobile-friendly inspection reports — checklists, photos & PDF.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--cc-text-muted)' }} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search code, title, job, plot…"
              className="input pl-8 w-full"
              data-testid="site-visits-search"
            />
          </div>
          {!isEngineer && (
            <div className="flex items-center gap-1">
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="input"
                style={{ width: '140px' }}
                data-testid="export-month-picker"
              />
              <button
                type="button"
                onClick={() => downloadFile(`${API}/site-visits/export/excel?month=${exportMonth}`, `site-visits-${exportMonth}.xlsx`)}
                className="btn btn-outline btn-sm"
                title={`Excel summary for ${exportMonth}`}
                data-testid="btn-export-sv-excel"
              >
                <FileSpreadsheet size={13}/> <span className="hidden md:inline">Export</span>
              </button>
            </div>
          )}
          <Link to="/site-visits/new" className="btn btn-accent" data-testid="btn-new-site-visit">
            <Plus size={16} /> <span className="hidden sm:inline">New Inspection</span><span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* Engineer's weekly chart (also useful for admins viewing their own visits) */}
      <MySvWeeklyChart />

      {/* Status filter pills (kept above the search row for easy phone access) */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap" data-testid="status-filter-pills">
        {[
          { v: '', label: 'All', count: items.length },
          { v: 'draft', label: 'Draft', count: items.filter((v) => (v.status || '').toLowerCase() === 'draft').length },
          { v: 'submitted', label: 'Submitted', count: items.filter((v) => (v.status || 'submitted').toLowerCase() === 'submitted').length },
        ].map((s) => {
          const active = (statusFilter || '') === s.v;
          return (
            <button
              key={s.v || 'all'}
              onClick={() => setStatus(s.v)}
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: active ? 'var(--cc-dark-green)' : 'transparent',
                color: active ? 'white' : 'var(--cc-text)',
                border: '1px solid var(--cc-border)',
              }}
              data-testid={`status-pill-${s.v || 'all'}`}
            >
              {s.label} <span style={{ opacity: 0.6 }}>· {s.count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center" data-testid="site-visits-empty">
          <ClipboardList size={36} className="mx-auto mb-3" style={{ color: 'var(--cc-accent)' }} />
          <h3 className="font-head text-lg font-bold mb-1" style={{ color: 'var(--cc-dark-green)' }}>No site visits yet</h3>
          <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>Tap "New Inspection" to start your first one.</p>
          <Link to="/site-visits/new" className="btn btn-accent inline-flex"><Plus size={16}/> New Inspection</Link>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2.5" data-testid="site-visits-cards">
            {filtered.map((v) => (
              <Link
                key={v.id}
                to={`/site-visits/${v.id}`}
                className="card p-3 block hover:shadow"
                data-testid={`site-visit-card-${v.visit_code}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono-data font-bold text-sm" style={{ color: 'var(--cc-dark-green)' }}>{v.visit_code}</span>
                  <StatusBadge status={v.status} />
                </div>
                <div className="font-semibold text-sm leading-tight mb-0.5">{v.inspection_title || '—'}</div>
                <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--cc-text-muted)' }}>
                  {v.project_code && <span className="font-mono-data">{v.project_code}</span>}
                  {(v.site_location || v.plot_no) && (<><MapPin size={11}/> {v.site_location || v.plot_no}</>)}
                  {v.visit_date && (<><Calendar size={11}/> {String(v.visit_date).slice(0, 10)}</>)}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="card overflow-hidden hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--cc-surface)', color: 'var(--cc-dark-green)' }}>
                  <th className="text-left px-3 py-2 font-semibold">Code</th>
                  <th className="text-left px-3 py-2 font-semibold">Inspection</th>
                  <th className="text-left px-3 py-2 font-semibold">Project</th>
                  <th className="text-left px-3 py-2 font-semibold">Customer / Site</th>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Engineer</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t hover:bg-emerald-50/30" style={{ borderColor: 'var(--cc-border)' }} data-testid={`site-visit-row-${v.visit_code}`}>
                    <td className="px-3 py-2 font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{v.visit_code}</td>
                    <td className="px-3 py-2">{v.inspection_title || '—'}</td>
                    <td className="px-3 py-2 font-mono-data text-xs">{v.project_code || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      <div>{v.customer || '—'}</div>
                      <div style={{ color: 'var(--cc-text-muted)' }}>{v.site_location || v.plot_no || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{(v.visit_date || '').slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs">{v.engineer_name || v.created_by_username || '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Link to={`/site-visits/${v.id}`} className="btn btn-outline btn-sm" title="View" data-testid={`btn-view-${v.visit_code}`}><Eye size={13}/></Link>
                        <button onClick={() => downloadFile(`${API}/site-visits/${v.id}/pdf`, `${v.visit_code}.pdf`)} className="btn btn-outline btn-sm" title="PDF" data-testid={`btn-pdf-${v.visit_code}`}><FileText size={13}/></button>
                        {!isEngineer && (
                          <button onClick={() => removeVisit(v)} className="btn btn-outline btn-sm" title="Delete" data-testid={`btn-delete-${v.visit_code}`}><Trash2 size={13}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Floating "+" for mobile */}
      <Link
        to="/site-visits/new"
        className="sm:hidden fixed bottom-5 right-5 rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
        style={{ background: 'var(--cc-dark-green)', color: 'white', zIndex: 30 }}
        data-testid="btn-new-site-visit-fab"
      >
        <Plus size={26}/>
      </Link>
    </div>
  );
};

export default SiteVisitsPage;
