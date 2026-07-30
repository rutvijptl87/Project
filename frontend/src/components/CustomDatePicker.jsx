import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/**
 * CustomDatePicker — renders its calendar panel via a portal into document.body,
 * positioned with getBoundingClientRect so it is NEVER clipped by overflow:hidden
 * ancestors and always stays fully within the viewport.
 *
 * Props:
 *   value        – ISO date string "YYYY-MM-DD" or ""
 *   onChange     – (isoString: string) => void
 *   placeholder  – string shown when no date selected
 *   disabled     – boolean
 *   className    – extra classes on the trigger wrapper div
 *   style        – inline style on the trigger wrapper div
 *   'data-testid'– forwarded to trigger button
 */
const CustomDatePicker = ({
  value = '',
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
  style,
  'data-testid': testId,
}) => {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;

  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [viewYear, setViewYear] = useState((parsed || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || today).getMonth());
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const PANEL_W = 272;
  const PANEL_H = 310;

  // Compute panel (x,y) so it never clips the viewport
  const calcPos = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Vertical: prefer below, flip above if not enough room
    let top = rect.bottom + scrollY + 4;
    if (window.innerHeight - rect.bottom < PANEL_H && rect.top > PANEL_H) {
      top = rect.top + scrollY - PANEL_H - 4;
    }

    // Horizontal: left-align to trigger, clamp within viewport
    let left = rect.left + scrollX;
    if (left + PANEL_W > window.innerWidth - 8) {
      left = window.innerWidth - PANEL_W - 8 + scrollX;
    }
    if (left < 8 + scrollX) left = 8 + scrollX;

    return { top, left };
  }, []);

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
      if (
        !triggerRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!open) {
      setPanelPos(calcPos());
      if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()); }
      else { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }
    }
    setOpen(v => !v);
  }, [open, disabled, parsed, today, calcPos]);

  const selectDay = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false);
  };

  const prevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate() : null;
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate() : null;

  const displayLabel = parsed
    ? `${String(parsed.getDate()).padStart(2,'0')}/${String(parsed.getMonth()+1).padStart(2,'0')}/${parsed.getFullYear()}`
    : '';

  return (
    <div ref={triggerRef} className={`relative w-full ${className}`} style={style}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        data-testid={testId}
        className="input w-full flex items-center gap-2 text-left cursor-pointer"
        style={{ paddingRight: '0.5rem' }}
      >
        <Calendar size={14} className="shrink-0 text-gray-400" />
        <span className={`flex-1 text-sm truncate ${!displayLabel ? 'text-gray-400' : ''}`}>
          {displayLabel || placeholder}
        </span>
        {displayLabel && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="shrink-0 text-gray-300 hover:text-gray-600 px-0.5 leading-none text-base cursor-pointer"
            title="Clear"
          >×</span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Calendar portal — mounted on document.body, positioned via getBoundingClientRect */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: panelPos.top,
            left: panelPos.left,
            width: PANEL_W,
            zIndex: 9999,
            borderColor: 'var(--cc-border)',
          }}
          className="bg-white border rounded-xl shadow-2xl overflow-hidden select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Month / Year nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
            <button type="button" onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--cc-dark-green)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-2 pt-2 pb-0.5">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider pb-1" style={{ color: 'var(--cc-text-muted)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center" style={{ aspectRatio: '1' }}>
                {day ? (
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors font-medium ${
                      day === selectedDay ? '' :
                      day === todayDay ? 'font-bold border' : 'hover:bg-gray-100'
                    }`}
                    style={
                      day === selectedDay
                        ? { background: 'var(--cc-dark-green)', color: '#fff' }
                        : day === todayDay
                        ? { borderColor: 'var(--cc-accent)', color: 'var(--cc-accent)' }
                        : {}
                    }
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs" style={{ borderColor: 'var(--cc-border)' }}>
            <button
              type="button"
              onClick={() => {
                const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                onChange(iso);
                setOpen(false);
              }}
              className="font-semibold hover:underline"
              style={{ color: 'var(--cc-accent)' }}
            >
              Today
            </button>
            {displayLabel && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomDatePicker;
