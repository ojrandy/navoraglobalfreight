import React, { useEffect, useId, useRef, useState } from 'react';
import type { PaymentStatus, PublicPayment } from '../shared/paymentRequest';
import { formatPaymentAmount } from '../shared/paymentRequest';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Upload, Wallet } from 'lucide-react';
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

/** "Oct 10, 2026" and "3:04 PM" in the visitor's own locale and time zone. */
function formatSubmitted(value: string): { date: string; time: string } | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d),
  };
}

interface PaymentTabProps {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Full-width tab that opens its panel underneath (update I.2, I.3). Closed until the customer opens it. */
const PaymentTab: React.FC<PaymentTabProps> = ({ icon, title, sub, open, onToggle, children }) => {
  const panelId = useId();
  return (
    <div className={`ngf-pay-tab${open ? ' is-open' : ''}`}>
      <button type="button" className="ngf-pay-tab-btn" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="ngf-pay-tab-icon" aria-hidden="true">{icon}</span>
        <span className="ngf-pay-tab-text">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </span>
        <ChevronDown size={18} className="ngf-pay-tab-chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="ngf-pay-tab-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
};

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
  // The accounts and the proof form each sit behind a tab, closed until opened (I.2, I.3).
  const [showMethods, setShowMethods] = useState(false);
  const [showProofForm, setShowProofForm] = useState(false);

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
  // Proof states from the server (F.4); this visitor's own just-sent proof shows the thank-you line instead.
  const latest = payment.proof;
  const underReview = !sentAt && status === 'UNDER_REVIEW';
  const submitted = underReview && latest?.status === 'SUBMITTED' ? formatSubmitted(latest.submittedAt) : null;
  const rejected = !sentAt && status === 'AWAITING_PAYMENT' && latest?.status === 'REJECTED' ? latest : null;
  const count = payment.methods.length;

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

      {count > 0 && (
        <div className="ngf-pay-methods">
          <PaymentTab
            icon={<Wallet size={18} />}
            title={isPaid ? (showMethods ? 'Hide payment accounts' : 'Show payment accounts') : 'How to pay'}
            sub={isPaid ? undefined : count === 1 ? '1 payment option' : `Choose one of ${count} payment options`}
            open={showMethods}
            onToggle={() => setShowMethods((v) => !v)}
          >
            {!isPaid && <p className="ngf-pay-methods-sub">Choose one account. You only need to pay once.</p>}
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
          </PaymentTab>
        </div>
      )}

      {underReview && (
        <div className="ngf-proof-state is-review">
          <Clock size={18} aria-hidden="true" />
          <div>
            <strong>Proof under review</strong>
            {submitted && <p>We received your proof on {submitted.date} at {submitted.time}. Our team will check it and update this page.</p>}
          </div>
        </div>
      )}

      {rejected && (
        <div className="ngf-proof-state is-rejected">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Proof not accepted{rejected.rejectionReason ? `: ${rejected.rejectionReason}` : ''}</strong>
            <p>Please check the details and send a new proof below.</p>
          </div>
        </div>
      )}

      {sentAt && (
        <p className="ngf-proof-sent" role="status">
          Thank you. Your proof of payment was sent. We'll check it and update this page.
        </p>
      )}

      {status === 'AWAITING_PAYMENT' && count > 0 && (
        <div className="ngf-pay-proof">
          <PaymentTab
            icon={<Upload size={18} />}
            title="Send proof of payment"
            sub="Already paid? Upload your receipt so we can confirm it."
            open={showProofForm}
            onToggle={() => setShowProofForm((v) => !v)}
          >
            <PaymentProofForm trackingNumber={trackingNumber} payment={payment} onSent={setSentAt} embedded />
          </PaymentTab>
        </div>
      )}

      <div className={`ngf-pay-toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
};
