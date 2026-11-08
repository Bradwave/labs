# Progress

## Done

1. **Setup and style.** Repository layout, design tokens, `STYLE.md`.
2. **Physics core and tests.** Conic classification and prediction, RK4 integrator, exact impact, thrust and programs, energy, history. 16 checks in `tests/`.
3. **Main view and cannon mode.** Planet, tower of adjustable height, ship, trail, predicted orbit, readouts, launch and reset.
4. **Representations and time.** Vectors, energy bars, plots, effective potential, time controls, scrubber with branching, ghost trails, no-gravity ghost, Kepler strobe and wedges.
5. **Thrusters and thrust program.** Four directions, hold or click, forward/backward label, editable thrust and pitch plots with live preview.
6. **Levels, missions, teacher panel.** Three levels, ten missions, per-feature switches, URL parameters and local storage, CSV export.
7. **Polish.** Phone layout, ship cam, rendezvous mode (Chase), modular repository and single-file build.

## Known limitations

- The equal-area wedges are drawn from the recorded trail and look coarse at high speed.
- The ship cam shows the planet only when it falls inside the field of view; far from the planet it is out of frame.
- Mission goals are checked on the state being shown, so scrubbing back can satisfy or lose a goal.
- Keyboard use is complete for the thrusters and time controls, but the canvas itself is not keyboard-pannable.
- Not yet tested on a wide range of real phones and tablets.

## Ideas

- Italian translation: move `STR` and the mission texts into a language file.
- Two-dimensional $\Delta v$ planner (Hohmann transfer helper) at level 3.
- Share a flight as a link (state and thrust events).
- Reuse `js/core` in a 3D / AR version.
