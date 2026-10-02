// Tests for worldwide geocoding (tracker 2.2) and mode-aware routing (tracker 2.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRouteGeometry, calculateEstimatedPosition, findNearestPointOnPolyline,
  inferTransportMode, calculateHaversineDistanceMiles,
} from '../src/services/routingEngine.ts';
import { resolveLocation, findNearestMetro, GLOBAL_GATEWAY_DATABASE } from '../src/services/geocodingService.ts';
import { greatCirclePoints, normalizeLng } from '../src/utils/greatCircle.ts';

const LAGOS = { lat: 6.5244, lng: 3.3792, name: 'Lagos' };
const LONDON = { lat: 51.5074, lng: -0.1278, name: 'London' };
const HOUSTON = { lat: 29.7604, lng: -95.3698, name: 'Houston' };
const ROTTERDAM = { lat: 51.9244, lng: 4.4777, name: 'Rotterdam' };
const IBADAN = { lat: 7.3775, lng: 3.947, name: 'Ibadan' };
const MANCHESTER = { lat: 53.4808, lng: -2.2426, name: 'Manchester' };
const NEW_YORK = { lat: 40.7128, lng: -74.006, name: 'New York' };
const LOS_ANGELES = { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' };
const HONG_KONG = { lat: 22.308, lng: 113.9185, name: 'Hong Kong' };

const milesBetween = (a: [number, number], b: { lat: number; lng: number }) =>
  calculateHaversineDistanceMiles(a[0], a[1], b.lat, b.lng);

test('inferTransportMode: stored mode wins, otherwise distance/region/cargo', () => {
  assert.equal(inferTransportMode({ mode: 'ocean', origin: LAGOS, destination: LONDON }), 'Sea');
  assert.equal(inferTransportMode({ origin: LAGOS, destination: LONDON, service: 'Express' }), 'Air');
  assert.equal(inferTransportMode({ origin: HOUSTON, destination: ROTTERDAM, service: 'Freight' }), 'Sea');
  assert.equal(inferTransportMode({ origin: HOUSTON, destination: ROTTERDAM, shipmentType: 'Container' }), 'Sea');
  // The pre-worldwide U.S. road network keeps its road routes.
  assert.equal(inferTransportMode({ origin: NEW_YORK, destination: LOS_ANGELES }), 'Road');
  assert.equal(inferTransportMode({ origin: ROTTERDAM, destination: { lat: 50.11, lng: 8.68 } }), 'Road');
});

test('Lagos -> London (air): one great-circle leg; position follows the arc', () => {
  const route = calculateRouteGeometry(LAGOS, LONDON, 'Air');
  assert.equal(route.mode, 'Air');
  assert.equal(route.legs.length, 1, 'Lagos is next to the LOS gateway, so no feeder leg');
  assert.equal(route.legs[0].mode, 'Air');
  assert.ok(route.distanceMiles > 3000 && route.distanceMiles < 3300, `${route.distanceMiles}`);

  const mid = calculateEstimatedPosition(route.polyline, 50, route.legs);
  const [gcLat, gcLng] = greatCirclePoints([LAGOS.lat, LAGOS.lng], [LONDON.lat, LONDON.lng], 2)[1];
  assert.ok(Math.abs(mid.lat - gcLat) < 0.3 && Math.abs(mid.lng - gcLng) < 0.3, `midpoint ${mid.lat},${mid.lng} vs ${gcLat},${gcLng}`);
  assert.equal(mid.mode, 'Air');
  assert.match(mid.corridorDescription, /^In flight/);
  assert.doesNotMatch(mid.corridorDescription, /interstate|highway/i);
});

test('Houston -> Rotterdam (sea): one sea leg with sea distance and transit time', () => {
  const route = calculateRouteGeometry(HOUSTON, ROTTERDAM, 'Sea');
  assert.equal(route.legs.length, 1);
  assert.equal(route.legs[0].mode, 'Sea');
  // ~5,000 straight-line miles, +20% for sea lanes; ~18 mph -> about two weeks.
  assert.ok(route.distanceMiles > 5700 && route.distanceMiles < 6400, `${route.distanceMiles}`);
  assert.ok(route.drivingDurationHours > 300 && route.drivingDurationHours < 360, `${route.drivingDurationHours}`);
  const at20 = calculateEstimatedPosition(route.polyline, 20, route.legs);
  assert.equal(at20.mode, 'Sea');
  assert.match(at20.corridorDescription, /^At sea/);
});

test('mixed legs: Ibadan -> Manchester is road, air, road; position interpolates by distance', () => {
  const route = calculateRouteGeometry(IBADAN, MANCHESTER, 'Air');
  assert.deepEqual(route.legs.map((l) => l.mode), ['Road', 'Air', 'Road']);
  assert.equal(route.legs[0].to.name, 'Lagos (LOS)');
  assert.equal(route.legs[2].from.name, 'London (LHR)');

  // Leg ranges are contiguous and cover the whole polyline.
  assert.equal(route.legs[0].startIndex, 0);
  for (let i = 1; i < route.legs.length; i++) assert.equal(route.legs[i].startIndex, route.legs[i - 1].endIndex);
  assert.equal(route.legs[route.legs.length - 1].endIndex, route.polyline.length - 1);
  // Joints sit on the gateways.
  assert.ok(milesBetween(route.polyline[route.legs[1].startIndex], route.legs[1].from) < 1);
  assert.ok(milesBetween(route.polyline[route.legs[1].endIndex], route.legs[1].to) < 1);

  // Walking progress 0 -> 100 moves forward along the line, through each leg's mode in order.
  const lineMiles = (() => {
    let sum = 0;
    for (let i = 1; i < route.polyline.length; i++) sum += milesBetween(route.polyline[i - 1], { lat: route.polyline[i][0], lng: route.polyline[i][1] });
    return sum;
  })();
  const firstRoadShare = (() => {
    let sum = 0;
    for (let i = 1; i <= route.legs[0].endIndex; i++) sum += milesBetween(route.polyline[i - 1], { lat: route.polyline[i][0], lng: route.polyline[i][1] });
    return (sum / lineMiles) * 100;
  })();
  const modes: string[] = [];
  let lastIndex = -1;
  for (let p = 0.5; p < 100; p += 0.5) {
    const pos = calculateEstimatedPosition(route.polyline, p, route.legs);
    if (modes[modes.length - 1] !== pos.mode) modes.push(pos.mode!);
    const nearest = findNearestPointOnPolyline(route.polyline, pos.lat, pos.lng);
    assert.ok(nearest.index >= lastIndex - 1, `went backwards at ${p}%`);
    lastIndex = nearest.index;
  }
  assert.deepEqual(modes, ['Road', 'Air', 'Road']);

  // The road feeder (~80 mi of ~3,300) is a sliver of the route, not a third of it as an
  // index-based split would make it.
  assert.ok(firstRoadShare < 5, `first road leg share ${firstRoadShare}%`);
  assert.equal(calculateEstimatedPosition(route.polyline, firstRoadShare / 2, route.legs).mode, 'Road');
  assert.equal(calculateEstimatedPosition(route.polyline, firstRoadShare + 1, route.legs).mode, 'Air');
});

test('date line: Hong Kong -> Los Angeles stays one continuous line', () => {
  const route = calculateRouteGeometry(HONG_KONG, LOS_ANGELES, 'Air');
  for (let i = 1; i < route.polyline.length; i++) {
    assert.ok(Math.abs(route.polyline[i][1] - route.polyline[i - 1][1]) < 20, `jump at ${i}`);
  }
  const end = route.polyline[route.polyline.length - 1];
  assert.ok(Math.abs(normalizeLng(end[1]) - LOS_ANGELES.lng) < 0.01);
  const mid = calculateEstimatedPosition(route.polyline, 50, route.legs);
  assert.ok(Math.abs(normalizeLng(mid.lng)) > 150, `mid-Pacific, got ${mid.lng}`);
});

test('U.S. road routes are unchanged in shape: one road leg', () => {
  const route = calculateRouteGeometry(NEW_YORK, LOS_ANGELES);
  assert.equal(route.mode, 'Road');
  assert.equal(route.legs.length, 1);
  assert.equal(route.distanceMiles, Math.round(calculateHaversineDistanceMiles(NEW_YORK.lat, NEW_YORK.lng, LOS_ANGELES.lat, LOS_ANGELES.lng) * 1.15));
});

test('geocoding: gateway table is an offline worldwide fallback', () => {
  const lagos = resolveLocation('Lagos');
  assert.equal(lagos?.countryCode, 'NG');
  assert.equal(lagos?.timezone, 'Africa/Lagos');
  assert.equal(lagos?.zip, undefined);
  assert.equal(resolveLocation('LOS')?.city, 'Lagos');
  assert.equal(resolveLocation('London, United Kingdom')?.timezone, 'Europe/London');
  assert.equal(resolveLocation('Sao Paulo')?.city, 'São Paulo');
  assert.equal(resolveLocation('Toronto, CA')?.countryCode, 'CA');
  // U.S. inputs still use the U.S. tables (downtown, not the airport gateway).
  const houston = resolveLocation('Houston');
  assert.equal(houston?.state, 'TX');
  assert.equal(houston?.timezone, 'America/Chicago');
  assert.ok(Math.abs((houston?.lat ?? 0) - 29.7604) < 0.01);
  assert.equal(resolveLocation('Los Angeles, CA')?.countryCode, 'US');
  // Unknown town in a known country: that country's gateway, flagged as a guess.
  const abuja = resolveLocation('Abuja, Nigeria');
  assert.equal(abuja?.city, 'Abuja');
  assert.equal(abuja?.countryCode, 'NG');
  assert.equal(abuja?.isExactCoordinate, false);
  assert.equal(Object.keys(GLOBAL_GATEWAY_DATABASE).length, 18);
});

test('findNearestMetro: gateways included, open ocean returns null', () => {
  assert.deepEqual(findNearestMetro(51.4, -0.3), { city: 'London', state: 'GB' });
  assert.equal(findNearestMetro(30, -40), null); // mid-Atlantic
});
