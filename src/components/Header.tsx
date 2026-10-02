import React, { useState, useEffect } from 'react';
import {
  Package,
  Menu,
  X,
  ArrowRight,
  Shield,
  MapPin,
  Calculator,
  Truck,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  Home,
  Headphones,
  HelpCircle
} from 'lucide-react';
import { COMPANY, LOGO, LOGO_ALT } from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { useEscapeKey } from '../utils/useEscapeKey';
import './Header.css';

// Moves keyboard focus past the header to the page content. A button, not an in-page
// "#main" link: the site uses hash routing, so changing the hash would change the page.
function skipToContent() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  main.setAttribute('tabindex', '-1');
  main.focus();
}

interface HeaderProps {
  activePage?: string;
  onNavigate?: (page: string, param?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage = 'home',
  onNavigate = () => {},
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Contact values come from brand.ts, overridable in admin Settings (useCompanyContact).
  // Empty values hide their element (no placeholder numbers).
  const { phone: supportPhone, phoneHref, email: supportEmail } = useCompanyContact();

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEscapeKey(mobileMenuOpen, () => setMobileMenuOpen(false));

  const handleNav = (page: string, param?: string) => {
    onNavigate(page, param);
    setMobileMenuOpen(false);
  };

  const goHome = (e: React.MouseEvent) => {
    e.preventDefault();
    handleNav('home');
  };

  return (
    <header className="sdl-header-wrapper">
      <button type="button" className="sdl-skip-link" onClick={skipToContent}>
        Skip to main content
      </button>
      {/* 1. TOP UTILITY BAR (Hidden completely on mobile to eliminate clutter) */}
      <div className="sdl-topbar hide-mobile-topbar">
        <div className="sdl-container-wide sdl-topbar-inner">
          <div className="sdl-topbar-left">
            <div className="topbar-item">
              <Clock size={13} className="text-emerald" />
              <span>24/7 Global Support</span>
            </div>
            {supportEmail && (
              <>
                <div className="topbar-divider" />
                <a href={`mailto:${supportEmail}`} className="topbar-item topbar-link">
                  <Mail size={13} className="text-accent" />
                  <span>{supportEmail}</span>
                </a>
              </>
            )}
            {supportPhone && (
              <>
                <div className="topbar-divider" />
                <a href={phoneHref} className="topbar-item topbar-link">
                  <Phone size={13} className="text-accent" />
                  <strong>{supportPhone}</strong>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVIGATION BAR */}
      <div className="sdl-main-header">
        <div className="sdl-container-wide sdl-header-inner">
          {/* Brand Logo */}
          <a href="#/" className="sdl-logo-wrap" onClick={goHome} aria-label={`${COMPANY} home`}>
            <img
              src={LOGO}
              alt={LOGO_ALT}
              className="sdl-brand-logo-img"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.sdl-fallback-logo')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'sdl-fallback-logo';
                  fallback.textContent = COMPANY;
                  parent.appendChild(fallback);
                }
              }}
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="sdl-nav-links">
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'track' ? 'active' : ''}`}
              onClick={() => handleNav('track')}
            >
              Track
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'ship' ? 'active' : ''}`}
              onClick={() => handleNav('ship')}
            >
              Ship
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'services' ? 'active' : ''}`}
              onClick={() => handleNav('services')}
            >
              Services
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'locations' ? 'active' : ''}`}
              onClick={() => handleNav('locations')}
            >
              Network
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'about' ? 'active' : ''}`}
              onClick={() => handleNav('about')}
            >
              About
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'help' ? 'active' : ''}`}
              onClick={() => handleNav('help')}
            >
              Help
            </button>
            <button
              type="button"
              className={`sdl-nav-link ${activePage === 'contact' ? 'active' : ''}`}
              onClick={() => handleNav('contact')}
            >
              Contact
            </button>
          </nav>

          {/* Header Primary Action Button */}
          <div className="sdl-header-actions">
            <button
              type="button"
              className="sdl-btn-top-quote"
              onClick={() => handleNav('quote')}
            >
              <Calculator size={15} />
              <span>Get a Quote</span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className={`sdl-mobile-toggle-btn ${mobileMenuOpen ? 'is-active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* 3. EXECUTIVE MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="sdl-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="sdl-mobile-drawer-sheet animate-slide-left"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header with Logo and Close */}
            <div className="drawer-header">
              <a href="#/" className="drawer-logo" onClick={goHome} aria-label={`${COMPANY} home`}>
                <img src={LOGO} alt={LOGO_ALT} className="drawer-logo-img" />
              </a>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Action Top Cards */}
            <div className="drawer-quick-actions">
              <button
                type="button"
                className="drawer-action-card track-card"
                onClick={() => handleNav('track')}
              >
                <div className="action-icon-wrap accent">
                  <Package size={20} />
                </div>
                <div className="action-text">
                  <strong>Track a Shipment</strong>
                  <small>Live milestones for your tracking ID</small>
                </div>
                <ChevronRight size={16} className="action-arrow" />
              </button>

              <button
                type="button"
                className="drawer-action-card quote-card"
                onClick={() => handleNav('quote')}
              >
                <div className="action-icon-wrap navy">
                  <Calculator size={20} />
                </div>
                <div className="action-text">
                  <strong>Get a Quote</strong>
                  <small>A coordinator sends your rate</small>
                </div>
                <ChevronRight size={16} className="action-arrow" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="drawer-nav-section">
              <span className="drawer-section-label">MAIN NAVIGATION</span>
              <nav className="drawer-nav-list">
                <button
                  type="button"
                  className={`drawer-link ${activePage === 'home' ? 'active' : ''}`}
                  onClick={() => handleNav('home')}
                >
                  <Home size={18} className="link-icon" />
                  <span>Home</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'ship' ? 'active' : ''}`}
                  onClick={() => handleNav('ship')}
                >
                  <Package size={18} className="link-icon" />
                  <span>Ship</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'services' ? 'active' : ''}`}
                  onClick={() => handleNav('services')}
                >
                  <Truck size={18} className="link-icon" />
                  <span>Services</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'locations' ? 'active' : ''}`}
                  onClick={() => handleNav('locations')}
                >
                  <MapPin size={18} className="link-icon" />
                  <span>Network</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'about' ? 'active' : ''}`}
                  onClick={() => handleNav('about')}
                >
                  <Shield size={18} className="link-icon" />
                  <span>About</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'help' ? 'active' : ''}`}
                  onClick={() => handleNav('help')}
                >
                  <HelpCircle size={18} className="link-icon" />
                  <span>Help</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>

                <button
                  type="button"
                  className={`drawer-link ${activePage === 'contact' ? 'active' : ''}`}
                  onClick={() => handleNav('contact')}
                >
                  <Headphones size={18} className="link-icon" />
                  <span>Contact</span>
                  <ChevronRight size={14} className="link-chevron" />
                </button>
              </nav>
            </div>

            {/* Drawer footer (CONTENT §1.2): Need help? + email, phone too when set */}
            {(supportEmail || supportPhone) && (
              <div className="drawer-footer-hotline">
                <div className="hotline-head">
                  <span className="live-status-dot" />
                  <span className="hotline-tag font-mono">NEED HELP?</span>
                </div>
                {supportEmail && (
                  <a href={`mailto:${supportEmail}`} className="hotline-phone-btn">
                    <Mail size={15} />
                    <span>{supportEmail}</span>
                  </a>
                )}
                {supportPhone && (
                  <a href={phoneHref} className="hotline-phone-btn is-secondary">
                    <Phone size={15} />
                    <span>{supportPhone}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
