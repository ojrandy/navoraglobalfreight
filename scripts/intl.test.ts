// Tests for international forms: units (2.7), currency (2.7), countries/phones (2.6), address lookup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDimensions, formatDistance, formatWeight, lengthFromDisplay, lengthToDisplay,
  roundForDisplay, weightFromDisplay, weightToDisplay,
} from '../src/shared/units.ts';
import { formatMoney, fromDisplayAmount, resolveCurrency, toDisplayAmount } from '../src/shared/currency.ts';
import { findCountry, formatPhoneNumber, getCountry, isPlausiblePhone, searchCountries, shortRegion, COUNTRIES } from '../src/data/countries.ts';
import { resolveAddress } from '../src/services/geocodingService.ts';
import { parseTransportMode, TRANSPORT_MODE_LABELS } from '../src/shared/transportMode.ts';

test('units: kg/cm entry round-trips through the canonical lb/in values', () => {
  for (const kg of [0.5, 1, 6.5, 10, 23.4, 1000]) {
    const lbs = weightFromDisplay(kg, 'metric');
    assert.equal(roundForDisplay(weightToDisplay(lbs, 'metric'), 2), String(kg));
  }
  for (const cm of [1, 30, 45.5, 120]) {
    const inches = lengthFromDisplay(cm, 'metric');
    assert.equal(roundForDisplay(lengthToDisplay(inches, 'metric'), 2), String(cm));
  }
  assert.equal(weightFromDisplay(22, 'imperial'), 22); // lb in, lb stored
  assert.equal(weightFromDisplay(10, 'metric'), 22.046);
});

test('units: display formatting, including records stored before this change', () => {
  assert.equal(formatWeight(22.046, 'metric'), '10 kg');
  assert.equal(formatWeight(22.046, 'imperial'), '22 lb');
  assert.equal(formatWeight(1850, 'imperial'), '1,850 lb');
  assert.equal(formatWeight(undefined, 'metric'), '');
  assert.equal(formatDimensions({ length: 12, width: 12, height: 12 }, 'metric'), '30.5 × 30.5 × 30.5 cm');
  assert.equal(formatDimensions({ length: 12, width: 0, height: 6 }, 'imperial'), '12 × — × 6 in');
  assert.equal(formatDimensions({ length: 0, width: 0, height: 0 }, 'metric'), '');
  assert.equal(formatDistance(3115, 'metric'), '5,013 km');
  assert.equal(formatDistance(3115, 'imperial'), '3,115 miles');
});

test('currency: USD stored, shown in the admin currency only with a rate', () => {
  assert.deepEqual(resolveCurrency({}), { currency: 'USD', rate: 1, missingRate: false });
  assert.deepEqual(resolveCurrency({ displayCurrency: 'NGN' }), { currency: 'USD', rate: 1, missingRate: true });
  assert.deepEqual(resolveCurrency({ displayCurrency: 'NGN', exchangeRates: { NGN: 0 } }), { currency: 'USD', rate: 1, missingRate: true });
  assert.deepEqual(resolveCurrency({ displayCurrency: 'XYZ' }), { currency: 'USD', rate: 1, missingRate: false });
  const ngn = resolveCurrency({ displayCurrency: 'NGN', exchangeRates: { NGN: 1500 } });
  assert.equal(formatMoney(350, ngn), 'NGN 525,000.00'.replace('NGN ', '₦'));
  assert.equal(formatMoney(350, resolveCurrency({})), '$350.00');
  assert.equal(formatMoney(350, resolveCurrency({ displayCurrency: 'GBP', exchangeRates: { GBP: 0.8 } })), '£280.00');
  assert.equal(formatMoney(350, resolveCurrency({ displayCurrency: 'EUR', exchangeRates: { EUR: 0.9 } })), '€315.00');
  // Admin enters ₦525,000 -> stored as $350
  assert.equal(fromDisplayAmount(525000, ngn), 350);
  assert.equal(toDisplayAmount(350, ngn), 525000);
});

test('countries: searchable list with calling codes', () => {
  assert.ok(COUNTRIES.length > 240);
  assert.equal(getCountry('ng')?.dialCode, '+234');
  assert.equal(findCountry('Nigeria')?.code, 'NG');
  assert.equal(findCountry('UK')?.code, 'GB');
  assert.equal(findCountry('usa')?.code, 'US');
  assert.equal(findCountry('Cote d’Ivoire')?.code, 'CI');
  assert.equal(searchCountries('nig')[0].code, 'NE'); // Niger, then Nigeria
  assert.ok(searchCountries('nig').slice(0, 2).some((c) => c.code === 'NG'));
  assert.equal(searchCountries('uk')[0].code, 'GB');
  assert.equal(searchCountries('+44')[0].code, 'GB');
});

test('phones: stored with calling code; soft plausibility check', () => {
  assert.equal(formatPhoneNumber('NG', '0803 123 4567'), '+234 803 123 4567');
  assert.equal(formatPhoneNumber('GB', '020 7946 0958'), '+44 20 7946 0958');
  assert.equal(formatPhoneNumber('US', '+1 212 555 0148'), '+1 212 555 0148');
  assert.equal(formatPhoneNumber('NG', ''), '');
  assert.equal(isPlausiblePhone('NG', '0803 123 4567'), true);
  assert.equal(isPlausiblePhone('NG', '12'), false);
  assert.equal(isPlausiblePhone('NG', ''), true);
});

test('address: short region convention, country-aware lookup', () => {
  assert.equal(shortRegion('US', 'tx'), 'TX');
  assert.equal(shortRegion('NG', 'Lagos State'), 'NG');
  assert.equal(resolveAddress({ city: 'Houston', region: 'TX', countryCode: 'US' })?.timezone, 'America/Chicago');
  assert.equal(resolveAddress({ city: 'Lagos', countryCode: 'NG' })?.isExactCoordinate, true);
  // A non-gateway town in a gateway country: that country's gateway, flagged as a guess.
  const ibadan = resolveAddress({ city: 'Ibadan', region: 'Oyo', countryCode: 'NG' });
  assert.equal(ibadan?.city, 'Ibadan');
  assert.equal(ibadan?.isExactCoordinate, false);
  // "CA" is Canada here, never California.
  const montreal = resolveAddress({ city: 'Montreal', region: 'QC', countryCode: 'CA' });
  assert.equal(montreal?.countryCode, 'CA');
  assert.equal(resolveAddress({ city: 'Toronto', countryCode: 'CA' })?.timezone, 'America/Toronto');
  // No gateway in that country: nothing offline (the live geocoder is asked instead).
  assert.equal(resolveAddress({ city: 'Lyon', countryCode: 'FR' }), null);
});

test('mode labels', () => {
  assert.equal(TRANSPORT_MODE_LABELS.Air, 'Air Freight');
  assert.equal(TRANSPORT_MODE_LABELS.Sea, 'Ocean Freight');
  assert.equal(parseTransportMode('Ocean Freight'), 'Sea');
  assert.equal(parseTransportMode('Air Freight'), 'Air');
});
