# Changelog

## Unreleased · 2026-11-09

- One repository for all the labs (`Bradwave/labs`): the kit lives at `kit/` and every lab loads it from `../kit/` instead of holding a copy; `sync-kit` now writes only the manifest and the service worker (whose precache list and cache name include the shared kit files), plus a frozen copy for labs that pin one (`kitCopy`).
- New tools: `test-all` (kit and lab tests, conformance check; used by CI), `screenshot` (headless Chrome over the DevTools protocol), `readme` (gallery from apps.json).
- `apps.json`: test command per lab. Info dialog's "More labs" link points to the labs home page (`../`).
- GitHub Actions: test, then deploy to Pages.

## 0.1.0 · 2026-11-07 (draft)

Impulse Lab (2026-11-09): icons pencil, drop, ball, impact, image.

Pilot on Pendulum Lab (2026-11-08): new icons (copy, waves, up, launch, axes, target, layers, help), 18 px icons in segmented controls, tabs and chips, steppers keep the decimals the user typed; proposed palettes approved.

First version, extracted from Crackler, Pendulum Lab, Quadrature and Motus 1D Lab.

- DESIGN.md: identity, tokens (shared physics colours), layout and breakpoints, header with info and settings, components, language, theme, math notation, plots, diagrams, animation, accessibility, storage, PWA, repository, XR apps, prototyping workflow, release checklist.
- kit.css: base, physics tokens, header and app bar, layout, buttons, segmented, styled select (with `appearance: base-select` where supported), switch, checkbox and radio, slider, number input with stepper, chips, tabs, menu, dialog, table, toast; phone portrait, short landscape, narrow and touch rules.
- kit.js: `initKit`, Italian/English strings and `t()`, theme auto/light/dark, settings menu (bottom sheet on phones), info dialog, slider guard for touch, `parseNum`/`fmtNum`/`fmtSci`/`niceTicks`, number steppers, toast, `store` with the slug prefix, `readColors`, service worker registration and install prompt, inline SVG icons.
- mathtext.js from Crackler.
- Space Mono bundled.
- Tools: check-app, check-palettes, sync-kit, new-app, make-icons, build-single-file.
- apps.json with the 14 labs; proposed palettes for the 7 clashing apps.
- template/ and template/single-file.html; demo.html.
