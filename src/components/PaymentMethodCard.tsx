import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, Info, QrCode } from 'lucide-react';
import type { CustomerMethodView } from '../shared/paymentMethods';
import { PaymentIcon } from './PaymentIcon';
import { PaymentQr } from './PaymentQr';
import './PaymentMethodCard.css';

interface PaymentMethodCardProps {
  view: CustomerMethodView;
  instructions?: string | null;
  /** Accordion mode (track page on mobile): the name becomes a button that shows or hides the details. */
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** When set, copy results go here (the track page's toast) instead of the card's own announcement. */
  onCopyMessage?: (message: string) => void;
}

/**
 * What the customer sees for one payment account (CONTENT.md §6.7): icon and name, each detail
 * with a Copy button, the method's link button, network warning and note, and the admin's
 * instructions, and a QR code on request. Used by the admin live previews and the track page payment section.
 */
export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  view, instructions, collapsible = false, expanded = true, onToggle, onCopyMessage,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [showQr, setShowQr] = useState(false);
  const timer = useRef<number>();
  const bodyId = useId();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const announce = (message: string) => (onCopyMessage ? onCopyMessage(message) : setAnnouncement(message));

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      announce(`${label} copied`);
    } catch {
      announce(`Could not copy. Select the ${label} and copy it manually.`);
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  };

  const headContent = (
    <>
      <span className="ngf-pm-card-icon"><PaymentIcon type={view.type} size={22} /></span>
      <strong className="ngf-pm-card-name">{view.label}</strong>
    </>
  );
  const open = !collapsible || expanded;

  return (
    <div className={`ngf-pm-card${collapsible ? ' is-collapsible' : ''}${open ? ' is-open' : ''}`}>
      {collapsible ? (
        <h4 className="ngf-pm-card-heading">
          <button
            type="button"
            className="ngf-pm-card-head ngf-pm-card-toggle"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            {headContent}
            <span className="ngf-sr-only">{expanded ? 'Hide details' : 'Show details'}</span>
            <ChevronDown className="ngf-pm-card-chevron" size={18} aria-hidden="true" />
          </button>
        </h4>
      ) : (
        <div className="ngf-pm-card-head">{headContent}</div>
      )}

      <div id={bodyId} className="ngf-pm-card-body" hidden={!open}>
        {view.warning && (
          <p className="ngf-pm-card-warning">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{view.warning}</span>
          </p>
        )}

        {view.fields.length > 0 && (
          <dl className="ngf-pm-card-fields">
            {view.fields.map((field) => (
              <div className="ngf-pm-card-field" key={field.label}>
                <dt>{field.label}</dt>
                <dd>
                  <span className="ngf-pm-card-value">{field.value}</span>
                  {field.copyable && (
                    <button
                      type="button"
                      className={`ngf-pm-copy${copied === field.label ? ' is-copied' : ''}`}
                      onClick={() => copy(field.label, field.value)}
                      aria-label={`Copy ${field.label}`}
                    >
                      {copied === field.label ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span>{copied === field.label ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {view.link && (
          <a className="ngf-pm-card-link" href={view.link.url} target="_blank" rel="noopener noreferrer">
            <span>{view.link.label}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}

        {view.note && (
          <p className="ngf-pm-card-note">
            <Info size={15} aria-hidden="true" />
            <span>{view.note}</span>
          </p>
        )}

        {view.qr && (
          <div className="ngf-pm-card-qr">
            <button
              type="button"
              className="ngf-pm-qr-toggle"
              aria-expanded={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode size={15} aria-hidden="true" />
              <span>{showQr ? 'Hide QR code' : 'Show QR code'}</span>
            </button>
            {showQr && <PaymentQr value={view.qr} methodLabel={view.label} />}
          </div>
        )}

        {instructions && <p className="ngf-pm-card-instructions">{instructions}</p>}
      </div>

      {!onCopyMessage && <span className="ngf-sr-only" role="status" aria-live="polite">{announcement}</span>}
    </div>
  );
};
