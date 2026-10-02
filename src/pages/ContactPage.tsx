import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  MessageCircle
} from 'lucide-react';
import { useAdminData } from '../context/AdminDataContext';
import { useCompanyContact } from '../utils/useCompanyContact';
import { COMPANY_SHORT, LEGAL_NAME } from '../config/brand';
import { api } from '../services/api';
import { GATEWAYS, getGateway } from '../data/gateways';
import { HELP_ARTICLES, CONTACT_QUICK_ANSWER_IDS } from '../data/helpArticles';
import './ContactPage.css';

// CONTENT §8.3 form topics (stored as the message subject in the admin inbox).
const TOPICS = ['Quote', 'Active shipment', 'Billing', 'Partnership', 'Other'] as const;

const QUICK_ANSWERS = CONTACT_QUICK_ANSWER_IDS
  .map((id) => HELP_ARTICLES.find((a) => a.id === id))
  .filter((a): a is NonNullable<typeof a> => Boolean(a));

interface ContactPageProps {
  onNavigate?: (page: string) => void;
  /** Gateway code pre-filled by "Contact this gateway" on the Locations page. */
  initialGateway?: string;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate, initialGateway = '' }) => {
  const { settings } = useAdminData();
  // Empty phone/WhatsApp/address/regulatory values hide their element (no placeholders).
  const { phone: supportPhone, phoneHref, whatsapp, email: dispatchEmail, address: headquartersAddress, regulatoryLine } = useCompanyContact();
  const companyName = settings.companyName || LEGAL_NAME;
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [tracking, setTracking] = useState('');
  const [gatewayCode, setGatewayCode] = useState(getGateway(initialGateway) ? initialGateway : '');
  const [message, setMessage] = useState('');
  // The server's reference (NGF-TKT-######) and the email it was sent with.
  const [ticket, setTicket] = useState<{ id: string; email: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Accordion open states
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (!name.trim() || !email.trim() || !topic || !message.trim()) {
      setFormError('Please complete all required fields (Name, Email, Topic and Message) before sending.');
      return;
    }

    // The server stores the message and issues the NGF-TKT reference.
    setSubmitting(true);
    try {
      const saved = await api.submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: topic,
        // No priority picker on the form (§8.3); active shipments are flagged for the inbox.
        priority: topic === 'Active shipment' ? 'urgent' : 'routine',
        trackingNumber: tracking.trim() || undefined,
        gatewayCode: gatewayCode || undefined,
        message: message.trim()
      });
      setTicket({ id: saved.id, email: email.trim() });
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(`We couldn't send your message: ${err?.message || 'please try again'}. You can also email us at ${dispatchEmail}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setTopic('');
    setTracking('');
    setGatewayCode('');
    setMessage('');
    setTicket(null);
    setFormError(null);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="sdl-page-contact">
      {/* =========================================================================
          1. HERO (CONTENT §8.3)
          ========================================================================= */}
      <section className="sdl-contact-hero">
        <div className="contact-hero-bg-overlay" />
        <div className="sdl-container-wide contact-hero-inner">
          {/* Regulatory line from admin Settings, only when set (tracker Blocked #20). */}
          {regulatoryLine && (
            <div className="contact-hero-pill animate-fade-in">
              <span>{regulatoryLine}</span>
            </div>
          )}

          <h1 className="contact-hero-title animate-fade-in">Talk to {COMPANY_SHORT}</h1>

          <p className="contact-hero-lead animate-fade-in">
            Questions, quotes or a shipment that needs attention: a real coordinator will get back to you.
          </p>
        </div>
      </section>

      {/* =========================================================================
          2. FORM & CHANNELS
          ========================================================================= */}
      <div className="sdl-container-wide sdl-contact-body">
        <div className="contact-grid">
          {/* Left Column: Form & Confirmation */}
          <div className="contact-form-card">
            {ticket ? (
              <div className="contact-success-wrap animate-fade-in" role="status">
                <div className="success-icon-badge">
                  <CheckCircle2 size={48} className="text-emerald" />
                </div>
                <h3>Message received.</h3>

                <div className="ticket-summary-box">
                  <p>
                    Your reference is <strong className="font-mono">{ticket.id}</strong>. We'll reply to <strong>{ticket.email}</strong> as soon as possible.
                  </p>
                </div>

                <div className="success-action-row">
                  <button
                    type="button"
                    className="btn-corp-primary"
                    onClick={handleReset}
                  >
                    <RotateCcw size={16} />
                    <span>Send another message</span>
                  </button>

                  {onNavigate && (
                    <button
                      type="button"
                      className="btn-corp-ghost"
                      onClick={() => onNavigate('track')}
                    >
                      <span>Track a Shipment</span>
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-header-row">
                  <h3>Send us a message</h3>
                </div>

                {formError && (
                  <div className="contact-form-error animate-fade-in" role="alert">
                    <AlertTriangle size={18} className="flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="contact-name">Name *</label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="sdl-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-email">Email *</label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="sdl-input"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="contact-phone">Phone <span className="sdl-field-optional">(optional)</span></label>
                    <input
                      id="contact-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="With country code, e.g. +44"
                      className="sdl-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-topic">Topic *</label>
                    <select
                      id="contact-topic"
                      required
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="sdl-input"
                    >
                      <option value="" disabled>Choose a topic</option>
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="contact-tracking">Tracking ID <span className="sdl-field-optional">(optional)</span></label>
                    <input
                      id="contact-tracking"
                      type="text"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="e.g. NGF7K2M9"
                      className="sdl-input font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-gateway">Gateway <span className="sdl-field-optional">(optional)</span></label>
                    <select
                      id="contact-gateway"
                      value={gatewayCode}
                      onChange={(e) => setGatewayCode(e.target.value)}
                      className="sdl-input"
                    >
                      <option value="">No specific gateway</option>
                      {GATEWAYS.map((gw) => (
                        <option key={gw.code} value={gw.code}>{gw.city}, {gw.country} ({gw.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="contact-message">Message *</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="sdl-input"
                  />
                </div>

                <button type="submit" className="btn-corp-primary form-submit-btn" disabled={submitting} aria-busy={submitting}>
                  <Send size={16} />
                  <span>{submitting ? 'Sending…' : 'Send message'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Channels & 24/7 card */}
          <div className="contact-info-col">
            <div className="contact-info-card">
              <div className="contact-channel-item">
                <div className="channel-icon icon-emerald"><Mail size={22} /></div>
                <div>
                  <small>Email</small>
                  <strong><a href={`mailto:${dispatchEmail}`}>{dispatchEmail}</a></strong>
                </div>
              </div>

              {supportPhone && (
                <div className="contact-channel-item">
                  <div className="channel-icon icon-accent"><Phone size={22} /></div>
                  <div>
                    <small>Phone</small>
                    <strong><a href={phoneHref}>{supportPhone}</a></strong>
                  </div>
                </div>
              )}

              {whatsappHref && (
                <div className="contact-channel-item">
                  <div className="channel-icon icon-emerald"><MessageCircle size={22} /></div>
                  <div>
                    <small>WhatsApp</small>
                    <strong><a href={whatsappHref} target="_blank" rel="noopener noreferrer">{whatsapp}</a></strong>
                  </div>
                </div>
              )}

              {headquartersAddress && (
                <div className="contact-channel-item">
                  <div className="channel-icon icon-sky"><MapPin size={22} /></div>
                  <div>
                    <small>Head office</small>
                    <strong>{companyName}</strong>
                    <p>{headquartersAddress}</p>
                  </div>
                </div>
              )}

              <div className="emergency-box">
                <div className="em-head">
                  <Clock size={18} className="text-amber" />
                  <strong>24/7 Operations Desk.</strong>
                </div>
                <p>For active shipments, include your tracking ID for the fastest help.</p>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. QUICK ANSWERS (CONTENT §8.3, items from §8.2)
            ========================================================================= */}
        <section className="sdl-contact-faq-section">
          <div className="section-center-header">
            <h2>Quick answers</h2>
            <div className="section-header-line" />
          </div>

          <div className="contact-faq-accordion">
            {QUICK_ANSWERS.map((faq, index) => (
              <div
                key={faq.id}
                className={`contact-faq-item ${openFaq === index ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="faq-question-btn"
                  aria-expanded={openFaq === index}
                  onClick={() => toggleFaq(index)}
                >
                  <div className="q-left">
                    <HelpCircle size={18} className="text-accent flex-shrink-0" />
                    <span>{faq.question}</span>
                  </div>
                  {openFaq === index ? (
                    <ChevronUp size={18} className="text-accent flex-shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {openFaq === index && (
                  <div className="faq-answer-body animate-fade-in">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
