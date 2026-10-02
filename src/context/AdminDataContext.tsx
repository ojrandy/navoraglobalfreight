import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shipment, ShipmentStatus, TrackingEvent } from '../types/shipment';
import { QuoteRequest, QuoteRequestStatus, QuoteRequestPricing, AdminNotification, AdminSettings, AdminDocument, DocumentStatus, DocumentVersion } from '../types/admin';
import { api } from '../services/api';
import { simulationEngine } from '../services/simulationEngine';
import { resolveLocation, resolveLocationPrecise } from '../services/geocodingService';
import { applyForwardOnlyShipmentUpdate } from '../utils/shipmentSync';
import { parseTrackingInput, pieceLabel } from '../shared/trackingId';
import { ADMIN_ROLE_LABEL, COMPANY_SHORT } from '../config/brand';
import { formatInZone, timeZoneForLocationLabel } from '../shared/timeZones';
import { shipmentStatusLabel } from '../shared/shipmentStatus';

// The server assigns every tracking ID (BRAND_GUIDE §7). Shipments are built here as drafts
// without one, and this stamps the ID the server returned onto the draft: the ID, the barcode,
// and each piece's id and child label (NGF7K2M9-01).
function withTrackingId<T extends Partial<Shipment>>(draft: T, trackingNumber: string): T {
  return {
    ...draft,
    trackingNumber,
    barcodeCode: `*${trackingNumber}*`,
    pieces: (draft.pieces || []).map((p, idx) => {
      const n = p.pieceNumber || idx + 1;
      return { ...p, id: `${trackingNumber}-P${n}`, trackingNumber: pieceLabel(trackingNumber, n) };
    })
  };
}

const INITIAL_SHIPMENTS: Shipment[] = [];
const INITIAL_QUOTE_REQUESTS: QuoteRequest[] = [];
const INITIAL_ADMIN_DOCUMENTS: AdminDocument[] = [];

interface AdminDataContextType {
  shipments: Shipment[];
  quoteRequests: QuoteRequest[];
  notifications: AdminNotification[];
  settings: AdminSettings;
  documents: AdminDocument[];
  
  // Actions
  updateShipmentDirect: (updated: Shipment) => void;
  updateShipmentFull: (updated: Shipment) => Promise<void>;
  deleteShipment: (trackingNumber: string) => Promise<{ success: boolean; error?: string }>;
  getTrashedShipments: () => Promise<Shipment[]>;
  restoreShipment: (trackingNumber: string) => Promise<{ success: boolean; error?: string }>;
  permanentlyDeleteShipment: (trackingNumber: string) => Promise<{ success: boolean; error?: string }>;
  updateShipmentStatus: (trackingNumber: string, newStatus: ShipmentStatus, location: string, facility: string, notes: string, progressPercent?: number, statusTextOverride?: string, lat?: number, lng?: number, eventTitleOverride?: string, skipLocalEventDuplicate?: boolean, skipServerEventCreation?: boolean, estimatedDeliveryDate?: string, estimatedDeliveryTime?: string) => Promise<{ success: boolean; error?: string }>;
  addTrackingEvent: (trackingNumber: string, event: Partial<TrackingEvent>) => void;
  correctTrackingEvent: (trackingNumber: string, eventId: string, updates: Partial<TrackingEvent>) => void;
  publishQuote: (quoteId: string, pricing: QuoteRequestPricing, internalNotes?: string) => void;
  updateQuoteStatus: (quoteId: string, status: QuoteRequestStatus) => void;
  createQuoteRequest: (quoteData: Partial<QuoteRequest>) => QuoteRequest;
  convertQuoteToShipment: (quoteId: string) => Promise<Shipment | undefined>;
  /** Persists a new shipment; resolves with the server-assigned tracking ID applied. Rejects if the server refuses it. */
  createShipment: (shipmentData: Partial<Shipment>) => Promise<Shipment>;
  /** Return to origin, persisted server-side: the return is its own shipment with a server-assigned NGF ID. */
  initiateReturn: (trackingNumber: string, reason: string) => Promise<{ success: boolean; error?: string; returnTrackingNumber?: string }>;
  updateSettings: (newSettings: Partial<AdminSettings>) => Promise<{ success: boolean; error?: string }>;
  markNotificationRead: (id: string) => void;
  getShipment: (trackingNumber: string) => Shipment | undefined;
  generateDocument: (docData: Omit<AdminDocument, 'id' | 'createdDate' | 'status' | 'version'>) => AdminDocument;
  regenerateDocument: (docId: string, notes?: string) => AdminDocument | undefined;
  updateDocumentStatus: (docId: string, status: DocumentStatus) => void;
  updateDocumentPaymentStatus: (docId: string, paymentStatus: 'PAID' | 'PENDING') => void;
  deleteDocument: (docId: string) => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>(INITIAL_QUOTE_REQUESTS);
  const [documents, setDocuments] = useState<AdminDocument[]>(INITIAL_ADMIN_DOCUMENTS);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  
  const [settings, setSettings] = useState<AdminSettings>({
    autoPublishQuotes: false,
    defaultFuelSurchargeRate: 0.085,
    piiMaskingEnabled: true,
    activeDispatchesCount: 0,
    hubSortStatus: {
      JFK: 'NORMAL',
      EWR: 'NORMAL',
      ORD: 'NORMAL',
      DFW: 'NORMAL',
      LAX: 'NORMAL'
    }
  });

const normalizeShipment = (s: any): Shipment => {
  const events = Array.isArray(s.events) && s.events.length > 0
    ? s.events
    : (Array.isArray(s.timeline) && s.timeline.length > 0 ? s.timeline : []);

  let etaDate = 'Scheduled';
  let etaWindow = '';
  if (typeof s.estimatedDelivery === 'string') {
    etaDate = s.estimatedDelivery;
    etaWindow = s.estimatedDeliveryDetail || '';
  } else if (typeof s.estimatedDelivery === 'object' && s.estimatedDelivery) {
    etaDate = s.estimatedDelivery.date || 'Scheduled';
    etaWindow = s.estimatedDelivery.timeWindow || s.estimatedDeliveryDetail || '';
  }

  return {
    ...s,
    events,
    timeline: events,
    estimatedDelivery: etaDate,
    estimatedDeliveryDetail: etaWindow || s.estimatedDeliveryDetail,
    sender: typeof s.sender === 'object' && s.sender ? s.sender : { name: String(s.sender || 'Shipper') },
    recipient: typeof s.recipient === 'object' && s.recipient ? s.recipient : { name: String(s.recipient || 'Consignee') },
    origin: typeof s.origin === 'object' && s.origin ? s.origin : { city: 'Origin', state: '' },
    destination: typeof s.destination === 'object' && s.destination ? s.destination : { city: 'Destination', state: '' }
  };
};

  // Live initial load from persistent SQLite Backend
  useEffect(() => {
    let isMounted = true;
    const loadBackendData = async () => {
      try {
        const [liveShipments, liveQuotes, liveDocs, liveSettings] = await Promise.allSettled([
          api.getShipments(),
          api.getQuotes(),
          api.getDocuments(),
          api.getSettings()
        ]);

        if (isMounted) {
          // NOTE: no `.length > 0` check here. An empty array is a legitimate, successful
          // response (e.g. the admin deleted everything) and must replace the mock
          // placeholder data — requiring a non-empty result meant a genuinely empty backend
          // state was indistinguishable from "fetch hasn't resolved yet", so deleting every
          // record just made the app silently fall back to showing 5 hardcoded mock
          // shipments forever, on every refresh. A rejected/failed fetch (network error,
          // server down) is the only case that should keep showing the placeholder.
          if (liveShipments.status === 'fulfilled' && Array.isArray(liveShipments.value)) {
            const normalized = liveShipments.value.map(normalizeShipment);
            setShipments(normalized);
          }
          if (liveQuotes.status === 'fulfilled' && Array.isArray(liveQuotes.value)) {
            setQuoteRequests(liveQuotes.value);
          }
          if (liveDocs.status === 'fulfilled' && Array.isArray(liveDocs.value)) {
            setDocuments(liveDocs.value);
          }
          if (liveSettings.status === 'fulfilled' && liveSettings.value) {
            setSettings(prev => ({ ...prev, ...liveSettings.value }));
          }
        }
      } catch (err) {
        console.warn('[AdminData] Connecting to backend server...', err);
      }
    };

    loadBackendData();
    return () => { isMounted = false; };
  }, []);

  // The initial load above only ever runs once, on mount — with nothing else refreshing it,
  // this context's `shipments` silently drifted further behind the server's real, continuously
  // -advancing progress (server/progress.ts) the longer the admin dashboard tab stayed open, while
  // the public track page (which re-polls every 8s) kept climbing. That's what made the same
  // shipment show two different progress numbers depending which page you looked at. Periodically
  // re-fetching closes that gap; merging through the shared forward-only guard (rather than a raw
  // overwrite) protects any shipment an admin has actively simulating client-side right now — the
  // server has no idea that's happening (ticks aren't persisted per-tick), so a naive overwrite
  // here would yank an in-flight simulation's progress back down to its last-known DB value,
  // reintroducing the exact "marker jumps backward" bug this same guard already fixed elsewhere.
  useEffect(() => {
    const REFRESH_MS = 12000;
    // This provider wraps the ENTIRE app, public pages included — so this interval was
    // starting for every visitor, admin or not. For anyone without an admin session it 401'd
    // on every single tick, forever, for as long as the tab stayed open: a permanent
    // every-12-seconds stream of failed requests and console errors on the public site. Once
    // a tick comes back 401 (not authenticated), stop polling entirely until the next real
    // page load — logging in already does a full reload (see AdminLogin.tsx), which starts
    // this effect fresh with a valid session. Other failures (a network blip, a 5xx) keep
    // retrying as before; only a confirmed "not authenticated" response silences it.
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const fresh = await api.getShipments();
        if (!Array.isArray(fresh)) return;
        const freshByTracking = new Map(fresh.map(f => [f.trackingNumber.toUpperCase(), normalizeShipment(f)]));
        setShipments(prev => prev.map(s => {
          const incoming = freshByTracking.get(s.trackingNumber.toUpperCase());
          return incoming ? applyForwardOnlyShipmentUpdate(s, incoming) : s;
        }));
      } catch (err: any) {
        if (err?.status === 401) {
          stopped = true;
          clearInterval(interval);
        }
        // Any other error: silent, a failed background refresh shouldn't disrupt the session.
      }
    }, REFRESH_MS);
    return () => { stopped = true; clearInterval(interval); };
  }, []);

  // Subscribe to Live Simulation Engine
  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((simUpdated) => {
      setShipments(prev => prev.map(s => {
        if (s.trackingNumber.toUpperCase() === simUpdated.trackingNumber.toUpperCase()) {
          return applyForwardOnlyShipmentUpdate(s, simUpdated);
        }
        return s;
      }));
    });
    return () => unsubscribe();
  }, []);

  // Normalises tracking IDs ("ngf 7k2-m9", child label NGF7K2M9-01 -> NGF7K2M9); anything else is
  // matched as typed.
  const getShipment = (trackingNumber: string) => {
    const wanted = parseTrackingInput(trackingNumber)?.trackingId ?? trackingNumber.trim().toUpperCase();
    return shipments.find(s => s.trackingNumber.toUpperCase() === wanted);
  };

  const updateShipmentDirect = (updated: Shipment) => {
    setShipments(prev => prev.map(s => {
      if (s.trackingNumber.toUpperCase() === updated.trackingNumber.toUpperCase()) {
        return { ...s, ...updated };
      }
      return s;
    }));
  };

  // Deliberate edits that must actually persist (e.g. the Edit Shipment modal) — unlike
  // updateShipmentDirect (also used for high-frequency local-only simulation ticks), this
  // always writes through to the backend so the change survives a refresh.
  const updateShipmentFull = async (updated: Shipment): Promise<void> => {
    updateShipmentDirect(updated);
    try {
      await api.updateShipment(updated.trackingNumber, updated);
    } catch (err) {
      console.error('[API] Failed to save shipment edit:', err);
    }
  };

  const initiateReturn = async (trackingNumber: string, reason: string): Promise<{ success: boolean; error?: string; returnTrackingNumber?: string }> => {
    try {
      const { original, returnShipment } = await api.initiateReturn(trackingNumber, reason, 'Administrator');
      const updatedOriginal = normalizeShipment(original);
      const created = normalizeShipment(returnShipment);
      setShipments(prev => [
        created,
        ...prev.map(s => s.trackingNumber.toUpperCase() === updatedOriginal.trackingNumber.toUpperCase() ? updatedOriginal : s)
      ]);
      return { success: true, returnTrackingNumber: created.trackingNumber };
    } catch (err: any) {
      console.error('[API] Failed to initiate return:', err);
      return { success: false, error: err?.message || 'the server did not respond' };
    }
  };

  const deleteShipment = async (trackingNumber: string): Promise<{ success: boolean; error?: string }> => {
    // Keep the removed shipment so a failed server delete can be restored — the caller
    // previously removed it from view unconditionally and reported success regardless of
    // whether the DELETE actually reached the server, so a failure (session expiry, a
    // network blip) looked identical to success until the next refresh brought it back.
    const removed = shipments.find(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase());
    setShipments(prev => prev.filter(s => s.trackingNumber.toUpperCase() !== trackingNumber.toUpperCase()));

    try {
      await api.deleteShipment(trackingNumber);
      return { success: true };
    } catch (err: any) {
      console.error('[API] Failed to delete shipment:', err);
      if (removed) {
        setShipments(prev => prev.some(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase())
          ? prev
          : [removed, ...prev]);
      }
      return { success: false, error: err?.message };
    }
  };

  // "Delete" above moves a shipment to a server-side trash (see server/routes/shipments.ts) —
  // these two round it out: viewing what's in the trash, and bringing one back. There is
  // deliberately no "empty trash" / bulk-purge action here; permanentlyDeleteShipment below is
  // the one path that actually destroys data, and it's one shipment at a time, on purpose.
  const getTrashedShipments = async (): Promise<Shipment[]> => {
    try {
      const trashed = await api.getTrashedShipments();
      return Array.isArray(trashed) ? trashed.map(normalizeShipment) : [];
    } catch (err) {
      console.error('[API] Failed to load trashed shipments:', err);
      return [];
    }
  };

  const restoreShipment = async (trackingNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const restored = await api.restoreShipment(trackingNumber);
      const normalized = normalizeShipment(restored);
      setShipments(prev => prev.some(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase())
        ? prev.map(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase() ? normalized : s)
        : [normalized, ...prev]);
      return { success: true };
    } catch (err: any) {
      console.error('[API] Failed to restore shipment:', err);
      return { success: false, error: err?.message };
    }
  };

  const permanentlyDeleteShipment = async (trackingNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.permanentlyDeleteShipment(trackingNumber);
      return { success: true };
    } catch (err: any) {
      console.error('[API] Failed to permanently delete shipment:', err);
      return { success: false, error: err?.message };
    }
  };

  const updateShipmentStatus = (trackingNumber: string, newStatus: ShipmentStatus, location: string, facility: string, notes: string, progressPercent?: number, statusTextOverride?: string, lat?: number, lng?: number, eventTitleOverride?: string, skipLocalEventDuplicate?: boolean, skipServerEventCreation?: boolean, estimatedDeliveryDate?: string, estimatedDeliveryTime?: string): Promise<{ success: boolean; error?: string }> => {
    // Keep the pre-update snapshot so a failed server write can be rolled back instead of
    // leaving the optimistic local change (new status, new event, pushed-back ETA) looking
    // permanent when it was never actually persisted.
    const previous = shipments.find(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase());

    // 1. Optimistic UI update
    setShipments(prev => prev.map(s => {
      if (s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase()) {
        const isDelivered = newStatus === 'DELIVERED';
        const updatedDocs = (s.documents || []).map((doc: any) => {
          if (isDelivered && (doc.type === 'PROOF_OF_DELIVERY' || doc.docType === 'POD')) {
            return { ...doc, status: 'AVAILABLE', date: 'Delivered', fileSize: '142 KB' };
          }
          return doc;
        });

        // Callers that already recorded a richer, specific event for this same action
        // (ShipmentControlModal via updateShipmentDirect, or TrackingEventsView via
        // addTrackingEvent) pass skipLocalEventDuplicate so this call only syncs
        // status/progress/location — without it, a second, generic "Status: X" event got
        // prepended on top of the real one every time, burying it as soon as it was created.
        let eventFields = {};
        if (!skipLocalEventDuplicate) {
          // Local time at the event's location + UTC offset, as the server will store it.
          const zone = timeZoneForLocationLabel(location, lat, lng);
          const local = formatInZone(Date.now(), zone);
          const newEvent: TrackingEvent = {
            id: `t-${Date.now()}`,
            timestamp: new Date().toISOString(),
            timezone: zone,
            utcOffset: local.utcOffset,
            displayDate: local.displayDate,
            displayTime: local.displayTime,
            title: eventTitleOverride || `Status: ${newStatus.replace(/_/g, ' ')}`,
            facility: facility || s.currentFacility || 'Sorting Hub',
            city: location.split(',')[0] || s.origin?.city || 'Transit Hub',
            state: location.split(',')[1]?.trim() || s.origin?.state || '',
            description: notes,
            operatorId: ADMIN_ROLE_LABEL,
            recordedBy: ADMIN_ROLE_LABEL,
            isCurrent: true,
            isCompleted: true
          };
          // Keep `timeline` mirrored with `events` — several views (e.g. TrackingEventsView)
          // read `s.timeline` first and only fall back to `s.events` when timeline is empty,
          // so updating only one of the two left the newly-added event invisible until the
          // next full refresh re-synced them both from the backend.
          eventFields = {
            events: [newEvent, ...((s.events || s.timeline) || []).map((t: any) => ({ ...t, isCurrent: false }))],
            timeline: [newEvent, ...((s.events || s.timeline) || []).map((t: any) => ({ ...t, isCurrent: false }))]
          };
        }

        return {
          ...s,
          status: newStatus,
          statusText: statusTextOverride || (newStatus === 'DELIVERED' ? 'Delivered & Signed' : newStatus === 'OUT_FOR_DELIVERY' ? 'Out for Final Delivery' : `In Transit - ${facility || location}`),
          progressPercent: progressPercent !== undefined ? progressPercent : (isDelivered ? 100 : s.progressPercent),
          estimatedDelivery: estimatedDeliveryDate || s.estimatedDelivery,
          estimatedDeliveryDetail: estimatedDeliveryTime || s.estimatedDeliveryDetail,
          lastUpdated: 'Just now',
          // When real coordinates are supplied, keep currentLocation's lat/lng in sync with
          // the city/state text so they never silently disagree (the root of the "Denver"
          // bug — a location label that no longer matched its own stored coordinates).
          ...(lat !== undefined && lng !== undefined ? {
            currentLocation: {
              ...(typeof s.currentLocation === 'object' ? s.currentLocation : {}),
              city: location.split(',')[0]?.trim() || (s.currentLocation as any)?.city,
              state: location.split(',')[1]?.trim() || (s.currentLocation as any)?.state,
              lat,
              lng,
              facility: facility || (s.currentLocation as any)?.facility
            } as any
          } : {}),
          documents: updatedDocs,
          ...eventFields
        };
      }
      return s;
    }));

    // 2. Persist to Backend API
    return api.updateShipmentStatus(trackingNumber, newStatus, location, facility, notes, progressPercent, statusTextOverride, lat, lng, eventTitleOverride, skipServerEventCreation, estimatedDeliveryDate, estimatedDeliveryTime)
      .then(() => ({ success: true }))
      .catch((err: any) => {
        console.error('[API] Failed to update shipment status:', err);
        if (previous) {
          setShipments(prev => prev.map(s => s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase() ? previous : s));
        }
        return { success: false, error: err?.message };
      });
  };

  const addTrackingEvent = (trackingNumber: string, event: Partial<TrackingEvent>) => {
    setShipments(prev => prev.map(s => {
      if (s.trackingNumber.toUpperCase() === trackingNumber.toUpperCase()) {
        const city = event.city || s.origin?.city || 'Gateway Hub';
        const state = event.state || s.origin?.state || '';
        const newEvent: TrackingEvent = {
          id: event.id || `ev-${Date.now()}`,
          timestamp: event.timestamp || new Date().toISOString(),
          timezone: event.timezone,
          displayDate: event.displayDate || new Date().toLocaleDateString('en-US'),
          displayTime: event.displayTime || new Date().toLocaleTimeString('en-US'),
          title: event.title || 'Checkpoint Scan',
          status: event.status,
          eventStatus: event.eventStatus || event.status,
          location: event.location || `${city}, ${state}`,
          facility: event.facility || s.currentFacility || 'Gateway Hub',
          city,
          state,
          description: event.description || 'Milestone recorded by operator.',
          operatorNotes: event.operatorNotes,
          internalNote: event.internalNote,
          recordedBy: event.recordedBy || ADMIN_ROLE_LABEL,
          operatorId: ADMIN_ROLE_LABEL,
          isCurrent: true,
          isCompleted: true
        };

        return {
          ...s,
          lastUpdated: 'Just now',
          events: [newEvent, ...((s.events || s.timeline) || []).map((t: any) => ({ ...t, isCurrent: false }))],
          timeline: [newEvent, ...((s.events || s.timeline) || []).map((t: any) => ({ ...t, isCurrent: false }))]
        };
      }
      return s;
    }));

    api.addTrackingEvent(trackingNumber, event).catch(err => {
      console.error('[API] Failed to add tracking event:', err);
    });
  };

  // Corrects an existing tracking event (location/date/time/message) while preserving an
  // audit trail of the change. Previously this only mutated the shipment object directly in
  // local state with no setState and no backend call — it looked saved but was never
  // persisted and didn't even reliably re-render.
  const correctTrackingEvent = (trackingNumber: string, eventId: string, updates: Partial<TrackingEvent>) => {
    setShipments(prev => prev.map(s => {
      if (s.trackingNumber.toUpperCase() !== trackingNumber.toUpperCase()) return s;

      const sourceTimeline: TrackingEvent[] = (s.timeline || (s as any).events || []);
      const correctedEvent = sourceTimeline.find(t => t.id === eventId);
      const updatedTimeline = sourceTimeline.map(t => t.id === eventId ? { ...t, ...updates } : t);

      const isCurrentEvent = Boolean(correctedEvent?.isCurrent);
      return {
        ...s,
        timeline: updatedTimeline,
        events: updatedTimeline,
        ...(isCurrentEvent ? {
          currentLocation: `${updates.city || correctedEvent?.city}, ${updates.state || correctedEvent?.state}`,
          lastUpdated: `${updates.displayDate || correctedEvent?.displayDate} · ${updates.displayTime || correctedEvent?.displayTime}`
        } : {})
      };
    }));

    api.correctTrackingEvent(trackingNumber, eventId, updates).catch(err => {
      console.error('[API] Failed to correct tracking event:', err);
    });
  };

  // Publish / Determine Final Quote Price
  const publishQuote = (quoteId: string, pricing: QuoteRequestPricing, internalNotes?: string) => {
    setQuoteRequests(prev => prev.map(q => {
      if (q.id === quoteId) {
        return {
          ...q,
          status: 'RATE_PUBLISHED',
          pricing: {
            ...pricing,
            publishedAt: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            publishedBy: ADMIN_ROLE_LABEL
          },
          internalNotes: internalNotes !== undefined ? internalNotes : q.internalNotes
        };
      }
      return q;
    }));

    api.publishQuote(quoteId, pricing, internalNotes).catch(err => {
      console.error('[API] Failed to publish quote:', err);
    });
  };

  const updateQuoteStatus = (quoteId: string, status: QuoteRequestStatus) => {
    let freshValidUntil: string | undefined;
    setQuoteRequests(prev => prev.map(q => {
      if (q.id !== quoteId) return q;
      // Re-opening an expired quote previously left its old validUntil date frozen in the
      // past, so it would read as expired again immediately — recompute a fresh validity
      // window using the same day-count new quotes get.
      if (q.status === 'EXPIRED' && status !== 'EXPIRED' && q.pricing) {
        const days = settings.quoteValidityDays || 14;
        freshValidUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return { ...q, status, pricing: { ...q.pricing, validUntil: freshValidUntil } };
      }
      return { ...q, status };
    }));
    api.updateQuoteStatus(quoteId, status, freshValidUntil).catch(err => {
      console.error('[API] Failed to update quote status:', err);
    });
  };

  const createQuoteRequest = (quoteData: Partial<QuoteRequest>): QuoteRequest => {
    const qd = quoteData as any;
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const newQuote: QuoteRequest = {
      id: qd.id || `QR-2026-${randomSuffix}`,
      submittedDate: qd.submittedDate || 'Today',
      status: qd.status || 'NEW',
      requesterName: qd.requesterName || qd.customerName || 'Prospective Customer',
      requesterEmail: qd.requesterEmail || qd.customerEmail || 'customer@company.com',
      requesterPhone: qd.requesterPhone || qd.customerPhone || '(555) 000-0000',
      requesterCompany: qd.requesterCompany || qd.company,
      recipientName: qd.recipientName || 'Designated Consignee',
      originCity: qd.originCity || qd.origin?.city || 'New York',
      originState: qd.originState || qd.origin?.state || 'NY',
      originZip: qd.originZip || qd.origin?.postalCode || '10001',
      destCity: qd.destCity || qd.destination?.city || 'Los Angeles',
      destState: qd.destState || qd.destination?.state || 'CA',
      destZip: qd.destZip || qd.destination?.postalCode || '90071',
      requestedService: qd.requestedService || qd.service || 'Standard',
      cargoType: qd.cargoType || qd.shipmentType || 'Parcel',
      cargoDescription: qd.cargoDescription || 'Consignment Cargo',
      totalWeightLbs: qd.totalWeightLbs || qd.weightLbs || 10,
      quantity: typeof qd.pieces === 'number' ? qd.pieces : qd.quantity || 1,
      dimensions: typeof qd.dimensions === 'string' ? qd.dimensions : '12 × 12 × 12 in',
      specialRequirements: qd.specialRequirements || qd.specialInstructions,
      pricing: qd.pricing
    };

    setQuoteRequests(prev => [newQuote, ...prev.filter(q => q.id !== newQuote.id)]);
    if (!qd.id) {
      api.submitPublicQuote(quoteData).catch(err => console.error('[API] Failed to create quote:', err));
    }
    return newQuote;
  };

  const convertQuoteToShipment = async (quoteId: string): Promise<Shipment | undefined> => {
    const targetQuote = quoteRequests.find(q => q.id === quoteId);
    if (!targetQuote) return undefined;

    const tq = targetQuote as any;
    const originCity = tq.originCity || tq.origin?.city || 'New York';
    const originState = tq.originState || tq.origin?.state || 'NY';
    const destCity = tq.destCity || tq.destination?.city || 'Los Angeles';
    const destState = tq.destState || tq.destination?.state || 'CA';

    // resolveLocationPrecise: instant for major metros, falls through to live geocoding for
    // smaller towns instead of silently landing on the state's rough centroid.
    const originGeo = await resolveLocationPrecise(tq.originZip || `${originCity}, ${originState}`);
    const destGeo = await resolveLocationPrecise(tq.destZip || `${destCity}, ${destState}`);

    // Draft: the tracking ID, barcode and piece labels come from the server (withTrackingId).
    const draft: any = {
      id: `shp-${Date.now()}`,
      status: 'RECEIVED',
      statusText: shipmentStatusLabel('RECEIVED'),
      statusMessage: 'Shipment registered in verified linehaul network.',
      health: 'ON_TRACK',
      healthExplanation: 'Consignment created from approved tariff rate quotation.',
      progressPercent: 15,
      lastUpdated: 'Just now',
      createdAt: 'Today',
      service: tq.requestedService || tq.service || 'Standard',
      shipmentType: tq.cargoType || tq.shipmentType || 'Parcel',
      cargoCategory: tq.cargoCategory || 'General Freight',
      cargoDescription: tq.cargoDescription || 'Commercial Freight Cargo',
      totalWeightLbs: tq.totalWeightLbs || tq.weightLbs || 45,
      totalPieces: typeof tq.pieces === 'number' ? tq.pieces : tq.quantity || 1,
      declaredValue: tq.declaredValue || 850,
      dimensions: typeof tq.dimensions === 'object' ? tq.dimensions : { length: 12, width: 12, height: 12 },
      origin: {
        city: originCity,
        state: originState,
        country: tq.originCountry || originGeo?.country || '',
        lat: originGeo?.lat || 40.7128,
        lng: originGeo?.lng || -74.0060,
        facility: originGeo?.facilityName || `${originCity} Gateway Hub`
      },
      destination: {
        city: destCity,
        state: destState,
        country: tq.destCountry || destGeo?.country || '',
        lat: destGeo?.lat || 34.0522,
        lng: destGeo?.lng || -118.2437,
        facility: destGeo?.facilityName || `${destCity} Sort Hub`
      },
      currentLocation: `${originCity}, ${originState}`,
      currentFacility: 'Origin Gateway Hub',
      sender: {
        name: tq.requesterName || tq.customerName || 'Shipper',
        company: tq.requesterCompany || tq.company,
        phone: tq.requesterPhone || tq.customerPhone,
        email: tq.requesterEmail || tq.customerEmail,
        city: originCity,
        state: originState,
        postalCode: tq.originZip || tq.origin?.postalCode || undefined,
        country: tq.originCountry || originGeo?.country || ''
      },
      recipient: {
        name: tq.recipientName || 'Designated Consignee',
        city: destCity,
        state: destState,
        postalCode: tq.destZip || tq.destination?.postalCode || undefined,
        country: tq.destCountry || destGeo?.country || ''
      },
      estimatedDelivery: 'Aug 25, 2026',
      estimatedDeliveryDetail: 'by 5:00 PM',
      pieces: [
        {
          pieceNumber: 1,
          totalPieces: 1,
          status: 'RECEIVED',
          statusText: shipmentStatusLabel('RECEIVED'),
          currentLocation: `${originCity}, ${originState}`,
          weightLbs: tq.totalWeightLbs || tq.weightLbs || 45,
          dimensions: typeof tq.dimensions === 'object' ? tq.dimensions : { length: 12, width: 12, height: 12 }
        }
      ],
      events: [
        {
          id: `e-${Date.now()}`,
          status: 'RECEIVED',
          title: 'Consignment Registered from Rate Quote',
          location: `${originCity}, ${originState}`,
          facility: 'Origin Gateway Hub',
          timestamp: 'Just now',
          description: `Consignment generated from approved quote ${targetQuote.id}. Linear Code 128 barcode assigned.`,
          delayFlag: false,
          completed: true,
          current: true
        }
      ],
      documents: [
        {
          id: `doc-bol-${Date.now()}`,
          title: 'Official Bill of Lading (BOL)',
          type: 'CONFIRMATION',
          status: 'AVAILABLE',
          version: '1.0',
          date: 'Today',
          fileSize: '124 KB'
        },
        {
          id: `doc-lbl-${Date.now()}`,
          title: 'Master Shipping Label (Code 128)',
          type: 'SHIPPING_LABEL',
          status: 'AVAILABLE',
          version: '1.0',
          date: 'Today',
          fileSize: '95 KB'
        },
        {
          id: `doc-inv-${Date.now()}`,
          title: 'Commercial Freight Invoice',
          type: 'INVOICE',
          status: 'AVAILABLE',
          version: '1.0',
          date: 'Today',
          fileSize: '110 KB'
        },
        {
          id: `doc-pod-${Date.now()}`,
          title: 'Official Proof of Delivery (Signed POD)',
          type: 'PROOF_OF_DELIVERY',
          status: 'AVAILABLE_AFTER_DELIVERY',
          version: '1.0',
          date: 'Upon Delivery',
          fileSize: 'Pending'
        }
      ]
    };

    // Persist first: the server assigns the tracking ID, and the shipment and its documents
    // only appear once it has. On failure nothing is added locally, so no unconfirmed ID is shown.
    let trackingNumber: string;
    try {
      ({ trackingNumber } = await api.convertQuoteToShipment(quoteId, draft));
    } catch (err) {
      console.error('[API] Failed to convert quote:', err);
      return undefined;
    }
    const newShipment = withTrackingId(draft, trackingNumber);

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const bolDoc: AdminDocument = {
      id: `BOL-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      shipmentTracking: trackingNumber,
      title: `Bill of Lading (${trackingNumber})`,
      docType: 'BOL',
      status: 'GENERATED',
      version: 1,
      createdDate: dateStr,
      senderName: tq.requesterName || 'Shipper',
      senderCompany: tq.requesterCompany,
      senderCity: originCity,
      senderState: originState,
      recipientName: tq.recipientName || 'Consignee',
      recipientCity: destCity,
      recipientState: destState,
      cargoDescription: tq.cargoDescription || 'Commercial Freight Cargo',
      shipmentType: tq.cargoType || 'Parcel',
      service: tq.requestedService || 'Priority Express',
      weightLbs: tq.totalWeightLbs || 0,
      pieces: typeof tq.pieces === 'number' ? tq.pieces : 1,
      // The accepted quote price, if one was published; no invented amount otherwise.
      charges: tq.pricing?.finalPrice ? {
        baseAmount: tq.pricing.finalPrice,
        totalAmount: tq.pricing.finalPrice,
        paymentStatus: 'PENDING'
      } : undefined,
      fileSize: '124 KB',
      versionHistory: [
        {
          version: 1,
          createdDate: `${dateStr} Just now`,
          generatedBy: 'Central Dispatch Desk',
          notes: `Official Bill of Lading automatically generated upon quote conversion (${targetQuote.id}).`
        }
      ]
    };

    const lblDoc: AdminDocument = {
      id: `LBL-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      shipmentTracking: trackingNumber,
      title: `Master Barcode Label - ${trackingNumber}`,
      docType: 'SHIPPING_LABEL',
      status: 'GENERATED',
      version: 1,
      createdDate: dateStr,
      senderName: tq.requesterName || 'Shipper',
      senderCity: originCity,
      senderState: originState,
      recipientName: tq.recipientName || 'Consignee',
      recipientCity: destCity,
      recipientState: destState,
      cargoDescription: tq.cargoDescription || 'Commercial Freight Cargo',
      shipmentType: tq.cargoType || 'Parcel',
      service: tq.requestedService || 'Priority Express',
      weightLbs: tq.totalWeightLbs || 0,
      pieces: typeof tq.pieces === 'number' ? tq.pieces : 1,
      fileSize: '95 KB',
      versionHistory: [
        {
          version: 1,
          createdDate: `${dateStr} Just now`,
          generatedBy: 'Central Dispatch Desk',
          notes: `Code 128 routing label generated for ${trackingNumber}.`
        }
      ]
    };

    setShipments(prev => [newShipment, ...prev]);
    setDocuments(prev => [bolDoc, lblDoc, ...prev]);
    setQuoteRequests(prev => prev.map(q => q.id === quoteId ? { ...q, status: 'CONVERTED', convertedShipmentId: trackingNumber } : q));

    // The BOL/Label built above were only ever added to local state — persist them for real
    // so they survive a refresh, the same way DocumentCenterView's generateDocument() does.
    api.generateDocument(bolDoc).catch(err => console.error('[API] Failed to persist auto-generated BOL:', err));
    api.generateDocument(lblDoc).catch(err => console.error('[API] Failed to persist auto-generated label:', err));

    return newShipment;
  };

  const createShipment = async (shipmentData: Partial<Shipment>): Promise<Shipment> => {

    const originCity = typeof shipmentData.origin === 'object' ? shipmentData.origin.city : (shipmentData.origin || 'New York');
    const originState = typeof shipmentData.origin === 'object' ? shipmentData.origin.state : 'NY';
    const destCity = typeof shipmentData.destination === 'object' ? shipmentData.destination.city : (shipmentData.destination || 'Los Angeles');
    const destState = typeof shipmentData.destination === 'object' ? shipmentData.destination.state : 'CA';

    const normalizedLocation = typeof shipmentData.currentLocation === 'string'
      ? shipmentData.currentLocation
      : (typeof shipmentData.currentLocation === 'object' && (shipmentData.currentLocation as any)?.city
          ? `${(shipmentData.currentLocation as any).city}, ${(shipmentData.currentLocation as any).state || ''}`
          : `${originCity}, ${originState}`);

    const normalizedDelivery = typeof shipmentData.estimatedDelivery === 'string'
      ? shipmentData.estimatedDelivery
      : (typeof shipmentData.estimatedDelivery === 'object' && (shipmentData.estimatedDelivery as any)?.date
          ? (shipmentData.estimatedDelivery as any).date
          : '3-5 Business Days');

    // Draft: the tracking ID, barcode and piece labels come from the server (withTrackingId).
    // Any trackingNumber the caller passed is only a preview and is not sent.
    const draft: any = {
      status: shipmentData.status || 'RECEIVED',
      statusText: shipmentData.statusText || 'Consignment Registered',
      statusMessage: shipmentData.statusMessage || 'Shipment registered in verified linehaul network.',
      health: shipmentData.health || 'ON_TRACK',
      healthExplanation: shipmentData.healthExplanation || 'Consignment created on schedule with verified physical barcodes.',
      progressPercent: (shipmentData as any)?.progressPercent || 15,
      lastUpdated: 'Just now',
      createdAt: 'Today',
      service: shipmentData.service || 'Standard',
      shipmentType: shipmentData.shipmentType || 'Parcel',
      // Main-leg mode chosen on the form (undefined = let the server infer it)
      transportMode: shipmentData.transportMode,
      cargoCategory: shipmentData.cargoCategory || (shipmentData.shipmentType === 'Vehicle' ? 'Automotive & Vehicles' : shipmentData.shipmentType === 'Pets' ? 'Live Animals & Pets (USDA / IPATA Regulated)' : 'General Freight'),
      cargoDescription: shipmentData.cargoDescription || 'Commercial Freight Cargo',
      vehicleDetails: shipmentData.vehicleDetails,
      petDetails: shipmentData.petDetails,
      palletDetails: shipmentData.palletDetails,
      containerDetails: shipmentData.containerDetails,
      freightDetails: shipmentData.freightDetails,
      documentDetails: shipmentData.documentDetails,
      // Real values only: an empty declared value stays 0 rather than an invented amount.
      totalWeightLbs: shipmentData.totalWeightLbs ?? 0,
      totalPieces: shipmentData.totalPieces || 1,
      declaredValue: (shipmentData as any)?.declaredValue ?? 0,
      dimensions: shipmentData.dimensions || { length: 0, width: 0, height: 0 },
      references: shipmentData.references || {
        customerReference: 'PO-STANDARD',
        orderNumber: 'ORD-ACTIVE',
        invoiceNumber: 'INV-VERIFIED'
      },
      origin: typeof shipmentData.origin === 'object' ? {
        ...shipmentData.origin,
        lat: (shipmentData.origin as any).lat || resolveLocation(`${originCity}, ${originState}`)?.lat || 40.7128,
        lng: (shipmentData.origin as any).lng || resolveLocation(`${originCity}, ${originState}`)?.lng || -74.0060,
        facility: (shipmentData.origin as any).facility || resolveLocation(`${originCity}, ${originState}`)?.facilityName || `${originCity} Intake Hub`
      } : {
        city: originCity,
        state: originState,
        country: resolveLocation(`${originCity}, ${originState}`)?.country || '',
        lat: resolveLocation(`${originCity}, ${originState}`)?.lat || 40.7128,
        lng: resolveLocation(`${originCity}, ${originState}`)?.lng || -74.0060,
        facility: resolveLocation(`${originCity}, ${originState}`)?.facilityName || `${originCity} Intake Hub`
      },
      destination: typeof shipmentData.destination === 'object' ? {
        ...shipmentData.destination,
        lat: (shipmentData.destination as any).lat || resolveLocation(`${destCity}, ${destState}`)?.lat || 34.0522,
        lng: (shipmentData.destination as any).lng || resolveLocation(`${destCity}, ${destState}`)?.lng || -118.2437,
        facility: (shipmentData.destination as any).facility || resolveLocation(`${destCity}, ${destState}`)?.facilityName || `${destCity} Sort Center`
      } : {
        city: destCity,
        state: destState,
        country: resolveLocation(`${destCity}, ${destState}`)?.country || '',
        lat: resolveLocation(`${destCity}, ${destState}`)?.lat || 34.0522,
        lng: resolveLocation(`${destCity}, ${destState}`)?.lng || -118.2437,
        facility: resolveLocation(`${destCity}, ${destState}`)?.facilityName || `${destCity} Sort Center`
      },
      currentLocation: normalizedLocation,
      currentFacility: (typeof shipmentData.currentFacility === 'string' ? shipmentData.currentFacility : null) || (typeof shipmentData.currentLocation === 'object' ? (shipmentData.currentLocation as any)?.facility : null) || `${originCity} Intake Terminal`,
      sender: shipmentData.sender || { name: 'Shipper', city: originCity, state: originState, country: resolveLocation(`${originCity}, ${originState}`)?.country || '' },
      recipient: shipmentData.recipient || { name: 'Consignee', city: destCity, state: destState, country: resolveLocation(`${destCity}, ${destState}`)?.country || '' },
      estimatedDelivery: normalizedDelivery,
      estimatedDeliveryDetail: shipmentData.estimatedDeliveryDetail || (typeof shipmentData.estimatedDelivery === 'object' ? (shipmentData.estimatedDelivery as any)?.timeWindow : null) || 'by 5:00 PM',
      routeCheckpoints: shipmentData.routeCheckpoints || [],
      passportStages: shipmentData.passportStages || [],
      timeline: shipmentData.timeline || [],
      pieces: (shipmentData.pieces && shipmentData.pieces.length > 0)
        ? shipmentData.pieces
        : [
            {
              pieceNumber: 1,
              totalPieces: shipmentData.totalPieces || 1,
              status: 'RECEIVED',
              statusText: shipmentStatusLabel('RECEIVED'),
              currentLocation: `${originCity}, ${originState}`,
              weightLbs: shipmentData.totalWeightLbs || 45,
              dimensions: shipmentData.dimensions || { length: 72, width: 24, height: 18 }
            }
          ],
      events: [
        {
          id: `e-${Date.now()}`,
          status: 'RECEIVED',
          title: 'Consignment Registered & Barcode Issued',
          location: `${shipmentData.origin?.city || 'New York'}, ${shipmentData.origin?.state || 'NY'}`,
          facility: 'Intake Gateway Hub',
          timestamp: 'Just now',
          description: `Shipment received into the ${COMPANY_SHORT} network. Linear Code 128 barcode assigned.`,
          delayFlag: false,
          completed: true,
          current: true
        }
      ],
      handlingRequirements: shipmentData.handlingRequirements,
      pickupWindow: shipmentData.pickupWindow,
      internalPricingNote: shipmentData.internalPricingNote
    };

    // Persist first so the shipment only appears locally with the ID the server assigned.
    // Errors propagate to the caller, which reports them in its own UI.
    const saved = await api.createShipment(draft);
    const newShipment = withTrackingId(draft, saved.trackingNumber);
    setShipments(prev => [newShipment, ...prev]);
    return newShipment;
  };

  const generateDocument = (docData: Omit<AdminDocument, 'id' | 'createdDate' | 'status' | 'version'>): AdminDocument => {
    const prefix = docData.docType === 'SHIPPING_LABEL' ? 'LBL' : docData.docType === 'RECEIPT' ? 'REC' : docData.docType === 'INVOICE' ? 'INV' : docData.docType === 'INSURANCE' ? 'INS' : 'BOL';
    const randNum = Math.floor(10000 + Math.random() * 90000);
    const newDocId = `${prefix}-2026-${randNum}`;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newDoc: AdminDocument = {
      ...docData,
      id: newDocId,
      createdDate: dateStr,
      status: 'GENERATED',
      version: 1,
      versionHistory: [
        {
          version: 1,
          createdDate: `${dateStr} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          generatedBy: ADMIN_ROLE_LABEL,
          notes: `Official document generated by ${ADMIN_ROLE_LABEL}.`
        }
      ],
      fileSize: `${Math.floor(90 + Math.random() * 200)} KB`
    };

    setDocuments(prev => [newDoc, ...prev]);
    api.generateDocument(newDoc).catch(err => console.error('[API] Failed to generate document:', err));
    return newDoc;
  };

  const regenerateDocument = (docId: string, notes?: string): AdminDocument | undefined => {
    const existing = documents.find(d => d.id === docId);
    if (!existing) return undefined;

    const nextVersion = existing.version + 1;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const updatedHistory: DocumentVersion[] = [
      {
        version: nextVersion,
        createdDate: `${dateStr} ${timeStr}`,
        generatedBy: ADMIN_ROLE_LABEL,
        notes: notes || `Regenerated version ${nextVersion} with updated parameters.`
      },
      ...(existing.versionHistory || [])
    ];

    // Re-pull the descriptive fields from the shipment's CURRENT state instead of leaving
    // them frozen at whatever they were when the document was first generated — previously
    // "Regenerate" only bumped the version number and left every real field untouched, so it
    // looked like a refresh but never actually was one. Pricing/insurance/BOL-specific fields
    // are deliberately left as-is (regenerating shouldn't silently re-price an issued document).
    const shipment = shipments.find(s => s.trackingNumber === existing.shipmentTracking);
    const refreshedFields: Partial<AdminDocument> = shipment ? {
      senderName: shipment.sender?.name || existing.senderName,
      senderCompany: shipment.sender?.company || existing.senderCompany,
      senderAddress: shipment.sender?.addressLine || existing.senderAddress,
      senderCity: shipment.origin?.city || existing.senderCity,
      senderState: shipment.origin?.state || existing.senderState,
      senderZip: (shipment.sender as any)?.postalCode || existing.senderZip,
      senderPhone: shipment.sender?.phone || existing.senderPhone,
      senderEmail: shipment.sender?.email || existing.senderEmail,
      recipientName: shipment.recipient?.name || existing.recipientName,
      recipientCompany: shipment.recipient?.company || existing.recipientCompany,
      recipientAddress: shipment.recipient?.addressLine || existing.recipientAddress,
      recipientCity: shipment.destination?.city || existing.recipientCity,
      recipientState: shipment.destination?.state || existing.recipientState,
      recipientZip: (shipment.recipient as any)?.postalCode || existing.recipientZip,
      recipientPhone: shipment.recipient?.phone || existing.recipientPhone,
      recipientEmail: shipment.recipient?.email || existing.recipientEmail,
      cargoDescription: shipment.cargoDescription || existing.cargoDescription,
      shipmentType: shipment.shipmentType || existing.shipmentType,
      service: shipment.service || existing.service,
      weightLbs: shipment.totalWeightLbs || existing.weightLbs,
      pieces: shipment.totalPieces || existing.pieces,
      dimensions: shipment.dimensions
        ? `${shipment.dimensions.length} × ${shipment.dimensions.width} × ${shipment.dimensions.height} in`
        : existing.dimensions
    } : {};

    const updatedDoc: AdminDocument = {
      ...existing,
      ...refreshedFields,
      version: nextVersion,
      status: 'UPDATED',
      createdDate: dateStr,
      versionHistory: updatedHistory
    };

    setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
    api.regenerateDocument(docId, notes, refreshedFields).catch(err => console.error('[API] Failed to regenerate document:', err));
    return updatedDoc;
  };

  const updateDocumentStatus = (docId: string, status: DocumentStatus) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status } : d));
    api.updateDocumentStatus(docId, status).catch(err => console.error('[API] Failed to update document status:', err));
  };

  const deleteDocument = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    api.deleteDocument(docId).catch(err => console.error('[API] Failed to delete document:', err));
  };

  const updateDocumentPaymentStatus = (docId: string, paymentStatus: 'PAID' | 'PENDING') => {
    setDocuments(prev => prev.map(d => d.id === docId
      ? { ...d, charges: d.charges ? { ...d.charges, paymentStatus } : d.charges }
      : d
    ));
    api.updateDocumentPaymentStatus(docId, paymentStatus).catch(err => console.error('[API] Failed to update document payment status:', err));
  };

  const updateSettings = (newSettings: Partial<AdminSettings>): Promise<{ success: boolean; error?: string }> => {
    const previous = settings;
    setSettings(prev => ({ ...prev, ...newSettings }));
    return api.updateSettings(newSettings)
      .then(() => ({ success: true }))
      .catch((err: any) => {
        console.error('[API] Failed to update settings:', err);
        // The Settings page previously always showed "Saved" regardless of whether this
        // actually reached the server — a rejected write (e.g. the Origin-check 403 while
        // the server hadn't picked up that fix yet) looked identical to a real save, so a
        // toggle like PII masking could be "on" in the admin UI while the public site kept
        // serving whatever the backend still had.
        setSettings(previous);
        return { success: false, error: err?.message };
      });
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <AdminDataContext.Provider value={{
      shipments,
      quoteRequests,
      notifications,
      settings,
      documents,
      updateShipmentDirect,
      updateShipmentFull,
      deleteShipment,
      getTrashedShipments,
      restoreShipment,
      permanentlyDeleteShipment,
      updateShipmentStatus,
      addTrackingEvent,
      correctTrackingEvent,
      publishQuote,
      updateQuoteStatus,
      createQuoteRequest,
      convertQuoteToShipment,
      createShipment,
      initiateReturn,
      updateSettings,
      markNotificationRead,
      getShipment,
      generateDocument,
      regenerateDocument,
      updateDocumentStatus,
      updateDocumentPaymentStatus,
      deleteDocument
    }}>
      {children}
    </AdminDataContext.Provider>
  );
};

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
};
