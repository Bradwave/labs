# Composition Lab XR — prototype plan

Status: **prototype v0.1** (2026-11-18). Maths and page tested in Node and in a desktop browser; the hand gestures were driven with faked joints. **Everything XR is unverified on the Quest.**

## From the 2D lab to AR
The Composition Lab artifact shows f, g and g∘f as graphs on three perpendicular planes and lets you drag x₀ on the x axis. In AR the same geometry becomes a thing you stand next to:
- **x is your hand**: its left-right position along the x axis is x₀, so "taking x to f(x)" is something you do, not watch.
- **Order is left and right**: a second hand is x₁; the arrows on the axes say whether f and g keep the order of your two hands.
- **You paint the graph**: g∘f appears where your hand has been (the 2D "Trace"), so prediction comes first.
- **Walking replaces the xy / yz / xz buttons**: look at a plane edge-on by moving.

## Against cognitive overload
No grids or tick numbers; corner brackets for planes; numbers only where something travels; g outside f's range is faint; levels f · +g · +g∘f; ten large panel buttons; nothing else on the panel but the formulas and the guiding question.

## Not done (next)
1. **Test on the Quest**: pinch reach on the ball (`0.06 + 0.4·scale` m), button indices (`GP` in `app.js`; thumbstick x is `axes[2]`), label legibility (value labels are 1.7 units ≈ 15 cm wide at the default scale), panel position (to the left, 0.62 m).
2. Predict-by-drawing: draw the expected g∘f with a finger, then compare with the painted one.
3. Inverse view: grab the z value and see which x map to it (preimages; shows non-injective f).
4. Equation entry in the headset (no keyboard in WebXR): for now write on the page and share the link or QR.
5. Spatial anchors so the planes sit on a real table; shared `kit/xr/` when a third XR lab needs the panel code.
6. Palette is the prototype's (cool grey, from the artifact): review with `node ../tools/check-palettes.mjs`.
