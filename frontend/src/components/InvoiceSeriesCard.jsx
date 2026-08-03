import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { FileText, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Reusable Settings card for editing an invoice numbering series.
 * Used twice on the Settings page — once for Proforma, once for Tax Invoice.
 *
 * The backend endpoints are:
 *   GET  /api/invoices/series/{kind}
 *   PUT  /api/invoices/series/{kind}
 * where kind ∈ ('proforma', 'tax').
 */
const preview = (prefix, suffix, year, seq, pad, yearReset) => {
  const padded = String(seq).padStart(pad, '0');
  const body = yearReset ? `${year}/${padded}` : padded;
  return `${prefix}${body}${suffix}`;
};

const InvoiceSeriesCard = ({ kind, title, hint }) => {
  const [cfg, setCfg] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [yearReset, setYearReset] = useState(false);
  const [pad, setPad] = useState(3);
  const [nextSeq, setNextSeq] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const r = await api.get(`/invoices/series/${kind}`);
      setCfg(r.data);
      setPrefix(r.data?.prefix || '');
      setSuffix(r.data?.suffix || '');
      setPad(parseInt(r.data?.pad, 10) || 3);
      setYearReset(!!r.data?.year_reset);
      setNextSeq(String(r.data?.next_seq || ''));
    } catch (err) {
      console.error(`Failed to load ${kind} series`, err);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const n = parseInt(nextSeq, 10);
      if (!n || n < 1) { setMsg({ type: 'error', text: 'Next serial must be a positive number.' }); setBusy(false); return; }
      const r = await api.put(`/invoices/series/${kind}`, {
        prefix, suffix, pad, year_reset: yearReset, next_seq: n,
      });
      setMsg({ type: 'success', text: `Next ${title} will be ${r.data.next_code}.` });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || 'Could not save.' });
    } finally { setBusy(false); }
  };

  if (!cfg) {
    return (
      <div className="card p-6 mb-4" data-testid={`${kind}-series-card-loading`}>
        <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
          <FileText size={16}/> {title}
        </h2>
        <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  const seqInt = parseInt(nextSeq || '0', 10) || 0;
  const previewCode = preview(prefix, suffix, cfg.year, seqInt, pad, yearReset);
  const changed = (
    prefix !== cfg.prefix ||
    suffix !== cfg.suffix ||
    pad !== cfg.pad ||
    yearReset !== cfg.year_reset ||
    seqInt !== cfg.next_seq
  );

  return (
    <div className="card p-6 mb-4" data-testid={`${kind}-series-card`}>
      <h2 className="font-head text-xl font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
        <FileText size={16}/> {title}
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--cc-text-muted)' }}>{hint}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>Currently next</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-dark-green)' }} data-testid={`${kind}-series-current`}>{cfg.next_code}</div>
        </div>
        <div className="rounded-md p-3" style={{ background: 'var(--cc-surface)' }}>
          <div className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--cc-text-muted)' }}>After save, next will be</div>
          <div className="font-mono-data font-bold text-lg" style={{ color: 'var(--cc-accent)' }} data-testid={`${kind}-series-preview`}>{previewCode}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="label text-xs">Prefix</label>
          <input type="text" className="input font-mono-data" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="CC > PIC > " data-testid={`${kind}-series-prefix`}/>
        </div>
        <div>
          <label className="label text-xs">Padding</label>
          <input type="number" min={1} max={6} className="input font-mono-data" value={pad} onChange={(e) => setPad(parseInt(e.target.value, 10) || 1)} data-testid={`${kind}-series-pad`}/>
        </div>
        <div>
          <label className="label text-xs">Next serial</label>
          <input type="number" min={1} className="input font-mono-data" value={nextSeq} onChange={(e) => setNextSeq(e.target.value)} data-testid={`${kind}-series-next`}/>
        </div>
        <div>
          <label className="label text-xs">Suffix</label>
          <input type="text" className="input font-mono-data" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="(none)" data-testid={`${kind}-series-suffix`}/>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={yearReset} onChange={(e) => setYearReset(e.target.checked)} data-testid={`${kind}-series-year-reset`}/>
          Year-reset (insert /{cfg.year}/ before the serial)
        </label>
        <button type="button" onClick={save} disabled={busy || !changed} className="btn btn-primary" data-testid={`${kind}-series-save`}>
          <Save size={14}/> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="text-[11px] mt-2 flex items-start gap-1" style={{ color: 'var(--cc-text-muted)' }}>
        <AlertTriangle size={11} className="mt-0.5"/>
        Existing numbers are not changed. If the chosen next number would collide with an existing invoice, the save will be refused.
      </div>

      {msg && (
        <div
          className="text-xs rounded-md p-2.5 mt-3 inline-flex items-center gap-1.5"
          style={msg.type === 'error'
            ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }
            : { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}
          data-testid={`${kind}-series-msg`}
        >
          {msg.type === 'success' && <CheckCircle2 size={12}/>}
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default InvoiceSeriesCard;
