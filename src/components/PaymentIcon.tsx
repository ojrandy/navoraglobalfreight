import React from 'react';
import { CreditCard, Globe, Landmark, Wallet } from 'lucide-react';
import { PAYMENT_METHODS, isPaymentMethodType } from '../shared/paymentMethods';
import { PAYMENT_ICON_PATHS } from '../assets/payment-icons';

// Brand marks from Simple Icons 16.34.0 (CC0), bundled locally in src/assets/payment-icons/ as SVGs
// plus a generated path module (scripts/payment-icons.mjs); sources and brand guidelines are in
// docs/update.md (C.2). Drawn from path data only: no remote requests, no raw HTML.
const ICON_PATHS = PAYMENT_ICON_PATHS;

// Simple Icons brand colours, except where that colour is too light to read on white:
// Wise uses its Forest Green, Western Union black.
const ICON_COLORS: Record<string, string> = {
  paypal: '#002991', bitcoin: '#F7931A', tether: '#50AF95', ethereum: '#3C3C3D', zelle: '#6D1ED4',
  cashapp: '#00C244', venmo: '#008CFF', applepay: '#000000', googlepay: '#4285F4', wise: '#163300',
  revolut: '#191C1F', stripe: '#635BFF', westernunion: '#1A1A1A', moneygram: '#DA291C',
};

const FALLBACKS: Record<string, typeof Wallet> = {
  landmark: Landmark,
  globe: Globe,
  'credit-card': CreditCard,
};

interface PaymentIconProps {
  /** A payment method type (e.g. 'paypal'); unknown types get the Wallet icon. */
  type: string;
  size?: number;
  className?: string;
}

/** Decorative icon for a payment method. Always show the method's name as text next to it. */
export const PaymentIcon: React.FC<PaymentIconProps> = ({ type, size = 24, className }) => {
  const iconKey = isPaymentMethodType(type) ? PAYMENT_METHODS[type].iconKey : '';
  const path = ICON_PATHS[iconKey];
  if (path) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d={path} fill={ICON_COLORS[iconKey] ?? 'currentColor'} />
      </svg>
    );
  }
  const Fallback = FALLBACKS[iconKey] ?? Wallet;
  return (
    <span className={className} style={{ display: 'inline-flex', color: 'var(--ngf-slate-700)' }}>
      <Fallback size={size} aria-hidden="true" />
    </span>
  );
};
