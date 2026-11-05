const SITE_HOST = 'jameslemon2002.github.io';
const WIDGET_KEY = 'JT_9V-adiGVBX89Jf7Bh7Kx7XH6wUPU5GFzTToZpBz4';
const PROJECT_ID = 2246776;
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

function jsonp(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const callback = '__rzVisitors_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let timer;
    const finish = (error, value) => {
      clearTimeout(timer);
      script.remove();
      delete window[callback];
      if (error) reject(error); else resolve(value);
    };
    window[callback] = value => finish(null, value);
    script.async = true;
    script.referrerPolicy = 'origin';
    script.onerror = () => finish(new Error('Visitor service unavailable'));
    url.searchParams.set('callback', callback);
    script.src = url.href;
    timer = setTimeout(() => finish(new Error('Visitor service timed out')), timeout);
    document.head.append(script);
  });
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

async function mount(section) {
  const detail = section.querySelector('.visitor-map-detail');
  let projection;
  let saved = [];
  try {
    const [projectionResponse, archiveResponse] = await Promise.all([
      fetch(new URL('./visitor-map-projection.json', import.meta.url)),
      fetch(new URL('./visitor-history.json', import.meta.url), { cache: 'no-cache' })
        .catch(() => null)
    ]);
    if (!projectionResponse.ok) throw new Error('Projection unavailable');
    projection = await projectionResponse.json();
    if (!Number.isFinite(projection.scale) || projection.scale <= 0 ||
        !Array.isArray(projection.translate) || projection.translate.length !== 2 ||
        !projection.translate.every(Number.isFinite)) throw new Error('Invalid projection');
    if (archiveResponse?.ok) {
      const archive = await archiveResponse.json();
      if (archive.version === 1 && Array.isArray(archive.cities)) {
        saved = archive.cities.filter(city => typeof city.location === 'string' &&
          city.location.length > 0 && city.location.length <= 180 &&
          Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 &&
          Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180);
      }
    }
    renderCities(section, saved, projection);
  } catch {
    section.dataset.state = 'unavailable';
    detail.hidden = true;
    return;
  }

  // The saved map is already visible. Register the current visit independently;
  // a blocked or slow third party must never hide the archived city locations.
  // Local previews can show the archive without recording test traffic.
  if (location.hostname !== SITE_HOST) return;
  try {
    const registration = new URL('https://mapmyvisitors.com/widget_call_home.js');
    registration.search = new URLSearchParams({ d: WIDGET_KEY, cl: 'ffffff', w: '360', t: 'm' });
    const bootstrap = await jsonp(registration);
    if (typeof bootstrap !== 'string' || bootstrap.length > 400000 ||
        Number(bootstrap.match(/'project_id'\s*:\s*(\d+)/)?.[1]) !== PROJECT_ID) {
      throw new Error('Unexpected visitor project');
    }
    const domain = bootstrap.match(/'domain'\s*:\s*'([^']+)'/)?.[1];
    if (!domain || domain.replaceAll('"', '') !== 'https://' + SITE_HOST + '/') {
      throw new Error('Unexpected visitor domain');
    }
    const endpoint = new URL('https://mapmyvisitors.com/ajax/map');
    endpoint.search = new URLSearchParams({
      last_hit_id: '0', initial_hit_id: '0', initial: 'true', animate: 'false',
      user: '0', url: domain, id: String(PROJECT_ID), mapType: 'widget'
    });
    const payload = await jsonp(endpoint);
    const cities = new Map(saved.map(city => [city.location.toLowerCase() + '|' + city.country, city]));
    for (const city of parseLocations(payload)) {
      const key = city.location.toLowerCase() + '|' + city.country;
      if (!cities.has(key)) cities.set(key, city);
    }
    // The background response can add new locations, but cannot remove history.
    if (cities.size !== saved.length) renderCities(section, [...cities.values()], projection);
  } catch {
    // The same-origin archive remains displayed; no default caption is needed.
  }
}

if (typeof document !== 'undefined') {
  const section = document.querySelector('#visitor-map');
  if (section) mount(section);
}
