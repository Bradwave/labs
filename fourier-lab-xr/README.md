# Fourier Lab XR (prototype)

Wind a signal around the frequency axis **in augmented reality**. The signal g(t) is wound clockwise at frequency f; its centre of mass c(f) leaves the origin only when f is a frequency of the signal. Slide the handle along the axis and c(f) draws, as a trail in the room, the Fourier transform of the signal.

Runs in the Quest Browser (WebXR passthrough or VR, hands or controllers) and on a computer. Interface in Italian and English, works offline. No build step: plain HTML, CSS and JavaScript, Three.js r128 bundled.

Part of the math and physics labs: the look and behaviour follow the shared [lab design standard](https://github.com/Bradwave/labs/blob/main/DESIGN.md).

## Features
- **The function as a rope**: g(t) hangs on a time rail in seconds; turn f and it twists clockwise into a corkscrew; press **Wind** and it slides into the plane as the wound curve, where its centre of mass starts to leave the trail.
- **Handle**: pinch (or trigger / grip) the yellow box on the frequency axis and move it: the position of your hand is the frequency f.
- **Knob**: grab the bead on the ring and turn your wrist clockwise around the axis; one full turn is 1 Hz, the same motion as the winding.
- **Flywheel**: switch the input to Wheel, throw the spoked wheel clockwise and f = κ · turns per second; it spins on and slows by friction, so the trail draws itself. Hold it to stop it.
- **Radio mode**: a third input next to Direct and Wheel. Turn the tuning knob like a radio dial (8 Hz per turn); the |c| meter shows how well you lock on, and the controller buzzes when you are tuned. Web Audio plays the signal and a tone at f together (beats, mixer product, or a probe tone whose loudness is |c|), with the frequencies moved into the audible range.
- **Advanced views**: the running walk of the partial integral, a trace coloured by phase, wall shadows of Re(f) and Im(f), epicycles, and plots of the product g·cos (its signed area is Re c) or g against cos.
- **Trail**: the centre of mass leaves a trace in (f, Re, Im) only where you have already been; "Whole curve" reveals where it will go.
- **Floating panel**: signal g(t), the readout of Re c, Im c and |c|, the explored spectrum (touch it to jump to a frequency), sweep, reset and four example signals (one sine, two, with a mean value, hidden in noise).
- **Small rooms**: grab the cube at the base of the axis to move the scene, use the second hand to scale it.
- On screen: drag the handle, orbit, zoom, slider and keyboard.

## Run
Serve the repository root and open `/fourier-lab-xr/`. Headsets need HTTPS (the published site) or `adb reverse` for a local server.

## Status
Prototype: everything XR is **unverified on the Quest** (button indices, hand joints, passthrough legibility, comfort of the knob gesture). Next steps are in `docs/PLAN.md`.

## Licence
MIT.
