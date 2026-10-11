import React from 'react';
import type { AdminPaymentProof } from '../../shared/paymentProof';
import { formatPaymentAmount } from '../../shared/paymentRequest';
import { customerMethodView, isPaymentMethodType } from '../../shared/paymentMethods';
import { PaymentIcon } from '../../components/PaymentIcon';
import './ProofFacts.css';

/** The account the customer says they used, as it was when they sent the proof. */
export function proofMethodView(proof: AdminPaymentProof) {
  const m = proof.method;
  if (!m || !isPaymentMethodType(m.type)) return null;
  return customerMethodView(m.type, m.details, m.label);
}

/** True when the amount the customer sent differs from the amount due. */
export function proofAmountMismatch(p: AdminPaymentProof): boolean {
  return Boolean(p.payment && p.amountSent !== null && Math.abs(p.amountSent - p.payment.amount) >= 0.005);
}

export const formatProofReceived = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Details of a proof of payment (amount due vs sent, account, payer, reference, reason).
 * Shared by the Payments page (F.5) and the dashboard's "New payment proofs" panel (G.2).
 */
export const ProofFacts: React.FC<{ proof: AdminPaymentProof }> = ({ proof: p }) => {
  const method = proofMethodView(p);
  const mismatch = proofAmountMismatch(p);
  return (
    <dl className="proof-facts">
      <div>
        <dt>Amount due</dt>
        <dd>{p.payment ? formatPaymentAmount(p.payment.amount, p.payment.currency) : '—'}</dd>
      </div>
      <div>
        <dt>Amount sent</dt>
        <dd className={mismatch ? 'proof-mismatch' : undefined}>
          {p.amountSent !== null ? formatPaymentAmount(p.amountSent, p.payment?.currency ?? 'USD') : '—'}
          {mismatch && <small> Differs from the amount due</small>}
        </dd>
      </div>
      <div>
        <dt>Paid to</dt>
        <dd className="proof-method">
          {method ? <><PaymentIcon type={method.type} size={16} /><span>{method.label}</span></> : '—'}
        </dd>
      </div>
      <div>
        <dt>Payer</dt>
        <dd>{p.payerName}</dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd className="font-mono">{p.reference || '—'}</dd>
      </div>
      <div className="proof-fact-wide">
        <dt>For</dt>
        <dd>{p.payment?.chargeReason || '—'}</dd>
      </div>
    </dl>
  );
};
