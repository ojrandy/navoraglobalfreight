import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Power, Trash2, Wallet, X } from 'lucide-react';
import { api } from '../../services/api';
import { AdminPaymentMethod } from '../../types/admin';
import {
  PAYMENT_METHOD_TYPES, PAYMENT_METHODS, PaymentField, PaymentMethodType, customerMethodView, isPaymentMethodType,
  validatePaymentDetails,
} from '../../shared/paymentMethods';
import { PaymentIcon } from '../../components/PaymentIcon';
import { PaymentMethodCard } from '../../components/PaymentMethodCard';
import './PaymentMethodsManager.css';

// Same limits as server/routes/paymentMethods.ts.
const MAX_LABEL = 60;
const MAX_INSTRUCTIONS = 500;

type EditorState =
  | { mode: 'pick' }
  | { mode: 'form'; type: PaymentMethodType; method?: AdminPaymentMethod };

interface FormValues {
  details: Record<string, string>;
  label: string;
  instructions: string;
  enabled: boolean;
}

function emptyValues(type: PaymentMethodType): FormValues {
  const details: Record<string, string> = {};
  for (const f of PAYMENT_METHODS[type].fields) details[f.name] = f.options && f.required ? f.options[0] : '';
  return { details, label: '', instructions: '', enabled: true };
}

function inputType(field: PaymentField): string {
  return field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel' : field.kind === 'url' ? 'url' : 'text';
}

/** Short summary for a method's card in the list: its first two filled fields. */
function summary(method: AdminPaymentMethod): string {
  if (!isPaymentMethodType(method.type)) return '';
  return PAYMENT_METHODS[method.type].fields
    .filter((f) => method.details[f.name] && f.name !== 'network')
    .slice(0, 2)
    .map((f) => method.details[f.name])
    .join(' · ');
}

/**
 * Settings > Payment methods (docs/update.md C.4): the admin's payment accounts. Saved through
 * /api/payment-methods only, never through the public settings record.
 */
export const PaymentMethodsManager: React.FC = () => {
  const [methods, setMethods] = useState<AdminPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    api.getPaymentMethods()
      .then((list) => { setMethods(list); setLoadError(''); })
      .catch((err) => setLoadError(err.message || 'Could not load payment methods.'))
      .finally(() => setLoading(false));
  }, []);

  const openForm = (type: PaymentMethodType, method?: AdminPaymentMethod) => {
    setEditor({ mode: 'form', type, method });
    setErrors({});
    if (method) {
      const base = emptyValues(type);
      setValues({
        details: { ...base.details, ...method.details },
        label: method.label ?? '',
        instructions: method.instructions ?? '',
        enabled: method.enabled,
      });
    } else {
      setValues(emptyValues(type));
    }
  };

  const closeEditor = () => {
    setEditor(null);
    setValues(null);
    setErrors({});
  };

  const setDetail = (name: string, value: string) => {
    setValues((v) => (v ? { ...v, details: { ...v.details, [name]: value } } : v));
    setErrors(({ [name]: _, _form: __, ...rest }) => rest);
  };

  const formType = editor?.mode === 'form' ? editor.type : null;

  // Live preview: the normalised details when they're valid, otherwise what's typed so far.
  const preview = useMemo(() => {
    if (!formType || !values) return null;
    const checked = validatePaymentDetails(formType, values.details);
    const shown = checked.ok
      ? checked.details
      : Object.fromEntries(Object.entries(values.details).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    return customerMethodView(formType, shown, values.label);
  }, [formType, values]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formType || !values || editor?.mode !== 'form') return;
    const checked = validatePaymentDetails(formType, values.details);
    const localErrors: Record<string, string> = checked.ok ? {} : { ...checked.errors };
    if (values.label.trim().length > MAX_LABEL) localErrors.label = `Keep the display name under ${MAX_LABEL} characters.`;
    if (values.instructions.trim().length > MAX_INSTRUCTIONS) localErrors.instructions = `Keep the instructions under ${MAX_INSTRUCTIONS} characters.`;
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }
    setSaving(true);
    try {
      const payload = { details: values.details, label: values.label.trim(), instructions: values.instructions.trim(), enabled: values.enabled };
      const list = editor.method
        ? await api.updatePaymentMethod(editor.method.id, payload)
        : await api.createPaymentMethod({ type: formType, ...payload });
      setMethods(list);
      setMessage({ text: editor.method ? 'Payment method saved.' : 'Payment method added.' });
      closeEditor();
    } catch (err: any) {
      setErrors(err.fieldErrors ?? {});
      setMessage({ text: err.message || 'Could not save the payment method.', error: true });
    } finally {
      setSaving(false);
    }
  };

  const run = async (id: string, action: () => Promise<AdminPaymentMethod[]>, done: string) => {
    setBusyId(id);
    try {
      setMethods(await action());
      setMessage({ text: done });
    } catch (err: any) {
      setMessage({ text: err.message || 'Something went wrong. Please try again.', error: true });
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = (m: AdminPaymentMethod) =>
    m.label || (isPaymentMethodType(m.type) ? PAYMENT_METHODS[m.type].label : m.type);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= methods.length) return;
    const ids = methods.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(methods[index].id, () => api.reorderPaymentMethods(ids), 'Order saved.');
  };

  const remove = (m: AdminPaymentMethod) => {
    if (!window.confirm(`Delete “${nameOf(m)}”? This cannot be undone.`)) return;
    run(m.id, () => api.deletePaymentMethod(m.id), `Deleted “${nameOf(m)}”.`);
  };

  return (
    <div className="settings-card-section animate-fade-in ngf-pmm">
      <div className="settings-card-header">
        <div className="header-icon-wrap icon-emerald">
          <Wallet size={20} />
        </div>
        <div>
          <h3>Payment Methods</h3>
          <p>
            Accounts customers can pay into. A shipment&rsquo;s track page shows only the methods you tick on its
            payment request, and only while they&rsquo;re enabled. These details are never part of the public settings.
          </p>
        </div>
      </div>

      <div className="settings-card-body">
        <div className="ngf-pmm-toolbar">
          <span className="ngf-pmm-count">{methods.length} method{methods.length === 1 ? '' : 's'}</span>
          {!editor && (
            <button type="button" className="ngf-pmm-btn primary" onClick={() => setEditor({ mode: 'pick' })}>
              <Plus size={15} aria-hidden="true" />
              <span>Add method</span>
            </button>
          )}
        </div>

        <p className={`ngf-pmm-status${message?.error ? ' is-error' : ''}`} role="status" aria-live="polite">{message?.text}</p>

        {editor?.mode === 'pick' && (
          <div className="ngf-pmm-editor">
            <div className="ngf-pmm-editor-head">
              <h4>Choose a payment method type</h4>
              <button type="button" className="ngf-pmm-icon-btn" onClick={closeEditor} aria-label="Cancel">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="ngf-pmm-type-grid">
              {PAYMENT_METHOD_TYPES.map((t) => (
                <button type="button" key={t} className="ngf-pmm-type" onClick={() => openForm(t)}>
                  <PaymentIcon type={t} size={22} />
                  <span>{PAYMENT_METHODS[t].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {editor?.mode === 'form' && values && formType && (
          <form className="ngf-pmm-editor" onSubmit={submit} noValidate>
            <div className="ngf-pmm-editor-head">
              <h4>
                <PaymentIcon type={formType} size={20} />
                <span>{editor.method ? 'Edit' : 'Add'} {PAYMENT_METHODS[formType].label}</span>
              </h4>
              <button type="button" className="ngf-pmm-icon-btn" onClick={closeEditor} aria-label="Cancel">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="ngf-pmm-form-grid">
              <div className="ngf-pmm-fields">
                {PAYMENT_METHODS[formType].fields.map((field) => {
                  const id = `pm-${field.name}`;
                  const error = errors[field.name];
                  return (
                    <div className="ngf-pmm-field" key={field.name}>
                      <label htmlFor={id}>{field.label}{field.required ? '' : ' (optional)'}</label>
                      {field.options ? (
                        <select id={id} value={values.details[field.name] ?? ''} onChange={(e) => setDetail(field.name, e.target.value)}>
                          {!field.required && <option value="">—</option>}
                          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          id={id}
                          type={inputType(field)}
                          inputMode={['routing', 'accountNumber', 'sortCode'].includes(field.kind) ? 'numeric' : undefined}
                          autoComplete="off"
                          spellCheck={false}
                          value={values.details[field.name] ?? ''}
                          placeholder={field.placeholder}
                          onChange={(e) => setDetail(field.name, e.target.value)}
                          aria-invalid={!!error}
                          aria-describedby={error ? `${id}-err` : undefined}
                        />
                      )}
                      {error && <p className="ngf-pmm-error" id={`${id}-err`}>{error}</p>}
                    </div>
                  );
                })}
                {errors._form && <p className="ngf-pmm-error">{errors._form}</p>}

                <div className="ngf-pmm-field">
                  <label htmlFor="pm-label">Display name (optional)</label>
                  <input
                    id="pm-label"
                    type="text"
                    maxLength={MAX_LABEL}
                    value={values.label}
                    placeholder={PAYMENT_METHODS[formType].label}
                    onChange={(e) => setValues({ ...values, label: e.target.value })}
                    aria-invalid={!!errors.label}
                  />
                  {errors.label && <p className="ngf-pmm-error">{errors.label}</p>}
                </div>
                <div className="ngf-pmm-field">
                  <label htmlFor="pm-instructions">Instructions for the customer (optional)</label>
                  <textarea
                    id="pm-instructions"
                    rows={3}
                    maxLength={MAX_INSTRUCTIONS}
                    value={values.instructions}
                    onChange={(e) => setValues({ ...values, instructions: e.target.value })}
                    aria-invalid={!!errors.instructions}
                  />
                  {errors.instructions && <p className="ngf-pmm-error">{errors.instructions}</p>}
                </div>
                <label className="ngf-pmm-check">
                  <input type="checkbox" checked={values.enabled} onChange={(e) => setValues({ ...values, enabled: e.target.checked })} />
                  <span>Enabled (can be ticked on payment requests)</span>
                </label>

                <div className="ngf-pmm-form-actions">
                  <button type="button" className="ngf-pmm-btn" onClick={closeEditor} disabled={saving}>Cancel</button>
                  <button type="submit" className="ngf-pmm-btn primary" disabled={saving}>
                    {saving && <Loader2 size={15} className="ngf-pmm-spin" aria-hidden="true" />}
                    <span>{editor.method ? 'Save changes' : 'Add method'}</span>
                  </button>
                </div>
              </div>

              <div className="ngf-pmm-preview">
                <span className="ngf-pmm-preview-label">Customer preview</span>
                {preview && <PaymentMethodCard view={preview} instructions={values.instructions.trim() || null} />}
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p className="ngf-pmm-empty">Loading payment methods…</p>
        ) : loadError ? (
          <p className="ngf-pmm-error">{loadError}</p>
        ) : methods.length === 0 ? (
          !editor && <p className="ngf-pmm-empty">No payment methods yet. Add the accounts customers can pay into.</p>
        ) : (
          <ul className="ngf-pmm-list">
            {methods.map((m, index) => {
              const busy = busyId === m.id;
              const typeLabel = isPaymentMethodType(m.type) ? PAYMENT_METHODS[m.type].label : m.type;
              return (
                <li key={m.id} className={`ngf-pmm-item${m.enabled ? '' : ' is-disabled'}`}>
                  <span className="ngf-pmm-item-icon"><PaymentIcon type={m.type} size={22} /></span>
                  <div className="ngf-pmm-item-text">
                    <strong>{nameOf(m)}</strong>
                    {m.label && <span className="ngf-pmm-item-type">{typeLabel}</span>}
                    <span className="ngf-pmm-item-summary">{summary(m)}</span>
                  </div>
                  <span className={`ngf-pmm-badge${m.enabled ? ' on' : ''}`}>{m.enabled ? 'Enabled' : 'Disabled'}</span>
                  <div className="ngf-pmm-item-actions">
                    <button type="button" className="ngf-pmm-icon-btn" onClick={() => isPaymentMethodType(m.type) && openForm(m.type, m)} disabled={busy || !!editor} aria-label={`Edit ${nameOf(m)}`}>
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className="ngf-pmm-icon-btn" onClick={() => run(m.id, () => api.updatePaymentMethod(m.id, { enabled: !m.enabled }), `${nameOf(m)} ${m.enabled ? 'disabled' : 'enabled'}.`)} disabled={busy} aria-label={`${m.enabled ? 'Disable' : 'Enable'} ${nameOf(m)}`} title={m.enabled ? 'Disable' : 'Enable'}>
                      <Power size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className="ngf-pmm-icon-btn" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${nameOf(m)} up`}>
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className="ngf-pmm-icon-btn" onClick={() => move(index, 1)} disabled={busy || index === methods.length - 1} aria-label={`Move ${nameOf(m)} down`}>
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className="ngf-pmm-icon-btn danger" onClick={() => remove(m)} disabled={busy} aria-label={`Delete ${nameOf(m)}`}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
