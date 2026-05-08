import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

// Restore token on page load so the very first request after a refresh works.
const _stored = typeof window !== 'undefined' ? localStorage.getItem('cc_auth_token') : null;
if (_stored) api.defaults.headers.common['Authorization'] = `Bearer ${_stored}`;

// Legacy no-op kept for backwards compatibility with old imports
export const registerUnlockFn = () => {};

export default api;
