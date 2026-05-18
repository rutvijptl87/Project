import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { logger } from './logger';

let _cache = null;
let _cacheAt = 0;
const TTL = 60 * 1000; // 1 minute

/**
 * Fetches the user directory once per minute and shares it across the app.
 * Returns { users, byUsername(name), refresh() }.
 */
export const useUserDirectory = () => {
  const [users, setUsers] = useState(_cache || []);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/auth/users/directory');
      _cache = r.data || [];
      _cacheAt = Date.now();
      setUsers(_cache);
      setTick((t) => t + 1);
    } catch (e) {
      // Non-critical: user directory is best-effort; AuthProvider handles 401s elsewhere.
      logger.warn('User directory fetch failed:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    if (!_cache || (Date.now() - _cacheAt) > TTL) {
      refresh();
    } else {
      setUsers(_cache);
    }
  }, [refresh]);

  const byUsername = useCallback((username) => {
    if (!username) return null;
    const u = (_cache || []).find((x) => x.username === username);
    return u || null;
  }, []);

  return { users, byUsername, refresh };
};
