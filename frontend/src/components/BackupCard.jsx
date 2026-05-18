import React, { useEffect, useState, useCallback } from 'react';
import { api, API } from '../lib/api';
import { useAuth } from '../lib/auth';
import { downloadFile } from '../lib/download';
import {
  Cloud, CloudOff, CheckCircle2, AlertCircle, RefreshCcw, Download,
  History, Link as LinkIcon, Play, Unlink,
} from 'lucide-react';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
};

const fmtBytes = (n) => {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const BackupCard = () => {
  const { requireUnlock } = useAuth();
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [running, setRunning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get('/backup/status');
      setStatus(r.data);
    } catch (e) { console.warn('Backup status fetch failed:', e?.message || e); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get('/backup/history', { params: { limit: 30 } });
      setHistory(r.data || []);
    } catch (e) { console.warn('Backup history fetch failed:', e?.message || e); }
  }, []);

  useEffect(() => {
    loadStatus();
    // Read query param set by Google callback redirect
    const params = new URLSearchParams(window.location.search);
    const drive = params.get('drive');
    if (drive === 'connected') {
      setMsg({ type: 'success', text: 'Google Drive connected successfully!' });
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (drive === 'error') {
      setMsg({ type: 'error', text: `Failed to connect Drive: ${params.get('reason') || 'unknown error'}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setMsg(null);
    try {
      const r = await api.get('/backup/google/connect');
      window.location.href = r.data.authorization_url;
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Failed to start Google auth' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Scheduled backups will stop uploading until you reconnect.')) return;
    const ok = await requireUnlock();
    if (!ok) return;
    try {
      await api.post('/backup/google/disconnect');
      setMsg({ type: 'success', text: 'Google Drive disconnected.' });
      loadStatus();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Failed to disconnect' });
    }
  };

  const handleRunNow = async () => {
    const ok = await requireUnlock();
    if (!ok) return;
    setRunning(true);
    setMsg(null);
    try {
      const r = await api.post('/backup/run');
      if (r.data.drive_uploaded) {
        setMsg({ type: 'success', text: `Backup uploaded to Google Drive (${fmtBytes(r.data.size_bytes)}).` });
      } else if (r.data.error) {
        setMsg({ type: 'warn', text: r.data.error });
      } else {
        setMsg({ type: 'success', text: `Backup saved locally (${fmtBytes(r.data.size_bytes)}).` });
      }
      loadStatus();
      if (showHistory) loadHistory();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Backup failed' });
    } finally { setRunning(false); }
  };

  const handleDownload = () => {
    downloadFile(`${API}/backup/download-latest`);
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  };

  const connected = status?.connected;

  return (
    <div className="card p-6 mb-4" data-testid="backup-card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Cloud size={18}/> Auto Backup
        </h2>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="badge badge-settled" data-testid="drive-status-connected">
              <CheckCircle2 size={10}/> Connected{status?.email ? ` · ${status.email}` : ''}
            </span>
          ) : (
            <span className="badge badge-outstanding" data-testid="drive-status-disconnected">
              <CloudOff size={10}/> Not Connected
            </span>
          )}
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
        Automatic full-database backup to your Google Drive every <strong>{status?.interval_hours ?? 6} hours</strong>.
        A local copy is also kept on the server. We keep the <strong>last {status?.retention_count ?? 30}</strong> backups and auto-delete older ones.
        You can also trigger a backup manually or download the latest JSON at any time.
      </p>

      {/* Status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>Last Backup</div>
          <div className="font-mono-data text-sm font-semibold mt-1" data-testid="backup-last-at" style={{ color: 'var(--cc-dark-green)' }}>
            {fmtDate(status?.last_backup_at)}
          </div>
          {status?.last_backup_at && (
            <div className="text-xs mt-0.5" style={{ color: status?.last_backup_ok ? '#065F46' : '#92400E' }}>
              {status?.last_backup_ok ? 'Uploaded to Drive' : 'Local only'}
            </div>
          )}
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>Next Scheduled Run</div>
          <div className="font-mono-data text-sm font-semibold mt-1" data-testid="backup-next-at" style={{ color: 'var(--cc-dark-green)' }}>
            {fmtDate(status?.next_run_at)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>Every {status?.interval_hours ?? 6}h</div>
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>Retention</div>
          <div className="font-mono-data text-sm font-semibold mt-1" style={{ color: 'var(--cc-dark-green)' }}>
            Last {status?.retention_count ?? 30} kept
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>Older auto-deleted</div>
        </div>
      </div>

      {msg && (
        <div
          className="text-sm rounded-md p-2.5 mb-3 flex items-start gap-2"
          style={msg.type === 'error'
            ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : msg.type === 'warn'
            ? { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="backup-message"
        >
          {msg.type === 'error' && <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
          {msg.type === 'success' && <CheckCircle2 size={14} className="mt-0.5 shrink-0"/>}
          {msg.type === 'warn' && <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {connected ? (
          <button onClick={handleDisconnect} className="btn btn-outline" data-testid="btn-disconnect-drive">
            <Unlink size={14}/> Disconnect Google Drive
          </button>
        ) : (
          <button onClick={handleConnect} disabled={connecting} className="btn btn-primary" data-testid="btn-connect-drive">
            <LinkIcon size={14}/> {connecting ? 'Redirecting…' : 'Connect Google Drive'}
          </button>
        )}
        <button onClick={handleRunNow} disabled={running} className="btn btn-accent" data-testid="btn-run-backup-now">
          <Play size={14}/> {running ? 'Backing up…' : 'Run Backup Now'}
        </button>
        <button onClick={handleDownload} className="btn btn-outline" data-testid="btn-download-latest-backup">
          <Download size={14}/> Download Latest Backup
        </button>
        <button onClick={toggleHistory} className="btn btn-outline" data-testid="btn-toggle-backup-history">
          <History size={14}/> {showHistory ? 'Hide History' : 'Show History'}
        </button>
        <button onClick={() => { loadStatus(); if (showHistory) loadHistory(); }} className="btn btn-ghost" title="Refresh status" data-testid="btn-refresh-backup-status">
          <RefreshCcw size={14}/>
        </button>
      </div>

      {showHistory && (
        <div className="mt-4 overflow-x-auto" data-testid="backup-history-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--cc-surface)' }}>
                <th className="text-left px-3 py-2 font-semibold">Run At</th>
                <th className="text-left px-3 py-2 font-semibold">Trigger</th>
                <th className="text-left px-3 py-2 font-semibold">Size</th>
                <th className="text-left px-3 py-2 font-semibold">Drive</th>
                <th className="text-left px-3 py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={5} className="text-center py-4" style={{ color: 'var(--cc-text-muted)' }}>No backups yet.</td></tr>
              )}
              {history.map((h, i) => (
                <tr key={h.id || h.finished_at || h.created_at || `bk-${i}`} style={{ borderTop: '1px solid var(--cc-border)' }} data-testid={`backup-history-row-${i}`}>
                  <td className="px-3 py-2 font-mono-data text-xs">{fmtDate(h.finished_at || h.created_at)}</td>
                  <td className="px-3 py-2 capitalize">{h.trigger || 'manual'}</td>
                  <td className="px-3 py-2 font-mono-data text-xs">{fmtBytes(h.size_bytes)}</td>
                  <td className="px-3 py-2">
                    {h.drive_web_link ? (
                      <a href={h.drive_web_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        Open <LinkIcon size={11}/>
                      </a>
                    ) : (<span style={{ color: 'var(--cc-text-muted)' }}>—</span>)}
                  </td>
                  <td className="px-3 py-2">
                    {h.drive_uploaded ? (
                      <span className="badge badge-settled"><CheckCircle2 size={10}/> Uploaded</span>
                    ) : h.error ? (
                      <span className="badge badge-outstanding" title={h.error}><AlertCircle size={10}/> Local only</span>
                    ) : (
                      <span className="badge badge-outstanding">Local only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BackupCard;
