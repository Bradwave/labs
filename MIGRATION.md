# Migrating a lab to the kit

How to bring an existing lab in line with `DESIGN.md`, one lab per session. Written after the Pendulum Lab pilot (2026-11-08): when in doubt, look at how `pendulum-lab/` does it. All the labs live in one repository; paths below are relative to a lab folder.

## Before you start

- **One lab per session.** Start the session in the repository root (`~/Developer/labs`) and work in `<slug>/`. Sonnet is fine for steps 1–9; ask the user before design decisions (palette, wordmark, removing features).
- `git status` must be clean; work on `main`, commit locally, and **ask before pushing** (a push to `main` deploys every lab to labs.matephis.com after CI).
- Read `../DESIGN.md` and the lab's own `CLAUDE.md`/`README.md`. Find the lab in the notes at the bottom of this file.
- Run `node tools/check-app.mjs <slug>` (from the root) and keep the list: it is the to-do list. Done means 0 failures and 0 warnings.
- Start the preview (`labs` entry in the root `.claude/launch.json`, port 8100), open `/<slug>/` and look at the app before changing anything, in both orientations on a phone size, so you can tell a regression from an old quirk.

## Steps

### 1. Head of `index.html`
- `<html lang="it">` (Italian is the static default), `<title>` exactly the display name from `apps.json`.
- `meta description` (English is fine; the manifest uses `apps.json`), two `theme-color` metas (light bg, and dark bg with `media="(prefers-color-scheme: dark)"`).
- `favicon.svg`, `apple-touch-icon.png`, `manifest.webmanifest` links.
- Remove every external resource: Google Fonts, Material Symbols, CDNs (MathJax, KaTeX). Link `../kit/kit.css` then `css/app.css`.

### 2. Header and info dialog
```html
<header class="top">
  <h1 class="word" aria-label="Pendulum Lab"><span class="k">p</span>…<b class="lab">lab</b></h1>
  <div class="top-actions">
    <button class="icon-btn" id="infoBtn" type="button"></button>
    <button class="icon-btn" id="settingsBtn" type="button"></button>
  </div>
</header>
```
- Tiles spell only the topic word; "lab" is always the badge. Keep the app's tile animation, if any, in `css/app.css`.
- Delete the tagline (`.tag-line`): its text becomes `info.about`, the first paragraph of the info dialog.
- Delete every other header button and every "mobile help" button: the kit fills the two icons, clones them into the tab row in short landscape, and opens the info dialog itself. Former header actions (theme, language, scenes, share, level, import/export, reset) become **settings menu items** (`initKit({ menu: [...] })`) or toolbar buttons.
- The help dialog becomes `<dialog id="info">` with a close button `data-close`, the wordmark, `info.about`, the help body, and `<p class="meta kit-meta"></p>` (the kit fills version, privacy, licence).

### 3. Kit start-up (`js/main.js`)
```js
import { initKit, onLang } from "../../kit/kit.js";
import STRINGS from "./strings.js";
export const VERSION = "2.0.0";
initKit({ slug: "<slug>", name: "<Name>", version: VERSION, strings: STRINGS, menu: [ /* app items */ ] });
onLang(() => relabel());   // rebuild everything generated in JS
```
`initKit` must run before any code that calls `t()`. Theme: if the app reads colours with `getComputedStyle`, it keeps working (the kit sets `data-theme`); otherwise use `readColors()` and redraw in `onTheme`.

### 4. Strings (the biggest step)
- Create `js/strings.js`: `export default { it: {…}, en: {…} }`, same keys, dotted names by area (`tab.graphs`, `p.L`, `t.reset`, `ro.paused`, `help.body`).
- Static markup: `data-i18n`, `data-i18n-html` (for `<sub>`, `<b>`), `data-i18n-title`, `data-i18n-aria`, `data-i18n-placeholder`. Put the Italian text in the HTML too.
- **Pitfall:** `data-i18n` replaces the element's whole content. A slider label like `<label>Length L <b id="LL"></b></label>` loses its value: wrap the text, `<label><span data-i18n="p.L">Lunghezza L</span> <b id="LL"></b></label>`.
- JS-generated text (lists, chips, tables, toasts, canvas labels, readouts): replace literals with `t("key", { n })`; arrays of labels become arrays of keys; a `relabel()` function rebuilds generated lists and refreshes values, called from `onLang`.
- Long help text: one `help.body` key per language with HTML.
- Labs that already have their own i18n (Carts, Crackler, Metric, Motus 1D, Units, Impulse): move the dictionary into `strings.js`, map their attribute names onto the kit's, delete their language switch and storage.
- Translating: write natural Italian (liceo scientifico register, standard physics terms: asta, filo, tensione, attrito viscoso, forza apparente, terzo principio, risonanza, smorzamento, periodo, ampiezza). The user reviews it; list anything you were unsure about in your final report.

### 5. Numbers
- Everything displayed goes through `fmtNum(x, digits, unit)` (decimal comma in Italian, real minus sign, thin space before the unit). Replace display `toFixed` calls; keep `toFixed` only for internal values.
- Inputs: never `type="number"`. Use `<label class="num"><span>θ</span><input type="text" data-step="1" data-min="-180" data-max="180"><span class="unit">°</span></label>` and read with `parseNum()` (accepts `12,5`, `−3`, `1,2×10^-3`).
- CSV export in Italian: `;` separator and decimal comma (see `csv()` in Pendulum Lab's `js/panels.js`).

### 6. Components
- Segmented controls: 2–4 short options. 5+ options (or long labels) → `label.sel > select`, kept in sync with any slider that sets the same value.
- Checkboxes → `.tg` switch rows (settings) or `label.chk` (lists, tables).
- Icons: Material Symbols ligatures (`<span class="ms">name</span>`) → kit icons. In markup add `data-ic="name"` and insert once at start-up: `for (const b of $$("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic))`. If the kit lacks an icon, add it to `ICONS` in `kit/kit.js` (24 × 24, square caps, `class="f"` for fills) and note it in the CHANGELOG.
- Toasts: delete the app's toast element and function; re-export the kit's `toast`.
- Tabs: icon + `<span class="t">label</span>` (labels hide under 540 px except on the active tab).
- Sliders need nothing: the guard is global.

### 7. CSS
- Rename the stylesheet to `css/app.css` and delete everything the kit already provides: base, fonts, `.ms`, header, layout, `.card`, `.btn`, `.seg`, `.tg`, `.ctl`, range, `.num`, `.lg`, tabs, dialog, toast, `kbd`, the phone/landscape layout rules. Keep: brand tokens (light and both dark blocks), app-only tokens, app components, and app-specific overrides inside the kit's breakpoints (`920px portrait`, `600px landscape height`, `440/540px`).
- App colours that mean a physics quantity alias the shared tokens (`--wt: var(--pos); --ten: var(--force)`); do not redefine `--pos --vel --acc --force --mom --ek --ep`.
- Contrast: if the accent is too light for text on the surface, darken headings only (`h3.grp`, `dialog h3`) in the light theme, as Pendulum Lab does. `node tools/check-palettes.mjs` shows the numbers.

### 8. Identity and PWA
- Palette: copy from `apps.json`. Labs with an approved **proposed** background need a full palette first (surface, ink, muted, accent, onaccent, tile2, gridline, light and dark): propose it to the user, update `apps.json` (move it to `palette.light`/`dark`), check with `check-palettes.mjs`.
- `favicon.svg`: a 32 × 32 tile on the brand bg, 2 px ink border, one simple drawing of the topic. Then `node tools/make-icons.mjs <slug>`.
- Set `"kit": true` for the lab in `apps.json`, then `node tools/sync-kit.mjs <slug>` (writes `manifest.webmanifest` and `sw.js`). Re-run sync after every later file change, before committing. Delete any old `kit/`, `.gitignore`, `.github/`, `.claude/` inside the lab: the root owns them.
- Screenshot: `node tools/screenshot.mjs <slug>` → `docs/screenshot.png`, shown at the top of the lab's README and in the root README.

### 9. Repository
- `CLAUDE.md` starting with "Follow `../DESIGN.md`" (template in `template/CLAUDE.md`), `tests/strings.test.mjs` (same keys, no empty strings), README updated (Italian and English, offline, structure, tests).
- Old style or progress notes superseded by DESIGN.md (`STYLE.md`) are deleted; plans worth keeping go to `docs/dev/`.
- Do not add a CNAME file (subdomains are not set up yet); keep an existing one.

### 10. Verify
- `node tools/check-app.mjs <slug>` → 0 failed, 0 warnings. `node tools/test-all.mjs` passes (add the lab's test command to `apps.json`, field `test`).
- In the preview, at 1440 × 900, 375 × 812 and 812 × 375, light and dark, Italian and English: no console errors; every tab, the settings menu (opens, language and theme switch, menu stays open), the info dialog, every former header action, every input with a decimal comma, toasts, and the app's main interaction.
- Test the features with JS in the page where clicking is awkward (as in the pilot: set an input, dispatch `change`, read the readout).
- Look for **old bugs** while wiring: the pilot found two buttons that had never been connected. Fix small ones and mention them in the commit.
- What you cannot test here (real touch, offline after deploy, Quest): say so in the report.

### 11. Commit
One commit ("<Name>: migrate to the lab kit", with a bullet list); kit changes in the same commit or a separate one. Ask before pushing.

## Session prompt (copy, fill in the slug)

> Migrate `<slug>` to the lab kit. Follow `MIGRATION.md` step by step and `DESIGN.md`; Pendulum Lab (`pendulum-lab/`) is the reference migration. Read the notes for `<slug>` at the bottom of MIGRATION.md first. Ask me before choosing a palette, a wordmark or removing a feature. Done means check-app reports 0 failures and 0 warnings, test-all passes and you have checked desktop, phone portrait and short landscape in both themes and both languages in the preview. Commit locally, do not push, and end with a list of anything you could not verify and any Italian wording you were unsure of.

## Suggested order

1. **Units Lab, Metric Lab, Carts Lab**: already Italian and English, smaller; good to settle the "existing i18n → strings.js" pattern.
2. **Attractor Lab, Relative Motion Lab, Quadrature, Orbit Lab**: English only, medium size.
3. **Detach Lab**: needs a decision on equation rendering.
4. **Motus 1D Lab, Impulse Lab, Crackler**: the biggest or with structural work.
5. **Orbit Lab XR, Surface Lab XR**: XR subset only (DESIGN.md §17).

## Notes per lab

| Lab | State and specifics |
|---|---|
| **attractor-lab** | English only, ~1.5 k lines, Google Fonts. Approved bg **orchid #E39BE6**: full palette needed. Theme button in the header → menu. Has an `input type="color"` (not covered by the kit: style it as a 36 px square with an ink border, propose it for the kit). |
| **carts-lab** | IT/EN in `js/i18n.js`; all CSS inline in `index.html` (move to `css/app.css`); own SVG icons in `js/icons.js` (replace with kit icons, add missing ones to the kit); own fonts in `fonts/` (delete, the kit bundles Space Mono); header has level (L1), language, theme, help → level as a menu item. 2 selects, 2 number inputs. Accent lime `#C6F500` is unreadable as text on white (contrast 1.2): darken headings. Keep `.github/workflows` (CI and Pages deploy) and `tests/`. |
| **crackler** | Largest lab (~10 k lines), coined name (keeps "Crackler", no badge decision needed: ask). Already IT/EN with the same `data-i18n*` attributes as the kit: move `DICT` into `strings.js`, delete its `t()`/`setLang`. Language and theme controls in header and help dialog → menu. `mathtext.js` is the kit's: import `../kit/mathtext.js` and delete its copy. 16 selects, 28 number inputs, 1 checkbox. Google Fonts and Material Symbols. Keep `CNAME`, `docs/dev/`, tests. |
| **detach-lab** | Italian/English via `data-en` / `data-en-label` attributes and `LANG` in `js/ui.js` → convert to `strings.js` keys. Wordmark built by `buildWord()`; share button in the header → menu "Copy link". **MathJax from a CDN** renders the Equations tab: decide with the user between a local KaTeX copy in the kit (planned 0.2) and rewriting the formulas with mathtext/HTML. Approved bg **mint #9EE6A0**: full palette needed. |
| **impulse-lab** | ✅ Migrated 2026-11-09: build removed, the six scripts stay classic scripts loaded after an ES-module `js/boot.js` (see its CLAUDE.md). Was: a **build step** (`src/` → `docs/index.html`, i18n in `src/i18n/*.json`, Pages serves `docs/`). DESIGN asks for no build: move `src/` to root ES modules (`index.html`, `css/app.css`, `js/`), JSON strings → `strings.js`, switch Pages to the root (tell the user: Settings → Pages). Keeps its lavender (owner of the hue). Storage keys need the slug prefix. |
| **metric-lab** | IT/EN in its own `I18` object; theme and language buttons in the header; 12 checkboxes (→ `.chk` or `.tg`), 2 selects (one unwrapped); own fonts (delete). Approved bg **coral #FF8C7A**: full palette needed. Keep `.github/workflows/test.yml` and tests. |
| **motus1d-lab** | Header with 15 buttons including its own gear menu: scenes, theme, language, share, import, export, reset, help → kit menu items (keep the QR dialog). IT/EN in `js/i18n.js`; all CSS inline in `index.html` (large); fonts and Material Symbols subset in `fonts/` → kit fonts and icons. Storage keys `motus1d.*` → `motus1d-lab.*`. |
| **orbit-lab** | English only but already centralised in `js/strings.js` as `STR.ui…` (different shape: convert to flat `{it, en}` keys). Own `css/tokens.css`, `STYLE.md` (delete after), `tools/build-single-file.mjs` (replace with the kit's). Google Fonts. Number inputs. Approved bg **deep space indigo #2E2A6B**, a dark background even in the light theme: design the full palette carefully and check contrast; Orbit Lab XR shares it. |
| **quadrature** | English only, coined name. `<title>` has a subtitle (remove), no meta description, Google Fonts. 1 select, 4 checkboxes, 2 number inputs. Keep `CNAME`. Its amber stays. |
| **relative-motion-lab** | English only. Own breakpoints (1080/720/559 px) → kit breakpoints; two-row wordmark → one row + badge; `<title>` subtitle; 5 selects. Its green stays. |
| **units-lab** | IT/EN in `js/i18n.js` (already `units-lab.lang`); the page scrolls by design (`body.scrolls`); 4 header buttons → menu. Approved bg **lemon-lime #E3F06A**: full palette needed. Fonts and Material Symbols subset → kit. The wordmark's balance animation needs redoing for "units" + badge. |
| **orbit-lab-xr** | XR: only identity, PWA, strings and repo rules. Needs `favicon.svg` and icons, storage key `orbitxr.v1` → `orbit-lab-xr.v1`, English strings next to Italian. Its own `sw.js` will be replaced by the generated one: check that `three.min.js` and every module are in the precache list and that it still opens offline on the Quest (user test). |
| **surface-lab-xr** | XR, same as above. Italian only: add English. Needs `favicon.svg` (has `icon.svg`), apple-touch icon, meta description. Same service worker caution. GitHub repo not created yet. |
