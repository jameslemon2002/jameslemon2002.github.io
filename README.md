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

The map first loads `assets/visitor-history.json` from this website. Saved city
locations stay on the map after they disappear from the provider's recent window,
and remain visible when the third-party service is slow or blocked. There is no
default caption. Hover, focus or tap a dot to show its city; Escape clears a pinned
selection. The public page also registers a visit with the existing MapMyVisitors
project and can add current locations in the background. Local previews show the
archive without making any tracking requests.

`.github/workflows/visitor-history.yml` checks the existing project's location feed
every hour, at minute 13 UTC, and saves newly observed cities to the repository.
GitHub may delay scheduled runs. Each city is stored once with rounded coordinates
and the day it was first saved. Repeated snapshots do not duplicate cities or add
overlapping recent visit counts. The workflow explicitly requests a Pages rebuild
after committing new locations because commits made with `GITHUB_TOKEN` do not
trigger the normal branch-based build. It can also be run manually in Actions.

The archive starts on 2026-11-05; it is a history of city locations observed since
then, not a complete per-visit log. Earlier expired records cannot be recovered
from the recent feed, and visits missed between polls or blocked by the service
cannot be guaranteed. Locations are approximate and can reflect a VPN or proxy.
No raw IP addresses, provider identifiers, individual visit timestamps or visitor
counts are stored in the archive. The page footer retains the separate overall
visitor counters. Map dots have a uniform size and city labels only.

The callback belongs to the provider's widget implementation rather than a
versioned public API. The response is parsed as data, never evaluated. Fetch errors
leave the existing archive untouched; there are no sample points in production.
The original [visitor report](https://mapmyvisitors.com/web/1c5mg) is linked from
the map heading. Run a sync locally with `node scripts/sync-visitor-history.mjs`.

The footer displays site-wide page views and visitor counts using the asynchronous
[Busuanzi](https://busuanzi.ibruce.info/) widget. Counts are supplied by this external
service and are approximate; blocked or unavailable requests may leave the numbers
unavailable. No account, API key, or backend is required. The homepage remains
usable when the widget cannot load.

Check the counters on the published hostname rather than localhost, where counts
do not represent this website. Remove the Busuanzi script and the `visitor-stats`
paragraph in `index.html` to disable the counters. Remove the `visitor-map-section`
section and the `visitor-map.mjs` script tag to disable geographic tracking, and
disable the Save visitor locations workflow to stop archiving. The map and
counters use separate providers and reporting windows.

Run parser, projection and history checks with `node --test test/*.test.mjs`.
Third-party geometry and projection notices are in `assets/visitor-map.LICENSE.txt`.
