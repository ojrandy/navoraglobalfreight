// Money display (tracker 2.7). Shared by the browser and the server.
//
// Amounts are stored in USD — every existing record is. The admin picks a display currency in
// Settings (USD, NGN, GBP or EUR) and enters its exchange rate; prices are converted for
// display and admin price inputs are converted back to USD. A non-USD currency without a valid
// rate keeps showing USD, so a $350 quote can never appear as ₦350.

export const DISPLAY_CURRENCIES = ['USD', 'NGN', 'GBP', 'EUR'] as const;
export type DisplayCurrency = typeof DISPLAY_CURRENCIES[number];

export const CURRENCY_NAMES: Record<DisplayCurrency, string> = {
  USD: 'US dollar',
  NGN: 'Nigerian naira',
  GBP: 'British pound',
  EUR: 'Euro',
};

export interface CurrencySettings {
  displayCurrency?: string;
  /** Units of each currency per 1 USD, e.g. { NGN: 1500 }. Entered by the admin. */
  exchangeRates?: Partial<Record<string, number>>;
}

export interface ResolvedCurrency {
  currency: DisplayCurrency;
  /** Display units per 1 USD (1 for USD). */
  rate: number;
  /** True when a non-USD currency was chosen but has no usable rate, so USD is shown instead. */
  missingRate: boolean;
}

export function resolveCurrency(settings: CurrencySettings | null | undefined): ResolvedCurrency {
  const chosen = (DISPLAY_CURRENCIES as readonly string[]).includes(settings?.displayCurrency || '')
    ? (settings!.displayCurrency as DisplayCurrency)
    : 'USD';
  if (chosen === 'USD') return { currency: 'USD', rate: 1, missingRate: false };
  const rate = Number(settings?.exchangeRates?.[chosen]);
  if (!Number.isFinite(rate) || rate <= 0) return { currency: 'USD', rate: 1, missingRate: true };
  return { currency: chosen, rate, missingRate: false };
}

/** Formats a USD amount in the display currency, e.g. "₦525,000.00" or "$350.00". */
export function formatMoney(usdAmount: unknown, resolved: ResolvedCurrency, options: { decimals?: number } = {}): string {
  const n = typeof usdAmount === 'string' ? parseFloat(usdAmount) : typeof usdAmount === 'number' ? usdAmount : NaN;
  const amount = Number.isFinite(n) ? n * resolved.rate : 0;
  const decimals = options.decimals ?? 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: resolved.currency,
    // "₦525,000.00" rather than "NGN 525,000.00"
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export const toDisplayAmount = (usd: number, resolved: ResolvedCurrency) => usd * resolved.rate;
export const fromDisplayAmount = (value: number, resolved: ResolvedCurrency) => Math.round((value / resolved.rate) * 10000) / 10000;

/** The currency's symbol on its own (e.g. "₦"), for input adornments and labels. */
export function currencySymbol(currency: DisplayCurrency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value || currency;
}
