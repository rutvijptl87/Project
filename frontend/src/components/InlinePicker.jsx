import React, { useState, useMemo, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { UserPlus, Compass, Plus, Search, X, Check } from 'lucide-react';

/**
 * Searchable combobox + inline "+ New" creator.
 *
 * Props:
 *  - entityType: 'client' | 'architect'
 *  - value, onChange: the selected id
 *  - items: current list
 *  - onItemsChange: called with (newList) after creating a new one
 *  - testIdPrefix: string used to build data-testid values
 */
const InlinePicker = ({ entityType, value, onChange, items, onItemsChange, testIdPrefix = '' }) => {
  const isClient = entityType === 'client';
  const label = isClient ? 'Client' : 'Architect';
  const path = isClient ? '/clients' : '/architects';
  const Icon = isClient ? UserPlus : Compass;

  const [openList, setOpenList] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const selected = useMemo(() => items.find((it) => it.id === value) || null, [items, value]);

  const displayValue = (it) => {
    if (!it) return '';
    if (isClient) return `${it.name}${it.company ? ` · ${it.company}` : ''}${it.phone ? ` (${it.phone})` : ''}`;
    return `${it.name}${it.firm ? ` · ${it.firm}` : ''}${it.phone ? ` (${it.phone})` : ''}`;
  };

  // Filter items by name + phone + email + company
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 200);
    return items
      .filter((it) =>
        ['name', 'phone', 'email', 'company', 'firm']
          .some((k) => (it[k] || '').toString().toLowerCase().includes(q))
      )
      .slice(0, 200);
  }, [items, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenList(false);
    };
    if (openList) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openList]);

  const selectItem = (it) => {
    onChange(it.id);
    setQuery('');
    setOpenList(false);
  };

  const clearSelection = () => {
    onChange('');
    setQuery('');
  };

  // ---- New-entity modal ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(
    isClient
      ? { name: '', phone: '', email: '', company: '', address: '' }
      : { name: '', phone: '', email: '', firm: '' }
  );

  const reset = () => {
    setForm(isClient
      ? { name: '', phone: '', email: '', company: '', address: '' }
      : { name: '', phone: '', email: '', firm: '' });
    setErr('');
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Name is required'); return; }
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

  return (
    <>
      <div className="flex gap-2 items-stretch">
        <div ref={wrapRef} className="relative flex-1" data-testid={`${testIdPrefix}combobox`}>
          {/* Trigger / search input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 pr-8"
              value={openList ? query : (displayValue(selected))}
              placeholder={selected ? '' : `Search ${label.toLowerCase()} by name, phone, email…`}
              onFocus={() => { setOpenList(true); setQuery(''); }}
              onChange={(e) => { setQuery(e.target.value); setOpenList(true); }}
              data-testid={`${testIdPrefix}search-input`}
            />
            {selected && !openList && (
              <button
                type="button"
                onClick={clearSelection}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                title={`Clear selection`}
                data-testid={`${testIdPrefix}clear-btn`}
              ><X size={12}/></button>
            )}
          </div>

          {/* Dropdown */}
          {openList && (
            <div
              className="absolute z-30 mt-1 left-0 right-0 rounded-lg shadow-lg border max-h-72 overflow-y-auto"
              style={{ background: 'white', borderColor: 'var(--cc-border)' }}
              data-testid={`${testIdPrefix}dropdown`}
            >
              {/* None option */}
              <button
                type="button"
                onClick={() => selectItem({ id: '' })}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 italic"
                style={{ color: 'var(--cc-text-muted)' }}
                data-testid={`${testIdPrefix}option-none`}
              >
                — None —
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm" style={{ color: 'var(--cc-text-muted)' }}>
                  No matches. Click <strong>+ New {label}</strong> on the right to add one.
                </div>
              ) : filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => selectItem(it)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start gap-2"
                  data-testid={`${testIdPrefix}option-${it.id}`}
                >
                  {value === it.id
                    ? <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--cc-dark-green)' }}/>
                    : <span className="w-3.5 shrink-0"/>}
                  <span className="flex-1">
                    <span className="font-medium">{it.name}</span>
                    {(isClient ? it.company : it.firm) && (
                      <span className="text-xs ml-1.5" style={{ color: 'var(--cc-text-muted)' }}>· {isClient ? it.company : it.firm}</span>
                    )}
                    {it.phone && (
                      <span className="text-xs ml-1.5 font-mono-data" style={{ color: 'var(--cc-text-muted)' }}>{it.phone}</span>
                    )}
                    {it.email && (
                      <span className="text-xs ml-1.5" style={{ color: 'var(--cc-text-muted)' }}>{it.email}</span>
                    )}
                  </span>
                </button>
              ))}
              <div className="px-3 py-1.5 text-[11px] border-t" style={{ borderColor: 'var(--cc-border)', color: 'var(--cc-text-muted)' }}>
                Showing {filtered.length} of {items.length} {label.toLowerCase()}{items.length === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </div>

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
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98xxx xxxxx" data-testid={`inline-${entityType}-phone`}/>
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@example.com" data-testid={`inline-${entityType}-email`}/>
            </div>
          </div>

          {isClient ? (
            <>
              <div>
                <label className="label">Company</label>
                <input className="input" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Organisation / firm" data-testid="inline-client-company"/>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea className="textarea" rows={2} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Full address (optional)" data-testid="inline-client-address"/>
              </div>
            </>
          ) : (
            <div>
              <label className="label">Firm</label>
              <input className="input" value={form.firm} onChange={(e) => update('firm', e.target.value)} placeholder="Firm name (optional)" data-testid="inline-architect-firm"/>
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
