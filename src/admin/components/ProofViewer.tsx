import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './ProofViewer.css';

interface ProofViewerProps {
  src: string;
  title: string;
  onClose: () => void;
  /** Shown under the image, e.g. the proof's details and review buttons. */
  children?: React.ReactNode;
}

/**
 * Full-size view of a payment screenshot (admin only; update F.5). Esc closes, Tab stays inside,
 * the page behind doesn't scroll. The caller returns focus to whatever opened it.
 */
export const ProofViewer: React.FC<ProofViewerProps> = ({ src, title, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="ngf-proof-viewer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="ngf-proof-viewer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ngf-proof-viewer-head">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="ngf-proof-viewer-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="ngf-proof-viewer-image">
          <img src={src} alt={title} />
        </div>
        {children && <div className="ngf-proof-viewer-body">{children}</div>}
      </div>
    </div>
  );
};
