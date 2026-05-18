import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { logger } from '../lib/logger';
import { Users, UserPlus, KeyRound, CheckCircle2, AlertCircle, Trash2, ShieldCheck, RotateCcw } from 'lucide-react';

const fmtErr = (detail, fallback = 'Something went wrong') => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(', ');
  if (detail?.msg) return detail.msg;
  return fallback;
};

const UserManagementCard = () => {
  const { user, refresh } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Add user form
  const [newU, setNewU] = useState('');
  const [newP, setNewP] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState(null);

  // Reset password modal
  const [resettingId, setResettingId] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetting, setResetting] = useState(false);

  // Change MY password
  const [oldPw, setOldPw] = useState('');
  const [myNewPw, setMyNewPw] = useState('');
  const [myNewPw2, setMyNewPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Change MY username
  const [newUsername, setNewUsername] = useState('');
  const [unameSaving, setUnameSaving] = useState(false);
  const [unameMsg, setUnameMsg] = useState(null);

  const isAdmin = user?.role === 'admin';

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const r = await api.get('/auth/users');
      setUsers(r.data || []);
    } catch (e) { logger.error('User list fetch failed:', e); }
    finally { setLoadingUsers(false); }
  }, [isAdmin]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddMsg(null);
    if (!newU.trim() || !newP || newP.length < 4) {
      setAddMsg({ type: 'error', text: 'Username and a password (min 4 chars) are required' });
      return;
    }
    setAdding(true);
    try {
      await api.post('/auth/users', {
        username: newU.trim(),
        password: newP,
        name: newName.trim(),
        role: newRole,
      });
      setAddMsg({ type: 'success', text: `User ${newU.trim().toLowerCase()} added.` });
      setNewU(''); setNewP(''); setNewName(''); setNewRole('staff');
      loadUsers();
    } catch (err) {
      setAddMsg({ type: 'error', text: fmtErr(err?.response?.data?.detail, 'Failed to add user') });
    } finally { setAdding(false); }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      loadUsers();
    } catch (err) {
      alert(fmtErr(err?.response?.data?.detail, 'Failed to delete user'));
    }
  };

  const handleToggleRole = async (u) => {
    const next = u.role === 'admin' ? 'staff' : 'admin';
    if (!window.confirm(`Change role of "${u.username}" from ${u.role} to ${next}?`)) return;
    try {
      await api.put(`/auth/users/${u.id}`, { role: next });
      loadUsers();
    } catch (err) {
      alert(fmtErr(err?.response?.data?.detail, 'Failed to change role'));
    }
  };

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 4) return alert('Password must be at least 4 characters');
    setResetting(true);
    try {
      await api.put(`/auth/users/${resettingId}`, { password: resetPw });
      setResettingId(null); setResetPw('');
      alert('Password reset successfully.');
    } catch (err) {
      alert(fmtErr(err?.response?.data?.detail, 'Failed to reset password'));
    } finally { setResetting(false); }
  };

  const handleChangeMyPassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (myNewPw !== myNewPw2) return setPwMsg({ type: 'error', text: 'New passwords do not match' });
    if (myNewPw.length < 4) return setPwMsg({ type: 'error', text: 'New password must be at least 4 characters' });
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: oldPw, new_password: myNewPw });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setOldPw(''); setMyNewPw(''); setMyNewPw2('');
    } catch (err) {
      setPwMsg({ type: 'error', text: fmtErr(err?.response?.data?.detail, 'Failed to change password') });
    } finally { setPwSaving(false); }
  };

  const handleChangeMyUsername = async (e) => {
    e.preventDefault();
    setUnameMsg(null);
    if (!newUsername.trim()) return setUnameMsg({ type: 'error', text: 'Enter a username' });
    setUnameSaving(true);
    try {
      await api.post('/auth/change-username', { new_username: newUsername.trim() });
      setUnameMsg({ type: 'success', text: 'Username changed. Please re-login next time you sign in.' });
      setNewUsername('');
      refresh();
    } catch (err) {
      setUnameMsg({ type: 'error', text: fmtErr(err?.response?.data?.detail, 'Failed to change username') });
    } finally { setUnameSaving(false); }
  };

  const StatusMsg = ({ msg, testId }) => msg ? (
    <div
      className="text-sm rounded-md p-2.5 flex items-center gap-2"
      style={msg.type === 'error'
        ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
        : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
      data-testid={testId}
    >
      {msg.type === 'success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
      {msg.text}
    </div>
  ) : null;

  return (
    <>
      {/* My account */}
      <div className="card p-6 mb-4" data-testid="my-account-card">
        <h2 className="font-head text-xl font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <KeyRound size={18}/> My Account
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
          Logged in as <strong className="font-mono-data">{user?.username}</strong>
          {' '}<span className="badge badge-settled">{user?.role}</span>
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Change password */}
          <form onSubmit={handleChangeMyPassword} className="space-y-3" data-testid="change-password-form">
            <h3 className="font-semibold text-sm mb-1">Change password</h3>
            <input type="password" className="input" placeholder="Current password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" data-testid="cp-current"/>
            <input type="password" className="input" placeholder="New password" value={myNewPw} onChange={(e) => setMyNewPw(e.target.value)} autoComplete="new-password" data-testid="cp-new"/>
            <input type="password" className="input" placeholder="Confirm new password" value={myNewPw2} onChange={(e) => setMyNewPw2(e.target.value)} autoComplete="new-password" data-testid="cp-confirm"/>
            <StatusMsg msg={pwMsg} testId="cp-msg" />
            <button type="submit" disabled={pwSaving} className="btn btn-primary" data-testid="btn-change-password">
              {pwSaving ? 'Saving…' : 'Change Password'}
            </button>
          </form>

          {/* Change username */}
          <form onSubmit={handleChangeMyUsername} className="space-y-3" data-testid="change-username-form">
            <h3 className="font-semibold text-sm mb-1">Change username</h3>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              Pick a new username. You'll keep using your current password.
            </p>
            <input className="input font-mono-data" placeholder="new username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} data-testid="cu-input"/>
            <StatusMsg msg={unameMsg} testId="cu-msg" />
            <button type="submit" disabled={unameSaving} className="btn btn-outline" data-testid="btn-change-username">
              {unameSaving ? 'Saving…' : 'Change Username'}
            </button>
          </form>
        </div>
      </div>

      {/* User management — admin only */}
      {isAdmin && (
        <div className="card p-6 mb-4" data-testid="user-management-card">
          <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <Users size={18}/> User Management
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>
            Add, remove, or manage users who can sign into Creator Consultant. Admins can manage users; staff can use the app but can't add/remove others.
          </p>

          {/* Add user */}
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4" data-testid="add-user-form">
            <input className="input md:col-span-1" placeholder="Username" value={newU} onChange={(e) => setNewU(e.target.value)} data-testid="add-user-username"/>
            <input className="input md:col-span-1" placeholder="Display name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="add-user-name"/>
            <input type="password" className="input md:col-span-1" placeholder="Password" value={newP} onChange={(e) => setNewP(e.target.value)} data-testid="add-user-password"/>
            <select className="select md:col-span-1" value={newRole} onChange={(e) => setNewRole(e.target.value)} data-testid="add-user-role">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={adding} className="btn btn-primary md:col-span-1" data-testid="btn-add-user">
              <UserPlus size={14}/> {adding ? 'Adding…' : 'Add User'}
            </button>
          </form>

          <StatusMsg msg={addMsg} testId="add-user-msg" />

          {/* Users list */}
          <div className="overflow-x-auto mt-3">
            <table className="cc-table" data-testid="users-table">
              <thead>
                <tr><th>Username</th><th>Name</th><th>Role</th><th>Created</th><th>Last Login</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--cc-text-muted)' }}>Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6">No users yet.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} data-testid={`user-row-${u.username}`}>
                    <td className="font-mono-data text-sm">{u.username}</td>
                    <td className="text-sm">{u.name || '—'}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-settled' : 'badge-outstanding'}`}>{u.role}</span></td>
                    <td className="text-xs font-mono-data">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="text-xs font-mono-data">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
                    <td>
                      <div className="flex gap-1 justify-end flex-wrap">
                        <button
                          className="btn btn-outline btn-sm"
                          title="Reset password"
                          onClick={() => { setResettingId(u.id); setResetPw(''); }}
                          data-testid={`btn-reset-pw-${u.username}`}
                        ><RotateCcw size={12}/></button>
                        {u.id !== user.id && (
                          <>
                            <button
                              className="btn btn-outline btn-sm"
                              title="Toggle admin/staff"
                              onClick={() => handleToggleRole(u)}
                              data-testid={`btn-toggle-role-${u.username}`}
                            ><ShieldCheck size={12}/></button>
                            <button
                              className="btn btn-danger btn-sm"
                              title="Delete user"
                              onClick={() => handleDeleteUser(u)}
                              data-testid={`btn-delete-user-${u.username}`}
                            ><Trash2 size={12}/></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reset password modal (inline) */}
          {resettingId && (
            <div className="rounded-lg border p-4 mt-3" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }} data-testid="reset-pw-form">
              <h4 className="font-semibold mb-2 text-sm">Set new password for this user</h4>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  className="input flex-1 min-w-[200px]"
                  placeholder="New password (min 4 chars)"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  data-testid="reset-pw-input"
                />
                <button onClick={handleResetPassword} disabled={resetting} className="btn btn-primary" data-testid="btn-reset-pw-confirm">
                  {resetting ? 'Saving…' : 'Set Password'}
                </button>
                <button onClick={() => { setResettingId(null); setResetPw(''); }} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default UserManagementCard;
