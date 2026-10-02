import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Calendar,
  Truck,
  Building2,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Link2,
  ArrowLeft,
  ArrowRight,
  Headphones,
  Check,
  Phone,
  Mail,
  Search,
  Radio,
  Clock,
  Compass,
  AlertCircle,
  HelpCircle,
  Car,
  Key,
  Flame,
  FileText,
  Activity,
  Layers,
  Bell,
  Printer,
  Share2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  PawPrint,
  Heart,
  Lock,
  Navigation,
  Zap,
  Scale,
  Box,
  Shield,
  Container,
  Stethoscope
} from 'lucide-react';
import { Shipment, TrackingEvent, RouteCheckpoint, ShipmentStatus } from '../types/shipment';
import { Barcode } from '../components/Barcode';
import { JourneyMap } from '../components/JourneyMap';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { MultiPieceList } from '../components/MultiPieceList';
import { shipmentStatusLabel, shipmentStatusTone } from '../shared/shipmentStatus';
import { SupportModal } from '../components/SupportModal';
import { calculateRouteGeometry, inferTransportMode } from '../services/routingEngine';
import { timeZoneForPlace } from '../shared/timeZones';
import { formatDimensions, formatDistance, formatWeight } from '../shared/units';
import { TRANSPORT_LEG_LABELS } from '../shared/transportMode';
import { useUnitSystem } from '../utils/useUnitSystem';
import { UnitToggle } from '../components/forms/UnitControls';
import { simulationEngine } from '../services/simulationEngine';
import { api } from '../services/api';
import { generateShipmentPlan, calculateDynamicTimeProgress, getServiceCommitmentHours } from '../services/planningEngine';
import { resolveLocation } from '../services/geocodingService';
import { applyForwardOnlyShipmentUpdate } from '../utils/shipmentSync';
import { useCompanyContact } from '../utils/useCompanyContact';
import './TrackResultPage.css';

interface TrackResultPageProps {
  shipment: Shipment;
  onTrackAnother: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

export const TrackResultPage: React.FC<TrackResultPageProps> = ({
  shipment,
  onTrackAnother,
  onNavigate,
}) => {
  // An empty phone hides the call button (no placeholder number).
  const { phone: supportPhone, phoneHref } = useCompanyContact();

  // Continuous real-time synchronized state
  const [liveShipment, setLiveShipment] = useState<Shipment>(shipment);

  useEffect(() => {
    setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, shipment));
  }, [shipment]);

  useEffect(() => {
    // Real progress now comes from the server (server/progress.ts), on a schedule, for every
    // viewer — this subscription is just for instant same-session updates an admin makes
    // through the control modal (a manual scrub-to-percentage preview, a delay advisory),
    // broadcast live via localStorage rather than waiting for the next poll. Guarded the same
    // forward-only way as every other entry point below.
    const unsubscribe = simulationEngine.subscribe((updated) => {
      if (updated.trackingNumber.toUpperCase() === (shipment?.trackingNumber || '').toUpperCase()) {
        setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, updated));
      }
    });

    return () => unsubscribe();
  }, [shipment?.trackingNumber]);

  useEffect(() => {
    // The server now advances a shipment's real progress on its own over elapsed time
    // (see server/progress.ts) — but an already-open tab has no way to notice that
    // happened without asking again. Periodically re-fetch so genuine background
    // progress becomes visible without requiring a manual page reload.
    const trackingNumber = shipment?.trackingNumber;
    if (!trackingNumber) return;

    const POLL_MS = 8000;
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const fresh = await api.trackShipment(trackingNumber);
        if (!fresh) return;
        setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, fresh));
      } catch (err: any) {
        if (err?.status === 404) {
          // The shipment behind this tracking number is gone (deleted, or never existed) —
          // retrying every 8 seconds forever can't fix that. Stop; a genuinely new tracking
          // number means a fresh mount of this page anyway (new trackingNumber dependency).
          stopped = true;
          clearInterval(interval);
        }
        // Any other error: silent, a failed background refresh shouldn't disrupt the page.
      }
    }, POLL_MS);

    return () => { stopped = true; clearInterval(interval); };
  }, [shipment?.trackingNumber]);

  const [searchInput, setSearchInput] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEarlierEvents, setShowEarlierEvents] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alertPhone, setAlertPhone] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Safe field extraction from synchronized liveShipment
  const trackingNum = liveShipment?.trackingNumber || shipment?.trackingNumber || '';
  const status = liveShipment?.status || 'IN_TRANSIT';
  const statusTone = shipmentStatusTone(status);
  const isDelivered = statusTone === 'delivered';
  const isHold = statusTone === 'hold';
  const isDelayed = statusTone === 'delayed';
  // The admin's Operations Control modal records a hold/delay reason into statusText as
  // "On hold (<reason>)" / "Delayed (<reason>)" — there's no separate reason column in
  // the backend, so this is the one place that value actually survives the round trip to the
  // database. Pull it back out here so the public page can tell the customer WHY, instead of
  // a generic "your shipment is on hold" that never says anything more.
  const holdOrDelayReasonMatch = /\((.+)\)\s*$/.exec(liveShipment?.statusText || '');
  const holdOrDelayReason = holdOrDelayReasonMatch ? holdOrDelayReasonMatch[1] : undefined;
  const hasRevisedSchedule = isHold || isDelayed || Boolean(shipment.delayNotice?.hasDelay);
  // Single canonical status name (CONTENT §6.3, shared with the admin), reused everywhere the
  // page shows the shipment's current status.
  const statusDisplayLabel = shipmentStatusLabel(status);
  // Vehicle views only for real vehicle shipments (by type or stored vehicle details).
  const isVehicle = liveShipment?.shipmentType === 'Vehicle' || !!liveShipment?.vehicleDetails;
  const isPet = liveShipment?.shipmentType === 'Pets' || !!liveShipment?.petDetails;
  const pet = liveShipment?.petDetails;
  
  const originCity = liveShipment?.origin?.city || shipment?.origin?.city || 'New York';
  const originState = liveShipment?.origin?.state || shipment?.origin?.state || 'NY';
  // No fallback — ZIP is optional at booking (CreateShipmentView), and showing a fake one for
  // a shipment that genuinely doesn't have it on file is exactly the "shows a placeholder
  // for a field I left blank" problem this page shouldn't have. Reads sender/recipient's
  // postalCode first — origin.zip/destination.zip have no backing database column at all, so
  // that value only ever survives in memory until the next refetch, when it silently reverts
  // to nothing; postalCode on the party record is what actually round-trips through the API.
  const originZip = (liveShipment?.sender as any)?.postalCode || (liveShipment?.origin as any)?.zip || (shipment?.sender as any)?.postalCode || (shipment?.origin as any)?.zip;
  const destCity = liveShipment?.destination?.city || shipment?.destination?.city || 'Los Angeles';
  const destState = liveShipment?.destination?.state || shipment?.destination?.state || 'CA';
  const destZip = (liveShipment?.recipient as any)?.postalCode || (liveShipment?.destination as any)?.zip || (shipment?.recipient as any)?.postalCode || (shipment?.destination as any)?.zip;
  // Facility names only when stored (no invented terminal names).
  const originFacility = (liveShipment?.origin as any)?.facilityName || (shipment?.origin as any)?.facilityName || '';
  const destFacility = (liveShipment?.destination as any)?.facilityName || (shipment?.destination as any)?.facilityName || '';

  const currentCity = typeof liveShipment?.currentLocation === 'string'
    ? liveShipment.currentLocation.split(',')[0].trim()
    : (typeof liveShipment?.currentLocation === 'object' && (liveShipment.currentLocation as any)?.city) || (typeof shipment?.currentLocation === 'object' && (shipment?.currentLocation as any)?.city) || originCity;
    
  const currentState = typeof liveShipment?.currentLocation === 'string'
    ? liveShipment.currentLocation.split(',')[1]?.trim() || originState
    : typeof liveShipment?.currentLocation === 'object'
      ? ((liveShipment.currentLocation as any)?.state ?? '')
      : ((typeof shipment?.currentLocation === 'object' && (shipment?.currentLocation as any)?.state) || '');

  // "In flight" / "At sea" positions have no region, so it's left off rather than filled in.
  const currentLocationText = [currentCity, currentState].filter(Boolean).join(', ');

  // Real coordinates for wherever the shipment's currentLocation actually points — an
  // admin-set facility or a live simulation tick, both now kept accurate (see the routing
  // fixes above). JourneyMap uses these to plot the vehicle marker for real instead of
  // guessing a point from progress % alone.
  const currentLat = typeof liveShipment?.currentLocation === 'object'
    ? (liveShipment.currentLocation as any)?.lat
    : (typeof shipment?.currentLocation === 'object' ? (shipment?.currentLocation as any)?.lat : undefined);
  const currentLng = typeof liveShipment?.currentLocation === 'object'
    ? (liveShipment.currentLocation as any)?.lng
    : (typeof shipment?.currentLocation === 'object' ? (shipment?.currentLocation as any)?.lng : undefined);

  // "Just now" is a real, valid value (the shipment really was just touched) — it just isn't
  // a displayable date/time on its own. This used to reject it and substitute a hardcoded
  // fake past date instead of formatting the actual current moment it stands in for.
  const lastUpdated = typeof liveShipment?.lastUpdated === 'string' && liveShipment.lastUpdated !== 'Just now'
    ? liveShipment.lastUpdated
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const estDeliveryDate = typeof liveShipment?.estimatedDelivery === 'string'
    ? liveShipment.estimatedDelivery
    : (typeof liveShipment?.estimatedDelivery === 'object' && (liveShipment.estimatedDelivery as any)?.date) || '';

  const estDeliveryTime = typeof liveShipment?.estimatedDeliveryDetail === 'string'
    ? liveShipment.estimatedDeliveryDetail
    : (typeof liveShipment?.estimatedDelivery === 'object' && (liveShipment.estimatedDelivery as any)?.timeWindow) || '';
  const estDeliveryText = [estDeliveryDate, estDeliveryTime].filter(Boolean).join(' · ') || '—';

  const service = liveShipment?.service || shipment?.service || 'Express';

  // Real shipment data always wins; these are only fallbacks when a field is missing.
  const cargoType = liveShipment?.shipmentType || 'Freight';
  const cargoDescription = liveShipment?.cargoDescription || shipment?.cargoDescription || 'General cargo';
  const shipmentType = cargoType === 'Vehicle' ? 'Freight' : cargoType;
  const transportType = 'Open Auto Carrier';
  // Stored in pounds; shown in the viewer's units (no invented fallback weight)
  const totalWeight = Number(liveShipment?.totalWeightLbs || shipment?.totalWeightLbs || 0);
  const [unitSystem] = useUnitSystem();
  const totalWeightText = totalWeight > 0 ? formatWeight(totalWeight, unitSystem) : '—';
  const totalPieces = Number(shipment?.totalPieces || 1);
  const dimensionsText = formatDimensions(liveShipment?.dimensions || shipment?.dimensions, unitSystem);

  // Parties data — only Full Name and Street Address are required at booking (see
  // CreateShipmentView); Company/Email/Phone are explicitly optional there, so a blank one
  // must not show a fabricated fallback value here: those fields are conditionally rendered
  // below and simply omitted when empty.
  const senderName = shipment?.sender?.name || 'Shipper';
  const senderCompany = shipment?.sender?.company;
  const senderAddress = shipment?.sender?.addressLine;
  const senderPhone = shipment?.sender?.phone;
  const senderEmail = shipment?.sender?.email;

  const recipientName = shipment?.recipient?.name || 'Consignee';
  const recipientCompany = shipment?.recipient?.company;
  const recipientAddress = shipment?.recipient?.addressLine;
  const recipientPhone = shipment?.recipient?.phone;
  const recipientEmail = shipment?.recipient?.email;

  const originGeo = resolveLocation([originCity, originState].filter(Boolean).join(', ')) || resolveLocation(originCity) || resolveLocation(originState) || { lat: 40.7128, lng: -74.0050 };
  const currentGeo = resolveLocation([currentCity, currentState].filter(Boolean).join(', ')) || resolveLocation(currentCity) || resolveLocation(currentState) || { lat: 41.8781, lng: -87.6298 };
  const destGeo = resolveLocation([destCity, destState].filter(Boolean).join(', ')) || resolveLocation(destCity) || resolveLocation(destState) || { lat: 34.0522, lng: -118.2437 };

  const routeCheckpoints: RouteCheckpoint[] = [
    {
      id: 'pt-origin',
      name: originCity,
      state: originState,
      type: 'origin',
      statusLabel: 'Origin',
      lat: (liveShipment?.origin as any)?.lat || (shipment?.origin as any)?.lat || originGeo.lat,
      lng: (liveShipment?.origin as any)?.lng || (shipment?.origin as any)?.lng || originGeo.lng,
    },
    {
      id: 'pt-current',
      name: currentCity,
      state: currentState,
      type: 'current',
      statusLabel: 'Current Location',
      lat: (liveShipment?.currentLocation as any)?.lat || currentGeo.lat,
      lng: (liveShipment?.currentLocation as any)?.lng || currentGeo.lng,
    },
    {
      id: 'pt-dest',
      name: destCity,
      state: destState,
      type: 'destination',
      statusLabel: 'Destination',
      dateLabel: `${estDeliveryDate} • ${estDeliveryTime}`,
      lat: (liveShipment?.destination as any)?.lat || (shipment?.destination as any)?.lat || destGeo.lat,
      lng: (liveShipment?.destination as any)?.lng || (shipment?.destination as any)?.lng || destGeo.lng,
    }
  ];

  // Timeline events
  const rawEventsList: TrackingEvent[] = (liveShipment?.timeline && liveShipment.timeline.length > 0)
    ? liveShipment.timeline
    : (shipment?.timeline && shipment.timeline.length > 0)
    ? shipment.timeline
    : (liveShipment?.events && liveShipment.events.length > 0)
    ? liveShipment.events
    : (shipment?.events && shipment.events.length > 0)
    ? shipment.events
    : [];

  const handleCopyTrackingNumber = () => {
    navigator.clipboard.writeText(trackingNum);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleCopyShareableLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/track/${trackingNum}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onTrackAnother(searchInput.trim());
    }
  };

  // Automated routing & planned milestone calculations. The mode (road, air or sea legs) comes
  // from the shipment, or is inferred for older records the same way the server does.
  const routeOrigin = { lat: (liveShipment?.origin as any)?.lat || (shipment?.origin as any)?.lat || originGeo.lat, lng: (liveShipment?.origin as any)?.lng || (shipment?.origin as any)?.lng || originGeo.lng, name: originCity };
  const routeDestination = { lat: (liveShipment?.destination as any)?.lat || (shipment?.destination as any)?.lat || destGeo.lat, lng: (liveShipment?.destination as any)?.lng || (shipment?.destination as any)?.lng || destGeo.lng, name: destCity };
  const transportMode = inferTransportMode({
    mode: liveShipment?.transportMode ?? shipment?.transportMode,
    shipmentType: cargoType,
    service,
    origin: routeOrigin,
    destination: routeDestination
  });
  const routeGeom = calculateRouteGeometry(routeOrigin, routeDestination, transportMode);

  const timeProgress = calculateDynamicTimeProgress(liveShipment || shipment, 48);

  // NOTE: progressPercent intentionally does NOT blend in timeProgress.progressPercent via
  // Math.max() here. timeProgress is a wall-clock estimate (elapsed real time since the
  // shipment's first event vs. its SLA window) — for demo data with fixed past dates, that
  // ratio only ever climbs and permanently pins near its 94% ceiling well after the SLA
  // window has passed, silently overriding whatever progress the simulation/admin actually
  // set. The real, admin-controllable progressPercent is the source of truth; timeProgress
  // is used only as a last-resort fallback when no real value exists at all.
  const progressPercent = status === 'DELIVERED'
    ? 100
    : isHold
    ? (liveShipment?.frozenProgressPercent ?? shipment?.frozenProgressPercent ?? shipment?.progressPercent ?? 35)
    : String(status) === 'CREATED' || String(status) === 'AWAITING_PICKUP' || String(status) === 'BOOKED'
    ? 0
    : (liveShipment as any)?.progressPercent !== undefined
    ? (liveShipment as any).progressPercent
    : (shipment as any)?.progressPercent !== undefined
    ? (shipment as any).progressPercent
    : timeProgress.progressPercent;

  // Anchor the planned-milestone timeline to this shipment's real, already-stored estimated
  // delivery date (working backward by the service SLA window) instead of deriving forward
  // from "right now" — otherwise the 6-stage timeline's own final "Delivered" milestone date
  // would silently drift out of sync with the ETA already shown in the header/summary cards,
  // the same class of self-contradicting-date bug this timeline replacement was meant to fix.
  const slaHoursForPlan = getServiceCommitmentHours(service, routeGeom.distanceMiles);
  const parsedEstDelivery = new Date(estDeliveryDate);
  const planPickupDateStr = !isNaN(parsedEstDelivery.getTime())
    ? new Date(parsedEstDelivery.getTime() - slaHoursForPlan * 3600 * 1000).toISOString()
    : undefined;

  const plan = generateShipmentPlan(
    { city: originCity, state: originState },
    { city: destCity, state: destState },
    service,
    routeGeom.distanceMiles,
    planPickupDateStr,
    rawEventsList,
    status as ShipmentStatus,
    progressPercent
  );

  const eventsList: TrackingEvent[] = useMemo(() => {
    let sourceList = [...rawEventsList];
    if (status === 'DELIVERED') {
      const hasDelivered = sourceList.some(e => e.status === 'DELIVERED' || e.title.toLowerCase().includes('delivered'));
      if (!hasDelivered) {
        const lastUp = typeof liveShipment?.lastUpdated === 'string' && liveShipment.lastUpdated.includes('·')
          ? liveShipment.lastUpdated
          : lastUpdated;
        const parts = lastUp.split('·');
        const dStr = parts[0]?.trim() || '';
        const tStr = parts[1]?.trim() || '';

        const delEvent: TrackingEvent = {
          id: 'auto-delivered-scan',
          timestamp: new Date().toISOString(),
          timezone: timeZoneForPlace({ city: destCity, state: destState }),
          displayDate: dStr,
          displayTime: tStr,
          title: shipmentStatusLabel('DELIVERED'),
          facility: '',
          city: destCity,
          state: destState,
          description: '',
          isCurrent: true,
          isCompleted: true
        };

        sourceList = [delEvent, ...sourceList];
      }
    }

    // Intelligent Deduplication: Filter out rapid tick artifacts & repetitive status pings
    const seenSignatures = new Set<string>();
    const cleaned: TrackingEvent[] = [];

    for (const evt of sourceList) {
      // Normalize signature: event title without non-alphanumeric noise + city
      const normTitle = (evt.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCity = (evt.city || '').trim().toLowerCase();
      const sig = `${normTitle}_${normCity}`;
      
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        cleaned.push(evt);
      }
      // Maximum realistic milestone checkpoints for any domestic highway consignment
      if (cleaned.length >= 8) break;
    }

    return cleaned;
  }, [status, rawEventsList, destCity, destState, liveShipment, shipment]);

  // The primary 6-stage timeline, derived from `plan.plannedMilestones` (see the
  // generateShipmentPlan call above) — genuinely computed from this shipment's real pickup
  // date, real service-level SLA window, and real confirmed events/progress, instead of a
  // fixed "Aug 21-23, 2026" mockup timeline that used to render identically for every
  // shipment regardless of when it was actually created or what had actually happened to it.
  const referenceTimelineEvents = useMemo(() => {
    const milestones = plan.plannedMilestones;
    const lastConfirmedIndex = milestones.reduce(
      (acc, m, idx) => (m.milestoneState === 'CONFIRMED' ? idx : acc),
      -1
    );
    return milestones.map((m, idx) => ({
      id: m.id,
      title: m.stageName,
      dateStr: m.plannedDateTime,
      location: m.location,
      statusType: (idx === lastConfirmedIndex && status !== 'DELIVERED')
        ? ('current' as const)
        : m.milestoneState === 'CONFIRMED'
          ? ('confirmed' as const)
          : ('estimated' as const),
      description: m.description
    }));
  }, [plan.plannedMilestones, status]);

  const scrollToTimeline = () => {
    const el = document.getElementById('shipment-timeline-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubscribeAlerts = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertSuccess(true);
    setTimeout(() => {
      setAlertSuccess(false);
      setAlertsModalOpen(false);
    }, 2000);
  };

  // CONTENT §6.3 lines. The ETA is given in the destination's local time zone.
  const destZone = timeZoneForPlace({ city: destCity, state: destState });
  const destZoneName = destZone === 'UTC' ? 'UTC' : `${(destZone.split('/').pop() || destZone).replace(/_/g, ' ')} time`;
  const etaLine = estDeliveryDate
    ? `Estimated delivery: ${[estDeliveryDate, estDeliveryTime].filter(Boolean).join(', ')} (${destZoneName})`
    : '';
  // Delivered: date and time of the delivery scan; the signer comes from the admin's delivery
  // record ("Delivered (Signed by …)"), already masked by the public API.
  const deliveredEvent = eventsList.find(e => e.status === 'DELIVERED' || (e.title || '').toLowerCase().includes('delivered'));
  const [lastUpdatedDate, lastUpdatedTime] = lastUpdated.split(' · ');
  const deliveredDate = deliveredEvent?.displayDate || lastUpdatedDate;
  const deliveredTime = deliveredEvent?.displayTime || lastUpdatedTime;
  const signerMatch = /signed (?:for )?by ([^().]+)/i.exec(`${liveShipment?.statusText || ''} ${deliveredEvent?.description || ''}`);
  const signer = signerMatch ? signerMatch[1].trim() : '';
  const deliveredLine = `Delivered ${deliveredDate}${deliveredTime ? ` at ${deliveredTime}` : ''}.${signer ? ` Signed by ${signer}.` : ''}`;
  const statusLine = isDelivered ? deliveredLine : etaLine;

  return (
    <div className="sdl-redesign-tracking-page animate-fade-in">
      {/* =========================================================================
          0. HERO BANNER
          ========================================================================= */}
      <section className="sdl-cinematic-hero-section">
        <div className="sdl-hero-backdrop-img">
          <ResponsiveImage
            name="track-hero"
            alt="Lorry with its headlights on, driving a mountain road at dusk"
            eager
            sizes="100vw"
            className="hero-bg-media"
            imgClassName="hero-bg-photo"
          />
          <div className="sdl-hero-overlay" />
        </div>

        <div className="sdl-hero-content-wrap">
          {/* Top Breadcrumb & Status */}
          <div className="sdl-hero-top-bar">
            <button
              type="button"
              className="hero-back-link"
              onClick={() => onNavigate('track')}
            >
              <ArrowLeft size={16} />
              <span>Back to tracking</span>
            </button>
          </div>

          <div className="hero-status-pill-wrap">
            <span className={`hero-live-status-pill ${isHold ? 'hold' : isDelayed ? 'delayed' : status === 'DELIVERED' ? 'delivered' : 'in-transit'}`}>
              <span className="hero-live-dot" />
              {statusDisplayLabel.toUpperCase()}
            </span>
          </div>

          <h1 className="hero-tracking-number font-mono">{trackingNum}</h1>
          <h2 className="hero-cargo-title">{cargoDescription}</h2>

          <div className="hero-route-strip">
            <div className="hero-route-stop">
              <MapPin size={16} className="text-blue" />
              <span>{originCity}, {originState}</span>
            </div>
            <ArrowRight size={14} className="hero-route-arrow" />
            <div className="hero-route-stop">
              <MapPin size={16} className="text-blue" />
              <span>{destCity}, {destState}</span>
            </div>
          </div>

          {/* Floating Frosted Dark Metrics Bar */}
          <div className="hero-floating-metrics-bar">
            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Zap size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">Service Level</span>
                <strong className="hero-metric-val">{service}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Calendar size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">Est. Delivery</span>
                <strong className="hero-metric-val">{estDeliveryText}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Truck size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">Distance</span>
                <strong className="hero-metric-val">{formatDistance(routeGeom.distanceMiles, unitSystem)}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className={`hero-metric-icon ${hasRevisedSchedule ? 'amber' : 'emerald'}`}>
                <Activity size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">Current Status</span>
                <strong className={`hero-metric-val ${hasRevisedSchedule ? 'text-amber' : 'text-emerald'}`}>
                  {statusDisplayLabel}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <div className="sdl-track-container">
        {/* Hold / Delay Advisory — surfaces the specific reason an admin recorded via
            Operations Control, instead of leaving a customer to guess why their shipment
            stopped moving or when it'll actually arrive. */}
        {(isHold || isDelayed) && (
          <div className={`tracking-top-alert-banner animate-fade-in ${isHold ? 'hold' : 'delay'}`}>
            {isHold ? <Clock size={18} /> : <AlertTriangle size={18} />}
            <div>
              <strong>{statusDisplayLabel}{holdOrDelayReason ? `: ${holdOrDelayReason}` : ''}</strong>
              {etaLine && <p>{etaLine}</p>}
            </div>
          </div>
        )}

        {/* RTO Alert (If active) */}
        {shipment?.returnLeg && (
          <div className="rto-active-advisory-banner animate-fade-in">
            <RotateCcw size={18} className="text-amber" />
            <div>
              <strong>{shipmentStatusLabel('RETURNED')} ({shipment.returnLeg.reason})</strong>
              <p>Returning to {originCity}{originState ? `, ${originState}` : ''}. Return tracking ID: <span className="font-mono">{shipment.returnLeg.returnTrackingNumber}</span></p>
            </div>
          </div>
        )}

        {/* Return shipment: link back to the original */}
        {shipment?.returnOf && (
          <div className="rto-active-advisory-banner animate-fade-in">
            <RotateCcw size={18} className="text-amber" />
            <div>
              <strong>{shipmentStatusLabel('RETURNED')}</strong>
              <p>This is the return of shipment <span className="font-mono">{shipment.returnOf}</span> to its sender.</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            1. WHITE CONSIGNMENT SUMMARY CARD (3 COLUMNS + CORRIDOR RAIL)
            ========================================================================= */}
        <section className="sdl-hero-summary-card">
          <div className="hero-summary-grid">
            {/* Column 1: Tracking Number & Barcode */}
            <div className="hero-col-barcode">
              <span className="hero-col-label">Tracking Number</span>
              <div className="tracking-number-row">
                <h3 className="tracking-number-val font-mono">{trackingNum}</h3>
                <button
                  type="button"
                  className="copy-btn-inline"
                  onClick={handleCopyTrackingNumber}
                  title="Copy Tracking Number"
                >
                  {copiedNumber ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                </button>
              </div>

              {/* Code 128 Linear Barcode */}
              <div className="hero-barcode-container">
                <Barcode
                  value={trackingNum}
                  height={54}
                  width={1.5}
                  fontSize={11}
                  displayValue={true}
                />
              </div>
            </div>

            {/* Column 2: Current Status & Details */}
            <div className="hero-col-status">
              <span className="hero-col-label">Current Status</span>
              <h2 className="status-hero-heading">
                {statusDisplayLabel}
              </h2>
              {statusLine && (
                <p className="status-hero-sub">
                  {statusLine}
                </p>
              )}

              <div className="last-recorded-checkpoint-box">
                <span className="chk-label">LAST SCAN</span>
                <span className="chk-val">{currentLocationText}{currentLocationText ? ' · ' : ''}{lastUpdated}</span>
              </div>
            </div>

            {/* Column 3: Estimated Delivery & Meta Specs */}
            <div className="hero-col-eta-specs">
              <span className="hero-col-label">ESTIMATED DELIVERY</span>
              <div className="eta-highlight-box">
                <div className="eta-date-row">
                  <Calendar size={22} className="text-blue" />
                  <div>
                    <strong>{estDeliveryDate || '—'}</strong>
                    {estDeliveryTime && <small>{estDeliveryTime}</small>}
                  </div>
                </div>
                {hasRevisedSchedule ? (
                  <span className="on-schedule-pill revised">
                    <Clock size={13} />
                    <span>Revised</span>
                  </span>
                ) : (
                  <span className="on-schedule-pill">
                    <CheckCircle2 size={13} />
                    <span>On Schedule</span>
                  </span>
                )}
              </div>

              {/* Meta Specs Table */}
              <div className="hero-specs-mini-table">
                <div className="spec-item-row">
                  <span className="s-lbl">Service Level:</span>
                  <span className="s-val">{service}</span>
                </div>
                <div className="spec-item-row">
                  <span className="s-lbl">Shipment Type:</span>
                  <span className="s-val">{shipmentType}</span>
                </div>
                {isVehicle && (
                <div className="spec-item-row">
                  <span className="s-lbl">Transport Type:</span>
                  <span className="s-val">{transportType}</span>
                </div>
                )}
                <div className="spec-item-row">
                  <span className="s-lbl">Total Weight:</span>
                  <span className="s-val">{totalWeightText}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Route transit rail */}
          <div className="hero-corridor-journey-strip">
            <div className="corridor-point origin">
              <div className="corridor-point-icon">
                <Navigation size={16} />
              </div>
              <div className="corridor-point-text">
                <span className="corridor-label">ORIGIN</span>
                <strong className="corridor-city">{originCity}, {originState}</strong>
                {originFacility && <small className="corridor-facility">{originFacility}</small>}
              </div>
            </div>

            <div className="corridor-track-wrapper">
              <div className="corridor-meta-badges">
                <span className="corridor-dist-badge">
                  <span>Total route {formatDistance(routeGeom.distanceMiles, unitSystem)} · {TRANSPORT_LEG_LABELS[transportMode]}</span>
                </span>
                <span className="corridor-status-badge">
                  {status === 'DELIVERED' ? (
                    <span className="text-emerald font-bold">✓ 100% Completed</span>
                  ) : (
                    <span>● {progressPercent}% Completed</span>
                  )}
                </span>
                <span className="corridor-sla-badge">
                  <span>{statusDisplayLabel}</span>
                </span>
              </div>
              <div className="corridor-progress-rail">
                <div 
                  className={`corridor-progress-fill ${status === 'DELIVERED' ? 'delivered' : ''}`}
                  style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
                >
                  <span className="corridor-hauler-indicator" title={`${progressPercent}% progress`}>
                    📦
                  </span>
                </div>
              </div>
            </div>

            <div className="corridor-point destination">
              <div className="corridor-point-icon dest">
                <MapPin size={16} />
              </div>
              <div className="corridor-point-text">
                <span className="corridor-label">DESTINATION</span>
                <strong className="corridor-city">{destCity}, {destState}</strong>
                {destFacility && <small className="corridor-facility">{destFacility}</small>}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. FULL-WIDTH INTERACTIVE ROUTE MAP
            ========================================================================= */}
        <section className="sdl-route-map-section" aria-labelledby="track-route-title">
          <h3 id="track-route-title" className="card-section-title sdl-route-title">Route</h3>
          <JourneyMap
            checkpoints={routeCheckpoints}
            currentLocationText={currentLocationText}
            currentLat={currentLat}
            currentLng={currentLng}
            lastEventDescription={isDelivered ? statusDisplayLabel : `${statusDisplayLabel} · ${TRANSPORT_LEG_LABELS[transportMode].toLowerCase()} to ${destCity}`}
            totalDistance={formatDistance(routeGeom.distanceMiles, unitSystem)}
            transitTime={`${plan.serviceCommitmentHours} Hours`}
            progressPercent={progressPercent}
            shipmentStatus={status}
            delayNotice={liveShipment.delayNotice}
            onScrollToTimeline={scrollToTimeline}
            transportMode={transportMode}
          />
        </section>

        {/* =========================================================================
            3. TWO-COLUMN MAIN CONTENT (LEFT: TIMELINE | RIGHT: VEHICLE & DETAILS)
            ========================================================================= */}
        <section className="sdl-main-content-grid">
          {/* LEFT COLUMN: Clean Chronological Shipment Timeline */}
          <div id="shipment-timeline-section" className="content-col-timeline">
            <div className="timeline-card">
              <div className="timeline-card-header">
                <h3 className="card-section-title" style={{ margin: 0 }}>Journey timeline</h3>
                <span className="timeline-count-tag font-mono">
                  {referenceTimelineEvents.filter(e => e.statusType === 'confirmed' || e.statusType === 'current').length} of {referenceTimelineEvents.length} milestones
                </span>
              </div>

              {/* 6 Formatted Events */}
              <div className="timeline-items-list">
                {referenceTimelineEvents.map((evt, idx) => {
                  const isCurrent = evt.statusType === 'current';
                  const isConfirmed = evt.statusType === 'confirmed';
                  const isLast = idx === referenceTimelineEvents.length - 1;

                  return (
                    <div key={evt.id} className={`t-event-row ${isCurrent ? 'active-event' : ''}`}>
                      <div className="t-icon-col">
                        <div className={`t-icon-badge ${isCurrent ? 'current' : isConfirmed ? 'confirmed' : 'estimated'}`}>
                          {isCurrent ? (
                            <Truck size={14} className="text-white animate-pulse" />
                          ) : isConfirmed ? (
                            <Check size={14} />
                          ) : (
                            <span className="hollow-circle-dot" />
                          )}
                        </div>
                        {!isLast && <div className={`t-line-connector ${isConfirmed ? 'solid' : 'dashed'}`} />}
                      </div>

                      <div className="t-content-col">
                        <div className="t-event-head-row">
                          <h4 className={`t-event-title ${isCurrent ? 'text-blue' : ''}`}>{evt.title}</h4>
                          <span className={`t-tag ${evt.statusType}`}>
                            {evt.statusType === 'confirmed' ? 'Confirmed' : evt.statusType === 'current' ? 'Current' : 'Estimated'}
                          </span>
                        </div>
                        <div className="t-event-meta-sub">
                          <span className="t-time-text">{evt.dateStr}</span>
                          <span className="t-dot-sep">•</span>
                          <span className="t-location-text">{evt.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View Full Timeline Button */}
              <button
                type="button"
                className="view-full-timeline-action-btn"
                onClick={() => setShowEarlierEvents(!showEarlierEvents)}
              >
                <span>{showEarlierEvents ? 'Hide scan history' : 'Show scan history'}</span>
                <ChevronDown size={15} style={{ transform: showEarlierEvents ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>

              {/* Expanded Facility Scan Logs */}
              {showEarlierEvents && (
                <div className="timeline-extended-logs animate-fade-in">
                  <div className="extended-logs-header">
                    <span className="font-mono text-xs text-slate-500 font-bold uppercase tracking-wider">All scans</span>
                  </div>
                  {eventsList.length === 0 && (
                    <div className="extended-scan-item">
                      <div className="scan-title">No scans recorded yet.</div>
                    </div>
                  )}
                  {eventsList.map((evt, idx) => (
                    <div key={evt.id || idx} className="extended-scan-item">
                      <div className="scan-time font-mono">{evt.displayDate} · {evt.displayTime}</div>
                      <div className="scan-title">{evt.title} — {[evt.city, evt.state].filter(Boolean).join(', ')}</div>
                      <div className="scan-facility text-xs text-slate-500">{evt.facility}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STRUCTURED CARGO DETAILS */}
          <div className="content-col-details">
            {/* Cargo-Type-Specific Specifications — shown for the non-Vehicle types that
                have real, structured data of their own (Pets, Pallet, Container, Freight,
                Document). Vehicle no longer gets a photo gallery here (removed per request —
                no images on the public track result page), and Parcel/Multi-piece/
                unrecognized types get no extra card either, since the generic "Shipment
                Details" card below already covers everything relevant for them. */}
            {!isVehicle && isPet && pet && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">Live Animal Details</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <PawPrint size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Pet Name</small>
                      <strong>{pet.name || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Heart size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Species / Breed</small>
                      <strong>{[pet.species, pet.breed].filter(Boolean).join(' — ') || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Scale size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Weight</small>
                      <strong>{pet.weightLbs ? formatWeight(pet.weightLbs, unitSystem) : '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Crate Type</small>
                      <strong>{pet.crateType || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Microchip Number</small>
                      <strong className="font-mono">{pet.microchipNumber || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Stethoscope size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Vet Clinic</small>
                      <strong>{pet.vetClinicName || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Pallet' && liveShipment?.palletDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">Pallet Specifications</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Layers size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Pallet Standard</small>
                      <strong>{liveShipment.palletDetails.standard}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Skid Count</small>
                      <strong>{liveShipment.palletDetails.count}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Scale size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Weight Per Skid</small>
                      <strong>{formatWeight(liveShipment.palletDetails.weightPerSkidLbs, unitSystem)}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>Stackable</small>
                      <strong>{liveShipment.palletDetails.stackable ? 'Yes' : 'No — Top-Tier Only'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Container' && liveShipment?.containerDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">Intermodal Container Details</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Container size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Container Number</small>
                      <strong className="font-mono">{liveShipment.containerDetails.containerNumber}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>ISO Size</small>
                      <strong>{liveShipment.containerDetails.isoSize}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Lock size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Bolt Seal</small>
                      <strong className="font-mono">{liveShipment.containerDetails.boltSeal}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Building2 size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Terminal</small>
                      <strong>{liveShipment.containerDetails.terminal}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Freight' && liveShipment?.freightDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">Heavy Freight & LTL Details</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Truck size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Freight Class</small>
                      <strong>{liveShipment.freightDetails.freightClass}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>NMFC Code</small>
                      <strong className="font-mono">{liveShipment.freightDetails.nmfcCode}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Loading Method</small>
                      <strong>{liveShipment.freightDetails.loadingMethod}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>Liftgate</small>
                      <strong>
                        {liveShipment.freightDetails.liftgatePickup && liveShipment.freightDetails.liftgateDelivery
                          ? 'Pickup & Delivery'
                          : liveShipment.freightDetails.liftgateDelivery
                            ? 'Delivery Only'
                            : liveShipment.freightDetails.liftgatePickup
                              ? 'Pickup Only'
                              : 'Not Required'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Document' && liveShipment?.documentDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">Secure Document Details</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Envelope / Pouch Type</small>
                      <strong>{liveShipment.documentDetails.envelopeType}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Lock size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>Seal Number</small>
                      <strong className="font-mono">{liveShipment.documentDetails.sealNumber}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>Signature Requirement</small>
                      <strong>{liveShipment.documentDetails.directSignOnly ? 'Direct Signature Only' : 'Standard Signature'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Clock size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>Delivery Deadline</small>
                      <strong>{liveShipment.documentDetails.urgentDeadline || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card 2: Shipment Details (2-Column Icon Grid) */}
            <div className="shipment-details-spec-card">
              <div className="sdl-heading-with-units">
                <h3 className="card-section-title">Shipment summary</h3>
                <UnitToggle />
              </div>
              <div className="shipment-details-two-col-grid">
                {/* Row 1 */}
                <div className="detail-cell">
                  <FileText size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>Tracking Number</small>
                    <div className="tracking-with-copy">
                      <strong className="font-mono">{trackingNum}</strong>
                      <button
                        type="button"
                        onClick={handleCopyTrackingNumber}
                        className="inline-copy-btn"
                        title="Copy tracking number"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="detail-cell">
                  <MapPin size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>Origin</small>
                    <strong>
                      {originCity}, {originState}
                      <span className="gps-sub font-mono">
                        ({Number(routeCheckpoints[0].lat).toFixed(4)}, {Number(routeCheckpoints[0].lng).toFixed(4)})
                      </span>
                    </strong>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="detail-cell">
                  <Car size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>Cargo</small>
                    <strong>{cargoDescription}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <MapPin size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>Destination</small>
                    <strong>
                      {destCity}, {destState}
                      <span className="gps-sub font-mono">
                        ({Number(routeCheckpoints[2].lat).toFixed(4)}, {Number(routeCheckpoints[2].lng).toFixed(4)})
                      </span>
                    </strong>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="detail-cell">
                  <Scale size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>Weight</small>
                    <strong>{totalWeightText}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <Package size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>Service Level</small>
                    <strong>{service}</strong>
                  </div>
                </div>

                {/* Row 4 */}
                <div className="detail-cell">
                  <Box size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>Dimensions</small>
                    <strong>{dimensionsText || '—'}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <ShieldCheck size={18} className="dtl-icon text-emerald" />
                  <div className="dtl-cell-content">
                    <small>Status</small>
                    <strong className="status-highlight text-emerald">
                      <span className="mini-green-pulse" />
                      {statusDisplayLabel}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Pieces (CONTENT §6.3) — each piece label travels with the shipment. */}
            {(liveShipment?.pieces?.length ?? 0) > 0 && (
              <MultiPieceList
                pieces={liveShipment.pieces}
                statusLabel={statusDisplayLabel}
                locationText={currentLocationText}
              />
            )}

            {/* Card 3: Shipment Parties (Side-by-side Sender and Recipient) */}
            <div className="shipment-parties-card">
              <h3 className="card-section-title">Shipment Parties</h3>
              <div className="parties-two-col-layout">
                {/* Sender */}
                <div className="party-box sender-box">
                  <div className="party-header-tag">
                    <User size={15} className="text-blue" />
                    <span>From (Sender)</span>
                  </div>
                  <h4 className="party-name">{senderName}</h4>
                  {senderCompany && <p className="party-company">{senderCompany}</p>}
                  {senderAddress && <p className="party-address">{senderAddress}</p>}
                  <p className="party-city-state">{originCity}, {originState}{originZip ? ` ${originZip}` : ''}</p>
                  {senderPhone && (
                    <a href={`tel:${senderPhone.replace(/[^0-9+]/g, '')}`} className="party-phone-link font-mono">
                      <Phone size={13} />
                      <span>{senderPhone}</span>
                    </a>
                  )}
                  {senderEmail && (
                    <a href={`mailto:${senderEmail}`} className="party-email-link font-mono">
                      <Mail size={13} />
                      <span>{senderEmail}</span>
                    </a>
                  )}
                </div>

                {/* Recipient */}
                <div className="party-box recipient-box">
                  <div className="party-header-tag">
                    <User size={15} className="text-blue" />
                    <span>To (Recipient)</span>
                  </div>
                  <h4 className="party-name">{recipientName}</h4>
                  {recipientCompany && <p className="party-company">{recipientCompany}</p>}
                  {recipientAddress && <p className="party-address">{recipientAddress}</p>}
                  <p className="party-city-state">{destCity}, {destState}{destZip ? ` ${destZip}` : ''}</p>
                  {recipientPhone && (
                    <a href={`tel:${recipientPhone.replace(/[^0-9+]/g, '')}`} className="party-phone-link font-mono">
                      <Phone size={13} />
                      <span>{recipientPhone}</span>
                    </a>
                  )}
                  {recipientEmail && (
                    <a href={`mailto:${recipientEmail}`} className="party-email-link font-mono">
                      <Mail size={13} />
                      <span>{recipientEmail}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Special Handling — reads the real handlingRequirements this shipment
                was created with. This used to be three literal JSX strings ("Fragile: No",
                "Signature Required: Yes") that showed the same values for every shipment
                regardless of what was actually set, and never surfaced `oversized` at all. */}
            <div className="special-handling-card">
              <h3 className="card-section-title">Special Handling</h3>
              <div className="handling-items-row">
                <div className="handling-pill">
                  <span className="h-label">Fragile:</span>
                  <strong className={`h-val ${liveShipment?.handlingRequirements?.fragile ? 'text-amber' : ''}`}>
                    {liveShipment?.handlingRequirements?.fragile ? 'Yes' : 'No'}
                  </strong>
                </div>
                <div className="handling-pill">
                  <span className="h-label">Signature Required:</span>
                  <strong className={`h-val ${liveShipment?.handlingRequirements?.signatureRequired ? 'text-emerald' : ''}`}>
                    {liveShipment?.handlingRequirements?.signatureRequired ? 'Yes' : 'No'}
                  </strong>
                </div>
                {liveShipment?.handlingRequirements?.oversized && (
                  <div className="handling-pill">
                    <span className="h-label">Oversized:</span>
                    <strong className="h-val text-amber">Yes</strong>
                  </div>
                )}
                {isVehicle && (
                  <div className="handling-pill">
                    <span className="h-label">Vehicle Handling:</span>
                    <strong className="h-val">Standard No Liftgate Required</strong>
                  </div>
                )}
              </div>
              {liveShipment?.handlingRequirements?.otherInstructions && (
                <p className="text-xs text-slate-500" style={{ marginTop: '0.5rem' }}>{liveShipment.handlingRequirements.otherInstructions}</p>
              )}
            </div>

          </div>
        </section>

        {/* =========================================================================
            4. NEED HELP? (CONTENT §6.3 / §6.4)
            ========================================================================= */}
        <section className="sdl-help-banner-card">
          <div className="help-banner-left">
            <ResponsiveImage
              name="track-result-vehicle"
              alt="Lorry travelling along a highway beneath mountains at dusk"
              sizes="72px"
              className="help-banner-photo"
              imgClassName="help-banner-photo-img"
            />
            <div>
              <h3>Need help?</h3>
              <p>Our operations desk is available 24/7.</p>
            </div>
          </div>

          <div className="help-banner-actions">
            {supportPhone && (
              <a href={phoneHref} className="help-btn phone-btn accent-dispatch-btn">
                <Phone size={15} />
                <span>{supportPhone}</span>
              </a>
            )}
            <button className="help-btn contact-btn" onClick={() => setSupportOpen(true)} type="button">
              <Headphones size={15} />
              <span>Contact Support</span>
            </button>
          </div>
        </section>
      </div>

      {/* =========================================================================
          SUBSCRIBE TO ALERTS MODAL
          ========================================================================= */}
      {alertsModalOpen && (
        <div className="alerts-modal-overlay animate-fade-in" onClick={() => setAlertsModalOpen(false)}>
          <div className="alerts-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="alerts-modal-header">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-blue" />
                <h3>Get Delivery Alerts</h3>
              </div>
              <button className="modal-close-icon" onClick={() => setAlertsModalOpen(false)} type="button">×</button>
            </div>
            <p className="alerts-modal-sub">
              Receive automatic SMS or email notifications whenever consignment <strong>{trackingNum}</strong> reaches a major sort hub or departs for final delivery.
            </p>

            {alertSuccess ? (
              <div className="alerts-success-box animate-fade-in">
                <CheckCircle2 size={24} className="text-emerald" />
                <div>
                  <h4>Subscribed Successfully!</h4>
                  <p>You will receive live transit updates for this consignment.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubscribeAlerts} className="alerts-modal-form">
                <div className="form-group">
                  <label>Mobile Number (SMS Updates)</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="(555) 000-0000"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="you@company.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-confirm-alerts">
                  <span>Activate Live Alerts</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Support Dialog */}
      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialTrackingNumber={trackingNum}
      />
    </div>
  );
};
