import axios from 'axios';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

export const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

// Restore token on page load so the very first request after a refresh works.
const _stored = typeof window !== 'undefined' ? localStorage.getItem('cc_auth_token') : null;
if (_stored) api.defaults.headers.common['Authorization'] = `Bearer ${_stored}`;

// Intercept requests to clean up Content-Type when sending FormData so browser attaches correct boundary
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }
  return config;
});

// Legacy no-op kept for backwards compatibility with old imports
export const registerUnlockFn = () => {};

export default api;
