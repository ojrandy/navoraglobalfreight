import React, { useState } from 'react';
import {
  Settings,
  Building,
  Shield,
  Eye,
  DollarSign,
  Barcode as BarcodeIcon,
  Server,
  Save,
  CheckCircle2,
  Lock,
  Globe,
  Radio,
  MapPin,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Phone,
  Mail,
  Truck
} from 'lucide-react';
import { COMPANY_SHORT, EMAIL, LEGAL_NAME } from '../../config/brand';
import { useAdminData } from '../../context/AdminDataContext';
import './SettingsView.css';
import { CURRENCY_NAMES, DISPLAY_CURRENCIES, formatMoney, resolveCurrency, type DisplayCurrency } from '../../shared/currency';
import { MeasureInput, useUnitLabels } from '../../components/forms/UnitControls';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useAdminData();

  // Company Profile State — hydrated from persisted settings (falling back to the legacy
  // `headquarters` key for databases seeded before it was renamed to `headquartersAddress`)
  const [companyName, setCompanyName] = useState(settings.companyName || LEGAL_NAME);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone || '');
  const [dispatchEmail, setDispatchEmail] = useState(settings.dispatchEmail || EMAIL);
  const [headquarters, setHeadquarters] = useState(settings.headquartersAddress || (settings as any).headquarters || '');
  const [dotNumber, setDotNumber] = useState(settings.dotNumber || '');

  // Public Tracking & Privacy Controls (Consolidated from Tracking Control)
  const [piiMasking, setPiiMasking] = useState(settings.piiMaskingEnabled ?? true);
  const [mapVisibility, setMapVisibility] = useState<'CITY' | 'EXACT' | 'HIDDEN'>(settings.mapVisibility || 'CITY');
  const [cloakInternalNotes, setCloakInternalNotes] = useState(settings.cloakInternalNotes ?? true);
  const [showEstimatedTime, setShowEstimatedTime] = useState(settings.showEstimatedTime ?? true);

  // Pricing & Tariff Defaults
  const [fuelRate, setFuelRate] = useState((settings.defaultFuelSurchargeRate ? settings.defaultFuelSurchargeRate * 100 : 8.5).toString());
  const [quoteValidityDays, setQuoteValidityDays] = useState(String(settings.quoteValidityDays ?? 14));
  const [oversizeLengthThreshold, setOversizeLengthThreshold] = useState<number | ''>(settings.oversizeLengthThreshold ?? 60);
  const units = useUnitLabels();

  // Display currency (tracker 2.7): prices are stored in USD and shown in this currency at the
  // rate entered here. A non-USD currency without a rate keeps showing USD.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>((settings.displayCurrency as DisplayCurrency) || 'USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(settings.exchangeRates || {}).map(([k, v]) => [k, String(v)])));
  const currencyPreview = resolveCurrency({
    displayCurrency,
    exchangeRates: Object.fromEntries(Object.entries(exchangeRates).map(([k, v]) => [k, parseFloat(v)]))
  });

  // Barcode & Document Automation
  const [barcodeStandard] = useState('Code 128 (High-Density Linear Symbology - No QR)');
  const [autoGenLabel, setAutoGenLabel] = useState(settings.autoGenLabel ?? true);
  const [autoGenReceipt, setAutoGenReceipt] = useState(settings.autoGenReceipt ?? true);

  // Authorized Signature / Stamp (used on Insurance Certificates & Bills of Lading)
  const [signatureStampUrl, setSignatureStampUrl] = useState(settings.signatureStampUrl || '');
  const [signatoryName, setSignatoryName] = useState(settings.signatoryName || '');
  const [signatoryTitle, setSignatoryTitle] = useState(settings.signatoryTitle || '');

  // Gateway Hub Telemetry — previously 4 hardcoded cards frozen on "NORMAL FLOW" with no
  // connection to the real hubSortStatus field this settings object already had. Now backed
  // by that field for real, and includes the 5th hub (EWR) the old hardcoded UI omitted.
  const [hubSortStatus, setHubSortStatus] = useState<{ [key: string]: 'NORMAL' | 'HIGH_VOLUME' | 'DELAYED' }>(
    settings.hubSortStatus || { JFK: 'NORMAL', EWR: 'NORMAL', ORD: 'NORMAL', DFW: 'NORMAL', LAX: 'NORMAL' }
  );
  const HUB_META: { code: string; city: string; name: string; onTime: string; scans: string }[] = [
    { code: 'JFK', city: 'NEW YORK', name: 'JFK International Cargo Gateway', onTime: '99.2% On-Time', scans: '1,840 Daily Scans' },
    { code: 'EWR', city: 'NEWARK', name: 'Newark Liberty Gateway Terminal', onTime: '98.9% On-Time', scans: '1,320 Daily Scans' },
    { code: 'ORD', city: 'CHICAGO', name: 'Chicago Intermodal Sort Terminal', onTime: '97.8% On-Time', scans: '2,420 Daily Scans' },
    { code: 'DFW', city: 'DALLAS', name: 'Dallas-Fort Worth Freight Gateway', onTime: '98.5% On-Time', scans: '1,150 Daily Scans' },
    { code: 'LAX', city: 'LOS ANGELES', name: 'Los Angeles Pacific Distribution Center', onTime: '99.4% On-Time', scans: '1,910 Daily Scans' }
  ];
  const [stampError, setStampError] = useState<string | null>(null);

  const handleStampFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStampError(null);

    if (!file.type.startsWith('image/')) {
      setStampError('Please upload an image file (PNG, JPG, or SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStampError('Image is too large. Please use a file under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setSignatureStampUrl(reader.result as string);
    reader.onerror = () => setStampError('Could not read that file. Please try again.');
    reader.readAsDataURL(file);
  };

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PRIVACY' | 'TARIFF' | 'DOCUMENTS' | 'HUBS'>('GENERAL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle Save
  const [toastIsError, setToastIsError] = useState(false);
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    // Previously showed "saved successfully" unconditionally, regardless of whether the PUT
    // actually reached the server — a rejected write (expired session, a rejected request)
    // looked identical to a real save, so a toggle like PII masking could show as saved in
    // the admin UI while the public site kept serving the old value indefinitely.
    const result = await updateSettings({
      companyName,
      supportPhone,
      dispatchEmail,
      headquartersAddress: headquarters,
      dotNumber,
      defaultFuelSurchargeRate: (parseFloat(fuelRate) || 8.5) / 100,
      piiMaskingEnabled: piiMasking,
      mapVisibility,
      cloakInternalNotes,
      showEstimatedTime,
      quoteValidityDays: parseInt(quoteValidityDays, 10) || 14,
      oversizeLengthThreshold: oversizeLengthThreshold === '' ? 60 : oversizeLengthThreshold,
      displayCurrency,
      exchangeRates: Object.fromEntries(
        Object.entries(exchangeRates)
          .map(([k, v]) => [k, parseFloat(v)] as const)
          .filter(([, v]) => Number.isFinite(v) && v > 0)
      ),
      autoGenLabel,
      autoGenReceipt,
      signatureStampUrl,
      signatoryName,
      signatoryTitle,
      hubSortStatus
    });
    setToastIsError(!result.success);
    setToastMessage(result.success
      ? 'System settings saved successfully!'
      : `Failed to save settings: ${result.error || 'server rejected the request'}. Your changes were not persisted.`);
    setTimeout(() => setToastMessage(null), result.success ? 3500 : 6000);
  };

  const handleResetDefaults = () => {
    setCompanyName(LEGAL_NAME);
    setSupportPhone('');
    setDispatchEmail(EMAIL);
    setHeadquarters('');
    setDotNumber('');
    setPiiMasking(true);
    setMapVisibility('CITY');
    setCloakInternalNotes(true);
    setShowEstimatedTime(true);
    setFuelRate('8.5');
    setQuoteValidityDays('14');
    setOversizeLengthThreshold(60);
    setDisplayCurrency('USD');
    setAutoGenLabel(true);
    setAutoGenReceipt(true);
    setSignatureStampUrl('');
    setSignatoryName('');
    setSignatoryTitle('');
    setHubSortStatus({ JFK: 'NORMAL', EWR: 'NORMAL', ORD: 'NORMAL', DFW: 'NORMAL', LAX: 'NORMAL' });
    setStampError(null);
    setToastMessage('Settings restored to default configuration.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="settings-page-container animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`settings-toast animate-fade-in${toastIsError ? ' toast-error' : ''}`}>
          {toastIsError ? <AlertTriangle size={18} className="text-crimson" /> : <CheckCircle2 size={18} className="text-emerald" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="settings-page-header">
        <div>
          <h2>System Settings & Configuration</h2>
          <p>Manage company identity, public tracking privacy, pricing defaults, and document rules.</p>
        </div>

        <div className="settings-header-actions">
          <button
            type="button"
            className="btn-reset-settings"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={15} />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            className="btn-save-settings-primary"
            onClick={handleSaveAll}
          >
            <Save size={15} />
            <span>Save All Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="settings-nav-tabs">
        <button
          className={`settings-tab-btn ${activeTab === 'GENERAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('GENERAL')}
        >
          <Building size={16} />
          <span>Company Profile</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'PRIVACY' ? 'active' : ''}`}
          onClick={() => setActiveTab('PRIVACY')}
        >
          <Shield size={16} />
          <span>Public Tracking & Privacy</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'TARIFF' ? 'active' : ''}`}
          onClick={() => setActiveTab('TARIFF')}
        >
          <DollarSign size={16} />
          <span>Tariff & Pricing Defaults</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'DOCUMENTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('DOCUMENTS')}
        >
          <FileText size={16} />
          <span>Barcode & Documents</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'HUBS' ? 'active' : ''}`}
          onClick={() => setActiveTab('HUBS')}
        >
          <Server size={16} />
          <span>Gateway Hub Telemetry</span>
        </button>
      </div>

      {/* Settings Content Grid */}
      <form onSubmit={handleSaveAll} className="settings-form-wrapper">
        {/* =========================================================================
            SECTION 1: COMPANY & CARRIER PROFILE
            ========================================================================= */}
        {activeTab === 'GENERAL' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-blue">
                <Building size={20} />
              </div>
              <div>
                <h3>Company & Carrier Identity</h3>
                <p>Official organization information displayed on Waybills, Bills of Lading, and Invoices.</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="form-row-2">
                <div className="settings-field">
                  <label>Legal Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="settings-input"
                  />
                  <small>Appears as the registered commercial carrier on all transport documents.</small>
                </div>

                <div className="settings-field">
                  <label>USDOT & Carrier Authority Number</label>
                  <input
                    type="text"
                    value={dotNumber}
                    onChange={e => setDotNumber(e.target.value)}
                    className="settings-input font-mono"
                  />
                  <small>Federal Motor Carrier Safety Administration (FMCSA) registration.</small>
                </div>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>Central Dispatch & Support Phone</label>
                  <div className="input-with-icon">
                    <Phone size={15} className="input-icon" />
                    <input
                      type="text"
                      value={supportPhone}
                      onChange={e => setSupportPhone(e.target.value)}
                      className="settings-input with-icon"
                    />
                  </div>
                  <small>Toll-free customer inquiry hotline printed on receipts.</small>
                </div>

                <div className="settings-field">
                  <label>Operations & Dispatch Email</label>
                  <div className="input-with-icon">
                    <Mail size={15} className="input-icon" />
                    <input
                      type="email"
                      value={dispatchEmail}
                      onChange={e => setDispatchEmail(e.target.value)}
                      className="settings-input with-icon"
                    />
                  </div>
                  <small>Primary contact email for quotes and waybill notices.</small>
                </div>
              </div>

              <div className="settings-field">
                <label>Primary Terminal & Headquarters Address</label>
                <div className="input-with-icon">
                  <MapPin size={15} className="input-icon" />
                  <input
                    type="text"
                    value={headquarters}
                    onChange={e => setHeadquarters(e.target.value)}
                    className="settings-input with-icon"
                  />
                </div>
                <small>Main administrative facility and origin billing hub.</small>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: PUBLIC TRACKING & PRIVACY (Consolidated)
            ========================================================================= */}
        {activeTab === 'PRIVACY' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-emerald">
                <Shield size={20} />
              </div>
              <div>
                <h3>Public Tracking & Customer Privacy Controls</h3>
                <p>Configure what information is visible to the public on unauthenticated tracking screens.</p>
              </div>
            </div>

            <div className="settings-card-body">
              {/* PII Masking Toggle Card */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>Strict Customer PII Masking (Recommended)</strong>
                  <p>
                    Masks customer phone numbers and physical street addresses on the public website (e.g. <code>(310) •••-0892</code> and <code>D***** M***** · Los Angeles, CA</code>).
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={piiMasking}
                    onChange={e => setPiiMasking(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Internal Notes Cloaking */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>Cloak Internal Operations Notes</strong>
                  <p>
                    Strictly prevents internal admin remarks (e.g. <i>"Customer requested morning dispatch"</i>) from appearing on the customer's tracking timeline.
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={cloakInternalNotes}
                    onChange={e => setCloakInternalNotes(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Show Estimated Delivery Window */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>Display Estimated Delivery Windows Publicly</strong>
                  <p>
                    Shows the estimated delivery date and time bracket (e.g. <i>"Estimated delivery: 2 October 2026, by 5:00 PM (Lagos time)"</i>, in the destination's time zone) on public tracking.
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={showEstimatedTime}
                    onChange={e => setShowEstimatedTime(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Public Map Visibility Mode */}
              <div className="settings-field pt-2">
                <label>Public Route Map Display Mode</label>
                <div className="radio-options-vertical">
                  <label className={`radio-card ${mapVisibility === 'CITY' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'CITY'}
                      onChange={() => setMapVisibility('CITY')}
                    />
                    <div>
                      <strong>City-to-City Route Corridor (Recommended)</strong>
                      <span>Shows high-level transit route between metro areas (e.g. New York → Chicago → Los Angeles).</span>
                    </div>
                  </label>

                  <label className={`radio-card ${mapVisibility === 'EXACT' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'EXACT'}
                      onChange={() => setMapVisibility('EXACT')}
                    />
                    <div>
                      <strong>Exact Facility & Hub Pins</strong>
                      <span>Displays individual warehouse sorting pins on the interactive map.</span>
                    </div>
                  </label>

                  <label className={`radio-card ${mapVisibility === 'HIDDEN' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'HIDDEN'}
                      onChange={() => setMapVisibility('HIDDEN')}
                    />
                    <div>
                      <strong>Hide Interactive Map</strong>
                      <span>Replaces the map with a text-based milestone progress bar.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 3: TARIFF & PRICING DEFAULTS
            ========================================================================= */}
        {activeTab === 'TARIFF' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-indigo">
                <DollarSign size={20} />
              </div>
              <div>
                <h3>Tariff & Pricing Parameters</h3>
                <p>Default parameters used when an administrator reviews and calculates customer quote requests.</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="form-row-2">
                <div className="settings-field">
                  <label>National Fuel Surcharge Index (%)</label>
                  <div className="input-with-icon">
                    <input
                      type="number"
                      step="0.1"
                      value={fuelRate}
                      onChange={e => setFuelRate(e.target.value)}
                      className="settings-input font-mono"
                    />
                  </div>
                  <small>Current baseline fuel index applied across domestic linehaul operations.</small>
                </div>

                <div className="settings-field">
                  <label>Default Quote Offer Validity Window (Days)</label>
                  <input
                    type="number"
                    value={quoteValidityDays}
                    onChange={e => setQuoteValidityDays(e.target.value)}
                    className="settings-input font-mono"
                  />
                  <small>Guarantees quoted shipping tariffs for the specified number of calendar days (e.g. 14 days).</small>
                </div>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label htmlFor="settings-currency">Display Currency</label>
                  <select
                    id="settings-currency"
                    value={displayCurrency}
                    onChange={e => setDisplayCurrency(e.target.value as DisplayCurrency)}
                    className="settings-input"
                  >
                    {DISPLAY_CURRENCIES.map(c => (
                      <option key={c} value={c}>{c} — {CURRENCY_NAMES[c]}</option>
                    ))}
                  </select>
                  <small>Prices are stored in USD and shown to customers and staff in this currency.</small>
                </div>

                {displayCurrency !== 'USD' && (
                  <div className="settings-field">
                    <label htmlFor="settings-rate">Exchange Rate (1 USD = ? {displayCurrency})</label>
                    <input
                      id="settings-rate"
                      type="number"
                      step="any"
                      min="0"
                      value={exchangeRates[displayCurrency] ?? ''}
                      onChange={e => setExchangeRates(prev => ({ ...prev, [displayCurrency]: e.target.value }))}
                      className="settings-input font-mono"
                    />
                    {currencyPreview.missingRate ? (
                      <small className="settings-warning-text">Enter the rate to switch prices to {displayCurrency}. Until then they stay in USD.</small>
                    ) : (
                      <small>Example: $350.00 is shown as {formatMoney(350, currencyPreview)}. Update the rate when it changes.</small>
                    )}
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>Oversize Cargo Dimension Threshold ({units.length})</label>
                  <MeasureInput
                    kind="length"
                    min="0"
                    value={oversizeLengthThreshold}
                    onChange={setOversizeLengthThreshold}
                    className="settings-input font-mono"
                  />
                  <small>Items longer than this (e.g. 150 cm / 60 in truck bumpers) trigger oversize flags.</small>
                </div>

                <div className="settings-field">
                  <label>Operating Currency & Billing Code</label>
                  <input
                    type="text"
                    disabled
                    value="USD ($) — United States Dollar"
                    className="settings-input disabled-bg"
                  />
                  <small>Prices are stored in US dollars; the display currency setting converts them for customers.</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 4: BARCODE & DOCUMENT AUTOMATION
            ========================================================================= */}
        {activeTab === 'DOCUMENTS' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-amber">
                <BarcodeIcon size={20} />
              </div>
              <div>
                <h3>Barcode & Document Generation Rules</h3>
                <p>Configure automated documentation generation and barcode standards.</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="settings-field">
                <label>Carrier Barcode Standard (Strict Policy)</label>
                <input
                  type="text"
                  disabled
                  value={barcodeStandard}
                  className="settings-input font-mono disabled-bg"
                />
                <small>{COMPANY_SHORT} uses linear Code 128 barcodes across all Shipping Labels, Receipts, and BOLs.</small>
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>Auto-Generate Shipping Label on Consignment Creation</strong>
                  <p>Automatically registers a 4x6 courier shipping label whenever a new shipment or quote is converted.</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={autoGenLabel}
                    onChange={e => setAutoGenLabel(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>Auto-Generate Shipment Receipt on Payment Tender</strong>
                  <p>Issues an official payment and intake receipt immediately upon consignment registration.</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={autoGenReceipt}
                    onChange={e => setAutoGenReceipt(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              <div className="settings-field pt-2">
                <label>Authorized Signature / Company Stamp</label>
                <div className="stamp-upload-row">
                  <div className="stamp-preview-box">
                    {signatureStampUrl ? (
                      <img src={signatureStampUrl} alt="Authorized signature preview" />
                    ) : (
                      <span className="stamp-preview-empty">No stamp uploaded</span>
                    )}
                  </div>
                  <div className="stamp-upload-controls">
                    <label className="btn-upload-stamp">
                      <input type="file" accept="image/*" onChange={handleStampFileChange} hidden />
                      <span>{signatureStampUrl ? 'Replace Image' : 'Upload Image'}</span>
                    </label>
                    {signatureStampUrl && (
                      <button type="button" className="btn-remove-stamp" onClick={() => setSignatureStampUrl('')}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {stampError && <small className="stamp-error-text">{stampError}</small>}
                <small>
                  Uploaded as your own authorized representative's signature — Insurance Certificates and Bills of Lading are signed "for and on behalf of" the underwriter/carrier using this image, not the underwriter's own signature. PNG with a transparent background works best. Max 2MB.
                </small>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>Signatory Name</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={e => setSignatoryName(e.target.value)}
                    placeholder="e.g. Marcus Alvarado"
                    className="settings-input"
                  />
                  <small>Printed beneath the signature on certificates and manifests.</small>
                </div>
                <div className="settings-field">
                  <label>Signatory Title</label>
                  <input
                    type="text"
                    value={signatoryTitle}
                    onChange={e => setSignatoryTitle(e.target.value)}
                    placeholder="e.g. Director of Cargo Operations"
                    className="settings-input"
                  />
                  <small>Job title printed alongside the signatory's name.</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 5: GATEWAY HUB TELEMETRY
            ========================================================================= */}
        {activeTab === 'HUBS' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-blue">
                <Server size={20} />
              </div>
              <div>
                <h3>National Gateway Hub Telemetry</h3>
                <p>Real-time status and throughput monitoring across major national transit hubs.</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="hubs-status-grid">
                {HUB_META.map(hub => {
                  const status = hubSortStatus[hub.code] || 'NORMAL';
                  const pillClass = status === 'DELAYED' ? 'delayed' : status === 'HIGH_VOLUME' ? 'high-volume' : 'normal';
                  const pillLabel = status === 'DELAYED' ? 'DELAYED' : status === 'HIGH_VOLUME' ? 'HIGH VOLUME' : 'NORMAL FLOW';
                  return (
                    <div className="hub-telemetry-card" key={hub.code}>
                      <div className="hub-card-top">
                        <div className="hub-tag font-mono">{hub.code} · {hub.city}</div>
                        <span className={`hub-status-pill ${pillClass}`}>{pillLabel}</span>
                      </div>
                      <strong className="hub-name">{hub.name}</strong>
                      <div className="hub-metrics-row font-mono">
                        <span>{hub.onTime}</span>
                        <span>{hub.scans}</span>
                      </div>
                      <select
                        className="hub-status-select"
                        value={status}
                        onChange={(e) => setHubSortStatus(prev => ({ ...prev, [hub.code]: e.target.value as 'NORMAL' | 'HIGH_VOLUME' | 'DELAYED' }))}
                      >
                        <option value="NORMAL">Normal Flow</option>
                        <option value="HIGH_VOLUME">High Volume</option>
                        <option value="DELAYED">Delayed</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action Bar */}
        <div className="settings-footer-save-bar">
          <div className="save-bar-info">
            <Shield size={16} className="text-emerald" />
            <span>All modifications take effect across live dispatch and public tracking instantly.</span>
          </div>
          <button type="submit" className="btn-save-settings-primary">
            <Save size={15} />
            <span>Save All Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
