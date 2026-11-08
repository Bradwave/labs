// Units Lab · climb.js
// The mountain with its stations, base camps and the climber (SVG). The climber moves with a CSS
// transition; with prefers-reduced-motion it simply jumps.

import { TOP, CAMP } from "./state.js";

const W = 300;
const H = 120;

/** Station k → [x, y] on the path, a gentle zig-zag up the ridge. */
function station(k) {
  const x = 22 + (k * (W - 62)) / TOP;
  const ridge = 104 - 74 * Math.pow(k / TOP, 0.9);
  const y = ridge + (k % 2 ? 3 : -3) * (k > 0 && k < TOP ? 1 : 0);
  return [x, y];
}

function path() {
  return Array.from({ length: TOP + 1 }, (_, k) => station(k))
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

const FIGURE = `<g class="climber-fig"><circle cx="0" cy="-13" r="3.6" class="hd"/><rect x="-3.5" y="-9" width="7" height="9" class="bd"/><rect x="-7" y="-8" width="4" height="7" class="pk"/><path d="M3.5 -7 L8 -13" class="st"/><path d="M-2 0 L-3 5 M2 0 L3 5" class="lg"/></g>`;

function mountainSvg(alt, summits) {
  const ridge = `M0 ${H} L0 100 ` + Array.from({ length: TOP + 1 }, (_, k) => station(k)).map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1) - 8}`).join(" ") + ` L${W} 40 L${W} ${H} Z`;
  const flags = Array.from({ length: TOP / CAMP + 1 }, (_, i) => i * CAMP)
    .map((k) => {
      const [x, y] = station(k);
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line x1="0" y1="0" x2="0" y2="-16" class="pole"/><path d="M0 -16 L9 -13 L0 -10 Z" class="${k === TOP ? "flag top" : "flag"}"/></g>`;
    })
    .join("");
  const dots = Array.from({ length: TOP + 1 }, (_, k) => {
    const [x, y] = station(k);
    return k % CAMP ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" class="stn"/>` : "";
  }).join("");
  const [cx, cy] = station(alt);
  return `<svg class="mount" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}/${TOP}"><path d="${ridge}" class="rock"/><path d="${path()}" class="trail"/>${dots}${flags}<g class="climber" style="transform:translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)">${FIGURE}</g>${summits ? `<text x="${W - 8}" y="14" text-anchor="end" class="sm">▲ ${summits}</text>` : ""}</svg>`;
}

/** Moves the existing climber to a station (CSS transition does the animation). */
function moveClimber(root, alt) {
  const g = root.querySelector(".climber");
  if (!g) return;
  const [x, y] = station(alt);
  g.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  g.classList.add("walking");
  setTimeout(() => g.classList.remove("walking"), 650);
}

export { mountainSvg, moveClimber, station };
