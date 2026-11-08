# Labs

One repository (`Bradwave/labs`, served at labs.matephis.com) with every math and physics lab, its shared kit and the design standard.

- **Follow `DESIGN.md`** in every lab: header with info and settings only, kit components, Italian and English, shared physics colours, PWA, repository layout.
- Each lab is a folder (`<slug>/`) with its own `CLAUDE.md`; read it before working on that lab.
- Shared code is `kit/`, loaded by the labs as `../kit/`: a change there reaches every lab. Keep it backwards compatible within a minor version, bump `VERSION` and `KIT_VERSION` in `kit/kit.js`, add a CHANGELOG line, check `demo.html` in both themes, and run `node tools/test-all.mjs`. `kit/` must never read or import anything outside its folder (so it can be split out later).
- `apps.json` is the single list of labs (names, descriptions it/en, palettes, test commands); palettes under `proposed` are used only once approved.
- Migrating a lab to the kit: follow `MIGRATION.md` (Pendulum Lab is the reference migration).
- Before committing changes to a lab: `node tools/sync-kit.mjs <slug>` (manifest and service worker) and `node tools/test-all.mjs`. After visible changes: `node tools/screenshot.mjs <slug>`; after changing `apps.json`: `node tools/readme.mjs`.
- Preview: the `labs` entry in `.claude/launch.json` serves the whole repository on port 8100 (labs at `/<slug>/`).
- **Ask before pushing**: a push to `main` deploys every lab to labs.matephis.com after CI.
- No CNAME files in the labs: the custom domain is set in the repository's Pages settings. The old per-lab repos (pendulum-lab, crackler, quadrature, attracthm, carts-lab) are kept only to redirect their old addresses.
- motus, matephis, obfusca and orario-pellicano are separate projects with their own style: do not apply the lab kit to them.
