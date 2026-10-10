import { db } from '../db.js';
import { deleteUpload } from '../uploads.js';

// Proofs of payment (docs/update.md Phase F). The screenshots are private: they are only served
// through admin-authenticated routes, never from /media.

export type ProofRow = {
  id: string; payment_id: string; tracking_number: string; method_id: string | null;
  method_snapshot_json: string | null; payer_name: string; amount_sent: number | null;
  reference: string | null; file_name: string; status: string; admin_note: string | null;
  created_at: string; reviewed_at: string | null;
};

/**
 * Removes every proof sent for a shipment, rows and files. A shipment has at most one payment
 * request, so this runs whenever that request is deleted (and on permanent shipment delete).
 */
export function deleteProofsForShipment(tracking: string) {
  const rows = db.prepare('SELECT file_name FROM payment_proofs WHERE tracking_number = ?').all(tracking) as { file_name: string }[];
  db.prepare('DELETE FROM payment_proofs WHERE tracking_number = ?').run(tracking);
  for (const row of rows) deleteUpload('proofs', row.file_name);
}
