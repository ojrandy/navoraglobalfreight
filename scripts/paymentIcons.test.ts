// Payment icons (docs/update.md C.2): every brand icon a method uses exists, and the generated
// path module matches the SVG files (re-run scripts/payment-icons.mjs after changing them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { PAYMENT_ICON_PATHS } from '../src/assets/payment-icons/index.ts';
import { PAYMENT_METHOD_TYPES, PAYMENT_METHODS } from '../src/shared/paymentMethods.ts';

const dir = path.join(process.cwd(), 'src', 'assets', 'payment-icons');
const LUCIDE_FALLBACKS = ['landmark', 'globe', 'credit-card'];

test('payment icons: each method has a bundled icon or a lucide fallback', () => {
  for (const t of PAYMENT_METHOD_TYPES) {
    const key = PAYMENT_METHODS[t].iconKey;
    assert.ok(PAYMENT_ICON_PATHS[key] || LUCIDE_FALLBACKS.includes(key), `${t} -> ${key}`);
  }
});

test('payment icons: generated module matches the SVG files', () => {
  const svgs = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
  assert.deepEqual(Object.keys(PAYMENT_ICON_PATHS).sort(), svgs.map((f) => f.replace(/\.svg$/, '')));
  for (const file of svgs) {
    const d = /<path d="([^"]+)"/.exec(fs.readFileSync(path.join(dir, file), 'utf8'))?.[1];
    assert.equal(PAYMENT_ICON_PATHS[file.replace(/\.svg$/, '')], d, file);
  }
});
