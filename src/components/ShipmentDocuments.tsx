import React, { useState } from 'react';
import { FileText, Eye, Lock, X, Printer } from 'lucide-react';
import { ShipmentDocument, Shipment } from '../types/shipment';
import { Barcode } from './Barcode';
import './ShipmentDocuments.css';
import { DocumentHeaderBrand, DocumentIdLine, DocumentLegalFooter } from './DocumentBrand';
import { formatWeightBoth } from '../shared/units';
import { useEscapeKey } from '../utils/useEscapeKey';

interface ShipmentDocumentsProps {
  documents: ShipmentDocument[];
  shipment: Shipment;
  className?: string;
}

export const ShipmentDocuments: React.FC<ShipmentDocumentsProps> = ({
  documents,
  shipment,
  className = '',
}) => {
  const [selectedDoc, setSelectedDoc] = useState<ShipmentDocument | null>(null);
  useEscapeKey(selectedDoc !== null, () => setSelectedDoc(null));

  const handleOpenDoc = (doc: ShipmentDocument) => {
    if (doc.status === 'AVAILABLE') {
      setSelectedDoc(doc);
    }
  };

  return (
    <div className={`ngf-docs-section ${className}`}>
      <div className="ngf-docs-header">
        <h3 className="ngf-docs-title">Shipment Documents</h3>
      </div>

      <div className="ngf-docs-grid">
        {documents.map((doc) => {
          const isAvailable = doc.status === 'AVAILABLE';

          return (
            <div
              key={doc.id}
              className={`ngf-doc-card ${isAvailable ? 'available' : 'restricted'}`}
            >
              <div className="doc-card-top">
                <div className="doc-icon-wrap">
                  <FileText size={20} />
                </div>
                <div className="doc-meta">
                  <h4 className="doc-name">{doc.title}</h4>
                  <div className="doc-status-row">
                    {isAvailable ? (
                      <span className="doc-status-available">Available</span>
                    ) : (
                      <span className="doc-status-restricted">Available after delivery</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="doc-card-bottom">
                {isAvailable ? (
                  <button
                    className="doc-action-btn"
                    onClick={() => handleOpenDoc(doc)}
                  >
                    <Eye size={14} />
                    <span>View / Download</span>
                  </button>
                ) : (
                  <span className="doc-action-locked">
                    <Lock size={13} />
                    <span>View</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Document Preview Modal */}
      {selectedDoc && (
        <div className="ngf-modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div
            className="ngf-modal-paper"
            role="dialog"
            aria-modal="true"
            aria-label={selectedDoc.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ngf-modal-header">
              <div className="modal-title-wrap">
                <FileText size={20} className="text-blue" />
                <h3>{selectedDoc.title}</h3>
                <span className="modal-version-tag">{selectedDoc.version}</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedDoc(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Document Content Simulation */}
            <div className="ngf-modal-body">
              <div className="doc-official-header">
                <DocumentHeaderBrand className="doc-brand" />
                <div className="doc-barcode-box">
                  <Barcode value={shipment.trackingNumber} height={36} width={1.3} fontSize={10} />
                </div>
              </div>

              <DocumentIdLine trackingId={shipment.trackingNumber} />
              <div className="doc-details-table">
                <div className="doc-row">
                  <span className="doc-field">Document:</span>
                  <span className="doc-val">{selectedDoc.title} ({selectedDoc.version})</span>
                </div>
                <div className="doc-row">
                  <span className="doc-field">Issue Date:</span>
                  <span className="doc-val">{selectedDoc.date}</span>
                </div>
                <div className="doc-row">
                  <span className="doc-field">Service:</span>
                  <span className="doc-val">{shipment.service}</span>
                </div>
                <div className="doc-row">
                  <span className="doc-field">Origin:</span>
                  <span className="doc-val">{[shipment.origin.city, shipment.origin.country].filter(Boolean).join(', ')}</span>
                </div>
                <div className="doc-row">
                  <span className="doc-field">Destination:</span>
                  <span className="doc-val">{[shipment.destination.city, shipment.destination.country].filter(Boolean).join(', ')}</span>
                </div>
                <div className="doc-row">
                  <span className="doc-field">Pieces / Weight:</span>
                  <span className="doc-val">{shipment.totalPieces} pcs • {formatWeightBoth(shipment.totalWeightLbs)}</span>
                </div>
              </div>

              <DocumentLegalFooter />
            </div>

            <div className="ngf-modal-footer">
              <button className="ngf-btn-secondary" onClick={() => setSelectedDoc(null)}>
                Close
              </button>
              <button className="ngf-btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
