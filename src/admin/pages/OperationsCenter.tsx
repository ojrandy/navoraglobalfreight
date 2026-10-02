import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Package,
  Eye,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Tag,
  Truck,
  TrendingUp,
  MapPin,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminViewType } from '../AdminLayout';
import { Shipment } from '../../types/shipment';
import './OperationsCenter.css';
import { WeightText } from '../../components/forms/UnitControls';
import { shipmentStatusLabel, shipmentStatusTone, type StatusTone } from '../../shared/shipmentStatus';
import { GATEWAYS } from '../../data/gateways';

// Badge colours per status family (names come from CONTENT §6.3).
const OPS_STATUS_CHIP: Record<StatusTone, { className: string; dot: string }> = {
  booked: { className: 'arrived', dot: 'slate' },
  transit: { className: 'in-transit', dot: 'blue' },
  out: { className: 'out-delivery', dot: 'amber' },
  delivered: { className: 'delivered', dot: 'green' },
  hold: { className: 'delayed', dot: 'red' },
  delayed: { className: 'delayed', dot: 'red' },
  returning: { className: 'delayed', dot: 'red' },
};

interface OperationsCenterProps {
  onSelectView: (view: AdminViewType) => void;
  onOpenShipmentDetail: (trackingNumber: string) => void;
  onQuickUpdateStatus: (shipment: Shipment) => void;
}

export const OperationsCenter: React.FC<OperationsCenterProps> = ({
  onSelectView,
  onOpenShipmentDetail,
  onQuickUpdateStatus
}) => {
  const { shipments, quoteRequests } = useAdminData();
  const [tableFilter, setTableFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'HELD'>('ALL');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Metrics calculation
  const totalShipmentsCount = shipments.length;
  const inTransitShipments = shipments.filter(s =>
    s.status === 'IN_TRANSIT' ||
    s.status === 'OUT_FOR_DELIVERY'
  );
  const inTransitCount = inTransitShipments.length;
  const deliveredCount = shipments.filter(s => s.status === 'DELIVERED').length;
  const exceptionCount = shipments.filter(s =>
    s.status === 'HELD' ||
    s.status === 'EXCEPTION' ||
    Boolean(s.delayNotice?.hasDelay)
  ).length;

  const totalPieces = shipments.reduce((acc, s) => {
    const piecesCount = Array.isArray(s.pieces) && s.pieces.length > 0 ? s.pieces.length : (s.totalPieces || 1);
    return acc + piecesCount;
  }, 0);

  const totalWeightLbs = shipments.reduce((acc, s) => {
    const w = parseFloat(String(s.totalWeightLbs || 0));
    return acc + (isNaN(w) ? 0 : w);
  }, 0);

  // Pending quotes awaiting tariff certification
  const pendingQuotes = quoteRequests.filter(q => q.status === 'NEW' || q.status === 'UNDER_REVIEW');

  // Filtered shipments for the main table
  const filteredShipments = shipments.filter(s => {
    // Status tab filter
    if (tableFilter === 'IN_TRANSIT') {
      const isTransit = s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY';
      if (!isTransit) return false;
    } else if (tableFilter === 'DELIVERED') {
      if (s.status !== 'DELIVERED') return false;
    } else if (tableFilter === 'HELD') {
      const isHeld = s.status === 'HELD' || s.status === 'EXCEPTION' || Boolean(s.delayNotice?.hasDelay);
      if (!isHeld) return false;
    }

    // Search query filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      const tracking = (s.trackingNumber || '').toLowerCase();
      const sender = typeof s.sender === 'object' ? (s.sender?.name || '').toLowerCase() : '';
      const recipient = typeof s.recipient === 'object' ? (s.recipient?.name || '').toLowerCase() : '';
      const origCity = typeof s.origin === 'object' ? (s.origin?.city || '').toLowerCase() : '';
      const destCity = typeof s.destination === 'object' ? (s.destination?.city || '').toLowerCase() : '';
      return tracking.includes(q) || sender.includes(q) || recipient.includes(q) || origCity.includes(q) || destCity.includes(q);
    }

    return true;
  });

  // Helper to format ETA cleanly into date and window
  const getEtaParts = (est: any, detail?: string) => {
    let dateStr = 'Scheduled';
    let timeStr = detail || 'Standard linehaul';
    if (typeof est === 'string' && est.trim()) {
      dateStr = est.trim();
    } else if (typeof est === 'object' && est) {
      dateStr = est.date || 'Scheduled';
      timeStr = est.timeWindow || detail || 'Standard linehaul';
    }
    dateStr = dateStr
      .replace('January', 'Jan')
      .replace('February', 'Feb')
      .replace('March', 'Mar')
      .replace('April', 'Apr')
      .replace('June', 'Jun')
      .replace('July', 'Jul')
      .replace('August', 'Aug')
      .replace('September', 'Sep')
      .replace('October', 'Oct')
      .replace('November', 'Nov')
      .replace('December', 'Dec');
    return { date: dateStr, time: timeStr };
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="ops-terminal-container">
      {/* ====================================================================
          1. NETWORK OPERATIONAL STATUS STRIP
         ==================================================================== */}
      <div className="ops-subhead-strip">
        <div className="subhead-left">
          <span className="live-status-pill">
            <span className="live-dot" />
            <span>Network Status: Optimal</span>
          </span>
          <span className="subhead-sep">·</span>
          <span className="subhead-text">{GATEWAYS.length} Gateways in Network</span>
        </div>
        <div className="subhead-right">
          <span className="subhead-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ====================================================================
          2. ENTERPRISE KPI METRIC CARDS (MATCHING SHIPMENTS PAGE)
         ==================================================================== */}
      <div className="ops-kpi-row">
        {/* Card 1: Active Shipments */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon accent">
              <Package size={15} />
            </div>
            <span className="ops-card-label">TOTAL CONSIGNMENTS</span>
          </div>
          <strong className="ops-card-number">{totalShipmentsCount}</strong>
          <span className="ops-card-subtext">Active Master Fleet · {totalPieces} pcs</span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D3070B" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#D3070B" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C25,36 40,24 60,30 C80,36 100,26 120,32 C135,36 145,18 160,32 L160,48 L0,48 Z"
                fill="url(#ops-spark-accent)"
              />
              <path
                d="M0,36 C25,36 40,24 60,30 C80,36 100,26 120,32 C135,36 145,18 160,32"
                fill="none"
                stroke="#D3070B"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: In Transit */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon blue">
              <Truck size={15} />
            </div>
            <span className="ops-card-label">IN TRANSIT</span>
          </div>
          <strong className="ops-card-number">{inTransitCount}</strong>
          <span className="ops-card-subtext">Active Linehaul Fleet</span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,38 C25,38 45,42 65,32 C85,22 105,38 125,32 C140,28 150,16 160,34 L160,48 L0,48 Z"
                fill="url(#ops-spark-blue)"
              />
              <path
                d="M0,38 C25,38 45,42 65,32 C85,22 105,38 125,32 C140,28 150,16 160,34"
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Pending Quotes */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('quote-requests')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className={`ops-circle-icon ${pendingQuotes.length > 0 ? 'amber' : 'green'}`}>
              <Tag size={15} />
            </div>
            <span className="ops-card-label">PENDING QUOTES</span>
          </div>
          <strong className="ops-card-number" style={{ color: pendingQuotes.length > 0 ? '#D3070B' : '#181818' }}>
            {pendingQuotes.length}
          </strong>
          <span className="ops-card-subtext">
            {pendingQuotes.length > 0 ? 'Commercial Review Required' : 'All Requests Certified'}
          </span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pendingQuotes.length > 0 ? '#D3070B' : '#10b981'} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={pendingQuotes.length > 0 ? '#D3070B' : '#10b981'} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36 L160,48 L0,48 Z"
                fill="url(#ops-spark-amber)"
              />
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36"
                fill="none"
                stroke={pendingQuotes.length > 0 ? '#D3070B' : '#10b981'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Exceptions & Holds */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon red">
              <AlertCircle size={15} />
            </div>
            <span className="ops-card-label">EXCEPTIONS & HOLDS</span>
          </div>
          <strong className="ops-card-number" style={{ color: exceptionCount > 0 ? '#dc2626' : '#181818' }}>
            {exceptionCount}
          </strong>
          <span className="ops-card-subtext">
            {exceptionCount > 0 ? 'Dispatcher Action Needed' : 'Zero Freight Holds Logged'}
          </span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C20,36 35,26 50,32 C70,26 85,34 105,30 C120,26 135,34 150,18 C155,22 158,32 160,34 L160,48 L0,48 Z"
                fill="url(#ops-spark-red)"
              />
              <path
                d="M0,36 C20,36 35,26 50,32 C70,26 85,34 105,30 C120,26 135,34 150,18 C155,22 158,32 160,34"
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. MAIN RECENT SHIPMENTS TABLE (MATCHING MASTER LEDGER DESIGN)
         ==================================================================== */}
      <div className="ops-section-card">
        <div className="ops-table-header-block">
          <div className="table-title-group">
            <div className="table-title-row">
              <h2 className="ops-section-title">Recent Shipments</h2>
              <span className="ops-shipment-count-pill">{filteredShipments.length} Active</span>
            </div>
          </div>

          <div className="table-controls-group">
            {/* Filter Tabs */}
            <div className="table-filter-tabs">
              <button
                className={`filter-tab-btn ${tableFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTableFilter('ALL')}
              >
                All ({totalShipmentsCount})
              </button>
              <button
                className={`filter-tab-btn ${tableFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setTableFilter('IN_TRANSIT')}
              >
                {shipmentStatusLabel('IN_TRANSIT')} ({inTransitCount})
              </button>
              <button
                className={`filter-tab-btn ${tableFilter === 'DELIVERED' ? 'active' : ''}`}
                onClick={() => setTableFilter('DELIVERED')}
              >
                Delivered ({deliveredCount})
              </button>
              {exceptionCount > 0 && (
                <button
                  className={`filter-tab-btn ${tableFilter === 'HELD' ? 'active' : ''}`}
                  onClick={() => setTableFilter('HELD')}
                >
                  {shipmentStatusLabel('ON_HOLD')} ({exceptionCount})
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="table-search-wrap">
              <Search size={13} className="table-search-icon" />
              <input
                type="text"
                placeholder="Search tracking, customer..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="table-search-input"
              />
            </div>

            {/* View Full Ledger Button */}
            <button
              className="ops-btn-secondary"
              onClick={() => onSelectView('all-shipments')}
            >
              All Shipments →
            </button>
          </div>
        </div>

        {totalShipmentsCount === 0 ? (
          <div className="ops-empty-panel">
            <Package size={36} className="empty-panel-icon" />
            <h4>No Consignments in Ledger</h4>
            <p>Zero shipments registered in the local fleet database.</p>
            <button
              className="ops-btn-primary"
              onClick={() => onSelectView('create-shipment')}
            >
              + Book New Shipment
            </button>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="ops-empty-panel">
            <Search size={32} className="empty-panel-icon" />
            <h4>No matching shipments found</h4>
            <p>{tableSearch ? `No consignments found matching "${tableSearch}".` : 'No shipments found with the selected status filter.'}</p>
            <button
              className="ops-btn-secondary"
              onClick={() => { setTableFilter('ALL'); setTableSearch(''); }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="ops-table-responsive">
            <table className="ops-data-table">
              <colgroup>
                <col style={{ width: '19%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>CONSIGNMENT</th>
                  <th>SERVICE</th>
                  <th>ROUTE</th>
                  <th>CUSTOMER</th>
                  <th>STATUS</th>
                  <th>EST. DELIVERY</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.slice(0, 8).map(shipment => {
                  const senderCity = typeof shipment.origin === 'object' ? shipment.origin?.city : 'Origin';
                  const senderState = typeof shipment.origin === 'object' ? shipment.origin?.state : '';
                  const destCity = typeof shipment.destination === 'object' ? shipment.destination?.city : 'Destination';
                  const destState = typeof shipment.destination === 'object' ? shipment.destination?.state : '';
                  const senderName = typeof shipment.sender === 'object' ? (shipment.sender?.name || shipment.sender?.company || 'Shipper') : (shipment.sender || 'Shipper');
                  const recipientName = typeof shipment.recipient === 'object' ? (shipment.recipient?.name || shipment.recipient?.company || 'Consignee') : (shipment.recipient || 'Consignee');
                  const piecesCount = Array.isArray(shipment.pieces) && shipment.pieces.length > 0 ? shipment.pieces.length : (shipment.totalPieces || 1);
                  const weight = shipment.totalWeightLbs || 0;
                  const eta = getEtaParts(shipment.estimatedDelivery, shipment.estimatedDeliveryDetail);
                  const serviceClean = (shipment.service || 'Standard').replace(' Express', '');
                  // Reflects whether the shipment is genuinely in transit right now — not
                  // whether an admin happened to have a live-ticking preview open (that
                  // feature no longer exists). A shipment moves at its real pace whether
                  // anyone's watching or not (server/progress.ts).
                  const isSimulating = shipment.status === 'IN_TRANSIT';

                  return (
                    <tr
                      key={shipment.trackingNumber}
                      className="ops-table-clickable-row"
                    >
                      {/* 1. CONSIGNMENT */}
                      <td>
                        <div className="ops-consignment-cell">
                          <div className="ops-mode-box" title={shipment.service}>
                            {shipment.service === 'Express' ? (
                              <Truck size={13} className="text-accent" />
                            ) : (
                              <Package size={13} className="text-slate" />
                            )}
                          </div>
                          <div className="ops-consignment-text">
                            <strong className="ops-tracking-code font-mono">{shipment.trackingNumber}</strong>
                            <span className="ops-specs-text">
                              {piecesCount} {piecesCount === 1 ? 'pc' : 'pcs'}{weight > 0 ? <> (<WeightText lbs={weight} />)</> : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. SERVICE */}
                      <td>
                        <span className={`ops-service-pill ${serviceClean.toLowerCase().replace(/\s+/g, '-')}`}>
                          {serviceClean}
                        </span>
                      </td>

                      {/* 3. ROUTE */}
                      <td>
                        <div className="ops-route-stack">
                          <span className="ops-route-origin">{senderCity}{senderState ? `, ${senderState}` : ''}</span>
                          <span className="ops-route-arrow">→</span>
                          <span className="ops-route-dest">{destCity}{destState ? `, ${destState}` : ''}</span>
                          <span className="ops-cargo-desc truncate" title={shipment.cargoDescription || shipment.shipmentType || 'Commercial Freight'}>
                            {shipment.cargoDescription || shipment.shipmentType || 'Commercial Freight'}
                          </span>
                        </div>
                      </td>

                      {/* 4. CUSTOMER */}
                      <td>
                        <div className="ops-customer-cell">
                          <strong className="ops-customer-name truncate" title={senderName}>{senderName}</strong>
                          <span className="ops-customer-consignee truncate" title={`to ${recipientName}`}>to {recipientName}</span>
                        </div>
                      </td>

                      {/* 5. STATUS */}
                      <td>
                        <span className={`ops-status-chip ${OPS_STATUS_CHIP[shipmentStatusTone(shipment.status)].className}`}>
                          <span className={`chip-dot ${OPS_STATUS_CHIP[shipmentStatusTone(shipment.status)].dot}`} /> {shipmentStatusLabel(shipment.status)}
                        </span>
                      </td>

                      {/* 6. EST. DELIVERY */}
                      <td>
                        <div className="ops-eta-cell">
                          <strong className="ops-eta-date">{eta.date}</strong>
                          <span className="ops-eta-subtext">{eta.time || 'Just now'}</span>
                        </div>
                      </td>

                      {/* 7. ACTIONS */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="ops-action-cluster">
                          <button
                            type="button"
                            className={`ops-control-btn ${isSimulating ? 'sim-active' : ''}`}
                            onClick={() => onQuickUpdateStatus(shipment)}
                            title="Operations Control"
                          >
                            <span className="control-dash">-</span>
                            <span>{isSimulating ? 'Moving' : 'Control'}</span>
                          </button>

                          <button
                            type="button"
                            className="ops-inspect-icon-btn"
                            onClick={() => onOpenShipmentDetail(shipment.trackingNumber)}
                            title="Inspect Consignment"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
