import React, { useEffect, useRef, useState } from 'react';
import type { PaymentStatus, PublicPayment } from '../shared/paymentRequest';
import { formatPaymentAmount } from '../shared/paymentRequest';
import { PaymentMethodCard } from './PaymentMethodCard';
import './PaymentSection.css';

interface PaymentSectionProps {
  payment: PublicPayment;
}

// Status badge text (CONTENT.md §6.8) and tone.
const STATUS_BADGES: Record<PaymentStatus, { label: string; tone: string }> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'awaiting' },
  UNDER_REVIEW: { label: 'Proof under review', tone: 'review' },
  PAID: { label: 'Paid', tone: 'paid' },
  CANCELLED: { label: 'Cancelled', tone: 'cancelled' },
};

/** Due dates are stored as YYYY-MM-DD; read them as calendar dates so no time zone shifts the day. */
function formatDueDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}

// Below this width the accounts are an accordion (one open at a time); above it, a grid.
const NARROW_QUERY = '(max-width: 767px)';
const TOAST_MS = 2000;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

/**
 * Track Result "Payment" section (CONTENT.md §6.8): what is due, what it is for, its status,
 * and this shipment's payment accounts with copy buttons and QR codes.
 */
export const PaymentSection: React.FC<PaymentSectionProps> = ({ payment }) => {
  const badge = STATUS_BADGES[payment.status] ?? STATUS_BADGES.AWAITING_PAYMENT;
  const narrow = useIsNarrow();
  const [openId, setOpenId] = useState<string | null>(payment.methods[0]?.id ?? null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (message: string) => {
    // Clear first so the same message is announced again on a second copy.
    setToast('');
    window.clearTimeout(toastTimer.current);
    requestAnimationFrame(() => setToast(message));
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  };

  return (
    <section className="ngf-pay-section" aria-labelledby="track-payment-title">
      <div className="ngf-pay-summary">
        <div className="ngf-pay-summary-head">
          <h3 id="track-payment-title" className="card-section-title ngf-pay-title">Payment</h3>
          <span className={`ngf-pay-badge is-${badge.tone}`}>{badge.label}</span>
        </div>

        {payment.status === 'AWAITING_PAYMENT' && (
          <p className="ngf-pay-intro">
            A payment is due for this shipment. Pay using any one of the accounts below, then send us your proof of payment.
          </p>
        )}

        <dl className="ngf-pay-facts">
          <div className="ngf-pay-fact ngf-pay-fact-amount">
            <dt>Amount due</dt>
            <dd className="ngf-pay-amount">{formatPaymentAmount(payment.amount, payment.currency)}</dd>
          </div>
          <div className="ngf-pay-fact">
            <dt>For</dt>
            <dd>{payment.chargeReason}</dd>
          </div>
          {payment.dueDate && (
            <div className="ngf-pay-fact">
              <dt>Due by</dt>
              <dd>{formatDueDate(payment.dueDate)}</dd>
            </div>
          )}
        </dl>

        {payment.customerNote && (
          <div className="ngf-pay-note">
            <strong>Note from our team</strong>
            <p>{payment.customerNote}</p>
          </div>
        )}
      </div>

      {payment.methods.length > 0 && (
        <div className="ngf-pay-methods">
          <h4 className="ngf-pay-methods-title">How to pay</h4>
          <p className="ngf-pay-methods-sub">Choose one account. You only need to pay once.</p>
          <ul className={`ngf-pay-methods-list${narrow ? ' is-accordion' : ''}`}>
            {payment.methods.map((method) => (
              <li key={method.id}>
                <PaymentMethodCard
                  view={method}
                  instructions={method.instructions}
                  collapsible={narrow}
                  expanded={openId === method.id}
                  onToggle={() => setOpenId((current) => (current === method.id ? null : method.id))}
                  onCopyMessage={showToast}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`ngf-pay-toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
};
