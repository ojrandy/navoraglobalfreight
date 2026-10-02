export type LatLngTuple = [number, number];

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Points along the great-circle path from `a` to `b` (longitudes in -180..180).
export function greatCirclePoints(a: LatLngTuple, b: LatLngTuple, steps = 64): LatLngTuple[] {
  const [lat1, lng1] = [toRad(a[0]), toRad(a[1])];
  const [lat2, lng2] = [toRad(b[0]), toRad(b[1])];
  const v1 = [Math.cos(lat1) * Math.cos(lng1), Math.cos(lat1) * Math.sin(lng1), Math.sin(lat1)];
  const v2 = [Math.cos(lat2) * Math.cos(lng2), Math.cos(lat2) * Math.sin(lng2), Math.sin(lat2)];
  const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const d = Math.acos(dot);
  if (d < 1e-9) return [a, b];

  const points: LatLngTuple[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const s1 = Math.sin((1 - f) * d) / Math.sin(d);
    const s2 = Math.sin(f * d) / Math.sin(d);
    const x = s1 * v1[0] + s2 * v2[0];
    const y = s1 * v1[1] + s2 * v2[1];
    const z = s1 * v1[2] + s2 * v2[2];
    points.push([toDeg(Math.atan2(z, Math.hypot(x, y))), toDeg(Math.atan2(y, x))]);
  }
  return points;
}

// Rewrites longitudes so consecutive points never jump by more than 180 degrees (e.g. 179 ->
// 181 instead of 179 -> -179). One continuous line Leaflet can draw across the date line.
export function unwrapLongitudes(points: LatLngTuple[]): LatLngTuple[] {
  const out: LatLngTuple[] = [];
  for (const [lat, lng] of points) {
    if (out.length === 0) {
      out.push([lat, lng]);
      continue;
    }
    const prev = out[out.length - 1][1];
    let next = lng;
    while (next - prev > 180) next -= 360;
    while (next - prev < -180) next += 360;
    out.push([lat, next]);
  }
  return out;
}

// Back into -180..180 (for storing or labelling a position taken from an unwrapped line).
export function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

// Points along the great-circle path from `a` to `b`, split into segments wherever the
// path crosses the antimeridian so Leaflet doesn't draw a line across the whole map.
// The result can be passed straight to L.polyline (it accepts nested arrays).
export function greatCircleSegments(a: LatLngTuple, b: LatLngTuple, steps = 64): LatLngTuple[][] {
  const points = greatCirclePoints(a, b, steps);
  const segments: LatLngTuple[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const [pLat, pLng] = points[i - 1];
    const [cLat, cLng] = points[i];
    if (Math.abs(cLng - pLng) > 180) {
      // Crossing the antimeridian: close this segment at ±180 and open the next at ∓180.
      const edge = pLng > 0 ? 180 : -180;
      const unwrapped = cLng + (pLng > 0 ? 360 : -360);
      const t = (edge - pLng) / (unwrapped - pLng);
      const crossLat = pLat + t * (cLat - pLat);
      segments[segments.length - 1].push([crossLat, edge]);
      segments.push([[crossLat, -edge]]);
    }
    segments[segments.length - 1].push([cLat, cLng]);
  }
  return segments;
}
