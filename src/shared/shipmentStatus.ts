// Shipment status names shown to customers and staff (CONTENT §6.3). Shared by the browser and
// the server so the public track page, the admin console and server-written status text agree.

export type StatusTone = 'booked' | 'transit' | 'out' | 'delivered' | 'hold' | 'delayed' | 'returning';

interface StatusDef {
  value: string;
  label: string;
  tone: StatusTone;
}

// The statuses an admin can set, in journey order. `value` is the stored code (DB column
// `status`); codes are not renamed, only their names.
export const SHIPMENT_STATUS_OPTIONS: readonly StatusDef[] = [
  { value: 'BOOKED', label: 'Booked', tone: 'booked' },
  { value: 'RECEIVED', label: 'Collected', tone: 'transit' },
  { value: 'PROCESSING', label: 'At origin gateway', tone: 'transit' },
  { value: 'DEPARTED_FACILITY', label: 'Departed', tone: 'transit' },
  { value: 'IN_TRANSIT', label: 'In transit', tone: 'transit' },
  { value: 'DESTINATION_PROCESSING', label: 'Arrived at destination gateway', tone: 'transit' },
  { value: 'CUSTOMS_CLEARANCE', label: 'Customs clearance', tone: 'transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery', tone: 'out' },
  { value: 'DELIVERED', label: 'Delivered', tone: 'delivered' },
  { value: 'ON_HOLD', label: 'On hold', tone: 'hold' },
  { value: 'DELAYED', label: 'Delayed', tone: 'delayed' },
  { value: 'RETURNED', label: 'Returning to sender', tone: 'returning' },
];

// Older codes still found in stored rows, shown under the nearest current name.
const LEGACY_STATUS: Record<string, string> = {
  CREATED: 'BOOKED',
  AWAITING_PICKUP: 'BOOKED',
  PROCESSED: 'PROCESSING',
  AT_FACILITY: 'IN_TRANSIT',
  HELD: 'ON_HOLD',
  EXCEPTION: 'ON_HOLD',
  DELIVERY_ATTEMPTED: 'DELAYED',
};

const BY_VALUE = new Map(SHIPMENT_STATUS_OPTIONS.map((s) => [s.value, s]));

/** The current status code a stored code is shown as (legacy codes map to their nearest). */
export function canonicalStatus(status: unknown): string {
  const code = String(status ?? '').trim().toUpperCase();
  return LEGACY_STATUS[code] ?? code;
}

function lookup(status: unknown): StatusDef | undefined {
  return BY_VALUE.get(canonicalStatus(status));
}

/** Display name when the code is a shipment status (current or legacy), otherwise undefined. */
export function knownStatusLabel(status: unknown): string | undefined {
  return lookup(status)?.label;
}

/** Display name for any stored status code, e.g. DESTINATION_PROCESSING -> "Arrived at destination gateway". */
export function shipmentStatusLabel(status: unknown): string {
  const def = lookup(status);
  if (def) return def.label;
  const code = String(status ?? '').trim();
  if (code.toUpperCase() === 'CANCELLED') return 'Cancelled';
  // Unknown code: readable rather than blank ("SOME_CODE" -> "Some code").
  const words = code.replace(/_/g, ' ').toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : 'In transit';
}

/** Colour family for badges. */
export function shipmentStatusTone(status: unknown): StatusTone {
  return lookup(status)?.tone ?? 'booked';
}
