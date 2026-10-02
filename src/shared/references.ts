// Non-tracking reference numbers (BRAND_GUIDE §7): a prefix plus 6 digits, e.g. SDL-SL-892401.
// They aren't tracking IDs, so they're not bound by the 8-character rule. Shared by the browser
// and the server.

export const REFERENCE_PREFIXES = {
  seal: 'SDL-SL-',
  ticket: 'SDL-TKT-',
  invoice: 'SDL-INV-',
} as const;

export type ReferenceKind = keyof typeof REFERENCE_PREFIXES;

export const REFERENCE_PATTERN = /^SDL-(SL|TKT|INV)-\d{6}$/;

// 6 random digits (leading zeros allowed, as in SDL-INV-004091). Rejection sampling keeps
// every value equally likely.
export function generateReference(kind: ReferenceKind): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  let n: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return REFERENCE_PREFIXES[kind] + String(n % 1_000_000).padStart(6, '0');
}

// A stable reference for a record that has no stored one (e.g. an invoice's authorisation
// ref derived from its document ID), so the same record always shows the same number.
export function referenceFor(kind: ReferenceKind, seed: string): string {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return REFERENCE_PREFIXES[kind] + String(h % 1_000_000).padStart(6, '0');
}
