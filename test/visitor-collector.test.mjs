import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCities, combineCities } from '../assets/visitor-map.mjs';

const city = { location: 'London, England, United Kingdom', country: 'GB', latitude: 51.5, longitude: -0.1 };

test('only accepts valid city coordinates and returns display fields', () => {
  const cities = normalizeCities({ version: 1, cities: [{ ...city, firstSavedOn: '2026-11-08', token: 'unused' },
    { ...city, latitude: 91 }, { ...city, country: '' }, null] });
  assert.deepEqual(cities, [city]);
  assert.throws(() => normalizeCities({ version: 2, cities: [] }), /Unexpected/);
  assert.throws(() => normalizeCities({ version: 1, cities: 'invalid' }), /Unexpected/);
});

test('keeps historical locations through empty results and deduplicates live cities', () => {
  const historical = { ...city, location: 'Los Angeles, California, United States', country: 'US', latitude: 34.1, longitude: -118.3 };
  assert.deepEqual(combineCities([historical], []), [historical]);
  assert.deepEqual(combineCities([historical], [city, city]), [historical, city]);
  assert.deepEqual(combineCities([city], [{ ...city, location: city.location.toUpperCase() }]), [city]);
});
