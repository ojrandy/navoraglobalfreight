import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowRight,
  Truck,
  FileText,
  AlertTriangle,
  Clock,
  Layers,
  Phone,
  Headphones,
  X
} from 'lucide-react';
import { SupportModal } from '../components/SupportModal';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { Shipment } from '../types/shipment';
import { api } from '../services/api';
import { useCompanyContact } from '../utils/useCompanyContact';
import { COMPANY_SHORT } from '../config/brand';
import { useEscapeKey } from '../utils/useEscapeKey';
import { parseTrackingInput } from '../shared/trackingId';
import { shipmentStatusLabel, shipmentStatusTone } from '../shared/shipmentStatus';
import './TrackPage.css';

interface TrackPageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
  notFoundQuery?: string | null;
}

// CONTENT §6.1 multi-track limit.
const MAX_BATCH = 10;

type BatchResult = { query: string; shipment: Shipment | null };

// Status pill colour on a batch card.
function batchPillClass(shipment: Shipment): 'delivered' | 'delayed' | 'transit' {
  const tone = shipmentStatusTone(shipment.status);
  if (tone === 'delivered') return 'delivered';
  if (tone === 'hold' || tone === 'delayed' || tone === 'returning') return 'delayed';
  return 'transit';
}

function isDelayedOrHeld(shipment: Shipment): boolean {
  return batchPillClass(shipment) === 'delayed' || shipment.health === 'POTENTIAL_DELAY' || shipment.health === 'ATTENTION_REQUIRED';
}

function placeText(place: any): string {
  if (!place) return '';
  if (typeof place === 'string') return place;
  return place.facility || [place.city, place.state].filter(Boolean).join(', ');
}

export const TrackPage: React.FC<TrackPageProps> = ({ onTrack, onNavigate, notFoundQuery }) => {
  // An empty phone hides its badge (no placeholder number).
  const { phone: supportPhone } = useCompanyContact();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Batch Multi-Tracking Drawer State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  useEscapeKey(batchModalOpen, () => setBatchModalOpen(false));
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED'>('ALL');

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ngf_recent_tracking');
      if (saved) {
        setRecentSearches(JSON.parse(saved).slice(0, 4));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const saveRecentSearch = (num: string) => {
    try {
      const clean = num.trim().toUpperCase();
      const existing = recentSearches.filter(n => n.toUpperCase() !== clean);
      const updated = [clean, ...existing].slice(0, 4);
      setRecentSearches(updated);
      localStorage.setItem('ngf_recent_tracking', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackingNumber.trim();
    if (clean) {
      saveRecentSearch(clean);
      onTrack(clean);
    }
  };

  const handleQuickTrack = (num: string) => {
    setTrackingNumber(num);
    saveRecentSearch(num);
    onTrack(num);
  };

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawNumbers = multiInput.split('\n').map(s => s.trim()).filter(Boolean).slice(0, MAX_BATCH);
    if (rawNumbers.length === 0) return;

    if (rawNumbers.length === 1) {
      handleQuickTrack(rawNumbers[0]);
      return;
    }

    // Each number is looked up through the same masked public endpoint single tracking
    // uses (api.trackShipment -> /api/track/:id), so no unmasked details are exposed. An ID
    // that isn't found is shown as not found (nothing is made up for it).
    const resolved: BatchResult[] = await Promise.all(
      rawNumbers.map(async (num) => {
        const clean = num.toUpperCase();
        try {
          const real = await api.trackShipment(clean);
          if (real) return { query: clean, shipment: real };
        } catch {
          // not found — shown as not found below
        }
        return { query: clean, shipment: null };
      })
    );

    setBatchResults(resolved);
    setBatchFilter('ALL');
    setBatchModalOpen(true);
  };

  const found = batchResults.filter((r): r is { query: string; shipment: Shipment } => r.shipment !== null);
  const inTransitCount = found.filter(r => batchPillClass(r.shipment) === 'transit').length;
  const deliveredCount = found.filter(r => batchPillClass(r.shipment) === 'delivered').length;
  const delayedCount = found.filter(r => isDelayedOrHeld(r.shipment)).length;

  const visibleResults = batchResults.filter(r => {
    if (batchFilter === 'ALL') return true;
    if (!r.shipment) return false;
    if (batchFilter === 'IN_TRANSIT') return batchPillClass(r.shipment) === 'transit';
    if (batchFilter === 'DELIVERED') return batchPillClass(r.shipment) === 'delivered';
    return isDelayedOrHeld(r.shipment);
  });

  return (
    <div className="ngf-page-track">
      {/* =========================================================================
          1. TRACKING HERO
          ========================================================================= */}
      <section className="track-hero-section">
        <ResponsiveImage
          name="track-hero"
          alt="Lorry with its headlights on, driving a mountain road at dusk"
          eager
          sizes="100vw"
          className="track-hero-media"
          imgClassName="track-hero-img"
        />
        <div className="track-hero-bg-overlay" />
        <div className="ngf-container-wide track-hero-container">
          <div className="track-hero-header">
            <h1 className="track-hero-headline animate-fade-in">Track your shipment</h1>
            <p className="track-hero-subtext animate-fade-in">
              Enter your 8-character {COMPANY_SHORT} tracking ID to see where your shipment is right now.
            </p>
          </div>

          {/* Not Found Alert Banner */}
          {notFoundQuery && (
            <div className="track-not-found-banner animate-fade-in" role="alert">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              {/* Malformed input (neither a tracking ID nor a quote reference) gets format help;
                  a well-formed ID that isn't on file gets "not found" (same split as /api/track 400/404). */}
              {!parseTrackingInput(notFoundQuery) && !notFoundQuery.trim().toUpperCase().startsWith('QR') ? (
                <p>Tracking IDs start with NGF and are 8 characters long, e.g. <span className="font-mono">NGF7K2M9</span>.</p>
              ) : (
                <p>
                  We couldn't find a shipment with ID <span className="font-mono font-bold">{notFoundQuery.trim().toUpperCase()}</span>. Check the characters and try again, or{' '}
                  <button type="button" className="track-inline-link" onClick={() => onNavigate('contact')}>contact us</button>{' '}
                  and we'll look it up for you.
                </p>
              )}
            </div>
          )}

          {/* =========================================================================
              2. TRACKING CARD
              ========================================================================= */}
          <div className="track-terminal-card animate-fade-in">
            {/* Mode Switcher Tabs */}
            <div className="terminal-tabs-row">
              <button
                type="button"
                className={`terminal-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                onClick={() => setActiveTab('single')}
              >
                <Search size={16} />
                <span>One ID</span>
              </button>

              <button
                type="button"
                className={`terminal-tab-btn ${activeTab === 'batch' ? 'active' : ''}`}
                onClick={() => setActiveTab('batch')}
              >
                <Layers size={16} />
                <span>Track several shipments</span>
              </button>
            </div>

            {/* TAB 1: SINGLE TRACKING */}
            {activeTab === 'single' && (
              <form onSubmit={handleSingleSubmit} className="terminal-form-single">
                <div className="terminal-input-wrapper">
                  <Search size={22} className="terminal-search-icon" />
                  <input
                    type="text"
                    placeholder="e.g. NGF7K2M9"
                    aria-label="Tracking ID"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="terminal-input font-mono"
                    autoFocus
                  />
                  {trackingNumber && (
                    <button
                      type="button"
                      className="terminal-clear-btn"
                      onClick={() => setTrackingNumber('')}
                      aria-label="Clear"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button type="submit" className="btn-corp-primary terminal-submit-btn">
                  <span>Track</span>
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            {/* TAB 2: BATCH MULTI-TRACKING */}
            {activeTab === 'batch' && (
              <form onSubmit={handleMultiSubmit} className="terminal-form-batch">
                <label className="batch-label" htmlFor="track-batch-input">
                  Enter up to 10 tracking IDs, one per line.
                </label>
                <textarea
                  id="track-batch-input"
                  rows={4}
                  value={multiInput}
                  onChange={(e) => setMultiInput(e.target.value)}
                  className="terminal-textarea font-mono"
                  placeholder="NGF7K2M9&#10;NGF8M4PQ&#10;NGF3J7NK"
                />
                <div className="batch-actions-row">
                  <button type="submit" className="btn-corp-primary terminal-submit-btn">
                    <span>Track</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </form>
            )}

            {/* Recent searches (only numbers this visitor has looked up) */}
            {recentSearches.length > 0 && (
              <div className="terminal-footer">
                <div className="recent-searches-group">
                  <span className="quick-samples-label">Recently tracked:</span>
                  <div className="quick-chips-row">
                    {recentSearches.map((num, i) => (
                      <button
                        key={i}
                        type="button"
                        className="recent-chip-btn font-mono"
                        onClick={() => handleQuickTrack(num)}
                      >
                        <Clock size={12} />
                        <span>{num}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. WHERE TO FIND YOUR ID
          ========================================================================= */}
      <section className="track-reference-section">
        <div className="ngf-container-wide">
          <div className="section-center-header">
            <h2>Where to find your ID</h2>
            <div className="section-header-line" />
          </div>

          <div className="track-reference-grid">
            <div className="reference-card">
              <div className="ref-icon-box accent">
                <FileText size={24} />
              </div>
              <h3>Booking confirmation</h3>
              <p>It's in the email or SMS we sent when your shipment was booked.</p>
            </div>

            <div className="reference-card">
              <div className="ref-icon-box emerald">
                <Truck size={24} />
              </div>
              <h3>Waybill / label</h3>
              <p>Printed at the top of your waybill and on every piece label.</p>
            </div>

            <div className="reference-card">
              <div className="ref-icon-box sky">
                <Headphones size={24} />
              </div>
              <h3>Your coordinator</h3>
              <p>Any {COMPANY_SHORT} coordinator can find it from your name, reference or phone number.</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. HELP BANNER
          ========================================================================= */}
      <section className="track-support-section">
        <div className="ngf-container-wide">
          <div className="track-support-card">
            <div className="support-card-content">
              <h2>Need help with an active shipment?</h2>
              <p>Our operations desk is available 24/7.</p>
              {supportPhone && (
                <div className="support-contact-strip">
                  <div className="support-phone-badge">
                    <Phone size={16} className="text-accent" />
                    <span className="font-mono font-bold">{supportPhone}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="support-card-actions">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => setSupportModalOpen(true)}
              >
                <span>Contact Support</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Support Modal */}
      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        initialTrackingNumber={trackingNumber.trim().toUpperCase()}
      />

      {/* =========================================================================
          5. SEVERAL SHIPMENTS: RESULTS
          ========================================================================= */}
      {batchModalOpen && (
        <div className="batch-modal-backdrop animate-fade-in" onClick={() => setBatchModalOpen(false)}>
          <div
            className="batch-modal-dialog animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="batch-modal-header">
              <div>
                <div className="batch-header-title">
                  <Truck size={20} className="text-accent" />
                  <h3 id="batch-modal-title">Track several shipments</h3>
                </div>
              </div>
              <button className="batch-modal-close" onClick={() => setBatchModalOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="batch-filter-bar">
              <div className="batch-filter-pills">
                <button
                  type="button"
                  className={`batch-filter-btn ${batchFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setBatchFilter('ALL')}
                >
                  All ({batchResults.length})
                </button>
                <button
                  type="button"
                  className={`batch-filter-btn ${batchFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                  onClick={() => setBatchFilter('IN_TRANSIT')}
                >
                  {shipmentStatusLabel('IN_TRANSIT')} ({inTransitCount})
                </button>
                <button
                  type="button"
                  className={`batch-filter-btn ${batchFilter === 'DELIVERED' ? 'active' : ''}`}
                  onClick={() => setBatchFilter('DELIVERED')}
                >
                  {shipmentStatusLabel('DELIVERED')} ({deliveredCount})
                </button>
                <button
                  type="button"
                  className={`batch-filter-btn ${batchFilter === 'DELAYED' ? 'active' : ''}`}
                  onClick={() => setBatchFilter('DELAYED')}
                >
                  {shipmentStatusLabel('DELAYED')} / {shipmentStatusLabel('ON_HOLD').toLowerCase()} ({delayedCount})
                </button>
              </div>
            </div>

            <div className="batch-modal-body">
              <div className="batch-cards-grid">
                {visibleResults.map(({ query, shipment }, index) => {
                  if (!shipment) {
                    return (
                      <div key={`${query}-${index}`} className="batch-shipment-card batch-not-found">
                        <div className="batch-card-top">
                          <span className="batch-tracking-id">{query}</span>
                        </div>
                        <p className="batch-not-found-text">
                          {parseTrackingInput(query)
                            ? `We couldn't find a shipment with ID ${query}. Check the characters and try again.`
                            : 'Tracking IDs start with NGF and are 8 characters long, e.g. NGF7K2M9.'}
                        </p>
                      </div>
                    );
                  }

                  const origin = placeText(shipment.origin);
                  const destination = placeText(shipment.destination);
                  const current = shipment.currentFacility || placeText(shipment.currentLocation);
                  const eta = typeof shipment.estimatedDelivery === 'string'
                    ? shipment.estimatedDelivery
                    : (shipment.estimatedDelivery as any)?.date;

                  return (
                    <div key={`${query}-${index}`} className="batch-shipment-card">
                      <div className="batch-card-top">
                        <div>
                          <span className="batch-tracking-id">{shipment.trackingNumber}</span>
                          {shipment.service && <span className="batch-service-sub">{shipment.service}</span>}
                        </div>

                        <span className={`batch-status-pill ${batchPillClass(shipment)}`}>
                          {shipmentStatusLabel(shipment.status)}
                        </span>
                      </div>

                      <div className="batch-route-strip">
                        <div className="batch-route-point">
                          <small>Origin</small>
                          <strong>{origin || '—'}</strong>
                        </div>

                        <div className="batch-route-arrow">
                          <ArrowRight size={14} />
                        </div>

                        <div className="batch-route-point right">
                          <small>Destination</small>
                          <strong>{destination || '—'}</strong>
                        </div>
                      </div>

                      <div className="batch-metrics-row">
                        <div className="batch-metric-box">
                          <small>Last seen</small>
                          <strong>{current || '—'}</strong>
                        </div>
                        <div className="batch-metric-box">
                          <small>Estimated delivery</small>
                          <strong>{eta || '—'}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-inspect-batch-item"
                        onClick={() => {
                          setBatchModalOpen(false);
                          handleQuickTrack(shipment.trackingNumber);
                        }}
                      >
                        <span>Open tracking</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="batch-modal-footer">
              <span className="batch-footer-count">
                <strong>{found.length}</strong> of {batchResults.length} found
              </span>
              <button
                type="button"
                className="btn-corp-ghost"
                onClick={() => setBatchModalOpen(false)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
