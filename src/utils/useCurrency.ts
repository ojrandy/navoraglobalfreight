import { useMemo } from 'react';
import { useAdminData } from '../context/AdminDataContext';
import { formatMoney, fromDisplayAmount, resolveCurrency, toDisplayAmount, currencySymbol, type ResolvedCurrency } from '../shared/currency';

// The display currency chosen in admin Settings, with helpers to show USD amounts in it.
export function useCurrency() {
  const { settings } = useAdminData();
  const resolved: ResolvedCurrency = useMemo(
    () => resolveCurrency(settings as any),
    [(settings as any)?.displayCurrency, JSON.stringify((settings as any)?.exchangeRates || {})]
  );
  return useMemo(() => ({
    ...resolved,
    symbol: currencySymbol(resolved.currency),
    /** USD amount -> "₦525,000.00" */
    format: (usd: unknown, decimals = 2) => formatMoney(usd, resolved, { decimals }),
    toDisplay: (usd: number) => toDisplayAmount(usd, resolved),
    fromDisplay: (value: number) => fromDisplayAmount(value, resolved),
  }), [resolved]);
}
