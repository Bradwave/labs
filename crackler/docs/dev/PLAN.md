# Crackler · structure, risks, Phase 1 plan

No app code written yet. Waiting for your confirmation of STYLE.md and of the decisions marked **DECISION** below.

## 1. File structure

```
index.html                 markup, help dialog
css/style.css              tokens, components, layouts (same sections as the siblings)
js/
  main.js                  entry point: wiring, responsive arrangement, main loop
  dom.js  util.js          $, $$, clamp, formatting helpers
  i18n.js                  ALL strings (it, en), t(), setLang(), applyI18n(root)
  mathtext.js              tiny markup -> HTML / SVG / canvas-Unicode (v_x, \theta, m/s^2)

  # pure math, no DOM, Node-tested (test/*.test.js)
  calibration.js           scale, origin, axes, y-flip; pixel<->world (later: homography, lens)
  derive.js                velocity, acceleration, smoothing, generic derived series
  homography.js lens.js    Phase 3 (pure), listed here so the tree is final
  fit.js  integrate.js     Phase 2 (pure): fits, R^2, slope, trapezoid area
  tracks.js                point mass data model (+ later CM, vector, tape, ...)
  autotrack.js             Phase 3, template matching on ImageData (pure)
  table.js                 column definitions and row building (pure), CSV text
  project.js               serialise/parse JSON, schema version, migration (pure)
  history.js               undo/redo (snapshots of project data) (pure)

  # browser-bound
  frames.js                frame access layer (the ONLY file touching <video>)
  frames-synthetic.js      same interface, frames drawn from a model (test clip)
  plot.js                  canvas plot renderer (+ pure scale/tick helpers tested)
  ui/
    layout.js              panels, tabs, responsive arrangement
    stage.js               video canvas: draw, zoom/pan, overlays, pointer + touch
    loupe.js               touch magnifier
    transport.js           frame slider, step, play/speed
    panel-clip.js  panel-calib.js  panel-tracks.js  panel-table.js  panel-plot.js
    controls.js            segBind, bindR, toast, dialogs (from the siblings)
test/                      node --test files, one per math module
README.md  LICENSE  CNAME  .gitignore  package.json ({"type":"module", scripts.test})
```

`package.json` only declares `"type":"module"` and `"test": "node --test"`. Node v26 is already installed here and `node --test` ships with it, so **no packages to install**.

## 2. Where I disagree with, or want to refine, the brief

1. **Memory budget is the real constraint.** An `ImageBitmap` is uncompressed RGBA: 640×360 = 0.9 MB, 960×540 = 2.1 MB, 1280×720 = 3.7 MB per frame. A 10 s clip at 30 fps = 300 frames = 276 MB at 640 px, 620 MB at 960 px. iOS Safari will kill the tab somewhere around that. Plan: default max width 640 px; default budget 400 MB desktop / 200 MB phones (detected via `navigator.deviceMemory`/UA, user-adjustable); the dialog shows `frames × w × h × 4` and the resulting frame count, and offers "use every 2nd frame" or "lower resolution" before extracting. If this proves too tight, `frames.js` can keep frames as compressed WebP blobs and decode a small LRU window of `ImageBitmap`s behind the same interface (about 10× less RAM, a few ms decode per step). I'd do it only if you hit the limit.
2. **Extraction by playback takes real time and can drop frames.** `requestVideoFrameCallback` only fires for frames the compositor presents. A 10 s clip takes ≥10 s to extract, and a busy main thread skips frames. Mitigation: play at a reduced `playbackRate` (start 0.5×, auto-halve and restart if gaps are detected, max 2 retries), `muted` + `playsInline` (required on iOS), and compare successive `mediaTime` deltas to the median to flag **duplicated** (delta ≈ 0) and **dropped** (delta ≈ k × median) frames. Warn, never silently interpolate. Phone footage is often variable frame rate, so `timeOf(n)` returns the true `mediaTime`; the "frame rate" in Clip settings can override it with uniform spacing.
3. **Small extension of the `frames.js` interface.** Your five members cannot cover "trim before extraction" and "estimate memory before extracting". Proposal: add `probe(file) -> {duration, width, height}` and make `load(file, {start, end, maxWidth, step, budget, onProgress, signal})` take options; add `width`, `height`, `warnings`, `dispose()`. The measurement code still only uses the five you listed plus `width/height`. **DECISION: OK?** `probe()` does use a `<video>`, still inside `frames.js`.
4. **Synthetic test clip, two layers.** Encoding a ball-in-free-fall into a real video via `MediaRecorder` gives WebM on Chrome/Android, MP4 on Safari, with jittery timestamps: bad ground truth. So:
   - `frames-synthetic.js` implements the exact `frames.js` interface but draws frame *n* directly with a known model (`y = y0 − ½ g t²`, known px/m scale, known fps). This tests the whole pipeline (calibration → tracking → derive → fit) with exact timestamps. Also runs as an automated check: tracking the ball at its true pixel positions must give g within tolerance, and that check can run in Node using only the math modules.
   - A "Download as video" button records the same animation with `MediaRecorder` (best effort) so you can test the real extraction path and hand the file to students.
5. **Math rendering: no KaTeX.** KaTeX/MathJax is a dependency, ~300 KB + fonts, and breaks inside canvas text anyway (plot axes, overlays). I propose `mathtext.js`: a one-line markup (`v_x`, `a_y`, `\theta`, `m/s^2`) rendered as `<sub>/<sup>` + Greek Unicode in HTML, as tspans in SVG, and as Unicode (vₓ, aᵧ, θ, m/s²) on canvas. It covers all quantities in the brief. Full formula typesetting (fits like `A e^{-bt}`) will be shown in plain-text form with superscripts.
6. **Phase 1 is big; I suggest splitting it.** 1a: frames + clip settings + transport/zoom/pan + calibration + single point mass + table + synthetic clip + tests. 1b: multiple masses/colour/markers, derive/smoothing, plot, save/load, undo/redo. You review after each. **DECISION: split or one phase?**
7. **Touch.** Page pinch-zoom is blocked only on the video canvas (`touch-action:none`, plus a `gesturestart` `preventDefault` for iOS Safari), not globally (`user-scalable=no` would hurt accessibility, and the siblings don't use it). The loupe, 44 px targets and two-finger pan/pinch land in Phase 1 because they decide the stage's input model. Plot touch selection is Phase 2.
8. **Fonts** come from Google Fonts like the siblings. That sends an IP address to Google, never video data; it also needs a network. I can self-host Space Mono and the icon font instead (needs a font download, which I'd ask you about first). **DECISION: keep as siblings?**
9. **Domain / repo:** I assume `crackler.matephis.com` for `CNAME` like the others. Tell me otherwise.

## 3. Key technical choices (Phase 1)

- **Coordinates**: frame pixels (after downscale) are the base. `calibration.js` holds origin (px), axis angle, y-inversion flag, scale (px per unit, from stick endpoints + length + unit). `pixelToWorld(p)` and `worldToPixel(w)` are inverses; the transform is a plain function chain so homography and lens correction slot in before it in Phase 3 without touching callers. Per-frame origin (camera motion) is also a Phase 3 hook: the functions will take the frame index even if Phase 1 ignores it.
- **Data model** (`project.js` shape, JSON-safe): `{version, clip:{start,end,step,fps,tOffset}, calibration, tracks:[{id,name,color,marker,visible,mass,points:{[frame]:[px,py]}}], ui}`. The video file is **not** stored, only name, size and duration so the app can ask for it again on load.
- **Time**: `t(n) = timeOf(n) − timeOf(tZeroFrame) + tOffset`, with a "frame rate" override giving uniform `t = (n − n0)/fps`.
- **Derivatives** (`derive.js`): velocity and acceleration by local least-squares polynomial (degree 1 for v, 2 for a) over a window of half-width k frames, k = 0 giving plain central differences (one-sided at the ends). Works with non-uniform times and missing frames. Slider "smoothing" = k.
- **Table**: rows = marked frames; selectable columns (t, x, y, v_x, v_y, v, a_x, a_y, a per mass); copy (TSV, pastes into spreadsheets) and CSV; clicking a row seeks the video.
- **Plot**: canvas, any variable vs any other, several series, autoscale or manual limits, click/tap picks the nearest point and jumps to its frame.
- **Undo/redo**: snapshots of project data (frames are never in the history), capped at 100, coalescing drags into one entry.
- **Frame display**: `getFrame(n)` → `drawImage` into the stage canvas with a camera (zoom/pan) transform; playback is a timer stepping the frame index at `fps × speed`, not the `<video>` element.

## 4. Tests (Phase 1 scope)

`node --test`: calibration round-trip and rotation/flip, finite differences and smoothing (exact on polynomials; g from a parabola), table/CSV, project save→load round-trip, undo/redo, i18n (every key present in both languages, no unused keys), mathtext. Homography, lens, fits, integration, slope arrive with their phases. The synthetic-clip pipeline check runs in Node.

## 5. Phase 1 plan (assuming the split)

**1a: from file to first measurement**
1. Skeleton: `index.html`, `css/style.css` (tokens + shared components copied from the siblings), `i18n.js` with language switch, `mathtext.js`, theme toggle, help dialog.
2. `frames.js` (`probe`, `load` with trim, resolution, budget, progress, gap/duplicate warnings) and `frames-synthetic.js`.
3. Stage: draw frame, zoom/pan (wheel, drag, pinch, two-finger pan), frame slider, step buttons, play with speed, keyboard shortcuts.
4. Clip panel: start/end/step, frame rate, time offset, t = 0 at any frame.
5. Calibration panel: stick, movable origin, rotatable axes, y inversion, unit; on-canvas handles with 44 px touch targets.
6. One point mass: click to mark, auto-advance, drag to correct, loupe on touch; table with row ↔ frame link, copy/CSV.
7. Tests for the above math; phone-width (360 px) and landscape pass in the browser.

**1b: complete Phase 1**
8. Several point masses (colour, marker, visibility, mass), track list panel.
9. `derive.js` + smoothing, velocity/acceleration columns.
10. `plot.js` and plot panel, click-to-jump.
11. `project.js` save/load, `history.js` undo/redo.
12. README (students + developer guide), tests, synthetic-clip end-to-end check (fitted g).

## 6. What I need from you

1. OK on STYLE.md, in particular: Quadrature-style code formatting, and the proposed green palette and wordmark.
2. The four **DECISION** items: interface extension for `frames.js`, split Phase 1 into 1a/1b, keep Google Fonts, domain.
3. Permission for the one non-code file `package.json` (no installs involved).
