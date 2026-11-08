# Style

Orbit Lab belongs to a family of small teaching apps that share one visual language: tiles, ink borders, hard offset shadows, a graph-paper background and Space Mono. The tokens live in `css/tokens.css`; this file records the rules so that new pages in the family look alike.

## Principles

- **Tiles and ink.** Every panel is a *card*: surface colour, 2 px ink border, hard 6 px shadow (4 px on phones). No blur, no gradients except the ship cam sky.
- **Header.** The app name as a row of square letter tiles (ink, accent, yellow and surface tiles, one of them animated), with a one-line tagline.
- **Layout.** A stage on the left (toolbar, canvas, scrubber, quick toggles) and a tabbed panel on the right; on phones in portrait the panel moves below the stage.
- **Controls.** Buttons with a hard shadow that presses in; segmented controls; toggle switches with a square thumb; square slider thumbs in the accent colour.
- **Language.** English UI, all strings in `js/strings.js` or in the data modules.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#8CCBEB` | `#0A1630` | page, with a 28 px grid of `--bgline` |
| `--surface` | `#F5F9FC` | `#12213F` | cards |
| `--ink` | `#0B1B3A` | `#E8F1FF` | text, borders, shadows |
| `--muted` | `#4D6585` | `#9BB0CF` | secondary text |
| `--accent` | `#FF6A3D` | `#FF7A50` | primary buttons, thumbs |
| `--tile2` | `#FFC23D` | `#E9A92A` | header tile, mission numbers |

Typography: Space Mono, 14 px base, 12–12.5 px for controls and notes, bold for labels and values. Icons: Material Symbols Outlined, 20 px.

## Colour roles in Orbit Lab

Roles are fixed across the whole app and never rely on colour alone.

| Role | Token | Redundant cue |
|---|---|---|
| Kinetic energy $K$ | `--kin` (blue) | solid fill |
| Potential energy $U$ | `--pot` (orange) | hatching |
| Total energy $E$ | `--tot` (ink) | dotted outline |
| Velocity | `--vel` (green) | arrow, labelled `v` |
| Gravity | `--grav` (blue) | arrow, labelled `g` |
| Thrust | `--thr` (magenta) | arrow plus a forward/backward label |
| Net acceleration | `--net` (ink) | dashed arrow |
| Orbit type | `--c-circle`, `--c-ellipse`, `--c-parab`, `--c-hyper`, `--c-crash` | the type is also written in the readout |

## Responsive rules

- Portrait phones (≤ 920 px wide): header hidden, panel below the stage, labels on toolbar buttons hidden, fewer speed buttons, smaller energy bars.
- Short landscape screens (≤ 600 px high): header and quick toggles hidden.
- Respect `prefers-color-scheme`, `prefers-reduced-motion` and the safe-area insets.
