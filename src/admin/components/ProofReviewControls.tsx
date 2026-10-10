import React, { useId, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { PROOF_LIMITS, type AdminPaymentProof } from '../../shared/paymentProof';
import './ProofReviewControls.css';

interface ProofReviewControlsProps {
  proof: AdminPaymentProof;
  onReviewed: (updated: AdminPaymentProof) => void;
}

/**
 * Approve / Reject for a submitted proof (docs/update.md F.6). Approving marks the request and its
 * linked invoice paid and, unless unticked, adds a public "Payment confirmed" event (D-8).
 * Rejecting needs a reason, which the customer sees on the track page.
 */
export const ProofReviewControls: React.FC<ProofReviewControlsProps> = ({ proof, onReviewed }) => {
  const id = useId();
  const [addEvent, setAddEvent] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (proof.status !== 'SUBMITTED') return null;

  const approve = async () => {
    if (!window.confirm(`Approve this proof and mark the payment for ${proof.trackingNumber} as paid?`)) return;
    setBusy(true);
    setError('');
    try {
      onReviewed(await api.approvePaymentProof(proof.id, addEvent));
    } catch (err: any) {
      setError(err?.message || 'Could not approve the proof.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < PROOF_LIMITS.rejectReasonMin) {
      setError('Tell the customer why the proof was not accepted. They will see this.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onReviewed(await api.rejectPaymentProof(proof.id, text));
    } catch (err: any) {
      setError(err?.fieldErrors?.reason || err?.message || 'Could not reject the proof.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proof-review">
      {!rejecting ? (
        <>
          <label className="proof-review-check">
            <input type="checkbox" checked={addEvent} onChange={(e) => setAddEvent(e.target.checked)} disabled={busy} />
            <span>Add a “Payment confirmed” event to the public tracking timeline</span>
          </label>
          <div className="proof-review-buttons">
            <button type="button" className="proof-review-btn approve" onClick={approve} disabled={busy}>
              <CheckCircle2 size={15} aria-hidden="true" /><span>Approve</span>
            </button>
            <button type="button" className="proof-review-btn reject" onClick={() => { setRejecting(true); setError(''); }} disabled={busy}>
              <XCircle size={15} aria-hidden="true" /><span>Reject</span>
            </button>
          </div>
        </>
      ) : (
        <form className="proof-review-reject" onSubmit={reject}>
          <label htmlFor={`${id}-reason`}>Reason (the customer will see this)</label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={PROOF_LIMITS.rejectReasonMax}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The amount on the screenshot does not match the amount due."
            disabled={busy}
            autoFocus
          />
          <div className="proof-review-buttons">
            <button type="submit" className="proof-review-btn reject" disabled={busy}>
              <XCircle size={15} aria-hidden="true" /><span>Reject proof</span>
            </button>
            <button type="button" className="proof-review-btn" onClick={() => { setRejecting(false); setError(''); }} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="proof-review-error" role="alert">{error}</p>}
    </div>
  );
};
