// Icone disegnate a mano (24×24, tratto 2). Classi: .fill = pieno, .soft = pieno tenue, .thin = tratto sottile.
const P = {
  rec: '<circle cx="12" cy="12" r="9"/><circle class="fill" cx="12" cy="12" r="4.6"/>',
  stop: '<rect class="fill" x="6.5" y="6.5" width="11" height="11"/>',
  launch: '<path d="M3 5v14"/><path d="M7 12h12"/><path d="M14 7l5 5-5 5"/>',
  home: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/><circle class="fill" cx="12" cy="12" r="1.8"/>',
  flip: '<path d="M3 8h10"/><path d="M9 4l-4 4 4 4"/><path d="M21 16H11"/><path d="M15 12l4 4-4 4"/>',
  swap: '<rect x="3" y="9" width="7" height="6"/><rect x="14" y="9" width="7" height="6"/><path d="M6 6.5h12M15 4l3 2.5L15 9"/><path d="M18 17.5H6M9 15l-3 2.5L9 20"/>',
  spring: '<path d="M2 12h3l2-6 4 12 4-12 2 6h5"/>',
  velcro: '<path d="M5 5v14M9 5v14M13 5v14M17 5v14"/><path class="thin" d="M3 8h18M3 12h18M3 16h18"/>',
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h4M14 8h4"/>',
  fire: '<path d="M12 2l2.2 7.3L21.5 12l-7.3 2.7L12 22l-2.2-7.3L2.5 12l7.3-2.7z"/>',
  autoscale: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6"/>',
  graph: '<path d="M3.5 3.5v17h17"/><path d="M6.5 16l4-6 3.5 3.5 5-7"/>',
  probe: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  select: '<path d="M8 5H5v14h3M16 5h3v14h-3"/><path d="M9 12h6M11.5 9.5L9 12l2.5 2.5M12.5 9.5L15 12l-2.5 2.5"/>',
  pan: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  fitlin: '<circle class="fill" cx="5" cy="17" r="1.6"/><circle class="fill" cx="10" cy="12.5" r="1.6"/><circle class="fill" cx="14" cy="13.5" r="1.6"/><circle class="fill" cx="19" cy="7" r="1.6"/><path d="M3 19L21 5"/>',
  fitquad: '<circle class="fill" cx="5" cy="7" r="1.6"/><circle class="fill" cx="12" cy="18" r="1.6"/><circle class="fill" cx="19" cy="7" r="1.6"/><path d="M3 4c5 20 13 20 18 0"/>',
  fitconst: '<circle class="fill" cx="5" cy="11" r="1.6"/><circle class="fill" cx="10" cy="13.5" r="1.6"/><circle class="fill" cx="15" cy="10.5" r="1.6"/><circle class="fill" cx="20" cy="12.5" r="1.6"/><path d="M2 12h20"/>',
  crop: '<path d="M7 2v15h15"/><path d="M2 7h15v15"/>',
  uncrop: '<path d="M7 2v15h15"/><path d="M2 7h15v15"/><path d="M3 21L21 3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" class="thin"/><path d="M3 21L21 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  points: '<circle class="fill" cx="5" cy="15" r="2"/><circle class="fill" cx="12" cy="8" r="2"/><circle class="fill" cx="19" cy="14" r="2"/>',
  joined: '<path d="M5 15L12 8l7 6"/><circle class="fill" cx="5" cy="15" r="2"/><circle class="fill" cx="12" cy="8" r="2"/><circle class="fill" cx="19" cy="14" r="2"/>',
  truth: '<path d="M2 18C8 2 14 24 22 6" stroke-dasharray="3 3"/>',
  tilt: '<path d="M2 8L22 18"/><path d="M2 8v13h20v-3"/><path class="thin" d="M15.2 15a6 6 0 0 1 .8 2.8"/>',
  friction: '<path d="M2 16h20"/><path d="M5 20l2.5-4M10 20l2.5-4M15 20l2.5-4"/><path d="M7 8h10M14 5l3 3-3 3"/>',
  sensor: '<rect x="2.5" y="7.5" width="6" height="9"/><path d="M12 8c3 1.3 3 6.7 0 8M15.5 5c5 2.3 5 11.7 0 14"/>',
  cart: '<rect x="3" y="7" width="18" height="8"/><circle cx="8" cy="18.5" r="2"/><circle cx="16" cy="18.5" r="2"/>',
  ruler: '<rect x="2" y="9" width="20" height="6"/><path d="M6 9v3M10 9v2M14 9v3M18 9v2"/>',
  mass: '<path d="M7 21h10l-1.8-10H8.8z"/><circle cx="12" cy="7" r="2.6"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path class="fill" d="M12 3.5a8.5 8.5 0 0 0 0 17z"/>',
  lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.2 3.5 14.8 0 18M12 3c-3.5 3.2-3.5 14.8 0 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a3 3 0 1 1 4.4 2.6c-1 .6-1.6 1.1-1.6 2.3"/><circle class="fill" cx="12" cy="17.2" r="1.1"/>',
  delta: '<path d="M12 4L3.5 19.5h17z"/>',
  clock: '<circle cx="12" cy="13.5" r="8"/><path d="M12 9v4.5l3 2M9.5 2.5h5"/>',
  wave: '<path d="M2 12c2-9 4-9 6 0s4 9 6 0 4-8 8-3"/>',
  invert: '<path d="M7 20V4M7 4L4 7.5M7 4l3 3.5"/><path d="M17 4v16M17 20l-3-3.5M17 20l3-3.5"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  align: '<path d="M4 3v18"/><path d="M4 7h12M4 12h16M4 17h9"/>',
  vec: '<path d="M3 15h15"/><path d="M13 10l5 5-5 5" transform="translate(0 -3)"/>',
  clip: '<rect x="8" y="3" width="8" height="4"/><path d="M8 5H5v16h14V5h-3"/><path d="M9 12h6M9 16h6"/>',
  run: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h6l-1.5 8L19 10h-6z"/>',
  scale: '<rect x="3" y="14" width="18" height="6"/><path d="M6 14l1.6-6h8.8L18 14M12 8V5.5"/><circle cx="12" cy="4.5" r="1.2"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17"/><circle class="fill" cx="8.5" cy="8.5" r="1.3"/><circle class="fill" cx="15.5" cy="15.5" r="1.3"/><circle class="fill" cx="12" cy="12" r="1.3"/>',
  live: '<path d="M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0"/><circle class="fill" cx="12" cy="12" r="1.6"/>',
};

export function ic(name, extra = '') {
  return `<svg class="ic ${extra}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
export function mountIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach((el) => {
    if (!el.dataset.icDone) { el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic)); el.dataset.icDone = '1'; }
  });
}
