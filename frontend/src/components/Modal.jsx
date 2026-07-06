import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Module-level stack of open modals so nested ones don't all close on Escape.
const modalStack = [];

const Modal = ({ open, onClose, title, children, maxWidth = '560px', overflow = 'auto', testId = 'modal' }) => {
  // Each opened modal gets a stable id and a depth tracked via state, so nested
  // modals render above their parents (z-index scales with depth).
  const [stackId] = useState(() => Symbol('modal'));
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!open) return;
    modalStack.push(stackId);
    setDepth(modalStack.length);

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Only the topmost modal in the stack reacts to Escape.
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
  // Only the topmost open modal closes when its dark backdrop is clicked —
  // clicks on the parent's now-hidden backdrop should not bubble through.
  const handleOverlayClick = () => {
    if (modalStack[modalStack.length - 1] === stackId) onClose?.();
  };
  // 50 is the base; +10 per modal level so each nested modal stacks above the previous.
  const z = 50 + depth * 10;
  // Render into document.body so the modal isn't a DOM descendant of any parent <form>.
  // This avoids invalid nested-form behaviour where the child form's submit bubbles up.
  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{ zIndex: z }}
    >
      <div className="modal-content" style={{ maxWidth, overflowY: overflow }} onClick={(e) => e.stopPropagation()} data-testid={testId}>
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" data-testid={`${testId}-close`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
