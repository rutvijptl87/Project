import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api } from './api';

const TOKEN_KEY = 'cc_auth_token';
const USER_KEY = 'cc_auth_user';

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const installToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setUser(null); setLoading(false); return; }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
      localStorage.setItem(USER_KEY, JSON.stringify(r.data));
    } catch {
      installToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Global 401 handler — clear session and force re-login
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          // Don't bounce on the login call itself — let the caller see the error
          const url = err?.config?.url || '';
          if (!url.endsWith('/auth/login')) {
            installToken(null);
            setUser(null);
          }
        }
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await api.post('/auth/login', { username, password });
    installToken(r.data.token);
    setUser(r.data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(r.data.user));
    return r.data.user;
  }, []);

  const logout = useCallback(() => {
    installToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
