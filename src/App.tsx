import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { TrackPage } from './pages/TrackPage';
import { TrackResultPage } from './pages/TrackResultPage';
import { PublicQuoteResultPage } from './pages/PublicQuoteResultPage';
import { ServicesPage } from './pages/ServicesPage';
import { QuotePage } from './pages/QuotePage';
import { ShipPage } from './pages/ShipPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { HelpPage } from './pages/HelpPage';
import { LegalPage } from './pages/LegalPage';
import { LocationsPage } from './pages/LocationsPage';
// The admin console's code is its own chunk, fetched only when the admin page opens, so public
// visitors never download it (MOTION_3D_SPEC §2). Its stylesheets stay in the main bundle, in
// their original place (see admin/styles.ts); that also keeps the `admin-login-shell`
// placeholder styled while the session check and the chunk load.
import './admin/styles';
import { TrackingLoadingScreen } from './components/TrackingLoadingScreen';
import { AdminDataProvider, useAdminData } from './context/AdminDataContext';
import { Shipment } from './types/shipment';
import { QuoteRequest } from './types/admin';
import { api } from './services/api';
import { simulationEngine } from './services/simulationEngine';
import { ADMIN_HOST, ADMIN_CONSOLE_NAME, COMPANY, SITE_URL } from './config/brand';
import './styles/global.css';

const loadAdminApp = () => import('./admin/AdminApp');
const loadAdminLogin = () => import('./admin/AdminLogin');
const AdminApp = lazy(() => loadAdminApp().then((m) => ({ default: m.AdminApp })));
const AdminLogin = lazy(() => loadAdminLogin().then((m) => ({ default: m.AdminLogin })));

const KNOWN_PAGES = ['home', 'track', 'services', 'quote', 'ship', 'about', 'help', 'contact', 'legal', 'locations', 'admin'];

// Admin lives only on its own subdomain (ADMIN_HOST in src/config/brand.ts), served by the same
// app and API as the public site. Deliberately not "admin." — that's one of the most commonly
// probed/guessed subdomain names. An exact hostname match, so no other host (the public domain,
// www., or a look-alike such as private.example.com) ever opens the console. localhost is
// exempted separately so local dev can keep using the plain #/admin hash.
function isAdminHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase() === ADMIN_HOST;
}

// Search engines must never index the console. Added at runtime (not in index.html) because the
// public site and the admin host share the same index.html.
function setRobotsNoIndex(enabled: boolean) {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-admin]');
  if (enabled && !tag) {
    tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    tag.setAttribute('data-admin', '');
    document.head.appendChild(tag);
  } else if (!enabled && tag) {
    tag.remove();
  }
}

// Page titles and meta descriptions (CONTENT.md §1.1). The defaults also live in index.html,
// which is what crawlers and link previews see before the app runs.
interface PageMeta {
  title: string;
  description: string;
}

const DEFAULT_DESCRIPTION =
  'SDL Global Logistics moves express parcels, freight, vehicles and high-value cargo worldwide, with one tracking ID, live milestones and signed proof of delivery.';

const PAGE_META: Record<string, PageMeta> = {
  home: { title: `${COMPANY} | Worldwide Express, Freight & Secure Cargo`, description: DEFAULT_DESCRIPTION },
  track: { title: `Track a Shipment | ${COMPANY}`, description: 'Enter your 8-character SDL tracking ID to see live milestones, location and delivery status.' },
  services: { title: `Logistics Services | ${COMPANY}`, description: 'Priority express, scheduled air, ocean and road freight, vehicle shipping and secure high-value transport, worldwide.' },
  quote: { title: `Get a Rate Quote | ${COMPANY}`, description: "Tell us what you're moving and where. A logistics coordinator will send your rate." },
  ship: { title: `Book a Shipment | ${COMPANY}`, description: 'Book a pickup, build a multi-piece shipment and get your tracking ID in minutes.' },
  about: { title: `About Us | ${COMPANY}`, description: 'Who we are, how we work and why shippers around the world trust SDL with cargo that matters.' },
  locations: { title: `Global Network | ${COMPANY}`, description: 'The gateways and trade lanes that connect SDL shipments across Africa, Europe, the Middle East, Asia and the Americas.' },
  help: { title: `Help Centre | ${COMPANY}`, description: 'Answers on tracking, booking, customs, documents and deliveries.' },
  contact: { title: `Contact Us | ${COMPANY}`, description: 'Talk to an SDL coordinator, any time zone, any day.' },
  legal: { title: `Policies | ${COMPANY}`, description: 'Privacy, terms of service, shipping terms and accessibility.' },
};

function setPageMeta({ title, description }: PageMeta) {
  document.title = title;
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = description;
}

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Reads the current URL hash synchronously, before the first paint, so the initial render
// already shows the right page. Without this, `currentPage` always started as 'home' and only
// got corrected once the hash-parsing effect ran a moment later — barely noticeable on an
// ordinary page load, but very visible right after logging into the admin console, since that
// flow does a full page reload: the public home page (header, hero, footer) would flash on
// screen for a beat before the admin dashboard took over. Only handles the simple, synchronous
// cases (a known page name, or /admin) — /track/:id and /quote/:id still need an async lookup
// to know what to show, so those fall back through to 'track' as a neutral holding page; the
// existing hash-parsing effect (below) still runs afterward and resolves them for real.
function getInitialPage(): string {
  if (typeof window === 'undefined') return 'home';
  if (isAdminHost()) return 'admin';
  const hash = window.location.hash.replace('#', '');
  const pathname = window.location.pathname.replace(/^\//, '');
  const target = hash || (pathname ? `/${pathname}` : '');
  if (target.startsWith('/admin') || target === 'admin') {
    return isLocalDevHost() ? 'admin' : 'home';
  }
  if (target.startsWith('/track/') || target.startsWith('/quote/')) return 'track';
  if (target.startsWith('/')) {
    const page = target.replace('/', '').split('/')[0];
    if (KNOWN_PAGES.includes(page)) return page;
  }
  return 'home';
}

function MainAppContent() {
  const [currentPage, setCurrentPage] = useState<string>(getInitialPage);
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(null);
  const [currentQuote, setCurrentQuote] = useState<QuoteRequest | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [preselectedService, setPreselectedService] = useState<string>('Priority');
  const [legalSection, setLegalSection] = useState<string>('privacy');
  // `n` bumps on every request so repeating the same footer link re-opens that tier.
  const [serviceTier, setServiceTier] = useState<{ id: string; n: number }>({ id: '', n: 0 });
  const [contactGateway, setContactGateway] = useState<string>('');
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [isTrackSearching, setIsTrackSearching] = useState(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const { getShipment, quoteRequests, shipments } = useAdminData();

  // Every admin API route now requires a session — check once before ever rendering the
  // real admin console, so someone without a session sees the login form instead of a
  // console full of failed 401 requests and empty/mock data.
  useEffect(() => {
    if (currentPage === 'admin' && !adminAuthChecked) {
      // Fetch the console code while the session is checked, so the split adds no wait.
      loadAdminLogin().catch(() => {});
      loadAdminApp().catch(() => {});
      api.checkSession().then(isAdmin => {
        setIsAdminAuthed(isAdmin);
        setAdminAuthChecked(true);
      });
    }
  }, [currentPage, adminAuthChecked]);

  // Keep tracked shipment in continuous live synchronization with simulation engine
  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((simUpdated) => {
      setCurrentShipment(prev => {
        if (prev && prev.trackingNumber.toUpperCase() === simUpdated.trackingNumber.toUpperCase()) {
          return { ...prev, ...simUpdated };
        }
        return prev;
      });
    });
    return () => unsubscribe();
  }, []);

  const liveShipment = currentShipment
    ? (shipments.find(s => s.trackingNumber.toUpperCase() === currentShipment.trackingNumber.toUpperCase()) || currentShipment)
    : null;

  // Per-page <title> and meta description (CONTENT.md §1.1)
  useEffect(() => {
    const meta: Record<string, PageMeta> = {
      ...PAGE_META,
      'track-result': {
        title: liveShipment ? `Tracking ${liveShipment.trackingNumber} | ${COMPANY}` : PAGE_META.track.title,
        description: PAGE_META.track.description,
      },
      'quote-result': {
        title: currentQuote ? `Quote ${currentQuote.id} | ${COMPANY}` : PAGE_META.quote.title,
        description: PAGE_META.quote.description,
      },
      admin: { title: ADMIN_CONSOLE_NAME, description: DEFAULT_DESCRIPTION },
    };
    setPageMeta(meta[currentPage] || PAGE_META.home);
    setRobotsNoIndex(currentPage === 'admin' || isAdminHost());
  }, [currentPage, liveShipment, currentQuote]);

  // Smartsupp live chat (loaded in index.html) is for customers only — keep it off the admin console.
  // Calls queue until the loader finishes, so this is safe before the widget has arrived.
  useEffect(() => {
    const smartsupp = (window as { smartsupp?: (...args: unknown[]) => void }).smartsupp;
    if (!smartsupp) return;
    smartsupp(currentPage === 'admin' || isAdminHost() ? 'chat:hide' : 'chat:show');
  }, [currentPage]);

  // Initialize from hash if available
  useEffect(() => {
    const handleHash = async () => {
      if (isAdminHost()) {
        setCurrentPage('admin');
        return;
      }
      const hash = window.location.hash.replace('#', '');
      const pathname = window.location.pathname.replace(/^\//, '');
      const target = hash || (pathname ? `/${pathname}` : '');

      if (target.startsWith('/track/')) {
        const trk = target.replace('/track/', '');
        if (trk.toUpperCase().startsWith('QR-') || trk.toUpperCase().startsWith('QR')) {
          handleTrackShipment(trk);
          return;
        }
        const found = getShipment(trk);
        if (found) {
          setCurrentShipment(found);
          setNotFoundQuery(null);
          setCurrentPage('track-result');
        } else {
          try {
            const apiShipment = await api.trackShipment(trk);
            if (apiShipment) {
              setCurrentShipment(apiShipment);
              setNotFoundQuery(null);
              setCurrentPage('track-result');
              return;
            }
          } catch (e) {
            // Not found
          }
          setNotFoundQuery(trk);
          setCurrentPage('track');
        }
      } else if (target.startsWith('/quote/')) {
        const quoteId = target.replace('/quote/', '');
        handleTrackShipment(quoteId);
      } else if (target.startsWith('/admin') || target === 'admin') {
        // No longer resolves on the public domain — admin moved to its own subdomain.
        // Exempted on localhost so local dev can keep using the plain #/admin hash.
        if (isLocalDevHost()) {
          setCurrentPage('admin');
        }
      } else if (target.startsWith('/')) {
        const [page, sub] = target.replace('/', '').split('/');
        if (KNOWN_PAGES.includes(page)) {
          // Deep links from the footer: #/services/<tier-id>, #/legal/<section>
          if (page === 'services') {
            setServiceTier(prev => (prev.id === (sub || '') ? prev : { id: sub || '', n: prev.n + 1 }));
          }
          if (page === 'legal' && sub) setLegalSection(sub);
          setCurrentPage(page);
        } else if (page === 'track-result') {
          // If navigated directly to track-result without an active shipment, redirect to track search
          if (!currentShipment) {
            setCurrentPage('track');
          }
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [getShipment, quoteRequests, shipments, currentShipment]);

  const handleNavigate = (page: string, param?: string) => {
    // The admin host only ever shows the console; public pages live on the main domain.
    if (isAdminHost() && page !== 'admin') {
      const path = page === 'home' ? '' : (param ? `/${page}/${param}` : `/${page}`);
      window.location.assign(path ? `${SITE_URL}/#${path}` : `${SITE_URL}/`);
      return;
    }
    if (page === 'quote' && param) {
      setPreselectedService(param);
    }
    if (page === 'legal' && param) {
      setLegalSection(param);
    }
    if (page === 'contact') {
      // Gateway code from "Contact this gateway"; plain Contact links clear it.
      setContactGateway(param || '');
    }
    if (page === 'services') {
      // A tier ID opens that tier; ServicesPage scrolls to it, so skip the scroll to top.
      setServiceTier(prev => ({ id: param || '', n: prev.n + 1 }));
    }
    setCurrentPage(page);
    if (!(page === 'services' && param)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (page === 'track-result' && param) {
      window.location.hash = `/track/${param}`;
    } else if (page === 'quote-result' && param) {
      window.location.hash = `/quote/${param}`;
    } else if ((page === 'services' || page === 'legal') && param) {
      window.location.hash = `/${page}/${param}`;
    } else if (page === 'home') {
      window.location.hash = '';
    } else {
      window.location.hash = `/${page}`;
    }
  };

  const handleTrackShipment = async (inputQuery: string) => {
    const query = inputQuery.trim();
    if (!query) return;

    // A local cache hit used to resolve this whole function synchronously, so the result
    // page just appeared instantly with zero transition — genuinely fast, but it read as
    // "did that even do anything?" rather than as a live lookup. Every exit path below now
    // goes through finishSearch, which guarantees the loading screen stays up for at least
    // MIN_LOADING_MS regardless of how fast the underlying lookup actually was, then commits
    // the real state change. A slow lookup (the real API path) is unaffected — it already
    // takes longer than this floor, so the extra wait is 0.
    const MIN_LOADING_MS = 900;
    const searchStartedAt = Date.now();
    setIsTrackSearching(true);
    setTrackSearchQuery(query);
    // Without this, the loading screen renders wherever the page happened to already be
    // scrolled to (e.g. down at the search box on TrackPage) — on mobile especially, that cut
    // the truck icon and heading off above the fold, leaving only the progress bar visible.
    // Scroll to top immediately, not just after the result is ready.
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const finishSearch = async (commit: () => void) => {
      const elapsed = Date.now() - searchStartedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      commit();
      setIsTrackSearching(false);
    };

    // 1. CHECK IF THIS IS A QUOTE ID (e.g. QR-2026-88752)
    if (query.toUpperCase().startsWith('QR') || quoteRequests.some(q => q.id.toUpperCase() === query.toUpperCase())) {
      const match = quoteRequests.find(q => q.id.toUpperCase() === query.toUpperCase());
      if (match) {
        await finishSearch(() => {
          setCurrentQuote(match);
          setCurrentPage('quote-result');
          window.location.hash = `/quote/${match.id}`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return;
      }

      // Try fetching from backend API — a single, scoped lookup by this exact ID, not the
      // full admin quotes list (that endpoint now requires an admin session anyway, and
      // even before it did, pulling every customer's quote data into a public visitor's
      // browser just to check one ID was never right).
      try {
        const apiMatch = await api.getPublicQuote(query.toUpperCase());
        if (apiMatch) {
          await finishSearch(() => {
            setCurrentQuote(apiMatch);
            setCurrentPage('quote-result');
            window.location.hash = `/quote/${apiMatch.id}`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
          return;
        }
      } catch (err) {
        console.error('Error fetching quote:', err);
      }
    }

    // 2. CHECK IF THIS IS A REAL SHIPMENT
    const foundShipment = getShipment(query);
    if (foundShipment) {
      await finishSearch(() => {
        setCurrentShipment(foundShipment);
        setNotFoundQuery(null);
        setCurrentPage('track-result');
        window.location.hash = `/track/${foundShipment.trackingNumber}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    // Try backend API for shipment
    try {
      const apiShipment = await api.trackShipment(query);
      if (apiShipment) {
        await finishSearch(() => {
          setCurrentShipment(apiShipment);
          setNotFoundQuery(null);
          setCurrentPage('track-result');
          window.location.hash = `/track/${apiShipment.trackingNumber}`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return;
      }
    } catch (e) {
      // not found
    }

    // 3. NOT FOUND STATE
    await finishSearch(() => {
      setNotFoundQuery(query);
      setCurrentPage('track');
      window.location.hash = `/track`;
    });
  };

  // If on Admin page, render dedicated Admin Command Center layout — gated behind the
  // session check above so no admin data ever loads into the page before login succeeds.
  if (currentPage === 'admin') {
    const adminPlaceholder = <div className="admin-login-shell" />;
    if (!adminAuthChecked) {
      return adminPlaceholder;
    }
    return (
      <Suspense fallback={adminPlaceholder}>
        {!isAdminAuthed ? (
          <AdminLogin onNavigatePublic={handleNavigate} />
        ) : (
          <AdminApp
            onNavigatePublic={handleNavigate}
            onViewPublicTracking={(trk) => {
              if (isAdminHost()) {
                window.location.assign(`${SITE_URL}/#/track/${encodeURIComponent(trk)}`);
              } else {
                handleTrackShipment(trk);
              }
            }}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="sdl-app-shell">
      <Header
        activePage={currentPage}
        onNavigate={handleNavigate}
      />

      <main className="sdl-main-view">
        {isTrackSearching ? (
          <TrackingLoadingScreen query={trackSearchQuery} />
        ) : (
          <>
        {currentPage === 'home' && (
          <HomePage
            onTrack={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'track' && (
          <TrackPage
            onTrack={handleTrackShipment}
            onNavigate={handleNavigate}
            notFoundQuery={notFoundQuery}
          />
        )}

        {currentPage === 'track-result' && (currentShipment || liveShipment) && (
          <TrackResultPage
            shipment={liveShipment || currentShipment!}
            onTrackAnother={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'quote-result' && currentQuote && (
          <PublicQuoteResultPage
            quote={currentQuote}
            onTrackShipment={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'services' && (
          <ServicesPage onNavigate={handleNavigate} initialServiceId={serviceTier.id} serviceRequest={serviceTier.n} />
        )}

        {currentPage === 'quote' && (
          <QuotePage onNavigate={handleNavigate} initialService={preselectedService} />
        )}

        {currentPage === 'ship' && (
          <ShipPage onTrack={(tn) => handleTrackShipment(tn)} onNavigate={handleNavigate} />
        )}

        {currentPage === 'about' && (
          <AboutPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'help' && (
          <HelpPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'contact' && (
          <ContactPage key={contactGateway} onNavigate={handleNavigate} initialGateway={contactGateway} />
        )}

        {currentPage === 'legal' && (
          <LegalPage initialSection={legalSection} onNavigate={handleNavigate} />
        )}

        {currentPage === 'locations' && (
          <LocationsPage onNavigate={handleNavigate} />
        )}
          </>
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        showTrustStrip={currentPage !== 'track-result'}
      />
    </div>
  );
}

export function App() {
  return (
    <AdminDataProvider>
      <MainAppContent />
    </AdminDataProvider>
  );
}

export default App;

