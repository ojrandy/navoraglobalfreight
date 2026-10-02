import React, { useState, useMemo } from 'react';
import {
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  FileText,
  Truck,
  AlertTriangle,
  ArrowRight,
  Send
} from 'lucide-react';
import { useCompanyContact } from '../utils/useCompanyContact';
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpCategory } from '../data/helpArticles';
import './HelpPage.css';

interface HelpPageProps {
  onNavigate: (page: string) => void;
}

// CONTENT §8.1 quick links
const QUICK_LINKS = [
  { page: 'track', title: 'Track a Shipment', icon: MapPin, tone: 'icon-accent' },
  { page: 'ship', title: 'Book a Collection', icon: Truck, tone: 'icon-emerald' },
  { page: 'quote', title: 'Request a Quote', icon: FileText, tone: 'icon-sky' },
  { page: 'contact', title: '24/7 Operations Desk', icon: Phone, tone: 'icon-amber' }
];

const categoryLabel = (id: HelpCategory) => HELP_CATEGORIES.find((c) => c.id === id)?.label || '';

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigate }) => {
  // An empty phone value hides its button (no placeholders).
  const { phone: supportPhone, phoneHref } = useCompanyContact();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<HelpCategory | 'all'>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(HELP_ARTICLES[0].id);

  // Search matches the question, the answer and the category name.
  const filteredFaqs = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return HELP_ARTICLES.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch = !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term) ||
        categoryLabel(faq.category).toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <div className="ngf-page-help">
      {/* =========================================================================
          1. HERO + SEARCH (CONTENT §8.1)
          ========================================================================= */}
      <section className="ngf-help-hero">
        <div className="help-hero-bg-overlay" />
        <div className="ngf-container-wide help-hero-inner">
          <h1 className="help-hero-title animate-fade-in">How can we help?</h1>

          <div className="help-search-container animate-fade-in">
            <div className="help-search-input-wrap">
              <Search size={20} className="help-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers, e.g. customs, delivery time, documents"
                aria-label="Search for answers"
                className="help-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="help-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="ngf-container-wide ngf-help-body">
        {/* =========================================================================
            2. QUICK LINKS
            ========================================================================= */}
        <div className="help-pillars-grid">
          {QUICK_LINKS.map(({ page, title, icon: Icon, tone }) => (
            <button key={page} type="button" className="help-pillar-card" onClick={() => onNavigate(page)}>
              <div className={`pillar-icon ${tone}`}><Icon size={24} /></div>
              <h3>{title}</h3>
              <span className="pillar-action-link" aria-hidden="true"><ArrowRight size={15} /></span>
            </button>
          ))}
        </div>

        {/* =========================================================================
            3. KNOWLEDGE BASE (CONTENT §8.2)
            ========================================================================= */}
        <section className="ngf-help-faq-section">
          <div className="section-center-header">
            <h2>Answers to common questions</h2>
            <div className="section-header-line" />
          </div>

          <div className="faq-category-pills">
            <button
              type="button"
              className={`cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All topics ({HELP_ARTICLES.length})
            </button>
            {HELP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="help-faq-accordion">
            {filteredFaqs.length === 0 ? (
              <div className="help-empty-search" role="status">
                <AlertTriangle size={36} className="text-amber" />
                <h3>No matching answers.</h3>
                <p>Try different words, or contact us and we'll answer directly.</p>
                <button
                  type="button"
                  className="btn-corp-ghost"
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className={`help-faq-item ${openFaqId === faq.id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="help-faq-header-btn"
                    aria-expanded={openFaqId === faq.id}
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <div className="faq-q-text">
                      <HelpCircle size={18} className="text-accent flex-shrink-0" />
                      <span>{faq.question}</span>
                    </div>
                    {openFaqId === faq.id ? (
                      <ChevronUp size={18} className="text-accent flex-shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {openFaqId === faq.id && (
                    <div className="help-faq-body animate-fade-in">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* =========================================================================
            4. FOOTER BANNER
            ========================================================================= */}
        <section className="ngf-help-cta-box">
          <div className="help-cta-content">
            <h2>Still need help with a shipment?</h2>
            <div className="help-cta-buttons">
              <button
                type="button"
                className="btn-corp-primary"
                onClick={() => onNavigate('contact')}
              >
                <Send size={16} />
                <span>Contact Support</span>
              </button>
              {supportPhone && (
                <a
                  href={phoneHref}
                  className="btn-corp-ghost"
                >
                  <Phone size={16} />
                  <span>Call {supportPhone}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
