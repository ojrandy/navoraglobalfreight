import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import './TrackingLoadingScreen.css';

interface TrackingLoadingScreenProps {
  query: string;
}

// CONTENT §6.2: rotating lines while the lookup runs.
const LOADING_LINES = ['Locating your shipment…', 'Checking the latest scans…', 'Plotting the route…'];
const LINE_MS = 1400;

export const TrackingLoadingScreen: React.FC<TrackingLoadingScreenProps> = ({ query }) => {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLineIndex((i) => (i + 1) % LOADING_LINES.length), LINE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="sdl-tracking-loading-shell">
      <div className="tracking-loading-card">
        <div className="tracking-loading-radar">
          <div className="tl-radar-ring tl-ring-1" />
          <div className="tl-radar-ring tl-ring-2" />
          <div className="tl-radar-icon-badge">
            <Truck size={26} />
          </div>
        </div>

        <h2 className="tracking-loading-title" role="status" aria-live="polite">
          {LOADING_LINES[lineIndex]}
        </h2>
        {query && (
          <p className="tracking-loading-sub">
            <span className="tl-query-code font-mono">{query}</span>
          </p>
        )}

        <div className="tracking-loading-bar-track">
          <div className="tracking-loading-bar-fill" />
        </div>
      </div>
    </section>
  );
};
