import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = '540px'
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="apni-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        ref={dialogRef}
        className="apni-modal-container glass-panel"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="apni-modal-header">
          <div>
            <h3 id="modal-title" className="apni-modal-title">{title}</h3>
            {description && <p className="apni-modal-description">{description}</p>}
          </div>
          <button className="apni-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="apni-modal-body">{children}</div>

        {footer && <div className="apni-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
