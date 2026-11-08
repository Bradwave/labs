# Handoff — Superfici 3D

Read `CLAUDE.md` (repo root) first (rules, structure, how to run and test), then `docs/PLAN.md` (plan, status, progress log).
This file only holds what those two do not: decisions taken with the user, open questions, and how to start.

## Where things stand
M0–M3 are built and work on the user's Quest 3 (run over USB with `adb reverse`, headset not on wifi). Independent surfaces,
slicing plane with snapping and conic classification, a 45-preset library with a parametric engine, offline package.
Two gaps were found on the headset: **no way to exit VR from inside the app** (the user uses the system menu), and **no settings
panel inside VR** (the left panel is a web page, hidden in VR). Next work is a floating panel and passthrough.

## Decisions already taken with the user
- Priority order: movable floating VR panel, then passthrough, then M4 domain, M5 parameters, scene link and deployment.
- **The panel is movable** (pinch its title bar) but its position is **not saved** between sessions.
- **Passthrough is a separate entry button** ("Entra in realtà mista") rather than a toggle: WebXR cannot switch VR/AR inside a session.
  A toggle inside VR may be tried, but whether the Quest Browser lets a press inside VR start a session is unverified; do not promise it.
- Buttons in VR are pressed with the **index fingertip** (poke) or the controller ray + trigger. Hands only or controllers only must both work.
- Equations are **not typed in VR** (too slow for maths): they are prepared on a computer/phone and loaded via a link or QR, later.
- Stack stays WebXR + Three.js r128, plain JS, no build step. Unity was considered and rejected unless performance becomes the limit.
- Priority content for students: conic sections first, then paraboloids, sphere, hyperboloids. Section and conic classification matter more than
  exotic surfaces.
- Grab priority: surface > axes > plane. Plane snapping in 0.25-unit steps and 6 degrees (user may find it too sticky on non-conic surfaces: it can be turned off).

## Answers received on 2026-10-26
- Hosting: **not interested for now**.
- Scene sharing: **both a short link/code (a hash) and a QR**.
- Parameters (M5): the answer was cut off; the user mentioned a set of **predefined parameters** and possibly sliders created on demand. Ask to complete it before M5.
- Domain editing was not understood: it means the region where an implicit surface is drawn (today a cube of half-size R, which cuts surfaces open at its faces). Explain it again, with a picture if possible, before M4.

## Open questions (do not decide silently; ask the user)
- Domain editing (M4): a box with draggable faces for every surface, or a sphere for round ones? (needs a clearer explanation first)
- How should students enter parametric surfaces, and before or after M5 (parameters)?

## Answers on 2026-11-02 (after v12)
- Domain editing (box): **approved**. Parameters: **must also be negative** (done, v13). A **keyboard in VR for equations**: asked for (done, v13). **QR: a must** (done, with the limits below). `npm install` of the test dependencies: **wait** (do not ask again until the user says so; use the shim in the scratchpad if needed). All the features of the user's list are to be built eventually (see the roadmap in `docs/PLAN.md`).
- Hosting was explained again: the user is not interested for now, but a QR that phones can open needs a reachable address.

## M4 and M5 (v12, unverified on the headset)
Decisions I took because the open questions were not answered (change them if the user disagrees): domain = box per surface (typed + steppers + draggable faces; no sphere option); parameters = both predefined (8 library presets) and automatic sliders for letters a, b, c, d, k, m, n; parameter sliders range 0.1–3 for custom equations. Ask: are the face handles easy to grab; do the parameter steppers (step ≈ range/24) feel right; which parameters/presets does the teacher want added. Still open: QR code for scenes (the `s3d1.` code exists), hosting (not wanted for now).

## Phases C–E (v9–v11, unverified on the headset)
Gallery with thumbnails, quick gallery on the sticks, palm gallery, scenes folder + lessons + undo + gesture history, object quick menu, probe. First thing to check on the Quest with `?monitor=1`: which button indices A/X and B/Y report and the thumbstick axes (expected `tasti[4]` A/X, `[5]` B/Y, `assi[2,3]` stick); the `palmo y=` value when the palm faces up (expected > 0.75; if it is negative, the handedness sign in `readHand` is inverted). Ask the user about: thumbnail pop-in, 3D ghost size/position above the controller, palm card position, hold time (0.5 s) for the quick menu, probe label readability, whether lessons should be edited/added (`SceneIO.LESSONS` in `scene.js`). Not built yet: QR for scenes (the code format exists), M4 domain, M5 parameters.

## Phase B (v8, unverified on the headset)
Icon tabs, grabbable frames, transformation summary, colour-blind palette. Ask the user: can both panels be grabbed from the border (is the 2 cm outer margin enough); are the icons clear; are the colours distinguishable and bold enough; is the transformation summary the right level of detail. Next: phase C (gallery with thumbnails, stick quick gallery, palm gallery), D (scenes folder, Nuova scena + undo, gesture log), E (object quick menu, probe).

## Phase A (v7, unverified on the headset)
Grip grabs, trigger points, B/Y toggles panels, hand ray + pinch click, stronger highlight, restore buttons, `?monitor=1`. Ask the user: does the hand ray appear and click where aimed; which button indices does the monitor show for A/X, B/Y and the sticks; is the vibration noticeable; is the highlight clear enough. Next: phase B (panel redesign, colour-blind palette), C (gallery + thumbnails + stick/palm quick gallery), D (scenes folder, Nuova scena + undo, gesture log), E (object quick menu, probe).

## Built after this handoff (v3, unverified on the headset)
Floating control panel (`panel.js` + `app.js`) and passthrough button. Ask the user: can the panel be grabbed by the title bar; do fingertip presses
register (thresholds `ARM`/`BACK` in `panel.js`); are buttons big enough; does the controller ray + trigger press work; does "Entra in realtà mista" start
and show the room; where should the panel start (`placePanel`).

## Waiting for headset feedback (ask the user to report)
Which object gets grabbed when pinching near a surface, an axis or the plane; whether the highlight is readable; whether the floating
section panel is comfortable to read and where it should sit; whether plane snapping feels helpful; whether the offline cache survives
closing the browser; frame rate with several surfaces (the section grid is reduced to 56 in VR).

## Starting a session
1. Ask before installing anything; if tests are wanted, `cd tests && npm install && npm test` (asks first) and expect all three to pass.
2. `python3 -m http.server 8000`; for the headset `adb reverse tcp:8000 tcp:8000`.
3. Build the next piece in `app.js`; put new pure logic (hit-testing, layout) in a testable module and test it headlessly with simulated
   fingertips, as was done for the grab logic.
4. After each piece: run the tests, bump `VERSION` in `sw.js`, add a row to the progress log in `docs/PLAN.md`, and tell the user exactly
   what is **unverified on the headset**.
