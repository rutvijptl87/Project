import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, User as UserIcon, ClipboardList, History } from 'lucide-react';
import { api } from '../lib/api';

const relTime = (iso) => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
};

const styleForAction = (a) => {
  const u = (a || '').toLowerCase();
  if (u.includes('created')) return { background: '#D1FAE5', color: '#065F46' };
  if (u.includes('deleted')) return { background: '#FEE2E2', color: '#991B1B' };
  if (u.includes('status')) return { background: '#FEF3C7', color: '#92400E' };
  return { background: '#E0F2FE', color: '#075985' };
};

const UserActivityCard = () => {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState({ activity: [], visits: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/users');
        // Engineers at the top, then by username; preserves the spec ('engineer users at top')
        const sorted = [...(r.data || [])].sort((a, b) => {
          const ar = a.role === 'engineer' ? 0 : 1;
          const br = b.role === 'engineer' ? 0 : 1;
          if (ar !== br) return ar - br;
          return a.username.localeCompare(b.username);
        });
        setUsers(sorted);
        // Default to the first engineer if any, otherwise the first non-self user
        const eng = sorted.find((u) => u.role === 'engineer');
        if (eng) setSelectedId(eng.id);
        else if (sorted.length) setSelectedId(sorted[0].id);
      } catch (err) {
        console.error('Failed to load users for activity view', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    api
      .get(`/users/${selectedId}/activity`, { params: { limit: 100 } })
      .then((r) => setData(r.data || { activity: [], visits: [] }))
      .catch(() => setData({ activity: [], visits: [] }))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedId), [users, selectedId]);

  return (
    <div className="card p-6" data-testid="user-activity-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Activity size={18} /> Per-Engineer Activity Feed
        </h2>
        <div className="flex items-center gap-2">
          <UserIcon size={14} style={{ color: 'var(--cc-text-muted)' }} />
          <select
            className="select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            data-testid="user-activity-picker"
            style={{ minWidth: '200px' }}
          >
            <option value="">— Pick a user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--cc-text-muted)' }}>
        Everything {selectedUser?.username ? <strong>{selectedUser.username}</strong> : 'this user'} has touched: visits created/edited, status changes, deletions.
      </p>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent activity events */}
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--cc-text-muted)' }}>
              <History size={12} /> RECENT EVENTS ({data.activity.length})
            </div>
            {data.activity.length === 0 ? (
              <div className="text-xs italic p-3 rounded" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}>No activity recorded.</div>
            ) : (
              <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--cc-border)', maxHeight: '380px', overflowY: 'auto' }} data-testid="user-activity-events">
                {data.activity.map((a) => {
                  // Pick the right link target for each event type
                  let to = null;
                  let label = null;
                  if (a.site_visit_id) { to = `/site-visits/${a.site_visit_id}`; label = a.site_visit_code; }
                  else if (a.project_id) { to = `/projects/${a.project_id}`; label = a.project_code; }
                  else if (a.audit_id) { to = `/audits/${a.audit_id}`; label = a.audit_code; }
                  return (
                    <div key={a.id} className="px-3 py-2 border-b text-sm" style={{ borderColor: 'var(--cc-border)' }} data-testid={`user-activity-event-${a.id}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={styleForAction(a.action)}>{a.action || 'EVENT'}</span>
                        {to && label && (
                          <Link to={to} className="font-mono-data text-xs hover:underline" style={{ color: 'var(--cc-dark-green)' }}>{label}</Link>
                        )}
                        <span className="text-[11px] ml-auto" style={{ color: 'var(--cc-text-muted)' }}>{relTime(a.created_at)}</span>
                      </div>
                      {a.detail && <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{a.detail}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visits authored by user */}
          <div>
            <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--cc-text-muted)' }}>
              <ClipboardList size={12} /> SITE VISITS CREATED BY THIS USER ({data.visits.length})
            </div>
            {data.visits.length === 0 ? (
              <div className="text-xs italic p-3 rounded" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}>No site visits.</div>
            ) : (
              <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--cc-border)', maxHeight: '380px', overflowY: 'auto' }} data-testid="user-activity-visits">
                {data.visits.map((v) => (
                  <Link
                    key={v.id}
                    to={`/site-visits/${v.id}`}
                    className="block px-3 py-2 border-b text-sm hover:bg-emerald-50/30"
                    style={{ borderColor: 'var(--cc-border)' }}
                    data-testid={`user-activity-visit-${v.visit_code}`}
                  >
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono-data text-xs font-bold" style={{ color: 'var(--cc-dark-green)' }}>{v.visit_code}</span>
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: v.status === 'draft' ? '#FEF3C7' : '#D1FAE5', color: v.status === 'draft' ? '#92400E' : '#065F46' }}>
                        {(v.status || 'submitted').toUpperCase()}
                      </span>
                      <span className="text-[11px] ml-auto" style={{ color: 'var(--cc-text-muted)' }}>{(v.visit_date || '').slice(0, 10) || relTime(v.created_at)}</span>
                    </div>
                    <div className="text-xs truncate">{v.inspection_title || '—'}</div>
                    {v.project_code && <div className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>{v.project_code} {v.project_name}</div>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserActivityCard;
