// Tests for the per-shipment payment request (docs/update.md D.1, D.4, D-9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPaymentAmount, publicPaymentView, validatePaymentRequest, type ShipmentPayment } from '../src/shared/paymentRequest.ts';

let n = 0;
const newId = () => `gen-${++n}`;
const paypal = { type: 'paypal', details: { email: 'payments@example.com' } };
const btc = { type: 'bitcoin', label: 'BTC wallet', details: { network: 'Bitcoin', address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }, instructions: 'Send the exact amount.' };

test('payment request: valid input is normalised', () => {
  const res = validatePaymentRequest({ amount: '120.005', chargeReason: '  Customs   duty – Invoice NGF-INV-104233 ', dueDate: '2026-11-01', methods: [paypal, { ...btc, id: 'keep-me' }] }, newId);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.value.amount, 120.01);
  assert.equal(res.value.currency, 'USD'); // default (D-6)
  assert.equal(res.value.chargeReason, 'Customs duty – Invoice NGF-INV-104233');
  assert.equal(res.value.methods.length, 2);
  assert.match(res.value.methods[0].id, /^gen-/);
  assert.equal(res.value.methods[1].id, 'keep-me'); // ids stay stable across edits
  assert.equal(res.value.methods[1].label, 'BTC wallet');
  assert.equal(res.value.invoiceDocumentId, null);
});

test('payment request: required fields, currency, dates and accounts', () => {
  const res = validatePaymentRequest({ amount: 0, currency: 'GBP', chargeReason: 'x', dueDate: '2026-02-30', methods: [] }, newId);
  assert.ok(!res.ok);
  if (res.ok) return;
  assert.ok(res.errors.amount && res.errors.currency && res.errors.chargeReason && res.errors.dueDate && res.errors.methods);

  const badAccount = validatePaymentRequest({ amount: 10, chargeReason: 'Duty', methods: [{ type: 'uk_bank', details: { sortCode: '1' } }, { type: 'giftcard', details: {} }] }, newId);
  assert.ok(!badAccount.ok && badAccount.errors['methods.0.sortCode'] && badAccount.errors['methods.0.accountName'] && badAccount.errors['methods.1.type']);

  const tooMany = validatePaymentRequest({ amount: 10, chargeReason: 'Duty', methods: Array(11).fill(paypal) }, newId);
  assert.ok(!tooMany.ok && /up to 10/.test(tooMany.errors.methods));
});

test('payment request: duplicate or malformed account ids are replaced', () => {
  const res = validatePaymentRequest({ amount: 5, chargeReason: 'Duty', methods: [{ ...paypal, id: 'same' }, { ...paypal, id: 'same' }, { ...paypal, id: '../x' }] }, newId);
  assert.ok(res.ok);
  if (!res.ok) return;
  const ids = res.value.methods.map((m) => m.id);
  assert.equal(ids[0], 'same');
  assert.equal(new Set(ids).size, 3);
  assert.ok(!ids.includes('../x'));
});

test('public view: only this request’s accounts, no internal fields', () => {
  const stored: ShipmentPayment = {
    id: 'p1', trackingNumber: 'NGF7K2M9', amount: 120, currency: 'USD', chargeReason: 'Customs duty', dueDate: null,
    invoiceDocumentId: 'INV-2026-00321', customerNote: 'Pay within 48 hours.', status: 'AWAITING_PAYMENT',
    createdAt: 't', updatedAt: 't', paidAt: null,
    methods: [
      { id: 'a1', type: 'paypal', label: null, details: { email: 'payments@example.com', link: 'https://paypal.me/navora' }, instructions: null },
      { id: 'a2', type: 'bitcoin', label: 'BTC wallet', details: { network: 'Bitcoin', address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }, instructions: 'Send the exact amount.' },
      { id: 'a3', type: 'giftcard' as any, label: null, details: {}, instructions: null }, // unknown type never shown
    ],
  };
  const view = publicPaymentView(stored);
  assert.deepEqual(Object.keys(view).sort(), ['amount', 'chargeReason', 'currency', 'customerNote', 'dueDate', 'methods', 'paidAt', 'proof', 'status']);
  assert.equal(view.proof, null);
  assert.deepEqual(view.methods.map((m) => m.id), ['a1', 'a2']);
  assert.equal(view.methods[0].link?.label, 'Open PayPal');
  assert.equal(view.methods[1].label, 'BTC wallet');
  assert.equal(view.methods[1].instructions, 'Send the exact amount.');
  assert.ok(!JSON.stringify(view).includes('INV-2026-00321'));

  // The latest proof is passed through as given (F.4); the server builds it without file or payer details.
  const proof = { status: 'REJECTED' as const, submittedAt: '2026-10-10T10:00:00.000Z', rejectionReason: 'Amount does not match.' };
  assert.deepEqual(publicPaymentView(stored, proof).proof, proof);
});

test('formatPaymentAmount', () => {
  assert.equal(formatPaymentAmount(120, 'USD', 'en-US'), '$120.00');
  assert.equal(formatPaymentAmount(1234.5, 'USD', 'en-US'), '$1,234.50');
});
