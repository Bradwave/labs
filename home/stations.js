// Labs · home/stations.js
// Bespoke 2D animated SVG laboratory apparatuses for every app in apps.json,
// plus a generic modular console fallback for future apps.
// Every apparatus shares viewBox="0 0 260 156" with tabletop contact at y = 148.

const STATIONS = {
  // ── 01 · MECHANICS & COLLISIONS ───────────────────────────────────────────

  // Pendulum Lab: retort stand, clamp, protractor arc, swinging yellow bob, force vector & tabletop stopwatch
  "pendulum-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Heavy laboratory retort stand base -->
      <rect x="40" y="138" width="124" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="46" y="133" width="112" height="5" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Vertical steel rod & clamp -->
      <rect x="64" y="18" width="8" height="115" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="60" y="24" width="16" height="14" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Horizontal cantilever arm -->
      <rect x="76" y="27" width="76" height="8" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Protractor dashed arc behind bob -->
      <path d="M98,108 A78,78 0 0 0 176,108" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-dasharray="4 4" opacity="0.45"/>
      <line x1="137" y1="31" x2="137" y2="122" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.35"/>
      <!-- Swinging pendulum assembly (pivot at 137, 31) -->
      <g class="st-pend-arm" transform="rotate(-22 137 31)">
        <line x1="137" y1="31" x2="137" y2="104" stroke="var(--ink)" stroke-width="3"/>
        <!-- Gravity arrow subtle physics indicator -->
        <line x1="137" y1="116" x2="137" y2="130" stroke="var(--force)" stroke-width="2.5"/>
        <polygon points="133,128 141,128 137,134" fill="var(--force)"/>
        <!-- Pendulum bob -->
        <circle cx="137" cy="108" r="14" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="3"/>
        <circle cx="133" cy="104" r="3" fill="var(--st-surface)" opacity="0.7"/>
      </g>
      <!-- Accent pivot pin -->
      <circle cx="137" cy="31" r="5" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Tabletop stopwatch sitting beside stand -->
      <g transform="translate(188, 102)">
        <rect x="14" y="0" width="10" height="6" fill="var(--ink)"/>
        <circle cx="19" cy="24" r="20" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
        <circle cx="19" cy="24" r="15" fill="none" stroke="var(--st-brand)" stroke-width="2"/>
        <path d="M19,10 v3 M33,24 h-3 M19,38 v-3 M5,24 h3" stroke="var(--ink)" stroke-width="1.6"/>
        <line class="st-pend-hand" x1="19" y1="24" x2="19" y2="12" stroke="var(--st-accent)" stroke-width="2.2" transform="rotate(35 19 24)"/>
        <circle cx="19" cy="24" r="2.5" fill="var(--ink)"/>
        <rect x="6" y="42" width="26" height="4" fill="var(--ink)"/>
      </g>
    </svg>`,

  // Carts Lab: elevated dynamics air-track rail, twin colliding carts, photogate LED sensors & impact spark
  "carts-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Track support legs resting on y=148 -->
      <polygon points="34,116 48,116 54,148 26,148" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <polygon points="212,116 226,116 234,148 206,148" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Main dynamics rail -->
      <rect x="16" y="106" width="228" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Ruler ticks along rail -->
      <path d="M36,106 v5 M56,106 v7 M76,106 v5 M96,106 v7 M116,106 v5 M136,106 v7 M156,106 v5 M176,106 v7 M196,106 v5 M216,106 v7" stroke="var(--st-brand-ink)" stroke-width="1.5"/>
      <!-- Left & right photogate sensor towers -->
      <rect x="18" y="64" width="12" height="42" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect class="st-cart-led-l" x="21" y="70" width="6" height="6" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.5"/>
      <rect x="230" y="64" width="12" height="42" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect class="st-cart-led-r" x="233" y="70" width="6" height="6" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.5"/>
      <!-- Left cart (yellow) -->
      <g class="st-cart-a" transform="translate(18 0)">
        <rect x="38" y="74" width="44" height="22" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5"/>
        <rect x="46" y="66" width="14" height="8" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2"/>
        <circle cx="49" cy="101" r="5" fill="var(--ink)"/>
        <circle cx="71" cy="101" r="5" fill="var(--ink)"/>
      </g>
      <!-- Right cart (surface white with accent bumper) -->
      <g class="st-cart-b" transform="translate(-18 0)">
        <rect x="178" y="74" width="44" height="22" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
        <rect x="172" y="80" width="6" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
        <circle cx="189" cy="101" r="5" fill="var(--ink)"/>
        <circle cx="211" cy="101" r="5" fill="var(--ink)"/>
      </g>
      <!-- Elastic collision spark burst -->
      <path class="st-cart-hit" d="M130,36 l4,11 11,0 -9,7 4,11 -10,-6 -10,6 4,-11 -9,-7 11,0 z" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.2"/>
    </svg>`,

  // Collision Lab: 2D air table with frame legs, dashed 90-deg scatter tracks, colliding pucks & air pump tube
  "collision-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Short air-table leveling feet -->
      <rect x="42" y="136" width="12" height="12" fill="var(--ink)"/>
      <rect x="206" y="136" width="12" height="12" fill="var(--ink)"/>
      <!-- Air pump hose on left -->
      <path d="M14,144 C20,144 18,108 32,108" fill="none" stroke="var(--ink)" stroke-width="4"/>
      <rect x="10" y="136" width="20" height="12" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Air table outer bumper frame -->
      <rect x="32" y="20" width="196" height="118" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="3"/>
      <!-- Low-friction white/surface playing field -->
      <rect x="44" y="32" width="172" height="94" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Subtle air-hole grid dots -->
      <path d="M64,50 h1 M96,50 h1 M128,50 h1 M160,50 h1 M192,50 h1 M64,79 h1 M96,79 h1 M128,79 h1 M160,79 h1 M192,79 h1 M64,108 h1 M96,108 h1 M128,108 h1 M160,108 h1 M192,108 h1" stroke="var(--ink)" stroke-width="2" opacity="0.2"/>
      <!-- Equal-mass 90° elastic scatter paths -->
      <g fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4" opacity="0.5">
        <path d="M58,72 H112 L134,42"/>
        <path d="M132,84 L186,112"/>
      </g>
      <!-- Puck B (teal, initially at rest) -->
      <g class="st-coll-pb">
        <circle cx="132" cy="84" r="13" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.8"/>
        <circle cx="132" cy="84" r="4" fill="var(--st-surface)"/>
      </g>
      <!-- Puck A (yellow, incoming) -->
      <g class="st-coll-pa">
        <circle cx="70" cy="72" r="13" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.8"/>
        <circle cx="70" cy="72" r="4" fill="var(--ink)"/>
      </g>
    </svg>`,

  // Impulse Lab: spring force-sensor wall + rolling ball wired to a live F(t) impulse oscilloscope
  "impulse-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Track bed on left -->
      <rect x="14" y="138" width="114" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Force-sensor backstop wall -->
      <rect x="108" y="68" width="18" height="70" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="112" y="76" width="10" height="14" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Coiled steel spring (compresses on impact) -->
      <polyline class="st-imp-spr" points="86,114 90,104 94,124 98,104 102,124 108,114" fill="none" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Rolling orange ball -->
      <circle class="st-imp-ball" cx="38" cy="114" r="12" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Signal cable connecting force sensor to oscilloscope -->
      <path d="M126,124 C138,124 134,142 148,142" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Tabletop F(t) oscilloscope housing -->
      <rect x="146" y="42" width="100" height="100" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="156" y="142" width="14" height="6" fill="var(--ink)"/>
      <rect x="222" y="142" width="14" height="6" fill="var(--ink)"/>
      <!-- Oscilloscope screen -->
      <rect x="156" y="52" width="80" height="58" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <line x1="162" y1="98" x2="230" y2="98" stroke="var(--ink)" stroke-width="2"/>
      <line x1="166" y1="60" x2="166" y2="104" stroke="var(--ink)" stroke-width="1.5" opacity="0.5"/>
      <!-- Shaded impulse area Δp + live F(t) pulse curve -->
      <path class="st-imp-area" d="M172,98 C184,98 188,64 198,64 S212,98 224,98 Z" fill="var(--st-tile2)"/>
      <path class="st-imp-curve" d="M172,98 C184,98 188,64 198,64 S212,98 224,98" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--ink)" stroke-width="3"/>
      <!-- Oscilloscope rotary knobs -->
      <circle cx="170" cy="126" r="7" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <line x1="170" y1="126" x2="174" y2="121" stroke="var(--ink)" stroke-width="2"/>
      <circle cx="194" cy="126" r="7" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <line x1="194" y1="126" x2="198" y2="128" stroke="var(--ink)" stroke-width="2"/>
      <rect x="214" y="121" width="18" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2"/>
    </svg>`,

  // ── 02 · MOTION & MEASUREMENT ─────────────────────────────────────────────

  // Motus 1D Lab: linear track + uniformly accelerating cart beneath a triple-screen (s-t, v-t, a-t) telemetry console
  "motus1d-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Telemetry console stand posts -->
      <rect x="44" y="92" width="10" height="44" fill="var(--ink)"/>
      <rect x="206" y="92" width="10" height="44" fill="var(--ink)"/>
      <!-- Triple-graph monitor housing -->
      <rect x="20" y="20" width="220" height="74" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Screen 1: s(t) parabola -->
      <rect x="30" y="30" width="60" height="54" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <path d="M36,38 V76 H84" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
      <path class="st-m1d-curve" d="M36,76 Q60,76 82,38" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--pos)" stroke-width="3"/>
      <!-- Screen 2: v(t) linear ramp -->
      <rect x="100" y="30" width="60" height="54" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <path d="M106,38 V76 H154" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
      <path class="st-m1d-curve" d="M106,76 L152,38" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--vel)" stroke-width="3"/>
      <!-- Screen 3: a(t) constant horizontal -->
      <rect x="170" y="30" width="60" height="54" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <path d="M176,38 V76 H224" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
      <path class="st-m1d-curve" d="M176,52 H222" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--acc)" stroke-width="3"/>
      <!-- Bottom linear track -->
      <rect x="16" y="138" width="228" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <path d="M36,138 v5 M76,138 v5 M116,138 v5 M156,138 v5 M196,138 v5 M232,138 v5" stroke="var(--ink)" stroke-width="1.5"/>
      <!-- Accelerating yellow cart -->
      <g class="st-m1d-cart" transform="translate(70 0)">
        <rect x="26" y="114" width="38" height="18" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5"/>
        <rect x="52" y="108" width="8" height="6" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
        <circle cx="36" cy="134" r="4.5" fill="var(--ink)"/>
        <circle cx="54" cy="134" r="4.5" fill="var(--ink)"/>
      </g>
    </svg>`,

  // Relative Motion Lab: model rail with rolling train car launching a yellow ball along a true Galilean parabola
  "relative-motion-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Backdrop reference grid panel -->
      <rect x="20" y="24" width="220" height="108" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <path d="M20,56 H240 M20,88 H240 M75,24 V132 M130,24 V132 M185,24 V132" stroke="var(--st-brand-ink)" stroke-width="1" opacity="0.22"/>
      <!-- Ground-frame parabolic trajectory (dashed) -->
      <path d="M62,94 Q130,-14 198,94" fill="none" stroke="var(--st-surface)" stroke-width="2.8" stroke-dasharray="6 5"/>
      <!-- Wooden/ink railway track on y=148 -->
      <rect x="12" y="138" width="236" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <path d="M28,138 v10 M52,138 v10 M76,138 v10 M100,138 v10 M124,138 v10 M148,138 v10 M172,138 v10 M196,138 v10 M220,138 v10" stroke="var(--ink)" stroke-width="1.6"/>
      <!-- Moving train + vertically tossed ball (linear X + quadratic Y = true parabola!) -->
      <g class="st-rel-train" transform="translate(68 0)">
        <!-- Vertical guide in train reference frame -->
        <line x1="62" y1="36" x2="62" y2="96" stroke="var(--st-brand-ink)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.5"/>
        <!-- Tossed ball -->
        <g class="st-rel-ball" transform="translate(0 -52)">
          <circle cx="62" cy="92" r="8.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5"/>
        </g>
        <!-- Train body & launcher chimney -->
        <rect x="55" y="92" width="14" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2"/>
        <rect x="34" y="102" width="56" height="26" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
        <rect x="42" y="108" width="14" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="1.8"/>
        <rect x="68" y="108" width="14" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="1.8"/>
        <circle cx="48" cy="133" r="5.5" fill="var(--ink)"/>
        <circle cx="76" cy="133" r="5.5" fill="var(--ink)"/>
      </g>
    </svg>`,

  // Crackler: video-analysis camera on a tripod filming a calibrated drop-tower with stroboscopic crosshairs
  "crackler": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Camera tripod on left (feet on y=148) -->
      <line x1="64" y1="86" x2="36" y2="148" stroke="var(--ink)" stroke-width="3"/>
      <line x1="64" y1="86" x2="64" y2="148" stroke="var(--ink)" stroke-width="2.5"/>
      <line x1="64" y1="86" x2="92" y2="148" stroke="var(--ink)" stroke-width="3"/>
      <rect x="52" y="78" width="24" height="9" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Camera body & lens -->
      <rect x="32" y="42" width="58" height="36" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <polygon points="90,50 108,42 108,76 90,68" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <circle cx="46" cy="54" r="4" class="st-crk-rec" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.5"/>
      <rect x="56" y="49" width="24" height="16" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Field-of-view subtle cone -->
      <polygon points="108,46 138,24 138,136 108,72" fill="var(--st-brand)" opacity="0.18"/>
      <!-- Calibrated drop-tower screen on right (base on y=148) -->
      <rect x="136" y="138" width="106" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="142" y="18" width="94" height="120" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Calibration ruler ticks -->
      <path d="M142,32 h10 M142,56 h8 M142,80 h10 M142,104 h8 M142,128 h10" stroke="var(--ink)" stroke-width="2"/>
      <!-- Stroboscopic red crosshair markers at y ∝ t² -->
      <g class="st-crk-d0"><path d="M180,32 h18 M189,23 v18" stroke="var(--st-accent)" stroke-width="2.8"/></g>
      <g class="st-crk-d1"><path d="M180,38 h18 M189,29 v18" stroke="var(--st-accent)" stroke-width="2.8"/></g>
      <g class="st-crk-d2"><path d="M180,55 h18 M189,46 v18" stroke="var(--st-accent)" stroke-width="2.8"/></g>
      <g class="st-crk-d3"><path d="M180,83 h18 M189,74 v18" stroke="var(--st-accent)" stroke-width="2.8"/></g>
      <g class="st-crk-d4"><path d="M180,122 h18 M189,113 v18" stroke="var(--st-accent)" stroke-width="2.8"/></g>
      <!-- Falling ball -->
      <circle class="st-crk-ball" cx="189" cy="32" r="9.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5" transform="translate(0 46)"/>
    </svg>`,

  // Units Lab: two-pan laboratory balance + metric summit conversion board with climbing flag
  "units-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Analytical balance on left -->
      <rect x="28" y="138" width="76" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <polygon points="56,138 66,54 76,138" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Rocking balance beam -->
      <g class="st-uni-beam" transform="rotate(-7 66 56)">
        <rect x="22" y="52" width="88" height="8" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
        <!-- Left hanging pan + weight -->
        <line x1="28" y1="60" x2="20" y2="96" stroke="var(--ink)" stroke-width="1.8"/>
        <line x1="28" y1="60" x2="36" y2="96" stroke="var(--ink)" stroke-width="1.8"/>
        <rect x="14" y="96" width="28" height="7" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
        <rect x="21" y="82" width="14" height="14" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2"/>
        <!-- Right hanging pan + twin weights -->
        <line x1="104" y1="60" x2="96" y2="96" stroke="var(--ink)" stroke-width="1.8"/>
        <line x1="104" y1="60" x2="112" y2="96" stroke="var(--ink)" stroke-width="1.8"/>
        <rect x="90" y="96" width="28" height="7" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
        <rect x="95" y="86" width="10" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
        <rect x="106" y="89" width="8" height="7" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
      </g>
      <circle cx="66" cy="56" r="4.5" fill="var(--ink)"/>

      <!-- Summit elevation / scale-conversion stand on right -->
      <rect x="134" y="138" width="110" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="140" y="24" width="98" height="114" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Mountain silhouette -->
      <polygon points="146,132 189,42 232,132" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.8" stroke-linejoin="miter"/>
      <polygon points="178,65 189,42 200,65 194,61 189,67 184,61" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Trail steps -->
      <path d="M158,128 L166,120 L174,108 L182,94 L190,80" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 3"/>
      <!-- Climbing violet flag -->
      <g class="st-uni-flag" transform="translate(22 -42)">
        <line x1="158" y1="128" x2="158" y2="104" stroke="var(--ink)" stroke-width="2.6"/>
        <path d="M158,104 h17 l-5,6 5,6 h-17 z" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2"/>
      </g>
    </svg>`,

  // ── 03 · ORBITS, BEAMS & FORCES ───────────────────────────────────────────

  // Orbit Lab: tabletop planetary orrery with globe, Newton's launch tower and orbiting rocket ship
  "orbit-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Stepped brass/ink orrery pedestal on y=148 -->
      <rect x="76" y="138" width="108" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="118" y="114" width="24" height="24" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Deep-space circular backing ring -->
      <circle cx="130" cy="70" r="56" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Twinkling subtle star crosses -->
      <path class="st-orb-star" d="M88,40 h6 M91,37 v6 M170,96 h6 M173,93 v6 M168,36 h4 M170,34 v4" stroke="var(--st-surface)" stroke-width="1.8"/>
      <!-- Dashed circular orbit path -->
      <circle cx="130" cy="70" r="42" fill="none" stroke="var(--st-surface)" stroke-width="2.4" stroke-dasharray="6 5"/>
      <!-- Planet globe + Newton's tower -->
      <circle cx="130" cy="70" r="22" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.8"/>
      <path d="M116,66 q8,-6 16,2 t12,-4" fill="none" stroke="var(--st-brand)" stroke-width="2.5" opacity="0.6"/>
      <rect x="127" y="40" width="6" height="10" fill="var(--ink)"/>
      <!-- Orbiting rocket ship -->
      <g class="st-orb-ship" transform="rotate(42 130 70)">
        <path d="M130,21 l11,7 -11,7 z" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="miter"/>
        <circle cx="126" cy="28" r="2.5" fill="var(--st-tile2)"/>
      </g>
    </svg>`,

  // Orbit Lab XR: VR headset mounted on a tabletop stand with glowing holographic orbit in the visor
  "orbit-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Tabletop headset cradle standing on y=148 -->
      <rect x="78" y="138" width="104" height="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="122" y="102" width="16" height="36" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Headstrap arms -->
      <path d="M46,66 L64,54 H196 L214,66" fill="none" stroke="var(--ink)" stroke-width="5"/>
      <rect x="38" y="62" width="12" height="22" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
      <rect x="210" y="62" width="12" height="22" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- VR Headset chassis -->
      <rect x="52" y="34" width="156" height="74" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="3"/>
      <!-- Visor screen inside -->
      <rect x="64" y="44" width="132" height="52" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Nose bridge cutout -->
      <path d="M116,108 L130,92 L144,108" fill="var(--bg)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Holographic elliptical orbit inside visor -->
      <ellipse cx="130" cy="68" rx="48" ry="16" fill="none" stroke="var(--st-surface)" stroke-width="2.2" stroke-dasharray="5 4"/>
      <circle cx="130" cy="68" r="10" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.4"/>
      <g transform="matrix(1 0 0 0.34 0 44.88)">
        <g class="st-orbxr-spin" transform="rotate(30 130 68)">
          <circle cx="178" cy="68" r="7.5" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.5"/>
        </g>
      </g>
      <!-- Tiny XR indicator badge on top of headset -->
      <rect x="172" y="24" width="28" height="10" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2"/>
    </svg>`,

  // Detach Lab: horizontal vacuum laser beamline with vertical pulsing laser and twin-atom detector screen
  "detach-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Optical rail base on y=148 -->
      <rect x="16" y="138" width="228" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <!-- Optical bench posts -->
      <rect x="44" y="110" width="10" height="28" fill="var(--ink)"/>
      <rect x="116" y="110" width="10" height="28" fill="var(--ink)"/>
      <rect x="212" y="122" width="10" height="16" fill="var(--ink)"/>
      <!-- Ion source chamber on left -->
      <rect x="22" y="64" width="38" height="46" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="30" y="76" width="14" height="22" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Horizontal vacuum beam tube -->
      <rect x="60" y="72" width="144" height="30" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.4"/>
      <line x1="60" y1="87" x2="204" y2="87" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.5"/>
      <!-- Overhead laser emitter -->
      <rect x="108" y="18" width="26" height="20" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="116" y="38" width="10" height="6" fill="var(--ink)"/>
      <!-- Vertical pulsing raspberry laser beam -->
      <rect class="st-det-las" x="118" y="44" width="6" height="90" fill="var(--st-accent)" opacity="0.4"/>
      <!-- Detector phosphor plate on right -->
      <rect x="204" y="34" width="26" height="90" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="209" y="42" width="14" height="74" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Twin impact marks on detector -->
      <g class="st-det-mk">
        <rect x="210" y="54" width="12" height="8" fill="var(--st-accent)"/>
        <rect x="210" y="102" width="12" height="8" fill="var(--st-accent)"/>
      </g>
      <!-- Paired I₂⁻ atoms splitting on laser hit -->
      <g class="st-det-a1" transform="translate(86 -16)">
        <circle cx="66" cy="84" r="6.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      </g>
      <g class="st-det-a2" transform="translate(86 16)">
        <circle cx="72" cy="90" r="6.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      </g>
    </svg>`,

  // Force Lab XR: tabletop force-zone chamber, target hoop gate and ball curving upward through the gate
  "force-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Lab rig base on y=148 -->
      <rect x="18" y="136" width="224" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Left ball launcher muzzle -->
      <rect x="26" y="110" width="28" height="26" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.5"/>
      <rect x="54" y="116" width="10" height="14" fill="var(--ink)"/>
      <!-- Force zone box (translucent crimson/accent with upward arrows) -->
      <rect x="92" y="58" width="54" height="78" fill="var(--force)" fill-opacity="0.22" stroke="var(--force)" stroke-width="2.5"/>
      <g class="st-fxr-arr" fill="none" stroke="var(--force)" stroke-width="2.8" stroke-linecap="square">
        <path d="M108,108 V82 M102,89 L108,82 L114,89"/>
        <path d="M130,96 V70 M124,77 L130,70 L136,77"/>
      </g>
      <!-- Dashed physically accurate trajectory: straight -> parabolic curve -> straight -->
      <path d="M64,122 H92 Q122,122 146,84 L212,26" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-dasharray="5 4" opacity="0.65"/>
      <!-- Target hoop gate on a tall stand -->
      <line x1="194" y1="68" x2="194" y2="136" stroke="var(--ink)" stroke-width="2.8"/>
      <ellipse cx="194" cy="44" rx="9" ry="22" transform="rotate(28 194 44)" fill="none" stroke="var(--ink)" stroke-width="5.5"/>
      <ellipse cx="194" cy="44" rx="9" ry="22" transform="rotate(28 194 44)" fill="none" stroke="var(--st-tile2)" stroke-width="2.5"/>
      <!-- Launched yellow ball -->
      <circle class="st-fxr-ball" cx="122" cy="108" r="8" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.6"/>
    </svg>`,

  // ── 04 · GEOMETRY & ANALYSIS ──────────────────────────────────────────────

  // Quadrature: tilted drafting light-table with gridded blob filling red/amber squares + counter gauge
  "quadrature": () => {
    const inside = [
      [1, 2], [2, 1], [2, 2], [2, 3], [3, 2],
    ];
    const border = [
      [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 3], [1, 4],
      [2, 0], [2, 4], [3, 0], [3, 1], [3, 3], [3, 4], [4, 1], [4, 2], [4, 3],
    ];
    let idx = 0;
    const cells = [
      ...inside.map(([c, r]) => {
        const d = (idx++ * 0.11).toFixed(2);
        return `<rect class="st-quad-c" style="animation-delay:${d}s" x="${60 + c * 18}" y="${30 + r * 18}" width="18" height="18" fill="var(--st-accent)"/>`;
      }),
      ...border.map(([c, r]) => {
        const d = (idx++ * 0.11).toFixed(2);
        return `<rect class="st-quad-c" style="animation-delay:${d}s" x="${60 + c * 18}" y="${30 + r * 18}" width="18" height="18" fill="var(--st-brand)"/>`;
      }),
    ].join("");
    return `<svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Drafting light-table angled feet on y=148 -->
      <rect x="44" y="138" width="18" height="10" fill="var(--ink)"/>
      <rect x="198" y="138" width="18" height="10" fill="var(--ink)"/>
      <!-- Light-table chassis -->
      <rect x="34" y="18" width="192" height="122" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="3"/>
      <!-- Gridded paper canvas -->
      <rect x="60" y="30" width="90" height="90" fill="var(--st-surface)"/>
      ${cells}
      <!-- Grid lines -->
      <path d="M78,30 V120 M96,30 V120 M114,30 V120 M132,30 V120 M60,48 H150 M60,66 H150 M60,84 H150 M60,102 H150" stroke="var(--ink)" stroke-width="1.2" opacity="0.38"/>
      <ellipse cx="105" cy="75" rx="37" ry="31" fill="none" stroke="var(--ink)" stroke-width="3.2"/>
      <rect x="60" y="30" width="90" height="90" fill="none" stroke="var(--ink)" stroke-width="2.4"/>
      <!-- Side mechanical counter gauge -->
      <rect x="164" y="30" width="48" height="90" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <rect x="172" y="42" width="32" height="14" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
      <rect x="172" y="64" width="32" height="14" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Animated progress fill bar -->
      <rect x="172" y="92" width="32" height="16" fill="none" stroke="var(--ink)" stroke-width="2"/>
      <rect class="st-quad-bar" x="174" y="94" width="28" height="12" fill="var(--ink)"/>
    </svg>`;
  },

  // Metric Lab: tabletop easel holding a city-block street map tracing taxicab vs Euclidean distance
  "metric-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Easel legs standing on y=148 -->
      <line x1="80" y1="120" x2="66" y2="148" stroke="var(--ink)" stroke-width="4"/>
      <line x1="180" y1="120" x2="194" y2="148" stroke="var(--ink)" stroke-width="4"/>
      <line x1="130" y1="22" x2="130" y2="142" stroke="var(--ink)" stroke-width="3"/>
      <!-- Framed coral map board -->
      <rect x="62" y="18" width="136" height="114" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="3"/>
      <rect x="74" y="28" width="112" height="94" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- City-block grid -->
      <path d="M92,28 V122 M110,28 V122 M128,28 V122 M146,28 V122 M164,28 V122 M74,46 H186 M74,64 H186 M74,82 H186 M74,100 H186" stroke="var(--ink)" stroke-width="1.2" opacity="0.28"/>
      <!-- Taxicab stair-step path (blue accent) -->
      <path class="st-met-taxi" d="M92,100 H110 V82 H128 V64 H146 V46 H164" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--st-accent)" stroke-width="4.2"/>
      <!-- Euclidean straight chord -->
      <path class="st-met-line" d="M92,100 L164,46" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0" fill="none" stroke="var(--ink)" stroke-width="3"/>
      <!-- Mint endpoints A & B -->
      <rect x="86" y="94" width="12" height="12" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      <rect x="158" y="40" width="12" height="12" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Easel ledge -->
      <rect x="54" y="128" width="152" height="8" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.4"/>
    </svg>`,

  // Attractor Lab: upright IFS fractal plotter frame assembling a Sierpinski triangle point-by-point
  "attractor-lab": () => {
    // 27 level-3 Sierpinski sub-triangles inside a triangle of side 88 centered at x=130, bottom y=114
    const pts = [];
    const sub = (x, y, s, depth) => {
      if (depth === 0) {
        pts.push([x, y, s]);
        return;
      }
      const h = (s / 2) * 0.866;
      sub(x, y, s / 2, depth - 1);
      sub(x + s / 2, y, s / 2, depth - 1);
      sub(x + s / 4, y - h, s / 2, depth - 1);
    };
    sub(86, 112, 88, 3);
    // Deterministic chaos-game order so triangles pop in all across the attractor
    const tris = pts
      .map(([x, y, s], i) => {
        const order = (i * 11) % pts.length;
        const delay = (order * 0.13).toFixed(2);
        const h = (s * 0.866).toFixed(1);
        return `<path class="st-att-t" style="animation-delay:${delay}s" d="M${x.toFixed(1)},${y.toFixed(1)} h${s.toFixed(1)} l-${(s / 2).toFixed(1)},-${h} z" fill="var(--st-accent)"/>`;
      })
      .join("");
    return `<svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Plotter console base on y=148 -->
      <rect x="50" y="132" width="160" height="16" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <circle cx="72" cy="140" r="4" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="1.8"/>
      <circle cx="88" cy="140" r="4" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="1.8"/>
      <rect class="st-att-led" x="184" y="137" width="14" height="6" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.5"/>
      <!-- Framed fractal display screen -->
      <rect x="64" y="18" width="132" height="114" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="74" y="26" width="112" height="98" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Outer Sierpinski triangle + popping sub-triangles -->
      <path d="M86,112 h88 l-44,-76.2 z" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="miter"/>
      ${tris}
      <path d="M86,112 h88 l-44,-76.2 z" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="miter"/>
    </svg>`;
  },

  // Series Lab: complex-plane Argand oscilloscope drawing converging partial-sum polygonal spiral
  "series-lab": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Instrument feet on y=148 -->
      <rect x="44" y="140" width="18" height="8" fill="var(--ink)"/>
      <rect x="198" y="140" width="18" height="8" fill="var(--ink)"/>
      <!-- Violet oscilloscope chassis -->
      <rect x="34" y="22" width="192" height="120" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="3"/>
      <!-- Argand plane screen -->
      <rect x="46" y="34" width="124" height="96" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.4"/>
      <!-- Re & Im axes -->
      <line x1="54" y1="82" x2="162" y2="82" stroke="var(--ink)" stroke-width="1.4" opacity="0.35"/>
      <line x1="108" y1="42" x2="108" y2="122" stroke="var(--ink)" stroke-width="1.4" opacity="0.35"/>
      <!-- Converging polygonal path of partial sums S_N -->
      <polyline class="st-ser-path" pathLength="100"
        points="58,114 134,114 146,66 116,52 104,70 114,80 122,76 120,71 117,71 117,73 118,74"
        fill="none" stroke="var(--ink)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- Limit square -->
      <rect class="st-ser-lim" x="112" y="67" width="12" height="12" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.4"/>
      <!-- Right control panel dials -->
      <rect x="180" y="34" width="34" height="96" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <circle cx="197" cy="56" r="10" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      <line x1="197" y1="56" x2="203" y2="49" stroke="var(--ink)" stroke-width="2"/>
      <circle cx="197" cy="86" r="10" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
      <line x1="197" y1="86" x2="191" y2="82" stroke="var(--ink)" stroke-width="2"/>
      <rect x="187" y="108" width="20" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="1.8"/>
    </svg>`,

  // ── 05 · SURFACES & SIGNALS XR ────────────────────────────────────────────

  // Surface Lab XR: double-cone geometric sculpture on a turntable pedestal with sliding conic-section slicer
  "surface-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Turntable pedestal resting on y=148 -->
      <rect x="64" y="132" width="132" height="16" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="82" y="124" width="96" height="8" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Overhead specimen lamp arm on left -->
      <path d="M52,148 V36 Q52,22 70,22 H92" fill="none" stroke="var(--ink)" stroke-width="3"/>
      <rect x="44" y="142" width="16" height="6" fill="var(--ink)"/>
      <polygon points="84,16 102,16 108,28 78,28" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Double cone sculpture -->
      <path d="M100,32 L168,32 L134,78 Z M100,124 L168,124 L134,78 Z" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.8" stroke-linejoin="miter"/>
      <ellipse cx="134" cy="32" rx="34" ry="7" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.4"/>
      <!-- Animated slicing plane & dynamically scaling conic section -->
      <g class="st-sur-slice">
        <polygon points="84,112 104,98 184,98 164,112" fill="var(--st-tile2)" fill-opacity="0.45" stroke="var(--st-accent)" stroke-width="2"/>
        <g class="st-sur-sec">
          <ellipse cx="134" cy="105" rx="22" ry="6" fill="var(--st-tile2)" stroke="var(--st-accent)" stroke-width="3"/>
        </g>
      </g>
      <ellipse cx="134" cy="124" rx="34" ry="7" fill="none" stroke="var(--ink)" stroke-width="2.4"/>
    </svg>`,

  // Fourier Lab XR: mechanical frequency-winding analyzer drum with spinning polar curve & center-of-mass beacon
  "fourier-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Analyzer stand base on y=148 -->
      <rect x="52" y="136" width="156" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Main circular analyzer housing -->
      <rect x="64" y="20" width="132" height="116" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Side winding crank handle -->
      <rect x="196" y="70" width="16" height="10" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <rect x="210" y="54" width="10" height="42" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Polar winding glass face -->
      <circle cx="130" cy="76" r="48" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.6"/>
      <path d="M86,76 H174 M130,32 V120" stroke="var(--ink)" stroke-width="1.5" opacity="0.35"/>
      <!-- Rotating wound signal cardioid + orange center-of-mass dot -->
      <g class="st-fou-wind">
        <path d="M168,76 C168,97 148,106 130,98 C122,94 119,84 119,76 C119,68 122,58 130,54 C148,46 168,55 168,76 Z"
          fill="none" stroke="var(--pos)" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="141" cy="76" r="7.5" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2.5"/>
      </g>
      <!-- Tiny frequency readout box on left -->
      <rect x="30" y="102" width="34" height="34" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.2"/>
      <path d="M35,119 q5,-10 10,0 t10,0 t4,-4" fill="none" stroke="var(--st-accent)" stroke-width="2.2"/>
    </svg>`,

  // Parameter Lab XR: vertical k-axis extrusion frame with stacked ellipses & rising highlighted slice plane
  "parameter-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Weighted rose-pink base on y=148 -->
      <rect x="46" y="136" width="168" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Vertical k-axis guide rail on left -->
      <rect x="64" y="20" width="8" height="116" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.4"/>
      <path d="M72,34 h6 M72,58 h6 M72,82 h6 M72,106 h6 M72,126 h6" stroke="var(--ink)" stroke-width="1.8"/>
      <!-- Back projection chamber -->
      <rect x="86" y="20" width="114" height="116" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="94" y="28" width="98" height="100" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Extruded surface wireframe ribs -->
      <line x1="127" y1="108" x2="108" y2="48" stroke="var(--pos)" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.6"/>
      <line x1="159" y1="108" x2="178" y2="48" stroke="var(--pos)" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.6"/>
      <ellipse cx="143" cy="108" rx="16" ry="6" fill="none" stroke="var(--pos)" stroke-width="2.8"/>
      <ellipse cx="143" cy="82" rx="26" ry="9" fill="none" stroke="var(--pos)" stroke-width="2.8"/>
      <!-- Rising highlighted solution slice plane -->
      <g class="st-par-slice">
        <ellipse cx="143" cy="52" rx="35" ry="12" fill="var(--st-accent)" fill-opacity="0.28" stroke="var(--st-accent)" stroke-width="3.5"/>
      </g>
      <!-- Synchronized sliding yellow k-knob on rail -->
      <g class="st-par-knob">
        <rect x="56" y="45" width="24" height="14" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5"/>
        <line x1="80" y1="52" x2="94" y2="52" stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 2"/>
      </g>
    </svg>`,

  // ── 06 · FUNCTIONS IN SPACE XR ────────────────────────────────────────────

  // Composition Lab XR: 3-plane orthogonal stage (xy, yz, xz) with sliding x bead lifting output dot
  "composition-lab-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Stage base on y=148 -->
      <rect x="40" y="136" width="180" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Upright xz display plane -->
      <rect x="54" y="20" width="152" height="106" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.8"/>
      <!-- Orthogonal axes -->
      <path d="M68,108 H192 M130,118 V32" fill="none" stroke="var(--ink)" stroke-width="2.2"/>
      <!-- Dashed f(x) curve on xy projection -->
      <path d="M74,90 L124,106" fill="none" stroke="var(--ek)" stroke-width="3.2" stroke-dasharray="2 6" stroke-linecap="round"/>
      <!-- Bold g∘f(x) composed curve -->
      <path d="M74,102 C100,102 114,72 130,66 S162,46 186,38" fill="none" stroke="var(--mom)" stroke-width="4" stroke-linecap="round"/>
      <!-- Sliding yellow x input bead -->
      <g class="st-cmp-x">
        <circle cx="130" cy="108" r="8.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.5"/>
      </g>
      <!-- Linked green g(f(x)) output dot rising -->
      <g class="st-cmp-y">
        <circle cx="130" cy="64" r="7" fill="var(--vel)" stroke="var(--ink)" stroke-width="2.4"/>
      </g>
      <!-- Base mounting brackets -->
      <rect x="64" y="126" width="14" height="10" fill="var(--ink)"/>
      <rect x="182" y="126" width="14" height="10" fill="var(--ink)"/>
    </svg>`,

  // Dynagraph XR: double parallel-axis laboratory jig with synchronized sliding beads & mapping threads
  "dynagraph-xr": () => `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <!-- Lime twin-upright frame base on y=148 -->
      <rect x="30" y="136" width="200" height="12" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.8"/>
      <rect x="40" y="28" width="14" height="108" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.6"/>
      <rect x="206" y="28" width="14" height="108" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="2.6"/>
      <!-- Translucent backplate -->
      <rect x="54" y="34" width="152" height="94" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
      <!-- Mapping threads between parallel axes -->
      <path d="M84,56 L104,106 M128,56 L152,106 M172,56 L186,106" fill="none" stroke="var(--st-accent)" stroke-width="2.4" stroke-dasharray="2 6" stroke-linecap="round"/>
      <!-- Upper parallel rail (input x) -->
      <line x1="54" y1="56" x2="206" y2="56" stroke="var(--ink)" stroke-width="3.5"/>
      <!-- Lower parallel rail (output f(x)) -->
      <line x1="54" y1="106" x2="206" y2="106" stroke="var(--ink)" stroke-width="3.5"/>
      <!-- Sliding input bead -->
      <g class="st-dyn-in">
        <circle cx="130" cy="56" r="9.5" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.6"/>
      </g>
      <!-- Sliding mapped output bead -->
      <g class="st-dyn-out">
        <circle cx="148" cy="106" r="8" fill="var(--ek)" stroke="var(--ink)" stroke-width="2.5"/>
      </g>
    </svg>`,
};

/**
 * Fallback apparatus for any future lab added to apps.json before a custom drawing exists:
 * renders an animated tabletop bench console using the lab's brand palette & initials.
 */
function renderFallbackStation(app) {
  const mono = String(app.name || "L")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return `
    <svg class="app-svg" viewBox="0 0 260 156" aria-hidden="true">
      <rect x="50" y="140" width="18" height="8" fill="var(--ink)"/>
      <rect x="192" y="140" width="18" height="8" fill="var(--ink)"/>
      <rect x="40" y="28" width="180" height="114" fill="var(--st-brand)" stroke="var(--ink)" stroke-width="3"/>
      <rect x="54" y="42" width="106" height="72" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2.4"/>
      <path class="st-fb-wave" d="M62,78 q12,-24 24,0 t24,0 t24,0 t18,-8" fill="none" stroke="var(--st-accent)" stroke-width="3"/>
      <text x="107" y="106" text-anchor="middle" font-family="Space Mono, monospace" font-weight="700" font-size="13" fill="var(--ink)">${mono}</text>
      <circle cx="188" cy="58" r="10" fill="var(--st-tile2)" stroke="var(--ink)" stroke-width="2.2"/>
      <line class="st-fb-needle" x1="188" y1="58" x2="188" y2="50" stroke="var(--ink)" stroke-width="2.2"/>
      <rect class="st-fb-led" x="178" y="84" width="20" height="10" fill="var(--st-accent)" stroke="var(--ink)" stroke-width="2"/>
      <rect x="178" y="102" width="20" height="12" fill="var(--st-surface)" stroke="var(--ink)" stroke-width="2"/>
    </svg>`;
}

export function renderStationSVG(app) {
  const fn = STATIONS[app.slug];
  return fn ? fn(app) : renderFallbackStation(app);
}
