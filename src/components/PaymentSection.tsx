import React, { useEffect, useRef, useState } from 'react';
import type { PaymentStatus, PublicPayment } from '../shared/paymentRequest';
import { formatPaymentAmount } from '../shared/paymentRequest';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { PaymentMethodCard } from './PaymentMethodCard';
import { PaymentProofForm } from './PaymentProofForm';
import './PaymentSection.css';

interface PaymentSectionProps {
  trackingNumber: string;
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

function formatPaidDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
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
export const PaymentSection: React.FC<PaymentSectionProps> = ({ trackingNumber, payment }) => {
  // Set when this visitor's proof was accepted; the request counts as under review until the
  // next track refresh brings the server's own status.
  const [sentAt, setSentAt] = useState<string | null>(null);
  const status: PaymentStatus = sentAt && payment.status === 'AWAITING_PAYMENT' ? 'UNDER_REVIEW' : payment.status;
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.AWAITING_PAYMENT;
  const narrow = useIsNarrow();
  const [openId, setOpenId] = useState<string | null>(payment.methods[0]?.id ?? null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // Once paid, the accounts are collapsed behind a toggle (E.4).
  const isPaid = payment.status === 'PAID';
  const [showPaidMethods, setShowPaidMethods] = useState(false);

  const showToast = (message: string) => {
    // Clear first so the same message is announced again on a second copy.
    setToast('');
    window.clearTimeout(toastTimer.current);
    requestAnimationFrame(() => setToast(message));
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  };

  // A cancelled request is not shown to the customer (the track page doesn't render this either).
  if (payment.status === 'CANCELLED') return null;

  const paidDate = formatPaidDate(payment.paidAt);
  const methodsVisible = !isPaid || showPaidMethods;

  return (
    <section className="ngf-pay-section" aria-labelledby="track-payment-title">
      <div className="ngf-pay-summary">
        <div className="ngf-pay-summary-head">
          <h3 id="track-payment-title" className="card-section-title ngf-pay-title">Payment</h3>
          <span className={`ngf-pay-badge is-${badge.tone}`}>{badge.label}</span>
        </div>

        {status === 'AWAITING_PAYMENT' && (
          <p className="ngf-pay-intro">
            A payment is due for this shipment. Pay using any one of the accounts below, then send us your proof of payment.
          </p>
        )}

        {isPaid && (
          <div className="ngf-pay-received">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>Payment received</strong>
              <p>{paidDate ? `Thank you. We received your payment on ${paidDate}.` : 'Thank you. We have received your payment.'}</p>
            </div>
          </div>
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
          {isPaid && (
            <button
              type="button"
              className={`ngf-pay-methods-toggle${showPaidMethods ? ' is-open' : ''}`}
              aria-expanded={showPaidMethods}
              aria-controls="track-payment-methods"
              onClick={() => setShowPaidMethods((v) => !v)}
            >
              <span>{showPaidMethods ? 'Hide payment accounts' : 'Show payment accounts'}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          <div id="track-payment-methods" hidden={!methodsVisible}>
            {!isPaid && (
              <>
                <h4 className="ngf-pay-methods-title">How to pay</h4>
                <p className="ngf-pay-methods-sub">Choose one account. You only need to pay once.</p>
              </>
            )}
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
        </div>
      )}

      {sentAt && (
        <p className="ngf-proof-sent" role="status">
          Thank you. Your proof of payment was sent. We'll check it and update this page.
        </p>
      )}

      {status === 'AWAITING_PAYMENT' && payment.methods.length > 0 && (
        <PaymentProofForm trackingNumber={trackingNumber} payment={payment} onSent={setSentAt} />
      )}

      <div className={`ngf-pay-toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
};
