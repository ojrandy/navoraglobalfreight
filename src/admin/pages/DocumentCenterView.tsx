import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Tag,
  Receipt,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  MoreVertical,
  RotateCcw,
  ExternalLink,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Building,
  User,
  MapPin,
  Truck,
  ShieldCheck,
  Check,
  Ban,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Trash2,
  DollarSign
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminDocument, DocumentType, DocumentStatus } from '../../types/admin';
import { Barcode } from '../../components/Barcode';
import { COMPANY_SHORT, LEGAL_NAME } from '../../config/brand';
import { referenceFor } from '../../shared/references';
import './DocumentCenterView.css';
import { formatWeightBoth } from '../../shared/units';
import { useCurrency } from '../../utils/useCurrency';
import { MoneyInput } from '../../components/forms/UnitControls';
import {
  DocumentHeaderBrand,
  DocumentIdLine,
  DocumentLegalFooter,
  DocumentPouchLine,
  documentTitle
} from '../../components/DocumentBrand';

interface DocumentCenterViewProps {
  onOpenShipmentDetail?: (trackingNumber: string) => void;
  onSelectView?: (view: any) => void;
}

// jspdf and html2canvas are only needed when a PDF is actually generated, so they are
// downloaded on demand rather than with the admin console (MOTION_3D_SPEC §2).
function loadPdfTools() {
  return Promise.all([import('jspdf'), import('html2canvas')]).then(([pdf, canvas]) => ({
    jsPDF: pdf.default,
    html2canvas: canvas.default,
  }));
}

/**
 * Waits for every <img> inside a container (the company logo on every document "paper", plus
 * the signature/stamp image) to actually finish loading before proceeding. This is what was
 * missing before: the PDF export and print handlers only waited a fixed, arbitrary delay
 * (50-300ms) after mounting the paper and hoped that was enough time for images to load —
 * fine on a fast connection, but the logo would silently come out blank in the exported PDF
 * whenever it wasn't loaded in time (a slow connection, a cold cache, a restrictive network).
 * Waiting on the images' own load/error events instead makes this correct regardless of
 * network speed. `error` also resolves (not rejects) so one broken image can't hang the whole
 * export forever; the 4s cap is a last-resort safety net for an image that never fires either
 * event for some reason.
 */
function waitForImagesToLoad(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>(resolve => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 4000);
      });
    })
  ).then(() => undefined);
}

export const DocumentCenterView: React.FC<DocumentCenterViewProps> = ({
  onOpenShipmentDetail,
  onSelectView
}) => {
  const { shipments, documents, generateDocument, regenerateDocument, updateDocumentStatus, updateDocumentPaymentStatus, deleteDocument, settings } = useAdminData();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | DocumentType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DocumentStatus>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');

  // Active Document Action / Menu State
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; bottom: number; openUpward: boolean } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AdminDocument | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Generate Document Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genDocType, setGenDocType] = useState<DocumentType>('SHIPPING_LABEL');
  const [genShipmentTracking, setGenShipmentTracking] = useState<string>(shipments[0]?.trackingNumber || '');
  const [genInsuredValue, setGenInsuredValue] = useState<number | ''>('');
  const [genInsuredValueTouched, setGenInsuredValueTouched] = useState(false);
  // Values only the admin knows: nothing is invented when they're left empty (canonical USD).
  const [genBaseCharge, setGenBaseCharge] = useState<number | ''>('');
  const [genOversizeFee, setGenOversizeFee] = useState<number | ''>('');
  const [genSpecialFee, setGenSpecialFee] = useState<number | ''>('');
  const [genPaymentStatus, setGenPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [genInsurerName, setGenInsurerName] = useState('');
  const [genPolicyNumber, setGenPolicyNumber] = useState('');
  const [genCoverageType, setGenCoverageType] = useState('');
  const [genPremium, setGenPremium] = useState<number | ''>('');
  const [genDeductible, setGenDeductible] = useState<number | ''>('');
  const money = useCurrency();

  // The shipment behind the open document: transport mode (for the §11 title) and countries.
  const previewShipment = previewDoc ? shipments.find(s => s.trackingNumber === previewDoc.shipmentTracking) : undefined;
  const previewTitle = previewDoc ? documentTitle(previewDoc.docType, previewShipment?.transportMode) : '';
  const placeLine = (city?: string, state?: string, zip?: string, country?: string) =>
    [[city, state].filter(Boolean).join(', '), zip, country].filter(Boolean).join(' ');
  const senderPlace = (d: AdminDocument) => placeLine(d.senderCity, d.senderState, d.senderZip, previewShipment?.origin?.country);
  const recipientPlace = (d: AdminDocument) => placeLine(d.recipientCity, d.recipientState, d.recipientZip, previewShipment?.destination?.country);
  // Documents saved before 3.12 may hold placeholder values the old code invented; they are
  // treated as empty so they never print (stored data is left untouched).
  const INVENTED_VALUES = new Set([
    'Meridian Marine & Cargo Underwriters',
    'MCC-2026-778120',
    'All-Risk Cargo Coverage — Institute Cargo Clauses (A)',
    '72 × 24 × 18 in'
  ]);
  const real = (v?: string) => (v && !INVENTED_VALUES.has(v) ? v : '');
  const dims = (d: AdminDocument) => real(d.dimensions) || '—';
  // A seal is shown only when it is the tamper-evident seal recorded on the shipment itself
  // (document shipments); older documents carry randomly generated numbers.
  const realSeal = (d: AdminDocument) =>
    d.bolSealNumber && previewShipment?.documentDetails?.sealNumber === d.bolSealNumber ? d.bolSealNumber : '';

  // Regenerate Modal State
  const [regenerateDocTarget, setRegenerateDocTarget] = useState<AdminDocument | null>(null);
  const [regenNotes, setRegenNotes] = useState<string>('Updated with revised shipment parameters.');

  // Delete Confirmation Modal State
  const [deleteDocTarget, setDeleteDocTarget] = useState<AdminDocument | null>(null);

  // Live Summary Statistics (Real database counts)
  const stats = useMemo(() => {
    return {
      total: documents.length,
      shippingLabels: documents.filter(d => d.docType === 'SHIPPING_LABEL').length,
      receipts: documents.filter(d => d.docType === 'RECEIPT').length,
      invoices: documents.filter(d => d.docType === 'INVOICE').length,
      bols: documents.filter(d => d.docType === 'BOL').length,
      insuranceCerts: documents.filter(d => d.docType === 'INSURANCE').length
    };
  }, [documents]);

  // Filtered Document List
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        doc.id.toLowerCase().includes(term) ||
        doc.shipmentTracking.toLowerCase().includes(term) ||
        doc.senderName.toLowerCase().includes(term) ||
        (doc.senderCompany && doc.senderCompany.toLowerCase().includes(term)) ||
        doc.recipientName.toLowerCase().includes(term) ||
        (doc.recipientCompany && doc.recipientCompany.toLowerCase().includes(term)) ||
        doc.cargoDescription.toLowerCase().includes(term) ||
        doc.title.toLowerCase().includes(term);

      const matchesType = typeFilter === 'ALL' || doc.docType === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

      let matchesDate = true;
      if (dateFilter === 'TODAY' || dateFilter === 'THIS_MONTH') {
        const parsed = new Date(doc.createdDate);
        if (!isNaN(parsed.getTime())) {
          const now = new Date();
          matchesDate = dateFilter === 'TODAY'
            ? parsed.toDateString() === now.toDateString()
            : parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
        }
      }

      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [documents, searchTerm, typeFilter, statusFilter, dateFilter]);

  // Helper for Document Type Icon & Labels
  const getDocTypeMeta = (type: DocumentType) => {
    switch (type) {
      case 'SHIPPING_LABEL':
        return {
          icon: <Tag size={16} className="text-blue" />,
          label: 'Shipping Label',
          badgeClass: 'badge-type-label'
        };
      case 'RECEIPT':
        return {
          icon: <Receipt size={16} className="text-emerald" />,
          label: 'Shipment Receipt',
          badgeClass: 'badge-type-receipt'
        };
      case 'INVOICE':
        return {
          icon: <FileText size={16} className="text-indigo" />,
          label: 'Commercial Invoice',
          badgeClass: 'badge-type-invoice'
        };
      case 'BOL':
        return {
          icon: <FileSpreadsheet size={16} className="text-amber" />,
          label: 'Bill of Lading',
          badgeClass: 'badge-type-bol'
        };
      case 'INSURANCE':
        return {
          icon: <ShieldCheck size={16} className="text-purple" />,
          label: 'Insurance Certificate',
          badgeClass: 'badge-type-insurance'
        };
      default:
        return {
          icon: <FileText size={16} className="text-slate" />,
          label: type || 'Document',
          badgeClass: 'badge-type-label'
        };
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'GENERATED':
        return <span className="doc-status-badge badge-generated"><Check size={12} /> Generated</span>;
      case 'UPDATED':
        return <span className="doc-status-badge badge-updated"><Clock size={12} /> Updated (v2+)</span>;
      case 'CANCELLED':
        return <span className="doc-status-badge badge-cancelled"><Ban size={12} /> Cancelled</span>;
      default:
        return <span className="doc-status-badge badge-generated"><Check size={12} /> {String(status).replace(/_/g, ' ')}</span>;
    }
  };

  // Handlers
  const openGenerateModal = () => {
    // Every document starts blank: charges or insurance details from the previous one must
    // never carry over onto a different shipment's document.
    setGenInsuredValueTouched(false);
    setGenBaseCharge('');
    setGenOversizeFee('');
    setGenSpecialFee('');
    setGenPaymentStatus('PENDING');
    setGenInsurerName('');
    setGenPolicyNumber('');
    setGenCoverageType('');
    setGenPremium('');
    setGenDeductible('');
    setShowGenerateModal(true);
  };

  const closeMenu = () => {
    setActiveMenuDocId(null);
    setMenuAnchor(null);
  };

  // Suggest the insured value from the selected shipment's declared value, but never
  // overwrite a value the admin has deliberately typed in for this generation session
  useEffect(() => {
    if (genInsuredValueTouched) return;
    const s = shipments.find(sh => sh.trackingNumber === genShipmentTracking);
    setGenInsuredValue(s?.declaredValue ? s.declaredValue : '');
  }, [genShipmentTracking, shipments, genInsuredValueTouched]);

  // Close the actions menu on scroll/resize so it never lingers at a stale, disconnected position
  useEffect(() => {
    if (!activeMenuDocId) return;
    const handleDismiss = () => closeMenu();
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [activeMenuDocId]);

  const handleOpenPreview = (doc: AdminDocument) => {
    setPreviewDoc(doc);
    setSelectedVersionIndex(0);
    closeMenu();
  };

  const handlePrint = (doc: AdminDocument) => {
    setPreviewDoc(doc);
    closeMenu();
    setTimeout(async () => {
      // Wait for the logo (and stamp, on insurance certs) to actually finish loading before
      // handing off to the browser's print engine — same fix as the PDF export below.
      if (paperRef.current) {
        await waitForImagesToLoad(paperRef.current);
      }
      window.print();
    }, 200);
  };

  const handleDownloadPdf = async (doc: AdminDocument) => {
    closeMenu();
    const alreadyOpen = previewDoc?.id === doc.id;
    if (!alreadyOpen) {
      setPreviewDoc(doc);
    }
    setToastMessage(`Preparing PDF for ${doc.id}...`);
    // Fetch the PDF libraries while the paper mounts. A failed download is reported by the
    // try/catch below; this catch only stops it counting as unhandled if we return early.
    const pdfTools = loadPdfTools();
    pdfTools.catch(() => {});

    // Give the paper a moment to mount/render before snapshotting it
    await new Promise(resolve => setTimeout(resolve, alreadyOpen ? 50 : 300));

    const paperEl = paperRef.current;
    if (!paperEl) {
      setToastMessage(`Could not generate PDF for ${doc.id}. Please try again.`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    // The fixed delay above only gives the DOM a moment to mount — it does NOT guarantee the
    // logo (or stamp image) has actually finished downloading and decoding. html2canvas
    // snapshots whatever's on screen at the instant it's called, so a not-yet-loaded image
    // silently came out blank in the exported PDF. Waiting on the images' own load events
    // instead makes this correct regardless of connection speed.
    await waitForImagesToLoad(paperEl);

    try {
      const { jsPDF, html2canvas } = await pdfTools;
      const canvas = await html2canvas(paperEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${doc.id}.pdf`);
      setToastMessage(`Downloaded ${doc.id}.pdf`);
    } catch (err) {
      console.error('[PDF] Failed to generate PDF:', err);
      setToastMessage(`Failed to generate PDF for ${doc.id}. Please try again.`);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTriggerRegenerate = (doc: AdminDocument) => {
    setRegenerateDocTarget(doc);
    setRegenNotes(`Regenerated with latest consignment parameters on ${new Date().toLocaleDateString('en-US')}.`);
    closeMenu();
  };

  const handleConfirmRegenerate = () => {
    if (!regenerateDocTarget) return;
    const updated = regenerateDocument(regenerateDocTarget.id, regenNotes);
    if (updated) {
      setToastMessage(`Document ${updated.id} regenerated successfully to Version ${updated.version}!`);
      setRegenerateDocTarget(null);
      if (previewDoc && previewDoc.id === updated.id) {
        setPreviewDoc(updated);
      }
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleTriggerDelete = (doc: AdminDocument) => {
    setDeleteDocTarget(doc);
    closeMenu();
  };

  const handleConfirmDelete = () => {
    if (!deleteDocTarget) return;
    const deletedId = deleteDocTarget.id;
    deleteDocument(deletedId);
    setToastMessage(`Document ${deletedId} has been permanently deleted.`);
    setDeleteDocTarget(null);
    if (previewDoc && previewDoc.id === deletedId) {
      setPreviewDoc(null);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleCancel = (doc: AdminDocument) => {
    // Restoring a cancelled document previously always reset it to 'GENERATED', even if it
    // had already been regenerated one or more times before being cancelled — silently
    // erasing the fact that it was on a revised version and showing it as if it were still
    // the untouched original. Restore to 'UPDATED' when it has real revision history.
    const newStatus: DocumentStatus = doc.status === 'CANCELLED'
      ? (doc.version > 1 ? 'UPDATED' : 'GENERATED')
      : 'CANCELLED';
    updateDocumentStatus(doc.id, newStatus);
    setToastMessage(`Document ${doc.id} status changed to ${newStatus}.`);
    closeMenu();
    if (previewDoc && previewDoc.id === doc.id) {
      setPreviewDoc({ ...previewDoc, status: newStatus });
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTogglePaymentStatus = (doc: AdminDocument) => {
    const newPaymentStatus: 'PAID' | 'PENDING' = doc.charges?.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
    updateDocumentPaymentStatus(doc.id, newPaymentStatus);
    setToastMessage(`Document ${doc.id} marked as ${newPaymentStatus}.`);
    closeMenu();
    if (previewDoc && previewDoc.id === doc.id && previewDoc.charges) {
      setPreviewDoc({ ...previewDoc, charges: { ...previewDoc.charges, paymentStatus: newPaymentStatus } });
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate Document Form Submission
  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedShipment = shipments.find(s => s.trackingNumber === genShipmentTracking) || shipments[0];
    if (!selectedShipment) return;

    // Only real values go on a document: the shipment's own data and what the admin entered
    // in this form. Nothing is invented when a field is empty (it prints as "—" or is left out).
    const insuredValue = genDocType === 'INSURANCE'
      ? (genInsuredValue === '' ? 0 : Math.max(0, genInsuredValue))
      : (selectedShipment.declaredValue || 0);
    const amount = (v: number | '') => (v === '' ? 0 : v);
    const baseAmount = amount(genBaseCharge);
    const oversizeFee = amount(genOversizeFee);
    const specialHandlingFee = amount(genSpecialFee);
    const d = selectedShipment.dimensions;

    const newDoc = generateDocument({
      docType: genDocType,
      title: `${documentTitle(genDocType, selectedShipment.transportMode)} (${selectedShipment.trackingNumber})`,
      shipmentTracking: selectedShipment.trackingNumber,
      senderName: selectedShipment.sender.name,
      senderCompany: selectedShipment.sender.company || '',
      senderAddress: selectedShipment.sender.addressLine || '',
      senderCity: selectedShipment.origin.city,
      senderState: selectedShipment.origin.state,
      senderZip: selectedShipment.sender.postalCode || '',
      senderPhone: selectedShipment.sender.phone || '',
      senderEmail: selectedShipment.sender.email || '',
      recipientName: selectedShipment.recipient.name,
      recipientCompany: selectedShipment.recipient.company || '',
      recipientAddress: selectedShipment.recipient.addressLine || '',
      recipientCity: selectedShipment.destination.city,
      recipientState: selectedShipment.destination.state,
      recipientZip: selectedShipment.recipient.postalCode || '',
      recipientPhone: selectedShipment.recipient.phone || '',
      recipientEmail: selectedShipment.recipient.email || '',
      cargoDescription: selectedShipment.cargoDescription || '',
      shipmentType: selectedShipment.shipmentType || 'Parcel',
      service: selectedShipment.service || '',
      weightLbs: selectedShipment.totalWeightLbs || 0,
      pieces: selectedShipment.totalPieces || 1,
      dimensions: d && (d.length || d.width || d.height) ? `${d.length || '—'} × ${d.width || '—'} × ${d.height || '—'} in` : '',
      declaredValue: insuredValue,
      // Only document types with a payment status carry charges (entered in this form).
      charges: (genDocType === 'RECEIPT' || genDocType === 'INVOICE' || genDocType === 'BOL') ? {
        baseAmount,
        oversizeFee,
        specialHandlingFee,
        totalAmount: baseAmount + oversizeFee + specialHandlingFee,
        paymentStatus: genPaymentStatus
      } : undefined,
      bolCarrier: LEGAL_NAME,
      // The real tamper-evident seal recorded on a document shipment, if any.
      bolSealNumber: selectedShipment.documentDetails?.sealNumber || undefined,
      bolSpecialInstructions: selectedShipment.handlingRequirements?.otherInstructions || undefined,
      ...(genDocType === 'INSURANCE' ? {
        insurerName: genInsurerName.trim(),
        policyNumber: genPolicyNumber.trim(),
        coverageType: genCoverageType.trim() || undefined,
        premiumAmount: genPremium === '' ? undefined : genPremium,
        deductible: genDeductible === '' ? undefined : genDeductible
      } : {})
    });

    setShowGenerateModal(false);
    setToastMessage(`Successfully generated ${getDocTypeMeta(newDoc.docType).label} ${newDoc.id}!`);
    setPreviewDoc(newDoc);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="document-center-container animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="doc-toast-notification animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          1. PAGE HEADER
          ========================================================================= */}
      <div className="doc-page-header">
        <div className="doc-header-titles">
          <h2>Document Center</h2>
          <p>Generate, view, print, and manage shipment documents from one place.</p>
        </div>

        <div className="doc-header-actions">
          <button
            className="btn-generate-doc-primary"
            onClick={() => openGenerateModal()}
          >
            <Plus size={16} />
            <span>Generate Document</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SUMMARY CARDS (Live database counts)
          ========================================================================= */}
      <div className="doc-summary-cards-grid">
        <div
          className={`doc-summary-card ${typeFilter === 'SHIPPING_LABEL' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'SHIPPING_LABEL' ? 'ALL' : 'SHIPPING_LABEL')}
        >
          <div className="summary-card-icon-wrap icon-blue">
            <Tag size={20} />
          </div>
          <div className="summary-card-info">
            <span className="summary-card-label">Shipping Labels</span>
            <strong className="summary-card-count font-mono">{stats.shippingLabels}</strong>
          </div>
        </div>

        <div
          className={`doc-summary-card ${typeFilter === 'RECEIPT' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'RECEIPT' ? 'ALL' : 'RECEIPT')}
        >
          <div className="summary-card-icon-wrap icon-emerald">
            <Receipt size={20} />
          </div>
          <div className="summary-card-info">
            <span className="summary-card-label">Shipment Receipts</span>
            <strong className="summary-card-count font-mono">{stats.receipts}</strong>
          </div>
        </div>

        <div
          className={`doc-summary-card ${typeFilter === 'INVOICE' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'INVOICE' ? 'ALL' : 'INVOICE')}
        >
          <div className="summary-card-icon-wrap icon-indigo">
            <FileText size={20} />
          </div>
          <div className="summary-card-info">
            <span className="summary-card-label">Invoices</span>
            <strong className="summary-card-count font-mono">{stats.invoices}</strong>
          </div>
        </div>

        <div
          className={`doc-summary-card ${typeFilter === 'BOL' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'BOL' ? 'ALL' : 'BOL')}
        >
          <div className="summary-card-icon-wrap icon-amber">
            <FileSpreadsheet size={20} />
          </div>
          <div className="summary-card-info">
            <span className="summary-card-label">Bills of Lading</span>
            <strong className="summary-card-count font-mono">{stats.bols}</strong>
          </div>
        </div>

        <div
          className={`doc-summary-card ${typeFilter === 'INSURANCE' ? 'active' : ''}`}
          onClick={() => setTypeFilter(typeFilter === 'INSURANCE' ? 'ALL' : 'INSURANCE')}
        >
          <div className="summary-card-icon-wrap icon-purple">
            <ShieldCheck size={20} />
          </div>
          <div className="summary-card-info">
            <span className="summary-card-label">Insurance Certificates</span>
            <strong className="summary-card-count font-mono">{stats.insuranceCerts}</strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. DOCUMENT TYPE NAVIGATION TABS
          ========================================================================= */}
      <div className="doc-type-nav-tabs">
        <button
          className={`doc-nav-tab ${typeFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setTypeFilter('ALL')}
        >
          <span>All Documents</span>
          <span className="tab-count-pill">{stats.total}</span>
        </button>

        <button
          className={`doc-nav-tab ${typeFilter === 'SHIPPING_LABEL' ? 'active' : ''}`}
          onClick={() => setTypeFilter('SHIPPING_LABEL')}
        >
          <Tag size={15} />
          <span>Shipping Labels</span>
          <span className="tab-count-pill">{stats.shippingLabels}</span>
        </button>

        <button
          className={`doc-nav-tab ${typeFilter === 'RECEIPT' ? 'active' : ''}`}
          onClick={() => setTypeFilter('RECEIPT')}
        >
          <Receipt size={15} />
          <span>Shipment Receipts</span>
          <span className="tab-count-pill">{stats.receipts}</span>
        </button>

        <button
          className={`doc-nav-tab ${typeFilter === 'INVOICE' ? 'active' : ''}`}
          onClick={() => setTypeFilter('INVOICE')}
        >
          <FileText size={15} />
          <span>Invoices</span>
          <span className="tab-count-pill">{stats.invoices}</span>
        </button>

        <button
          className={`doc-nav-tab ${typeFilter === 'BOL' ? 'active' : ''}`}
          onClick={() => setTypeFilter('BOL')}
        >
          <FileSpreadsheet size={15} />
          <span>Bills of Lading</span>
          <span className="tab-count-pill">{stats.bols}</span>
        </button>

        <button
          className={`doc-nav-tab ${typeFilter === 'INSURANCE' ? 'active' : ''}`}
          onClick={() => setTypeFilter('INSURANCE')}
        >
          <ShieldCheck size={15} />
          <span>Insurance Certificates</span>
          <span className="tab-count-pill">{stats.insuranceCerts}</span>
        </button>
      </div>

      {/* =========================================================================
          4. SEARCH AND FILTER BAR
          ========================================================================= */}
      <div className="doc-search-filter-card">
        <div className="doc-search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="doc-search-input font-mono"
            placeholder="Search by document number, tracking number, sender, recipient..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="doc-filters-cluster">
          {/* Status Filter */}
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="GENERATED">Generated</option>
              <option value="UPDATED">Updated</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="filter-group">
            <label>Date:</label>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. MAIN DOCUMENT LIST & TABLE
          ========================================================================= */}
      <div className="doc-table-card">
        <div className="table-responsive-wrapper">
          <table className="doc-master-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Document</th>
                <th style={{ width: '16%' }}>Document Number</th>
                <th style={{ width: '16%' }}>Shipment</th>
                <th style={{ width: '20%' }}>Related Party</th>
                <th style={{ width: '12%' }}>Created</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-docs-row">
                    <div className="empty-docs-box">
                      <FileText size={36} className="empty-icon" />
                      <h4>No documents yet</h4>
                      <p>Documents generated from your shipments will appear here.</p>
                      <button
                        className="btn-empty-generate"
                        onClick={() => openGenerateModal()}
                      >
                        <Plus size={14} />
                        <span>Create Document</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map(doc => {
                  const meta = getDocTypeMeta(doc.docType);
                  return (
                    <tr key={doc.id} className={`doc-table-row ${doc.status === 'CANCELLED' ? 'row-cancelled' : ''}`}>
                      {/* Document Type & Title */}
                      <td>
                        <div className="doc-identity-cell">
                          <div className={`doc-type-icon-pill ${meta.badgeClass}`}>
                            {meta.icon}
                          </div>
                          <div className="doc-identity-text">
                            <strong className="doc-title-text">{doc.title}</strong>
                            <span className="doc-type-sub font-mono">{meta.label} · PDF</span>
                          </div>
                        </div>
                      </td>

                      {/* Document Number */}
                      <td>
                        <div className="doc-number-cell font-mono">
                          <strong>{doc.id}</strong>
                          {doc.version > 1 && (
                            <span className="version-pill font-mono">v{doc.version}</span>
                          )}
                        </div>
                      </td>

                      {/* Shipment Tracking */}
                      <td>
                        <div className="shipment-link-cell font-mono">
                          <span className="tracking-text">{doc.shipmentTracking}</span>
                          <span className="cargo-sub">{doc.cargoDescription}</span>
                        </div>
                      </td>

                      {/* Related Party (Sender -> Recipient) */}
                      <td>
                        <div className="parties-route-cell">
                          <div className="parties-line">
                            <span className="party-name sender">{doc.senderName}</span>
                            <ArrowRight size={12} className="party-arrow" />
                            <span className="party-name recipient">{doc.recipientName}</span>
                          </div>
                          <div className="route-sub">
                            {doc.senderCity}, {doc.senderState} → {doc.recipientCity}, {doc.recipientState}
                          </div>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td>
                        <div className="created-date-cell">
                          <span className="date-main">{doc.createdDate}</span>
                          <span className="file-size-sub font-mono">{doc.fileSize || '180 KB'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {renderStatusBadge(doc.status)}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="actions-cluster-cell">
                          <button
                            className="btn-view-doc-primary"
                            onClick={() => handleOpenPreview(doc)}
                            title="View Document"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          <div className="dropdown-action-wrap">
                            <button
                              className="btn-dots-menu"
                              onClick={e => {
                                e.stopPropagation();
                                if (activeMenuDocId === doc.id) {
                                  closeMenu();
                                  return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const estimatedMenuHeight = onOpenShipmentDetail ? 270 : 230;
                                const openUpward = window.innerHeight - rect.bottom < estimatedMenuHeight && rect.top > estimatedMenuHeight;
                                setMenuAnchor({ left: rect.right, top: rect.bottom, bottom: rect.top, openUpward });
                                setActiveMenuDocId(doc.id);
                              }}
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeMenuDocId === doc.id && menuAnchor && createPortal(
                              <>
                                <div className="doc-menu-backdrop" onClick={closeMenu} />
                                <div
                                  className="doc-action-menu-dropdown animate-fade-in"
                                  style={{
                                    position: 'fixed',
                                    left: Math.max(8, menuAnchor.left - 175),
                                    top: menuAnchor.openUpward ? undefined : menuAnchor.top + 6,
                                    bottom: menuAnchor.openUpward ? (window.innerHeight - menuAnchor.bottom + 6) : undefined
                                  }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    className="dropdown-item"
                                    onClick={() => handleOpenPreview(doc)}
                                  >
                                    <Eye size={14} />
                                    <span>View Document</span>
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={() => handleDownloadPdf(doc)}
                                  >
                                    <Download size={14} />
                                    <span>Download PDF</span>
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={() => handlePrint(doc)}
                                  >
                                    <Printer size={14} />
                                    <span>Print</span>
                                  </button>
                                  <button
                                    className="dropdown-item"
                                    onClick={() => handleTriggerRegenerate(doc)}
                                  >
                                    <RotateCcw size={14} />
                                    <span>Regenerate</span>
                                  </button>
                                  {onOpenShipmentDetail && (
                                    <button
                                      className="dropdown-item"
                                      onClick={() => {
                                        closeMenu();
                                        onOpenShipmentDetail(doc.shipmentTracking);
                                      }}
                                    >
                                      <ExternalLink size={14} />
                                      <span>View Shipment</span>
                                    </button>
                                  )}
                                  {doc.charges && (doc.docType === 'RECEIPT' || doc.docType === 'INVOICE' || doc.docType === 'BOL') && (
                                    <button
                                      className="dropdown-item"
                                      onClick={() => handleTogglePaymentStatus(doc)}
                                    >
                                      <DollarSign size={14} />
                                      <span>Mark as {doc.charges.paymentStatus === 'PAID' ? 'Pending' : 'Paid'}</span>
                                    </button>
                                  )}
                                  <div className="dropdown-divider" />
                                  <button
                                    className={`dropdown-item ${doc.status === 'CANCELLED' ? 'text-emerald' : 'text-danger'}`}
                                    onClick={() => handleToggleCancel(doc)}
                                  >
                                    {doc.status === 'CANCELLED' ? (
                                      <>
                                        <CheckCircle2 size={14} />
                                        <span>Restore Document</span>
                                      </>
                                    ) : (
                                      <>
                                        <Ban size={14} />
                                        <span>Cancel Document</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    className="dropdown-item text-danger"
                                    onClick={() => handleTriggerDelete(doc)}
                                  >
                                    <Trash2 size={14} />
                                    <span>Delete Document</span>
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="doc-table-footer">
          <span>Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> system documents</span>
          <span className="footer-sub">Official Regulatory & Consignment Records</span>
        </div>
      </div>

      {/* =========================================================================
          6. DOCUMENT PREVIEW MODAL / PANEL
          ========================================================================= */}
      {previewDoc && (
        <div className="doc-preview-modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="doc-preview-modal-container animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="preview-modal-header">
              <div className="header-left">
                <div className="doc-tag-pill">
                  {getDocTypeMeta(previewDoc.docType).icon}
                  <span>{getDocTypeMeta(previewDoc.docType).label}</span>
                </div>
                <h3 className="font-mono">{previewDoc.id}</h3>
                {previewDoc.version > 1 && (
                  <span className="preview-version-pill font-mono">
                    Version {previewDoc.version} — Current
                  </span>
                )}
              </div>

              <div className="header-actions-right">
                <button
                  className="btn-preview-action"
                  onClick={() => handleDownloadPdf(previewDoc)}
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>
                <button
                  className="btn-preview-action"
                  onClick={() => handlePrint(previewDoc)}
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
                <button
                  className="btn-preview-action"
                  onClick={() => handleTriggerRegenerate(previewDoc)}
                >
                  <RotateCcw size={15} />
                  <span>Regenerate</span>
                </button>
                {previewDoc.charges && (previewDoc.docType === 'RECEIPT' || previewDoc.docType === 'INVOICE' || previewDoc.docType === 'BOL') && (
                  <button
                    className="btn-preview-action"
                    onClick={() => handleTogglePaymentStatus(previewDoc)}
                  >
                    <DollarSign size={15} />
                    <span>Mark as {previewDoc.charges.paymentStatus === 'PAID' ? 'Pending' : 'Paid'}</span>
                  </button>
                )}
                <button
                  className="btn-preview-action btn-preview-delete"
                  onClick={() => handleTriggerDelete(previewDoc)}
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
                <button
                  className="btn-preview-close"
                  onClick={() => setPreviewDoc(null)}
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Version History Subdeck (if updated) */}
            {previewDoc.versionHistory && previewDoc.versionHistory.length > 1 && (
              <div className="preview-version-history-bar">
                <div className="version-bar-title">
                  <Clock size={13} className="text-blue" />
                  <span>Audit Trail Version History:</span>
                </div>
                <div className="version-chips-list">
                  {previewDoc.versionHistory.map((vh, i) => (
                    <span key={i} className={`v-chip font-mono ${i === 0 ? 'current' : 'previous'}`}>
                      v{vh.version} ({vh.createdDate}) · {vh.notes || 'Document modified'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Document Body (The Paper Sheet) */}
            <div className="preview-sheet-scroll-container">
              {/* =================================================================
                  DOCUMENT TYPE 1: SHIPPING LABEL (4x6 Real Courier Layout)
                  ================================================================= */}
              {previewDoc.docType === 'SHIPPING_LABEL' && (
                <div className="shipping-label-paper" ref={paperRef}>
                  {/* Label Top Bar */}
                  <div className="lbl-top-row">
                    <DocumentHeaderBrand className="lbl-brand-block" />
                    <div className="lbl-service-stamp font-mono">
                      <span>{previewTitle}</span>
                      <strong>{previewDoc.service || '—'}</strong>
                    </div>
                  </div>

                  {/* Shipment Tracking Box */}
                  <div className="lbl-tracking-masthead">
                    <div className="lbl-tracking-label">Tracking ID / Waybill No.</div>
                    <div className="lbl-tracking-code font-mono">{previewDoc.shipmentTracking}</div>
                  </div>

                  {/* Sender & Recipient Section */}
                  <div className="lbl-parties-grid">
                    {/* FROM */}
                    <div className="lbl-from-box">
                      <span className="lbl-role-tag font-mono">FROM / SHIPPER</span>
                      <strong className="lbl-party-name">{previewDoc.senderName}</strong>
                      {previewDoc.senderCompany && <div className="lbl-company">{previewDoc.senderCompany}</div>}
                      <div className="lbl-address">{previewDoc.senderAddress}</div>
                      <div className="lbl-city-state font-bold">{senderPlace(previewDoc)}</div>
                      <div className="lbl-phone font-mono">{previewDoc.senderPhone}</div>
                      {previewDoc.senderEmail && <div className="lbl-email font-mono">{previewDoc.senderEmail}</div>}
                    </div>

                    {/* TO */}
                    <div className="lbl-to-box">
                      <div className="lbl-to-head">
                        <span className="lbl-role-tag font-mono">SHIP TO / CONSIGNEE</span>
                      </div>
                      <strong className="lbl-to-name">{previewDoc.recipientName}</strong>
                      {previewDoc.recipientCompany && <div className="lbl-to-company">{previewDoc.recipientCompany}</div>}
                      <div className="lbl-to-address">{previewDoc.recipientAddress}</div>
                      <div className="lbl-to-city-state">{recipientPlace(previewDoc)}</div>
                      <div className="lbl-to-phone font-mono">{previewDoc.recipientPhone}</div>
                      {previewDoc.recipientEmail && <div className="lbl-to-email font-mono">{previewDoc.recipientEmail}</div>}
                    </div>
                  </div>

                  {/* Cargo Specifications Strip */}
                  <div className="lbl-specs-strip">
                    <div className="lbl-spec-col">
                      <span className="s-lbl">SHIPMENT TYPE</span>
                      <strong className="s-val">{previewDoc.shipmentType}</strong>
                    </div>
                    <div className="lbl-spec-col">
                      <span className="s-lbl">WEIGHT</span>
                      <strong className="s-val font-mono">{formatWeightBoth(previewDoc.weightLbs) || '—'}</strong>
                    </div>
                    <div className="lbl-spec-col">
                      <span className="s-lbl">PIECES</span>
                      <strong className="s-val font-mono">{previewDoc.pieces}</strong>
                    </div>
                    <div className="lbl-spec-col">
                      <span className="s-lbl">DIMENSIONS</span>
                      <strong className="s-val font-mono">{dims(previewDoc)}</strong>
                    </div>
                  </div>

                  {/* Contents Description */}
                  <div className="lbl-contents-bar font-mono">
                    <span>CARGO: <strong>{previewDoc.cargoDescription}</strong></span>
                  </div>

                  {/* BARCODE SECTION (Code 128 ONLY - NO QR CODES) */}
                  <div className="lbl-barcode-area">
                    <div className="barcode-render-box">
                      <Barcode
                        value={previewDoc.shipmentTracking}
                        width={2.4}
                        height={75}
                        fontSize={14}
                      />
                    </div>
                    <DocumentIdLine trackingId={previewDoc.shipmentTracking} />
                  </div>

                  {realSeal(previewDoc) && <DocumentPouchLine sealNumber={realSeal(previewDoc)} />}

                  {/* Label Footer */}
                  <div className="lbl-footer-row font-mono">
                    <span>DOC ID: <strong className="lbl-footer-id">{previewDoc.id}</strong></span>
                    <span>ISSUED: {previewDoc.createdDate}</span>
                  </div>
                  <DocumentLegalFooter />
                </div>
              )}

              {/* =================================================================
                  DOCUMENT TYPE 2: SHIPMENT RECEIPT
                  ================================================================= */}
              {previewDoc.docType === 'RECEIPT' && (
                <div className="receipt-paper" ref={paperRef}>
                  {/* Receipt Header */}
                  <div className="rec-header">
                    <div className="rec-brand">
                      <DocumentHeaderBrand />
                      <p>{previewTitle}</p>
                    </div>
                    <div className="rec-meta font-mono">
                      <div className="m-row"><span>Receipt No:</span> <strong className="rec-meta-id">{previewDoc.id}</strong></div>
                      <div className="m-row"><span>Date:</span> <strong>{previewDoc.createdDate}</strong></div>
                      <div className="m-row">
                        <span>Status:</span>
                        <strong className={`rec-status-pill ${previewDoc.charges?.paymentStatus === 'PENDING' ? 'pending' : 'paid'}`}>
                          {previewDoc.charges?.paymentStatus === 'PENDING' ? 'PENDING' : 'PAID'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="rec-divider" />
                  <DocumentIdLine trackingId={previewDoc.shipmentTracking} />

                  {/* Shipment Information Card */}
                  <div className="rec-section-title">CONSIGNMENT & ROUTE SUMMARY</div>
                  <div className="rec-summary-grid">
                    <div className="rec-card">
                      <span className="rec-card-lbl">SENDER / SHIPPER</span>
                      <strong>{previewDoc.senderName}</strong>
                      {previewDoc.senderCompany && <div className="rec-card-company">{previewDoc.senderCompany}</div>}
                      <div>{previewDoc.senderAddress}</div>
                      <div>{senderPlace(previewDoc)}</div>
                      {previewDoc.senderPhone && <div className="rec-card-contact font-mono">{previewDoc.senderPhone}</div>}
                      {previewDoc.senderEmail && <div className="rec-card-contact font-mono">{previewDoc.senderEmail}</div>}
                    </div>
                    <div className="rec-card">
                      <span className="rec-card-lbl">DESTINATION RECIPIENT</span>
                      <strong>{previewDoc.recipientName}</strong>
                      {previewDoc.recipientCompany && <div className="rec-card-company">{previewDoc.recipientCompany}</div>}
                      <div>{previewDoc.recipientAddress}</div>
                      <div>{recipientPlace(previewDoc)}</div>
                      {previewDoc.recipientPhone && <div className="rec-card-contact font-mono">{previewDoc.recipientPhone}</div>}
                      {previewDoc.recipientEmail && <div className="rec-card-contact font-mono">{previewDoc.recipientEmail}</div>}
                    </div>
                  </div>

                  {/* Cargo Specifications */}
                  <div className="rec-section-title">CARGO SPECIFICATIONS</div>
                  <div className="table-responsive-wrapper">
                    <table className="rec-items-table">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th>Type</th>
                          <th>Service</th>
                          <th>Weight</th>
                          <th>Pieces</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>{previewDoc.cargoDescription}</strong></td>
                          <td>{previewDoc.shipmentType}</td>
                          <td>{previewDoc.service}</td>
                          <td className="font-mono">{formatWeightBoth(previewDoc.weightLbs)}</td>
                          <td className="font-mono">{previewDoc.pieces}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Charges */}
                  <div className="rec-section-title">TARIFF & CHARGES BREAKDOWN</div>
                  <div className="rec-charges-container">
                    <div className="charge-row">
                      <span>Transport ({previewDoc.senderCity} → {previewDoc.recipientCity})</span>
                      <strong className="font-mono">{previewDoc.charges?.baseAmount ? money.format(previewDoc.charges.baseAmount) : '—'}</strong>
                    </div>
                    {previewDoc.charges?.oversizeFee ? (
                      <div className="charge-row">
                        <span>Oversize handling</span>
                        <strong className="font-mono">{money.format(previewDoc.charges.oversizeFee)}</strong>
                      </div>
                    ) : null}
                    {previewDoc.charges?.specialHandlingFee ? (
                      <div className="charge-row">
                        <span>Special handling</span>
                        <strong className="font-mono">{money.format(previewDoc.charges.specialHandlingFee)}</strong>
                      </div>
                    ) : null}
                    <div className={`charge-row total-row ${previewDoc.charges?.paymentStatus === 'PENDING' ? 'pending' : ''}`}>
                      <span>TOTAL {previewDoc.charges?.paymentStatus === 'PENDING' ? 'DUE' : 'PAID'} ({money.currency})</span>
                      <strong className={`font-mono ${previewDoc.charges?.paymentStatus === 'PENDING' ? 'text-amber-strong' : 'text-emerald'}`}>{previewDoc.charges?.totalAmount ? money.format(previewDoc.charges.totalAmount) : '—'}</strong>
                    </div>
                  </div>

                  {/* Barcode & Signature Footprint */}
                  <div className="rec-footer-barcode-box">
                    <Barcode
                      value={previewDoc.shipmentTracking}
                      width={2.0}
                      height={50}
                      fontSize={12}
                    />
                  </div>
                  <DocumentLegalFooter />
                </div>
              )}

              {/* =================================================================
                  DOCUMENT TYPE 3: INVOICE
                  ================================================================= */}
              {previewDoc.docType === 'INVOICE' && (
                <div className="invoice-paper" ref={paperRef}>
                  {/* Invoice Header */}
                  <div className="inv-top-bar">
                    <DocumentHeaderBrand className="inv-brand" />
                    <div className="inv-masthead-title">
                      <h1>{previewTitle}</h1>
                      <div className="inv-id-badge font-mono">{previewDoc.id}</div>
                    </div>
                  </div>

                  <div className="inv-divider" />
                  <DocumentIdLine trackingId={previewDoc.shipmentTracking} />

                  {/* Parties Info Grid */}
                  <div className="inv-parties-grid">
                    <div className="inv-parties-left">
                      <div className="inv-billed-to">
                        <span className="inv-section-tag">BILLED TO (CUSTOMER)</span>
                        <strong className="inv-party-name">{previewDoc.senderName}</strong>
                        {previewDoc.senderCompany && <div className="inv-company">{previewDoc.senderCompany}</div>}
                        <div>{previewDoc.senderAddress}</div>
                        <div>{senderPlace(previewDoc)}</div>
                        <div className="font-mono">{previewDoc.senderPhone}</div>
                        {previewDoc.senderEmail && <div className="font-mono">{previewDoc.senderEmail}</div>}
                      </div>

                      <div className="inv-ship-to">
                        <span className="inv-section-tag">SHIP TO (CONSIGNEE)</span>
                        <strong className="inv-party-name">{previewDoc.recipientName}</strong>
                        {previewDoc.recipientCompany && <div className="inv-company">{previewDoc.recipientCompany}</div>}
                        <div>{previewDoc.recipientAddress}</div>
                        <div>{recipientPlace(previewDoc)}</div>
                        <div className="font-mono">{previewDoc.recipientPhone}</div>
                        {previewDoc.recipientEmail && <div className="font-mono">{previewDoc.recipientEmail}</div>}
                      </div>
                    </div>

                    <div className="inv-meta-card font-mono">
                      <div className="inv-m-row">
                        <span>Invoice Date:</span>
                        <strong>{previewDoc.createdDate}</strong>
                      </div>
                      <div className="inv-m-row">
                        <span>Shipment Waybill:</span>
                        <strong>{previewDoc.shipmentTracking}</strong>
                      </div>
                      <div className="inv-m-row">
                        <span>Service:</span>
                        <strong>{previewDoc.service}</strong>
                      </div>
                      <div className="inv-m-row">
                        <span>Payment Status:</span>
                        <strong className={previewDoc.charges?.paymentStatus === 'PENDING' ? 'text-amber-strong' : 'text-emerald'}>
                          {previewDoc.charges?.paymentStatus === 'PENDING' ? 'PAYMENT DUE' : 'PAID IN FULL'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Consignment Details Table */}
                  <div className="inv-items-section">
                    <table className="inv-items-table">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th>Route Corridor</th>
                          <th>Weight</th>
                          <th>Pieces</th>
                          <th style={{ textAlign: 'right' }}>Amount ({money.currency})</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>{previewDoc.cargoDescription}</strong>
                            <div className="text-xs text-slate">{dims(previewDoc)}</div>
                          </td>
                          <td>{previewDoc.senderCity} → {previewDoc.recipientCity}</td>
                          <td className="font-mono">{formatWeightBoth(previewDoc.weightLbs)}</td>
                          <td className="font-mono">{previewDoc.pieces}</td>
                          <td className="font-mono" style={{ textAlign: 'right' }}>
                            {previewDoc.charges?.baseAmount ? money.format(previewDoc.charges.baseAmount) : '—'}
                          </td>
                        </tr>
                        {previewDoc.charges?.oversizeFee ? (
                          <tr>
                            <td>Oversize handling</td>
                            <td />
                            <td className="font-mono">-</td>
                            <td className="font-mono">-</td>
                            <td className="font-mono" style={{ textAlign: 'right' }}>
                              {money.format(previewDoc.charges.oversizeFee)}
                            </td>
                          </tr>
                        ) : null}
                        {previewDoc.charges?.specialHandlingFee ? (
                          <tr>
                            <td>Special handling</td>
                            <td />
                            <td className="font-mono">-</td>
                            <td className="font-mono">-</td>
                            <td className="font-mono" style={{ textAlign: 'right' }}>
                              {money.format(previewDoc.charges.specialHandlingFee)}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary (taxes are not calculated here, so no tax line is printed) */}
                  <div className="inv-totals-wrap">
                    <div className="inv-totals-box">
                      <div className="t-row grand-total">
                        <span>{previewDoc.charges?.paymentStatus === 'PENDING' ? 'TOTAL DUE:' : 'TOTAL PAID:'}</span>
                        <strong className={`font-mono ${previewDoc.charges?.paymentStatus === 'PENDING' ? 'text-amber-strong' : 'text-emerald'}`}>{previewDoc.charges?.totalAmount ? `${money.format(previewDoc.charges.totalAmount)} ${money.currency}` : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Footer Barcode */}
                  <div className="inv-footer-barcode">
                    <Barcode
                      value={previewDoc.shipmentTracking}
                      width={1.8}
                      height={45}
                      fontSize={11}
                    />
                    <div className="font-mono text-xs text-slate mt-1">
                      INVOICE REF: {previewDoc.id} · {referenceFor('invoice', previewDoc.id)}
                    </div>
                  </div>
                  <DocumentLegalFooter />
                </div>
              )}

              {/* =================================================================
                  DOCUMENT TYPE 4: BILL OF LADING (BOL)
                  ================================================================= */}
              {previewDoc.docType === 'BOL' && (
                <div className="bol-paper" ref={paperRef}>
                  {/* BOL Header Grid */}
                  <div className="bol-top-header">
                    <div className="bol-carrier-brand">
                      <DocumentHeaderBrand />
                      <span className="font-mono font-bold text-xs">{previewTitle.toUpperCase()}</span>
                    </div>
                    <div className="bol-id-box font-mono">
                      <div className="b-row"><span>DOCUMENT NO:</span> <strong className="bol-id-value">{previewDoc.id}</strong></div>
                      <div className="b-row"><span>DATE:</span> <strong>{previewDoc.createdDate}</strong></div>
                    </div>
                  </div>
                  <DocumentIdLine trackingId={previewDoc.shipmentTracking} />

                  {/* BOL Parties Section */}
                  <div className="bol-parties-container">
                    <div className="bol-party-cell">
                      <span className="bol-cell-label">SHIPPER / CONSIGNOR</span>
                      <strong className="bol-name">{previewDoc.senderName}</strong>
                      {previewDoc.senderCompany && <div>{previewDoc.senderCompany}</div>}
                      <div>{previewDoc.senderAddress}</div>
                      <div>{senderPlace(previewDoc)}</div>
                      <div className="font-mono text-xs">{previewDoc.senderPhone}</div>
                      {previewDoc.senderEmail && <div className="font-mono text-xs">{previewDoc.senderEmail}</div>}
                    </div>

                    <div className="bol-party-cell">
                      <span className="bol-cell-label">CONSIGNEE / SHIP TO</span>
                      <strong className="bol-name">{previewDoc.recipientName}</strong>
                      {previewDoc.recipientCompany && <div>{previewDoc.recipientCompany}</div>}
                      <div>{previewDoc.recipientAddress}</div>
                      <div>{recipientPlace(previewDoc)}</div>
                      <div className="font-mono text-xs">{previewDoc.recipientPhone}</div>
                      {previewDoc.recipientEmail && <div className="font-mono text-xs">{previewDoc.recipientEmail}</div>}
                    </div>
                  </div>

                  {/* Carrier & Equipment Details */}
                  <div className="bol-carrier-strip font-mono">
                    <div className="c-field"><span>CARRIER:</span> <strong>{LEGAL_NAME}</strong></div>
                    <div className="c-field"><span>SERVICE:</span> <strong>{previewDoc.service || '—'}</strong></div>
                  </div>
                  {realSeal(previewDoc) && <DocumentPouchLine sealNumber={realSeal(previewDoc)} />}

                  {/* Freight Commodity Grid */}
                  <div className="table-responsive-wrapper">
                    <table className="bol-freight-table">
                      <thead>
                        <tr>
                          <th>HANDLING UNITS</th>
                          <th>PACKAGE TYPE</th>
                          <th>DESCRIPTION OF ARTICLES & SPECIAL MARKS</th>
                          <th>WEIGHT</th>
                          <th>DIMENSIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-mono font-bold text-center">{previewDoc.pieces}</td>
                          <td>{previewDoc.shipmentType}</td>
                          <td>
                            <strong>{previewDoc.cargoDescription}</strong>
                          </td>
                          <td className="font-mono font-bold text-center">{formatWeightBoth(previewDoc.weightLbs)}</td>
                          <td className="font-mono text-center">{dims(previewDoc)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Special handling instructions: only what was recorded for the shipment */}
                  {previewDoc.bolSpecialInstructions && (
                    <div className="bol-instructions-box">
                      <span className="font-mono font-bold text-xs text-slate">SPECIAL HANDLING INSTRUCTIONS:</span>
                      <p className="bol-instruct-text">{previewDoc.bolSpecialInstructions}</p>
                    </div>
                  )}

                  {/* Freight Charges — a standard BOL field (Prepaid/Collect terms). Every
                      BOL already carries real charges data computed at generation time; this
                      was previously never shown anywhere, so there was no way to see or mark
                      it paid short of opening the Receipt/Invoice for the same shipment. */}
                  {previewDoc.charges && (
                    <div className="rec-charges-container">
                      <div className="charge-row">
                        <span>FREIGHT CHARGES</span>
                        <strong className="font-mono">{previewDoc.charges.baseAmount ? money.format(previewDoc.charges.baseAmount) : '—'}</strong>
                      </div>
                      {previewDoc.charges.oversizeFee ? (
                        <div className="charge-row">
                          <span>Oversize handling</span>
                          <strong className="font-mono">{money.format(previewDoc.charges.oversizeFee)}</strong>
                        </div>
                      ) : null}
                      {previewDoc.charges.specialHandlingFee ? (
                        <div className="charge-row">
                          <span>Special handling</span>
                          <strong className="font-mono">{money.format(previewDoc.charges.specialHandlingFee)}</strong>
                        </div>
                      ) : null}
                      <div className={`charge-row total-row ${previewDoc.charges.paymentStatus === 'PENDING' ? 'pending' : ''}`}>
                        <span>FREIGHT TERMS: {previewDoc.charges.paymentStatus === 'PENDING' ? 'COLLECT' : 'PREPAID'}</span>
                        <strong className={`font-mono ${previewDoc.charges.paymentStatus === 'PENDING' ? 'text-amber-strong' : 'text-emerald'}`}>{previewDoc.charges.totalAmount ? money.format(previewDoc.charges.totalAmount) : '—'}</strong>
                      </div>
                    </div>
                  )}

                  {/* Signature Certification Boxes */}
                  <div className="bol-signatures-row">
                    <div className="sig-box">
                      <span className="sig-label font-mono">SHIPPER CERTIFICATION & SIGNATURE</span>
                      <div className="sig-line">
                        <span className="signed-name font-mono">{previewDoc.senderName}</span>
                      </div>
                      <div className="sig-date font-mono">DATE: {previewDoc.createdDate}</div>
                    </div>

                    <div className="sig-box">
                      <span className="sig-label font-mono">CARRIER ACKNOWLEDGEMENT & RECEIPT</span>
                      <div className="sig-line">
                        <span className="signed-name font-mono">{settings.signatoryName || `${COMPANY_SHORT} Dispatch Officer`}</span>
                      </div>
                      {settings.signatoryTitle && <div className="ins-signatory-title font-mono">{settings.signatoryTitle}</div>}
                      <div className="sig-date font-mono">DATE: {previewDoc.createdDate}</div>
                    </div>

                    {settings.signatureStampUrl && (
                      <div className="ins-seal">
                        <img src={settings.signatureStampUrl} alt="Company stamp" className="ins-stamp-img" />
                      </div>
                    )}
                  </div>

                  {/* BOL Barcode */}
                  <div className="bol-barcode-center">
                    <Barcode
                      value={previewDoc.shipmentTracking}
                      width={2.2}
                      height={55}
                      fontSize={12}
                    />
                  </div>
                  <DocumentLegalFooter />
                </div>
              )}

              {/* =================================================================
                  DOCUMENT TYPE 5: CERTIFICATE OF CARGO INSURANCE
                  ================================================================= */}
              {previewDoc.docType === 'INSURANCE' && (
                <div className="ins-paper" ref={paperRef}>
                  {/* Certificate Header */}
                  <div className="ins-top-header">
                    <DocumentHeaderBrand className="ins-brand" />
                    <div className="ins-id-box font-mono">
                      <div className="b-row"><span>CERTIFICATE NO:</span> <strong className="ins-id-value">{previewDoc.id}</strong></div>
                      <div className="b-row"><span>POLICY NO:</span> <strong>{real(previewDoc.policyNumber) || '—'}</strong></div>
                      <div className="b-row"><span>DATE ISSUED:</span> <strong>{previewDoc.createdDate}</strong></div>
                    </div>
                  </div>

                  <div className="ins-title-band">
                    <ShieldCheck size={18} className="text-purple" />
                    <span>{previewTitle.toUpperCase()}</span>
                  </div>
                  <DocumentIdLine trackingId={previewDoc.shipmentTracking} />

                  {/* Only the insurer and policy the admin entered are named; nothing is shown in their place. */}
                  <p className="ins-certify-text">
                    The cargo described below is insured{real(previewDoc.insurerName) ? <> by <strong>{real(previewDoc.insurerName)}</strong></> : null}{real(previewDoc.policyNumber) ? <> under policy <strong>{real(previewDoc.policyNumber)}</strong></> : null}, subject to that policy's terms, conditions and exclusions.
                  </p>

                  {/* Parties Section */}
                  <div className="ins-parties-container">
                    <div className="ins-party-cell">
                      <span className="ins-cell-label">ASSURED / SHIPPER</span>
                      <strong className="ins-name">{previewDoc.senderName}</strong>
                      {previewDoc.senderCompany && <div>{previewDoc.senderCompany}</div>}
                      <div>{previewDoc.senderAddress}</div>
                      <div>{senderPlace(previewDoc)}</div>
                    </div>
                    <div className="ins-party-cell">
                      <span className="ins-cell-label">CONSIGNEE</span>
                      <strong className="ins-name">{previewDoc.recipientName}</strong>
                      {previewDoc.recipientCompany && <div>{previewDoc.recipientCompany}</div>}
                      <div>{previewDoc.recipientAddress}</div>
                      <div>{recipientPlace(previewDoc)}</div>
                    </div>
                  </div>

                  {/* Conveyance & Transit Details */}
                  <div className="ins-transit-strip font-mono">
                    <div className="c-field"><span>CARRIER:</span> <strong>{LEGAL_NAME}</strong></div>
                    <div className="c-field"><span>ROUTE:</span> <strong>{previewDoc.senderCity} → {previewDoc.recipientCity}</strong></div>
                  </div>

                  {/* Cargo Description Table */}
                  <div className="table-responsive-wrapper">
                    <table className="ins-cargo-table">
                      <thead>
                        <tr>
                          <th>DESCRIPTION OF INSURED CARGO</th>
                          <th>PACKAGE TYPE</th>
                          <th>WEIGHT</th>
                          <th>PIECES</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>{previewDoc.cargoDescription}</strong></td>
                          <td>{previewDoc.shipmentType}</td>
                          <td className="font-mono">{formatWeightBoth(previewDoc.weightLbs)}</td>
                          <td className="font-mono">{previewDoc.pieces}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Coverage & Sum Insured Panel */}
                  <div className="ins-coverage-panel">
                    <div className="ins-sum-insured-block">
                      <span className="ins-sum-label">TOTAL SUM INSURED</span>
                      <strong className="ins-sum-value font-mono">{money.format(previewDoc.declaredValue || 0)}</strong>
                      <span className="ins-sum-sub">{money.currency}</span>
                    </div>
                    <div className="ins-coverage-details">
                      <div className="ins-cov-row">
                        <span>Coverage type:</span>
                        <strong>{real(previewDoc.coverageType) || '—'}</strong>
                      </div>
                      <div className="ins-cov-row">
                        <span>Deductible (excess):</span>
                        <strong className="font-mono">{previewDoc.deductible !== undefined ? money.format(previewDoc.deductible) : '—'}</strong>
                      </div>
                      <div className="ins-cov-row">
                        <span>Premium:</span>
                        <strong className="font-mono">{previewDoc.premiumAmount !== undefined ? money.format(previewDoc.premiumAmount) : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Claims Notice (same window as Shipping Terms 9) */}
                  <div className="ins-claims-box">
                    <span className="font-mono font-bold text-xs text-slate">CLAIMS:</span>
                    <p className="ins-claims-text">
                      Tell {COMPANY_SHORT} about any loss or damage within 7 days of delivery, quoting the tracking ID above, with photos and proof of value.
                    </p>
                  </div>

                  {/* Signature (and the company stamp only when one is uploaded in Settings) */}
                  <div className="ins-signature-row">
                    <div className="ins-sig-block">
                      <span className="sig-label font-mono">AUTHORISED REPRESENTATIVE</span>
                      <div className="sig-line">
                        <span className="signed-name font-mono">{settings.signatoryName || ''}</span>
                      </div>
                      {settings.signatoryTitle && <div className="ins-signatory-title font-mono">{settings.signatoryTitle}</div>}
                      <div className="ins-signatory-onbehalf font-mono">for {LEGAL_NAME}</div>
                      <div className="sig-date font-mono">DATE: {previewDoc.createdDate}</div>
                    </div>
                    {settings.signatureStampUrl && (
                      <div className="ins-seal">
                        <img src={settings.signatureStampUrl} alt="Company stamp" className="ins-stamp-img" />
                      </div>
                    )}
                  </div>

                  {/* Barcode Footer */}
                  <div className="ins-barcode-center">
                    <Barcode
                      value={previewDoc.shipmentTracking}
                      width={2.0}
                      height={50}
                      fontSize={12}
                    />
                  </div>
                  <DocumentLegalFooter />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. GENERATE DOCUMENT MODAL
          ========================================================================= */}
      {showGenerateModal && (
        <div className="doc-generate-modal-backdrop" onClick={() => setShowGenerateModal(false)}>
          <div className="doc-generate-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div>
                <h3>Generate New Shipment Document</h3>
                <p>Create a document from a shipment's saved details.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowGenerateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="generate-form-body">
              {/* Step 1: Select Document Type */}
              <div className="form-field-unit">
                <label className="form-field-label">1. Select Document Type</label>
                <div className="doc-type-radio-grid">
                  <label className={`doc-type-radio-card ${genDocType === 'SHIPPING_LABEL' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="docType"
                      value="SHIPPING_LABEL"
                      checked={genDocType === 'SHIPPING_LABEL'}
                      onChange={() => setGenDocType('SHIPPING_LABEL')}
                    />
                    <Tag size={18} className="text-blue" />
                    <div>
                      <strong>Shipping Label</strong>
                      <span>Barcode label with the tracking ID</span>
                    </div>
                  </label>

                  <label className={`doc-type-radio-card ${genDocType === 'RECEIPT' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="docType"
                      value="RECEIPT"
                      checked={genDocType === 'RECEIPT'}
                      onChange={() => setGenDocType('RECEIPT')}
                    />
                    <Receipt size={18} className="text-emerald" />
                    <div>
                      <strong>Shipment Receipt</strong>
                      <span>Receipt with charges</span>
                    </div>
                  </label>

                  <label className={`doc-type-radio-card ${genDocType === 'INVOICE' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="docType"
                      value="INVOICE"
                      checked={genDocType === 'INVOICE'}
                      onChange={() => setGenDocType('INVOICE')}
                    />
                    <FileText size={18} className="text-indigo" />
                    <div>
                      <strong>Commercial Invoice</strong>
                      <span>Charges for the shipment</span>
                    </div>
                  </label>

                  <label className={`doc-type-radio-card ${genDocType === 'BOL' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="docType"
                      value="BOL"
                      checked={genDocType === 'BOL'}
                      onChange={() => setGenDocType('BOL')}
                    />
                    <FileSpreadsheet size={18} className="text-amber" />
                    <div>
                      <strong>Bill of Lading</strong>
                      <span>Air waybill for air shipments</span>
                    </div>
                  </label>

                  <label className={`doc-type-radio-card ${genDocType === 'INSURANCE' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="docType"
                      value="INSURANCE"
                      checked={genDocType === 'INSURANCE'}
                      onChange={() => setGenDocType('INSURANCE')}
                    />
                    <ShieldCheck size={18} className="text-purple" />
                    <div>
                      <strong>Insurance Certificate</strong>
                      <span>Insurer and policy you enter</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 2: Select Associated Shipment */}
              <div className="form-field-unit">
                <label className="form-field-label">2. Select Associated Shipment</label>
                <select
                  value={genShipmentTracking}
                  onChange={e => setGenShipmentTracking(e.target.value)}
                  className="modal-shipment-select font-mono"
                  required
                >
                  {shipments.map(s => (
                    <option key={s.trackingNumber} value={s.trackingNumber}>
                      {s.trackingNumber} — {s.sender.name} → {s.recipient.name} ({s.cargoDescription || 'Parcel'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Charges (Receipt, Invoice, Bill of Lading / Air Waybill) */}
              {(genDocType === 'RECEIPT' || genDocType === 'INVOICE' || genDocType === 'BOL') && (
                <div className="form-field-unit">
                  <label className="form-field-label">3. Charges ({money.currency})</label>
                  <div className="gen-fields-grid">
                    <label className="gen-field">
                      <span>Transport</span>
                      <MoneyInput min="0" value={genBaseCharge} onChange={setGenBaseCharge} className="modal-shipment-select font-mono" />
                    </label>
                    <label className="gen-field">
                      <span>Oversize handling</span>
                      <MoneyInput min="0" value={genOversizeFee} onChange={setGenOversizeFee} className="modal-shipment-select font-mono" />
                    </label>
                    <label className="gen-field">
                      <span>Special handling</span>
                      <MoneyInput min="0" value={genSpecialFee} onChange={setGenSpecialFee} className="modal-shipment-select font-mono" />
                    </label>
                    <label className="gen-field">
                      <span>Payment</span>
                      <select value={genPaymentStatus} onChange={e => setGenPaymentStatus(e.target.value as 'PENDING' | 'PAID')} className="modal-shipment-select">
                        <option value="PENDING">Due</option>
                        <option value="PAID">Paid</option>
                      </select>
                    </label>
                  </div>
                  <p className="insured-value-hint">Left empty, a charge is not printed (the total shows "—").</p>
                </div>
              )}

              {/* Step 3: Insurance details (Insurance Certificate only) */}
              {genDocType === 'INSURANCE' && (
                <div className="form-field-unit">
                  <label className="form-field-label">3. Insurance details</label>
                  <div className="gen-fields-grid">
                    <label className="gen-field">
                      <span>Insurer *</span>
                      <input type="text" required value={genInsurerName} onChange={e => setGenInsurerName(e.target.value)} className="modal-shipment-select" />
                    </label>
                    <label className="gen-field">
                      <span>Policy number *</span>
                      <input type="text" required value={genPolicyNumber} onChange={e => setGenPolicyNumber(e.target.value)} className="modal-shipment-select font-mono" />
                    </label>
                    <label className="gen-field">
                      <span>Sum insured ({money.currency}) *</span>
                      <MoneyInput
                        min="0"
                        required
                        value={genInsuredValue}
                        onChange={(v) => {
                          setGenInsuredValue(v);
                          setGenInsuredValueTouched(true);
                        }}
                        className="modal-shipment-select font-mono"
                      />
                    </label>
                    <label className="gen-field">
                      <span>Coverage type</span>
                      <input type="text" value={genCoverageType} onChange={e => setGenCoverageType(e.target.value)} className="modal-shipment-select" />
                    </label>
                    <label className="gen-field">
                      <span>Premium ({money.currency})</span>
                      <MoneyInput min="0" value={genPremium} onChange={setGenPremium} className="modal-shipment-select font-mono" />
                    </label>
                    <label className="gen-field">
                      <span>Deductible ({money.currency})</span>
                      <MoneyInput min="0" value={genDeductible} onChange={setGenDeductible} className="modal-shipment-select font-mono" />
                    </label>
                  </div>
                  <p className="insured-value-hint">
                    The sum insured starts from the shipment's declared value. Enter the insurer and policy exactly as issued: nothing is filled in for you.
                  </p>
                </div>
              )}

              {/* Auto-populated Preview Summary */}
              {(() => {
                const targetShipment = shipments.find(s => s.trackingNumber === genShipmentTracking) || shipments[0];
                return targetShipment ? (
                  <div className="auto-populated-preview-card">
                    <div className="preview-card-header">
                      <Sparkles size={14} className="text-blue" />
                      <span>Filled in from the shipment</span>
                    </div>
                    <div className="preview-data-grid font-mono">
                      <div><span>Shipper:</span> <strong>{targetShipment.sender.name} ({targetShipment.origin.city}, {targetShipment.origin.state})</strong></div>
                      <div><span>Consignee:</span> <strong>{targetShipment.recipient.name} ({targetShipment.destination.city}, {targetShipment.destination.state})</strong></div>
                      <div><span>Cargo:</span> <strong>{targetShipment.cargoDescription}</strong></div>
                      <div><span>Weight / Pieces:</span> <strong>{formatWeightBoth(targetShipment.totalWeightLbs)} · {targetShipment.totalPieces} pcs</strong></div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit-generate"
                >
                  <Plus size={16} />
                  <span>Generate Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. REGENERATE DOCUMENT MODAL
          ========================================================================= */}
      {regenerateDocTarget && (
        <div className="doc-generate-modal-backdrop" onClick={() => setRegenerateDocTarget(null)}>
          <div className="doc-generate-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div>
                <h3>Regenerate Document</h3>
                <p>Create Version {regenerateDocTarget.version + 1} for {regenerateDocTarget.id}.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setRegenerateDocTarget(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="generate-form-body">
              <div className="auto-populated-preview-card">
                <div className="preview-card-header">
                  <Clock size={14} className="text-blue" />
                  <span>Version Preservation</span>
                </div>
                <p className="text-xs text-slate m-0">
                  Version {regenerateDocTarget.version} will be preserved in the document history. Version {regenerateDocTarget.version + 1} will become the new current version.
                </p>
              </div>

              <div className="form-field-unit">
                <label className="form-field-label">Reason / Revision Notes</label>
                <input
                  type="text"
                  value={regenNotes}
                  onChange={e => setRegenNotes(e.target.value)}
                  placeholder="e.g. Updated cargo description and routing corridor"
                  className="modal-shipment-select"
                  required
                />
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setRegenerateDocTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-submit-generate"
                  onClick={handleConfirmRegenerate}
                >
                  <RotateCcw size={16} />
                  <span>Regenerate Version {regenerateDocTarget.version + 1}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. DELETE DOCUMENT CONFIRMATION MODAL
          ========================================================================= */}
      {deleteDocTarget && (
        <div className="doc-delete-modal-backdrop" onClick={() => setDeleteDocTarget(null)}>
          <div className="doc-delete-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="doc-delete-modal-top">
              <div className="doc-delete-warning-halo">
                <AlertTriangle size={24} className="text-danger" />
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteDocTarget(null)} title="Cancel">
                <X size={18} />
              </button>
            </div>

            <div className="doc-delete-modal-content">
              <h3 className="doc-delete-modal-title">Delete Document?</h3>
              <p className="doc-delete-modal-desc">
                Are you sure you want to permanently delete <strong className="font-mono">{deleteDocTarget.id}</strong>? This action cannot be undone{deleteDocTarget.version > 1 ? ', and all prior versions in its history will be removed as well.' : '.'}
              </p>

              <div className="doc-delete-preview-card">
                <div className="doc-delete-preview-row">
                  <span className="doc-delete-preview-label">DOCUMENT</span>
                  <strong className="doc-delete-preview-val">{deleteDocTarget.title}</strong>
                </div>
                <div className="doc-delete-preview-row">
                  <span className="doc-delete-preview-label">SHIPMENT</span>
                  <span className="doc-delete-preview-val font-mono">{deleteDocTarget.shipmentTracking}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button type="button" className="btn-cancel-modal" onClick={() => setDeleteDocTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn-confirm-delete-doc" onClick={handleConfirmDelete}>
                <Trash2 size={15} />
                <span>Delete Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
