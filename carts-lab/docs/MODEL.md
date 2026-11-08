# Physical model

All quantities are in SI units. Constants live in `js/config.js`.

## Dynamics (`js/physics.js`)

One dimension, fixed step `DT = 0.2 ms`, semi-implicit Euler. Carts are 12 cm long; the rail length is adjustable (default 1 m).

**Cart–cart force.** Collisions are not instantaneous: they are force interactions during which momentum is exchanged, so the sensor graphs show a short but finite transition.

- *Magnets (same poles).* A short-range repulsion $F = F_0\,\bigl(d_0/(g+d_0)\bigr)^{N}$, shifted so it vanishes at `MAG_RANGE`, plus a hard-contact spring–damper. Almost elastic.
- *Velcro against velcro.* A weaker attraction of the same form and a heavily damped contact (`ZETA_STICK`): perfectly inelastic.
- *Spring plunger.* Three states: blocked (hard contact), active (soft spring of stiffness `K_SPRING` with small damping), loaded (compressed; when fired it pushes with `K_FIRE` over a stroke chosen among three levels).

Here $g$ is the gap between the facing ends. The contact spring–damper uses the damping ratio $\zeta$ to set the restitution.

**Friction.** Constant rolling resistance $\mu m g \cos\theta$ opposite to the velocity, with a static-stick rule below `VEPS`. Quadratic air drag with a very small coefficient.

**Tilt.** Set as the height difference $\Delta h$ of the two feet (left minus right, in mm). With $L$ the rail length,

$$\sin\theta = \frac{\Delta h}{\sqrt{L^2+\Delta h^2}}, \qquad a = g\sin\theta$$

A positive value means the left end is higher and the carts accelerate to the right. A tilt with $\tan\theta=\mu$ compensates friction, but only for one direction of motion.

**Dragging.** A held cart is kinematic (it follows the pointer with critical smoothing) and cannot pass through the other cart; on release it keeps the velocity of the gesture.

**Derailing.** A cart whose centre passes the end of the rail falls and leaves the sensor's view.

## Sensors and recording (`js/sensors.js`)

- Sensor S1 is at the left end and measures the distance to the nearest cart face on its side, S2 at the right end likewise. Each sensor therefore measures its own distance: the same motion has velocities of opposite sign on the two sensors. An inversion switch flips the sign per sensor.
- Dead zone: below `DEAD = 0.15 m` the reading is the minimum distance.
- Noise: Gaussian with standard deviation `σ` (default 0.5 mm), seeded; readings rounded to 0.1 mm.
- Sampling at `f` Hz (10–40, default 30). Velocity comes from the **samples**, by the three-point central difference $v_i = (x_{i+1}-x_{i-1})/(t_{i+1}-t_{i-1})$, so it carries the same noise amplification as a real logger.
- The true curves are stored every 2 ms for the optional overlay and for replaying the scene.
- Trigger: the run starts when a sensor's true distance differs from its value at arming by more than a threshold; $t=0$ is the instant of crossing.
- Scale: reading $=\operatorname{round}\bigl((m+\varepsilon)/1\,\mathrm{g}\bigr)$ with $\varepsilon\sim\mathcal N(0,\ 0.6\ \mathrm g)$. Hidden masses are drawn from a seeded generator in $[0.8, 1.2]$ kg, at least 60 g apart.

## Fits (`js/fit.js`)

Least-squares polynomials of degree 0, 1 or 2 in the local time $\tau = t - t_0$ over the selected interval, with standard errors and $R^2$. On a position graph the slope of a line is the velocity and twice the quadratic coefficient is the acceleration; on a velocity graph the slope is the acceleration. Fits are stored as definitions (run, sensor, graph, degree, interval) and recomputed from the displayed series, so sign inversion and crop are always consistent.

## Calibrating against real data

The constants are estimates. To tune them from a real recording of the same set-up:

1. **Noise** `SIGMA_DEFAULT`: standard deviation of the position of a cart at rest.
2. **Friction** `MU_DEFAULT`: deceleration of a free cart is $\mu g$.
3. **Collision duration and restitution**: compare the width of the velocity step of a magnetic collision (adjust `REP_F0`, `REP_D0`, `MAG_N`, `MAG_RANGE`) and the speeds after an inelastic one (`ZETA_STICK`).
4. **Spring plunger**: `K_SPRING`, `ZETA_SPRING`; and for launches `K_FIRE`, `FIRE_E`.

After changing constants, run `npm test`: the tests check conservation laws and orders of magnitude, not exact values, and use tolerances that should still hold for reasonable settings.
