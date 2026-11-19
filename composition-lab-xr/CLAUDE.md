# Composition Lab XR

Follow `../DESIGN.md` (§17 for XR apps). Read `docs/PLAN.md` for decisions and what is next. Same conventions as `../parameter-lab-xr` (static site, no build, Three.js **r128** global `THREE`, no remote resources, code comments in Italian, UI strings in Italian **and** English with the same keys in `js/strings.js`). Always say what is **unverified on the Quest**.

AR version (prototype, 2026-11-18) of the *Composition Lab* artifact: **f on the xy plane, g on the yz plane, g∘f on the xz plane**; a number travels x → f(x) → g(f(x)).

| File | Role |
|---|---|
| `js/expr.js` | copy of Parameter Lab XR's parser plus `compileFn(src, "x"|"y")` / `tryFn` (one variable, no `eval` of user text). |
| `js/compose.js` | **pure** (global `Compose`): `chain`, `sample` (curves split at undefined/leaving the cube/jumps), `range`, `order` (keep/flip/flat per step), `Trail` (bins visited by the hand), the 9 examples. |
| `js/app.js` | THREE scene, panel on a canvas, hand/controller input, desktop camera, state and links. Test hook `window.__app`. |
| `js/grab.js` | copied from `parameter-lab-xr` (two-hand grab and scale of the stage). |
| `js/main.js`, `js/strings.js`, `css/app.css`, `index.html` | kit setup, strings, page. |

Maths (x, y, z) → Three.js (x, z, −y), cube [−4, 4]³ in stage units, stage scale 0.09 m/unit (x axis ≈ 0.72 m, within arm's reach, 0.6 m in front of the head).

Embodiment: the **hand's x is x₀** (pinch or trigger/grip near the yellow ball; a dashed thread links hand and ball; a tick on controllers at every integer); a **second hand pinching near the x axis is x₁** (left/right of the hands = order of the numbers; compare mode turns on by itself); sweeping the hand **paints g∘f** (Trace mode, predict then check); walk around instead of view buttons.

Clutter rules: planes are corner brackets and a 7 % fill, no grids, no tick numbers (numbers only on the travelling beads and the axis ends), g outside the range of f is faint, g∘f hidden until painted, panel has ten big buttons, **levels** (f · +g · +g∘f) build the composition one plane at a time. Colours: f orange, g green, g∘f violet, hand ball yellow.

Tests: `node tests/compose.test.mjs`. Headless XR check: set `__app.SRC[i].kind = "hand"`, fake `__app.hands[i].joints` (`thumb-tip`, `index-finger-tip`, Object3D with `visible = true`) and call `__app.xrInput(now, dt)`.

Advanced (page: collapsible "Advanced settings"; headset: panel button "More" opens a second page): **Trace f and g too** (the hand also draws f and g point by point; static f and g curves are hidden), **Curve in space** (x, f(x), g(f(x)) in ink, shadows are f, g, g∘f), **Travelling pulse** (a bright head with a fading tail runs at constant speed along the arrows x → f → g, then pauses; ends on the violet point at level 3). All off by default; not stored in the link.
