import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Hash, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Settings card — admins set the NEXT Audit Offer Number.
 *
 * Audit Offer numbers are auto-generated as STR/AUD-OFR/YYYY/NNN by the
 * backend. This card lets admins:
 *   - Skip ahead (e.g. continue a paper register at 050)
 *   - Reset the counter at year-end
 *
 * The backend refuses to set the counter to a value that would clash with
 * an existing audit's offer number, so admins can't accidentally collide.
 */
const AuditOfferSeriesCard = () => {
  const [series, setSeries] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/audits/offer-series');
      setSeries(r.data);
      setDraft(String(r.data?.next_seq || ''));
    } catch (err) {
      console.error('Failed to load audit offer series', err);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = parseInt(draft, 10);
      if (!n || n < 1) {
        setMsg({ type: 'error', text: 'Enter a positive number (e.g. 12).' });
        setBusy(false);
        return;
      }
      const r = await api.put('/audits/offer-series', { next_seq: n });
      setMsg({ type: 'success', text: `Next audit offer will be ${r.data.next_code}.` });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  if (!series) {
    return (
      <div className="card p-6 mb-4" data-testid="audit-offer-series-card-loading">
        <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Hash size={16}/> Audit Offer Numbering
        </h2>
        <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  const seqInt = parseInt(draft || '0', 10) || 0;
  const preview = `STR/AUD-OFR/${series.year}/${String(seqInt).padStart(3, '0')}`;
  const changed = seqInt !== series.next_seq;

  return (
    <div className="card p-6 mb-4" data-testid="audit-offer-series-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <Hash size={16}/> Audit Offer Numbering
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
        Edit the NEXT Audit Offer Number (auto-generated as <strong>STR/AUD-OFR/{series.year}/NNN</strong>). Skip ahead to continue from a paper register, or reset at year-end.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>Currently next</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-dark-green)' }} data-testid="audit-offer-series-current">
            {series.next_code}
          </div>
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>After save, next will be</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-accent)' }} data-testid="audit-offer-series-preview">
            {preview}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="label text-xs">Next serial number (just the NNN part)</label>
          <input
            type="number"
            min={1}
            className="input font-mono-data"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 12"
            style={{ width: 160 }}
            data-testid="audit-offer-series-input"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="btn btn-primary"
          data-testid="audit-offer-series-save"
        >
          <Save size={14}/> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="text-[11px] mt-2 flex items-start gap-1" style={{ color: 'var(--cc-text-muted)' }}>
        <AlertTriangle size={11} className="mt-0.5"/>
        Existing audit offer numbers are not changed. If your chosen serial would collide with an existing audit, the save will be refused.
      </div>

      {msg && (
        <div
          className="text-xs rounded-md p-2.5 mt-3 inline-flex items-center gap-1.5"
          style={msg.type === 'error'
            ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid="audit-offer-series-msg"
        >
          {msg.type === 'success' && <CheckCircle2 size={12}/>}
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default AuditOfferSeriesCard;
