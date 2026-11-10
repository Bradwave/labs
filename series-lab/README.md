# Series Lab

Partial sums of a complex series in the Argand plane: write the general term and watch the polygonal path converge (or not).

Part of the math and physics labs at [matephis.com](https://matephis.com). Interface in Italian and English, light and dark themes, works on phones and offline, installable as an app.

## Features

- Write the general term a_n of a series in n and a complex parameter z (`z^n/n!`, `exp(i*n)/n`, `1/n^z`…): the plot updates as you type, errors are explained in plain words.
- Partial sums S_n as a polygonal path in the Argand plane, with the last term drawn as a vector; pan and zoom, or let the view follow n.
- A **Field** view: the partial-sum path for every point z of a grid (up to 21 × 21) drawn in the same plane, coloured by the point it starts from or by whether its terms shrink; converging paths gather at their limits, diverging ones fly away (and are faded). A map of the sample points tells which colour is which z; click picks z, double-click opens its path in the Plane.
- Re/Im parts and moduli (|a_n|, |S_n|, optional log scale) against n.
- An estimated limit (Aitken extrapolation), shown only when the series looks convergent and always labelled as an estimate.
- Eight examples, table of the last terms, shareable link, CSV export.

## Run locally

```bash
# from the repository root
python3 -m http.server 8100
```

Then open <http://localhost:8100/series-lab/>. Tests: `node --test tests/`.

## Structure

```
index.html            markup and the info dialog
css/app.css           palette and app-specific styles
js/main.js            entry point: state, controls, animation, pan and zoom
js/expr.js            parser for complex expressions (pure)
js/series.js          partial sums, Aitken, presets, URL state, CSV (pure)
js/field.js           the partial-sum paths of a grid of points z, advanced in time-budgeted slices (pure)
js/render.js          canvas drawing of the four views
js/strings.js         Italian and English strings
sw.js, manifest.webmanifest   offline and install (generated)
tests/                node --test
```

The look and behaviour follow the shared [lab design standard](https://github.com/Bradwave/labs/blob/main/DESIGN.md).

## Licence

MIT. Vibecoded with Claude, with <3.
