const SITE_HOST = 'jameslemon2002.github.io';
const MAP_WIDTH = 360;
const MAP_HEIGHT = 180;

// Read only literal coordinates and metadata from the provider's JavaScript
// response. Never evaluate the returned payload or retain visitor identifiers.
export function parseLocations(source) {
  if (typeof source !== 'string' || source.length > 1000000) {
    throw new Error('Unexpected visitor data');
  }
  const positions = new Map();
  const coordinates = /_map\.mapObject\.addMarker\(\s*['"](\d+)['"]\s*,\s*\{\s*latLng\s*:\s*\[\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\]/g;
  for (const match of source.matchAll(coordinates)) {
    const latitude = Number(match[2]);
    const longitude = Number(match[3]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      positions.set(match[1], { latitude, longitude });
    }
  }
  const visitors = new Map();
  let metadataRecords = 0;
  for (const match of source.matchAll(/_map\.addRealtimeVisitors\(([\s\S]*?)\)\s*;/g)) {
    let fields;
    try { fields = JSON.parse('[' + match[1] + ']'); } catch { continue; }
    metadataRecords += 1;
    const [identifier, place, , , rawVisits, country] = fields;
    const position = positions.get(String(identifier));
    const visits = Number(rawVisits);
    if (!position || typeof place !== 'string' || place.length > 180 ||
        typeof country !== 'string' || !/^[A-Z]{2}$/.test(country) ||
        !Number.isSafeInteger(visits) || visits < 1 || visits > 100000000 ||
        /\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(place)) continue;
    visitors.set(String(identifier), {
      location: place.trim().replace(/\s+/g, ' '),
      country,
      latitude: Math.round(position.latitude * 10) / 10,
      longitude: Math.round(position.longitude * 10) / 10,
      visits
    });
  }
  if (positions.size && !metadataRecords) throw new Error('Visitor data format changed');
  const cities = new Map();
  for (const visitor of visitors.values()) {
    const key = [visitor.location.toLowerCase(), visitor.country,
      visitor.latitude, visitor.longitude].join('|');
    if (cities.has(key)) cities.get(key).visits += visitor.visits;
    else cities.set(key, { ...visitor });
  }
  return [...cities.values()].sort((a, b) => b.visits - a.visits);
}

// Equal Earth forward projection, adapted from d3-geo 3.1.1 (ISC license).
// The basemap was generated with the same projection and fit parameters.
export function projectLocation(longitude, latitude, projection) {
  const lambda = longitude * Math.PI / 180;
  const phi = latitude * Math.PI / 180;
  const m = Math.sqrt(3) / 2;
  const l = Math.asin(m * Math.sin(phi));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  const x = lambda * Math.cos(l) /
    (m * (1.340264 - 3 * 0.081106 * l2 + l6 * (7 * 0.000893 + 9 * 0.003796 * l2)));
  const y = l * (1.340264 - 0.081106 * l2 + l6 * (0.000893 + 0.003796 * l2));
  return [projection.translate[0] + projection.scale * x,
    projection.translate[1] - projection.scale * y];
}

function renderCities(section, cities, projection) {
  const points = section.querySelector('.visitor-map-points');
  const detail = section.querySelector('.visitor-map-detail');
  let pinned = null;
  const show = city => {
    detail.textContent = city ? city.location : '';
    detail.hidden = !city;
  };
  const reset = () => show(pinned?.city);
  points.replaceChildren();
  for (const city of cities) {
    const [x, y] = projectLocation(city.longitude, city.latitude, projection);
    if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'visitor-point';
    button.dataset.precision = city.location.endsWith(' (country-level)') ? 'country' : 'city';
    button.style.left = (x / MAP_WIDTH * 100) + '%';
    button.style.top = (y / MAP_HEIGHT * 100) + '%';
    button.style.setProperty('--dot-size', '5.5px');
    button.setAttribute('aria-label', city.location);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('pointerenter', () => show(city));
    button.addEventListener('pointerleave', reset);
    button.addEventListener('focus', () => show(city));
    button.addEventListener('blur', reset);
    button.addEventListener('click', () => {
      if (pinned) pinned.button.setAttribute('aria-pressed', 'false');
      if (pinned?.button === button) pinned = null;
      else { pinned = { city, button }; button.setAttribute('aria-pressed', 'true'); }
      reset();
    });
    points.append(button);
  }
  section.onkeydown = event => {
    if (event.key === 'Escape') {
      if (pinned) pinned.button.setAttribute('aria-pressed', 'false');
      pinned = null;
      reset();
    }
  };
  section.dataset.state = points.children.length ? 'ready' : 'empty';
  reset();
}

export function normalizeCities(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.cities) || data.cities.length > 20000) {
    throw new Error('Unexpected city data');
  }
  return data.cities.filter(city => typeof city?.location === 'string' &&
    city.location.length > 0 && city.location.length <= 200 &&
    typeof city.country === 'string' && /^[A-Z]{2}$/.test(city.country) &&
    Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 &&
    Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180)
    .map(city => ({ location: city.location, country: city.country,
      latitude: city.latitude, longitude: city.longitude }));
}

export function combineCities(saved, incoming) {
  const cities = new Map(saved.map(city => [city.location.toLowerCase() + '|' + city.country, city]));
  for (const city of incoming) {
    const key = city.location.toLowerCase() + '|' + city.country;
    if (!cities.has(key)) cities.set(key, city);
  }
  return [...cities.values()];
}

async function getJson(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'omit', cache: 'no-store',
    signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Visitor data unavailable');
  return response.json();
}

async function mount(section) {
  const detail = section.querySelector('.visitor-map-detail');
  let projection;
  let cities = [];
  try {
    const [projectionData, archive] = await Promise.all([
      getJson(new URL('./visitor-map-projection.json', import.meta.url)),
      getJson(new URL('./visitor-history.json', import.meta.url)).catch(() => null)
    ]);
    projection = projectionData;
    if (!Number.isFinite(projection.scale) || projection.scale <= 0 ||
        !Array.isArray(projection.translate) || projection.translate.length !== 2 ||
        !projection.translate.every(Number.isFinite)) throw new Error('Invalid projection');
    if (archive) cities = normalizeCities(archive);
    renderCities(section, cities, projection);
  } catch {
    section.dataset.state = 'unavailable';
    detail.hidden = true;
    return;
  }

  let collector;
  try {
    const config = await getJson(new URL('./visitor-config.json', import.meta.url));
    collector = new URL(config.collectorOrigin);
    if (collector.protocol !== 'https:') throw new Error('Invalid collector');
  } catch { return; }

  const refresh = async () => {
    try {
      const data = await getJson(new URL('/api/locations', collector));
      const merged = combineCities(cities, normalizeCities(data));
      if (merged.length !== cities.length) {
        cities = merged;
        renderCities(section, cities, projection);
      }
      section.dataset.collectorState = 'ready';
      section.dataset.checkedAt = data.checkedAt || '';
    } catch {
      section.dataset.collectorState = 'unavailable';
    }
  };
  void refresh();
  if (location.hostname !== SITE_HOST) return;

  // No browser identifier: only a timestamp to avoid repeating the same request
  // on every page refresh. A missing browser store does not break the map.
  let lastRecorded = 0;
  try { lastRecorded = Number(localStorage.getItem('rz-map-recorded-at')) || 0; } catch {}
  if (Date.now() - lastRecorded > 30 * 60 * 1000) {
    try {
      const challenge = await getJson(new URL('/api/challenge', collector));
      const result = await getJson(new URL('/api/visit', collector), {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ token: challenge.token }), keepalive: true
      });
      if (result.recorded) {
        try { localStorage.setItem('rz-map-recorded-at', String(Date.now())); } catch {}
        section.dataset.recordingState = 'recorded';
        await refresh();
      }
    } catch { section.dataset.recordingState = 'unavailable'; }
  }
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

if (typeof document !== 'undefined') {
  const section = document.querySelector('#visitor-map');
  if (section) mount(section);
}
