import React, { useState, useEffect } from 'react';
import {
  Globe,
  Truck,
  ShieldCheck,
  ArrowRight,
  Zap,
  CheckCircle2,
  Calendar,
  Thermometer,
  FileCheck2,
  Building,
  Car
} from 'lucide-react';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { SdlImageName } from '../data/sdlImages';
import { COMPANY_SHORT } from '../config/brand';
import './ServicesPage.css';

interface ServicesPageProps {
  onNavigate: (page: string) => void;
  // Tier to open on arrival (#/services/<tier-id>, e.g. from the footer).
  initialServiceId?: string;
  // Changes on every navigation request, so the same tier link works twice in a row.
  serviceRequest?: number;
}

// Copy: docs/CONTENT.md §3. Values marked [confirm] there are shown as written, pending the owner.
interface ServiceTier {
  id: string;
  name: string;
  summary: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  idealFor: string;
  compare: { speed: string; modes: string; maxWeight: string; tracking: string; signature: string };
  fastest?: boolean;
}

const SERVICE_TIERS: ServiceTier[] = [
  {
    id: 'priority-courier',
    name: 'Priority Express Courier',
    summary: 'Our fastest door-to-door service for urgent documents and parcels, worldwide.',
    highlights: [
      'Same-day collection when booked before the cut-off',
      'Fastest available air routing',
      'Customs pre-alert and pre-clearance where possible',
      'Signature on delivery'
    ],
    specs: [
      { label: 'Weight', value: 'Up to 70 kg per piece' },
      { label: 'Dimensions', value: 'Up to 120 × 80 × 80 cm' },
      { label: 'Tracking', value: 'Every scan, live' },
      { label: 'Signature', value: 'Always' },
      { label: 'Cover', value: 'Standard liability, with extended cover on request' }
    ],
    idealFor: 'Contracts, samples, spare parts, urgent e-commerce orders',
    compare: { speed: 'Fastest available routing', modes: 'Air, door to door', maxWeight: '70 kg per piece', tracking: 'Every scan, live', signature: 'Always' },
    fastest: true
  },
  {
    id: 'scheduled-freight',
    name: 'Scheduled Freight & Linehaul',
    summary: 'Air, ocean and road freight on fixed departures, built for regular volumes and predictable transit.',
    highlights: [
      'Air freight consolidations',
      'Ocean FCL and LCL',
      'Cross-border road linehaul',
      'Palletised and oversized cargo'
    ],
    specs: [
      { label: 'Weight', value: 'From 70 kg to full container/truckload' },
      { label: 'Dimensions', value: 'Pallet, container or project cargo' },
      { label: 'Tracking', value: 'Milestone updates at every gateway' },
      { label: 'Signature', value: 'At delivery' },
      { label: 'Cover', value: 'Standard liability, with cargo insurance on request' }
    ],
    idealFor: 'Stock replenishment, manufacturing inputs, distributor supply',
    compare: { speed: 'Fixed departures, predictable transit', modes: 'Air · Ocean · Road', maxWeight: 'Full container/truckload', tracking: 'Milestone updates at every gateway', signature: 'At delivery' }
  },
  {
    id: 'vehicle-shipping',
    name: 'Vehicle Shipping & Transport',
    summary: 'International and domestic shipping for cars, motorcycles and fleet vehicles.',
    highlights: [
      'Container or RoRo shipping',
      'Enclosed carrier option',
      'Export/import documentation',
      'Condition report with photos at collection and delivery'
    ],
    specs: [
      { label: 'Vehicles', value: 'Cars, SUVs, motorcycles, light commercial' },
      { label: 'Tracking', value: 'Milestone updates plus vessel/carrier status' },
      { label: 'Signature', value: 'Condition report sign-off' },
      { label: 'Cover', value: 'Marine insurance on request' }
    ],
    idealFor: 'Dealers, exporters, relocations, fleet moves',
    compare: { speed: 'Scheduled vessel or carrier departures', modes: 'Container · RoRo · Enclosed carrier', maxWeight: 'Cars, SUVs, motorcycles, light commercial', tracking: 'Milestones plus vessel/carrier status', signature: 'Condition report sign-off' }
  },
  {
    id: 'secure-vault',
    name: 'Secure Vault & High-Value',
    summary: 'Sealed, tamper-evident transport with restricted hand-offs for valuables and sensitive cargo.',
    highlights: [
      'Tamper-evident sealed pouches and cases',
      'Restricted, named hand-offs',
      'Photo and seal-number verification at each stage',
      'ID-checked release'
    ],
    specs: [
      { label: 'Weight', value: 'Up to 30 kg per piece' },
      { label: 'Tracking', value: 'Every hand-off, with the seal number' },
      { label: 'Signature', value: 'ID-verified, named recipient only' },
      { label: 'Cover', value: 'Declared-value cover on request' }
    ],
    idealFor: 'Legal and financial documents, jewellery, pharmaceuticals, prototypes',
    compare: { speed: 'Door to door, restricted hand-offs', modes: 'Sealed, door to door', maxWeight: '30 kg per piece', tracking: 'Every hand-off, with the seal number', signature: 'ID-verified, named recipient only' }
  }
];

// CONTENT.md §3.3; bullets reuse §2.6, photos and alt text from §12.
const INDUSTRIES: { id: string; title: string; icon: React.ReactNode; desc: string; bullets: string[]; image: SdlImageName; alt: string }[] = [
  {
    id: 'healthcare',
    title: 'Healthcare & Life Sciences',
    icon: <Thermometer size={24} className="text-emerald" />,
    desc: 'Controlled hand-offs, priority customs lodgement and temperature-sensitive handling on request.',
    bullets: ['Temperature-sensitive handling (on request)', 'Sealed chain of custody', 'Priority customs lodgement'],
    image: 'industry-healthcare',
    alt: 'Gloved hands holding a sealed vaccine shipment box'
  },
  {
    id: 'technology',
    title: 'Technology & Electronics',
    icon: <Zap size={24} className="text-blue" />,
    desc: 'Secure vault options, protected packing guidance and signature-only release.',
    bullets: ['Secure vault option', 'Anti-static, protected packing guidance', 'Signature-only release'],
    image: 'industry-technology',
    alt: 'Server rack with network cables and status lights'
  },
  {
    id: 'automotive',
    title: 'Automotive & Fleet',
    icon: <Car size={24} className="text-amber" />,
    desc: 'Parts express to keep lines moving, plus complete vehicle shipping.',
    bullets: ['Line-side parts express', 'Vehicle export & import documentation', 'Enclosed and container shipping'],
    image: 'industry-automotive',
    alt: 'Aerial view of rows of new cars waiting for shipment'
  },
  {
    id: 'commercial',
    title: 'Commercial & Retail Distribution',
    icon: <Globe size={24} className="text-purple" />,
    desc: 'Scheduled consolidations, cross-border e-commerce and linked returns.',
    bullets: ['Multi-piece shipments under one ID', 'Scheduled consolidations', 'Simple returns with linked tracking'],
    image: 'industry-ecommerce',
    alt: 'Parcels stacked inside a delivery van'
  }
];

// CONTENT.md §3.4
const ADD_ONS: { title: string; body: string; icon: React.ReactNode; tone: string }[] = [
  { title: 'Signature Confirmation', body: 'Delivery is released only against a named signature.', icon: <ShieldCheck size={26} />, tone: 'emerald' },
  { title: 'Weekend Delivery', body: 'Saturday delivery on selected lanes.', icon: <Calendar size={26} />, tone: 'accent' },
  { title: 'Hold for Collection', body: 'Keep your shipment at the destination gateway for the recipient to collect.', icon: <Building size={26} />, tone: 'purple' },
  { title: 'Enclosed Vehicle Care', body: 'Soft-tie securing and enclosed transport for high-value vehicles.', icon: <Car size={26} />, tone: 'sky' }
];

// CONTENT.md §3.5 (step text reuses §2.3)
const PROCESS: { title: string; body: string }[] = [
  { title: 'Digital Booking & Labels', body: `Book online or with a coordinator. You get your 8-character ${COMPANY_SHORT} tracking ID and a barcode label for every piece straight away.` },
  { title: 'Gateway Scan', body: 'We collect from your door, weigh and scan every piece at the origin gateway, and prepare the export and customs documents.' },
  { title: 'Linehaul & Border Crossing', body: 'Your cargo travels on the fastest suitable lane: air, ocean or road. Customs clearance and each transfer are logged live.' },
  { title: 'Signed Proof of Delivery', body: 'Final-mile delivery to the door, with a signed digital proof of delivery sent to you the moment it lands.' }
];

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate, initialServiceId = '', serviceRequest = 0 }) => {
  const isTier = (id: string) => SERVICE_TIERS.some((s) => s.id === id);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    isTier(initialServiceId) ? initialServiceId : SERVICE_TIERS[0].id
  );
  const [activeIndustryTab, setActiveIndustryTab] = useState<string>(INDUSTRIES[0].id);

  useEffect(() => {
    if (!isTier(initialServiceId)) return;
    setSelectedServiceId(initialServiceId);
    document.getElementById('service-tiers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServiceId, serviceRequest]);

  const activeService = SERVICE_TIERS.find((s) => s.id === selectedServiceId) || SERVICE_TIERS[0];
  const activeIndustry = INDUSTRIES.find((ind) => ind.id === activeIndustryTab) || INDUSTRIES[0];

  return (
    <div className="sdl-page-services">
      {/* =========================================================================
          1. HERO (CONTENT.md §3)
          ========================================================================= */}
      <section className="services-hero-section">
        <ResponsiveImage
          name="services-hero"
          alt="Aircraft silhouetted against an orange sunset sky after take-off"
          eager
          sizes="100vw"
          className="services-hero-media"
          imgClassName="services-hero-img"
        />
        <div className="services-hero-overlay" />
        <div className="sdl-container-wide services-hero-inner">
          <div className="services-hero-badge animate-fade-in">
            <span className="services-badge-dot" />
            <span>OUR SERVICES</span>
          </div>

          <h1 className="services-hero-title animate-fade-in">
            Every mode. Every border. <br /><span className="services-highlight-accent">One accountable team.</span>
          </h1>
          <p className="services-hero-sub animate-fade-in">
            Choose the speed, security and mode that fit your cargo. We'll handle the route, the paperwork and the hand-offs.
          </p>

          <div className="services-hero-stats-row animate-fade-in">
            <div className="services-stat-pill">
              <span className="stat-num font-mono">5</span>
              <span className="stat-lbl">Continents served</span>
            </div>
            <div className="services-stat-pill">
              <span className="stat-num font-mono">Air · Ocean · Road</span>
              <span className="stat-lbl">Modes connected</span>
            </div>
            <div className="services-stat-pill">
              <span className="stat-num font-mono">8-character</span>
              <span className="stat-lbl">Tracking ID</span>
            </div>
            <div className="services-stat-pill">
              <span className="stat-num font-mono">24/7</span>
              <span className="stat-lbl">Operations desk</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. SERVICE TIERS (CONTENT.md §3.1)
          ========================================================================= */}
      <section id="service-tiers" className="services-explorer-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">SERVICE TIERS</span>
            <h2>Choose a service to see how it works</h2>
            <div className="section-header-line" />
          </div>

          {/* Tier Selection Tabs */}
          <div className="service-tab-nav">
            {SERVICE_TIERS.map((tier, i) => {
              const isSelected = tier.id === selectedServiceId;
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={`service-nav-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedServiceId(tier.id)}
                  aria-pressed={isSelected}
                >
                  <span className="nav-btn-badge font-mono">{String(i + 1).padStart(2, '0')}</span>
                  <strong className="nav-btn-title">{tier.name}</strong>
                </button>
              );
            })}
          </div>

          {/* Active Service Showcase Card */}
          <div className="active-service-showcase-card animate-fade-in">
            <div className="service-showcase-grid">
              {/* Left Details */}
              <div className="showcase-left">
                <div className="showcase-header">
                  <h3>{activeService.name}</h3>
                  <p className="showcase-tagline">{activeService.summary}</p>
                </div>

                <div className="showcase-features-list">
                  <h4>Highlights</h4>
                  {activeService.highlights.map((feat) => (
                    <div key={feat} className="feature-bullet">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="showcase-actions-row">
                  <button
                    type="button"
                    className="btn-corp-primary"
                    onClick={() => onNavigate('quote')}
                  >
                    <span>Get a Rate Quote</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-corp-ghost"
                    onClick={() => onNavigate('track')}
                  >
                    <span>Track a Shipment</span>
                  </button>
                </div>
              </div>

              {/* Right Specs Card */}
              <div className="showcase-right">
                <div className="specs-card-box">
                  <div className="specs-head">
                    <FileCheck2 size={18} className="text-accent" />
                    <h4>Service specifications</h4>
                  </div>

                  <div className="specs-items-list">
                    {activeService.specs.map((spec) => (
                      <div key={spec.label} className="spec-item">
                        <span className="spec-title">{spec.label}</span>
                        <strong className="spec-val font-mono">{spec.value}</strong>
                      </div>
                    ))}

                    <div className="spec-item ideal-for">
                      <span className="spec-title">Ideal for</span>
                      <p className="spec-desc">{activeService.idealFor}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. COMPARISON TABLE (CONTENT.md §3.2)
          ========================================================================= */}
      <section className="services-matrix-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">COMPARE</span>
            <h2>Compare speed and capability</h2>
            <div className="section-header-line" />
          </div>

          <div className="matrix-table-card">
            <div className="table-mobile-hint">
              <span>← Swipe to see the full table →</span>
            </div>
            <div className="table-responsive">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Transit speed</th>
                    <th>Modes</th>
                    <th>Max weight</th>
                    <th>Tracking detail</th>
                    <th>Signature</th>
                    <th>Best for</th>
                    <th aria-label="Quote" />
                  </tr>
                </thead>
                <tbody>
                  {SERVICE_TIERS.map((tier) => (
                    <tr key={tier.id}>
                      <td>
                        <div className="tier-col-title">
                          <strong>{tier.name}</strong>
                          {tier.fastest && <span className="tier-tag fast">Fastest</span>}
                        </div>
                      </td>
                      <td>{tier.compare.speed}</td>
                      <td>{tier.compare.modes}</td>
                      <td>{tier.compare.maxWeight}</td>
                      <td>{tier.compare.tracking}</td>
                      <td>{tier.compare.signature}</td>
                      <td>{tier.idealFor}</td>
                      <td>
                        <button type="button" className="table-action-btn" onClick={() => onNavigate('quote')}>
                          Quote
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. INDUSTRIES (CONTENT.md §3.3)
          ========================================================================= */}
      <section className="services-industry-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">INDUSTRIES</span>
            <h2>Solutions tailored to your industry</h2>
            <div className="section-header-line" />
          </div>

          <div className="industry-tabs-row">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                type="button"
                className={`industry-pill-btn ${ind.id === activeIndustryTab ? 'active' : ''}`}
                onClick={() => setActiveIndustryTab(ind.id)}
                aria-pressed={ind.id === activeIndustryTab}
              >
                {ind.title}
              </button>
            ))}
          </div>

          <div className="industry-showcase-card animate-fade-in">
            <div key={activeIndustry.id} className="ind-card-grid">
              <div className="ind-card-left">
                <div className="ind-icon-title-row">
                  <div className="ind-icon-box">{activeIndustry.icon}</div>
                  <div>
                    <h3>{activeIndustry.title}</h3>
                  </div>
                </div>
                <p className="ind-desc">{activeIndustry.desc}</p>

                <div className="ind-capabilities-list">
                  {activeIndustry.bullets.map((cap) => (
                    <div key={cap} className="ind-cap-row">
                      <CheckCircle2 size={16} className="text-emerald" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>

                <div className="ind-cta-row">
                  <button
                    type="button"
                    className="btn-corp-primary"
                    onClick={() => onNavigate('quote')}
                  >
                    <span>Get a Rate Quote</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>

              <div className="ind-card-right">
                <div className="ind-visual-box">
                  <ResponsiveImage
                    name={activeIndustry.image}
                    alt={activeIndustry.alt}
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="ind-visual-media"
                    imgClassName="ind-showcase-img"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. ADD-ONS (CONTENT.md §3.4)
          ========================================================================= */}
      <section className="services-addons-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">ADD-ONS</span>
            <h2>Extra care when you need it</h2>
            <div className="section-header-line" />
          </div>

          <div className="addons-grid-cool">
            {ADD_ONS.map((addon) => (
              <div key={addon.title} className="addon-card-cool">
                <div className={`addon-card-glow-bar glow-${addon.tone}`} />
                <div className="addon-top-meta">
                  <div className={`addon-icon-box icon-${addon.tone}`}>{addon.icon}</div>
                </div>
                <h3 className="addon-title-cool">{addon.title}</h3>
                <p className="addon-desc-cool">{addon.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. PROCESS STRIP (CONTENT.md §3.5)
          ========================================================================= */}
      <section className="services-lifecycle-section">
        <div className="sdl-container-wide">
          <div className="lifecycle-header">
            <span className="lifecycle-eyebrow">HOW IT WORKS</span>
            <h3>How every shipment moves through {COMPANY_SHORT}</h3>
            <p>Four stages, one tracking ID, and full visibility from the first scan to the final signature.</p>
          </div>

          <div className="lifecycle-steps-grid">
            {PROCESS.map((step, i) => (
              <div key={step.title} className="lifecycle-step-card">
                <span className="step-num font-mono">{String(i + 1).padStart(2, '0')}</span>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CTA (CONTENT.md §3.6)
          ========================================================================= */}
      <section className="services-bottom-cta">
        <div className="sdl-container-wide">
          <div className="services-cta-card">
            <div className="services-cta-content">
              <h2>Ready to ship with {COMPANY_SHORT}?</h2>
              <p>Get a rate in minutes, or talk to a coordinator about your lane.</p>
            </div>

            <div className="services-cta-actions">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => onNavigate('quote')}
              >
                <span>Get a Quote</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={() => onNavigate('contact')}
              >
                <span>Contact Us</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
