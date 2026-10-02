import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Save, Building, User, Package, Calendar, MapPin } from 'lucide-react';
import { Shipment } from '../../types/shipment';
import { resolveLocation } from '../../services/geocodingService';
import './EditShipmentModal.css';
import { COMPANY_SHORT } from '../../config/brand';

interface EditShipmentModalProps {
  shipment: Shipment;
  onClose: () => void;
  onSave: (updated: Shipment) => void;
}

export const EditShipmentModal: React.FC<EditShipmentModalProps> = ({
  shipment,
  onClose,
  onSave
}) => {
  // Sender form state
  const initialSenderName = typeof shipment.sender === 'object' ? (shipment.sender?.name || '') : String(shipment.sender || '');
  const initialSenderCity = typeof shipment.origin === 'object' ? (shipment.origin?.city || 'New York') : 'New York';
  const initialSenderState = typeof shipment.origin === 'object' ? (shipment.origin?.state || 'NY') : 'NY';
  const initialSenderAddress = typeof shipment.sender === 'object' ? (shipment.sender?.addressLine || '100 Broadway') : '100 Broadway';

  // Recipient form state
  const initialRecipientName = typeof shipment.recipient === 'object' ? (shipment.recipient?.name || '') : String(shipment.recipient || '');
  const initialRecipientCity = typeof shipment.destination === 'object' ? (shipment.destination?.city || 'Los Angeles') : 'Los Angeles';
  const initialRecipientState = typeof shipment.destination === 'object' ? (shipment.destination?.state || 'CA') : 'CA';
  const initialRecipientAddress = typeof shipment.recipient === 'object' ? (shipment.recipient?.addressLine || '500 Grand Ave') : '500 Grand Ave';

  const [senderName, setSenderName] = useState(initialSenderName);
  const [senderCity, setSenderCity] = useState(initialSenderCity);
  const [senderState, setSenderState] = useState(initialSenderState);
  const [senderAddress, setSenderAddress] = useState(initialSenderAddress);
  // Company/Email/Phone/ZIP were entirely absent from this form — every save silently wiped
  // them out, because the PUT route replaces the whole stored sender/recipient JSON blob with
  // exactly what's submitted here (see server/routes/shipments.ts). A shipment created WITH a
  // real phone/email lost it the first time anyone opened and saved this editor.
  const [senderCompany, setSenderCompany] = useState(typeof shipment.sender === 'object' ? (shipment.sender?.company || '') : '');
  const [senderEmail, setSenderEmail] = useState(typeof shipment.sender === 'object' ? (shipment.sender?.email || '') : '');
  const [senderPhone, setSenderPhone] = useState(typeof shipment.sender === 'object' ? (shipment.sender?.phone || '') : '');
  const [senderZip, setSenderZip] = useState(typeof shipment.sender === 'object' ? ((shipment.sender as any)?.postalCode || '') : '');

  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [recipientCity, setRecipientCity] = useState(initialRecipientCity);
  const [recipientState, setRecipientState] = useState(initialRecipientState);
  const [recipientAddress, setRecipientAddress] = useState(initialRecipientAddress);
  const [recipientCompany, setRecipientCompany] = useState(typeof shipment.recipient === 'object' ? (shipment.recipient?.company || '') : '');
  const [recipientEmail, setRecipientEmail] = useState(typeof shipment.recipient === 'object' ? (shipment.recipient?.email || '') : '');
  const [recipientPhone, setRecipientPhone] = useState(typeof shipment.recipient === 'object' ? (shipment.recipient?.phone || '') : '');
  const [recipientZip, setRecipientZip] = useState(typeof shipment.recipient === 'object' ? ((shipment.recipient as any)?.postalCode || '') : '');

  const [service, setService] = useState(shipment.service || 'Express');
  const [shipmentType, setShipmentType] = useState(shipment.shipmentType || 'Parcel');
  const [cargoDescription, setCargoDescription] = useState(shipment.cargoDescription || '');
  const [totalWeight, setTotalWeight] = useState(String(shipment.totalWeightLbs || 25));
  const [totalPieces, setTotalPieces] = useState(String(shipment.totalPieces || 1));
  const [estDelivery, setEstDelivery] = useState(
    typeof shipment.estimatedDelivery === 'string'
      ? shipment.estimatedDelivery
      : ((shipment.estimatedDelivery as any)?.date || 'Aug 26, 2026')
  );

  // Cargo-type-specific state — initialized from whatever is already persisted for this
  // shipment (see Phase 5) so re-opening the editor on a Vehicle/Pet/Pallet/etc. shipment
  // shows its real data instead of blank fields, with sensible defaults only for a shipment
  // that has none yet (e.g. the admin is switching its type here for the first time).
  const veh = shipment.vehicleDetails;
  const [vehMake, setVehMake] = useState(veh?.make || '');
  const [vehModel, setVehModel] = useState(veh?.model || '');
  const [vehYear, setVehYear] = useState(String(veh?.year || 2024));
  const [vehVin, setVehVin] = useState(veh?.vin || '');
  const [vehColor, setVehColor] = useState(veh?.color || '');
  const [vehBodyType, setVehBodyType] = useState(veh?.bodyType || 'Sedan');
  const [vehCondition, setVehCondition] = useState(veh?.condition || 'Good');
  const [vehOperable, setVehOperable] = useState(veh?.operable !== false);
  const [vehExistingDamage, setVehExistingDamage] = useState((veh?.existingDamage || ['No major visible damage']).join(', '));
  const [vehInspectionNotes, setVehInspectionNotes] = useState(veh?.inspectionNotes || '');

  const pet = shipment.petDetails;
  const [petName, setPetName] = useState(pet?.name || '');
  const [petSpecies, setPetSpecies] = useState(pet?.species || 'Canine (Dog)');
  const [petBreed, setPetBreed] = useState(pet?.breed || '');
  const [petAge, setPetAge] = useState(pet?.age || '');
  const [petGender, setPetGender] = useState(pet?.gender || '');
  const [petWeightLbs, setPetWeightLbs] = useState(String(pet?.weightLbs || ''));
  const [petMicrochip, setPetMicrochip] = useState(pet?.microchipNumber || '');
  const [petCrateType, setPetCrateType] = useState(pet?.crateType || '');
  const [petHealthCert, setPetHealthCert] = useState(pet?.healthCertificateNumber || '');
  const [petRabiesTag, setPetRabiesTag] = useState(pet?.rabiesVaccineNumber || '');
  const [petVetClinic, setPetVetClinic] = useState(pet?.vetClinicName || '');
  const [petVetPhone, setPetVetPhone] = useState(pet?.vetPhone || '');
  const [petIsBrachycephalic, setPetIsBrachycephalic] = useState(!!pet?.isBrachycephalic);
  const [petAcclimationCert, setPetAcclimationCert] = useState(pet?.acclimationCertified !== false);
  const [petSpecialCareNotes, setPetSpecialCareNotes] = useState(pet?.specialCareNotes || '');

  const pallet = shipment.palletDetails;
  const [palletStandard, setPalletStandard] = useState(pallet?.standard || 'GMA Standard 48×40 in (US Wood)');
  const [palletCount, setPalletCount] = useState(String(pallet?.count || 1));
  const [palletWeightPerSkid, setPalletWeightPerSkid] = useState(String(pallet?.weightPerSkidLbs || ''));
  const [palletHeightIn, setPalletHeightIn] = useState(String(pallet?.heightIn || ''));
  const [palletStackable, setPalletStackable] = useState(!!pallet?.stackable);
  const [palletForkliftAccess, setPalletForkliftAccess] = useState(pallet?.forkliftAccess || '4-Way Forklift Entry');
  const [palletSecuringChecks, setPalletSecuringChecks] = useState((pallet?.securingChecks || []).join(', '));

  const container = shipment.containerDetails;
  const [containerNumber, setContainerNumber] = useState(container?.containerNumber || '');
  const [containerIsoSize, setContainerIsoSize] = useState(container?.isoSize || '40ft High-Cube (40HC)');
  const [containerBoltSeal, setContainerBoltSeal] = useState(container?.boltSeal || '');
  const [containerChassisNumber, setContainerChassisNumber] = useState(container?.chassisNumber || '');
  const [containerTerminal, setContainerTerminal] = useState(container?.terminal || '');
  const [containerVgmWeight, setContainerVgmWeight] = useState(String(container?.vgmWeightLbs || ''));
  const [containerTemperature, setContainerTemperature] = useState(container?.temperature || 'Ambient / Dry Cargo');
  const [containerCustomsStatus, setContainerCustomsStatus] = useState(container?.customsStatus || '');

  const freight = shipment.freightDetails;
  const [freightClass, setFreightClass] = useState(freight?.freightClass || 'Class 70');
  const [freightNmfcCode, setFreightNmfcCode] = useState(freight?.nmfcCode || '');
  const [freightLoadingMethod, setFreightLoadingMethod] = useState(freight?.loadingMethod || 'Standard Raised Commercial Loading Dock');
  const [freightLiftgatePickup, setFreightLiftgatePickup] = useState(!!freight?.liftgatePickup);
  const [freightLiftgateDelivery, setFreightLiftgateDelivery] = useState(!!freight?.liftgateDelivery);
  const [freightHazMat, setFreightHazMat] = useState(!!freight?.hazMat);
  const [freightUnNumber, setFreightUnNumber] = useState(freight?.unNumber || '');
  const [freightPiecesCount, setFreightPiecesCount] = useState(String(freight?.piecesCount || 1));
  const [freightTotalWeightLbs, setFreightTotalWeightLbs] = useState(String(freight?.totalWeightLbs || ''));

  const doc = shipment.documentDetails;
  const [docEnvelopeType, setDocEnvelopeType] = useState(doc?.envelopeType || `${COMPANY_SHORT} Waterproof Pouch`);
  const [docSealNumber, setDocSealNumber] = useState(doc?.sealNumber || '');
  const [docDirectSignOnly, setDocDirectSignOnly] = useState(doc?.directSignOnly !== false);
  const [docUrgentDeadline, setDocUrgentDeadline] = useState(doc?.urgentDeadline || '');
  const [docFilingCourtRef, setDocFilingCourtRef] = useState(doc?.filingCourtRef || '');
  const [docContentsDescription, setDocContentsDescription] = useState(doc?.contentsDescription || '');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const originQuery = [senderCity.trim(), senderState.trim()].filter(Boolean).join(', ');
    const destQuery = [recipientCity.trim(), recipientState.trim()].filter(Boolean).join(', ');
    const originGeo = resolveLocation(originQuery) || resolveLocation(senderCity.trim()) || resolveLocation(senderState.trim());
    const destGeo = resolveLocation(destQuery) || resolveLocation(recipientCity.trim()) || resolveLocation(recipientState.trim());

    const updated: Shipment = {
      ...shipment,
      service: service as any,
      shipmentType: shipmentType as any,
      cargoDescription: cargoDescription.trim() || shipment.cargoDescription,
      totalWeightLbs: parseFloat(totalWeight) || shipment.totalWeightLbs || 10,
      totalPieces: parseInt(totalPieces, 10) || shipment.totalPieces || 1,
      estimatedDelivery: estDelivery,
      origin: {
        city: senderCity.trim() || originGeo?.city || 'Origin',
        state: senderState.trim() || originGeo?.state || 'US',
        // The form has no country field: take it from the edited city, else keep the stored one.
        country: originGeo?.country || shipment.origin?.country || '',
        lat: originGeo?.lat || (shipment.origin as any)?.lat || 31.9686,
        lng: originGeo?.lng || (shipment.origin as any)?.lng || -99.9018,
        facility: originGeo?.facilityName || `${senderCity.trim()} Origin Hub`
      } as any,
      destination: {
        city: recipientCity.trim() || destGeo?.city || 'Destination',
        state: recipientState.trim() || destGeo?.state || 'US',
        country: destGeo?.country || shipment.destination?.country || '',
        lat: destGeo?.lat || (shipment.destination as any)?.lat || 38.9072,
        lng: destGeo?.lng || (shipment.destination as any)?.lng || -77.0369,
        facility: destGeo?.facilityName || `${recipientCity.trim()} Sort Hub`
      } as any,
      sender: {
        name: senderName.trim(),
        city: senderCity.trim(),
        state: senderState.trim(),
        addressLine: senderAddress.trim(),
        country: originGeo?.country || shipment.sender?.country || '',
        company: senderCompany.trim() || undefined,
        email: senderEmail.trim() || undefined,
        phone: senderPhone.trim() || undefined,
        postalCode: senderZip.trim() || undefined
      },
      recipient: {
        name: recipientName.trim(),
        city: recipientCity.trim(),
        state: recipientState.trim(),
        addressLine: recipientAddress.trim(),
        country: destGeo?.country || shipment.recipient?.country || '',
        company: recipientCompany.trim() || undefined,
        email: recipientEmail.trim() || undefined,
        phone: recipientPhone.trim() || undefined,
        postalCode: recipientZip.trim() || undefined
      },
      // Only the cargo-type-specific block matching the currently selected type is built —
      // the others are left as whatever was already on the shipment (matching how
      // shipmentType itself has always been freely editable here without clearing the
      // other type's persisted data; reclassifying a shipment's cargo type is a rare edge
      // case and out of scope for this pass).
      vehicleDetails: shipmentType === 'Vehicle' ? {
        make: vehMake.trim(),
        model: vehModel.trim(),
        year: parseInt(vehYear, 10) || new Date().getFullYear(),
        vin: vehVin.trim(),
        color: vehColor.trim(),
        bodyType: vehBodyType,
        operable: vehOperable,
        condition: vehCondition,
        existingDamage: vehExistingDamage.split(',').map(s => s.trim()).filter(Boolean),
        inspectionNotes: vehInspectionNotes.trim(),
        itemsReceived: veh?.itemsReceived
      } : shipment.vehicleDetails,
      petDetails: shipmentType === 'Pets' ? {
        name: petName.trim(),
        species: petSpecies,
        breed: petBreed.trim(),
        age: petAge.trim(),
        gender: petGender.trim(),
        microchipNumber: petMicrochip.trim(),
        weightLbs: parseFloat(petWeightLbs) || 0,
        crateType: petCrateType.trim(),
        crateDimensions: pet?.crateDimensions,
        healthCertificateNumber: petHealthCert.trim(),
        rabiesVaccineNumber: petRabiesTag.trim(),
        vetClinicName: petVetClinic.trim(),
        vetPhone: petVetPhone.trim(),
        isBrachycephalic: petIsBrachycephalic,
        acclimationCertified: petAcclimationCert,
        lastFedTimestamp: pet?.lastFedTimestamp,
        waterRefillProtocol: pet?.waterRefillProtocol,
        specialCareNotes: petSpecialCareNotes.trim()
      } : shipment.petDetails,
      palletDetails: shipmentType === 'Pallet' ? {
        standard: palletStandard,
        count: parseInt(palletCount, 10) || 1,
        weightPerSkidLbs: parseFloat(palletWeightPerSkid) || 0,
        heightIn: parseFloat(palletHeightIn) || 0,
        stackable: palletStackable,
        forkliftAccess: palletForkliftAccess,
        securingChecks: palletSecuringChecks.split(',').map(s => s.trim()).filter(Boolean)
      } : shipment.palletDetails,
      containerDetails: shipmentType === 'Container' ? {
        containerNumber: containerNumber.trim(),
        isoSize: containerIsoSize,
        boltSeal: containerBoltSeal.trim(),
        chassisNumber: containerChassisNumber.trim(),
        terminal: containerTerminal.trim(),
        vgmWeightLbs: parseFloat(containerVgmWeight) || 0,
        temperature: containerTemperature,
        customsStatus: containerCustomsStatus.trim()
      } : shipment.containerDetails,
      freightDetails: shipmentType === 'Freight' ? {
        freightClass,
        nmfcCode: freightNmfcCode.trim(),
        loadingMethod: freightLoadingMethod,
        liftgatePickup: freightLiftgatePickup,
        liftgateDelivery: freightLiftgateDelivery,
        hazMat: freightHazMat,
        unNumber: freightUnNumber.trim() || undefined,
        piecesCount: parseInt(freightPiecesCount, 10) || 1,
        totalWeightLbs: parseFloat(freightTotalWeightLbs) || 0
      } : shipment.freightDetails,
      documentDetails: shipmentType === 'Document' ? {
        envelopeType: docEnvelopeType,
        sealNumber: docSealNumber.trim(),
        directSignOnly: docDirectSignOnly,
        urgentDeadline: docUrgentDeadline.trim(),
        filingCourtRef: docFilingCourtRef.trim() || undefined,
        contentsDescription: docContentsDescription.trim()
      } : shipment.documentDetails,
      lastUpdated: 'Just now'
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="edit-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="edit-modal-header">
          <div className="edit-title-group">
            <span className="edit-badge">Consignment Editor</span>
            <div className="edit-waybill-wrap">
              <h3 className="edit-waybill font-mono">{shipment.trackingNumber}</h3>
              <span className="edit-route-sub">
                {senderCity}, {senderState} <ArrowRight size={11} className="text-accent" /> {recipientCity}, {recipientState}
              </span>
            </div>
          </div>
          <button type="button" className="edit-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="edit-modal-form">


          {/* Parties Grid (Shipper & Consignee side-by-side) */}
          <div className="parties-row-grid">
            {/* Section 1: Shipper / Sender */}
            <div className="form-section-card">
              <div className="section-head">
                <User size={13} className="text-accent" />
                <span>Shipper (Origin)</span>
              </div>
              <div className="form-fields-grid">
                <div className="edit-field full">
                  <label>Sender Full Name</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. John Anderson"
                    required
                  />
                </div>
                <div className="edit-field full">
                  <label>Company (Optional)</label>
                  <input
                    type="text"
                    value={senderCompany}
                    onChange={(e) => setSenderCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div className="edit-field">
                  <label>Email (Optional)</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="sender@company.com"
                  />
                </div>
                <div className="edit-field">
                  <label>Phone (Optional)</label>
                  <input
                    type="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="edit-field">
                  <label>Origin City</label>
                  <input
                    type="text"
                    value={senderCity}
                    onChange={(e) => setSenderCity(e.target.value)}
                    required
                  />
                </div>
                <div className="edit-field">
                  <label>State</label>
                  <input
                    type="text"
                    value={senderState}
                    onChange={(e) => setSenderState(e.target.value)}
                    maxLength={4}
                    required
                  />
                </div>
                <div className="edit-field full">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={(e) => setSenderAddress(e.target.value)}
                  />
                </div>
                <div className="edit-field">
                  <label>ZIP Code (Optional)</label>
                  <input
                    type="text"
                    value={senderZip}
                    onChange={(e) => setSenderZip(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Consignee / Recipient */}
            <div className="form-section-card">
              <div className="section-head">
                <Building size={13} className="text-blue" />
                <span>Consignee (Destination)</span>
              </div>
              <div className="form-fields-grid">
                <div className="edit-field full">
                  <label>Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Dr. Michael Johnson"
                    required
                  />
                </div>
                <div className="edit-field full">
                  <label>Company (Optional)</label>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div className="edit-field">
                  <label>Email (Optional)</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@company.com"
                  />
                </div>
                <div className="edit-field">
                  <label>Phone (Optional)</label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="edit-field">
                  <label>Destination City</label>
                  <input
                    type="text"
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    required
                  />
                </div>
                <div className="edit-field">
                  <label>State</label>
                  <input
                    type="text"
                    value={recipientState}
                    onChange={(e) => setRecipientState(e.target.value)}
                    maxLength={4}
                    required
                  />
                </div>
                <div className="edit-field full">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                  />
                </div>
                <div className="edit-field">
                  <label>ZIP Code (Optional)</label>
                  <input
                    type="text"
                    value={recipientZip}
                    onChange={(e) => setRecipientZip(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Consignment Cargo & Logistics */}
          <div className="form-section-card">
            <div className="section-head">
              <Package size={13} className="text-slate" />
              <span>Cargo & Service Specs</span>
            </div>
            <div className="cargo-specs-grid">
              <div className="edit-field">
                <label>Service Class</label>
                <select value={service} onChange={(e) => setService(e.target.value as any)}>
                  <option value="Express">Express</option>
                  <option value="Priority">Priority</option>
                  <option value="Standard">Standard</option>
                  <option value="Freight LTL">Freight LTL</option>
                </select>
              </div>
              <div className="edit-field">
                <label>Cargo Classification</label>
                <select value={shipmentType} onChange={(e) => setShipmentType(e.target.value as any)}>
                  <option value="Parcel">Parcel</option>
                  <option value="Document">Document</option>
                  <option value="Freight">Freight</option>
                  <option value="Pallet">Pallet</option>
                  <option value="Container">Container</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Pets">Pets</option>
                </select>
              </div>
              <div className="edit-field">
                <label>Total Pieces</label>
                <input
                  type="number"
                  min="1"
                  value={totalPieces}
                  onChange={(e) => setTotalPieces(e.target.value)}
                  required
                />
              </div>
              <div className="edit-field">
                <label>Scale Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  required
                />
              </div>
              <div className="edit-field span-2">
                <label>Cargo Description</label>
                <input
                  type="text"
                  value={cargoDescription}
                  onChange={(e) => setCargoDescription(e.target.value)}
                  placeholder="e.g. Automotive components, Electronics"
                />
              </div>
              <div className="edit-field span-2">
                <label>Estimated Delivery Schedule</label>
                <input
                  type="text"
                  value={estDelivery}
                  onChange={(e) => setEstDelivery(e.target.value)}
                  placeholder="e.g. Aug 28, 2026"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 4: Cargo-Type-Specific Details — only rendered for the currently
              selected Cargo Classification, and only ever writes that one type's block on
              save (see handleSubmit) */}
          {shipmentType === 'Vehicle' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Vehicle Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field">
                  <label>Make</label>
                  <input type="text" value={vehMake} onChange={(e) => setVehMake(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Model</label>
                  <input type="text" value={vehModel} onChange={(e) => setVehModel(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Year</label>
                  <input type="number" value={vehYear} onChange={(e) => setVehYear(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>VIN</label>
                  <input type="text" value={vehVin} onChange={(e) => setVehVin(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Color</label>
                  <input type="text" value={vehColor} onChange={(e) => setVehColor(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Body Type</label>
                  <input type="text" value={vehBodyType} onChange={(e) => setVehBodyType(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Condition</label>
                  <select value={vehCondition} onChange={(e) => setVehCondition(e.target.value)}>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={vehOperable} onChange={(e) => setVehOperable(e.target.checked)} />
                    <span>Operable</span>
                  </label>
                </div>
                <div className="edit-field span-2">
                  <label>Existing Damage (comma-separated)</label>
                  <input type="text" value={vehExistingDamage} onChange={(e) => setVehExistingDamage(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Inspection Notes</label>
                  <textarea value={vehInspectionNotes} onChange={(e) => setVehInspectionNotes(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          )}

          {shipmentType === 'Pets' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Live Pet Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field">
                  <label>Pet Name</label>
                  <input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Species</label>
                  <input type="text" value={petSpecies} onChange={(e) => setPetSpecies(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Breed</label>
                  <input type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Age</label>
                  <input type="text" value={petAge} onChange={(e) => setPetAge(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Gender</label>
                  <input type="text" value={petGender} onChange={(e) => setPetGender(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Weight (lbs)</label>
                  <input type="number" step="0.1" value={petWeightLbs} onChange={(e) => setPetWeightLbs(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Microchip Number</label>
                  <input type="text" value={petMicrochip} onChange={(e) => setPetMicrochip(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Crate Type</label>
                  <input type="text" value={petCrateType} onChange={(e) => setPetCrateType(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Health Certificate #</label>
                  <input type="text" value={petHealthCert} onChange={(e) => setPetHealthCert(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Rabies Vaccine #</label>
                  <input type="text" value={petRabiesTag} onChange={(e) => setPetRabiesTag(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Vet Clinic Name</label>
                  <input type="text" value={petVetClinic} onChange={(e) => setPetVetClinic(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Vet Phone</label>
                  <input type="text" value={petVetPhone} onChange={(e) => setPetVetPhone(e.target.value)} />
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={petIsBrachycephalic} onChange={(e) => setPetIsBrachycephalic(e.target.checked)} />
                    <span>Brachycephalic Breed</span>
                  </label>
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={petAcclimationCert} onChange={(e) => setPetAcclimationCert(e.target.checked)} />
                    <span>Acclimation Certified</span>
                  </label>
                </div>
                <div className="edit-field span-2">
                  <label>Special Care Notes</label>
                  <textarea value={petSpecialCareNotes} onChange={(e) => setPetSpecialCareNotes(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          )}

          {shipmentType === 'Pallet' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Pallet & Skid Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field span-2">
                  <label>Pallet Standard</label>
                  <input type="text" value={palletStandard} onChange={(e) => setPalletStandard(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Skid Count</label>
                  <input type="number" min="1" value={palletCount} onChange={(e) => setPalletCount(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Weight Per Skid (lbs)</label>
                  <input type="number" value={palletWeightPerSkid} onChange={(e) => setPalletWeightPerSkid(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Stack Height (in)</label>
                  <input type="number" value={palletHeightIn} onChange={(e) => setPalletHeightIn(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Forklift Access</label>
                  <input type="text" value={palletForkliftAccess} onChange={(e) => setPalletForkliftAccess(e.target.value)} />
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={palletStackable} onChange={(e) => setPalletStackable(e.target.checked)} />
                    <span>Stackable</span>
                  </label>
                </div>
                <div className="edit-field span-2">
                  <label>Securing Checks (comma-separated)</label>
                  <input type="text" value={palletSecuringChecks} onChange={(e) => setPalletSecuringChecks(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {shipmentType === 'Container' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Intermodal Container Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field">
                  <label>Container Number</label>
                  <input type="text" value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>ISO Size</label>
                  <input type="text" value={containerIsoSize} onChange={(e) => setContainerIsoSize(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Bolt Seal #</label>
                  <input type="text" value={containerBoltSeal} onChange={(e) => setContainerBoltSeal(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Chassis Number</label>
                  <input type="text" value={containerChassisNumber} onChange={(e) => setContainerChassisNumber(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Terminal</label>
                  <input type="text" value={containerTerminal} onChange={(e) => setContainerTerminal(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>VGM Weight (lbs)</label>
                  <input type="number" value={containerVgmWeight} onChange={(e) => setContainerVgmWeight(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Temperature</label>
                  <input type="text" value={containerTemperature} onChange={(e) => setContainerTemperature(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Customs Status</label>
                  <input type="text" value={containerCustomsStatus} onChange={(e) => setContainerCustomsStatus(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {shipmentType === 'Freight' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Heavy Freight & LTL Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field">
                  <label>Freight Class</label>
                  <input type="text" value={freightClass} onChange={(e) => setFreightClass(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>NMFC Code</label>
                  <input type="text" value={freightNmfcCode} onChange={(e) => setFreightNmfcCode(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Loading Method</label>
                  <input type="text" value={freightLoadingMethod} onChange={(e) => setFreightLoadingMethod(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Pieces Count</label>
                  <input type="number" min="1" value={freightPiecesCount} onChange={(e) => setFreightPiecesCount(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Total Weight (lbs)</label>
                  <input type="number" value={freightTotalWeightLbs} onChange={(e) => setFreightTotalWeightLbs(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>UN Number (if HazMat)</label>
                  <input type="text" value={freightUnNumber} onChange={(e) => setFreightUnNumber(e.target.value)} />
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={freightLiftgatePickup} onChange={(e) => setFreightLiftgatePickup(e.target.checked)} />
                    <span>Liftgate Pickup</span>
                  </label>
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={freightLiftgateDelivery} onChange={(e) => setFreightLiftgateDelivery(e.target.checked)} />
                    <span>Liftgate Delivery</span>
                  </label>
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={freightHazMat} onChange={(e) => setFreightHazMat(e.target.checked)} />
                    <span>HazMat</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {shipmentType === 'Document' && (
            <div className="form-section-card">
              <div className="section-head">
                <Package size={13} className="text-blue" />
                <span>Secure Document Details</span>
              </div>
              <div className="cargo-specs-grid">
                <div className="edit-field span-2">
                  <label>Envelope / Pouch Type</label>
                  <input type="text" value={docEnvelopeType} onChange={(e) => setDocEnvelopeType(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Seal Number</label>
                  <input type="text" value={docSealNumber} onChange={(e) => setDocSealNumber(e.target.value)} />
                </div>
                <div className="edit-field checkbox-field">
                  <label>
                    <input type="checkbox" checked={docDirectSignOnly} onChange={(e) => setDocDirectSignOnly(e.target.checked)} />
                    <span>Direct Signature Only</span>
                  </label>
                </div>
                <div className="edit-field span-2">
                  <label>Urgent Deadline</label>
                  <input type="text" value={docUrgentDeadline} onChange={(e) => setDocUrgentDeadline(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Filing / Court Reference</label>
                  <input type="text" value={docFilingCourtRef} onChange={(e) => setDocFilingCourtRef(e.target.value)} />
                </div>
                <div className="edit-field span-2">
                  <label>Contents Description</label>
                  <textarea value={docContentsDescription} onChange={(e) => setDocContentsDescription(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="edit-modal-footer">
            <button type="button" className="edit-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="edit-btn-save">
              <Save size={15} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
