# Force Lab XR

Prototype WebXR lab (Quest Browser and desktop) about **force → acceleration → velocity**: throw a ball and steer it through gates
with force zones and a rubber band. Read `docs/PLAN.md` first (decisions taken with the user, tracks, controls, what is next), then
`../DESIGN.md` §17 (XR apps). Conventions follow `../surface-lab-xr` and `../orbit-lab-xr`: static site, no build, Three.js **r128**
(`js/three.min.js`, global `THREE`), no remote resources (headsets are offline), ask before installing anything, code comments in Italian,
UI strings in Italian **and** English (`js/strings.js`; track names in `js/tracks.js`). Always say what is **unverified on the Quest**.

Unlike the older XR labs, the 2D page uses the shared kit (`../kit/kit.css`, `../kit/kit.js` via `js/main.js`): header, info, settings, language, theme, PWA.

| File | Role |
|---|---|
| `js/physics.js` | **pure**: forces (uniform zones in N, rubber band that only pulls with rest length + dead zone `slack`, default `BAND.slack`, set by `opt.slack`; weight), fixed step `DT = 1/240` (semi-implicit Euler), ring crossing, target, prediction, split of a, force snapping. |
| `js/tracks.js` | **pure**: the 8 tracks + sandbox (data in stage coordinates, metres), `validate`, `Run` state machine (ready · held · flying · free · done · failed · lost), kicks (`blast`, budget `maxBlasts`), medals, `simulateSolution`, guide path. |
| `js/input.js` | **pure**: `ThrowEstimator` (least squares over a window before release), `Button` (tap / hold with progress), `Stick`, `palmNormal`/`palmUp`, `fist`, `openHand`, `BlastGesture`, `DoubleTap`. |
| `js/xrpanel.js` | **pure layout + canvas drawing**: options, HUD, gallery/palm card, zone menu; hit-test, ray, fingertip `Poke`. |
| `js/grab.js`, `js/pointer.js` | copied unchanged from `surface-lab-xr` (two-hand grab of the stage; pointer tracker with pre-pinch latch). |
| `js/app.js` | THREE scene, zones (`ZoneView`), ball/arrows/trail/band/prediction, XR input (`xrInput`), desktop input, sessions, loop. Test hook `window.__app`. |
| `js/main.js`, `js/strings.js` | kit setup and strings. |
| `sw.js`, `manifest.webmanifest`, icons | generated: `node tools/sync-kit.mjs force-lab-xr`, `node tools/logos.mjs force-lab-xr` (from `logo.svg`). |

Frames: `scene` > `stage` (grabbable: move, rotate, two-hand scale; comfort only) > track, ball, zones, arrows, HUD. **Physics runs in stage
coordinates**: hand positions are converted with `stage.worldToLocal`, so moving or scaling the stage never changes the difficulty (and gravity
turns with the stage). The user stands at the origin facing −z; the start pad is at about (0, 1.2, −0.45).

Tests: `node tests/physics.test.mjs`, `tracks.test.mjs` (every track's reference `solution` must earn gold), `input.test.mjs`, `panel.test.mjs`
(buttons ≥ 4 cm, no overlaps). When you add a track, give it a `solution`; when you add a panel item, handle its id in `doAction`.
Headless XR checks used so far: in the page, set `__app.SRC[i]` (`kind`, `gp` with `buttons`/`axes`), write `__app.grips[i].matrix` /
`__app.ctrls[i].matrix` (XR controller groups ignore `.position`) and `visible = true`, fake `__app.hands[i].joints`, then call `__app.xrInput(now, dt)` and `__app.physics(dt)`.

Controls (agreed with the user, see the plan): grip = grab/throw ball, move zones and handles, stage knob (Options → Track size scales around the start pad, `scaleAboutStart`); trigger = rubber band (or click a
panel, or drag a handle on the ray), double tap = kick along the ray; A/X tap = new zone, hold = zone menu; B/Y tap = retry, hold = options; stick up = gallery (left/right, trigger plays,
down closes). Hands: pinch or fist near the ball = grab; pinch or fist on the knob = move/turn the track (second hand pinching = resize); pinch a handle = drag; pinch with the ray on a panel = click; pinch elsewhere = band;
fist then snapped open = kick along the palm; palm up 0.4 s = palm menu (poke ◀ ▶ or swipe the other index across the card); index fingertip pokes buttons. Button indices (`GP` in `app.js`) and the palm sign are **unverified on the Quest**:
open `?monitor=1`.
