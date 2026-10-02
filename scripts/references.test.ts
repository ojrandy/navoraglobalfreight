// Tests for reference numbers (BRAND_GUIDE §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReference, referenceFor, REFERENCE_PATTERN } from '../src/shared/references.ts';

test('generateReference: NGF-SL/TKT/INV + 6 digits', () => {
  for (const [kind, prefix] of [['seal', 'NGF-SL-'], ['ticket', 'NGF-TKT-'], ['invoice', 'NGF-INV-']] as const) {
    for (let i = 0; i < 500; i++) {
      const ref = generateReference(kind);
      assert.ok(ref.startsWith(prefix), ref);
      assert.match(ref, REFERENCE_PATTERN);
    }
  }
});

test('referenceFor is stable per seed and well-formed', () => {
  assert.equal(referenceFor('invoice', 'INV-2026-48213'), referenceFor('invoice', 'INV-2026-48213'));
  assert.notEqual(referenceFor('invoice', 'INV-2026-48213'), referenceFor('invoice', 'INV-2026-48214'));
  assert.match(referenceFor('invoice', 'x'), /^NGF-INV-\d{6}$/);
});
