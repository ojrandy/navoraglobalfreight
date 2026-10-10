import { Router, Request, Response } from 'express';
import path from 'path';
import { db } from '../db.js';
import { IMAGE_CONTENT_TYPES, resolveUploadPath } from '../uploads.js';

export const mediaRouter = Router();

function notFound(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).type('text/plain').send('Not found');
}

// GET /media/<id>.<ext> (public). Package images only, and only while marked visible on a shipment
// that isn't in the trash. Payment proofs are never served here: they live in a separate folder
// that this route can't reach (resolveUploadPath is always called with 'images').
mediaRouter.get('/media/:file', (req: Request, res: Response) => {
  const file = req.params.file as string;
  const filePath = resolveUploadPath('images', file);
  if (!filePath) return notFound(res);

  const id = file.slice(0, file.lastIndexOf('.'));
  const row = db.prepare(`
    SELECT si.file_name FROM shipment_images si
    JOIN shipments s ON s.tracking_number = si.tracking_number
    WHERE si.id = ? AND si.is_public = 1 AND s.deleted_at_ts IS NULL
  `).get(id) as { file_name: string } | undefined;
  if (!row || row.file_name !== file) return notFound(res);

  res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[path.extname(file).slice(1)]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // A given id's bytes never change (a new upload gets a new id), so it can be cached for long.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath, { cacheControl: false }, (err) => {
    if (err && !res.headersSent) notFound(res);
  });
});
