/* icons.js — piccola serie di icone a tratto (griglia 24×24), le stesse per la pagina (SVG inline) e per i pannelli VR (Path2D su canvas).
   Nessun font o file remoto: la Quest non è in rete. Nessun THREE, nessun DOM. */
(function (root) {
  'use strict';

  const ICONS = {
    cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
    plane: 'M3 16l5-9h13l-5 9z',
    move: 'M12 3v18 M3 12h18 M12 3l-3 3 M12 3l3 3 M12 21l-3-3 M12 21l3-3 M3 12l3-3 M3 12l3 3 M21 12l-3-3 M21 12l-3 3',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
    eyeoff: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z M3 3l18 18',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
    prev: 'M15 5l-7 7 7 7',
    next: 'M9 5l7 7-7 7',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    close: 'M5 5l14 14 M19 5L5 19',
    face: 'M12 4a4 4 0 100 8 4 4 0 000-8z M5 21c0-4 3-7 7-7s7 3 7 7',
    exit: 'M10 4H5v16h5 M14 8l5 4-5 4 M19 12H9',
    grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    home: 'M4 11l8-7 8 7 M6 10v10h12V10 M10 20v-6h4v6',
    reset: 'M20 12a8 8 0 11-2.5-5.8 M20 4v5h-5',
    resetall: 'M20 12a8 8 0 11-2.5-5.8 M20 4v5h-5 M12 9v6 M9 12h6',
    clip: 'M4 4h16v16H4z M12 4v16 M15 8l2 2 M15 12l2 2 M15 16l2 2',
    flip: 'M7 4L3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7',
    snap: 'M6 3v9a6 6 0 0012 0V3h-4v9a2 2 0 01-4 0V3z',
    help: 'M12 3a9 9 0 100 18 9 9 0 000-18z M9.5 9.5a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4 M12 17.5v.5',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    headset: 'M3 8h18v8a2 2 0 01-2 2h-4l-2-2h-2l-2 2H5a2 2 0 01-2-2z',
    room: 'M3 20V9l9-5 9 5v11 M3 20h18 M9 20v-6h6v6',
    tune: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4v6 M9 14v6',
    folder: 'M3 7h6l2 2h10v10H3z',
    save: 'M5 4h12l3 3v13H5z M8 4v5h8V4 M8 20v-6h8v6',
    undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 010 12h-4',
    history: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2',
    newfile: 'M6 3h9l4 4v14H6z M12 11v6 M9 14h6',
    book: 'M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z M5 17a3 3 0 013-3h10',
    copy: 'M8 8h12v12H8z M4 4h12v4 M4 4v12h4',
    lock: 'M6 11h12v9H6z M8 11V8a4 4 0 018 0v3',
    box: 'M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10',
    edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
    check: 'M5 12l5 5 9-10',
    qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v6h-4 M14 18h2v2',
    isolate: 'M12 7a5 5 0 100 10 5 5 0 000-10z M12 3v2 M12 19v2 M3 12h2 M19 12h2',
    probe: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M12 10a2 2 0 100 4 2 2 0 000-4z'
  };

  // stringa SVG (per la pagina): <svg viewBox="0 0 24 24" ...>; il colore viene da currentColor
  function svg(name, size) {
    const d = ICONS[name]; if (!d) return '';
    const sz = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  // disegna su un canvas 2D: centro (cx, cy), lato size (px)
  const cache = {};
  function draw(ctx, name, cx, cy, size, color, lineWidth) {
    const d = ICONS[name]; if (!d || typeof Path2D === 'undefined') return;
    const p = cache[name] || (cache[name] = new Path2D(d));
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth || 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(p);
    ctx.restore();
  }
  // nella pagina: sostituisce ogni <span data-ic="nome"> con l'icona
  function mount(doc) {
    [].slice.call((doc || document).querySelectorAll('[data-ic]')).forEach(function (el) {
      el.innerHTML = svg(el.getAttribute('data-ic'), +el.getAttribute('data-size') || 18); el.classList.add('ic');
    });
  }

  const api = { ICONS: ICONS, svg: svg, draw: draw, mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Icons = api;
})(typeof window !== 'undefined' ? window : globalThis);
