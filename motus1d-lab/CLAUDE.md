# Motus 1D Lab — handover for Claude Code

A teaching web app for one-dimensional kinematics. Read this first, then the README for what the app does from a user's point of view.

## Working preferences of the maintainer

- **Ask before installing anything** on the maintainer's machine: npm or pip packages, Playwright, Homebrew, anything else.
- **Discuss design questions before coding them.** When asked "what do you think" or "elaborate", answer first and wait. When told "apply" or "go ahead", implement.
- **Honest feedback, not agreement.** If an idea has a cost or a better alternative, say so plainly.
- **Math in chat** in LaTeX ($…$ inline, $$…$$ display).
- **Keep public docs generic.** README and the files in `docs/` don't mention people, schools, classes, courses or specific events.
- **Testing happens on a Mac and on phones.** The app is Italian first, then English; every text exists in both.

## What it is, technically

- A static site: vanilla JavaScript ES modules, one `index.html` with all the CSS, no build step, and no dependencies to install.
- It must be served over HTTP, because ES modules don't load from `file://`. Use `python3 -m http.server 8000`.
- It is also published as a multi-file Claude artifact. The artifact version differs from this repo in two ways:
  - the artifact's `index.html` has no doctype, `<head>` or `<body>`, because the artifact host adds them;
  - its `getBase()` falls back to the artifact URL.
- Everything is client-side: scenes live in `localStorage`, and share links carry state after the `#`.
- Fonts are bundled in `fonts/`, so no third-party requests are made. The app works offline once loaded.

## Files

| File | Role |
| --- | --- |
| `index.html` | markup and all CSS (design tokens on `:root`, dark theme under `prefers-color-scheme` and `[data-theme]`) |
| `js/main.js` | state `S`, motions, scenes, undo, panels, interaction, render loop, sharing, keys, boot (~2,100 lines) |
| `js/model.js` | sections → motion model; joints, quintic blending, Savitzky–Golay smoothing, free fall with bounces, frame transforms |
| `js/draw.js` | drawn graphs: segments, splice/redraw, handles, `deleteNode`, `drawModel`, plot gallery |
| `js/views.js` | `drawGraph` (one s/v/a graph) and `drawTrack` (cart or ball); label placement layer |
| `js/plot.js` | `Plot` class (axes, grid, mapping), colour tokens `C()`, `label`, `arrow`, `hatch` |
| `js/parser.js` | expression parser (implicit products, functions, parameters, τ) |
| `js/analysis.js` | Riemann sums, crossings (meeting times), interval statistics |
| `js/gallery.js` | equation presets, challenge targets |
| `js/levels.js` | the 4 levels as feature sets, feature groups for the authoring view |
| `js/i18n.js` | `T(key, …args)` with `{0}` placeholders; IT and EN tables; `fx()` fixed decimals with the locale's comma |
| `js/share.js` | link encoding: JSON → deflate-raw → base32, prefix `m1z` (`m1j` = uncompressed) |
| `js/pdc.js` | activities mode (predict · discuss · compare): format in the header comment, step runner, recording, drawing, comparison, progress |
| `js/activities.js` | built-in activities, as data |
| `js/inflate.js` | small raw-DEFLATE decoder, used where `DecompressionStream` is missing (Safari < 16.4) |
| `js/icons.js` | custom SVG icons (tools, joints, area methods) |
| `js/vendor/qrcode.js` | qrcode-generator (Kazuhiko Arase, MIT) as an ES module |
| `fonts/` | Space Mono (OFL) and a 17 KB subset of Material Symbols Outlined (Apache 2.0) + `LICENSES.txt` |

`main.js` has banner comments (`/* ===== state */`, `/* ----- scenes */`…) that serve as its table of contents.

## Core ideas (keep them true)

1. **One motion model for every input.** Equations, drawings, recordings, free fall and challenge attempts all become a model with this shape:

   `{ T, at(t)→[s,v,a], S, V, A, pieces[{t,s,v,a}], joints[{t,status,dS,dV,dA,L,R,blend,w}], splits, range, t0, t1, raw }`

   Every analysis tool works on that model alone. New input methods must produce it; new tools must consume it.

2. **Joint status** is one of:
   - `smooth`;
   - `acorner` (a jumps, acceptable);
   - `kink` (v jumps);
   - `jump` (s jumps, teleport);
   - `coll` (deliberate impact).

   Blending replaces a joint with a quintic Hermite that matches s, v and a at both ends (C², no overshoot). Don't go back to mixing extrapolations: that caused velocity spikes.

3. **Two coordinate systems.**
   - Equation motions are stored in **view** coordinates; their text is rewritten when the frame changes (`affineText`).
   - Recordings, drawings, free fall and targets are stored in **world** coordinates.
   - Frame: $x = \text{dir}\,(w - o)$.
   - `viewOf` / `worldOf` / `transformModel` convert between them. Changing the frame must never move the motion.

4. **Motions list.** `S.motions` holds `{id, type: 'eq'|'draw'|'rec', vis, ver, data, edited, hid}`.
   - `S.cur[type]` is the current motion per editor.
   - `curM(type, create)` returns it, creating one only when asked to.
   - `S.secs`, `S.ff` and `S.draw.q/segs/s0/v0` are getters into the current motion, with dummies when none exists. Don't make them create motions; that bug produced "ghost" motions.

5. **Hiding has one meaning:** `m.hid = {s, v, a}`. A motion with all its curves hidden (`allHid`) shows nothing: no curve, areas, slopes, joints or cart, even when it is the active one. `m.vis` is legacy; old saves are converted to `hid`.

6. **An empty list is allowed.** Deleting the last motion leaves the cart alone in Drag mode. Entering Equations or Drawing then creates a fresh motion.

## Things that will bite you

- **Storage keys keep the old name** (`motus1d.v1`, `motus1d.scenes`, `motus1d.s.<id>`, `motus1d.theme`, `motus1d.hand`, `motus1d.lang`, `motus1d.base`). Renaming them would wipe everyone's saved scenes.
- **Share links must keep working forever.** The prefix carries the format (`m1z`, `m1j`). For a new format, add a new prefix and keep decoding the old ones. `applyState` validates every field: never trust link content.
- **Undo** saves a snapshot of the whole scene (`packState`).
  - `save()` records a step at once for clicks and keys, and waits 400 ms for `input`/`pointermove` events (sliders, typing). It tells them apart through `window.event`.
  - `t`, `playing`, `tab`, `nextId` and the drawing tools are not steps.
  - History is per scene and resets on scene open and link load.
- **Labels on graphs** go through `lab()` in `drawGraph` and are placed at the end by `placeLabels`, which avoids obstacles (`obstacle()`: axis band, t₁/t₂ tabs, letter tags, impulse arrows). Use `lab()`, not `label()`, for anything inside a graph. Labels can still sit on curves; the halo keeps them readable.
- **Long press** only fires when a press would just move the time cursor (`gGrab` in `cur`/`t1`/`t2`), so drawing and editing are never interrupted. The pointer tool is a one-shot mode.
- **Recording** resamples to 60 Hz (`REC_DT`). The clock restarts on the first grab. Use `performance.now()`, never the rAF timestamp: mixing them caused negative T and a freeze on iOS.
- **Icons are a subset font.** Adding a new Material Symbols icon name will show the name as plain text until the font is regenerated (see below).
- **CSS:** `.btn:active` sets `transform`. An absolutely positioned button that is centred with `transform` needs its own `:active` rule, or it jumps away under the finger (see `.gdone:active`).
- **CSS:** global `[hidden]{display:none!important}` is relied on; elements with their own `display` still hide.

## Regenerating the icon font

The subset was made from the `material-symbols` npm package (outlined, variable) with fontTools:

1. Fix the variable axes at FILL 0, GRAD 0, opsz 24, wght 500 (`varLib.instancer`).
2. Keep the glyphs for `a–z`, `0–9`, `_` and the ligature outputs of the icon names used in `index.html` and `js/*.js`.
3. Set `layout_closure=False` and keep the `liga`/`rlig`/`calt`/`ccmp` features.
4. Save as woff2 (needs `brotli`).

To find the names, intersect the identifier-like strings in the source with the font's ligature table. All of this needs Python packages: **ask the maintainer before installing them.**

## Style

- Bold, flat look:
  - sharp corners, 2 px ink borders, hard offset shadows;
  - Space Mono everywhere;
  - Material Symbols icons; few words, icons first;
  - bold blue palette (`--bg #4D7BFF`, ink `#0A1240`, accent `#FF4B2B`, tile `#FFD23F`); dark mode uses a deep navy page.
- Logo: letter tiles "m o t u (s) 1 D" plus a plain bold lowercase "lab".
- Every UI string goes in **both** IT and EN tables in `i18n.js`. Keep Italian natural, and don't translate word by word from English.
- Numbers use `fx(v)`: fixed decimals (setting `S.dec`) with the locale's decimal separator. Tick labels use `num()`.
- Code comments explain *why*, briefly, in plain English. Keep the existing tone.

## Testing

There is no test suite in the repository yet. During development the app was checked with ad-hoc Playwright scripts that served the folder and covered:

- boot with no console errors (desktop, dark mode, a 390 px phone, touch);
- motions: delete/undo, the empty list, hiding;
- drawing: strokes, editing, node deletion;
- recordings: editing samples, the Done button;
- picking (pointer, long press, table letter);
- undo/redo with quick consecutive actions;
- hand mode and the vertical track;
- share links, including decoding without `DecompressionStream`.

Worth rebuilding as `tests/` (Playwright + `python3 -m http.server`), but installing Playwright needs the maintainer's OK. At minimum, after any change:

- load the page and check the console;
- try one motion of each type;
- create and open a share link;
- check the phone layout at 390 px.

`window.motus = { S, REC, CH, plots, models, ball }` is exposed for checks from the console or from tests.

## Open items / ideas

- **Activities mode (predict · discuss · compare):** stages 1 and 2 of `docs/pdc-plan.md` are built, in `js/pdc.js` and `js/activities.js`. The mode is a full-page layer; free exploration stays exactly as it was and pauses its rendering while the layer is open.
  - Recording is a toggle (button or R) or held; the clock starts at the press, so the initial acceleration is recorded; it stops at the end of the window.
  - Questions are mostly open (free text or paper); open items can carry `read` to show what the reference says at compare.
  - Stage 2: alternative B, handover with private screens and `key: 'secret'`, act `write`, teacher reveal codes, group board.
  - Decided: no scores for students (the comparison only shows differences); retry always allowed, attempts kept; question answers locked after a reveal; every text in IT and EN; think timer optional.
  - Distribution: built-in activities, links (`{ act: { builtin, codes? } }` or the whole activity), and JSON import. Loading from a web address is not built.
  - Next: stage 3 (motion diagram, words, choose) and the authoring editor.
- **Hand tracking with the camera:** planned in `docs/hand-tracking-plan.md`, not started.

- **Split `main.js`** into modules (scenes and storage, history, picking, panels, interaction). It was deferred because most of the file shares mutable state (`S`, `dirty`, `gGrab`, `stroke`, `MEQ`, `MDR`, `REC`…). Do it step by step, with tests run after each move.
- **Real-device checks still to do:**
  - long press on iOS and Android (the system menu may grab it);
  - recording on older iPads;
  - QR scanning of long links.
- **Labels can overlap curves.** Curves could become obstacles if this matters.
- **Level 4 is dense.** For students, links at levels 1–2 work better.
- **Possible features discussed but not built:** an RMS deviation readout when a manual model is overlaid on a recording, and an "explain" step after predict (observe → explain → test).
- **README:** has a hidden placeholder for the GitHub Pages link.

## Publishing

- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / root. Share links point to the address the app was opened from (`getBase()`), unless `localStorage['motus1d.base']` overrides it.
- **Commits** end with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

  Only commit or push when the maintainer asks.
