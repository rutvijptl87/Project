import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Lock, User, AlertCircle, LogIn , X } from 'lucide-react';

const formatErr = (detail, fallback) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(', ');
  if (detail?.msg) return detail.msg;
  return fallback;
};

const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      // Auth context will update; the route guard re-renders the app.
    } catch (err) {
      setError(formatErr(err?.response?.data?.detail, 'Login failed. Please check your credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'linear-gradient(135deg, #0A2E1F 0%, #134E2E 60%, #1F5A3F 100%)',
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <img
            src="/logo.jpg"
            alt="Creator Consultant"
            className="h-16 w-auto mx-auto mb-3 rounded-lg shadow-lg bg-white p-1.5"
          />
          <div className="text-white/95 font-head font-extrabold tracking-tight text-2xl">CREATOR</div>
          <div className="text-emerald-300 font-head font-medium text-[11px] tracking-[0.4em]">CONSULTANT</div>
        </div>

        <div
          className="rounded-2xl shadow-2xl p-7 backdrop-blur"
          style={{ background: 'rgba(255,255,255,0.97)' }}
        >
          <h1 className="font-head text-2xl font-bold mb-1" style={{ color: 'var(--cc-dark-green)' }}>Sign in</h1>
          <p className="text-sm mb-5" style={{ color: 'var(--cc-text-muted)' }}>
            Enter your credentials to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  placeholder="rutvij0213"
                  data-testid="login-username-input"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  className="input pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your password"
                  data-testid="login-password-input"
                />
              </div>
            </div>

            {error && (
              <div
                className="rounded-md p-2.5 text-sm flex items-start gap-2"
                style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' }}
                data-testid="login-error"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full justify-center"
              data-testid="login-submit-btn"
            >
              <LogIn size={15} /> {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4 text-white/70">
          Sessions expire after 24 hours — re-login each day for security.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
