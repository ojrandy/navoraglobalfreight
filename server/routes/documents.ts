import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { publicWriteLimiter } from '../middleware/rateLimit.js';
import { ADMIN_ROLE_LABEL, LEGAL_NAME } from '../../src/config/brand.js';

export const documentsRouter = Router();

function formatDoc(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    docType: row.doc_type,
    title: row.title,
    shipmentTracking: row.shipment_tracking,
    senderName: row.sender_name,
    senderCompany: row.sender_company,
    senderAddress: row.sender_address,
    senderCity: row.sender_city,
    senderState: row.sender_state,
    senderZip: row.sender_zip,
    senderPhone: row.sender_phone,
    senderEmail: row.sender_email,
    recipientName: row.recipient_name,
    recipientCompany: row.recipient_company,
    recipientAddress: row.recipient_address,
    recipientCity: row.recipient_city,
    recipientState: row.recipient_state,
    recipientZip: row.recipient_zip,
    recipientPhone: row.recipient_phone,
    recipientEmail: row.recipient_email,
    cargoDescription: row.cargo_description,
    shipmentType: row.shipment_type,
    service: row.service,
    weightLbs: row.weight_lbs,
    pieces: row.pieces,
    dimensions: row.dimensions,
    declaredValue: row.declared_value,
    charges: row.charges_json ? JSON.parse(row.charges_json) : undefined,
    bolCarrier: row.bol_carrier,
    bolTrailerNumber: row.bol_trailer_number,
    bolSealNumber: row.bol_seal_number,
    bolSpecialInstructions: row.bol_special_instructions,
    insurerName: row.insurer_name,
    policyNumber: row.policy_number,
    coverageType: row.coverage_type,
    deductible: row.deductible,
    premiumAmount: row.premium_amount,
    createdDate: row.created_date,
    status: row.status,
    version: row.version,
    versionHistory: row.version_history_json ? JSON.parse(row.version_history_json) : [],
    fileSize: row.file_size
  };
}

// GET /api/documents (List all documents with optional filter)
documentsRouter.get('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { docType, status, search } = req.query;
    let query = 'SELECT * FROM documents';
    const params: any[] = [];
    const conditions: string[] = [];

    if (docType && docType !== 'ALL') {
      conditions.push('doc_type = ?');
      params.push(docType);
    }

    if (status && status !== 'ALL') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      const term = `%${String(search).toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(id) LIKE ? OR
        LOWER(shipment_tracking) LIKE ? OR
        LOWER(sender_name) LIKE ? OR
        LOWER(recipient_name) LIKE ? OR
        LOWER(cargo_description) LIKE ? OR
        LOWER(title) LIKE ?
      )`);
      params.push(term, term, term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at_ts DESC';

    const rows = db.prepare(query).all(...params);
    const docs = rows.map(formatDoc);
    res.json({ success: true, count: docs.length, data: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/documents/:id
documentsRouter.get('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id as string);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, data: formatDoc(row) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/documents/generate (Generate new document)
// Deliberately NOT gated: ShipPage.tsx's public booking flow auto-generates a BOL right
// after a customer books a shipment, via this same endpoint. Rate-limited instead.
documentsRouter.post('/generate', publicWriteLimiter, (req: Request, res: Response) => {
  try {
    const d = req.body;
    const prefix = d.docType === 'SHIPPING_LABEL' ? 'LBL' : d.docType === 'RECEIPT' ? 'REC' : d.docType === 'INVOICE' ? 'INV' : d.docType === 'INSURANCE' ? 'INS' : 'BOL';
    const randNum = Math.floor(10000 + Math.random() * 90000);
    const id = d.id || `${prefix}-2026-${randNum}`;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const versionHistory = [
      {
        version: 1,
        createdDate: `${dateStr} ${timeStr}`,
        generatedBy: ADMIN_ROLE_LABEL,
        notes: 'Master document generated.'
      }
    ];

    db.prepare(`
      INSERT INTO documents (
        id, doc_type, title, shipment_tracking, sender_name, sender_company,
        sender_address, sender_city, sender_state, sender_zip, sender_phone, sender_email,
        recipient_name, recipient_company, recipient_address, recipient_city,
        recipient_state, recipient_zip, recipient_phone, recipient_email, cargo_description,
        shipment_type, service, weight_lbs, pieces, dimensions, declared_value,
        charges_json, bol_carrier, bol_trailer_number, bol_seal_number,
        bol_special_instructions, insurer_name, policy_number, coverage_type, deductible, premium_amount,
        created_date, status, version, version_history_json, file_size,
        created_at_ts
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      id,
      d.docType || 'SHIPPING_LABEL',
      d.title || 'Official Shipping Document',
      d.shipmentTracking,
      d.senderName || 'Shipper',
      d.senderCompany || null,
      d.senderAddress || null,
      // Only real values: empty strings (NOT NULL columns) or null, never a placeholder
      // city, size, trailer or seal number that would then print on the document.
      d.senderCity || '',
      d.senderState || '',
      d.senderZip || null,
      d.senderPhone || null,
      d.senderEmail || null,
      d.recipientName || 'Consignee',
      d.recipientCompany || null,
      d.recipientAddress || null,
      d.recipientCity || '',
      d.recipientState || '',
      d.recipientZip || null,
      d.recipientPhone || null,
      d.recipientEmail || null,
      d.cargoDescription || '',
      d.shipmentType || 'Parcel',
      d.service || '',
      d.weightLbs || 0,
      d.pieces || 1,
      d.dimensions || null,
      d.declaredValue || 0,
      d.charges ? JSON.stringify(d.charges) : null,
      d.bolCarrier || LEGAL_NAME,
      d.bolTrailerNumber || null,
      d.bolSealNumber || null,
      d.bolSpecialInstructions || null,
      d.insurerName || null,
      d.policyNumber || null,
      d.coverageType || null,
      d.deductible ?? null,
      d.premiumAmount ?? null,
      dateStr,
      'GENERATED',
      1,
      JSON.stringify(versionHistory),
      `${Math.floor(90 + Math.random() * 200)} KB`,
      Date.now()
    );

    const created = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatDoc(created) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/documents/:id/regenerate (Create revised document version)
documentsRouter.post('/:id/regenerate', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { notes, ...d } = req.body;

    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: `Document ${id} not found` });
    }

    const currentDoc = formatDoc(row)!;
    const nextVersion = currentDoc.version + 1;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const updatedHistory = [
      {
        version: nextVersion,
        createdDate: `${dateStr} ${timeStr}`,
        generatedBy: ADMIN_ROLE_LABEL,
        notes: notes || `Regenerated version ${nextVersion} with revised parameters.`
      },
      ...currentDoc.versionHistory
    ];

    // Re-pull the descriptive fields from the shipment's current state (sent by the
    // client, which already has the live shipment in memory) instead of leaving them
    // frozen at whatever they were when the document was first generated — previously
    // "Regenerate" only ever bumped the version number and left every actual field
    // (address, cargo description, weight, pieces, dimensions) untouched, so it looked
    // like it refreshed the document but never really did. COALESCE keeps the existing
    // value for any field the caller doesn't supply.
    db.prepare(`
      UPDATE documents SET
        version = ?,
        status = 'UPDATED',
        created_date = ?,
        version_history_json = ?,
        sender_name = COALESCE(?, sender_name),
        sender_company = COALESCE(?, sender_company),
        sender_address = COALESCE(?, sender_address),
        sender_city = COALESCE(?, sender_city),
        sender_state = COALESCE(?, sender_state),
        sender_zip = COALESCE(?, sender_zip),
        sender_phone = COALESCE(?, sender_phone),
        sender_email = COALESCE(?, sender_email),
        recipient_name = COALESCE(?, recipient_name),
        recipient_company = COALESCE(?, recipient_company),
        recipient_address = COALESCE(?, recipient_address),
        recipient_city = COALESCE(?, recipient_city),
        recipient_state = COALESCE(?, recipient_state),
        recipient_zip = COALESCE(?, recipient_zip),
        recipient_phone = COALESCE(?, recipient_phone),
        recipient_email = COALESCE(?, recipient_email),
        cargo_description = COALESCE(?, cargo_description),
        shipment_type = COALESCE(?, shipment_type),
        service = COALESCE(?, service),
        weight_lbs = COALESCE(?, weight_lbs),
        pieces = COALESCE(?, pieces),
        dimensions = COALESCE(?, dimensions)
      WHERE id = ?
    `).run(
      nextVersion, dateStr, JSON.stringify(updatedHistory),
      d.senderName || null, d.senderCompany || null, d.senderAddress || null,
      d.senderCity || null, d.senderState || null, d.senderZip || null,
      d.senderPhone || null, d.senderEmail || null,
      d.recipientName || null, d.recipientCompany || null, d.recipientAddress || null,
      d.recipientCity || null, d.recipientState || null, d.recipientZip || null,
      d.recipientPhone || null, d.recipientEmail || null,
      d.cargoDescription || null, d.shipmentType || null, d.service || null,
      d.weightLbs !== undefined ? d.weightLbs : null,
      d.pieces !== undefined ? d.pieces : null,
      d.dimensions || null,
      id
    );

    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    res.json({ success: true, data: formatDoc(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/documents/:id/status (Toggle cancel / active)
documentsRouter.patch('/:id/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body;

    db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    res.json({ success: true, data: formatDoc(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/documents/:id/payment-status (Toggle paid / pending)
documentsRouter.patch('/:id/payment-status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { paymentStatus } = req.body;
    if (paymentStatus !== 'PAID' && paymentStatus !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'paymentStatus must be PAID or PENDING' });
    }

    const row = db.prepare('SELECT charges_json FROM documents WHERE id = ?').get(id) as { charges_json: string | null } | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: `Document ${id} not found` });
    }

    const charges = row.charges_json ? JSON.parse(row.charges_json) : {};
    charges.paymentStatus = paymentStatus;
    if (paymentStatus === 'PAID') {
      charges.paidDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      delete charges.paidDate;
    }

    db.prepare('UPDATE documents SET charges_json = ? WHERE id = ?').run(JSON.stringify(charges), id);
    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    res.json({ success: true, data: formatDoc(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/documents/:id
documentsRouter.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    res.json({ success: true, message: `Document ${id} deleted` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
