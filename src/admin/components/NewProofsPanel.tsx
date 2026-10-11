import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Maximize2, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import type { AdminPaymentProof } from '../../shared/paymentProof';
import { formatPaymentAmount } from '../../shared/paymentRequest';
import { PaymentIcon } from '../../components/PaymentIcon';
import { ProofViewer } from './ProofViewer';
import { ProofReviewControls } from './ProofReviewControls';
import { ProofFacts, formatProofReceived, proofAmountMismatch, proofMethodView } from './ProofFacts';
import './NewProofsPanel.css';

/** How many proofs the dashboard lists before pointing to the Payments page. */
const PANEL_LIMIT = 6;

interface NewProofsPanelProps {
  /** Count from the console's poll (G.1); the list reloads whenever it changes. */
  newProofsCount: number;
  /** Called after a review, so the badge and bell update straight away. */
  onProofsChanged?: () => void;
  onOpenPayments: () => void;
}

/**
 * "New payment proofs" card on the Operations Center (docs/update.md G.2): proofs waiting for
 * review with their screenshot (admin-only file route), opening a full-size viewer with Approve / Reject.
 */
export const NewProofsPanel: React.FC<NewProofsPanelProps> = ({ newProofsCount, onProofsChanged, onOpenPayments }) => {
  const [proofs, setProofs] = useState<AdminPaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminPaymentProof | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProofs(await api.getPaymentProofs('SUBMITTED'));
    } catch (err: any) {
      setError(err?.message || 'Could not load payment proofs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, newProofsCount]);

  const openViewer = (proof: AdminPaymentProof, opener: HTMLElement) => {
    openerRef.current = opener;
    setViewing(proof);
  };

  // The viewer stays open on the reviewed proof (showing its outcome); the list drops it.
  const handleReviewed = (updated: AdminPaymentProof) => {
    setViewing((current) => (current?.id === updated.id ? updated : current));
    setProofs((list) => list.filter((p) => p.id !== updated.id));
    onProofsChanged?.();
    load();
  };

  // The thumbnail that opened the viewer may be gone after a review, so fall back to the heading.
  const closeViewer = useCallback(() => {
    setViewing(null);
    requestAnimationFrame(() => {
      const opener = openerRef.current;
      if (opener && opener.isConnected) opener.focus();
      else headingRef.current?.focus();
    });
  }, []);

  const shown = proofs.slice(0, PANEL_LIMIT);

  return (
    <section className="ops-section-card ngf-new-proofs" aria-labelledby="ngf-new-proofs-title">
      <div className="ops-table-header-block">
        <div className="table-title-row">
          <h2 id="ngf-new-proofs-title" ref={headingRef} tabIndex={-1} className="ops-section-title">New payment proofs</h2>
          <span className={`ops-shipment-count-pill${proofs.length > 0 ? ' new-proofs-pill-active' : ''}`}>
            {proofs.length} to review
          </span>
        </div>
        <div className="new-proofs-head-actions">
          <button type="button" className="new-proofs-icon-btn" onClick={load} disabled={loading} aria-label="Refresh payment proofs">
            <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
          </button>
          <button type="button" className="ops-btn-secondary" onClick={onOpenPayments}>
            All Payments →
          </button>
        </div>
      </div>

      {error && (
        <div className="new-proofs-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!error && !loading && proofs.length === 0 && (
        <div className="new-proofs-empty">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <strong>Nothing to review</strong>
            <p>Proofs of payment customers send from the track page will appear here.</p>
          </div>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="new-proofs-list">
          {shown.map((p) => {
            const method = proofMethodView(p);
            const mismatch = proofAmountMismatch(p);
            return (
              <li key={p.id} className="new-proof-item">
                <button
                  type="button"
                  className="new-proof-thumb"
                  onClick={(e) => openViewer(p, e.currentTarget)}
                  aria-label={`Review the payment proof for ${p.trackingNumber}`}
                >
                  <img src={p.fileUrl} alt="" loading="lazy" width={72} height={72} />
                  <span className="new-proof-thumb-zoom" aria-hidden="true"><Maximize2 size={12} /></span>
                </button>
                <div className="new-proof-info">
                  <div className="new-proof-top">
                    <strong className="font-mono">{p.trackingNumber}</strong>
                    <small>{formatProofReceived(p.createdAt)}</small>
                  </div>
                  <div className="new-proof-amounts">
                    <span>
                      Due <b>{p.payment ? formatPaymentAmount(p.payment.amount, p.payment.currency) : '—'}</b>
                    </span>
                    <span className={mismatch ? 'new-proof-mismatch' : undefined}>
                      Sent <b>{p.amountSent !== null ? formatPaymentAmount(p.amountSent, p.payment?.currency ?? 'USD') : '—'}</b>
                      {mismatch && <><AlertTriangle size={12} aria-hidden="true" /><em>differs</em></>}
                    </span>
                  </div>
                  <div className="new-proof-meta">
                    <span className="new-proof-method">
                      {method ? <><PaymentIcon type={method.type} size={14} /><span>{method.label}</span></> : <><Wallet size={14} aria-hidden="true" /><span>Account not recorded</span></>}
                    </span>
                    <span className="new-proof-ref font-mono" title={p.reference || undefined}>Ref: {p.reference || '—'}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {proofs.length > PANEL_LIMIT && (
        <button type="button" className="new-proofs-more" onClick={onOpenPayments}>
          View all {proofs.length} proofs waiting in Payments →
        </button>
      )}

      {viewing && (
        <ProofViewer src={viewing.fileUrl} title={`Payment screenshot · ${viewing.trackingNumber}`} onClose={closeViewer}>
          <ProofFacts proof={viewing} />
          {viewing.status === 'APPROVED' && (
            <p className="new-proofs-outcome" role="status">Approved. The payment is marked as paid.</p>
          )}
          {viewing.status === 'REJECTED' && viewing.adminNote && (
            <p className="proof-note" role="status">Rejected: {viewing.adminNote}</p>
          )}
          <ProofReviewControls proof={viewing} onReviewed={handleReviewed} />
        </ProofViewer>
      )}
    </section>
  );
};
