import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, ArrowRight } from 'lucide-react';
import { Shipment } from '../../types/shipment';
import './DeleteShipmentModal.css';

interface DeleteShipmentModalProps {
  shipment: Shipment;
  onClose: () => void;
  onConfirmDelete: (trackingNumber: string) => void;
}

export const DeleteShipmentModal: React.FC<DeleteShipmentModalProps> = ({
  shipment,
  onClose,
  onConfirmDelete
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const originCity = typeof shipment.origin === 'object' ? shipment.origin?.city : shipment.origin;
  const originState = typeof shipment.origin === 'object' ? shipment.origin?.state : '';
  const destCity = typeof shipment.destination === 'object' ? shipment.destination?.city : shipment.destination;
  const destState = typeof shipment.destination === 'object' ? shipment.destination?.state : '';
  const senderName = typeof shipment.sender === 'object' ? (shipment.sender?.name || 'Shipper') : String(shipment.sender || 'Shipper');
  const recipientName = typeof shipment.recipient === 'object' ? (shipment.recipient?.name || 'Consignee') : String(shipment.recipient || 'Consignee');

  return (
    <div className="delete-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="delete-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Icon & Close */}
        <div className="delete-modal-top">
          <div className="delete-warning-halo">
            <AlertTriangle size={24} className="text-crimson" />
          </div>
          <button type="button" className="delete-close-btn" onClick={onClose} title="Cancel (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="delete-modal-content">
          <h3 className="delete-modal-title">Delete Consignment?</h3>
          <p className="delete-modal-desc">
            Are you sure you want to permanently delete consignment <strong className="font-mono text-dark">{shipment.trackingNumber}</strong>? This action cannot be undone and will purge all associated milestone logs.
          </p>

          {/* Consignment summary preview */}
          <div className="delete-preview-card">
            <div className="preview-row">
              <span className="preview-label">WAYBILL</span>
              <strong className="preview-val font-mono">{shipment.trackingNumber}</strong>
            </div>
            <div className="preview-row">
              <span className="preview-label">ROUTE</span>
              <span className="preview-val">
                {originCity}, {originState} <ArrowRight size={11} className="inline-arrow" /> {destCity}, {destState}
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-label">PARTIES</span>
              <span className="preview-val truncate">{senderName} → {recipientName}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="delete-modal-footer">
          <button type="button" className="btn-cancel-delete" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-confirm-delete"
            onClick={() => onConfirmDelete(shipment.trackingNumber)}
          >
            <Trash2 size={15} />
            <span>Delete Consignment</span>
          </button>
        </div>
      </div>
    </div>
  );
};
