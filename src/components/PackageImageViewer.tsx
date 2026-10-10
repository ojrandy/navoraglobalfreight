import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryImage } from './PackageGallery';
import './PackageImageViewer.css';

interface PackageImageViewerProps {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Full-screen photo viewer for the track page gallery. Esc closes, the arrow keys move between
 * photos, and Tab stays inside the dialog. The gallery returns focus to the opener on close.
 */
export const PackageImageViewer: React.FC<PackageImageViewerProps> = ({ images, index, onIndexChange, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const image = images[index];
  const total = images.length;
  const go = (delta: number) => onIndexChange((index + delta + total) % total);

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
      } else if (e.key === 'ArrowRight' && total > 1) {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' && total > 1) {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
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
  });

  if (!image) return null;

  return (
    <div className="ngf-viewer-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="ngf-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${total}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ngf-viewer-bar">
          <span className="ngf-viewer-count" aria-live="polite">Photo {index + 1} of {total}</span>
          <button ref={closeRef} type="button" className="ngf-viewer-btn" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <figure className="ngf-viewer-figure">
          <img
            key={image.url}
            src={image.url}
            alt={image.caption}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
          />
          <figcaption>{image.caption}</figcaption>
        </figure>
        {total > 1 && (
          <>
            <button type="button" className="ngf-viewer-btn ngf-viewer-prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <button type="button" className="ngf-viewer-btn ngf-viewer-next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
