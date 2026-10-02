/**
 * Route Geometry Service (tracker 2.3)
 *
 * A route is a list of legs. Road legs follow roads (OSRM when reachable, a smooth synthetic
 * road line otherwise); air and sea legs are great-circle arcs between gateways. A long air or
 * sea shipment gets a road feeder leg to its origin gateway and from its destination gateway
 * when the customer is far from one. When OSRM says a road leg can't be driven (different
 * continents, open sea), that leg is drawn as a great-circle arc instead.
 *
 * Positions are interpolated by distance along the whole line, so a shipment's schedule-based
 * position stays correct across legs of very different lengths and point densities.
 * Strictly separates physical transit hours from commercial customer service SLAs.
 */

import { US_METRO_DATABASE, GLOBAL_GATEWAY_DATABASE, GeoLocationResult } from './geocodingService.js';
import { GATEWAYS, type Gateway } from '../data/gateways.js';
import { greatCirclePoints, unwrapLongitudes, type LatLngTuple } from '../utils/greatCircle.js';
import { parseTransportMode, type TransportMode } from '../shared/transportMode.js';

export type { TransportMode } from '../shared/transportMode.js';

export interface LatLngPoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface RouteLeg {
  mode: TransportMode;
  from: LatLngPoint;
  to: LatLngPoint;
  distanceMiles: number;
  durationHours: number;
  /** Index range of this leg within the route's polyline (inclusive). */
  startIndex: number;
  endIndex: number;
  /** A road leg OSRM could not route, drawn as a direct great-circle arc instead. */
  isArcFallback?: boolean;
}

export interface RouteGeometryResult {
  origin: LatLngPoint;
  destination: LatLngPoint;
  /** Main mode of the shipment (the longest leg's mode). */
  mode: TransportMode;
  distanceMiles: number;
  /** Total transit hours across all legs (name kept from the road-only engine). */
  drivingDurationHours: number;
  /** [lat, lng] points for Leaflet. Longitudes are continuous (may pass ±180) across the date line. */
  polyline: [number, number][];
  legs: RouteLeg[];
  majorWaypoints: LatLngPoint[];
  isLiveRoadRoute?: boolean;
}

export interface EstimatedPositionResult {
  lat: number;
  lng: number;
  progressPercent: number; // 0 to 100
  corridorDescription: string;
  isCompleted: boolean;
  /** Mode of the leg the position is on, when the route's legs were supplied. */
  mode?: TransportMode;
}

// Distance and speed assumptions per mode. Road distance runs ~15% over the straight line;
// sea lanes ~20% (routing around coasts and through straits). Speeds are door-to-door averages.
const DISTANCE_FACTOR: Record<TransportMode, number> = { Road: 1.15, Air: 1, Sea: 1.2 };
const SPEED_MPH: Record<TransportMode, number> = { Road: 55, Air: 500, Sea: 18 };
// Air/sea shipments this close to a gateway (miles) go straight onto the main leg; beyond it
// they get a road feeder leg, up to FEEDER_MAX_MILES (further than that, the gateway network
// doesn't really serve the place, so the main leg starts from the place itself).
const FEEDER_MIN_MILES = 60;
const FEEDER_MAX_MILES = 450;
// Legacy inference: a shipment with no stored mode is road freight when it stays within this
// distance or within North America (the pre-worldwide system was U.S. road linehaul).
const ROAD_INFERENCE_MAX_MILES = 1500;

// In-memory route cache
const ROUTE_CACHE = new Map<string, RouteGeometryResult>();

/**
 * Calculates great-circle distance between two points (in miles)
 */
export function calculateHaversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(haversineMiles(lat1, lon1, lat2, lon2));
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const inNorthAmerica = (p: LatLngPoint) => p.lat >= 14 && p.lat <= 72 && p.lng >= -170 && p.lng <= -50;

/**
 * The transport mode for a shipment's route: the stored mode when there is one, otherwise a
 * best guess — road within ~1,500 miles or inside North America, sea for containers and
 * freight services, air for everything else long-haul.
 */
export function inferTransportMode(input: {
  mode?: unknown;
  shipmentType?: string;
  service?: string;
  origin: LatLngPoint;
  destination: LatLngPoint;
}): TransportMode {
  const explicit = parseTransportMode(input.mode);
  if (explicit) return explicit;
  const { origin, destination } = input;
  const miles = haversineMiles(origin.lat, origin.lng, destination.lat, destination.lng);
  if (miles <= ROAD_INFERENCE_MAX_MILES || (inNorthAmerica(origin) && inNorthAmerica(destination))) return 'Road';
  if (/container/i.test(input.shipmentType || '') || /freight|ocean|sea|fcl|lcl/i.test(input.service || '')) return 'Sea';
  return 'Air';
}

// Nearest gateway that handles the mode (Sea needs an Ocean gateway), within FEEDER_MAX_MILES.
function nearestGateway(point: LatLngPoint, mode: TransportMode): { gateway: Gateway; miles: number } | null {
  const needed = mode === 'Sea' ? 'Ocean' : 'Air';
  let best: { gateway: Gateway; miles: number } | null = null;
  for (const g of GATEWAYS) {
    if (!g.modes.includes(needed)) continue;
    const miles = haversineMiles(point.lat, point.lng, g.lat, g.lng);
    if (!best || miles < best.miles) best = { gateway: g, miles };
  }
  return best && best.miles <= FEEDER_MAX_MILES ? best : null;
}

// Smooth synthetic road line (used until/unless OSRM geometry is available).
function syntheticRoadPoints(from: LatLngPoint, to: LatLngPoint, distanceMiles: number): LatLngTuple[] {
  const points: LatLngTuple[] = [];
  const steps = Math.max(25, Math.min(100, Math.round(distanceMiles / 30)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const baseLat = from.lat + (to.lat - from.lat) * t;
    const baseLng = from.lng + (to.lng - from.lng) * t;
    // Gentle bow, as real roads rarely run dead straight
    const arcDeviation = Math.sin(t * Math.PI) * 0.85 * (to.lng < from.lng ? -1 : 1);
    points.push([baseLat + arcDeviation * 0.4, baseLng]);
  }
  return points;
}

function arcPoints(from: LatLngPoint, to: LatLngPoint, miles: number): LatLngTuple[] {
  const steps = Math.max(16, Math.min(128, Math.round(miles / 60)));
  return greatCirclePoints([from.lat, from.lng], [to.lat, to.lng], steps);
}

interface LegDraft {
  mode: TransportMode;
  from: LatLngPoint;
  to: LatLngPoint;
  points: LatLngTuple[];
  distanceMiles: number;
  isArcFallback?: boolean;
}

function draftLeg(mode: TransportMode, from: LatLngPoint, to: LatLngPoint): LegDraft {
  const straight = haversineMiles(from.lat, from.lng, to.lat, to.lng);
  // Road keeps the road-only engine's exact arithmetic (rounded miles x 1.15) so existing
  // shipments' distances, and the ETAs derived from them, don't shift.
  const distanceMiles = mode === 'Road'
    ? Math.max(25, Math.round(Math.round(straight) * DISTANCE_FACTOR.Road))
    : Math.round(straight * DISTANCE_FACTOR[mode]);
  const points = mode === 'Road' ? syntheticRoadPoints(from, to, distanceMiles) : arcPoints(from, to, straight);
  return { mode, from, to, points, distanceMiles };
}

// The legs of a route before any live road geometry: feeder -> main -> feeder for air/sea.
function planLegs(origin: LatLngPoint, destination: LatLngPoint, mode: TransportMode): LegDraft[] {
  if (mode === 'Road') return [draftLeg('Road', origin, destination)];

  const from = nearestGateway(origin, mode);
  const to = nearestGateway(destination, mode);
  // Both ends served by the same gateway: nothing to fly or sail, it's a local road move.
  if (from && to && from.gateway.code === to.gateway.code) return [draftLeg('Road', origin, destination)];

  const gatewayPoint = (g: Gateway): LatLngPoint => ({ lat: g.lat, lng: g.lng, name: `${g.city} (${g.code})` });
  const mainFrom = from && from.miles > FEEDER_MIN_MILES ? gatewayPoint(from.gateway) : origin;
  const mainTo = to && to.miles > FEEDER_MIN_MILES ? gatewayPoint(to.gateway) : destination;

  const legs: LegDraft[] = [];
  if (mainFrom !== origin) legs.push(draftLeg('Road', origin, mainFrom));
  legs.push(draftLeg(mode, mainFrom, mainTo));
  if (mainTo !== destination) legs.push(draftLeg('Road', mainTo, destination));
  return legs;
}

// Joins leg drafts into one continuous polyline with per-leg index ranges and totals.
function assembleRoute(origin: LatLngPoint, destination: LatLngPoint, drafts: LegDraft[], isLiveRoadRoute: boolean): RouteGeometryResult {
  const joined: LatLngTuple[] = [];
  const ranges: [number, number][] = [];
  for (const leg of drafts) {
    const start = joined.length === 0 ? 0 : joined.length - 1;
    // Consecutive legs share their joint point; drop the duplicate.
    joined.push(...(joined.length === 0 ? leg.points : leg.points.slice(1)));
    ranges.push([start, joined.length - 1]);
  }
  const polyline = unwrapLongitudes(joined) as [number, number][];

  const legs: RouteLeg[] = drafts.map((d, i) => ({
    mode: d.mode,
    from: d.from,
    to: d.to,
    distanceMiles: d.distanceMiles,
    durationHours: Math.max(0.5, Math.round((d.distanceMiles / SPEED_MPH[d.mode]) * 10) / 10),
    startIndex: ranges[i][0],
    endIndex: ranges[i][1],
    ...(d.isArcFallback ? { isArcFallback: true } : {})
  }));

  const main = legs.reduce((a, b) => (b.distanceMiles > a.distanceMiles ? b : a), legs[0]);
  const distanceMiles = legs.reduce((sum, l) => sum + l.distanceMiles, 0);
  const drivingDurationHours = Math.max(1, Math.round(legs.reduce((sum, l) => sum + l.durationHours, 0) * 10) / 10);

  return {
    origin,
    destination,
    mode: main.mode,
    distanceMiles,
    drivingDurationHours,
    polyline,
    legs,
    majorWaypoints: [origin, ...legs.slice(1).map((l) => l.from), destination],
    isLiveRoadRoute
  };
}

/**
 * Synchronously builds the route geometry between two points for a transport mode (inferred
 * from the distance when omitted). Road legs use the synthetic road line; the server's
 * schedule-based position sync and the map's first paint both use this, so they agree.
 */
export function calculateRouteGeometry(
  origin: LatLngPoint,
  destination: LatLngPoint,
  mode?: TransportMode
): RouteGeometryResult {
  const resolved = mode || inferTransportMode({ origin, destination });
  return assembleRoute(origin, destination, planLegs(origin, destination, resolved), false);
}

type OsrmResult = { status: 'ok'; points: LatLngTuple[]; distanceMiles: number } | { status: 'no-route' } | { status: 'error' };

async function fetchOsrmLeg(from: LatLngPoint, to: LatLngPoint): Promise<OsrmResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // OSRM's public demo server routinely takes 4-5s to respond; 3s was timing out on essentially every request

    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await resp.json().catch(() => null);
    if (data?.code === 'NoRoute' || data?.code === 'NoSegment') return { status: 'no-route' };
    if (resp.ok && data?.routes?.length > 0) {
      const primaryRoute = data.routes[0];
      // OSRM returns GeoJSON coordinates as [lng, lat], convert to Leaflet [lat, lng]
      const points: LatLngTuple[] = primaryRoute.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      return { status: 'ok', points, distanceMiles: Math.round(primaryRoute.distance * 0.000621371) };
    }
  } catch {
    // Network failure or timeout — keep the synthetic road line
  }
  return { status: 'error' };
}

/**
 * Route geometry with real roads: every road leg is routed through OSRM. A road leg OSRM
 * cannot drive (different continents, open sea) becomes a great-circle arc; a network failure
 * keeps the synthetic road line. Air and sea legs never touch the network.
 */
export async function fetchLiveRoadRoute(
  origin: LatLngPoint,
  destination: LatLngPoint,
  mode?: TransportMode
): Promise<RouteGeometryResult> {
  const resolved = mode || inferTransportMode({ origin, destination });
  const cacheKey = `${resolved}:${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}_${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
  if (ROUTE_CACHE.has(cacheKey)) {
    return ROUTE_CACHE.get(cacheKey)!;
  }

  const drafts = planLegs(origin, destination, resolved);
  let routedAny = false;
  for (const leg of drafts) {
    if (leg.mode !== 'Road') continue;
    const osrm = await fetchOsrmLeg(leg.from, leg.to);
    if (osrm.status === 'ok') {
      leg.points = osrm.points;
      leg.distanceMiles = osrm.distanceMiles;
      routedAny = true;
    } else if (osrm.status === 'no-route') {
      const straight = haversineMiles(leg.from.lat, leg.from.lng, leg.to.lat, leg.to.lng);
      leg.points = arcPoints(leg.from, leg.to, straight);
      leg.distanceMiles = Math.round(straight);
      leg.isArcFallback = true;
    }
  }

  const result = assembleRoute(origin, destination, drafts, routedAny);
  ROUTE_CACHE.set(cacheKey, result);
  return result;
}

// Cumulative distance (miles) at each polyline point.
function cumulativeMiles(polyline: [number, number][]): number[] {
  const cumulative = [0];
  for (let i = 1; i < polyline.length; i++) {
    const [lat1, lng1] = polyline[i - 1];
    const [lat2, lng2] = polyline[i];
    cumulative.push(cumulative[i - 1] + haversineMiles(lat1, lng1, lat2, lng2));
  }
  return cumulative;
}

/**
 * Finds the point on a route polyline closest to a real, known location — used to anchor
 * the completed/remaining route split to wherever a shipment's actual GPS-equivalent
 * coordinates say it is, instead of a percentage-only estimate that has no idea the
 * marker and the route line might not agree with each other. Returns the equivalent
 * progress percentage (by distance) that point represents, purely for the solid/dashed line
 * split — the marker itself should still be drawn at the exact real coordinates.
 */
export function findNearestPointOnPolyline(
  polyline: [number, number][],
  targetLat: number,
  targetLng: number
): { index: number; lat: number; lng: number; progressPercent: number } {
  if (!polyline || polyline.length === 0) {
    return { index: 0, lat: targetLat, lng: targetLng, progressPercent: 0 };
  }

  let bestIndex = 0;
  let bestMiles = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const [lat, lng] = polyline[i];
    const miles = haversineMiles(lat, lng, targetLat, targetLng);
    if (miles < bestMiles) {
      bestMiles = miles;
      bestIndex = i;
    }
  }

  const cumulative = cumulativeMiles(polyline);
  const total = cumulative[cumulative.length - 1];
  const progressPercent = total > 0 ? (cumulative[bestIndex] / total) * 100 : 0;
  return { index: bestIndex, lat: polyline[bestIndex][0], lng: polyline[bestIndex][1], progressPercent };
}

const MODE_WORDING: Record<TransportMode, string> = {
  Road: 'On the road',
  Air: 'In flight',
  Sea: 'At sea',
};

/**
 * Schedule-based estimated position at `progressPercent` of the route, measured by distance
 * along the whole line (so legs with many points, like OSRM roads, don't get more than their
 * share). Clearly labeled as schedule-derived, protecting company credibility. Pass the route's
 * legs to get the current leg's mode in the result and the description.
 */
export function calculateEstimatedPosition(
  polyline: [number, number][],
  progressPercent: number,
  legs?: RouteLeg[]
): EstimatedPositionResult {
  if (!polyline || polyline.length === 0) {
    return {
      lat: 0,
      lng: 0,
      progressPercent: 0,
      corridorDescription: 'Awaiting departure scan',
      isCompleted: false
    };
  }

  const clampedPercent = Math.max(0, Math.min(100, progressPercent));
  // The leg a segment starting at `index` belongs to (a joint point starts the next leg).
  const legAt = (index: number) =>
    legs?.find((l) => index >= l.startIndex && index < l.endIndex) ?? legs?.[legs.length - 1];

  if (clampedPercent === 0) {
    return {
      lat: polyline[0][0],
      lng: polyline[0][1],
      progressPercent: 0,
      corridorDescription: 'Staged at Origin Terminal',
      isCompleted: false,
      mode: legAt(0)?.mode
    };
  }

  if (clampedPercent === 100 || polyline.length === 1) {
    const last = polyline[polyline.length - 1];
    return {
      lat: last[0],
      lng: last[1],
      progressPercent: 100,
      corridorDescription: 'Delivered to Consignee Destination',
      isCompleted: true,
      mode: legAt(polyline.length - 1)?.mode
    };
  }

  const cumulative = cumulativeMiles(polyline);
  const total = cumulative[cumulative.length - 1];
  const target = (clampedPercent / 100) * total;

  // First segment whose end reaches the target distance
  let upper = 1;
  while (upper < cumulative.length - 1 && cumulative[upper] < target) upper++;
  const lower = upper - 1;
  const span = cumulative[upper] - cumulative[lower];
  const fraction = span > 0 ? (target - cumulative[lower]) / span : 0;

  const p1 = polyline[lower];
  const p2 = polyline[upper];
  const leg = legAt(lower);
  const percentLabel = `${Math.round(clampedPercent)}% complete`;

  return {
    lat: p1[0] + (p2[0] - p1[0]) * fraction,
    lng: p1[1] + (p2[1] - p1[1]) * fraction,
    progressPercent: Math.round(clampedPercent),
    corridorDescription: leg ? `${MODE_WORDING[leg.mode]} on the planned route (${percentLabel})` : `Moving along the planned route (${percentLabel})`,
    isCompleted: false,
    mode: leg?.mode
  };
}

/**
 * Identifies a major logistics interchange (U.S. metro or global gateway) located along the
 * route between origin and destination.
 */
export function findIntermediateHub(
  origin: LatLngPoint,
  destination: LatLngPoint
): { city: string; state: string; facility: string; description: string } | null {
  const directDist = calculateHaversineDistanceMiles(origin.lat, origin.lng, destination.lat, destination.lng);
  if (directDist < 120) {
    return null;
  }

  const midLat = (origin.lat + destination.lat) / 2;
  const midLng = (origin.lng + destination.lng) / 2;

  let bestEntry: GeoLocationResult | null = null;
  let bestDist = Infinity;

  const origCityLower = (origin.name || '').toLowerCase();
  const destCityLower = (destination.name || '').toLowerCase();

  const candidates = [...Object.values(US_METRO_DATABASE), ...Object.values(GLOBAL_GATEWAY_DATABASE)];
  for (const entry of candidates) {
    const entryCityLower = entry.city.toLowerCase();
    if (origCityLower.includes(entryCityLower) || destCityLower.includes(entryCityLower)) {
      continue;
    }

    const distToMid = calculateHaversineDistanceMiles(midLat, midLng, entry.lat, entry.lng);
    const distFromOrigin = calculateHaversineDistanceMiles(origin.lat, origin.lng, entry.lat, entry.lng);
    const distToDest = calculateHaversineDistanceMiles(entry.lat, entry.lng, destination.lat, destination.lng);
    const totalViaEntry = distFromOrigin + distToDest;

    if (totalViaEntry < directDist * 1.35 && distToMid < bestDist) {
      bestDist = distToMid;
      bestEntry = entry;
    }
  }

  if (bestEntry) {
    const region = bestEntry.state || bestEntry.countryCode || '';
    return {
      city: bestEntry.city,
      state: region,
      facility: bestEntry.facilityName || `${bestEntry.city} Regional Sort Hub`,
      description: `Transit scan verified at ${bestEntry.city}${bestEntry.stateFull ? `, ${bestEntry.stateFull}` : ''}.`
    };
  }

  return null;
}
