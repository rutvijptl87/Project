import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Bell, Check } from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

const relTime = (iso) => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
};

const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = async () => {
    try {
      const r = await api.get('/notifications', { params: { limit: 20 } });
      setItems(r.data.items || []);
      setUnread(r.data.unread || 0);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (n) => {
    if (n.is_read) return;
    try { await api.post(`/notifications/${n.id}/read`); } catch {}
    setItems((cur) => cur.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    try { await api.post('/notifications/read-all'); } catch {}
    setItems((cur) => cur.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={wrapRef} data-testid="notification-bell-wrap">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-outline btn-sm relative"
        title="Notifications"
        data-testid="notification-bell-btn"
        aria-label={`Notifications (${unread} unread)`}
      >
        <Bell size={14}/>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#DC2626', color: 'white', minWidth: '16px', height: '16px', padding: '0 4px' }}
            data-testid="notification-unread-count"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50 overflow-hidden"
          style={{ background: 'white', border: '1px solid var(--cc-border)' }}
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
            <div className="font-head text-sm font-bold" style={{ color: 'var(--cc-dark-green)' }}>Notifications</div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--cc-accent)' }} data-testid="notification-mark-all-read">
                <Check size={11}/> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs italic" style={{ color: 'var(--cc-text-muted)' }} data-testid="notification-empty">
                You're all caught up.
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  to={n.related_visit_id ? `/site-visits/${n.related_visit_id}` : '/site-visits'}
                  onClick={() => { markRead(n); setOpen(false); }}
                  className="block px-3 py-2.5 border-b text-sm hover:bg-emerald-50/40"
                  style={{ borderColor: 'var(--cc-border)', background: n.is_read ? 'white' : 'rgba(16,185,129,0.06)' }}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 inline-block rounded-full" style={{ width: '7px', height: '7px', background: '#10B981' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm leading-tight ${n.is_read ? '' : 'font-semibold'}`}>{n.message}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{relTime(n.created_at)}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
