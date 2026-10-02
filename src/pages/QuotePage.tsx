import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  MapPin,
  Send,
  FileText,
  Truck,
  User,
  Package,
  RotateCcw,
  AlertCircle,
  ListChecks
} from 'lucide-react';
import { api } from '../services/api';
import { useAdminData } from '../context/AdminDataContext';
import { COMPANY } from '../config/brand';
import { CountrySelect } from '../components/forms/CountrySelect';
import { PhoneInput } from '../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../components/forms/UnitControls';
import { getCountry, postcodeLabel, regionLabel, shortRegion } from '../data/countries';
import { SERVICE_OPTIONS, findServiceOption } from '../data/serviceOptions';
import { QUOTE_NEXT_STEPS } from '../data/quoteNextSteps';
import { formatWeight } from '../shared/units';
import { TRANSPORT_MODE_LABELS, type TransportMode } from '../shared/transportMode';
import { useCurrency } from '../utils/useCurrency';
import './QuotePage.css';

// Address as sent to the API: the short region shown after the city ("TX" / "NG"), plus the
// full region, postcode and country as entered.
function addressPayload(countryCode: string, city: string, region: string, postcode: string) {
  return {
    city: city.trim(),
    state: shortRegion(countryCode, region),
    region: region.trim() || undefined,
    postalCode: postcode.trim() || undefined,
    country: getCountry(countryCode)?.name || '',
    countryCode
  };
}

// "Houston, TX, United States" / "Lagos, Nigeria"
function placeLabel(city: string, region: string, countryCode: string) {
  const country = getCountry(countryCode);
  return [city || '—', countryCode === 'US' ? region.trim().toUpperCase() : '', country?.name].filter(Boolean).join(', ');
}

interface QuotePageProps {
  onNavigate: (page: string, param?: string) => void;
  initialService?: string;
}

export const QuotePage: React.FC<QuotePageProps> = ({ onNavigate, initialService }) => {
  const { createQuoteRequest } = useAdminData();

  // Your details
  const [customerName, setCustomerName] = useState('');
  const [company, setCompany] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Route: country first, then the fields that fit it (region and postcode optional)
  const [originCountry, setOriginCountry] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originZip, setOriginZip] = useState('');

  const [destCountry, setDestCountry] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [destZip, setDestZip] = useState('');

  // '' = let us recommend the mode
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const units = useUnitLabels();
  const money = useCurrency();

  // Service: one of the four §7.1 services (stored by name)
  const [cargoDescription, setCargoDescription] = useState('');
  const [service, setService] = useState(findServiceOption(initialService).name);

  useEffect(() => {
    if (initialService) {
      setService(findServiceOption(initialService).name);
    }
  }, [initialService]);

  // Stored canonically: pounds, inches and USD (the inputs convert for display).
  const [weight, setWeight] = useState<number | ''>('');
  const [pieces, setPieces] = useState('1');
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [declaredValue, setDeclaredValue] = useState<number | ''>('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Status & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdQuoteId, setCreatedQuoteId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (!customerName.trim() || !customerEmail.trim() || !originCountry || !originCity.trim() || !destCountry || !destCity.trim() || weight === '' || !cargoDescription.trim()) {
      setFormError('Please complete all required fields (origin and destination country and city, weight, contents, name and email).');
      return;
    }

    setIsSubmitting(true);

    try {
      const quotePayload = {
        customerName: customerName.trim(),
        company: company.trim() || undefined,
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        origin: addressPayload(originCountry, originCity, originState, originZip),
        destination: addressPayload(destCountry, destCity, destState, destZip),
        transportMode: transportMode || undefined,
        cargoDescription: cargoDescription.trim(),
        shipmentType: (findServiceOption(service).id === 'vehicle' ? 'Vehicle' : 'Parcel') as any,
        service: service as any,
        weightLbs: weight,
        pieces: parseInt(pieces, 10) || 1,
        // Optional; only the sides actually entered are sent (inches)
        dimensions: {
          ...(length !== '' ? { length } : {}),
          ...(width !== '' ? { width } : {}),
          ...(height !== '' ? { height } : {})
        },
        declaredValue: declaredValue === '' ? 0 : declaredValue,
        specialInstructions: specialInstructions.trim() || undefined
      };

      // Saved in the database; the server assigns the quote reference.
      const result = await api.submitPublicQuote(quotePayload as any);
      createQuoteRequest(result);

      setCreatedQuoteId(result.id);
      setSubmitted(true);
      window.scrollTo({ top: 200, behavior: 'smooth' });
    } catch (err: any) {
      // Nothing was saved: say so rather than showing a reference that doesn't exist.
      setFormError(`We couldn't send your quote request: ${err?.message || 'the server did not respond'}. Nothing was saved; please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setCustomerName('');
    setCompany('');
    setCustomerEmail('');
    setCustomerPhone('');
    setOriginCountry('');
    setDestCountry('');
    setTransportMode('');
    setOriginCity('');
    setOriginState('');
    setOriginZip('');
    setDestCity('');
    setDestState('');
    setDestZip('');
    setCargoDescription('');
    setWeight('');
    setPieces('1');
    setLength('');
    setWidth('');
    setHeight('');
    setDeclaredValue('');
    setSpecialInstructions('');
    setFormError(null);
  };

  return (
    <div className="sdl-page-quote">
      {/* =========================================================================
          1. HERO (CONTENT §7.1)
          ========================================================================= */}
      <section className="sdl-quote-hero">
        <div className="quote-hero-bg-overlay" />
        <div className="sdl-container-wide quote-hero-inner">
          <h1 className="quote-hero-title animate-fade-in">Get a rate quote</h1>

          <p className="quote-hero-lead animate-fade-in">
            Tell us what you're moving and where. A coordinator will confirm your rate, usually the same business day.
          </p>
        </div>
      </section>

      {/* =========================================================================
          2. MAIN BODY & FORM
          ========================================================================= */}
      <div className="sdl-container-wide sdl-quote-body">
        {submitted ? (
          /* =========================================================================
             CONFIRMATION STATE
             ========================================================================= */
          <div className="quote-confirmation-card animate-fade-in" role="status">
            <div className="confirm-header">
              <div className="check-badge-icon"><CheckCircle2 size={48} className="text-emerald" /></div>
              <h2>Quote request received</h2>
              <p>
                Quote reference <strong className="font-mono text-accent">{createdQuoteId}</strong>
              </p>
            </div>

            <div className="admin-review-info-box">
              <div className="info-box-head">
                <ListChecks size={18} className="text-accent flex-shrink-0" />
                <h4>What happens next</h4>
              </div>
              <ol className="quote-next-steps">
                {QUOTE_NEXT_STEPS.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>

            <div className="quote-receipt-card">
              <div className="receipt-grid">
                <div className="rec-item">
                  <small>Quote reference</small>
                  <strong className="font-mono text-accent">{createdQuoteId}</strong>
                </div>
                <div className="rec-item">
                  <small>Service</small>
                  <strong>{service}{transportMode ? ` · ${TRANSPORT_MODE_LABELS[transportMode]}` : ''}</strong>
                </div>
                <div className="rec-item span-full">
                  <small>Route</small>
                  <strong>{placeLabel(originCity, originState, originCountry)} → {placeLabel(destCity, destState, destCountry)}</strong>
                </div>
                <div className="rec-item span-full">
                  <small>Cargo</small>
                  <strong>{cargoDescription} · {formatWeight(weight, units.system)} · {pieces || '1'} {parseInt(pieces, 10) > 1 ? 'pieces' : 'piece'}</strong>
                </div>
              </div>
            </div>

            <div className="quote-confirm-actions">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => onNavigate('quote-result', createdQuoteId)}
              >
                <FileText size={16} />
                <span>View your quote</span>
              </button>

              <button
                type="button"
                className="btn-corp-ghost"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Request another quote</span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
             QUOTE FORM + SIDE CARD
             ========================================================================= */
          <div className="sdl-quote-grid">
            <div className="quote-form-card">
              {formError && (
                <div className="quote-form-error animate-fade-in" role="alert">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="quote-calc-form">
                {/* 1. ROUTE */}
                <div className="form-section-divider">
                  <MapPin size={16} className="text-accent" />
                  <span>1. Route</span>
                </div>

                {([
                  { key: 'origin', title: 'From', country: originCountry, setCountry: setOriginCountry, city: originCity, setCity: setOriginCity, region: originState, setRegion: setOriginState, postcode: originZip, setPostcode: setOriginZip },
                  { key: 'dest', title: 'To', country: destCountry, setCountry: setDestCountry, city: destCity, setCity: setDestCity, region: destState, setRegion: setDestState, postcode: destZip, setPostcode: setDestZip }
                ]).map((side) => (
                  <fieldset key={side.key} className="quote-address-fieldset">
                    <legend>{side.title}</legend>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor={`${side.key}-country`}>Country *</label>
                        <CountrySelect
                          id={`${side.key}-country`}
                          value={side.country}
                          onChange={side.setCountry}
                          className="sdl-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`${side.key}-city`}>City *</label>
                        <input
                          id={`${side.key}-city`}
                          type="text"
                          required
                          value={side.city}
                          onChange={(e) => side.setCity(e.target.value)}
                          placeholder={side.key === 'origin' ? 'e.g. Lagos' : 'e.g. London'}
                          className="sdl-input"
                        />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor={`${side.key}-region`}>{regionLabel(side.country)} <span className="sdl-field-optional">(optional)</span></label>
                        <input
                          id={`${side.key}-region`}
                          type="text"
                          value={side.region}
                          onChange={(e) => side.setRegion(e.target.value)}
                          className="sdl-input"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`${side.key}-postcode`}>{postcodeLabel(side.country)} <span className="sdl-field-optional">(optional)</span></label>
                        <input
                          id={`${side.key}-postcode`}
                          type="text"
                          value={side.postcode}
                          onChange={(e) => side.setPostcode(e.target.value)}
                          className="sdl-input font-mono"
                        />
                      </div>
                    </div>
                  </fieldset>
                ))}

                {/* 2. CARGO */}
                <div className="form-section-divider">
                  <Package size={16} className="text-accent" />
                  <span>2. Cargo</span>
                </div>

                <div className="sdl-heading-with-units quote-units-row">
                  <span className="quote-units-label">Units</span>
                  <UnitToggle />
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label htmlFor="quote-pieces">Pieces *</label>
                    <input
                      id="quote-pieces"
                      type="number"
                      min="1"
                      required
                      value={pieces}
                      onChange={(e) => setPieces(e.target.value)}
                      placeholder="1"
                      className="sdl-input font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quote-weight">Weight ({units.weight}) *</label>
                    <MeasureInput
                      id="quote-weight"
                      kind="weight"
                      step="0.1"
                      min="0"
                      required
                      value={weight}
                      onChange={setWeight}
                      placeholder={units.system === 'metric' ? 'e.g. 6.5' : 'e.g. 14.5'}
                      className="sdl-input font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quote-value">Declared value ({money.currency}) <span className="sdl-field-optional">(optional)</span></label>
                    <MoneyInput
                      id="quote-value"
                      min="0"
                      value={declaredValue}
                      onChange={setDeclaredValue}
                      placeholder="e.g. 2500"
                      className="sdl-input font-mono"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dimensions (L × W × H, {units.length}) <span className="sdl-field-optional">(optional)</span></label>
                  <div className="dimensions-row">
                    <MeasureInput kind="length" min="0" aria-label={`Length (${units.length})`} value={length} onChange={setLength} placeholder={`Length (${units.length})`} className="sdl-input font-mono" />
                    <MeasureInput kind="length" min="0" aria-label={`Width (${units.length})`} value={width} onChange={setWidth} placeholder={`Width (${units.length})`} className="sdl-input font-mono" />
                    <MeasureInput kind="length" min="0" aria-label={`Height (${units.length})`} value={height} onChange={setHeight} placeholder={`Height (${units.length})`} className="sdl-input font-mono" />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quote-contents">Contents *</label>
                  <input
                    id="quote-contents"
                    type="text"
                    required
                    value={cargoDescription}
                    onChange={(e) => setCargoDescription(e.target.value)}
                    placeholder="e.g. Machine spare parts"
                    className="sdl-input"
                  />
                </div>

                {/* 3. SERVICE */}
                <div className="form-section-divider">
                  <Truck size={16} className="text-accent" />
                  <span>3. Service</span>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-service">Service *</label>
                    <select
                      id="quote-service"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="sdl-input"
                    >
                      {SERVICE_OPTIONS.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="quote-mode">Transport mode</label>
                    <select
                      id="quote-mode"
                      value={transportMode}
                      onChange={(e) => setTransportMode(e.target.value as TransportMode | '')}
                      className="sdl-input"
                    >
                      <option value="">Let {COMPANY} recommend</option>
                      <option value="Air">{TRANSPORT_MODE_LABELS.Air}</option>
                      <option value="Sea">{TRANSPORT_MODE_LABELS.Sea}</option>
                      <option value="Road">{TRANSPORT_MODE_LABELS.Road}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quote-notes">Special instructions <span className="sdl-field-optional">(optional)</span></label>
                  <textarea
                    id="quote-notes"
                    rows={3}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="sdl-input"
                  />
                </div>

                {/* 4. YOUR DETAILS */}
                <div className="form-section-divider">
                  <User size={16} className="text-accent" />
                  <span>4. Your details</span>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-name">Name *</label>
                    <input
                      id="quote-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="sdl-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quote-company">Company <span className="sdl-field-optional">(optional)</span></label>
                    <input
                      id="quote-company"
                      type="text"
                      autoComplete="organization"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="sdl-input"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-email">Email *</label>
                    <input
                      id="quote-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="sdl-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quote-phone">Phone <span className="sdl-field-optional">(optional)</span></label>
                    <PhoneInput
                      id="quote-phone"
                      value={customerPhone}
                      onChange={setCustomerPhone}
                      defaultCountry={originCountry || 'US'}
                      className="sdl-input font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="btn-corp-primary submit-quote-btn"
                >
                  <Send size={18} />
                  <span>{isSubmitting ? 'Sending…' : 'Request a Quote'}</span>
                </button>
              </form>
            </div>

            {/* Side card (CONTENT §7.1) */}
            <div className="quote-sidebar-col">
              <div className="quote-policy-card">
                <h3>Straight answers, no surprises.</h3>
                <p>
                  Your quote includes the service, estimated transit time and every known charge, so the price you accept is the price you pay (duties and taxes as applicable).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
