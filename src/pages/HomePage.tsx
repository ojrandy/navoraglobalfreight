import React, { useState } from 'react';
import {
  Package,
  Truck,
  Calculator,
  MapPin,
  Clock,
  Globe,
  Warehouse,
  ShieldCheck,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  Sparkles,
  Activity,
  Zap,
  Lock,
  FileText,
  FileCheck,
  Search,
  Shield,
  Users,
  Car,
  ChevronDown,
  ChevronUp,
  Plane,
  Ship,
  ScanBarcode
} from 'lucide-react';
import { Barcode } from '../components/Barcode';
import { HomeNetworkMap } from '../components/HomeNetworkMap';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { SdlImageName } from '../data/sdlImages';
import { GATEWAYS, getGateway, getLanePartners, formatGatewayTime } from '../data/gateways';
import { useNow } from '../utils/useNow';
import { useCompanyContact } from '../utils/useCompanyContact';
import { COMPANY, COMPANY_SHORT } from '../config/brand';
import { api } from '../services/api';
import './HomePage.css';

interface HomePageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

type IndustryTab = 'auto' | 'medical' | 'ecommerce' | 'tech';

// Copy: docs/CONTENT.md §2. Alt text: CONTENT.md §12.
const SERVICES: { title: string; body: string; cta: string; image: SdlImageName; alt: string }[] = [
  {
    title: 'Priority Express Courier',
    body: 'Time-critical documents and parcels, door to door, with the fastest available routing and customs pre-clearance where possible.',
    cta: 'Explore Express',
    image: 'service-priority-express',
    alt: 'Ground crew raising a cargo pallet to the hold door of a wide-body aircraft'
  },
  {
    title: 'Scheduled Freight & Linehaul',
    body: 'Air, ocean (FCL and LCL) and road freight on fixed departures, for regular volumes that need predictable transit times.',
    cta: 'Explore Freight',
    image: 'service-freight-linehaul',
    alt: 'Dock workers on a container ship deck as gantry cranes load stacked containers'
  },
  {
    title: 'Vehicle Shipping & Transport',
    body: 'Cars, motorcycles and fleet vehicles moved by container, RoRo or enclosed carrier, with documentation handled end to end.',
    cta: 'Explore Vehicle Shipping',
    image: 'service-vehicle-transport',
    alt: 'Roll-on/roll-off vehicle carrier ship berthed at a harbour quay'
  },
  {
    title: 'Secure Vault & High-Value',
    body: 'Sealed, tamper-evident transport for valuables, sensitive documents, pharmaceuticals and high-value electronics, with restricted hand-offs.',
    cta: 'Explore Secure Vault',
    image: 'service-secure-vault',
    alt: 'Close-up of the combination lock on a metal security case'
  }
];

const INDUSTRIES: { id: IndustryTab; icon: React.ReactNode; title: string; body: string; bullets: string[]; image: SdlImageName; alt: string }[] = [
  {
    id: 'auto',
    icon: <Car size={16} />,
    title: 'Automotive & Vehicles',
    body: 'Spare parts, components and complete vehicles, moved to keep production lines and dealerships running.',
    bullets: ['Line-side parts express', 'Vehicle export & import documentation', 'Enclosed and container shipping'],
    image: 'industry-automotive',
    alt: 'Mechanic working on a car engine with a spanner'
  },
  {
    id: 'medical',
    icon: <ShieldCheck size={16} />,
    title: 'Healthcare & Life Sciences',
    body: 'Samples, medical devices and pharmaceuticals handled with care, controlled hand-offs and full traceability.',
    bullets: ['Temperature-sensitive handling (on request)', 'Sealed chain of custody', 'Priority customs lodgement'],
    image: 'industry-healthcare',
    alt: 'Worker in gloves and a clean-room gown carrying sealed boxes'
  },
  {
    id: 'ecommerce',
    icon: <Package size={16} />,
    title: 'E-Commerce & Retail',
    body: 'Cross-border parcels, stock replenishment and returns for growing online brands.',
    bullets: ['Multi-piece shipments under one ID', 'Scheduled consolidations', 'Simple returns with linked tracking'],
    image: 'industry-ecommerce',
    alt: 'Online seller packing parcels next to a laptop'
  },
  {
    id: 'tech',
    icon: <Zap size={16} />,
    title: 'Technology & Electronics',
    body: 'High-value hardware and components moved securely, on time and fully insured on request.',
    bullets: ['Secure vault option', 'Anti-static, protected packing guidance', 'Signature-only release'],
    image: 'industry-technology',
    alt: 'Server rack with network cables and status lights'
  }
];

const STEPS: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: 'Book & Label',
    body: `Book online or with a coordinator. You get your 8-character ${COMPANY_SHORT} tracking ID and a barcode label for every piece straight away.`,
    icon: <FileText size={22} className="text-accent" />
  },
  {
    title: 'Collect & Verify',
    body: 'We collect from your door, weigh and scan every piece at the origin gateway, and prepare the export and customs documents.',
    icon: <Warehouse size={22} className="text-accent" />
  },
  {
    title: 'Move Across Borders',
    body: 'Your cargo travels on the fastest suitable lane: air, ocean or road. Customs clearance and each transfer are logged live.',
    icon: <Globe size={22} className="text-accent" />
  },
  {
    title: 'Deliver & Sign',
    body: 'Final-mile delivery to the door, with a signed digital proof of delivery sent to you the moment it lands.',
    icon: <ShieldCheck size={22} className="text-accent" />
  }
];

const TRUST_TILES: { title: string; body: string; icon: React.ReactNode }[] = [
  { title: 'Integrity Guarantee', body: 'What you hand us is exactly what arrives: counted, sealed and signed for.', icon: <ShieldCheck size={22} className="text-accent" /> },
  { title: 'Committed Schedules', body: 'Agreed windows, proactive updates and no silent delays.', icon: <Clock size={22} className="text-accent" /> },
  { title: 'Vetted Handlers', body: 'Every driver, agent and handler in our chain is vetted and accountable.', icon: <Users size={22} className="text-accent" /> },
  { title: 'Privacy by Design', body: 'Public tracking masks names and addresses. Your data stays yours.', icon: <Lock size={22} className="text-accent" /> },
  { title: 'Compliance First', body: 'Export, import and dangerous-goods rules are respected on every lane.', icon: <Shield size={22} className="text-accent" /> },
  { title: 'Digital Documents', body: 'Waybills, invoices and proof of delivery, available online at any time.', icon: <FileText size={22} className="text-accent" /> },
  { title: 'Piece-Level Barcodes', body: 'Every carton carries its own scannable label, linked to one tracking ID.', icon: <ScanBarcode size={22} className="text-accent" /> },
  { title: '24/7 Support', body: 'A real coordinator, whatever the hour and wherever you are.', icon: <Headphones size={22} className="text-accent" /> }
];

// CONTENT.md §2.10 Option A: stands in for testimonials until real, permitted ones exist.
const COMMITMENTS: { quote: string; body: string }[] = [
  { quote: 'You’ll always know where it is.', body: 'Live milestones on every shipment, with no exceptions.' },
  { quote: 'You’ll always reach a person.', body: 'A coordinator who knows your shipment, any time zone.' },
  { quote: 'You’ll hear from us first.', body: 'If something changes, we tell you before you have to ask.' }
];

// CONTENT.md §2.11: replaces the client-logo strip. Real partner logos only with written permission.
const MODES: { label: string; icon: React.ReactNode }[] = [
  { label: 'Air Freight', icon: <Plane size={20} className="text-accent" /> },
  { label: 'Ocean Freight', icon: <Ship size={20} className="text-accent" /> },
  { label: 'Road Freight', icon: <Truck size={20} className="text-accent" /> },
  { label: 'Express Courier', icon: <Package size={20} className="text-accent" /> },
  { label: 'Customs Brokerage', icon: <FileCheck size={20} className="text-accent" /> },
  { label: 'Secure Transport', icon: <Lock size={20} className="text-accent" /> }
];

const FAQS = [
  {
    q: 'Do I need an account to track a shipment?',
    a: 'No. Enter your 8-character tracking ID (for example NGF7K2M9) on the Track page and you’ll see its status and milestones straight away. Personal details are masked for privacy.'
  },
  {
    q: 'How does live tracking work?',
    a: 'Every piece is scanned at each hand-off: collection, gateway, departure, arrival, customs and delivery. Between scans, we show your shipment’s estimated position on its route.'
  },
  {
    q: 'Can I track a multi-piece shipment under one ID?',
    a: 'Yes. All pieces share one tracking ID, and each piece has its own label (for example NGF7K2M9-01, -02), so you can see every carton individually.'
  },
  {
    q: 'Do you handle customs clearance?',
    a: 'Yes. We prepare the export and import documentation with you and manage clearance on your behalf. Duties and taxes are billed as agreed at booking.'
  },
  {
    q: 'Are my documents available online?',
    a: 'Yes. Your waybill, invoice and signed proof of delivery can be viewed and downloaded from your tracking page.'
  }
];

export const HomePage: React.FC<HomePageProps> = ({ onTrack, onNavigate }) => {
  // Empty phone values hide their element (no placeholders).
  const { phone: supportPhone, email: dispatchEmail } = useCompanyContact();

  // Industry Solutions Interactive Tab State
  const [industryTab, setIndustryTab] = useState<IndustryTab>('auto');
  const activeIndustry = INDUSTRIES.find((ind) => ind.id === industryTab) ?? INDUSTRIES[0];

  // Callback Form State
  const [cbName, setCbName] = useState('');
  const [cbPhone, setCbPhone] = useState('');
  const [cbTime, setCbTime] = useState('');
  const [cbReference, setCbReference] = useState<string | null>(null);
  const [cbSubmitting, setCbSubmitting] = useState(false);
  const [cbError, setCbError] = useState<string | null>(null);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Global network map: selected gateway
  const [activeGatewayCode, setActiveGatewayCode] = useState('LOS');
  const activeGateway = getGateway(activeGatewayCode) ?? GATEWAYS[0];
  const now = useNow();
  const activeGatewayTime = formatGatewayTime(activeGateway.timeZone, now);
  const activeGatewayLanes = getLanePartners(activeGateway.code).map((code) => getGateway(code)?.city ?? code);

  // Stored as a message in the admin inbox; the server issues the NGF-TKT reference.
  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbName.trim() || !cbPhone.trim() || cbSubmitting) return;
    setCbSubmitting(true);
    setCbError(null);
    try {
      const saved = await api.submitContactMessage({
        name: cbName.trim(),
        email: '',
        phone: cbPhone.trim(),
        subject: 'Callback request',
        priority: 'urgent',
        message: cbTime.trim()
          ? `Callback requested from the Home page. Preferred time: ${cbTime.trim()}`
          : 'Callback requested from the Home page. No preferred time given.'
      });
      setCbReference(saved.id);
      setCbName('');
      setCbPhone('');
      setCbTime('');
    } catch (err) {
      setCbError(err instanceof Error && err.message ? err.message : 'We couldn’t send your request. Please try again.');
    } finally {
      setCbSubmitting(false);
    }
  };

  return (
    <div className="sdl-homepage-container">
      {/* =========================================================================
          1. HERO (CONTENT.md §2.1)
          ========================================================================= */}
      <section className="corp-hero-section">
        <ResponsiveImage
          name="hero-home"
          mobileName="hero-home-mobile"
          alt={`${COMPANY} truck at a container port at sunset, with a cargo ship, cranes and a ${COMPANY_SHORT} aircraft overhead`}
          eager
          sizes="100vw"
          className="corp-hero-media"
          imgClassName="corp-hero-img"
        />
        <div className="corp-hero-overlay" />
        <div className="sdl-container-wide corp-hero-inner">
          <div className="corp-hero-content animate-fade-in">
            <div className="corp-hero-badge">
              <span className="badge-pulse-dot" />
              <span>WORLDWIDE LOGISTICS NETWORK</span>
            </div>

            <h1 className="corp-hero-title">
              Connecting Markets, <br />
              <span className="sdl-highlight">Delivering Trust.</span>
            </h1>

            <p className="corp-hero-subtitle">
              Express parcels, freight, vehicles and high-value cargo, moved across borders by a team that answers, with one tracking ID from pickup to signed delivery.
            </p>

            <div className="corp-hero-cta-row">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => onNavigate('quote')}
              >
                <Calculator size={18} />
                <span>Get a Rate Quote</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={() => onNavigate('track')}
              >
                <Search size={18} />
                <span>Track a Shipment</span>
              </button>
            </div>
          </div>

          {/* Service promise panel */}
          <div className="corp-hero-service-showcase animate-scale-in">
            <div className="hero-showcase-header">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-accent" />
                <span className="showcase-header-title font-mono">OUR SERVICE PROMISE</span>
              </div>
            </div>

            <div className="hero-feature-rows">
              <div className="hero-feat-item">
                <div className="hero-feat-icon">
                  <Clock size={20} className="text-accent" />
                </div>
                <div className="hero-feat-text">
                  <strong>Agreed Delivery Windows</strong>
                  <p>You get a committed pickup and delivery window, and we tell you the moment anything changes.</p>
                </div>
              </div>

              <div className="hero-feat-item">
                <div className="hero-feat-icon">
                  <ShieldCheck size={20} className="text-emerald" />
                </div>
                <div className="hero-feat-text">
                  <strong>Unbroken Chain of Custody</strong>
                  <p>Every hand-off is scanned, every high-value item is sealed, and every delivery is signed.</p>
                </div>
              </div>

              <div className="hero-feat-item">
                <div className="hero-feat-icon">
                  <Headphones size={20} className="text-sky" />
                </div>
                <div className="hero-feat-text">
                  <strong>Real People, Every Time Zone</strong>
                  <p>A named coordinator follows your shipment and replies around the clock.</p>
                </div>
              </div>
            </div>

            <div className="hero-showcase-bottom">
              {supportPhone ? (
                <>
                  <Phone size={15} className="text-accent" />
                  <span>Priority line: <strong><a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`}>{supportPhone}</a></strong></span>
                </>
              ) : (
                <>
                  <Mail size={15} className="text-accent" />
                  <span><strong><a href={`mailto:${dispatchEmail}`}>{dispatchEmail}</a></strong></span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. WHY SHIPPERS CHOOSE US (CONTENT.md §2.2)
          ========================================================================= */}
      <section className="corp-why-choose-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">WHY {COMPANY_SHORT.toUpperCase()}</span>
            <h2>Why shippers around the world choose {COMPANY_SHORT}</h2>
            <p className="section-desc-sub">
              Global reach only matters if every shipment is handled like it’s the only one. That’s the standard we work to.
            </p>
            <div className="section-header-line" />
          </div>

          <div className="why-choose-grid">
            {/* Card 1 */}
            <div className="why-card">
              <div className="why-icon-bubble">
                <Zap size={24} />
              </div>
              <h3>Priority Express, Worldwide</h3>
              <p>
                Door-to-door express for documents and parcels that can’t wait. Booked in minutes, collected fast, cleared and delivered on an agreed window.
              </p>
              <button
                type="button"
                className="btn-why-readmore"
                onClick={() => onNavigate('services')}
              >
                <span>Read more</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Card 2 */}
            <div className="why-card">
              <div className="why-icon-bubble">
                <Truck size={24} />
              </div>
              <h3>Scheduled Freight on Every Mode</h3>
              <p>
                Air, ocean and road departures on fixed schedules. Consolidated or dedicated, with one booking, one tracking ID and one invoice.
              </p>
              <button
                type="button"
                className="btn-why-readmore"
                onClick={() => onNavigate('services')}
              >
                <span>Read more</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Card 3 */}
            <div className="why-card">
              <div className="why-icon-bubble">
                <Activity size={24} />
              </div>
              <h3>Visibility at Every Checkpoint</h3>
              <p>
                Every scan, hand-off and customs milestone appears on your tracking page as it happens. No chasing, no guesswork.
              </p>
              <button
                type="button"
                className="btn-why-readmore"
                onClick={() => onNavigate('track')}
              >
                <span>Read more</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. HOW IT WORKS (CONTENT.md §2.3)
          ========================================================================= */}
      <section className="corp-how-it-works-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">HOW IT WORKS</span>
            <h2>How {COMPANY_SHORT} moves your shipment</h2>
            <p className="section-desc-sub">
              Four stages, one tracking ID, and full visibility from the first scan to the final signature.
            </p>
            <div className="section-header-line" />
          </div>

          <div className="kinetic-pipeline-container">
            <div className="pipeline-laser-beam" />
            <div className="pipeline-nodes-row">
              {STEPS.map((step, i) => {
                const num = String(i + 1).padStart(2, '0');
                return (
                  <div key={step.title} className="pipeline-step-node">
                    <div className="pipeline-connector-top">
                      <div className="node-ring font-mono">
                        <span className="node-num">{num}</span>
                        <div className="node-ring-pulse" />
                      </div>
                      <div className="node-icon-bubble">{step.icon}</div>
                    </div>
                    <div className="node-body">
                      <span className="node-eyebrow font-mono">STEP {num}</span>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA strip: CONTENT.md §3.6 */}
          <div className="how-it-works-action-strip">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-accent" />
              <span>Ready to ship with {COMPANY_SHORT}? Get a rate in minutes, or talk to a coordinator about your lane.</span>
            </div>
            <div className="flex gap-3">
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
                className="btn-corp-ghost-dark"
                onClick={() => onNavigate('contact')}
              >
                <span>Contact Us</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. ABOUT STRIP (CONTENT.md §2.4)
          ========================================================================= */}
      <section className="corp-about-section">
        <div className="sdl-container-wide corp-about-grid">
          {/* Left Stacked Image Stage */}
          <div className="about-image-stage">
            <div className="about-main-img-wrapper">
              <ResponsiveImage
                name="about-operations"
                alt="Warehouse staff member checking stock on a tablet between loaded pallet racks"
                sizes="(max-width: 1024px) 100vw, 45vw"
                imgClassName="about-main-img"
              />
            </div>

            {/* Floating Secondary Thumbnail */}
            <div className="about-thumb-overlap">
              <ResponsiveImage
                name="about-team"
                alt="Smiling support coordinator wearing a headset"
                sizes="72px"
                imgClassName="about-thumb-img"
              />
              <div className="about-thumb-caption">
                <strong>Real People, Every Time Zone</strong>
                <small>A named coordinator follows your shipment</small>
              </div>
            </div>
          </div>

          {/* Right Text Content */}
          <div className="about-text-content">
            <span className="section-eyebrow">ABOUT {COMPANY_SHORT}</span>
            <h2>We believe global shipping should feel local: visible, fast and dependable.</h2>
            <p className="about-lead">
              {COMPANY} was built for shippers who are tired of losing sight of their cargo the moment it leaves the building. We bring express, freight and secure transport under one roof, so one team owns your shipment from pickup to proof of delivery, wherever in the world it’s going.
            </p>

            {/* "Years moving cargo" stays hidden until the owner confirms the founding year;
                "Continents served" (CONTENT §2.7) fills the third tile. */}
            <div className="about-stats-strip">
              <div className="about-stat-item">
                <strong className="font-mono text-accent">24/7</strong>
                <span>Global operations desk</span>
              </div>
              <div className="about-stat-item">
                <strong className="font-mono text-accent">1</strong>
                <span>Tracking ID from start to finish</span>
              </div>
              <div className="about-stat-item">
                <strong className="font-mono text-accent">5</strong>
                <span>Continents served</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-corp-primary"
              onClick={() => onNavigate('about')}
            >
              <span>More about {COMPANY_SHORT}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. SERVICES (CONTENT.md §2.5)
          ========================================================================= */}
      <section className="corp-services-section">
        <div className="sdl-container-wide">
          <div className="section-center-header light">
            <span className="section-eyebrow text-accent">WHAT WE MOVE</span>
            <h2>Specialised transport for cargo that matters</h2>
            <div className="section-header-line accent" />
          </div>

          <div className="services-showcase-grid">
            {SERVICES.map((service, i) => (
              <div key={service.title} className="service-card">
                <ResponsiveImage
                  name={service.image}
                  alt={service.alt}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="service-card-media"
                  imgClassName="service-card-img"
                />
                <div className="service-card-overlay" />
                <div className="service-card-content">
                  <span className="service-num font-mono">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{service.title}</h3>
                  <p>{service.body}</p>
                  <button
                    type="button"
                    className="btn-service-arrow"
                    onClick={() => onNavigate('services')}
                  >
                    <span>{service.cta}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. INDUSTRIES (CONTENT.md §2.6)
          ========================================================================= */}
      <section className="corp-industry-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">INDUSTRIES</span>
            <h2>Logistics shaped around your industry</h2>
            <div className="section-header-line" />
          </div>

          <div className="industry-tabs-bar">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                type="button"
                className={`ind-tab-btn ${industryTab === ind.id ? 'active' : ''}`}
                onClick={() => setIndustryTab(ind.id)}
              >
                {ind.icon}
                <span>{ind.title}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <div className="industry-content-card animate-fade-in">
            <div key={activeIndustry.id} className="industry-tab-grid">
              <div className="ind-text-col">
                <h3>{activeIndustry.title}</h3>
                <p>{activeIndustry.body}</p>
                <ul className="ind-feature-list">
                  {activeIndustry.bullets.map((bullet) => (
                    <li key={bullet}><CheckCircle2 size={16} className="text-emerald" /> {bullet}</li>
                  ))}
                </ul>
                <button className="btn-corp-primary mt-4" onClick={() => onNavigate('quote')}>
                  Get a Rate Quote
                </button>
              </div>
              <div className="ind-img-col">
                <ResponsiveImage
                  name={activeIndustry.image}
                  alt={activeIndustry.alt}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  imgClassName="ind-showcase-img"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. GLOBAL NETWORK MAP (CONTENT.md §2.7)
          ========================================================================= */}
      <section className="corp-hubs-map-section">
        <div className="sdl-container-wide">
          <div className="hubs-map-header">
            <div>
              <span className="section-eyebrow text-accent">GLOBAL NETWORK</span>
              <h2>Connected across the world's key trade lanes</h2>
            </div>
            <div className="hubs-selector-pills" role="group" aria-label="Select a gateway">
              {GATEWAYS.map((gw) => (
                <button
                  key={gw.code}
                  type="button"
                  className={`hub-pill-btn ${activeGatewayCode === gw.code ? 'active' : ''}`}
                  onClick={() => setActiveGatewayCode(gw.code)}
                  aria-pressed={activeGatewayCode === gw.code}
                  title={`${gw.city}, ${gw.country}`}
                >
                  <MapPin size={13} />
                  <span>{gw.code}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hubs-preview-grid">
            <div className="hub-info-card">
              <div className="hub-status-strip">
                <span className="hub-dot-pulse" />
                <strong>{activeGateway.city}, {activeGateway.country} ({activeGateway.code})</strong>
              </div>

              <div className="hub-metrics-grid-2x2">
                <div className="hm-box">
                  <small>MODES</small>
                  <strong>{activeGateway.modes.join(' · ')}</strong>
                </div>
                <div className="hm-box">
                  <small>LOCAL TIME</small>
                  <strong>{activeGatewayTime.time}{activeGatewayTime.offset && <span className="hm-offset"> {activeGatewayTime.offset}</span>}</strong>
                </div>
                {activeGatewayLanes.length > 0 && (
                  <div className="hm-box hm-box-wide">
                    <small>DIRECT TRADE LANES</small>
                    <strong>{activeGatewayLanes.join(' · ')}</strong>
                  </div>
                )}
              </div>

              <p className="hub-description-text">
                Our gateways link Africa, Europe, the Middle East, Asia and the Americas, so your shipment always has a direct, well-travelled route.
              </p>

              <div className="network-side-stats">
                <div><strong>5</strong><small>Continents served</small></div>
                <div><strong>Air · Ocean · Road</strong><small>Modes connected</small></div>
                <div><strong>24/7</strong><small>Operations desk</small></div>
              </div>

              <button
                type="button"
                className="btn-why-readmore"
                onClick={() => onNavigate('locations')}
              >
                <span>View our network</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Interactive Leaflet Gateway Map */}
            <HomeNetworkMap activeCode={activeGatewayCode} onSelectGateway={setActiveGatewayCode} />
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. TRUST MATRIX (CONTENT.md §2.8)
          ========================================================================= */}
      <section className="corp-trust-matrix-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">SAFE HANDS</span>
            <h2>Your cargo is safe with us</h2>
            <div className="section-header-line" />
          </div>

          <div className="trust-matrix-grid">
            {TRUST_TILES.map((tile) => (
              <div key={tile.title} className="trust-pillar-card">
                <div className="trust-pillar-icon">{tile.icon}</div>
                <div>
                  <h4>{tile.title}</h4>
                  <p>{tile.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. BARCODE SPOTLIGHT (CONTENT.md §2.9)
          ========================================================================= */}
      <section className="corp-barcode-spotlight-section">
        <div className="sdl-container-wide barcode-spotlight-grid">
          <div className="barcode-text-col">
            <span className="section-eyebrow text-accent">SMART LABELS</span>
            <h2>One label. Every checkpoint. Zero guesswork.</h2>
            <p>
              Every {COMPANY_SHORT} piece carries a high-density Code 128 barcode linked to your tracking ID. Each scan, at collection, at the gateway, through customs and at the door, updates your tracking page instantly.
            </p>
            <div className="barcode-specs-row">
              <div className="b-spec">
                <strong>8-character</strong>
                <small>Tracking ID</small>
              </div>
              <div className="b-spec">
                <strong>Every piece</strong>
                <small>Individually scanned</small>
              </div>
              <div className="b-spec">
                <strong>Live</strong>
                <small>Milestone updates</small>
              </div>
            </div>
          </div>

          <div className="barcode-visual-col">
            <div className="thermal-label-card">
              <div className="thermal-perforation-top" />
              <div className="thermal-header-strip">
                <div>
                  <strong className="thermal-brand font-mono">{COMPANY.toUpperCase()}</strong>
                </div>
                <img src="/brand/mark.png" alt="" className="thermal-mark" width={40} height={40} loading="lazy" />
              </div>

              <div className="thermal-body-grid font-mono">
                <div className="th-cell">
                  <small>ORIGIN</small>
                  <strong>LOS (LAGOS)</strong>
                </div>
                <div className="th-cell">
                  <small>DESTINATION</small>
                  <strong>LHR (LONDON)</strong>
                </div>
                <div className="th-cell">
                  <small>WEIGHT</small>
                  <strong>20.4 KG</strong>
                </div>
                <div className="th-cell">
                  <small>SERVICE</small>
                  <strong>PRIORITY EXPRESS</strong>
                </div>
              </div>

              <div className="bc-canvas-wrap-thermal">
                <div className="laser-sweep-line" />
                <Barcode value="NGF7K2M9" width={2.2} height={68} />
              </div>

              <div className="thermal-footer font-mono">
                <span>TRACKING ID: NGF7K2M9</span>
                <span>PIECE 01/01</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          10. OUR COMMITMENTS (CONTENT.md §2.10, Option A)
          ========================================================================= */}
      <section className="corp-testimonial-section">
        <div className="sdl-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">OUR COMMITMENTS</span>
            <h2>What you can hold us to</h2>
            <div className="section-header-line" />
          </div>

          <div className="commitments-grid">
            {COMMITMENTS.map((item) => (
              <div key={item.quote} className="testimonial-card-frame commitment-card">
                <div className="quote-mark-icon" aria-hidden="true">“</div>
                <p className="testimonial-quote-text">“{item.quote}”</p>
                <p className="commitment-body">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          11. MODES WE CONNECT (CONTENT.md §2.11)
          ========================================================================= */}
      <section className="corp-partners-strip">
        <div className="sdl-container-wide">
          <div className="partners-label">MODES WE CONNECT</div>
          <ul className="modes-row">
            {MODES.map((mode) => (
              <li key={mode.label} className="mode-card">
                {mode.icon}
                <span>{mode.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* =========================================================================
          12. CALLBACK BANNER (CONTENT.md §2.12)
          ========================================================================= */}
      <section className="corp-callback-banner">
        <ResponsiveImage
          name="callback-banner"
          alt=""
          sizes="100vw"
          className="callback-banner-media"
          imgClassName="callback-banner-img"
        />
        <div className="callback-banner-overlay" />
        <div className="sdl-container callback-inner">
          <div className="callback-text-block">
            <h3>Need an urgent collection or a custom rate?</h3>
            <p>Leave your number and a coordinator will call you back, usually within 30 minutes during business hours.</p>
          </div>

          {cbReference ? (
            <div className="callback-success-alert animate-fade-in" role="status">
              <CheckCircle2 size={24} className="text-emerald" />
              <div>
                <strong>Request received!</strong>
                <p>A coordinator will call you shortly. Your reference is <span className="font-mono">{cbReference}</span>.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCallbackSubmit} className="callback-form-row">
              <input
                type="text"
                placeholder="Name"
                aria-label="Name"
                value={cbName}
                onChange={(e) => setCbName(e.target.value)}
                className="cb-input"
                required
              />

              <input
                type="tel"
                placeholder="Phone (with country code)"
                aria-label="Phone (with country code)"
                value={cbPhone}
                onChange={(e) => setCbPhone(e.target.value)}
                className="cb-input"
                required
              />

              <input
                type="text"
                placeholder="Preferred time"
                aria-label="Preferred time"
                value={cbTime}
                onChange={(e) => setCbTime(e.target.value)}
                className="cb-input"
              />

              <button type="submit" className="btn-callback-submit" disabled={cbSubmitting}>
                <span>{cbSubmitting ? 'Sending…' : 'Request a Callback'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {cbError && !cbReference && (
            <p className="callback-error" role="alert">{cbError}</p>
          )}
        </div>
      </section>

      {/* =========================================================================
          13. FAQ (CONTENT.md §2.13)
          ========================================================================= */}
      <section className="corp-faq-section">
        <div className="sdl-container">
          <div className="section-center-header">
            <span className="section-eyebrow">COMMON QUESTIONS</span>
            <h2>Frequently Asked Questions</h2>
            <div className="section-header-line" />
          </div>

          <div className="faq-accordion-list">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className={`faq-item-card ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-toggle"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={18} className="text-accent" /> : <ChevronDown size={18} />}
                  </button>
                  {isOpen && (
                    <div className="faq-answer-pane animate-fade-in">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
