import React, { useState, useEffect } from 'react';
import {
  Package,
  FileText,
  Truck,
  Layers,
  Box,
  Container,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Plus,
  Trash2,
  Printer,
  FileCheck,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
  RotateCcw,
  ShieldCheck,
  DollarSign,
  MapPin,
  Compass,
  Barcode,
  Car,
  Camera,
  Key,
  FileBadge,
  Wrench,
  CheckSquare,
  Square,
  X,
  ZoomIn,
  Upload,
  Shield,
  Lock,
  Anchor,
  Thermometer,
  AlertTriangle,
  PawPrint,
  Heart
} from 'lucide-react';
import { resolveAddress, resolveAddressPrecise, resolveLocation, STATE_NAMES } from '../../services/geocodingService';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../../components/forms/UnitControls';
import { getCountry, postcodeLabel, regionLabel, shortRegion } from '../../data/countries';
import { formatDimensions, formatLength, formatWeight } from '../../shared/units';

// Weight text saved into event descriptions: kg first with lb alongside, readable in either system.
const bothUnits = (lbs: unknown) => `${formatWeight(lbs, 'metric')} (${formatWeight(lbs, 'imperial')})`;
import { TRANSPORT_LEG_LABELS } from '../../shared/transportMode';
import { useCurrency } from '../../utils/useCurrency';
import { calculateRouteGeometry, inferTransportMode, type TransportMode } from '../../services/routingEngine';
import { generateShipmentPlan } from '../../services/planningEngine';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminViewType } from '../AdminLayout';
import { Shipment, ShipmentStatus, TrackingEvent } from '../../types/shipment';
import { ADMIN_ROLE_LABEL, COMPANY, COMPANY_SHORT, INTAKE_DESK, LEGAL_NAME, REFERENCE_PREFIX, TRACKING_PREFIX } from '../../config/brand';
import { generateReference } from '../../shared/references';
import './CreateShipmentView.css';
import { Barcode as TrackingBarcode } from '../../components/Barcode';
import { documentTitle } from '../../components/DocumentBrand';

interface CreateShipmentViewProps {
  onSelectView: (view: AdminViewType) => void;
  onOpenShipmentDetail: (trackingNumber: string) => void;
}

export type ShipmentTypeOption = 'Document' | 'Parcel' | 'Freight' | 'Pallet' | 'Container' | 'Vehicle' | 'Pets' | 'Multi-piece';
export type ServiceOption = 'Standard' | 'Express' | 'Priority' | 'Freight';

interface PackageItem {
  id: string;
  type: string;
  weightLbs: number;
  length: number;
  width: number;
  height: number;
  description: string;
}

export const CreateShipmentView: React.FC<CreateShipmentViewProps> = ({
  onSelectView,
  onOpenShipmentDetail
}) => {
  const { createShipment, generateDocument } = useAdminData();

  // Current Step: 1 to 7
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftSavedToast, setDraftSavedToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ----------------------------------------------------
  // STEP 1: Shipment Information
  // ----------------------------------------------------
  const [shipmentType, setShipmentType] = useState<ShipmentTypeOption>('Parcel');
  const [cargoCategory, setCargoCategory] = useState('Automotive & Parts');
  const [service, setService] = useState<ServiceOption>('Express');
  // 'Auto' leaves the mode to inference (road within ~1,500 mi or North America, sea for
  // containers/freight, otherwise air); the server applies the same rule on read.
  const [transportModeChoice, setTransportModeChoice] = useState<'Auto' | TransportMode>('Auto');
  const units = useUnitLabels();
  const money = useCurrency();
  const [customerRef, setCustomerRef] = useState('PO-45821');
  const [invoiceRef, setInvoiceRef] = useState('INV-2026-892');
  const [internalRef, setInternalRef] = useState('INT-CORP-01');
  const [shipmentDescription, setShipmentDescription] = useState('Generator spare parts');

  // ----------------------------------------------------
  // VEHICLE CARGO SPECIFIC STATE (When shipmentType === 'Vehicle')
  // ----------------------------------------------------
  const [vehMake, setVehMake] = useState('Toyota');
  const [vehModel, setVehModel] = useState('Land Cruiser');
  const [vehYear, setVehYear] = useState('2024');
  const [vehVin, setVehVin] = useState('');
  const [vehColor, setVehColor] = useState('White');
  const [vehBodyType, setVehBodyType] = useState('SUV / Crossover');
  const [vehOperable, setVehOperable] = useState(true);
  const [vehCondition, setVehCondition] = useState('Good');
  const [vehPlate, setVehPlate] = useState('7XYZ892 (NY)');
  const [vehTitleNumber, setVehTitleNumber] = useState('TITLE-NY-90214');
  const [vehWeightLbs, setVehWeightLbs] = useState('5490');
  const [vehLengthIn, setVehLengthIn] = useState('195');
  const [vehWidthIn, setVehWidthIn] = useState('78');
  const [vehHeightIn, setVehHeightIn] = useState('75');

  // Vehicle Condition Checklist
  const [damageChecklist, setDamageChecklist] = useState<string[]>(['No major visible damage']);
  const [inspectionNotes, setInspectionNotes] = useState('Minor 1-inch cosmetic clearcoat mark on rear tailgate. All factory glass intact.');
  const [itemsReceived, setItemsReceived] = useState<string[]>([
    'Vehicle',
    'Primary Key',
    'Title Document',
    'Registration'
  ]);
  // ----------------------------------------------------
  // PALLET CARGO SPECIFIC STATE (When shipmentType === 'Pallet')
  // ----------------------------------------------------
  const [palletStandard, setPalletStandard] = useState('GMA Standard 48×40 in (US Wood)');
  const [palletCount, setPalletCount] = useState<number>(2);
  const [palletWeightPerSkid, setPalletWeightPerSkid] = useState<number>(850);
  const [palletHeightIn, setPalletHeightIn] = useState<number>(54);
  const [palletStackable, setPalletStackable] = useState<boolean>(false);
  const [palletForkliftAccess, setPalletForkliftAccess] = useState('4-Way Forklift Entry');
  const [palletSecuringChecks, setPalletSecuringChecks] = useState<string[]>([
    'Heat-Treated (ISPM-15 Certified)',
    'Heavy Gauge Stretch-Wrapped',
    'Steel Banded / Strapped',
    'Corner Edge Protectors'
  ]);

  const handleTogglePalletCheck = (check: string) => {
    setPalletSecuringChecks(prev =>
      prev.includes(check) ? prev.filter(c => c !== check) : [...prev, check]
    );
  };

  // ----------------------------------------------------
  // CONTAINER CARGO SPECIFIC STATE (When shipmentType === 'Container')
  // ----------------------------------------------------
  const [containerNumber, setContainerNumber] = useState('MSCU-749102-3');
  const [containerIsoSize, setContainerIsoSize] = useState('40ft High-Cube (40HC)');
  const [containerBoltSeal, setContainerBoltSeal] = useState('HSS-NY-984021');
  const [containerChassisNumber, setContainerChassisNumber] = useState('CHAS-8812 (Tri-axle)');
  const [containerTerminal, setContainerTerminal] = useState('Port of New York / Newark Container Terminal (PNCT)');
  const [containerVgmWeight, setContainerVgmWeight] = useState('48200');
  const [containerTemperature, setContainerTemperature] = useState('Ambient / Dry Cargo');
  const [containerCustomsStatus, setContainerCustomsStatus] = useState('Pre-Cleared / Manifest Approved');

  // ----------------------------------------------------
  // HEAVY FREIGHT SPECIFIC STATE (When shipmentType === 'Freight')
  // ----------------------------------------------------
  const [freightClass, setFreightClass] = useState('Class 70');
  const [freightNmfcCode, setFreightNmfcCode] = useState('NMFC 18260-Sub 2');
  const [freightLoadingMethod, setFreightLoadingMethod] = useState('Standard Raised Commercial Loading Dock');
  const [freightLiftgatePickup, setFreightLiftgatePickup] = useState(false);
  const [freightLiftgateDelivery, setFreightLiftgateDelivery] = useState(true);
  const [freightHazMat, setFreightHazMat] = useState(false);
  const [freightUnNumber, setFreightUnNumber] = useState('');
  const [freightPiecesCount, setFreightPiecesCount] = useState<number>(1);
  const [freightTotalWeightLbs, setFreightTotalWeightLbs] = useState<number>(1850);

  // ----------------------------------------------------
  // DOCUMENT CARGO SPECIFIC STATE (When shipmentType === 'Document')
  // ----------------------------------------------------
  const [docEnvelopeType, setDocEnvelopeType] = useState(`${COMPANY_SHORT} Waterproof Pouch`);
  const [docSealNumber, setDocSealNumber] = useState(() => generateReference('seal'));
  const [docDirectSignOnly, setDocDirectSignOnly] = useState(true);
  const [docUrgentDeadline, setDocUrgentDeadline] = useState('By 10:30 AM Next Business Day');
  const [docFilingCourtRef, setDocFilingCourtRef] = useState('CASE-2026-NY-4481');
  const [docContentsDescription, setDocContentsDescription] = useState('Executed Commercial Vehicle Titles & Sales Contracts (35 Pages)');

  // ----------------------------------------------------
  // PETS & LIVE ANIMAL SPECIFIC STATE (When shipmentType === 'Pets')
  // ----------------------------------------------------
  const [petName, setPetName] = useState('Barnaby');
  const [petSpecies, setPetSpecies] = useState('Canine (Dog)');
  const [petBreed, setPetBreed] = useState('Golden Retriever');
  const [petAge, setPetAge] = useState('3 Years');
  const [petGender, setPetGender] = useState('Male (Neutered)');
  const [petWeightLbs, setPetWeightLbs] = useState<number>(68);
  const [petMicrochip, setPetMicrochip] = useState('985141002849102');
  const [petCollarTag, setPetCollarTag] = useState('Barnaby • (212) 555-0199');

  // Travel Crate & IATA LAR Compliance
  const [petCrateType, setPetCrateType] = useState('IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)');
  const [petCrateLength, setPetCrateLength] = useState<number>(36);
  const [petCrateWidth, setPetCrateWidth] = useState<number>(25);
  const [petCrateHeight, setPetCrateHeight] = useState<number>(27);
  const [petCrateWeightLbs, setPetCrateWeightLbs] = useState<number>(22);
  const [petIsBrachycephalic, setPetIsBrachycephalic] = useState<boolean>(false);

  // Veterinary & Health Certificates
  const [petHealthCertNumber, setPetHealthCertNumber] = useState('CVI-NY-2026-88194');
  const [petRabiesTag, setPetRabiesTag] = useState('RAB-2027-11-04 (NY Dept of Health)');
  const [petVetClinic, setPetVetClinic] = useState('Manhattan Animal Health Hospital');
  const [petVetPhone, setPetVetPhone] = useState('(212) 555-0149');
  const [petAcclimationCert, setPetAcclimationCert] = useState<boolean>(true);

  // Care & Welfare Directives
  const [petLastFed, setPetLastFed] = useState('4 Hours Prior to Tender (Light Meal)');
  const [petWaterProtocol, setPetWaterProtocol] = useState('Fresh spring water refreshed at every terminal transfer waypoint');
  const [petSpecialInstructions, setPetSpecialInstructions] = useState('Gentle handling; favorite comfort blanket inside crate. No sedation per AVMA protocol.');
  const [petCareDirectives, setPetCareDirectives] = useState<string[]>([
    'Dual Door-Accessible Food/Water Dishes Attached',
    'IATA Live Animals (AVI) Green Label Affixed',
    'Active Climate Control 68°F-74°F Hold Guaranteed',
    'Absorbent Bedding Layer Pre-Installed',
    'Emergency 24/7 Vet On-Call Authorized'
  ]);

  const handleTogglePetDirective = (directive: string) => {
    setPetCareDirectives(prev =>
      prev.includes(directive) ? prev.filter(d => d !== directive) : [...prev, directive]
    );
  };
  const [senderName, setSenderName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderCountry, setSenderCountry] = useState('');
  const [senderCity, setSenderCity] = useState('');
  const [senderState, setSenderState] = useState('');
  const [senderZip, setSenderZip] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');

  // Warns (doesn't block, same as dateOrderWarning below) when the State field isn't a real
  // US state/territory code. Geocoding silently falls back to the geographic center of the
  // continental US when it can't recognize a state at all — with a typo like a county name
  // ("DENTON" instead of "TX") that fallback previously had no visible signal at all, so a
  // real shipment's route/map/distance quietly rendered toward the wrong part of the country.
  const isRecognizedState = (raw: string): boolean => {
    const val = raw.trim().toUpperCase();
    if (!val) return true; // empty is handled elsewhere as required/optional, not a bad-value warning
    if (STATE_NAMES[val]) return true;
    return Object.values(STATE_NAMES).some(name => name.toUpperCase() === val);
  };
  const senderStateWarning = React.useMemo(() => {
    if (senderCountry !== 'US' || isRecognizedState(senderState)) return null;
    return `"${senderState}" isn't a recognized US state — did you mean the state, not a city or county? Unrecognized states silently route to the middle of the country on the map.`;
  }, [senderState, senderCountry]);
  const recipientStateWarning = React.useMemo(() => {
    if (recipientCountry !== 'US' || isRecognizedState(recipientState)) return null;
    return `"${recipientState}" isn't a recognized US state — did you mean the state, not a city or county? Unrecognized states silently route to the middle of the country on the map.`;
  }, [recipientState, recipientCountry]);

  // ----------------------------------------------------
  // STEP 3: Packages (For Non-Vehicle Cargo)
  // ----------------------------------------------------
  const [packagesList, setPackagesList] = useState<PackageItem[]>([
    {
      id: '1',
      type: 'Box',
      weightLbs: 45.0,
      length: 72,
      width: 24,
      height: 18,
      description: 'Generator spare parts (factory packed)'
    }
  ]);

  // ----------------------------------------------------
  // STEP 4: Route & Intake Location
  // ----------------------------------------------------
  const [initialLocationMode, setInitialLocationMode] = useState<'NOT_RECEIVED' | 'ORIGIN' | 'CUSTOM'>('ORIGIN');
  const [customInitialLocation, setCustomInitialLocation] = useState('New York Gateway Facility');

  // ----------------------------------------------------
  // STEP 5: Service & Operational Requirements
  // ----------------------------------------------------
  const [pickupDate, setPickupDate] = useState('2026-08-19');
  const [pickupWindow, setPickupWindow] = useState('09:00 AM - 12:00 PM');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('August 22, 2026');
  const [expectedDeliveryDateTouched, setExpectedDeliveryDateTouched] = useState(false);

  // Warns (doesn't block — the admin can still legitimately need to record a same-day or
  // manually-overridden date) when the ETA is chronologically before the pickup date, e.g. a
  // typo'd manual override. Silently skips the check if either date can't be parsed rather
  // than showing a false warning on well-formed input this simple parser doesn't recognize.
  const dateOrderWarning = React.useMemo(() => {
    if (!pickupDate || !expectedDeliveryDate) return null;
    const pickup = new Date(pickupDate);
    const delivery = new Date(expectedDeliveryDate);
    if (isNaN(pickup.getTime()) || isNaN(delivery.getTime())) return null;
    if (delivery.getTime() < pickup.getTime()) {
      return `Expected delivery date is before the pickup date (${pickup.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).`;
    }
    return null;
  }, [pickupDate, expectedDeliveryDate]);
  const [isFragile, setIsFragile] = useState(false);
  const [isOversized, setIsOversized] = useState(true);
  const [isSpecialHandling, setIsSpecialHandling] = useState(true);
  const [isSignatureRequired, setIsSignatureRequired] = useState(true);
  const [isOtherHandling, setIsOtherHandling] = useState(false);
  const [otherHandlingInstructions, setOtherHandlingInstructions] = useState('');

  // ----------------------------------------------------
  // STEP 6: Pricing (administrator only)
  // ----------------------------------------------------
  const [baseRate, setBaseRate] = useState<number>(shipmentType === 'Vehicle' ? 1450.00 : 125.00);
  const [additionalCharges, setAdditionalCharges] = useState<number>(shipmentType === 'Vehicle' ? 150.00 : 25.00);
  const [surcharges, setSurcharges] = useState<number>(shipmentType === 'Vehicle' ? 95.00 : 12.50);
  const [discount, setDiscount] = useState<number>(0.00);
  const [manualAdjustment, setManualAdjustment] = useState<number>(0.00);
  const [internalPricingNotes, setInternalPricingNotes] = useState('Private negotiated commercial tariff rate.');

  // ----------------------------------------------------
  // STEP 7 / Creation State
  // ----------------------------------------------------
  // Set from the server's response on create: the server assigns every tracking ID
  // (BRAND_GUIDE §7). Until then the UI shows the NGF····· placeholder.
  const [generatedTrackingNumber, setGeneratedTrackingNumber] = useState<string>('');
  const [createdShipmentRecord, setCreatedShipmentRecord] = useState<Shipment | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);

  // Live preview of the actual computed delivery plan (same engine used at final submit),
  // so the "Expected Delivery Date (ETA)" field shown to the admin reflects a real,
  // route-aware estimate instead of a static, unrelated hardcoded default — while still
  // letting the admin type their own override, which is honored once touched.
  const previewEstimatedDeliveryDate = React.useMemo(() => {
    try {
      // Offline, country-aware lookup; no estimate until both ends can be placed.
      const originGeo = resolveAddress({ city: senderCity, region: senderState, countryCode: senderCountry });
      const destGeo = resolveAddress({ city: recipientCity, region: recipientState, countryCode: recipientCountry });
      if (!originGeo || !destGeo) return null;
      const routeFrom = { lat: originGeo.lat, lng: originGeo.lng, name: originGeo.city };
      const routeTo = { lat: destGeo.lat, lng: destGeo.lng, name: destGeo.city };
      const routePlan = calculateRouteGeometry(
        routeFrom,
        routeTo,
        inferTransportMode({ mode: transportModeChoice === 'Auto' ? undefined : transportModeChoice, shipmentType, service, origin: routeFrom, destination: routeTo })
      );
      const plan = generateShipmentPlan(
        { city: originGeo.city, state: originGeo.state ?? '', facilityName: (originGeo as any).facilityName },
        { city: destGeo.city, state: destGeo.state ?? '', facilityName: (destGeo as any).facilityName },
        service,
        routePlan.distanceMiles,
        pickupDate
      );
      return plan.estimatedDeliveryDate;
    } catch {
      return null;
    }
  }, [senderCity, senderState, senderCountry, recipientCity, recipientState, recipientCountry, service, pickupDate, transportModeChoice, shipmentType]);

  useEffect(() => {
    if (!expectedDeliveryDateTouched && previewEstimatedDeliveryDate) {
      setExpectedDeliveryDate(previewEstimatedDeliveryDate);
    }
  }, [previewEstimatedDeliveryDate, expectedDeliveryDateTouched]);

  // Adjust base pricing defaults when switching shipment type
  useEffect(() => {
    if (shipmentType === 'Vehicle') {
      setBaseRate(1450.00);
      setAdditionalCharges(150.00);
      setSurcharges(95.00);
      if (!shipmentDescription || shipmentDescription.includes('spare parts') || shipmentDescription.includes('Skid') || shipmentDescription.includes('Container') || shipmentDescription.includes('Gearbox')) {
        setShipmentDescription('2024 Toyota Land Cruiser');
      }
    } else if (shipmentType === 'Pallet') {
      setBaseRate(380.00);
      setAdditionalCharges(45.00);
      setSurcharges(35.00);
      if (!shipmentDescription || shipmentDescription.includes('Land Cruiser') || shipmentDescription.includes('spare parts')) {
        setShipmentDescription('Industrial Machinery Spares (2 Pallet Skids)');
      }
    } else if (shipmentType === 'Container') {
      setBaseRate(2850.00);
      setAdditionalCharges(350.00);
      setSurcharges(180.00);
      if (!shipmentDescription || shipmentDescription.includes('Land Cruiser') || shipmentDescription.includes('spare parts')) {
        setShipmentDescription('Automotive Sub-Assemblies (40HC FCL Container)');
      }
    } else if (shipmentType === 'Freight') {
      setBaseRate(620.00);
      setAdditionalCharges(75.00);
      setSurcharges(55.00);
      if (!shipmentDescription || shipmentDescription.includes('Land Cruiser') || shipmentDescription.includes('spare parts')) {
        setShipmentDescription('Heavy Industrial Gearbox & Drivetrain Unit');
      }
    } else if (shipmentType === 'Document') {
      setBaseRate(45.00);
      setAdditionalCharges(10.00);
      setSurcharges(5.00);
      if (!shipmentDescription || shipmentDescription.includes('Land Cruiser') || shipmentDescription.includes('spare parts')) {
        setShipmentDescription('Executed Commercial Vehicle Titles & Master Agreements');
      }
    } else if (shipmentType === 'Pets') {
      setBaseRate(680.00);
      setAdditionalCharges(120.00);
      setSurcharges(85.00);
      if (!shipmentDescription || shipmentDescription.includes('Land Cruiser') || shipmentDescription.includes('spare parts') || shipmentDescription.includes('Skid')) {
        setShipmentDescription('Live Animal / Canine Relocation (Barnaby - Golden Retriever)');
      }
    } else {
      if (baseRate === 1450.00 || baseRate === 2850.00 || baseRate === 380.00 || baseRate === 620.00 || baseRate === 45.00 || baseRate === 680.00) {
        setBaseRate(125.00);
        setAdditionalCharges(25.00);
        setSurcharges(12.50);
      }
    }
  }, [shipmentType]);

  // Computed Totals for all Cargo Handling Categories
  const totalWeight = shipmentType === 'Vehicle'
    ? parseFloat(vehWeightLbs) || 4445
    : shipmentType === 'Pallet'
    ? (palletCount || 1) * (palletWeightPerSkid || 850)
    : shipmentType === 'Container'
    ? parseFloat(containerVgmWeight) || 48200
    : shipmentType === 'Freight'
    ? freightTotalWeightLbs || 1850
    : shipmentType === 'Document'
    ? 0.5
    : shipmentType === 'Pets'
    ? (petWeightLbs || 68) + (petCrateWeightLbs || 22)
    : packagesList.reduce((acc, p) => acc + (Number(p.weightLbs) || 0), 0);

  const totalPieces = shipmentType === 'Vehicle'
    ? 1
    : shipmentType === 'Pallet'
    ? palletCount || 1
    : shipmentType === 'Container'
    ? 1
    : shipmentType === 'Freight'
    ? freightPiecesCount || 1
    : shipmentType === 'Document'
    ? 1
    : shipmentType === 'Pets'
    ? 1
    : packagesList.length;

  const finalPrice = Math.max(0, (baseRate + additionalCharges + surcharges + manualAdjustment) - discount);

  // Quick Copy Sender to Recipient
  const handleCopySenderToRecipient = () => {
    setRecipientName(senderName);
    setRecipientCompany(senderCompany);
    setRecipientEmail(senderEmail);
    setRecipientPhone(senderPhone);
    setRecipientAddress(senderAddress);
    setRecipientCountry(senderCountry);
    setRecipientCity(senderCity);
    setRecipientState(senderState);
    setRecipientZip(senderZip);
  };


  // Autonomous Geocoding on ZIP code change
  const handleSenderZipChange = (zip: string) => {
    setSenderZip(zip);
    if (senderCountry === 'US' && zip.trim().length >= 5) {
      const geo = resolveLocation(zip);
      if (geo) {
        setSenderCity(geo.city);
        setSenderState(geo.state ?? '');
      }
    }
  };

  const handleRecipientZipChange = (zip: string) => {
    setRecipientZip(zip);
    if (recipientCountry === 'US' && zip.trim().length >= 5) {
      const geo = resolveLocation(zip);
      if (geo) {
        setRecipientCity(geo.city);
        setRecipientState(geo.state ?? '');
      }
    }
  };

  // Add Package Item
  const handleAddPackage = () => {
    setPackagesList(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'Box',
        weightLbs: 10.0,
        length: 18,
        width: 12,
        height: 10,
        description: 'Supplementary cargo package'
      }
    ]);
  };

  // Remove Package Item
  const handleRemovePackage = (id: string) => {
    if (packagesList.length <= 1) return;
    setPackagesList(prev => prev.filter(p => p.id !== id));
  };

  // Update Package Field
  const handleUpdatePackage = (id: string, field: keyof PackageItem, value: any) => {
    setPackagesList(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Toggle Damage Checklist
  const handleToggleDamage = (item: string) => {
    setDamageChecklist(prev =>
      prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item]
    );
  };

  // Toggle Item Received
  const handleToggleItemReceived = (item: string) => {
    setItemsReceived(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // Load Preset Test Data (All Cargo Categories)
  const handleLoadPreset = (
    type: 'vehicle_suv' | 'skid_pallet' | 'ocean_container' | 'heavy_freight' | 'legal_doc' | 'live_pet' | 'parts_parcel' | 'electronics'
  ) => {
    if (type === 'vehicle_suv') {
      setShipmentType('Vehicle');
      setCargoCategory('Automotive & Parts');
      setShipmentDescription('2024 Toyota Land Cruiser');
      setVehMake('Toyota');
      setVehModel('Land Cruiser');
      setVehYear('2024');
      setVehColor('White');
      setVehVin('');
      setVehBodyType('SUV / Crossover');
      setVehOperable(true);
      setVehCondition('Pristine');
      setVehWeightLbs('5490');
      setVehLengthIn('195');
      setVehWidthIn('78');
      setVehHeightIn('75');
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'skid_pallet') {
      setShipmentType('Pallet');
      setCargoCategory('Industrial Machinery');
      setShipmentDescription('Industrial Machine Components (2 Pallet Skids)');
      setPalletStandard('GMA Standard 48×40 in (US Wood)');
      setPalletCount(2);
      setPalletWeightPerSkid(850);
      setPalletHeightIn(54);
      setPalletStackable(false);
      setPalletForkliftAccess('4-Way Forklift Entry');
      setPalletSecuringChecks([
        'Heat-Treated (ISPM-15 Certified)',
        'Heavy Gauge Stretch-Wrapped',
        'Steel Banded / Strapped',
        'Corner Edge Protectors'
      ]);
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'ocean_container') {
      setShipmentType('Container');
      setCargoCategory('Automotive & Parts');
      setShipmentDescription('Automotive Sub-Assemblies (40HC FCL Container)');
      setContainerNumber('MSCU-749102-3');
      setContainerIsoSize('40ft High-Cube Dry Van (40HC / 9ft 6in)');
      setContainerBoltSeal('HSS-NY-984021');
      setContainerTerminal('Port of New York / Newark Container Terminal (PNCT)');
      setContainerChassisNumber('CHAS-8812 (Tri-axle)');
      setContainerVgmWeight('48200');
      setContainerTemperature('Ambient / Dry Cargo');
      setContainerCustomsStatus('Pre-Cleared / Manifest Approved');
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'heavy_freight') {
      setShipmentType('Freight');
      setCargoCategory('Industrial Machinery');
      setShipmentDescription('Heavy Industrial Gearbox & Transmission Unit');
      setFreightClass('Class 70 (Machinery, auto parts)');
      setFreightNmfcCode('NMFC 18260-Sub 2');
      setFreightPiecesCount(1);
      setFreightTotalWeightLbs(1850);
      setFreightLoadingMethod('Standard Raised Commercial Loading Dock (48" Dock Height)');
      setFreightLiftgatePickup(false);
      setFreightLiftgateDelivery(true);
      setFreightHazMat(false);
      setService('Priority');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'legal_doc') {
      setShipmentType('Document');
      setCargoCategory('Legal & Documents');
      setShipmentDescription('Executed Commercial Vehicle Titles & Sales Contracts (35 Pages)');
      setDocEnvelopeType(`${COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)`);
      setDocSealNumber(generateReference('seal'));
      setDocDirectSignOnly(true);
      setDocUrgentDeadline('By 10:30 AM Next Business Day (Priority Legal)');
      setDocFilingCourtRef('CASE-2026-NY-4481');
      setDocContentsDescription('Executed Commercial Vehicle Titles & Sales Contracts (35 Pages)');
      setService('Priority');
      setIsSignatureRequired(true);
    } else if (type === 'live_pet') {
      setShipmentType('Pets');
      setCargoCategory('Live Animals & Pets (USDA / IPATA Regulated)');
      setShipmentDescription('Live Animal / Canine Relocation (Barnaby - Golden Retriever)');
      setPetName('Barnaby');
      setPetSpecies('Canine (Dog)');
      setPetBreed('Golden Retriever');
      setPetAge('3 Years');
      setPetGender('Male (Neutered)');
      setPetWeightLbs(68);
      setPetMicrochip('985141002849102');
      setPetCollarTag('Barnaby • (212) 555-0199');
      setPetCrateType('IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)');
      setPetCrateLength(36);
      setPetCrateWidth(25);
      setPetCrateHeight(27);
      setPetCrateWeightLbs(22);
      setPetIsBrachycephalic(false);
      setPetHealthCertNumber('CVI-NY-2026-88194');
      setPetRabiesTag('RAB-2027-11-04 (NY Dept of Health)');
      setPetVetClinic('Manhattan Animal Health Hospital');
      setPetVetPhone('(212) 555-0149');
      setPetAcclimationCert(true);
      setPetLastFed('4 Hours Prior to Tender (Light Meal)');
      setPetWaterProtocol('Fresh spring water refreshed at every terminal transfer waypoint');
      setPetSpecialInstructions('Gentle handling; favorite comfort blanket inside crate. No sedation per AVMA protocol.');
      setService('Priority');
      setIsSpecialHandling(true);
    } else if (type === 'parts_parcel') {
      setShipmentType('Parcel');
      setCargoCategory('Automotive & Parts');
      setShipmentDescription('Generator spare parts');
      setService('Express');
      setPackagesList([
        {
          id: '1',
          type: 'Box',
          weightLbs: 45.0,
          length: 72,
          width: 24,
          height: 18,
          description: 'Generator spare parts'
        }
      ]);
      setIsOversized(true);
    } else {
      setShipmentType('Parcel');
      setCargoCategory('Electronics & Tech');
      setShipmentDescription('Apple MacBook Pro M3 Max Workstations');
      setService('Express');
      setPackagesList([
        {
          id: '1',
          type: 'Box',
          weightLbs: 14.5,
          length: 20,
          width: 15,
          height: 10,
          description: 'MacBook Pro units (Qty 2)'
        }
      ]);
      setIsOversized(false);
    }
  };

  // Save Draft
  const handleSaveDraft = () => {
    const draftData = {
      shipmentType,
      cargoCategory,
      shipmentDescription,
      service,
      customerRef,
      senderName,
      senderCity,
      recipientName,
      recipientCity,
      packagesList,
      vehVin,
      finalPrice
    };
    try {
      localStorage.setItem('sdl_admin_shipment_draft', JSON.stringify(draftData));
      setDraftSavedToast('Draft manifest saved to local session.');
      setTimeout(() => setDraftSavedToast(null), 3000);
    } catch {
      setDraftSavedToast('Draft saved.');
      setTimeout(() => setDraftSavedToast(null), 3000);
    }
  };

  // Validation per step (non-blocking so the administrator can move freely between steps)
  const validateStep = (_step?: number): boolean => {
    setErrors({});
    return true;
  };

  const handleNextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Final Action: Create Shipment
  const handleFinalCreateShipment = async () => {
    if (isCreatingShipment) return;
    setIsCreatingShipment(true);
    // Piece labels (NGFxxxxx-NN) are stamped from the server-assigned ID in createShipment.
    const formattedPieces = shipmentType === 'Vehicle'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Vehicle Manifest Created' : 'Vehicle Ingested & Inspected',
            currentLocation: [senderCity.trim(), shortRegion(senderCountry, senderState)].filter(Boolean).join(', '),
            weightLbs: parseFloat(vehWeightLbs) || 4445,
            dimensions: {
              length: parseFloat(vehLengthIn) || 213,
              width: parseFloat(vehWidthIn) || 75,
              height: parseFloat(vehHeightIn) || 71
            }
          }
        ]
      : shipmentType === 'Pallet'
      ? Array.from({ length: Math.max(1, palletCount) }, (_, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: palletCount,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Skid Manifested' : 'Skid Received & Scanned',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: palletWeightPerSkid || 850,
          dimensions: {
            length: 48,
            width: 40,
            height: palletHeightIn || 54
          }
        }))
      : shipmentType === 'Container'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Container Booked' : 'Container Ingested at Terminal',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: parseFloat(containerVgmWeight) || 48200,
            dimensions: {
              length: 480,
              width: 96,
              height: 114
            }
          }
        ]
      : shipmentType === 'Freight'
      ? Array.from({ length: Math.max(1, freightPiecesCount) }, (_, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: freightPiecesCount,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Freight Linehaul Manifested' : 'Freight Ingested at Raised Dock',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: Math.round((freightTotalWeightLbs || 1850) / (freightPiecesCount || 1)),
          dimensions: {
            length: 60,
            width: 48,
            height: 52
          }
        }))
      : shipmentType === 'Document'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Document Pouch Registered' : 'Document Pouch Sealed & Logged',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: 0.5,
            dimensions: {
              length: 16,
              width: 12,
              height: 1
            }
          }
        ]
      : shipmentType === 'Pets'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Pet Relocation Manifest Created' : 'Live Pet Health Ingested & Staged',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: (petWeightLbs || 68) + (petCrateWeightLbs || 22),
            dimensions: {
              length: petCrateLength || 36,
              width: petCrateWidth || 25,
              height: petCrateHeight || 27
            }
          }
        ]
      : packagesList.map((p, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: packagesList.length,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Shipment Created' : 'Shipment Received at Origin',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: p.weightLbs,
          dimensions: {
            length: p.length,
            width: p.width,
            height: p.height
          }
        }));

    // Country is picked from the list; the country-aware lookup is instant for gateways and
    // U.S. metros and asks the live geocoder (restricted to that country) for anything else.
    // An address that can't be placed stops here instead of landing somewhere made up.
    if (!senderCountry || !recipientCountry || !senderCity.trim() || !recipientCity.trim()) {
      setErrors({ submit: 'Choose the country and enter the city for both the sender and the recipient (step 2).' });
      setIsCreatingShipment(false);
      return;
    }
    const [originGeo, destGeo] = await Promise.all([
      resolveAddressPrecise({ street: senderAddress, city: senderCity, region: senderState, countryCode: senderCountry }, getCountry(senderCountry)?.name),
      resolveAddressPrecise({ street: recipientAddress, city: recipientCity, region: recipientState, countryCode: recipientCountry }, getCountry(recipientCountry)?.name)
    ]);
    if (!originGeo || !destGeo) {
      const missing = !originGeo ? `${senderCity}, ${getCountry(senderCountry)?.name}` : `${recipientCity}, ${getCountry(recipientCountry)?.name}`;
      setErrors({ submit: `Couldn't locate ${missing}. Check the city and country (step 2) and try again.` });
      setIsCreatingShipment(false);
      return;
    }
    const originRegion = shortRegion(senderCountry, senderState) || originGeo.state || '';
    const destRegion = shortRegion(recipientCountry, recipientState) || destGeo.state || '';
    const routeFrom = { lat: originGeo.lat, lng: originGeo.lng, name: originGeo.city };
    const routeTo = { lat: destGeo.lat, lng: destGeo.lng, name: destGeo.city };
    const chosenMode = transportModeChoice === 'Auto' ? undefined : transportModeChoice;
    const routePlan = calculateRouteGeometry(
      routeFrom,
      routeTo,
      inferTransportMode({ mode: chosenMode, shipmentType, service, origin: routeFrom, destination: routeTo })
    );
    const shipmentPlan = generateShipmentPlan(
      { city: originGeo.city, state: originGeo.state ?? '', facilityName: originGeo.facilityName },
      { city: destGeo.city, state: destGeo.state ?? '', facilityName: destGeo.facilityName },
      service,
      routePlan.distanceMiles,
      pickupDate
    );

    const initialTimeline: TrackingEvent[] = [
      {
        id: `evt-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        timezone: originGeo.timezone,
        displayDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        displayTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        title: initialLocationMode === 'NOT_RECEIVED'
          ? (shipmentType === 'Vehicle' ? 'Vehicle Consignment Registered' :
             shipmentType === 'Pallet' ? 'Pallet Consignment Registered' :
             shipmentType === 'Container' ? 'Intermodal FCL Booking Registered' :
             shipmentType === 'Freight' ? 'Freight Linehaul Tender Registered' :
             shipmentType === 'Document' ? 'Document Chain of Custody Registered' :
             shipmentType === 'Pets' ? 'Live Pet Transport Booking Registered' :
             'Shipment Record Created')
          : (shipmentType === 'Vehicle' ? `Vehicle Received & Inspected — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Pallet' ? `Pallet Skids Ingested & Scanned — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Container' ? `FCL Container Ingested at Terminal — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Freight' ? `Heavy Freight Ingested at Dock — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Document' ? `Document Pouch Sealed & Logged — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Pets' ? `Live Animal (${petName}) Ingested & Health Inspected — ${originGeo.city}, ${originGeo.state}` :
             'Shipment Received & Ingested'),
        facility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName,
        city: originGeo.city,
        state: originGeo.state ?? '',
        description: initialLocationMode === 'NOT_RECEIVED'
          ? `Physical waybill registered by ${ADMIN_ROLE_LABEL}. Awaiting carrier collection.`
          : (shipmentType === 'Vehicle'
              ? `${vehYear} ${vehMake} ${vehModel} (VIN: ${vehVin}) inspected and physically received. Key custody verified.`
              : shipmentType === 'Pallet'
              ? `${palletCount} skids (${palletStandard}) verified. Stackability: ${palletStackable ? 'Stackable' : 'Non-Stackable (Top-Tier)'}. ISPM-15 compliant.`
              : shipmentType === 'Container'
              ? `Container ${containerNumber} received at terminal. Bolt Seal: ${containerBoltSeal}. VGM: ${bothUnits(containerVgmWeight)}.`
              : shipmentType === 'Freight'
              ? `Heavy freight (${freightClass}, ${freightNmfcCode}) received via commercial raised dock. Liftgate delivery: ${freightLiftgateDelivery ? 'Yes' : 'No'}.`
              : shipmentType === 'Document'
              ? `Security Pouch Sealed (${docSealNumber}). Direct consignee signature directive active.`
              : shipmentType === 'Pets'
              ? `Live animal ${petName} (${petBreed}, ${bothUnits(petWeightLbs)}) received. Microchip ${petMicrochip} verified against CVI #${petHealthCertNumber}. Dual dishes & climate kennel confirmed.`
              : `Shipment physically received at ${originGeo.city}, ${originGeo.state}. Code 128 barcode applied.`),
        isCurrent: true,
        isCompleted: true,
        operatorId: ADMIN_ROLE_LABEL
      }
    ];

    const newShipmentRecord: Shipment = {
      trackingNumber: '',
      status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
      statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Manifest Created' : 'Received at Origin Facility',
      statusMessage: shipmentType === 'Vehicle'
        ? `Vehicle Cargo (${vehYear} ${vehMake} ${vehModel}) received. VIN: ${vehVin}. Operable.`
        : shipmentType === 'Pallet'
        ? `Pallet Cargo (${palletCount} Skids, ${bothUnits(totalWeight)}). ${palletStackable ? 'Stackable' : 'Non-Stackable (Top-Tier Only)'}.`
        : shipmentType === 'Container'
        ? `Container ${containerNumber} (${containerIsoSize.split(' ')[0]}). Seal: ${containerBoltSeal}. VGM: ${bothUnits(containerVgmWeight)}.`
        : shipmentType === 'Freight'
        ? `Heavy Freight (${freightClass}, ${freightNmfcCode}). Weight: ${bothUnits(totalWeight)}.`
        : shipmentType === 'Document'
        ? `Secure Document (${docEnvelopeType.split(' ')[0]}). Seal: ${docSealNumber}. Direct In-Person Signature Required.`
        : shipmentType === 'Pets'
        ? `Live Pet Cargo: ${petName} (${petBreed}). Microchip: ${petMicrochip}. CVI: ${petHealthCertNumber}. Active Climate Hold Guaranteed.`
        : `Consignment provisioned. ${totalPieces} package(s) totalling ${bothUnits(totalWeight)}.`,
      health: 'ON_TRACK',
      healthExplanation: 'Consignment created on schedule with verified physical barcodes.',
      progressPercent: initialLocationMode === 'NOT_RECEIVED' ? 0 : 5,
      shipmentType: shipmentType === 'Multi-piece' ? 'Parcel' : shipmentType,
      cargoCategory,
      cargoDescription: shipmentDescription,
      petDetails: shipmentType === 'Pets' ? {
        name: petName,
        species: petSpecies,
        breed: petBreed,
        age: petAge,
        gender: petGender,
        microchipNumber: petMicrochip,
        weightLbs: petWeightLbs,
        crateType: petCrateType,
        crateDimensions: { length: petCrateLength, width: petCrateWidth, height: petCrateHeight },
        healthCertificateNumber: petHealthCertNumber,
        rabiesVaccineNumber: petRabiesTag,
        vetClinicName: petVetClinic,
        vetPhone: petVetPhone,
        isBrachycephalic: petIsBrachycephalic,
        acclimationCertified: petAcclimationCert,
        lastFedTimestamp: petLastFed,
        waterRefillProtocol: petWaterProtocol,
        specialCareNotes: petSpecialInstructions
      } : undefined,
      vehicleDetails: shipmentType === 'Vehicle' ? {
        make: vehMake,
        model: vehModel,
        year: parseInt(vehYear) || 2024,
        vin: vehVin,
        color: vehColor,
        bodyType: vehBodyType,
        operable: vehOperable,
        condition: vehCondition,
        existingDamage: damageChecklist,
        inspectionNotes,
        itemsReceived
      } : undefined,
      palletDetails: shipmentType === 'Pallet' ? {
        standard: palletStandard,
        count: palletCount,
        weightPerSkidLbs: palletWeightPerSkid,
        heightIn: palletHeightIn,
        stackable: palletStackable,
        forkliftAccess: palletForkliftAccess,
        securingChecks: palletSecuringChecks
      } : undefined,
      containerDetails: shipmentType === 'Container' ? {
        containerNumber,
        isoSize: containerIsoSize,
        boltSeal: containerBoltSeal,
        chassisNumber: containerChassisNumber,
        terminal: containerTerminal,
        vgmWeightLbs: parseFloat(containerVgmWeight) || 0,
        temperature: containerTemperature,
        customsStatus: containerCustomsStatus
      } : undefined,
      freightDetails: shipmentType === 'Freight' ? {
        freightClass,
        nmfcCode: freightNmfcCode,
        loadingMethod: freightLoadingMethod,
        liftgatePickup: freightLiftgatePickup,
        liftgateDelivery: freightLiftgateDelivery,
        hazMat: freightHazMat,
        unNumber: freightUnNumber || undefined,
        piecesCount: freightPiecesCount,
        totalWeightLbs: freightTotalWeightLbs
      } : undefined,
      documentDetails: shipmentType === 'Document' ? {
        envelopeType: docEnvelopeType,
        sealNumber: docSealNumber,
        directSignOnly: docDirectSignOnly,
        urgentDeadline: docUrgentDeadline,
        filingCourtRef: docFilingCourtRef || undefined,
        contentsDescription: docContentsDescription
      } : undefined,
      service: service === 'Priority' ? 'Priority' : service === 'Freight' ? 'Freight LTL' : service === 'Standard' ? 'Standard' : 'Express',
      transportMode: chosenMode,
      shipmentDate: new Date().toISOString().split('T')[0],
      // Honors the admin's manual ETA override if they typed one; otherwise this already
      // equals the same route-aware calculated date shown live in the Service step.
      estimatedDelivery: expectedDeliveryDate || shipmentPlan.estimatedDeliveryDate,
      estimatedDeliveryDetail: 'by ' + shipmentPlan.estimatedDeliveryTime,
      currentLocation: {
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        lat: originGeo.lat,
        lng: originGeo.lng,
        facility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName
      } as any,
      currentFacility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName,
      lastUpdated: 'Just now',
      nextStep: shipmentType === 'Vehicle' ? 'Corridor Dispatch & Staging' : 'Linehaul Sorting & Dispatch',
      nextStepLocation: `${originGeo.city} Sort Gateway`,
      origin: {
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        country: getCountry(senderCountry)?.name || '',
        lat: originGeo.lat,
        lng: originGeo.lng,
        facility: originGeo.facilityName
      } as any,
      destination: {
        city: recipientCity.trim() || destGeo.city,
        state: destRegion,
        country: getCountry(recipientCountry)?.name || '',
        lat: destGeo.lat,
        lng: destGeo.lng,
        facility: destGeo.facilityName
      } as any,
      sender: {
        name: senderName.trim() || 'Sender / Shipper',
        company: senderCompany.trim(),
        addressLine: senderAddress.trim(),
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        region: senderState.trim() || undefined,
        postalCode: senderZip.trim() || undefined,
        phone: senderPhone.trim(),
        email: senderEmail.trim(),
        country: getCountry(senderCountry)?.name || '',
        countryCode: senderCountry
      },
      recipient: {
        name: recipientName.trim() || 'Consignee / Recipient',
        company: recipientCompany.trim(),
        addressLine: recipientAddress.trim(),
        city: recipientCity.trim() || destGeo.city,
        state: destRegion,
        region: recipientState.trim() || undefined,
        postalCode: recipientZip.trim() || undefined,
        phone: recipientPhone.trim(),
        email: recipientEmail.trim(),
        country: getCountry(recipientCountry)?.name || '',
        countryCode: recipientCountry
      },
      totalWeightLbs: totalWeight,
      totalPieces: totalPieces,
      dimensions: shipmentType === 'Vehicle'
        ? { length: parseFloat(vehLengthIn) || 213, width: parseFloat(vehWidthIn) || 75, height: parseFloat(vehHeightIn) || 71 }
        : (packagesList[0] ? { length: packagesList[0].length, width: packagesList[0].width, height: packagesList[0].height } : { length: 12, width: 12, height: 12 }),
      references: {
        customerReference: customerRef || undefined,
        orderNumber: internalRef || undefined,
        invoiceNumber: invoiceRef || undefined
      },
      routeCheckpoints: [
        { id: '1', name: `${originGeo.city}, ${originGeo.state}`, state: originGeo.state ?? '', type: 'origin', statusLabel: 'Ingested', lat: originGeo.lat, lng: originGeo.lng },
        { id: '2', name: `${destGeo.city}, ${destGeo.state}`, state: destGeo.state ?? '', type: 'destination', statusLabel: 'Destination', lat: destGeo.lat, lng: destGeo.lng }
      ],
      timeline: initialTimeline,
      pieces: formattedPieces,
      passportStages: [
        { id: 'p1', label: 'Tender Registered', sublabel: `${senderCity} Origin`, status: 'completed' },
        { id: 'p2', label: 'Corridor Movement', sublabel: 'En Route', status: 'upcoming' },
        { id: 'p3', label: 'Destination Arrival', sublabel: `${recipientCity} Hub`, status: 'upcoming' },
        { id: 'p4', label: 'Final Handover', sublabel: 'Signature Required', status: 'upcoming' }
      ],
      handlingRequirements: {
        fragile: isFragile,
        oversized: isOversized,
        specialHandling: isSpecialHandling,
        signatureRequired: isSignatureRequired,
        otherInstructions: isOtherHandling ? otherHandlingInstructions : undefined
      },
      pickupWindow: `${pickupDate} · ${pickupWindow}`,
      internalPricingNote: internalPricingNotes || undefined
    };

    // 1. Save into central Admin Context & persistent database. The server assigns the
    // tracking ID; everything below uses the one it returned.
    let created: Shipment;
    try {
      created = await createShipment(newShipmentRecord);
    } catch (err: any) {
      setErrors({ submit: `Could not register the shipment: ${err?.message || 'the server did not respond'}. Nothing was saved; please try again.` });
      setIsCreatingShipment(false);
      return;
    }
    const trackingNumber = created.trackingNumber;
    setGeneratedTrackingNumber(trackingNumber);

    // 2. Automatically generate the transport document (Bill of Lading, or Air Waybill for air)
    // in the Document Center, from what was entered in the wizard only: the seal is the real
    // document-pouch seal (document shipments), instructions are the admin's own handling notes.
    const bolSealNumber = shipmentType === 'Document' ? docSealNumber : undefined;
    const bolSpecialInstructions = newShipmentRecord.handlingRequirements?.otherInstructions || undefined;

    try {
      generateDocument({
        docType: 'BOL',
        title: `${documentTitle('BOL', created.transportMode || newShipmentRecord.transportMode)} (${trackingNumber})`,
        shipmentTracking: trackingNumber,
        senderName: senderName || 'Origin Consignor',
        senderCompany: senderCompany || INTAKE_DESK,
        senderAddress: senderAddress,
        senderCity: senderCity,
        senderState: senderState,
        senderZip: senderZip,
        senderPhone: senderPhone,
        recipientName: recipientName || 'Destination Consignee',
        recipientCompany: recipientCompany || 'Consignee Receiver',
        recipientAddress: recipientAddress,
        recipientCity: recipientCity,
        recipientState: recipientState,
        recipientZip: recipientZip,
        recipientPhone: recipientPhone,
        cargoDescription: shipmentDescription || 'Commercial Freight Cargo',
        shipmentType: shipmentType,
        service: service,
        weightLbs: totalWeight,
        pieces: totalPieces,
        dimensions: `${newShipmentRecord.dimensions.length}x${newShipmentRecord.dimensions.width}x${newShipmentRecord.dimensions.height} in`,
        declaredValue: newShipmentRecord.declaredValue || 0,
        charges: {
          baseAmount: baseRate,
          oversizeFee: additionalCharges,
          specialHandlingFee: surcharges,
          // Include the discount/manual adjustment the admin set in Step 5 so the total
          // matches the "Final Price" the admin approved. No tax or fuel line is invented.
          totalAmount: Math.max(0, baseRate + additionalCharges + surcharges + manualAdjustment - discount),
          paymentStatus: 'PAID'
        },
        bolCarrier: LEGAL_NAME,
        bolSealNumber,
        bolSpecialInstructions,
        fileSize: '148 KB'
      });
    } catch (e) {
      console.warn('Auto BOL document creation:', e);
    }

    setCreatedShipmentRecord(created);
    setIsCreatingShipment(false);
  };

  const handleCopySuccessTracking = () => {
    navigator.clipboard.writeText(generatedTrackingNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // ----------------------------------------------------
  // SUCCESS STATE VIEW
  // ----------------------------------------------------
  if (createdShipmentRecord) {
    return (
      <div className="shipment-success-view-container animate-fade-in">
        <div className="success-card-panel">
          <div className="success-header-badge">
            <div className="success-icon-wrap">
              <CheckCircle2 size={32} className="text-emerald" />
            </div>
            <h2>Shipment Created Successfully</h2>
            <p>The shipment record and its unique tracking identity have been generated and registered in the system.</p>
          </div>

          {/* Tracking Identity Section */}
          <div className="success-identity-box">
            <span className="identity-label">OFFICIAL TRACKING NUMBER</span>
            <div className="identity-code-row">
              <strong className="tracking-val font-mono">{generatedTrackingNumber}</strong>
              <button
                className="identity-copy-btn"
                onClick={handleCopySuccessTracking}
                title="Copy tracking number"
              >
                {isCopied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Real Code 128 barcode of the new tracking ID */}
            <div className="traditional-barcode-card">
              <TrackingBarcode value={generatedTrackingNumber} height={48} width={1.6} fontSize={12} />
            </div>
          </div>

          {/* Route Summary */}
          <div className="success-route-grid">
            <div className="route-node">
              <span className="r-label">ORIGIN</span>
              <strong>{senderCity}, {senderState}</strong>
              <small>{senderName}</small>
            </div>
            <div className="route-arrow-icon">
              <ArrowRight size={20} className="text-blue" />
            </div>
            <div className="route-node">
              <span className="r-label">DESTINATION</span>
              <strong>{recipientCity}, {recipientState}</strong>
              <small>{recipientName}</small>
            </div>
          </div>

          {/* Key Specs Row */}
          <div className="success-specs-strip">
            <div className="spec-item">
              <span className="s-label">TYPE</span>
              <strong>{shipmentType}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">CARGO</span>
              <strong className="truncate-cargo">{shipmentDescription}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">SERVICE</span>
              <strong>{service}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">TOTAL WEIGHT</span>
              <strong>{formatWeight(totalWeight, units.system)}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="success-action-buttons-grid">
            <button
              className="action-btn primary"
              onClick={() => onOpenShipmentDetail(generatedTrackingNumber)}
            >
              <FileText size={16} />
              <span>View Shipment Record</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              <span>Print Waybill / Label</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => onSelectView('document-center')}
            >
              <FileCheck size={16} />
              <span>Generate Documents</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => {
                setCreatedShipmentRecord(null);
                setCurrentStep(1);
                setGeneratedTrackingNumber('');
              }}
            >
              <Plus size={16} />
              <span>Create Another Shipment</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN MULTI-STEP WORKSPACE VIEW
  // ----------------------------------------------------
  return (
    <div className="sdl-create-shipment-workspace">
      {draftSavedToast && (
        <div className="draft-saved-toast animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{draftSavedToast}</span>
        </div>
      )}

      {/* 1. TOP TITLE & WORKSPACE ACTIONS BAR */}
      <div className="workspace-top-bar">
        <div className="bar-left">
          <button className="back-link-btn" onClick={() => onSelectView('all-shipments')}>
            <ArrowLeft size={14} />
            <span>All Shipments</span>
          </button>
          <div className="page-heading-wrap">
            <h2>Book Master Consignment</h2>
            <p>Register freight, vehicles, parcels, or documents and issue validated tracking credentials.</p>
          </div>
        </div>

        <div className="bar-right">
          <div className="preset-quick-pills">
            <span className="preset-caption">QUICK PRESETS:</span>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('vehicle_suv')}>
              <Car size={13} className="preset-icon-car" />
              <span>Vehicle</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('live_pet')}>
              <PawPrint size={13} className="preset-icon-pet" />
              <span>Live Pet</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('skid_pallet')}>
              <Layers size={13} className="preset-icon-pallet" />
              <span>Pallet Skids</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('ocean_container')}>
              <Container size={13} className="preset-icon-container" />
              <span>Container</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('heavy_freight')}>
              <Truck size={13} className="preset-icon-freight" />
              <span>Heavy Freight</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('legal_doc')}>
              <FileText size={13} className="preset-icon-doc" />
              <span>Legal Doc</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('parts_parcel')}>
              <Package size={13} className="preset-icon-pkg" />
              <span>Parcel</span>
            </button>
          </div>
          <button type="button" className="save-draft-btn" onClick={handleSaveDraft}>
            <Save size={14} />
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      {/* 2. PROGRESS STEP WIDGET (01 to 06) */}
      <div className="step-progress-container">
        {[
          { num: 1, label: 'Shipment', desc: 'Type & Refs' },
          { num: 2, label: 'Parties', desc: 'Shipper & Consignee' },
          {
            num: 3,
            label: shipmentType === 'Vehicle' ? 'Vehicle Cargo'
                 : shipmentType === 'Pallet' ? 'Pallet Deck'
                 : shipmentType === 'Container' ? 'Container Deck'
                 : shipmentType === 'Freight' ? 'Freight Deck'
                 : shipmentType === 'Document' ? 'Document Deck'
                 : shipmentType === 'Pets' ? 'Live Animal Deck'
                 : 'Packages',
            desc: shipmentType === 'Vehicle' ? 'Specs & Inspection'
                : shipmentType === 'Pallet' ? 'Skids & Stackability'
                : shipmentType === 'Container' ? 'ISO & Bolt Seal'
                : shipmentType === 'Freight' ? 'Class & Dock Access'
                : shipmentType === 'Document' ? 'Security & Custody'
                : shipmentType === 'Pets' ? 'Health, Crate & Care'
                : 'Item Manifest'
          },
          { num: 4, label: 'Service', desc: 'Tier & Handling' },
          { num: 5, label: 'Pricing', desc: 'Tariff Rating' },
          { num: 6, label: 'Review & Create', desc: 'Issue Waybill' }
        ].map((s) => {
          const isCompleted = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <button
              key={s.num}
              type="button"
              className={`step-pill ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => setCurrentStep(s.num)}
            >
              <span className="step-index">
                {isCompleted ? <Check size={11} strokeWidth={3} /> : `0${s.num}`}
              </span>
              <div className="step-label-stack">
                <span className="step-text">{s.label}</span>
                <span className="step-sub">{s.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENT: FORM STEP (LEFT) + LIVE SHIPMENT SUMMARY (RIGHT) */}
      <div className="step-form-grid-layout">
        {/* FORM WORKSPACE (LEFT) */}
        <div className="step-form-card">
          {/* ---------------------------------------------------- */}
          {/* STEP 1: SHIPMENT INFORMATION */}
          {/* ---------------------------------------------------- */}
          {currentStep === 1 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <div className="step-heading-badge">STEP 01</div>
                <h3>Shipment Classification & Identifiers</h3>
                <p>Establish what the cargo is, operational handling requirements, and commercial reference codes.</p>
              </div>

              {/* Shipment Type Big Visual Selection */}
              <div className="form-group-block">
                <label className="section-field-label">Cargo Handling Category</label>
                <div className="shipment-type-tiles-grid">
                  {[
                    { id: 'Parcel', label: 'Parcel', icon: <Package size={19} />, colorClass: 'accent', desc: 'Boxed goods & parts' },
                    { id: 'Vehicle', label: 'Vehicle', icon: <Car size={19} />, colorClass: 'blue', desc: 'Cars, trucks & autos' },
                    { id: 'Pets', label: 'Live Pets', icon: <PawPrint size={19} />, colorClass: 'rose', desc: 'Live animal transport' },
                    { id: 'Document', label: 'Document', icon: <FileText size={19} />, colorClass: 'green', desc: 'Envelopes & contracts' },
                    { id: 'Freight', label: 'Freight', icon: <Truck size={19} />, colorClass: 'purple', desc: 'Heavy oversized linehaul' },
                    { id: 'Pallet', label: 'Pallet', icon: <Layers size={19} />, colorClass: 'amber', desc: 'Skidded palletized cargo' },
                    { id: 'Container', label: 'Container', icon: <Container size={19} />, colorClass: 'navy', desc: 'Sealed 20ft/40ft container' },
                    { id: 'Multi-piece', label: 'Multi-piece', icon: <Box size={19} />, colorClass: 'indigo', desc: 'Grouped parcel manifest' }
                  ].map(t => {
                    const isSelected = shipmentType === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`type-tile ${isSelected ? 'active' : ''}`}
                        onClick={() => setShipmentType(t.id as ShipmentTypeOption)}
                      >
                        {isSelected && (
                          <span className="type-tile-selected-badge">
                            <Check size={9} strokeWidth={3.5} />
                          </span>
                        )}
                        <div className={`tile-circle-icon ${t.colorClass}`}>
                          {t.icon}
                        </div>
                        <strong className="tile-title">{t.label}</strong>
                        <small className="tile-desc">{t.desc}</small>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cargo Category & Free-form Description */}
              <div className="form-group-block">
                <label className="section-field-label">Cargo Content & Description</label>
                <p className="field-hint-txt">Describe the items, commodities, or cargo being shipped.</p>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>Cargo Category</label>
                    <select
                      value={cargoCategory}
                      onChange={e => setCargoCategory(e.target.value)}
                    >
                      <option value="Automotive & Parts">Automotive & Parts</option>
                      <option value="Live Animals & Pets (USDA / IPATA Regulated)">Live Animals & Pets (USDA / IPATA Regulated)</option>
                      <option value="General Cargo">General Cargo</option>
                      <option value="Electronics & Tech">Electronics & Tech</option>
                      <option value="Industrial Machinery">Industrial Machinery</option>
                      <option value="Medical & BioTech">Medical & BioTech</option>
                      <option value="Apparel & Textiles">Apparel & Textiles</option>
                      <option value="Legal & Documents">Legal & Documents</option>
                      <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                      <option value="Personal Effects">Personal Effects</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Content / Cargo Description</label>
                    <input
                      type="text"
                      value={shipmentDescription}
                      onChange={e => setShipmentDescription(e.target.value)}
                      placeholder="Cargo or consignment description"
                    />
                    {errors.shipmentDescription && <span className="field-error-msg">{errors.shipmentDescription}</span>}
                  </div>
                </div>
              </div>

              {/* References Section */}
              <div className="form-group-block">
                <label className="section-field-label">Reference Identifiers (Optional)</label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label>Customer Reference</label>
                    <input
                      type="text"
                      value={customerRef}
                      onChange={e => setCustomerRef(e.target.value)}
                      placeholder="PO Number / Ref"
                    />
                  </div>
                  <div className="input-field">
                    <label>Invoice Reference</label>
                    <input
                      type="text"
                      value={invoiceRef}
                      onChange={e => setInvoiceRef(e.target.value)}
                      placeholder="Invoice Number"
                    />
                  </div>
                  <div className="input-field">
                    <label>Internal Reference</label>
                    <input
                      type="text"
                      value={internalRef}
                      onChange={e => setInternalRef(e.target.value)}
                      placeholder="Internal Ref Code"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 2: SENDER & RECIPIENT */}
          {/* ---------------------------------------------------- */}
          {currentStep === 2 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <div className="heading-with-action">
                  <div>
                    <h3>02. Sender & Recipient</h3>
                    <p>Enter the shipment parties. This information attaches directly to this shipment.</p>
                  </div>
                  <button
                    type="button"
                    className="copy-parties-btn"
                    onClick={handleCopySenderToRecipient}
                  >
                    Copy Sender → Recipient
                  </button>
                </div>
              </div>


              {/* Shared US States Datalist */}
              <datalist id="us-states-list">
                {Object.entries(STATE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{code} — {name}</option>
                ))}
              </datalist>

              {/* Sender Box */}
              <div className="parties-box sender">
                <div className="parties-box-head">
                  <span className="party-tag blue">SENDER (PICKUP LOCATION)</span>
                </div>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder="Shipper Full Name"
                    />
                  </div>
                  <div className="input-field">
                    <label>Company (Optional)</label>
                    <input
                      type="text"
                      value={senderCompany}
                      onChange={e => setSenderCompany(e.target.value)}
                      placeholder="Company Name (Optional)"
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label>Email (Optional)</label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={e => setSenderEmail(e.target.value)}
                      placeholder="shipper@company.com"
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-phone">Phone (Optional)</label>
                    <PhoneInput
                      id="sender-phone"
                      value={senderPhone}
                      onChange={setSenderPhone}
                      defaultCountry={senderCountry || 'US'}
                    />
                  </div>
                </div>

                <div className="input-field full-width">
                  <label>Pickup Street Address</label>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={e => setSenderAddress(e.target.value)}
                    placeholder="Street Address, Suite / Unit"
                  />
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="sender-country">Country *</label>
                    <CountrySelect id="sender-country" value={senderCountry} onChange={setSenderCountry} />
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-city">City *</label>
                    <input
                      id="sender-city"
                      type="text"
                      value={senderCity}
                      onChange={e => setSenderCity(e.target.value)}
                      placeholder="e.g. Lagos"
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="sender-region">{regionLabel(senderCountry)} (Optional)</label>
                    <input
                      id="sender-region"
                      type="text"
                      list={senderCountry === 'US' ? 'us-states-list' : undefined}
                      value={senderState}
                      onChange={e => setSenderState(senderCountry === 'US' ? e.target.value.toUpperCase() : e.target.value)}
                      maxLength={60}
                    />
                    {senderStateWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {senderStateWarning}
                      </span>
                    )}
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-postcode">{postcodeLabel(senderCountry)} (Optional)</label>
                    <input
                      id="sender-postcode"
                      type="text"
                      value={senderZip}
                      onChange={e => handleSenderZipChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Box */}
              <div className="parties-box recipient">
                <div className="parties-box-head">
                  <span className="party-tag purple">RECIPIENT (DELIVERY DESTINATION)</span>
                </div>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="Recipient Full Name"
                    />
                  </div>
                  <div className="input-field">
                    <label>Company (Optional)</label>
                    <input
                      type="text"
                      value={recipientCompany}
                      onChange={e => setRecipientCompany(e.target.value)}
                      placeholder="Company Name (Optional)"
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label>Email (Optional)</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="recipient@company.com"
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-phone">Phone (Optional)</label>
                    <PhoneInput
                      id="recipient-phone"
                      value={recipientPhone}
                      onChange={setRecipientPhone}
                      defaultCountry={recipientCountry || senderCountry || 'US'}
                    />
                  </div>
                </div>

                <div className="input-field full-width">
                  <label>Delivery Street Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={e => setRecipientAddress(e.target.value)}
                    placeholder="Street Address, Suite / Unit"
                  />
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="recipient-country">Country *</label>
                    <CountrySelect id="recipient-country" value={recipientCountry} onChange={setRecipientCountry} />
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-city">City *</label>
                    <input
                      id="recipient-city"
                      type="text"
                      value={recipientCity}
                      onChange={e => setRecipientCity(e.target.value)}
                      placeholder="e.g. London"
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="recipient-region">{regionLabel(recipientCountry)} (Optional)</label>
                    <input
                      id="recipient-region"
                      type="text"
                      list={recipientCountry === 'US' ? 'us-states-list' : undefined}
                      value={recipientState}
                      onChange={e => setRecipientState(recipientCountry === 'US' ? e.target.value.toUpperCase() : e.target.value)}
                      maxLength={60}
                    />
                    {recipientStateWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {recipientStateWarning}
                      </span>
                    )}
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-postcode">{postcodeLabel(recipientCountry)} (Optional)</label>
                    <input
                      id="recipient-postcode"
                      type="text"
                      value={recipientZip}
                      onChange={e => handleRecipientZipChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 3: SMART ADAPTIVE CARGO SPECIFICATIONS (units: see the toggle) */}
          {/* ---------------------------------------------------- */}
          {currentStep === 3 && (
            <div className="step-inner-content animate-fade-in">
              <div className="sdl-heading-with-units admin-units-bar">
                <span className="dim-label">Weights and dimensions in</span>
                <UnitToggle />
              </div>
              {/* CASE A: VEHICLE CARGO SPECIFICATION */}
              {shipmentType === 'Vehicle' ? (
                <div className="vehicle-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Vehicle Cargo Specifications</h3>
                        <p>Vehicle shipping details, VIN identification, operability, and intake inspection.</p>
                      </div>
                      <button
                        type="button"
                        className="preset-spec-btn"
                        onClick={() => {
                          setVehMake('Toyota');
                          setVehModel('Land Cruiser');
                          setVehYear('2024');
                          setVehWeightLbs('5490');
                          setVehLengthIn('195');
                          setVehWidthIn('78');
                          setVehHeightIn('75');
                        }}
                      >
                        Use Example Specs
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Identity Details */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">1. Vehicle Identification</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Make *</label>
                        <input
                          type="text"
                          value={vehMake}
                          onChange={e => setVehMake(e.target.value)}
                          placeholder="e.g. Toyota"
                        />
                        {errors.vehMake && <span className="field-error-msg">{errors.vehMake}</span>}
                      </div>
                      <div className="input-field">
                        <label>Model *</label>
                        <input
                          type="text"
                          value={vehModel}
                          onChange={e => setVehModel(e.target.value)}
                          placeholder="e.g. Land Cruiser"
                        />
                        {errors.vehModel && <span className="field-error-msg">{errors.vehModel}</span>}
                      </div>
                      <div className="input-field">
                        <label>Year *</label>
                        <input
                          type="number"
                          value={vehYear}
                          onChange={e => setVehYear(e.target.value)}
                          placeholder="2024"
                        />
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>VIN (17-Character Number) *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={vehVin}
                          onChange={e => setVehVin(e.target.value.toUpperCase())}
                          placeholder="17-character VIN"
                        />
                        {errors.vehVin && <span className="field-error-msg">{errors.vehVin}</span>}
                      </div>
                      <div className="input-field">
                        <label>Color</label>
                        <input
                          type="text"
                          value={vehColor}
                          onChange={e => setVehColor(e.target.value)}
                          placeholder="White"
                        />
                      </div>
                      <div className="input-field">
                        <label>Vehicle Body Type</label>
                        <select
                          value={vehBodyType}
                          onChange={e => setVehBodyType(e.target.value)}
                        >
                          <option value="Pickup Truck">Pickup Truck</option>
                          <option value="Sedan">Sedan</option>
                          <option value="SUV / Crossover">SUV / Crossover</option>
                          <option value="Coupe">Coupe</option>
                          <option value="Van / Minivan">Van / Minivan</option>
                          <option value="Motorcycle">Motorcycle</option>
                          <option value="Commercial / Heavy">Commercial / Heavy</option>
                        </select>
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>License Plate (Optional)</label>
                        <input
                          type="text"
                          value={vehPlate}
                          onChange={e => setVehPlate(e.target.value)}
                          placeholder="e.g. 7XYZ892 (NY)"
                        />
                      </div>
                      <div className="input-field">
                        <label>Title / Registration # (Optional)</label>
                        <input
                          type="text"
                          value={vehTitleNumber}
                          onChange={e => setVehTitleNumber(e.target.value)}
                          placeholder="e.g. TITLE-NY-90214"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operability & Dimensions */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">2. Operability & Physical Dimensions</span>
                    <div className="operability-toggle-row">
                      <label className={`operable-option-card ${vehOperable ? 'active operable-yes' : ''}`}>
                        <input
                          type="radio"
                          name="operable"
                          checked={vehOperable}
                          onChange={() => setVehOperable(true)}
                        />
                        <div className="operable-card-body">
                          <div className="operable-head-row">
                            <strong>Operable (Drivable)</strong>
                            <span className="operable-status-tag success">Runs & Drives</span>
                          </div>
                          <small>Vehicle starts, steers, brakes, and drives under its own power directly onto the car hauler or transport trailer ramp.</small>
                        </div>
                      </label>

                      <label className={`operable-option-card ${!vehOperable ? 'active operable-no' : ''}`}>
                        <input
                          type="radio"
                          name="operable"
                          checked={!vehOperable}
                          onChange={() => setVehOperable(false)}
                        />
                        <div className="operable-card-body">
                          <div className="operable-head-row">
                            <strong>Inoperable (Non-Running)</strong>
                            <span className="operable-status-tag warning">Requires Winch</span>
                          </div>
                          <small>Vehicle cannot start or drive (dead engine, flat battery, crash damage, or missing keys). Carrier driver must load via winch or rollback.</small>
                        </div>
                      </label>
                    </div>

                    <div className="dim-row-group" style={{ marginTop: '0.75rem' }}>
                      <span className="dim-label">Dimensions ({units.length}):</span>
                      <div className="dim-input-group">
                        <MeasureInput
                          kind="length"
                          value={vehLengthIn}
                          onChange={val => setVehLengthIn(val === '' ? '' : String(val))}
                          placeholder="Length"
                        />
                        <span className="dim-x">×</span>
                        <MeasureInput
                          kind="length"
                          value={vehWidthIn}
                          onChange={val => setVehWidthIn(val === '' ? '' : String(val))}
                          placeholder="Width"
                        />
                        <span className="dim-x">×</span>
                        <MeasureInput
                          kind="length"
                          value={vehHeightIn}
                          onChange={val => setVehHeightIn(val === '' ? '' : String(val))}
                          placeholder="Height"
                        />
                        <span className="dim-label" style={{ marginLeft: '0.5rem' }}>in</span>
                      </div>

                      <div className="dim-input-group" style={{ marginLeft: '1rem' }}>
                        <span className="dim-label">Curb Weight ({units.weight}):</span>
                        <MeasureInput
                          kind="weight"
                          style={{ width: '80px' }}
                          value={vehWeightLbs}
                          onChange={val => setVehWeightLbs(val === '' ? '' : String(val))}
                        />
                        <span className="dim-label">lb</span>
                      </div>
                    </div>
                  </div>

                  {/* Condition & Inspection */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">3. Condition & Pre-Trip Inspection</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <div className="field-label-split">
                          <label>Overall Condition</label>
                          <span className="field-type-tag">Custom Admin Entry</span>
                        </div>
                        <input
                          type="text"
                          value={vehCondition}
                          onChange={e => setVehCondition(e.target.value)}
                          placeholder="e.g. Clean daily driver, minor cosmetic scuffs, mechanically sound"
                          className="condition-custom-input"
                        />
                        <div className="condition-quick-chips">
                          <span className="chips-hint-text">Quick Presets:</span>
                          {[
                            'Showroom / Pristine',
                            'Clean / Minor Wear',
                            'Noticeable Cosmetic Wear',
                            'Mechanically Sound',
                            'Salvage / Inoperable'
                          ].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              className={`condition-chip-btn ${vehCondition === preset ? 'active' : ''}`}
                              onClick={() => setVehCondition(preset)}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    <div className="damage-checklist-wrap">
                      <label className="section-field-label" style={{ fontSize: '0.72rem' }}>Existing Damage Noted at Intake:</label>
                      <div className="damage-pills-grid">
                        {[
                          'No major visible damage',
                          'Front bumper scratch',
                          'Rear bumper scratch',
                          'Driver side door ding',
                          'Passenger side ding',
                          'Windshield chip',
                          'Wheel / rim curb rash',
                          'Underbody wear'
                        ].map(dmg => (
                          <button
                            key={dmg}
                            type="button"
                            className={`damage-pill-btn ${damageChecklist.includes(dmg) ? 'active' : ''}`}
                            onClick={() => handleToggleDamage(dmg)}
                          >
                            {damageChecklist.includes(dmg) ? <CheckSquare size={13} /> : <Square size={13} />}
                            <span>{dmg}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-field full-width">
                      <label>Inspection Remarks</label>
                      <input
                        type="text"
                        value={inspectionNotes}
                        onChange={e => setInspectionNotes(e.target.value)}
                        placeholder="e.g. Minor 1-inch clearcoat mark on rear tailgate."
                      />
                    </div>

                    {/* Keys & Documents Received */}
                    <div className="keys-docs-wrap">
                      <label className="section-field-label" style={{ fontSize: '0.72rem' }}>Items & Documents Received with Vehicle:</label>
                      <div className="keys-grid">
                        {[
                          'Vehicle',
                          'Primary Key',
                          'Spare Key',
                          'Title Document',
                          'Registration',
                          'Bill of Sale',
                          'Owner Manuals'
                        ].map(item => (
                          <button
                            key={item}
                            type="button"
                            className={`item-pill-btn ${itemsReceived.includes(item) ? 'active' : ''}`}
                            onClick={() => handleToggleItemReceived(item)}
                          >
                            {itemsReceived.includes(item) ? <Check size={13} className="text-emerald" /> : null}
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Pallet' ? (
                <div className="pallet-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Palletized Cargo & Skid Configuration</h3>
                        <p>Configure standard pallet geometry, skid count, forklift entry, and double-stack directives.</p>
                      </div>
                      <button
                        type="button"
                        className="preset-spec-btn"
                        onClick={() => {
                          setPalletStandard('GMA Standard 48×40 in (US Wood)');
                          setPalletCount(2);
                          setPalletWeightPerSkid(850);
                          setPalletHeightIn(54);
                          setPalletStackable(false);
                          setPalletForkliftAccess('4-Way Forklift Entry');
                        }}
                      >
                        Fill Standard LTL Skid (48×40)
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Standard & Physical Specs */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">1. Skid Geometry & Quantity</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Pallet Standard / Base Type</label>
                        <select
                          value={palletStandard}
                          onChange={e => setPalletStandard(e.target.value)}
                        >
                          <option value="GMA Standard 48×40 in (US Wood)">GMA Standard 48×40 in (US Wood 4-Way)</option>
                          <option value="ISO Euro Pallet EUR-1 (1200×800 mm)">ISO Euro Pallet EUR-1 (1200×800 mm / 47.2×31.5 in)</option>
                          <option value="ISO Euro Pallet EUR-2 (1200×1000 mm)">ISO Euro Pallet EUR-2 (1200×1000 mm / 47.2×39.4 in)</option>
                          <option value="Heavy Duty Industrial Skid 48×48 in">Heavy Duty Industrial Skid 48×48 in</option>
                          <option value="Half-Pallet Retail Display 40×24 in">Half-Pallet Retail Display 40×24 in</option>
                          <option value="Custom Engineered Machinery Runner">Custom Engineered Machinery Runner Base</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Forklift & Pallet Jack Entry</label>
                        <select
                          value={palletForkliftAccess}
                          onChange={e => setPalletForkliftAccess(e.target.value)}
                        >
                          <option value="4-Way Forklift Entry">4-Way Forklift Entry (Universal Access)</option>
                          <option value="2-Way Entry (Stringer Block)">2-Way Entry (Stringer Block Pallet)</option>
                          <option value="Hydraulic Jack Friendly">Hydraulic Pallet Jack Friendly (Bottom Chamfer)</option>
                        </select>
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Skid Count (Quantity) *</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={palletCount}
                          onChange={e => setPalletCount(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div className="input-field">
                        <label>Weight Per Skid ({units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          min="10"
                          step="10"
                          value={palletWeightPerSkid}
                          onChange={val => setPalletWeightPerSkid(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>Total Skid Height ({units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          min="12"
                          max="96"
                          value={palletHeightIn}
                          onChange={val => setPalletHeightIn(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="pallet-live-calc-strip">
                      <div className="calc-metric-pill">
                        <span>TOTAL PAYLOAD WEIGHT:</span>
                        <strong className="font-mono text-emerald">{formatWeight(palletCount * palletWeightPerSkid, units.system)}</strong>
                      </div>
                      <div className="calc-metric-pill">
                        <span>ESTIMATED CUBIC VOLUME:</span>
                        <strong className="font-mono">{(((48 * 40 * palletHeightIn) / 1728) * palletCount).toFixed(1)} cu ft</strong>
                      </div>
                      <div className="calc-metric-pill">
                        <span>TRAILER LINEHAUL SLOTS:</span>
                        <strong className="font-mono">{palletStackable ? Math.ceil(palletCount / 2) : palletCount} Floor Positions</strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Stackability Directive */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">2. Trailer Consolidation & Stackability Directive</span>
                    <p className="field-hint-txt" style={{ marginTop: '-0.2rem', marginBottom: '0.65rem' }}>
                      Carrier linehaul dispatchers must know whether top freight can be double-tiered during linehaul transit.
                    </p>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${!palletStackable ? 'active' : ''}`}
                        onClick={() => setPalletStackable(false)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Do Not Double Stack (Top-Tier Only)</span>
                            <span className="opt-badge-pill inoperable-badge">TOP-TIER MANDATE</span>
                          </div>
                          <div className="opt-radio-circle">
                            {!palletStackable && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Top surface is fragile, pyramid-stacked, or lacks structural load-bearing capacity. Carrier must stow on top tier with ZERO cargo stacked above.
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`operable-option-card ${palletStackable ? 'active' : ''}`}
                        onClick={() => setPalletStackable(true)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Stackable (Double-Stack Certified)</span>
                            <span className="opt-badge-pill operable-badge">2-TIER APPROVED</span>
                          </div>
                          <div className="opt-radio-circle">
                            {palletStackable && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Skid has a uniform flat top deck capable of supporting equivalent weight (up to 1,500 lbs). Allows trailer 2-tier cube consolidation.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Pallet Securing & ISPM-15 Compliance */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">3. Unit Securing & Regulatory Compliance</span>
                    <div className="damage-pills-grid">
                      {[
                        'Heat-Treated (ISPM-15 Certified)',
                        'Heavy Gauge Stretch-Wrapped',
                        'Steel Banded / Strapped',
                        'Corner Edge Protectors',
                        'Top Dust Cover / Weather-Resistant Sheeting',
                        'Anti-Slip Pallet Liners'
                      ].map(check => (
                        <button
                          key={check}
                          type="button"
                          className={`damage-pill-btn ${palletSecuringChecks.includes(check) ? 'active' : ''}`}
                          onClick={() => handleTogglePalletCheck(check)}
                        >
                          {palletSecuringChecks.includes(check) ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>{check}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Container' ? (
                <div className="container-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Intermodal FCL Container Specifications</h3>
                        <p>SOLAS Verified Gross Mass (VGM), ISO 6346 unit number, ISO 17712 bolt seal, and interchange terminal.</p>
                      </div>
                      <button
                        type="button"
                        className="preset-spec-btn"
                        onClick={() => {
                          setContainerNumber('MSCU-749102-3');
                          setContainerIsoSize('40ft High-Cube Dry Van (40HC / 9ft 6in)');
                          setContainerBoltSeal('HSS-NY-984021');
                          setContainerTerminal('Port of New York / Newark Container Terminal (PNCT)');
                          setContainerChassisNumber('CHAS-8812 (Tri-axle)');
                          setContainerVgmWeight('48200');
                        }}
                      >
                        Fill 40ft High Cube Container
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Container Unit Identification & ISO Type */}
                  <div className="vehicle-form-deck container-deck-panel">
                    <span className="deck-sub-title">1. Container Equipment & Identification</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Container Unit Number (ISO 6346) *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={containerNumber}
                          onChange={e => setContainerNumber(e.target.value.toUpperCase())}
                          placeholder="MSCU-749102-3"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>4-letter prefix + 6 digits + 1 check digit</span>
                      </div>
                      <div className="input-field">
                        <label>ISO Container Equipment Size</label>
                        <select
                          value={containerIsoSize}
                          onChange={e => setContainerIsoSize(e.target.value)}
                        >
                          <option value="40ft High-Cube Dry Van (40HC / 9ft 6in)">40ft High-Cube Dry Van (40HC / 9ft 6in)</option>
                          <option value="20ft General Purpose Standard (20GP / 8ft 6in)">20ft Standard GP Dry Van (20GP / 8ft 6in)</option>
                          <option value="40ft General Purpose Standard (40GP / 8ft 6in)">40ft Standard GP Dry Van (40GP / 8ft 6in)</option>
                          <option value="45ft High-Cube Pallet Wide (45HCPW)">45ft High-Cube Pallet Wide (45HCPW)</option>
                          <option value="40ft High-Cube Refrigerated Reefer (40HR)">40ft High-Cube Refrigerated Reefer (40HR)</option>
                          <option value="20ft Open Top / Flat Rack Special">20ft Open Top / Flat Rack Special Equipment</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>ISO 17712 High-Security Bolt Seal # *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={containerBoltSeal}
                          onChange={e => setContainerBoltSeal(e.target.value.toUpperCase())}
                          placeholder="HSS-NY-984021"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>Tamper-evident bolt seal (C-TPAT compliant)</span>
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Verified Gross Mass (VGM, {units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          className="font-mono"
                          value={containerVgmWeight}
                          onChange={val => setContainerVgmWeight(val === '' ? '' : String(val))}
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>Total certified scale weight (SOLAS VGM)</span>
                      </div>
                      <div className="input-field">
                        <label>Port / Rail Ramp Terminal</label>
                        <select
                          value={containerTerminal}
                          onChange={e => setContainerTerminal(e.target.value)}
                        >
                          <option value="Port of New York / Newark Container Terminal (PNCT)">Port of New York / Newark Container Terminal (PNCT)</option>
                          <option value="Port of Los Angeles - Pier 400 APM">Port of Los Angeles - Pier 400 APM</option>
                          <option value="Port of Long Beach - Pier T (TTI)">Port of Long Beach - Pier T (TTI)</option>
                          <option value="BNSF Logistics Park Chicago (LPC)">BNSF Logistics Park Chicago (LPC)</option>
                          <option value="Georgia Ports Authority - Savannah Ocean Terminal">Georgia Ports Authority - Savannah Ocean Terminal</option>
                          <option value="Union Pacific Global IV Intermodal Terminal">Union Pacific Global IV Intermodal Terminal</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Intermodal Chassis #</label>
                        <input
                          type="text"
                          value={containerChassisNumber}
                          onChange={e => setContainerChassisNumber(e.target.value)}
                          placeholder="CHAS-8812 (Tri-axle)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Atmosphere & Customs Status */}
                  <div className="vehicle-form-deck container-deck-panel">
                    <span className="deck-sub-title">2. Environmental & Customs Control</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Atmosphere / Reefer Temperature</label>
                        <select
                          value={containerTemperature}
                          onChange={e => setContainerTemperature(e.target.value)}
                        >
                          <option value="Ambient / Dry Cargo">Ambient / Standard Dry Cargo</option>
                          <option value="Chilled Fresh (+2°C to +4°C / 36°F to 39°F)">Chilled Fresh (+2°C to +4°C / 36°F to 39°F)</option>
                          <option value="Deep Frozen (-20°C / -4°F)">Deep Frozen (-20°C / -4°F)</option>
                          <option value="Ultra-Low Cryo (-60°C)">Ultra-Low Cryo (-60°C)</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Customs & Terminal Pre-Gate Status</label>
                        <select
                          value={containerCustomsStatus}
                          onChange={e => setContainerCustomsStatus(e.target.value)}
                        >
                          <option value="Pre-Cleared / Manifest Approved">Pre-Cleared / AMS Manifest Approved</option>
                          <option value="In-Bond Transit (IT 7512 Authorized)">In-Bond Transit (IT 7512 Authorized)</option>
                          <option value="Customs Hold / Pending Physical Inspection">Customs Hold / Pending Physical Inspection</option>
                          <option value="Gate-In Complete / Staged for Vessel">Gate-In Complete / Staged for Vessel</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Freight' ? (
                <div className="freight-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Heavy Freight & LTL Linehaul Specifications</h3>
                        <p>National Motor Freight Classification (NMFC), freight class rating, dock access, and liftgate requirements.</p>
                      </div>
                      <button
                        type="button"
                        className="preset-spec-btn"
                        onClick={() => {
                          setFreightClass('Class 70 (Machinery, auto parts)');
                          setFreightNmfcCode('NMFC 18260-Sub 2');
                          setFreightPiecesCount(1);
                          setFreightTotalWeightLbs(1850);
                          setFreightLoadingMethod('Standard Raised Commercial Loading Dock (48" Dock Height)');
                          setFreightLiftgatePickup(false);
                          setFreightLiftgateDelivery(true);
                        }}
                      >
                        Fill Machinery Freight (Class 70)
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Freight Rating & NMFC Code */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">1. Rating & Classification</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Freight Class Rating *</label>
                        <select
                          value={freightClass}
                          onChange={e => setFreightClass(e.target.value)}
                        >
                          <option value="Class 50 (Clean dense freight)">Class 50 (Clean dense freight / over 50 lbs/cu ft)</option>
                          <option value="Class 55">Class 55 (35-50 lbs/cu ft)</option>
                          <option value="Class 60">Class 60 (30-35 lbs/cu ft)</option>
                          <option value="Class 65">Class 65 (22.5-30 lbs/cu ft)</option>
                          <option value="Class 70 (Machinery, auto parts)">Class 70 (Machinery, auto parts / 15-22.5 lbs/cu ft)</option>
                          <option value="Class 77.5">Class 77.5 (Tires, parts / 13.5-15 lbs/cu ft)</option>
                          <option value="Class 85">Class 85 (Crated machinery / 12-13.5 lbs/cu ft)</option>
                          <option value="Class 92.5">Class 92.5 (10.5-12 lbs/cu ft)</option>
                          <option value="Class 100">Class 100 (9-10.5 lbs/cu ft)</option>
                          <option value="Class 125">Class 125 (8-9 lbs/cu ft)</option>
                          <option value="Class 150">Class 150 (6-8 lbs/cu ft)</option>
                          <option value="Class 200">Class 200 (4-6 lbs/cu ft)</option>
                          <option value="Class 300">Class 300 (2-4 lbs/cu ft)</option>
                          <option value="Class 500 (Low density / high value)">Class 500 (Low density / high value / under 1 lb/cu ft)</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>NMFC Code *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={freightNmfcCode}
                          onChange={e => setFreightNmfcCode(e.target.value)}
                          placeholder="NMFC 18260-Sub 2"
                        />
                      </div>
                      <div className="input-field">
                        <label>Total Scale Weight ({units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="10"
                          value={freightTotalWeightLbs}
                          onChange={val => setFreightTotalWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Pieces / Crates Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={freightPiecesCount}
                          onChange={e => setFreightPiecesCount(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div className="input-field">
                        <label>Facility Loading Method</label>
                        <select
                          value={freightLoadingMethod}
                          onChange={e => setFreightLoadingMethod(e.target.value)}
                        >
                          <option value='Standard Raised Commercial Loading Dock (48" Dock Height)'>Standard Raised Commercial Loading Dock (48" Height)</option>
                          <option value="Ground Level Facility (Forklift from Yard)">Ground Level Facility (Forklift from Yard)</option>
                          <option value="Construction Site / Industrial Yard">Construction Site / Industrial Yard</option>
                          <option value="Residential / Limited Access Facility">Residential / Limited Access Facility</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Liftgate Requirements (Essential in Freight Dispatch) */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">2. Specialized Hydraulic Liftgate Directives</span>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${freightLiftgatePickup ? 'active' : ''}`}
                        onClick={() => setFreightLiftgatePickup(!freightLiftgatePickup)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Liftgate Required at Pickup</span>
                            <span className={`opt-badge-pill ${freightLiftgatePickup ? 'operable-badge' : 'neutral-badge'}`}>
                              {freightLiftgatePickup ? 'REQUIRED' : 'NOT REQUIRED'}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {freightLiftgatePickup && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Origin shipper lacks a 48" raised loading dock. Linehaul carrier must dispatch a truck with hydraulic liftgate to hoist freight from ground level.
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`operable-option-card ${freightLiftgateDelivery ? 'active' : ''}`}
                        onClick={() => setFreightLiftgateDelivery(!freightLiftgateDelivery)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Liftgate Required at Delivery</span>
                            <span className={`opt-badge-pill ${freightLiftgateDelivery ? 'operable-badge' : 'neutral-badge'}`}>
                              {freightLiftgateDelivery ? 'REQUIRED' : 'NOT REQUIRED'}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {freightLiftgateDelivery && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Destination consignee location lacks a raised dock. Linehaul driver must lower heavy freight safely to pavement level.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: HazMat Declaration */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">3. Hazardous Materials (HazMat) Declaration</span>
                    <label className="save-address-checkbox" style={{ margin: '0.25rem 0 0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={freightHazMat}
                        onChange={e => setFreightHazMat(e.target.checked)}
                      />
                      <span>Consignment contains Hazardous Materials (HazMat Regulated Cargo)</span>
                    </label>

                    {freightHazMat && (
                      <div className="hazmat-alert-box animate-fade-in">
                        <div className="hazmat-badge">
                          <AlertTriangle size={15} />
                          <span>HAZMAT DECLARATION REQUIRED (49 CFR / IMDG)</span>
                        </div>
                        <div className="input-grid-2" style={{ marginTop: '0.65rem' }}>
                          <div className="input-field">
                            <label>UN / NA Identification Number *</label>
                            <input
                              type="text"
                              className="font-mono"
                              value={freightUnNumber}
                              onChange={e => setFreightUnNumber(e.target.value)}
                              placeholder="e.g. UN 3480 (Lithium Ion Batteries)"
                            />
                          </div>
                          <div className="input-field">
                            <label>Emergency Response Contact</label>
                            <input
                              type="text"
                              placeholder="24-hour emergency response number"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : shipmentType === 'Document' ? (
                <div className="doc-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Secure Document & Courier Pouch Deck</h3>
                        <p>Chain-of-custody tracking, tamper-evident security seal, direct consignee signature mandate, and urgent delivery window.</p>
                      </div>
                      <button
                        type="button"
                        className="preset-spec-btn"
                        onClick={() => {
                          setDocEnvelopeType(`${COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)`);
                          setDocSealNumber(generateReference('seal'));
                          setDocDirectSignOnly(true);
                          setDocUrgentDeadline('By 10:30 AM Next Business Day (Priority Legal)');
                          setDocFilingCourtRef('CASE-2026-NY-4481');
                          setDocContentsDescription('Executed Commercial Vehicle Titles & Sales Contracts (35 Pages)');
                        }}
                      >
                        Fill Legal Document Pouch
                      </button>
                    </div>
                  </div>

                  {/* Section 1: Pouch Format & Numbered Security Seal */}
                  <div className="vehicle-form-deck doc-deck-panel">
                    <span className="deck-sub-title">1. Courier Packaging & Security Seal</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Packaging / Envelope Format</label>
                        <select
                          value={docEnvelopeType}
                          onChange={e => setDocEnvelopeType(e.target.value)}
                        >
                          <option value={`${COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)`}>{COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)</option>
                          <option value="Rigid Cardboard Stay-Flat Mailer (9.5×12.5 in)">Rigid Cardboard Stay-Flat Mailer (9.5×12.5 in)</option>
                          <option value="Heavy Duty Tyvek Courier Envelope (10×13 in)">Heavy Duty Tyvek Courier Envelope (10×13 in)</option>
                          <option value="Tamper-Evident Bank Deposit Polybag">Tamper-Evident Bank Deposit / Evidence Polybag</option>
                          <option value="Archival Box / Legal Binder Folder">Archival Box / Legal Binder Folder</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Numbered Security Seal ID *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={docSealNumber}
                          onChange={e => setDocSealNumber(e.target.value.toUpperCase())}
                          placeholder={`${REFERENCE_PREFIX}-SL-892401`}
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>Sequential tamper-evident barcode seal</span>
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Target Delivery Commitment Window</label>
                        <select
                          value={docUrgentDeadline}
                          onChange={e => setDocUrgentDeadline(e.target.value)}
                        >
                          <option value="By 10:30 AM Next Business Day (Priority Legal)">By 10:30 AM Next Business Day (Priority Legal)</option>
                          <option value="End of Business Day (5:00 PM)">End of Business Day (5:00 PM)</option>
                          <option value="Same-Day Hotshot Courier (Within 4 Hours)">Same-Day Hotshot Courier (Within 4 Hours)</option>
                          <option value="Saturday Courier Handover">Saturday Courier Handover</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Court Case / Escrow / Notary Filing Reference</label>
                        <input
                          type="text"
                          value={docFilingCourtRef}
                          onChange={e => setDocFilingCourtRef(e.target.value)}
                          placeholder="e.g. CASE-2026-NY-4481 or ESCROW-TX-9021"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Chain of Custody Directive */}
                  <div className="vehicle-form-deck doc-deck-panel">
                    <span className="deck-sub-title">2. Chain of Custody & Signature Directives</span>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${docDirectSignOnly ? 'active' : ''}`}
                        onClick={() => setDocDirectSignOnly(!docDirectSignOnly)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Direct In-Person Consignee Signature Required</span>
                            <span className="opt-badge-pill operable-badge">STRICT NO-WAIVER</span>
                          </div>
                          <div className="opt-radio-circle">
                            {docDirectSignOnly && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          The courier must hand the envelope directly to the named individual with government photo ID verification. Indirect delivery, mailbox drop, or front-porch waivers are strictly prohibited.
                        </p>
                      </button>
                    </div>

                    <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                      <label>Contents Description & Document Inventory</label>
                      <input
                        type="text"
                        value={docContentsDescription}
                        onChange={e => setDocContentsDescription(e.target.value)}
                        placeholder="e.g. Executed Commercial Vehicle Titles & Sales Contracts (35 Pages)"
                      />
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Pets' ? (
                /* CASE: LIVE ANIMAL & PET TRANSPORT DECK */
                <div className="pet-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Live Animal & Pet Transport Deck (IATA LAR / USDA Regulated)</h3>
                        <p>Individual animal identity, 15-digit RFID microchip verification, certified CR-82 travel crate, USDA health certificates, and in-transit welfare protocols.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="preset-spec-btn"
                          onClick={() => {
                            setPetName('Barnaby');
                            setPetSpecies('Canine (Dog)');
                            setPetBreed('Golden Retriever');
                            setPetAge('3 Years');
                            setPetGender('Male (Neutered)');
                            setPetWeightLbs(68);
                            setPetMicrochip('985141002849102');
                            setPetCollarTag('Barnaby • (212) 555-0199');
                            setPetCrateType('IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)');
                            setPetCrateLength(36);
                            setPetCrateWidth(25);
                            setPetCrateHeight(27);
                            setPetCrateWeightLbs(22);
                            setPetIsBrachycephalic(false);
                            setPetHealthCertNumber('CVI-NY-2026-88194');
                            setPetRabiesTag('RAB-2027-11-04 (NY Dept of Health)');
                            setPetVetClinic('Manhattan Animal Health Hospital');
                            setPetVetPhone('(212) 555-0149');
                            setPetAcclimationCert(true);
                            setPetLastFed('4 Hours Prior to Tender (Light Meal)');
                            setPetWaterProtocol('Fresh spring water refreshed at every terminal transfer waypoint');
                            setPetSpecialInstructions('Gentle handling; favorite comfort blanket inside crate. No sedation per AVMA protocol.');
                          }}
                        >
                          <PawPrint size={13} style={{ marginRight: '4px' }} /> Canine: Golden Retriever
                        </button>
                        <button
                          type="button"
                          className="preset-spec-btn"
                          onClick={() => {
                            setPetName('Cleo');
                            setPetSpecies('Feline (Cat)');
                            setPetBreed('Siamese');
                            setPetAge('2 Years');
                            setPetGender('Female (Spayed)');
                            setPetWeightLbs(9.5);
                            setPetMicrochip('985141009941824');
                            setPetCollarTag('Cleo • (415) 555-0182');
                            setPetCrateType('IATA LAR Certified Series 100 (Small Rigid Kennel - 21×16×15 in)');
                            setPetCrateLength(21);
                            setPetCrateWidth(16);
                            setPetCrateHeight(15);
                            setPetCrateWeightLbs(8);
                            setPetIsBrachycephalic(false);
                            setPetHealthCertNumber('CVI-CA-2026-33901');
                            setPetRabiesTag('RAB-2026-08-19 (SF Health)');
                            setPetVetClinic('Mission Pet Emergency Clinic');
                            setPetVetPhone('(415) 555-0199');
                            setPetAcclimationCert(true);
                            setPetLastFed('3 Hours Prior to Tender');
                            setPetWaterProtocol('Clip-on dish with pre-frozen ice block');
                            setPetSpecialInstructions('Calm feline. Cover kennel with breathable dark cloth during ramp transfer to reduce visual stimulus.');
                          }}
                        >
                          <Heart size={13} style={{ marginRight: '4px' }} /> Feline: Siamese Cat
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Pet Identification & Biometrics */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">1. Animal Identification & Biometrics</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>Pet / Animal Name *</label>
                        <input
                          type="text"
                          value={petName}
                          onChange={e => setPetName(e.target.value)}
                          placeholder="e.g. Barnaby"
                        />
                      </div>
                      <div className="input-field">
                        <label>Species *</label>
                        <select
                          value={petSpecies}
                          onChange={e => setPetSpecies(e.target.value)}
                        >
                          <option value="Canine (Dog)">Canine (Dog)</option>
                          <option value="Feline (Cat)">Feline (Cat)</option>
                          <option value="Avian (Bird)">Avian (Bird)</option>
                          <option value="Small Mammal (Rabbit/Ferret)">Small Mammal (Rabbit / Ferret)</option>
                          <option value="Equine (Horse / Pony)">Equine (Horse / Pony)</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Breed *</label>
                        <input
                          type="text"
                          value={petBreed}
                          onChange={e => setPetBreed(e.target.value)}
                          placeholder="e.g. Golden Retriever"
                        />
                      </div>
                    </div>

                    <div className="input-grid-4" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>Age / DOB</label>
                        <input
                          type="text"
                          value={petAge}
                          onChange={e => setPetAge(e.target.value)}
                          placeholder="e.g. 3 Years"
                        />
                      </div>
                      <div className="input-field">
                        <label>Gender & Status</label>
                        <select
                          value={petGender}
                          onChange={e => setPetGender(e.target.value)}
                        >
                          <option value="Male (Neutered)">Male (Neutered)</option>
                          <option value="Male (Intact)">Male (Intact)</option>
                          <option value="Female (Spayed)">Female (Spayed)</option>
                          <option value="Female (Intact)">Female (Intact)</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Pet Net Weight ({units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="0.5"
                          value={petWeightLbs}
                          onChange={val => setPetWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>Microchip RFID # *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petMicrochip}
                          onChange={e => setPetMicrochip(e.target.value)}
                          placeholder="985141002849102 (15-digit ISO)"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>ISO 11784/11785 Compliant</span>
                      </div>
                    </div>

                    {/* Snub-nosed / Brachycephalic Warning Toggle */}
                    <div className="operability-toggle-row" style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        className={`operable-option-card ${petIsBrachycephalic ? 'warning-active' : ''}`}
                        onClick={() => setPetIsBrachycephalic(!petIsBrachycephalic)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">Brachycephalic / Snub-Nosed Breed Protocol</span>
                            <span className={`opt-badge-pill ${petIsBrachycephalic ? 'brachy-badge active' : 'brachy-badge'}`}>
                              {petIsBrachycephalic ? '⚠️ RESTRICTIVE AIRWAY ACTIVE' : 'STANDARD AIRWAY'}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {petIsBrachycephalic && <span className="opt-radio-dot" style={{ backgroundColor: '#D3070B' }} />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Pugs, French Bulldogs, Persian cats, and other short-muzzle breeds have restricted airways. When active, strict ambient temperature thresholds (under 75°F / 24°C) and expedited non-stop flight routes are automatically enforced.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: IATA LAR Certified Travel Crate & Dimensions */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">2. IATA LAR Certified Travel Kennel & Scaled Dimensions</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Travel Kennel Specification *</label>
                        <select
                          value={petCrateType}
                          onChange={e => {
                            const val = e.target.value;
                            setPetCrateType(val);
                            if (val.includes('Series 400')) {
                              setPetCrateLength(36); setPetCrateWidth(25); setPetCrateHeight(27); setPetCrateWeightLbs(22);
                            } else if (val.includes('Series 500')) {
                              setPetCrateLength(40); setPetCrateWidth(27); setPetCrateHeight(30); setPetCrateWeightLbs(28);
                            } else if (val.includes('Series 200')) {
                              setPetCrateLength(26); setPetCrateWidth(18); setPetCrateHeight(19); setPetCrateWeightLbs(12);
                            } else if (val.includes('Series 100')) {
                              setPetCrateLength(21); setPetCrateWidth(16); setPetCrateHeight(15); setPetCrateWeightLbs(8);
                            }
                          }}
                        >
                          <option value="IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)">IATA LAR Series 400 (Large Dog - 36×25×27 in)</option>
                          <option value="IATA LAR Certified Series 500 (X-Large Rigid Kennel - 40×27×30 in)">IATA LAR Series 500 (X-Large Dog - 40×27×30 in)</option>
                          <option value="IATA LAR Certified Series 200 (Medium Rigid Kennel - 26×18×19 in)">IATA LAR Series 200 (Medium Dog/Cat - 26×18×19 in)</option>
                          <option value="IATA LAR Certified Series 100 (Small Rigid Kennel - 21×16×15 in)">IATA LAR Series 100 (Small Cat/Toy Dog - 21×16×15 in)</option>
                          <option value="Custom Reinforced Wooden Sky Crate (IATA CR-82 Heavy Duty)">Custom Reinforced Wooden Sky Crate (CR-82 Heavy Duty)</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>Kennel Tare Weight ({units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="0.5"
                          value={petCrateWeightLbs}
                          onChange={val => setPetCrateWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="input-grid-3" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>Crate Length ({units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateLength}
                          onChange={val => setPetCrateLength(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>Crate Width ({units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateWidth}
                          onChange={val => setPetCrateWidth(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>Crate Height ({units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateHeight}
                          onChange={val => setPetCrateHeight(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    {/* Weight Breakdown Callout */}
                    <div className="pet-weight-calc-pill">
                      <PawPrint size={14} className="text-rose" />
                      <span>
                        Live Scaled Manifest Weight: <strong>{formatWeight(petWeightLbs, units.system)} (Pet Net)</strong> + <strong>{formatWeight(petCrateWeightLbs, units.system)} (Crate Tare)</strong> = <strong className="font-mono text-emerald">{totalWeight.toFixed(1)} lbs Total Scaled Weight</strong>
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Veterinary Health & USDA APHIS Certification */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">3. Veterinary Health & Regulatory Documentation (USDA / CVI)</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Certificate of Veterinary Inspection (CVI #) *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petHealthCertNumber}
                          onChange={e => setPetHealthCertNumber(e.target.value)}
                          placeholder="e.g. CVI-NY-2026-88194"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>Valid within 10 days of travel</span>
                      </div>
                      <div className="input-field">
                        <label>Rabies Vaccination Tag # & Clinic *</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petRabiesTag}
                          onChange={e => setPetRabiesTag(e.target.value)}
                          placeholder="e.g. RAB-2027-11-04 (NY Dept of Health)"
                        />
                      </div>
                    </div>

                    <div className="input-grid-2" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>Attending Veterinary Hospital / Clinic</label>
                        <input
                          type="text"
                          value={petVetClinic}
                          onChange={e => setPetVetClinic(e.target.value)}
                          placeholder="e.g. Manhattan Animal Health Hospital"
                        />
                      </div>
                      <div className="input-field">
                        <label>24/7 Emergency Attending Vet Phone #</label>
                        <input
                          type="text"
                          value={petVetPhone}
                          onChange={e => setPetVetPhone(e.target.value)}
                          placeholder="e.g. (212) 555-0149"
                        />
                      </div>
                    </div>

                    <div className="operability-toggle-row" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className={`operable-option-card ${petAcclimationCert ? 'active' : ''}`}
                        onClick={() => setPetAcclimationCert(!petAcclimationCert)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">USDA Acclimation Certificate Attached</span>
                            <span className="opt-badge-pill operable-badge">VET ENDORSED</span>
                          </div>
                          <div className="opt-radio-circle">
                            {petAcclimationCert && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          Licensed veterinarian certifies the animal has acclimated to temperature ranges down to 45°F (7°C) or up to 85°F (29°C), ensuring compliant ground and tarmac operations.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 4: Welfare, Feeding & Hydration Protocols */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">4. Animal Welfare, Nutrition & Hydration Directives</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>Pre-Departure Feeding Timestamp</label>
                        <input
                          type="text"
                          value={petLastFed}
                          onChange={e => setPetLastFed(e.target.value)}
                          placeholder="e.g. 4 Hours Prior to Tender (Light Meal)"
                        />
                      </div>
                      <div className="input-field">
                        <label>Hydration & Water Protocol</label>
                        <input
                          type="text"
                          value={petWaterProtocol}
                          onChange={e => setPetWaterProtocol(e.target.value)}
                          placeholder="e.g. Fresh spring water refreshed at every terminal transfer"
                        />
                      </div>
                    </div>

                    <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                      <label>Special Welfare Instructions & Calming Protocol</label>
                      <textarea
                        rows={2}
                        value={petSpecialInstructions}
                        onChange={e => setPetSpecialInstructions(e.target.value)}
                        placeholder="e.g. Favorite blanket inside kennel. No sedation per AVMA rules. Keep away from excessive noise or vehicle exhaust."
                      />
                    </div>

                    <div className="cargo-checklist-block" style={{ marginTop: '1rem' }}>
                      <label className="section-field-label">Mandatory Live Animal Welfare Directives</label>
                      <div className="checklist-grid-2">
                        {[
                          'Dual Door-Accessible Food/Water Dishes Attached',
                          'IATA Live Animals (AVI) Green Label Affixed',
                          'Active Climate Control 68°F-74°F Hold Guaranteed',
                          'Absorbent Bedding Layer Pre-Installed',
                          'Emergency 24/7 Vet On-Call Authorized',
                          'No Sedatives / Tranquilizers Administered (AVMA Compliance)',
                          'Priority Tarmac Ramp Transfer (Sun Shielding)'
                        ].map((directive, idx) => {
                          const isChecked = petCareDirectives.includes(directive);
                          return (
                            <div
                              key={idx}
                              className={`checklist-item-card ${isChecked ? 'active' : ''}`}
                              onClick={() => handleTogglePetDirective(directive)}
                            >
                              <div className="chk-icon">
                                {isChecked ? <CheckSquare size={16} className="text-rose" /> : <Square size={16} className="text-slate-500" />}
                              </div>
                              <span className="chk-label">{directive}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASE B: GENERAL PACKAGES / MULTI-PIECE EDITOR */
                <div>
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>03. Packages & Pieces</h3>
                        <p>Configure single-piece or multi-piece cargo payload. Traditional Code 128 barcodes will be generated.</p>
                      </div>
                      <button
                        type="button"
                        className="add-package-btn"
                        onClick={handleAddPackage}
                      >
                        <Plus size={14} /> Add Another Package
                      </button>
                    </div>
                  </div>

                  {/* Package List */}
                  <div className="packages-accordion-list">
                    {packagesList.map((pkg, idx) => (
                      <div key={pkg.id} className="package-editor-card">
                        <div className="pkg-card-head">
                          <div className="pkg-head-left">
                            <span className="pkg-num-badge">PIECE 0{idx + 1}</span>
                            <span className="pkg-preview-meta">{[formatWeight(pkg.weightLbs, units.system), formatDimensions(pkg, units.system)].filter(Boolean).join(' • ')}</span>
                          </div>
                          {packagesList.length > 1 && (
                            <button
                              type="button"
                              className="pkg-remove-btn"
                              onClick={() => handleRemovePackage(pkg.id)}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          )}
                        </div>

                        <div className="pkg-card-body">
                          <div className="input-grid-3">
                            <div className="input-field">
                              <label>Package Type</label>
                              <select
                                value={pkg.type}
                                onChange={e => handleUpdatePackage(pkg.id, 'type', e.target.value)}
                              >
                                <option value="Box">Box</option>
                                <option value="Envelope">Envelope</option>
                                <option value="Pallet">Pallet</option>
                                <option value="Crate">Crate</option>
                                <option value="Tube">Tube</option>
                              </select>
                            </div>
                            <div className="input-field">
                              <label>Weight ({units.weight}) *</label>
                              <MeasureInput
                                kind="weight"
                                step="0.1"
                                min="0.1"
                                value={pkg.weightLbs}
                                onChange={v => handleUpdatePackage(pkg.id, 'weightLbs', v === '' ? 0 : v)}
                              />
                            </div>
                            <div className="input-field">
                              <label>Piece Content Description</label>
                              <input
                                type="text"
                                value={pkg.description}
                                onChange={e => handleUpdatePackage(pkg.id, 'description', e.target.value)}
                                placeholder="Piece content description"
                              />
                            </div>
                          </div>

                          <div className="dim-row-group">
                            <span className="dim-label">Dimensions ({units.length}):</span>
                            <div className="dim-input-group">
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={`Length (${units.length})`}
                                value={pkg.length}
                                onChange={v => handleUpdatePackage(pkg.id, 'length', v === '' ? 0 : v)}
                                placeholder="Length"
                              />
                              <span className="dim-x">×</span>
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={`Width (${units.length})`}
                                value={pkg.width}
                                onChange={v => handleUpdatePackage(pkg.id, 'width', v === '' ? 0 : v)}
                                placeholder="Width"
                              />
                              <span className="dim-x">×</span>
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={`Height (${units.length})`}
                                value={pkg.height}
                                onChange={v => handleUpdatePackage(pkg.id, 'height', v === '' ? 0 : v)}
                                placeholder="Height"
                              />
                            </div>
                            <span className="dim-calc-tag font-mono">
                              {formatWeight((pkg.length * pkg.width * pkg.height) / 139, units.system)} dim.
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Aggregate Strip */}
                  <div className="packages-total-bar">
                    <div className="total-stat-unit">
                      <span>Total Packages:</span>
                      <strong>{totalPieces}</strong>
                    </div>
                    <div className="total-stat-unit">
                      <span>Total Scale Weight:</span>
                      <strong>{formatWeight(totalWeight, units.system)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 4: SERVICE & SHIPPING REQUIREMENTS */}
          {/* ---------------------------------------------------- */}
          {currentStep === 4 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>04. Service & Operational Requirements</h3>
                <p>Specify service speed tier, pickup window, and operational cargo directives.</p>
              </div>

              {/* Integrated Transit Corridor Overview Strip */}
              <div className="step-corridor-strip">
                <div className="corridor-endpoint">
                  <span className="corridor-role">ORIGIN</span>
                  <strong>{senderCity || 'New York'}, {senderState || 'NY'}</strong>
                  <span className="corridor-zip font-mono">ZIP {senderZip || '10005'}</span>
                </div>
                <div className="corridor-arrow-bridge">
                  <span className="bridge-line" />
                  <div className="bridge-pill">
                    <Truck size={13} />
                    <span>Direct Transit Corridor</span>
                  </div>
                  <span className="bridge-line" />
                </div>
                <div className="corridor-endpoint dest">
                  <span className="corridor-role">DESTINATION</span>
                  <strong className="text-accent">{recipientCity || 'Los Angeles'}, {recipientState || 'CA'}</strong>
                  <span className="corridor-zip font-mono">ZIP {recipientZip || '90071'}</span>
                </div>
              </div>

              {/* Service Level Radio Pills */}
              <div className="form-group-block">
                <label className="section-field-label">Service Level</label>
                <div className="service-radio-grid">
                  {[
                    { id: 'Standard', label: 'Standard', desc: '3-5 business days transit' },
                    { id: 'Express', label: 'Express', desc: '1-2 business days guaranteed' },
                    { id: 'Priority', label: 'Priority', desc: 'Time-critical expedited' },
                    { id: 'Freight', label: 'Freight', desc: 'Heavy transport corridor' }
                  ].map(s => (
                    <label
                      key={s.id}
                      className={`service-radio-tile ${service === s.id ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="service"
                        checked={service === s.id}
                        onChange={() => setService(s.id as ServiceOption)}
                      />
                      <div className="srv-tile-body">
                        <strong>{s.label}</strong>
                        <small>{s.desc}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Transport Mode (main leg) */}
              <div className="form-group-block">
                <label className="section-field-label">Transport Mode</label>
                <div className="service-radio-grid">
                  {([
                    { id: 'Auto', label: 'Auto', desc: 'Chosen from distance and cargo' },
                    { id: 'Road', label: TRANSPORT_LEG_LABELS.Road, desc: 'Truck on real roads' },
                    { id: 'Air', label: TRANSPORT_LEG_LABELS.Air, desc: 'Flight between gateways' },
                    { id: 'Sea', label: TRANSPORT_LEG_LABELS.Sea, desc: 'Ocean freight between ports' }
                  ] as const).map(m => (
                    <label
                      key={m.id}
                      className={`service-radio-tile ${transportModeChoice === m.id ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="transportMode"
                        checked={transportModeChoice === m.id}
                        onChange={() => setTransportModeChoice(m.id)}
                      />
                      <div className="srv-tile-body">
                        <strong>{m.label}</strong>
                        <small>{m.desc}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pickup & Delivery Windows */}
              <div className="form-group-block">
                <label className="section-field-label">Schedule & Controlled Delivery Window</label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label>Preferred Pickup Date</label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)}
                    />
                  </div>
                  <div className="input-field">
                    <label>Pickup Time Window</label>
                    <input
                      type="text"
                      value={pickupWindow}
                      onChange={e => setPickupWindow(e.target.value)}
                      placeholder="e.g. 09:00 AM - 12:00 PM"
                    />
                  </div>
                  <div className="input-field">
                    <label>Expected Delivery Date (ETA)</label>
                    <input
                      type="text"
                      value={expectedDeliveryDate}
                      onChange={e => { setExpectedDeliveryDate(e.target.value); setExpectedDeliveryDateTouched(true); }}
                      placeholder="e.g. August 22, 2026"
                    />
                    {expectedDeliveryDateTouched ? (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>
                        Manual override.{' '}
                        <button
                          type="button"
                          onClick={() => setExpectedDeliveryDateTouched(false)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                        >
                          Use calculated ETA
                        </button>
                      </span>
                    ) : (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>Auto-calculated from route, service &amp; pickup date.</span>
                    )}
                    {dateOrderWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {dateOrderWarning}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Handling Checkboxes */}
              <div className="form-group-block">
                <label className="section-field-label">Special Handling Directives</label>
                <div className="handling-checkbox-grid">
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isFragile}
                      onChange={e => setIsFragile(e.target.checked)}
                    />
                    <span>Fragile Cargo</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isOversized}
                      onChange={e => setIsOversized(e.target.checked)}
                    />
                    <span>Oversized Item</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isSpecialHandling}
                      onChange={e => setIsSpecialHandling(e.target.checked)}
                    />
                    <span>Special Handling</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isSignatureRequired}
                      onChange={e => setIsSignatureRequired(e.target.checked)}
                    />
                    <span>Signature Required</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isOtherHandling}
                      onChange={e => setIsOtherHandling(e.target.checked)}
                    />
                    <span>Other Requirements</span>
                  </label>
                </div>

                {isOtherHandling && (
                  <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                    <label>Additional Instructions</label>
                    <textarea
                      rows={2}
                      value={otherHandlingInstructions}
                      onChange={e => setOtherHandlingInstructions(e.target.value)}
                      placeholder="Specify unique handling or custody requirements..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 5: PRICING (PRIVATE ADMIN) */}
          {/* ---------------------------------------------------- */}
          {currentStep === 5 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>05. Shipment Pricing (Administrator only)</h3>
                <p>Internal rate calculation. Pricing is PRIVATE and never automatically displayed to customers.</p>
              </div>

              {/* Pricing Line Items */}
              <div className="pricing-calculator-card">
                <div className="pricing-row-input">
                  <label>Base Linehaul Rate ({money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={baseRate}
                    onChange={val => setBaseRate(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>Additional Charges / Handling ({money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={additionalCharges}
                    onChange={val => setAdditionalCharges(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>Distance / Fuel Surcharges ({money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={surcharges}
                    onChange={val => setSurcharges(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>Discount ({money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={discount}
                    onChange={val => setDiscount(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>Manual Adjustment ({money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={manualAdjustment}
                    onChange={val => setManualAdjustment(val === '' ? 0 : val)}
                  />
                </div>

                <div className="final-price-strip">
                  <span>FINAL SHIPPING PRICE</span>
                  <strong className="font-mono text-blue">{money.format(finalPrice)} {money.currency}</strong>
                </div>
              </div>

              <div className="form-group-block">
                <label className="section-field-label">Private Internal Pricing Note</label>
                <div className="input-field full-width">
                  <input
                    type="text"
                    value={internalPricingNotes}
                    onChange={e => setInternalPricingNotes(e.target.value)}
                    placeholder="e.g. Special negotiated rate for this shipment"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 6: REVIEW & CREATE */}
          {/* ---------------------------------------------------- */}
          {currentStep === 6 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>06. Review & Create</h3>
                <p>Carefully verify all shipment specifications before generating tracking identity.</p>
              </div>

              <div className="review-summary-container">
                {/* Review: Shipment & Cargo */}
                <div className="review-segment">
                  <span className="seg-title">SHIPMENT & CARGO</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>Type:</small>
                      <strong>{shipmentType}</strong>
                    </div>
                    <div>
                      <small>Cargo Description:</small>
                      <strong className="text-blue">{shipmentDescription}</strong>
                    </div>
                  </div>
                </div>

                {/* If Vehicle, Show Specific Identity */}
                {shipmentType === 'Vehicle' && (
                  <div className="review-segment vehicle-highlight">
                    <span className="seg-title">VEHICLE CARGO IDENTIFIERS</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Vehicle:</small>
                        <strong>{vehYear} {vehMake} {vehModel} ({vehColor})</strong>
                      </div>
                      <div>
                        <small>VIN Number:</small>
                        <strong className="font-mono">{vehVin}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Operability:</small>
                        <span>{vehOperable ? 'Operable (Runs & Drives)' : 'Inoperable'}</span>
                      </div>
                      <div>
                        <small>Documents & Keys:</small>
                        <span>{itemsReceived.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Pallet, Show Skid Configuration */}
                {shipmentType === 'Pallet' && (
                  <div className="review-segment pallet-highlight">
                    <span className="seg-title">PALLET & SKID SPECIFICATIONS</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Pallet Standard:</small>
                        <strong>{palletStandard}</strong>
                      </div>
                      <div>
                        <small>Skids / Units:</small>
                        <strong>{palletCount} Skids ({formatWeight(palletWeightPerSkid, units.system)}/skid • {formatLength(palletHeightIn, units.system)} high)</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Stackability Directive:</small>
                        <span className={palletStackable ? 'text-emerald font-bold' : 'text-accent font-bold'}>
                          {palletStackable ? 'Stackable (Double-Stack Certified)' : 'Do Not Double Stack (Top-Tier Only)'}
                        </span>
                      </div>
                      <div>
                        <small>Securing Compliance:</small>
                        <span>{palletSecuringChecks.join(', ') || 'Standard wrap'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Container, Show Intermodal FCL Details */}
                {shipmentType === 'Container' && (
                  <div className="review-segment container-highlight">
                    <span className="seg-title">INTERMODAL FCL CONTAINER IDENTIFIERS</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Container Unit # (ISO 6346):</small>
                        <strong className="font-mono text-blue">{containerNumber}</strong>
                      </div>
                      <div>
                        <small>ISO Equipment Size:</small>
                        <strong>{containerIsoSize}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>High-Security Bolt Seal #:</small>
                        <strong className="font-mono text-emerald">{containerBoltSeal}</strong>
                      </div>
                      <div>
                        <small>SOLAS VGM Scale Weight:</small>
                        <strong className="font-mono">{formatWeight(containerVgmWeight, units.system)}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Terminal Interchange:</small>
                        <span>{containerTerminal}</span>
                      </div>
                      <div>
                        <small>Customs Pre-Gate:</small>
                        <span>{containerCustomsStatus}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Freight, Show LTL Rating & Dock Directives */}
                {shipmentType === 'Freight' && (
                  <div className="review-segment freight-highlight">
                    <span className="seg-title">HEAVY FREIGHT & LTL RATING</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Freight Class:</small>
                        <strong className="text-blue">{freightClass}</strong>
                      </div>
                      <div>
                        <small>NMFC Classification:</small>
                        <strong className="font-mono">{freightNmfcCode}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Loading Facility Dock:</small>
                        <span>{freightLoadingMethod}</span>
                      </div>
                      <div>
                        <small>Liftgate Required:</small>
                        <span>
                          Pickup: {freightLiftgatePickup ? 'Yes' : 'No'} • Delivery: {freightLiftgateDelivery ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    {freightHazMat && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>Hazardous Materials (HazMat):</small>
                        <strong className="text-accent">{freightUnNumber || 'HazMat Regulated'}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* If Document, Show Custody & Security Seal */}
                {shipmentType === 'Document' && (
                  <div className="review-segment doc-highlight">
                    <span className="seg-title">SECURE DOCUMENT & CUSTODY SPECIFICATIONS</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Courier Pouch Format:</small>
                        <strong>{docEnvelopeType}</strong>
                      </div>
                      <div>
                        <small>Tamper-Evident Seal #:</small>
                        <strong className="font-mono text-emerald">{docSealNumber}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Signature Mandate:</small>
                        <strong className="text-emerald">
                          {docDirectSignOnly ? 'Direct In-Person Photo ID Signature Required' : 'Standard Delivery'}
                        </strong>
                      </div>
                      <div>
                        <small>Delivery Commitment:</small>
                        <span>{docUrgentDeadline}</span>
                      </div>
                    </div>
                    {docFilingCourtRef && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>Filing Reference / Court Ref:</small>
                        <strong className="font-mono">{docFilingCourtRef}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* If Pet, Show Live Animal & Veterinary Care Highlights */}
                {shipmentType === 'Pets' && (
                  <div className="review-segment pet-highlight">
                    <span className="seg-title">LIVE ANIMAL (AVI) & VETERINARY CARE SPECIFICATIONS</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>Pet Identity:</small>
                        <strong>{petName} ({petSpecies} • {petBreed})</strong>
                      </div>
                      <div>
                        <small>RFID Microchip #:</small>
                        <strong className="font-mono text-emerald">{petMicrochip}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Travel Kennel / Crate:</small>
                        <span>{petCrateType} ({formatDimensions({ length: petCrateLength, width: petCrateWidth, height: petCrateHeight }, units.system)} • Tare {formatWeight(petCrateWeightLbs, units.system)})</span>
                      </div>
                      <div>
                        <small>Total Live Scaled Weight:</small>
                        <strong className="font-mono">{formatWeight(totalWeight, units.system)} (Pet: {formatWeight(petWeightLbs, units.system)} + Crate: {formatWeight(petCrateWeightLbs, units.system)})</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Veterinary CVI Health Cert:</small>
                        <strong className="font-mono text-blue">{petHealthCertNumber}</strong>
                      </div>
                      <div>
                        <small>Rabies Tag # & Clinic:</small>
                        <span>{petRabiesTag} ({petVetClinic})</span>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>Brachycephalic (Snub-Nosed):</small>
                        <span className={petIsBrachycephalic ? 'text-accent font-bold' : 'text-slate-300'}>
                          {petIsBrachycephalic ? '⚠️ YES - Snub Nosed (Strict Temp Directives Active)' : 'No (Standard Airway)'}
                        </span>
                      </div>
                      <div>
                        <small>Acclimation Certification:</small>
                        <span className={petAcclimationCert ? 'text-emerald font-bold' : 'text-slate-400'}>
                          {petAcclimationCert ? 'Certified 45°F to 85°F Range' : 'Standard Cabin/Hold'}
                        </span>
                      </div>
                    </div>
                    {petCareDirectives.length > 0 && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>Active Animal Welfare Protocols:</small>
                        <span>{petCareDirectives.join(' • ')}</span>
                      </div>
                    )}
                    {petSpecialInstructions && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>Care & Feeding Directives:</small>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                          Last Fed: {petLastFed} | Hydration: {petWaterProtocol} | Notes: {petSpecialInstructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Review: Route */}
                <div className="review-segment">
                  <span className="seg-title">ROUTING</span>
                  <div className="review-route-display">
                    <div className="r-box">
                      <span className="r-tag">ORIGIN</span>
                      <strong>{senderCity}, {senderState} {senderZip}</strong>
                      <p>{senderName} • {senderCompany}</p>
                    </div>
                    <div className="r-arrow">↓</div>
                    <div className="r-box">
                      <span className="r-tag">DESTINATION</span>
                      <strong>{recipientCity}, {recipientState} {recipientZip}</strong>
                      <p>{recipientName} • {recipientCompany}</p>
                    </div>
                  </div>
                </div>

                {/* Review: Payload */}
                <div className="review-segment">
                  <span className="seg-title">PAYLOAD SPECIFICATIONS</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>Total Units:</small>
                      <strong>{totalPieces} {shipmentType === 'Vehicle' ? 'Vehicle' : shipmentType === 'Pets' ? 'Live Pet' : 'Pieces'}</strong>
                    </div>
                    <div>
                      <small>Total Weight:</small>
                      <strong>{formatWeight(totalWeight, units.system)} total</strong>
                    </div>
                  </div>
                </div>

                {/* Review: Operational Requirements */}
                <div className="review-segment">
                  <span className="seg-title">OPERATIONAL REQUIREMENTS</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>Pickup Window:</small>
                      <strong>{pickupDate} · {pickupWindow}</strong>
                    </div>
                    <div>
                      <small>Expected Delivery (ETA):</small>
                      <strong>{expectedDeliveryDate}{expectedDeliveryDateTouched ? ' (manual override)' : ''}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <small>Special Handling:</small>
                    <span>
                      {[
                        isFragile && 'Fragile',
                        isOversized && 'Oversized',
                        isSpecialHandling && 'Special Handling',
                        isSignatureRequired && 'Signature Required',
                        isOtherHandling && (otherHandlingInstructions || 'Other')
                      ].filter(Boolean).join(', ') || 'None'}
                    </span>
                  </div>
                </div>

                {/* Review: Pricing */}
                <div className="review-segment">
                  <span className="seg-title">ADMINISTRATIVE PRICING</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>Internal Final Price:</small>
                      <strong className="text-emerald font-mono">{money.format(finalPrice)} {money.currency}</strong>
                    </div>
                    <div>
                      <small>Service Level:</small>
                      <span>{service}</span>
                    </div>
                  </div>
                </div>

                {/* Generated Tracking Identity Display */}
                <div className="review-identity-card">
                  <span className="identity-pre-title">TRACKING IDENTITY · ASSIGNED ON REGISTRATION</span>
                  <strong className="identity-tracking font-mono">{generatedTrackingNumber || `${TRACKING_PREFIX}·····`}</strong>
                  {errors.submit && <span className="field-error-msg" role="alert">{errors.submit}</span>}
                  <div className="review-barcode-svg">
                    <svg className="code128-mini-svg" viewBox="0 0 280 40">
                      <rect x="5" y="2" width="3" height="36" fill="#000000" />
                      <rect x="11" y="2" width="2" height="36" fill="#000000" />
                      <rect x="16" y="2" width="5" height="36" fill="#000000" />
                      <rect x="24" y="2" width="2" height="36" fill="#000000" />
                      <rect x="29" y="2" width="5" height="36" fill="#000000" />
                      <rect x="37" y="2" width="3" height="36" fill="#000000" />
                      <rect x="43" y="2" width="4" height="36" fill="#000000" />
                      <rect x="50" y="2" width="2" height="36" fill="#000000" />
                      <rect x="55" y="2" width="6" height="36" fill="#000000" />
                      <rect x="64" y="2" width="3" height="36" fill="#000000" />
                      <rect x="70" y="2" width="4" height="36" fill="#000000" />
                      <rect x="77" y="2" width="5" height="36" fill="#000000" />
                      <rect x="85" y="2" width="2" height="36" fill="#000000" />
                      <rect x="90" y="2" width="5" height="36" fill="#000000" />
                      <rect x="98" y="2" width="3" height="36" fill="#000000" />
                      <rect x="104" y="2" width="6" height="36" fill="#000000" />
                      <rect x="113" y="2" width="2" height="36" fill="#000000" />
                      <rect x="118" y="2" width="5" height="36" fill="#000000" />
                      <rect x="126" y="2" width="3" height="36" fill="#000000" />
                      <rect x="132" y="2" width="6" height="36" fill="#000000" />
                      <rect x="141" y="2" width="3" height="36" fill="#000000" />
                      <rect x="147" y="2" width="4" height="36" fill="#000000" />
                      <rect x="154" y="2" width="5" height="36" fill="#000000" />
                      <rect x="162" y="2" width="2" height="36" fill="#000000" />
                      <rect x="167" y="2" width="6" height="36" fill="#000000" />
                      <rect x="176" y="2" width="3" height="36" fill="#000000" />
                      <rect x="182" y="2" width="4" height="36" fill="#000000" />
                      <rect x="189" y="2" width="5" height="36" fill="#000000" />
                      <rect x="197" y="2" width="2" height="36" fill="#000000" />
                      <rect x="202" y="2" width="6" height="36" fill="#000000" />
                      <rect x="211" y="2" width="4" height="36" fill="#000000" />
                      <rect x="218" y="2" width="2" height="36" fill="#000000" />
                      <rect x="223" y="2" width="5" height="36" fill="#000000" />
                      <rect x="231" y="2" width="3" height="36" fill="#000000" />
                      <rect x="237" y="2" width="6" height="36" fill="#000000" />
                      <rect x="246" y="2" width="4" height="36" fill="#000000" />
                      <rect x="253" y="2" width="2" height="36" fill="#000000" />
                      <rect x="258" y="2" width="5" height="36" fill="#000000" />
                      <rect x="266" y="2" width="4" height="36" fill="#000000" />
                    </svg>
                  </div>
                  <small className="identity-notice">
                    Creating this shipment will generate its unique tracking identity and make the consignment available across the live tracking portal.
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Step Navigation Bottom Bar */}
          <div className="step-nav-footer">
            <div className="step-footer-left">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="step-back-btn"
                  onClick={handlePrevStep}
                >
                  <ArrowLeft size={14} />
                  <span>Previous Step</span>
                </button>
              )}
            </div>

            <div className="step-footer-right">
              <span className="step-count-badge">STAGE {currentStep} OF 6</span>
              {currentStep < 6 ? (
                <button
                  type="button"
                  className="step-continue-btn"
                  onClick={handleNextStep}
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="create-shipment-final-btn"
                  onClick={handleFinalCreateShipment}
                  disabled={isCreatingShipment}
                >
                  <CheckCircle2 size={17} />
                  <span>{isCreatingShipment ? 'Verifying Route & Registering…' : 'Register Master Consignment'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PERSISTENT CONSIGNMENT PASSPORT (RIGHT) */}
        <aside className="persistent-summary-column">
          <div className="summary-sticky-card">
            <div className="summary-passport-header">
              <div className="summary-head-title-row">
                <span className="summary-carrier-tag">{COMPANY.toUpperCase()}</span>
                <span className="summary-live-badge">
                  <span className="summary-live-dot" />
                  <span>LIVE MANIFEST</span>
                </span>
              </div>
              <h4 className="summary-passport-title">Consignment Passport</h4>
            </div>

            {/* Visual Route Corridor */}
            <div className="summary-route-corridor">
              <div className="corridor-city origin">
                <span className="corridor-label">ORIGIN</span>
                <strong className="corridor-name">{senderCity || 'Origin'}{senderState ? `, ${senderState}` : ''}</strong>
              </div>
              <div className="corridor-arrow-wrap">
                <span className="corridor-line" />
                <span className="corridor-arrow">→</span>
              </div>
              <div className="corridor-city dest">
                <span className="corridor-label">DESTINATION</span>
                <strong className="corridor-name text-accent">{recipientCity || 'Destination'}{recipientState ? `, ${recipientState}` : ''}</strong>
              </div>
            </div>

            <div className="summary-specs-list">
              <div className="summary-line-item">
                <span className="s-prop">Handling Mode</span>
                <strong className="s-val">{shipmentType}</strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">Cargo Description</span>
                <strong className="s-val truncate-summary" title={shipmentDescription}>{shipmentDescription || 'Commercial Freight'}</strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">Service Class</span>
                <span className={`summary-service-pill ${(service || 'standard').toLowerCase().replace(/\s+/g, '-')}`}>
                  {service}
                </span>
              </div>

              <div className="summary-divider" />

              <div className="summary-line-item">
                <span className="s-prop">Payload Units</span>
                <strong className="s-val">
                  {shipmentType === 'Vehicle'
                    ? `1 Vehicle (${vehMake} ${vehModel})`
                    : shipmentType === 'Pallet'
                    ? `${palletCount} Skids (${palletStandard.split(' ')[0]})`
                    : shipmentType === 'Container'
                    ? `1 FCL Container (${containerIsoSize.split(' ')[0]})`
                    : shipmentType === 'Freight'
                    ? `${freightPiecesCount} Heavy Units (${freightClass.split(' ')[0]})`
                    : shipmentType === 'Document'
                    ? `1 Secure Pouch (${docEnvelopeType.split(' ')[0]})`
                    : shipmentType === 'Pets'
                    ? `1 Live Pet (${petName || 'Pet'} • ${petBreed || petSpecies})`
                    : `${totalPieces} ${totalPieces === 1 ? 'Package' : 'Packages'}`}
                </strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">Scale Weight</span>
                <strong className="s-val font-mono">{formatWeight(totalWeight, units.system)}</strong>
              </div>
            </div>

            <div className="summary-price-box">
              <div className="price-label-row">
                <span className="price-lead-label">COMMERCIAL TARIFF TOTAL</span>
                <span className="price-currency-tag">{money.currency}</span>
              </div>
              <div className="price-big-amount">
                <span className="amount-number font-mono">{money.format(finalPrice)}</span>
              </div>
            </div>

            <div className="summary-barcode-box">
              <div className="barcode-simulation-lines">
                <div className="b-bar w-2" /><div className="b-bar w-1" /><div className="b-bar w-3" />
                <div className="b-bar w-1" /><div className="b-bar w-4" /><div className="b-bar w-2" />
                <div className="b-bar w-3" /><div className="b-bar w-1" /><div className="b-bar w-2" />
                <div className="b-bar w-4" /><div className="b-bar w-1" /><div className="b-bar w-3" />
              </div>
              <span className="barcode-tracking-text font-mono">
                {generatedTrackingNumber || `${TRACKING_PREFIX}·····`}
              </span>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};
