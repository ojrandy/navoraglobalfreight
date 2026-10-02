import React from 'react';
import { MapPin, Clock, Mail } from 'lucide-react';
import { FacilityNetworkMap } from '../components/FacilityNetworkMap';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { useNow } from '../utils/useNow';
import { GATEWAYS, formatGatewayTime, type GatewayRegion } from '../data/gateways';
import './LocationsPage.css';

interface LocationsPageProps {
  onNavigate?: (page: string, param?: string) => void;
}

const REGION_ORDER: GatewayRegion[] = ['Africa', 'Europe', 'Middle East', 'Asia', 'Americas', 'Oceania'];

export const LocationsPage: React.FC<LocationsPageProps> = ({ onNavigate }) => {
  const now = useNow();

  const contactGateway = onNavigate ? (code: string) => onNavigate('contact', code) : undefined;

  const regions = REGION_ORDER
    .map((region) => ({ region, gateways: GATEWAYS.filter((g) => g.region === region) }))
    .filter((group) => group.gateways.length > 0);

  return (
    <div className="sdl-page-locations">
      {/* =========================================================================
          1. CINEMATIC HERO SECTION
          ========================================================================= */}
      <section className="sdl-locations-hero">
        <ResponsiveImage
          name="locations-hero"
          alt="Aerial view of a container ship berthed at a lit port terminal at night"
          eager
          sizes="100vw"
          className="locations-hero-media"
          imgClassName="locations-hero-img"
        />
        <div className="locations-hero-bg-overlay" />
        <div className="sdl-container-wide locations-hero-inner">
          <div className="locations-hero-pill animate-fade-in">
            <span className="locations-pulse-dot" />
            <span>GLOBAL NETWORK</span>
          </div>

          <h1 className="locations-hero-title animate-fade-in">
            Wherever it's going, <span className="locations-highlight-accent">we're already connected.</span>
          </h1>

          <p className="locations-hero-lead animate-fade-in">
            Our gateways and trade lanes link the world's major markets, so your cargo moves on routes we know well.
          </p>
        </div>
      </section>

      {/* =========================================================================
          2. MAIN BODY: MAP & GATEWAY CARDS
          ========================================================================= */}
      <div className="sdl-container-wide sdl-locations-content">
        <div className="locations-map-feature animate-fade-in">
          <div className="map-card-header">
            <div className="map-badge-pill font-mono">GLOBAL NETWORK</div>
            <h3>Gateways & scheduled trade lanes</h3>
          </div>
          <FacilityNetworkMap onContactGateway={contactGateway} />
        </div>

        <div className="facilities-section-head">
          <h2>Our gateways</h2>
        </div>

        <div className="gateway-regions">
          {regions.map(({ region, gateways }) => (
            <section key={region} className="gateway-region-group" aria-labelledby={`region-${region}`}>
              <h3 id={`region-${region}`} className="gateway-region-title font-mono">{region}</h3>
              <div className="locations-list-grid">
                {gateways.map((gw) => {
                  const local = formatGatewayTime(gw.timeZone, now);
                  return (
                    <div key={gw.code} className="facility-card">
                      <div className="facility-card-top">
                        <span className="gateway-code-pill font-mono">{gw.code}</span>
                        <h3>{gw.name}</h3>
                      </div>
                      <p className="fac-address">
                        <MapPin size={14} className="text-accent" />
                        <span>{gw.city}, {gw.country}</span>
                      </p>

                      <div className="gateway-modes">
                        {gw.modes.map((mode) => (
                          <span key={mode} className="gateway-mode-tag font-mono">{mode}</span>
                        ))}
                    </div>

                    <div className="fac-meta-info">
                      <div className="fac-meta-row">
                        <Clock size={14} className="text-accent" />
                        <span>
                          Local time <strong className="font-mono">{local.time}</strong>
                          {local.offset && <span className="gateway-offset"> {local.offset}</span>}
                        </span>
                      </div>
                    </div>

                    {contactGateway && (
                      <button
                        type="button"
                        className="gateway-contact-btn"
                        onClick={() => contactGateway(gw.code)}
                        aria-label={`Contact the ${gw.city} gateway`}
                      >
                        <Mail size={15} />
                        <span>Contact this gateway</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        </div>

        <p className="gateways-footnote">
          Don't see your city? We deliver well beyond these gateways. Ask us about your lane.
        </p>
      </div>
    </div>
  );
};
