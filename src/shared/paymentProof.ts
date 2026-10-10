// Proof of payment sent from the track page (docs/update.md Phase F). Shared by the server (the
// public submit route) and the customer form, so both apply the same rules and messages
// (CONTENT.md §6.8). The screenshot itself is checked separately (server/uploads.ts).
import { PAYMENT_LIMITS } from './paymentRequest.js';

export const PROOF_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type ProofStatus = typeof PROOF_STATUSES[number];

export const PROOF_LIMITS = {
  payerNameMin: 2,
  payerNameMax: 100,
  referenceMax: 120,
  /** Proofs waiting for review per payment request (docs/update.md F.2). */
  maxOpenProofs: 3,
  rejectReasonMin: 3,
  rejectReasonMax: 300,
} as const;

export interface ProofSubmission {
  methodId: string;
  payerName: string;
  amountSent: number;
  reference: string | null;
}

export type ProofValidation =
  | { ok: true; value: ProofSubmission }
  | { ok: false; errors: Record<string, string> };

/** Checks the form fields. `methodIds` are the accounts on this shipment's own request. */
export function validateProofSubmission(input: unknown, methodIds: readonly string[]): ProofValidation {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const methodId = typeof src.methodId === 'string' ? src.methodId : '';
  if (!methodIds.includes(methodId)) errors.methodId = 'Choose the account you paid to.';

  const payerName = typeof src.payerName === 'string' ? src.payerName.trim().replace(/\s+/g, ' ') : '';
  if (payerName.length < PROOF_LIMITS.payerNameMin) errors.payerName = 'Enter the name the payment was sent from.';
  else if (payerName.length > PROOF_LIMITS.payerNameMax) errors.payerName = `Keep the name under ${PROOF_LIMITS.payerNameMax} characters.`;

  const rawAmount = typeof src.amountSent === 'string' ? src.amountSent.trim() : src.amountSent;
  const amountSent = rawAmount === '' || rawAmount === undefined || rawAmount === null ? NaN : Number(rawAmount);
  if (!Number.isFinite(amountSent) || amountSent <= 0) errors.amountSent = 'Enter the amount you sent.';
  else if (amountSent > PAYMENT_LIMITS.maxAmount) errors.amountSent = 'That amount is too large.';

  let reference: string | null = null;
  if (typeof src.reference === 'string' && src.reference.trim()) {
    reference = src.reference.trim();
    if (reference.length > PROOF_LIMITS.referenceMax) errors.reference = `Keep the reference under ${PROOF_LIMITS.referenceMax} characters.`;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { methodId, payerName, amountSent: Math.round(amountSent * 100) / 100, reference } };
}

/** The latest proof as the track page shows it (F.4): no file, no payer details. */
export interface PublicProofStatus {
  status: ProofStatus;
  submittedAt: string;
  /** Only for REJECTED: the reason the admin gave. */
  rejectionReason: string | null;
}

/** A proof as the admin Payments page lists it (F.5). */
export interface AdminPaymentProof {
  id: string;
  paymentId: string;
  trackingNumber: string;
  methodId: string | null;
  /** The account as it was when the customer used it. */
  method: { type: string; label: string | null; details: Record<string, string> } | null;
  payerName: string;
  amountSent: number | null;
  reference: string | null;
  status: ProofStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  /** Admin-only URL of the screenshot. */
  fileUrl: string;
  /** The request this proof is for, as it is now (null if it was deleted). */
  payment: { amount: number; currency: string; chargeReason: string; status: string } | null;
}
