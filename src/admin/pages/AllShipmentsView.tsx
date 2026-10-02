import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  Filter,
  Eye,
  Radio,
  FileCheck,
  FileText,
  MoreVertical,
  ArrowRight,
  X,
  CheckCircle2,
  Calendar,
  Truck,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  ArrowUpRight,
  Download,
  Copy,
  Check,
  Plane,
  AlertCircle,
  ShieldCheck,
  Tag,
  Edit3,
  Trash2
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { resolveLocation } from '../../services/geocodingService';
import { Shipment, ShipmentStatus } from '../../types/shipment';
import { EditShipmentModal } from '../components/EditShipmentModal';
import { DeleteShipmentModal } from '../components/DeleteShipmentModal';
import { RecentlyDeletedModal } from '../components/RecentlyDeletedModal';
import './AllShipmentsView.css';
import { WeightText } from '../../components/forms/UnitControls';
import { canonicalStatus, shipmentStatusLabel, shipmentStatusTone, type StatusTone } from '../../shared/shipmentStatus';

// Badge colours per status family (names come from CONTENT §6.3).
const STATUS_CHIP: Record<StatusTone, { className: string; dot: string }> = {
  booked: { className: 'default', dot: 'slate' },
  transit: { className: 'in-transit', dot: 'blue' },
  out: { className: 'out-delivery', dot: 'amber' },
  delivered: { className: 'delivered', dot: 'green' },
  hold: { className: 'delayed', dot: 'red' },
  delayed: { className: 'delayed', dot: 'red' },
  returning: { className: 'delayed', dot: 'red' },
};

interface AllShipmentsViewProps {
  onOpenShipmentDetail: (trackingNumber: string) => void;
  onQuickUpdateStatus: (shipment: Shipment) => void;
}

export const AllShipmentsView: React.FC<AllShipmentsViewProps> = ({
  onOpenShipmentDetail,
  onQuickUpdateStatus
}) => {
  const { shipments, createShipment, updateShipmentFull, deleteShipment } = useAdminData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editModalShipment, setEditModalShipment] = useState<Shipment | null>(null);
  const [deleteModalShipment, setDeleteModalShipment] = useState<Shipment | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);

  // New Shipment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderCity, setSenderCity] = useState('New York');
  const [senderState, setSenderState] = useState('NY');
  const [senderAddress, setSenderAddress] = useState('100 Broadway');
  const [recipientName, setRecipientName] = useState('');
  const [recipientCity, setRecipientCity] = useState('Los Angeles');
  const [recipientState, setRecipientState] = useState('CA');
  const [recipientAddress, setRecipientAddress] = useState('500 Grand Ave');
  const [service, setService] = useState<'Express' | 'Standard' | 'Priority' | 'Freight LTL'>('Express');
  const [shipmentType, setShipmentType] = useState<'Parcel' | 'Document' | 'Freight'>('Parcel');
  const [weight, setWeight] = useState('12.5');
  const [pieces, setPieces] = useState('2');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  const filteredShipments = shipments.filter(s => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (s.trackingNumber || '').toLowerCase().includes(term) ||
      (s.cargoDescription || '').toLowerCase().includes(term) ||
      (s.sender?.name || '').toLowerCase().includes(term) ||
      (s.recipient?.name || '').toLowerCase().includes(term) ||
      (s.origin?.city || (typeof s.origin === 'string' ? s.origin : '')).toLowerCase().includes(term) ||
      (s.destination?.city || (typeof s.destination === 'string' ? s.destination : '')).toLowerCase().includes(term);

    const code = canonicalStatus(s.status);
    const matchesStatus = statusFilter === 'ALL' || code === statusFilter || (statusFilter === 'DELAYED' && code === 'ON_HOLD');
    const matchesService = serviceFilter === 'ALL' || s.service === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  const getStatusBadge = (status: ShipmentStatus) => {
    const chip = STATUS_CHIP[shipmentStatusTone(status)];
    return (
      <span className={`ship-status-chip ${chip.className}`}>
        <span className={`chip-dot ${chip.dot}`} /> {shipmentStatusLabel(status)}
      </span>
    );
  };

  const formatEtaDate = (est: any) => {
    if (!est) return 'Scheduled';
    let dateStr = typeof est === 'string' ? est : (est?.date || 'Scheduled');
    return dateStr
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
  };

  const copyTracking = (num: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The server assigns the tracking ID; on failure nothing is added and the modal stays open.
    let newShip: Shipment;
    // The quick form has no country field; take it from the city/region entered.
    const originCountry = resolveLocation([senderCity, senderState].filter(Boolean).join(', '))?.country || '';
    const destCountry = resolveLocation([recipientCity, recipientState].filter(Boolean).join(', '))?.country || '';
    try {
      newShip = await createShipment({
        shipmentType,
        service,
        totalWeightLbs: parseFloat(weight) || 10,
        totalPieces: parseInt(pieces) || 1,
        origin: { city: senderCity, state: senderState, country: originCountry },
        destination: { city: recipientCity, state: recipientState, country: destCountry },
        sender: {
          name: senderName,
          city: senderCity,
          state: senderState,
          addressLine: senderAddress,
          country: originCountry
        },
        recipient: {
          name: recipientName,
          city: recipientCity,
          state: recipientState,
          addressLine: recipientAddress,
          country: destCountry
        },
        currentLocation: `${senderCity}, ${senderState}`,
        currentFacility: `${senderCity} Regional Gateway`,
        status: 'BOOKED',
        statusText: shipmentStatusLabel('BOOKED')
      });
    } catch (err: any) {
      setSuccessToast(`Could not register the shipment: ${err?.message || 'the server did not respond'}. Nothing was saved.`);
      setTimeout(() => setSuccessToast(null), 6000);
      return;
    }

    setSuccessToast(`Master Consignment ${newShip.trackingNumber} registered successfully!`);
    setShowCreateModal(false);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Metrics summary counts
  const totalCount = shipments.length;
  const inTransitCount = shipments.filter(s => canonicalStatus(s.status) === 'IN_TRANSIT').length;
  const arrivedCount = shipments.filter(s => s.status === 'DESTINATION_PROCESSING').length;
  const outDeliveryCount = shipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = shipments.filter(s => s.status === 'DELIVERED').length;
  const delayedCount = shipments.filter(s => s.status === 'DELAYED' || s.status === 'EXCEPTION' || s.status === 'ON_HOLD').length;

  return (
    <div className="ngf-shipments-page">
      {successToast && (
        <div className={`admin-toast-banner animate-fade-in${toastIsError ? ' toast-error' : ''}`}>
          {toastIsError ? <AlertCircle size={18} className="text-crimson" /> : <CheckCircle2 size={18} className="text-emerald" />}
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. TOP HEADER ROW */}
      <div className="shipments-top-header">
        <div className="header-info">
          <div className="header-title-row">
            <h2>Shipments Ledger</h2>
            <span className="shipments-count-pill">{filteredShipments.length} Active</span>
          </div>
        </div>

        <div className="header-actions-cluster">
          <button
            type="button"
            className="recently-deleted-btn"
            onClick={() => setShowTrashModal(true)}
            title="View and restore deleted shipments"
          >
            <Trash2 size={15} />
            <span>Recently Deleted</span>
          </button>
          <button
            type="button"
            className="create-shipment-cta-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>Book Consignment</span>
          </button>
        </div>
      </div>

      {/* 2. KPI SUMMARY CARDS (4 CARDS WITH SVG SPARKLINES) */}
      <div className="shipments-stat-strip">
        {/* Total Consignments */}
        <div
          className="stat-pill-card"
          onClick={() => setStatusFilter('ALL')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header">
            <div className="stat-circle-icon accent">
              <Package size={15} />
            </div>
            <span className="stat-label">TOTAL CONSIGNMENTS</span>
          </div>
          <strong className="stat-number">{totalCount}</strong>
          <span className="stat-subtext">Active Master Fleet</span>

          <div className="stat-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="spark-grad-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D3070B" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#D3070B" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C25,36 40,24 60,30 C80,36 100,26 120,32 C135,36 145,18 160,32 L160,48 L0,48 Z"
                fill="url(#spark-grad-accent)"
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

        {/* In Transit */}
        <div
          className="stat-pill-card"
          onClick={() => setStatusFilter('IN_TRANSIT')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header">
            <div className="stat-circle-icon blue">
              <Truck size={15} />
            </div>
            <span className="stat-label">IN TRANSIT</span>
          </div>
          <strong className="stat-number">{inTransitCount}</strong>
          <span className="stat-subtext">Active Linehaul</span>

          <div className="stat-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="spark-grad-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,38 C25,38 45,42 65,32 C85,22 105,38 125,32 C140,28 150,16 160,34 L160,48 L0,48 Z"
                fill="url(#spark-grad-blue)"
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

        {/* Out for Delivery */}
        <div
          className="stat-pill-card"
          onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header">
            <div className="stat-circle-icon green">
              <MapPin size={15} />
            </div>
            <span className="stat-label">OUT FOR DELIVERY</span>
          </div>
          <strong className="stat-number">{outDeliveryCount}</strong>
          <span className="stat-subtext">Final Mile Delivery</span>

          <div className="stat-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="spark-grad-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36 L160,48 L0,48 Z"
                fill="url(#spark-grad-green)"
              />
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Exceptions & Holds */}
        <div
          className="stat-pill-card"
          onClick={() => setStatusFilter('DELAYED')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header">
            <div className="stat-circle-icon red">
              <AlertCircle size={15} />
            </div>
            <span className="stat-label">DELAYED & ON HOLD</span>
          </div>
          <strong className="stat-number">{delayedCount}</strong>
          <span className="stat-subtext">{delayedCount === 0 ? 'Zero Holds' : 'Requires Intervention'}</span>

          <div className="stat-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="spark-grad-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C20,36 35,26 50,32 C70,26 85,34 105,30 C120,26 135,34 150,18 C155,22 158,32 160,34 L160,48 L0,48 Z"
                fill="url(#spark-grad-red)"
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

      {/* 3. SEARCH & ADVANCED FILTER TOOLBAR */}
      <div className="shipments-control-toolbar">
        <div className="toolbar-search-box">
          <Search size={15} className="search-ico" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search tracking #, shipper, consi..."
            className="search-input-field font-mono"
          />
          {searchTerm && (
            <button type="button" className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-filter-tabs">
          <button
            type="button"
            className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All <span className="tab-count-badge">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${statusFilter === 'IN_TRANSIT' ? 'active' : ''}`}
            onClick={() => setStatusFilter('IN_TRANSIT')}
          >
            {shipmentStatusLabel('IN_TRANSIT')} <span className="tab-count-badge">{inTransitCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${statusFilter === 'DESTINATION_PROCESSING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DESTINATION_PROCESSING')}
          >
            {shipmentStatusLabel('DESTINATION_PROCESSING')} <span className="tab-count-badge">{arrivedCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${statusFilter === 'OUT_FOR_DELIVERY' ? 'active' : ''}`}
            onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
          >
            {shipmentStatusLabel('OUT_FOR_DELIVERY')} <span className="tab-count-badge">{outDeliveryCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${statusFilter === 'DELIVERED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DELIVERED')}
          >
            Delivered <span className="tab-count-badge">{deliveredCount}</span>
          </button>
        </div>

        <div className="toolbar-service-select">
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="service-dropdown"
          >
            <option value="ALL">All Services</option>
            <option value="Express">Express</option>
            <option value="Priority">Priority</option>
            <option value="Standard">Standard</option>
            <option value="Freight LTL">Freight LTL</option>
          </select>
        </div>
      </div>

      {/* 4. MASTER CONSIGNMENT TABLE (7 COLUMNS, DARK NAVY HEADER) */}
      <div className="shipments-table-card">
        <div className="table-overflow-wrapper">
          <table className="master-data-table">
            <colgroup>
              <col style={{ width: '19%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '19%' }} />
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
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    <div className="empty-state-box">
                      <AlertCircle size={28} className="text-slate" />
                      <strong>No consignments match your filter criteria</strong>
                      <p>Try resetting the search or status filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredShipments.map(s => {
                  const piecesCount = Array.isArray(s.pieces) && s.pieces.length > 0 ? s.pieces.length : (s.totalPieces || 1);
                  const weight = s.totalWeightLbs || 0;
                  // Reflects whether the shipment is genuinely in transit right now — not,
                  // as this used to mean, whether an admin happened to have a live-ticking
                  // preview open. A shipment moves at its real pace whether anyone's watching
                  // or not (server/progress.ts), so "Moving" should be true for every viewer
                  // whenever that's actually happening, not just when someone's tab is open.
                  const isSimulating = s.status === 'IN_TRANSIT';
                  const originCity = typeof s.origin === 'object' ? s.origin?.city : s.origin;
                  const originState = typeof s.origin === 'object' ? s.origin?.state : '';
                  const destCity = typeof s.destination === 'object' ? s.destination?.city : s.destination;
                  const destState = typeof s.destination === 'object' ? s.destination?.state : '';
                  const senderName = typeof s.sender === 'object' ? (s.sender?.name || s.sender?.company || 'Shipper') : (s.sender || 'Shipper');
                  const recipientName = typeof s.recipient === 'object' ? (s.recipient?.name || s.recipient?.company || 'Consignee') : (s.recipient || 'Consignee');
                  const serviceClean = (s.service || 'Standard').replace(' Express', '');

                  return (
                    <tr key={s.trackingNumber} className="shipment-row">
                      {/* 1. CONSIGNMENT */}
                      <td>
                        <div className="consignment-col-cell">
                          <div className="consignment-mode-box" title={s.service}>
                            {s.service === 'Express' ? (
                              <Truck size={13} className="text-accent" />
                            ) : (
                              <Package size={13} className="text-slate" />
                            )}
                          </div>
                          <div className="consignment-text-wrap">
                            <strong className="consignment-code font-mono">{s.trackingNumber}</strong>
                            <span className="consignment-specs">
                              {piecesCount} {piecesCount === 1 ? 'pc' : 'pcs'}{weight > 0 ? <> (<WeightText lbs={weight} />)</> : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. SERVICE */}
                      <td>
                        <span className={`service-pill ${serviceClean.toLowerCase().replace(/\s+/g, '-')}`}>
                          {serviceClean}
                        </span>
                      </td>

                      {/* 3. ROUTE */}
                      <td>
                        <div className="route-col-cell">
                          <span className="route-origin">{originCity}{originState ? `, ${originState}` : ''}</span>
                          <span className="route-arrow-down">→</span>
                          <span className="route-dest">{destCity}{destState ? `, ${destState}` : ''}</span>
                          <span className="route-cargo-desc truncate" title={s.cargoDescription || s.shipmentType || 'Commercial Freight'}>
                            {s.cargoDescription || s.shipmentType || 'Commercial Freight'}
                          </span>
                        </div>
                      </td>

                      {/* 4. CUSTOMER */}
                      <td>
                        <div className="customer-col-cell">
                          <strong className="customer-name truncate" title={senderName}>{senderName}</strong>
                          <span className="customer-consignee truncate" title={`to ${recipientName}`}>to {recipientName}</span>
                        </div>
                      </td>

                      {/* 5. STATUS */}
                      <td>
                        {getStatusBadge(s.status)}
                      </td>

                      {/* 6. EST. DELIVERY */}
                      <td>
                        <div className="eta-col-cell">
                          <strong className="eta-date">{formatEtaDate(s.estimatedDelivery)}</strong>
                          <span className="eta-subtext">
                            {typeof s.lastUpdated === 'string' && s.lastUpdated ? s.lastUpdated : 'Just now'}
                          </span>
                        </div>
                      </td>

                      {/* 7. ACTIONS */}
                      <td className="action-cell" style={{ textAlign: 'right' }}>
                        <div className="action-button-cluster">
                          <button
                            type="button"
                            className={`control-pill-btn ${isSimulating ? 'sim-active' : ''}`}
                            title="Operations Control"
                            onClick={() => onQuickUpdateStatus(s)}
                          >
                            <span className="control-dash">-</span>
                            <span>{isSimulating ? 'Moving' : 'Control'}</span>
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn edit"
                            title="Edit Consignment"
                            onClick={() => setEditModalShipment(s)}
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn view"
                            title="View Full Shipment Manifest"
                            onClick={() => onOpenShipmentDetail(s.trackingNumber)}
                          >
                            <Eye size={13} />
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn delete"
                            title="Delete Consignment"
                            onClick={() => setDeleteModalShipment(s)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Stats */}
        <div className="table-card-footer">
          <span>Showing <strong>{filteredShipments.length}</strong> of <strong>{shipments.length}</strong> consignments</span>
          <span className="footer-system-text">
            <FileText size={13} className="carrier-archive-icon" />
            <span>Live Code 128 Carrier Archive</span>
          </span>
        </div>
      </div>

      {/* 5. CREATE NEW SHIPMENT MODAL */}
      {showCreateModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="admin-modal-card wide animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Package size={20} className="text-blue" />
                <div>
                  <h4>Provision New Master Consignment</h4>
                  <p>Register new physical waybill and issue tracking barcode</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="create-shipment-form">
              {/* Section 1: Shipper */}
              <div className="modal-form-section">
                <span className="section-title">1. Shipper / Origin Information</span>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Shipper Name *</label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="Shipper Full Name"
                    />
                  </div>
                  <div className="form-field">
                    <label>Origin City *</label>
                    <input
                      type="text"
                      required
                      value={senderCity}
                      onChange={e => setSenderCity(e.target.value)}
                      placeholder="New York"
                    />
                  </div>
                  <div className="form-field">
                    <label>Origin State *</label>
                    <input
                      type="text"
                      required
                      value={senderState}
                      onChange={e => setSenderState(e.target.value)}
                      placeholder="NY"
                    />
                  </div>
                </div>
                <div className="form-field full-width">
                  <label>Physical Street Address *</label>
                  <input
                    type="text"
                    required
                    value={senderAddress}
                    onChange={e => setSenderAddress(e.target.value)}
                    placeholder="100 Broadway, Suite 400"
                  />
                </div>
              </div>

              {/* Section 2: Consignee */}
              <div className="modal-form-section">
                <span className="section-title">2. Consignee / Destination Information</span>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Consignee Name *</label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Daniel Miller"
                    />
                  </div>
                  <div className="form-field">
                    <label>Destination City *</label>
                    <input
                      type="text"
                      required
                      value={recipientCity}
                      onChange={e => setRecipientCity(e.target.value)}
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div className="form-field">
                    <label>Destination State *</label>
                    <input
                      type="text"
                      required
                      value={recipientState}
                      onChange={e => setRecipientState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                </div>
                <div className="form-field full-width">
                  <label>Delivery Street Address *</label>
                  <input
                    type="text"
                    required
                    value={recipientAddress}
                    onChange={e => setRecipientAddress(e.target.value)}
                    placeholder="500 Grand Ave, Floor 12"
                  />
                </div>
              </div>

              {/* Section 3: Package Payload */}
              <div className="modal-form-section">
                <span className="section-title">3. Consignment Cargo & Service</span>
                <div className="form-grid-4">
                  <div className="form-field">
                    <label>Service Level</label>
                    <select value={service} onChange={e => setService(e.target.value as any)}>
                      <option value="Express">Express</option>
                      <option value="Priority">Priority</option>
                      <option value="Standard">Standard</option>
                      <option value="Freight LTL">Freight LTL</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Cargo Type</label>
                    <select value={shipmentType} onChange={e => setShipmentType(e.target.value as any)}>
                      <option value="Parcel">Parcel</option>
                      <option value="Document">Document</option>
                      <option value="Freight">Freight</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Total Scale Weight (lbs)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      placeholder="45.0"
                    />
                  </div>

                  <div className="form-field">
                    <label>Pieces Count</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={pieces}
                      onChange={e => setPieces(e.target.value)}
                      placeholder="2"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  <CheckCircle2 size={16} />
                  <span>Provision Master Consignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT SHIPMENT MODAL */}
      {editModalShipment && (
        <EditShipmentModal
          shipment={editModalShipment}
          onClose={() => setEditModalShipment(null)}
          onSave={async (updated) => {
            await updateShipmentFull(updated);
            setSuccessToast(`Consignment ${updated.trackingNumber} specifications updated.`);
            setTimeout(() => setSuccessToast(null), 4000);
          }}
        />
      )}

      {/* 7. DELETE CONFIRMATION MODAL */}
      {deleteModalShipment && (
        <DeleteShipmentModal
          shipment={deleteModalShipment}
          onClose={() => setDeleteModalShipment(null)}
          onConfirmDelete={async (trackingNumber) => {
            const result = await deleteShipment(trackingNumber);
            setDeleteModalShipment(null);
            setToastIsError(!result.success);
            setSuccessToast(result.success
              ? `Consignment ${trackingNumber} moved to Recently Deleted — restorable anytime.`
              : `Failed to delete ${trackingNumber}: ${result.error || 'server rejected the request'}. It has been restored.`);
            setTimeout(() => setSuccessToast(null), 6000);
          }}
        />
      )}

      {/* 8. RECENTLY DELETED (TRASH) MODAL */}
      {showTrashModal && (
        <RecentlyDeletedModal onClose={() => setShowTrashModal(false)} />
      )}
    </div>
  );
};
