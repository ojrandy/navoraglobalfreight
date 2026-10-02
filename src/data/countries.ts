// Countries for address forms (tracker 2.6): ISO code, English name and calling code, from
// libphonenumber-js metadata and the browser's Intl.DisplayNames.

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "NG" */
  code: string;
  name: string;
  /** e.g. "+234" */
  dialCode: string;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({ code, name: regionNames?.of(code) || code, dialCode: `+${getCountryCallingCode(code)}` }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

// Main country for calling codes shared by several countries (e.g. +44: UK, Guernsey, Jersey).
const MAIN_FOR_DIAL_CODE: Record<string, string> = {
  '+1': 'US', '+7': 'RU', '+44': 'GB', '+47': 'NO', '+61': 'AU', '+39': 'IT', '+358': 'FI',
  '+212': 'MA', '+262': 'RE', '+590': 'GP', '+599': 'CW', '+290': 'SH',
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const ALIASES: Record<string, string> = {
  usa: 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  uae: 'AE', holland: 'NL', 'ivory coast': 'CI', 'hong kong sar': 'HK',
};

export function getCountry(code: string | null | undefined): Country | undefined {
  const upper = (code || '').trim().toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

/** A country from its ISO code, its English name or a common alias ("UK", "USA"). */
export function findCountry(value: string | null | undefined): Country | undefined {
  const v = fold(value || '');
  if (!v) return undefined;
  if (v.length === 2) {
    const byCode = getCountry(v);
    if (byCode) return byCode;
  }
  return getCountry(ALIASES[v]) || COUNTRIES.find((c) => fold(c.name) === v);
}

/** Countries whose name, code or calling code matches the search text, best matches first. */
export function searchCountries(query: string): Country[] {
  const q = fold(query);
  if (!q) return COUNTRIES;
  const alias = ALIASES[q];
  const scored = COUNTRIES.map((c) => {
    const name = fold(c.name);
    const score = c.code === alias ? 0
      : name.startsWith(q) ? 1
      : c.code.toLowerCase() === q ? 1
      : name.split(/[\s-]+/).some((w) => w.startsWith(q)) ? 2
      : (c.dialCode === q || c.dialCode === `+${q}`) && MAIN_FOR_DIAL_CODE[c.dialCode] === c.code ? 2
      : name.includes(q) || c.dialCode === q || c.dialCode === `+${q}` ? 3
      : -1;
    return { c, score };
  }).filter((x) => x.score >= 0);
  return scored.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name)).map((x) => x.c);
}

// Field labels that fit the country. State/region and postcode are optional everywhere.
export const regionLabel = (code: string) => (code === 'US' ? 'State' : code === 'CA' ? 'Province' : 'State/Region');
export const postcodeLabel = (code: string) => (code === 'US' ? 'ZIP code' : code === 'CA' ? 'Postal code' : 'Postcode');

/**
 * The short region stored next to the city on a shipment ("Houston, TX", "Lagos, NG"): the state
 * code for U.S. addresses, otherwise the ISO country code. The full region, postcode and country
 * are kept on the sender/recipient/quote address itself.
 */
export function shortRegion(countryCode: string, region: string): string {
  const code = (countryCode || '').toUpperCase();
  if (code === 'US') return (region || '').trim().toUpperCase().slice(0, 2);
  return code;
}

/** "+234 803 123 4567" from a country and a national number; '' when the number is empty. */
export function formatPhoneNumber(countryCode: string, national: string): string {
  const digits = (national || '').trim();
  if (!digits) return '';
  if (digits.startsWith('+')) return parsePhoneNumberFromString(digits)?.formatInternational() || digits;
  const parsed = parsePhoneNumberFromString(digits, (countryCode || 'US').toUpperCase() as CountryCode);
  if (parsed) return parsed.formatInternational();
  const country = getCountry(countryCode);
  return country ? `${country.dialCode} ${digits}` : digits;
}

/** Whether a phone number looks valid for its country (used for a soft warning, never to block). */
export function isPlausiblePhone(countryCode: string, national: string): boolean {
  const digits = (national || '').trim();
  if (!digits) return true;
  const parsed = digits.startsWith('+')
    ? parsePhoneNumberFromString(digits)
    : parsePhoneNumberFromString(digits, (countryCode || 'US').toUpperCase() as CountryCode);
  return Boolean(parsed?.isPossible());
}
