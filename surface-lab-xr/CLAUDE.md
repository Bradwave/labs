# CLAUDE.md — Surface Lab XR (Superfici 3D, WebXR for Meta Quest 3)

Teaching app for a maths/physics teacher at an Italian liceo scientifico. Students explore surfaces in 3D with their
hands and discover conic sections by slicing them with a plane. Runs in the Quest Browser (WebXR) and on desktop/phone.
**UI text is Italian. Code comments are Italian. Talk to the user in the language they write in (English or Italian).**
**Start here:** this file, then `docs/HANDOFF.md` (decisions taken with the user, open questions, how to start a session) and
`docs/PLAN.md` (plan, roadmap, feature status, progress log). `docs/PLAN.md` is an export of the original claude.ai doc and is now the
living plan: keep it current and add a row to its "Progress log" after each piece of work. (The original doc, which Claude Code cannot open:
https://claude.ai/artifact/BTyyyQgCRfKe6c9EJLQrYU)

## Rules for working with this user
- **Ask before installing anything** (npm packages, Homebrew, Xcode tools, browsers). Say what and why, then wait.
- Static site, **no build step, no bundler, no framework**. Do not introduce one without asking. Vanilla JS (ES2015+ style
  already used), Three.js **r128** bundled in `three.min.js` (UMD global `THREE`). Do not upgrade Three.js casually:
  r128 specifics are relied on (`SphereBufferGeometry`, `renderer.xr.getHand`, `joint.jointRadius`).
- Headsets are **not on wifi**. Never add a CDN, web font, remote script or network call. Everything must work offline.
- You cannot test WebXR, hand tracking, passthrough or on-headset performance. Test the maths and logic headlessly, simulate
  hands (see Testing), and say clearly what remains **unverified on the headset**. The user tests on a Quest 3 and reports.
- Be honest about tuning: pinch thresholds, pick distances, panel size and snapping feel are decided by headset feedback.

## Layout
| File | Role |
|---|---|
| `index.html` | page, panels (left: surfaces/plane; right: section card), loads scripts, registers the service worker |
| `core.js` | **pure maths, no DOM, no THREE**: parser, meshing, sections, conic classification, preset library. Runs in Node. |
| `grab.js` | `GrabController` (one/two hands) and `pinchUpdate`. Takes `THREE` as an argument; testable in Node. |
| `icons.js` | stroke icon set (24×24 paths) shared by the page (`Icons.mount`, `data-ic` spans) and the VR canvases (`Icons.draw` with `Path2D`). Global `Icons`. Offline: no icon font. |
| `panel.js` | **pure**: floating VR control panel with icon tabs (Superfici/Piano/Oggetto/Vista), list pages, "Menu" button, grabbable frame (`inFrame`), fingertip `Poke`, controller `rayHit`, transformation summary (`describe`), canvas `draw`. Global `Panel`. Tested by `tests/test4.js`. |
| `qr.js` | **pure**: QR code generator (byte mode, ECC L/M, versions 1–25; checked against standard capacities and a published Reed-Solomon vector, and decoded by the browser's BarcodeDetector). Global `QR`. `tests/test11.js`. |
| `thumbs.js` | **pure**: surface previews (low-res mesh + painter's-algorithm canvas drawing; used by the gallery, quick gallery and scene tiles). Global `Thumbs`. `tests/test6.js`. |
| `quick.js` | **pure**: quick gallery state (stick up/down/left/right, ring of surfaces ordered by family, idle close), shared with the palm gallery. Global `Quick`. `tests/test7.js`. |
| `scene.js` | **pure**: scene format (validate, short code `s3d1.…`, pose deltas for the gesture history) and built-in lessons. Global `SceneIO`. `tests/test8.js`. |
| `probe.js` | **pure**: probe maths (project onto F=0, numeric gradient). Global `ProbeMath`. `tests/test9.js`. |
| `pointer.js` | **pure**: ray pointer logic shared by controllers and hands (`Tracker`: down/tap/hold/cancel with pre-pinch latch; `nearestOnRay`). Global `Pointer`. Tested by `tests/test5.js`. |
| `app.js` | scene, objects, snapping, panels, desktop orbit, WebXR input. Global `window.__app` is a test hook. |
| `sw.js`, `manifest.webmanifest`, `icon*` | offline PWA. **Bump `VERSION` in `sw.js` on every release.** |
| `docs/` | `CLAUDE.md` (this file), `PLAN.md` (plan and progress log), `HANDOFF.md` (decisions and open questions) |
| `tests/` | `node test.js` … `test5.js` (see Testing) |

Script order in `index.html`: `three.min.js`, `core.js`, `grab.js`, `icons.js`, `panel.js`, `scene.js`, `probe.js`, `qr.js`, `pointer.js`, `thumbs.js`, `quick.js`, `app.js`. `core.js`/`grab.js` export via `module.exports`
in Node and attach `Core`/`Grab` to `window` in the browser.

## Run
`python3 -m http.server 8000` in this folder, open `http://localhost:8000` (secure context, so WebXR and the service worker work).
Quest over USB (headset not on the internet): developer mode on, `adb devices`, `adb reverse tcp:8000 tcp:8000`,
open `http://localhost:8000` in the Quest Browser. The reverse mapping is lost on unplug or `adb` restart.
Desktop without a headset: Immersive Web Emulator extension (Chrome/Edge).

## Testing
`cd tests && npm install && npm test` (installs `three@0.128.0` for the tests only; ask first). Tests `require('../core.js')` etc.
- `test.js`: parser, sphere area/volume/normals, cone vertices.
- `test2.js`: conic classification of sections (cone at 30/45/60 degrees, sphere, ellipsoid, paraboloids…), moved/rotated/scaled
  surfaces, marching squares, and grabbing objects that are children of a scaled/rotated group.
- `test3.js`: extended parser, parametric meshing (catenoid and helicoid areas vs exact), sections of parametric surfaces,
  and a sanity sweep over **every preset** (valid mesh, bounded extent, valid normals). Add new presets here automatically
  by adding them to `PRESETS`; the sweep covers them.
- `test4.js`: panel layout, hit-testing, fingertip poke, controller ray maths, list pages, collapsed menu. `test5.js`: pointer tracker (tap/hold/cancel/latch) and `nearestOnRay`. Both run with plain `node`, no install.
Browser checks used so far (not in the repo): headless Chromium via Playwright with software GL
(`--use-gl=swiftshader --enable-unsafe-swiftshader`), fulfilling the local `three.min.js`, then driving the UI and `window.__app`.
Hand tracking is simulated by faking `renderer.xr.getHand(i).joints[...]` (visible + position) and calling
`__app.grab.update(sources, dt, __app.pick)` with plain `{id, active, pinching, pos, quat}` sources.

## Coordinates and scene graph (important)
- Maths frame: **z is up**. `mathG` is rotated by -90 degrees about X so math (x,y,z) maps to Three (x, z, -y).
- `scene` > `frameRoot` (the reference system; world pose and scale; scale = metres per unit, default `DEF_SCALE = 0.16`,
  home `(0, 1.3, -0.7)`) > `mathG` > { axes, `planeG`, one `group` per surface }.
- `frameRoot`, each surface `group` and `planeG` are **independent grabbable objects**. A surface's equation is always in its own
  local coordinates; its `group` position/rotation/uniform scale place it in the reference system. Never bake a transform into an equation.
- Plane: `planeG` local z is its normal; local x,y are its axes (u,v of the 2D section panel). Frame extent `FR = 2.5`, plane extent `PR = 2.5`.
- `userData.grab = { scalable, min, max, kind }` on grabbable objects; min/max are **local** uniform scale limits
  (frame 0.04–0.5, surface 0.15–6, plane not scalable).

## Surfaces
Two kinds, both in `core.js` and in `app.js` (`s.kind`):
- `implicit`: `F(x,y,z) = 0`, meshed by marching tetrahedra (Kuhn, 6 tets per cell) inside a **box** `s.bounds = [x0,x1,y0,y1,z0,z1]` (presets give the cube `[-R,R]^3`; `polygonize(fn, {bounds|R, N})`, N = cells along the longest side; sections take the same box). The VR "Dominio" page and the page fields edit it; in VR the six face handles (yellow spheres, toggle "Maniglie sulle facce") can be pinched and slid along their axis, the mesh is recomputed on release (`updateHandles`, `trackGesture`).
  Normals from the numeric gradient; the "front" side is where F grows. Zero-gradient (singular) vertices fall back to the face normal.
- `param`: `(x(u,v), y(u,v), z(u,v))` over `[u0,u1] x [v0,v1]` (strings; ranges accept `pi`), grid `N x N`.
  Normals from numeric partial derivatives. `twoSided: true` for non-orientable surfaces (back side uses the front colour).
- **Parameters (M5)** (ranges are negative too: custom equations get `[-3, 3]`): the letters `a b c d k m n` in an equation are parameters (`Core.PARAM_LETTERS`; `compile(eq, vals)` returns `{fn, params, make}`, missing values = 1; function names are matched before single letters so `abs` is not `a·b·s`). Each surface keeps `s.params = {a: {v, min, max}}` (presets declare `params: {a: [valore, min, max]}`; custom equations get `[1, 0.1, 3]`). Page: sliders under the equation (`renderParamSliders`, rebuild at N≤32 while dragging and at full N on release); VR: Oggetto → Parametri (± steps). Parameters and bounds are saved in scenes (`par`, `b`).
- Parser (`compile`, `compileParam`, `evalNumber`): own recursive-descent parser that **generates JS only from validated tokens**
  (no `eval` of user text). Supports `^` and `²`, implicit product (`2x`, `xy`), `pi`, `e`, `sqrt sin cos tan asin acos atan sinh cosh tanh
  exp ln log abs sign floor atan2 min max`. Implicit uses x,y,z; parametric uses u,v. Error messages are Italian.
- Library: `PRESETS` in `core.js` (53 in 11 groups, the last one "Superfici con parametri"; `GROUPS` max 9 per group so a gallery page is 3×3). To add one: `I(id, group, name, eq, R, extra)` for implicit or
  `P(id, group, name, fx, fy, fz, u0, u1, v0, v1, extra)` for parametric. Keep the extent within about +-2.5 so it fits the frame;
  `extra` may set `N`, `twoSided`, `cone`. `cone: true` enables the cone-specific plane snaps.
- Max 6 surfaces (`PALETTE`). `rebuild(s)` recomputes mesh + pick samples + domain box.

## Sections and conics
- Implicit: sample F on the plane grid (in the surface's local frame via the inverse of its matrix), marching squares, domain test
  against the local `[-R,R]^3`. Conic type via `fitConic` (exact quadratic fit on the plane, residual check) and `classifyConic`
  (circle with radius, ellipse/hyperbola with eccentricity, parabola, lines, point, empty). Non-quadrics: "curva non conica".
  `TOL2 = 2e-3` is the relative tolerance for "parabola" (the discriminant is about 0).
- Parametric: the section is `n . P(u,v) - d = 0` on the parameter grid (`sectionSegmentsMesh`), so no function evaluations per frame.
  Not classified as a conic ("curva di sezione").
- The curve is drawn as a ribbon mesh (`makeRibbon`, capacity `CAP = 3000` segments) on the plane, and in the 2D panel (`drawPanel`,
  used for both the DOM canvas and the VR panel texture). `recompute()` runs only when `dirty` (plane or a surface matrix changed).
- Clipping hides one side of the plane (`renderer.localClippingEnabled`, shared `clipPlane`, flip with `clipSide`).

## Interaction
- `GrabController.update(sources, dt, pick)`: pose is handled in **world space** and converted back to the object's local space
  (`_setWorld`), so children of a scaled/rotated parent behave. One source moves and rotates the target; a second source pinching
  anywhere scales (if allowed) and rotates it. Smoothing `smooth = 28` (1/s). Pinch: on below 2.2 cm, off above 3.5 cm.
- `pick(pos)` in `app.js` chooses the target: **surface (nearest sampled vertex, `REACH_SURF = 0.06` m) > axes (`REACH_AXES = 0.05`)
  > plane (`REACH_PLANE = 0.06`)**. Hover highlights the object a pinch would grab.
- Snapping (`snapPlane`): plane normal to the frame axes, and for `cone` surfaces to the cone axis (circle), parallel to a
  generatrix (parabola) and containing the axis (hyperbola), within `SNAP_ANG = 6` degrees, plus distance in steps of
  `SNAP_STEP = 0.25` units. The snap follows a moved/rotated cone.
- Controllers (v7): **grip = grab** (source `pinching` = squeeze), **trigger = ray pointer** (press panel buttons on down, select a surface on a quick tap, hold = quick menu, reserved for phase E), **B/Y = show/hide the panels** (collapses to a "Menu" button, `fab`). A/X is free (probe, planned). Button indices in `GP` (xr-standard: 4 = A/X, 5 = B/Y) are **unverified on the Quest**: open `http://localhost:8000/?monitor=1` to see the raw buttons/axes above the panel.
- Hands (v7): pinch near an object = grab (direct); pinch with the ray on a button/surface = click/select (`Pointer.Tracker`, target latched when the pinch starts closing, `u.near`). The hand ray is the input source's own targetRay pose (`ctrls[i]` group); if the Quest does not provide it (`c.visible` false) there is no ray and the fingertip poke still works. Surfaces are pointed by sampled vertices (`REACH_RAY = 0.035`), not triangles.
- Phase C (v9): gallery page in the VR panel (family arrows, 3×3 thumbnails, Sostituisci/Aggiungi mode); thumbnails are generated lazily by `pumpThumbs` (one per 40 ms on the page, one per 250 ms in XR) into canvases. **Quick gallery**: thumbstick up opens, down closes, left/right = next/previous surface of one ring ordered by family, the *other* stick left/right jumps family, trigger applies (replace or add, same mode as the gallery); a rotating 3D ghost (`ghost`) and a name tag float above the controller. Thumbstick axes are `axes[2]`, `axes[3]` (y negative = up) — **unverified on the Quest** (`?monitor=1`). **Palm gallery**: palm up for 0.4 s (`palmUp` from `index × pinky` metacarpals, sign flipped for the left hand — **unverified**, the monitor prints `palmo y=`) shows `palmMesh` above the palm; poke or ray its arrows/preview.
- Phase D (v10): scenes. `snapScene`/`applyScene` (format in `scene.js`), saved scenes in `localStorage['surface-lab-xr.scenes.v1']` (per origin: they disappear if the address or port changes; use the code to move scenes), built-in lessons, **single-slot undo** (`pushUndo`/`doUndo`, with redo by pressing again) for Nuova scena, opening a scene, Ripristina tutto, delete surface, gallery changes, duplicate/isolate/home from the quick menu and reverting a gesture. Desktop tab "Scene" has save/open/delete and copy/paste of the code. **Gesture history**: `trackGesture` logs each grab (start→release) that changed a surface/plane/frame pose; Oggetto → "Cronologia dei gesti" shows them with before/after and "Torna a prima di questo gesto".
- Keyboard and QR (v13): VR keyboard (Superfici → "Scrivi l'equazione", page `kbd`): 40 character keys (labels from `kbKeyDefs`, x y z or u v), cursor, backspace, clear, field switcher for parametric surfaces, live validity check, "Applica" runs `applyEditor` and keeps one undo step. **Scene link**: `sceneUrl()` = base + `#s3d1.<code>`; `applyHash()` opens a scene from the URL hash at load and on `hashchange`; the base is the current address or the "Indirizzo dell'app per il QR" saved in `localStorage['s3d-base']`. Page (Scene tab): "Mostra QR" and "Comando Quest" (an `adb shell am start … -d "http://localhost:PORT/#s3d1…"` command that opens the scene in the Quest Browser over USB); VR: Scene → QR. **The headset cannot read a QR code** (WebXR pages have no camera access): the QR is for phones/tablets/other computers that can reach the address.
- Phase E (v11): **object quick menu** (hold the trigger, or the ray pinch, still on a surface): hide, delete, original position, isolate, duplicate, lock (locked surfaces are not grabbable; not saved in scenes). **Probe**: A/X held (controllers) or "Sonda" in Vista (hands) → the ray shows point P and ∇F in the surface's own coordinates and the unit normal in the reference system (parametric surfaces: normal only); the trigger/pinch pins a marker that follows the surface; "Piano tang." toggles a small very transparent tangent plane.
- Highlight before grabbing: lightened surface + solid yellow box + name tag (`updateTag`), plane white edge, frame yellow; hands turn yellow when something is within pinch reach; controllers vibrate (`buzz`) when the ray reaches something, on press and on select.
- Restore: `restoreSurface`, `restorePlane`, `resetAll` (panel "Pos. originale"/"Ripristina tutto", page "Pos. originale" and "Ripristina tutto"). "Ripristina vista" resets only the reference frame and the camera.
- Panels in VR (v8): both the control panel and the section card are grabbed by their **frame** (about 1.4 cm band plus 2 cm outside; `pick` → `Panel.inFrame`), which lights up orange when a hand is close. The "Oggetto" tab summarises the selected surface's transformations in words, and in numbers with "Dettagli" (`tfSummary`, `Panel.describe`).
- Colours (v8): colour-blind-safe Okabe-Ito palette (`PALETTE`: blue, vermilion, sky, purple, green, grey; section curves darker; back face cream; plane yellow; axes vermilion/green/blue plus letters). Avoid green-vs-pink or red-vs-green pairs as the only cue.
- Page UI (v6): stage card (`#view` holds the canvas; `resize()` follows it, not the window) + side column (section card `#secbox`, tabs Superfici/Piano/Posizione/Aiuto). Style shared with Quadrature and Pendulum Lab (`../quadrature`, `../pendulum-lab`) but with **no remote fonts/icons**. `app.js` relies on the element ids in `index.html`; keep them when restyling.
- In VR the left panel is hidden (`body.inxr`); the section card is replaced by a floating panel (`xrPanel`) that turns towards the user.

## Status (see the doc for the full picture)
Done: M0–M3, independent surfaces, 45-preset library with parametric engine, section classification, offline package.
Tested by the user on a Quest 3: app loads and works. Known gaps seen there: **no way to exit VR from inside the app**, and **no
settings panel inside VR**.

## Next work, in this order (agreed with the user)
**Items 1 and 2 are built (v3) but unverified on the headset**: floating panel in `panel.js`/`app.js` (`ctlPanel`, `updatePanel`, `doAction`), passthrough via
`startXR('immersive-ar')` and the `#ar` button. Wait for the user's feedback and tune before moving on. Answers from the user: no hosting work for now; scene sharing
as a short code/hash plus QR; M5 parameter details still to be completed by the user. Original descriptions kept below.
1. **Floating VR panel, movable.** Grab it by its title bar with a pinch (reuse `GrabController`, add the panel to `pick` with the
   highest priority only on the title bar); two hands resize it; optional "face me". Buttons are pressed with the **index fingertip**
   (poke: fingertip crosses the panel plane inside a button rect; ignore while pinching) or the controller ray + trigger.
   Contents: Exit VR, reset view, previous/next preset and add/delete/show/hide surface, plane tilt/direction/distance, hide-side and
   flip, snapping on/off, domain size +/-. Panel rendered from a canvas texture (like `xrPanel`) with hit regions. Keep it readable
   (large targets, about 3 cm) and test hit-testing headlessly with simulated fingertips.
2. **Passthrough (mixed reality).** A second desktop button "Entra in realtà mista" requesting `immersive-ar` with the same optional
   features; transparent background (`scene.background = null`, renderer alpha), hide the floor grid. WebXR cannot switch VR/AR inside a
   session: leaving and re-entering is expected. Whether a button press inside VR can start a session is **unverified**; do not promise it.
3. **M4 domain**: grabbable box faces per surface, typed bounds as a fallback. **M5 parameters**: detect `a, b, c` in equations,
   3D sliders. Then scene link/QR (prepare on a computer, load on the headset) and deployment (subdomain, offline check).
4. Later: challenge mode, Dandelin spheres, tangent plane/normal, intersection of two surfaces, level curves, parametric input helpers,
   height/curvature colouring, parameter animation, undo/snapshots, seated mode.

## Gotchas learned
- Matrix update order matters: the render loop calls `scene.updateMatrixWorld(true)` before `grab.update`/`pick`, and `group.updateMatrix()` before `recompute()`; keep that order when adding code.
- `renderer.xr.getHand(i).joints` are only populated after the hand `connected` event; check `joint.visible` before use. Hand and
  controller input sources both fire `select` events; `app.js` distinguishes them via `c.userData.kind` from the `connected` event.
- The main `camera` position is valid in XR (Three copies the headset pose into it); the VR panel billboards with it.
- Clipping planes: Three clips the **negative** side of the plane, hence the `-clipSide` sign when building `clipPlane`.
- Changing `material.clippingPlanes` from null to an array needs `material.needsUpdate = true` (done in `applyClipFlag`).
- Marching tetrahedra cells with non-finite values are skipped (e.g. `sqrt` of negatives), so surfaces can have holes by design.
- Service worker is network-first with cache fallback and bypasses the browser HTTP cache (`python3 -m http.server` sends no cache headers, so stale files were possible); after a release change `VERSION`. The page shows the running version under the VR buttons ("Versione: superfici3d-vN"). Behind Cloudflare, do not cache `sw.js`/`index.html` aggressively.
- When editing the README or this file, keep them accurate: the user relies on them to set up the headset session.

## Other project docs

After this file, read `docs/HANDOFF.md` (decisions taken with the user, open questions) and `docs/PLAN.md` (plan, status, progress log).
The folder and repo were renamed from `superfici3d` to `surface-lab-xr` on 2026-11-07; older entries in `docs/PLAN.md` still use the old name.
