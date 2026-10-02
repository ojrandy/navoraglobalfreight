import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
  }
}

// This used to also run a second, independent CSRF check here: reject any state-changing
// request whose Origin header didn't match "this app's own origin", derived from the
// request itself. In production that derivation proved unreliable across two different
// approaches (matching req.protocol+host, then host-only) — this app sits behind Hostinger's
// own edge CDN in front of whatever internal proxying it does to reach the actual Node
// process, and neither the forwarded scheme nor the forwarded Host header reliably survived
// that chain intact. The practical effect was every real admin write (delete, status
// updates, settings saves) getting rejected with a 403 in production, repeatedly, across
// multiple attempts to fix the derivation — a redundant safety net actively breaking the
// primary feature it was meant to protect.
//
// It's genuinely redundant, not just broken: the session cookie's `sameSite: 'lax'` (see
// index.ts) already stops the actual CSRF attack this was defending against — a cross-site
// page cannot get a browser to attach the admin session cookie to a state-changing
// fetch/XHR/form request at all, so a forged request from another origin never even reaches
// this middleware with a valid session in the first place. Removed rather than attempting a
// third derivation; the session check below remains the real gate.
// Admin session cookie. Renamed during the SDL rebrand; that rename signed every existing
// admin session out once.
export const SESSION_COOKIE = 'sdl.sid';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}
