import { Shipment, TrackingEvent, ShipmentStatus } from '../types/shipment';
import { calculateRouteGeometry, calculateEstimatedPosition, inferTransportMode } from './routingEngine';
import { resolveLocation, findNearestMetro } from './geocodingService';
import { normalizeLng } from '../utils/greatCircle';
import { formatInZone, timeZoneForPlace } from '../shared/timeZones';
import { shipmentStatusLabel } from '../shared/shipmentStatus';

export type SimulationListener = (updatedShipment: Shipment) => void;

/**
 * Despite the name (kept for the broadcast channel/localStorage keys it already shares with
 * every open tab — renaming those would silently break cross-tab sync for anyone with a tab
 * open across a deploy), this class no longer runs any kind of tick loop. Shipments move on
 * their own now, server-side, at their real promised pace (server/progress.ts) — that used to
 * not exist, which is why a client-side setInterval ticker was built here in the first place
 * to fake movement for a demo. Now that real movement is the source of truth for every
 * viewer, on every device, all the time, that ticker was pure redundant surface area: it could
 * only ever show a *temporary, local, unsaved* preview of a shipment moving faster or slower
 * than its real trajectory, which is a confusing thing for an admin console to offer next to
 * data that's already live and correct. What's left is genuinely useful: broadcasting a
 * shipment update to every open tab instantly (scrub, delay, status changes), a one-shot
 * "jump to this percentage" scrub for testing/demos, and delay advisories.
 */
class SimulationEngine {
  private listeners = new Set<SimulationListener>();

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === 'ngf_live_shipment_stream' && e.newValue) {
            try {
              const data = JSON.parse(e.newValue);
              if (data && data.shipment) {
                this.notifyListeners(data.shipment);
              }
            } catch {}
          }
        });
      }
    } catch {}
  }

  public subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(shipment: Shipment) {
    this.listeners.forEach(fn => fn(shipment));
  }

  private broadcastStream(shipment: Shipment) {
    this.notifyListeners(shipment);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ngf_live_shipment_stream', JSON.stringify({
          trackingNumber: shipment.trackingNumber,
          shipment,
          timestamp: Date.now()
        }));
      }
    } catch {}
  }

  /**
   * Instantly jumps a shipment to a given progress percentage — a one-shot preview/testing
   * tool (e.g. "what does the page look like at 90%?"), not a continuous simulation. Recomputes
   * the marker's real position and nearest-metro label for the scrubbed-to percentage so the
   * map and the percentage shown everywhere else on the page stay consistent. Purely local
   * until an admin submits it via the control modal's "Update Status" action — scrubbing alone
   * does not persist to the server.
   */
  public scrubProgress(
    shipment: Shipment,
    targetPercent: number,
    updateShipmentCallback: (updated: Shipment) => void
  ) {
    const clamped = Math.max(0, Math.min(100, targetPercent));
    let status: ShipmentStatus = shipment.status;
    let statusText = shipment.statusText;

    let currentTimeline = [...(shipment.timeline || (shipment as any).events || [])];
    if (clamped === 0) {
      status = 'RECEIVED';
      statusText = shipmentStatusLabel('RECEIVED');
    } else if (clamped > 0 && clamped < 85) {
      status = 'IN_TRANSIT';
      statusText = shipmentStatusLabel('IN_TRANSIT');
    } else if (clamped >= 85 && clamped < 100) {
      status = 'OUT_FOR_DELIVERY';
      statusText = shipmentStatusLabel('OUT_FOR_DELIVERY');
    } else {
      status = 'DELIVERED';
      statusText = shipmentStatusLabel('DELIVERED');
      const hasDelivered = currentTimeline.some(e => e.status === 'DELIVERED' || e.title.toLowerCase().includes('delivered'));
      if (!hasDelivered) {
        const now = new Date();
        // Local time at the destination, plus its UTC offset (same format the server stores).
        const zone = timeZoneForPlace({ city: shipment.destination.city, state: shipment.destination.state, lat: shipment.destination.lat, lng: shipment.destination.lng });
        const local = formatInZone(now.getTime(), zone);
        const delEvent: TrackingEvent = {
          id: `evt-del-scrub-${Date.now()}`,
          timestamp: now.toISOString(),
          occurredAt: now.toISOString(),
          timezone: zone,
          utcOffset: local.utcOffset,
          displayDate: local.displayDate,
          displayTime: local.displayTime,
          title: `Delivered to Consignee — ${shipment.destination.city}, ${shipment.destination.state}`,
          facility: `${shipment.destination.city} Consignee Delivery Address`,
          city: shipment.destination.city,
          state: shipment.destination.state,
          description: `Consignment successfully delivered into the custody of ${shipment.recipient?.name || 'authorized recipient'}. Proof of delivery confirmed.`,
          isCurrent: true,
          isCompleted: true
        };
        currentTimeline = [delEvent, ...currentTimeline];
      }
    }

    // Recompute the marker's actual position for the scrubbed-to percentage — this used to
    // only change the progress number/status text, leaving the map marker (and its city
    // label) sitting wherever it was before the scrub, completely disconnected from the
    // percentage now shown everywhere else on the page.
    const origCity = shipment.origin?.city || 'New York';
    const origState = shipment.origin?.state || 'NY';
    const destCity = shipment.destination?.city || 'Los Angeles';
    const destState = shipment.destination?.state || 'CA';
    const originResolved = resolveLocation(`${origCity}, ${origState}`);
    const destResolved = resolveLocation(`${destCity}, ${destState}`);
    const origin = {
      lat: shipment.origin?.lat || originResolved?.lat || 40.7128,
      lng: shipment.origin?.lng || originResolved?.lng || -74.0060,
      name: `${origCity}, ${origState}`
    };
    const dest = {
      lat: shipment.destination?.lat || destResolved?.lat || 34.0522,
      lng: shipment.destination?.lng || destResolved?.lng || -118.2437,
      name: `${destCity}, ${destState}`
    };
    // Same route the server and the map use for this shipment (road, air or sea legs)
    const mode = inferTransportMode({ mode: shipment.transportMode, shipmentType: shipment.shipmentType, service: shipment.service, origin, destination: dest });
    const routeGeom = calculateRouteGeometry(origin, dest, mode);
    const estimated = calculateEstimatedPosition(routeGeom.polyline, clamped, routeGeom.legs);
    // Routes across the date line use continuous longitudes; keep the real one.
    const pos = { lat: estimated.lat, lng: normalizeLng(estimated.lng) };
    const nearestMetro = clamped >= 100
      ? { city: destCity, state: destState }
      : clamped <= 0
      ? { city: origCity, state: origState }
      : findNearestMetro(pos.lat, pos.lng) || { city: origCity, state: origState };

    const updated: Shipment = {
      ...shipment,
      progressPercent: clamped,
      status,
      statusText,
      lastUpdated: 'Just now (Scrubbed)',
      timeline: currentTimeline,
      events: currentTimeline,
      currentLocation: {
        ...(typeof shipment.currentLocation === 'object' ? shipment.currentLocation : {}),
        lat: pos.lat,
        lng: pos.lng,
        city: nearestMetro.city,
        state: nearestMetro.state
      } as any,
      simulationState: {
        manualScrub: true,
        lastHeartbeat: new Date().toISOString()
      }
    };

    updateShipmentCallback(updated);
    this.broadcastStream(updated);
  }

  /**
   * Applies an operational delay and shifts estimated delivery date/time.
   */
  public applyDelay(
    shipment: Shipment,
    reason: string,
    delayHours: number,
    advisoryNote: string,
    updateShipmentCallback: (updated: Shipment) => void
  ) {
    const now = new Date();
    const timestampStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Injected delay checkpoint
    const delayEvent: TrackingEvent = {
      id: `delay-${Date.now()}`,
      status: 'DELAYED',
      milestoneState: 'CONFIRMED',
      title: `Transit Delay Advisory: ${reason} (+${delayHours} Hours)`,
      location: shipment.currentLocation || `${shipment.origin.city}, ${shipment.origin.state}`,
      facility: shipment.currentFacility || 'In transit',
      city: shipment.origin.city,
      state: shipment.origin.state,
      timestamp: timestampStr,
      displayDate: timestampStr.split(' · ')[0],
      displayTime: timestampStr.split(' · ')[1],
      description: advisoryNote || `Corridor transit delay due to ${reason}. Estimated delivery adjusted by +${delayHours} hours.`,
      isCompleted: true,
      isCurrent: true,
      recordedBy: 'Live Dispatch Operations'
    };

    // Calculate revised ETA
    const originalETA = shipment.estimatedDelivery || 'Tomorrow, 5:00 PM';
    const revisedETA = `${originalETA} (+${delayHours} hrs)`;

    const updated: Shipment = {
      ...shipment,
      status: 'DELAYED',
      statusText: `${shipmentStatusLabel('DELAYED')} (${reason})`,
      health: 'ATTENTION_REQUIRED',
      healthExplanation: `Operational delay logged: ${reason}. Delivery schedule pushed by ${delayHours} hours.`,
      delayNotice: {
        hasDelay: true,
        reason,
        delayHours,
        originalETA,
        revisedETA,
        advisoryNote: advisoryNote || `Shipment delayed due to ${reason}. Transit active with revised delivery window.`
      },
      timeline: [delayEvent, ...(shipment.timeline || []).map(t => ({ ...t, isCurrent: false }))],
      lastUpdated: 'Just now'
    };

    updateShipmentCallback(updated);
    this.broadcastStream(updated);
  }

  /**
   * Clears any active delay notice and restores regular on-track status.
   */
  public clearDelay(shipment: Shipment, updateShipmentCallback: (updated: Shipment) => void) {
    const updated: Shipment = {
      ...shipment,
      status: 'IN_TRANSIT',
      statusText: shipmentStatusLabel('IN_TRANSIT'),
      health: 'ON_TRACK',
      healthExplanation: 'Consignment progressing normally on its planned route.',
      delayNotice: undefined,
      lastUpdated: 'Just now'
    };

    updateShipmentCallback(updated);
    this.broadcastStream(updated);
  }
}

export const simulationEngine = new SimulationEngine();
