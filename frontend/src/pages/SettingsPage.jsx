import React, { useEffect, useState } from 'react';
import { api, API } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Download, Database, ExternalLink, Lock, Unlock, KeyRound, CheckCircle2 } from 'lucide-react';

const SettingsPage = () => {
  const [stats, setStats] = useState(null);
  const { passwordSet, unlocked, lock, refreshStatus } = useAuth();
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

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

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }
    if (newPw.length < 4) {
      setPwMsg({ type: 'error', text: 'New password must be at least 4 characters' });
      return;
    }
    setSaving(true);
    try {
      const payload = { new_password: newPw };
      if (passwordSet) payload.current_password = curPw;
      await api.post('/auth/set-password', payload);
      setPwMsg({ type: 'success', text: passwordSet ? 'Password changed successfully!' : 'Password set! Edits are now protected.' });
      setCurPw(''); setNewPw(''); setConfirmPw('');
      refreshStatus();
    } catch (err) {
      setPwMsg({ type: 'error', text: err?.response?.data?.detail || 'Failed to change password' });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="settings-page">
      <h1 className="font-head text-3xl md:text-4xl font-extrabold mb-1" style={{ color: 'var(--cc-dark-green)' }}>Settings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>Manage your data, exports and security.</p>

      {/* Security */}
      <div className="card p-6 mb-4" data-testid="security-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <KeyRound size={18}/> Edit Password
          </h2>
          <div className="flex items-center gap-2">
            {passwordSet ? (
              unlocked ? (
                <>
                  <span className="badge badge-settled" data-testid="lock-status-unlocked"><Unlock size={10}/> Unlocked</span>
                  <button onClick={lock} className="btn btn-outline btn-sm" data-testid="btn-lock-now"><Lock size={12}/> Lock Now</button>
                </>
              ) : (
                <span className="badge badge-outstanding" data-testid="lock-status-locked"><Lock size={10}/> Locked</span>
              )
            ) : (
              <span className="badge badge-outstanding" data-testid="lock-status-not-set">Not Set</span>
            )}
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
          {passwordSet
            ? 'A password is already set. It protects all edit, create, delete, convert and payment actions. Unlock persists until you close the tab.'
            : 'No password set yet. Edit actions are currently OPEN. Set one below to protect your data.'}
        </p>

        <form onSubmit={changePassword} className="space-y-3 max-w-md" data-testid="change-password-form">
          {passwordSet && (
            <div>
              <label className="label">Current Password *</label>
              <input type="password" className="input" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Enter current password" data-testid="current-password-input" autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className="label">{passwordSet ? 'New Password *' : 'Set Password *'}</label>
            <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 4 characters" data-testid="new-password-input" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm {passwordSet ? 'New ' : ''}Password *</label>
            <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter password" data-testid="confirm-password-input" autoComplete="new-password" />
          </div>

          {pwMsg && (
            <div
              className="text-sm rounded-md p-2.5 flex items-center gap-2"
              style={pwMsg.type === 'error'
                ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
                : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
              data-testid="password-message"
            >
              {pwMsg.type === 'success' && <CheckCircle2 size={14}/>}
              {pwMsg.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary" data-testid="btn-change-password">
            {saving ? 'Saving...' : (passwordSet ? 'Change Password' : 'Set Password')}
          </button>
        </form>
      </div>

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
