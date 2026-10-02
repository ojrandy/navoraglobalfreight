import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { syncTimeBasedProgress, shipmentTransportMode } from '../progress.js';
import { eventTime } from '../eventTime.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { publicWriteLimiter } from '../middleware/rateLimit.js';
import { generateUniqueTrackingId } from '../trackingIds.js';
import { parseTrackingInput, pieceLabel } from '../../src/shared/trackingId.js';
import { COMPANY_SHORT } from '../../src/config/brand.js';
import { eventTimeDisplay } from '../../src/shared/timeZones.js';
import { parseTransportMode } from '../../src/shared/transportMode.js';
import { shipmentStatusLabel } from '../../src/shared/shipmentStatus.js';

export const shipmentsRouter = Router();

// Splits a stored "City, ST" location string into separate fields — the DB only
// stores the combined string, but several frontend views render city/state separately.
function splitLocation(location: string): { city: string; state: string } {
  const parts = (location || '').split(',').map((s: string) => s.trim());
  return { city: parts[0] || '', state: parts[1] || '' };
}

// Helper to format shipment row from DB to JSON model
function formatShipment(row: any) {
  if (!row) return null;

  // Advance progress based on real elapsed time before formatting, so it moves forward
  // whether or not an admin session is open (persists back to the DB inside this call).
  row.progress_percent = syncTimeBasedProgress(row);

  const piecesStmt = db.prepare('SELECT * FROM shipment_pieces WHERE parent_tracking = ? ORDER BY piece_number ASC');
  const pieces = piecesStmt.all(row.tracking_number).map((p: any) => ({
    id: p.id,
    trackingNumber: p.tracking_number,
    pieceNumber: p.piece_number,
    totalPieces: p.total_pieces,
    status: p.status,
    statusText: p.status_text,
    currentLocation: p.current_location,
    weightLbs: p.weight_lbs,
    dimensions: JSON.parse(p.dimensions_json || '{}')
  }));

  const eventsStmt = db.prepare('SELECT * FROM tracking_events WHERE shipment_tracking = ? ORDER BY sort_order ASC, timestamp ASC');
  const events = eventsStmt.all(row.tracking_number).map((e: any) => ({
    id: e.id,
    status: e.status,
    eventStatus: e.status,
    title: e.title,
    location: e.location,
    ...splitLocation(e.location),
    // Local time where the event happened + UTC offset; older rows keep their stored text.
    ...eventTimeDisplay(e.timestamp, e.occurred_at_ts, e.time_zone),
    occurredAt: e.occurred_at_ts ? new Date(e.occurred_at_ts).toISOString() : undefined,
    facility: e.facility,
    timestamp: e.timestamp,
    description: e.description,
    operatorNotes: e.operator_notes,
    internalNote: e.operator_notes || undefined,
    recordedBy: e.recorded_by || undefined,
    correctionAudit: e.correction_audit_json ? JSON.parse(e.correction_audit_json) : undefined,
    delayFlag: Boolean(e.delay_flag),
    completed: Boolean(e.completed),
    current: Boolean(e.current_flag)
  }));

  return {
    trackingNumber: row.tracking_number,
    barcodeCode: row.barcode_code,
    status: row.status,
    statusText: row.status_text,
    progressPercent: row.progress_percent,
    lastUpdated: row.last_updated,
    createdAt: row.created_at,
    createdAtTs: row.created_at_ts || undefined,
    estimatedDelivery: {
      date: row.estimated_delivery_date,
      timeWindow: row.estimated_delivery_time
    },
    service: row.service,
    shipmentType: row.shipment_type,
    transportMode: shipmentTransportMode(row),
    cargoDescription: row.cargo_description,
    totalWeightLbs: row.total_weight_lbs,
    totalPieces: row.total_pieces,
    declaredValue: row.declared_value,
    origin: {
      city: row.origin_city,
      state: row.origin_state,
      lat: row.origin_lat,
      lng: row.origin_lng
    },
    destination: {
      city: row.destination_city,
      state: row.destination_state,
      lat: row.destination_lat,
      lng: row.destination_lng
    },
    currentLocation: {
      city: row.current_location_city,
      state: row.current_location_state,
      lat: row.current_location_lat,
      lng: row.current_location_lng,
      facility: row.current_facility
    },
    sender: JSON.parse(row.sender_json || '{}'),
    recipient: JSON.parse(row.recipient_json || '{}'),
    dimensions: JSON.parse(row.dimensions_json || '{}'),
    vehicleDetails: row.vehicle_json ? JSON.parse(row.vehicle_json) : undefined,
    petDetails: row.pet_json ? JSON.parse(row.pet_json) : undefined,
    palletDetails: row.pallet_json ? JSON.parse(row.pallet_json) : undefined,
    containerDetails: row.container_json ? JSON.parse(row.container_json) : undefined,
    freightDetails: row.freight_json ? JSON.parse(row.freight_json) : undefined,
    documentDetails: row.document_json ? JSON.parse(row.document_json) : undefined,
    references: row.references_json ? JSON.parse(row.references_json) : undefined,
    cargoCategory: row.cargo_category || (row.shipment_type === 'Vehicle' ? 'Automotive & Parts' : 'General Freight'),
    photos: row.photos_json ? JSON.parse(row.photos_json) : undefined,
    handlingRequirements: row.handling_requirements_json ? JSON.parse(row.handling_requirements_json) : undefined,
    pickupWindow: row.pickup_window || undefined,
    internalPricingNote: row.internal_pricing_note || undefined,
    returnLeg: row.return_leg_json ? JSON.parse(row.return_leg_json) : undefined,
    returnOf: row.return_of_tracking || undefined,
    pieces,
    events
  };
}

// GET /api/shipments (All consignments with optional search & filter) — admin only, unmasked.
// Excludes soft-deleted shipments by default; pass ?trash=true to see the recoverable trash
// list instead (see DELETE below — nothing here is ever hard-deleted by the admin UI anymore).
shipmentsRouter.get('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { search, status, trash } = req.query;
    const wantsTrash = trash === 'true';
    let query = 'SELECT * FROM shipments';
    const params: any[] = [];
    const conditions: string[] = [wantsTrash ? 'deleted_at_ts IS NOT NULL' : 'deleted_at_ts IS NULL'];

    if (status && status !== 'ALL') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      const term = `%${String(search).toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(tracking_number) LIKE ? OR
        LOWER(cargo_description) LIKE ? OR
        LOWER(origin_city) LIKE ? OR
        LOWER(destination_city) LIKE ?
      )`);
      params.push(term, term, term, term);
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += wantsTrash ? ' ORDER BY deleted_at_ts DESC' : ' ORDER BY created_at_ts DESC';

    const rows = db.prepare(query).all(...params);
    const shipments = rows.map(formatShipment);
    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shipments/:trackingNumber — admin only, unmasked (public lookups use /api/track/:id)
shipmentsRouter.get('/:trackingNumber', requireAdminAuth, (req: Request, res: Response) => {
  try {
    // Accepts "ngf 7k2-m9" and child labels (NGF7K2M9-01 -> NGF7K2M9); anything else is looked
    // up as typed, so records created before the NGF format can still be opened here.
    const raw = (req.params.trackingNumber as string).trim().toUpperCase();
    const tracking = parseTrackingInput(raw)?.trackingId ?? raw;
    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking) as any;

    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }

    res.json({ success: true, data: formatShipment(row) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shipments (Create new consignment) — deliberately NOT gated: this is the same
// endpoint the public booking flow (ShipPage.tsx -> api.submitPublicShipment) posts to, not
// just the admin's CreateShipmentView. Rate-limited instead, since nothing else stops this
// being scripted/spammed without a session requirement to fall back on.
shipmentsRouter.post('/', publicWriteLimiter, (req: Request, res: Response) => {
  try {
    const s = req.body;
    // The server is the authority on tracking IDs (BRAND_GUIDE §7): any trackingNumber in the
    // body is ignored and the ID comes back in the response for the client to adopt. This
    // route is public, so a caller must never be able to choose its own ID.
    const trackingNumber = generateUniqueTrackingId();
    const barcodeCode = `*${trackingNumber}*`;
    const createdAt = s.createdAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lastUpdated = 'Just now';

    const insertShipment = db.prepare(`
      INSERT INTO shipments (
        tracking_number, barcode_code, status, status_text, progress_percent,
        last_updated, created_at, estimated_delivery_date, estimated_delivery_time,
        service, shipment_type, cargo_description, total_weight_lbs, total_pieces,
        declared_value, origin_city, origin_state, origin_lat, origin_lng,
        destination_city, destination_state, destination_lat, destination_lng,
        current_location_city, current_location_state, current_location_lat, current_location_lng,
        current_facility, sender_json, recipient_json, dimensions_json,
        vehicle_json, pet_json, pallet_json, container_json, freight_json, document_json,
        references_json, cargo_category, photos_json,
        handling_requirements_json, pickup_window, internal_pricing_note,
        progress_updated_at_ts, created_at_ts, transport_mode
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    insertShipment.run(
      trackingNumber,
      barcodeCode,
      s.status || 'RECEIVED',
      s.statusText || shipmentStatusLabel(s.status || 'RECEIVED'),
      s.progressPercent || 15,
      lastUpdated,
      createdAt,
      s.estimatedDelivery?.date || s.estimatedDelivery || 'August 24, 2026',
      s.estimatedDelivery?.timeWindow || s.estimatedDeliveryDetail || 'by 5:00 PM',
      s.service || 'Standard',
      s.shipmentType || 'Parcel',
      s.cargoDescription || 'Consignment Cargo',
      s.totalWeightLbs || 10,
      s.totalPieces || 1,
      s.declaredValue || 0,
      s.origin?.city || 'New York',
      s.origin?.state || '',
      s.origin?.lat || 40.7128,
      s.origin?.lng || -74.006,
      s.destination?.city || 'Los Angeles',
      s.destination?.state || '',
      s.destination?.lat || 34.0522,
      s.destination?.lng || -118.2437,
      s.currentLocation?.city || s.origin?.city || 'New York',
      s.currentLocation?.state || s.origin?.state || '',
      s.currentLocation?.lat || s.origin?.lat || 40.7128,
      s.currentLocation?.lng || s.origin?.lng || -74.006,
      s.currentFacility || s.currentLocation?.facility || 'Intake Terminal',
      JSON.stringify(s.sender || {}),
      JSON.stringify(s.recipient || {}),
      JSON.stringify(s.dimensions || { length: 12, width: 12, height: 12 }),
      s.vehicleDetails ? JSON.stringify(s.vehicleDetails) : null,
      s.petDetails ? JSON.stringify(s.petDetails) : null,
      s.palletDetails ? JSON.stringify(s.palletDetails) : null,
      s.containerDetails ? JSON.stringify(s.containerDetails) : null,
      s.freightDetails ? JSON.stringify(s.freightDetails) : null,
      s.documentDetails ? JSON.stringify(s.documentDetails) : null,
      s.references ? JSON.stringify(s.references) : null,
      s.cargoCategory || (s.shipmentType === 'Vehicle' ? 'Automotive & Parts' : 'General Freight'),
      s.photos || s.vehicleDetails?.photos ? JSON.stringify(s.photos || s.vehicleDetails?.photos) : null,
      s.handlingRequirements ? JSON.stringify(s.handlingRequirements) : null,
      s.pickupWindow || null,
      s.internalPricingNote || null,
      Date.now(),
      // created_at_ts: always server-authoritative (never trust a client-supplied value —
      // that's exactly how "Today" as a literal string ended up in the display column and
      // broke sorting) so newest-first ordering is always reliably correct.
      Date.now(),
      // NULL when not given: the mode is then inferred from distance and cargo on read.
      parseTransportMode(s.transportMode) ?? null
    );

    // Insert Pieces
    const insertPiece = db.prepare(`
      INSERT INTO shipment_pieces (
        id, tracking_number, parent_tracking, piece_number, total_pieces,
        status, status_text, current_location, weight_lbs, dimensions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const pieces = (s.pieces && s.pieces.length > 0) ? s.pieces : [
      {
        id: '01',
        trackingNumber: `${trackingNumber}-01`,
        pieceNumber: 1,
        totalPieces: 1,
        status: s.status || 'RECEIVED',
        statusText: shipmentStatusLabel(s.status || 'RECEIVED'),
        currentLocation: [s.origin?.city || 'New York', s.origin?.state].filter(Boolean).join(', '),
        weightLbs: s.totalWeightLbs || 10,
        dimensions: s.dimensions || { length: 12, width: 12, height: 12 }
      }
    ];

    for (const p of pieces) {
      const pieceNum = p.pieceNumber || 1;
      const pieceId = `${trackingNumber}-P${pieceNum}`;
      insertPiece.run(
        pieceId,
        pieceLabel(trackingNumber, pieceNum),
        trackingNumber,
        pieceNum,
        p.totalPieces || pieces.length,
        p.status || s.status || 'RECEIVED',
        p.statusText || shipmentStatusLabel(p.status || 'RECEIVED'),
        p.currentLocation || [s.origin?.city || 'New York', s.origin?.state].filter(Boolean).join(', '),
        p.weightLbs || (s.totalWeightLbs ? s.totalWeightLbs / pieces.length : 10),
        JSON.stringify(p.dimensions || s.dimensions || {})
      );
    }

    // Insert Initial Event
    const insertEvent = db.prepare(`
      INSERT INTO tracking_events (
        id, shipment_tracking, status, title, location, facility,
        timestamp, description, operator_notes, delay_flag, completed, current_flag, sort_order,
        occurred_at_ts, time_zone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const originLabel = [s.origin?.city || 'New York', s.origin?.state].filter(Boolean).join(', ');
    const createdTime = eventTime(originLabel, { lat: s.origin?.lat, lng: s.origin?.lng });
    insertEvent.run(
      `e-${Date.now()}`,
      trackingNumber,
      s.status || 'RECEIVED',
      'Consignment Registered & Barcode Issued',
      originLabel,
      s.currentLocation?.facility || 'Intake Gateway',
      createdTime.timestamp,
      `Shipment received into the ${COMPANY_SHORT} network. Linear Code 128 barcode assigned.`,
      'Initial entry scan.',
      0, 1, 1, 1,
      createdTime.occurredAtTs, createdTime.timeZone
    );

    const createdRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(trackingNumber);
    res.status(201).json({ success: true, data: formatShipment(createdRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/shipments/:trackingNumber/status (Quick update)
shipmentsRouter.patch('/:trackingNumber/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const newStatus = req.body.newStatus || req.body.status;
    const { location, facility, notes, progressPercent, statusText: statusTextOverride, lat, lng, eventTitle, skipEventCreation, estimatedDeliveryDate, estimatedDeliveryTime } = req.body;

    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }

    // Default progress/statusText per status, used only when the caller doesn't already
    // know a better value. The Operations Control modal computes a richer statusText
    // (with hold/delay reason, hub name, etc.) and its own progress via planningEngine.ts —
    // when it sends those, honor them instead of clobbering them with these generic defaults.
    // Status names come from CONTENT §6.3 (src/shared/shipmentStatus.ts).
    const DEFAULT_PROGRESS: Record<string, number> = {
      CREATED: 5, BOOKED: 5, RECEIVED: 15, PROCESSING: 25, PROCESSED: 35, DEPARTED_FACILITY: 45,
      EXCEPTION: 50, IN_TRANSIT: 60, AT_FACILITY: 65, DESTINATION_PROCESSING: 75,
      CUSTOMS_CLEARANCE: 80, OUT_FOR_DELIVERY: 85, DELIVERED: 100,
    };
    const keepsProgress = newStatus === 'ON_HOLD' || newStatus === 'DELAYED' || newStatus === 'RETURNED';
    let progress = keepsProgress ? (row as any).progress_percent : (DEFAULT_PROGRESS[newStatus] ?? 15);
    let statusText = shipmentStatusLabel(newStatus);

    if (typeof progressPercent === 'number' && !isNaN(progressPercent)) {
      progress = Math.max(0, Math.min(100, progressPercent));
    }
    if (typeof statusTextOverride === 'string' && statusTextOverride.trim()) {
      statusText = statusTextOverride.trim();
    }

    // Parse location
    const [city, state] = (location || 'Transit Hub').split(',').map((s: string) => s.trim());

    // Update shipment. progress_updated_at_ts resets to now so the real-time auto-advance
    // (syncTimeBasedProgress) restarts its clock from this admin-set value instead of
    // compounding on top of whatever stale timestamp was last recorded.
    //
    // current_location_lat/lng previously had NO update path at all outside of shipment
    // creation — every status change since then only touched the city/state TEXT columns,
    // so "current location" coordinates silently froze at whatever they were on day one
    // while the city/state label kept changing. That's how a shipment marked "At Facility:
    // Denver, CO" ended up still carrying its origin's exact coordinates, and the tracking
    // map (which does its own separate percentage-based placement) compounded the problem.
    // Only overwrite them when the caller actually supplies real numbers, so a plain
    // city/state-only update (e.g. from Tracking Events, which doesn't resolve coordinates
    // yet — see Phase 2) doesn't blow away a previously-correct pair with NULL.
    const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
    // A Hold/Delay pushes the estimated delivery date/time out (planningEngine.ts computes the
    // new values and this route is the only write path for a status change) — without
    // persisting them here, the pushed-back ETA only ever existed in the admin's local browser
    // state and silently reverted to the shipment's original ETA on the next refresh, and never
    // reached the public tracking page at all.
    const hasEstDeliveryDate = typeof estimatedDeliveryDate === 'string' && estimatedDeliveryDate.trim();
    const hasEstDeliveryTime = typeof estimatedDeliveryTime === 'string' && estimatedDeliveryTime.trim();
    db.prepare(`
      UPDATE shipments SET
        status = ?,
        status_text = ?,
        progress_percent = ?,
        last_updated = 'Just now',
        current_location_city = COALESCE(?, current_location_city),
        current_location_state = COALESCE(?, current_location_state),
        current_location_lat = COALESCE(?, current_location_lat),
        current_location_lng = COALESCE(?, current_location_lng),
        current_facility = COALESCE(?, current_facility),
        estimated_delivery_date = COALESCE(?, estimated_delivery_date),
        estimated_delivery_time = COALESCE(?, estimated_delivery_time),
        progress_updated_at_ts = ?
      WHERE tracking_number = ?
    `).run(
      newStatus, statusText, progress,
      city || null, state || null,
      hasCoords ? lat : null, hasCoords ? lng : null,
      facility || null,
      hasEstDeliveryDate ? estimatedDeliveryDate.trim() : null,
      hasEstDeliveryTime ? estimatedDeliveryTime.trim() : null,
      Date.now(), tracking
    );

    // Some callers (e.g. Tracking Events' "Record Event" form) already persisted a real,
    // specific event for this exact action via a separate POST /events call before hitting
    // this route just to sync status/progress/location — inserting another one here made
    // every such action create two near-identical rows. skipEventCreation lets that caller
    // opt out of a second insert entirely.
    if (!skipEventCreation) {
      // Clear old current_flag in events
      db.prepare('UPDATE tracking_events SET current_flag = 0 WHERE shipment_tracking = ?').run(tracking);

      // Count existing events for sort_order
      const eventCount = (db.prepare('SELECT COUNT(*) as count FROM tracking_events WHERE shipment_tracking = ?').get(tracking) as any).count;

      // Add new event — eventTitle carries a specific, action-built description (e.g.
      // Operations Control's "Physical checkpoint scan confirmed at Rocky Mountain Gateway")
      // when the caller has one; otherwise falls back to the generic status label exactly as
      // before, so callers that never had a richer title (like Tracking Events, which always
      // skips this block) are unaffected.
      const statusTime = eventTime(location || '', hasCoords ? { lat, lng } : {});
      db.prepare(`
        INSERT INTO tracking_events (
          id, shipment_tracking, status, title, location, facility,
          timestamp, description, operator_notes, delay_flag, completed, current_flag, sort_order,
          occurred_at_ts, time_zone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `e-${Date.now()}`,
        tracking,
        newStatus,
        eventTitle || statusText,
        location || 'Regional Transit Gateway',
        facility || `${COMPANY_SHORT} Facility`,
        statusTime.timestamp,
        notes || `Status transitioned to ${newStatus}.`,
        notes || null,
        newStatus === 'EXCEPTION' ? 1 : 0,
        1, 1, eventCount + 1,
        statusTime.occurredAtTs, statusTime.timeZone
      );
    }

    const updatedRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking);
    res.json({ success: true, data: formatShipment(updatedRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shipments/:trackingNumber/return (Return to origin)
//
// A return gets its own new NGF ID, linked to the original (BRAND_GUIDE §7). It's created here
// as a real shipment row so the return is stored, trackable publicly and covered by the same
// uniqueness check as every other ID: origin/destination and sender/recipient are swapped,
// pieces are relabelled, and each side records the link (return_leg_json / return_of_tracking).
shipmentsRouter.post('/:trackingNumber/return', requireAdminAuth, (req: Request, res: Response) => {
  const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
  const operator = typeof req.body?.operator === 'string' && req.body.operator.trim() ? req.body.operator.trim().slice(0, 80) : 'Administrator';
  if (!reason) {
    return res.status(400).json({ success: false, error: 'A return reason is required.' });
  }

  let inTransaction = false;
  try {
    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }
    if (row.return_leg_json) {
      const existing = JSON.parse(row.return_leg_json);
      return res.status(409).json({ success: false, error: `Shipment ${tracking} already has a return (${existing.returnTrackingNumber}).` });
    }
    if (row.return_of_tracking) {
      return res.status(409).json({ success: false, error: `${tracking} is itself a return of ${row.return_of_tracking}.` });
    }

    const now = Date.now();
    const nowDate = new Date(now);
    const currentLabel = [row.current_location_city, row.current_location_state].filter(Boolean).join(', ') || `${row.destination_city}, ${row.destination_state}`;
    const returnTime = eventTime(currentLabel, { occurredAt: now, lat: row.current_location_lat, lng: row.current_location_lng });
    const timestamp = returnTime.timestamp;

    db.exec('BEGIN');
    inTransaction = true;

    const returnId = generateUniqueTrackingId();

    // The return starts where the parcel is now and heads back to the original origin.
    db.prepare(`
      INSERT INTO shipments (
        tracking_number, barcode_code, status, status_text, progress_percent,
        last_updated, created_at, estimated_delivery_date, estimated_delivery_time,
        service, shipment_type, cargo_description, total_weight_lbs, total_pieces,
        declared_value, origin_city, origin_state, origin_lat, origin_lng,
        destination_city, destination_state, destination_lat, destination_lng,
        current_location_city, current_location_state, current_location_lat, current_location_lng,
        current_facility, sender_json, recipient_json, dimensions_json,
        vehicle_json, pet_json, pallet_json, container_json, freight_json, document_json,
        references_json, cargo_category, handling_requirements_json,
        return_of_tracking, progress_updated_at_ts, created_at_ts
      )
      SELECT
        ?, ?, 'RECEIVED', ?, 5,
        'Just now', ?, 'To be confirmed', '',
        service, shipment_type, cargo_description, total_weight_lbs, total_pieces,
        declared_value, destination_city, destination_state, destination_lat, destination_lng,
        origin_city, origin_state, origin_lat, origin_lng,
        current_location_city, current_location_state, current_location_lat, current_location_lng,
        current_facility, recipient_json, sender_json, dimensions_json,
        vehicle_json, pet_json, pallet_json, container_json, freight_json, document_json,
        references_json, cargo_category, handling_requirements_json,
        tracking_number, ?, ?
      FROM shipments WHERE tracking_number = ?
    `).run(
      returnId, `*${returnId}*`, `Return registered (${reason})`,
      nowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      now, now, tracking
    );

    const pieces = db.prepare('SELECT * FROM shipment_pieces WHERE parent_tracking = ? ORDER BY piece_number ASC').all(tracking) as any[];
    const insertPiece = db.prepare(`
      INSERT INTO shipment_pieces (
        id, tracking_number, parent_tracking, piece_number, total_pieces,
        status, status_text, current_location, weight_lbs, dimensions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of pieces) {
      insertPiece.run(
        `${returnId}-P${p.piece_number}`, pieceLabel(returnId, p.piece_number), returnId,
        p.piece_number, p.total_pieces, 'RECEIVED', 'Return registered', currentLabel,
        p.weight_lbs, p.dimensions_json
      );
    }

    const insertEvent = db.prepare(`
      INSERT INTO tracking_events (
        id, shipment_tracking, status, title, location, facility,
        timestamp, description, operator_notes, delay_flag, completed, current_flag, sort_order, recorded_by,
        occurred_at_ts, time_zone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEvent.run(
      `e-${now}-r`, returnId, 'RECEIVED', 'Return Shipment Registered', currentLabel,
      row.current_facility || `${COMPANY_SHORT} Facility`, timestamp,
      `Return of ${tracking} to the sender at ${row.origin_city}, ${row.origin_state} (${reason}).`,
      null, 0, 1, 1, 1, operator, returnTime.occurredAtTs, returnTime.timeZone
    );

    const returnLeg = {
      returnTrackingNumber: returnId,
      originalTrackingNumber: tracking,
      returnInitiatedDate: timestamp,
      reason,
      origin: { city: row.destination_city, state: row.destination_state, country: '' },
      destination: { city: row.origin_city, state: row.origin_state, country: '' },
      status: 'RECEIVED',
      timeline: []
    };

    db.prepare(`
      UPDATE shipments SET status = 'RETURNED', status_text = ?, last_updated = 'Just now',
        return_leg_json = ?, progress_updated_at_ts = ?
      WHERE tracking_number = ?
    `).run(`${shipmentStatusLabel('RETURNED')} (${reason})`, JSON.stringify(returnLeg), now, tracking);

    db.prepare('UPDATE tracking_events SET current_flag = 0 WHERE shipment_tracking = ?').run(tracking);
    const eventCount = (db.prepare('SELECT COUNT(*) as count FROM tracking_events WHERE shipment_tracking = ?').get(tracking) as any).count;
    insertEvent.run(
      `e-${now}`, tracking, 'RETURNED', `${shipmentStatusLabel('RETURNED')}: ${reason}`, currentLabel,
      row.current_facility || `${COMPANY_SHORT} Facility`, timestamp,
      `Original journey concluded (${reason}). Returning to the sender at ${row.origin_city}, ${row.origin_state} under tracking ID ${returnId}.`,
      null, 1, 1, 1, eventCount + 1, operator, returnTime.occurredAtTs, returnTime.timeZone
    );

    db.exec('COMMIT');
    inTransaction = false;

    const original = formatShipment(db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking));
    const returnShipment = formatShipment(db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(returnId));
    res.status(201).json({ success: true, data: { original, returnShipment } });
  } catch (err: any) {
    if (inTransaction) db.exec('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shipments/:trackingNumber/events (Add tracking event)
shipmentsRouter.post('/:trackingNumber/events', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const e = req.body;

    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }

    db.prepare('UPDATE tracking_events SET current_flag = 0 WHERE shipment_tracking = ?').run(tracking);

    const eventCount = (db.prepare('SELECT COUNT(*) as count FROM tracking_events WHERE shipment_tracking = ?').get(tracking) as any).count;

    const eventLocation = e.location || (e.city && e.state ? `${e.city}, ${e.state}` : (e.city || 'Sorting Facility'));
    // The instant and IANA zone come from the caller when it has them (TrackingEventsView's
    // Add Event form lets the admin pick an exact date, time and zone); otherwise it's now, in
    // the event location's own zone. Browser-formatted displayDate/displayTime strings are no
    // longer stored, as they carried the admin's own clock rather than the location's.
    const time = eventTime(eventLocation, { occurredAt: e.occurredAt, timeZone: e.timeZone ?? e.timezone });

    db.prepare(`
      INSERT INTO tracking_events (
        id, shipment_tracking, status, title, location, facility,
        timestamp, description, operator_notes, delay_flag, completed, current_flag, sort_order,
        recorded_by, occurred_at_ts, time_zone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      e.id || `e-${Date.now()}`,
      tracking,
      e.status || e.eventStatus || 'IN_TRANSIT',
      e.title || 'Checkpoint Scan Verified',
      eventLocation,
      e.facility || 'Gateway Hub',
      time.timestamp,
      e.description || 'Barcode scanned and verified.',
      e.internalNote || e.operatorNotes || null,
      e.delayFlag ? 1 : 0,
      1, 1, eventCount + 1,
      e.recordedBy || null,
      time.occurredAtTs, time.timeZone
    );

    // Also update shipment status if provided
    if (e.status) {
      db.prepare(`
        UPDATE shipments SET
          status = ?,
          status_text = ?,
          last_updated = 'Just now',
          current_facility = COALESCE(?, current_facility)
        WHERE tracking_number = ?
      `).run(e.status, e.title || e.status, e.facility || null, tracking);
    }

    const updatedRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking);
    res.status(201).json({ success: true, data: formatShipment(updatedRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/shipments/:trackingNumber/events/:eventId (Correct an existing tracking event)
//
// The "Edit / Correct Tracking Event" modal previously only mutated the shipment object
// directly in local React state with no backend call at all — the correction looked saved
// but vanished on the next refetch. This persists the correction and records what changed.
shipmentsRouter.patch('/:trackingNumber/events/:eventId', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const { eventId } = req.params as { eventId: string };
    const e = req.body || {};

    const eventRow: any = db.prepare('SELECT * FROM tracking_events WHERE id = ? AND shipment_tracking = ?').get(eventId, tracking);
    if (!eventRow) {
      return res.status(404).json({ success: false, error: `Tracking event ${eventId} not found on shipment ${tracking}` });
    }

    const newLocation = (e.city || e.state)
      ? `${e.city || eventRow.location.split(',')[0]?.trim() || ''}, ${e.state || eventRow.location.split(',')[1]?.trim() || ''}`
      : eventRow.location;
    // A corrected instant or zone re-formats the event in that zone; a location-only correction
    // keeps the event's instant and zone. Rows from before IANA zones with only display text
    // (no instant) keep accepting a display-text correction.
    let occurredAtTs: number | null = eventRow.occurred_at_ts ?? null;
    let timeZone: string | null = eventRow.time_zone ?? null;
    let newTimestamp: string = eventRow.timestamp;
    // Re-format from an instant only when there is one (sent, or already stored): an older row
    // with display text only must not be reset to "now" by a zone-only correction.
    if (e.occurredAt || (eventRow.occurred_at_ts && (e.timeZone || e.timezone))) {
      const corrected = eventTime(newLocation, {
        occurredAt: e.occurredAt ?? eventRow.occurred_at_ts ?? undefined,
        timeZone: e.timeZone ?? e.timezone ?? eventRow.time_zone ?? undefined
      });
      occurredAtTs = corrected.occurredAtTs;
      timeZone = corrected.timeZone;
      newTimestamp = corrected.timestamp;
    } else if (e.displayDate && e.displayTime) {
      newTimestamp = `${e.displayDate} · ${e.displayTime}`;
      occurredAtTs = null;
      timeZone = null;
    }

    db.prepare(`
      UPDATE tracking_events SET
        location = ?,
        timestamp = ?,
        occurred_at_ts = ?,
        time_zone = ?,
        description = COALESCE(?, description),
        correction_audit_json = ?
      WHERE id = ? AND shipment_tracking = ?
    `).run(
      newLocation,
      newTimestamp,
      occurredAtTs,
      timeZone,
      e.description || null,
      e.correctionAudit ? JSON.stringify(e.correctionAudit) : eventRow.correction_audit_json,
      eventId,
      tracking
    );

    // If this was the shipment's current/latest event, reflect the correction on the
    // shipment's own currentLocation/lastUpdated too, same as the original (broken) client
    // behavior intended.
    if (eventRow.current_flag) {
      const [city, state] = newLocation.split(',').map((s: string) => s.trim());
      db.prepare(`
        UPDATE shipments SET
          current_location_city = COALESCE(?, current_location_city),
          current_location_state = COALESCE(?, current_location_state),
          last_updated = ?
        WHERE tracking_number = ?
      `).run(city || null, state || null, newTimestamp, tracking);
    }

    const updatedRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking);
    res.json({ success: true, data: formatShipment(updatedRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shipments/:trackingNumber (Full update)
shipmentsRouter.put('/:trackingNumber', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const s = req.body;

    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }

    // estimatedDelivery arrives either as the formatted { date, timeWindow } shape this API
    // returns, or as a plain string (the Edit Shipment modal flattens it to just the date) —
    // handle both without blowing away the time window when only the date was edited.
    const estDeliveryDate = typeof s.estimatedDelivery === 'string'
      ? s.estimatedDelivery
      : (s.estimatedDelivery?.date ?? null);
    const estDeliveryTime = typeof s.estimatedDelivery === 'object'
      ? (s.estimatedDelivery?.timeWindow ?? null)
      : (s.estimatedDeliveryDetail ?? null);

    db.prepare(`
      UPDATE shipments SET
        status = COALESCE(?, status),
        status_text = COALESCE(?, status_text),
        progress_percent = COALESCE(?, progress_percent),
        service = COALESCE(?, service),
        shipment_type = COALESCE(?, shipment_type),
        cargo_description = COALESCE(?, cargo_description),
        total_weight_lbs = COALESCE(?, total_weight_lbs),
        total_pieces = COALESCE(?, total_pieces),
        estimated_delivery_date = COALESCE(?, estimated_delivery_date),
        estimated_delivery_time = COALESCE(?, estimated_delivery_time),
        origin_city = COALESCE(?, origin_city),
        origin_state = COALESCE(?, origin_state),
        origin_lat = COALESCE(?, origin_lat),
        origin_lng = COALESCE(?, origin_lng),
        destination_city = COALESCE(?, destination_city),
        destination_state = COALESCE(?, destination_state),
        destination_lat = COALESCE(?, destination_lat),
        destination_lng = COALESCE(?, destination_lng),
        sender_json = COALESCE(?, sender_json),
        recipient_json = COALESCE(?, recipient_json),
        last_updated = 'Just now',
        current_location_city = COALESCE(?, current_location_city),
        current_location_state = COALESCE(?, current_location_state),
        current_location_lat = COALESCE(?, current_location_lat),
        current_location_lng = COALESCE(?, current_location_lng),
        current_facility = COALESCE(?, current_facility),
        progress_updated_at_ts = COALESCE(?, progress_updated_at_ts),
        vehicle_json = COALESCE(?, vehicle_json),
        pet_json = COALESCE(?, pet_json),
        pallet_json = COALESCE(?, pallet_json),
        container_json = COALESCE(?, container_json),
        freight_json = COALESCE(?, freight_json),
        document_json = COALESCE(?, document_json),
        transport_mode = COALESCE(?, transport_mode)
      WHERE tracking_number = ?
    `).run(
      s.status || null,
      s.statusText || null,
      s.progressPercent !== undefined ? s.progressPercent : null,
      s.service || null,
      s.shipmentType || null,
      s.cargoDescription || null,
      s.totalWeightLbs !== undefined ? s.totalWeightLbs : null,
      s.totalPieces !== undefined ? s.totalPieces : null,
      estDeliveryDate,
      estDeliveryTime,
      typeof s.origin === 'object' ? (s.origin?.city ?? null) : null,
      typeof s.origin === 'object' ? (s.origin?.state ?? null) : null,
      typeof s.origin === 'object' ? (s.origin?.lat ?? null) : null,
      typeof s.origin === 'object' ? (s.origin?.lng ?? null) : null,
      typeof s.destination === 'object' ? (s.destination?.city ?? null) : null,
      typeof s.destination === 'object' ? (s.destination?.state ?? null) : null,
      typeof s.destination === 'object' ? (s.destination?.lat ?? null) : null,
      typeof s.destination === 'object' ? (s.destination?.lng ?? null) : null,
      s.sender ? JSON.stringify(s.sender) : null,
      s.recipient ? JSON.stringify(s.recipient) : null,
      s.currentLocation ? (typeof s.currentLocation === 'string' ? s.currentLocation.split(',')[0].trim() : s.currentLocation.city) : null,
      s.currentLocation ? (typeof s.currentLocation === 'string' ? s.currentLocation.split(',')[1]?.trim() : s.currentLocation.state) : null,
      (typeof s.currentLocation === 'object' && typeof s.currentLocation?.lat === 'number') ? s.currentLocation.lat : null,
      (typeof s.currentLocation === 'object' && typeof s.currentLocation?.lng === 'number') ? s.currentLocation.lng : null,
      s.currentFacility || null,
      // Only reset the auto-advance clock when this call actually changes progress —
      // otherwise leave it alone so an unrelated field update doesn't restart the clock.
      s.progressPercent !== undefined ? Date.now() : null,
      s.vehicleDetails ? JSON.stringify(s.vehicleDetails) : null,
      s.petDetails ? JSON.stringify(s.petDetails) : null,
      s.palletDetails ? JSON.stringify(s.palletDetails) : null,
      s.containerDetails ? JSON.stringify(s.containerDetails) : null,
      s.freightDetails ? JSON.stringify(s.freightDetails) : null,
      s.documentDetails ? JSON.stringify(s.documentDetails) : null,
      parseTransportMode(s.transportMode) ?? null,
      tracking
    );

    const updatedRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking);
    res.json({ success: true, data: formatShipment(updatedRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/shipments/:trackingNumber — soft delete only. A real, only-hours-old shipment
// was permanently, unrecoverably lost to what this route used to do (a real hard DELETE, with
// no backup covering the gap between its creation and its deletion the same day) — this marks
// deleted_at_ts instead and leaves every row (the shipment, its pieces, events, documents)
// fully intact, so "Restore" below can always bring it back exactly as it was. Nothing here
// permanently destroys data anymore; see the /permanent route for the one explicit action
// that still does, which the trash UI gates behind its own separate confirmation.
shipmentsRouter.delete('/:trackingNumber', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const row = db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `Shipment ${tracking} not found` });
    }
    db.prepare('UPDATE shipments SET deleted_at_ts = ? WHERE tracking_number = ?').run(Date.now(), tracking);
    res.json({ success: true, message: `Shipment ${tracking} moved to trash — restorable from Recently Deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shipments/:trackingNumber/restore — undoes a soft delete.
shipmentsRouter.post('/:trackingNumber/restore', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const row = db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NOT NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `${tracking} is not in the trash.` });
    }
    db.prepare('UPDATE shipments SET deleted_at_ts = NULL WHERE tracking_number = ?').run(tracking);
    const restoredRow = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(tracking);
    res.json({ success: true, data: formatShipment(restoredRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/shipments/:trackingNumber/permanent — the one action that actually, irreversibly
// destroys a shipment's data. Only ever reachable from the trash view (a shipment must already
// be soft-deleted first), as a deliberate second step — never the direct result of the
// ordinary "Delete" button.
shipmentsRouter.delete('/:trackingNumber/permanent', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const tracking = (req.params.trackingNumber as string).trim().toUpperCase();
    const row = db.prepare('SELECT 1 FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NOT NULL').get(tracking);
    if (!row) {
      return res.status(404).json({ success: false, error: `${tracking} must be in the trash before it can be permanently deleted.` });
    }
    db.prepare('DELETE FROM shipment_pieces WHERE parent_tracking = ?').run(tracking);
    db.prepare('DELETE FROM tracking_events WHERE shipment_tracking = ?').run(tracking);
    db.prepare('DELETE FROM documents WHERE shipment_tracking = ?').run(tracking);
    db.prepare('DELETE FROM shipments WHERE tracking_number = ?').run(tracking);
    res.json({ success: true, message: `Shipment ${tracking} permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
