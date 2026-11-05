import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLocations, projectLocation } from '../assets/visitor-map.mjs';

// Synthetic examples of the observed MapMyVisitors callback format.
const record = (id, lat, lon, label, visits, country = 'GB') => `
  _map.mapObject.addMarker('${id}', { latLng: [${lat}, ${lon}], style: {} });
  _map.addRealtimeVisitors(${id}, ${JSON.stringify(label)}, "gb", "2026-11-05 00:00:00", "${visits}", "${country}");
`;

test('aggregates city visits, deduplicates records and exposes only display fields', () => {
  const first = record(101, 51.5074, -0.1278, 'London, United Kingdom', 3);
  const data = parseLocations(first + first + record(102, 51.5074, -0.1278, 'London, United Kingdom', 2));
  assert.deepEqual(data, [{ location: 'London, United Kingdom', country: 'GB',
    latitude: 51.5, longitude: -0.1, visits: 5 }]);
  assert.deepEqual(Object.keys(data[0]).sort(), ['country', 'latitude', 'location', 'longitude', 'visits']);
});

test('rejects invalid coordinates, counts and IP-address labels', () => {
  const data = record(101, 95, 0, 'Invalid latitude', 1) +
    record(102, 0, -181, 'Invalid longitude', 1) +
    record(103, 51, 0, 'London', -1) +
    record(104, 51, 0, '127.0.0.1', 4) +
    record(105, 51, 0, 'London', 1);
  assert.equal(parseLocations(data).length, 1);
  assert.equal(parseLocations(data)[0].visits, 1);
});

test('does not execute returned JavaScript and fails closed on a changed schema', () => {
  delete globalThis.__visitorPayloadExecuted;
  const data = parseLocations('globalThis.__visitorPayloadExecuted = true;' +
    record(101, 51, 0, '<img src=x onerror=alert(1)>', 1));
  assert.equal(globalThis.__visitorPayloadExecuted, undefined);
  assert.equal(data[0].location, '<img src=x onerror=alert(1)>');
  assert.throws(() => parseLocations("_map.mapObject.addMarker('1', { latLng: [51, 0] });"), /format changed/);
  assert.throws(() => parseLocations({}), /Unexpected/);
  assert.deepEqual(parseLocations(''), []);
});

test('uses the same Equal Earth projection as the generated basemap', async () => {
  const projection = JSON.parse(await readFile(new URL('../assets/visitor-map-projection.json', import.meta.url)));
  const cases = [
    [0, 0, 180, 90],
    [-118.3, 34.1, 72.74464451157083, 46.009036537556085],
    [114.2, 22.3, 288.874144186597, 60.686775596191005],
    [0, 90, 180, 3.364378381042016],
    [180, 0, 358, 90]
  ];
  for (const [lon, lat, expectedX, expectedY] of cases) {
    const [x, y] = projectLocation(lon, lat, projection);
    assert.ok(Math.abs(x - expectedX) < 1e-8);
    assert.ok(Math.abs(y - expectedY) < 1e-8);
  }
});
