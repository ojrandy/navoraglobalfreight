import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initDatabase, dataDir, dbPath } from './db.js';
import { shipmentsRouter } from './routes/shipments.js';
import { quotesRouter } from './routes/quotes.js';
import { documentsRouter } from './routes/documents.js';
import { settingsRouter } from './routes/settings.js';
import { trackRouter } from './routes/track.js';
import { statsRouter } from './routes/stats.js';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { seoRouter } from './seo.js';
import { requireAdminAuth, SESSION_COOKIE } from './middleware/auth.js';

dotenv.config(); // reload trigger for tsx watch after .env changes

const app = express();
const PORT = process.env.PORT || 5000;

// Set only on the admin-subdomain deployment. That deployment has no database of its own —
// every /api request is silently forwarded to the real app's API instead, so there is always
// exactly one SQLite file and one source of truth, never two copies of the data quietly
// diverging between the public site and the admin console. See the branch below.
const ADMIN_PROXY_TARGET = process.env.ADMIN_PROXY_TARGET;

// Hostinger (like virtually all shared/PaaS hosting) terminates HTTPS at a reverse proxy in
// front of this process, which itself only ever sees plain HTTP. Without this, Express has no
// way to know the original request was secure, so the session cookie's `secure: true` flag
// below never actually reaches the browser correctly — every request after login still looks
// unauthenticated (401), even though login itself appears to succeed. Trusting the first
// proxy hop is what lets Express read the standard X-Forwarded-Proto header instead.
app.set('trust proxy', 1);

if (!ADMIN_PROXY_TARGET) {
  // Initialize Persistent SQLite Database
  initDatabase();
}

// Middleware
// contentSecurityPolicy and crossOriginEmbedderPolicy are off deliberately, not an
// oversight: this app loads map tiles from ArcGIS, fonts from Google Fonts, and (on the
// flagship demo shipment) photos from Unsplash — none of those send the response headers a
// strict CSP/COEP would require, so turning helmet's defaults on as-is would silently break
// the map and images. Doing CSP properly means cataloguing every external host this app
// actually uses and allow-listing exactly those — worth doing as a deliberate follow-up,
// not as a default flip. Everything else helmet sets (X-Content-Type-Options, X-Frame-
// Options, Strict-Transport-Security, Referrer-Policy, etc.) is safe with no such tradeoff.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// robots.txt, sitemap.xml and the admin-host noindex header; host-aware, so before anything else.
app.use(seoRouter);

// credentials:true + a specific origin (not '*', which browsers reject alongside
// credentialed requests) — the admin session cookie has to actually reach the API for
// auth to work at all. In dev the Vite proxy makes this same-origin anyway, but this also
// covers hitting the API directly against its own port.
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// API answers are per-visitor (session, admin data) and must never be stored by Hostinger's
// CDN or the browser; a replayed/emptied login response broke sign-in on fresh browsers.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, private');
  next();
});

if (ADMIN_PROXY_TARGET) {
  // Admin-subdomain deployment: forward every /api request to the real app untouched, cookies
  // included. Mounted before any body-parser so the raw request stream reaches the upstream
  // intact — express.json() below would otherwise consume it, breaking the proxy for any
  // POST/PUT/PATCH body. No cookieDomainRewrite needed: the session cookie is set with no
  // explicit Domain attribute (see below), so it passes through unchanged and the browser
  // naturally scopes it to whichever host actually answered — this subdomain.
  //
  // pathRewrite re-adds "/api" because Express's app.use('/api', ...) already strips that
  // prefix from req.url before the proxy ever sees it (confirmed live — without this, /api/
  // health arrived upstream as bare /health and 404'd).
  app.use('/api', createProxyMiddleware({
    target: ADMIN_PROXY_TARGET,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
  }));
} else {
  // Raised from Express's 100kb default so a base64-encoded signature/stamp image upload
  // (see Settings > Barcode & Documents) doesn't silently fail with a 413.
  app.use(express.json({ limit: '5mb' }));

  if (!process.env.SESSION_SECRET) {
    console.error('[server] SESSION_SECRET is not set in .env — admin sessions will not persist reliably across restarts.');
  }

  app.use(session({
    name: SESSION_COOKIE,
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-fallback-secret',
    resave: false,
    saveUninitialized: false,
    // Tells express-session to trust the proxy-derived secure-ness (via trust proxy above)
    // rather than the raw, always-insecure connection this process itself sees — required
    // alongside app.set('trust proxy') for a secure cookie to actually be set behind one.
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Only sent over HTTPS once this is actually deployed behind one — forcing it on in
      // this local http dev setup would silently stop the cookie from ever being sent at all.
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    }
  }));

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SDL Global Logistics API',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // TEMPORARY diagnostic — answers "does this host wipe files that aren't tracked by git on
  // redeploy?" directly, rather than guessing. On first request ever, writes a marker file
  // (with its own creation time) next to the database. On every later request, reports that
  // same original timestamp back. If a redeploy resets this to a brand-new timestamp, the
  // host is wiping untracked files on every deploy — the same thing that would be silently
  // destroying the database each time. If the timestamp survives a redeploy, it isn't. Safe
  // to remove once that's confirmed one way or the other. Admin-only: it reveals server paths.
  app.get('/api/diag/storage', requireAdminAuth, (req, res) => {
    try {
      const markerPath = path.join(dataDir, '.persistence-check.json');
      let marker: { firstSeen: string; checkedAt: string };
      if (fs.existsSync(markerPath)) {
        const existing = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
        marker = { firstSeen: existing.firstSeen, checkedAt: new Date().toISOString() };
      } else {
        marker = { firstSeen: new Date().toISOString(), checkedAt: new Date().toISOString() };
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(markerPath, JSON.stringify({ firstSeen: marker.firstSeen }));
      }
      const dbExists = fs.existsSync(dbPath);
      const dbStat = dbExists ? fs.statSync(dbPath) : null;
      res.json({
        success: true,
        dataDir,
        markerFirstSeen: marker.firstSeen,
        markerCheckedAt: marker.checkedAt,
        databaseFileExists: dbExists,
        databaseFileSizeBytes: dbStat?.size ?? null,
        databaseFileModifiedAt: dbStat ? dbStat.mtime.toISOString() : null
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Routes
  // login/logout/session-check are necessarily unauthenticated (that's the point of them);
  // shipments and quotes are mixed public+admin routers, so each gates its own admin-only
  // routes internally — see the requireAdminAuth calls inside those two files. Documents,
  // settings and stats have no public use at all (confirmed by a full grep of the frontend
  // before this change), so it's simpler and harder to accidentally get wrong to gate them
  // wholesale here at the mount point instead of touching every route inside those files.
  app.use('/api/auth', authRouter);
  app.use('/api/shipments', shipmentsRouter);
  app.use('/api/quotes', quotesRouter);
  // documents is ALSO mixed public+admin (the public booking flow in ShipPage.tsx
  // auto-generates a BOL right after booking) — gated per-route inside documents.ts instead
  // of wholesale here, same reasoning as shipments/quotes.
  app.use('/api/documents', documentsRouter);
  // Not gated wholesale — GET is public (the public site needs to read company
  // identity/display-toggle fields like companyName/supportPhone/piiMaskingEnabled), and the
  // settings blob has nothing sensitive in it (no secrets, just business info and display
  // toggles whose enforcement already happens server-side regardless of who can see the
  // toggle's value). PUT is gated per-route inside settings.ts instead.
  app.use('/api/settings', settingsRouter);
  app.use('/api/track', trackRouter);
  // Contact form: POST is public (rate-limited); list and status changes are gated per-route.
  app.use('/api/messages', messagesRouter);
  app.use('/api/stats', requireAdminAuth, statsRouter);

  // 404 for anything under /api that didn't match a route above.
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Not found.' });
  });
}

// Serve the built React frontend (dist/, produced by `vite build`) so this one process is
// the whole deployed app — API above, static site here. The app uses HashRouter (#/admin,
// #/track/...), so the browser only ever requests the bare "/" from the server no matter which
// in-app page is open (everything after "#" stays client-side) — express.static's default
// index.html-for-"/" behavior is enough, no separate SPA catch-all route is needed.
app.use(express.static(path.join(process.cwd(), 'dist')));

// Last-resort error handler — catches anything that bypassed every route's own try/catch
// (a malformed JSON body from express.json(), a thrown error in middleware, etc.). Express's
// own default handler, with no NODE_ENV set (the case in this dev setup), responds with the
// FULL raw error — stack trace, absolute local filesystem paths, all of it — to whoever sent
// the request; confirmed live by POSTing truncated JSON and getting back a stack trace with
// this machine's real folder path in the response body. This always returns a flat, generic
// message instead and logs the real error server-side only, regardless of NODE_ENV.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  if (res.headersSent) return next(err);
  const isMalformedBody = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
  const status = isMalformedBody ? 400 : (typeof err?.status === 'number' ? err.status : 500);
  res.status(status).json({
    success: false,
    error: isMalformedBody ? 'Malformed request body.' : 'Internal server error.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SDL Global Logistics API running on port ${PORT}`);
  if (ADMIN_PROXY_TARGET) {
    console.log(`🔀 Admin-proxy mode — /api forwards to ${ADMIN_PROXY_TARGET}`);
  } else {
    console.log(`📦 Database: ${dbPath} (Persistent SQLite)`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  }
  console.log(`====================================================`);
});
