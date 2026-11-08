# Rong Zhao — Academic Homepage

A static academic homepage for <https://jameslemon2002.github.io/> with no build step.

## Local preview

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8000/>.

## Publish

GitHub Pages serves the repository root directly. Commit the changes and push the
`main` branch; no build step is required.

## Visitor map and statistics

The small SVG world map below Selected Papers is drawn locally in the homepage's
light/dark grey palette. It uses Natural Earth 1:110m land boundaries redistributed
by [world-atlas 2.0.2](https://github.com/topojson/world-atlas), projected with
Equal Earth using d3-geo 3.1.1. The geometry and projection parameters are bundled
in `assets/visitor-land.svg` and `assets/visitor-map-projection.json`; the map has
no runtime dependency on a mapping library or external basemap service.

The map first loads `assets/visitor-history.json` from this website, then merges
live city locations from the dedicated collector configured in
`assets/visitor-config.json`. The collector stores cities in a persistent D1
database. It replaces the old MapMyVisitors widget callback, which could return
no locations while a scheduled job still appeared successful. There is no default
caption. Hover, focus or tap a dot to show its city; Escape clears a pinned selection.
The saved archive stays visible if the collector cannot be reached.

On the public hostname, a short-lived request-bound token authorizes saving the
current approximate city. Geography comes from the collector's edge metadata or,
when that metadata is missing, a server-side lookup of the trusted connection IP
through IPWHOIS.io. That provider receives the address for the lookup; our
database does not retain it. Browser-posted coordinates are not accepted.
If city lookup fails, a trusted country header supplies an explicitly labelled
country-level reference point, shown as a hollow dot. These points use rounded
[Google country coordinates](https://developers.google.com/public-data/docs/canonical/countries_csv)
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); they do not claim
to identify a visitor's city or exact position.
The map reads the saved cities again
after recording a visit, then every minute while the page is visible and whenever
the tab is brought forward. A browser-local timestamp limits repeat submissions
to one per 30 minutes; no persistent visitor identifier is created. Local previews
can display city data but do not register visits.

`.github/workflows/visitor-history.yml` now only backs up the collector's cities
to this repository. It is scheduled hourly, but GitHub may run it hours later;
the public map's live updates do not wait for this job. Each city is stored once
with rounded coordinates and the day it was first saved. The job requests a Pages
rebuild after committing a changed backup. It can also be run manually in Actions.

The archive starts on 2026-11-05; it is a history of city locations observed since
then, not a complete per-visit log. Earlier expired records cannot be recovered.
Requests blocked by a browser or unavailable edge geolocation cannot be recorded.
Locations are approximate and can reflect a VPN or proxy.
No raw IP addresses, provider identifiers, individual visit timestamps or visitor
counts are stored in the archive. The page footer retains the separate overall
visitor counters. Map dots have a uniform size and city labels only.

Fetch errors leave the existing archive untouched; there are no sample points in
production. Run a backup locally with `node scripts/sync-visitor-history.mjs`.
The collector source is maintained separately in `../rong-visitor-collector`.

The footer displays site-wide page views and visitor counts using the asynchronous
[Busuanzi](https://busuanzi.ibruce.info/) widget. Counts are supplied by this external
service and are approximate; blocked or unavailable requests may leave the numbers
unavailable. No account, API key, or backend is required. The homepage remains
usable when the widget cannot load.

Check the counters on the published hostname rather than localhost, where counts
do not represent this website. Remove the Busuanzi script and the `visitor-stats`
paragraph in `index.html` to disable the counters. Remove the `visitor-map-section`
section and the `visitor-map.mjs` script tag to disable geographic tracking, and
disable the Back up visitor locations workflow to stop backups. The map and
counters use separate providers and reporting windows.

Run parser, projection and history checks with `node --test test/*.test.mjs`.
Third-party geometry and projection notices are in `assets/visitor-map.LICENSE.txt`.
