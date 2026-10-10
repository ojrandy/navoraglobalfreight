// Payment method types (docs/update.md §4, C.1): the single registry used by the server
// (validation, the public track response) and both UIs (admin forms, customer cards). Adding a
// method later means adding one entry here. Customer-facing names, labels, warnings and notes
// come from docs/CONTENT.md §6.7. Gift cards are deliberately absent (update.md D-1).
import {
  CryptoCoin, ValidationResult, validateCashtag, validateCryptoAddress, validateDigits, validateEmail,
  validateHandle, validateHttpsUrl, validateIban, validatePhone, validateRoutingNumber, validateSortCode, validateSwift,
} from './paymentValidation.js';

export const PAYMENT_METHOD_TYPES = [
  'paypal', 'bitcoin', 'usdt', 'ethereum', 'zelle', 'cashapp', 'venmo', 'applepay', 'googlepay',
  'us_bank', 'uk_bank', 'intl_wire', 'wise', 'revolut', 'card_link', 'western_union', 'moneygram',
] as const;
export type PaymentMethodType = typeof PAYMENT_METHOD_TYPES[number];

export type PaymentFieldKind =
  | 'text' | 'email' | 'url' | 'phone' | 'crypto' | 'iban' | 'sortCode' | 'routing'
  | 'swift' | 'cashtag' | 'handle' | 'accountNumber';

export interface PaymentField {
  name: string;
  label: string;
  kind: PaymentFieldKind;
  required?: boolean;
  /** Fixed choices (e.g. a crypto network); the first one is the default. */
  options?: readonly string[];
  placeholder?: string;
  /** For 'url': the link must be on one of these hosts (or a subdomain of one). */
  hosts?: readonly string[];
  /** For 'accountNumber': allowed digit counts. */
  digits?: readonly [number, number];
  /** Shown to the customer with a Copy button. Defaults to true. */
  copyable?: boolean;
}

export type PaymentGroup = 'wallet' | 'crypto' | 'bank' | 'cash';

export interface PaymentMethodDefinition {
  type: PaymentMethodType;
  label: string;
  /** Local icon in src/assets/payment-icons/ (C.2), or a lucide fallback key. */
  iconKey: string;
  group: PaymentGroup;
  coin?: CryptoCoin;
  fields: readonly PaymentField[];
  /** At least one field of each group must be filled, e.g. Zelle email OR phone. */
  requireOneOf?: readonly (readonly string[])[];
  /** Customer-side extras, built from the stored details. */
  link?: (d: Details) => { label: string; url: string } | null;
  qr?: (d: Details) => string | null;
  warning?: (d: Details) => string | null;
  note?: string;
}

export type Details = Record<string, string>;

const NAME = (label = 'Account name', required = true): PaymentField => ({ name: 'accountName', label, kind: 'text', required });

const cryptoWarning = (coin: string) => (d: Details) =>
  d.network ? `Send only ${coin} on the ${d.network} network. Funds sent on another network can be lost.` : null;

export const PAYMENT_METHODS: Record<PaymentMethodType, PaymentMethodDefinition> = {
  paypal: {
    type: 'paypal', label: 'PayPal', iconKey: 'paypal', group: 'wallet',
    fields: [
      { name: 'email', label: 'PayPal email', kind: 'email', placeholder: 'payments@example.com' },
      { name: 'link', label: 'PayPal.Me link', kind: 'url', hosts: ['paypal.me', 'paypal.com'], placeholder: 'https://paypal.me/yourname', copyable: false },
      NAME('Account name', false),
    ],
    requireOneOf: [['email', 'link']],
    link: (d) => (d.link ? { label: 'Open PayPal', url: d.link } : null),
    qr: (d) => d.link || null,
  },
  bitcoin: {
    type: 'bitcoin', label: 'Bitcoin (BTC)', iconKey: 'bitcoin', group: 'crypto', coin: 'BTC',
    fields: [
      { name: 'network', label: 'Network', kind: 'text', required: true, options: ['Bitcoin', 'Lightning'] },
      { name: 'address', label: 'Wallet address', kind: 'crypto', required: true },
    ],
    qr: (d) => d.address || null,
    warning: cryptoWarning('BTC'),
  },
  usdt: {
    type: 'usdt', label: 'USDT (Tether)', iconKey: 'tether', group: 'crypto', coin: 'USDT',
    fields: [
      { name: 'network', label: 'Network', kind: 'text', required: true, options: ['TRC20 (Tron)', 'ERC20 (Ethereum)', 'BEP20 (BNB Smart Chain)', 'Polygon', 'Solana'] },
      { name: 'address', label: 'Wallet address', kind: 'crypto', required: true },
    ],
    qr: (d) => d.address || null,
    warning: cryptoWarning('USDT'),
  },
  ethereum: {
    type: 'ethereum', label: 'Ethereum (ETH)', iconKey: 'ethereum', group: 'crypto', coin: 'ETH',
    fields: [
      { name: 'network', label: 'Network', kind: 'text', required: true, options: ['Ethereum (mainnet)', 'Arbitrum', 'Optimism', 'Base', 'Polygon'] },
      { name: 'address', label: 'Wallet address', kind: 'crypto', required: true },
    ],
    qr: (d) => d.address || null,
    warning: cryptoWarning('ETH'),
  },
  zelle: {
    type: 'zelle', label: 'Zelle', iconKey: 'zelle', group: 'wallet',
    fields: [
      { name: 'email', label: 'Zelle email', kind: 'email' },
      { name: 'phone', label: 'Zelle phone (US)', kind: 'phone', placeholder: '+1 555 010 0000' },
      NAME('Recipient name'),
    ],
    requireOneOf: [['email', 'phone']],
  },
  cashapp: {
    type: 'cashapp', label: 'Cash App', iconKey: 'cashapp', group: 'wallet',
    fields: [{ name: 'cashtag', label: '$Cashtag', kind: 'cashtag', required: true, placeholder: '$NavoraPay' }, NAME('Name', false)],
    link: (d) => (d.cashtag ? { label: 'Open Cash App', url: `https://cash.app/${d.cashtag}` } : null),
  },
  venmo: {
    type: 'venmo', label: 'Venmo', iconKey: 'venmo', group: 'wallet',
    fields: [{ name: 'username', label: 'Venmo username', kind: 'handle', required: true, placeholder: '@navora-pay' }, NAME('Name', false)],
    link: (d) => (d.username ? { label: 'Open Venmo', url: `https://venmo.com/u/${d.username.replace(/^@/, '')}` } : null),
  },
  applepay: {
    type: 'applepay', label: 'Apple Pay / Apple Cash', iconKey: 'applepay', group: 'wallet',
    fields: [{ name: 'phone', label: 'Phone', kind: 'phone' }, { name: 'email', label: 'Email', kind: 'email' }, NAME('Name')],
    requireOneOf: [['phone', 'email']],
  },
  googlepay: {
    type: 'googlepay', label: 'Google Pay', iconKey: 'googlepay', group: 'wallet',
    fields: [{ name: 'phone', label: 'Phone', kind: 'phone' }, { name: 'email', label: 'Email', kind: 'email' }, NAME('Name')],
    requireOneOf: [['phone', 'email']],
  },
  us_bank: {
    type: 'us_bank', label: 'US bank transfer (ACH / wire)', iconKey: 'landmark', group: 'bank',
    fields: [
      NAME('Account name'),
      { name: 'bankName', label: 'Bank', kind: 'text', required: true },
      { name: 'routingNumber', label: 'Routing number', kind: 'routing', required: true },
      { name: 'accountNumber', label: 'Account number', kind: 'accountNumber', required: true, digits: [4, 17] },
      { name: 'accountType', label: 'Account type', kind: 'text', required: true, options: ['Checking', 'Savings'] },
      { name: 'bankAddress', label: 'Bank address', kind: 'text' },
    ],
  },
  uk_bank: {
    type: 'uk_bank', label: 'UK bank transfer (Faster Payments)', iconKey: 'landmark', group: 'bank',
    fields: [
      NAME('Account name'),
      { name: 'bankName', label: 'Bank', kind: 'text', required: true },
      { name: 'sortCode', label: 'Sort code', kind: 'sortCode', required: true, placeholder: '12-34-56' },
      { name: 'accountNumber', label: 'Account number', kind: 'accountNumber', required: true, digits: [8, 8] },
    ],
  },
  intl_wire: {
    type: 'intl_wire', label: 'International wire (SWIFT / IBAN)', iconKey: 'globe', group: 'bank',
    fields: [
      { name: 'beneficiary', label: 'Beneficiary', kind: 'text', required: true },
      { name: 'bankName', label: 'Bank', kind: 'text', required: true },
      { name: 'iban', label: 'IBAN', kind: 'iban' },
      { name: 'accountNumber', label: 'Account number', kind: 'accountNumber', digits: [4, 34] },
      { name: 'swift', label: 'SWIFT/BIC', kind: 'swift', required: true },
      { name: 'bankAddress', label: 'Bank address', kind: 'text' },
      { name: 'country', label: 'Bank country', kind: 'text', required: true },
    ],
    requireOneOf: [['iban', 'accountNumber']],
  },
  wise: {
    type: 'wise', label: 'Wise', iconKey: 'wise', group: 'wallet',
    fields: [{ name: 'email', label: 'Wise email', kind: 'email' }, { name: 'wisetag', label: 'Wisetag', kind: 'handle', placeholder: '@navora' }, NAME('Name')],
    requireOneOf: [['email', 'wisetag']],
  },
  revolut: {
    type: 'revolut', label: 'Revolut', iconKey: 'revolut', group: 'wallet',
    fields: [{ name: 'revtag', label: 'Revtag', kind: 'handle', placeholder: '@navora' }, { name: 'phone', label: 'Phone', kind: 'phone' }, NAME('Name')],
    requireOneOf: [['revtag', 'phone']],
  },
  card_link: {
    type: 'card_link', label: 'Card payment link', iconKey: 'credit-card', group: 'wallet',
    fields: [
      { name: 'url', label: 'Checkout link', kind: 'url', required: true, placeholder: 'https://checkout.stripe.com/…', copyable: false },
      { name: 'provider', label: 'Provider (e.g. Stripe, Square)', kind: 'text', copyable: false },
    ],
    link: (d) => (d.url ? { label: 'Pay by card', url: d.url } : null),
    qr: (d) => d.url || null,
  },
  western_union: {
    type: 'western_union', label: 'Western Union', iconKey: 'westernunion', group: 'cash',
    fields: [
      { name: 'receiverName', label: 'Receiver full name', kind: 'text', required: true },
      { name: 'country', label: 'Country', kind: 'text', required: true },
      { name: 'city', label: 'City', kind: 'text', required: true },
    ],
    note: 'After sending, enter the MTCN (money transfer control number) as your payment reference.',
  },
  moneygram: {
    type: 'moneygram', label: 'MoneyGram', iconKey: 'moneygram', group: 'cash',
    fields: [
      { name: 'receiverName', label: 'Receiver full name', kind: 'text', required: true },
      { name: 'country', label: 'Country', kind: 'text', required: true },
      { name: 'city', label: 'City', kind: 'text', required: true },
    ],
    note: 'After sending, enter the MoneyGram reference number as your payment reference.',
  },
};

export function isPaymentMethodType(value: unknown): value is PaymentMethodType {
  return typeof value === 'string' && (PAYMENT_METHOD_TYPES as readonly string[]).includes(value);
}

const MAX_TEXT = 200;

function validateField(field: PaymentField, raw: string, def: PaymentMethodDefinition, details: Details): ValidationResult {
  switch (field.kind) {
    case 'email': return validateEmail(raw);
    case 'phone': return validatePhone(raw);
    case 'iban': return validateIban(raw);
    case 'sortCode': return validateSortCode(raw);
    case 'routing': return validateRoutingNumber(raw);
    case 'swift': return validateSwift(raw);
    case 'cashtag': return validateCashtag(raw);
    case 'handle': return validateHandle(raw);
    case 'accountNumber': return validateDigits(raw, field.digits?.[0] ?? 4, field.digits?.[1] ?? 34, field.label.toLowerCase());
    case 'crypto': return validateCryptoAddress(raw, def.coin ?? 'BTC', details.network);
    case 'url': {
      const res = validateHttpsUrl(raw);
      if (!res.ok || !field.hosts) return res;
      const host = new URL(res.value).hostname.toLowerCase();
      return field.hosts.some((h) => host === h || host.endsWith(`.${h}`))
        ? res
        : { ok: false, error: `The link must be on ${field.hosts.join(' or ')}.` };
    }
    default: {
      const value = raw.trim().replace(/\s+/g, ' ');
      if (value.length > MAX_TEXT) return { ok: false, error: `Keep this under ${MAX_TEXT} characters.` };
      if (field.options && !field.options.includes(value)) return { ok: false, error: `Choose one of: ${field.options.join(', ')}.` };
      return { ok: true, value };
    }
  }
}

export type DetailsValidation =
  | { ok: true; details: Details }
  | { ok: false; errors: Record<string, string> };

/**
 * Checks and normalises an account's details for its type. Unknown keys are dropped, empty
 * optional fields are left out, and every error is keyed by field name ('_form' for
 * either/or rules), so the admin form can show it next to the right input.
 */
export function validatePaymentDetails(type: PaymentMethodType, input: unknown): DetailsValidation {
  const def = PAYMENT_METHODS[type];
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const raw: Details = {};
  for (const field of def.fields) {
    const v = source[field.name];
    if (typeof v === 'string' && v.trim()) raw[field.name] = v;
    else if (field.options && field.required && (v === undefined || v === '')) raw[field.name] = field.options[0];
  }

  const errors: Record<string, string> = {};
  const details: Details = {};
  for (const field of def.fields) {
    const value = raw[field.name];
    if (value === undefined) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }
    const res = validateField(field, value, def, raw);
    if (res.ok) details[field.name] = res.value;
    else errors[field.name] = res.error;
  }
  for (const group of def.requireOneOf ?? []) {
    if (!group.some((name) => raw[name] !== undefined)) {
      const labels = group.map((name) => def.fields.find((f) => f.name === name)?.label ?? name);
      errors._form = `Fill in at least one of: ${labels.join(' or ')}.`;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, details };
}

export interface CustomerMethodView {
  type: PaymentMethodType;
  label: string;
  iconKey: string;
  fields: { label: string; value: string; copyable: boolean }[];
  link: { label: string; url: string } | null;
  qr: string | null;
  warning: string | null;
  note: string | null;
}

/** What the customer sees for one account (track page card and the admin live preview). */
export function customerMethodView(type: PaymentMethodType, details: Details, labelOverride?: string | null): CustomerMethodView {
  const def = PAYMENT_METHODS[type];
  return {
    type,
    label: labelOverride?.trim() || def.label,
    iconKey: def.iconKey,
    fields: def.fields
      .filter((f) => details[f.name] && f.copyable !== false)
      .map((f) => ({ label: f.label, value: details[f.name], copyable: true })),
    link: def.link?.(details) ?? null,
    qr: def.qr?.(details) ?? null,
    warning: def.warning?.(details) ?? null,
    note: def.note ?? null,
  };
}
