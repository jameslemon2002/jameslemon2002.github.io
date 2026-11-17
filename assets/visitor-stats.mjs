const SITE_HOST = 'jameslemon2002.github.io';
const BROWSER_KEY = 'rz-site-visitor';
const SNAPSHOT_KEY = 'rz-site-stats';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStats(data) {
  if (data?.version !== 1 || !Number.isSafeInteger(data.views) || data.views < 0 ||
      !Number.isSafeInteger(data.visitors) || data.visitors < 0 || data.visitors > data.views) {
    throw new Error('Invalid visitor totals');
  }
  if (data.views === 0 && data.startedAt === null && data.updatedAt === null) return null;
  const started = typeof data.startedAt === 'string' ? Date.parse(data.startedAt) : NaN;
  const updated = typeof data.updatedAt === 'string' ? Date.parse(data.updatedAt) : NaN;
  if (data.views === 0 || !Number.isFinite(started) || !Number.isFinite(updated) || updated < started) {
    throw new Error('Invalid visitor counting dates');
  }
  return { version: 1, views: data.views, visitors: data.visitors,
    startedAt: new Date(started).toISOString(), updatedAt: new Date(updated).toISOString() };
}

function visitData() {
  if (!globalThis.crypto?.randomUUID) return null;
  let visitorId = null;
  try {
    const saved = localStorage.getItem(BROWSER_KEY);
    if (saved && UUID_V4.test(saved)) {
      visitorId = saved;
    } else {
      const generated = crypto.randomUUID();
      localStorage.setItem(BROWSER_KEY, generated);
      visitorId = generated;
    }
  } catch {
    // A browser without storage can still contribute a page view.
  }
  return { viewId: crypto.randomUUID(), visitorId };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options, credentials: 'omit', cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error('Visitor totals unavailable');
  return response.json();
}

async function getLiveStats(endpoint) {
  const visit = visitData();
  if (visit) {
    const body = JSON.stringify(visit);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return normalizeStats(await fetchJson(endpoint, {
          method: 'POST', body, keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        }));
      } catch {
        // Retry using the same view ID, then try reading the totals.
      }
    }
  }
  return normalizeStats(await fetchJson(endpoint));
}

async function mountStats(footer) {
  const views = footer.querySelector('#site-views');
  const visitors = footer.querySelector('#site-visitors');
  const period = footer.querySelector('time');
  const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' });
  let shown;

  function show(data, live = false) {
    if (!data || (shown && (data.updatedAt < shown.updatedAt ||
        (data.updatedAt === shown.updatedAt && data.views < shown.views)))) return;
    // A slower snapshot should not relabel an equal live result as cached.
    if (!live && footer.dataset.source === 'live' && shown?.updatedAt === data.updatedAt && shown.views === data.views) return;
    shown = data;
    views.textContent = data.views.toLocaleString('en');
    visitors.textContent = data.visitors.toLocaleString('en');
    footer.dataset.source = live ? 'live' : 'archive';
    period.dateTime = live ? data.startedAt : data.updatedAt;
    period.textContent = (live ? 'since ' : 'as of ') + day.format(new Date(period.dateTime));
    footer.title = 'Visitors are counted once per browser since ' + day.format(new Date(data.startedAt));
  }

  try {
    const stored = localStorage.getItem(SNAPSHOT_KEY);
    if (stored) show(normalizeStats(JSON.parse(stored)));
  } catch {}
  void fetchJson(new URL('./visitor-stats.json', import.meta.url))
    .then(archive => { if (archive.current) show(normalizeStats(archive.current)); })
    .catch(() => {});

  if (location.hostname !== SITE_HOST) return;
  try {
    const config = await fetchJson(new URL('./visitor-config.json', import.meta.url));
    const endpoint = new URL('/api/stats', config.collectorOrigin);
    if (endpoint.protocol !== 'https:') return;
    const live = await getLiveStats(endpoint);
    if (live) {
      show(live, true);
      if (shown === live) {
        try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(live)); } catch {}
      }
    }
  } catch {
    // The footer continues to show the last dated snapshot.
  }
}

if (typeof document !== 'undefined') {
  const footer = document.querySelector('#visitor-stats');
  if (footer) void mountStats(footer);
}
