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

## Visitor statistics

The footer displays site-wide page views and visitor counts using the asynchronous
[Busuanzi](https://busuanzi.ibruce.info/) widget. Counts are supplied by this external
service and are approximate; blocked or unavailable requests may leave the numbers
unavailable. No account, API key, or backend is required. The homepage remains
usable when the widget cannot load.

Check the counters on the published hostname rather than localhost, where counts
do not represent this website. Remove the Busuanzi script and the `visitor-stats`
paragraph in `index.html` to disable this integration.
