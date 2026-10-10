import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  PAYMENT_METHOD_TYPES, PAYMENT_METHODS, PaymentField, PaymentMethodType, customerMethodView,
  validatePaymentDetails,
} from '../../shared/paymentMethods';
import {
  DEFAULT_PAYMENT_CURRENCY, PAYMENT_CURRENCIES, PAYMENT_LIMITS, PaymentCurrency, ShipmentPayment, formatPaymentAmount,
  validatePaymentRequest,
} from '../../shared/paymentRequest';
import type { PaymentRequestBody } from '../../services/api';
import { PaymentIcon } from '../../components/PaymentIcon';
import { PaymentMethodCard } from '../../components/PaymentMethodCard';
import './PaymentRequestEditor.css';

// ---------------------------------------------------------------------------------------------
// Draft model: what the editor holds while the courier types (strings, not yet validated).
// ---------------------------------------------------------------------------------------------

export interface PaymentDraftAccount {
  /** Stable React key; `id` is the stored account id once saved. */
  key: string;
  id?: string;
  type: PaymentMethodType;
  label: string;
  details: Record<string, string>;
  instructions: string;
}

export interface PaymentDraft {
  amount: string;
  currency: PaymentCurrency;
  chargeReason: string;
  dueDate: string;
  invoiceDocumentId: string;
  customerNote: string;
  accounts: PaymentDraftAccount[];
}

const newKey = () => `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function emptyPaymentDraft(): PaymentDraft {
  return { amount: '', currency: DEFAULT_PAYMENT_CURRENCY, chargeReason: '', dueDate: '', invoiceDocumentId: '', customerNote: '', accounts: [] };
}

export function draftFromPayment(p: ShipmentPayment): PaymentDraft {
  return {
    amount: String(p.amount),
    currency: p.currency,
    chargeReason: p.chargeReason,
    dueDate: p.dueDate ?? '',
    invoiceDocumentId: p.invoiceDocumentId ?? '',
    customerNote: p.customerNote ?? '',
    accounts: p.methods.map((m) => ({ key: m.id, id: m.id, type: m.type, label: m.label ?? '', details: { ...m.details }, instructions: m.instructions ?? '' })),
  };
}

export function draftToRequest(d: PaymentDraft): PaymentRequestBody {
  return {
    amount: d.amount,
    currency: d.currency,
    chargeReason: d.chargeReason,
    dueDate: d.dueDate || undefined,
    invoiceDocumentId: d.invoiceDocumentId || undefined,
    customerNote: d.customerNote || undefined,
    methods: d.accounts.map((a) => ({ id: a.id, type: a.type, label: a.label || undefined, details: a.details, instructions: a.instructions || undefined })),
  };
}

/** Client-side check with the same rules as the server. Returns {} when the draft is valid. */
export function paymentDraftErrors(d: PaymentDraft): Record<string, string> {
  const res = validatePaymentRequest(draftToRequest(d), newKey);
  return res.ok ? {} : res.errors;
}

/** Short one-line summary, e.g. "$120.00 · Customs duty · 2 accounts". */
export function paymentDraftSummary(d: PaymentDraft): string {
  const amount = Number(d.amount);
  const parts = [
    Number.isFinite(amount) && amount > 0 ? formatPaymentAmount(amount, d.currency) : 'No amount',
    d.chargeReason.trim() || 'No reason',
    `${d.accounts.length} account${d.accounts.length === 1 ? '' : 's'}`,
  ];
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------------------------

function blankDetails(type: PaymentMethodType): Record<string, string> {
  const details: Record<string, string> = {};
  for (const f of PAYMENT_METHODS[type].fields) details[f.name] = f.options && f.required ? f.options[0] : '';
  return details;
}

function inputType(field: PaymentField): string {
  return field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel' : field.kind === 'url' ? 'url' : 'text';
}

function accountSummary(a: PaymentDraftAccount): string {
  return PAYMENT_METHODS[a.type].fields
    .filter((f) => a.details[f.name] && f.name !== 'network')
    .slice(0, 2)
    .map((f) => a.details[f.name])
    .join(' · ');
}

type AccountEditor = { mode: 'pick' } | { mode: 'form'; account: PaymentDraftAccount; index: number | null };

interface PaymentRequestEditorProps {
  value: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  /** Errors from paymentDraftErrors or the server, keyed like validatePaymentRequest. */
  errors?: Record<string, string>;
  /** This shipment's invoices, for the optional link. Hidden when empty. */
  invoices?: { id: string; label: string }[];
  /** Prefix for element ids, so two editors on a page don't clash. */
  idPrefix?: string;
  /** Stack the preview under the form (for narrow hosts such as the Edit Shipment modal). */
  compact?: boolean;
}

/**
 * Admin editor for a shipment's payment request (docs/update.md D.2, D-9): amount, reason, due
 * date, note, optional invoice link, and the payment accounts typed for this shipment, with a live
 * preview of what the customer will see. Controlled: the host decides when and where to save.
 * Every button is type="button" and Enter in a text field never submits a surrounding form.
 */
export const PaymentRequestEditor: React.FC<PaymentRequestEditorProps> = ({ value, onChange, errors = {}, invoices = [], idPrefix = 'pr', compact = false }) => {
  const [accountEditor, setAccountEditor] = useState<AccountEditor | null>(null);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

  const set = (patch: Partial<PaymentDraft>) => onChange({ ...value, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;

  const startAdd = () => {
    setAccountErrors({});
    setAccountEditor({ mode: 'pick' });
  };

  const pickType = (type: PaymentMethodType) =>
    setAccountEditor({ mode: 'form', index: null, account: { key: newKey(), type, label: '', details: blankDetails(type), instructions: '' } });

  const startEdit = (index: number) => {
    const a = value.accounts[index];
    setAccountErrors({});
    setAccountEditor({ mode: 'form', index, account: { ...a, details: { ...blankDetails(a.type), ...a.details } } });
  };

  const editing = accountEditor?.mode === 'form' ? accountEditor.account : null;
  const updateEditing = (patch: Partial<PaymentDraftAccount>) => {
    if (accountEditor?.mode !== 'form') return;
    setAccountEditor({ ...accountEditor, account: { ...accountEditor.account, ...patch } });
  };

  const saveAccount = () => {
    if (accountEditor?.mode !== 'form') return;
    const a = accountEditor.account;
    const checked = validatePaymentDetails(a.type, a.details);
    const errs: Record<string, string> = checked.ok ? {} : { ...checked.errors };
    if (a.label.trim().length > PAYMENT_LIMITS.labelMax) errs.label = `Keep the display name under ${PAYMENT_LIMITS.labelMax} characters.`;
    if (a.instructions.trim().length > PAYMENT_LIMITS.instructionsMax) errs.instructions = `Keep the instructions under ${PAYMENT_LIMITS.instructionsMax} characters.`;
    if (Object.keys(errs).length) {
      setAccountErrors(errs);
      return;
    }
    const saved: PaymentDraftAccount = { ...a, details: checked.ok ? checked.details : a.details, label: a.label.trim(), instructions: a.instructions.trim() };
    const accounts = [...value.accounts];
    if (accountEditor.index === null) accounts.push(saved);
    else accounts[accountEditor.index] = saved;
    set({ accounts });
    setAccountEditor(null);
    setAccountErrors({});
  };

  const removeAccount = (index: number) => {
    const a = value.accounts[index];
    const name = a.label || PAYMENT_METHODS[a.type].label;
    if (!window.confirm(`Remove “${name}” from this payment request?`)) return;
    set({ accounts: value.accounts.filter((_, i) => i !== index) });
  };

  const moveAccount = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= value.accounts.length) return;
    const accounts = [...value.accounts];
    [accounts[index], accounts[target]] = [accounts[target], accounts[index]];
    set({ accounts });
  };

  // The customer's view of every saved account (and the one being edited, live).
  const previewAccounts = useMemo(() => {
    const list = value.accounts.map((a, i) => (accountEditor?.mode === 'form' && accountEditor.index === i ? accountEditor.account : a));
    if (accountEditor?.mode === 'form' && accountEditor.index === null) list.push(accountEditor.account);
    return list.map((a) => {
      const shown = Object.fromEntries(Object.entries(a.details).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
      return { key: a.key, view: customerMethodView(a.type, shown, a.label), instructions: a.instructions.trim() || null };
    });
  }, [value.accounts, accountEditor]);

  const amountNumber = Number(value.amount);
  const accountErrorFor = (index: number) =>
    Object.entries(errors).filter(([k]) => k.startsWith(`methods.${index}.`)).map(([, v]) => v)[0];

  // Enter in a single-line field must never submit the Create/Edit Shipment form around this editor.
  const blockEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  };

  return (
    <div className={`ngf-pre${compact ? " ngf-pre-compact" : ""}`} onKeyDown={blockEnter}>
      <div className="ngf-pre-layout">
        <div className="ngf-pre-form">
          <div className="ngf-pre-row">
            <div className="ngf-pre-field">
              <label htmlFor={id('amount')}>Amount due</label>
              <input
                id={id('amount')}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={value.amount}
                onChange={(e) => set({ amount: e.target.value })}
                aria-invalid={!!errors.amount}
                placeholder="0.00"
              />
              {errors.amount && <p className="ngf-pre-error">{errors.amount}</p>}
            </div>
            <div className="ngf-pre-field ngf-pre-field-narrow">
              <label htmlFor={id('currency')}>Currency</label>
              <select id={id('currency')} value={value.currency} onChange={(e) => set({ currency: e.target.value as PaymentCurrency })}>
                {PAYMENT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="ngf-pre-field">
              <label htmlFor={id('due')}>Due date (optional)</label>
              <input id={id('due')} type="date" value={value.dueDate} onChange={(e) => set({ dueDate: e.target.value })} aria-invalid={!!errors.dueDate} />
              {errors.dueDate && <p className="ngf-pre-error">{errors.dueDate}</p>}
            </div>
          </div>

          <div className="ngf-pre-field">
            <label htmlFor={id('reason')}>What the customer is paying for</label>
            <input
              id={id('reason')}
              type="text"
              maxLength={PAYMENT_LIMITS.reasonMax}
              value={value.chargeReason}
              onChange={(e) => set({ chargeReason: e.target.value })}
              placeholder="e.g. Customs duty – Invoice NGF-INV-104233"
              aria-invalid={!!errors.chargeReason}
            />
            {errors.chargeReason && <p className="ngf-pre-error">{errors.chargeReason}</p>}
          </div>

          {invoices.length > 0 && (
            <div className="ngf-pre-field">
              <label htmlFor={id('invoice')}>Linked invoice (optional)</label>
              <select id={id('invoice')} value={value.invoiceDocumentId} onChange={(e) => set({ invoiceDocumentId: e.target.value })} aria-invalid={!!errors.invoiceDocumentId}>
                <option value="">None</option>
                {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.label}</option>)}
              </select>
              <p className="ngf-pre-hint">When the payment is confirmed, this invoice is marked paid.</p>
              {errors.invoiceDocumentId && <p className="ngf-pre-error">{errors.invoiceDocumentId}</p>}
            </div>
          )}

          <div className="ngf-pre-field">
            <label htmlFor={id('note')}>Note for the customer (optional)</label>
            <textarea
              id={id('note')}
              rows={2}
              maxLength={PAYMENT_LIMITS.noteMax}
              value={value.customerNote}
              onChange={(e) => set({ customerNote: e.target.value })}
              placeholder="e.g. Please pay within 48 hours so the shipment can clear customs."
            />
            {errors.customerNote && <p className="ngf-pre-error">{errors.customerNote}</p>}
          </div>

          {/* Accounts typed for this shipment */}
          <div className="ngf-pre-accounts">
            <div className="ngf-pre-accounts-head">
              <h5>Payment accounts for this shipment</h5>
              <span>{value.accounts.length} / {PAYMENT_LIMITS.maxAccounts}</span>
            </div>
            {errors.methods && <p className="ngf-pre-error">{errors.methods}</p>}

            {value.accounts.length > 0 && (
              <ul className="ngf-pre-account-list">
                {value.accounts.map((a, index) => {
                  const err = accountErrorFor(index);
                  return (
                    <li key={a.key} className={`ngf-pre-account${err ? ' has-error' : ''}`}>
                      <span className="ngf-pre-account-icon"><PaymentIcon type={a.type} size={20} /></span>
                      <div className="ngf-pre-account-text">
                        <strong>{a.label || PAYMENT_METHODS[a.type].label}</strong>
                        <span>{accountSummary(a)}</span>
                        {err && <span className="ngf-pre-error">{err}</span>}
                      </div>
                      <div className="ngf-pre-account-actions">
                        <button type="button" className="ngf-pre-icon-btn" onClick={() => startEdit(index)} disabled={!!accountEditor} aria-label={`Edit ${a.label || PAYMENT_METHODS[a.type].label}`}>
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="ngf-pre-icon-btn" onClick={() => moveAccount(index, -1)} disabled={!!accountEditor || index === 0} aria-label="Move up">
                          <ArrowUp size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="ngf-pre-icon-btn" onClick={() => moveAccount(index, 1)} disabled={!!accountEditor || index === value.accounts.length - 1} aria-label="Move down">
                          <ArrowDown size={14} aria-hidden="true" />
                        </button>
                        <button type="button" className="ngf-pre-icon-btn danger" onClick={() => removeAccount(index)} disabled={!!accountEditor} aria-label={`Remove ${a.label || PAYMENT_METHODS[a.type].label}`}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!accountEditor && value.accounts.length < PAYMENT_LIMITS.maxAccounts && (
              <button type="button" className="ngf-pre-btn" onClick={startAdd}>
                <Plus size={14} aria-hidden="true" />
                <span>Add account</span>
              </button>
            )}

            {accountEditor?.mode === 'pick' && (
              <div className="ngf-pre-subeditor">
                <div className="ngf-pre-subeditor-head">
                  <h6>Choose the payment method</h6>
                  <button type="button" className="ngf-pre-icon-btn" onClick={() => setAccountEditor(null)} aria-label="Cancel">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="ngf-pre-type-grid">
                  {PAYMENT_METHOD_TYPES.map((t) => (
                    <button type="button" key={t} className="ngf-pre-type" onClick={() => pickType(t)}>
                      <PaymentIcon type={t} size={20} />
                      <span>{PAYMENT_METHODS[t].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editing && (
              <div className="ngf-pre-subeditor">
                <div className="ngf-pre-subeditor-head">
                  <h6>
                    <PaymentIcon type={editing.type} size={18} />
                    <span>{PAYMENT_METHODS[editing.type].label}</span>
                  </h6>
                  <button type="button" className="ngf-pre-icon-btn" onClick={() => setAccountEditor(null)} aria-label="Cancel">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                {PAYMENT_METHODS[editing.type].fields.map((field) => {
                  const fid = id(`acc-${field.name}`);
                  const err = accountErrors[field.name];
                  return (
                    <div className="ngf-pre-field" key={field.name}>
                      <label htmlFor={fid}>{field.label}{field.required ? '' : ' (optional)'}</label>
                      {field.options ? (
                        <select id={fid} value={editing.details[field.name] ?? ''} onChange={(e) => updateEditing({ details: { ...editing.details, [field.name]: e.target.value } })}>
                          {!field.required && <option value="">—</option>}
                          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          id={fid}
                          type={inputType(field)}
                          inputMode={['routing', 'accountNumber', 'sortCode'].includes(field.kind) ? 'numeric' : undefined}
                          autoComplete="off"
                          spellCheck={false}
                          value={editing.details[field.name] ?? ''}
                          placeholder={field.placeholder}
                          onChange={(e) => {
                            updateEditing({ details: { ...editing.details, [field.name]: e.target.value } });
                            setAccountErrors(({ [field.name]: _, _form: __, ...rest }) => rest);
                          }}
                          aria-invalid={!!err}
                          aria-describedby={err ? `${fid}-err` : undefined}
                        />
                      )}
                      {err && <p className="ngf-pre-error" id={`${fid}-err`}>{err}</p>}
                    </div>
                  );
                })}
                {accountErrors._form && <p className="ngf-pre-error">{accountErrors._form}</p>}
                <div className="ngf-pre-field">
                  <label htmlFor={id('acc-label')}>Display name (optional)</label>
                  <input id={id('acc-label')} type="text" maxLength={PAYMENT_LIMITS.labelMax} value={editing.label} placeholder={PAYMENT_METHODS[editing.type].label} onChange={(e) => updateEditing({ label: e.target.value })} />
                  {accountErrors.label && <p className="ngf-pre-error">{accountErrors.label}</p>}
                </div>
                <div className="ngf-pre-field">
                  <label htmlFor={id('acc-instructions')}>Instructions for the customer (optional)</label>
                  <textarea id={id('acc-instructions')} rows={2} maxLength={PAYMENT_LIMITS.instructionsMax} value={editing.instructions} onChange={(e) => updateEditing({ instructions: e.target.value })} />
                  {accountErrors.instructions && <p className="ngf-pre-error">{accountErrors.instructions}</p>}
                </div>
                <div className="ngf-pre-subeditor-actions">
                  <button type="button" className="ngf-pre-btn" onClick={() => setAccountEditor(null)}>Cancel</button>
                  <button type="button" className="ngf-pre-btn primary" onClick={saveAccount}>
                    {accountEditor?.mode === 'form' && accountEditor.index !== null ? 'Update account' : 'Add this account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live preview of the customer's payment section */}
        <div className="ngf-pre-preview" aria-label="Customer preview">
          <span className="ngf-pre-preview-label">Customer preview</span>
          <div className="ngf-pre-preview-box">
            <div className="ngf-pre-preview-amount">
              {Number.isFinite(amountNumber) && amountNumber > 0 ? formatPaymentAmount(amountNumber, value.currency) : formatPaymentAmount(0, value.currency)}
            </div>
            <p className="ngf-pre-preview-reason">{value.chargeReason.trim() || 'Reason for the payment'}</p>
            {value.dueDate && <p className="ngf-pre-preview-meta">Due {value.dueDate}</p>}
            {value.customerNote.trim() && <p className="ngf-pre-preview-note">{value.customerNote.trim()}</p>}
            {previewAccounts.length === 0 ? (
              <p className="ngf-pre-preview-empty">Add an account to show how the customer can pay.</p>
            ) : (
              <div className="ngf-pre-preview-cards">
                {previewAccounts.map((p) => <PaymentMethodCard key={p.key} view={p.view} instructions={p.instructions} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

