import { useEffect } from 'react';

// Closes an overlay (modal, drawer) with the Escape key while it is open, so keyboard users are
// never trapped behind a backdrop that only a mouse click can dismiss.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
