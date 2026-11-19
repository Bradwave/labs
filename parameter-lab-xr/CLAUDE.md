# Parameter Lab XR

Follow `../DESIGN.md` (§17 for XR apps): it is the design standard of all the labs. This file only adds what is specific to Parameter Lab XR. Read `docs/PLAN.md` for decisions and what is next. Conventions follow `../fourier-lab-xr` and `../force-lab-xr`: static site, no build, Three.js **r128** (`js/three.min.js`, global `THREE`), no remote resources (headsets are offline), code comments in Italian, UI strings in Italian **and** English (`js/strings.js`, same keys). Always say what is **unverified on the Quest**.

Prototype AR app (2026-11-18) for a teacher: explore parametric equations and inequalities by extruding the (x, y) plane along the parameter k.

| File | Role |
|---|---|
| `js/expr.js` | **pure** (UMD, global `Expr`): parser of one relation (`y = x^2 + k`, `x^2 + y^2 <= k`) into `F(x, y, k, a)` plus op; no `eval` of user text (JS is generated from validated tokens); errors are `{code, params}` with `err.*` string keys. |
| `js/engine.js` | **pure** (global `Engine`): `contour` (marching squares, pole-safe), `surface` (marching tetrahedra in (x, y, k)), `mask` (regions), `intersections` (segment hits + Newton), `scan` (all slices), `link` (3D intersection curve), `discuss` (runs of equal count, critical values by bisection, then Newton on tangency `FA = FB = det = 0`), `filterInside`. |
| `js/presets.js` | **pure**: the eleven examples (data only; name `pr.<id>` and question `pq.<id>` live in `strings.js`). |
| `js/app.js` | THREE scene, slice plot and discussion bar (one drawing function for the page and for the headset panel), floating panel, hand/controller input, desktop camera, state and links. Test hook `window.__app`. |
| `js/grab.js` | copied unchanged from `force-lab-xr` (two-hand grab and scale of the stage; pinch hysteresis). |
| `js/main.js`, `js/strings.js` | kit setup and strings. |
| `sw.js`, `manifest.webmanifest`, icons | generated: `node ../tools/sync-kit.mjs parameter-lab-xr`, `node ../tools/logos.mjs parameter-lab-xr` (from `logo.svg`). |

Frames: `stage` (movable and scalable with the base cube; 0.3 m per unit: plane about 0.6 m wide, k axis about 0.45 m high). Stage X = x/W, Z = −y/W (the plane's y points away from you), Y = (k − k0)/(k1 − k0)·1.5. The window is x, y ∈ [−W, W]: **intersections outside it are not counted**, so presets keep their solutions inside (a lesson learned with the pencil of lines: a root at y = 13.9 in a window of 4 made fake critical values). Interaction maths runs in stage coordinates.

Semantics: `A` blue, `B` orange, **violet (accent) is always the solution set**: intersection points (two equations), the part of the equation's curve inside the inequality, the overlap of two regions. The discussion counts intersections of the two *boundary curves*; with an inequality the label says "boundary intersections". Critical values found by Newton are marked tangent; the others (a point leaving through the window, a domain edge) are shown with "≈".

Controls: **handle** (yellow box on the k axis) = pinch or trigger/grip near it, hand height is k, snaps to critical values; thumbstick up/down moves k slowly; **base cube** moves the scene (second hand scales); **panel** = fingertip poke or ray + trigger (k −/+, sweep, previous/next example, next critical value, slice only, layers, recentre, touch the discussion bar to jump). On screen: drag the handle, orbit, wheel/pinch, Space / ← → (Shift = ×5) / C (Shift+C previous) / R.

State is the URL hash (`#a=…&b=…&k0=…&k1=…&w=…&k=…&p=…`), also stored in `parameter-lab-xr.state`; a `hashchange` applies a pasted link.

Tests: `node tests/engine.test.mjs` (parser, contours, tangent critical values ±2√2, two circles −3 −1 1 3, x³ − 3x = k, √x = x − k domain edge, every preset). Headless XR checks: in the page set `__app.SRC[i].kind = "hand"`, fake `__app.hands[i].joints` (`thumb-tip`, `index-finger-tip`) and call `__app.xrInput(now, dt)`.

Palette: rose, violet accent (`apps.json`, proposed: review with `node ../tools/check-palettes.mjs`). In the headset the dark palette is used.
