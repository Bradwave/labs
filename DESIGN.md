# Lab design standard

Version 0.1.0 (draft, 2026-11-07). This file is the single source of truth for how the math and physics labs look and behave. All the labs live in one repository (`Bradwave/labs`, served at labs.matephis.com): the shared files that implement this standard are in `kit/`, the list of labs with their names, palettes and descriptions is `apps.json`, and each lab is a folder.

Rules use three words on purpose: **must** (the checker fails), **should** (the checker warns, or a reviewer asks why), **may** (free choice).

Contents: 1 Scope and changes · 2 Identity · 3 Tokens · 4 Layout · 5 Header, info and settings · 6 Components · 7 Language · 8 Theme · 9 Math notation · 10 Plots · 11 Diagrams and vectors · 12 Animation and simulation controls · 13 Accessibility · 14 Storage and links · 15 PWA and offline · 16 Repository and code · 17 XR apps · 18 Prototyping a new lab · 19 Release checklist

---

## 1. Scope and changes

- Applies to every app listed in `apps.json`. `kind: "2d"` apps follow the whole file; `kind: "xr"` apps follow the XR section (17) plus identity, language, PWA and repository rules.
- **One shared kit.** Every lab loads the kit from `../kit/` (stylesheet `../kit/kit.css`, module `../../kit/kit.js` from `js/`). A kit change reaches every lab at once, so it is checked by CI (tests, `check-app`) before deploying, and seen on `demo.html` first. Each lab's service worker precaches the kit files it uses, so labs keep working offline.
- **Escape hatch: a frozen kit.** A lab that must not follow kit changes (half-migrated, or no longer maintained) may hold a copy in `<lab>/kit/`, declared in `apps.json` as `"kitCopy": "<version>"` and written by `tools/sync-kit.mjs`. Normally no lab uses it.
- **A standalone lab.** To give one lab away as a single file (for a computer without internet, or a prototype), `tools/build-single-file.mjs` inlines the kit; the kit stays in the repository otherwise.
- **The kit stays separable.** `kit/` never imports or reads anything outside its folder, and labs use it only through `kit.css` and `kit.js`: splitting it into its own repository later stays a matter of hours.
- **Changing the standard while prototyping.** A new need is solved inside the app first, with an `x-` prefix on new classes (`.x-stepper`) and a comment `/* x: proposal for the kit */`. When the app moves to Claude Code, each `x-` piece is either promoted (moved into `kit/`, documented here, version bumped, CHANGELOG line) or renamed as app-specific. The checker warns about leftover `x-` classes.
- **Versioning.** `VERSION` follows semver: patch = fixes, minor = new components or rules that existing apps already satisfy, major = a rule that existing apps must change for. Every change gets a line in `CHANGELOG.md`.

## 2. Identity

### Names
- Display name: **"<Topic> Lab"**, two words, English in both languages (it is a name, not a phrase). Coined exceptions recorded in `apps.json`: Crackler, Quadrature.
- Slug: kebab case, `<topic>-lab`. The slug is the folder in this repository, the path on the site (`labs.matephis.com/<slug>/`) and the storage prefix.
- XR versions add ` XR` / `-xr`: Orbit Lab XR, `orbit-lab-xr`.

### Wordmark
- Letter tiles: `h1.word > span`, one tile per letter of the topic, lowercase, 1.32 em squares, 2 px ink border, overlapping by 2 px. Tile roles: `.a` accent fill, `.b` `--tile2` fill, `.k` ink fill (inverted), plain = surface. Two or three coloured tiles per word, never adjacent.
- Followed by the **lab badge**: `<b class="lab">lab</b>`, identical in every app (small ink box, surface text, sits on the baseline). The badge is the family mark; never draw "lab" as tiles.
- One tile may animate once on load (Pendulum swings, Crackler pops). The animation must stop under `prefers-reduced-motion`.
- `aria-label` on the `h1` is the full display name.

### Palette
- Each app owns one **brand hue**, recorded in `apps.json` (`palette.light` / `palette.dark`). Two apps must not share a hue; a pair like Orbit Lab and Orbit Lab XR shares on purpose (`"sharesPaletteWith"`).
- The checker compares background hues: closer than 18° with similar lightness is a clash.
- Proposed hues for apps that clash today are in `apps.json` under `palette.proposed` and on the swatch board in `demo.html`. They become real only after review.

### Icon and favicon
- `favicon.svg`: a single tile (the app's accent or bg colour, 2 px ink border) carrying one glyph or a tiny drawing of the topic. Plus `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (glyph inside the 80 % safe zone) and `apple-touch-icon.png` (180 px).
- `<meta name="theme-color">` equals the light `--bg`, with a dark variant: `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="…">`.

## 3. Tokens

All colours are CSS custom properties on `:root`; dark overrides go under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` **and** `:root[data-theme="dark"] { … }`. Canvas code must not hard-code colours: read them with `readColors()` from the kit.

### Brand tokens (per app, from `apps.json`)
| Token | Role |
|---|---|
| `--bg` | page background (graph paper) |
| `--bgline` | graph-paper lines: `--ink` at 12–15 % (light), `--bg` hue at 7 % (dark) |
| `--surface` | cards, dialogs, inputs |
| `--ink` | text, borders, shadows |
| `--muted` | secondary text |
| `--accent` / `--onaccent` | primary buttons, slider thumbs, active toggles, section headings |
| `--tile2` | second wordmark colour, highlights |
| `--gridline` | dotted separators, plot grid |

### Physics tokens (identical in every app)
Students learn one colour language across the labs. These values are defined in `kit/kit.css` and an app must not redefine them.

| Token | Quantity | Light | Dark |
|---|---|---|---|
| `--pos` | position, displacement, weight | `#2350D8` | `#86A6FF` |
| `--vel` | velocity | `#0F9A63` | `#3DDC97` |
| `--acc` | acceleration | `#B42BA0` | `#F27ADF` |
| `--force` | force (generic), tension, impulse | `#E2412A` | `#FF7C60` |
| `--mom` | momentum | `#6E3FE0` | `#B59CFF` |
| `--ek` | kinetic energy | `#C27400` | `#FFC15A` |
| `--ep` | potential energy | `#1592B8` | `#6FD3F0` |
| `--neg` / `--pos-sign` | negative / positive values in tables | `#E2412A` / `#0F9A63` | `#FF7C60` / `#3DDC97` |

Other forces (normal, friction, drag) use the app's own tokens, named `--f-normal`, `--f-friction`, `--f-drag`, and should stay in the red–orange family.

### Shape, type, spacing
- Borders 2 px `--ink` (1.5 px for chips and plot frames). **No border radius anywhere** except dots and circles that represent physical objects.
- Shadows are hard: cards `6px 6px 0 var(--ink)` (4 px on phones), buttons `3px 3px 0`, small controls `2px 2px 0`. No blur.
- Font: **Space Mono** 400/700, bundled in `kit/fonts/`. Body 14 px / 1.45. Control text 12.5 px bold. Notes 11.5 px. Numbers use `font-variant-numeric: tabular-nums`.
- Spacing scale: 4, 6, 8, 10, 12, 16, 22 px. Gaps between cards 22 px desktop, 10 px phones.

## 4. Layout

Breakpoints are fixed for every app:

| Name | Media query | Layout |
|---|---|---|
| desktop | default | header; grid `minmax(0,1fr) | minmax(330px,440px)`, max width 1400 px |
| phone portrait | `(max-width: 920px) and (orientation: portrait)` | app bar; stage on top, panel below at `clamp(220px, 38dvh, 560px)` |
| short landscape | `(max-height: 600px) and (orientation: landscape)` | no header; two columns, panel `minmax(290px,380px)`; info and settings buttons at the end of the tab row |
| narrow | `(max-width: 540px)` | tab labels hidden (icons only), button labels `.lbl` hidden |
| touch | `(pointer: coarse)` | every hit target at least 44 × 44 px |

- **Stage column**: toolbar card → canvas card (`flex: 1`) → optional control bar card.
- **Panel column**: folder tabs (`.tabs`) over one `.tabpane.card` that scrolls internally (`overscroll-behavior: contain`). The page itself does not scroll on desktop or in short landscape.
- Safe areas: side padding is `max(16px, env(safe-area-inset-left))` (8 px on phones); top and bottom use `env(safe-area-inset-*)`.
- Apps whose main view is a form or a game (Units Lab) may scroll the page, but keep the header, cards and components.

## 5. Header, info and settings

### Desktop
```
[wordmark tiles][lab]                                  [ⓘ] [⚙]
```
- Left: the wordmark. **No tagline under it.** The one-line description goes to `<meta name="description">`, the manifest, the info dialog and the landing page (`apps.json` → `description`).
- Right: exactly two icon buttons, `#infoBtn` and `#settingsBtn`, in that order. Nothing else lives in the header: share, scenes, levels, reset and import/export go in the settings menu or the toolbar.

### Phone portrait: the app bar
A 48 px bar: smaller wordmark (tiles 22 px), same two buttons (40 px). The app keeps its identity when installed and there is no browser bar.

### Short landscape
The header is hidden; `#infoBtn` and `#settingsBtn` are cloned by the kit to the end of the tab row (`.tabs .kit-mini`).

### Settings menu (gear)
Built by `kit.js`, always in this order:
1. **Language**: segmented `IT | EN`
2. **Theme**: segmented `Auto | Light | Dark` (icons + labels)
3. divider, then the app's own items (each: icon, label, optional value on the right), e.g. share link, scenes, import, export, level, reset
4. divider, **Install app** (only when the browser offers it), **version** line (`v1.4.0 · kit 0.1.0`)

It opens under the gear on desktop and as a bottom sheet on phones; closes on outside click, Escape and after an item runs.

### Info dialog
`<dialog id="info">`: wordmark, one-paragraph description, "How it works" sections, keyboard shortcuts (hidden on touch), credits, privacy line ("Everything runs on this device; nothing is uploaded."), licence, version, link to the landing page.

## 6. Components

All classes below are defined in `kit/kit.css`; `demo.html` shows each one in both themes.

| Component | Markup | Rules |
|---|---|---|
| Card | `.card` | surface, 2 px border, 6 px shadow |
| Button | `button.btn` (+ `.primary`, `.on`, `.ic`) | 36 px tall (44 on touch); `:active` moves 3 px and drops the shadow; label in `.lbl` so it can hide on phones; icon first |
| Icon button | `button.icon-btn` | 42 px square; must have `aria-label` |
| Segmented | `.seg` (+ `.small`) > `button` | one choice from **2–4** options. Active = ink fill. Labels short (≤ 10 characters). On phones more than 4 options must become a select. Never wraps: `white-space: nowrap` |
| Select | `label.sel > select` | for 5+ options or long labels. Closed box styled like `.btn` with a chevron; the open list stays native (best on phones). Progressive enhancement: `appearance: base-select` where supported |
| Switch | `button.tg[aria-pressed]` with `.txt` and `.box` | every on/off setting in panels. Label + optional `<small>` hint |
| Checkbox | `label.chk > input[type=checkbox] + span` | only inside lists and tables where a switch row is too big. Square box, ink tick, accent fill when checked |
| Slider | `.ctl > label (text + <b>value</b>) + input[type=range]` | square accent thumb, 4 px ink track. Must be guarded (below). Value shown bold on the right with units |
| Number | `.num > span + input[type=text][inputmode=decimal]` (+ `data-step`) | **never `type=number`**. Accepts comma or point, Unicode minus, spaces. With `data-step` the kit adds − / + buttons. Invalid input: red border, value kept, toast with the reason |
| Chip | `button.lg` (+ `.on`) | legends and quick toggles; dims when off |
| Tabs | `.tabs > button.tab[role=tab]` + `.tabpane.card[role=tabpanel]` | icon + `.t` label; label hidden under 540 px |
| Toast | `kit.toast(msg)` | ink on surface, top centre of the stage, 2.4 s |
| Hint | `.hint` | small boxed caption at the bottom left of the canvas; hidden on phones |
| Readout | `.readout` | boxed key/value grid over the canvas, tabular numbers |
| Dialog | `<dialog>` | 2 px border, 6 px shadow, max 660 px; `h2` 22 px, `h3` accent 13 px |
| Menu | `.menu.card` | rows with icon, label, value; dotted separators |
| Table | `.ptable` | sticky header, tabular numbers, current row highlighted |

### Slider guard (touch)
`kit.guardSliders()` is on by default. On touch, a slider only changes once the finger has moved **8 px sideways and more sideways than vertically**; a vertical swipe that starts on a slider scrolls the panel instead, and a tap on the track does not jump the value. Mouse, pen and keyboard are unaffected. Sliders have `touch-action: pan-y`.

### Numbers in Italian
`kit.parseNum("0,5")` → 0.5; `kit.fmtNum(x, digits)` writes a decimal comma in Italian and a point in English, a real minus sign (−), and a thin space before units in readouts (`3,2 m/s`).

## 7. Language

- Every lab is in **Italian and English**. Default: Italian if `navigator.language` starts with `it`, else English; the choice is stored in `<slug>.lang`.
- All strings live in `js/strings.js` as `{ it: {…}, en: {…} }` with the **same keys** in both (the checker compares them). The kit merges its own strings (`kit.*`).
- Markup: `data-i18n` (text), `data-i18n-html`, `data-i18n-title`, `data-i18n-aria`, `data-i18n-placeholder`. JS: `t(key, params)` with `{name}` placeholders.
- `<html lang>` follows the current language. Static text in HTML is the Italian version (no flash for most users).
- Keys are lowercase with dots by area: `tab.motion`, `help.title`, `err.badNumber`.
- Units and symbols are the same in both languages; decimal separator follows the language.

## 8. Theme

- Three states, `auto` (follows the system), `light`, `dark`; stored in `<slug>.theme`; applied as `data-theme` on `<html>` (absent in auto).
- Canvas and SVG drawing: call `kit.readColors()` (returns every token) and redraw on `kit.onTheme(fn)`.
- Both themes must pass contrast checks: text on surface ≥ 4.5:1, ink on bg ≥ 3:1, accent on surface ≥ 3:1.

## 9. Math notation

- Labels, axes, readouts and table headers use **mathtext** (`kit/mathtext.js`, from Crackler): `v_x`, `a_{max}`, `m/s^2`, `\theta`, `\Delta s`. It renders to HTML (`<i>`, `<sub>`, `<sup>`), SVG tspans and canvas Unicode from one source string.
- Variables italic, units and numbers upright, Greek from the markup (`\omega`), minus sign `−` (U+2212), multiplication `·` or `×`, scientific notation `3,2 × 10⁻⁴` (`kit.fmtSci`). mathtext does not italicise variables yet: planned for kit 0.2.
- Real formulas (fractions, roots, integrals) only in help and info text: render with a **local** KaTeX copy (`kit/katex/`, loaded on demand). No CDN, no MathJax.

## 10. Plots

- **Frame**: plot area with a 1.5 px ink border; grid in `--gridline`; axes through zero in ink 1.5 px when zero is in range.
- **Ticks**: `kit.niceTicks(min, max, n≈5–8)`; labels 11 px muted, decimal separator by language; no more than 3 significant digits on tick labels.
- **Axis labels**: quantity and unit as `v (m/s)` in mathtext, at the end of each axis.
- **Series**: the physics colour of the quantity (`--pos`, `--vel`, …); continuous curves 2 px; **sampled data** as 4 px square markers (data-logger look) optionally joined by a 1 px line; fits and predictions dashed `6 4`.
- **Legend**: chips (`.lg`) above the plot, which also toggle series.
- **Cursor and readout**: a vertical hairline follows the pointer or the simulation time; values in a `.readout` box.
- **Areas** (∫, Δ): fill in the series colour at 18 % opacity, outlined; rectangles for Riemann sums with 1 px ink edges.
- **Export**: CSV with a header row of quantities and units; in Italian use `;` as separator and decimal comma so it opens directly in Excel.
- One shared implementation (`kit/plot.js`) is planned for kit 0.2; until then apps keep their own plot code but follow these rules.

## 11. Diagrams and vectors

- Vectors: shaft 2.5 px (3 px on phones), filled triangular head 10 × 8 px, colour of the quantity. Components dashed `4 3` in the same colour at 70 % opacity.
- Labels next to the head, mathtext, 12 px bold, with a 3 px `--surface` halo (stroke) so they read over anything.
- Objects: fills from `--tile2`/`--accent`, ink 2 px outlines, no gradients (except the sky in an explicit camera view).
- Ghosts, predictions, trails: dashed or 35 % opacity; never a new hue.
- Reference frames and axes: ink, 1.5 px, labelled `x`, `y` in italics; moving frames in the accent colour.

## 12. Animation and simulation controls

- Transport in the toolbar, left side, always in this order: **Play/Pause** (primary), **Step**, **Reset**, then a speed segmented control (`¼× ½× 1× 2×` or similar), then the time readout `t = 1,25 s`.
- Keyboard: Space play/pause, → step, R reset (shown as `<kbd>` hints, hidden on touch).
- Simulation time is separate from screen time (fixed physics step, rendering at display rate); the time shown is simulation time.
- UI transitions 150 ms (controls) and 250 ms (panels, toasts), `ease-out`. Under `prefers-reduced-motion`: no UI transitions, no wordmark animation; the simulation itself still runs.

## 13. Accessibility

- Visible focus: 3 px ink outline, 2 px offset (`:focus-visible`).
- Touch targets ≥ 44 px on coarse pointers.
- Tabs use `role=tablist/tab/tabpanel` and arrow keys; the settings menu uses `aria-expanded`/`aria-controls`; toggles use `aria-pressed`.
- Every icon-only button has `aria-label` (translated).
- Canvas content that matters has a text alternative (the readout, the table, or `aria-label` on the canvas).

## 14. Storage and links

- localStorage keys: `<slug>.<name>` (`metric-lab.lang`, `units-lab.v2`). Every access goes through `kit.store` (try/catch, the app works without storage).
- Shareable state lives in the URL hash (`#v=10&L=30`) and is parsed defensively; the settings menu offers "Copy link" when an app supports it.

## 15. PWA and offline

- Every lab is installable and works offline after the first visit:
  - `manifest.webmanifest` generated by `tools/sync-kit.mjs` from `apps.json` (name, short name, description, colours, icons, `display: standalone`, `start_url: "./"`, `scope: "./"`);
  - `sw.js` generated from `kit/sw.template.js`: precache the app's files, **network first** for everything (so a new deploy shows up at once), cache fallback offline, cache name `<slug>-<appVersion>-<kitVersion>`;
  - the kit shows a toast "Updated: reload" when a new version takes over.
- **No external requests**: no Google Fonts, no CDNs, no analytics. Fonts and icons travel with the app.

## 16. Repository and code

```
<slug>/
  index.html            static markup, info dialog
  manifest.webmanifest  generated
  sw.js                 generated
  favicon.svg  icon-192.png  icon-512.png  icon-maskable-512.png  apple-touch-icon.png
  css/app.css           app styles only (tokens + app components)
  js/main.js            entry point; js/strings.js; one concern per file
  tests/                node --test
  docs/                 MODEL.md, screenshots; docs/dev/ for plans and notes
  README.md  LICENSE  CLAUDE.md
```
Repository-wide files live only at the root: `.gitignore`, `.github/workflows/`, `.claude/launch.json` (one preview server for all the labs, port 8100), `package.json`.
- Vanilla ES modules, no build step, no runtime dependencies. (Impulse Lab keeps six classic scripts after an ES-module boot file: an accepted exception, see its CLAUDE.md.)
- Each JS file starts with `// <App> · <file>.js` and one line on what it owns.
- Formatting: Prettier defaults with `printWidth: 110`, double quotes. Physics and maths in pure modules (no DOM) with tests.
- `CLAUDE.md` in every lab starts by pointing to this file: "Follow `../DESIGN.md`."
- LICENSE: MIT, "Copyright (c) <year> Matteo Bramardi".
- README sections: a screenshot (`docs/screenshot.png`) · what it is · features · run locally (`python3 -m http.server 8100` in the repository root, then `/<slug>/`) · structure · licence. Footer line "Vibecoded with Claude, with <3."

## 17. XR apps

Orbit Lab XR and Surface Lab XR run in the Quest Browser and on desktop. They share:
- names, slugs, palette (the XR twin shares its 2D app's palette), favicon and icons, physics tokens, Italian/English, PWA files, repository layout and licence;
- the 2D page around the XR session follows the header rule (wordmark, info, settings);
- inside XR, panels follow the same look in 3D: flat cards, 2 px ink borders, hard offset "shadow" plane, Space Mono rendered to canvas textures, accent buttons; hit targets at least 4 cm at arm's length.
They do not follow sections 4 and 6 inside the immersive view.

## 18. Prototyping a new lab

1. **Cowork, any device**: start from `template/single-file.html` (the kit inlined in one file, about 140 kB) and this document. Focus on the physics and the teaching; use only kit components; new needs get `x-` classes.
2. **Identity**: pick the name and slug, add the app to `apps.json` with a palette that passes `node tools/check-palettes.mjs`, and draw `favicon.svg`.
3. **Claude Code**: `node tools/new-app.mjs <slug>` creates the folder from `template/` and writes its manifest and service worker; `node tools/make-icons.mjs <slug>` renders the PNG icons from the favicon. Then port the prototype into modules, move physics into pure tested modules, and resolve every `x-` piece (section 1).
4. **Release**: `node tools/sync-kit.mjs <slug>` (refreshes the manifest and the service worker's file list and cache name), then the checklist below passes; pushing to `main` deploys after CI.

### Tools
| Command | Does |
|---|---|
| `node tools/check-app.mjs <slug>` / `--all` | conformance report (§19) |
| `node tools/check-palettes.mjs [--proposed]` | hue clashes and contrast across the labs |
| `node tools/sync-kit.mjs [slug…]` | regenerates manifest and service worker (and a frozen kit copy, for labs that pin one) |
| `node tools/test-all.mjs` | runs the kit tests and every lab's tests (as CI does) |
| `node tools/screenshot.mjs [slug…]` | `docs/screenshot.png` of each lab with headless Chrome |
| `node tools/new-app.mjs <slug>` | new lab from `template/` |
| `node tools/make-icons.mjs <slug>` | PNG icons from `favicon.svg` (macOS `sips`) |
| `node tools/build-single-file.mjs [app-folder out.html]` | one-file build: the Cowork starter, or a prototype to share |
| `node --test tests/` | kit unit tests |

Existing labs are brought in line with `MIGRATION.md` (one lab per session).

## 19. Release checklist

`node tools/check-app.mjs <slug>` checks the starred items.

- [ ] ★ name, title, `aria-label`, manifest name agree with `apps.json`
- [ ] ★ favicon, icons, `theme-color`, manifest and service worker present
- [ ] ★ no external URLs in HTML, CSS or JS
- [ ] ★ loads the shared `../kit/` (or a declared frozen copy)
- [ ] ★ header has only the wordmark, `#infoBtn` and `#settingsBtn`; no `.tag-line`
- [ ] ★ no `type=number`; every `select` inside `.sel`; checkboxes only as `.chk`
- [ ] ★ `strings.js` has the same keys in `it` and `en`; `data-i18n` used in markup
- [ ] ★ storage keys start with the slug
- [ ] ★ LICENSE, README, `.gitignore`, `CLAUDE.md`, `tests/` (not `test/`)
- [ ] ★ no leftover `x-` classes
- [ ] works at 375 × 812 portrait, 812 × 375 landscape and 1440 × 900, both themes
- [ ] sliders can be scrolled past on a phone without changing
- [ ] installs and opens offline
- [ ] Italian strings read naturally (reviewed by Matteo)
