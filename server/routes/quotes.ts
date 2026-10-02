import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { publicWriteLimiter } from '../middleware/rateLimit.js';
import { generateUniqueTrackingId } from '../trackingIds.js';
import { pieceLabel } from '../../src/shared/trackingId.js';
import { ADMIN_ROLE_LABEL } from '../../src/config/brand.js';
import { parseTransportMode } from '../../src/shared/transportMode.js';
import { eventTime } from '../eventTime.js';

export const quotesRouter = Router();

// Helper to format quote request row. `includeInternalNotes` defaults to true (the admin
// view) — the one public-facing call site (GET /:id, used by the "look up my quote" flow on
// the public site) explicitly passes false so a customer's internal admin notes about their
// own quote never reach their browser.
function formatQuote(row: any, includeInternalNotes: boolean = true) {
  if (!row) return null;
  const origin = JSON.parse(row.origin_json || '{}');
  const destination = JSON.parse(row.destination_json || '{}');
  let dims = row.dimensions_json ? JSON.parse(row.dimensions_json) : {};
  // Canonical inches (tracker 2.7). `dimensions` stays a display string for older views;
  // `dimensionsIn` is the structured value the unit-aware views format.
  let dimensionsStr = '';
  if (typeof dims === 'string') {
    dimensionsStr = dims;
  } else if (dims && typeof dims === 'object' && (dims.length !== undefined || dims.width !== undefined)) {
    dimensionsStr = `${dims.length || '—'} × ${dims.width || '—'} × ${dims.height || '—'} in`;
  }

  return {
    id: row.id,
    submittedDate: row.created_at,
    createdAt: row.created_at,
    status: row.status,
    requesterName: row.customer_name,
    customerName: row.customer_name,
    requesterEmail: row.customer_email,
    customerEmail: row.customer_email,
    requesterPhone: row.customer_phone,
    customerPhone: row.customer_phone,
    requesterCompany: row.company,
    company: row.company,
    recipientName: 'Designated Consignee',
    origin,
    originCity: origin.city || 'New York',
    originState: origin.state || '',
    originZip: origin.postalCode || '',
    originCountry: origin.country || '',
    originCountryCode: origin.countryCode || '',
    destination,
    destCity: destination.city || 'Los Angeles',
    destState: destination.state || '',
    destZip: destination.postalCode || '',
    destCountry: destination.country || '',
    destCountryCode: destination.countryCode || '',
    requestedService: row.service,
    service: row.service,
    shipmentType: row.shipment_type,
    cargoType: row.shipment_type,
    cargoDescription: row.cargo_description,
    totalWeightLbs: row.weight_lbs,
    weightLbs: row.weight_lbs,
    quantity: row.pieces || 1,
    pieces: row.pieces || 1,
    dimensions: dimensionsStr,
    dimensionsIn: dims && typeof dims === 'object' ? dims : undefined,
    transportMode: parseTransportMode(row.transport_mode),
    declaredValue: row.declared_value,
    specialRequirements: row.special_instructions,
    specialInstructions: row.special_instructions,
    pricing: row.pricing_json ? JSON.parse(row.pricing_json) : undefined,
    internalNotes: includeInternalNotes ? row.internal_notes : undefined,
    convertedShipmentId: row.converted_shipment_id || undefined
  };
}

// GET /api/quotes (All quotes) — admin only. This returns EVERY customer's full quote
// request (contact info, cargo, pricing, internal notes) — previously had no auth at all,
// and was being fetched in full by the public site's own quote-lookup search (see the fix in
// App.tsx alongside this change), meaning any visitor's browser downloaded every other
// customer's quote data just by searching for a quote ID.
quotesRouter.get('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM quote_requests ORDER BY created_at_ts DESC').all();
    const quotes = rows.map(r => formatQuote(r));
    res.json({ success: true, count: quotes.length, data: quotes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/quotes/:id — intentionally public/unauthenticated: this is what the "look up my
// quote" flow on the public site now calls (a customer who has their own quote ID looking up
// their own submission), scoped to exactly one record instead of the full list. Strips
// internalNotes (admin-only notes about the customer, not the customer's own data).
quotesRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(req.params.id as string);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Quote request not found' });
    }
    res.json({ success: true, data: formatQuote(row, false) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotes (Create quote request from public form) — rate-limited, no session to
// gate this behind.
quotesRouter.post('/', publicWriteLimiter, (req: Request, res: Response) => {
  try {
    const q = req.body;
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const id = q.id || `QR-2026-${randomSuffix}`;
    const createdAt = `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const customerName = q.customerName || q.requesterName || 'Prospective Customer';
    const customerEmail = q.customerEmail || q.requesterEmail || 'client@example.com';
    const customerPhone = q.customerPhone || q.requesterPhone || '';
    const company = q.company || q.requesterCompany || null;
    const origin = q.origin || { city: q.originCity || '', state: q.originState || '', postalCode: q.originZip || '' };
    const destination = q.destination || { city: q.destCity || '', state: q.destState || '', postalCode: q.destZip || '' };
    const service = q.service || q.requestedService || 'Standard';
    const shipmentType = q.shipmentType || q.cargoType || 'Parcel';
    const cargoDescription = q.cargoDescription || 'Commercial Freight Cargo';
    const weightLbs = q.weightLbs || q.totalWeightLbs || 10;
    const pieces = q.pieces || q.quantity || 1;
    const dimensions = q.dimensions || { length: 12, width: 12, height: 12 };
    const declaredValue = q.declaredValue || 0;
    const specialInstructions = q.specialInstructions || q.specialRequirements || null;

    db.prepare(`
      INSERT INTO quote_requests (
        id, created_at, status, customer_name, customer_email, customer_phone,
        company, origin_json, destination_json, service, shipment_type,
        cargo_description, weight_lbs, pieces, dimensions_json, declared_value,
        special_instructions, pricing_json, internal_notes, created_at_ts, transport_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      createdAt,
      'NEW',
      customerName,
      customerEmail,
      customerPhone,
      company,
      JSON.stringify(origin),
      JSON.stringify(destination),
      service,
      shipmentType,
      cargoDescription,
      weightLbs,
      pieces,
      JSON.stringify(dimensions),
      declaredValue,
      specialInstructions,
      null,
      null,
      Date.now(),
      parseTransportMode(q.transportMode) ?? null
    );

    const created = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatQuote(created) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT & PATCH /api/quotes/:id/publish (Publish final pricing)
const publishHandler = (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { pricing, internalNotes } = req.body;

    const row = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: `Quote request ${id} not found` });
    }

    const updatedPricing = {
      ...pricing,
      publishedAt: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };

    db.prepare(`
      UPDATE quote_requests SET
        status = 'RATE_PUBLISHED',
        pricing_json = ?,
        internal_notes = COALESCE(?, internal_notes)
      WHERE id = ?
    `).run(JSON.stringify(updatedPricing), internalNotes || null, id);

    const updated = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    res.json({ success: true, data: formatQuote(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
quotesRouter.put('/:id/publish', requireAdminAuth, publishHandler);
quotesRouter.patch('/:id/publish', requireAdminAuth, publishHandler);

// PATCH /api/quotes/:id/status (Record customer decision / re-open / mark under review)
//
// Deliberately NOT fully gated behind requireAdminAuth: PublicQuoteResultPage.tsx calls this
// so a real customer can Accept/Decline their own quote from the public result page. There's
// no per-customer ownership check on a quote ID (same bearer-ID trust model this whole app
// already uses for tracking numbers), so an unauthenticated caller is restricted to ONLY the
// two statuses a customer should ever legitimately set on their own quote — everything else
// (re-opening, marking under review, force-expiring) requires an admin session.
const VALID_QUOTE_STATUSES = new Set([
  'NEW', 'UNDER_REVIEW', 'QUOTE_PUBLISHED', 'RATE_PUBLISHED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED'
]);
const PUBLIC_SETTABLE_QUOTE_STATUSES = new Set(['ACCEPTED', 'DECLINED']);
quotesRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, validUntil } = req.body;

    if (!VALID_QUOTE_STATUSES.has(status)) {
      return res.status(400).json({ success: false, error: `Invalid quote status: ${status}` });
    }

    if (!req.session?.isAdmin && !PUBLIC_SETTABLE_QUOTE_STATUSES.has(status)) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const row: any = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: `Quote request ${id} not found` });
    }

    // A customer can only answer a quote that is on offer (the same rule as the public page's
    // Accept button), so a quote that is unpriced, expired, declined or booked can't be flipped.
    if (!req.session?.isAdmin && row.status !== 'QUOTE_PUBLISHED' && row.status !== 'RATE_PUBLISHED') {
      return res.status(409).json({ success: false, error: 'This quote is no longer open.' });
    }

    // Re-opening an expired quote previously left its old validUntil date frozen in the
    // past — the moment it was reopened it was already stale/expired again. The client
    // computes a fresh date (today + the configured quote validity window) and sends it
    // here to merge into the persisted pricing blob. Admin only: a customer can't extend a price.
    if (validUntil && row.pricing_json && req.session?.isAdmin) {
      const pricing = JSON.parse(row.pricing_json);
      pricing.validUntil = validUntil;
      db.prepare('UPDATE quote_requests SET status = ?, pricing_json = ? WHERE id = ?').run(status, JSON.stringify(pricing), id);
    } else {
      db.prepare('UPDATE quote_requests SET status = ? WHERE id = ?').run(status, id);
    }

    const updated = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    res.json({ success: true, data: formatQuote(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotes/:id/convert (Convert quote to live active shipment)
//
// The client (AdminDataContext.convertQuoteToShipment) sends the richer shipment details it
// built (geocoded origin/destination, sender, recipient, cargo), which are persisted as sent.
// The tracking ID is always generated here, since the server is the authority
// (BRAND_GUIDE §7), and returned for the client to adopt.
quotesRouter.post('/:id/convert', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const quoteRow: any = db.prepare('SELECT * FROM quote_requests WHERE id = ?').get(id);
    if (!quoteRow) {
      return res.status(404).json({ success: false, error: `Quote request ${id} not found` });
    }

    const q = formatQuote(quoteRow)!;
    const s = req.body && typeof req.body === 'object' ? req.body : {};
    const trackingNumber = generateUniqueTrackingId();
    const createdAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // The quote's raw stored dimensions (an object, e.g. {length,width,height}) — formatQuote()
    // flattens q.dimensions into a display string ("12 × 12 × 12 in") for the quote UI, which
    // must never be reused here as the shipment's structured dimensions_json.
    let rawQuoteDims: any = {};
    try { rawQuoteDims = quoteRow.dimensions_json ? JSON.parse(quoteRow.dimensions_json) : {}; } catch { rawQuoteDims = {}; }
    if (!rawQuoteDims || typeof rawQuoteDims !== 'object' || Array.isArray(rawQuoteDims)) rawQuoteDims = {};

    const origin = s.origin && typeof s.origin === 'object' ? s.origin : q.origin;
    const destination = s.destination && typeof s.destination === 'object' ? s.destination : q.destination;
    const sender = s.sender && typeof s.sender === 'object' ? s.sender : {
      name: q.customerName,
      company: q.company || '',
      phone: q.customerPhone,
      email: q.customerEmail,
      city: q.origin.city,
      state: q.origin.state,
      postalCode: q.origin.postalCode || ''
    };
    const recipient = s.recipient && typeof s.recipient === 'object' ? s.recipient : {
      name: q.recipientName,
      city: q.destination.city,
      state: q.destination.state,
      postalCode: q.destination.postalCode || ''
    };
    const dimensions = s.dimensions && typeof s.dimensions === 'object' ? s.dimensions : rawQuoteDims;

    // 1. Create shipment
    db.prepare(`
      INSERT INTO shipments (
        tracking_number, barcode_code, status, status_text, progress_percent,
        last_updated, created_at, estimated_delivery_date, estimated_delivery_time,
        service, shipment_type, cargo_description, total_weight_lbs, total_pieces,
        declared_value, origin_city, origin_state, origin_lat, origin_lng,
        destination_city, destination_state, destination_lat, destination_lng,
        current_location_city, current_location_state, current_location_lat, current_location_lng,
        current_facility, sender_json, recipient_json, dimensions_json, progress_updated_at_ts,
        created_at_ts, transport_mode
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      trackingNumber,
      `*${trackingNumber}*`,
      'RECEIVED',
      'Consignment Registered (Converted from Quote)',
      15,
      'Just now',
      createdAt,
      'August 25, 2026',
      'by 5:00 PM',
      s.service || q.service,
      s.shipmentType || q.shipmentType,
      s.cargoDescription || q.cargoDescription,
      s.totalWeightLbs !== undefined ? s.totalWeightLbs : q.weightLbs,
      s.totalPieces !== undefined ? s.totalPieces : q.pieces,
      s.declaredValue !== undefined ? s.declaredValue : (q.declaredValue || 0),
      origin.city || 'New York',
      origin.state || '',
      origin.lat || 40.7128, origin.lng || -74.006,
      destination.city || 'Los Angeles',
      destination.state || '',
      destination.lat || 34.0522, destination.lng || -118.2437,
      origin.city || 'New York',
      origin.state || '',
      origin.lat || 40.7128, origin.lng || -74.006,
      origin.facility || 'Origin Gateway Hub',
      JSON.stringify(sender),
      JSON.stringify(recipient),
      JSON.stringify(dimensions && Object.keys(dimensions).length ? dimensions : { length: 12, width: 12, height: 12 }),
      Date.now(),
      Date.now(),
      parseTransportMode(s.transportMode) ?? parseTransportMode(quoteRow.transport_mode) ?? null
    );

    // 2. Create pieces
    db.prepare(`
      INSERT INTO shipment_pieces (
        id, tracking_number, parent_tracking, piece_number, total_pieces,
        status, status_text, current_location, weight_lbs, dimensions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${trackingNumber}-P01`,
      pieceLabel(trackingNumber, 1),
      trackingNumber,
      1,
      1,
      'RECEIVED',
      'Consignment Registered',
      `${origin.city}, ${origin.state}`,
      s.totalWeightLbs !== undefined ? s.totalWeightLbs : q.weightLbs,
      JSON.stringify(dimensions && Object.keys(dimensions).length ? dimensions : {})
    );

    // 3. Create initial event
    const originLabel = `${origin.city}, ${origin.state}`;
    const createdTime = eventTime(originLabel, { lat: origin.lat, lng: origin.lng });
    db.prepare(`
      INSERT INTO tracking_events (
        id, shipment_tracking, status, title, location, facility,
        timestamp, description, operator_notes, delay_flag, completed, current_flag, sort_order,
        occurred_at_ts, time_zone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `e-${Date.now()}`,
      trackingNumber,
      'RECEIVED',
      'Consignment Registered from Rate Quote',
      originLabel,
      'Origin Gateway',
      createdTime.timestamp,
      `Consignment generated from approved quote ${q.id}. Linear Code 128 barcode assigned.`,
      `Converted by ${ADMIN_ROLE_LABEL}. Tariff: ${q.pricing?.finalPrice || '350.00'}`,
      0, 1, 1, 1,
      createdTime.occurredAtTs, createdTime.timeZone
    );

    // 4. Mark the quote CONVERTED (the actual terminal status for this action — it previously
    // wrote 'ACCEPTED' here while the admin UI's optimistic update showed 'CONVERTED', so the
    // two silently diverged on the next refetch) and record the resulting shipment's tracking
    // number so the quote detail view can link back to it after a reload.
    db.prepare(`UPDATE quote_requests SET status = 'CONVERTED', converted_shipment_id = ? WHERE id = ?`).run(trackingNumber, id);

    const createdShipment = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(trackingNumber);
    res.status(201).json({ success: true, trackingNumber, data: createdShipment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
