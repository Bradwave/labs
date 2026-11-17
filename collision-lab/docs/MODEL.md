# Collision Lab · the model

- **Table**: 2.0 m × 1.2 m, frictionless (air table). Between contacts every body moves uniformly; no forces act except at contacts.
- **Discs**: masses 0.1–1 kg, radius r = 4.5 cm · √(m / 0.25 kg) (same thickness and material, so area ∝ mass).
- **Contacts**: discs are smooth (no friction between them), so the impulse is along the line of centres. With relative normal velocity v_n and coefficient of restitution e, the impulse is J = −(1 + e)·v_n / (1/M_A + 1/M_B + (r_A×n)²/I_A + (r_B×n)²/I_B). For two free discs the last two terms vanish and the textbook formulas follow (tested in `tests/physics.test.mjs`).
- **Exact contact times**: for bodies that do not rotate, the next contact is the root of |d + w·t| = r_A + r_B, so collisions happen at the right instant whatever the time step. When a stuck pair rotates, contacts involving it are found by overlap with 1 ms sub-steps.
- **Sticking (velcro)**: on contact two bodies merge into one rigid cluster; its momentum and its angular momentum about the new centre of mass are those of the two bodies, so an off-centre hit makes the pair spin. Moment of inertia I = Σ m·|o|² (discs as point masses at their centres), so the kinetic energy of a cluster is exactly Σ ½·m·v² over its discs.
- **Explosion**: at t = 0.5 s the pair receives equal and opposite impulses along the line of centres, of size J = √(2·E·μ) with μ the reduced mass, so the kinetic energy grows by exactly E.
- **Bumpers**: elastic (e = 1 for the walls), the only external force. Their total impulse is recorded and equals the change in total momentum.
- **Energy split**: K = K_CM + K_int with K_CM = P²/2M. P is conserved without bumpers, so K_CM cannot change; a collision can only remove (e < 1, sticking) or add (explosion) internal kinetic energy.
- **Frames**: the centre-of-mass frame moves with the current velocity of the centre of mass. Velocities, momenta, graphs and the balance are shown in the chosen frame; the inelastic percentage in the verdict is always computed in the lab frame.
- **Run**: physics step 1/240 s (contacts are exact within it), samples every 0.02 s, stop after 15 s or when every disc is 25 cm beyond the table.
