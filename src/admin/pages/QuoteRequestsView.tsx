import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  Layers,
  FileText,
  DollarSign,
  Calendar,
  AlertTriangle,
  Send,
  Eye,
  Tag,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Lock,
  Truck
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { QuoteRequest, QuoteRequestStatus, QuoteRequestPricing } from '../../types/admin';
import './QuoteRequestsView.css';
import { MoneyInput } from '../../components/forms/UnitControls';
import { useCurrency } from '../../utils/useCurrency';
import { useUnitSystem } from '../../utils/useUnitSystem';
import { formatDimensions, formatWeight } from '../../shared/units';
import { TRANSPORT_MODE_LABELS } from '../../shared/transportMode';
import { SERVICE_OPTIONS } from '../../data/serviceOptions';

export const QuoteRequestsView: React.FC = () => {
  const { quoteRequests, publishQuote, updateQuoteStatus, convertQuoteToShipment, settings } = useAdminData();
  const money = useCurrency();
  const [units] = useUnitSystem();

  // The admin's "Quote Validity (Days)" setting only ever affected re-opening an already-
  // EXPIRED quote — the actual "publish a new quote" path below (both the default here and
  // handleSelectQuote's reset) had this same date hardcoded as a literal instead, so the
  // setting looked like it controlled quote expiry but silently didn't for the common case.
  const computeDefaultValidUntil = () => {
    const days = settings.quoteValidityDays || 14;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Selected quote for the review workspace
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Pricing Form State (Ultra-Simple Single Amount)
  const [finalPrice, setFinalPrice] = useState<number>(350);
  const [validUntilDate, setValidUntilDate] = useState<string>(computeDefaultValidUntil());
  const [internalNotes, setInternalNotes] = useState<string>('Oversized automotive part. Confirm packaging before shipment creation.');

  // Modal States
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);

  const selectedQuote = quoteRequests.find(q => q.id === selectedQuoteId);

  // Set pricing state when quote is selected
  const handleSelectQuote = (quote: QuoteRequest) => {
    setSelectedQuoteId(quote.id);
    if (quote.pricing) {
      setFinalPrice(quote.pricing.finalPrice || 350);
      setValidUntilDate(quote.pricing.validUntil || computeDefaultValidUntil());
    } else {
      setFinalPrice(350);
      setValidUntilDate(computeDefaultValidUntil());
    }
    setInternalNotes(quote.internalNotes || '');
  };

  // Search Filter
  const filteredQuotes = quoteRequests.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      q.id.toLowerCase().includes(term) ||
      q.requesterName.toLowerCase().includes(term) ||
      q.recipientName.toLowerCase().includes(term) ||
      q.requesterEmail.toLowerCase().includes(term) ||
      q.requesterPhone.toLowerCase().includes(term) ||
      q.originCity.toLowerCase().includes(term) ||
      q.destCity.toLowerCase().includes(term) ||
      q.cargoDescription.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    const matchesService = serviceFilter === 'ALL' || q.requestedService === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  // Snapshot KPIs — same at-a-glance stat row used across the other admin screens.
  const newPendingCount = quoteRequests.filter(q => q.status === 'NEW' || q.status === 'UNDER_REVIEW').length;
  const awaitingResponseCount = quoteRequests.filter(q => q.status === 'QUOTE_PUBLISHED' || q.status === 'RATE_PUBLISHED').length;
  const acceptedCount = quoteRequests.filter(q => q.status === 'ACCEPTED').length;

  // Handle Publish Quote
  const handleConfirmPublish = () => {
    if (!selectedQuote) return;
    const pricing: QuoteRequestPricing = {
      baseShipping: Number(finalPrice) || 0,
      oversizeHandling: 0,
      specialHandling: 0,
      finalPrice: Number(finalPrice) || 0,
      validUntil: validUntilDate
    };

    publishQuote(selectedQuote.id, pricing, internalNotes);
    setShowPublishConfirmModal(false);
    setSuccessToast(`Quote ${selectedQuote.id} published successfully for ${money.format(finalPrice)}!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Handle Convert to Shipment (Strict direct transition)
  const handleConvertShipment = async (quoteId: string) => {
    if (isConverting) return;
    setIsConverting(true);
    try {
      const createdShipment = await convertQuoteToShipment(quoteId);
      setSuccessToast(createdShipment
        ? `Accepted quote ${quoteId} converted directly to master shipment ${createdShipment.trackingNumber}!`
        : `Quote ${quoteId} could not be converted: the server did not confirm a tracking ID. Nothing was created; please try again.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } finally {
      setIsConverting(false);
    }
  };

  // Helper for Status Badge Styling
  const renderStatusBadge = (status: QuoteRequestStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="quote-status-badge badge-new">NEW</span>;
      case 'UNDER_REVIEW':
        return <span className="quote-status-badge badge-review">UNDER REVIEW</span>;
      case 'QUOTE_PUBLISHED':
        return <span className="quote-status-badge badge-published">QUOTE PUBLISHED</span>;
      case 'RATE_PUBLISHED':
        return <span className="quote-status-badge badge-published">RATE PUBLISHED</span>;
      case 'ACCEPTED':
        return <span className="quote-status-badge badge-accepted">ACCEPTED</span>;
      case 'DECLINED':
        return <span className="quote-status-badge badge-declined">DECLINED</span>;
      case 'EXPIRED':
        return <span className="quote-status-badge badge-expired">EXPIRED</span>;
      case 'CONVERTED':
        return <span className="quote-status-badge badge-converted">CONVERTED</span>;
      default:
        // Defensive fallback for any status value outside the known set (e.g. stale/legacy
        // data) — still renders a properly styled pill instead of unstyled plain text.
        return <span className="quote-status-badge badge-review">{String(status).replace(/_/g, ' ')}</span>;
    }
  };

  // Structured inches when the quote has them (converted to the viewer's units), otherwise the
  // stored display string of older quotes; '—' when nothing was given.
  const formatDims = (dims: any, structured?: QuoteRequest['dimensionsIn']) => {
    const inches = structured || (dims && typeof dims === 'object' ? dims : null);
    if (inches) return formatDimensions(inches, units) || '—';
    if (typeof dims === 'string' && dims.trim()) return dims;
    return '—';
  };

  return (
    <div className="ngf-quote-requests-workspace animate-fade-in">
      {successToast && (
        <div className="quote-toast-success animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{successToast}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW A: DETAIL WORKSPACE (If a quote is opened for review)
          ========================================================================= */}
      {selectedQuote ? (
        <div className="quote-detail-workspace animate-fade-in">
          {/* Top Bar Navigation */}
          <div className="detail-top-nav">
            <button className="back-to-list-btn" onClick={() => setSelectedQuoteId(null)}>
              <ArrowLeft size={16} />
              <span>Back to Quote Requests</span>
            </button>
            <div className="detail-id-cluster">
              <span className="detail-quote-id font-mono">{selectedQuote.id}</span>
              {renderStatusBadge(selectedQuote.status)}
            </div>
          </div>

          <div className="quote-split-layout">
            {/* LEFT COLUMN: REQUEST DETAILS */}
            <div className="quote-request-card">
              <div className="card-section-head">
                <FileText size={18} className="text-blue" />
                <div>
                  <h3>Customer Shipping Inquiry Details</h3>
                  <p>Inquiry submitted on {selectedQuote.submittedDate} via website portal.</p>
                </div>
              </div>

              {/* Visual Route Header */}
              <div className="route-visual-banner">
                <div className="route-node origin">
                  <span className="r-tag">ORIGIN</span>
                  <strong>{selectedQuote.originCity}, {selectedQuote.originState}</strong>
                  <small className="font-mono">{selectedQuote.originZip || '10001'}</small>
                </div>
                <div className="route-divider-arrow">
                  <div className="line" />
                  <ArrowRight size={18} className="arrow" />
                  <div className="line" />
                </div>
                <div className="route-node dest">
                  <span className="r-tag">DESTINATION</span>
                  <strong>{selectedQuote.destCity}, {selectedQuote.destState}</strong>
                  <small className="font-mono">{selectedQuote.destZip || '90071'}</small>
                </div>
              </div>

              {/* Sender & Recipient Grid */}
              <div className="parties-2col-grid">
                <div className="party-box">
                  <div className="p-header">
                    <User size={15} className="text-blue" />
                    <span className="p-role">REQUESTER / SENDER</span>
                  </div>
                  <strong className="party-name">{selectedQuote.requesterName}</strong>
                  {selectedQuote.requesterCompany && (
                    <div className="party-meta-row">
                      <Building size={13} className="text-slate" />
                      <span>{selectedQuote.requesterCompany}</span>
                    </div>
                  )}
                  <div className="party-meta-row">
                    <Mail size={13} className="text-slate" />
                    <span>{selectedQuote.requesterEmail}</span>
                  </div>
                  <div className="party-meta-row">
                    <Phone size={13} className="text-slate" />
                    <span>{selectedQuote.requesterPhone}</span>
                  </div>
                  {selectedQuote.requesterAddress && (
                    <div className="party-meta-row">
                      <MapPin size={13} className="text-slate" />
                      <span>{selectedQuote.requesterAddress}</span>
                    </div>
                  )}
                </div>

                <div className="party-box">
                  <div className="p-header">
                    <User size={15} className="text-emerald" />
                    <span className="p-role">DESTINATION RECIPIENT</span>
                  </div>
                  <strong className="party-name">{selectedQuote.recipientName}</strong>
                  {selectedQuote.recipientEmail && (
                    <div className="party-meta-row">
                      <Mail size={13} className="text-slate" />
                      <span>{selectedQuote.recipientEmail}</span>
                    </div>
                  )}
                  {selectedQuote.recipientPhone && (
                    <div className="party-meta-row">
                      <Phone size={13} className="text-slate" />
                      <span>{selectedQuote.recipientPhone}</span>
                    </div>
                  )}
                  {selectedQuote.recipientAddress && (
                    <div className="party-meta-row">
                      <MapPin size={13} className="text-slate" />
                      <span>{selectedQuote.recipientAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cargo & Physical Pieces Breakdown */}
              <div className="cargo-spec-section">
                <div className="spec-section-head">
                  <Package size={15} className="text-blue" />
                  <h4>Cargo Description & Payload Specifications</h4>
                </div>

                <div className="cargo-main-summary">
                  <div className="cargo-headline">
                    <span className="cargo-title">{selectedQuote.cargoDescription}</span>
                    <span className="cargo-type-pill font-mono">{selectedQuote.cargoType}</span>
                  </div>

                  <div className="cargo-metrics-strip">
                    <div className="metric-cell">
                      <span className="m-lbl">QUANTITY</span>
                      <strong>{selectedQuote.quantity} {selectedQuote.quantity === 1 ? 'Unit' : 'Units'}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">SCALE WEIGHT</span>
                      <strong>{formatWeight(selectedQuote.totalWeightLbs, units) || '—'}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">DIMENSIONS</span>
                      <strong className="font-mono">{formatDims(selectedQuote.dimensions, selectedQuote.dimensionsIn)}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">SERVICE TIER</span>
                      <strong className="text-blue">{selectedQuote.requestedService}{selectedQuote.transportMode ? ` · ${TRANSPORT_MODE_LABELS[selectedQuote.transportMode]}` : ''}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Special Requirements */}
              <div className="special-req-box">
                <span className="req-label">SPECIAL HANDLING & INSTRUCTIONS</span>
                <p className="req-text">
                  {selectedQuote.specialRequirements || 'None provided.'}
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: INTERNAL PRICING AREA (ULTRA-SIMPLE) */}
            <div className="quote-pricing-card">
              <div className="card-section-head pricing-head">
                <DollarSign size={18} className="text-emerald" />
                <div>
                  <h3>Set Shipping Price</h3>
                  <p>Determine the total price for this customer and set how long it is valid.</p>
                </div>
              </div>

              <div className="pricing-body">
                {/* Single Simple Price Input */}
                <div className="single-price-box">
                  <label className="price-box-label">TOTAL QUOTE PRICE ({money.currency})</label>
                  <div className="single-price-input-wrap">
                    <span className="price-dollar-sign">{money.symbol}</span>
                    <MoneyInput
                      step="0.01"
                      value={finalPrice}
                      onChange={v => setFinalPrice(v === '' ? 0 : v)}
                      className="single-price-input font-mono"
                    />
                  </div>
                  <small className="price-help-text">The exact all-inclusive amount the customer will pay.</small>
                </div>

                {/* Validity Date */}
                <div className="validity-input-box">
                  <label className="validity-label">
                    <Calendar size={13} className="text-blue" />
                    <span>QUOTE VALID UNTIL (EXPIRATION DATE)</span>
                  </label>
                  <input
                    type="text"
                    value={validUntilDate}
                    onChange={e => setValidUntilDate(e.target.value)}
                    placeholder="e.g. September 2, 2026"
                    className="validity-date-input"
                  />
                  <small className="validity-help-text">Guarantees this price until the selected date.</small>
                </div>

                {/* Internal Admin Notes (Private) */}
                <div className="internal-notes-area">
                  <div className="notes-head">
                    <Lock size={12} className="text-amber" />
                    <span>INTERNAL NOTES (PRIVATE TO ADMIN)</span>
                  </div>
                  <textarea
                    rows={3}
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    placeholder="Private remarks for operations..."
                    className="internal-notes-textarea"
                  />
                </div>

                {/* Lifecycle State Actions */}
                <div className="pricing-actions-footer">
                  {selectedQuote.status === 'NEW' || selectedQuote.status === 'UNDER_REVIEW' ? (
                    <div className="action-buttons-stack">
                      <button
                        className="btn-publish-quote-primary"
                        onClick={() => setShowPublishConfirmModal(true)}
                      >
                        <Send size={16} />
                        <span>Publish Final Quote ({money.format(finalPrice)})</span>
                      </button>
                      {selectedQuote.status === 'NEW' && (
                        <button
                          className="btn-review-status-secondary"
                          onClick={() => {
                            updateQuoteStatus(selectedQuote.id, 'UNDER_REVIEW');
                            setSuccessToast(`Quote ${selectedQuote.id} marked as Under Review.`);
                            setTimeout(() => setSuccessToast(null), 3000);
                          }}
                        >
                          <Clock size={14} />
                          <span>Mark as Under Review</span>
                        </button>
                      )}
                    </div>
                  ) : selectedQuote.status === 'QUOTE_PUBLISHED' || selectedQuote.status === 'RATE_PUBLISHED' ? (
                    <div className="published-state-box">
                      <div className="pub-status-alert">
                        <CheckCircle2 size={16} className="text-emerald" />
                        <div>
                          <strong>Quote Published: {money.format(selectedQuote.pricing?.finalPrice)}</strong>
                          <p>Valid until {selectedQuote.pricing?.validUntil}. Awaiting customer decision.</p>
                        </div>
                      </div>

                      <div className="decision-recorder-buttons">
                        <button
                          className="btn-record-accept"
                          onClick={() => {
                            updateQuoteStatus(selectedQuote.id, 'ACCEPTED');
                            setSuccessToast(`Recorded customer acceptance for quote ${selectedQuote.id}!`);
                            setTimeout(() => setSuccessToast(null), 3000);
                          }}
                        >
                          <Check size={14} />
                          <span>Record Customer Acceptance</span>
                        </button>
                        <button
                          className="btn-record-decline"
                          onClick={() => {
                            updateQuoteStatus(selectedQuote.id, 'DECLINED');
                            setSuccessToast(`Recorded quote ${selectedQuote.id} as declined.`);
                            setTimeout(() => setSuccessToast(null), 3000);
                          }}
                        >
                          <XCircle size={14} />
                          <span>Record Declined</span>
                        </button>
                      </div>
                    </div>
                  ) : selectedQuote.status === 'ACCEPTED' ? (
                    <div className="accepted-action-box">
                      <div className="accept-banner">
                        <CheckCircle2 size={18} className="text-emerald" />
                        <div>
                          <strong>Quote Accepted by Customer ({money.format(selectedQuote.pricing?.finalPrice)})</strong>
                          <p>Ready for physical shipment provisioning.</p>
                        </div>
                      </div>

                      <button
                        className="btn-convert-to-shipment"
                        onClick={() => handleConvertShipment(selectedQuote.id)}
                        disabled={isConverting}
                      >
                        <Truck size={17} />
                        <span>{isConverting ? 'Verifying Route & Converting…' : 'Create Shipment from Quote'}</span>
                      </button>
                    </div>
                  ) : selectedQuote.status === 'CONVERTED' ? (
                    <div className="converted-state-box">
                      <ShieldCheck size={20} className="text-blue" />
                      <div>
                        <strong>Consignment Active: <span className="font-mono text-blue">{selectedQuote.convertedShipmentId || selectedQuote.id}</span></strong>
                        <p>This quote was converted into an active master shipment.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="closed-state-box">
                      <span>Status: <strong>{selectedQuote.status}</strong></span>
                      <button
                        className="btn-reopen-quote"
                        onClick={() => updateQuoteStatus(selectedQuote.id, 'UNDER_REVIEW')}
                      >
                        <RotateCcw size={13} />
                        <span>Re-open Quote</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           VIEW B: MAIN QUOTE REQUESTS DIRECTORY & TABLE
           ========================================================================= */
        <div className="quotes-directory-view animate-fade-in">
          {/* Header */}
          <div className="quotes-page-header">
            <div className="header-title-block">
              <h2>Quote Requests</h2>
              <p>Review shipping inquiries, determine pricing, and manage customer quote requests.</p>
            </div>
          </div>

          {/* Snapshot KPI Row (matches Dashboard / Shipments visual language) */}
          <div className="qr-kpi-row">
            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon accent">
                  <Package size={15} />
                </div>
                <span className="qr-card-label">TOTAL REQUESTS</span>
              </div>
              <strong className="qr-card-number">{quoteRequests.length}</strong>
              <span className="qr-card-subtext">All-time inquiries</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className={`qr-circle-icon ${newPendingCount > 0 ? 'amber' : 'green'}`}>
                  <Clock size={15} />
                </div>
                <span className="qr-card-label">NEW / PENDING</span>
              </div>
              <strong className="qr-card-number">{newPendingCount}</strong>
              <span className="qr-card-subtext">Awaiting review</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon blue">
                  <Send size={15} />
                </div>
                <span className="qr-card-label">RATE PUBLISHED</span>
              </div>
              <strong className="qr-card-number">{awaitingResponseCount}</strong>
              <span className="qr-card-subtext">Awaiting customer</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon emerald">
                  <CheckCircle2 size={15} />
                </div>
                <span className="qr-card-label">ACCEPTED</span>
              </div>
              <strong className="qr-card-number">{acceptedCount}</strong>
              <span className="qr-card-subtext">Ready to convert</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="quotes-filter-bar">
            <div className="quote-search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="quote-search-input font-mono"
                placeholder="Search quote ID, applicant name, cargo, city, or route..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-selects-cluster">
              <div className="filter-unit">
                <label>Status:</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="QUOTE_PUBLISHED">Quote Published</option>
                  <option value="RATE_PUBLISHED">Rate Published</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="DECLINED">Declined</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CONVERTED">Converted</option>
                </select>
              </div>

              <div className="filter-unit">
                <label>Service:</label>
                <select
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Services</option>
                  {SERVICE_OPTIONS.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Master Table of Quote Requests */}
          <div className="quotes-table-card">
            <table className="quotes-master-table">
              <thead>
                <tr>
                  <th>QUOTE ID</th>
                  <th>PARTIES</th>
                  <th>CARGO DESCRIPTION</th>
                  <th>ROUTE</th>
                  <th>SPECS</th>
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                  <th className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-table-cell">
                      No quote requests match your current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map(quote => (
                    <tr
                      key={quote.id}
                      className={`quote-row-item ${quote.id === 'QR-2026-00124' ? 'flagship-row' : ''}`}
                      onClick={() => handleSelectQuote(quote)}
                    >
                      {/* Quote ID */}
                      <td>
                        <div className="id-cell">
                          <strong className="quote-id-txt font-mono">{quote.id}</strong>
                          {quote.id === 'QR-2026-00124' && <span className="flagship-pill">SAMPLE</span>}
                        </div>
                      </td>

                      {/* Parties */}
                      <td>
                        <div className="parties-cell">
                          <strong>{quote.requesterName}</strong>
                          <span className="sub-to">→ {quote.recipientName}</span>
                        </div>
                      </td>

                      {/* Cargo Description */}
                      <td>
                        <div className="cargo-cell">
                          <strong>{quote.cargoDescription}</strong>
                          <small className="cargo-type font-mono">{quote.cargoType}</small>
                        </div>
                      </td>

                      {/* Route */}
                      <td>
                        <div className="route-cell">
                          <span>{quote.originCity}, {quote.originState}</span>
                          <ArrowRight size={12} className="route-arr" />
                          <span>{quote.destCity}, {quote.destState}</span>
                        </div>
                      </td>

                      {/* Specs */}
                      <td>
                        <div className="specs-cell">
                          <strong>{formatWeight(quote.totalWeightLbs || (quote as any).weightLbs, units) || '—'}</strong>
                          <small className="font-mono">{formatDims(quote.dimensions, quote.dimensionsIn)}</small>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {renderStatusBadge(quote.status)}
                      </td>

                      {/* Date */}
                      <td>
                        <span className="date-cell">{quote.submittedDate}</span>
                      </td>

                      {/* Action */}
                      <td className="text-right" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-review-row"
                          onClick={() => handleSelectQuote(quote)}
                        >
                          <Eye size={13} />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Table Footer */}
            <div className="quotes-table-footer">
              <span>Showing <strong>{filteredQuotes.length}</strong> of <strong>{quoteRequests.length}</strong> quote inquiries</span>
              <span className="footer-sub">Private Pricing & Tariff Authority</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: PUBLISH QUOTE CONFIRMATION
          ========================================================================= */}
      {showPublishConfirmModal && selectedQuote && (
        <div className="quote-modal-backdrop" onClick={() => setShowPublishConfirmModal(false)}>
          <div className="quote-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Publish Quote?</h3>
              <button className="modal-close-btn" onClick={() => setShowPublishConfirmModal(false)}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="publish-confirm-body">
              <div className="confirm-summary-box">
                <div className="c-row">
                  <span>Quote Reference:</span>
                  <strong className="font-mono">{selectedQuote.id}</strong>
                </div>
                <div className="c-row">
                  <span>Customer:</span>
                  <strong>{selectedQuote.requesterName} ({selectedQuote.originCity} → {selectedQuote.destCity})</strong>
                </div>
                <div className="c-row highlight">
                  <span>Final Amount:</span>
                  <strong className="font-mono text-emerald">{money.format(finalPrice)} {money.currency}</strong>
                </div>
                <div className="c-row">
                  <span>Valid Until:</span>
                  <strong>{validUntilDate}</strong>
                </div>
              </div>

              <p className="publish-disclaimer">
                Once published, this quote will be available for customer acceptance through the company's chosen communication process.
              </p>
            </div>

            <div className="modal-actions-footer">
              <button className="btn-cancel" onClick={() => setShowPublishConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn-confirm-publish" onClick={handleConfirmPublish}>
                <Send size={15} />
                <span>Publish Quote</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
