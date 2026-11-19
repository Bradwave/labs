# Parameter Lab XR — prototype plan

Status: **prototype v0.1** (2026-11-18). Everything XR is **unverified on the Quest**; the maths and the page are tested in Node and in a desktop browser.

## The idea
Parametric exercises ("discuss, as k varies, the number of solutions of …") are usually drawn one k at a time. Here the (x, y) plane is **extruded along k**: a curve F(x, y; k) = 0 becomes a surface, an inequality a solid, and two relations meet in a curve in space. A horizontal **slice** at k is the ordinary 2D plot, so students see the family and the single case together.

## Decisions
- **One box per relation** with `=`, `<`, `≤`, `>`, `≥`: equations and inequalities share a grammar. Without a sign, `x^2 + k` means `y = x^2 + k`. Typing happens on a computer or phone; in the headset you pick examples and move k (a headset has no keyboard in WebXR). Prepare on the page, share with link or QR.
- **Colour meaning is fixed and minimal**: blue A, orange B (a colour-blind safe pair), violet = solutions. Counts use a violet sequential ramp *and* the number written on each interval.
- **The discussion is the teaching point**, so it is computed exactly where possible: critical values by bisection, then Newton on tangency (`FA = FB = det J = 0`), giving ±2√2 for a line and a circle to 4 digits. It can be hidden so students predict first.
- **Cognitive load**: one slice plate, one panel, six buttons; layers, surfaces and the discussion toggle off; "Slice only" dims everything else; three colours; a guiding question per example.
- **No remote anything**: parser written here (no eval of user text), contours and meshing in plain JS.
- **Window clipping is explicit** (info text and the "≈" mark) rather than hidden: presets were chosen to keep solutions inside.
- Structure and XR plumbing copied from Fourier Lab XR (handle gesture, panel, desktop camera); the surface mesher is Surface Lab XR's marching tetrahedra with a pole check added.

## Not done yet (next)
1. **Test on the Quest**: button indices (`GP` in `app.js`), thumbstick axis (`axes[3]`), pinch thresholds on the handle (reach is `0.08 + 0.2·scale` m), legibility of the 3D labels and of the panel (plot 37 cm wide at 0.55 m), cost of ~20 translucent slabs (reduce `i % 2` stride or texture size if slow). `?monitor=1` prints raw input on the panel.
2. **Predict · discuss · compare**: students flag expected critical values by pinching in the air, then reveal the discussion (the toggle exists; flags and scoring do not).
3. **Second parameter as an axis** (a heat map of counts over (a, k)) or a pinned slice to compare two k side by side.
4. **Equation entry in the headset** (a keyboard like Surface Lab XR's `panel.js`) and the shared `kit/xr/` once a third XR lab needs the panel code.
5. **Area of the solution set vs k** for inequality systems (the same masks give it).
6. Spatial anchors / plane detection so the stack sits on a real table.
7. Shared palette review: rose and violet are the prototype's choice (`apps.json` note).
8. Real-root semantics (`x^(1/3)` of negatives) and more functions if asked; `log` is base 10, `ln` natural.

## Known limits
- The count is of *boundary intersections* sampled on a grid (80 cells, 160 slices): a tangency closer than one cell can be missed at that k; a domain edge landing inside a grid cell loses a root next to it (found with √x, fixed for the cell at x = 0 only).
- Inequalities are solids sampled as ~11 translucent layers, not a true volume.
- Curves with many pieces (e.g. sin(x) with a line through the origin) produce many "≈" critical values because intersections leave the window.
