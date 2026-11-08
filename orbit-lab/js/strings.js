// Orbit Lab · strings.js
// All user-facing text in one place (English now, ready for translation).
/* =====================================================================
   Orbit Lab · single-file build
   Sections: STRINGS · DATA · CORE (pure physics, no DOM) · SIM · RENDER · UI · MAIN
   Units: mu = GM = 1, planet radius R = 1. Circular speed at the surface = 1, escape = sqrt(2), T0 = 2*pi.
   ===================================================================== */

/* ============================== STRINGS ============================== */
export const STR={
  ui:{
    tagLine:'Climb a tower, throw a ship sideways, and watch free fall turn into an orbit. Then change the orbit with thrusters.',
    gTower:'Tower', hLab:'Tower height h/R', gMode:'Launch mode', modeCannon:'Cannon', modeProg:'Thrust program',
    vLab:'Launch speed (units of v꜀₀)', aLab:'Angle above the horizontal', bLab:'Burn duration',
    progA:'Thrust a(t), in units of g₀ — drag the points', progT:'Pitch θ(t) from the vertical — drag the points',
    progNote:'The ship waits on the pad while the thrust is smaller than gravity. Double-click a plot to add a point, drag a point off the plot to remove it.',
    launchLbl:'Launch', gThr:'Thrusters', tlLab:'Thrust level (g₀)', dvLab:'Click = fixed Δv step', bgLab:'Δv budget',
    tPro:'Prograde', tRetro:'Retrograde', tOut:'Radial out', tIn:'Radial in',
    thrNote:'Hold a button (or its key) to burn. A quick click gives one small Δv step.',
    gVeffT:'Effective potential', sclLab:'Arrow length', kepLab:'Kepler strobe interval', clrLbl:'Clear ghost trails',
    gLevel:'Level', gPlanet:'Real planet (display only)', gData:'Data', csvLbl:'Copy CSV', csvDlLbl:'Download CSV',
    gTeach:'Teacher panel', teachNote:'Switch single features on or off. Choices are kept in this browser and in the link.',
    gChase:'Rendezvous', chaseNote:'A target ship flies on the same circular orbit as you, ahead of you or behind you. Meet it: get within 0.06 R and match its velocity (within 0.05 v꜀₀). Only your thrusters can change your motion.',
    leadLab:'Gap at the start (angle along the orbit)', chaseStartLbl:'Start chase', chaseExitLbl:'Leave chase mode',
    trLbl:'Back to level defaults', linkLbl:'Copy link', helpTitle:'How it works'
  },
  chase:{hint:'The shorter the period of an orbit, the faster you go round it. To gain on a ship ahead, you want a shorter period than its period. Which burn gives you that?',
    gaining:'You are gaining on the target',losing:'You are falling behind',same:'Same pace as the target'},
  hints:{prep:'Set the tower and the launch, then press Launch · wheel zooms, drag pans',fly:'Thrusters W S D A · Space plays or pauses · drag the scrubber to rewind'},
  lv:['Qualitative: shapes, closest and farthest point.','Quantitative: numbers, units, thrust program, Kepler tools.','Advanced: L, eccentricity vector, work by thrust, effective potential, Δv budget.'],
  types:{circle:'circle',ellipse:'ellipse',parabola:'≈ parabola',hyperbola:'hyperbola',radial:'straight line',crash:'hits the ground',stay:'on the pad'},
  hLabel:'Tower height h/R',
  tower:'The tower is drawn to scale. It is only a gantry: the ship ignores collisions with it.',
  help:`<p><b>Free fall around a planet.</b> The ship starts at the top of a tower of height <i>h</i>. Throw it sideways: gravity keeps pulling it toward the centre, and the faster you throw, the farther it lands. At a certain speed the ground curves away as fast as the ship falls: that is an orbit.</p>
  <h3>Units</h3><p>The planet radius is 1 and the speed of a circular orbit at its surface is 1 (<i>v</i><sub>c0</sub>). Escape speed is √2. A surface orbit lasts 2π time units. On the tower the markers on the speed slider show the circular speed <i>v</i><sub>c</sub>(h) = 1/√(1+h) and the escape speed √2·<i>v</i><sub>c</sub>(h).</p>
  <h3>The dashed curve</h3><p>It is the orbit the ship would follow from now on if the thrusters stay off: green circle, blue ellipse, amber ≈ parabola, magenta hyperbola, red when it hits the ground. Dots mark the closest (filled) and farthest (hollow) points, a cross marks the impact.</p>
  <h3>Energy bars</h3><p>K kinetic (solid blue), U potential (hatched orange), E total (dotted outline). One unit is the kinetic energy of a surface circular orbit. E = 0 is the escape line.</p>
  <h3>Rewind</h3><p>Drag the scrubber to go back. Press play or fire a thruster from there to branch a new flight.</p>
  <h3>Keys</h3><p><kbd>Space</kbd> play/pause · <kbd>W</kbd> <kbd>S</kbd> prograde/retrograde · <kbd>D</kbd> <kbd>A</kbd> radial out/in · <kbd>R</kbd> reset · <kbd>F</kbd> fit orbit.</p>`
};
