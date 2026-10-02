import React, { useEffect, useState } from 'react';
import { Headphones, X, CheckCircle, Send } from 'lucide-react';
import './SupportModal.css';
import { api } from '../services/api';
import { useEscapeKey } from '../utils/useEscapeKey';

// CONTENT §6.4
export const SUPPORT_ISSUE_TYPES = ['Delay', 'Address change', 'Damage', 'Customs question', 'Other'] as const;
export type SupportIssueType = typeof SUPPORT_ISSUE_TYPES[number];

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrackingNumber?: string;
  defaultIssueType?: SupportIssueType;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  initialTrackingNumber = '',
  defaultIssueType = 'Other',
}) => {
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [issueType, setIssueType] = useState<SupportIssueType>(defaultIssueType);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // The server's ticket reference (NGF-TKT-######) and the values it was opened with.
  const [ticket, setTicket] = useState<{ id: string; trackingNumber: string; email: string } | null>(null);

  // Each opening starts from the shipment it was opened for.
  useEffect(() => {
    if (!isOpen) return;
    setTrackingNumber(initialTrackingNumber);
    setIssueType(defaultIssueType);
    setError('');
    setTicket(null);
  }, [isOpen, initialTrackingNumber, defaultIssueType]);

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const id = trackingNumber.trim().toUpperCase();
    try {
      // Stored in the admin Messages inbox, like the Contact form.
      const saved = await api.submitContactMessage({
        name: fullName.trim(),
        email: email.trim(),
        subject: `Shipment support: ${issueType}`,
        priority: issueType === 'Damage' ? 'urgent' : 'routine',
        trackingNumber: id || undefined,
        message: message.trim(),
      });
      setTicket({ id: saved.id, trackingNumber: id, email: email.trim() });
      setMessage('');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'We couldn’t send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ngf-support-overlay" onClick={onClose}>
      <div
        className="ngf-support-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ngf-support-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ngf-support-header">
          <div className="support-header-left">
            <div className="support-icon-pill">
              <Headphones size={18} />
            </div>
            <h3 id="ngf-support-title">How can we help with this shipment?</h3>
          </div>
          <button type="button" className="support-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {ticket ? (
          <div className="ngf-support-success" role="status">
            <CheckCircle size={44} className="text-emerald" />
            <p>
              Ticket <strong className="font-mono">{ticket.id}</strong> opened
              {ticket.trackingNumber && <> for <strong className="font-mono">{ticket.trackingNumber}</strong></>}.
              {' '}We'll reply to <strong>{ticket.email}</strong> shortly.
            </p>
            <button type="button" className="ngf-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="ngf-support-form">
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="support-tracking">Tracking ID</label>
                <input
                  id="support-tracking"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. NGF7K2M9"
                  className="ngf-input font-mono"
                />
              </div>

              <div className="form-group">
                <label htmlFor="support-issue">Issue type</label>
                <select
                  id="support-issue"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as SupportIssueType)}
                  className="ngf-input"
                >
                  {SUPPORT_ISSUE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="support-message">Message</label>
              <textarea
                id="support-message"
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="ngf-input"
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="support-name">Name</label>
                <input
                  id="support-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="ngf-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="support-email">Email</label>
                <input
                  id="support-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="ngf-input"
                />
              </div>
            </div>

            {error && <p className="support-error" role="alert">{error}</p>}

            <div className="support-form-actions">
              <button type="button" className="ngf-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ngf-btn-primary" disabled={submitting}>
                <Send size={15} /> {submitting ? 'Opening…' : 'Open ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
