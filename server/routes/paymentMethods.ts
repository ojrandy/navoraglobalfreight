import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { isPaymentMethodType, validatePaymentDetails, PaymentMethodType } from '../../src/shared/paymentMethods.js';

// The admin's payment accounts (docs/update.md C.3). Mounted behind requireAdminAuth in
// server/index.ts: nothing here is public.
export const paymentMethodsRouter = Router();

export const MAX_PAYMENT_METHODS = 50;
const MAX_LABEL = 60;
const MAX_INSTRUCTIONS = 500;

type MethodRow = {
  id: string; type: string; label: string | null; details_json: string; instructions: string | null;
  enabled: number; sort_order: number; created_at: string; updated_at: string;
};

export function formatPaymentMethod(row: MethodRow) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    details: JSON.parse(row.details_json) as Record<string, string>,
    instructions: row.instructions,
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listMethods() {
  const rows = db.prepare('SELECT * FROM payment_methods ORDER BY sort_order ASC, created_at ASC').all() as MethodRow[];
  return rows.map(formatPaymentMethod);
}

/**
 * Payment requests still waiting on the customer (or on review) that tick this method. Before
 * the shipment_payments table exists (update D.1) there are none.
 */
function openRequestsUsing(id: string): string[] {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shipment_payments'").get();
  if (!table) return [];
  const rows = db.prepare(`
    SELECT sp.tracking_number FROM shipment_payments sp, json_each(sp.method_ids_json) j
    WHERE j.value = ? AND sp.status IN ('AWAITING_PAYMENT', 'UNDER_REVIEW')
  `).all(id) as { tracking_number: string }[];
  return rows.map((r) => r.tracking_number);
}

function cleanOptionalText(value: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length > max) return { ok: false };
  return { ok: true, value: trimmed || null };
}

// GET /api/payment-methods: every account, disabled ones included, in display order.
paymentMethodsRouter.get('/', (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: listMethods() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payment-methods: { type, details, label?, instructions?, enabled? }
paymentMethodsRouter.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!isPaymentMethodType(body.type)) return res.status(400).json({ success: false, error: 'Choose a payment method type.' });
    const count = (db.prepare('SELECT COUNT(*) AS c FROM payment_methods').get() as { c: number }).c;
    if (count >= MAX_PAYMENT_METHODS) return res.status(400).json({ success: false, error: `You can keep up to ${MAX_PAYMENT_METHODS} payment methods.` });

    const checked = validatePaymentDetails(body.type as PaymentMethodType, body.details);
    if (!checked.ok) return res.status(400).json({ success: false, error: 'Some details need fixing.', fieldErrors: checked.errors });
    const label = cleanOptionalText(body.label, MAX_LABEL);
    if (!label.ok) return res.status(400).json({ success: false, error: `Keep the display name under ${MAX_LABEL} characters.` });
    const instructions = cleanOptionalText(body.instructions, MAX_INSTRUCTIONS);
    if (!instructions.ok) return res.status(400).json({ success: false, error: `Keep the instructions under ${MAX_INSTRUCTIONS} characters.` });

    const now = new Date().toISOString();
    const maxOrder = (db.prepare('SELECT MAX(sort_order) AS m FROM payment_methods').get() as { m: number | null }).m;
    db.prepare(`
      INSERT INTO payment_methods (id, type, label, details_json, instructions, enabled, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), body.type, label.value, JSON.stringify(checked.details), instructions.value,
      body.enabled === false ? 0 : 1, (maxOrder ?? -1) + 1, now, now);
    res.status(201).json({ success: true, data: listMethods() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/payment-methods/order: { ids: [...] } in the new order.
paymentMethodsRouter.put('/order', (req: Request, res: Response) => {
  try {
    const ids = req.body?.ids;
    const current = (db.prepare('SELECT id FROM payment_methods').all() as { id: string }[]).map((r) => r.id);
    const valid = Array.isArray(ids) && ids.length === current.length
      && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!valid) return res.status(400).json({ success: false, error: 'The new order must list each payment method once.' });
    const stmt = db.prepare('UPDATE payment_methods SET sort_order = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
      ids.forEach((id: string, index: number) => stmt.run(index, id));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ success: true, data: listMethods() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payment-methods/:id: { details?, label?, instructions?, enabled? }. The type is fixed:
// to switch type, add a new method.
paymentMethodsRouter.patch('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id as string) as MethodRow | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Payment method not found.' });
    const body = req.body || {};

    let detailsJson = row.details_json;
    if (body.details !== undefined) {
      const checked = validatePaymentDetails(row.type as PaymentMethodType, body.details);
      if (!checked.ok) return res.status(400).json({ success: false, error: 'Some details need fixing.', fieldErrors: checked.errors });
      detailsJson = JSON.stringify(checked.details);
    }
    let label = row.label;
    if (body.label !== undefined) {
      const cleaned = cleanOptionalText(body.label, MAX_LABEL);
      if (!cleaned.ok) return res.status(400).json({ success: false, error: `Keep the display name under ${MAX_LABEL} characters.` });
      label = cleaned.value;
    }
    let instructions = row.instructions;
    if (body.instructions !== undefined) {
      const cleaned = cleanOptionalText(body.instructions, MAX_INSTRUCTIONS);
      if (!cleaned.ok) return res.status(400).json({ success: false, error: `Keep the instructions under ${MAX_INSTRUCTIONS} characters.` });
      instructions = cleaned.value;
    }
    const enabled = typeof body.enabled === 'boolean' ? (body.enabled ? 1 : 0) : row.enabled;

    db.prepare(`
      UPDATE payment_methods SET label = ?, details_json = ?, instructions = ?, enabled = ?, updated_at = ? WHERE id = ?
    `).run(label, detailsJson, instructions, enabled, new Date().toISOString(), row.id);
    res.json({ success: true, data: listMethods() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/payment-methods/:id: refused while an open payment request uses it (disable it instead).
paymentMethodsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const row = db.prepare('SELECT id FROM payment_methods WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Payment method not found.' });
    const usedBy = openRequestsUsing(id);
    if (usedBy.length) {
      return res.status(409).json({
        success: false,
        error: `This method is ticked on an open payment request (${usedBy.slice(0, 5).join(', ')}${usedBy.length > 5 ? ', …' : ''}). Disable it instead, or untick it there first.`,
      });
    }
    db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
    res.json({ success: true, data: listMethods() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
