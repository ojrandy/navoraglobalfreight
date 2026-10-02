// Tests for IANA time zone handling of tracking events (tracker 2.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventTimeDisplay, formatEventTimestamp, timeZoneForPlace, timeZoneForLocationLabel,
  utcOffsetLabel, zonedTimeToUtc,
} from '../src/shared/timeZones.ts';

const SEP_28_2026_1400_UTC = Date.UTC(2026, 8, 28, 14, 0);

test('utcOffsetLabel: whole, negative, half-hour and zero offsets', () => {
  assert.equal(utcOffsetLabel('Africa/Lagos', SEP_28_2026_1400_UTC), 'UTC+1');
  assert.equal(utcOffsetLabel('America/New_York', SEP_28_2026_1400_UTC), 'UTC-4'); // EDT
  assert.equal(utcOffsetLabel('America/New_York', Date.UTC(2026, 0, 15)), 'UTC-5'); // EST
  assert.equal(utcOffsetLabel('Asia/Kolkata', SEP_28_2026_1400_UTC), 'UTC+5:30');
  assert.equal(utcOffsetLabel('Europe/London', Date.UTC(2026, 0, 15)), 'UTC');
});

test('formatEventTimestamp: local time where the event happened, plus offset', () => {
  assert.equal(formatEventTimestamp(SEP_28_2026_1400_UTC, 'Africa/Lagos'), 'Sep 28, 2026 · 3:00 PM UTC+1');
  assert.equal(formatEventTimestamp(SEP_28_2026_1400_UTC, 'America/Chicago'), 'Sep 28, 2026 · 9:00 AM UTC-5');
});

test('zonedTimeToUtc: wall-clock time in a zone back to the instant', () => {
  assert.equal(zonedTimeToUtc('2026-09-28', '3:00 PM', 'Africa/Lagos'), SEP_28_2026_1400_UTC);
  assert.equal(zonedTimeToUtc('2026-09-28', '09:00 AM', 'America/Chicago'), SEP_28_2026_1400_UTC);
  assert.equal(zonedTimeToUtc('2026-09-28', '19:30', 'Asia/Kolkata'), SEP_28_2026_1400_UTC);
  assert.equal(zonedTimeToUtc('bad', '3:00 PM', 'UTC'), null);
});

test('timeZoneForPlace: gateways, U.S. states, ISO/state clashes, coordinates', () => {
  assert.equal(timeZoneForPlace({ city: 'Lagos', state: 'NG' }), 'Africa/Lagos');
  assert.equal(timeZoneForPlace({ city: 'São Paulo' }), 'America/Sao_Paulo');
  assert.equal(timeZoneForPlace({ city: 'Sao Paulo', state: 'BR' }), 'America/Sao_Paulo');
  assert.equal(timeZoneForPlace({ city: 'Houston', state: 'TX' }), 'America/Chicago');
  assert.equal(timeZoneForPlace({ city: 'Denver', state: 'CO' }), 'America/Denver');
  // "CA" is California for Los Angeles but Canada for Toronto.
  assert.equal(timeZoneForPlace({ city: 'Los Angeles', state: 'CA' }), 'America/Los_Angeles');
  assert.equal(timeZoneForPlace({ city: 'Toronto', state: 'CA' }), 'America/Toronto');
  assert.equal(timeZoneForPlace({ city: 'Sacramento', state: 'CA' }), 'America/Los_Angeles');
  // A non-gateway city in a gateway country.
  assert.equal(timeZoneForPlace({ city: 'Abuja', state: 'NG' }), 'Africa/Lagos');
  assert.equal(timeZoneForPlace({ city: 'Mombasa', country: 'Kenya' }), 'Africa/Nairobi');
  // Nearest gateway by coordinates, then a longitude-based Etc zone far from any gateway.
  assert.equal(timeZoneForPlace({ lat: 51.2, lng: 6.8 }), 'Europe/Berlin'); // Düsseldorf -> nearest is FRA
  assert.equal(timeZoneForPlace({ lat: -20, lng: -130 }), 'Etc/GMT+9');
  assert.equal(timeZoneForLocationLabel('Rotterdam, NL'), 'Europe/Amsterdam');
});

test('eventTimeDisplay: new events format from instant + zone', () => {
  const d = eventTimeDisplay('ignored', SEP_28_2026_1400_UTC, 'Europe/London');
  assert.deepEqual(d, { displayDate: 'Sep 28, 2026', displayTime: '3:00 PM UTC+1', timezone: 'Europe/London', utcOffset: 'UTC+1' });
});

test('eventTimeDisplay: legacy ET/CT/MT/PT rows still display, with the offset for their date', () => {
  const summer = eventTimeDisplay('August 20, 2026 · 4:35 PM CT');
  assert.equal(summer.displayDate, 'August 20, 2026');
  assert.equal(summer.displayTime, '4:35 PM UTC-5');
  assert.equal(summer.timezone, 'America/Chicago');

  const winter = eventTimeDisplay('January 10, 2026 · 9:00 AM ET');
  assert.equal(winter.displayTime, '9:00 AM UTC-5');
  assert.equal(eventTimeDisplay('Aug 19 · 9:00 AM PT').displayTime, '9:00 AM UTC-7');
});

test('eventTimeDisplay: rows with no zone and odd strings are left as stored', () => {
  assert.deepEqual(eventTimeDisplay('Aug 19, 2026 04:35 PM'), { displayDate: 'Aug 19, 2026', displayTime: '04:35 PM' });
  assert.deepEqual(eventTimeDisplay('Sep 28, 2026 · 3:00 PM UTC+1'), { displayDate: 'Sep 28, 2026', displayTime: '3:00 PM UTC+1', utcOffset: 'UTC+1' });
  assert.deepEqual(eventTimeDisplay('Pending'), { displayDate: 'Pending', displayTime: '', timezone: undefined });
  assert.deepEqual(eventTimeDisplay(''), { displayDate: '', displayTime: '' });
});
