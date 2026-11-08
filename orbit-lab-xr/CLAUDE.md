# Orbit Lab XR
Draft WebXR port of Orbit Lab (see README.md). Conventions follow `../surface-lab-xr` (read its `CLAUDE.md`): static site, no build, Three.js r128 (`three.min.js`),
no remote resources, ask before installing anything, code comments in Italian, UI text in English (as the original Orbit Lab), say what is **unverified on the Quest**.

| File | Role |
|---|---|
| `core.js` | pure: physics copied verbatim from the 2D Orbit Lab (`../orbit-lab`) (`CORE`) + `shipFrame`, `toShipLocal`, `dashPolyline`. Node-testable. |
| `sim.js` | pure: state, history/rewind, thrusters (time passed in, no timers), levels, missions 1–6. |
| `xrpanel.js` | pure: control panel layout (`build(state)`), hit-test, ray, `Poke`, canvas drawing. Same conventions as Superfici 3D's `panel.js`. |
| `hud.js` | canvas drawing: readouts, energy bars, 2D ship-cam inset. |
| `grab.js`, `pointer.js` | copied unchanged from surface-lab-xr. |
| `app.js` | THREE scene, views, desktop camera, XR input, session start. Hook: `window.__app`. |
| `sw.js` | offline cache; bump `VERSION` on every release. |

Math frame: orbit plane = (x, y), z = normal, planet radius 1. `world` holds everything in math coordinates under `frameRoot`.
Ship view: `placeShipFrame` writes `frameRoot.matrix` every frame (ship pinned above the head, up = radial, forward = motion).
When you add a panel item, add its id to `doAction` in `app.js` and keep `tests/test-panel.js` green (targets ≥ 44 px, no overlaps).
