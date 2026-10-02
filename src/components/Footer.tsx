import React from 'react';
import {
  ShieldCheck,
  Clock,
  Layers,
  Globe,
  Send,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  ChevronRight
} from 'lucide-react';
import { COMPANY_SHORT, LEGAL_NAME, LOGO_ALT, LOGO_WHITE, SOCIAL, SocialNetwork, TAGLINE } from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import './Footer.css';

// Only networks with a real URL in brand.ts are rendered.
const SOCIAL_LINKS: { key: SocialNetwork; label: string; Icon: typeof Facebook }[] = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'x', label: 'Twitter / X', Icon: Twitter },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
];

// Every link points at a real page (and, where there is one, the exact section on it):
// page = App.tsx KNOWN_PAGES entry, param = service tier ID or legal section ID.
interface FooterLinkDef {
  label: string;
  page: string;
  param?: string;
}

const FOOTER_COLUMNS: { title: string; links: FooterLinkDef[] }[] = [
  {
    title: 'Services',
    links: [
      { label: 'Priority Express', page: 'services', param: 'priority-courier' },
      { label: 'Freight & Linehaul', page: 'services', param: 'scheduled-freight' },
      { label: 'Vehicle Shipping', page: 'services', param: 'vehicle-shipping' },
      { label: 'Secure Vault', page: 'services', param: 'secure-vault' },
    ],
  },
  {
    // Careers hidden until the page exists
    title: 'Company',
    links: [
      { label: `About ${COMPANY_SHORT}`, page: 'about' },
      { label: 'Our Services', page: 'services' },
      { label: 'Global Network', page: 'locations' },
      { label: 'Contact', page: 'contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Track a Shipment', page: 'track' },
      { label: 'Book a Shipment', page: 'ship' },
      { label: 'Get a Quote', page: 'quote' },
      { label: 'Help Centre', page: 'help' },
    ],
  },
  {
    // LegalPage sections (CONTENT §1.3 / §13).
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', page: 'legal', param: 'privacy' },
      { label: 'Terms of Service', page: 'legal', param: 'terms' },
      { label: 'Shipping Terms', page: 'legal', param: 'shipping-terms' },
      { label: 'Cookie Policy', page: 'legal', param: 'cookies' },
    ],
  },
];

// Keep every column at exactly four links so the rows line up across the footer.
// Accessibility lives in the bottom bar instead of a fifth Legal row.

const hrefFor = (page: string, param?: string) =>
  page === 'home' ? '#/' : `#/${page}${param ? `/${param}` : ''}`;

interface FooterProps {
  onNavigate?: (page: string, param?: string) => void;
  showTrustStrip?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate = () => {},
  showTrustStrip = true,
}) => {
  const { address } = useCompanyContact();

  // Plain clicks route in-app; Ctrl/Cmd/Shift/middle-click keep the browser's
  // open-in-new-tab behaviour, since each link carries its real URL.
  const go = (page: string, param?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(page, param);
  };

  return (
    <footer className="sdl-pro-footer-wrapper">
      {/* 1. TRUST FEATURE STRIP */}
      {showTrustStrip && (
        <div className="sdl-footer-trust-strip">
          <div className="sdl-container-wide sdl-trust-grid">
            <div className="sdl-trust-card">
              <div className="sdl-trust-icon">
                <Globe size={24} />
              </div>
              <div className="sdl-trust-info">
                <h4>Worldwide Coverage</h4>
                <p>Air, ocean and road, connected.</p>
              </div>
            </div>

            <div className="sdl-trust-card">
              <div className="sdl-trust-icon">
                <Clock size={24} />
              </div>
              <div className="sdl-trust-info">
                <h4>Live Milestones</h4>
                <p>Every hand-off scanned and time-stamped.</p>
              </div>
            </div>

            <div className="sdl-trust-card">
              <div className="sdl-trust-icon">
                <Layers size={24} />
              </div>
              <div className="sdl-trust-info">
                <h4>Piece-Level Labels</h4>
                <p>Every carton individually barcoded.</p>
              </div>
            </div>

            <div className="sdl-trust-card">
              <div className="sdl-trust-icon">
                <ShieldCheck size={24} />
              </div>
              <div className="sdl-trust-info">
                <h4>Signed Delivery</h4>
                <p>Digital proof of delivery on every shipment.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN EXECUTIVE FOOTER */}
      <div className="sdl-pro-footer-main">
        {/* Subtle Map Watermark Background */}
        <div className="footer-world-map-bg" />
        
        {/* Glowing Accent Corner Swoosh */}
        <div className="footer-accent-swoosh" />

        <div className="sdl-container-wide footer-content-relative">
          <div className="sdl-pro-footer-grid">
            {/* Column 1: Brand & Tagline */}
            <div className="sdl-pro-brand-col">
              <a className="sdl-pro-footer-logo" href={hrefFor('home')} onClick={go('home')}>
                <img
                  src={LOGO_WHITE}
                  alt={LOGO_ALT}
                  className="sdl-pro-footer-logo-img"
                />
              </a>

              <p className="sdl-pro-brand-desc">
                Express, freight and secure cargo across borders, with one tracking ID and one accountable team from pickup to proof of delivery.
              </p>

              {SOCIAL_LINKS.some(s => SOCIAL[s.key]) && (
                <div className="sdl-pro-socials">
                  {SOCIAL_LINKS.filter(s => SOCIAL[s.key]).map(({ key, label, Icon }) => (
                    <a key={key} href={SOCIAL[key]} className="pro-social-btn" aria-label={label} target="_blank" rel="noopener noreferrer">
                      <Icon size={15} />
                    </a>
                  ))}
                </div>
              )}

              <div className="sdl-pro-faster-tagline font-mono">
                <span>{TAGLINE.toUpperCase()}.</span>
                <div className="tagline-bar" />
              </div>
            </div>

            {/* Columns 2–5: Services · Company · Support · Legal */}
            {FOOTER_COLUMNS.map(({ title, links }) => (
              <nav key={title} className="sdl-pro-links-col" aria-label={title}>
                <h4 className="sdl-pro-col-title">
                  {title}
                  <span className="title-accent-dash" />
                </h4>
                <ul className="sdl-pro-links-list">
                  {links.map(({ label, page, param }) => (
                    <li key={label}>
                      <a href={hrefFor(page, param)} onClick={go(page, param)}>
                        <ChevronRight size={14} className="link-chevron" aria-hidden="true" />
                        <span>{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* 3. BOTTOM BAR */}
          <div className="sdl-pro-footer-bottom">
            <div className="pro-copy-text">
              © {new Date().getFullYear()} {LEGAL_NAME}. All rights reserved.
              {address && <> · {address}</>}
            </div>
            <a
              className="pro-bottom-link"
              href={hrefFor('legal', 'accessibility')}
              onClick={go('legal', 'accessibility')}
            >
              Accessibility
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
