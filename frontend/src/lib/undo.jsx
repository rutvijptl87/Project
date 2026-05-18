import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Undo2, X } from 'lucide-react';
import { logger } from './logger';

const UndoContext = createContext(null);
export const useUndo = () => useContext(UndoContext);

const DEFAULT_DURATION_MS = 60_000;

export const UndoProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t.commitTimer);
      if (t.tickTimer) clearInterval(t.tickTimer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const commitNow = useCallback(async (id) => {
    const item = items.find((x) => x.id === id) || null;
    const t = timersRef.current.get(id);
    if (!item && !t) return;
    try {
      await (t?.onCommit || item?.onCommit)?.();
    } catch (e) {
      logger.error('Undo commit failed:', e);
      // If commit fails, run onUndo to restore UI and show an error via a fresh toast
      try { await (t?.onUndo || item?.onUndo)?.(); } catch (e2) { logger.warn('Undo rollback also failed:', e2); }
    } finally {
      remove(id);
    }
  }, [items, remove]);

  const undo = useCallback(async (id) => {
    const t = timersRef.current.get(id);
    if (t) {
      try { await t.onUndo?.(); } catch (e) { logger.error('Undo handler error:', e); }
    }
    remove(id);
  }, [remove]);

  const schedule = useCallback(({ label, onCommit, onUndo, durationMs = DEFAULT_DURATION_MS }) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id,
      label,
      startedAt: Date.now(),
      durationMs,
      remaining: Math.round(durationMs / 1000),
    };
    const commitTimer = setTimeout(() => {
      commitNow(id);
    }, durationMs);
    const tickTimer = setInterval(() => {
      setItems((prev) => prev.map((x) => {
        if (x.id !== id) return x;
        const remaining = Math.max(0, Math.ceil((x.startedAt + x.durationMs - Date.now()) / 1000));
        return { ...x, remaining };
      }));
    }, 500);
    timersRef.current.set(id, { commitTimer, tickTimer, onCommit, onUndo });
    setItems((prev) => [...prev, item]);
    return id;
  }, [commitNow]);

  // Flush all on unmount (commit anything still pending)
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t.commitTimer));
      timersRef.current.forEach((t) => t.tickTimer && clearInterval(t.tickTimer));
    };
  }, []);

  const contextValue = useMemo(
    () => ({ schedule, undo, commitNow }),
    [schedule, undo, commitNow],
  );

  return (
    <UndoContext.Provider value={contextValue}>
      {children}
      <UndoBar items={items} onUndo={undo} onDismiss={commitNow} />
    </UndoContext.Provider>
  );
};

const UndoBar = ({ items, onUndo, onDismiss }) => {
  if (items.length === 0) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[95vw]"
      data-testid="undo-bar"
    >
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border"
          style={{
            background: '#0A2E1F',
            color: '#F3FBF6',
            borderColor: '#0F3D2A',
            minWidth: 360,
          }}
          data-testid={`undo-toast-${it.id}`}
        >
          {/* Countdown ring */}
          <div className="relative w-8 h-8 shrink-0" aria-hidden>
            <svg viewBox="0 0 36 36" className="w-8 h-8">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#1F5A3F" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - Math.max(0, it.remaining) / Math.round(it.durationMs / 1000))}`}
                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold">
              {it.remaining}s
            </span>
          </div>

          <div className="flex-1 text-sm font-medium truncate" data-testid={`undo-toast-label-${it.id}`}>
            {it.label}
          </div>

          <button
            onClick={() => onUndo(it.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-sm transition-colors"
            style={{ background: '#10B981', color: '#062017' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#34D399')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#10B981')}
            data-testid={`undo-btn-${it.id}`}
          >
            <Undo2 size={14}/> Undo
          </button>

          <button
            onClick={() => onDismiss(it.id)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Delete now"
            data-testid={`undo-dismiss-${it.id}`}
          >
            <X size={14}/>
          </button>
        </div>
      ))}
    </div>
  );
};
