import React, { useState } from 'react';
import { Bell, BellRing, BellOff, Smartphone, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePushSubscription } from '../lib/usePushSubscription';

/**
 * Settings card — lets the user enable Web Push (mobile + desktop) notifications.
 *
 * On Android Chrome / iOS Safari (PWA installed), this routes through native
 * OS notifications so the user gets a real banner even when the tab is closed.
 *
 * Notes for iOS:
 *  - Push only works AFTER the user adds the site to their Home Screen and
 *    opens it as a standalone PWA. We surface a hint in that case.
 */
const MobileNotificationsCard = () => {
  const push = usePushSubscription();
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  const sendTest = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      await push.sendTest();
      setTestMsg('Test push sent — you should see a banner in a moment.');
    } catch (e) {
      setTestMsg(e?.response?.data?.detail || e.message || 'Test push failed.');
    } finally {
      setTesting(false);
    }
  };

  // iOS PWA detection (heuristic): standalone display-mode means the user
  // installed the app to home screen, which is required for push on iOS.
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
  const iosNeedsInstall = isIOS && !isStandalone;

  return (
    <div className="card p-6 mb-4" data-testid="mobile-notifications-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <Smartphone size={16}/> Mobile Notifications
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
        Get a real push notification on your phone whenever a new Site Visit is submitted, even when the app is closed.
      </p>

      {!push.supported && (
        <div className="text-xs rounded-md p-2.5 mb-3 flex items-center gap-2"
             style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          <AlertTriangle size={14}/> This browser does not support push notifications. Try Chrome on Android or Safari on iOS (after installing the app to your Home Screen).
        </div>
      )}

      {iosNeedsInstall && (
        <div className="text-xs rounded-md p-2.5 mb-3"
             style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
          <strong>iPhone setup:</strong> tap the <em>Share</em> icon in Safari → <em>Add to Home Screen</em>, then open the app from your home screen and come back to this page to enable notifications.
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {push.subscribed ? (
          <button
            type="button"
            onClick={push.unsubscribe}
            disabled={push.busy}
            className="btn btn-outline"
            data-testid="btn-disable-push"
            style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
          >
            <BellOff size={14}/> {push.busy ? 'Working…' : 'Disable Notifications'}
          </button>
        ) : (
          <button
            type="button"
            onClick={push.subscribe}
            disabled={push.busy || !push.supported}
            className="btn btn-primary"
            data-testid="btn-enable-push"
          >
            <BellRing size={14}/> {push.busy ? 'Enabling…' : 'Enable Notifications on this Device'}
          </button>
        )}

        {push.subscribed && (
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="btn btn-accent"
            data-testid="btn-test-push"
          >
            <Send size={14}/> {testing ? 'Sending…' : 'Send Test Notification'}
          </button>
        )}
      </div>

      <div className="text-xs mt-3 flex items-center gap-2">
        {push.subscribed ? (
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--cc-accent)' }}>
            <CheckCircle2 size={12}/> Notifications are ENABLED on this device.
          </span>
        ) : (
          <span style={{ color: 'var(--cc-text-muted)' }} className="inline-flex items-center gap-1">
            <Bell size={12}/> Notifications are currently OFF on this device.
          </span>
        )}
        {push.permission === 'denied' && (
          <span style={{ color: '#B91C1C' }}>· Browser permission is blocked — re-enable it in site settings.</span>
        )}
      </div>

      {testMsg && (
        <div className="text-xs mt-2" style={{ color: 'var(--cc-text-muted)' }} data-testid="push-test-msg">
          {testMsg}
        </div>
      )}
      {push.error && (
        <div className="text-xs mt-2" style={{ color: '#B91C1C' }} data-testid="push-error">
          {push.error}
        </div>
      )}
    </div>
  );
};

export default MobileNotificationsCard;
