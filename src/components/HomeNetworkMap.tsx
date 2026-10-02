import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { destroyMap, fitWorldView, useLeaflet, type Leaflet } from '../utils/leaflet';
import { greatCircleSegments } from '../utils/greatCircle';
import { GATEWAYS, TRADE_LANES, getGateway } from '../data/gateways';
import 'leaflet/dist/leaflet.css';
import './HomeNetworkMap.css';

interface HomeNetworkMapProps {
  activeCode: string;
  onSelectGateway: (code: string) => void;
}

// Below this zoom only the selected gateway keeps its code label (labels overlap in Europe).
const LABEL_ZOOM = 3;

const gatewayIcon = (leaflet: Leaflet, code: string, isSelected: boolean) =>
  leaflet.divIcon({
    className: 'hub-leaflet-marker-wrap',
    html: `
      <div class="hub-marker-beacon ${isSelected ? 'active-beacon' : ''}">
        <div class="hub-marker-ping"></div>
        <div class="hub-marker-core"></div>
        <div class="hub-marker-label font-mono">${code}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

export const HomeNetworkMap: React.FC<HomeNetworkMapProps> = ({ activeCode, onSelectGateway }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [code: string]: L.Marker }>({});
  const lastCodeRef = useRef(activeCode);
  const onSelectRef = useRef(onSelectGateway);
  onSelectRef.current = onSelectGateway;
  const L = useLeaflet(mapContainerRef);

  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 15],
      zoom: 1,
      minZoom: 0,
      maxZoom: 7,
      zoomSnap: 0.25,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
      worldCopyJump: true
    });

    // Esri's ArcGIS Online basemap tiles: no API key required, and unlike raw
    // tile.openstreetmap.org (which actively throttles/blocks this kind of client-side
    // production traffic — see FacilityNetworkMap.tsx and JourneyMap.tsx, already on
    // ArcGIS for the same reason), these are meant for exactly this kind of usage.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Trade lanes as great-circle arcs
    TRADE_LANES.forEach(([from, to]) => {
      const a = getGateway(from);
      const b = getGateway(to);
      if (!a || !b) return;
      L.polyline(greatCircleSegments([a.lat, a.lng], [b.lat, b.lng]), {
        color: '#D3070B',
        weight: 2,
        opacity: 0.7,
        dashArray: '6, 8',
        className: 'animated-corridor-line'
      }).addTo(map);
    });

    GATEWAYS.forEach((gw) => {
      const marker = L.marker([gw.lat, gw.lng], {
        icon: gatewayIcon(L, gw.code, gw.code === activeCode),
        title: `${gw.name}, ${gw.country}`,
        keyboard: true
      }).addTo(map);
      marker.on('click', () => onSelectRef.current(gw.code));
      markersRef.current[gw.code] = marker;
    });

    const syncLabelMode = () => {
      wrapperRef.current?.classList.toggle('labels-compact', map.getZoom() < LABEL_ZOOM);
    };
    map.on('zoomend', syncLabelMode);

    fitWorldView(map, L.latLngBounds(GATEWAYS.map((g) => [g.lat, g.lng] as [number, number])));
    syncLabelMode();

    mapInstanceRef.current = map;
    // The map opens on the whole network, even if a gateway was picked before it loaded.
    lastCodeRef.current = activeCode;

    return () => {
      destroyMap(map);
      mapInstanceRef.current = null;
      markersRef.current = {};
    };
  }, [L]);

  // Restyle markers when the selection changes and fly to a newly picked gateway
  // (the initial view stays on the whole network).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    GATEWAYS.forEach((gw) => {
      const marker = markersRef.current[gw.code];
      marker?.setIcon(gatewayIcon(L, gw.code, gw.code === activeCode));
      marker?.setZIndexOffset(gw.code === activeCode ? 1000 : 0);
    });

    if (lastCodeRef.current === activeCode) return;
    lastCodeRef.current = activeCode;
    const target = getGateway(activeCode);
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), LABEL_ZOOM), { duration: 1.2 });
    }
  }, [activeCode, L]);

  return (
    <div ref={wrapperRef} className="home-network-map-wrapper">
      <div ref={mapContainerRef} className="home-leaflet-map-container" />
      <div className="map-overlay-badge font-mono" aria-hidden="true">
        <span className="legend-gateway-dot" /> <span>Gateway</span>
        <span className="legend-lane-dash" /> <span>Trade lane</span>
      </div>
    </div>
  );
};
