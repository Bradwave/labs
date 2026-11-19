# Dynagraph XR — prototype plan

Status: **prototype v0.1** (2026-11-18). Maths tested in Node; page and scene checked in a desktop browser; the hand gesture was driven with faked joints. **Everything XR is unverified on the Quest.**

## From the web app to AR
The Dynagraph web app (`Bradwave/dynagraph`) draws f, g and a composition h between parallel axes (IN, OUT, COMP) and lets you drag the inputs. In AR the axes are a vertical plane at arm's reach:
- **The input is your hand**: pinch the ball on the top axis and move left/right. Two hands move f and g independently; "Link" ties them.
- **Composition**: the third axis; h acts on the output of f and of g; links 2→3, 1→3 or both, as in the web app.
- **Trace / samples**: kept as in the web app (last N positions fading with age in four steps; evenly spaced samples by density or exact interval/start/end).
- **Cartesian mode**: the graphs y=f(x), y=g(x) and h(y) in square frames beside the axes, with the moving points.
- **Axes**: zoom, pan, exact range and spacing — on the page (fields), in the headset (panel page "Axes"), on screen (Shift+drag / Shift+wheel on an axis).

## Differences from the web app
No JavaScript input box (no `eval` of user text; no keyboard in WebXR). Colours are the 8 Okabe-Ito pairs (light/dark), chosen with swatches or the "More" page. No per-axis opacity sliders (trace/sample opacities are fixed). Function names are fixed f, g, h.

## Not done (next)
1. **Test on the Quest**: pinch reach on the ball, button indices (`GP` in `app.js`), label legibility (about 15 cm wide at the default scale), panel layout (3 pages), haptic tick per axis tick.
2. Grab an axis in the headset to zoom/pan it (now only panel buttons).
3. Per-function tracing of h separately from f/g; opacity settings.
4. Spatial anchors; a shared `kit/xr/` when a third lab needs the panel code (the panel code is now duplicated in Composition Lab XR and here).
5. Palette: lime page background to stay clear of Composition Lab XR's grey (`node ../tools/check-palettes.mjs`); to be reviewed.
