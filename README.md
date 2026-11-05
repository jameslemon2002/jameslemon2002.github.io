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

`assets/visitor-map.mjs` records a visit with the existing MapMyVisitors project
and reads its recent-location callback. The response is parsed as data; its
JavaScript payload is never evaluated. The display aggregates records by city,
rounds coordinates to 0.1 degrees, and exposes location labels and visit counts.
It does not display visitor identifiers, raw IP addresses or individual timestamps.
Hover, focus or tap a dot to read its details. Escape clears a pinned selection.

These are approximate IP-derived locations within the provider's recent reporting
window, not a complete all-time history or precise visitor positions. VPNs and
proxies can affect the reported location. The callback belongs to the provider's
widget implementation rather than a versioned public API; changes or blocked
requests leave the basemap visible with an unavailable-data message. There is no
sample-location fallback in production. Development previews do not make tracking
requests. The original [visitor report](https://mapmyvisitors.com/web/1c5mg) is
linked from the map heading.

The footer displays site-wide page views and visitor counts using the asynchronous
[Busuanzi](https://busuanzi.ibruce.info/) widget. Counts are supplied by this external
service and are approximate; blocked or unavailable requests may leave the numbers
unavailable. No account, API key, or backend is required. The homepage remains
usable when the widget cannot load.

Check the counters on the published hostname rather than localhost, where counts
do not represent this website. Remove the Busuanzi script and the `visitor-stats`
paragraph in `index.html` to disable the counters. Remove the `visitor-map-section`
section and the `visitor-map.mjs` script tag to disable geographic tracking. The
map and counters use separate providers and reporting windows, so their totals
need not match.

Run the parser and projection checks with `node --test test/visitor-map.test.mjs`.
Third-party geometry and projection notices are in `assets/visitor-map.LICENSE.txt`.
