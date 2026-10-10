import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Info } from 'lucide-react';
import type { CustomerMethodView } from '../shared/paymentMethods';
import { PaymentIcon } from './PaymentIcon';
import './PaymentMethodCard.css';

interface PaymentMethodCardProps {
  view: CustomerMethodView;
  instructions?: string | null;
}

/**
 * What the customer sees for one payment account (CONTENT.md §6.7): icon and name, each detail
 * with a Copy button, the method's link button, network warning and note, and the admin's
 * instructions. Used by the admin live previews and the track page payment section.
 */
export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ view, instructions }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setAnnouncement(`${label} copied`);
    } catch {
      setAnnouncement(`Could not copy. Select the ${label.toLowerCase()} and copy it manually.`);
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="ngf-pm-card">
      <div className="ngf-pm-card-head">
        <span className="ngf-pm-card-icon"><PaymentIcon type={view.type} size={22} /></span>
        <strong className="ngf-pm-card-name">{view.label}</strong>
      </div>

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
                    aria-label={`Copy ${field.label.toLowerCase()}`}
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

      {instructions && <p className="ngf-pm-card-instructions">{instructions}</p>}

      <span className="ngf-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
};
