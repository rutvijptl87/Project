import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

// Global unlock hook — set by AuthProvider
let _requireUnlock = null;
export const registerUnlockFn = (fn) => { _requireUnlock = fn; };

// Paths that are NEVER gated (even on POST)
const OPEN_WRITE_PATHS = [
  '/auth/verify',
  '/auth/status',
  '/auth/set-password',
];

const isOpenPath = (url) => {
  if (!url) return false;
  return OPEN_WRITE_PATHS.some((p) => url.includes(p));
};

// Intercept all mutating requests (POST / PUT / PATCH / DELETE) to require unlock
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method === 'get' || method === 'head' || method === 'options') return config;
  if (isOpenPath(config.url)) return config;
  if (_requireUnlock) {
    const ok = await _requireUnlock();
    if (!ok) {
      // Cancel the request
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      source.cancel('Locked');
    }
  }
  return config;
});

export default api;
