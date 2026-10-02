import { formatEventTimestamp, isValidTimeZone, timeZoneForLocationLabel } from '../src/shared/timeZones.js';

export interface EventTime {
  /** Display string stored in tracking_events.timestamp, e.g. "Sep 28, 2026 · 3:04 PM UTC+1". */
  timestamp: string;
  occurredAtTs: number;
  /** IANA zone of the event's location. */
  timeZone: string;
}

// Time fields for a new or corrected tracking event at `location` ("City, Region"). The caller
// may supply the instant (ISO string or epoch ms) and an IANA zone, e.g. an admin logging a
// scan after the fact; otherwise it's now, in the location's own zone.
export function eventTime(
  location: string,
  options: { occurredAt?: unknown; timeZone?: unknown; lat?: number; lng?: number } = {}
): EventTime {
  const timeZone = isValidTimeZone(options.timeZone)
    ? options.timeZone
    : timeZoneForLocationLabel(location, options.lat, options.lng);
  const parsed = typeof options.occurredAt === 'number'
    ? options.occurredAt
    : typeof options.occurredAt === 'string' ? Date.parse(options.occurredAt) : NaN;
  const occurredAtTs = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  return { timestamp: formatEventTimestamp(occurredAtTs, timeZone), occurredAtTs, timeZone };
}
