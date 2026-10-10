import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { IMAGE_CONTENT_TYPES, deleteUpload, resolveUploadPath, saveImageUpload } from '../uploads.js';

// Package images (docs/update.md B.2). Mounted on /api/shipments next to shipmentsRouter, which
// also takes public requests (booking POST), so every route here is gated individually rather
// than with router.use().
export const shipmentImagesRouter = Router();

export const MAX_IMAGES_PER_SHIPMENT = 20;
export const MAX_CAPTION_LENGTH = 120;

type ImageRow = {
  id: string; tracking_number: string; caption: string; file_name: string;
  width: number | null; height: number | null; size_bytes: number | null;
  is_public: number; sort_order: number; created_at: string;
};

const ORDER_BY = 'ORDER BY sort_order ASC, created_at ASC';

function trackingParam(req: Request): string {
  return (req.params.trackingNumber as string).trim().toUpperCase();
}

function activeShipmentExists(tracking: string): boolean {
  return !!db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
}

function cleanCaption(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const caption = value.replace(/\s+/g, ' ').trim();
  return caption && caption.length <= MAX_CAPTION_LENGTH ? caption : null;
}

// Dimensions come from the browser's compressor and are only used for layout (width/height
// attributes), so they're accepted when plausible and dropped otherwise.
function cleanDimension(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 10000 ? n : null;
}

function formatImage(row: ImageRow) {
  return {
    id: row.id,
    caption: row.caption,
    // Admin preview works for hidden images too; the public /media URL only for visible ones.
    adminUrl: `/api/shipments/${encodeURIComponent(row.tracking_number)}/images/${row.id}/file`,
    url: `/media/${row.file_name}`,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    isPublic: row.is_public === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function listImages(tracking: string) {
  const rows = db.prepare(`SELECT * FROM shipment_images WHERE tracking_number = ? ${ORDER_BY}`).all(tracking) as ImageRow[];
  return rows.map(formatImage);
}

/** Visible images for the public track response (B.4). Callers have already checked the shipment isn't trashed. */
export function publicShipmentImages(tracking: string) {
  const rows = db.prepare(`SELECT * FROM shipment_images WHERE tracking_number = ? AND is_public = 1 ${ORDER_BY}`).all(tracking) as ImageRow[];
  return rows.map((row) => ({
    url: `/media/${row.file_name}`,
    caption: row.caption,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  }));
}

/** Removes every image row and file of a shipment. Only for permanent deletion. */
export function deleteAllShipmentImages(tracking: string) {
  const rows = db.prepare('SELECT file_name FROM shipment_images WHERE tracking_number = ?').all(tracking) as { file_name: string }[];
  db.prepare('DELETE FROM shipment_images WHERE tracking_number = ?').run(tracking);
  for (const row of rows) {
    try { deleteUpload('images', row.file_name); } catch (err) { console.error('[images] Could not delete file', row.file_name, err); }
  }
}

// GET /api/shipments/:trackingNumber/images (admin): every image, hidden ones included.
shipmentImagesRouter.get('/:trackingNumber/images', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    res.json({ success: true, data: listImages(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shipments/:trackingNumber/images (admin): { image: base64, caption, isPublic?, width?, height? }
shipmentImagesRouter.post('/:trackingNumber/images', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    const body = req.body || {};
    const caption = cleanCaption(body.caption);
    if (!caption) return res.status(400).json({ success: false, error: `A caption is required (up to ${MAX_CAPTION_LENGTH} characters).` });

    const count = (db.prepare('SELECT COUNT(*) AS c FROM shipment_images WHERE tracking_number = ?').get(tracking) as { c: number }).c;
    if (count >= MAX_IMAGES_PER_SHIPMENT) {
      return res.status(400).json({ success: false, error: `A shipment can have up to ${MAX_IMAGES_PER_SHIPMENT} images.` });
    }

    const saved = saveImageUpload('images', body.image);
    if (!saved.ok) return res.status(400).json({ success: false, error: saved.error });

    const maxOrder = (db.prepare('SELECT MAX(sort_order) AS m FROM shipment_images WHERE tracking_number = ?').get(tracking) as { m: number | null }).m;
    db.prepare(`
      INSERT INTO shipment_images (id, tracking_number, caption, file_name, width, height, size_bytes, is_public, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saved.id, tracking, caption, saved.fileName,
      cleanDimension(body.width), cleanDimension(body.height), saved.sizeBytes,
      body.isPublic === false ? 0 : 1, (maxOrder ?? -1) + 1, new Date().toISOString()
    );
    res.status(201).json({ success: true, data: listImages(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shipments/:trackingNumber/images/order (admin): { ids: [...] } in the new order.
shipmentImagesRouter.put('/:trackingNumber/images/order', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    const ids = req.body?.ids;
    const current = (db.prepare('SELECT id FROM shipment_images WHERE tracking_number = ?').all(tracking) as { id: string }[]).map((r) => r.id);
    const valid = Array.isArray(ids) && ids.length === current.length
      && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!valid) return res.status(400).json({ success: false, error: 'The new order must list each of this shipment’s images once.' });

    const stmt = db.prepare('UPDATE shipment_images SET sort_order = ? WHERE id = ? AND tracking_number = ?');
    db.exec('BEGIN');
    try {
      ids.forEach((id: string, index: number) => stmt.run(index, id, tracking));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ success: true, data: listImages(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/shipments/:trackingNumber/images/:imageId (admin): { caption?, isPublic? }
shipmentImagesRouter.patch('/:trackingNumber/images/:imageId', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    const row = db.prepare('SELECT * FROM shipment_images WHERE id = ? AND tracking_number = ?').get(req.params.imageId as string, tracking) as ImageRow | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Image not found.' });

    const body = req.body || {};
    let caption = row.caption;
    if (body.caption !== undefined) {
      const cleaned = cleanCaption(body.caption);
      if (!cleaned) return res.status(400).json({ success: false, error: `A caption is required (up to ${MAX_CAPTION_LENGTH} characters).` });
      caption = cleaned;
    }
    const isPublic = typeof body.isPublic === 'boolean' ? (body.isPublic ? 1 : 0) : row.is_public;
    db.prepare('UPDATE shipment_images SET caption = ?, is_public = ? WHERE id = ?').run(caption, isPublic, row.id);
    res.json({ success: true, data: listImages(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/shipments/:trackingNumber/images/:imageId (admin): removes the row and the file.
shipmentImagesRouter.delete('/:trackingNumber/images/:imageId', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    const row = db.prepare('SELECT * FROM shipment_images WHERE id = ? AND tracking_number = ?').get(req.params.imageId as string, tracking) as ImageRow | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Image not found.' });
    db.prepare('DELETE FROM shipment_images WHERE id = ?').run(row.id);
    deleteUpload('images', row.file_name);
    res.json({ success: true, data: listImages(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipments/:trackingNumber/images/:imageId/file (admin): the image itself, visible or
// not, for previews in the console. /api responses are already no-store (server/index.ts).
shipmentImagesRouter.get('/:trackingNumber/images/:imageId/file', requireAdminAuth, (req: Request, res: Response) => {
  const tracking = trackingParam(req);
  const row = db.prepare('SELECT file_name FROM shipment_images WHERE id = ? AND tracking_number = ?').get(req.params.imageId as string, tracking) as { file_name: string } | undefined;
  const filePath = row && resolveUploadPath('images', row.file_name);
  if (!row || !filePath) return res.status(404).json({ success: false, error: 'Image not found.' });
  res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[row.file_name.split('.').pop() as string]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath, { cacheControl: false }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, error: 'Image not found.' });
  });
});
