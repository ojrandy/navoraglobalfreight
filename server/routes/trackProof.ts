import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { paymentProofLimiter } from '../middleware/rateLimit.js';
import { deleteUpload, saveImageUpload } from '../uploads.js';
import { getShipmentPayment } from './shipmentPayments.js';
import { parseTrackingInput } from '../../src/shared/trackingId.js';
import { PROOF_LIMITS, validateProofSubmission } from '../../src/shared/paymentProof.js';

// POST /api/track/:trackingNumber/payment-proof (public, rate-limited; docs/update.md F.2).
// Anyone with the tracking ID can send a proof, but only while the request is awaiting payment,
// only for one of this shipment's own accounts, and only as an image checked by its content.
// On success the request moves to UNDER_REVIEW. Mounted on /api/track before trackRouter.
export const trackProofRouter = Router();

// Customer-facing messages (CONTENT.md §6.8). `code` lets the form pick the right one.
const NOT_ACCEPTING = 'This payment is no longer waiting for a proof. Refresh the page to see its current status.';
const TOO_MANY_OPEN = 'We already have proofs waiting for review for this payment. Our team will check them first.';
const NOT_AN_IMAGE = 'This file isn\'t an image. Upload a JPG, PNG, WebP or HEIC.';

trackProofRouter.post('/:trackingNumber/payment-proof', paymentProofLimiter, (req: Request, res: Response) => {
  let savedFile: string | null = null;
  try {
    const parsed = parseTrackingInput(req.params.trackingNumber as string);
    if (!parsed) return res.status(400).json({ success: false, error: 'Tracking IDs are 8 characters, starting with NGF (for example NGF7K2M9).' });
    const tracking = parsed.trackingId;

    const shipment = db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
    const payment = shipment ? getShipmentPayment(tracking) : null;
    if (!payment) return res.status(404).json({ success: false, error: 'This shipment has no payment request.' });
    if (payment.status !== 'AWAITING_PAYMENT') {
      return res.status(409).json({ success: false, code: 'NOT_ACCEPTING', error: NOT_ACCEPTING });
    }
    const open = (db.prepare("SELECT COUNT(*) AS n FROM payment_proofs WHERE payment_id = ? AND status = 'SUBMITTED'").get(payment.id) as { n: number }).n;
    if (open >= PROOF_LIMITS.maxOpenProofs) {
      return res.status(409).json({ success: false, code: 'TOO_MANY_OPEN', error: TOO_MANY_OPEN });
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const checked = validateProofSubmission(body, payment.methods.map((m) => m.id));
    const fieldErrors: Record<string, string> = checked.ok ? {} : { ...checked.errors };
    if (!body.image) fieldErrors.image = 'Add a screenshot of the payment.';
    if (!checked.ok || fieldErrors.image) {
      return res.status(400).json({ success: false, error: 'Some details need fixing.', fieldErrors });
    }

    const upload = saveImageUpload('proofs', body.image);
    if (!upload.ok) {
      const message = upload.error === 'The image is too large.' ? upload.error : NOT_AN_IMAGE;
      return res.status(400).json({ success: false, error: 'Some details need fixing.', fieldErrors: { image: message } });
    }
    savedFile = upload.fileName;

    const proof = checked.value;
    const account = payment.methods.find((m) => m.id === proof.methodId)!;
    const now = new Date().toISOString();

    db.exec('BEGIN');
    try {
      // Re-checked inside the transaction: the admin may have changed the status meanwhile.
      const moved = db.prepare("UPDATE shipment_payments SET status = 'UNDER_REVIEW', updated_at = ? WHERE id = ? AND status = 'AWAITING_PAYMENT'")
        .run(now, payment.id);
      if (moved.changes === 0) {
        db.exec('ROLLBACK');
        deleteUpload('proofs', upload.fileName);
        return res.status(409).json({ success: false, code: 'NOT_ACCEPTING', error: NOT_ACCEPTING });
      }
      db.prepare(`
        INSERT INTO payment_proofs (id, payment_id, tracking_number, method_id, method_snapshot_json, payer_name,
          amount_sent, reference, file_name, status, admin_note, created_at, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', NULL, ?, NULL)
      `).run(upload.id, payment.id, tracking, account.id,
        JSON.stringify({ type: account.type, label: account.label, details: account.details }),
        proof.payerName, proof.amountSent, proof.reference, upload.fileName, now);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.status(201).json({ success: true, data: { status: 'SUBMITTED', submittedAt: now } });
  } catch (err: any) {
    if (savedFile) {
      try { deleteUpload('proofs', savedFile); } catch { /* the error below matters more */ }
    }
    res.status(500).json({ success: false, error: err.message });
  }
});
