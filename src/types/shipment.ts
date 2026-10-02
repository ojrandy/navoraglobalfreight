import type { TransportMode } from '../shared/transportMode.js';

export type ShipmentStatus =
  | 'CREATED'
  | 'BOOKED'
  | 'AWAITING_PICKUP'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'IN_TRANSIT'
  | 'AT_FACILITY'
  | 'DEPARTED_FACILITY'
  | 'DESTINATION_PROCESSING'
  | 'CUSTOMS_CLEARANCE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_ATTEMPTED'
  | 'DELIVERED'
  | 'DELAYED'
  | 'EXCEPTION'
  | 'HELD'
  | 'ON_HOLD'
  | 'RETURNED'
  | 'CANCELLED';

export type HealthStatus = 'ON_TRACK' | 'POTENTIAL_DELAY' | 'ATTENTION_REQUIRED' | 'UPDATE_PENDING';

export type MapVisibility = 'EXACT' | 'APPROXIMATE' | 'FACILITY_ONLY' | 'HIDDEN';

export type MilestoneState = 'CONFIRMED' | 'ESTIMATED' | 'PENDING_CONFIRMATION';

export interface TrackingEvent {
  id: string;
  timestamp: string; // stored display string, or ISO 8601 UTC for events built in the browser
  /** When the event happened (ISO 8601), for events stored with an instant. */
  occurredAt?: string;
  /** IANA zone of the event's location, e.g. "Africa/Lagos". */
  timezone?: string;
  /** e.g. "UTC+1" */
  utcOffset?: string;
  displayDate: string; // e.g. "Sep 28, 2026"
  displayTime: string; // local time where it happened + offset, e.g. "3:04 PM UTC+1"
  title: string;
  status?: ShipmentStatus | string;
  milestoneState?: MilestoneState;
  location?: string;
  facility: string;
  city: string;
  state: string;
  description: string;
  internalNote?: string;
  operatorNotes?: string;
  eventStatus?: string;
  isCurrent?: boolean;
  isCompleted?: boolean;
  isFuture?: boolean;
  operatorId?: string; // internal provenance
  recordedBy?: string;
  correctionAudit?: {
    originalLocation?: string;
    originalTitle?: string;
    reason: string;
    correctedAt: string;
    operator: string;
  };
}

export interface PackagePiece {
  id: string;
  pieceNumber: number;
  totalPieces: number;
  trackingNumber: string; // e.g. "DLS7K2M9-01"
  status: ShipmentStatus;
  statusText: string;
  currentLocation: string;
  weightLbs: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
}

export interface ShipmentParty {
  name: string;
  company?: string;
  addressLine?: string;
  postalCode?: string;
  maskedName?: string;
  city: string;
  /** Short region shown after the city: state code for U.S. addresses, ISO country code elsewhere. */
  state: string;
  /** Full state/province/region as entered (optional). */
  region?: string;
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode?: string;
  /** International format with calling code, e.g. "+234 803 123 4567" (older records may lack it). */
  phone?: string;
  maskedPhone?: string;
  email?: string;
  instructions?: string;
  fullAddress?: string;
}

export interface RouteCheckpoint {
  id: string;
  name: string;
  state: string;
  type: 'origin' | 'previous' | 'current' | 'next' | 'destination';
  statusLabel: string;
  dateLabel?: string;
  lat: number;
  lng: number;
  svgCoords?: { x: number; y: number };
}

export interface ShipmentDocument {
  id: string;
  title: string;
  type: 'RECEIPT' | 'SHIPPING_LABEL' | 'INVOICE' | 'PROOF_OF_DELIVERY' | 'CONFIRMATION';
  status: 'AVAILABLE' | 'AVAILABLE_AFTER_DELIVERY' | 'RESTRICTED';
  version: string;
  date: string;
  fileSize?: string;
}

export interface ShipmentPassportStage {
  id: string;
  label: string;
  sublabel: string;
  status: 'completed' | 'current' | 'upcoming';
  date?: string;
}

export interface ShipmentAuditEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  reason?: string;
  durationHours?: number;
  prevETA?: string;
  newETA?: string;
  details: string;
}

export interface ReturnJourneyLeg {
  returnTrackingNumber: string;
  originalTrackingNumber: string;
  returnInitiatedDate: string;
  reason: string;
  origin: { city: string; state: string; country: string };
  destination: { city: string; state: string; country: string };
  status: ShipmentStatus;
  timeline: TrackingEvent[];
}

export interface Shipment {
  trackingNumber: string;
  barcodeCode?: string;
  id?: string;
  status: ShipmentStatus;
  statusText: string;
  statusMessage: string;
  health: HealthStatus;
  healthExplanation: string;
  progressPercent?: number;
  isHoldFrozen?: boolean;
  frozenProgressPercent?: number;
  shipmentType: 'Parcel' | 'Document' | 'Freight' | 'Pallet' | 'Container' | 'Vehicle' | 'Pets';
  cargoCategory?: string;
  cargoDescription?: string;
  petDetails?: {
    name: string;
    species: string;
    breed: string;
    age?: string;
    gender?: string;
    microchipNumber: string;
    weightLbs: number;
    crateType: string;
    crateDimensions?: { length: number; width: number; height: number };
    healthCertificateNumber?: string;
    rabiesVaccineNumber?: string;
    vetClinicName?: string;
    vetPhone?: string;
    isBrachycephalic?: boolean;
    acclimationCertified?: boolean;
    lastFedTimestamp?: string;
    waterRefillProtocol?: string;
    specialCareNotes?: string;
  };
  vehicleDetails?: {
    make: string;
    model: string;
    year: number;
    vin: string;
    color?: string;
    bodyType?: string;
    operable?: boolean;
    condition?: string;
    existingDamage?: string[];
    inspectionNotes?: string;
    itemsReceived?: string[];
    photoCount?: number;
    photos?: string[];
    licensePlate?: string;
    keys?: boolean | string;
    fuelType?: string;
  };
  palletDetails?: {
    standard: string;
    count: number;
    weightPerSkidLbs: number;
    heightIn: number;
    stackable: boolean;
    forkliftAccess: string;
    securingChecks: string[];
  };
  containerDetails?: {
    containerNumber: string;
    isoSize: string;
    boltSeal: string;
    chassisNumber: string;
    terminal: string;
    vgmWeightLbs: number;
    temperature: string;
    customsStatus: string;
  };
  freightDetails?: {
    freightClass: string;
    nmfcCode: string;
    loadingMethod: string;
    liftgatePickup: boolean;
    liftgateDelivery: boolean;
    hazMat: boolean;
    unNumber?: string;
    piecesCount: number;
    totalWeightLbs: number;
  };
  documentDetails?: {
    envelopeType: string;
    sealNumber: string;
    directSignOnly: boolean;
    urgentDeadline: string;
    filingCourtRef?: string;
    contentsDescription: string;
  };
  photos?: string[];
  service: 'Express' | 'Standard' | 'Priority' | 'Freight LTL' | string;
  /** Main-leg transport mode; the server infers it for records created before it was stored. */
  transportMode?: TransportMode;
  shipmentDate?: string;
  createdAt?: string;
  createdAtTs?: number;
  estimatedDelivery: string;
  estimatedDeliveryDetail: string;
  currentLocation: string;
  currentFacility: string;
  lastUpdated: string;
  nextStep?: string;
  nextStepLocation?: string;
  
  origin: {
    city: string;
    state: string;
    country: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
  };
  destination: {
    city: string;
    state: string;
    country: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
  };

  sender: ShipmentParty;
  recipient: ShipmentParty;

  totalWeightLbs: number;
  totalPieces: number;
  declaredValue?: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };

  references: {
    customerReference?: string;
    orderNumber?: string;
    invoiceNumber?: string;
  };

  routeCheckpoints: RouteCheckpoint[];
  timeline: TrackingEvent[];
  events?: TrackingEvent[];
  pieces: PackagePiece[];
  documents?: ShipmentDocument[];
  passportStages?: ShipmentPassportStage[];
  
  auditLog?: ShipmentAuditEntry[];
  returnLeg?: ReturnJourneyLeg;
  /** Set on a return shipment: the tracking ID of the shipment it returns. */
  returnOf?: string;
  
  exception?: {
    type: string;
    title: string;
    description: string;
    actionRequired: boolean;
    date: string;
  };
  
  // What's left after removing the client-side "Simulate" ticker (shipments now move on
  // their own, server-side, at their real pace) — just a marker that an admin manually
  // scrubbed progress via the control modal's preview slider, and when.
  simulationState?: {
    lastHeartbeat?: string;
    manualScrub?: boolean;
  };

  delayNotice?: {
    hasDelay: boolean;
    reason: string;
    delayHours: number;
    originalETA?: string;
    revisedETA?: string;
    advisoryNote?: string;
  };

  proofOfDelivery?: {
    deliveredAt: string;
    signedBy: string;
    signatureUrl?: string;
    deliveryNotes?: string;
  };

  handlingRequirements?: {
    fragile?: boolean;
    oversized?: boolean;
    specialHandling?: boolean;
    signatureRequired?: boolean;
    otherInstructions?: string;
  };
  pickupWindow?: string;
  internalPricingNote?: string;
}

