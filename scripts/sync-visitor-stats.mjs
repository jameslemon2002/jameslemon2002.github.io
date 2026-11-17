import { readFile, writeFile } from 'node:fs/promises';
import { normalizeStats } from '../assets/visitor-stats.mjs';

const archiveUrl = new URL('../assets/visitor-stats.json', import.meta.url);
const configUrl = new URL('../assets/visitor-config.json', import.meta.url);
const [archive, config] = await Promise.all([archiveUrl, configUrl]
  .map(async url => JSON.parse(await readFile(url, 'utf8'))));
const endpoint = new URL('/api/stats', config.collectorOrigin);
if (archive.version !== 1 || endpoint.protocol !== 'https:') throw new Error('Invalid visitor stats configuration');

const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error('Visitor stats service HTTP ' + response.status);
const counts = normalizeStats(await response.json());
const previous = archive.current && normalizeStats(archive.current);
const changed = counts && (!previous || counts.updatedAt > previous.updatedAt ||
  (counts.updatedAt === previous.updatedAt && counts.views > previous.views));
if (changed) {
  archive.current = counts;
  await writeFile(archiveUrl, JSON.stringify(archive, null, 2) + '\n');
}
console.log(JSON.stringify({ views: counts?.views ?? 0, visitors: counts?.visitors ?? 0, changed: Boolean(changed) }));
