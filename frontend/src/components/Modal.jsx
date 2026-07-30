import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Module-level stack of open modals so nested ones don't all close on Escape.
const modalStack = [];

const Modal = ({ open, onClose, title, children, maxWidth = '560px', overflow = 'auto', testId = 'modal' }) => {
  const [stackId] = useState(() => Symbol('modal'));
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!open) return;
    modalStack.push(stackId);
    setDepth(modalStack.length);

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== stackId) return;
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const idx = modalStack.indexOf(stackId);
      if (idx !== -1) modalStack.splice(idx, 1);
    };
  }, [open, onClose, stackId]);

  if (!open) return null;
  const handleOverlayClick = () => {
    if (modalStack[modalStack.length - 1] === stackId) onClose?.();
  };
  const z = 50 + depth * 10;
  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{ zIndex: z, padding: 'clamp(0.5rem, 4vw, 1.5rem)' }}
    >
      <div
        className="modal-content"
        style={{ maxWidth, overflowY: overflow, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="flex items-start justify-between px-4 sm:px-5 py-3 sm:py-4 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-lg sm:text-xl font-bold leading-snug pr-2" style={{ color: 'var(--cc-dark-green)' }}>{title}</h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 transition-colors shrink-0" data-testid={`${testId}-close`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;

