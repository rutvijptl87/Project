import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { PenTool, Save, Trash2, CheckCircle2, Upload } from 'lucide-react';
import SignaturePad from './SignaturePad';

/**
 * Settings card — lets the logged-in user draw OR upload a pre-fitted default
 * signature. Site Visit forms read this via /auth/me and auto-fill the
 * engineer signature pad on every new visit (no need to re-draw each time).
 */
const DefaultSignatureCard = () => {
  const [sig, setSig] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  // Bump this to force-remount the SignaturePad so it redraws after an upload
  const [padKey, setPadKey] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/me');
        const cur = r.data?.default_signature || '';
        setSig(cur);
        setHasSaved(!!cur);
        if (cur) setPadKey((k) => k + 1);
      } catch {}
    })();
  }, []);

  // Re-render the uploaded image onto a fixed-size canvas so it fits the
  // 600×200 signature pad. Returns a fresh PNG data-URL.
  const fitToPad = (dataUrl) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = 600, H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      // Fill white so a transparent PNG doesn't print as black
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      // Contain-fit: scale so the whole signature is visible
      const r = Math.min(W / img.width, H / img.height);
      const w = img.width * r, h = img.height * r;
      const x = (W - w) / 2, y = (H - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not read the image. Try a PNG or JPG.'));
    img.src = dataUrl;
  });

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'Please pick an image file (PNG / JPG).' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File is too large (max 5 MB before compression).' });
      return;
    }
    setMsg(null);
    try {
      const raw = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(new Error('Could not read the file.'));
        fr.readAsDataURL(file);
      });
      const fitted = await fitToPad(raw);
      setSig(fitted);
      setPadKey((k) => k + 1);
      setMsg({ type: 'success', text: 'Signature loaded — click "Save Signature" to persist.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Upload failed.' });
    }
  };

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
      setPadKey((k) => k + 1);
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
        Draw with your finger or upload an image of your signature — it will be auto-stamped on every new Site Visit you create, so you never have to sign on a phone screen again.
      </p>

      <SignaturePad
        key={padKey}
        value={sig}
        onChange={setSig}
        label="Draw your signature below"
        testId="default-sig"
      />

      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={onUpload}
          className="hidden"
          data-testid="default-sig-file-input"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn btn-outline"
          data-testid="btn-upload-default-sig"
        >
          <Upload size={14}/> Upload Image
        </button>
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
