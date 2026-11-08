# Roadmap

Where the labs project stands and what comes next. Updated 2026-11-09. Each phase is a session or a few; ✅ = done.

## 0. Foundations ✅
- ✅ Design standard (`DESIGN.md`), shared kit (`kit/`), tools, template, `apps.json`, migration guide.
- ✅ Pilot migrations: Pendulum Lab (live), Impulse Lab (build step removed).
- ✅ One repository for all the labs, with CI, screenshots, README gallery, placeholder home page.

## 1. Go live (next, short)
1. Push `Bradwave/labs` (ask first).
2. **You:** DNS `CNAME labs → bradwave.github.io`; repo Settings → Pages: Source *GitHub Actions*, custom domain `labs.matephis.com`, *Enforce HTTPS*.
3. Check every lab at `labs.matephis.com/<slug>/` (the not-yet-migrated ones too).
4. **Redirects** for the old addresses: `pendulum-lab.matephis.com`, `crackler.matephis.com`, `quadrature.matephis.com`, `attracthm.matephis.com` (→ attractor-lab), `bradwave.github.io/carts-lab`. Each old repo becomes a redirect page that keeps the URL hash, plus a service worker that clears the old offline copy. Ask before pushing; check on a phone that had the old version.
5. **You:** archive (later delete) the five old repos once the redirects work; update links on matephis.com.

## 2. Identity before migrations (one session)
- **Palettes** for the five labs with an approved new background (Attractor, Detach, Metric, Units, Orbit + Orbit XR): full light and dark palettes, contrast checked.
- **Animated logo** per lab: a square tile with one motion that sums up the lab; its still frame is the favicon and app icon (`logo.svg`, CSS animation, reduced-motion still frame). Spec in DESIGN.md §2, reviewed in a logo gallery. (Optional: derive them from the landing stations, phase 5.)
- Done here once, so each migration only applies them.

## 3. Kit 0.2 (one session, before the remaining migrations)
- **KaTeX**, local copy in `kit/katex/`, loaded on demand, for formulas in help, info and equation cards (needs your OK to download it). Needed by Detach Lab.
- **Two layers:** `core` (look, components, language, theme, PWA) and `lab` (physics colours, mathtext, plots, stage/panel layout); lab-specific bits (badge, "more labs" link, privacy line) become options.
- Smaller items: italic variables in mathtext, a shared `plot.js` (axes, ticks, series, cursor) to replace each lab's own, styled scrollbars and colour input (from Impulse and Attractor), a CI check that `kit/` never reaches outside its folder.

## 4. Migrations (one lab per session, Sonnet; `MIGRATION.md`)
Order: Units, Metric, Carts → Attractor, Relative Motion, Quadrature, Orbit → Detach (KaTeX) → Motus 1D, Crackler → Orbit XR, Surface XR (XR subset). After each: screenshot, README gallery, check-app at 0/0, ask before pushing.

## 5. Landing page (its own session; plan in `docs/LANDING.md`)
The home page as a laboratory full of equipment: one animated station per lab, labelled with the lab's wordmark, grouped on benches; a plain list below for quick access and screen readers.

## Later
- The older apps still on `*.matephis.com` (Fourier family, fractals, motion apps…): decide one by one whether each becomes a lab, merges into one, or is retired.
- Motus redesign (out of scope for now).
- Obfusca: separate redesign, not the lab kit.
- Translations reviewed by a second teacher; a short teachers' guide per lab (activities, worksheets) linked from the info dialog.
