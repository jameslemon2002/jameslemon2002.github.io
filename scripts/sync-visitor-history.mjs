import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseLocations } from '../assets/visitor-map.mjs';

const archiveUrl = new URL('../assets/visitor-history.json', import.meta.url);
const site = 'https://jameslemon2002.github.io/';

export function decodeCallback(source) {
  const match = source.match(/^\s*visitorArchive\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error('Unexpected visitor callback');
  const payload = JSON.parse(match[1]);
  if (typeof payload !== 'string') throw new Error('Unexpected visitor payload');
  return payload;
}

// Persist city presence, not overlapping recent visit totals. Adding those
// totals across hourly snapshots would count the same visits repeatedly.
export function mergeHistory(previous, locations, now = new Date()) {
  if (previous && (previous.version !== 1 || !Array.isArray(previous.cities))) {
    throw new Error('Invalid existing history; refusing to overwrite it');
  }
  const day = now.toISOString().slice(0, 10);
  const cities = new Map((previous?.cities || []).map(city => [
    city.location.toLowerCase() + '|' + city.country, city
  ]));
  let changed = !previous;
  for (const city of locations) {
    const key = city.location.toLowerCase() + '|' + city.country;
    if (cities.has(key)) continue;
    cities.set(key, {
      location: city.location, country: city.country,
      latitude: city.latitude, longitude: city.longitude, firstSavedOn: day
    });
    changed = true;
  }
  if (!changed) return previous;
  return {
    version: 1, startedOn: previous?.startedOn || day, updatedAt: now.toISOString(),
    cities: [...cities.values()].sort((a, b) => a.location.localeCompare(b.location, 'en'))
  };
}

async function fetchLocations() {
  const url = new URL('https://mapmyvisitors.com/ajax/map');
  url.search = new URLSearchParams({
    last_hit_id: '0', initial_hit_id: '0', initial: 'true', animate: 'false',
    user: '0', url: JSON.stringify(site), id: '2246776', mapType: 'widget', callback: 'visitorArchive'
  });
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Visitor service HTTP ' + response.status);
      const source = await response.text();
      if (source.length > 1200000) throw new Error('Visitor response too large');
      return parseLocations(decodeCallback(source));
    } catch (error) {
      failure = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw failure;
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile(archiveUrl, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const locations = await fetchLocations();
  const archive = mergeHistory(previous, locations);
  if (archive !== previous) {
    await writeFile(archiveUrl, JSON.stringify(archive, null, 2) + '\n');
  }
  console.log(JSON.stringify({ observedCities: locations.length, savedCities: archive.cities.length,
    changed: archive !== previous, archive: fileURLToPath(archiveUrl) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
