import React, { useState } from 'react';
import {
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  User,
  Clock,
  Plus,
  Trash2,
  FileText,
  Copy,
  Check,
  Building,
  Layers,
  Car,
  Lock,
  Printer,
  ListChecks
} from 'lucide-react';
import { Barcode } from '../components/Barcode';
import { useAdminData } from '../context/AdminDataContext';
import { resolveAddressPrecise } from '../services/geocodingService';
import './ShipPage.css';
import { pieceLabel } from '../shared/trackingId';
import { shipmentStatusLabel } from '../shared/shipmentStatus';
import { COMPANY, COMPANY_SHORT } from '../config/brand';
import { SERVICE_OPTIONS, type ServiceOptionId } from '../data/serviceOptions';
import { documentTitle } from '../components/DocumentBrand';
import { CountrySelect } from '../components/forms/CountrySelect';
import { PhoneInput } from '../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../components/forms/UnitControls';
import { getCountry, postcodeLabel, regionLabel, shortRegion } from '../data/countries';
import { formatDimensions, formatWeight } from '../shared/units';
import { TRANSPORT_MODE_LABELS, type TransportMode } from '../shared/transportMode';
import { useCurrency } from '../utils/useCurrency';

interface ShipPageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

// Weight in pounds and dimensions in inches (canonical); the inputs show the viewer's units.
interface PieceItem {
  id: string;
  weight: number | '';
  length: number | '';
  width: number | '';
  height: number | '';
  description: string;
}

interface AddressFieldsProps {
  idPrefix: string;
  country: string;
  onCountry: (code: string) => void;
  city: string;
  onCity: (v: string) => void;
  region: string;
  onRegion: (v: string) => void;
  postcode: string;
  onPostcode: (v: string) => void;
  cityPlaceholder: string;
}

// Country first (searchable), then city, then the optional region and postcode for that country.
const AddressFields: React.FC<AddressFieldsProps> = (f) => (
  <>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-country`}>Country *</label>
      <CountrySelect id={`${f.idPrefix}-country`} value={f.country} onChange={f.onCountry} className="ngf-input" required />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-city`}>City *</label>
      <input id={`${f.idPrefix}-city`} type="text" required value={f.city} onChange={(e) => f.onCity(e.target.value)} className="ngf-input" placeholder={f.cityPlaceholder} />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-region`}>{regionLabel(f.country)} <span className="ngf-field-optional">(optional)</span></label>
      <input id={`${f.idPrefix}-region`} type="text" value={f.region} onChange={(e) => f.onRegion(e.target.value)} className="ngf-input" />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-postcode`}>{postcodeLabel(f.country)} <span className="ngf-field-optional">(optional)</span></label>
      <input id={`${f.idPrefix}-postcode`} type="text" value={f.postcode} onChange={(e) => f.onPostcode(e.target.value)} className="ngf-input font-mono" />
    </div>
  </>
);

// "Houston, TX" / "Lagos, Nigeria" for summaries
const placeText = (city: string, region: string, countryCode: string) =>
  [city, countryCode === 'US' ? region.trim().toUpperCase() : getCountry(countryCode)?.name].filter(Boolean).join(', ');

const PICKUP_WINDOWS = [
  'Today, 2:00 PM – 5:00 PM (local time)',
  'Tomorrow morning, 8:00 AM – 12:00 PM (local time)',
  'Tomorrow afternoon, 1:00 PM – 5:00 PM (local time)'
];

const DROP_OFF_LABEL = `Drop-off at a ${COMPANY_SHORT} gateway`;

const SERVICE_ICONS: Record<ServiceOptionId, React.ElementType> = {
  express: Clock,
  freight: Truck,
  vehicle: Car,
  vault: Lock
};

// CONTENT §7.3 steps
const STEP_TITLES = ['Sender & collection', 'Recipient & delivery', 'Pieces', 'Service & extras'];

// CONTENT §7.3 "How booking works": stage names, bodies from §2.3 (as on Services §3.5).
const BOOKING_STAGES = [
  { title: 'Booking', body: `Book online or with a coordinator. You get your 8-character ${COMPANY_SHORT} tracking ID and a barcode label for every piece straight away.` },
  { title: 'Gateway scan', body: 'We collect from your door, weigh and scan every piece at the origin gateway, and prepare the export and customs documents.' },
  { title: 'Linehaul & border crossing', body: 'Your cargo travels on the fastest suitable lane: air, ocean or road. Customs clearance and each transfer are logged live.' },
  { title: 'Proof of delivery', body: 'Final-mile delivery to the door, with a signed digital proof of delivery sent to you the moment it lands.' }
];

// CONTENT §7.3 next steps
const NEXT_STEPS = [
  'Print and attach a label to each piece',
  'Have the shipment ready at the collection time',
  'Track progress any time with your ID'
];

export const ShipPage: React.FC<ShipPageProps> = ({ onTrack, onNavigate }) => {
  const { createShipment, generateDocument } = useAdminData();
  const units = useUnitLabels();
  const money = useCurrency();

  // Multi-step form flow
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State - Sender (Origin)
  const [senderCompany, setSenderCompany] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderCountry, setSenderCountry] = useState('');
  const [senderCity, setSenderCity] = useState('');
  const [senderState, setSenderState] = useState('');
  const [senderZip, setSenderZip] = useState('');
  const [pickupType, setPickupType] = useState<'pickup' | 'dropoff'>('pickup');
  const [pickupWindow, setPickupWindow] = useState(PICKUP_WINDOWS[0]);

  // Form State - Recipient (Destination)
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Form State - Pieces (Clean, empty piece item)
  const [piecesList, setPiecesList] = useState<PieceItem[]>([
    {
      id: '01',
      weight: '',
      length: '',
      width: '',
      height: '',
      description: '',
    },
  ]);

  // Form State - Service (one of the four §7.1 services)
  const [selectedService, setSelectedService] = useState<ServiceOptionId>('express');
  // '' = let us recommend
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [declaredValue, setDeclaredValue] = useState<number | ''>('');
  const [requireSignature, setRequireSignature] = useState(true);
  const [saturdayDelivery, setSaturdayDelivery] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(false);
  const [generatedTracking, setGeneratedTracking] = useState('');
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Calculations
  const totalWeight = piecesList.reduce((acc, curr) => acc + (curr.weight === '' ? 0 : curr.weight), 0);
  const totalPieces = piecesList.length;

  const handleAddPiece = () => {
    const nextNum = (piecesList.length + 1).toString().padStart(2, '0');
    setPiecesList([
      ...piecesList,
      {
        id: nextNum,
        weight: '',
        length: '',
        width: '',
        height: '',
        description: '',
      },
    ]);
  };

  const handleRemovePiece = (index: number) => {
    if (piecesList.length > 1) {
      setPiecesList(piecesList.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePiece = <K extends keyof PieceItem>(index: number, field: K, val: PieceItem[K]) => {
    const updated = [...piecesList];
    updated[index] = { ...updated[index], [field]: val };
    setPiecesList(updated);
  };

  // Step Validation Logic
  const validateStep = (step: number): boolean => {
    setFormError(null);
    if (step === 1) {
      // State/region and postcode are optional (not every country has them).
      if (!senderContact.trim() || !senderPhone.trim() || !senderAddress.trim() || !senderCountry || !senderCity.trim()) {
        setFormError('Please fill out all required sender and pickup address fields (name, phone, street, country and city) before continuing.');
        return false;
      }
    } else if (step === 2) {
      if (!recipientContact.trim() || !recipientPhone.trim() || !recipientAddress.trim() || !recipientCountry || !recipientCity.trim()) {
        setFormError('Please fill out all required recipient fields (name, phone, street, country and city) before continuing.');
        return false;
      }
    } else if (step === 3) {
      for (const p of piecesList) {
        if (p.weight === '' || p.weight <= 0) {
          setFormError(`Each piece must have a valid scale weight (${units.weight}).`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const getServiceName = () =>
    (SERVICE_OPTIONS.find((s) => s.id === selectedService) || SERVICE_OPTIONS[0]).name;

  const collectionText = pickupType === 'pickup' ? pickupWindow : DROP_OFF_LABEL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setIsSubmitting(true);

    const originRegion = shortRegion(senderCountry, senderState);
    const destRegion = shortRegion(recipientCountry, recipientState);
    const originLabel = [senderCity.trim(), originRegion].filter(Boolean).join(', ');
    // Inches; 0 = side not given (shown as "—"), never an invented size.
    const dimensionsOf = (piece: PieceItem) => ({
      length: piece.length === '' ? 0 : piece.length,
      width: piece.width === '' ? 0 : piece.width,
      height: piece.height === '' ? 0 : piece.height
    });
    const party = (company: string, name: string, phone: string, street: string, city: string, region: string, postcode: string, countryCode: string) => ({
      company,
      name,
      phone,
      addressLine: street,
      city: city.trim(),
      state: shortRegion(countryCode, region),
      region: region.trim() || undefined,
      postalCode: postcode.trim() || undefined,
      country: getCountry(countryCode)?.name || '',
      countryCode
    });

    // Piece ids and labels (NGFxxxxx-NN) are stamped from the server-assigned ID in createShipment.
    const piecesFormatted = piecesList.map((p, idx) => ({
      id: '',
      pieceNumber: idx + 1,
      totalPieces: piecesList.length,
      trackingNumber: '',
      status: 'AWAITING_PICKUP' as const,
      statusText: shipmentStatusLabel('BOOKED'),
      currentLocation: originLabel,
      weightLbs: p.weight === '' ? 0 : p.weight,
      dimensions: dimensionsOf(p)
    }));

    // Coordinates for the route map, from the country-aware lookup (live geocoder when the
    // offline tables only have a guess). An address we can't place at all stops the booking.
    const [originGeo, destGeo] = await Promise.all([
      resolveAddressPrecise({ street: senderAddress, city: senderCity, region: senderState, countryCode: senderCountry }, getCountry(senderCountry)?.name),
      resolveAddressPrecise({ street: recipientAddress, city: recipientCity, region: recipientState, countryCode: recipientCountry }, getCountry(recipientCountry)?.name)
    ]);
    if (!originGeo || !destGeo) {
      const missing = !originGeo ? `${senderCity}, ${getCountry(senderCountry)?.name}` : `${recipientCity}, ${getCountry(recipientCountry)?.name}`;
      setFormError(`We couldn't find ${missing}. Check the city and country, then try again.`);
      setIsSubmitting(false);
      return;
    }

    // Register into persistent application state & backend database. The server assigns the
    // tracking ID; the confirmation and the BOL below use the one it returned.
    let newTrackingId: string;
    try {
      const created = await createShipment({
        status: 'AWAITING_PICKUP',
        statusText: shipmentStatusLabel('BOOKED'),
        statusMessage: `${shipmentStatusLabel('BOOKED')} · ${collectionText}`,
        health: 'ON_TRACK',
        progressPercent: 10,
        lastUpdated: 'Just now',
        createdAt: 'Today',
        service: getServiceName(),
        transportMode: transportMode || undefined,
        shipmentType: 'Parcel',
        cargoCategory: 'Commercial Goods',
        cargoDescription: piecesList[0]?.description || 'Commercial Express Consignment',
        totalWeightLbs: totalWeight,
        totalPieces: totalPieces,
        declaredValue: declaredValue === '' ? 0 : declaredValue,
        dimensions: dimensionsOf(piecesList[0]),
        origin: {
          city: senderCity.trim(),
          state: originRegion,
          country: getCountry(senderCountry)?.name || '',
          lat: originGeo.lat,
          lng: originGeo.lng
        },
        destination: {
          city: recipientCity.trim(),
          state: destRegion,
          country: getCountry(recipientCountry)?.name || '',
          lat: destGeo.lat,
          lng: destGeo.lng
        },
        currentLocation: originLabel,
        currentFacility: `${senderCity.trim()} Regional Gateway`,
        sender: party(senderCompany, senderContact, senderPhone, senderAddress, senderCity, senderState, senderZip, senderCountry),
        recipient: party(recipientCompany, recipientContact, recipientPhone, recipientAddress, recipientCity, recipientState, recipientZip, recipientCountry),
        estimatedDelivery: '2-3 Business Days',
        estimatedDeliveryDetail: 'by 5:00 PM',
        pieces: piecesFormatted,
        // Collection and extras chosen on the form, for the operations team.
        pickupWindow: collectionText,
        handlingRequirements: {
          signatureRequired: requireSignature,
          otherInstructions: [
            saturdayDelivery ? 'Weekend Delivery requested' : '',
            deliveryInstructions.trim()
          ].filter(Boolean).join('. ') || undefined
        }
      });
      newTrackingId = created.trackingNumber;
    } catch (err: any) {
      setFormError(`We couldn't register your shipment: ${err?.message || 'the server did not respond'}. Nothing was saved; please try again.`);
      setIsSubmitting(false);
      return;
    }
    setGeneratedTracking(newTrackingId);

    // Auto-generate Master Record in Document Center
    generateDocument({
      docType: 'BOL',
      title: `${documentTitle('BOL', transportMode || undefined)} (${newTrackingId})`,
      shipmentTracking: newTrackingId,
      senderName: senderContact,
      senderCompany: senderCompany,
      senderAddress: senderAddress,
      senderCity: senderCity,
      senderState: originRegion,
      senderZip: senderZip,
      senderPhone: senderPhone,
      recipientName: recipientContact,
      recipientCompany: recipientCompany,
      recipientAddress: recipientAddress,
      recipientCity: recipientCity,
      recipientState: destRegion,
      recipientZip: recipientZip,
      recipientPhone: recipientPhone,
      cargoDescription: piecesList[0]?.description || 'Commercial Express Consignment',
      shipmentType: 'Parcel',
      service: getServiceName(),
      weightLbs: totalWeight,
      pieces: totalPieces,
      // Documents keep the canonical unit (inches)
      dimensions: formatDimensions(piecesList[0], 'imperial'),
      declaredValue: declaredValue === '' ? 0 : declaredValue,
      // No price yet: the coordinator confirms the rate (charges are added in the Document Center).
      bolSpecialInstructions: [saturdayDelivery ? 'Weekend Delivery requested' : '', deliveryInstructions.trim()].filter(Boolean).join('. ') || undefined
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedBooking(true);
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }, 600);
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(generatedTracking);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <div className="ngf-page-ship">
      {/* =========================================================================
          1. CINEMATIC HERO SECTION
          ========================================================================= */}
      <section className="ngf-ship-hero">
        <div className="ngf-ship-hero-bg" />
        <div className="ngf-container-wide ship-hero-container">
          <nav className="ngf-ship-breadcrumbs" aria-label="Breadcrumb">
            <a href="#/" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="crumb-link">Home</a>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">Book a shipment</span>
          </nav>

          <h1 className="ship-hero-title animate-fade-in">Book a shipment</h1>
        </div>
      </section>

      {/* =========================================================================
          2. MAIN FORM CONTAINER & STICKY LIVE SUMMARY
          ========================================================================= */}
      <div className="ngf-container-wide ngf-ship-workspace">
        {submittedBooking ? (
          /* BOOKING CONFIRMATION SCREEN */
          <div className="ngf-booking-confirmed-card animate-fade-in">
            <div className="confirm-header" role="status">
              <CheckCircle2 size={56} className="confirm-check-icon text-emerald" />
              <h2>Shipment booked</h2>
              <p>
                Your tracking ID is <strong className="font-mono">{generatedTracking}</strong>. Labels for each piece are ready to print.
              </p>
            </div>

            {/* Tracking ID and piece labels: this block is what "Print labels" prints. */}
            <div className="ship-print-labels">
            <div className="confirm-barcode-block">
              <div className="barcode-block-header">
                <span className="barcode-tag">{COMPANY}</span>
                <span className="barcode-service">{getServiceName()}</span>
              </div>

              <div className="barcode-render-stage">
                <Barcode
                  value={generatedTracking}
                  height={55}
                  width={1.6}
                  fontSize={14}
                  displayValue={true}
                />
              </div>

              <div className="barcode-block-meta">
                <div><strong>Route:</strong> {placeText(senderCity, senderState, senderCountry)} → {placeText(recipientCity, recipientState, recipientCountry)}</div>
                <div><strong>Pieces:</strong> {totalPieces} ({formatWeight(totalWeight, units.system)} gross)</div>
                {transportMode && <div><strong>Mode:</strong> {TRANSPORT_MODE_LABELS[transportMode]}</div>}
                <div><strong>Collection:</strong> {collectionText}</div>
              </div>
            </div>

            {/* Piece Barcodes List */}
            <div className="confirm-pieces-grid">
              {piecesList.map((piece, idx) => (
                <div key={piece.id} className="confirm-piece-card">
                  <div className="piece-card-header">
                    <span className="font-bold">Piece {idx + 1} of {piecesList.length}</span>
                    <small>{[formatWeight(piece.weight, units.system), formatDimensions(piece, units.system)].filter(Boolean).join(' • ')}</small>
                  </div>
                  <div className="piece-barcode-render">
                    <Barcode
                      value={pieceLabel(generatedTracking, idx + 1)}
                      height={32}
                      width={1.1}
                      fontSize={10}
                      displayValue={true}
                    />
                  </div>
                </div>
              ))}
            </div>
            </div>

            {/* Next steps (CONTENT §7.3); the collection-time step applies to collections only */}
            <div className="confirm-instructions-card">
              <div className="inst-icon"><ListChecks size={20} className="text-accent flex-shrink-0" /></div>
              <div>
                <h4>Next steps</h4>
                <ul className="ship-next-steps">
                  {NEXT_STEPS.filter((step, i) => i !== 1 || pickupType === 'pickup').map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="confirm-action-row">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print labels</span>
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={() => onTrack(generatedTracking)}
              >
                <span>Track a Shipment</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={handleCopyTracking}
              >
                {copiedTracking ? (
                  <>
                    <Check size={16} className="text-emerald" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy tracking ID</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={() => {
                  setSubmittedBooking(false);
                  setTransportMode('');
                  setCurrentStep(1);
                }}
              >
                <span>Book another shipment</span>
              </button>
            </div>
          </div>
        ) : (
          /* MULTI-STEP BOOKING FORM + STICKY SIDEBAR */
          <div className="ngf-ship-grid">
            {/* Left Column: Multi-Section Form */}
            <div className="ngf-ship-main-form">
              {/* Unified Responsive Step Stepper */}
              <div className="form-steps-nav">
                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
                  onClick={() => setCurrentStep(1)}
                >
                  <span className="step-num">{currentStep > 1 ? '✓' : '1'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[0]}</span>
                    <span className="step-sub">{senderCity ? placeText(senderCity, senderState, senderCountry) : 'From'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
                  onClick={() => validateStep(1) && setCurrentStep(2)}
                >
                  <span className="step-num">{currentStep > 2 ? '✓' : '2'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[1]}</span>
                    <span className="step-sub">{recipientCity ? placeText(recipientCity, recipientState, recipientCountry) : 'To'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
                  onClick={() => validateStep(1) && validateStep(2) && setCurrentStep(3)}
                >
                  <span className="step-num">{currentStep > 3 ? '✓' : '3'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[2]}</span>
                    <span className="step-sub">{[`${totalPieces} ${totalPieces === 1 ? 'piece' : 'pieces'}`, formatWeight(totalWeight, units.system)].filter(Boolean).join(' · ')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 4 ? 'active' : ''}`}
                  onClick={() => validateStep(1) && validateStep(2) && validateStep(3) && setCurrentStep(4)}
                >
                  <span className="step-num">4</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[3]}</span>
                    <span className="step-sub">{getServiceName()}</span>
                  </div>
                </button>
              </div>

              {/* Mobile Real-Time Step Progress Indicator */}
              <div className="mobile-step-summary-bar">
                <div className="mobile-step-text">
                  <span className="step-badge-mini">{currentStep}/4</span>
                  <strong>
                    {STEP_TITLES[currentStep - 1]}
                  </strong>
                </div>
                <div className="mobile-step-track">
                  <div className="mobile-step-fill" style={{ width: `${(currentStep / 4) * 100}%` }} />
                </div>
              </div>

              {/* Error Notice */}
              {formError && (
                <div className="form-validation-error animate-fade-in">
                  <FileText size={18} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: ORIGIN & SENDER */}
              {currentStep === 1 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><User size={20} /></div>
                    <div>
                      <h3>1. {STEP_TITLES[0]}</h3>
                    </div>
                  </div>

                  <div className="form-fields-grid">
                    <div className="form-group span-2">
                      <label htmlFor="ship-sender-company">Company <span className="ngf-field-optional">(optional)</span></label>
                      <input
                        id="ship-sender-company"
                        type="text"
                        value={senderCompany}
                        onChange={(e) => setSenderCompany(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ship-sender-name">Sender name *</label>
                      <input
                        id="ship-sender-name"
                        type="text"
                        required
                        value={senderContact}
                        onChange={(e) => setSenderContact(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="sender-phone">Phone *</label>
                      <PhoneInput id="sender-phone" required value={senderPhone} onChange={setSenderPhone} defaultCountry={senderCountry || 'US'} className="ngf-input" />
                    </div>

                    <div className="form-group span-2">
                      <label htmlFor="ship-sender-address">Street address *</label>
                      <input
                        id="ship-sender-address"
                        type="text"
                        required
                        value={senderAddress}
                        onChange={(e) => setSenderAddress(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <AddressFields
                      idPrefix="sender"
                      country={senderCountry}
                      onCountry={setSenderCountry}
                      city={senderCity}
                      onCity={setSenderCity}
                      region={senderState}
                      onRegion={setSenderState}
                      postcode={senderZip}
                      onPostcode={setSenderZip}
                      cityPlaceholder="e.g. Lagos"
                    />
                  </div>

                  {/* Collection or drop-off */}
                  <div className="tender-mode-wrap">
                    <span className="section-sublabel" id="ship-collection-label">Collection</span>
                    <div className="tender-toggle-row" role="radiogroup" aria-labelledby="ship-collection-label">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pickupType === 'pickup'}
                        className={`tender-card ${pickupType === 'pickup' ? 'selected' : ''}`}
                        onClick={() => setPickupType('pickup')}
                      >
                        <Truck size={22} className="text-accent" />
                        <div>
                          <strong>Book a Collection</strong>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={pickupType === 'dropoff'}
                        className={`tender-card ${pickupType === 'dropoff' ? 'selected' : ''}`}
                        onClick={() => setPickupType('dropoff')}
                      >
                        <Building size={22} className="text-accent" />
                        <div>
                          <strong>{DROP_OFF_LABEL}</strong>
                        </div>
                      </button>
                    </div>

                    {pickupType === 'pickup' && (
                      <div className="pickup-window-select">
                        <label htmlFor="ship-collection-window">Collection time</label>
                        <select
                          id="ship-collection-window"
                          value={pickupWindow}
                          onChange={(e) => setPickupWindow(e.target.value)}
                          className="ngf-input"
                        >
                          {PICKUP_WINDOWS.map((w) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-step-actions">
                    <button
                      type="button"
                      className="btn-corp-primary"
                      onClick={handleNextStep}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DESTINATION & RECIPIENT */}
              {currentStep === 2 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><MapPin size={20} /></div>
                    <div>
                      <h3>2. {STEP_TITLES[1]}</h3>
                    </div>
                  </div>

                  <div className="form-fields-grid">
                    <div className="form-group span-2">
                      <label htmlFor="ship-recipient-company">Company <span className="ngf-field-optional">(optional)</span></label>
                      <input
                        id="ship-recipient-company"
                        type="text"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ship-recipient-name">Recipient name *</label>
                      <input
                        id="ship-recipient-name"
                        type="text"
                        required
                        value={recipientContact}
                        onChange={(e) => setRecipientContact(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="recipient-phone">Phone *</label>
                      <PhoneInput id="recipient-phone" required value={recipientPhone} onChange={setRecipientPhone} defaultCountry={recipientCountry || senderCountry || 'US'} className="ngf-input" />
                    </div>

                    <div className="form-group span-2">
                      <label htmlFor="ship-recipient-address">Street address *</label>
                      <input
                        id="ship-recipient-address"
                        type="text"
                        required
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <AddressFields
                      idPrefix="recipient"
                      country={recipientCountry}
                      onCountry={setRecipientCountry}
                      city={recipientCity}
                      onCity={setRecipientCity}
                      region={recipientState}
                      onRegion={setRecipientState}
                      postcode={recipientZip}
                      onPostcode={setRecipientZip}
                      cityPlaceholder="e.g. London"
                    />

                    <div className="form-group span-2">
                      <label htmlFor="ship-delivery-instructions">Delivery instructions <span className="ngf-field-optional">(optional)</span></label>
                      <input
                        id="ship-delivery-instructions"
                        type="text"
                        value={deliveryInstructions}
                        onChange={(e) => setDeliveryInstructions(e.target.value)}
                        className="ngf-input"
                      />
                    </div>
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="btn-corp-ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      className="btn-corp-primary"
                      onClick={handleNextStep}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: MULTI-PIECE CONSIGNMENT BUILDER */}
              {currentStep === 3 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><Layers size={20} /></div>
                    <div className="sec-title-wrap">
                      <div>
                        <h3>3. {STEP_TITLES[2]}</h3>
                        <UnitToggle className="ship-unit-toggle" />
                      </div>
                      <button
                        type="button"
                        className="add-piece-btn"
                        onClick={handleAddPiece}
                      >
                        <Plus size={15} /> Add a piece
                      </button>
                    </div>
                  </div>

                  <div className="pieces-builder-list">
                    {piecesList.map((piece, index) => (
                      <div key={index} className="piece-builder-row">
                        <div className="piece-badge-col">
                          <span className="p-badge font-mono">#{piece.id}</span>
                          {piecesList.length > 1 && (
                            <button
                              type="button"
                              className="p-delete-btn"
                              onClick={() => handleRemovePiece(index)}
                              title="Remove this piece"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="piece-inputs-col">
                          <div className="piece-dim-grid">
                            <div className="p-field">
                              <label htmlFor={`piece-${index}-weight`}>Weight ({units.weight}) *</label>
                              <MeasureInput
                                id={`piece-${index}-weight`}
                                kind="weight"
                                step="0.1"
                                min="0.1"
                                required
                                value={piece.weight}
                                onChange={(v) => handleUpdatePiece(index, 'weight', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-length`}>Length ({units.length})</label>
                              <MeasureInput
                                id={`piece-${index}-length`}
                                kind="length"
                                min="0"
                                value={piece.length}
                                onChange={(v) => handleUpdatePiece(index, 'length', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-width`}>Width ({units.length})</label>
                              <MeasureInput
                                id={`piece-${index}-width`}
                                kind="length"
                                min="0"
                                value={piece.width}
                                onChange={(v) => handleUpdatePiece(index, 'width', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-height`}>Height ({units.length})</label>
                              <MeasureInput
                                id={`piece-${index}-height`}
                                kind="length"
                                min="0"
                                value={piece.height}
                                onChange={(v) => handleUpdatePiece(index, 'height', v)}
                                className="ngf-input"
                              />
                            </div>
                          </div>

                          <div className="p-field-desc">
                            <label htmlFor={`ship-piece-${index}-contents`}>Contents <span className="ngf-field-optional">(optional)</span></label>
                            <input
                              id={`ship-piece-${index}-contents`}
                              type="text"
                              value={piece.description}
                              onChange={(e) => handleUpdatePiece(index, 'description', e.target.value)}
                              placeholder="e.g. Machine spare parts"
                              className="ngf-input"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="btn-corp-ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      className="btn-corp-primary"
                      onClick={handleNextStep}
                    >
                      <span>Continue</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: SERVICE TIER & SUBMISSION */}
              {currentStep === 4 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><Truck size={20} /></div>
                    <div>
                      <h3>4. {STEP_TITLES[3]}</h3>
                    </div>
                  </div>

                  {/* Service cards: the four §7.1 services, summaries from §3.1 */}
                  <div className="services-select-grid" role="radiogroup" aria-label="Service">
                    {SERVICE_OPTIONS.map((s) => {
                      const Icon = SERVICE_ICONS[s.id];
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={selectedService === s.id}
                          className={`service-option-card ${selectedService === s.id ? 'selected' : ''}`}
                          onClick={() => setSelectedService(s.id)}
                        >
                          <div className="serv-head">
                            <Icon size={20} className="text-accent" />
                            <strong>{s.name}</strong>
                          </div>
                          <small>{s.summary}</small>
                        </button>
                      );
                    })}
                  </div>

                  {/* Transport mode (tracker 2.8) */}
                  <div className="transport-mode-row">
                    <label htmlFor="ship-mode" className="section-sublabel">Transport mode</label>
                    <select
                      id="ship-mode"
                      value={transportMode}
                      onChange={(e) => setTransportMode(e.target.value as TransportMode | '')}
                      className="ngf-input"
                    >
                      <option value="">Let {COMPANY} recommend</option>
                      <option value="Air">{TRANSPORT_MODE_LABELS.Air}</option>
                      <option value="Sea">{TRANSPORT_MODE_LABELS.Sea}</option>
                      <option value="Road">{TRANSPORT_MODE_LABELS.Road}</option>
                    </select>
                  </div>

                  {/* Extras (CONTENT §3.4 add-ons) */}
                  <div className="addons-grid">
                    <div className="addon-checkbox-row">
                      <input
                        type="checkbox"
                        id="signCheck"
                        checked={requireSignature}
                        onChange={(e) => setRequireSignature(e.target.checked)}
                      />
                      <label htmlFor="signCheck">
                        <strong>Signature Confirmation</strong>
                        <small>Delivery is released only against a named signature.</small>
                      </label>
                    </div>

                    <div className="addon-checkbox-row">
                      <input
                        type="checkbox"
                        id="satCheck"
                        checked={saturdayDelivery}
                        onChange={(e) => setSaturdayDelivery(e.target.checked)}
                      />
                      <label htmlFor="satCheck">
                        <strong>Weekend Delivery</strong>
                        <small>Saturday delivery on selected lanes.</small>
                      </label>
                    </div>

                    <div className="declared-value-row">
                      <label htmlFor="ship-declared-value">Declared value ({money.currency}) <span className="ngf-field-optional">(optional)</span></label>
                      <div className="value-input-wrap">
                        <span className="curr-sym">{money.symbol}</span>
                        <MoneyInput
                          id="ship-declared-value"
                          min="0"
                          value={declaredValue}
                          onChange={setDeclaredValue}
                          className="ngf-input font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="btn-corp-ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="btn-corp-primary submit-booking-btn"
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border" />
                          <span>Booking…</span>
                        </>
                      ) : (
                        <>
                          <span>Book shipment</span>
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Summary */}
            <aside className="ngf-ship-sidebar">
              <div className="sidebar-sticky-card">
                <div className="sidebar-head">
                  <h3>Summary</h3>
                </div>

                <div className="sidebar-route-preview">
                  <div className="route-loc origin">
                    <MapPin size={16} className="text-accent" />
                    <div>
                      <small>From</small>
                      <strong>{senderCity ? placeText(senderCity, senderState, senderCountry) : '—'}</strong>
                    </div>
                  </div>
                  <div className="route-arrow-line">
                    <span className="route-line" />
                    <span className="route-dot" />
                  </div>
                  <div className="route-loc dest">
                    <MapPin size={16} className="text-accent" />
                    <div>
                      <small>To</small>
                      <strong>{recipientCity ? placeText(recipientCity, recipientState, recipientCountry) : '—'}</strong>
                    </div>
                  </div>
                </div>

                <div className="sidebar-specs-list">
                  <div className="spec-row">
                    <span>Pieces</span>
                    <strong>{totalPieces}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Weight</span>
                    <strong>{formatWeight(totalWeight, units.system) || '—'}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Service</span>
                    <strong className="text-accent">
                      {getServiceName()}
                    </strong>
                  </div>
                  <div className="spec-row">
                    <span>Transport mode</span>
                    <strong>{transportMode ? TRANSPORT_MODE_LABELS[transportMode] : `${COMPANY_SHORT} recommends`}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Collection</span>
                    <strong>{pickupType === 'pickup' ? pickupWindow : DROP_OFF_LABEL}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Signature Confirmation</span>
                    <strong>{requireSignature ? 'Yes' : 'No'}</strong>
                  </div>
                  {saturdayDelivery && (
                    <div className="spec-row">
                      <span>Weekend Delivery</span>
                      <strong>Yes</strong>
                    </div>
                  )}
                </div>

                <div className="sidebar-pricing-breakdown">
                  <p className="admin-publishing-note">
                    Your coordinator confirms the rate before collection.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. HOW BOOKING WORKS (CONTENT §7.3)
          ========================================================================= */}
      <section className="ngf-ship-process-section">
        <div className="ngf-container-wide">
          <div className="section-center-header">
            <h2>How booking works</h2>
            <div className="section-header-line" />
          </div>

          <div className="process-steps-grid">
            {BOOKING_STAGES.map((stage, i) => (
              <div key={stage.title} className="p-step-card">
                <div className="step-badge">{String(i + 1).padStart(2, '0')}</div>
                <h4>{stage.title}</h4>
                <p>{stage.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
