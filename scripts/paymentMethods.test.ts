// Tests for the payment method registry and validators (docs/update.md C.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCashtag, validateCryptoAddress, validateEmail, validateHandle, validateHttpsUrl, validateIban,
  validatePhone, validateRoutingNumber, validateSortCode, validateSwift,
} from '../src/shared/paymentValidation.ts';
import { PAYMENT_METHOD_TYPES, PAYMENT_METHODS, customerMethodView, isPaymentMethodType, validatePaymentDetails } from '../src/shared/paymentMethods.ts';

const value = (r: { ok: boolean; value?: string }) => (r.ok ? r.value : null);

test('IBAN: mod-97 check, spaces and case normalised', () => {
  assert.equal(value(validateIban('gb82 west 1234 5698 7654 32')), 'GB82WEST12345698765432');
  assert.equal(value(validateIban('DE89 3704 0044 0532 0130 00')), 'DE89370400440532013000');
  assert.equal(validateIban('GB82WEST12345698765433').ok, false); // one digit changed
  assert.equal(validateIban('GB82').ok, false);
});

test('UK sort code and US routing number', () => {
  assert.equal(value(validateSortCode('123456')), '12-34-56');
  assert.equal(value(validateSortCode('12 34 56')), '12-34-56');
  assert.equal(validateSortCode('12-34-5').ok, false);
  assert.equal(value(validateRoutingNumber('021000021')), '021000021');
  assert.equal(value(validateRoutingNumber('011000015')), '011000015');
  assert.equal(validateRoutingNumber('123456789').ok, false); // checksum
  assert.equal(validateRoutingNumber('02100002').ok, false);
});

test('email, https link, phone, SWIFT, cashtag, handle', () => {
  assert.equal(validateEmail('pay@example.com').ok, true);
  assert.equal(validateEmail('pay@example').ok, false);
  assert.equal(validateHttpsUrl('https://paypal.me/navora').ok, true);
  assert.equal(validateHttpsUrl('http://paypal.me/navora').ok, false);
  assert.equal(validateHttpsUrl('javascript:alert(1)').ok, false);
  assert.equal(value(validatePhone('+1 (555) 010-0000')), '+15550100000');
  assert.equal(validatePhone('12345').ok, false);
  assert.equal(value(validateSwift('nwbk gb 2l')), 'NWBKGB2L');
  assert.equal(validateSwift('NWBKGB2LXX').ok, false);
  assert.equal(value(validateCashtag('NavoraPay')), '$NavoraPay');
  assert.equal(validateCashtag('$123').ok, false);
  assert.equal(value(validateHandle('navora-pay')), '@navora-pay');
  assert.equal(validateHandle('@a b').ok, false);
});

test('crypto addresses: format per coin and network', () => {
  assert.equal(validateCryptoAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'BTC', 'Bitcoin').ok, true);
  assert.equal(validateCryptoAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'BTC', 'Bitcoin').ok, true);
  assert.equal(validateCryptoAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'BTC', 'Bitcoin').ok, false);
  assert.equal(validateCryptoAddress('pay@walletofsatoshi.com', 'BTC', 'Lightning').ok, true);
  assert.equal(validateCryptoAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'ETH', 'Ethereum (mainnet)').ok, true);
  assert.equal(validateCryptoAddress('0x5290840009852788', 'ETH').ok, false);
  assert.equal(validateCryptoAddress('TJRabPrwbZy45sbavfcjinPJC18kjpRTv8', 'USDT', 'TRC20 (Tron)').ok, true);
  assert.equal(validateCryptoAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'USDT', 'TRC20 (Tron)').ok, false);
  assert.equal(validateCryptoAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'USDT', 'BEP20 (BNB Smart Chain)').ok, true);
});

test('registry: 17 types, no gift cards, every type has fields and a label', () => {
  assert.equal(PAYMENT_METHOD_TYPES.length, 17);
  assert.equal(PAYMENT_METHOD_TYPES.some((t) => /gift/i.test(t)), false);
  for (const t of PAYMENT_METHOD_TYPES) {
    assert.equal(PAYMENT_METHODS[t].type, t);
    assert.ok(PAYMENT_METHODS[t].fields.length > 0 && PAYMENT_METHODS[t].label);
  }
  assert.equal(isPaymentMethodType('paypal'), true);
  assert.equal(isPaymentMethodType('giftcard'), false);
  assert.equal(isPaymentMethodType('__proto__'), false);
});

test('validatePaymentDetails: required, either/or, normalising, unknown keys dropped', () => {
  const uk = validatePaymentDetails('uk_bank', { accountName: ' Navora  Ltd ', bankName: 'Example Bank', sortCode: '123456', accountNumber: '1234 5678', evil: '<script>' });
  assert.ok(uk.ok);
  if (uk.ok) assert.deepEqual(uk.details, { accountName: 'Navora Ltd', bankName: 'Example Bank', sortCode: '12-34-56', accountNumber: '12345678' });

  const missing = validatePaymentDetails('uk_bank', { accountName: 'X' });
  assert.ok(!missing.ok && missing.errors.sortCode && missing.errors.bankName);

  const zelle = validatePaymentDetails('zelle', { accountName: 'Navora' });
  assert.ok(!zelle.ok && /email or Zelle phone/.test(zelle.errors._form));
  assert.ok(validatePaymentDetails('zelle', { accountName: 'Navora', phone: '+1 555 010 0000' }).ok);

  const paypalWrongHost = validatePaymentDetails('paypal', { link: 'https://evil.example/paypal.me' });
  assert.ok(!paypalWrongHost.ok && paypalWrongHost.errors.link);

  // Network defaults to the first option; the address is checked against it.
  const usdt = validatePaymentDetails('usdt', { address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' });
  assert.ok(usdt.ok && usdt.details.network === 'TRC20 (Tron)');
  const badNet = validatePaymentDetails('usdt', { network: 'Dogecoin', address: 'x' });
  assert.ok(!badNet.ok && badNet.errors.network);

  const wire = validatePaymentDetails('intl_wire', { beneficiary: 'Navora', bankName: 'B', swift: 'NWBKGB2L', country: 'United Kingdom', iban: 'GB82WEST12345698765433' });
  assert.ok(!wire.ok && wire.errors.iban);
});

test('customerMethodView: link, QR, warning and note per type', () => {
  const cash = customerMethodView('cashapp', { cashtag: '$NavoraPay', accountName: 'Navora' });
  assert.deepEqual(cash.link, { label: 'Open Cash App', url: 'https://cash.app/$NavoraPay' });
  const usdt = customerMethodView('usdt', { network: 'TRC20 (Tron)', address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' }, 'USDT (main wallet)');
  assert.equal(usdt.label, 'USDT (main wallet)');
  assert.equal(usdt.qr, 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8');
  assert.match(usdt.warning!, /TRC20 \(Tron\) network/);
  const card = customerMethodView('card_link', { url: 'https://checkout.stripe.com/c/pay/abc', provider: 'Stripe' });
  assert.deepEqual(card.fields, []); // the link is a button, not a copy field
  assert.equal(card.link?.label, 'Pay by card');
  assert.match(customerMethodView('western_union', { receiverName: 'A', country: 'B', city: 'C' }).note!, /MTCN/);
});
