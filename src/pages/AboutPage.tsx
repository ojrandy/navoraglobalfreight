import React from 'react';
import {
  ShieldCheck,
  Eye,
  ArrowRight,
  Truck,
  Package,
  CheckCircle2,
  Lock,
  Zap,
  Car,
  Headphones,
  Compass,
  Clock,
  Globe,
  ScanBarcode,
  Shield,
  Users,
  FileText
} from 'lucide-react';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { useCompanyContact } from '../utils/useCompanyContact';
import { COMPANY, COMPANY_SHORT } from '../config/brand';
import './AboutPage.css';

interface AboutPageProps {
  onNavigate: (page: string) => void;
}

// Copy: docs/CONTENT.md §4 (stats, divisions, badges and CTA reuse approved text from §2/§3).
const STATS = [
  { value: '24/7', title: 'Global operations desk', sub: 'Our desk follows the sun across time zones.' },
  { value: '1', title: 'Tracking ID from start to finish', sub: 'One team accountable from the first mile to the last.' },
  { value: '5', title: 'Continents served', sub: 'Gateways across Africa, Europe, the Middle East, Asia and the Americas.' },
  { value: 'Air · Ocean · Road', title: 'Modes connected', sub: 'Air, ocean and road, connected.' }
];

const APPROACH: { title: string; body: string; icon: React.ReactNode; tone: string }[] = [
  { title: 'Milestone Visibility', body: 'Every scan and hand-off is recorded and visible to you.', icon: <Eye size={22} />, tone: 'accent' },
  { title: 'Direct Routing', body: 'The fewest possible hand-offs between origin and destination.', icon: <Compass size={22} />, tone: 'emerald' },
  { title: 'Secure Custody', body: 'Seals, scans and named releases for anything of value.', icon: <Lock size={22} />, tone: 'sky' },
  { title: 'Proactive Support', body: 'We contact you first when plans change.', icon: <Headphones size={22} />, tone: 'navy' },
  { title: 'Round-the-Clock Operations', body: 'Our desk follows the sun across time zones.', icon: <Clock size={22} />, tone: 'accent' }
];

const DIVISIONS: { title: string; summary: string; bullets: string[]; icon: React.ReactNode; tone: string }[] = [
  {
    title: 'Priority Express Courier',
    summary: 'Our fastest door-to-door service for urgent documents and parcels, worldwide.',
    bullets: ['Same-day collection when booked before the cut-off', 'Fastest available air routing', 'Customs pre-alert and pre-clearance where possible'],
    icon: <Zap size={26} />,
    tone: 'accent'
  },
  {
    title: 'Scheduled Freight & Linehaul',
    summary: 'Air, ocean and road freight on fixed departures, built for regular volumes and predictable transit.',
    bullets: ['Air freight consolidations', 'Ocean FCL and LCL', 'Cross-border road linehaul'],
    icon: <Truck size={26} />,
    tone: 'emerald'
  },
  {
    title: 'Vehicle Shipping & Transport',
    summary: 'International and domestic shipping for cars, motorcycles and fleet vehicles.',
    bullets: ['Container or RoRo shipping', 'Enclosed carrier option', 'Export/import documentation'],
    icon: <Car size={26} />,
    tone: 'sky'
  },
  {
    title: 'Secure Vault & High-Value',
    summary: 'Sealed, tamper-evident transport with restricted hand-offs for valuables and sensitive cargo.',
    bullets: ['Tamper-evident sealed pouches and cases', 'Restricted, named hand-offs', 'Photo and seal-number verification at each stage'],
    icon: <Package size={26} />,
    tone: 'navy'
  }
];

// Shown as capabilities until the owner supplies real dates; a card shows its year only when `year` is set.
const MILESTONES: { title: string; body: string; icon: React.ReactNode; tone: string; year?: string }[] = [
  { title: 'Express Courier Lines', body: 'Where we began, with urgent door-to-door delivery.', icon: <Compass size={22} />, tone: 'accent' },
  { title: 'Cross-Border Freight', body: 'Scheduled air, ocean and road departures.', icon: <Truck size={22} />, tone: 'emerald' },
  { title: 'Piece-Level Tracking', body: 'Every carton barcoded and scanned.', icon: <ScanBarcode size={22} />, tone: 'sky' },
  { title: 'Global Gateway Network', body: 'Partner gateways across five continents.', icon: <Globe size={22} />, tone: 'amber' }
];

const COMPLIANCE_BADGES: { title: string; body: string; icon: React.ReactNode }[] = [
  { title: 'Compliance First', body: 'Export, import and dangerous-goods rules are respected on every lane.', icon: <Shield size={28} className="text-accent" /> },
  { title: 'Vetted Handlers', body: 'Every driver, agent and handler in our chain is vetted and accountable.', icon: <Users size={28} className="text-emerald" /> },
  { title: 'Privacy by Design', body: 'Public tracking masks names and addresses. Your data stays yours.', icon: <Lock size={28} className="text-sky" /> },
  { title: 'Digital Documents', body: 'Waybills, invoices and proof of delivery, available online at any time.', icon: <FileText size={28} className="text-amber" /> }
];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  // The admin "regulatory line" (Settings) shows only when set; no invented licence numbers.
  const { regulatoryLine } = useCompanyContact();
  return (
    <div className="ngf-page-about">
      {/* =========================================================================
          1. HERO (CONTENT.md §4)
          ========================================================================= */}
      <section className="about-hero-section">
        <ResponsiveImage
          name="about-hero"
          alt="Dock worker with a radio watching a cargo ship being loaded at sunset"
          eager
          sizes="100vw"
          className="about-hero-media"
          imgClassName="about-hero-img"
        />
        <div className="about-hero-overlay" />
        <div className="ngf-container-wide about-hero-inner">
          <div className="about-hero-badge animate-fade-in">
            <span className="about-badge-dot" />
            <span>ABOUT {COMPANY_SHORT}</span>
          </div>

          <h1 className="about-hero-title animate-fade-in">
            Moving what matters, <br /><span className="about-highlight-accent">with nothing hidden.</span>
          </h1>

          <p className="about-hero-lead animate-fade-in">
            {COMPANY} connects businesses and people to the world with express, freight and secure transport, and with the one thing logistics often forgets: accountability.
          </p>

          {regulatoryLine && (
            <div className="about-hero-credentials animate-fade-in">
              <div className="cred-badge">
                <ShieldCheck size={16} className="text-accent" />
                <span>{regulatoryLine}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          2. STAT CARDS (approved stats only)
          ========================================================================= */}
      <section className="about-stats-section">
        <div className="ngf-container-wide">
          <div className="about-stats-grid">
            {STATS.map((stat) => (
              <div key={stat.title} className="about-stat-card">
                <span className={`stat-value font-mono ${stat.value.length > 6 ? 'is-long' : ''}`}>{stat.value}</span>
                <strong className="stat-title">{stat.title}</strong>
                <p className="stat-subtitle">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. OUR STORY + OUR APPROACH
          ========================================================================= */}
      <section className="about-story-section">
        <div className="ngf-container-wide">
          <div className="about-story-grid">
            <div className="about-story-content">
              <span className="section-eyebrow">OUR STORY</span>
              <h2>How {COMPANY_SHORT} came to be</h2>
              <p className="lead-p">
                {COMPANY} started with a simple frustration: once cargo crossed a border, shippers lost sight of it. Calls went unanswered, updates arrived late, and nobody owned the problem.
              </p>
              <p>
                We built {COMPANY_SHORT} to fix that, joining express, freight and secure transport into one network, with one tracking ID and one team accountable from the first mile to the last.
              </p>

              <div className="about-pillars-grid">
                {APPROACH.map((item) => (
                  <div key={item.title} className="pillar-item">
                    <div className={`pillar-icon-box ${item.tone}`}>{item.icon}</div>
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="about-visual-column">
              <div className="about-visual-card">
                <ResponsiveImage
                  name="about-story"
                  alt="Operations coordinator checking a clipboard between storage racks"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="about-terminal-media"
                  imgClassName="about-terminal-img"
                />
                <div className="about-floating-badge">
                  <div className="floating-badge-header">
                    <span className="live-pulse-dot" />
                    <span className="font-mono text-xs font-bold text-white">ROUND-THE-CLOCK OPERATIONS</span>
                  </div>
                  <h4>24/7 Global operations desk</h4>
                  <p>Our desk follows the sun across time zones.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. OUR DIVISIONS (CONTENT.md §4 → §3.1)
          ========================================================================= */}
      <section className="about-divisions-section">
        <div className="ngf-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">DIVISIONS</span>
            <h2>Our divisions</h2>
            <div className="section-header-line" />
          </div>

          <div className="about-divisions-grid">
            {DIVISIONS.map((division) => (
              <div key={division.title} className="division-card">
                <div className={`division-icon-wrap ${division.tone}`}>{division.icon}</div>
                <h3>{division.title}</h3>
                <p>{division.summary}</p>
                <ul className="division-specs">
                  {division.bullets.map((bullet) => (
                    <li key={bullet}><CheckCircle2 size={15} className="text-emerald" /> {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. WHAT WE'VE BUILT (timeline cards, undated until the owner supplies dates)
          ========================================================================= */}
      <section className="about-timeline-section">
        <div className="ngf-container-wide">
          <div className="section-center-header">
            <span className="section-eyebrow">WHAT WE'VE BUILT</span>
            <h2>Express, freight and secure transport under one roof</h2>
            <div className="section-header-line" />
          </div>

          <div className="timeline-track-container">
            <div className="timeline-connector-bar" />

            <div className="timeline-cards-grid">
              {MILESTONES.map((m, i) => {
                const isLast = i === MILESTONES.length - 1;
                return (
                  <div key={m.title} className={`timeline-card ${isLast ? 'active' : ''}`}>
                    {m.year && <div className={`timeline-year-badge font-mono ${isLast ? 'active' : ''}`}>{m.year}</div>}
                    <div className={`timeline-icon-bubble ${m.tone}`}>{m.icon}</div>
                    <h3>{m.title}</h3>
                    <p>{m.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. SAFETY & COMPLIANCE (CONTENT.md §4)
          ========================================================================= */}
      <section className="about-compliance-section">
        <div className="ngf-container-wide">
          <div className="compliance-banner">
            <ResponsiveImage
              name="about-compliance"
              alt=""
              sizes="(max-width: 1440px) 100vw, 1400px"
              className="compliance-banner-media"
              imgClassName="compliance-banner-img"
            />
            <div className="compliance-text-block">
              <span className="section-eyebrow light">SAFETY & COMPLIANCE</span>
              <h3>Committed to safety and compliance</h3>
              <p>
                We follow the export, import, security and dangerous-goods rules on every lane we operate, and we work only with vetted carriers and agents. Ask us for our compliance documents at any time.
              </p>
            </div>

            <div className="compliance-badges-grid">
              {regulatoryLine && (
                <div className="c-badge-item">
                  <ShieldCheck size={28} className="text-accent" />
                  <div>
                    <strong>{regulatoryLine}</strong>
                  </div>
                </div>
              )}
              {COMPLIANCE_BADGES.map((badge) => (
                <div key={badge.title} className="c-badge-item">
                  {badge.icon}
                  <div>
                    <strong>{badge.title}</strong>
                    <span>{badge.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CTA (CONTENT.md §3.6)
          ========================================================================= */}
      <section className="about-bottom-cta">
        <div className="ngf-container-wide">
          <div className="about-cta-card">
            <div className="about-cta-content">
              <h2>Ready to ship with {COMPANY_SHORT}?</h2>
              <p>Get a rate in minutes, or talk to a coordinator about your lane.</p>
            </div>

            <div className="about-cta-action-row">
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
