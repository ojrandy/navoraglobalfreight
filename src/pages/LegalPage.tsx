import React, { useState, useEffect } from 'react';
import { Shield, FileText, Lock, Eye, Cookie } from 'lucide-react';
import { useCompanyContact } from '../utils/useCompanyContact';
import { LEGAL_LAST_UPDATED, legalDocs, type LegalDocId } from '../data/legalDocs';
import './LegalPage.css';

interface LegalPageProps {
  initialSection?: string;
  onNavigate?: (page: string, param?: string) => void;
}

const DOC_ICONS: Record<LegalDocId, React.ElementType> = {
  privacy: Lock,
  terms: FileText,
  'shipping-terms': Shield,
  cookies: Cookie,
  accessibility: Eye
};

// CONTENT §13: Privacy Policy · Terms of Service · Shipping Terms · Cookie Policy · Accessibility
export const LegalPage: React.FC<LegalPageProps> = ({ initialSection = 'privacy', onNavigate }) => {
  // Contact values from Settings/brand.ts; an empty address leaves its sentence out.
  const { email, address } = useCompanyContact();
  const docs = legalDocs({ email, address });
  const known = (id: string) => docs.some((d) => d.id === id);
  const [activeDoc, setActiveDoc] = useState(known(initialSection) ? initialSection : 'privacy');

  useEffect(() => {
    if (initialSection && known(initialSection)) {
      setActiveDoc(initialSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  const doc = docs.find((d) => d.id === activeDoc) || docs[0];

  return (
    <div className="sdl-page-legal">
      <section className="sdl-legal-hero">
        <div className="legal-hero-bg-overlay" />
        <div className="sdl-container-wide legal-hero-inner">
          <h1 className="legal-hero-title animate-fade-in">Legal</h1>
        </div>
      </section>

      <div className="sdl-container-wide sdl-legal-content-wrap">
        <aside className="sdl-legal-sidebar">
          <div className="legal-sidebar-card">
            <nav className="legal-nav-list" aria-label="Legal pages">
              {docs.map((d) => {
                const Icon = DOC_ICONS[d.id];
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-current={d.id === doc.id ? 'page' : undefined}
                    className={`legal-nav-btn ${d.id === doc.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveDoc(d.id);
                      // Keep the URL (#/legal/<id>) in step, so each policy has its own link.
                      onNavigate?.('legal', d.id);
                    }}
                  >
                    <Icon size={16} />
                    <span>{d.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="sdl-legal-document animate-fade-in">
          <div className="legal-doc-header">
            <h2>{doc.title}</h2>
            <div className="doc-meta-bar">
              <span>Last updated: <time>{LEGAL_LAST_UPDATED}</time></span>
            </div>
          </div>

          <div className="legal-doc-body">
            {doc.sections.map((section, i) => (
              <section key={section.heading} className="legal-section">
                <h3>{i + 1}. {section.heading}</h3>
                {section.body.map((block, j) =>
                  Array.isArray(block) ? (
                    <ul key={j} className="legal-list">
                      {block.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p key={j}>{block}</p>
                  )
                )}
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};
