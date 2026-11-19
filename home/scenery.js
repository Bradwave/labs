// Labs · home/scenery.js
// Non-clickable architectural and laboratory scenery: overhead lamps, chalkboard, wall shelves,
// tabletop props and under-bench stools/crates. Drawn strictly in muted tones so clickable
// apparatuses always stand out unambiguously.

/**
 * Overhead lab ceiling lamps, wall chalkboard with chalk formulas, analog wall clock and shelf.
 * Rendered as a crisp architectural header strip at the top of the lab room.
 */
export function renderRoomCeilingScenery() {
  return `<div class="room-wall-decor" aria-hidden="true">
    <svg class="room-wall-svg" viewBox="0 0 1200 132" preserveAspectRatio="xMidYMax slice">
      <!-- Subtle ceiling conduit & pipe -->
      <line x1="0" y1="8" x2="1200" y2="8" stroke="var(--sc-stroke)" stroke-width="2"/>
      <line x1="0" y1="14" x2="1200" y2="14" stroke="var(--sc-soft)" stroke-width="1"/>

      <!-- Left hanging workshop lamp + subtle geometric light cone -->
      <polygon points="158,40 202,40 246,132 114,132" fill="var(--sc-lamp-cone)"/>
      <line x1="180" y1="8" x2="180" y2="26" stroke="var(--sc-stroke)" stroke-width="2"/>
      <path d="M156,40 L168,26 H192 L204,40 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2" stroke-linejoin="miter"/>
      <rect x="171" y="40" width="18" height="4" fill="var(--sc-bulb)"/>

      <!-- Center hanging workshop lamp -->
      <polygon points="578,40 622,40 676,132 524,132" fill="var(--sc-lamp-cone)"/>
      <line x1="600" y1="8" x2="600" y2="26" stroke="var(--sc-stroke)" stroke-width="2"/>
      <path d="M576,40 L588,26 H612 L624,40 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2" stroke-linejoin="miter"/>
      <rect x="591" y="40" width="18" height="4" fill="var(--sc-bulb)"/>

      <!-- Right hanging workshop lamp -->
      <polygon points="998,40 1042,40 1086,132 954,132" fill="var(--sc-lamp-cone)"/>
      <line x1="1020" y1="8" x2="1020" y2="26" stroke="var(--sc-stroke)" stroke-width="2"/>
      <path d="M996,40 L1008,26 H1032 L1044,40 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2" stroke-linejoin="miter"/>
      <rect x="1011" y="40" width="18" height="4" fill="var(--sc-bulb)"/>

      <!-- Left wall shelf with flasks & notebooks -->
      <g transform="translate(26, 56)">
        <rect x="0" y="48" width="112" height="6" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <path d="M14,54 v14 l12,-14 M98,54 v14 l-12,-14" fill="none" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <!-- Stacked books -->
        <rect x="8" y="37" width="34" height="11" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="11" y="27" width="30" height="10" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <line x1="16" y1="32" x2="36" y2="32" stroke="var(--sc-soft)" stroke-width="1"/>
        <!-- Erlenmeyer flask -->
        <path d="M64,16 h8 v10 l11,22 h-30 l11,-22 z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5" stroke-linejoin="miter"/>
        <path d="M58,39 h20 l4,9 h-28 z" fill="var(--sc-soft)"/>
        <line x1="62" y1="16" x2="74" y2="16" stroke="var(--sc-stroke)" stroke-width="2"/>
        <!-- Graduated cylinder -->
        <rect x="92" y="18" width="10" height="30" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <path d="M92,26 h4 M92,32 h5 M92,38 h4 M92,43 h5" stroke="var(--sc-stroke)" stroke-width="1"/>
      </g>

      <!-- Center classroom chalkboard with chalk sketches -->
      <g transform="translate(300, 32)">
        <rect x="0" y="0" width="440" height="84" fill="var(--sc-board)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <rect x="5" y="5" width="430" height="74" fill="none" stroke="var(--sc-chalk)" stroke-width="1" stroke-opacity="0.25"/>
        <!-- Chalk formulas & diagrams -->
        <g fill="var(--sc-chalk)" font-family="Space Mono, monospace" font-size="11" opacity="0.65">
          <text x="18" y="26">F = m·a</text>
          <text x="18" y="48">Δp = ∫ F(t) dt</text>
          <text x="18" y="68">T = 2π√(L/g)</text>
          <text x="290" y="26">e^(iπ) + 1 = 0</text>
          <text x="290" y="68">x(t) = x₀ + v₀t + ½at²</text>
        </g>
        <!-- Small chalk wave & parabola sketches -->
        <g fill="none" stroke="var(--sc-chalk)" stroke-width="1.4" opacity="0.5">
          <path d="M150,58 H255 M160,64 V18"/>
          <path d="M160,58 Q182,16 204,58 T248,58" stroke-dasharray="3 2"/>
          <path d="M160,58 Q204,20 248,58"/>
          <path d="M292,44 c8,-12 16,-12 24,0 s16,12 24,0 s16,-12 24,0 s16,12 24,0"/>
        </g>
        <!-- Chalk tray + eraser + chalk sticks -->
        <rect x="-6" y="84" width="452" height="6" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="36" y="78" width="26" height="6" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="80" y="81" width="14" height="3" fill="var(--sc-chalk)" opacity="0.8"/>
        <rect x="98" y="81" width="10" height="3" fill="var(--sc-chalk)" opacity="0.6"/>
      </g>

      <!-- Analog lab wall clock -->
      <g transform="translate(804, 68)">
        <circle cx="0" cy="0" r="28" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <circle cx="0" cy="0" r="23" fill="none" stroke="var(--sc-soft)" stroke-width="1"/>
        <path d="M0,-21 v4 M21,0 h-4 M0,21 v-4 M-21,0 h4" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <line x1="0" y1="0" x2="0" y2="-13" stroke="var(--sc-stroke)" stroke-width="2"/>
        <line x1="0" y1="0" x2="11" y2="-4" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <line class="wall-clock-sec" x1="0" y1="4" x2="0" y2="-19" stroke="var(--sc-stroke)" stroke-width="1" stroke-dasharray="2 1"/>
        <circle cx="0" cy="0" r="2.2" fill="var(--sc-stroke)"/>
      </g>

      <!-- Right pegboard with T-square, set square & pinned note -->
      <g transform="translate(876, 44)">
        <rect x="0" y="0" width="96" height="66" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <!-- Peg holes -->
        <path d="M12,12 h1 M26,12 h1 M40,12 h1 M54,12 h1 M68,12 h1 M82,12 h1 M12,26 h1 M26,26 h1 M40,26 h1 M54,26 h1 M68,26 h1 M82,26 h1 M12,40 h1 M26,40 h1 M40,40 h1 M54,40 h1 M68,40 h1 M82,40 h1 M12,54 h1 M26,54 h1 M40,54 h1 M54,54 h1 M68,54 h1 M82,54 h1" stroke="var(--sc-soft)" stroke-width="2" stroke-linecap="square"/>
        <!-- Set square hanging -->
        <polygon points="14,54 44,54 14,18" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <polygon points="20,48 33,48 20,32" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1"/>
        <!-- Hanging caliper / ruler -->
        <rect x="54" y="12" width="10" height="44" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <path d="M54,20 h4 M54,28 h4 M54,36 h4 M54,44 h4" stroke="var(--sc-stroke)" stroke-width="1"/>
        <!-- Small safety goggles icon -->
        <rect x="70" y="20" width="20" height="10" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <line x1="80" y1="20" x2="80" y2="30" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      </g>

      <!-- Far right shelf with beaker & binder -->
      <g transform="translate(1078, 56)">
        <rect x="0" y="48" width="96" height="6" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <path d="M12,54 v14 l12,-14 M84,54 v14 l-12,-14" fill="none" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="10" y="16" width="12" height="32" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="24" y="20" width="12" height="28" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="38" y="14" width="11" height="34" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <!-- Beaker -->
        <path d="M62,24 h22 v24 h-22 z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="63" y="35" width="20" height="12" fill="var(--sc-soft)"/>
        <path d="M60,24 h26" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      </g>
    </svg>
  </div>`;
}

/**
 * Small muted wall ornament strip rendered on the right side of a bench's header rail.
 * Gives each table zone distinct laboratory wall clutter without competing with stations.
 */
export function renderBenchWallDecor(kind) {
  const svgs = {
    mechanics: `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Slotted mass weights -->
      <rect x="18" y="20" width="12" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="34" y="24" width="10" height="12" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="48" y="27" width="8" height="9" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Hanging coiled spring -->
      <polyline points="82,6 82,12 77,15 87,19 77,23 87,27 82,30 82,34" fill="none" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Small wrench & plumb-bob -->
      <path d="M116,12 v20 M112,12 h8 M112,32 h8" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M148,8 v14 l-6,10 h12 l-6,-10" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
    </svg>`,

    motion: `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Meter ruler -->
      <rect x="14" y="26" width="66" height="10" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M24,26 v4 M34,26 v6 M44,26 v4 M54,26 v6 M64,26 v4 M74,26 v6" stroke="var(--sc-stroke)" stroke-width="1"/>
      <!-- Stopwatch -->
      <circle cx="108" cy="24" r="11" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="105" y="9" width="6" height="4" fill="var(--sc-stroke)"/>
      <line x1="108" y1="24" x2="113" y2="18" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Protractor -->
      <path d="M134,36 A16,16 0 0 1 166,36 Z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M142,36 A8,8 0 0 1 158,36" fill="none" stroke="var(--sc-soft)" stroke-width="1"/>
    </svg>`,

    modern: `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Optical prism -->
      <polygon points="20,36 34,12 48,36" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="8" y1="26" x2="26" y2="24" stroke="var(--sc-soft)" stroke-width="1.5" stroke-dasharray="3 2"/>
      <line x1="42" y1="24" x2="62" y2="29" stroke="var(--sc-soft)" stroke-width="1.5" stroke-dasharray="3 2"/>
      <!-- Vacuum bottle / flask -->
      <path d="M84,14 h8 v8 l8,14 h-24 l8,-14 z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Coiled BNC cable -->
      <circle cx="136" cy="22" r="11" fill="none" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <circle cx="136" cy="22" r="7" fill="none" stroke="var(--sc-soft)" stroke-width="1.5"/>
      <rect x="156" y="18" width="12" height="18" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
    </svg>`,

    geometry: `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Compass -->
      <path d="M28,10 L18,36 M28,10 L38,36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <circle cx="28" cy="10" r="3" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Set square -->
      <polygon points="56,36 86,36 56,12" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Stacked graph notebooks -->
      <rect x="104" y="26" width="44" height="10" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="108" y="17" width="38" height="9" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Pencil cup -->
      <rect x="156" y="20" width="12" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="159" y1="20" x2="157" y2="10" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="165" y1="20" x2="167" y2="11" stroke="var(--sc-stroke)" stroke-width="1.5"/>
    </svg>`,

    "xr-surfaces": `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Tracking sensor bar -->
      <rect x="16" y="20" width="42" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="37" y1="28" x2="37" y2="36" stroke="var(--sc-stroke)" stroke-width="2"/>
      <circle cx="24" cy="24" r="2" fill="var(--sc-stroke)"/>
      <circle cx="50" cy="24" r="2" fill="var(--sc-stroke)"/>
      <!-- Wireframe octahedron model -->
      <polygon points="94,8 108,22 94,36 80,22" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="80" y1="22" x2="108" y2="22" stroke="var(--sc-soft)" stroke-width="1"/>
      <line x1="94" y1="8" x2="94" y2="36" stroke="var(--sc-soft)" stroke-width="1"/>
      <!-- Headset case -->
      <rect x="128" y="18" width="38" height="18" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="128" y1="27" x2="166" y2="27" stroke="var(--sc-stroke)" stroke-width="1"/>
    </svg>`,

    "xr-functions": `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Vertical binders -->
      <rect x="18" y="12" width="11" height="24" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="31" y="15" width="11" height="21" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="44" y="10" width="11" height="26" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Mini pinned axis card -->
      <rect x="74" y="8" width="44" height="24" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M82,26 H112 M88,28 V12" stroke="var(--sc-stroke)" stroke-width="1"/>
      <path d="M84,24 Q98,12 110,16" fill="none" stroke="var(--sc-soft)" stroke-width="1.5"/>
      <!-- Stylus tray -->
      <rect x="134" y="28" width="34" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="138" y1="24" x2="164" y2="24" stroke="var(--sc-stroke)" stroke-width="2"/>
    </svg>`,

    arrivals: `<svg viewBox="0 0 180 42" aria-hidden="true">
      <line x1="6" y1="36" x2="174" y2="36" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="24" y="14" width="34" height="22" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <line x1="24" y1="14" x2="58" y2="36" stroke="var(--sc-soft)" stroke-width="1"/>
      <rect x="74" y="20" width="26" height="16" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
    </svg>`,
  };
  return `<div class="bench-wall-decor" aria-hidden="true">${svgs[kind] || svgs.arrivals}</div>`;
}

/**
 * Non-clickable tabletop clutter prop placed in spare bench slots (when a table has fewer than 4 apps)
 * so the table still looks richly populated, with unmistakable non-clickable muted styling.
 */
export function renderTableClutterProp(variant = 0) {
  const props = [
    // Variant 0: glassware cluster + stacked lab notebooks + coffee mug
    `<svg viewBox="0 0 220 156" aria-hidden="true">
      <!-- Lab notebook stack -->
      <rect x="18" y="132" width="66" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="24" y="118" width="58" height="14" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <line x1="30" y1="125" x2="74" y2="125" stroke="var(--sc-soft)" stroke-width="1.2"/>
      <!-- Coffee mug on top of books -->
      <rect x="40" y="96" width="22" height="22" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path d="M62,101 h6 v11 h-6" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path d="M47,91 q-2,-5 2,-9 M55,91 q-2,-5 2,-9" fill="none" stroke="var(--sc-soft)" stroke-width="1.4"/>
      <!-- Erlenmeyer flask -->
      <path d="M122,82 h12 v18 l18,48 h-48 l18,-48 z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path d="M112,126 h32 l8,22 h-48 z" fill="var(--sc-soft)"/>
      <line x1="119" y1="82" x2="137" y2="82" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <!-- Graduated cylinder -->
      <rect x="172" y="76" width="16" height="72" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="167" y="144" width="26" height="4" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M172,92 h6 M172,104 h8 M172,116 h6 M172,128 h8" stroke="var(--sc-stroke)" stroke-width="1.2"/>
    </svg>`,

    // Variant 1: calibration weight box + vernier caliper + bench lamp
    `<svg viewBox="0 0 220 156" aria-hidden="true">
      <!-- Articulated desk lamp (muted scenery) -->
      <rect x="26" y="140" width="38" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <polyline points="45,140 30,96 68,66" fill="none" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <circle cx="30" cy="96" r="4" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M62,58 L82,70 L70,82 L56,72 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <!-- Wooden weight box + brass weights -->
      <rect x="96" y="122" width="54" height="26" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="104" y="106" width="12" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="120" y="110" width="10" height="12" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="134" y="114" width="8" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Clipboard leaning -->
      <rect x="164" y="96" width="36" height="52" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="174" y="92" width="16" height="7" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M170,110 h24 M170,118 h20 M170,126 h24 M170,134 h16" stroke="var(--sc-soft)" stroke-width="1.4"/>
    </svg>`,
  ];
  return `<div class="bench-clutter" aria-hidden="true">
    <div class="clutter-bay">${props[variant % props.length]}</div>
    <div class="table-strip clutter-strip"></div>
    <div class="clutter-apron"></div>
  </div>`;
}

/**
 * Sturdy lab table legs, crossbar and floor scenery (stool, storage crate, coiled cord) under each bench.
 */
export function renderBenchUnderframe(index = 0) {
  const floorDecor =
    index % 2 === 0
      ? `<!-- Tucked-in laboratory stool -->
         <g transform="translate(150, 2)">
           <rect x="0" y="10" width="56" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
           <line x1="10" y1="18" x2="4" y2="54" stroke="var(--sc-stroke)" stroke-width="2"/>
           <line x1="46" y1="18" x2="52" y2="54" stroke="var(--sc-stroke)" stroke-width="2"/>
           <line x1="28" y1="18" x2="28" y2="54" stroke="var(--sc-soft)" stroke-width="1.6"/>
           <line x1="7" y1="38" x2="49" y2="38" stroke="var(--sc-stroke)" stroke-width="1.5"/>
         </g>
         <!-- Floor equipment crate -->
         <g transform="translate(920, 18)">
           <rect x="0" y="0" width="84" height="36" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
           <line x1="0" y1="12" x2="84" y2="12" stroke="var(--sc-soft)" stroke-width="1.2"/>
           <line x1="0" y1="24" x2="84" y2="24" stroke="var(--sc-soft)" stroke-width="1.2"/>
           <rect x="28" y="14" width="28" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.2"/>
         </g>`
      : `<!-- Power strip & coiled floor cord -->
         <g transform="translate(210, 32)">
           <rect x="0" y="12" width="64" height="10" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
           <rect x="8" y="15" width="6" height="4" fill="var(--sc-stroke)"/>
           <rect x="20" y="15" width="6" height="4" fill="var(--sc-stroke)"/>
           <rect x="32" y="15" width="6" height="4" fill="var(--sc-stroke)"/>
           <rect x="44" y="15" width="6" height="4" fill="var(--sc-stroke)"/>
           <path d="M64,17 c18,0 24,-10 42,-10 s24,12 44,12" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
         </g>
         <!-- Tucked-in laboratory stool on right -->
         <g transform="translate(960, 2)">
           <rect x="0" y="10" width="56" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
           <line x1="10" y1="18" x2="4" y2="54" stroke="var(--sc-stroke)" stroke-width="2"/>
           <line x1="46" y1="18" x2="52" y2="54" stroke="var(--sc-stroke)" stroke-width="2"/>
           <line x1="28" y1="18" x2="28" y2="54" stroke="var(--sc-soft)" stroke-width="1.6"/>
           <line x1="7" y1="38" x2="49" y2="38" stroke="var(--sc-stroke)" stroke-width="1.5"/>
         </g>`;

  return `<div class="bench-underframe" aria-hidden="true">
    <svg viewBox="0 0 1200 58" preserveAspectRatio="none">
      <!-- Crossbar -->
      <rect x="42" y="28" width="1116" height="6" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <!-- Left steel leg -->
      <rect x="26" y="0" width="18" height="54" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <rect x="22" y="50" width="26" height="6" fill="var(--sc-stroke)"/>
      <!-- Right steel leg -->
      <rect x="1156" y="0" width="18" height="54" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <rect x="1152" y="50" width="26" height="6" fill="var(--sc-stroke)"/>
      <!-- Floor decor -->
      ${floorDecor}
      <!-- Lab floor line -->
      <line x1="0" y1="56" x2="1200" y2="56" stroke="var(--sc-stroke)" stroke-width="2"/>
    </svg>
  </div>`;
}
