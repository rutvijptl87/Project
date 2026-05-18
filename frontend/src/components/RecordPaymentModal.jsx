import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import { IndianRupee, Search, ChevronDown, X } from 'lucide-react';

const RecordPaymentModal = ({ open, onClose, defaultProjectId, defaultAuditId, entityType = 'project', onSaved }) => {
  const isAudit = entityType === 'audit';
  const [items, setItems] = useState([]);
  const [entityId, setEntityId] = useState(isAudit ? (defaultAuditId || '') : (defaultProjectId || ''));
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Combobox state
  const [search, setSearch] = useState('');
  const [openList, setOpenList] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const url = isAudit ? '/audits' : '/projects';
      api.get(url).then((r) => setItems(r.data)).catch(() => {});
      setEntityId(isAudit ? (defaultAuditId || '') : (defaultProjectId || ''));
      setAmount('');
      setNotes('');
      setError('');
      setSearch('');
      setOpenList(false);
      setHighlight(0);
      setPaymentDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, defaultProjectId, defaultAuditId, isAudit]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openList) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenList(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openList]);

  const selected = items.find((p) => p.id === entityId);

  const labelCode = (p) => (isAudit ? p.audit_code : p.project_code);
  const labelName = (p) => (isAudit ? (p.audit_offer || 'Audit') : p.name);
  const quotedKey = isAudit ? 'total_amount' : 'quoted_amount';
  const quotedLabel = isAudit ? 'Total' : 'Quoted';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [
        labelCode(p),
        labelName(p),
        p.client_name,
        p.architect_name,
        p.location,
      ].filter(Boolean).join(' ').toLowerCase();
      // match if any token in haystack starts with q OR substring match
      return hay.includes(q) || hay.split(/\s+/).some((tok) => tok.startsWith(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, isAudit]);

  useEffect(() => { setHighlight(0); }, [search, openList]);

  const pick = (p) => {
    setEntityId(p.id);
    setOpenList(false);
    setSearch('');
  };

  const clearPick = () => {
    setEntityId('');
    setSearch('');
    setOpenList(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e) => {
    if (!openList && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpenList(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const p = filtered[highlight];
      if (p) pick(p);
    }
    else if (e.key === 'Escape') { setOpenList(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!entityId) return setError(isAudit ? 'Please select an audit' : 'Please select a project');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Enter a valid amount');
    setSaving(true);
    try {
      if (isAudit) {
        await api.post('/audit-payments', {
          audit_id: entityId,
          amount: amt,
          payment_date: new Date(paymentDate).toISOString(),
          notes,
        });
      } else {
        await api.post('/payments', {
          project_id: entityId,
          amount: amt,
          payment_date: new Date(paymentDate).toISOString(),
          notes,
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const placeholder = isAudit
    ? 'Search audit by ID, offer or client name…'
    : 'Search project by code, name, client, architect or location…';

  return (
    <Modal open={open} onClose={onClose} title={isAudit ? 'Record Audit Payment' : 'Record Payment'} testId="record-payment-modal">
      <form onSubmit={handleSave} className="space-y-4">
        <div ref={wrapRef} className="relative">
          <label className="label">{isAudit ? 'Audit *' : 'Project *'}</label>

          {selected && !openList ? (
            <button
              type="button"
              onClick={() => { setOpenList(true); setSearch(''); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left hover:bg-gray-50"
              style={{ borderColor: 'var(--cc-border)', background: '#fff' }}
              data-testid="payment-project-selected"
            >
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--cc-dark-green)' }}>
                  <span className="font-mono-data">{labelCode(selected)}</span> — {labelName(selected)}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>
                  {selected.client_name || 'No client'} • Outstanding {formatINR(selected.outstanding_amount)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <X size={14} className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); clearPick(); }} data-testid="payment-project-clear" />
                <ChevronDown size={14} className="opacity-60" />
              </span>
            </button>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                ref={inputRef}
                className="input pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpenList(true); }}
                onFocus={() => setOpenList(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                data-testid="payment-project-search"
              />
            </div>
          )}

          {openList && (
            <div
              className="absolute z-30 mt-1 w-full rounded-lg border shadow-lg max-h-72 overflow-auto"
              style={{ background: '#fff', borderColor: 'var(--cc-border)' }}
              data-testid="payment-project-list"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--cc-text-muted)' }}>
                  No matches for "{search}"
                </div>
              ) : filtered.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => pick(p)}
                  className="w-full text-left px-3 py-2 border-b last:border-b-0 flex items-center justify-between gap-3"
                  style={{
                    borderColor: 'var(--cc-border)',
                    background: idx === highlight ? 'var(--cc-surface)' : '#fff',
                  }}
                  data-testid={`payment-project-option-${labelCode(p)}`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      <span className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-accent)' }}>{labelCode(p)}</span>
                      <span className="ml-2">{labelName(p)}</span>
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>
                      {p.client_name || 'No client'}{p.location ? ` • ${p.location}` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-mono-data whitespace-nowrap" style={{ color: Number(p.outstanding_amount || 0) > 0 ? '#DC2626' : '#065F46' }}>
                    {formatINR(p.outstanding_amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="rounded-lg border p-3 text-sm" style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
            <div className="flex justify-between"><span className="text-gray-600">{quotedLabel}</span><span className="font-mono-data">{formatINR(selected[quotedKey])}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Received</span><span className="font-mono-data">{formatINR(selected.received_amount)}</span></div>
            <div className="flex justify-between font-semibold" style={{ color: 'var(--cc-dark-green)' }}><span>Outstanding</span><span className="font-mono-data">{formatINR(selected.outstanding_amount)}</span></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="number"
                step="0.01"
                className="input pl-8"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="payment-amount-input"
              />
            </div>
          </div>
          <div>
            <label className="label">Payment Date</label>
            <input
              type="date"
              className="input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              data-testid="payment-date-input"
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="textarea"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Cheque no. / UPI ref / advance payment"
            data-testid="payment-notes-input"
          />
        </div>

        {error && <div className="text-sm text-red-600" data-testid="payment-error">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline" data-testid="payment-cancel-btn">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary" data-testid="payment-save-btn">
            {saving ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordPaymentModal;
