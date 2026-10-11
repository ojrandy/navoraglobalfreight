import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const statsRouter = Router();

// GET /api/stats (Live dashboard metrics)
statsRouter.get('/', (req: Request, res: Response) => {
  try {
    // deleted_at_ts IS NULL everywhere here — a soft-deleted (trashed) shipment shouldn't
    // count toward any of these operational totals.
    const totalShipments = (db.prepare('SELECT COUNT(*) as c FROM shipments WHERE deleted_at_ts IS NULL').get() as any).c;
    const inTransitCount = (db.prepare("SELECT COUNT(*) as c FROM shipments WHERE deleted_at_ts IS NULL AND status IN ('IN_TRANSIT', 'PROCESSED')").get() as any).c;
    const outForDeliveryCount = (db.prepare("SELECT COUNT(*) as c FROM shipments WHERE deleted_at_ts IS NULL AND status = 'OUT_FOR_DELIVERY'").get() as any).c;
    const deliveredCount = (db.prepare("SELECT COUNT(*) as c FROM shipments WHERE deleted_at_ts IS NULL AND status = 'DELIVERED'").get() as any).c;
    const exceptionsCount = (db.prepare("SELECT COUNT(*) as c FROM shipments WHERE deleted_at_ts IS NULL AND status = 'EXCEPTION'").get() as any).c;
    const pendingQuotesCount = (db.prepare("SELECT COUNT(*) as c FROM quote_requests WHERE status IN ('NEW', 'UNDER_REVIEW')").get() as any).c;
    const totalDocumentsCount = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as any).c;
    // Proofs of payment waiting for review (update G.1), counted the way the Payments page lists them.
    const submittedProofsCount = (db.prepare(`
      SELECT COUNT(*) as c FROM payment_proofs pp
      JOIN shipments s ON s.tracking_number = pp.tracking_number AND s.deleted_at_ts IS NULL
      WHERE pp.status = 'SUBMITTED'`).get() as any).c;

    const stats = {
      totalShipments,
      inTransitCount,
      outForDeliveryCount,
      deliveredCount,
      exceptionsCount,
      pendingQuotesCount,
      totalDocumentsCount,
      submittedProofsCount,
      onTimeRate: 98.6,
      networkEfficiency: 99.1
    };

    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
