import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PenTool, Save, Trash2, CheckCircle2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

/**
 * Settings card — lets the logged-in user draw + save a pre-fitted default
 * signature. Site Visit forms read this via /auth/me and auto-fill the
 * engineer signature pad on every new visit (no need to re-draw each time).
 */
const DefaultSignatureCard = () => {
  const [sig, setSig] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/me');
        const cur = r.data?.default_signature || '';
        setSig(cur);
        setHasSaved(!!cur);
      } catch {}
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/auth/me/signature', { signature: sig || '' });
      setHasSaved(!!sig);
      setMsg({ type: 'success', text: sig ? 'Default signature saved.' : 'Default signature cleared.' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not save signature.' });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Remove your default signature?')) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/auth/me/signature', { signature: '' });
      setSig('');
      setHasSaved(false);
      setMsg({ type: 'success', text: 'Default signature cleared.' });
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not clear signature.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 mb-4" data-testid="default-signature-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <PenTool size={16}/> My Default Signature
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
        Draw your signature once — it will be auto-stamped on every new Site Visit you create, so you never have to sign on a phone screen again.
      </p>

      <SignaturePad
        value={sig}
        onChange={setSig}
        label="Draw your signature below"
        testId="default-sig"
      />

      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn btn-primary"
          data-testid="btn-save-default-sig"
        >
          <Save size={14}/> {busy ? 'Saving…' : 'Save Signature'}
        </button>
        {hasSaved && (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            className="btn btn-outline"
            data-testid="btn-clear-default-sig"
            style={{ color: '#B91C1C', borderColor: '#FCA5A5' }}
          >
            <Trash2 size={14}/> Clear
          </button>
        )}
        {hasSaved && (
          <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--cc-accent)' }}>
            <CheckCircle2 size={12}/> A default signature is currently saved.
          </span>
        )}
      </div>

      {msg && (
        <div
          className="text-xs rounded-md p-2.5 mt-3"
          style={msg.type === 'error'
            ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="default-sig-msg"
        >
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default DefaultSignatureCard;
