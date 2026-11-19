# Dynagraph XR

Follow `../DESIGN.md` (§17 for XR apps). Read `docs/PLAN.md` for decisions and what is next. Same conventions as `../composition-lab-xr` (static site, no build, Three.js **r128** global `THREE`, no remote resources, code comments in Italian, UI strings in Italian **and** English with the same keys in `js/strings.js`). Always say what is **unverified on the Quest**.

AR version (prototype, 2026-11-18) of the *Dynagraph* web app (`Bradwave/dynagraph`, a single `main.js` canvas app): functions as lines between **parallel axes** — IN on top, OUT in the middle, COMP (the composition h) at the bottom; the plane is vertical in front of the user.

| File | Role |
|---|---|
| `js/expr.js` | copy of Composition Lab XR's parser (`compileFn(src, "x")` / `tryFn`; every function here uses `x`; no `eval` of user text). |
| `js/dyna.js` | **pure** (global `Dyna`): axis views (`valToX`, `zoom`, `pan`, `setRange`, `ticks`), `chain` (x → f(x) → h(f(x))), `lines` (2→3 / 1→3 / both), `sampleXs`, `curve` (cartesian plots), `Trace`, link `toQuery`/`fromQuery`, colour palette. |
| `js/app.js` | THREE scene, panel on a canvas (3 pages: main, axes, more), hand/controller input, desktop camera and Shift+drag/wheel on axes, state and links. Test hook `window.__app`. |
| `js/grab.js` | copied from `parameter-lab-xr` (two-hand grab and scale of the stage). |
| `js/main.js`, `js/strings.js`, `css/app.css`, `index.html` | kit setup, strings, page. |

Features of the web app that are in: draggable inputs of f and g, link inputs, composition axis with the three connection modes, per-function visibility / colour / trace (length) / sampling (density, exact interval, start, end), cartesian mode, axis zoom, pan and range, axis spacing, full labels, travelling pulse (the web app's "animations"). **Left out**: the JavaScript input box (no `eval` of user text, no keyboard in the headset), dark-mode toggle (kit theme), per-axis opacity sliders, renaming functions, install and GitHub buttons (kit).

Embodiment: the **hand's x is the input** (pinch or trigger/grip near the ball on the top axis; two hands move f and g independently, `Link` ties them); a tick on controllers at every tick mark of the axis.

Tests: `node tests/dyna.test.mjs`. Headless XR check: set `__app.SRC[i].kind = "hand"`, fake `__app.hands[i].joints` (`thumb-tip`, `index-finger-tip`, Object3D with `visible = true`) and call `__app.xrInput(now, dt)`.
