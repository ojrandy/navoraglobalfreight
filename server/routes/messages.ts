import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { publicWriteLimiter } from '../middleware/rateLimit.js';
import { generateReference } from '../../src/shared/references.js';
import { getGateway } from '../../src/data/gateways.js';

export const messagesRouter = Router();

const PRIORITIES = new Set(['routine', 'urgent', 'critical']);
const STATUSES = new Set(['NEW', 'READ', 'RESOLVED']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trimmed string capped at `max` characters, or '' for anything that isn't a string.
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function formatMessage(row: any) {
  const gateway = row.gateway_code ? getGateway(row.gateway_code) : undefined;
  return {
    id: row.id,
    createdAt: new Date(row.created_at_ts).toISOString(),
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    subject: row.subject,
    priority: row.priority,
    trackingNumber: row.tracking_number || undefined,
    gatewayCode: row.gateway_code || undefined,
    gatewayLabel: gateway ? `${gateway.city}, ${gateway.country} (${gateway.code})` : undefined,
    message: row.message
  };
}

// POST /api/messages — the public Contact form and the Home callback request. Rate-limited, no session.
// An empty email is stored as '' (the column is NOT NULL).
messagesRouter.post('/', publicWriteLimiter, (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = text(body.name, 120);
    const email = text(body.email, 200);
    const message = text(body.message, 5000);
    const subject = text(body.subject, 120) || 'General Operations';
    const priority = PRIORITIES.has(body.priority) ? body.priority : 'routine';
    const phone = text(body.phone, 40) || null;
    const trackingNumber = text(body.trackingNumber, 40).toUpperCase() || null;
    const gatewayCode = getGateway(text(body.gatewayCode, 3).toUpperCase())?.code || null;

    if (!name || !message) {
      return res.status(400).json({ success: false, error: 'Name and message are required.' });
    }
    // Contact form messages come with an email; Home callback requests only with a phone number.
    if (!email && (phone ?? '').replace(/\D/g, '').length < 6) {
      return res.status(400).json({ success: false, error: 'Please enter an email address or a phone number with its country code.' });
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const exists = db.prepare('SELECT 1 FROM contact_messages WHERE id = ?');
    let id = generateReference('ticket');
    for (let i = 0; i < 5 && exists.get(id); i++) id = generateReference('ticket');

    db.prepare(`
      INSERT INTO contact_messages (
        id, created_at_ts, status, name, email, phone, subject, priority, tracking_number, gateway_code, message
      ) VALUES (?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, Date.now(), name, email, phone, subject, priority, trackingNumber, gatewayCode, message);

    const created = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatMessage(created) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/messages — admin inbox, newest first.
messagesRouter.get('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM contact_messages ORDER BY created_at_ts DESC').all();
    res.json({ success: true, count: rows.length, data: rows.map(formatMessage) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/messages/:id/status — admin marks a message read or resolved.
messagesRouter.patch('/:id/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body || {};
    if (!STATUSES.has(status)) {
      return res.status(400).json({ success: false, error: `Invalid message status: ${status}` });
    }
    const result = db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: `Message ${id} not found` });
    }
    const updated = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
    res.json({ success: true, data: formatMessage(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
