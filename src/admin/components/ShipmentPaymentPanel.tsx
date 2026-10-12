import React, { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAdminData } from '../../context/AdminDataContext';
import { PAYMENT_METHODS } from '../../shared/paymentMethods';
import { ShipmentPayment, formatPaymentAmount } from '../../shared/paymentRequest';
import { PaymentIcon } from '../../components/PaymentIcon';
import {
  PaymentDraft, PaymentRequestEditor, draftFromPayment, draftToRequest, emptyPaymentDraft, paymentDraftErrors,
} from './PaymentRequestEditor';
import './ShipmentPaymentPanel.css';

const STATUS_LABELS: Record<ShipmentPayment['status'], string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  UNDER_REVIEW: 'Proof under review',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

interface ShipmentPaymentPanelProps {
  trackingNumber: string;
}

/**
 * Edit Shipment: the shipment's payment request (docs/update.md D.2, D-9) with create, edit and
 * delete. Saves through /api/shipments/:id/payment on its own, independently of Save Changes.
 */
export const ShipmentPaymentPanel: React.FC<ShipmentPaymentPanelProps> = ({ trackingNumber }) => {
  const { documents } = useAdminData();
  const [payment, setPayment] = useState<ShipmentPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  // Bumped by "Try again" after a failed load (update I.6).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    api.getShipmentPayment(trackingNumber)
      .then((p) => { if (!cancelled) setPayment(p); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load the payment request.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trackingNumber, reloadKey]);

  const invoices = useMemo(
    () => documents
      .filter((d) => d.docType === 'INVOICE' && d.shipmentTracking?.toUpperCase() === trackingNumber.toUpperCase())
      .map((d) => ({ id: d.id, label: `${d.id} – ${d.title}` })),
    [documents, trackingNumber]
  );

  const startEditing = () => {
    setErrors({});
    setMessage(null);
    setDraft(payment ? draftFromPayment(payment) : emptyPaymentDraft());
  };

  const save = async () => {
    if (!draft) return;
    const localErrors = paymentDraftErrors(draft);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setMessage({ text: 'Some payment details need fixing.', error: true });
      return;
    }
    setBusy(true);
    try {
      const saved = await api.saveShipmentPayment(trackingNumber, draftToRequest(draft));
      setPayment(saved);
      setDraft(null);
      setErrors({});
      setMessage({ text: payment ? 'Payment request saved.' : 'Payment request added. The customer can now see it on the track page.' });
    } catch (err: any) {
      setErrors(err.fieldErrors ?? {});
      setMessage({ text: err.message || 'Could not save the payment request.', error: true });
    } finally {
      setBusy(false);
    }
  };

  // D.3: manual status changes. Marking paid also marks a linked invoice paid (server side).
  const changeStatus = async (action: 'cancel' | 'mark_paid' | 'reopen') => {
    const prompts = {
      mark_paid: 'Mark this payment as received (for example cash at the counter)? The customer will see it as paid.',
      cancel: 'Cancel this payment request? The customer will no longer be asked to pay.',
      reopen: 'Reopen this payment request? The customer will be asked to pay again.',
    };
    if (!window.confirm(prompts[action])) return;
    setBusy(true);
    try {
      const updated = await api.setShipmentPaymentStatus(trackingNumber, action);
      setPayment(updated);
      setMessage({ text: action === 'mark_paid' ? 'Marked as paid.' : action === 'cancel' ? 'Payment request cancelled.' : 'Payment request reopened.' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Could not change the status.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this payment request and its accounts? The customer will no longer see it.')) return;
    setBusy(true);
    try {
      await api.deleteShipmentPayment(trackingNumber);
      setPayment(null);
      setDraft(null);
      setMessage({ text: 'Payment request deleted.' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Could not delete the payment request.', error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ngf-spp" aria-labelledby={`ngf-spp-${trackingNumber}`}>
      <div className="ngf-spp-head">
        <h4 id={`ngf-spp-${trackingNumber}`}>Payment request</h4>
        {payment && !draft && <span className={`ngf-spp-status s-${payment.status.toLowerCase()}`}>{STATUS_LABELS[payment.status]}</span>}
      </div>
      <p className="ngf-spp-hint">Shown to the customer on the track page. Saved on its own, separately from Save Changes.</p>

      <p className={`ngf-spp-message${message?.error ? ' is-error' : ''}`} role="status" aria-live="polite">{message?.text}</p>

      {loading ? (
        <p className="ngf-spp-empty">Loading…</p>
      ) : loadError ? (
        <div className="ngf-load-error" role="alert">
          <p className="ngf-spp-error">{loadError}</p>
          <button type="button" className="ngf-load-retry" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      ) : draft ? (
        <>
          <PaymentRequestEditor value={draft} onChange={setDraft} errors={errors} invoices={invoices} idPrefix={`edit-${trackingNumber}`} compact />
          <div className="ngf-spp-actions">
            <button type="button" className="ngf-spp-btn" onClick={() => { setDraft(null); setErrors({}); setMessage(null); }} disabled={busy}>Cancel</button>
            <button type="button" className="ngf-spp-btn primary" onClick={save} disabled={busy}>
              {busy && <Loader2 size={14} className="ngf-spp-spin" aria-hidden="true" />}
              <span>{payment ? 'Save payment request' : 'Add payment request'}</span>
            </button>
          </div>
        </>
      ) : payment ? (
        <div className="ngf-spp-summary">
          <div className="ngf-spp-amount">{formatPaymentAmount(payment.amount, payment.currency)}</div>
          <p className="ngf-spp-reason">{payment.chargeReason}</p>
          {payment.dueDate && <p className="ngf-spp-meta">Due {payment.dueDate}</p>}
          {payment.paidAt && <p className="ngf-spp-meta">Paid {new Date(payment.paidAt).toLocaleString()}</p>}
          <ul className="ngf-spp-accounts">
            {payment.methods.map((m) => (
              <li key={m.id}>
                <PaymentIcon type={m.type} size={16} />
                <span>{m.label || PAYMENT_METHODS[m.type]?.label || m.type}</span>
              </li>
            ))}
          </ul>
          <div className="ngf-spp-actions">
            {(payment.status === 'AWAITING_PAYMENT' || payment.status === 'UNDER_REVIEW') && (
              <>
                <button type="button" className="ngf-spp-btn" onClick={() => changeStatus('cancel')} disabled={busy}>
                  <Ban size={14} aria-hidden="true" />
                  <span>Cancel request</span>
                </button>
                <button type="button" className="ngf-spp-btn" onClick={() => changeStatus('mark_paid')} disabled={busy}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>Mark paid</span>
                </button>
              </>
            )}
            {(payment.status === 'PAID' || payment.status === 'CANCELLED') && (
              <button type="button" className="ngf-spp-btn" onClick={() => changeStatus('reopen')} disabled={busy}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Reopen</span>
              </button>
            )}
            <button type="button" className="ngf-spp-btn danger" onClick={remove} disabled={busy}>
              <Trash2 size={14} aria-hidden="true" />
              <span>Delete</span>
            </button>
            <button type="button" className="ngf-spp-btn" onClick={startEditing} disabled={busy}>
              <Pencil size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="ngf-spp-none">
          <p className="ngf-spp-empty">No payment request for this shipment.</p>
          <button type="button" className="ngf-spp-btn primary" onClick={startEditing}>
            <Plus size={14} aria-hidden="true" />
            <span>Add payment request</span>
          </button>
        </div>
      )}
    </section>
  );
};
