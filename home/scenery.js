// Labs · home/scenery.js
// 2D cutaway game-scene interior art: rooftop cornice, per-floor room walls (windows with day clouds
// and night stars, pendant lamps with light cones, chalkboard, bookshelves, pegboards, observatory
// porthole, vertical ladder), continuous workbench under-cabinets, stools, tabletop props and a lab cat.
// All scenery is muted and non-interactive so clickable apparatuses always stand out unambiguously.

/**
 * Rooftop cutaway cornice with skylight, gently spinning anemometer, and vent stack.
 */
export function renderRoofScenery() {
  return `<div class="building-roof" aria-hidden="true">
    <svg viewBox="0 0 1280 54" preserveAspectRatio="xMidYMax meet">
      <!-- Industrial skylight dome -->
      <polygon points="480,46 514,14 766,14 800,46" fill="var(--win-sky)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <path d="M514,14 L526,46 M578,14 V46 M640,14 V46 M702,14 V46 M766,14 L754,46" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      <line x1="496" y1="30" x2="784" y2="30" stroke="var(--sc-stroke)" stroke-width="1.4" opacity="0.6"/>
      <!-- Left ventilation chimney -->
      <rect x="130" y="18" width="26" height="28" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <polygon points="122,18 143,8 164,18" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <path class="sc-puff" d="M143,6 q-5,-4 1,-8 M149,4 q4,-4 -1,-7" fill="none" stroke="var(--sc-soft)" stroke-width="1.6"/>
      <!-- Right rooftop weathervane / anemometer -->
      <line x1="1120" y1="46" x2="1120" y2="12" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <line x1="1102" y1="20" x2="1138" y2="20" stroke="var(--sc-stroke)" stroke-width="2"/>
      <circle cx="1102" cy="20" r="3.5" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      <circle cx="1138" cy="20" r="3.5" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      <polygon points="1114,32 1126,32 1120,25" fill="var(--sc-stroke)"/>
      <!-- Heavy roof cornice beam -->
      <rect x="0" y="44" width="1280" height="10" fill="var(--wall-slab)" stroke="var(--ink)" stroke-width="2.5"/>
    </svg>
  </div>`;
}

/**
 * Reusable arched/gridded laboratory window showing drifting daytime clouds (light mode)
 * or twinkling stars + crescent moon (dark mode).
 */
function labWindow(x, y, w = 136, h = 112) {
  return `<g transform="translate(${x}, ${y})">
    <rect x="0" y="0" width="${w}" height="${h}" fill="var(--win-sky)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
    <!-- Daytime clouds (visible in light mode) -->
    <g class="win-day">
      <g class="sc-cloud">
        <rect x="14" y="24" width="38" height="10" fill="var(--win-cloud)"/>
        <rect x="22" y="18" width="22" height="8" fill="var(--win-cloud)"/>
      </g>
      <g class="sc-cloud-slow">
        <rect x="74" y="54" width="42" height="10" fill="var(--win-cloud)"/>
        <rect x="84" y="47" width="20" height="9" fill="var(--win-cloud)"/>
      </g>
    </g>
    <!-- Night sky stars & moon (visible in dark mode) -->
    <g class="win-night">
      <path d="M98,22 A11,11 0 1 0 112,35 A8,8 0 1 1 98,22 Z" fill="var(--win-moon)"/>
      <path class="sc-twinkle" d="M26,28 h6 M29,25 v6 M56,18 h4 M58,16 v4 M74,64 h6 M77,61 v6 M34,78 h4 M36,76 v4" stroke="var(--win-star)" stroke-width="1.6"/>
    </g>
    <!-- Subtle diagonal window glass gleam -->
    <polygon points="6,6 32,6 6,42" fill="var(--win-gleam)"/>
    <!-- Window muntins / frame bars -->
    <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="var(--sc-stroke)" stroke-width="2"/>
    <line x1="0" y1="${h * 0.48}" x2="${w}" y2="${h * 0.48}" stroke="var(--sc-stroke)" stroke-width="2"/>
    <!-- Windowsill -->
    <rect x="-6" y="${h}" width="${w + 12}" height="7" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
  </g>`;
}

/**
 * Overhead pendant workshop lamp with geometric light cone descending toward the bench.
 */
function pendantLamp(cx) {
  return `<g>
    <polygon points="${cx - 22},34 ${cx + 22},34 ${cx + 96},230 ${cx - 96},230" fill="var(--lamp-cone)"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="20" stroke="var(--sc-stroke)" stroke-width="2"/>
    <path d="M${cx - 24},34 L${cx - 12},20 H${cx + 12} L${cx + 24},34 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="2"/>
    <rect x="${cx - 10}" y="34" width="20" height="4" fill="var(--lamp-bulb)"/>
  </g>`;
}

/**
 * Wooden vertical access ladder on the side of the room linking floors like a 2D platformer lab.
 */
function sideLadder(x) {
  const rungs = [];
  for (let y = 18; y <= 218; y += 24) {
    rungs.push(`<line x1="${x + 2}" y1="${y}" x2="${x + 32}" y2="${y}" stroke="var(--sc-stroke)" stroke-width="2.4"/>`);
  }
  return `<g opacity="0.72">
    <line x1="${x}" y1="0" x2="${x}" y2="234" stroke="var(--sc-stroke)" stroke-width="3"/>
    <line x1="${x + 34}" y1="0" x2="${x + 34}" y2="234" stroke="var(--sc-stroke)" stroke-width="3"/>
    ${rungs.join("")}
  </g>`;
}

/**
 * Full-bleed 2D room back-wall interior SVG behind the workbench & apparatuses.
 * ViewBox 1280 × 234 aligns flush to the top of the workbench surface.
 */
export function renderFloorBackdrop(theme, index) {
  const ladderX = index % 2 === 0 ? 1222 : 24;

  const themes = {
    mechanics: `
      ${labWindow(84, 48, 134, 114)}
      <!-- Classroom chalkboard -->
      <g transform="translate(360, 44)">
        <rect x="0" y="0" width="380" height="110" fill="var(--sc-board)" stroke="var(--sc-stroke)" stroke-width="2.4"/>
        <rect x="6" y="6" width="368" height="98" fill="none" stroke="var(--sc-chalk)" stroke-width="1" opacity="0.22"/>
        <g fill="var(--sc-chalk)" font-family="Space Mono, monospace" font-size="11.5" opacity="0.62">
          <text x="18" y="30">F = m · a</text>
          <text x="18" y="56">Δp = ∫ F(t) dt</text>
          <text x="18" y="82">T = 2π √(L / g)</text>
          <text x="224" y="30">p₁ + p₂ = const</text>
        </g>
        <g fill="none" stroke="var(--sc-chalk)" stroke-width="1.5" opacity="0.48">
          <path d="M210,84 H348 M222,90 V44"/>
          <path d="M222,84 Q256,42 290,84 T342,60"/>
          <circle cx="290" cy="64" r="7" stroke-dasharray="3 2"/>
        </g>
        <rect x="-8" y="110" width="396" height="8" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <rect x="34" y="104" width="28" height="6" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      </g>
      <!-- Wall shelf with calibration weights & flasks -->
      <g transform="translate(860, 62)">
        <rect x="0" y="54" width="184" height="7" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <path d="M18,61 v16 l14,-16 M166,61 v16 l-14,-16" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <rect x="14" y="34" width="16" height="20" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <rect x="34" y="40" width="12" height="14" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M84,20 h10 v12 l12,22 h-34 l12,-22 z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M77,44 h24 l5,10 h-34 z" fill="var(--sc-soft)"/>
        <rect x="124" y="16" width="14" height="38" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <rect x="142" y="22" width="14" height="32" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      </g>
      ${pendantLamp(290)}
      ${pendantLamp(640)}
      ${pendantLamp(990)}
    `,

    motion: `
      <!-- Wide laboratory pegboard with hanging instruments -->
      <g transform="translate(110, 48)">
        <rect x="0" y="0" width="230" height="114" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <path d="M18,18 h2 M42,18 h2 M66,18 h2 M90,18 h2 M114,18 h2 M138,18 h2 M162,18 h2 M186,18 h2 M210,18 h2 M18,44 h2 M42,44 h2 M66,44 h2 M90,44 h2 M114,44 h2 M138,44 h2 M162,44 h2 M186,44 h2 M210,44 h2 M18,70 h2 M42,70 h2 M66,70 h2 M90,70 h2 M114,70 h2 M138,70 h2 M162,70 h2 M186,70 h2 M210,70 h2 M18,96 h2 M42,96 h2 M66,96 h2 M90,96 h2 M114,96 h2 M138,96 h2 M162,96 h2 M186,96 h2 M210,96 h2" stroke="var(--sc-soft)" stroke-width="2.5"/>
        <!-- Hanging meter stick -->
        <rect x="22" y="22" width="16" height="78" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M22,34 h6 M22,46 h8 M22,58 h6 M22,70 h8 M22,82 h6" stroke="var(--sc-stroke)" stroke-width="1.2"/>
        <!-- Hanging set square -->
        <polygon points="62,94 114,94 62,32" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <polygon points="72,84 96,84 72,54" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.2"/>
        <!-- Hanging stopwatch -->
        <circle cx="152" cy="56" r="18" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <line x1="152" y1="56" x2="160" y2="46" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <!-- Clipboard -->
        <rect x="184" y="34" width="32" height="48" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M190,48 h20 M190,56 h16 M190,64 h20" stroke="var(--sc-soft)" stroke-width="1.4"/>
      </g>
      ${labWindow(500, 46, 150, 116)}
      <!-- Ticking analog wall clock -->
      <g transform="translate(744, 92)">
        <circle cx="0" cy="0" r="32" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <path d="M0,-25 v5 M25,0 h-5 M0,25 v-5 M-25,0 h5" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <line x1="0" y1="0" x2="0" y2="-15" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <line x1="0" y1="0" x2="12" y2="-4" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <line class="wall-clock-sec" x1="0" y1="5" x2="0" y2="-22" stroke="var(--sc-stroke)" stroke-width="1.2"/>
        <circle cx="0" cy="0" r="2.5" fill="var(--sc-stroke)"/>
      </g>
      <!-- Pinned kinematics chart poster -->
      <g transform="translate(864, 52)">
        <rect x="0" y="0" width="166" height="106" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <path d="M16,86 H148 M24,92 V18" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M24,86 Q76,84 136,24" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8" stroke-dasharray="4 3"/>
        <path d="M24,86 L136,36" fill="none" stroke="var(--sc-soft)" stroke-width="2"/>
        <circle cx="10" cy="10" r="3" fill="var(--sc-stroke)"/>
        <circle cx="156" cy="10" r="3" fill="var(--sc-stroke)"/>
      </g>
      ${pendantLamp(340)}
      ${pendantLamp(960)}
    `,

    modern: `
      <!-- Observatory circular porthole window -->
      <g transform="translate(178, 100)">
        <circle cx="0" cy="0" r="56" fill="var(--win-sky)" stroke="var(--sc-stroke)" stroke-width="3.5"/>
        <g class="win-day">
          <rect x="-34" y="-16" width="44" height="10" fill="var(--win-cloud)"/>
          <rect x="4" y="14" width="34" height="9" fill="var(--win-cloud)"/>
        </g>
        <g class="win-night">
          <circle cx="-12" cy="-14" r="10" fill="none" stroke="var(--win-moon)" stroke-width="2"/>
          <ellipse cx="-12" cy="-14" rx="20" ry="6" transform="rotate(-18 -12 -14)" fill="none" stroke="var(--win-moon)" stroke-width="1.6"/>
          <path class="sc-twinkle" d="M18,-22 h6 M21,-25 v6 M14,18 h4 M16,16 v4 M-26,18 h6 M-23,15 v6" stroke="var(--win-star)" stroke-width="1.6"/>
        </g>
        <circle cx="0" cy="0" r="46" fill="none" stroke="var(--sc-stroke)" stroke-width="1.4" stroke-dasharray="6 6"/>
      </g>
      <!-- Overhead conduit pipes & laser junction box -->
      <path d="M280,26 H1180 M280,34 H920" stroke="var(--sc-stroke)" stroke-width="2" fill="none"/>
      <rect x="580" y="18" width="54" height="24" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <!-- Star chart & optics diagram pinboard -->
      <g transform="translate(460, 56)">
        <rect x="0" y="0" width="210" height="104" fill="var(--sc-board)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <ellipse cx="105" cy="52" rx="72" ry="30" fill="none" stroke="var(--sc-chalk)" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.5"/>
        <circle cx="76" cy="52" r="10" fill="none" stroke="var(--sc-chalk)" stroke-width="1.6" opacity="0.6"/>
        <circle cx="152" cy="36" r="4" fill="var(--sc-chalk)" opacity="0.6"/>
        <path d="M18,22 h4 M20,20 v4 M186,78 h4 M188,76 v4 M174,24 h4 M176,22 v4" stroke="var(--sc-chalk)" stroke-width="1.4" opacity="0.5"/>
      </g>
      <!-- Optical shelf with prism & coiled cable -->
      <g transform="translate(830, 66)">
        <rect x="0" y="54" width="220" height="7" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <polygon points="24,54 44,20 64,54" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <line x1="6" y1="40" x2="34" y2="38" stroke="var(--sc-soft)" stroke-width="1.8" stroke-dasharray="3 2"/>
        <line x1="54" y1="38" x2="86" y2="44" stroke="var(--sc-soft)" stroke-width="1.8" stroke-dasharray="3 2"/>
        <circle cx="132" cy="34" r="16" fill="none" stroke="var(--sc-stroke)" stroke-width="2"/>
        <circle cx="132" cy="34" r="10" fill="none" stroke="var(--sc-soft)" stroke-width="1.6"/>
        <rect x="172" y="20" width="26" height="34" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
      </g>
      ${pendantLamp(340)}
      ${pendantLamp(760)}
      ${pendantLamp(1080)}
    `,

    geometry: `
      <!-- Tall math library bookcase on left -->
      <g transform="translate(106, 36)">
        <rect x="0" y="0" width="160" height="196" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <rect x="8" y="10" width="144" height="44" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="8" y="64" width="144" height="44" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <rect x="8" y="118" width="144" height="44" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <!-- Books rows -->
        <g fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.3">
          <rect x="14" y="20" width="12" height="34"/><rect x="28" y="16" width="14" height="38"/><rect x="44" y="24" width="11" height="30"/><rect x="57" y="18" width="15" height="36"/><rect x="96" y="22" width="12" height="32"/><rect x="110" y="16" width="14" height="38"/>
          <rect x="16" y="72" width="14" height="36"/><rect x="32" y="78" width="12" height="30"/><rect x="46" y="70" width="16" height="38"/><rect x="88" y="76" width="14" height="32"/><rect x="104" y="72" width="12" height="36"/><rect x="118" y="80" width="18" height="28"/>
        </g>
      </g>
      ${labWindow(420, 44, 140, 114)}
      <!-- Potted fern on windowsill -->
      <g transform="translate(524, 132)">
        <polygon points="4,26 24,26 20,12 8,12" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M14,12 q-10,-12 -4,-20 M14,12 q10,-12 4,-20 M14,12 v-18" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      </g>
      <!-- Framed geometric proof & Euler board -->
      <g transform="translate(720, 48)">
        <rect x="0" y="0" width="240" height="106" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <circle cx="58" cy="54" r="32" fill="none" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <polygon points="58,22 86,70 30,70" fill="none" stroke="var(--sc-stroke)" stroke-width="1.5"/>
        <g fill="var(--sc-stroke)" font-family="Space Mono, monospace" font-size="11.5" opacity="0.72">
          <text x="112" y="42">e^(iπ) + 1 = 0</text>
          <text x="112" y="68">Σ 1/n² = π²/6</text>
        </g>
      </g>
      ${pendantLamp(340)}
      ${pendantLamp(650)}
      ${pendantLamp(1040)}
    `,

    "xr-surfaces": `
      <!-- High-tech XR tracking bar & studio acoustic wall panels -->
      <g transform="translate(100, 46)">
        <rect x="0" y="0" width="84" height="110" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M14,0 V110 M28,0 V110 M42,0 V110 M56,0 V110 M70,0 V110" stroke="var(--sc-soft)" stroke-width="1.4"/>
      </g>
      ${labWindow(280, 44, 146, 112)}
      <!-- Blueprint wireframe poster -->
      <g transform="translate(540, 48)">
        <rect x="0" y="0" width="210" height="108" fill="var(--sc-board)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <path d="M24,22 H186 M24,86 H186 M42,22 L168,86 M168,22 L42,86" stroke="var(--sc-chalk)" stroke-width="1.1" opacity="0.28"/>
        <ellipse cx="105" cy="54" rx="54" ry="20" fill="none" stroke="var(--sc-chalk)" stroke-width="1.6" opacity="0.58"/>
        <ellipse cx="105" cy="54" rx="20" ry="38" fill="none" stroke="var(--sc-chalk)" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.5"/>
      </g>
      <!-- XR equipment locker on right -->
      <g transform="translate(910, 42)">
        <rect x="0" y="0" width="110" height="190" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <line x1="55" y1="0" x2="55" y2="190" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <path d="M14,20 h26 M14,28 h26 M14,36 h26 M70,20 h26 M70,28 h26 M70,36 h26" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <rect x="40" y="92" width="6" height="18" fill="var(--sc-stroke)"/>
        <rect x="64" y="92" width="6" height="18" fill="var(--sc-stroke)"/>
      </g>
      ${pendantLamp(480)}
      ${pendantLamp(840)}
    `,

    "xr-functions": `
      ${labWindow(130, 44, 148, 114)}
      <!-- Framed coordinate planes poster -->
      <g transform="translate(420, 48)">
        <rect x="0" y="0" width="220" height="106" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2.2"/>
        <path d="M24,34 H196 M24,74 H196" stroke="var(--sc-stroke)" stroke-width="1.8"/>
        <path d="M46,34 L72,74 M90,34 L126,74 M134,34 L168,74 M174,34 L154,74" stroke="var(--sc-soft)" stroke-width="1.6" stroke-dasharray="3 3"/>
        <text x="24" y="24" fill="var(--sc-stroke)" font-family="Space Mono, monospace" font-size="11" opacity="0.7">g ∘ f : X → Z</text>
      </g>
      <!-- Studio shelf with binders & potted plant -->
      <g transform="translate(770, 64)">
        <rect x="0" y="54" width="210" height="7" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="2"/>
        <rect x="16" y="18" width="14" height="36" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <rect x="34" y="22" width="14" height="32" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <rect x="52" y="16" width="14" height="38" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <!-- Tiny wireframe dodecahedron / cube -->
        <rect x="96" y="24" width="28" height="28" fill="none" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <rect x="106" y="16" width="28" height="28" fill="none" stroke="var(--sc-soft)" stroke-width="1.4"/>
        <!-- Potted succulent -->
        <polygon points="164,54 188,54 184,38 168,38" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
        <path d="M176,38 c-10,-8 -12,-18 -2,-20 c4,4 2,12 2,20 c10,-8 12,-18 2,-20" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      </g>
      ${pendantLamp(360)}
      ${pendantLamp(860)}
    `,

    arrivals: `
      ${labWindow(140, 46, 136, 110)}
      <g transform="translate(460, 56)">
        <rect x="0" y="0" width="240" height="96" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="120" y="54" text-anchor="middle" fill="var(--sc-stroke)" font-family="Space Mono, monospace" font-size="13" opacity="0.7">NEW BENCH</text>
      </g>
      ${pendantLamp(640)}
    `,
  };

  return `<div class="floor-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1280 234" preserveAspectRatio="xMidYMax slice">
      <!-- Subtle wainscoting / dado rail along back wall -->
      <rect x="0" y="168" width="1280" height="66" fill="var(--wall-wainscot)"/>
      <line x1="0" y1="168" x2="1280" y2="168" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <!-- Room-specific architectural scenery -->
      ${themes[theme] || themes.arrivals}
      <!-- Vertical ladder connecting floor to floor -->
      ${sideLadder(ladderX)}
    </svg>
  </div>`;
}

/**
 * Muted non-clickable tabletop prop sitting directly on the workbench in spare slots
 * (2- or 3-station floors) so every bench looks authentically lived-in.
 */
export function renderTableProp(variant = 0) {
  const props = [
    // Steaming lab coffee mug + stacked notebooks + Erlenmeyer flask + graduated cylinder
    `<svg class="prop-svg" viewBox="0 0 220 156" aria-hidden="true">
      <rect x="18" y="132" width="66" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="24" y="118" width="58" height="14" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="40" y="96" width="22" height="22" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path d="M62,101 h6 v11 h-6" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path class="sc-steam" d="M47,91 q-3,-6 2,-11 M55,91 q-3,-6 2,-11" fill="none" stroke="var(--sc-soft)" stroke-width="1.5"/>
      <path d="M122,82 h12 v18 l18,48 h-48 l18,-48 z" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <path d="M112,126 h32 l8,22 h-48 z" fill="var(--sc-soft)"/>
      <line x1="119" y1="82" x2="137" y2="82" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <rect x="172" y="76" width="16" height="72" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="167" y="144" width="26" height="4" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
    </svg>`,

    // Articulated bench lamp + wooden weight box + leaning clipboard
    `<svg class="prop-svg" viewBox="0 0 220 156" aria-hidden="true">
      <rect x="24" y="140" width="38" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <polyline points="43,140 28,96 66,66" fill="none" stroke="var(--sc-stroke)" stroke-width="2.2"/>
      <circle cx="28" cy="96" r="4" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M60,58 L80,70 L68,82 L54,72 Z" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="96" y="122" width="54" height="26" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="104" y="106" width="12" height="16" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="120" y="110" width="10" height="12" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="134" y="114" width="8" height="8" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <rect x="164" y="96" width="36" height="52" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <rect x="174" y="92" width="16" height="7" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M170,110 h24 M170,118 h20 M170,126 h24 M170,134 h16" stroke="var(--sc-soft)" stroke-width="1.4"/>
    </svg>`,
  ];
  return `<div class="bench-prop" aria-hidden="true">${props[variant % props.length]}</div>`;
}

/**
 * Under-bench cutaway furniture: drawers, cabinet doors, lab stools, power strips, crates,
 * floor tiles, and a cozy sleeping lab cat curled up on the top floor!
 */
export function renderFloorUnderbench(index, isLastFloor = false) {
  const stoolLeft = `<g transform="translate(310, 12)">
    <rect x="0" y="6" width="58" height="9" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
    <line x1="10" y1="15" x2="4" y2="62" stroke="var(--sc-stroke)" stroke-width="2.2"/>
    <line x1="48" y1="15" x2="54" y2="62" stroke="var(--sc-stroke)" stroke-width="2.2"/>
    <line x1="29" y1="15" x2="29" y2="62" stroke="var(--sc-soft)" stroke-width="1.8"/>
    <line x1="7" y1="42" x2="51" y2="42" stroke="var(--sc-stroke)" stroke-width="1.6"/>
  </g>`;

  const stoolRight = `<g transform="translate(880, 12)">
    <rect x="0" y="6" width="58" height="9" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
    <line x1="10" y1="15" x2="4" y2="62" stroke="var(--sc-stroke)" stroke-width="2.2"/>
    <line x1="48" y1="15" x2="54" y2="62" stroke="var(--sc-stroke)" stroke-width="2.2"/>
    <line x1="29" y1="15" x2="29" y2="62" stroke="var(--sc-soft)" stroke-width="1.8"/>
    <line x1="7" y1="42" x2="51" y2="42" stroke="var(--sc-stroke)" stroke-width="1.6"/>
  </g>`;

  const crateWithCat = `<g transform="translate(590, 26)">
    <!-- Wooden equipment crate -->
    <rect x="0" y="16" width="94" height="32" fill="var(--wall-trim)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
    <line x1="0" y1="32" x2="94" y2="32" stroke="var(--sc-soft)" stroke-width="1.4"/>
    <!-- Sleeping lab cat curled on top of crate (gentle breathing animation) -->
    <g class="sc-cat">
      <ellipse cx="46" cy="12" rx="18" ry="9" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <circle cx="32" cy="11" r="7" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.8"/>
      <polygon points="27,6 29,0 33,5" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <polygon points="34,5 38,0 39,6" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.5"/>
      <path d="M62,14 c10,0 14,-6 8,-9" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
    </g>
  </g>`;

  const powerStrip = `<g transform="translate(560, 50)">
    <rect x="0" y="12" width="70" height="12" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.6"/>
    <rect x="10" y="16" width="7" height="4" fill="var(--sc-stroke)"/>
    <rect x="24" y="16" width="7" height="4" fill="var(--sc-stroke)"/>
    <rect x="38" y="16" width="7" height="4" fill="var(--sc-stroke)"/>
    <rect x="52" y="16" width="7" height="4" fill="var(--sc-stroke)"/>
    <path d="M70,18 c24,0 30,-10 56,-10 s28,12 52,12" fill="none" stroke="var(--sc-stroke)" stroke-width="1.8"/>
  </g>`;

  return `<div class="floor-underbench" aria-hidden="true">
    <svg viewBox="0 0 1280 80" preserveAspectRatio="none">
      <!-- Recessed dark under-bench cavity -->
      <rect x="28" y="0" width="1224" height="74" fill="var(--under-cavity)"/>
      <!-- Left drawer bank cabinet -->
      <rect x="44" y="0" width="166" height="74" fill="var(--table-apron)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <rect x="54" y="8" width="146" height="18" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.4"/>
      <rect x="114" y="15" width="26" height="4" fill="var(--sc-stroke)"/>
      <rect x="54" y="32" width="146" height="34" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.4"/>
      <rect x="114" y="46" width="26" height="4" fill="var(--sc-stroke)"/>

      <!-- Right cabinet doors -->
      <rect x="1070" y="0" width="166" height="74" fill="var(--table-apron)" stroke="var(--sc-stroke)" stroke-width="2"/>
      <rect x="1080" y="8" width="70" height="58" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.4"/>
      <rect x="1156" y="8" width="70" height="58" fill="var(--sc-fill)" stroke="var(--sc-stroke)" stroke-width="1.4"/>
      <rect x="1138" y="30" width="5" height="14" fill="var(--sc-stroke)"/>
      <rect x="1163" y="30" width="5" height="14" fill="var(--sc-stroke)"/>

      <!-- Center under-bench stretcher bar -->
      <rect x="210" y="28" width="860" height="7" fill="var(--sc-fill-2)" stroke="var(--sc-stroke)" stroke-width="1.4"/>

      <!-- Alternating floor props (stools, power strip, sleeping lab cat) -->
      ${index % 2 === 0 ? stoolLeft : stoolRight}
      ${isLastFloor ? crateWithCat : powerStrip}

      <!-- Heavy concrete floor slab dividing this floor from the next -->
      <rect x="0" y="72" width="1280" height="8" fill="var(--wall-slab)" stroke="var(--ink)" stroke-width="2.2"/>
    </svg>
  </div>`;
}
