import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * CustomSelect — a DOM-rendered dropdown using a portal into document.body.
 * Positioned via getBoundingClientRect so it is NEVER clipped by overflow:hidden
 * ancestors and always stays within the viewport.
 *
 * Props:
 *   value        – current value (string)
 *   onChange     – (value: string) => void
 *   options      – [{ value, label }]
 *   placeholder  – text shown when nothing selected (value='')
 *   searchable   – show search box (default: true when options > 8)
 *   disabled     – boolean
 *   className    – extra classes on the trigger wrapper div
 *   'data-testid'– forwarded to trigger button
 */
const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  searchable,
  disabled = false,
  className = '',
  'data-testid': testId,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const showSearch = searchable !== undefined ? searchable : options.length > 8;

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label ?? '';

  // Compute portal panel position
  const calcPos = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0, width: 200 };
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const panelW = Math.max(rect.width, 180);
    const panelH = showSearch ? 260 : 220;

    let top = rect.bottom + scrollY + 2;
    if (window.innerHeight - rect.bottom < panelH && rect.top > panelH) {
      top = rect.top + scrollY - panelH - 2;
    }

    let left = rect.left + scrollX;
    if (left + panelW > window.innerWidth - 8) {
      left = window.innerWidth - panelW - 8 + scrollX;
    }
    if (left < 8 + scrollX) left = 8 + scrollX;

    return { top, left, width: panelW };
  }, [showSearch]);

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => setPanelPos(calcPos());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, calcPos]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, showSearch]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!open) setPanelPos(calcPos());
    setOpen(v => !v);
    if (open) setQuery('');
  }, [open, disabled, calcPos]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={triggerRef} className={`relative w-full ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        data-testid={testId}
        className="select w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        style={{ paddingRight: '0.6rem' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate flex-1 ${!selectedLabel ? 'text-gray-400' : ''}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown portal */}
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            zIndex: 9999,
            borderColor: 'var(--cc-border)',
          }}
          className="bg-white border rounded-lg shadow-xl overflow-hidden"
        >
          {showSearch && (
            <div className="p-1.5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:border-green-500"
                  style={{ borderColor: 'var(--cc-border)' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {/* Placeholder / clear option */}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50"
                style={{ color: 'var(--cc-text-muted)' }}
              >
                <span className="flex-1">{placeholder}</span>
                {!value && <Check size={13} style={{ color: 'var(--cc-accent)' }} />}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-gray-400">No results</li>
            ) : filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={String(value) === String(opt.value)}
                  onClick={() => handleSelect(opt.value)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
                  style={String(value) === String(opt.value)
                    ? { background: 'var(--cc-surface)', color: 'var(--cc-dark-green)', fontWeight: 600 }
                    : {}}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {String(value) === String(opt.value) && <Check size={13} style={{ color: 'var(--cc-accent)' }} />}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
