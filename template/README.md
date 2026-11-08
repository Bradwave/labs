# __NAME__

__DESC_EN__

Part of the math and physics labs at [matephis.com](https://matephis.com). Interface in Italian and English, light and dark themes, works on phones and offline, installable as an app.

## Features

- …

## Run locally

```bash
# from the repository root
python3 -m http.server 8100
```

Then open <http://localhost:8100/__SLUG__/>. Tests: `node --test tests/`.

## Structure

```
index.html            markup and the info dialog
css/app.css           palette and app-specific styles
js/main.js            entry point
js/strings.js         Italian and English strings
sw.js, manifest.webmanifest   offline and install (generated)
tests/                node --test
```

The look and behaviour follow the shared [lab design standard](https://github.com/Bradwave/labs/blob/main/DESIGN.md).

## Licence

MIT. Vibecoded with Claude, with <3.
