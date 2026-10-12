import { AdminShipmentImage, Shipment, ShipmentStatus, TrackingEvent } from '../types/shipment';
import { QuoteRequest, QuoteRequestPricing, QuoteRequestStatus, AdminSettings, AdminDocument, DocumentStatus, ContactMessage, ContactMessageStatus } from '../types/admin';
import type { ShipmentPayment } from '../shared/paymentRequest';
import type { AdminPaymentProof, ProofStatus } from '../shared/paymentProof';

/** Body for PUT /api/shipments/:id/payment (validated by validatePaymentRequest on the server). */
export interface PaymentRequestBody {
  amount: number | string;
  currency: string;
  chargeReason: string;
  dueDate?: string;
  invoiceDocumentId?: string;
  customerNote?: string;
  methods: { id?: string; type: string; label?: string; details: Record<string, string>; instructions?: string }[];
}

/** Body for POST /api/track/:id/payment-proof (validated by validateProofSubmission on the server). */
export interface PaymentProofBody {
  methodId: string;
  payerName: string;
  amountSent: number | string;
  reference?: string;
  image: string;
}

const API_BASE = '/api';

// ---------------------------------------------------------------------------------------------
// Every request in this module goes through fetchApi (update I.6). The hosting CDN sometimes
// answers an API call with an HTML page (its bot check, or a placeholder while the app restarts)
// or drops the connection. Reads are safe to repeat, so they are retried twice with a short
// pause; writes are sent once, so nothing is ever saved twice.
// ---------------------------------------------------------------------------------------------

const RETRY_DELAYS_MS = [700, 1800];
const UNREACHABLE = "We couldn't reach the server just now. Please try again in a moment.";
const UNCONFIRMED = "We couldn't confirm the server received this. Refresh the page to check, then try again if needed.";
// The method of each response, so handleResponse can word a failed write differently.
const requestMethods = new WeakMap<Response, string>();

const isJsonResponse = (res: Response) => (res.headers.get('content-type') || '').includes('json');

async function fetchApi(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const attempts = retryable ? RETRY_DELAYS_MS.length + 1 : 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      const res = await fetch(input, init);
      requestMethods.set(res, method);
      // A non-JSON reply to a read is the CDN, not the app: try again.
      if (retryable && !isJsonResponse(res) && res.status !== 204 && attempt < attempts - 1) continue;
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn(`[api] ${method} ${input} failed: no response from the server.`, lastError);
  const err: any = new Error(retryable ? UNREACHABLE : UNCONFIRMED);
  err.status = 0;
  err.unreachable = true;
  throw err;
}

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    // Not the app's answer (see fetchApi). Keep the technical details in the console only.
    const method = requestMethods.get(res) || 'GET';
    console.warn(`[api] ${method} ${res.url} returned a non-JSON reply (HTTP ${res.status}, ${res.headers.get('content-type') || 'no content type'}):`, text.slice(0, 160));
    const err: any = new Error(method === 'GET' || method === 'HEAD' ? UNREACHABLE : UNCONFIRMED);
    err.status = res.status;
    err.unreachable = true;
    throw err;
  }
  if (!res.ok || json.success === false) {
    // Attaching the real HTTP status lets callers tell "not authenticated, stop retrying"
    // apart from "transient failure, keep retrying" — see AdminDataContext's periodic
    // refresh, which used to retry every 12s forever even for a logged-out visitor.
    const err: any = new Error(json.error || `HTTP error ${res.status}`);
    err.status = res.status;
    // Per-field messages from form endpoints (e.g. payment methods), keyed by field name.
    if (json.fieldErrors) err.fieldErrors = json.fieldErrors;
    throw err;
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Admin Auth
  async login(password: string): Promise<{ success: boolean }> {
    let res: Response;
    try {
      res = await fetchApi(`${API_BASE}/auth/login`, {
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
    await fetchApi(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  },

  async checkSession(): Promise<boolean> {
    try {
      const res = await fetchApi(`${API_BASE}/auth/session`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      return Boolean(json?.isAdmin);
    } catch {
      return false;
    }
  },

  // Public Tracking
  async trackShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  // Proof of payment from the track page (public, rate-limited; update F.2). image is base64 or a data: URL.
  async submitPaymentProof(trackingNumber: string, proof: PaymentProofBody): Promise<{ status: 'SUBMITTED'; submittedAt: string }> {
    const res = await fetchApi(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}/payment-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });
    return handleResponse<{ status: 'SUBMITTED'; submittedAt: string }>(res);
  },

  // Public Booking & Quotes
  async submitPublicQuote(quoteData: Partial<QuoteRequest>): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });
    return handleResponse<QuoteRequest>(res);
  },

  async submitPublicShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments`, {
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
    const res = await fetchApi(`${API_BASE}/shipments?${query.toString()}`);
    return handleResponse<Shipment[]>(res);
  },

  // Soft-deleted shipments — "Delete" moves a shipment here rather than erasing it; this is
  // the Recently Deleted / trash list.
  async getTrashedShipments(): Promise<Shipment[]> {
    const res = await fetchApi(`${API_BASE}/shipments?trash=true`);
    return handleResponse<Shipment[]>(res);
  },

  async restoreShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/restore`, {
      method: 'POST'
    });
    return handleResponse<Shipment>(res);
  },

  // Permanent, irreversible delete — only ever called from the trash view on a shipment
  // that's already soft-deleted, as a deliberate separate action from the ordinary delete.
  async permanentlyDeleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/permanent`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Single fresh shipment, server-synced (unmasked, admin-only — never call this from a
  // public-facing page; use trackShipment there instead).
  async getShipment(trackingNumber: string): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`);
    return handleResponse<Shipment>(res);
  },

  async createShipment(shipmentData: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments`, {
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
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, location, facility, notes, progressPercent, statusText, lat, lng, eventTitle, skipEventCreation, estimatedDeliveryDate, estimatedDeliveryTime })
    });
    return handleResponse<Shipment>(res);
  },

  async updateShipment(trackingNumber: string, shipment: Partial<Shipment>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment)
    });
    return handleResponse<Shipment>(res);
  },

  async addTrackingEvent(trackingNumber: string, event: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return handleResponse<Shipment>(res);
  },

  async correctTrackingEvent(trackingNumber: string, eventId: string, updates: Partial<TrackingEvent>): Promise<Shipment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<Shipment>(res);
  },

  // Return to origin: the server creates the return as its own shipment with a new NGF ID.
  async initiateReturn(trackingNumber: string, reason: string, operator?: string): Promise<{ original: Shipment; returnShipment: Shipment }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, operator })
    });
    return handleResponse<{ original: Shipment; returnShipment: Shipment }>(res);
  },

  async deleteShipment(trackingNumber: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Package images (admin). Every call returns the shipment's full, ordered image list.
  async getShipmentImages(trackingNumber: string): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images`);
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async uploadShipmentImage(
    trackingNumber: string,
    image: { base64: string; caption: string; isPublic: boolean; width: number; height: number }
  ): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: image.base64, caption: image.caption, isPublic: image.isPublic, width: image.width, height: image.height })
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async updateShipmentImage(trackingNumber: string, imageId: string, updates: { caption?: string; isPublic?: boolean }): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/${encodeURIComponent(imageId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async reorderShipmentImages(trackingNumber: string, ids: string[]): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  async deleteShipmentImage(trackingNumber: string, imageId: string): Promise<AdminShipmentImage[]> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/images/${encodeURIComponent(imageId)}`, {
      method: 'DELETE'
    });
    return handleResponse<AdminShipmentImage[]>(res);
  },

  // Payment request per shipment (admin only). Accounts are typed per shipment (update D-9).
  async getShipmentPayment(trackingNumber: string): Promise<ShipmentPayment | null> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`);
    return handleResponse<ShipmentPayment | null>(res);
  },

  async saveShipmentPayment(trackingNumber: string, request: PaymentRequestBody): Promise<ShipmentPayment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return handleResponse<ShipmentPayment>(res);
  },

  async setShipmentPaymentStatus(trackingNumber: string, action: 'cancel' | 'mark_paid' | 'reopen'): Promise<ShipmentPayment> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    return handleResponse<ShipmentPayment>(res);
  },

  // Proofs of payment (admin Payments page, update F.5). Screenshots load from each proof's fileUrl.
  async getPaymentProofs(status?: ProofStatus): Promise<AdminPaymentProof[]> {
    const res = await fetchApi(`${API_BASE}/payments/proofs${status ? `?status=${status}` : ''}`);
    return handleResponse<AdminPaymentProof[]>(res);
  },

  // Review (update F.6). Approving marks the request and its linked invoice paid.
  async approvePaymentProof(id: string, addTrackingEvent: boolean): Promise<AdminPaymentProof> {
    const res = await fetchApi(`${API_BASE}/payments/proofs/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addTrackingEvent })
    });
    return handleResponse<AdminPaymentProof>(res);
  },

  async rejectPaymentProof(id: string, reason: string): Promise<AdminPaymentProof> {
    const res = await fetchApi(`${API_BASE}/payments/proofs/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return handleResponse<AdminPaymentProof>(res);
  },

  async deleteShipmentPayment(trackingNumber: string): Promise<void> {
    const res = await fetchApi(`${API_BASE}/shipments/${encodeURIComponent(trackingNumber)}/payment`, { method: 'DELETE' });
    await handleResponse<null>(res);
  },

  // Admin Quotes
  async getQuotes(): Promise<QuoteRequest[]> {
    const res = await fetchApi(`${API_BASE}/quotes`);
    return handleResponse<QuoteRequest[]>(res);
  },

  // Public: a single quote by its own ID (used by the "look up my quote" flow) — scoped to
  // one record instead of pulling every customer's quotes to find a match client-side.
  async getPublicQuote(id: string): Promise<QuoteRequest | null> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return handleResponse<QuoteRequest>(res);
  },

  async publishQuote(id: string, pricing: QuoteRequestPricing, internalNotes?: string): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricing, internalNotes })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async updateQuoteStatus(id: string, status: QuoteRequestStatus, validUntil?: string): Promise<QuoteRequest> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, validUntil })
    });
    return handleResponse<QuoteRequest>(res);
  },

  async convertQuoteToShipment(id: string, shipment?: Partial<Shipment>): Promise<{ trackingNumber: string; data: Shipment }> {
    const res = await fetchApi(`${API_BASE}/quotes/${encodeURIComponent(id)}/convert`, {
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
    const res = await fetchApi(`${API_BASE}/documents?${query.toString()}`);
    return handleResponse<AdminDocument[]>(res);
  },

  async generateDocument(docData: AdminDocument): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    return handleResponse<AdminDocument>(res);
  },

  async regenerateDocument(id: string, notes?: string, refreshedFields?: Partial<AdminDocument>): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, ...refreshedFields })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentStatus(id: string, status: DocumentStatus): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return handleResponse<AdminDocument>(res);
  },

  async updateDocumentPaymentStatus(id: string, paymentStatus: 'PAID' | 'PENDING'): Promise<AdminDocument> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}/payment-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus })
    });
    return handleResponse<AdminDocument>(res);
  },

  async deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Settings
  async getSettings(): Promise<AdminSettings> {
    const res = await fetchApi(`${API_BASE}/settings`);
    return handleResponse<AdminSettings>(res);
  },

  async updateSettings(settings: Partial<AdminSettings>): Promise<AdminSettings> {
    const res = await fetchApi(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse<AdminSettings>(res);
  },

  // Contact form (public submit) and the admin Messages inbox
  async submitContactMessage(message: Pick<ContactMessage, 'name' | 'email' | 'phone' | 'subject' | 'priority' | 'trackingNumber' | 'gatewayCode' | 'message'>): Promise<ContactMessage> {
    const res = await fetchApi(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return handleResponse<ContactMessage>(res);
  },

  async getContactMessages(): Promise<ContactMessage[]> {
    const res = await fetchApi(`${API_BASE}/messages`, { credentials: 'include' });
    return handleResponse<ContactMessage[]>(res);
  },

  async updateContactMessageStatus(id: string, status: ContactMessageStatus): Promise<ContactMessage> {
    const res = await fetchApi(`${API_BASE}/messages/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    return handleResponse<ContactMessage>(res);
  },

  // Dashboard Stats
  async getStats(): Promise<any> {
    const res = await fetchApi(`${API_BASE}/stats`, { credentials: 'include' });
    return handleResponse<any>(res);
  }
};
