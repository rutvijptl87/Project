import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, maxWidth = '560px', testId = 'modal' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} data-testid={`${testId}-overlay`}>
      <div className="modal-content" style={{ maxWidth }} onClick={(e) => e.stopPropagation()} data-testid={testId}>
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" data-testid={`${testId}-close`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
