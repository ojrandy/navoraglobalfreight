import { Router, Request, Response, NextFunction } from 'express';
import { ADMIN_HOST, ADMIN_PATH, SITE_URL } from '../src/config/brand.js';

// robots.txt, sitemap.xml and crawler headers (tracker 6.4). The admin console is the same Node
// app as the public site, under ADMIN_PATH on the main domain (DEPLOYMENT §5). The old admin
// host (ADMIN_HOST) now only redirects to that path (index.ts). Neither is ever listed anywhere a
// crawler can read it: a Disallow line in robots.txt would advertise the path.

// ADMIN_PROXY_TARGET marks a deployment that serves only the admin host (see index.ts).
export function isOldAdminHost(req: Request): boolean {
  return Boolean(process.env.ADMIN_PROXY_TARGET) || req.hostname.toLowerCase() === ADMIN_HOST;
}

export function isAdminPathRequest(req: Request): boolean {
  const p = req.path.toLowerCase();
  return p === ADMIN_PATH || p.startsWith(`${ADMIN_PATH}/`);
}

// The site uses hash routing (#/services, #/track/…). Search engines drop everything after "#",
// so the home URL is the only page they can index on its own; hash URLs don't belong in a sitemap.
const SITEMAP_PATHS = ['/'];

export const seoRouter = Router();

// Belt and braces for the console: a header works before any HTML or JS runs, and also covers
// the old host's redirects (App.tsx adds the matching robots meta tag at runtime).
seoRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (isOldAdminHost(req) || isAdminPathRequest(req)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

seoRouter.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  if (isOldAdminHost(req)) {
    res.send('User-agent: *\nDisallow: /\n');
    return;
  }
  res.send(`User-agent: *\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

seoRouter.get('/sitemap.xml', (req: Request, res: Response) => {
  if (isOldAdminHost(req)) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  const urls = SITEMAP_PATHS
    .map((p) => `  <url>\n    <loc>${SITE_URL}${p}</loc>\n  </url>`)
    .join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
});
