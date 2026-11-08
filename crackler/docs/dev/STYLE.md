# Crackler · STYLE.md

What I found in **Quadrature** and **Pendulum Lab** (read in full: `index.html`, `css/style.css`, every `js/*.js` that sets conventions, both READMEs). Crackler will be a third sibling, so everything below is meant to be reused unless marked **NEW** or **DECISION**.

## 1. Shared visual language ("tiles on graph paper")

| Aspect | Convention (identical in both apps) |
|---|---|
| Page | Graph-paper background: `--bg` with two 1.5 px `--bgline` gradients, `background-size: 28px 28px`. `body` is a non-scrolling flex column (`overflow:hidden`, `height:100%`). |
| Type | **Space Mono** (400/700) from Google Fonts, 14 px / 1.45, `-webkit-text-size-adjust:100%`. Small UI text 11–12.5 px, bold for controls. `font-variant-numeric: tabular-nums` on numbers. |
| Icons | **Material Symbols Outlined** (`opsz 24, wght 500, FILL 0`) as ligature text in `<span class="ms">name</span>`, 20 px (18 px inside segmented buttons). |
| Cards | `.card`: `--surface` fill, **2 px solid `--ink`** border, **hard offset shadow `6px 6px 0 var(--ink)`** (4 px on phones). No radius, no blur, anywhere. Range thumbs are squares. |
| Buttons | `.btn`: same border + `3px 3px 0` shadow, bold 12.5 px, `min-height:36px`. `:active` → `translate(3px,3px)` and shadow removed (physical press). Variants `.primary` (accent fill), `.on` (ink fill). `.icon-btn` is 42 px square. |
| Segmented | `.seg` / `.seg.small`: bordered strip, 2 px dividers, active segment inverted (`--ink` bg, `--surface` text). |
| Tabs | Folder tabs above the panel card; active tab takes `--surface`, overlaps the card border by 2 px. |
| Toggles | `.tg` rows: swatch (arrow or dot) + label + `<small>` hint + square switch box that fills with `--accent`. Dotted `--gridline` separators. |
| Sliders | `.ctl`: label left (muted 12 px) and **bold current value right**; 4 px ink track, 22 px square accent thumb with ink border and hard shadow. |
| Numbers | `.num`: label + 74 px input, 2 px border, no radius, `inputmode="decimal"`. |
| Chips | `.lg`: 1.5 px bordered pills, dimmed when off, used for legends and quick toggles. |
| Feedback | `.toast` (ink on surface, top-centre, fades), `.hint` (small boxed caption on the canvas), `.readout` (boxed key/value grid on the canvas). |
| Help | `<dialog>` with the tile wordmark, `h2`, `h3` in accent colour, 12.5 px text, a Close button; `?` icon button in the header (phones: in the toolbar or tab row). `<kbd>` hints hidden on `(hover:none)`. |
| Header | The app name is a row of **letter tiles** (`h1.word > span`, 1.32 em squares, 2 px borders, overlapping by 2 px) coloured by role; one tile animates (Pendulum: last tile swings; Quadrature: tiles show covered/border/empty). Tagline below, `12.5px`. |

### Layout
- Desktop: `.layout` is a 2-column grid `minmax(0,1fr) | minmax(330px,420px)`, gap 22 px, `max-width:1400px`, side padding honours `env(safe-area-inset-*)`.
- Left **stage** column: `toolbar card` → `canvas-wrap card` (flex:1) → quick-chips / control bar card. Right column: **tabbed panel** (`.tabs` + `.tabpane.card`, scrolls internally, `overscroll-behavior:contain`).
- Phones, portrait (`max-width:920px` and portrait): header hidden, layout becomes a flex column: stage on top, panel below at `height: clamp(250px, 40dvh, 560px)`, shadows 4 px, button labels hidden (`.lbl`), help button moves into the toolbar / tab row.
- Short landscape (`max-height:600px` and landscape): header hidden, two columns kept (`minmax(290px,370px)` panel), quick chips hidden.
- ≤440 px: more labels dropped. `prefers-reduced-motion` kills transitions and animations.

### Theming
- Tokens on `:root`; dark overrides under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` **and** `:root[data-theme="dark"]`. Neither app has a visible theme toggle yet; both react to a `data-theme` attribute.
- Canvas code never hard-codes colours: `readColors()` copies CSS variables into a map `C` via `getComputedStyle`, re-run on `prefers-color-scheme` change and on `data-theme` mutation.

### Palettes
- Quadrature: amber `#f2b632` bg, cream `#fff4df` surface, wine ink `#3a0e12`, crimson accent `#b8262f`.
- Pendulum Lab: sky `#8CCBEB` bg, `#F5F9FC` surface, navy ink `#0B1B3A`, orange accent `#FF6A3D`, yellow `--tile2`.
- Each app has its own hue; the *structure* of the tokens is shared (`--bg --bgline --surface --ink --muted --accent --onaccent --gridline` + semantic colours for the drawing). Pendulum Lab also names physics colours the same way across the app: `--vel` green, `--acc` magenta, weight blue, tension red. **Crackler will reuse those physics hues for velocity/acceleration** so students see the same colour language across all three apps.

## 2. Code conventions

- Plain ES modules, `<script type="module" src="js/main.js">`, no build, no deps. Flat `js/` folder, one concern per file, `css/style.css` single stylesheet, `index.html` holds all static markup and the help dialog.
- Every file opens with a header comment: `// App · file.js` + one line saying what it owns. Sections are marked `// ---------- name ----------`.
- `$` / `$$` = `querySelector` / spread `querySelectorAll`, defined once (`dom.js` or `util.js`).
- State is a few plain exported mutable objects (`st`; or `P`, `LY`, `S`), not classes, no store library. Modules import from each other freely (main imports everything; `state.js` is the hub).
- Canvas: DPR-aware `resize()` via `ResizeObserver`; one `draw()` driven by `requestAnimationFrame` or an on-demand `req()`; world↔screen helpers `w2s/s2w`; pointer input via Pointer Events + `setPointerCapture`, `touch-action:none` on the canvas.
- UI wiring helpers: `segBind(id, fn)` / `segSet`, `bindR(sliderId, labelId, get, set, show)`, `toast(msg)`, delegated click on `[data-ly]` for toggles.
- Dynamic panels are built with template strings assigned to `innerHTML`.
- Math/number formatting is tiny and hand-written (`fmt`, `fmtPM`, `niceTicks`); sub/superscripts are `<sub>`/`<sup>` in HTML, `<tspan baseline-shift>` in SVG, Unicode (θ, ω, ², ₀, −) on canvas. **No KaTeX/MathJax anywhere.**
- Persistence: `localStorage` with a versioned key (`quadrature.series.v1`). CSV goes to the clipboard with a `<textarea>` fallback when clipboard access is blocked.
- Repo hygiene: `LICENSE` (MIT), `CNAME` (`<app>.matephis.com`), `.gitignore` (`.DS_Store Thumbs.db .vscode/ node_modules/`), README with feature list, "run locally with `python3 -m http.server 8000`", GitHub Pages steps, and a code-structure tree. Footer line: "Vibecoded with Claude, with <3."
- Tests: **neither app has any.** Crackler's Node tests are new.

### The two apps differ on formatting
Quadrature is Prettier-style (double quotes, one statement per line, exports at the bottom, `export { ... }`). Pendulum Lab is ultra-dense (single quotes, many statements per line). **DECISION: Crackler follows Quadrature's formatting.** Dense one-liners are hostile to the unit-tested math modules, and this keeps diffs readable for you.

## 3. What is NEW in Crackler (neither app has it)

1. **i18n** (IT/EN): all strings in `i18n.js`; markup uses `data-i18n` / `data-i18n-title` / `data-i18n-aria`; a `t(key, params)` function for JS. Language switch (header and phone toolbar), default from `navigator.language` (Italian if it starts with `it`), stored in `localStorage` (`crackler.lang`). The siblings' strings are hard-coded English in HTML and JS, so I can't copy a pattern here.
2. **Math notation** without a library: a ~100-line `mathtext.js` that converts a small markup (`v_x`, `a_y`, `\theta`, `m/s^2`) to HTML (`<sub>/<sup>`), to SVG-safe tspans and to canvas-safe Unicode. See PLAN.md for why not KaTeX.
3. **Theme toggle** button (light / dark / auto). The CSS hooks already exist in both apps, so this is just wiring. Optional, say if you don't want it.
4. **Video stage**: the canvas background is the video frame, so overlays use a thin `--surface` halo / outlines to stay legible on any footage. Track colours come from a fixed qualitative set tuned for video.

## 4. Proposed Crackler identity (needs your OK)

- **Wordmark**: tiles `c r a c k l e r`; the `k` tile gets a diagonal hairline crack and a one-off "pop" jolt on load (static under `prefers-reduced-motion`).
- **Palette, light**: bg `#BFE88A` (fresh green), surface `#F7FBEF`, ink `#10230F`, muted `#4F6A47`, accent `#E8344E` (crackle red), `--tile2 #FFD23F`.
- **Palette, dark**: bg `#0F1D12`, surface `#182A1B`, ink `#E9F7DC`, accent `#FF5D73`.
- Physics colours as in Pendulum Lab: `--vel` green, `--acc` magenta, `--pos` blue, plus an 8-colour track set.
- Reason for a new hue: Quadrature = amber, Pendulum = blue, Crackler = green keeps the family distinguishable at a glance. If you'd rather reuse an existing palette, it's a one-block CSS change.
