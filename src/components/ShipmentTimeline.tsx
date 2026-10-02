import React, { useState } from 'react';
import { Check, Clock, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { TrackingEvent } from '../types/shipment';
import './ShipmentTimeline.css';

interface ShipmentTimelineProps {
  events: TrackingEvent[];
  className?: string;
}

export const ShipmentTimeline: React.FC<ShipmentTimelineProps> = ({
  events,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(true);

  const displayEvents = expanded ? events : events.slice(0, 4);

  return (
    <div className={`sdl-timeline-card ${className}`}>
      <div className="sdl-timeline-header">
        <h3 className="sdl-timeline-title">Shipment Journey</h3>
      </div>

      <div className="sdl-timeline-list">
        {displayEvents.map((evt) => {
          const isCurrent = evt.isCurrent;
          const isCompleted = evt.isCompleted && !isCurrent;
          const isFuture = evt.isFuture;

          return (
            <div
              key={evt.id}
              className={`sdl-timeline-item ${isCurrent ? 'current' : isCompleted ? 'completed' : 'future'}`}
            >
              {/* Timeline Spine & Node Icon */}
              <div className="timeline-node-col">
                <div className={`timeline-node-icon ${isCurrent ? 'current' : isCompleted ? 'completed' : 'future'}`}>
                  {isCurrent ? (
                    <div className="node-pulse-circle" />
                  ) : isCompleted ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <div className="node-future-ring" />
                  )}
                </div>
                <div className="timeline-spine-line" />
              </div>

              {/* Event Content */}
              <div className="timeline-content-col">
                <div className="timeline-event-time">
                  {evt.displayDate} {evt.displayTime && `• ${evt.displayTime}`}
                </div>

                <div className="timeline-event-title-row">
                  <h4 className="timeline-event-title">{evt.title}</h4>
                  {isCurrent && (
                    <span className="sdl-badge-current-loc">
                      CURRENT LOCATION
                    </span>
                  )}
                </div>

                <div className="timeline-event-location">
                  <MapPin size={13} />
                  <span>{evt.city}, {evt.state} {evt.facility && `• ${evt.facility}`}</span>
                </div>

                <p className="timeline-event-desc">{evt.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {events.length > 4 && (
        <div className="sdl-timeline-footer">
          <button
            className="sdl-btn-toggle-history"
            onClick={() => setExpanded(!expanded)}
          >
            <span>{expanded ? 'Collapse history' : 'View full history'}</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      )}
    </div>
  );
};
