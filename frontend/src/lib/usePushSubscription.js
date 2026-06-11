import { useEffect, useState, useCallback } from 'react';
import { api } from './api';

// Convert a base64url public key to the Uint8Array PushManager wants.
const urlBase64ToUint8 = (b64) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const std = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(std);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

/**
 * React hook for managing Web Push subscriptions.
 *
 * Exposes:
 *  - supported: boolean — browser can do push at all
 *  - permission: 'default' | 'granted' | 'denied'
 *  - subscribed: boolean — this device is currently subscribed
 *  - busy: in-flight subscribe/unsubscribe
 *  - error: last error string (empty when ok)
 *  - subscribe(): kicks off permission + subscription + backend save
 *  - unsubscribe(): removes the subscription on both sides
 *  - sendTest(): POST /push/test (server pushes a test message back to this device)
 */
export const usePushSubscription = () => {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setPermission(Notification.permission);
    } catch (e) {
      setError(e.message || 'failed to read subscription');
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    setError(''); setBusy(true);
    try {
      if (!supported) throw new Error('This browser does not support push notifications.');
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') throw new Error('Permission denied — enable notifications for this site in browser settings.');
      }
      const reg = await navigator.serviceWorker.ready;
      // Already subscribed? Just re-register with backend in case it forgot.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const r = await api.get('/push/vapid-public');
        const publicKey = r.data?.public_key;
        if (!publicKey) throw new Error('VAPID public key missing on server.');
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8(publicKey),
        });
      }
      const subJson = sub.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        expirationTime: subJson.expirationTime || null,
      });
      setSubscribed(true);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to enable push.');
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    setError(''); setBusy(true);
    try {
      if (!supported) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await api.post('/push/unsubscribe', { endpoint: sub.endpoint }); }
        catch (err) { console.warn('Push unsubscribe (server) failed; continuing local cleanup', err); }
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e.message || 'Failed to disable push.');
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const sendTest = useCallback(async () => {
    setError('');
    try {
      const r = await api.post('/push/test');
      return r.data;
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Test push failed.');
      throw e;
    }
  }, []);

  return { supported, permission, subscribed, busy, error, subscribe, unsubscribe, sendTest, refresh };
};
