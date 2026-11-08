# Superfici 3D for Meta Quest 3 — project plan and status

Oct 26, 2026 · @Matteo

## Overview

Superfici 3D is a teaching app for the Meta Quest 3 where students explore surfaces in 3D with their hands and discover conic sections by slicing them with a plane. Milestones M0 to M3 are built, and you have run the app on the headset: it works. The next gap is that settings cannot be changed, or VR exited, from inside VR.

- **Audience:** students, working with hands only or with controllers; the teacher can also prepare scenes on a computer.
- **Priority content:** conic sections first, then paraboloids, sphere and hyperboloids.
- **Where it runs:** Quest Browser (WebXR), with a desktop and phone mode for preparing and checking scenes. The interface is in Italian.

## Technical decisions

The app is a static WebXR page (Three.js r128, plain JavaScript, no build step), chosen over Unity because it is shared as a link and iterates quickly.

- **Why not Unity:** it would give more performance headroom for many high-resolution implicit surfaces, at the cost of slower builds, sideloading on every headset and no link sharing. Revisit only if performance becomes the limit. Godot, Unreal and Meta Spatial SDK were considered and not needed.
- **Surface model:** a surface is either implicit, F(x, y, z) = 0, or parametric, (x(u, v), y(u, v), z(u, v)); implicit ones are meshed with marching tetrahedra on a grid (default 48 per side). Typed equations go through an own safe parser: `^` or `²`, `sqrt`, `sin`, `exp`, `pi`, implicit products such as `2x`.
- **Sections:** the cut curve is found with marching squares on the plane. The conic type (circle, ellipse, parabola, hyperbola, lines, point) is computed exactly by fitting a quadratic to the plane, which also gives the circle radius and the eccentricity. Non-quadric surfaces are labelled as non-conic curves.
- **Scene structure:** the reference system, each surface and the slicing plane are separate objects. A surface can be moved, rotated and scaled (uniformly) without changing its equation; moving the reference system moves everything.
- **Hands:** pinch (thumb and index) with hysteresis, 2.2 cm to grab and 3.5 cm to release, plus smoothing. One hand moves and rotates; a second hand pinching anywhere scales and rotates. Controllers use the trigger.
- **Delivery:** the headsets are not on wifi, so the folder is served from the computer and forwarded over USB (`adb reverse`), then cached by a service worker for offline use. WebXR needs https or `localhost`.
- **Testing without a headset:** the Immersive Web Emulator extension, plus headless tests of the maths and the grab logic.

## Requested features

Most of your original request works; the gaps are domain editing, parameters, and anything that needs a control panel inside VR.

| Requested feature | Status | Notes |
| --- | --- | --- |
| 2026-11-02 | VR keyboard, QR, negative parameters (v13) | Parameters can be negative (custom equations −3…3; waves, cone, helicoid presets symmetric). VR keyboard for equations (page + field switcher + live validation). `qr.js` QR generator (tests/test11.js; decodes with the browser's BarcodeDetector). Scene link in the URL hash (`#s3d1.…`), QR on the page and in the VR panel, adb command for the Quest, configurable public address. Root `CLAUDE.md` now imports `docs/CLAUDE.md` so new sessions load the rules. **Unverified on the headset**: keyboard key size (2.7 cm), whether the ray types comfortably; the Quest cannot scan QR codes. |
| 2026-11-02 | M4 domain + M5 parameters (v12) | **M4**: implicit surfaces are meshed and sectioned inside a box `[x0,x1,y0,y1,z0,z1]` (core: `polygonize({bounds})`, `sectionSegments(bounds)`); page fields per axis; VR Oggetto → Dominio (steppers, "Cubico", "Predefinito") and six pinchable face handles with undo. **M5**: parameter letters in equations (`compile(eq, vals)`), sliders on the page, ± steppers in VR (Oggetto → Parametri), 8 new presets in "Superfici con parametri" (ellipsoid a,b,c; sphere a; cone k; paraboloid a,b; hyperboloid a,b,c; torus a,b; waves a,k; helicoid a). Scenes and codes store bounds and parameters. Tests: `test10.js` (parser, parameters, box meshing) and updated 3/4/8; all pass. **Unverified on the headset**: face-handle grabbing feel and size (1.3 cm), cost of rebuilding while dragging, slider ranges. |
| 2026-11-02 | Phases C, D, E (v9–v11) | **C** gallery with thumbnails in the VR panel; stick quick gallery with a 3D preview and trigger to choose; palm gallery for hands. **D** scene tab: save/open/delete, built-in lessons, short code to copy/paste (desktop), "Nuova scena", single-step undo/redo, gesture history with revert. **E** object quick menu (hide, delete, original position, isolate, duplicate, lock) on trigger/pinch hold; probe (point, gradient, normal, optional tangent plane) with A/X hold or hand probe mode, pinned marker. New pure modules `thumbs.js`, `quick.js`, `scene.js`, `probe.js` with tests 6–9. All pure tests pass; flows checked in a desktop browser with simulated controllers/hands. **Unverified on the headset**: thumbstick axes and A/X indices, palm-up detection sign, hold timing, probe accuracy (sampled hit + Newton projection), thumbnail generation cost in XR, panel readability. |
| 2026-11-02 | Phase B: panel redesign and colour-blind palette (v8) | New `icons.js` (22 stroke icons shared by page and VR). VR panel redesigned: icon header (face me / exit / close), four icon tabs (Superfici, Piano, Oggetto, Vista), surface tiles with colour swatches, steppers with icons, list pages with Indietro; 0.32 × 0.39 m (was 0.53 m tall). Both VR panels (control and section card) are grabbed by a visible frame; hovering lights it up. "Oggetto" tab shows what was done to the selected surface (traslata / ruotata / ingrandita), numbers with Dettagli. Okabe-Ito palette on page, VR panel, 2D section and 3D scene (surfaces, axes, plane, back face). Page buttons and toggles have icons. Tests pass; checked in a desktop browser (light and dark). **Unverified on the headset**: frame grab feel, readability of the mono panel, the new colours on the Quest. |
| 2026-11-02 | Phase A: input and grabbing (v7) | New `pointer.js` (+ `tests/test5.js`). Controllers: grip grabs (no more preset cycling), trigger = ray pointer, B/Y collapses/expands the panels ("Menu" button). Hands: pinch with the ray presses panel buttons and selects surfaces; pinch near an object still grabs. Stronger pre-grab highlight (lightened surface, yellow box, name tag, yellow hand), vibration on hover/press/grab. New buttons: "Pos. originale" (selected surface), "Ripristina tutto", "Chiudi" in the VR panel; "Ripristina tutto" and "Pos. originale" on the page. `?monitor=1` shows raw buttons/axes in VR. Tests pass; pointer flow checked in a desktop browser with simulated controllers and hands; **unverified on the headset**: the hand ray pose, the A/B button indices, vibration, hold timings, pre-pinch latch, panel height (0.53 m). |
| 2026-10-26 | UI rework (v6) | Same visual language as Quadrature and Pendulum Lab (graph-paper background, letter tiles, ink borders, hard shadows, monospace), green/pink palette, light and dark. Desktop/phone: 3D stage with toolbar (reset, VR, mixed reality) and quick toggles (plane, hide side, flip, snapping), section card, side panel with tabs Superfici · Piano · Posizione · Aiuto; stacks on phones. VR panel and section card restyled. No remote fonts or icons (offline): system monospace. Scene background now matches the card. Checked in a browser (desktop dark, phone light); **unverified on the headset**: legibility of the monospace VR panel. |
| 2026-10-26 | Plane on/off + surface picker (v5) | New "Mostra il piano di sezione" checkbox (desktop) and "Piano di sezione" button in the VR panel: hides the plane, the section curve and the clipping. VR panel button "Scegli superficie" opens a list of the 10 groups, then the surfaces of the group (replaces the selected surface; "Indietro" goes back). Panel is taller (0.49 m). Tests pass; checked in a desktop browser with simulated actions; **unverified on the headset**: legibility and reach of the taller panel. |
| Pick from a list of famous surfaces | Done | 45 presets in 10 groups: quadrics, cylinders, tori, spirals and helices, minimal surfaces, Möbius strips and Klein bottle, surfaces of revolution, famous cubics and quartics, function graphs, periodic surfaces. Up to 6 in the scene. In VR only by controller grip until the panel exists. |
| Type an implicit equation | Done | Desktop only. |
| Type a parametric equation | Done | Typed (x(u,v), y(u,v), z(u,v), ranges) or from the library. Sections are drawn exactly but not classified as conics. |
| Several surfaces at once | Done | Up to 6, each with its own section. |
| Grab, rotate, translate | Done | One hand. Works on the Quest. |
| Pinch to enlarge | Done | Second hand, uniform scale with limits. |
| Place the surface in a 3D reference system | Done | Independent of the equation; typed position, rotation and scale on desktop. |
| Slice with a plane, parallel or not to the coordinate planes | Done | Grab it, or use sliders; snaps to axes and notable angles. |
| Parameters with sliders | Done | Letters a, b, c, d, k, m, n in an equation become sliders (page) and ± steppers (VR); 8 presets with parameters. |
| Domain without sliders or typing | Done | Box domain per surface: typed fields on the page, steppers in VR, and draggable face handles. |
| Typing available alongside | Partial | Equation and domain size on desktop only. |
| Hands or controllers only | Partial | Surface selection and equation need desktop; the VR panel is missing. |
| Conic sections as priority | Done | Cone presets, snapping, live classification, 2D section panel. |

## Additional features

You approved all of the features I suggested; about half are in the app today.

| Feature | Group | Status |
| --- | --- | --- |
| Double cone with a plane that snaps to circle, parabola and plane-through-axis | Conics | Done |
| Live 2D section panel, labelled circle, ellipse, parabola or hyperbola | Conics | Done |
| Circle radius and eccentricity readout | Conics | Done |
| Presets for paraboloids, sphere, ellipsoid, hyperboloids | Conics | Done |
| Dandelin spheres, to show why the section is an ellipse | Conics | To do |
| Challenge mode, for example tilt the plane to get a parabola | Conics | To do |
| Plane snapping to axes and numeric plane equation | Tools | Done |
| Axes with ticks, and a grid on the plane | Tools | Done |
| Controller fallback and desktop/phone mode | Access | Done |
| Reset | Tools | Partial (view reset only) |
| Undo and snapshot of the scene | Tools | To do |
| Level curves and traces on the coordinate planes | Analysis | To do |
| Tangent plane and normal at a pinched point | Analysis | To do |
| Intersection curve of two surfaces | Analysis | To do |
| Curvature or height colouring | Analysis | To do |
| Animate a parameter | Analysis | To do |
| Save and share a scene by link or QR | Sharing | To do |
| Teacher-set challenges and a guided tour of the quadrics | Teaching | To do |
| Seated mode | Access | To do |
| Passthrough, so the surface sits in the classroom | Access | To do |

## Project phases

Roadmap (the picture in the original doc, as text):

- **Built:** M0 Skeleton (scene and VR session), M1 Grab (pinch, move, rotate, scale), M2 Surfaces (equations, meshing, axes), M3 Slicing plane (sections, snapping, conics).
- **Next, in this order:** movable VR panel and passthrough; M4 Domain (drag the box faces); M5 Parameters (3D sliders for a, b, c); scene link and deployment (M7: QR, subdomain, offline).
- **After the MVP:** teaching tools (challenges, guided tour), Dandelin spheres, analysis tools (tangent plane, traces), sharing and comfort (undo, seated, snapshots).

The movable VR panel and passthrough come first because VR sessions cannot yet be controlled from inside the headset. M6 (presets and several surfaces) is largely covered by M3, so it is not drawn separately.

## What has been done

M0 to M3 are built and packaged, and the first Quest 3 test worked.

- **M0 to M2:** WebXR skeleton, grabbing with smoothing, equation parser, surface meshing, axes with ticks, 8 presets.
- **M3:** reference system, surfaces and plane as independent objects; slicing plane with clipping of one side, section curve, snapping, plane equation shown on the plane; section classification with a 2D panel on desktop and a floating panel in VR; several surfaces at once; hover highlight of the object a pinch would grab.
- **Packaging:** a downloadable static project (`superfici3d-project.zip`) with Three.js bundled, a service worker and manifest for offline use, a README and the tests.
- **Checks on my side:** the sphere's area and volume match 4π and 4π/3; sections of the cone at 30°, 45° and 60° give ellipse, parabola and hyperbola; sections stay correct after moving, rotating or scaling a surface; grabbing a surface, an axis or the plane moves only that object; the page loads from a local server and reloads offline.
- **Check on your side:** you ran the app on the Quest 3 over `adb reverse` and it works.
- **Not tested on the headset by me:** hand-tracking feel, the picking distances and the offline cache on the device.

## Headset test findings and known limits

The first Quest 3 test exposed two gaps that block comfortable use in VR; both come from the control panel being a web page that is hidden in VR.

- **No way to exit VR from inside the app.** For now, use the system menu: pinch with the palm facing you, or press the Meta button on a controller.
- **Settings are not visible in VR.** Equation, surface type, domain size, plane controls and show/hide are only on the desktop page. A controller grip cycles surface types.
- **Still unchecked on the headset:** distances for grabbing a surface, an axis or the plane; legibility of the highlight; comfort of the floating section panel; the feel of plane snapping; offline reload from the cache.
- **Model limits:** implicit surfaces are open where they leave the domain cube; the cone shows a small artefact at its vertex; at most 6 surfaces; non-quadric sections are drawn but not named.
- **Typing in VR is slow for maths,** so equations will be prepared outside the headset (see next steps).

## Next steps

Updated order: a movable floating panel and passthrough come first, because VR sessions cannot be controlled from inside the headset and the surfaces should be able to sit in the classroom.

1. **Floating VR panel, movable.** Grab it by its title bar with a pinch and place it anywhere; two hands resize it; an option keeps it facing you. Buttons are pressed with the index fingertip or the controller trigger. Contents: Exit VR, reset view, previous and next surface type, add, delete, show or hide, plane tilt, direction and distance, side hiding and flip, snapping, domain size.
2. **Passthrough (mixed reality).** A second entry button starts a passthrough session so the surfaces sit in the room: transparent background, floor grid hidden. Switching between VR and passthrough most likely needs leaving and re-entering the session; this has to be verified on the headset.
3. **M4, domain.** A box around each surface whose faces are grabbed and dragged, with typed bounds as a precise alternative.
4. **M5, parameters.** Parameters such as a, b, c detected in the equation, each with a 3D slider.
5. **Scene link and deployment (M7).** A link or QR code that loads a prepared scene on the headset; publish to a subdomain, verify offline use, and set cache headers so updates reach the headsets.
6. **After the MVP.** Challenge mode and guided tour, Dandelin spheres, tangent plane and normal, intersection of two surfaces, level curves and traces, parametric input, height or curvature colouring, parameter animation, undo and snapshots, seated mode.

M6 (presets and several surfaces) is already largely covered by M3.

## Run, test and deploy

The project is a folder of static files, so running it means serving that folder.

**On the Quest 3 without internet on the headset**

1. Unzip `superfici3d-project.zip` and open Terminal in the `superfici3d` folder.
2. Start the server and leave it open: `python3 -m http.server 8000`.
3. With the headset plugged in and USB debugging allowed, check `adb devices`, then run `adb reverse tcp:8000 tcp:8000` in a second window.
4. In the Quest Browser open `http://localhost:8000`.

The port forwarding disappears when you unplug the headset or restart `adb`, so repeat step 3 each session.

**On a computer, without a headset.** Open `http://localhost:8000` for desktop mode, or install the Immersive Web Emulator extension in Chrome or Edge to simulate hands and controllers.

**Offline in class.** After one load of the same address, the service worker caches the files. Unplug, close the browser, reopen the same address, and check it still loads; repeat after Horizon OS updates. This has been tested on desktop only.

**Publishing a new version.** Change `VERSION` in `sw.js`. If the site is behind Cloudflare, do not let `sw.js` or `index.html` be cached aggressively, or headsets keep the old version.

**Tuning by feel.** The constants most likely to change after headset tests are the smoothing and pinch thresholds in `grab.js`, and the grab distances, snapping tolerance and scene size in `app.js`.

## Risks and open decisions

The biggest risk is entering equations inside VR; the rest can be tuned with testing.

| Risk | Mitigation |
| --- | --- |
| Typing equations in VR is slow | Prepare scenes on a computer or phone and load them on the headset by link or QR; keep typing on desktop. |
| Hand-tracking precision for placing the plane | Snapping to axes and notable angles; tune thresholds on the headset. |
| Performance with several or high-resolution surfaces | Default resolution 48; section grid reduced in VR; move to Unity only if it becomes the limit. |
| Invalid or singular equations | Cells with undefined values are skipped; clear error messages in Italian. |
| Offline cache on the headsets after OS updates | Test after each update; version number in `sw.js`. |

Decisions still open:

- **Domain interaction:** a box with draggable faces for all surfaces, or a sphere for round ones.
- **Parametric surfaces:** how students enter them, and whether they come before or after parameters (M5).
- **Hosting:** which subdomain to use and how the school devices will load it.
- **Scene sharing:** link only, or link plus QR code shown on screen.

## Roadmap of the remaining requested features (all to be built, in this order)

1. Level curves and traces on the coordinate planes, plus the probe's coordinate/gradient display refinements.
2. Dandelin spheres.
3. Challenge mode (e.g. tilt the plane to get a parabola) and a guided tour of the quadrics; teacher-set challenges (scene + goal).
4. Height or curvature colouring; animation of a parameter.
5. Intersection curve of two surfaces.
6. Seated mode; multi-level undo (the single-slot undo and the gesture history are the starting point).
7. Later: reading a scene from the headset (only if a camera API ever becomes available), hosting (not wanted for now).

## Progress log

Newest first; add a row each time something is built or tested (Claude Code: please keep this table current).

| Date | Item | Note |
| --- | --- | --- |
| 2026-10-26 | Stale cache fix (v4) | Service worker now bypasses the browser HTTP cache (`cache: 'reload'` at install, `'no-cache'` on fetch), because `python3 -m http.server` sends no cache headers. The page shows "Versione: superfici3d-vN" under the VR buttons. Checked only by reading the code: the browser pane lost access to the local server before the new worker could be exercised. |
| 2026-10-26 | Floating VR panel + passthrough (v3) | New `panel.js` (layout, hit-test, fingertip poke, controller ray; pure, `tests/test4.js`). Movable control panel (pinch the title bar, two hands resize, optional "Guardami"): exit, reset, previous/next/add/delete/show-hide surface, plane θ/φ/d, hide side, flip, snapping, domain R. Second button "Entra in realtà mista" (`immersive-ar`, transparent background, floor grid hidden). Checked in a desktop browser with simulated fingertips and actions; **unverified on the headset**: poke feel and depth thresholds, button size, panel placement, controller-ray press, passthrough start. |
| 2026-10-26 | Surface library | 45 presets in 10 groups, with a parametric engine (typed or preset): spirals, helicoid, torus, shell, Möbius strip, Klein bottle and more. Tests pass; package and web page updated. Next: floating panel. |
| 2026-10-26 | Priorities | Movable floating panel and passthrough set as the next work; plan and roadmap updated. |
