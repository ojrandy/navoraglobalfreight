import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { PaymentStatus, ShipmentPayment, validatePaymentRequest } from '../../src/shared/paymentRequest.js';
import { setDocumentPaymentStatus } from './documents.js';
import { deleteProofsForShipment } from './paymentProofs.js';

// A shipment's payment request (docs/update.md D.1, D-9). Mounted on /api/shipments next to
// shipmentsRouter, which also takes the public booking POST, so every route is gated
// individually. Payment data never comes in through that public POST: the Create Shipment form
// calls PUT below once the server has assigned the tracking ID.
export const shipmentPaymentsRouter = Router();

type PaymentRow = {
  id: string; tracking_number: string; amount: number; currency: string; charge_reason: string;
  due_date: string | null; methods_json: string; invoice_document_id: string | null; status: string;
  customer_note: string | null; created_at: string; updated_at: string; paid_at: string | null;
};

export function formatPayment(row: PaymentRow): ShipmentPayment {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    amount: row.amount,
    currency: row.currency as ShipmentPayment['currency'],
    chargeReason: row.charge_reason,
    dueDate: row.due_date,
    methods: JSON.parse(row.methods_json),
    invoiceDocumentId: row.invoice_document_id,
    status: row.status as PaymentStatus,
    customerNote: row.customer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  };
}

/** The stored request for a shipment, or null. Callers check the shipment itself (e.g. not trashed). */
export function getShipmentPayment(tracking: string): ShipmentPayment | null {
  const row = db.prepare('SELECT * FROM shipment_payments WHERE tracking_number = ?').get(tracking) as PaymentRow | undefined;
  return row ? formatPayment(row) : null;
}

/** Removes a shipment's payment request and its proofs (rows and files). Returns whether there was one. */
export function deleteShipmentPayment(tracking: string): boolean {
  deleteProofsForShipment(tracking);
  return db.prepare('DELETE FROM shipment_payments WHERE tracking_number = ?').run(tracking).changes > 0;
}

function trackingParam(req: Request): string {
  return (req.params.trackingNumber as string).trim().toUpperCase();
}

function activeShipmentExists(tracking: string): boolean {
  return !!db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
}

// GET /api/shipments/:trackingNumber/payment (admin): the request, or null when there is none.
shipmentPaymentsRouter.get('/:trackingNumber/payment', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    res.json({ success: true, data: getShipmentPayment(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shipments/:trackingNumber/payment (admin): creates the request, or replaces its amount,
// reason, dates, note, invoice link and accounts. A new request starts as AWAITING_PAYMENT; an
// existing one keeps its status (status changes go through POST .../payment/status).
shipmentPaymentsRouter.put('/:trackingNumber/payment', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });

    const checked = validatePaymentRequest(req.body, () => crypto.randomUUID());
    if (!checked.ok) return res.status(400).json({ success: false, error: 'Some payment details need fixing.', fieldErrors: checked.errors });
    const p = checked.value;

    if (p.invoiceDocumentId) {
      const invoice = db.prepare("SELECT 1 FROM documents WHERE id = ? AND shipment_tracking = ? AND doc_type = 'INVOICE'").get(p.invoiceDocumentId, tracking);
      if (!invoice) {
        return res.status(400).json({ success: false, error: 'Some payment details need fixing.', fieldErrors: { invoiceDocumentId: 'Choose an invoice that belongs to this shipment.' } });
      }
    }

    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM shipment_payments WHERE tracking_number = ?').get(tracking) as { id: string } | undefined;
    if (existing) {
      db.prepare(`
        UPDATE shipment_payments SET amount = ?, currency = ?, charge_reason = ?, due_date = ?, methods_json = ?,
          invoice_document_id = ?, customer_note = ?, updated_at = ?
        WHERE id = ?
      `).run(p.amount, p.currency, p.chargeReason, p.dueDate, JSON.stringify(p.methods), p.invoiceDocumentId, p.customerNote, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO shipment_payments (id, tracking_number, amount, currency, charge_reason, due_date, methods_json,
          invoice_document_id, status, customer_note, created_at, updated_at, paid_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_PAYMENT', ?, ?, ?, NULL)
      `).run(crypto.randomUUID(), tracking, p.amount, p.currency, p.chargeReason, p.dueDate, JSON.stringify(p.methods),
        p.invoiceDocumentId, p.customerNote, now, now);
    }
    res.status(existing ? 200 : 201).json({ success: true, data: getShipmentPayment(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Status changes the admin can make by hand (D.3). Proof approval/rejection (update F.6) adds the
// UNDER_REVIEW transitions; here: cancel, mark paid (e.g. cash at the counter), and reopen.
const STATUS_ACTIONS: Record<string, { from: PaymentStatus[]; to: PaymentStatus }> = {
  cancel: { from: ['AWAITING_PAYMENT', 'UNDER_REVIEW'], to: 'CANCELLED' },
  mark_paid: { from: ['AWAITING_PAYMENT', 'UNDER_REVIEW'], to: 'PAID' },
  reopen: { from: ['PAID', 'CANCELLED'], to: 'AWAITING_PAYMENT' },
};

// POST /api/shipments/:trackingNumber/payment/status (admin): { action: 'cancel' | 'mark_paid' | 'reopen' }.
// Marking paid also marks the linked invoice PAID; reopening a paid request sets it back to PENDING.
shipmentPaymentsRouter.post('/:trackingNumber/payment/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    const payment = getShipmentPayment(tracking);
    if (!payment) return res.status(404).json({ success: false, error: 'This shipment has no payment request.' });

    const key = req.body?.action;
    const action = typeof key === 'string' && Object.prototype.hasOwnProperty.call(STATUS_ACTIONS, key) ? STATUS_ACTIONS[key] : null;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Unknown action.' });
    }
    if (!action.from.includes(payment.status)) {
      return res.status(409).json({ success: false, error: `This request is ${payment.status.toLowerCase().replace('_', ' ')}, so that isn’t possible.` });
    }

    const now = new Date().toISOString();
    const paidAt = action.to === 'PAID' ? now : null;
    db.prepare('UPDATE shipment_payments SET status = ?, paid_at = ?, updated_at = ? WHERE id = ?').run(action.to, paidAt, now, payment.id);
    if (payment.invoiceDocumentId) {
      if (action.to === 'PAID') setDocumentPaymentStatus(payment.invoiceDocumentId, 'PAID');
      else if (payment.status === 'PAID') setDocumentPaymentStatus(payment.invoiceDocumentId, 'PENDING');
    }
    res.json({ success: true, data: getShipmentPayment(tracking) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/shipments/:trackingNumber/payment (admin): removes the request, its accounts and any proofs sent for it.
shipmentPaymentsRouter.delete('/:trackingNumber/payment', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = trackingParam(req);
    if (!activeShipmentExists(tracking)) return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    if (!deleteShipmentPayment(tracking)) return res.status(404).json({ success: false, error: 'This shipment has no payment request.' });
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
