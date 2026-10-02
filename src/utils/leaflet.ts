import { useEffect, useState, type RefObject } from 'react';
import type L from 'leaflet';

export type Leaflet = typeof L;

// Leaflet is fetched on demand (MOTION_3D_SPEC §2), so pages with no map on screen never
// download it. Every map shares one request; once it has resolved, later maps get the module
// on their first render and initialise exactly as they did with a static import.
let leafletModule: Leaflet | null = null;
let leafletRequest: Promise<Leaflet> | null = null;

function loadLeaflet(): Promise<Leaflet> {
  if (!leafletRequest) {
    leafletRequest = import('leaflet').then((mod) => {
      leafletModule = mod.default;
      return leafletModule;
    });
    // A failed chunk download (e.g. offline) must not stick: the next map can try again.
    leafletRequest.catch(() => {
      leafletRequest = null;
    });
  }
  return leafletRequest;
}

// Returns the Leaflet module once `targetRef` (the map container) is within 200px of the
// viewport, and null until then. Components keep rendering their own UI meanwhile; only the
// map canvas waits. The container's size comes from CSS, so nothing shifts when it fills in.
export function useLeaflet(targetRef: RefObject<HTMLElement>): Leaflet | null {
  const [leaflet, setLeaflet] = useState<Leaflet | null>(leafletModule);

  useEffect(() => {
    if (leaflet) return;
    let cancelled = false;
    const load = () => {
      loadLeaflet()
        .then((mod) => {
          if (!cancelled) setLeaflet(() => mod);
        })
        .catch((err) => console.error('[map] Could not load the map library:', err));
    };

    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [leaflet, targetRef]);

  return leaflet;
}

// Tears down a Leaflet map safely, even while a zoom animation is still running.
//
// Leaflet 1.9.4 finishes every animated zoom from a fixed 250 ms setTimeout
// (_animateZoom -> _onZoomTransitionEnd). map.remove() deletes the panes but leaves that
// timer and the _animatingZoom flag in place, so leaving a page mid-zoom (zoom buttons,
// flyTo, fitBounds) made the timer fire against a destroyed map and throw
// "Cannot read properties of undefined (reading '_leaflet_pos')". Clearing the flag first
// makes the late callback return straight away.
export function destroyMap(map: L.Map) {
  (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
  map.remove();
}

// Fits a world-scale map to `bounds` without showing the grey void above the Arctic or
// below the Antarctic: the minimum zoom is raised until the tiles fill the map height,
// and panning is held inside the tiled latitudes (longitude stays free to wrap).
export function fitWorldView(map: L.Map, bounds: L.LatLngBoundsExpression) {
  const snap = map.options.zoomSnap || 1;
  const fillZoom = Math.ceil(Math.log2(map.getSize().y / 256) / snap) * snap;
  map.setMinZoom(Math.max(0, fillZoom));
  map.setMaxBounds([[-85, -100000], [85, 100000]]);
  map.options.maxBoundsViscosity = 1;
  map.fitBounds(bounds, { padding: [24, 24] });
}
