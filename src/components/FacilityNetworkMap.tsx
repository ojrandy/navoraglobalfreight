import React, { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { destroyMap, fitWorldView, useLeaflet } from '../utils/leaflet';
import { greatCircleSegments } from '../utils/greatCircle';
import { useNow } from '../utils/useNow';
import { GATEWAYS, TRADE_LANES, type Gateway, getGateway, getLanePartners, formatGatewayTime } from '../data/gateways';
import 'leaflet/dist/leaflet.css';
import { MapPin, Clock, Layers, ZoomIn, ZoomOut, Compass, Radio, Route, Mail } from 'lucide-react';
import './FacilityNetworkMap.css';

interface FacilityNetworkMapProps {
  onContactGateway?: (code: string) => void;
}

const WORLD_BOUNDS: L.LatLngBoundsLiteral = GATEWAYS.map((g) => [g.lat, g.lng] as [number, number]);
const GATEWAY_ZOOM = 5;
// Below this zoom pins shrink to dots (the selected one keeps its code) so clusters stay readable.
const COMPACT_PIN_ZOOM = 2;

export const FacilityNetworkMap: React.FC<FacilityNetworkMapProps> = ({ onContactGateway }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [code: string]: L.Marker }>({});
  const [selectedGateway, setSelectedGateway] = useState<Gateway>(GATEWAYS[0]);
  const now = useNow();
  const L = useLeaflet(mapContainerRef);

  useEffect(() => {
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20, 15],
        zoom: 1,
        minZoom: 0,
        zoomSnap: 0.25,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        worldCopyJump: true
      });

      // Esri's ArcGIS Online basemap tiles: no API key required (CARTO's
      // basemaps.cartocdn.com now gates raster tiles behind a key, and raw
      // tile.openstreetmap.org throttles this kind of client-side traffic).
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7'
      }).addTo(map);

      // Scheduled trade lanes as great-circle arcs (subtle glowing dashed lines)
      TRADE_LANES.forEach(([from, to]) => {
        const a = getGateway(from);
        const b = getGateway(to);
        if (!a || !b) return;
        const arc = greatCircleSegments([a.lat, a.lng], [b.lat, b.lng]);

        // Outer glow
        L.polyline(arc, {
          color: '#D3070B',
          weight: 4,
          opacity: 0.2,
          dashArray: '8, 8'
        }).addTo(map);

        // Inner crisp line
        L.polyline(arc, {
          color: '#D3070B',
          weight: 2,
          opacity: 0.75,
          dashArray: '6, 6'
        }).addTo(map);
      });

      GATEWAYS.forEach((gw) => {
        const iconHtml = `
          <div class="facility-map-marker-pin ${gw.code === selectedGateway.code ? 'active' : ''}">
            <div class="marker-pulse-ring"></div>
            <div class="marker-pin-inner">
              <span class="marker-pin-code font-mono">${gw.code}</span>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-facility-div-icon',
          html: iconHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        const marker = L.marker([gw.lat, gw.lng], { icon: customIcon, title: `${gw.city}, ${gw.country}` }).addTo(map);

        marker.on('click', () => {
          setSelectedGateway(gw);
          map.flyTo([gw.lat, gw.lng], GATEWAY_ZOOM, { duration: 1.2 });
        });

        const popupContent = `
          <div class="facility-map-popup font-sans">
            <div class="popup-badge font-mono">${gw.code} GATEWAY</div>
            <h4>${gw.city}</h4>
            <p class="popup-address">${gw.country}</p>
            <p class="popup-type">${gw.modes.join(' · ')}</p>
          </div>
        `;
        marker.bindPopup(popupContent, { offset: [0, -16], closeButton: false });

        markersRef.current[gw.code] = marker;
      });

      const syncPinMode = () => {
        stageRef.current?.classList.toggle('pins-compact', map.getZoom() < COMPACT_PIN_ZOOM);
      };
      map.on('zoomend', syncPinMode);

      fitWorldView(map, WORLD_BOUNDS);
      syncPinMode();
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        destroyMap(mapInstanceRef.current);
        mapInstanceRef.current = null;
        markersRef.current = {};
      }
    };
  }, [L]);

  // Keep the active pin highlighted
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([code, marker]) => {
      const isSelected = code === selectedGateway.code;
      marker.getElement()?.querySelector('.facility-map-marker-pin')?.classList.toggle('active', isSelected);
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
  }, [selectedGateway, L]);

  const handleSelectGateway = (gw: Gateway) => {
    setSelectedGateway(gw);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([gw.lat, gw.lng], GATEWAY_ZOOM, { duration: 1.2 });
      markersRef.current[gw.code]?.openPopup();
    }
  };

  const handleResetZoom = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.closePopup();
      mapInstanceRef.current.flyToBounds(WORLD_BOUNDS, { padding: [24, 24], duration: 1.2 });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const localTime = formatGatewayTime(selectedGateway.timeZone, now);
  const lanePartners = getLanePartners(selectedGateway.code).map((code) => getGateway(code)?.city ?? code);

  return (
    <div className="facility-network-map-wrapper">
      {/* 1. Gateway Selector Chips */}
      <div className="facility-tabs-bar">
        <button
          type="button"
          className="btn-national-view"
          onClick={handleResetZoom}
          title="Show the whole network"
        >
          <Compass size={14} />
          <span>World View</span>
        </button>

        <div className="facility-chips-list">
          {GATEWAYS.map((gw) => (
            <button
              key={gw.code}
              type="button"
              className={`facility-chip ${selectedGateway.code === gw.code ? 'active' : ''}`}
              onClick={() => handleSelectGateway(gw)}
              aria-pressed={selectedGateway.code === gw.code}
            >
              <span className="chip-code font-mono">{gw.code}</span>
              <span className="chip-name">{gw.city}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Interactive Map Viewport */}
      <div ref={stageRef} className="facility-map-stage">
        <div ref={mapContainerRef} className="facility-leaflet-container" />

        {/* Map Floating HUD Controls */}
        <div className="facility-map-controls">
          <button type="button" onClick={handleZoomIn} aria-label="Zoom in" title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={handleZoomOut} aria-label="Zoom out" title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button type="button" onClick={handleResetZoom} aria-label="Show the whole network" title="World view">
            <Compass size={16} />
          </button>
        </div>

        {/* Legend Badge */}
        <div className="facility-map-legend font-mono">
          <div className="legend-item">
            <span className="legend-marker-dot"></span>
            <span>Gateway</span>
          </div>
          <div className="legend-item">
            <span className="legend-line-dash"></span>
            <span>Trade lane</span>
          </div>
        </div>
      </div>

      {/* 3. Selected Gateway Spotlight Card */}
      <div className="facility-spotlight-card animate-fade-in">
        <div className="spotlight-header">
          <div>
            <div className="spotlight-code-badge font-mono">
              <Radio size={12} className="text-accent" />
              <span>{selectedGateway.code} GATEWAY</span>
            </div>
            <h3>{selectedGateway.city}</h3>
            <p className="spotlight-type">{selectedGateway.country}</p>
          </div>
          {onContactGateway && (
            <button
              type="button"
              className="spotlight-contact-btn"
              onClick={() => onContactGateway(selectedGateway.code)}
            >
              <Mail size={16} />
              <span>Contact this gateway</span>
            </button>
          )}
        </div>

        <div className="spotlight-details-grid">
          <div className="spotlight-info-item">
            <MapPin size={16} className="text-accent flex-shrink-0" />
            <div>
              <small>City, Country</small>
              <strong>{selectedGateway.city}, {selectedGateway.country}</strong>
            </div>
          </div>

          <div className="spotlight-info-item">
            <Clock size={16} className="text-accent flex-shrink-0" />
            <div>
              <small>Local time</small>
              <strong>{localTime.time}{localTime.offset && ` (${localTime.offset})`}</strong>
            </div>
          </div>

          <div className="spotlight-info-item">
            <Layers size={16} className="text-accent flex-shrink-0" />
            <div>
              <small>Modes</small>
              <div className="spotlight-services-pills">
                {selectedGateway.modes.map((mode) => (
                  <span key={mode} className="service-tag font-mono">{mode}</span>
                ))}
              </div>
            </div>
          </div>

          {lanePartners.length > 0 && (
            <div className="spotlight-info-item">
              <Route size={16} className="text-accent flex-shrink-0" />
              <div>
                <small>Direct trade lanes</small>
                <strong>{lanePartners.join(' · ')}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
