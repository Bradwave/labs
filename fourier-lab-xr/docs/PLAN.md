# Fourier Lab XR — prototype plan

Status: **prototype v0.1** (2026-11-18). Built from the single-file "Fourier Lab" prototype (artifact, 2026-11-13). Everything XR is **unverified on the Quest**.

## What the prototype does
Same maths as the 2D prototype (`js/fourier.js`, tested): one or two sinusoids, mean value, noise; winding at frequency f; centre of mass c(f); explored-only trace; ghost of the whole curve. The 3D scene is real space instead of a projection: the frequency axis is about 1 m long in front of you (AR passthrough or VR), the winding plane rides on the axis with the handle, and the trace is a thick tube drawn as instanced segments.

## Decisions
- **Passthrough first**: the main button is "Augmented reality"; VR is the same scene on a dark floor grid. The dark palette is used in both (bright hues survive passthrough).
- **Two gestures for f**, as the prototype's info promised: handle (hand position = f) and knob (wrist turns clockwise, 1 turn = 1 Hz). Both work with pinch (hands) and trigger/grip (controllers). The knob is the new thing AR gives: the same motion as the winding.
- **Scene placement**: put in front of the user at first frame and on "Recentre"; the base cube moves it, a second hand scales it (comfort only: interaction maths is in stage coordinates).
- **Panel**: canvas texture; fingertip poke for hands, ray + trigger for controllers, 4.8 cm buttons. It carries the plots that are tabs in the 2D page.

- **Flywheel kept** (2026-11-18): the prototype's "Ruota" input is a 3D wheel next to the axis, same clockwise gesture as the knob; `Fourier.Wheel` is pure and tested (ratchet, friction, κ continuity). The on-screen page has the same graphs as the headset panel (g(t) and the explored spectrum, drag to set f).

- **The function is visible** (2026-11-18): g(t) is a rope on a time rail; f twists it; Wind slides it into the plane, so the winding is something you watch, not only a result.

- **Radio mode, sound and advanced views** (2026-11-18): third input mode with a tuning knob; Web Audio plays the signal and a probe tone at f (beats, mixer product, |c| probe); advanced options for the walk, phase colours, wall shadows, epicycles and product/correlation plots. All unverified on the Quest, and the audio is unverified by ear.

## Not done yet (next)
1. **Test on the Quest**: audio start from a controller click inside the session (the page click on AR/VR is what unlocks it), knob gesture and detents, haptics (`hapticActuators`), button indices (`GP` in `app.js`), pinch thresholds on the handle (reach is `0.08 + 0.2·scale` m), legibility of the axis and labels in passthrough, knob comfort, panel height and tilt. `?monitor=1` prints raw input on the panel.
2. **Predict · discuss · compare** (the prototype's third tab): flag peaks on the axis by pinching in the air, sweep, compare. `Fourier.evalFlags` is ready; needs flag meshes and a panel step.
3. **Grab the rope itself**: pull its end to wind it by hand (today Wind is a button/animation); a tactile spool.
4. **Spatial anchors / plane detection** so the axis can sit on a real table (`plane-detection`, `anchors` features).
5. Shared `kit/xr/` once a third XR lab needs the panel code.
6. Shared palette: the sand/orange palette is the 2D prototype's; `apps.json` has it as proposed — review with `node tools/check-palettes.mjs` before the 2D Fourier Lab is migrated.
7. Resonator bank (pendulums or tuning forks driven by the signal), diffraction scene, spectrogram: advanced views not built yet.
