import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCallback, mergeHistory } from '../scripts/sync-visitor-history.mjs';

const city = { location: 'London, United Kingdom', country: 'GB',
  latitude: 51.5, longitude: -0.1, visits: 5 };

test('keeps cities permanently when they disappear from the recent feed', () => {
  const first = mergeHistory(null, [city], new Date('2026-11-05T12:00:00Z'));
  const later = mergeHistory(first, [], new Date('2026-12-05T12:00:00Z'));
  assert.equal(later, first);
  assert.equal(later.cities.length, 1);
});

test('does not inflate counts or change the archive on repeated snapshots', () => {
  const first = mergeHistory(null, [city, city]);
  assert.equal(first.cities.length, 1);
  assert.equal(mergeHistory(first, [{ ...city, visits: 20 }]), first);
  assert.equal('visits' in first.cities[0], false);
  assert.deepEqual(Object.keys(first.cities[0]).sort(),
    ['country', 'firstSavedOn', 'latitude', 'location', 'longitude']);
});

test('adds new cities without removing or rewriting old locations', () => {
  const first = mergeHistory(null, [city], new Date('2026-11-05T12:00:00Z'));
  const second = mergeHistory(first, [{ ...city, location: 'Hong Kong', country: 'HK',
    latitude: 22.3, longitude: 114.2 }], new Date('2026-11-06T12:00:00Z'));
  assert.equal(second.cities.length, 2);
  assert.equal(second.startedOn, '2026-11-05');
  assert.equal(second.cities.find(c => c.country === 'GB').firstSavedOn, '2026-11-05');
  assert.equal(second.cities.find(c => c.country === 'HK').firstSavedOn, '2026-11-06');
  assert.throws(() => mergeHistory({ version: 2, cities: [] }, []), /refusing to overwrite/);
});

test('decodes only the expected JSONP string without executing its contents', () => {
  const payload = 'globalThis.__archiveExecuted = true;';
  assert.equal(decodeCallback('visitorArchive(' + JSON.stringify(payload) + ');'), payload);
  assert.equal(globalThis.__archiveExecuted, undefined);
  assert.throws(() => decodeCallback('visitorArchive(alert(1));'));
  assert.throws(() => decodeCallback('anotherCallback("data");'));
});
