import React from 'react';
import { PackagePiece } from '../types/shipment';
import { Barcode } from './Barcode';
import './MultiPieceList.css';
import { WeightText } from './forms/UnitControls';
import { formatDimensions } from '../shared/units';
import { useUnitSystem } from '../utils/useUnitSystem';

interface MultiPieceListProps {
  pieces: PackagePiece[];
  /** Status name shown on every piece (pieces travel with their shipment). */
  statusLabel: string;
  /** Where the shipment is now; stored piece locations are only set at booking. */
  locationText?: string;
  className?: string;
}

export const MultiPieceList: React.FC<MultiPieceListProps> = ({
  pieces,
  statusLabel,
  locationText,
  className = '',
}) => {
  const [unitSystem] = useUnitSystem();
  return (
    <div className={`sdl-pieces-card ${className}`}>
      <div className="sdl-pieces-header">
        <h3 className="sdl-pieces-title">Pieces</h3>
        <span className="sdl-pieces-count-badge">{pieces.length}</span>
      </div>

      <div className="sdl-pieces-grid">
        {pieces.map((piece) => (
          <div key={piece.id} className="sdl-piece-item">
            <div className="piece-item-top">
              <div className="piece-meta">
                <span className="piece-label">Piece {String(piece.pieceNumber).padStart(2, '0')}</span>
                <span className="piece-tracking-id">{piece.trackingNumber}</span>
              </div>
              <div className="piece-status-wrap">
                <span className="sdl-badge-in-transit-sm">{statusLabel.toUpperCase()}</span>
                {locationText && <span className="piece-location">{locationText}</span>}
              </div>
            </div>

            {/* Piece Barcode */}
            <div className="piece-barcode-wrap">
              <Barcode
                value={piece.trackingNumber}
                height={38}
                width={1.4}
                fontSize={11}
                displayValue={false}
              />
            </div>

            {/* Piece Specs */}
            <div className="piece-specs">
              <span><WeightText lbs={piece.weightLbs} /></span>
              <span className="spec-dot">•</span>
              <span>{formatDimensions(piece.dimensions, unitSystem)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
