/**
 * Autonomous Logistics Planning & Dynamic Timeline Engine
 * Generates automated planned timelines, predicts milestone timestamps,
 * enforces 3-state milestone taxonomy (CONFIRMED, ESTIMATED, PENDING_CONFIRMATION),
 * and handles state-machine transitions (Hold, Delay, Return, Deliver) with full audit logging.
 */

import {
  TrackingEvent,
  ShipmentStatus,
  MilestoneState,
  Shipment,
  ShipmentAuditEntry
} from '../types/shipment.js';
import { findIntermediateHub } from './routingEngine.js';
import { ADMIN_ROLE_LABEL } from '../config/brand.js';
import { shipmentStatusLabel } from '../shared/shipmentStatus.js';
import { resolveLocation } from './geocodingService.js';

/**
 * Shipment.currentLocation is typed as a string, but the simulation engine (in motion)
 * writes it as an object ({ city, state, lat, lng }) once a shipment starts moving.
 * This safely extracts city/state regardless of which shape is actually present, instead
 * of assuming .split(',') always works and crashing when it's an object.
 */
function getLocationCityState(currentLocation: unknown): { city?: string; state?: string } {
  if (typeof currentLocation === 'string') {
    const [city, state] = currentLocation.split(',');
    return { city: city?.trim(), state: state?.trim() };
  }
  if (currentLocation && typeof currentLocation === 'object') {
    const loc = currentLocation as { city?: string; state?: string };
    return { city: loc.city, state: loc.state };
  }
  return {};
}

/** Renders currentLocation (string or object) as a "City, ST" display string. */
function formatLocationString(currentLocation: unknown): string {
  if (typeof currentLocation === 'string') return currentLocation;
  const { city, state } = getLocationCityState(currentLocation);
  return [city, state].filter(Boolean).join(', ');
}

export interface PlannedMilestone {
  id: string;
  stageName: string;
  location: string;
  facility: string;
  plannedDateTime: string;
  targetTimestamp: number; // epoch ms
  milestoneState: MilestoneState;
  status: ShipmentStatus;
  description: string;
  isConfirmed: boolean;
  isEstimated: boolean;
  isPendingConfirmation: boolean;
}

export interface ShipmentPlanResult {
  serviceCommitmentHours: number;
  pickupDateTime: string;
  estimatedDeliveryDate: string;
  estimatedDeliveryTime: string;
  plannedMilestones: PlannedMilestone[];
}

/**
 * Maps commercial service level to customer delivery SLA commitment (hours)
 * Strictly separated from physical driving duration.
 */
export function getServiceCommitmentHours(service: string, distanceMiles: number): number {
  const norm = String(service).toUpperCase();
  if (norm.includes('EXPRESS') || norm.includes('AIR')) {
    return 24; // 24h Express Air Linehaul SLA
  }
  if (norm.includes('PRIORITY')) {
    return 48; // 48h Priority SLA
  }
  if (norm.includes('FREIGHT') || norm.includes('LTL')) {
    return Math.max(72, Math.round((distanceMiles / 35) / 24) * 24);
  }
  // Standard Ground
  return Math.max(72, Math.round((distanceMiles / 30) / 24) * 24);
}

/**
 * Combines a stored `estimated_delivery_date` (date-only, e.g. "September 24, 2026") with the
 * free-text `estimated_delivery_time` field into one real timestamp. `new Date(dateOnlyString)`
 * on its own parses to MIDNIGHT (00:00:00) of that date — which silently truncated a promised
 * delivery window by however many hours had already passed that day, sometimes by nearly a
 * full 24 hours (e.g. a shipment created at 1pm promising delivery "tomorrow" was treated as
 * having only ~11 hours to arrive — until midnight tonight — instead of the intended ~24).
 * Tries to extract a real time-of-day from `estimatedDeliveryTime` first (it's inconsistently
 * formatted across this app — "by 5:00 PM", "Delivered at 2:15 PM", "Revised Schedule", "by
 * end of day" — so this only succeeds when an actual clock time is present); when it can't,
 * defaults to the END of that day (23:59:59), not the start — "delivery by September 24" means
 * sometime up through that day, not literally at its first instant.
 */
function parseEstimatedDeliveryTimestamp(dateStr: string, timeStr?: string): number | null {
  const baseDate = new Date(dateStr);
  if (isNaN(baseDate.getTime())) return null;

  const timeMatch = timeStr?.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    baseDate.setHours(hours, minutes, 0, 0);
  } else {
    baseDate.setHours(23, 59, 59, 999);
  }
  return baseDate.getTime();
}

/**
 * The pace a shipment should advance at, in hours for a full 0-100% journey — used by both
 * the automatic server-side progress sync (server/progress.ts) and the admin's manual
 * "Simulate" preview (simulationEngine.ts), so a shipment paces identically whichever
 * mechanism is driving it. Prefers the shipment's OWN real, already-stored promise
 * (createdAt -> estimatedDeliveryDate + estimatedDeliveryTime) over the generic
 * getServiceCommitmentHours default — an admin can manually override a shipment's ETA (e.g.
 * to a custom "3 days from now" regardless of what its service level would normally imply),
 * and progress must pace against whatever was actually promised for THIS shipment, not a
 * number that silently ignores that override. Falls back to the service-level default when
 * there's no usable stored date to anchor to (new/malformed rows, or an ETA that parses to
 * before its own creation time).
 */
export function resolveProgressPaceHours(
  service: string,
  distanceMiles: number,
  createdAtTs?: number | null,
  estimatedDeliveryDate?: string,
  estimatedDeliveryTime?: string
): number {
  if (createdAtTs && estimatedDeliveryDate) {
    const etaTs = parseEstimatedDeliveryTimestamp(estimatedDeliveryDate, estimatedDeliveryTime);
    if (etaTs !== null) {
      const realWindowHours = (etaTs - createdAtTs) / (1000 * 60 * 60);
      if (realWindowHours > 0.5) {
        return realWindowHours;
      }
    }
  }
  return getServiceCommitmentHours(service, distanceMiles);
}

/**
 * Formats a Date object into human-readable Date and Time strings
 */
export function formatDateTime(date: Date): { dateStr: string; timeStr: string } {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return { dateStr, timeStr };
}

/**
 * Automatically creates an initial planned shipment schedule and dual-phase timeline.
 * Never automatically converts an estimated milestone into a confirmed actual scan.
 */
export function generateShipmentPlan(
  origin: { city: string; state: string; facilityName?: string },
  destination: { city: string; state: string; facilityName?: string },
  service: string,
  distanceMiles: number,
  pickupDateStr?: string,
  confirmedEvents: TrackingEvent[] = [],
  currentStatus?: ShipmentStatus,
  currentProgress?: number
): ShipmentPlanResult {
  const slaHours = getServiceCommitmentHours(service, distanceMiles);

  const startDate = pickupDateStr ? new Date(pickupDateStr) : new Date();
  if (isNaN(startDate.getTime())) {
    startDate.setTime(Date.now());
  }

  if (startDate.getHours() === 0) {
    startDate.setHours(8, 0, 0, 0);
  }

  const originFacility = origin.facilityName || `${origin.city} Gateway Terminal`;
  const destFacility = destination.facilityName || `${destination.city} Destination Sort Center`;

  const nowMs = Date.now();

  // Dynamically identify realistic intermediate waypoint hub
  const originGeo = resolveLocation(`${origin.city}, ${origin.state}`) || { lat: 39.8283, lng: -98.5795 };
  const destGeo = resolveLocation(`${destination.city}, ${destination.state}`) || { lat: 38.9072, lng: -77.0369 };
  const intermediateHub = findIntermediateHub(
    { lat: originGeo.lat, lng: originGeo.lng, name: origin.city },
    { lat: destGeo.lat, lng: destGeo.lng, name: destination.city }
  );

  // Stage names are the CONTENT §6.3 status names.
  const midStageName = shipmentStatusLabel('IN_TRANSIT');
  const midLocation = intermediateHub ? `${intermediateHub.city}, ${intermediateHub.state}` : 'In transit';
  const midFacility = intermediateHub ? intermediateHub.facility : 'Regional Linehaul Sort Center';
  const midDescription = intermediateHub
    ? intermediateHub.description
    : `In transit toward ${destination.city}.`;

  // Milestone 1: Origin Intake
  const t0 = new Date(startDate.getTime());
  const { dateStr: d0, timeStr: tm0 } = formatDateTime(t0);

  // Milestone 2: Linehaul Departure
  const t1 = new Date(startDate.getTime() + Math.round(slaHours * 0.25 * 3600 * 1000));
  const { dateStr: d1, timeStr: tm1 } = formatDateTime(t1);

  // Milestone 3: Intermediate Sorting Hub (Midpoint)
  const t2 = new Date(startDate.getTime() + Math.round(slaHours * 0.65 * 3600 * 1000));
  const { dateStr: d2, timeStr: tm2 } = formatDateTime(t2);

  // Milestone 4: Arrival at Destination Sorting Center
  const t3 = new Date(startDate.getTime() + Math.round(slaHours * 0.85 * 3600 * 1000));
  const { dateStr: d3, timeStr: tm3 } = formatDateTime(t3);

  // Milestone 5: Out for Final Delivery
  const t4 = new Date(startDate.getTime() + Math.round(slaHours * 0.95 * 3600 * 1000));
  const { dateStr: d4, timeStr: tm4 } = formatDateTime(t4);

  // Milestone 6: Final Delivery
  const t5 = new Date(startDate.getTime() + slaHours * 3600 * 1000);
  const { dateStr: d5, timeStr: tm5 } = formatDateTime(t5);

  const rawMilestones = [
    {
      id: 'plan-orig-intake',
      stageName: shipmentStatusLabel('RECEIVED'),
      location: `${origin.city}, ${origin.state}`,
      facility: originFacility,
      plannedDateTime: `${d0} · ${tm0}`,
      targetTimestamp: t0.getTime(),
      status: 'RECEIVED' as ShipmentStatus,
      description: `Consignment tendered and registered at ${originFacility}.`
    },
    {
      id: 'plan-linehaul-depart',
      stageName: shipmentStatusLabel('DEPARTED_FACILITY'),
      location: `${origin.city}, ${origin.state}`,
      facility: originFacility,
      plannedDateTime: `${d1} · ${tm1}`,
      targetTimestamp: t1.getTime(),
      status: 'IN_TRANSIT' as ShipmentStatus,
      description: `Linehaul unit dispatched along verified corridor toward ${destination.city}.`
    },
    {
      id: 'plan-midpoint-sort',
      stageName: midStageName,
      location: midLocation,
      facility: midFacility,
      plannedDateTime: `${d2} · ${tm2}`,
      targetTimestamp: t2.getTime(),
      status: 'IN_TRANSIT' as ShipmentStatus,
      description: midDescription
    },
    {
      id: 'plan-dest-arrive',
      stageName: shipmentStatusLabel('DESTINATION_PROCESSING'),
      location: `${destination.city}, ${destination.state}`,
      facility: destFacility,
      plannedDateTime: `${d3} · ${tm3}`,
      targetTimestamp: t3.getTime(),
      status: 'AT_FACILITY' as ShipmentStatus,
      description: `Arrived at destination hub for inbound sorting and final dispatch.`
    },
    {
      id: 'plan-out-delivery',
      stageName: shipmentStatusLabel('OUT_FOR_DELIVERY'),
      location: `${destination.city}, ${destination.state}`,
      facility: destFacility,
      plannedDateTime: `${d4} · ${tm4}`,
      targetTimestamp: t4.getTime(),
      status: 'OUT_FOR_DELIVERY' as ShipmentStatus,
      description: `Loaded onto local courier unit for delivery to consignee.`
    },
    {
      id: 'plan-delivered',
      stageName: shipmentStatusLabel('DELIVERED'),
      location: `${destination.city}, ${destination.state}`,
      facility: 'Consignee Delivery Location',
      plannedDateTime: `${d5} · by ${tm5}`,
      targetTimestamp: t5.getTime(),
      status: 'DELIVERED' as ShipmentStatus,
      description: `Commercial delivery commitment completion.`
    }
  ];

  // Map 3-state taxonomy:
  // 1. CONFIRMED if an actual event exists in confirmedEvents
  // 2. PENDING_CONFIRMATION if targetTimestamp < now and overall commitment overdue
  // 3. ESTIMATED if milestone is planned ahead on schedule
  const plannedMilestones: PlannedMilestone[] = rawMilestones.map((m) => {
    const isOverallDelivered = currentStatus === 'DELIVERED' || (currentProgress !== undefined && currentProgress >= 100);
    const isOverallOutForDelivery = currentStatus === 'OUT_FOR_DELIVERY' || (currentProgress !== undefined && currentProgress >= 88);
    // Arrived at the destination gateway (or in customs there): every earlier stage is done.
    const isOverallArrived = currentStatus === 'DESTINATION_PROCESSING' || currentStatus === 'CUSTOMS_CLEARANCE';
    const isOverallAtFacility = isOverallArrived || currentStatus === 'AT_FACILITY' || (currentProgress !== undefined && currentProgress >= 65);
    const isOverallDeparted = currentStatus === 'DEPARTED_FACILITY' || (currentStatus === 'IN_TRANSIT' && (currentProgress !== undefined ? currentProgress >= 20 : true));

    let isMatchedConfirmed = false;
    if (isOverallDelivered) {
      isMatchedConfirmed = true;
    } else if (m.id === 'plan-orig-intake') {
      isMatchedConfirmed = confirmedEvents.some(e => 
        e.status === 'RECEIVED' || e.title.toLowerCase().includes('received') || e.title.toLowerCase().includes('registered') || e.title.toLowerCase().includes('created') || e.title.toLowerCase().includes('picked up')
      ) || (currentStatus !== undefined && currentStatus !== 'CREATED' && currentStatus !== 'AWAITING_PICKUP' && currentStatus !== 'BOOKED');
    } else if (m.id === 'plan-linehaul-depart') {
      isMatchedConfirmed = isOverallOutForDelivery || isOverallAtFacility || (isOverallDeparted && (confirmedEvents.some(e => 
        e.title.toLowerCase().includes('departed') || (e.status === 'IN_TRANSIT' && !e.title.toLowerCase().includes('corridor') && !e.title.toLowerCase().includes('intermediate'))
      ) || (currentProgress !== undefined && currentProgress >= 25)));
    } else if (m.id === 'plan-midpoint-sort') {
      isMatchedConfirmed = isOverallOutForDelivery || isOverallAtFacility || confirmedEvents.some(e => 
        e.title.toLowerCase().includes('corridor') || e.title.toLowerCase().includes('intermediate') || e.title.toLowerCase().includes('waypoint') || e.title.toLowerCase().includes('weigh') || (e.facility && e.facility.toLowerCase().includes('linehaul'))
      ) || (currentProgress !== undefined && currentProgress >= 60);
    } else if (m.id === 'plan-dest-arrive') {
      isMatchedConfirmed = isOverallOutForDelivery || isOverallArrived || confirmedEvents.some(e => 
        e.status === 'AT_FACILITY' || e.status === 'DESTINATION_PROCESSING' || (e.title.toLowerCase().includes('arrived') && e.title.toLowerCase().includes('destination'))
      ) || (currentProgress !== undefined && currentProgress >= 88);
    } else if (m.id === 'plan-out-delivery') {
      isMatchedConfirmed = isOverallDelivered || confirmedEvents.some(e => 
        e.status === 'OUT_FOR_DELIVERY' || e.title.toLowerCase().includes('out for delivery')
      );
    } else if (m.id === 'plan-delivered') {
      isMatchedConfirmed = isOverallDelivered || confirmedEvents.some(e => 
        e.status === 'DELIVERED' || e.title.toLowerCase().includes('delivered')
      );
    } else {
      isMatchedConfirmed = confirmedEvents.some(e => e.id === m.id || e.title.toLowerCase().includes(m.stageName.toLowerCase()));
    }

    if (isMatchedConfirmed) {
      return {
        ...m,
        milestoneState: 'CONFIRMED' as MilestoneState,
        isConfirmed: true,
        isEstimated: false,
        isPendingConfirmation: false
      };
    }

    const isOverdue = nowMs > t5.getTime();
    const hasPassedMilestoneTime = m.targetTimestamp < nowMs;

    if (isOverdue && hasPassedMilestoneTime) {
      return {
        ...m,
        milestoneState: 'PENDING_CONFIRMATION' as MilestoneState,
        isConfirmed: false,
        isEstimated: false,
        isPendingConfirmation: true,
        description: 'Scheduled transit window passed; awaiting carrier telemetry scan.'
      };
    }

    return {
      ...m,
      milestoneState: 'ESTIMATED' as MilestoneState,
      isConfirmed: false,
      isEstimated: true,
      isPendingConfirmation: false
    };
  });

  return {
    serviceCommitmentHours: slaHours,
    pickupDateTime: `${d0} at ${tm0}`,
    estimatedDeliveryDate: d5,
    estimatedDeliveryTime: tm5,
    plannedMilestones
  };
}

/**
 * Creates an immutable Audit Log Entry for administrator operational actions
 */
export function createAuditLogEntry(
  operator: string,
  action: string,
  details: string,
  params?: {
    reason?: string;
    durationHours?: number;
    prevETA?: string;
    newETA?: string;
  }
): ShipmentAuditEntry {
  const now = new Date();
  return {
    id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    timestamp: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    operator: operator || ADMIN_ROLE_LABEL,
    action,
    reason: params?.reason,
    durationHours: params?.durationHours,
    prevETA: params?.prevETA,
    newETA: params?.newETA,
    details
  };
}

/**
 * Recalculates Delivery ETA when a Hold (+hours) or Delay (+hours) is applied
 */
export function recalculateETAOnDelay(
  currentETADateStr: string,
  delayHours: number
): { newETADate: string; newETATime: string } {
  let dateObj = new Date(currentETADateStr);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + 3);
    dateObj.setHours(17, 0, 0, 0); // 5:00 PM
  }

  const updatedEpoch = dateObj.getTime() + delayHours * 3600 * 1000;
  const newDateObj = new Date(updatedEpoch);

  const { dateStr, timeStr } = formatDateTime(newDateObj);
  return { newETADate: dateStr, newETATime: timeStr };
}

/**
 * 1. HOLD Handler: Freezes progress %, freezes estimated position, pushes ETA
 */
export function applyHoldState(
  shipment: Shipment,
  holdReason: string,
  holdHours: number,
  operator = ADMIN_ROLE_LABEL
): { updatedShipment: Shipment; auditEntry: ShipmentAuditEntry; event: TrackingEvent } {
  const prevETA = typeof shipment.estimatedDelivery === 'string'
    ? shipment.estimatedDelivery
    : (shipment.estimatedDelivery as any)?.date || 'On Schedule';

  const { newETADate, newETATime } = recalculateETAOnDelay(prevETA, holdHours);
  const newETA = `${newETADate} • ${newETATime}`;

  const currentProgress = shipment.progressPercent ?? 35;

  const updatedShipment: Shipment = {
    ...shipment,
    status: 'ON_HOLD',
    statusText: `${shipmentStatusLabel('ON_HOLD')} (${holdReason})`,
    statusMessage: `Shipment temporarily paused: ${holdReason}. Delivery ETA extended by +${holdHours} hours.`,
    isHoldFrozen: true,
    frozenProgressPercent: currentProgress,
    progressPercent: currentProgress,
    // estimatedDelivery/estimatedDeliveryDetail (date + time-window, matching how every other
    // part of the app models ETA — see Shipment type) rather than one combined "date • time"
    // string, so this pushed-back ETA actually round-trips through the backend's separate
    // estimated_delivery_date/estimated_delivery_time columns instead of getting silently
    // dropped by callers that expect the split shape.
    estimatedDelivery: newETADate,
    estimatedDeliveryDetail: newETATime,
    lastUpdated: 'Just now'
  };

  const now = new Date();
  const timestampStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const event: TrackingEvent = {
    id: `ev-${Date.now()}`,
    status: 'ON_HOLD',
    milestoneState: 'CONFIRMED',
    title: `Shipment Placed On Hold: ${holdReason}`,
    location: formatLocationString(shipment.currentLocation),
    facility: shipment.currentFacility || `${shipment.origin.city} Sorting Hub`,
    city: getLocationCityState(shipment.currentLocation).city || shipment.origin.city,
    state: getLocationCityState(shipment.currentLocation).state || shipment.origin.state,
    timestamp: timestampStr,
    displayDate: timestampStr.split(' · ')[0],
    displayTime: timestampStr.split(' · ')[1],
    description: `Operational hold initiated. Linehaul movement paused. Delivery ETA extended by +${holdHours}h to ${newETADate}.`,
    isCompleted: true,
    isCurrent: true,
    recordedBy: operator
  };

  const auditEntry = createAuditLogEntry(
    operator,
    'HOLD_APPLIED',
    `Shipment placed on hold for ${holdReason}. Progress frozen at ${currentProgress}%. ETA pushed by +${holdHours}h.`,
    {
      reason: holdReason,
      durationHours: holdHours,
      prevETA,
      newETA
    }
  );

  updatedShipment.timeline = [event, ...(shipment.timeline || []).map(e => ({ ...e, isCurrent: false }))];
  updatedShipment.auditLog = [auditEntry, ...(shipment.auditLog || [])];

  return { updatedShipment, auditEntry, event };
}

/**
 * 2. RESUME Handler: Unfreezes hold and continues linehaul progression
 */
export function applyResumeState(
  shipment: Shipment,
  operator = ADMIN_ROLE_LABEL
): { updatedShipment: Shipment; auditEntry: ShipmentAuditEntry; event: TrackingEvent } {
  const currentProgress = shipment.frozenProgressPercent ?? shipment.progressPercent ?? 35;

  const updatedShipment: Shipment = {
    ...shipment,
    status: 'IN_TRANSIT',
    statusText: shipmentStatusLabel('IN_TRANSIT'),
    statusMessage: 'Hold condition resolved. Shipment movement has resumed along its planned route.',
    isHoldFrozen: false,
    progressPercent: currentProgress,
    lastUpdated: 'Just now'
  };

  const now = new Date();
  const timestampStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const event: TrackingEvent = {
    id: `ev-${Date.now()}`,
    status: 'IN_TRANSIT',
    milestoneState: 'CONFIRMED',
    title: 'Linehaul Transit Resumed',
    location: formatLocationString(shipment.currentLocation),
    facility: shipment.currentFacility || `${shipment.origin.city} Gateway`,
    city: getLocationCityState(shipment.currentLocation).city || shipment.origin.city,
    state: getLocationCityState(shipment.currentLocation).state || shipment.origin.state,
    timestamp: timestampStr,
    displayDate: timestampStr.split(' · ')[0],
    displayTime: timestampStr.split(' · ')[1],
    description: 'Operational hold resolved. Consignment moving toward destination on revised schedule.',
    isCompleted: true,
    isCurrent: true,
    recordedBy: operator
  };

  const auditEntry = createAuditLogEntry(
    operator,
    'TRANSIT_RESUMED',
    `Operational hold resolved. Linehaul progression resumed from ${currentProgress}%.`
  );

  updatedShipment.timeline = [event, ...(shipment.timeline || []).map(e => ({ ...e, isCurrent: false }))];
  updatedShipment.auditLog = [auditEntry, ...(shipment.auditLog || [])];

  return { updatedShipment, auditEntry, event };
}

/**
 * 3. DELAY Handler: Shifts operational schedule without freezing movement
 */
export function applyDelayState(
  shipment: Shipment,
  delayReason: string,
  delayHours: number,
  operator = ADMIN_ROLE_LABEL
): { updatedShipment: Shipment; auditEntry: ShipmentAuditEntry; event: TrackingEvent } {
  const prevETA = typeof shipment.estimatedDelivery === 'string'
    ? shipment.estimatedDelivery
    : (shipment.estimatedDelivery as any)?.date || 'On Schedule';

  const { newETADate, newETATime } = recalculateETAOnDelay(prevETA, delayHours);
  const newETA = `${newETADate} • ${newETATime}`;

  const updatedShipment: Shipment = {
    ...shipment,
    status: 'DELAYED',
    statusText: `${shipmentStatusLabel('DELAYED')} (${delayReason})`,
    statusMessage: `Corridor transit delay: ${delayReason}. New estimated delivery is ${newETADate}.`,
    // Split date/time, matching the app's ETA convention — see the same fix in applyHoldState.
    estimatedDelivery: newETADate,
    estimatedDeliveryDetail: newETATime,
    lastUpdated: 'Just now'
  };

  const now = new Date();
  const timestampStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const event: TrackingEvent = {
    id: `ev-${Date.now()}`,
    status: 'DELAYED',
    milestoneState: 'CONFIRMED',
    title: `Transit Delay Advisory: ${delayReason}`,
    location: formatLocationString(shipment.currentLocation),
    facility: shipment.currentFacility || 'In transit',
    city: getLocationCityState(shipment.currentLocation).city || shipment.origin.city,
    state: getLocationCityState(shipment.currentLocation).state || shipment.origin.state,
    timestamp: timestampStr,
    displayDate: timestampStr.split(' · ')[0],
    displayTime: timestampStr.split(' · ')[1],
    description: `Corridor schedule delay recorded: ${delayReason}. Estimated delivery commitment adjusted by +${delayHours}h.`,
    isCompleted: true,
    isCurrent: true,
    recordedBy: operator
  };

  const auditEntry = createAuditLogEntry(
    operator,
    'DELAY_LOGGED',
    `Delay logged: ${delayReason}. Transit schedule shifted by +${delayHours}h.`,
    {
      reason: delayReason,
      durationHours: delayHours,
      prevETA,
      newETA
    }
  );

  updatedShipment.timeline = [event, ...(shipment.timeline || []).map(e => ({ ...e, isCurrent: false }))];
  updatedShipment.auditLog = [auditEntry, ...(shipment.auditLog || [])];

  return { updatedShipment, auditEntry, event };
}

/**
 * Calculates genuine dynamic time-elapsed progress percentage (0 - 100%)
 * based on start time, SLA duration hours, and real-world clock time.
 */
export function calculateDynamicTimeProgress(
  shipment: Shipment | null | undefined,
  serviceCommitmentHours: number = 24
): {
  progressPercent: number;
  interpolatedLocation: string;
  isCompletedTime: boolean;
  activeMilestoneStage: string;
} {
  if (!shipment) {
    return { progressPercent: 15, interpolatedLocation: 'Origin Sort Facility', isCompletedTime: false, activeMilestoneStage: 'Intake' };
  }

  const status = shipment.status || 'IN_TRANSIT';
  if (status === 'DELIVERED') {
    return {
      progressPercent: 100,
      interpolatedLocation: `${shipment.destination?.city || 'Destination'}, ${shipment.destination?.state || ''}`,
      isCompletedTime: true,
      activeMilestoneStage: 'Delivered'
    };
  }

  if (status === 'ON_HOLD' || status === 'HELD') {
    const frozen = shipment.frozenProgressPercent ?? shipment.progressPercent ?? 35;
    return {
      progressPercent: frozen,
      interpolatedLocation: typeof shipment.currentLocation === 'string'
        ? shipment.currentLocation
        : `${(shipment.currentLocation as any)?.city || 'Transit Hub'}, ${(shipment.currentLocation as any)?.state || ''}`,
      isCompletedTime: false,
      activeMilestoneStage: 'Hold Staged'
    };
  }

  if (status === 'CREATED' || status === 'AWAITING_PICKUP' || status === 'BOOKED') {
    return {
      progressPercent: 0,
      interpolatedLocation: `${shipment.origin?.city || 'Origin'}, ${shipment.origin?.state || ''}`,
      isCompletedTime: false,
      activeMilestoneStage: 'Consignment Created'
    };
  }

  if (status === 'RECEIVED') {
    return {
      progressPercent: 5,
      interpolatedLocation: `${shipment.origin?.city || 'Origin'}, ${shipment.origin?.state || ''}`,
      isCompletedTime: false,
      activeMilestoneStage: 'Received at Origin Terminal'
    };
  }

  // Determine start timestamp: earliest event timestamp, shipment createdAt, or pickupDate
  let startMs = Date.now() - 4 * 3600 * 1000; // default 4 hours ago
  const events = shipment.timeline || shipment.events || [];
  if (events.length > 0) {
    let oldest = new Date(events[0].timestamp).getTime();
    for (const ev of events) {
      const t = new Date(ev.timestamp).getTime();
      if (!isNaN(t) && t < oldest) {
        oldest = t;
      }
    }
    if (!isNaN(oldest) && oldest > 0) {
      startMs = oldest;
    }
  } else if ((shipment as any).createdAt) {
    const parsed = new Date((shipment as any).createdAt).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      startMs = parsed;
    }
  } else if ((shipment as any).pickupDate) {
    const parsed = new Date((shipment as any).pickupDate).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      startMs = parsed;
    }
  }

  const totalDurationMs = Math.max(1, serviceCommitmentHours * 3600 * 1000);
  const nowMs = Date.now();
  const elapsedMs = Math.max(0, nowMs - startMs);

  let ratio = elapsedMs / totalDurationMs;
  if (ratio > 1) ratio = 1;

  // Real-time dynamic progress calculation
  let dynamicProgress = Math.round(ratio * 100);

  // If status is IN_TRANSIT and time has elapsed 24h+, progress reaches destination gateway (90-95%)
  if (status === 'IN_TRANSIT') {
    dynamicProgress = Math.max(15, Math.min(94, dynamicProgress));
  } else if (status === 'OUT_FOR_DELIVERY') {
    dynamicProgress = Math.max(88, Math.min(98, dynamicProgress));
  } else if (status === 'AT_FACILITY' || status === 'DEPARTED_FACILITY') {
    dynamicProgress = Math.max(dynamicProgress, 50);
  }

  const originCity = shipment.origin?.city || 'Origin';
  const destCity = shipment.destination?.city || 'Destination';

  let activeMilestoneStage = 'In Linehaul';
  if (dynamicProgress >= 90) {
    activeMilestoneStage = `Arrived at ${destCity} Gateway`;
  } else if (dynamicProgress >= 65) {
    activeMilestoneStage = 'Approaching Regional Hub';
  } else if (dynamicProgress >= 35) {
    activeMilestoneStage = 'In transit';
  }

  return {
    progressPercent: dynamicProgress,
    interpolatedLocation: `${originCity} → ${destCity}`,
    isCompletedTime: ratio >= 1,
    activeMilestoneStage
  };
}

