import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

// Legacy no-op kept so existing imports (auth.jsx) don't break
export const registerUnlockFn = () => {};

export default api;
