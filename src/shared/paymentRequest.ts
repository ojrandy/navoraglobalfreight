// A shipment's payment request (docs/update.md §5, D.1, D-9): amount, reason and the payment
// accounts the courier typed for this shipment. Shared by the server (validation, the public
// track response) and the admin editor, so both apply the same rules.
import type { PublicProofStatus } from './paymentProof.js';
import {
  CustomerMethodView, Details, PaymentMethodType, customerMethodView, isPaymentMethodType, validatePaymentDetails,
} from './paymentMethods.js';

/** USD only for now (update.md D-6, D-7); the column stays ISO 4217 so more can be added later. */
export const PAYMENT_CURRENCIES = ['USD'] as const;
export type PaymentCurrency = typeof PAYMENT_CURRENCIES[number];
export const DEFAULT_PAYMENT_CURRENCY: PaymentCurrency = 'USD';

export const PAYMENT_STATUSES = ['AWAITING_PAYMENT', 'UNDER_REVIEW', 'PAID', 'CANCELLED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const PAYMENT_LIMITS = {
  maxAmount: 1_000_000_000,
  reasonMin: 3,
  reasonMax: 200,
  noteMax: 300,
  maxAccounts: 10,
  labelMax: 60,
  instructionsMax: 500,
} as const;

/** One account on a shipment's request. `id` stays stable across edits so proofs can refer to it. */
export interface PaymentAccount {
  id: string;
  type: PaymentMethodType;
  label: string | null;
  details: Details;
  instructions: string | null;
}

export interface CleanPaymentRequest {
  amount: number;
  currency: PaymentCurrency;
  chargeReason: string;
  dueDate: string | null;
  invoiceDocumentId: string | null;
  customerNote: string | null;
  methods: PaymentAccount[];
}

export type PaymentRequestValidation =
  | { ok: true; value: CleanPaymentRequest }
  | { ok: false; errors: Record<string, string> };

const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function optionalText(value: unknown, max: number, key: string, label: string, errors: Record<string, string>): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    errors[key] = `${label} must be text.`;
    return null;
  }
  const text = value.trim();
  if (text.length > max) errors[key] = `Keep ${label.toLowerCase()} under ${max} characters.`;
  return text || null;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Checks a whole payment request. Errors are keyed by field ('amount', 'chargeReason', ...) and,
 * for accounts, by 'methods.<index>.<field>' (or 'methods.<index>._form' for either/or rules).
 * `newId` makes ids for accounts that don't have a valid one yet.
 */
export function validatePaymentRequest(input: unknown, newId: () => string): PaymentRequestValidation {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const amount = typeof src.amount === 'string' ? Number(src.amount.trim()) : Number(src.amount);
  if (src.amount === undefined || src.amount === '' || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter the amount due (more than 0).';
  } else if (amount > PAYMENT_LIMITS.maxAmount) {
    errors.amount = 'That amount is too large.';
  }

  const currency = (src.currency ?? DEFAULT_PAYMENT_CURRENCY) as string;
  if (!(PAYMENT_CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = `Payments are in ${PAYMENT_CURRENCIES.join(', ')} only.`;
  }

  const reason = typeof src.chargeReason === 'string' ? src.chargeReason.trim().replace(/\s+/g, ' ') : '';
  if (reason.length < PAYMENT_LIMITS.reasonMin) {
    errors.chargeReason = 'Say what the customer is paying for, e.g. "Customs duty".';
  } else if (reason.length > PAYMENT_LIMITS.reasonMax) {
    errors.chargeReason = `Keep the reason under ${PAYMENT_LIMITS.reasonMax} characters.`;
  }

  let dueDate: string | null = null;
  if (src.dueDate !== undefined && src.dueDate !== null && src.dueDate !== '') {
    if (typeof src.dueDate === 'string' && isRealDate(src.dueDate)) dueDate = src.dueDate;
    else errors.dueDate = 'Enter a valid date.';
  }

  const invoiceDocumentId = optionalText(src.invoiceDocumentId, 64, 'invoiceDocumentId', 'Invoice', errors);
  const customerNote = optionalText(src.customerNote, PAYMENT_LIMITS.noteMax, 'customerNote', 'The note', errors);

  const rawMethods = Array.isArray(src.methods) ? src.methods : [];
  if (rawMethods.length === 0) errors.methods = 'Add at least one payment account.';
  if (rawMethods.length > PAYMENT_LIMITS.maxAccounts) errors.methods = `Add up to ${PAYMENT_LIMITS.maxAccounts} payment accounts.`;

  const usedIds = new Set<string>();
  const methods: PaymentAccount[] = [];
  rawMethods.slice(0, PAYMENT_LIMITS.maxAccounts).forEach((raw, i) => {
    const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const key = `methods.${i}`;
    if (!isPaymentMethodType(m.type)) {
      errors[`${key}.type`] = 'Choose a payment method type.';
      return;
    }
    const checked = validatePaymentDetails(m.type, m.details);
    if (!checked.ok) {
      for (const [field, message] of Object.entries(checked.errors)) errors[`${key}.${field}`] = message;
    }
    const label = optionalText(m.label, PAYMENT_LIMITS.labelMax, `${key}.label`, 'The display name', errors);
    const instructions = optionalText(m.instructions, PAYMENT_LIMITS.instructionsMax, `${key}.instructions`, 'The instructions', errors);
    let id = typeof m.id === 'string' && ACCOUNT_ID.test(m.id) && !usedIds.has(m.id) ? m.id : newId();
    while (usedIds.has(id)) id = newId();
    usedIds.add(id);
    methods.push({ id, type: m.type, label, details: checked.ok ? checked.details : {}, instructions });
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      amount: Math.round(amount * 100) / 100,
      currency: currency as PaymentCurrency,
      chargeReason: reason,
      dueDate,
      invoiceDocumentId,
      customerNote,
      methods,
    },
  };
}

/** A stored request, as the admin API returns it. */
export interface ShipmentPayment extends CleanPaymentRequest {
  id: string;
  trackingNumber: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface PublicPaymentAccount extends CustomerMethodView {
  id: string;
  instructions: string | null;
}

/** What the public track response carries (D.4). No internal fields such as the linked invoice id. */
export interface PublicPayment {
  amount: number;
  currency: string;
  chargeReason: string;
  dueDate: string | null;
  status: PaymentStatus;
  customerNote: string | null;
  paidAt: string | null;
  methods: PublicPaymentAccount[];
  /** The latest proof sent for this request (F.4): status and time only, plus the rejection reason. */
  proof: PublicProofStatus | null;
}

/** Builds the public payment block from a stored request: only this request's own accounts, in order. */
export function publicPaymentView(payment: ShipmentPayment, latestProof: PublicProofStatus | null = null): PublicPayment {
  return {
    amount: payment.amount,
    currency: payment.currency,
    chargeReason: payment.chargeReason,
    dueDate: payment.dueDate,
    status: payment.status,
    customerNote: payment.customerNote,
    paidAt: payment.paidAt,
    methods: payment.methods
      .filter((m) => isPaymentMethodType(m.type))
      .map((m) => ({ id: m.id, ...customerMethodView(m.type, m.details, m.label), instructions: m.instructions })),
    proof: latestProof,
  };
}

/** Formats an amount in its currency, e.g. 120 USD -> "$120.00". */
export function formatPaymentAmount(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
