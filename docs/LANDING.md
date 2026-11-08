# Landing page plan: "the lab"

Draft, 2026-11-09. To be built in its own session. Replaces the placeholder `index.html` (a grid of cards).

## Idea

labs.matephis.com opens on a **physics and maths laboratory seen from the side**: benches, shelves, a blackboard, equipment everywhere. Every lab of the repository has its **station**: a piece of equipment that shows, with a small looping animation, what the lab is about. Each station carries the lab's **wordmark** (the letter tiles and the `lab` badge, as in the lab's own header) as its label, like a sign on the bench. Clicking a station opens the lab.

It should feel like walking into a room full of things to try, not like browsing a catalogue.

## Stations (first ideas, one per lab)

| Lab | Station | Animation |
|---|---|---|
| Pendulum Lab | a stand with a bob on a string | the bob swings (period matching its drawn length) |
| Carts Lab | a rail with two carts and a sensor at each end | the carts collide and bounce, a sensor light blinks |
| Impulse Lab | a force sensor with a ball, a small F(t) screen | the ball hits, the F(t) bump draws and its area fills |
| Motus 1D Lab | a cart on a track with three small graph screens | the cart moves, s–t, v–t, a–t trace in sync |
| Relative Motion Lab | a toy train with a passenger throwing a ball | the ball's path from the ground and from the train |
| Orbit Lab | a globe with a tower | a ship launched sideways falls into orbit |
| Orbit Lab XR | a VR headset on a hook next to the globe | a tiny orbit inside the lens |
| Crackler | a camera on a tripod and a falling ball | dots appear frame by frame along the fall |
| Detach Lab | a beam line with a laser and a detector screen | an atom flies off, hits the detector, a dot appears |
| Quadrature | graph paper with a blob shape | squares fill in, the counter goes up |
| Attractor Lab | a framed canvas | a fractal appears point by point |
| Metric Lab | a city map on the wall | a taxi path, a straight line and a ball in different metrics |
| Units Lab | a balance and a mountain poster | weights move, a flag climbs |
| Surface Lab XR | a 3D surface model under a lamp with a slicing plane | the plane moves, the conic section changes |

The station can borrow from the lab's animated logo (see the roadmap), but it is its own drawing: the logo is a square icon, the station is a piece of the room.

## Layout

- **Desktop:** a wide room, built as a grid of **benches** (zones): Mechanics, Motion, Space, Waves and signals (future), Geometry and numbers, Video and data, XR corner. A bench holds 2–4 stations; adding a lab means adding a station to a bench, never redrawing the room.
- **Phones:** the same benches stacked vertically (one bench per screen width, stations in a row that may scroll sideways). No zooming and panning around a big picture: it is slow and hard to use with a thumb.
- **Header:** the site wordmark (`matephis` tiles + `labs` badge) with info and settings, as every lab.
- Below the room: a short intro, and an **"all labs" list** (text, filters by subject) for people who want to find a lab quickly or use a screen reader.

## Rules

- **Style:** the kit's language (tiles, 2 px ink, hard shadows, graph-paper background, Space Mono). Equipment is drawn with ink outlines and palette fills, no gradients, no realism. Each station uses its lab's palette (from `apps.json`) for its fills, so the room is colourful but every colour means "that lab".
- **Physics honesty:** animations obey the physics they show (a pendulum's period, a parabola, a closed orbit). They are decorative but never wrong.
- **Animation:** SVG with CSS keyframes (no canvas loops, no libraries). Loops of 2–8 s, gentle. Only stations on screen animate (IntersectionObserver), everything stops when the tab is hidden, and with `prefers-reduced-motion` each station shows a meaningful still frame. Hover/focus may add a small extra motion.
- **Accessibility:** each station is a link with the lab's name and one-line description (aria-label), reachable with Tab in a sensible order; the animation is `aria-hidden`.
- **Languages and theme:** Italian/English and light/dark from the kit's settings menu; stations are inline SVG so they follow the theme switch.
- **Performance:** first paint under 1 s on a school Chromebook; total page weight (SVG + CSS + JS, without fonts) under ~300 kB; no image files needed.
- **Data:** names, descriptions, palettes, subjects and the "being updated" state from `apps.json`; each station's drawing in `home/stations/<slug>.svg` (or a `station` field pointing to it). A new lab without a station still appears in the list and on a "new arrivals" shelf.

## Open questions for the session

1. Station sketches: draft all and review in one gallery, or one bench at a time?
2. Benches: the grouping above, or by school year / curriculum topic?
3. Should labs still "being updated" appear in the room, or only in the list until migrated?
4. Is the animated logo (square icon) designed before or after the stations? (Recommended: stations first, then logos derived from them.)
5. A short "what is this site" for teachers (Italian first), and credits, on the home page or in the info dialog?

## Steps for the session

1. Agree on benches and the list of stations (this table, refined).
2. Sketch the room layout on desktop and phone (static SVG), review.
3. Draw stations one bench at a time, with their animation and still frame; review in a station gallery.
4. Build `index.html` from `apps.json`: room, list, filters, header, info dialog; kit for settings, language and theme.
5. Check on desktop, phone portrait and short landscape, both themes and languages, reduced motion; measure weight and frame rate.
6. Update DESIGN.md (stations as part of a lab's identity) and MIGRATION.md (a new lab needs a station).
