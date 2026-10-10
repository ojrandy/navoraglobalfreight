// Validators for payment-method account details (docs/update.md C.1). Shared by the browser and
// the server. Each returns the value normalised for storage, or an error message for the admin.
// These are format checks: they catch typos, not whether an account actually exists.

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

const ok = (value: string): ValidationResult => ({ ok: true, value });
const fail = (error: string): ValidationResult => ({ ok: false, error });

export function validateEmail(input: string): ValidationResult {
  const value = input.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254
    ? ok(value)
    : fail('Enter a valid email address, e.g. payments@example.com.');
}

/** Only https links: a payment page served over plain http is not acceptable. */
export function validateHttpsUrl(input: string): ValidationResult {
  const value = input.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) throw new Error();
    return ok(url.toString());
  } catch {
    return fail('Enter a full secure link starting with https://.');
  }
}

/** International format: optional +, then 7 to 15 digits. Spaces, dashes, dots and brackets are removed. */
export function validatePhone(input: string): ValidationResult {
  const compact = input.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(compact)
    ? ok(compact)
    : fail('Enter a phone number with its country code, e.g. +1 555 010 0000.');
}

/** IBAN: country code, check digits, then up to 30 letters/digits, verified with the mod-97 check. */
export function validateIban(input: string): ValidationResult {
  const value = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) {
    return fail('Enter a valid IBAN, e.g. GB82 WEST 1234 5698 7654 32.');
  }
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1 ? ok(value) : fail('This IBAN fails its check digits. Check it for typos.');
}

/** UK sort code, stored as NN-NN-NN. */
export function validateSortCode(input: string): ValidationResult {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits)
    ? ok(`${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`)
    : fail('Enter a 6-digit sort code, e.g. 12-34-56.');
}

/** US ABA routing number: 9 digits with the 3-7-1 weighted checksum. */
export function validateRoutingNumber(input: string): ValidationResult {
  const digits = input.replace(/\s/g, '');
  if (!/^\d{9}$/.test(digits)) return fail('Enter the 9-digit routing number.');
  const d = digits.split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0 ? ok(digits) : fail('This routing number fails its checksum. Check it for typos.');
}

/** SWIFT/BIC: 8 or 11 characters. */
export function validateSwift(input: string): ValidationResult {
  const value = input.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value)
    ? ok(value)
    : fail('Enter an 8- or 11-character SWIFT/BIC code, e.g. NWBKGB2L.');
}

export type CryptoCoin = 'BTC' | 'USDT' | 'ETH';

const BASE58 = '[1-9A-HJ-NP-Za-km-z]';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Basic address format for the coin and network (not a checksum or on-chain check).
 * The network names match the options in src/shared/paymentMethods.ts.
 */
export function validateCryptoAddress(input: string, coin: CryptoCoin, network = ''): ValidationResult {
  const value = input.trim();
  const net = network.toLowerCase();
  let valid = false;
  if (coin === 'BTC') {
    valid = net.startsWith('lightning')
      // Lightning address (name@domain), LNURL or a BOLT11 invoice.
      ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || /^(lnurl|lnbc)[0-9a-z]+$/i.test(value)
      : new RegExp(`^(bc1[02-9ac-hj-np-z]{11,71}|[13]${BASE58}{25,34})$`).test(value);
  } else if (coin === 'USDT' && net.startsWith('trc20')) {
    valid = new RegExp(`^T${BASE58}{33}$`).test(value);
  } else if (coin === 'USDT' && net.startsWith('solana')) {
    valid = new RegExp(`^${BASE58}{32,44}$`).test(value);
  } else {
    // ETH and EVM networks for USDT (ERC20, BEP20, Polygon, Arbitrum, ...).
    valid = EVM_ADDRESS.test(value);
  }
  return valid ? ok(value) : fail(`This doesn’t look like a ${coin}${network ? ` (${network})` : ''} address. Check it and the network.`);
}

/** $Cashtag: 1 to 20 letters/digits/underscores, with at least one letter. Stored with the $. */
export function validateCashtag(input: string): ValidationResult {
  const tag = input.trim().replace(/^\$/, '');
  return /^(?=.*[A-Za-z])[A-Za-z0-9_]{1,20}$/.test(tag) ? ok(`$${tag}`) : fail('Enter a $Cashtag, e.g. $NavoraPay.');
}

/** @handle (Venmo username, Wisetag, Revtag): letters, digits, - and _, stored with the @. */
export function validateHandle(input: string): ValidationResult {
  const handle = input.trim().replace(/^@/, '');
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(handle) ? ok(`@${handle}`) : fail('Enter a username, e.g. @navora-pay.');
}

/** Account numbers: digits only, within the given length range. */
export function validateDigits(input: string, min: number, max: number, label: string): ValidationResult {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits) || digits.length < min || digits.length > max) {
    return fail(min === max ? `Enter the ${min}-digit ${label}.` : `Enter the ${label} (${min} to ${max} digits).`);
  }
  return ok(digits);
}
