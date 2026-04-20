import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import { IndianRupee } from 'lucide-react';

const RecordPaymentModal = ({ open, onClose, defaultProjectId, defaultAuditId, entityType = 'project', onSaved }) => {
  const isAudit = entityType === 'audit';
  const [items, setItems] = useState([]);
  const [entityId, setEntityId] = useState(isAudit ? (defaultAuditId || '') : (defaultProjectId || ''));
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const url = isAudit ? '/audits' : '/projects';
      api.get(url).then((r) => setItems(r.data)).catch(() => {});
      setEntityId(isAudit ? (defaultAuditId || '') : (defaultProjectId || ''));
      setAmount('');
      setNotes('');
      setError('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, defaultProjectId, defaultAuditId, isAudit]);

  const selected = items.find((p) => p.id === entityId);

  const labelCode = (p) => (isAudit ? p.audit_code : p.project_code);
  const labelName = (p) => (isAudit ? (p.audit_offer || 'Audit') : p.name);
  const quotedKey = isAudit ? 'total_amount' : 'quoted_amount';
  const quotedLabel = isAudit ? 'Total' : 'Quoted';

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

  return (
    <Modal open={open} onClose={onClose} title={isAudit ? 'Record Audit Payment' : 'Record Payment'} testId="record-payment-modal">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">{isAudit ? 'Audit *' : 'Project *'}</label>
          <select
            className="select"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            data-testid="payment-project-select"
          >
            <option value="">-- Select {isAudit ? 'an audit' : 'a project'} --</option>
            {items.map((p) => (
              <option key={p.id} value={p.id}>
                {labelCode(p)} — {labelName(p)} ({p.client_name || 'No client'}) • Outstanding ₹ {Number(p.outstanding_amount || 0).toLocaleString('en-IN')}
              </option>
            ))}
          </select>
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
