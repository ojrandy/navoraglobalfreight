// IANA time zones for tracking events (tracker 2.5). Shared by the browser and the server.
// Events store the instant (occurred_at_ts) and the IANA zone of where they happened; the
// display is the local wall-clock time there plus its UTC offset, e.g. "3:04 PM UTC+1".

import { GATEWAYS } from '../data/gateways.js';

// Zone suffixes written by the pre-worldwide system ("August 20, 2026 · 4:35 PM CT").
export const LEGACY_ZONE_ABBREVIATIONS: Record<string, string> = {
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  MT: 'America/Denver', MDT: 'America/Denver', MST: 'America/Phoenix',
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
  AKST: 'America/Anchorage', AKDT: 'America/Anchorage',
  HST: 'Pacific/Honolulu',
  UTC: 'UTC', GMT: 'UTC',
};

// Main IANA zone per U.S. state (a few states span two zones; this is the populous one).
export const US_STATE_ZONES: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver',
};

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Minutes east of UTC for `timeZone` at instant `ts` (e.g. 60 for Lagos, -240 for New York in summer).
export function utcOffsetMinutes(timeZone: string, ts: number): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' } as Intl.DateTimeFormatOptions)
    .formatToParts(new Date(ts))
    .find((p) => p.type === 'timeZoneName')?.value || 'GMT';
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] || 0);
  return m[1] === '-' ? -minutes : minutes;
}

// "UTC+1", "UTC-4", "UTC+5:30" or "UTC".
export function utcOffsetLabel(timeZone: string, ts: number = Date.now()): string {
  const total = utcOffsetMinutes(timeZone, ts);
  if (total === 0) return 'UTC';
  const sign = total > 0 ? '+' : '-';
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const min = abs % 60;
  return `UTC${sign}${h}${min ? `:${String(min).padStart(2, '0')}` : ''}`;
}

// Date and local time of an instant in a zone: { displayDate: "Sep 28, 2026", displayTime: "3:04 PM UTC+1" }.
export function formatInZone(ts: number, timeZone: string): { displayDate: string; displayTime: string; utcOffset: string } {
  const date = new Date(ts);
  const displayDate = date.toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const utcOffset = utcOffsetLabel(timeZone, ts);
  return { displayDate, displayTime: `${time} ${utcOffset}`, utcOffset };
}

// The single display string stored in tracking_events.timestamp, e.g. "Sep 28, 2026 · 3:04 PM UTC+1".
export function formatEventTimestamp(ts: number, timeZone: string): string {
  const { displayDate, displayTime } = formatInZone(ts, timeZone);
  return `${displayDate} · ${displayTime}`;
}

// The instant for a wall-clock date ("2026-09-28") and time ("3:04 PM" or "15:04") in a zone.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): number | null {
  const d = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!d || !t) return null;
  let hour = Number(t[1]) % 24;
  if (t[3]) hour = (hour % 12) + (t[3].toUpperCase() === 'PM' ? 12 : 0);
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hour, Number(t[2]));
  // Apply the zone's offset, then re-check it at the result in case a DST change sits between.
  let ts = wall - utcOffsetMinutes(timeZone, wall) * 60_000;
  ts = wall - utcOffsetMinutes(timeZone, ts) * 60_000;
  return ts;
}

const normalise = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export interface PlaceForZone {
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

// Best IANA zone for a place: gateway city, U.S. state, same-country gateway, then the nearest
// gateway within ~800 km, and finally a whole-hour zone from the longitude (Etc/GMT±N).
export function timeZoneForPlace(place: PlaceForZone): string {
  const city = normalise(place.city || '');
  const region = (place.state || '').trim().toUpperCase();
  const iso = (place.countryCode || '').trim().toUpperCase();
  const country = normalise(place.country || '');

  // A 2-letter region after the city is either the country's ISO code or, for U.S. places, the state.
  const regionFits = (gatewayIso: string) =>
    region.length !== 2 || region === gatewayIso || (gatewayIso === 'US' && Boolean(US_STATE_ZONES[region]));
  const byCity = city && GATEWAYS.find((g) => normalise(g.city) === city && (!iso || g.iso === iso) && regionFits(g.iso));
  if (byCity) return byCity.timeZone;

  const isUS = iso === 'US' || country === 'united states' || (!iso && !country && US_STATE_ZONES[region]);
  if (isUS && US_STATE_ZONES[region]) return US_STATE_ZONES[region];

  // Same-country gateway. A bare 2-letter region only counts as a country when it isn't also a
  // U.S. state code (CA, DE, GA and IN are both).
  const regionIso = !iso && region.length === 2 && !US_STATE_ZONES[region] ? region : '';
  const countryGateway = GATEWAYS.find((g) =>
    g.iso !== 'US' && ((iso && g.iso === iso) || (regionIso && g.iso === regionIso) || (country && normalise(g.country) === country)));
  if (countryGateway) return countryGateway.timeZone;

  if (typeof place.lat === 'number' && typeof place.lng === 'number' && !isNaN(place.lat) && !isNaN(place.lng)) {
    let best: { tz: string; d: number } | null = null;
    for (const g of GATEWAYS) {
      const d = Math.hypot(g.lat - place.lat, (g.lng - place.lng) * Math.cos((place.lat * Math.PI) / 180));
      if (!best || d < best.d) best = { tz: g.timeZone, d };
    }
    if (best && best.d <= 7) return best.tz;
    const hours = Math.round(place.lng / 15);
    // Etc/GMT zones use the inverted POSIX sign: Etc/GMT-3 is UTC+3.
    return hours === 0 ? 'UTC' : `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
  }

  if (isUS) return 'America/New_York';
  return 'UTC';
}

// Zone for a stored "City, Region" location label.
export function timeZoneForLocationLabel(location: string, lat?: number, lng?: number): string {
  const [city, region] = (location || '').split(',').map((s) => s.trim());
  return timeZoneForPlace({ city, state: region, lat, lng });
}

const LEGACY_ZONE_SUFFIX = /\s*\b(ET|EST|EDT|CT|CST|CDT|MT|MDT|MST|PT|PST|PDT|AKST|AKDT|HST|UTC|GMT)\s*$/;
const OFFSET_SUFFIX = /\s*\bUTC[+-]\d{1,2}(?::\d{2})?\s*$/;
const TIME_PATTERN = /\d{1,2}:\d{2}\s*[AaPp][Mm]/;

export interface EventTimeDisplay {
  displayDate: string;
  displayTime: string;
  /** IANA zone, when known. */
  timezone?: string;
  /** e.g. "UTC+1", when known. */
  utcOffset?: string;
}

// Display fields for a stored event. Events with an instant and zone are formatted from those;
// older rows keep their stored text, with a legacy U.S. suffix (ET/CT/MT/PT…) turned into the
// matching IANA zone and the UTC offset that applied on that date.
export function eventTimeDisplay(raw: string, occurredAtTs?: number | null, timeZone?: string | null): EventTimeDisplay {
  if (typeof occurredAtTs === 'number' && occurredAtTs > 0 && isValidTimeZone(timeZone)) {
    const { displayDate, displayTime, utcOffset } = formatInZone(occurredAtTs, timeZone);
    return { displayDate, displayTime, timezone: timeZone, utcOffset };
  }

  const str = (raw || '').trim();
  if (!str) return { displayDate: '', displayTime: '' };

  // Already in the new format (e.g. a corrected event without a stored instant).
  if (OFFSET_SUFFIX.test(str)) {
    const timeMatch = str.match(TIME_PATTERN);
    if (timeMatch) {
      const idx = str.indexOf(timeMatch[0]);
      return {
        displayDate: str.slice(0, idx).replace(/[·\-–—]+\s*$/, '').trim() || str,
        displayTime: str.slice(idx).trim(),
        utcOffset: str.match(/UTC[+-]\d{1,2}(?::\d{2})?/)?.[0],
      };
    }
  }

  const zoneMatch = str.match(LEGACY_ZONE_SUFFIX);
  const zone = zoneMatch ? LEGACY_ZONE_ABBREVIATIONS[zoneMatch[1]] : undefined;
  const body = zoneMatch ? str.slice(0, zoneMatch.index).trim() : str;

  const timeMatch = body.match(TIME_PATTERN);
  if (!timeMatch) return { displayDate: body || str, displayTime: '', timezone: zone };

  const idx = body.indexOf(timeMatch[0]);
  const displayDate = body.slice(0, idx).replace(/[·\-–—]+\s*$/, '').trim() || body;
  const time = body.slice(idx).trim();
  if (!zone) return { displayDate, displayTime: time };

  // The offset depends on the date (daylight saving), so use the event's own date when it parses.
  const parsed = Date.parse(`${displayDate} 12:00`);
  const utcOffset = utcOffsetLabel(zone, isNaN(parsed) ? Date.now() : parsed);
  return { displayDate, displayTime: `${time} ${utcOffset}`, timezone: zone, utcOffset };
}
