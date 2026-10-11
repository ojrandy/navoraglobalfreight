import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Maximize2, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import type { AdminPaymentProof, ProofStatus } from '../../shared/paymentProof';
import { formatPaymentAmount } from '../../shared/paymentRequest';
import { customerMethodView, isPaymentMethodType } from '../../shared/paymentMethods';
import { PaymentIcon } from '../../components/PaymentIcon';
import { ProofViewer } from '../components/ProofViewer';
import { ProofReviewControls } from '../components/ProofReviewControls';
import './PaymentsView.css';

interface PaymentsViewProps {
  searchQuery: string;
  onOpenShipmentDetail: (trackingNumber: string) => void;
  /** Called after the list loads, so the console can refresh its new-proof badge (update G.1). */
  onProofsChanged?: () => void;
}

type Filter = 'ALL' | ProofStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

const PROOF_STATUS_LABELS: Record<ProofStatus, string> = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  UNDER_REVIEW: 'Under review',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

const formatReceived = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The account the customer says they used, as it was when they sent the proof. */
export function proofMethodView(proof: AdminPaymentProof) {
  const m = proof.method;
  if (!m || !isPaymentMethodType(m.type)) return null;
  return customerMethodView(m.type, m.details, m.label);
}

/** Admin Payments page (docs/update.md F.5): proofs of payment sent from the track page. */
export const PaymentsView: React.FC<PaymentsViewProps> = ({ searchQuery, onOpenShipmentDetail, onProofsChanged }) => {
  const [proofs, setProofs] = useState<AdminPaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [viewing, setViewing] = useState<AdminPaymentProof | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProofs(await api.getPaymentProofs());
      onProofsChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Could not load payment proofs.');
    } finally {
      setLoading(false);
    }
  }, [onProofsChanged]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return proofs.filter((p) => {
      if (filter !== 'ALL' && p.status !== filter) return false;
      if (!q) return true;
      return [p.trackingNumber, p.payerName, p.reference, p.payment?.chargeReason, proofMethodView(p)?.label]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [proofs, filter, searchQuery]);

  const counts = useMemo(() => ({
    ALL: proofs.length,
    SUBMITTED: proofs.filter((p) => p.status === 'SUBMITTED').length,
    APPROVED: proofs.filter((p) => p.status === 'APPROVED').length,
    REJECTED: proofs.filter((p) => p.status === 'REJECTED').length,
  }), [proofs]);

  const openViewer = (proof: AdminPaymentProof, opener: HTMLElement) => {
    openerRef.current = opener;
    setViewing(proof);
  };
  // Approving one proof also changes its request, which other proofs for that shipment show,
  // so the list is reloaded after the reviewed proof is swapped in.
  const handleReviewed = (updated: AdminPaymentProof) => {
    setProofs((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setViewing((current) => (current?.id === updated.id ? updated : current));
    load();
  };

  const closeViewer = useCallback(() => {
    setViewing(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const details = (p: AdminPaymentProof) => {
    const method = proofMethodView(p);
    const mismatch = p.payment && p.amountSent !== null && Math.abs(p.amountSent - p.payment.amount) >= 0.005;
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

  return (
    <div className="ngf-payments-workspace animate-fade-in">
      <div className="payments-toolbar">
        <div className="payments-filters" role="tablist" aria-label="Filter payment proofs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`payments-filter-btn ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} <span className="font-mono">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="payments-refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="payments-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="payments-empty">
          <Wallet size={28} />
          <strong>{proofs.length === 0 ? 'No payment proofs yet' : 'No proofs match'}</strong>
          <p>{proofs.length === 0 ? 'Proofs customers send from the track page will appear here.' : 'Try another filter or clear the search.'}</p>
        </div>
      )}

      <div className="payments-list">
        {visible.map((p) => (
          <article key={p.id} className={`proof-card status-${p.status.toLowerCase()}`}>
            <button
              type="button"
              className="proof-thumb"
              onClick={(e) => openViewer(p, e.currentTarget)}
              aria-label={`Open the screenshot sent for ${p.trackingNumber}`}
            >
              <img src={p.fileUrl} alt="" loading="lazy" />
              <span className="proof-thumb-zoom" aria-hidden="true"><Maximize2 size={14} /></span>
            </button>

            <div className="proof-main">
              <div className="proof-head">
                <strong className="font-mono">{p.trackingNumber}</strong>
                <span className={`proof-badge ${p.status.toLowerCase()}`}>{PROOF_STATUS_LABELS[p.status]}</span>
                {p.payment && <span className="proof-request-status">Request: {REQUEST_STATUS_LABELS[p.payment.status] ?? p.payment.status}</span>}
                <small className="proof-time">Received {formatReceived(p.createdAt)}</small>
              </div>
              {details(p)}
              {p.status === 'REJECTED' && p.adminNote && <p className="proof-note">Rejected: {p.adminNote}</p>}
              <div className="proof-actions">
                <button type="button" className="proof-action" onClick={(e) => openViewer(p, e.currentTarget)}>
                  <Maximize2 size={14} /><span>View screenshot</span>
                </button>
                <button type="button" className="proof-action" onClick={() => onOpenShipmentDetail(p.trackingNumber)}>
                  <ExternalLink size={14} /><span>View shipment</span>
                </button>
              </div>
              <ProofReviewControls proof={p} onReviewed={handleReviewed} />
            </div>
          </article>
        ))}
      </div>

      {viewing && (
        <ProofViewer src={viewing.fileUrl} title={`Payment screenshot · ${viewing.trackingNumber}`} onClose={closeViewer}>
          {details(viewing)}
          {viewing.status === 'REJECTED' && viewing.adminNote && <p className="proof-note">Rejected: {viewing.adminNote}</p>}
          <ProofReviewControls proof={viewing} onReviewed={handleReviewed} />
        </ProofViewer>
      )}
    </div>
  );
};
