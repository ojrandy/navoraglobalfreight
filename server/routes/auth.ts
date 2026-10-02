import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { SESSION_COOKIE } from '../middleware/auth.js';

export const authRouter = Router();

// A handful of attempts per window per IP — this is what actually stops password-guessing;
// rate-limiting only the public write endpoints (quotes/shipments) wouldn't touch this route
// at all. Counts both failed and successful attempts against the same window deliberately
// (skipSuccessfulRequests defaults to false) — a real admin logging in once isn't going to
// notice a 20-per-15-minutes ceiling, but it caps how fast a script can grind through guesses.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in a few minutes.' }
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    // Read process.env at request time, not as a module-level constant — this file is
    // imported (and its top-level code evaluated) before index.ts's dotenv.config() call
    // runs, since ES module imports are hoisted above the rest of the importing module's
    // code. A module-level `const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH`
    // would have permanently captured `undefined`, no matter how correct the .env file was.
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminPasswordHash) {
      // Misconfiguration, not a client error — fail closed rather than silently accepting
      // any password because the hash never got set.
      console.error('[auth] ADMIN_PASSWORD_HASH is not set — refusing all logins.');
      return res.status(500).json({ success: false, error: 'Admin login is not configured.' });
    }

    const { password } = req.body || {};
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const valid = await bcrypt.compare(password, adminPasswordHash);
    if (!valid) {
      // Deliberately generic — never confirm/deny which part of a credential was wrong.
      return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }

    req.session.isAdmin = true;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE);
    res.json({ success: true });
  });
});

// GET /api/auth/session — lets the frontend check whether it's already logged in on load,
// without that check itself requiring auth (that would be a bit circular).
authRouter.get('/session', (req: Request, res: Response) => {
  res.json({ success: true, isAdmin: Boolean(req.session?.isAdmin) });
});
