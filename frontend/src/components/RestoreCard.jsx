import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { api, API } from '../lib/api';
import {
  Upload, CheckCircle2, AlertCircle, RefreshCcw, FileJson,
  HardDrive, Cloud, FilePlus, X,
} from 'lucide-react';

const fmtBytes = (n) => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
};

const RestoreCard = () => {
  // Source: 'local' | 'drive'
  const [source, setSource] = useState('local');

  // Local file flow
  const [localFile, setLocalFile] = useState(null);

  // Drive flow
  const [driveBackups, setDriveBackups] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [selectedDriveId, setSelectedDriveId] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadDriveBackups = useCallback(async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const r = await api.get('/backup/drive/backups');
      setDriveBackups(r.data || []);
    } catch (e) {
      setDriveError(e?.response?.data?.detail || 'Failed to load Drive backups (connect Drive in the card above)');
    } finally { setDriveLoading(false); }
  }, []);

  useEffect(() => {
    if (source === 'drive') loadDriveBackups();
  }, [source, loadDriveBackups]);

  const resetAll = () => {
    setLocalFile(null); setSelectedDriveId('');
    setPreview(null); setConfirmText(''); setResult(null); setError(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.json')) {
      setError('Please select a .json backup file');
      return;
    }
    setLocalFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setConfirmText('');
  };

  const doPreview = async () => {
    setPreviewing(true); setError(null); setPreview(null);
    try {
      if (source === 'local') {
        if (!localFile) throw new Error('Pick a file first');
        const fd = new FormData();
        fd.append('file', localFile);
        const r = await axios.post(`${API}/backup/restore/preview`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPreview(r.data);
      } else {
        // For Drive we can't preview-without-restore without adding another endpoint;
        // show the file metadata + a gentle note and let user confirm to restore.
        const meta = driveBackups.find((b) => b.id === selectedDriveId);
        if (!meta) throw new Error('Pick a Drive backup');
        setPreview({ drive_only: true, file: meta });
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to preview');
    } finally { setPreviewing(false); }
  };

  const doRestore = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESTORE') {
      setError('Type RESTORE to confirm');
      return;
    }
    setRestoring(true); setError(null); setResult(null);
    try {
      let r;
      if (source === 'local') {
        const fd = new FormData();
        fd.append('file', localFile);
        fd.append('confirm', 'RESTORE');
        r = await axios.post(`${API}/backup/restore`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        r = await api.post('/backup/restore/drive', {
          file_id: selectedDriveId,
          confirm: 'RESTORE',
        });
      }
      setResult(r.data);
      // Auto-refresh after a moment so user sees the success banner first
      setTimeout(() => { window.location.reload(); }, 4000);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Restore failed');
    } finally { setRestoring(false); }
  };

  const canPreview = source === 'local' ? !!localFile : !!selectedDriveId;
  const canRestore = !!preview && confirmText.trim().toUpperCase() === 'RESTORE';

  // Success banner
  if (result) {
    const perCol = result.added_per_collection || {};
    const summary = Object.entries(perCol)
      .filter(([, n]) => n > 0)
      .map(([col, n]) => `${n} ${col.replace(/_/g, ' ')}`)
      .join(', ');
    return (
      <div className="card p-6 mb-4" data-testid="restore-success-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-full p-2" style={{ background: '#D1FAE5' }}>
            <CheckCircle2 size={22} style={{ color: '#065F46' }}/>
          </div>
          <div>
            <h2 className="font-head text-xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>Restore Complete</h2>
            <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>From: {result.filename}</p>
          </div>
        </div>
        <p className="text-sm mb-3">
          <strong>Restored {result.total_added} new record{result.total_added === 1 ? '' : 's'}</strong>
          {summary ? ` — ${summary}.` : '.'}
          {result.total_skipped > 0 && <> <span style={{ color: 'var(--cc-text-muted)' }}>({result.total_skipped} records were already present and skipped.)</span></>}
        </p>
        {result.errors && result.errors.length > 0 && (
          <div className="rounded-md p-2.5 text-xs mb-2" style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E' }}>
            Warnings: {result.errors.slice(0, 3).join(' · ')}
          </div>
        )}
        <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
          Page will refresh in 4 seconds so all lists reflect the restored data…
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 mb-4" data-testid="restore-card">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Upload size={18}/> Restore from Backup
        </h2>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
        Merge records from a backup JSON file. <strong>Only records that don't already exist will be added</strong> — existing data is never overwritten.
        A safety snapshot of your current database is taken automatically before the restore runs.
      </p>

      {/* Source toggle */}
      <div className="inline-flex rounded-lg border p-1 mb-4" style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
        <button
          onClick={() => { setSource('local'); resetAll(); }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${source === 'local' ? 'bg-white shadow-sm' : ''}`}
          style={source === 'local' ? { color: 'var(--cc-dark-green)' } : { color: 'var(--cc-text-muted)' }}
          data-testid="restore-source-local"
        >
          <HardDrive size={14}/> My Computer
        </button>
        <button
          onClick={() => { setSource('drive'); resetAll(); }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${source === 'drive' ? 'bg-white shadow-sm' : ''}`}
          style={source === 'drive' ? { color: 'var(--cc-dark-green)' } : { color: 'var(--cc-text-muted)' }}
          data-testid="restore-source-drive"
        >
          <Cloud size={14}/> Google Drive
        </button>
      </div>

      {/* File picker / Drive list */}
      {source === 'local' ? (
        <div className="mb-4" data-testid="restore-local-zone">
          <label
            htmlFor="restore-file-input"
            className="flex items-center gap-3 rounded-lg border border-dashed p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: 'var(--cc-border)' }}
          >
            <FilePlus size={20} style={{ color: 'var(--cc-accent)' }} />
            <div className="flex-1 min-w-0">
              {localFile ? (
                <>
                  <div className="font-mono-data text-sm font-semibold truncate">{localFile.name}</div>
                  <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{fmtBytes(localFile.size)} · JSON backup</div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-sm">Choose a backup JSON file</div>
                  <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Usually downloaded via "Download Latest Backup"</div>
                </>
              )}
            </div>
            {localFile && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLocalFile(null); setPreview(null); setConfirmText(''); }}
                className="p-1 rounded hover:bg-gray-100"
                title="Remove file"
                data-testid="btn-clear-restore-file"
              ><X size={14}/></button>
            )}
          </label>
          <input
            id="restore-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
            data-testid="restore-file-input"
          />
        </div>
      ) : (
        <div className="mb-4" data-testid="restore-drive-zone">
          {driveLoading ? (
            <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading Drive backups…</div>
          ) : driveError ? (
            <div className="rounded-md p-3 text-sm flex items-start gap-2" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
              <AlertCircle size={14} className="mt-0.5"/>
              <div>
                <div>{driveError}</div>
                <button onClick={loadDriveBackups} className="text-xs underline mt-1">Retry</button>
              </div>
            </div>
          ) : driveBackups.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>No backups found in your Drive folder yet.</div>
          ) : (
            <>
              <label className="label">Pick a backup from your Drive</label>
              <select
                className="select"
                value={selectedDriveId}
                onChange={(e) => { setSelectedDriveId(e.target.value); setPreview(null); setConfirmText(''); }}
                data-testid="restore-drive-select"
              >
                <option value="">— Select a backup —</option>
                {driveBackups.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {fmtBytes(b.size)} · {fmtDate(b.created_time)}
                  </option>
                ))}
              </select>
              <button onClick={loadDriveBackups} className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: 'var(--cc-accent)' }}>
                <RefreshCcw size={10}/> Refresh list
              </button>
            </>
          )}
        </div>
      )}

      {/* Preview section */}
      {!preview && (
        <button
          onClick={doPreview}
          disabled={!canPreview || previewing}
          className="btn btn-outline"
          data-testid="btn-preview-restore"
        >
          <FileJson size={14}/> {previewing ? 'Previewing…' : 'Preview what will be added'}
        </button>
      )}

      {preview && !preview.drive_only && (
        <div className="rounded-lg border p-3 my-3 text-sm" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }} data-testid="restore-preview">
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <div>
              <span className="font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{preview.total_would_add} new record{preview.total_would_add === 1 ? '' : 's'} will be added.</span>
              {preview.total_already_exists > 0 && <span style={{ color: 'var(--cc-text-muted)' }}> · {preview.total_already_exists} already exist and will be skipped.</span>}
            </div>
            <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Backup from: {fmtDate(preview.generated_at)}</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--cc-text-muted)' }}>
                <th className="text-left py-1">Collection</th>
                <th className="text-right py-1">In Backup</th>
                <th className="text-right py-1" style={{ color: 'var(--cc-dark-green)' }}>Will Add</th>
                <th className="text-right py-1">Already Exist</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview.per_collection || {}).map(([col, s]) => (
                <tr key={col} style={{ borderTop: '1px solid var(--cc-border)' }}>
                  <td className="py-1 capitalize">{col.replace(/_/g, ' ')}</td>
                  <td className="text-right py-1 font-mono-data">{s.in_backup}</td>
                  <td className="text-right py-1 font-mono-data font-semibold" style={{ color: s.would_add > 0 ? 'var(--cc-dark-green)' : 'var(--cc-text-muted)' }}>{s.would_add}</td>
                  <td className="text-right py-1 font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>{s.already_exists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && preview.drive_only && (
        <div className="rounded-lg border p-3 my-3 text-sm" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }} data-testid="restore-preview-drive">
          <div className="font-semibold mb-1">{preview.file.name}</div>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            Size: {fmtBytes(preview.file.size)} · Created: {fmtDate(preview.file.created_time)}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--cc-text-muted)' }}>
            The file will be downloaded from your Drive and merged. Only records not already in the database will be added.
          </p>
        </div>
      )}

      {/* Confirm + Restore */}
      {preview && (
        <div className="space-y-2 mt-3" data-testid="restore-confirm-zone">
          <label className="label">
            Type <strong className="font-mono-data" style={{ color: '#DC2626' }}>RESTORE</strong> to confirm
          </label>
          <input
            className="input font-mono-data"
            placeholder="RESTORE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            data-testid="restore-confirm-input"
          />
          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={resetAll} className="btn btn-outline" data-testid="btn-restore-reset">Cancel</button>
            <button
              onClick={doRestore}
              disabled={!canRestore || restoring}
              className="btn btn-primary"
              data-testid="btn-restore-confirm"
            >
              <Upload size={14}/> {restoring ? 'Restoring…' : 'Restore Now'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md p-2.5 mt-3 text-sm flex items-start gap-2" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' }} data-testid="restore-error">
          <AlertCircle size={14} className="mt-0.5 shrink-0"/> <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default RestoreCard;
