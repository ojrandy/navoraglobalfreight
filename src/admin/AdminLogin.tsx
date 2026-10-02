import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { ADMIN_CONSOLE_NAME } from '../config/brand';
import './AdminLogin.css';

interface AdminLoginProps {
  onNavigatePublic: (page: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigatePublic }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.login(password);
      // AdminDataContext only ever fetches shipments/quotes/documents/settings once, on the
      // very first app mount — which, for someone landing straight on #/admin logged out,
      // happened before this session existed and so came back empty/401. A full reload is
      // the simplest way to guarantee that context re-fetches everything now that a valid
      // session cookie actually exists, rather than trying to thread a manual refetch call
      // through the provider just for this one-time transition.
      window.location.reload();
    } catch (err: any) {
      // CONTENT §10 wording for a wrong password; other failures (e.g. too many attempts) keep the server's message.
      const message: string = err?.message || '';
      setError(/incorrect password/i.test(message) || !message ? 'Incorrect password. Please try again.' : message);
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-badge">
          <ShieldCheck size={22} />
        </div>
        <h1 className="admin-login-title">{ADMIN_CONSOLE_NAME}</h1>
        <p className="admin-login-sub">Sign in to manage shipments, tracking and documents.</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-field">
            <Lock size={15} className="admin-login-field-icon" />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Password"
              aria-label="Password"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="admin-login-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="admin-login-submit" disabled={submitting || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting && <ArrowRight size={15} />}
          </button>
        </form>

        <button type="button" className="admin-login-exit" onClick={() => onNavigatePublic('home')}>
          ← Back to public site
        </button>
      </div>
    </div>
  );
};
