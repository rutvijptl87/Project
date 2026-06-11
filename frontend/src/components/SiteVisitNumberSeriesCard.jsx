import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Hash, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Settings card — admins set the NEXT Site Visit Report Number.
 *
 * Use cases:
 *  - Continue numbering from a paper register (e.g. start at SV-0150)
 *  - Skip a range that's already been used externally
 *  - Reset the counter at year-end
 *
 * The backend refuses to set the counter to a value that would collide with
 * an existing visit's code, so admins can't accidentally clobber history.
 */
const SiteVisitNumberSeriesCard = () => {
  const [series, setSeries] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/site-visits/series');
      setSeries(r.data);
      setDraft(String(r.data?.next_seq || ''));
    } catch (err) {
      console.error('Failed to load site visit series', err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = parseInt(draft, 10);
      if (!n || n < 1) {
        setMsg({ type: 'error', text: 'Enter a positive number (e.g. 150).' });
        setBusy(false);
        return;
      }
      const r = await api.put('/site-visits/series', { next_seq: n });
      setMsg({ type: 'success', text: `Next visit will be ${r.data.next_code}.` });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  if (!series) {
    return (
      <div className="card p-6 mb-4" data-testid="sv-series-card-loading">
        <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Hash size={16}/> Site Visit Numbering
        </h2>
        <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  const preview = `SV-${String(parseInt(draft || '0', 10) || 0).padStart(4, '0')}`;
  const changed = parseInt(draft, 10) !== series.next_seq;

  return (
    <div className="card p-6 mb-4" data-testid="sv-series-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <Hash size={16}/> Site Visit Numbering
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
        Edit the NEXT Site Visit Report Number. Use this to continue numbering from a paper register, skip ahead, or reset at year-end.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>Currently next</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-dark-green)' }} data-testid="sv-series-current">
            {series.next_code}
          </div>
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>After save, next will be</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-accent)' }} data-testid="sv-series-preview">
            {preview}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="label text-xs">Next number (without SV- prefix)</label>
          <input
            type="number"
            min={1}
            className="input font-mono-data"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 150"
            style={{ width: 160 }}
            data-testid="sv-series-input"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="btn btn-primary"
          data-testid="sv-series-save"
        >
          <Save size={14}/> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="text-[11px] mt-2 flex items-start gap-1" style={{ color: 'var(--cc-text-muted)' }}>
        <AlertTriangle size={11} className="mt-0.5"/>
        Existing visit codes are not changed. If the new number would collide with an existing visit (e.g. SV-0010 already exists), the save will be refused.
      </div>

      {msg && (
        <div
          className="text-xs rounded-md p-2.5 mt-3 inline-flex items-center gap-1.5"
          style={msg.type === 'error'
            ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="sv-series-msg"
        >
          {msg.type === 'success' && <CheckCircle2 size={12}/>}
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default SiteVisitNumberSeriesCard;
