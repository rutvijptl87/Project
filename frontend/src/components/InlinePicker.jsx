import React, { useState } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { UserPlus, Compass, Plus } from 'lucide-react';

/**
 * A select dropdown with an inline "+ New" button that opens a small
 * modal to create a new entity. On save, the new entity is added to the
 * local list and auto-selected — no page navigation needed.
 *
 * Props:
 *  - entityType: 'client' | 'architect'
 *  - value, onChange: the selected id
 *  - items: current list
 *  - onItemsChange: called with (newList) after creating a new one
 *  - testIdPrefix: string used to build data-testid values
 */
const InlinePicker = ({ entityType, value, onChange, items, onItemsChange, testIdPrefix = '' }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(
    entityType === 'client'
      ? { name: '', phone: '', email: '', company: '', address: '' }
      : { name: '', phone: '', email: '', firm: '' }
  );

  const isClient = entityType === 'client';
  const label = isClient ? 'Client' : 'Architect';
  const path = isClient ? '/clients' : '/architects';
  const Icon = isClient ? UserPlus : Compass;

  const reset = () => {
    setForm(isClient
      ? { name: '', phone: '', email: '', company: '', address: '' }
      : { name: '', phone: '', email: '', firm: '' });
    setErr('');
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post(path, form);
      const created = r.data;
      const newList = [...items, created].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      );
      onItemsChange(newList);
      onChange(created.id);
      setOpen(false);
      reset();
    } catch (ex) {
      setErr(ex?.response?.data?.detail || `Failed to create ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const labelFor = (it) => {
    if (isClient) return `${it.name}${it.company ? ` · ${it.company}` : ''}${it.phone ? ` (${it.phone})` : ''}`;
    return `${it.name}${it.firm ? ` · ${it.firm}` : ''}${it.phone ? ` (${it.phone})` : ''}`;
  };

  return (
    <>
      <div className="flex gap-2 items-stretch">
        <select
          className="select flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`${testIdPrefix}select`}
        >
          <option value="">— None —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{labelFor(it)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { reset(); setOpen(true); }}
          className="btn btn-outline whitespace-nowrap"
          title={`Add a new ${label.toLowerCase()} without leaving this page`}
          data-testid={`${testIdPrefix}add-new-btn`}
        >
          <Plus size={14} /> New {label}
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`New ${label}`} testId={`inline-${entityType}-modal`}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 rounded-md" style={{ background: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}>
            <Icon size={16} style={{ color: 'var(--cc-dark-green)' }} />
            <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              This {label.toLowerCase()} will be saved and automatically selected in the form.
            </span>
          </div>

          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              autoFocus
              placeholder={isClient ? 'Full name or company name' : "Architect's name"}
              data-testid={`inline-${entityType}-name`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+91 98xxx xxxxx"
                data-testid={`inline-${entityType}-phone`}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="email@example.com"
                data-testid={`inline-${entityType}-email`}
              />
            </div>
          </div>

          {isClient ? (
            <>
              <div>
                <label className="label">Company</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                  placeholder="Organisation / firm"
                  data-testid="inline-client-company"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Full address (optional)"
                  data-testid="inline-client-address"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="label">Firm</label>
              <input
                className="input"
                value={form.firm}
                onChange={(e) => update('firm', e.target.value)}
                placeholder="Firm name (optional)"
                data-testid="inline-architect-firm"
              />
            </div>
          )}

          {err && <div className="text-sm text-red-600" data-testid={`inline-${entityType}-error`}>{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" data-testid={`inline-${entityType}-save`}>
              {saving ? 'Saving…' : `Save ${label}`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default InlinePicker;
