import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Undo2
} from 'lucide-react';
import { Shipment, TrackingEvent, ShipmentStatus } from '../../types/shipment';
import {
  applyHoldState,
  applyResumeState,
  applyDelayState,
  createAuditLogEntry
} from '../../services/planningEngine';
import { simulationEngine } from '../../services/simulationEngine';
import { ADMIN_ROLE_LABEL } from '../../config/brand';
import { shipmentStatusLabel } from '../../shared/shipmentStatus';
import { useAdminData } from '../../context/AdminDataContext';
import { resolveLocation } from '../../services/geocodingService';
import './ShipmentControlModal.css';

interface ShipmentControlModalProps {
  shipment: Shipment;
  onClose: () => void;
  onUpdateShipment: (updated: Shipment) => void;
  /** Called on every live simulation tick (play/pause/speed/scrub) — local-state-only,
   * distinct from onUpdateShipment which persists to the backend. Falls back to
   * onUpdateShipment if not provided. */
  onLiveUpdate?: (updated: Shipment) => void;
}

type ControlAction =
  | 'IN_TRANSIT'
  | 'AT_FACILITY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'ON_HOLD'
  | 'DELAY'
  | 'RETURN';

const STANDARD_HUBS = [
  { city: 'New York', state: 'NY', facility: 'New York Gateway Facility' },
  { city: 'Chicago', state: 'IL', facility: 'Chicago Regional Sort Facility' },
  { city: 'Dallas', state: 'TX', facility: 'Dallas Freight Intermodal Hub' },
  { city: 'Denver', state: 'CO', facility: 'Rocky Mountain Gateway' },
  { city: 'Atlanta', state: 'GA', facility: 'Atlanta Gateway Center' },
  { city: 'Los Angeles', state: 'CA', facility: 'Los Angeles Metro Sort Hub' }
];

export const ShipmentControlModal: React.FC<ShipmentControlModalProps> = ({
  shipment,
  onClose,
  onUpdateShipment,
  onLiveUpdate
}) => {
  const liveUpdate = onLiveUpdate || onUpdateShipment;
  // Determine initial action based on current shipment status
  const getInitialAction = (): ControlAction => {
    if (shipment.status === 'ON_HOLD') return 'ON_HOLD';
    if (shipment.status === 'DELIVERED') return 'DELIVERED';
    if (shipment.status === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
    if (shipment.status === 'AT_FACILITY') return 'AT_FACILITY';
    return 'IN_TRANSIT';
  };

  const [targetAction, setTargetAction] = useState<ControlAction>(getInitialAction());
  const [scrubValue, setScrubValue] = useState<number>(shipment.progressPercent ?? 35);

  // Contextual inputs
  const [selectedHub, setSelectedHub] = useState('Chicago, IL');
  const [customFacility, setCustomFacility] = useState('Chicago Regional Sort Facility');
  const [holdReason, setHoldReason] = useState('Severe Weather Condition');
  const [customHoldReason, setCustomHoldReason] = useState('');
  const [holdHours, setHoldHours] = useState(4);
  const [delayReason, setDelayReason] = useState('Road Congestion');
  const [delayHours, setDelayHours] = useState(4);
  const [returnReason, setReturnReason] = useState('Delivery Refused / Recipient Unavailable');
  const [signedBy, setSignedBy] = useState(
    typeof shipment.recipient === 'object' ? (shipment.recipient?.name || 'Authorized Recipient') : 'Authorized Recipient'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const { initiateReturn } = useAdminData();

  // Sync scrub value when shipment updates
  useEffect(() => {
    setScrubValue(shipment.progressPercent || 0);
  }, [shipment.progressPercent]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Instant preview only — the shipment already advances on its own, server-side, at its
  // real pace (server/progress.ts). This just jumps the LOCAL preview to a percentage for
  // testing/demo purposes (what does the page look like at 90%?); it doesn't persist unless
  // submitted below via "Update Status".
  const handleScrub = (val: number) => {
    setScrubValue(val);
    simulationEngine.scrubProgress(shipment, val, (updated) => liveUpdate(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // A return is created server-side as its own shipment with a new NGF ID (BRAND_GUIDE §7),
    // so both records are persisted; local state is updated from the server's response.
    if (targetAction === 'RETURN') {
      if (isSubmittingReturn) return;
      setIsSubmittingReturn(true);
      const result = await initiateReturn(shipment.trackingNumber, returnReason);
      setIsSubmittingReturn(false);
      if (!result.success) {
        setToastMsg(`Return not saved: ${result.error}`);
        return;
      }
      setToastMsg(`Return registered as ${result.returnTrackingNumber}`);
      setTimeout(() => onClose(), 1200);
      return;
    }

    let updated = { ...shipment };
    const now = new Date();
    const timestampStr =
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' +
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const originCity = typeof shipment.origin === 'object' ? shipment.origin?.city : shipment.origin;
    const originState = typeof shipment.origin === 'object' ? shipment.origin?.state : '';
    const destCity = typeof shipment.destination === 'object' ? shipment.destination?.city : shipment.destination;
    const destState = typeof shipment.destination === 'object' ? shipment.destination?.state : '';

    if (targetAction === 'IN_TRANSIT') {
      if (shipment.status === 'ON_HOLD') {
        const res = applyResumeState(updated, ADMIN_ROLE_LABEL);
        updated = res.updatedShipment;
      } else {
        const event: TrackingEvent = {
          id: `ev-${Date.now()}`,
          status: 'IN_TRANSIT',
          milestoneState: 'CONFIRMED',
          title: 'Departed Facility in Transit',
          location: `${originCity}, ${originState}`,
          facility: `${originCity} Terminal`,
          city: originCity,
          state: originState,
          timestamp: timestampStr,
          displayDate: timestampStr.split(' · ')[0],
          displayTime: timestampStr.split(' · ')[1],
          description: 'Shipment has departed the origin facility and is in linehaul transit.',
          isCompleted: true,
          isCurrent: true,
          recordedBy: ADMIN_ROLE_LABEL
        };
        const auditEntry = createAuditLogEntry(ADMIN_ROLE_LABEL, 'START_TRANSIT', 'Linehaul departure confirmed.');
        updated = {
          ...updated,
          status: 'IN_TRANSIT',
          statusText: shipmentStatusLabel('IN_TRANSIT'),
          progressPercent: Math.max(25, updated.progressPercent || 25),
          timeline: [event, ...(updated.timeline || []).map(t => ({ ...t, isCurrent: false }))],
          auditLog: [auditEntry, ...(updated.auditLog || [])],
          lastUpdated: 'Just now'
        };
      }
    } else if (targetAction === 'AT_FACILITY') {
      const parts = selectedHub.split(',');
      const city = parts[0]?.trim() || 'Chicago';
      const state = parts[1]?.trim() || 'IL';
      // Resolve the real coordinates for the selected hub instead of leaving currentLocation
      // as a bare "City, State" string with no coordinates — that's how a facility change
      // previously showed the right label while the map (and the DB) kept whatever
      // coordinates were last set, sometimes hundreds of miles from the named city.
      const hubGeo = resolveLocation(`${city}, ${state}`);
      const event: TrackingEvent = {
        id: `ev-${Date.now()}`,
        status: 'AT_FACILITY',
        milestoneState: 'CONFIRMED',
        title: `Arrived at ${city} Facility`,
        location: `${city}, ${state}`,
        facility: customFacility,
        city,
        state,
        timestamp: timestampStr,
        displayDate: timestampStr.split(' · ')[0],
        displayTime: timestampStr.split(' · ')[1],
        description: `Physical checkpoint scan confirmed at ${customFacility}.`,
        isCompleted: true,
        isCurrent: true,
        recordedBy: ADMIN_ROLE_LABEL
      };
      const auditEntry = createAuditLogEntry(ADMIN_ROLE_LABEL, 'CONFIRM_CHECKPOINT', `Arrived at ${customFacility}.`);
      updated = {
        ...updated,
        currentLocation: {
          city,
          state,
          lat: hubGeo?.lat,
          lng: hubGeo?.lng,
          facility: customFacility
        } as any,
        currentFacility: customFacility,
        status: 'AT_FACILITY',
        statusText: `${shipmentStatusLabel('AT_FACILITY')} (${[city, state].filter(Boolean).join(', ')})`,
        progressPercent: Math.min(85, Math.max(50, (updated.progressPercent || 30) + 20)),
        timeline: [event, ...(updated.timeline || []).map(t => ({ ...t, isCurrent: false }))],
        auditLog: [auditEntry, ...(updated.auditLog || [])],
        lastUpdated: 'Just now'
      };
    } else if (targetAction === 'OUT_FOR_DELIVERY') {
      const event: TrackingEvent = {
        id: `ev-${Date.now()}`,
        status: 'OUT_FOR_DELIVERY',
        milestoneState: 'CONFIRMED',
        title: 'Out for Final Delivery',
        location: `${destCity}, ${destState}`,
        facility: `${destCity} Local Depot`,
        city: destCity,
        state: destState,
        timestamp: timestampStr,
        displayDate: timestampStr.split(' · ')[0],
        displayTime: timestampStr.split(' · ')[1],
        description: 'With local courier for delivery today.',
        isCompleted: true,
        isCurrent: true,
        recordedBy: ADMIN_ROLE_LABEL
      };
      const auditEntry = createAuditLogEntry(ADMIN_ROLE_LABEL, 'OUT_FOR_DELIVERY', 'Dispatched for final-mile delivery.');
      updated = {
        ...updated,
        status: 'OUT_FOR_DELIVERY',
        statusText: shipmentStatusLabel('OUT_FOR_DELIVERY'),
        progressPercent: 90,
        // Reuse the destination's own already-geocoded coordinates — "out for delivery"
        // means the shipment is now at/near its destination, so currentLocation should
        // reflect that instead of staying wherever it was left by a previous checkpoint.
        currentLocation: {
          city: destCity,
          state: destState,
          lat: (shipment.destination as any)?.lat,
          lng: (shipment.destination as any)?.lng,
          facility: `${destCity} Local Depot`
        } as any,
        currentFacility: `${destCity} Local Depot`,
        timeline: [event, ...(updated.timeline || []).map(t => ({ ...t, isCurrent: false }))],
        auditLog: [auditEntry, ...(updated.auditLog || [])],
        lastUpdated: 'Just now'
      };
    } else if (targetAction === 'DELIVERED') {
      const event: TrackingEvent = {
        id: `ev-${Date.now()}`,
        status: 'DELIVERED',
        milestoneState: 'CONFIRMED',
        title: 'Shipment Delivered',
        location: `${destCity}, ${destState}`,
        facility: 'Recipient Address',
        city: destCity,
        state: destState,
        timestamp: timestampStr,
        displayDate: timestampStr.split(' · ')[0],
        displayTime: timestampStr.split(' · ')[1],
        description: `Delivered and signed by ${signedBy}.`,
        isCompleted: true,
        isCurrent: true,
        recordedBy: ADMIN_ROLE_LABEL
      };
      const auditEntry = createAuditLogEntry(ADMIN_ROLE_LABEL, 'DELIVERY_CONFIRMED', `Delivered to ${signedBy}.`);
      updated = {
        ...updated,
        status: 'DELIVERED',
        statusText: `${shipmentStatusLabel('DELIVERED')} (Signed by ${signedBy})`,
        progressPercent: 100,
        currentLocation: {
          city: destCity,
          state: destState,
          lat: (shipment.destination as any)?.lat,
          lng: (shipment.destination as any)?.lng,
          facility: 'Recipient Address'
        } as any,
        currentFacility: 'Recipient Address',
        timeline: [event, ...(updated.timeline || []).map(t => ({ ...t, isCurrent: false }))],
        auditLog: [auditEntry, ...(updated.auditLog || [])],
        lastUpdated: 'Just now'
      };
    } else if (targetAction === 'ON_HOLD') {
      const effectiveHoldReason = holdReason === 'OTHER' ? (customHoldReason.trim() || 'Other') : holdReason;
      const res = applyHoldState(updated, effectiveHoldReason, holdHours, ADMIN_ROLE_LABEL);
      updated = res.updatedShipment;
    } else if (targetAction === 'DELAY') {
      const res = applyDelayState(updated, delayReason, delayHours, ADMIN_ROLE_LABEL);
      updated = res.updatedShipment;
    }

    onUpdateShipment(updated);
    setToastMsg('Status updated successfully');
    setTimeout(() => onClose(), 600);
  };

  const originCity = typeof shipment.origin === 'object' ? shipment.origin?.city : shipment.origin;
  const originState = typeof shipment.origin === 'object' ? shipment.origin?.state : '';
  const destCity = typeof shipment.destination === 'object' ? shipment.destination?.city : shipment.destination;
  const destState = typeof shipment.destination === 'object' ? shipment.destination?.state : '';

  return (
    <div className="control-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="control-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="control-modal-top">
          <div className="modal-title-group">
            <span className="control-modal-tag">Operations Control</span>
            <div className="waybill-route-title">
              <strong className="tracking-id-text font-mono">{shipment.trackingNumber}</strong>
              <span className="bullet-dot">·</span>
              <span className="route-brief">
                {originCity}, {originState} <ArrowRight size={11} className="inline-arrow" /> {destCity}, {destState}
              </span>
            </div>
          </div>
          <button type="button" className="close-x-btn" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="control-modal-body">
          {/* Quick Progress Preview — the shipment already advances on its own, server-side,
              at its real promised pace. This slider is a one-shot local preview for testing/
              demos (jump straight to any percentage to see what the page looks like there);
              it only becomes real once submitted below via "Update Status". */}
          <div className="compact-progress-box">
            <div className="progress-top-row">
              <span className="progress-label">Corridor Transit Progress</span>
              <div className="progress-value-group">
                <span className="progress-pct-num font-mono">{Math.round(scrubValue)}%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={scrubValue}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="compact-slider"
            />
            <p className="scrub-hint-text">
              Drag to preview any point along the route — this shipment is already moving on
              its own in real time. To actually pause or delay it, use the status actions below.
            </p>
          </div>

          {/* Status Selection Pill Grid */}
          <div className="action-selection-section">
            <label className="section-label">Select Operational Status</label>
            <div className="status-pills-grid">
              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setTargetAction('IN_TRANSIT')}
              >
                <Truck size={14} />
                {/* Relabeled when the shipment is currently on hold so resuming it is an
                    obvious, unambiguous single action instead of looking like just another
                    generic status option — this is the actual "remove from hold" control. */}
                <span>{shipment.status === 'ON_HOLD' ? 'Resume Movement' : shipmentStatusLabel('IN_TRANSIT')}</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'AT_FACILITY' ? 'active' : ''}`}
                onClick={() => setTargetAction('AT_FACILITY')}
              >
                <MapPin size={14} />
                <span>Hub scan</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'OUT_FOR_DELIVERY' ? 'active' : ''}`}
                onClick={() => setTargetAction('OUT_FOR_DELIVERY')}
              >
                <Truck size={14} />
                <span>{shipmentStatusLabel('OUT_FOR_DELIVERY')}</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'DELIVERED' ? 'active' : ''}`}
                onClick={() => setTargetAction('DELIVERED')}
              >
                <CheckCircle2 size={14} />
                <span>{shipmentStatusLabel('DELIVERED')}</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'ON_HOLD' ? 'active' : ''}`}
                onClick={() => setTargetAction('ON_HOLD')}
              >
                <Clock size={14} />
                <span>{shipmentStatusLabel('ON_HOLD')}</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'DELAY' ? 'active' : ''}`}
                onClick={() => setTargetAction('DELAY')}
              >
                <AlertTriangle size={14} />
                <span>{shipmentStatusLabel('DELAYED')}</span>
              </button>

              <button
                type="button"
                className={`status-pill-btn ${targetAction === 'RETURN' ? 'active' : ''}`}
                onClick={() => setTargetAction('RETURN')}
              >
                <Undo2 size={14} />
                <span>{shipmentStatusLabel('RETURNED')}</span>
              </button>
            </div>
          </div>

          {/* Contextual Input Fields */}
          {targetAction === 'AT_FACILITY' && (
            <div className="contextual-field-box animate-fade-in">
              <label>Select Facility / Terminal Hub</label>
              <select
                className="clean-select"
                value={selectedHub}
                onChange={(e) => {
                  setSelectedHub(e.target.value);
                  const found = STANDARD_HUBS.find((h) => `${h.city}, ${h.state}` === e.target.value);
                  if (found) setCustomFacility(found.facility);
                }}
              >
                {STANDARD_HUBS.map((h) => (
                  <option key={`${h.city}-${h.state}`} value={`${h.city}, ${h.state}`}>
                    {h.city}, {h.state} — {h.facility}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetAction === 'ON_HOLD' && (
            <div className="contextual-field-box animate-fade-in">
              <div className="fields-row">
                <div className="sub-field">
                  <label>Hold Reason</label>
                  <select
                    className="clean-select"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                  >
                    <option value="Severe Weather Condition">Severe Weather</option>
                    <option value="Customer Request">Customer Request</option>
                    <option value="Documentation Pending">Documentation Review</option>
                    <option value="Vehicle Inspection">Maintenance Inspection</option>
                    <option value="OTHER">Other (specify reason)</option>
                  </select>
                </div>
                <div className="sub-field">
                  <label>Hold Duration</label>
                  <select
                    className="clean-select"
                    value={holdHours}
                    onChange={(e) => setHoldHours(parseInt(e.target.value, 10))}
                  >
                    <option value={2}>+2 Hours</option>
                    <option value={4}>+4 Hours</option>
                    <option value={8}>+8 Hours</option>
                    <option value={24}>+24 Hours</option>
                  </select>
                </div>
              </div>
              {holdReason === 'OTHER' && (
                <div className="sub-field">
                  <label>Custom Hold Reason</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={customHoldReason}
                    onChange={(e) => setCustomHoldReason(e.target.value)}
                    placeholder="e.g. Awaiting customs clearance"
                    maxLength={120}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {targetAction === 'DELAY' && (
            <div className="contextual-field-box animate-fade-in">
              <div className="fields-row">
                <div className="sub-field">
                  <label>Delay Cause</label>
                  <select
                    className="clean-select"
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                  >
                    <option value="Road Congestion">Road Congestion</option>
                    <option value="Weather Routing Deviation">Weather Highway Reroute</option>
                    <option value="Mechanical Maintenance">Vehicle Maintenance</option>
                  </select>
                </div>
                <div className="sub-field">
                  <label>Schedule Shift</label>
                  <select
                    className="clean-select"
                    value={delayHours}
                    onChange={(e) => setDelayHours(parseInt(e.target.value, 10))}
                  >
                    <option value={2}>+2 Hours</option>
                    <option value={4}>+4 Hours</option>
                    <option value={6}>+6 Hours</option>
                    <option value={12}>+12 Hours</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {targetAction === 'RETURN' && (
            <div className="contextual-field-box animate-fade-in">
              <label>Return Reason</label>
              <select
                className="clean-select"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              >
                <option value="Delivery Refused / Recipient Unavailable">Delivery Refused / Recipient Unavailable</option>
                <option value="Undeliverable Address">Undeliverable Address</option>
                <option value="Customer Requested Cancellation">Customer Requested Cancellation</option>
                <option value="Damaged in Transit">Damaged in Transit</option>
                <option value="Customs / Regulatory Hold">Customs / Regulatory Hold</option>
              </select>
            </div>
          )}

          {targetAction === 'DELIVERED' && (
            <div className="contextual-field-box animate-fade-in">
              <label>Signed by Recipient</label>
              <input
                type="text"
                className="clean-input"
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="e.g. John Anderson"
                required
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="control-modal-footer">
            {toastMsg && <span className="action-toast-inline font-mono">{toastMsg}</span>}
            <div className="footer-btns-cluster">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-save-update">
                Update Status
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
