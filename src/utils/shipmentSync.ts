import { Shipment } from '../types/shipment';

/**
 * A shipment's live position/status can arrive through several independent, uncoordinated
 * sources — a simulation broadcast, a server poll, an admin data refresh — each a different
 * snapshot taken at a different moment, with no coordination between them. Applied without a
 * rule, whichever one happens to land last wins, even if it's older/less-advanced than what's
 * already on screen — a shipment's position visibly jumping backward.
 *
 * Every producer across the app should funnel its updates through this one function, which
 * enforces a single rule: for the SAME shipment, position/status only ever move forward. A
 * genuinely different shipment (a new tracking number) always fully replaces state — the
 * forward-only rule only makes sense comparing two snapshots of the same one.
 */
export function applyForwardOnlyShipmentUpdate(prev: Shipment | null, incoming: Shipment): Shipment {
  if (!prev || (prev.trackingNumber || '').toUpperCase() !== (incoming.trackingNumber || '').toUpperCase()) {
    return incoming;
  }
  const incomingIsBehind = (incoming.progressPercent ?? 0) < (prev.progressPercent ?? 0);
  if (!incomingIsBehind) {
    return { ...prev, ...incoming };
  }
  return {
    ...prev,
    ...incoming,
    currentLocation: prev.currentLocation,
    status: prev.status,
    statusText: prev.statusText,
    progressPercent: prev.progressPercent,
  };
}
