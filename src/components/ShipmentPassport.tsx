import React from 'react';
import { Package, Truck, MapPin, Navigation, CheckCircle2 } from 'lucide-react';
import { ShipmentPassportStage } from '../types/shipment';
import './ShipmentPassport.css';

interface ShipmentPassportProps {
  stages: ShipmentPassportStage[];
  className?: string;
}

export const ShipmentPassport: React.FC<ShipmentPassportProps> = ({
  stages,
  className = '',
}) => {
  const getIcon = (id: string, status: string) => {
    if (id === 'created') return <Package size={18} />;
    if (id === 'in-transit') return <Truck size={18} />;
    if (id === 'current') return <MapPin size={18} />;
    if (id === 'next') return <Navigation size={18} />;
    if (id === 'delivery') return <CheckCircle2 size={18} />;
    return <Package size={18} />;
  };

  return (
    <div className={`ngf-passport-card ${className}`}>
      <div className="ngf-passport-header">
        <h3 className="ngf-passport-title">Shipment Passport</h3>
        <p className="ngf-passport-sub">A consolidated record of your shipment's journey.</p>
      </div>

      <div className="ngf-passport-stages">
        {stages.map((stage, idx) => {
          const isCompleted = stage.status === 'completed';
          const isCurrent = stage.status === 'current';
          const isUpcoming = stage.status === 'upcoming';

          return (
            <div
              key={stage.id}
              className={`ngf-passport-stage-col ${stage.status}`}
            >
              <div className="stage-icon-wrap">
                <div className={`stage-icon ${stage.status}`}>
                  {getIcon(stage.id, stage.status)}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`stage-connector ${isCompleted ? 'completed' : isCurrent ? 'current' : ''}`} />
                )}
              </div>

              <div className="stage-content">
                <span className="stage-label">{stage.label}</span>
                <span className="stage-sublabel">{stage.sublabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
