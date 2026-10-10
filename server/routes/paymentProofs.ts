import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { deleteUpload, IMAGE_CONTENT_TYPES, resolveUploadPath } from '../uploads.js';
import { PROOF_STATUSES } from '../../src/shared/paymentProof.js';
import type { AdminPaymentProof, ProofStatus, PublicProofStatus } from '../../src/shared/paymentProof.js';

// Proofs of payment (docs/update.md Phase F). The screenshots are private: they are only served
// through admin-authenticated routes, never from /media.

export type ProofRow = {
  id: string; payment_id: string; tracking_number: string; method_id: string | null;
  method_snapshot_json: string | null; payer_name: string; amount_sent: number | null;
  reference: string | null; file_name: string; status: string; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
};

/** The latest proof of a payment request as the track page shows it (F.4), or null. */
export function latestPublicProof(paymentId: string): PublicProofStatus | null {
  const row = db.prepare('SELECT status, created_at, admin_note FROM payment_proofs WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(paymentId) as { status: ProofStatus; created_at: string; admin_note: string | null } | undefined;
  if (!row) return null;
  return {
    status: row.status,
    submittedAt: row.created_at,
    // The admin's note is only shown to the customer as a rejection reason.
    rejectionReason: row.status === 'REJECTED' ? row.admin_note : null,
  };
}

/**
 * Removes every proof sent for a shipment, rows and files. A shipment has at most one payment
 * request, so this runs whenever that request is deleted (and on permanent shipment delete).
 */
export function deleteProofsForShipment(tracking: string) {
  const rows = db.prepare('SELECT file_name FROM payment_proofs WHERE tracking_number = ?').all(tracking) as { file_name: string }[];
  db.prepare('DELETE FROM payment_proofs WHERE tracking_number = ?').run(tracking);
  for (const row of rows) deleteUpload('proofs', row.file_name);
}

// ---- Admin Payments page (docs/update.md F.5). Mounted on /api/payments behind requireAdminAuth. ----

export const paymentsRouter = Router();

type ProofListRow = ProofRow & {
  p_amount: number | null; p_currency: string | null; p_reason: string | null; p_status: string | null;
};

function parseSnapshot(json: string | null): AdminPaymentProof['method'] {
  if (!json) return null;
  try {
    const m = JSON.parse(json);
    return m && typeof m.type === 'string' ? { type: m.type, label: m.label ?? null, details: m.details ?? {} } : null;
  } catch {
    return null;
  }
}

export function formatProof(row: ProofListRow): AdminPaymentProof {
  return {
    id: row.id,
    paymentId: row.payment_id,
    trackingNumber: row.tracking_number,
    methodId: row.method_id,
    method: parseSnapshot(row.method_snapshot_json),
    payerName: row.payer_name,
    amountSent: row.amount_sent,
    reference: row.reference,
    status: row.status as ProofStatus,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    fileUrl: `/api/payments/proofs/${encodeURIComponent(row.id)}/file`,
    payment: row.p_amount === null ? null : {
      amount: row.p_amount, currency: row.p_currency ?? 'USD', chargeReason: row.p_reason ?? '', status: row.p_status ?? '',
    },
  };
}

const PROOF_SELECT = `
  SELECT pp.*, sp.amount AS p_amount, sp.currency AS p_currency, sp.charge_reason AS p_reason, sp.status AS p_status
  FROM payment_proofs pp
  JOIN shipments s ON s.tracking_number = pp.tracking_number AND s.deleted_at_ts IS NULL
  LEFT JOIN shipment_payments sp ON sp.id = pp.payment_id`;

/** One proof with its request, or null (also null when its shipment is in the trash). */
export function getProof(id: string): AdminPaymentProof | null {
  const row = db.prepare(`${PROOF_SELECT} WHERE pp.id = ?`).get(id) as ProofListRow | undefined;
  return row ? formatProof(row) : null;
}

// GET /api/payments/proofs?status=SUBMITTED|APPROVED|REJECTED (all when omitted), newest first.
// Proofs of shipments in the trash are left out, like the rest of the console.
paymentsRouter.get('/proofs', (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    if (status && !(PROOF_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ success: false, error: 'Unknown status.' });
    }
    const rows = (status
      ? db.prepare(`${PROOF_SELECT} WHERE pp.status = ? ORDER BY pp.created_at DESC LIMIT 500`).all(status)
      : db.prepare(`${PROOF_SELECT} ORDER BY pp.created_at DESC LIMIT 500`).all()) as ProofListRow[];
    res.json({ success: true, data: rows.map(formatProof) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/proofs/:id/file: the private screenshot. Never cached, never sniffed.
paymentsRouter.get('/proofs/:id/file', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT file_name FROM payment_proofs WHERE id = ?').get(req.params.id as string) as { file_name: string } | undefined;
    const filePath = row ? resolveUploadPath('proofs', row.file_name) : null;
    if (!row || !filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Not found.' });
    const ext = path.extname(row.file_name).slice(1);
    res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
