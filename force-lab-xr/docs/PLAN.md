# Force Lab XR — prototype plan

Status: **prototype v0.1 built** (2026-11-09, plan and build with Opus 5.5). Name and slug: **Force Lab XR**, `force-lab-xr`.
Start with `../CLAUDE.md` (this lab's) for the file map; this plan holds the decisions. Everything XR is **unverified on the Quest**.

## Decisions taken with the user (2026-11-09)
- Force zones: one uniform force per box, several boxes (they add up). Forces in newtons, the mass matters.
- Rubber band: pulls only; rest length = distance when it attaches; **dead zone increased to 15 cm** (`BAND.slack`), and the band **dangles**
  (a sagging curve of the right length, toward the floor) while it is slack. Stiffness 4 N/m, cap 3 N, reach 2.5 m.
- Gravity: off on most tracks, low g = 1 m/s² on track 8; Earth only in the sandbox; slow motion ×½ ×¼.
- **Rotating the track helps with how the user can move their arms**: the stage can be moved, rotated freely (not only yaw) and scaled
  with the knob under the start pad (two hands scale). Physics runs in stage coordinates, so this is comfort, not a puzzle element.
- Palette approved (petrol `#2BA3B4`, burnt-orange accent, yellow ball). Catching the ball in flight cancels the run. Reference solutions in the tests.
- Controls and gestures as in §2 (accepted). The extras of §1.9 (retry tap, desktop mode, passthrough, sandbox) accepted.

## Differences from the plan below (taken while building)
- Each zone has **three handles**: centre (move), arrow tip (force), max corner (size). The centre handle lets hands move a zone without
  making "pinch inside a zone" ambiguous with the band. Controllers can also grip anywhere inside a zone to move it.
- Desktop: the ball and handles are dragged in a **horizontal plane** (Shift = vertical), so a throw can go down the track; the HUD is drawn
  over the stage on screen and floats next to the track in the headset.
- No swipe on the palm card yet: the ◀ ▶ buttons (poke or ray) change track.
- The prediction is drawn while the ball is in the hand too (with the current estimated release velocity): an aiming aid on the tracks that allow it.

A WebXR lab for the Quest Browser (and desktop) about the relationship **force → acceleration → velocity**.
The student throws a ball and steers it through a track of gates using **force zones** and an **elastic band**.
The point of the game is the physics: every frame the ball shows v, a and F, and the tracks are chosen so that
each one makes one idea unavoidable.

---

## 0. Read first (for the developer)

- Repo rules: `../CLAUDE.md`, `../DESIGN.md` §2 (identity), §3 physics tokens, §7 language, §15 PWA, §16 repository, **§17 XR apps**.
- There is **no XR kit in `kit/`**. The "XR kit" today is §17 plus modules duplicated in the two XR labs.
  Use **`../surface-lab-xr`** as the reference (its `CLAUDE.md` is the best guide to WebXR on the Quest in this repo) and
  **`../orbit-lab-xr`** as the smaller example of an XR lab with a simulation.
  - Copy unchanged: `three.min.js` (r128), `grab.js`, `pointer.js` (identical in both labs).
  - Copy and adapt: the canvas-panel pattern (`surface-lab-xr/panel.js`: layout, hit-test, poke, ray, canvas draw),
    the quick/palm gallery logic (`surface-lab-xr/quick.js`, `palmUp` in its `app.js`), `?monitor=1`, `buzz`, service worker.
  - Once this is the third lab using them, those modules are candidates for a `kit/xr/` (not in this prototype).
- Stack: static site, **no build**, plain JS, Three.js r128 global `THREE`, **no network** (headsets offline), code comments in Italian
  (like the other XR labs), UI strings **Italian and English**.
- `tools/new-app.mjs` makes a **2D** lab from `template/` and refuses an existing folder: do not use it. Scaffold by hand like
  `orbit-lab-xr`, add the app to `apps.json` (`kind: "xr"`), then `node tools/sync-kit.mjs force-lab-xr`.
- You cannot test on the headset. Test pure logic in Node, simulate hands/controllers like `surface-lab-xr` does,
  and list everything **unverified on the Quest** at the end of each phase.

---

## 1. Critical analysis of the brief (decisions taken in this plan)

### 1.1 What the lab teaches (keep this the centre)
1. **a ∥ F_net, always; v is not.** The ball always shows three arrows: v (green `--vel`), a (magenta `--acc`), F_net (red `--force`).
   Students see that the acceleration points where the net force points, while the velocity can point anywhere.
2. **F along v changes speed, F across v changes direction.** Option "split a": a_∥ (along v) and a_⊥ (across v), dashed.
   This is the one extra feature that matters most: it explains every track.
3. **Same force, different mass, different acceleration** (a = F/m), while gravity accelerates every mass equally. Mass is a track
   property (and a sandbox option), so force zones are **forces in newtons**, not acceleration fields.
4. **No force → constant velocity** (Newton's first law): zero-g tracks with no drag.

Everything that does not serve one of these is left out of the prototype.

### 1.2 Force zones: uniform or variable inside the box?
Variable fields (a direction/magnitude per point, painted inside the cube) **would make the app too complicated**: hard to edit
with hands, hard to read (the arrow you see is not the force the ball feels), and hard to reason about, which kills the puzzle.
**Decision: one uniform force per box**, with any number of boxes (track limit). **Overlapping boxes add** (superposition,
shown by the net-force arrow): non-uniform fields arise from combining boxes, and that is itself a lesson.
Later, one more kind could be worth it: a **central zone** (force toward/away from a point, for circular motion). Not in v0.1.

Box details: axis-aligned in the stage frame (no rotation, so resizing stays simple); size 0.2–2 m per side; one big arrow at the
centre whose **tip is a handle** (direction + magnitude: length = 0.5 m per newton); snapping to the 26 axis/diagonal directions
within 8° and to 0.05 N steps (option). A faint 3×3×3 grid of small arrows inside shows "same force everywhere".

### 1.3 Elastic band
- A **rubber band, not a spring**: it only pulls (slack when shorter than its rest length). A spring that also pushes is
  physically fine but useless here (you cannot compress it from a distance) and confusing.
- **Rest length = the ball–hand distance when the band attaches** (no jolt on attach), plus a **dead zone δ = 3 cm** that absorbs
  hand tremor: `F = k · max(0, d − L0 − δ)` along hand→ball. This is the "rest position near the ball with a dead zone" of the brief,
  made precise: slack band = no force, the student must *pull* to apply force.
- k = 4 N/m, force capped at 3 N, reach 2.5 m (beyond that the trigger shows "too far" and buzzes).
- The band is drawn as a line that is grey/dashed when slack and turns force-coloured and thinner as it stretches.
- **Risk:** the hand is an unlimited source of force, so the band can trivialise every track. Hence each track declares
  `band: true/false`. Band tracks are their own family (circular motion with the hand at the centre is the highlight: hold the band
  taut while the ball circles you → centripetal force).

### 1.4 Launching
- Release velocity from **position history**, not the last frame: least-squares line through the grip positions between
  110 ms and 15 ms before release (hand tracking: 140–30 ms, because the release is detected late). Cap 4 m/s.
  `XRPose.linearVelocity` may exist in the Quest Browser: read it if present, but trust the estimator (compare both in `?monitor=1`).
- A run starts when the ball is **released inside the start zone** (a sphere at the start pad). Grabbing the ball during a run
  **voids the run** (gates and timer reset). Otherwise catching it mid-flight would be the solution to every track.

### 1.5 Room scale, gravity and time
- Tracks must fit a small room: x ∈ [−2, 2] m, y ∈ [0.6, 2.1] m, z ∈ [−4, 0.5] m, the user at the origin facing −z.
  Ball speeds 0.3–2 m/s, accelerations 0.2–3 m/s².
- **Earth gravity is far too strong for room-scale tracks** (a ball falls 1 m in 0.45 s). Gravity is a **track property**:
  off (most tracks), **low g = 1 m/s²**, or Earth only in the sandbox (with slow motion). Weight drawn in `--pos` blue (DESIGN §3).
- **Slow motion** ×1, ×½, ×¼ (option): a big help to read the arrows.
- Leaving the play volume (6 × 3 × 6 m box around the track) = ball lost, automatic retry after 1 s.

### 1.6 Rotating and scaling the track
- With gravity off, rotating the track changes nothing physically (space is isotropic), so it cannot be a puzzle there.
  With gravity on, **tilting** is a real puzzle ("tilt the track so gravity does the work"), but it needs full rotation handles
  and careful explanation. **Later**, as a dedicated track family.
- In v0.1 the track lives in a **stage** that can be moved, turned around the vertical axis (yaw) and scaled for **comfort**
  (fit the room, seated use). Physics runs in **stage-local units**: hand positions are converted world → stage, release velocity
  is divided by the stage scale, gravity stays stage −y. So scaling changes the look, never the difficulty.

### 1.7 Path and gates
- The gates are the rule; the **path is a hint** (dashed Catmull-Rom curve through the gates, 35 % opacity).
  Scoring deviation from the path is hard to make fair: later.
- Gate types (three only):
  - **ring** (radius 15–30 cm, has a direction: crossing backwards does not count);
  - **speed ring**: also needs |v| ≥ v_min at crossing (shows the number; teaches speed vs velocity);
  - **target** (finish only, a sphere): the ball must be inside with |v| ≤ v_max (braking tracks).
- Crossing is tested on every physics step on the segment p₀→p₁ (no tunnelling at any speed).
- Gates in order; the next gate glows, passed gates turn green, the timer runs from launch.
- **Medals** by time (gold/silver/bronze), saved per track. A second score later: fewest zones / least total force.

### 1.8 Prediction line
Showing the future trajectory (with the current zones, no band) is a strong teaching tool **and** solves the puzzle for you.
It is a per-track flag (`predict: true` on the first tracks), always on in the sandbox, plus an option a teacher can force on.

### 1.9 Things the brief did not mention but the prototype needs
- **Retry** must be one tap (it is the most frequent action in a challenge game).
- **Desktop mode** that is actually playable (throw with the mouse, edit zones, gallery, options): needed for development,
  for headless tests and screenshots, and for students without a headset.
- **Passthrough (AR)**: a second entry button like Surface Lab XR; a ball flying through gates in your room is the strongest
  "wow" for almost no code.
- **Sandbox**: no gates, every tool, gravity and mass selectable.

---

## 2. Controls

### 2.1 Controllers (Quest Touch, mirrored on both hands so left-handers work)
Critique of the proposed mapping: **long-press grip to reset conflicts with holding the ball** (students hold it for seconds while
aiming), and reset is the most frequent action, so it deserves a tap. **Surface Lab XR already uses stick-up for its quick gallery
and B/Y for panels**: one control language across the XR labs is worth keeping.

| Input | Action |
|---|---|
| **Grip** (hold/release) | grab the ball near the hand (≤ 12 cm) and throw it on release; grab a zone (inside it) to move it; grab a handle (arrow tip, resize corner) to drag it; grab the stage base to move/turn/scale (second hand scales) |
| **Trigger** | priority: panel under the ray → click; zone handle under the ray → drag it from afar; otherwise → **elastic band** to the ball while held |
| **A / X** tap | new force zone in front of the controller (if the track allows one more) |
| **A / X** hold 0.6 s (ring fills) | zone quick menu for the pointed/nearest zone: delete, duplicate, 0 N, snap on/off |
| **B / Y** tap | **retry**: ball back to start, gates and timer reset |
| **B / Y** hold 0.6 s (ring fills) | options panel open/close |
| **Thumbstick up** | tracks gallery on this controller (as in Surface Lab XR); left/right = previous/next track, trigger = play it, stick down or B/Y = close |
| Thumbstick left/right (gallery closed) | free in v0.1 (candidate: snap-turn the stage by 30°) |

Hold actions show a **progress ring on the controller** (and the label of what will happen).
Button indices (xr-standard: 0 trigger, 1 grip, 3 stick press, 4 A/X, 5 B/Y; stick `axes[2,3]`) are **still unverified on the
Quest** in the other XR labs: carry over `?monitor=1` and check it first.

### 2.2 Hands
Critique: hand tracking is weakest exactly at fast throws and needs few, robust gestures. Instead of inventing a gesture per action,
use **three gestures and one palm menu**.

| Gesture | Action |
|---|---|
| **Pinch or fist near the ball** (≤ 8 cm) | grab; open the hand to throw (same estimator, earlier window) |
| **Pinch near a zone handle** | drag it (as the face handles in Surface Lab XR) |
| **Pinch with the hand ray on a panel** | click |
| **Pinch anywhere else** | **elastic band** while held |
| **Palm up for 0.4 s** | **palm menu** above that hand: Retry · tracks (3D mini + ◀ ▶) · + Zone · Options. Poke with the other index; a sideways **swipe** over the card also changes track (optional, poke arrows are the reliable path) |

The pinch is overloaded on purpose and resolved by distance: near the ball = grab, near a handle = drag, ray on UI = click,
otherwise band. Delete a zone: pinch-and-hold a handle 1 s → quick menu.

### 2.3 Desktop
Right-drag orbit, wheel zoom; left-drag the ball and release to throw (in the plane facing the camera); left-drag handles;
Space held = band toward the mouse point; keys **R** retry, **G** gallery, **O** options, **F** new zone, **Del** delete selected zone.

---

## 3. Physics and numbers

- State: p, v (stage-local, metres), mass m (default 0.5 kg), ball radius 4 cm.
- Forces: Σ zones containing the ball centre + band + m·g. a = F_net / m.
- Integrator: semi-implicit Euler at a fixed **1/240 s**, accumulator, time scale ×1/×½/×¼, max 16 steps per frame.
- Zones: |F| 0–1 N (track `maxForce` may lower it), step 0.05 N.
- Band: k = 4 N/m, δ = 3 cm, cap 3 N, reach 2.5 m.
- Arrow lengths: v 0.3 m per m/s, a 0.15 m per m/s², F 0.3 m per N, with a 3 cm minimum so tiny vectors stay visible.
- Strobe trail: a dot every 0.1 s of simulation time (spacing = speed), last 6 s.
- Readouts on the HUD card: t, gates n/N, |v|, |a|, |F| (decimal comma in Italian).

---

## 4. Tracks (v0.1)

Data format (`tracks.js`, pure):

```js
{ id: 't3', name: {it, en}, idea: {it, en},            // one sentence: what this track teaches
  g: 0, mass: 0.5, predict: true, band: false,
  start: { p: [0, 1.3, -0.4], r: 0.15 },
  gates: [ { type: 'ring', p: [...], n: [...], r: 0.25 }, { type: 'speed', ..., vmin: 1.0 }, { type: 'target', p, r: 0.2, vmax: 0.2 } ],
  zones: [ { min: [...], max: [...], F: [...], locked: true } ],   // pre-placed, not editable
  maxZones: 1, maxForce: 1, timeLimit: 8, medals: [3, 4.5, 6],
  solution: { launch: [vx, vy, vz], zones: [...] } }      // reference solution, used by the tests
```

| # | Track | Tools | Idea |
|---|---|---|---|
| 1 | Straight | launch only, g 0 | no force → straight line, constant speed |
| 2 | Fast lane | launch only, speed rings, time limit | speed is the size of v; you must throw hard enough |
| 3 | The bend | one locked zone, launch only | F across v turns the ball without changing its speed |
| 4 | Your bend | 1 zone | place the force yourself (mirror of 3) |
| 5 | Brake | 1 zone, target with v_max | F against v slows the ball down |
| 6 | Slalom | 3 zones, time limit | alternating forces; the time limit forbids slow solutions |
| 7 | Sling | band only, rings on a circle around you | a force toward the centre keeps the ball circling |
| 8 | Low gravity | g = 1 m/s², 2 zones | weight is a force too: cancel it, use it |
| — | Sandbox | everything, gravity/mass selectable | free play |

Every track except Sling ships a `solution`; a test simulates it and checks that it passes every gate within the time limit
(and that the zones respect the track limits). This guarantees the tracks are solvable and catches physics regressions.
All tracks are open from the start (a teacher must be able to jump to any); the gallery marks the suggested order and medals.

---

## 5. Panels (DESIGN §17 look: flat card, 2 px ink border, hard offset shadow plane, Space Mono on canvas, targets ≥ 4 cm)

- **HUD card** above the start pad, facing the user: track name, timer, gates, |v|, |a|, |F|, medal times; "Launch from the pad" hint.
- **Gallery** (controller or palm): one track at a time as a **real 3D miniature** (the same builder as the full track at 1/16 scale,
  turning slowly; tracks are a few primitives, so no thumbnails needed), name, idea sentence, best time and medal, ◀ ▶.
- **Options** (short on purpose): Language IT/EN · Arrows v / a / F · Forces: net / each · Split a (∥, ⊥) · Strobe trail ·
  Prediction (when the track allows it) · Slow motion ×1 ×½ ×¼ · Snap · Sandbox: gravity off / low / Earth, mass 0.25 / 0.5 / 1 kg ·
  Stage: reset position · Exit VR.
- Storage: `localStorage['force-lab-xr.v1']` (options, medals, best times).

---

## 6. Files

| File | Role |
|---|---|
| `index.html` | 2D page around the session (wordmark, info, settings; VR and AR buttons), canvas, script order |
| `physics.js` | **pure**: state, forces (zones, band, gravity), fixed step, gate crossing, target test, play-volume test |
| `tracks.js` | **pure**: track data, validation, run state machine (ready → running → passed/failed/lost), medals |
| `throw.js` | **pure**: release-velocity estimator (ring buffer, least squares, windows for controllers and hands) |
| `buttons.js` | **pure**: per-source tap/hold detection with progress (0.6 s), shared by all buttons |
| `strings.js` | it/en strings |
| `grab.js`, `pointer.js` | copied unchanged from `surface-lab-xr` |
| `xrpanel.js` | canvas panels (HUD, options, gallery card, quick menus), layout + hit-test pure, drawing in the browser |
| `app.js` | THREE scene, stage, ball, arrows, trail, zones, gates, path, XR input, desktop input, session start; `window.__app` test hook |
| `sw.js`, `manifest.webmanifest`, `logo.svg`, icons | PWA (generated by the repo tools) |
| `tests/` | `node` tests for physics, tracks (+ solutions), throw, buttons, panel layout |
| `CLAUDE.md`, `README.md`, `docs/PLAN.md` | lab docs (keep this plan's progress log current) |

---

## 7. Build phases (each ends with tests green and a list of what is unverified on the Quest)

0. **Scaffold**: `apps.json` entry (`kind: "xr"`, port 8115, description it/en, palette **once approved**), folder like `orbit-lab-xr`,
   page with wordmark/info/settings, empty THREE scene with desktop camera, `CLAUDE.md`, service worker, `?monitor=1`.
1. **Pure core**: `physics.js`, `tracks.js`, `throw.js`, `buttons.js` + tests (no-force straight line, uniform zone matches
   x₀ + v t + ½ a t², overlapping zones add, slack band gives 0, energy of a band orbit stays bounded, gate crossing at 20 m/s,
   backwards crossing ignored, speed gate, target, every track `solution` passes, estimator recovers a known velocity from noisy samples,
   tap vs hold timing).
2. **Scene + desktop play**: stage, ball, arrows, strobe trail, gates, path, HUD, retry, timer, medals; mouse throw. Screenshot.
3. **XR controllers**: grip throw, trigger band, B/Y retry/options, ring indicators, buzz, VR and AR entry.
4. **Force zones**: add, move, resize, arrow handle, snapping, track limits, locked zones, quick menu (controllers and desktop).
5. **Gallery + options + language**, 3D minis, persistence.
6. **Hands**: pinch near/far rule, fist alias, palm menu, swipe.
7. **Release**: `logo.svg` + `node tools/logos.mjs force-lab-xr`, `node tools/sync-kit.mjs force-lab-xr`, test command in `apps.json`,
   `node tools/test-all.mjs`, `node tools/screenshot.mjs force-lab-xr`, `node tools/readme.mjs`. **Ask before pushing.**

Expected size: about 2 500 lines of JS. Later (not v0.1): central zones, tilt tracks, path-deviation score, v(t) plot after a run,
replay ghost, track editor and sharing tracks by link/QR, sounds, obstacles.

---

## 8. Open questions (all answered on 2026-11-09, kept for the record)

1. **Name**: Force Lab XR (`force-lab-xr`)? Alternatives: Newton Lab XR, Dynamics Lab XR.
2. **Palette**: a new brand hue (no 2D twin). Free areas of the wheel today: deep orange, cyan/petrol, warm grey.
   To be checked with `node tools/check-palettes.mjs` before it is used.
3. **Controls**: OK with B/Y tap = retry, B/Y hold = options, stick up = gallery (as in Surface Lab XR), instead of grip hold = reset and B/Y = gallery?
4. **Rubber band** (pulls only), rest length = distance when it attaches: OK?
5. **Prediction line**: on for the first tracks only, as planned?
6. Did the `?monitor=1` check in Surface Lab XR confirm the button indices and the palm-up sign on your Quest 3? (It decides how much tuning phase 3 needs.)

## Progress log
| Date | What |
|---|---|
| 2026-11-09 | Plan written (Opus 5.5). |
| 2026-11-09 | v0.1 built: physics, 8 tracks + sandbox with reference solutions, throw estimator, buttons, panels, scene, desktop play, XR controllers and hands, zones, gallery with 3D previews, palm menu, options, it/en, PWA, logo. Tests: 12 physics, 25 tracks, 5 input, 34 panel. Checked in the browser (desktop) and with simulated controllers/hands; **nothing run on a Quest yet**. |

## Next (waiting for the first headset test)
1. On the Quest with `?monitor=1`: button indices (A/X = 4, B/Y = 5, stick `axes[2,3]`), palm `y` > 0.75 when the palm faces up (else flip the sign in `input.js`).
2. Feel: throw speed (windows in `input.js`), grab radius (12 cm controllers, 8 cm pinch), handle radius, band stiffness and dead zone, panel size and distance, the knob position.
3. Track difficulty and medal times after a few students have played.
4. Later (from §7): central zones, tilt tracks, v(t) plot after a run, replay ghost, track editor and sharing, sounds, obstacles; promote the shared XR modules to `kit/xr/`.
