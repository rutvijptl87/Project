import React, { useEffect, useRef, useState } from 'react';
import { api, API } from '../lib/api';
import { Download, Database, ExternalLink, CheckCircle2, Upload } from 'lucide-react';
import BackupCard from '../components/BackupCard';
import RestoreCard from '../components/RestoreCard';
import UserManagementCard from '../components/UserManagementCard';
import DocumentTypesCard from '../components/DocumentTypesCard';

const SettingsPage = () => {
  const [stats, setStats] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const sqliteRef = useRef(null);

  useEffect(() => {
    api.get('/dashboard/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const handleSeed = async () => {
    if (!window.confirm('Seed demo data? This only runs if the database is empty.')) return;
    const r = await api.post('/seed');
    alert(r.data.seeded ? 'Demo data added!' : 'Data already exists.');
    const s = await api.get('/dashboard/stats');
    setStats(s.data);
  };

  const handleSqliteImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Import ${file.name}?\nThis will ADD new records to your existing data (duplicates skipped by project code / client name).`)) {
      if (sqliteRef.current) sqliteRef.current.value = '';
      return;
    }
    const replace = window.confirm('Do you also want to REPLACE all existing projects/clients/architects/payments with the imported data?\n\nClick OK to replace, Cancel to merge.');
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `/import/sqlite?replace=${replace ? 'true' : 'false'}`;
      const r = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { imported } = r.data;
      setImportMsg({ type: 'success', text: `Imported: ${imported.projects} projects, ${imported.clients} clients, ${imported.architects} architects, ${imported.payments} payments.` });
      const s = await api.get('/dashboard/stats');
      setStats(s.data);
    } catch (err) {
      setImportMsg({ type: 'error', text: err?.response?.data?.detail || 'Import failed' });
    } finally {
      setImporting(false);
      if (sqliteRef.current) sqliteRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="settings-page">
      <h1 className="font-head text-3xl md:text-4xl font-extrabold mb-1" style={{ color: 'var(--cc-dark-green)' }}>Settings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>Manage your data, backups and imports.</p>

      {/* Account & users */}
      <UserManagementCard />

      {/* Google Drive Auto-Backup */}
      <BackupCard />

      {/* Restore from backup */}
      <RestoreCard />

      {/* Document number series management */}
      <div className="mb-4"><DocumentTypesCard /></div>

      <div className="card p-6 mb-4">
        <h2 className="font-head text-xl font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Database Summary</h2>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Projects" value={stats.total_projects} />
            <Stat label="Clients" value={stats.total_clients} />
            <Stat label="Architects" value={stats.total_architects} />
            <Stat label="Offers" value={stats.total_offers || 0} />
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading...</div>
        )}
      </div>

      <div className="card p-6 mb-4">
        <h2 className="font-head text-xl font-bold mb-3" style={{ color: 'var(--cc-dark-green)' }}>Data Management</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
          Export your full database as a multi-sheet Excel file, or import historic projects from a similar file.
        </p>
        <div className="flex gap-2 flex-wrap">
          <a href={`${API}/export/excel`} className="btn btn-primary" data-testid="settings-btn-export">
            <Download size={15}/> Export All to Excel
          </a>
          <button onClick={handleSeed} className="btn btn-outline" data-testid="settings-btn-seed">
            <Database size={15}/> Seed Demo Data
          </button>
        </div>
      </div>

      {/* SQLite Import */}
      <div className="card p-6 mb-4" data-testid="sqlite-import-card">
        <h2 className="font-head text-xl font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>Import SQLite DB</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
          Import data from a legacy SQLite .db file. The file should contain tables: clients, architects, projects, payments.
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="file"
            accept=".db,.sqlite,.sqlite3"
            ref={sqliteRef}
            onChange={handleSqliteImport}
            className="hidden"
            data-testid="sqlite-file-input"
          />
          <button
            type="button"
            onClick={() => sqliteRef.current?.click()}
            disabled={importing}
            className="btn btn-accent"
            data-testid="btn-import-sqlite"
          >
            <Upload size={15}/> {importing ? 'Importing...' : 'Import SQLite DB'}
          </button>
        </div>
        {importMsg && (
          <div
            className="text-sm rounded-md p-2.5 mt-3 flex items-center gap-2"
            style={importMsg.type === 'error'
              ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
              : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
            data-testid="import-message"
          >
            {importMsg.type === 'success' && <CheckCircle2 size={14}/>}
            {importMsg.text}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-head text-xl font-bold mb-2" style={{ color: 'var(--cc-dark-green)' }}>Import Historic Format</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
          Go to the Projects page and click <strong>Import Historic</strong>. Your Excel file should contain these sheets/columns:
        </p>
        <div className="text-xs space-y-2 font-mono-data rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div><strong>Projects sheet:</strong> Project ID · Project Name · Client · Architect · Site Location · Quoted (INR) · Received (INR) · Outstanding (INR) · Status · Notes</div>
          <div><strong>Clients sheet:</strong> Name · Phone · Email · Company · Address</div>
          <div><strong>Architects sheet:</strong> Name · Phone · Email · Firm</div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--cc-text-muted)' }}>
          Tip: Export first to see the exact format, then fill with your historic data and re-import.
        </p>
      </div>

      <div className="mt-8 text-xs flex items-center gap-2" style={{ color: 'var(--cc-text-muted)' }}>
        Built with <span className="font-semibold" style={{ color: 'var(--cc-dark-green)' }}>Creator Consultant</span>
        <ExternalLink size={11}/>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
    <div className="font-mono-data text-2xl font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{value}</div>
  </div>
);

export default SettingsPage;
