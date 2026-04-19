import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, registerUnlockFn } from './api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const SESSION_KEY = 'cc_unlocked';

export const AuthProvider = ({ children }) => {
  const [passwordSet, setPasswordSet] = useState(null); // null = loading
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('verify'); // 'verify' | 'setup'
  const pendingResolve = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get('/auth/status');
      setPasswordSet(r.data.password_set);
    } catch {
      setPasswordSet(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Auto-unlock when no password is set yet
  useEffect(() => {
    if (passwordSet === false) setUnlocked(true);
  }, [passwordSet]);

  const markUnlocked = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setUnlocked(true);
  };

  const lock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  };

  const requireUnlock = useCallback(() => {
    // Returns a Promise that resolves to true if unlocked, false if cancelled
    return new Promise((resolve) => {
      if (passwordSet === false) {
        // No password set: either auto-allow or prompt to set one first
        setModalMode('setup');
        pendingResolve.current = resolve;
        setModalOpen(true);
        return;
      }
      if (unlocked) { resolve(true); return; }
      setModalMode('verify');
      pendingResolve.current = resolve;
      setModalOpen(true);
    });
  }, [unlocked, passwordSet]);

  // Force a fresh password prompt regardless of unlocked state — used for destructive actions like delete.
  const forceVerify = useCallback(() => {
    return new Promise((resolve) => {
      if (passwordSet === false) {
        setModalMode('setup');
        pendingResolve.current = resolve;
        setModalOpen(true);
        return;
      }
      setModalMode('verify-delete');
      pendingResolve.current = resolve;
      setModalOpen(true);
    });
  }, [passwordSet]);

  // Register requireUnlock globally so axios interceptor can call it
  useEffect(() => {
    registerUnlockFn(requireUnlock);
  }, [requireUnlock]);

  const handleModalResult = (ok) => {
    setModalOpen(false);
    if (pendingResolve.current) {
      pendingResolve.current(ok);
      pendingResolve.current = null;
    }
  };

  return (
    <AuthContext.Provider value={{ passwordSet, unlocked, requireUnlock, forceVerify, lock, markUnlocked, refreshStatus: loadStatus }}>
      {children}
      {modalOpen && (
        <PasswordModal
          mode={modalMode}
          onClose={() => handleModalResult(false)}
          onSuccess={() => {
            if (modalMode !== 'verify-delete') markUnlocked();
            loadStatus();
            handleModalResult(true);
          }}
        />
      )}
    </AuthContext.Provider>
  );
};

// Local modal (inline to avoid circular imports)
const PasswordModal = ({ mode, onClose, onSuccess }) => {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!pw || pw.length < 4) { setErr('Password must be at least 4 characters'); return; }
    setBusy(true);
    try {
      if (mode === 'setup') {
        await api.post('/auth/set-password', { new_password: pw });
      } else {
        // verify and verify-delete both call /auth/verify
        await api.post('/auth/verify', { password: pw });
      }
      onSuccess();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="password-modal-overlay">
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} data-testid="password-modal">
        <div className="p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold" style={{ color: mode === 'verify-delete' ? '#DC2626' : 'var(--cc-dark-green)' }}>
            {mode === 'setup' && '🔐 Set Edit Password'}
            {mode === 'verify' && '🔒 Enter Password to Edit'}
            {mode === 'verify-delete' && '⚠️  Confirm Delete — Enter Password'}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            {mode === 'setup' && 'No password is set yet. Please set one to protect edit actions. You can change it later from Settings.'}
            {mode === 'verify' && 'This password protects edit, delete, create and convert actions. It stays unlocked until you close the tab.'}
            {mode === 'verify-delete' && 'Delete is permanent. Please re-enter your password to confirm this destructive action.'}
          </p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="label">{mode === 'setup' ? 'New Password *' : 'Password *'}</label>
            <input
              autoFocus
              type="password"
              className="input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter password"
              data-testid="password-modal-input"
            />
          </div>
          {err && <div className="text-sm text-red-600" data-testid="password-modal-error">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" data-testid="password-modal-cancel">Cancel</button>
            <button type="submit" disabled={busy} className={`btn ${mode === 'verify-delete' ? 'btn-danger' : 'btn-primary'}`} data-testid="password-modal-submit">
              {busy ? 'Checking...' : (mode === 'setup' ? 'Set & Unlock' : (mode === 'verify-delete' ? 'Confirm Delete' : 'Unlock'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
