// Tests for proof-of-payment form validation (docs/update.md F.2, F.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROOF_LIMITS, validateProofSubmission } from '../src/shared/paymentProof.ts';

const ids = ['acc-paypal', 'acc-btc'];

test('proof: valid input is normalised', () => {
  const res = validateProofSubmission({ methodId: 'acc-btc', payerName: '  Ada   Lovelace ', amountSent: '120.005', reference: ' tx123 ' }, ids);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.deepEqual(res.value, { methodId: 'acc-btc', payerName: 'Ada Lovelace', amountSent: 120.01, reference: 'tx123' });
});

test('proof: reference is optional', () => {
  const res = validateProofSubmission({ methodId: 'acc-paypal', payerName: 'Ada', amountSent: 5, reference: '   ' }, ids);
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.value.reference, null);
});

test('proof: only this shipment\'s accounts are accepted', () => {
  const res = validateProofSubmission({ methodId: 'someone-elses-account', payerName: 'Ada', amountSent: 5 }, ids);
  assert.ok(!res.ok);
  if (!res.ok) assert.equal(res.errors.methodId, 'Choose the account you paid to.');
});

test('proof: required fields and limits', () => {
  const res = validateProofSubmission({ payerName: ' ', amountSent: '', reference: 'x'.repeat(PROOF_LIMITS.referenceMax + 1) }, ids);
  assert.ok(!res.ok);
  if (res.ok) return;
  assert.equal(res.errors.methodId, 'Choose the account you paid to.');
  assert.equal(res.errors.payerName, 'Enter the name the payment was sent from.');
  assert.equal(res.errors.amountSent, 'Enter the amount you sent.');
  assert.ok(res.errors.reference);
  for (const bad of [0, -1, 'abc', Infinity]) {
    const r = validateProofSubmission({ methodId: 'acc-btc', payerName: 'Ada', amountSent: bad }, ids);
    assert.ok(!r.ok && r.errors.amountSent, `amount ${bad}`);
  }
});

test('proof: non-object input is rejected, not thrown', () => {
  assert.ok(!validateProofSubmission(null, ids).ok);
  assert.ok(!validateProofSubmission('x', ids).ok);
});
