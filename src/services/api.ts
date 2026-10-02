import { Shipment, ShipmentStatus, TrackingEvent } from '../types/shipment';
import { QuoteRequest, QuoteRequestPricing, QuoteRequestStatus, AdminSettings, AdminDocument, DocumentStatus, ContactMessage, ContactMessageStatus } from '../types/admin';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any;
  try {
    json = await res.json();
  } catch {
    const err: any = new Error(`Server returned non-JSON response (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (!res.ok || json.success === false) {
    // Attaching the real HTTP status lets callers tell "not authenticated, stop retrying"
    // apart from "transient failure, keep retrying" — see AdminDataContext's periodic
    // refresh, which used to retry every 12s forever even for a logged-out visitor.
    const err: any = new Error(json.error || `HTTP error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Admin Auth
  async login(password: string): Promise<{ success: boolean }> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ password })
      });
    } catch {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    let json: any;
    try {
      json = await res.json();
    } catch {
      // The hosting CDN has been seen answering with an empty or HTML body. The body is
      // unreliable but the session cookie isn't, so ask the server whether login took.
      if (res.ok && await api.checkSession()) return { success: true };
      if (res.status === 401) throw new Error('Incorrect password.');
      if (res.status === 429) throw new Error('Too many login attempts. Try again in a few minutes.');
      throw new Error('Sign-in is temporarily unavailable. Please try again in a moment.');
    }
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `HTTP error ${res.status}`);
    }
    return json;
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  },

  async checkSession(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      return Boolean(json?.isAdmin);
    } catch {
      return false;
    }
  },

  // Public Tracking
  async trackShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  // Public Booking & Quotes
  async submitPublicQuote(quoteData: Partial<QuoteRequest>): Promise<QuoteRequest> {
    const res = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });
    return handleResponse<QuoteRequest>(res);
  },

  async submitPublicShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipmentData)
    });
    return handleResponse<Shipment>(res);
  },

  // Admin Shipments
  async getShipments(params?: { search?: string; status?: string }): Promise<Shipment[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const res = await fetch(`${API_BASE}/shipments?${query.toString()}`);
    return handleResponse<Shipment[]>(res);
  },

  // Soft-deleted shipments — "Delete" moves a shipment here rather than erasing it; this is
  // the Recently Deleted / trash list.
  async getTrashedShipments(): Promise<Shipment[]> {
    const res = await fetch(`${API_BASE}/shipments?trash=true`);
    return handleResponse<Shipment[]>(res);
  },

  async restoreShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/restore`, {
      method: 'POST'
    });
    return handleResponse<Shipment>(res);
  },

  // Permanent, irreversible delete — only ever called from the trash view on a shipment
  // that's already soft-deleted, as a deliberate separate action from the ordinary delete.
  async permanentlyDeleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/permanent`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Single fresh shipment, server-synced (unmasked, admin-only — never call this from a
  // public-facing page; use trackShipment there instead).
  async getShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  async createShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipmentData)
    });
    return handleResponse<Shipment>(res);
  },

  async updateShipmentStatus(
    trackingNumber: string,
    newStatus: ShipmentStatus,
    location?: string,
    facility?: string,
    notes?: string,
    progressPercent?: number,
    statusText?: string,
    lat?: number,
    lng?: number,
    eventTitle?: string,
    skipEventCreation?: boolean,
    estimatedDeliveryDate?: string,
    estimatedDeliveryTime?: string
  ): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, location, facility, notes, progressPercent, statusText, lat, lng, eventTitle, skipEventCreation, estimatedDeliveryDate, estimatedDeliveryTime })
    });
    return handleResponse<Shipment>(res);
  },

  async updateShipment(trackingNumber: string, shipment: Partial<Shipment>): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment)
    });
    return handleResponse<Shipment>(res);
  },

  async addTrackingEvent(trackingNumber: string, event: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return handleResponse<Shipment>(res);
  },

  async correctTrackingEvent(trackingNumber: string, eventId: string, updates: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<Shipment>(res);
  },

  // Return to origin: the server creates the return as its own shipment with a new NGF ID.
  async initiateReturn(trackingNumber: string, reason: string, operator?: string): Promise<{ original: Shipment; returnShipment: Shipment }> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, operator })
    });
    return handleResponse<{ original: Shipment; returnShipment: Shipment }>(res);
  },

  async deleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Admin Quotes
  async getQuotes(): Promise<QuoteRequest[]> {
    const res = await fetch(`${API_BASE}/quotes`);
    return handleResponse<QuoteRequest[]>(res);
  },

  // Public: a single quote by its own ID (used by the "look up my quote" flow) — scoped to
  // one record instead of pulling every customer's quotes to find a match client-side.
  async getPublicQuote(id: string): Promise<QuoteRequest | null> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return handleResponse<QuoteRequest>(res);
  },

  async publishQuote(id: string, pricing: QuoteRequestPricing, internalNotes?: string): Promise<QuoteRequest> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(id)}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricing, internalNotes })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async updateQuoteStatus(id: string, status: QuoteRequestStatus, validUntil?: string): Promise<QuoteRequest> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, validUntil })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async convertQuoteToShipment(id: string, shipment?: Partial<Shipment>): Promise<{ trackingNumber: string; data: Shipment }> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(id)}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment || {})
    });
    // The new ID is sent beside `data` (a raw database row), and handleResponse returns only
    // `data`, so read it from the top-level body first.
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<Shipment>(res);
    return { trackingNumber: body?.trackingNumber, data };
  },

  // Admin Documents
  async getDocuments(params?: { docType?: string; status?: string; search?: string }): Promise<AdminDocument[]> {
    const query = new URLSearchParams();
    if (params?.docType) query.set('docType', params.docType);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const res = await fetch(`${API_BASE}/documents?${query.toString()}`);
    return handleResponse<AdminDocument[]>(res);
  },

  async generateDocument(docData: AdminDocument): Promise<AdminDocument> {
    const res = await fetch(`${API_BASE}/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    return handleResponse<AdminDocument>(res);
  },

  async regenerateDocument(id: string, notes?: string, refreshedFields?: Partial<AdminDocument>): Promise<AdminDocument> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, ...refreshedFields })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentStatus(id: string, status: DocumentStatus): Promise<AdminDocument> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentPaymentStatus(id: string, paymentStatus: 'PAID' | 'PENDING'): Promise<AdminDocument> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/payment-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus })
    });
    return handleResponse<AdminDocument>(res);
  },

  async deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Settings
  async getSettings(): Promise<AdminSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<AdminSettings>(res);
  },

  async updateSettings(settings: Partial<AdminSettings>): Promise<AdminSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse<AdminSettings>(res);
  },

  // Contact form (public submit) and the admin Messages inbox
  async submitContactMessage(message: Pick<ContactMessage, 'name' | 'email' | 'phone' | 'subject' | 'priority' | 'trackingNumber' | 'gatewayCode' | 'message'>): Promise<ContactMessage> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return handleResponse<ContactMessage>(res);
  },

  async getContactMessages(): Promise<ContactMessage[]> {
    const res = await fetch(`${API_BASE}/messages`, { credentials: 'include' });
    return handleResponse<ContactMessage[]>(res);
  },

  async updateContactMessageStatus(id: string, status: ContactMessageStatus): Promise<ContactMessage> {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    return handleResponse<ContactMessage>(res);
  },

  // Dashboard Stats
  async getStats(): Promise<any> {
    const res = await fetch(`${API_BASE}/stats`);
    return handleResponse<any>(res);
  }
};
