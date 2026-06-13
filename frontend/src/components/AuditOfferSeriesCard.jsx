import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Hash, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Settings card — admins control the Audit Offer Numbering series.
 *
 * Admin can edit:
 *   - Prefix (e.g. STR/AUD-OFR, STR/GEN-CERT, MUM-AUD)
 *   - Year-reset on/off
 *   - Padding (NNN, NNNN, etc.)
 *   - Next serial number (skip ahead, reset at year-end, continue from a paper register)
 *
 * Backend refuses any change whose resulting code would collide with an
 * existing audit's `audit_offer`, so admins can't accidentally clobber.
 */
const padPreview = (prefix, year, seq, pad, yearReset) => {
  const padded = String(seq).padStart(pad, '0');
  return yearReset ? `${prefix}/${year}/${padded}` : `${prefix}/${padded}`;
};

const AuditOfferSeriesCard = () => {
  const [cfg, setCfg] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [yearReset, setYearReset] = useState(true);
  const [pad, setPad] = useState(3);
  const [nextSeq, setNextSeq] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/audits/offer-series');
      setCfg(r.data);
      setPrefix(r.data?.prefix || 'STR/AUD-OFR');
      setYearReset(r.data?.year_reset !== false);
      setPad(parseInt(r.data?.pad, 10) || 3);
      setNextSeq(String(r.data?.next_seq || ''));
    } catch (err) {
      console.error('Failed to load audit offer series', err);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = parseInt(nextSeq, 10);
      if (!n || n < 1) {
        setMsg({ type: 'error', text: 'Enter a positive Next serial (e.g. 12).' });
        setBusy(false);
        return;
      }
      const cleanedPrefix = (prefix || '').trim().replace(/^\/+|\/+$/g, '');
      if (!cleanedPrefix) {
        setMsg({ type: 'error', text: 'Prefix is required (e.g. STR/AUD-OFR).' });
        setBusy(false);
        return;
      }
      const r = await api.put('/audits/offer-series', {
        prefix: cleanedPrefix,
        year_reset: yearReset,
        pad,
        next_seq: n,
      });
      setMsg({ type: 'success', text: `Next audit offer will be ${r.data.next_code}.` });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) {
    return (
      <div className="card p-6 mb-4" data-testid="audit-offer-series-card-loading">
        <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <Hash size={16}/> Audit Offer Numbering
        </h2>
        <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  const seqInt = parseInt(nextSeq || '0', 10) || 0;
  const cleanedPrefix = (prefix || '').trim().replace(/^\/+|\/+$/g, '') || 'STR/AUD-OFR';
  const preview = padPreview(cleanedPrefix, cfg.year, seqInt, pad, yearReset);
  const changed = (
    cleanedPrefix !== cfg.prefix ||
    yearReset !== cfg.year_reset ||
    pad !== cfg.pad ||
    seqInt !== cfg.next_seq
  );

  return (
    <div className="card p-6 mb-4" data-testid="audit-offer-series-card">
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <Hash size={16}/> Audit Offer Numbering
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>
        Edit how Audit Offer Numbers are auto-generated. Change the prefix, toggle year-reset, or skip ahead to continue from a paper register.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>Currently next</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-dark-green)' }} data-testid="audit-offer-series-current">
            {cfg.next_code}
          </div>
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>After save, next will be</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-accent)' }} data-testid="audit-offer-series-preview">
            {preview}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="label text-xs">Prefix</label>
          <input
            type="text"
            className="input font-mono-data"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="STR/AUD-OFR"
            data-testid="audit-offer-series-prefix"
          />
        </div>
        <div>
          <label className="label text-xs">Padding (digits)</label>
          <input
            type="number"
            min={1}
            max={6}
            className="input font-mono-data"
            value={pad}
            onChange={(e) => setPad(parseInt(e.target.value, 10) || 1)}
            data-testid="audit-offer-series-pad"
          />
        </div>
        <div>
          <label className="label text-xs">Next serial</label>
          <input
            type="number"
            min={1}
            className="input font-mono-data"
            value={nextSeq}
            onChange={(e) => setNextSeq(e.target.value)}
            placeholder="12"
            data-testid="audit-offer-series-input"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={yearReset}
              onChange={(e) => setYearReset(e.target.checked)}
              data-testid="audit-offer-series-year-reset"
            />
            Year-reset (insert /{cfg.year}/)
          </label>
        </div>
      </div>

      <div className="flex justify-end mt-3">
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
        Existing audit offer numbers are not changed. If the new format would collide with an existing audit, the save will be refused.
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
