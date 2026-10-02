import { Router, Request, Response, NextFunction } from 'express';
import { ADMIN_HOST, SITE_URL } from '../src/config/brand.js';

// robots.txt, sitemap.xml and crawler headers (tracker 6.4). The public site and the admin
// console are the same Node app on two hostnames (DEPLOYMENT §5), so every answer here depends
// on which host asked. The admin host is never listed anywhere a crawler can read it.

// ADMIN_PROXY_TARGET marks a deployment that serves only the admin host (see index.ts).
function isAdminRequest(req: Request): boolean {
  return Boolean(process.env.ADMIN_PROXY_TARGET) || req.hostname.toLowerCase() === ADMIN_HOST;
}

// The site uses hash routing (#/services, #/track/…). Search engines drop everything after "#",
// so the home URL is the only page they can index on its own; hash URLs don't belong in a sitemap.
const SITEMAP_PATHS = ['/'];

export const seoRouter = Router();

// Belt and braces for the admin host: a header works before any HTML or JS runs, and also covers
// API responses and static files (App.tsx adds the matching robots meta tag at runtime).
seoRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (isAdminRequest(req)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

seoRouter.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  if (isAdminRequest(req)) {
    res.send('User-agent: *\nDisallow: /\n');
    return;
  }
  res.send(`User-agent: *\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

seoRouter.get('/sitemap.xml', (req: Request, res: Response) => {
  if (isAdminRequest(req)) {
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
