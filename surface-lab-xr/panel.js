/* panel.js — pannello flottante per la VR: pagine a schede con icone, cornice afferrabile, hit-test, "poke" col dito indice,
   raggio, riepilogo delle trasformazioni, disegno su canvas. Logica pura (nessun THREE, nessun DOM): le coordinate locali sono
   in metri del pannello non scalato, x a destra, y in alto, z uscente dal pannello verso l’utente. Testabile in Node. */
(function (root) {
  'use strict';

  const Icons = root.Icons || (typeof require !== 'undefined' ? require('./icons.js') : null);
  const W = 640, H = 776, MPP = 0.0005, FR = 28;   // canvas in pixel; metri per pixel → pannello 0,32 × 0,388 m; cornice di 28 px = 1,4 cm
  const ARM = 0.012, BACK = 0.03, HOVER = 0.05;     // distanze MONDIALI (m): dito "armato" oltre ARM davanti; premuto a z ≤ 0; ignorato oltre BACK dietro

  const fmt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace('-', '−');
  const B = (id, x, y, w, h, label, icon, on, extra) => Object.assign({ id: id, kind: 'btn', x: x, y: y, w: w, h: h, label: label, icon: icon, on: on }, extra || {});
  const L = (id, x, y, w, h, label) => ({ id: id, kind: 'label', x: x, y: y, w: w, h: h, label: label });

  // intestazione comune: titolo (mostra il suggerimento del pulsante sotto il dito), tre pulsanti a sola icona, schede
  const HEAD = [
    L('title', 40, 40, 340, 60, () => 'Surface Lab XR'),
    B('face', 392, 40, 60, 60, () => '', 'face', s => s.faceMe, { tip: 'Guardami: il pannello ti segue' }),
    B('exit', 464, 40, 60, 60, () => '', 'exit', null, { tip: 'Esci dalla sessione' }),
    B('hide', 536, 40, 60, 60, () => '', 'close', null, { tip: 'Chiudi il pannello (B/Y)' })
  ];
  const TAB_DEF = [['sup', 'Superfici', 'cube'], ['pia', 'Piano', 'plane'], ['ogg', 'Oggetto', 'move'], ['sce', 'Scene', 'folder'], ['vis', 'Vista', 'tune']];
  const TABS = TAB_DEF.map((t, i) => B('tab:' + t[0], 40 + i * 115, 112, 111, 72, () => t[1], t[2], s => s.tab === t[0] || (t[0] === 'ogg' && s.tab === 'log'), { stack: true }));
  const FOOT = L('foot', 40, 704, 572, 36, () => 'Afferra il bordo per spostare');
  const NOFOOT = { sce: 1, log: 1, ogg: 1, dom: 1, par: 1 };

  const stepper = (key, y, label) => [
    L(key + 'v', 40, y, 200, 64, label),
    B(key + '-', 252, y, 150, 64, () => '', 'minus'),
    B(key + '+', 414, y, 198, 64, () => '', 'plus')
  ];
  const tiles = [0, 1, 2, 3, 4, 5].map(i => B('sel:' + i, 40 + i * 96, 404, 88, 64, () => String(i + 1), null, s => s.selIndex === i, { swatch: i, off: s => i >= s.nSurf }));

  const PAGES = {
    sup: [
      L('surf', 40, 200, 572, 44, s => s.name + (s.vis ? '' : ' (nascosta)')),
      B('prev', 40, 252, 170, 64, () => '', 'prev', null, { tip: 'Superficie precedente' }),
      B('pickmenu', 222, 252, 196, 64, () => 'Galleria', 'grid'),
      B('next', 430, 252, 182, 64, () => '', 'next', null, { tip: 'Superficie successiva' }),
      B('vis', 40, 328, 186, 64, s => s.vis ? 'Nascondi' : 'Mostra', s => s.vis ? 'eye' : 'eyeoff'),
      B('add', 238, 328, 186, 64, () => 'Aggiungi', 'plus'),
      B('del', 436, 328, 176, 64, () => 'Elimina', 'trash')
    ].concat(tiles, [B('kopen', 40, 484, 572, 60, () => 'Scrivi l’equazione', 'edit')]),
    pia: [L('plabel', 40, 200, 572, 44, s => 'Piano  ' + s.plane)]
      .concat(stepper('th', 252, s => 'θ  ' + Math.round(s.theta) + '°'), stepper('ph', 324, s => 'φ  ' + Math.round(s.phi) + '°'), stepper('d', 396, s => 'd  ' + fmt(s.d)),
        [B('plane', 40, 480, 186, 64, () => 'Piano', 'plane', s => s.planeOn),
         B('clip', 238, 480, 186, 64, () => 'Taglio', 'clip', s => s.clipOn),
         B('flip', 436, 480, 176, 64, () => 'Inverti', 'flip'),
         B('snap', 40, 556, 572, 64, () => 'Aggancio ad assi e casi notevoli', 'snap', s => s.snapOn)]),
    ogg: [
      L('oname', 40, 200, 572, 44, s => s.name),
      L('tr', 40, 252, 572, 40, s => s.tr), L('rot', 40, 296, 572, 40, s => s.rot), L('sca', 40, 340, 572, 40, s => s.sca),
      B('det', 40, 392, 572, 56, s => s.details ? 'Meno dettagli' : 'Dettagli', s => s.details ? 'up' : 'down'),
      B('home', 40, 464, 282, 64, () => 'Pos. originale', 'home'),
      B('resetall', 330, 464, 282, 64, () => 'Ripristina tutto', 'resetall')
    ].concat([B('gdom', 40, 540, 186, 64, () => 'Dominio', 'box'), B('gpar', 238, 540, 186, 64, () => 'Parametri', 'tune', null, { off: s => !s.parRows || !s.parRows.length }),
              B('cron', 436, 540, 176, 64, () => 'Storia', 'history')]),
    dom: [L('dt', 40, 196, 572, 36, s => s.implicit ? 'Dominio: scatola della superficie' : 'Superficie parametrica: dominio = u, v'),
      L('dhl', 84, 232, 250, 30, () => 'minimo'), L('dhu', 344, 232, 250, 30, () => 'massimo')]
      .concat(['x', 'y', 'z'].reduce((acc, a, i) => {
        const y = 266 + i * 72, off = s => !s.implicit;
        return acc.concat([L('da' + a, 40, y, 40, 64, () => a),
          B('dl-' + a, 84, y, 70, 64, () => '', 'minus', null, { off: off }), L('dlv' + a, 158, y, 100, 64, s => s.domRows && s.domRows[i] ? fmt(s.domRows[i][0]) : '—'), B('dl+' + a, 262, y, 70, 64, () => '', 'plus', null, { off: off }),
          B('du-' + a, 344, y, 70, 64, () => '', 'minus', null, { off: off }), L('duv' + a, 418, y, 100, 64, s => s.domRows && s.domRows[i] ? fmt(s.domRows[i][1]) : '—'), B('du+' + a, 522, y, 70, 64, () => '', 'plus', null, { off: off })]);
      }, []),
      [B('dsym', 40, 494, 282, 60, () => 'Cubico', 'box', null, { off: s => !s.implicit }), B('dreset', 330, 494, 282, 60, () => 'Predefinito', 'reset', null, { off: s => !s.implicit }),
       B('dhandles', 40, 566, 572, 64, () => 'Maniglie sulle facce', 'move', s => s.domHandles, { off: s => !s.implicit })]),
    par: [L('pt', 40, 196, 572, 36, () => 'Parametri dell’equazione')]
      .concat([0, 1, 2, 3, 4, 5].reduce((acc, i) => acc.concat([
        L('pn' + i, 40, 244 + i * 72, 250, 64, s => s.parRows && s.parRows[i] ? s.parRows[i].n + '  ' + fmt(s.parRows[i].v) : ''),
        B('pm:' + i, 300, 244 + i * 72, 150, 64, () => '', 'minus', null, { off: s => !s.parRows || !s.parRows[i] }),
        B('pp:' + i, 462, 244 + i * 72, 150, 64, () => '', 'plus', null, { off: s => !s.parRows || !s.parRows[i] })]), []),
        [B('pdef', 40, 680, 572, 62, () => 'Valori predefiniti', 'reset')]),
    vis: [
      B('reset', 40, 200, 572, 64, () => 'Ripristina vista', 'reset'),
      B('resetall', 40, 276, 572, 64, () => 'Ripristina tutto', 'resetall'),
      L('h1', 40, 364, 572, 36, () => 'Impugnatura: afferra'),
      L('h2', 40, 400, 572, 36, () => 'Grilletto o pinza col raggio: premi'),
      L('h3', 40, 436, 572, 36, () => 'B / Y: chiudi o apri il pannello'),
      B('undo', 40, 496, 572, 64, s => s.canUndo ? 'Annulla: ' + s.undoLabel : 'Niente da annullare', 'undo', null, { off: s => !s.canUndo }),
      B('probe', 40, 572, 282, 60, () => 'Sonda', 'probe', s => s.probeMode),
      B('tgp', 330, 572, 282, 60, () => 'Piano tang.', 'plane', s => s.showTg),
      B('unpin', 40, 640, 572, 56, () => 'Togli il segnaposto', 'close', null, { off: s => !s.canUnpin })
    ],
    sce: [
      B('kmie', 40, 200, 170, 60, () => 'Mie', 'folder', s => s.sceKind === 'mie'),
      B('klez', 218, 200, 170, 60, () => 'Lezioni', 'book', s => s.sceKind === 'lez'),
      B('sdel', 396, 200, 216, 60, () => 'Elimina', 'trash', s => s.delMode, { off: s => s.sceKind !== 'mie' }),
      B('salva', 40, 272, 186, 60, () => 'Salva', 'save'),
      B('nuova', 238, 272, 186, 60, () => 'Nuova', 'newfile'),
      B('qr', 436, 272, 176, 60, () => 'QR', 'qr')
    ].concat([0, 1, 2, 3].map(i => B('se:' + i, 40 + (i % 2) * 290, 344 + Math.floor(i / 2) * 144, 282, 136, s => (s.sceEntries[i] && s.sceEntries[i].name) || '', null, null,
      { img: s => s.sceEntries[i] && s.sceEntries[i].canvas, off: s => !s.sceEntries[i] })),
      [B('spp', 40, 632, 120, 54, () => '', 'prev', null, { tip: 'Pagina precedente' }), L('spl', 172, 632, 268, 54, s => s.sceInfo || ''), B('spn', 492, 632, 120, 54, () => '', 'next', null, { tip: 'Pagina successiva' }),
       B('undo', 40, 692, 572, 54, s => s.canUndo ? 'Annulla: ' + s.undoLabel : 'Niente da annullare', 'undo', null, { off: s => !s.canUndo })]),
    log: [L('lt', 40, 196, 440, 36, () => 'Cronologia dei gesti')].concat([0, 1, 2, 3, 4].map(i => B('lg:' + i, 40, 238 + i * 58, 572, 54, s => (s.logRows[i] && s.logRows[i].text) || '', null, s => s.logSel === i && !!s.logRows[i], { off: s => !s.logRows[i] })),
      [L('ld1', 40, 534, 440, 34, s => s.logD1 || ''), L('ld2', 40, 568, 440, 34, s => s.logD2 || ''), L('ld3', 40, 602, 440, 34, s => s.logD3 || ''),
       B('lpp', 486, 540, 58, 54, () => '', 'up', null, { tip: 'Gesti più recenti' }), B('lpn', 554, 540, 58, 54, () => '', 'down', null, { tip: 'Gesti precedenti' }),
       B('lrev', 40, 648, 572, 64, () => 'Torna a prima di questo gesto', 'undo', null, { off: s => !s.logRows[s.logSel] })])
  };
  const LAYOUTS = {};
  Object.keys(PAGES).forEach(k => { LAYOUTS[k] = { W: W, H: H, MPP: MPP, frame: FR, items: HEAD.concat(TABS, PAGES[k], NOFOOT[k] ? [] : [FOOT]) }; });
  // pagine con intestazione propria (senza schede): tastiera e codice QR
  function headed(title, items) { return { W: W, H: H, MPP: MPP, frame: FR, items: [L('title', 40, 40, 230, 60, () => title), B('back', 280, 40, 100, 60, () => '', 'prev', null, { tip: 'Indietro' }), HEAD[1], HEAD[2], HEAD[3]].concat(items) }; }
  // Tastiera: 40 tasti-carattere (etichette dallo stato: kbKeys), cursore, cancella, applica
  const kx = (j, n, w) => 40 + Math.round(j * (572 - w) / (n - 1));
  const KEYS = []; [0, 1, 2].forEach(r => { for (let j = 0; j < 10; j++) KEYS.push(B('kc:' + (r * 10 + j), kx(j, 10, 54), 256 + r * 60, 54, 54, s => (s.kbKeys && s.kbKeys[r * 10 + j]) || '', null, null, { off: s => !(s.kbKeys && s.kbKeys[r * 10 + j]) })); });
  [3, 4].forEach(r => { for (let j = 0; j < 5; j++) { const ix = 30 + (r - 3) * 5 + j; KEYS.push(B('kc:' + ix, kx(j, 5, 110), 256 + r * 60, 110, 54, s => (s.kbKeys && s.kbKeys[ix]) || '', null, null, { off: s => !(s.kbKeys && s.kbKeys[ix]) })); } });
  const KBD = headed('Tastiera', [
    L('kt1', 40, 112, 400, 54, s => s.kbLabel || ''),
    B('kpt', 450, 112, 76, 54, () => '', 'prev', null, { tip: 'Campo precedente', off: s => !s.kbMulti }), B('knt', 536, 112, 76, 54, () => '', 'next', null, { tip: 'Campo successivo', off: s => !s.kbMulti }),
    L('ktx', 40, 170, 572, 44, s => s.kbShow || ''), L('kerr', 40, 214, 572, 34, s => s.kbMsg || '')
  ].concat(KEYS, [
    B('kl', 40, 556, 138, 54, () => '', 'prev', null, { tip: 'Cursore a sinistra' }), B('kr', 186, 556, 138, 54, () => '', 'next', null, { tip: 'Cursore a destra' }),
    B('kbs', 332, 556, 138, 54, () => 'Canc', 'close'), B('kclr', 478, 556, 134, 54, () => '', 'trash', null, { tip: 'Svuota il campo' }),
    B('ko', 40, 622, 572, 62, () => 'Applica', 'check')]));
  const QRP = headed('Codice QR', [{ id: 'qrimg', kind: 'label', x: 40, y: 112, w: 572, h: 572, label: () => '', img: s => s.qrCanvas }, L('qrinfo', 40, 692, 572, 54, s => s.qrInfo || '')]);
  LAYOUTS.kbd = KBD; LAYOUTS.qr = QRP;
  const LAYOUT = LAYOUTS.sup;
  function pageLayout(tab) { return LAYOUTS[tab] || LAYOUT; }

  // Galleria: anteprime di una famiglia di superfici (3 colonne), con frecce per cambiare famiglia.
  // entries = [{ id, label, thumb (id del preset), on? }]; on = voce attuale (evidenziata).
  function galleryLayout(groupName, entries) {
    const items = [
      L('title', 40, 40, 190, 60, () => 'Galleria'),
      B('galmode', 238, 40, 250, 60, s => s.addMode ? 'Aggiungi' : 'Sostituisci', s => s.addMode ? 'plus' : 'flip', null, { tip: 'Cosa fa toccare una superficie: sostituisce quella scelta o ne aggiunge una' }),
      B('back', 500, 40, 112, 60, () => '', 'prev', null, { tip: 'Torna al pannello' }),
      B('gprev', 40, 112, 56, 56, () => '', 'prev', null, { tip: 'Famiglia precedente' }),
      L('gname', 104, 112, 416, 56, () => groupName),
      B('gnext', 556, 112, 56, 56, () => '', 'next', null, { tip: 'Famiglia successiva' })
    ];
    entries.forEach((e, i) => items.push(B(e.id, 40 + (i % 3) * 192, 184 + Math.floor(i / 3) * 176, 188, 168, () => e.label, null, () => !!e.on, { thumb: e.thumb })));
    return { W: W, H: H, MPP: MPP, frame: FR, items: items };
  }
  // Galleria sul palmo (mani): una anteprima grande, frecce per scorrere, due pulsanti per cambiare famiglia
  const PALM = { W: 420, H: 260, MPP: MPP, frame: 6, items: [
    B('pprev', 10, 10, 80, 240, () => '', 'prev', null, { tip: 'Precedente' }),
    B('pnext', 330, 10, 80, 240, () => '', 'next', null, { tip: 'Successiva' }),
    B('psel', 100, 10, 220, 170, s => s.palmName || '', null, null, { thumb: s => s.palmId }),
    B('pgp', 100, 190, 56, 60, () => '', 'up', null, { tip: 'Famiglia precedente' }),
    L('pgl', 160, 190, 100, 60, s => s.palmPos || ''),
    B('pgn', 264, 190, 56, 60, () => '', 'down', null, { tip: 'Famiglia successiva' })
  ] };
  // Menu rapido di una superficie (si apre tenendo premuto il grilletto, o la pinza col raggio, su di essa)
  const OBJMENU = { W: 420, H: 272, MPP: MPP, frame: 6, items: [
    L('omt', 10, 10, 400, 44, s => s.omName || ''),
    B('om-hide', 10, 62, 195, 60, s => s.omVis ? 'Nascondi' : 'Mostra', s => s.omVis ? 'eyeoff' : 'eye'),
    B('om-del', 215, 62, 195, 60, () => 'Elimina', 'trash', null, { off: s => !s.canDel }),
    B('om-home', 10, 132, 195, 60, () => 'Pos. orig.', 'home'),
    B('om-solo', 215, 132, 195, 60, s => s.omSolo ? 'Mostra tutte' : 'Isola', 'isolate'),
    B('om-dup', 10, 202, 195, 60, () => 'Duplica', 'copy', null, { off: s => !s.canAdd }),
    B('om-lock', 215, 202, 195, 60, s => s.omLocked ? 'Sblocca' : 'Blocca', 'lock', s => s.omLocked)
  ] };
  // Pannello chiuso: un solo pulsante "Menu" (6 cm) che lo riapre
  const FAB = { W: 128, H: 128, MPP: MPP, frame: 6, items: [B('show', 12, 12, 104, 104, () => 'Menu', 'menu', null, { stack: true })] };

  // coordinate locali (m) → pixel del canvas
  const toPx = (lx, ly, Lo) => { Lo = Lo || LAYOUT; return [lx / Lo.MPP + Lo.W / 2, Lo.H / 2 - ly / Lo.MPP]; };
  const toLocalXY = (px, py, Lo) => { Lo = Lo || LAYOUT; return [(px - Lo.W / 2) * Lo.MPP, (Lo.H / 2 - py) * Lo.MPP]; };

  function hit(layout, lx, ly, kinds) {
    const p = toPx(lx, ly, layout);
    for (const it of layout.items) {
      if (kinds && kinds.indexOf(it.kind) < 0) continue;
      if (p[0] >= it.x && p[0] <= it.x + it.w && p[1] >= it.y && p[1] <= it.y + it.h) return it;
    }
    return null;
  }
  // il punto sta sulla cornice (o poco fuori, entro margin metri)? Serve ad afferrare il pannello dal bordo.
  function inFrame(layout, lx, ly, margin) {
    const p = toPx(lx, ly, layout), m = (margin === undefined ? 0.02 : margin) / layout.MPP, f = layout.frame || 0;
    const inOuter = p[0] >= -m && p[0] <= layout.W + m && p[1] >= -m && p[1] <= layout.H + m;
    const inInner = p[0] > f && p[0] < layout.W - f && p[1] > f && p[1] < layout.H - f;
    return inOuter && !inInner;
  }

  // m = inversa della matrice del pannello (16 elementi, colonna per colonna, come THREE); w = 1 punto, 0 direzione
  function toLocal(m, x, y, z, w) {
    w = w === undefined ? 1 : w;
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w,
            m[1] * x + m[5] * y + m[9] * z + m[13] * w,
            m[2] * x + m[6] * y + m[10] * z + m[14] * w];
  }

  // raggio (origine o, direzione d, in coordinate mondo) contro il piano del pannello; t in unità locali
  function rayHit(inv, o, d) {
    const lo = toLocal(inv, o[0], o[1], o[2], 1), ld = toLocal(inv, d[0], d[1], d[2], 0);
    if (Math.abs(ld[2]) < 1e-9) return null;
    const t = -lo[2] / ld[2];
    if (t <= 0) return null;
    return { x: lo[0] + ld[0] * t, y: lo[1] + ld[1] * t, t: t };
  }

  // Poke: il dito indice "preme" quando attraversa il piano del pannello da davanti dentro un pulsante.
  // Si arma solo se è stato oltre ARM davanti; ignora la pinza; dopo la pressione serve ritirarsi oltre ARM.
  function Poke() { this.s = {}; }
  Poke.prototype.update = function (id, p, pinching, layout, scale) {
    const st = this.s[id] || (this.s[id] = { armed: false });
    const zw = p.z * scale;
    if (pinching) { st.armed = false; return { press: null, hover: null }; }
    const it = hit(layout, p.x, p.y, ['btn']);
    let press = null;
    if (zw > ARM) st.armed = true;
    if (zw <= 0) {
      if (st.armed && it && zw > -BACK) press = it.id;
      st.armed = false;
    }
    return { press: press, hover: it && zw > -BACK && zw < HOVER ? it.id : null };
  };
  Poke.prototype.reset = function () { this.s = {}; };

  // ---------- riepilogo delle trasformazioni di un oggetto ----------
  // g = { px, py, pz (unità), rx, ry, rz (gradi, Euler), angle (gradi, rotazione totale), axis [x,y,z], s (scala) }
  function describe(g, details) {
    const dist = Math.hypot(g.px, g.py, g.pz);
    if (details) return {
      tr: 'x ' + fmt(g.px) + '  y ' + fmt(g.py) + '  z ' + fmt(g.pz),
      rot: 'x ' + Math.round(g.rx) + '°  y ' + Math.round(g.ry) + '°  z ' + Math.round(g.rz) + '°',
      sca: 'scala ' + fmt(g.s)
    };
    let axis = 'obliquo';
    if (g.axis) { const a = g.axis.map(Math.abs), k = a.indexOf(Math.max.apply(null, a)); if (a[k] > 0.985) axis = 'asse ' + 'xyz'[k]; }
    return {
      tr: dist < 0.005 ? 'Non traslata' : 'Traslata di ' + fmt(dist) + ' unità',
      rot: g.angle < 0.5 ? 'Non ruotata' : 'Ruotata di ' + Math.round(g.angle) + '° (' + axis + ')',
      sca: Math.abs(g.s - 1) < 0.005 ? 'Scala originale' : (g.s > 1 ? 'Ingrandita' : 'Rimpicciolita') + ' ×' + fmt(g.s)
    };
  }

  // ---------- disegno ----------
  // Stesso linguaggio di Quadrature e Pendulum Lab (tessere, bordi d’inchiostro, ombre dure), variante scura verde-acqua con
  // accenti giallo e vermiglio (palette sicura per il daltonismo).
  const TH = { bg: '#0d3a33', frame: '#e8fbf5', frameHot: '#ff8a3d', btn: '#0a2b26', hov: '#f0e442', hovInk: '#06201c', on: '#ff8a3d', onInk: '#06201c',
               flash: '#56b4e9', fg: '#e8fbf5', muted: '#7fa89c', ink: '#e8fbf5', shadow: '#031411' };
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  function fit(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text; while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  const iconOf = (it, s) => typeof it.icon === 'function' ? it.icon(s) : it.icon;
  // s = stato (vedi PAGES); hover = id sotto il dito/raggio; flash = id appena premuto
  function draw(ctx, layout, s, hover, flash) {
    const CW = layout.W, CH = layout.H, f = layout.frame || 0, SH = layout.frame > 10 ? 6 : 4;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = s.hot ? TH.frameHot : TH.frame; ctx.fillRect(0, 0, CW, CH);       // cornice: si accende quando la mano è vicina
    ctx.fillStyle = TH.bg; ctx.fillRect(f, f, CW - 2 * f, CH - 2 * f);
    if (f > 10) { ctx.fillStyle = s.hot ? TH.frame : TH.frameHot; [[CW / 2 - 40, 8, 80, 12], [CW / 2 - 40, CH - 20, 80, 12], [8, CH / 2 - 40, 12, 80], [CW - 20, CH / 2 - 40, 12, 80]].forEach(r => ctx.fillRect(r[0], r[1], r[2], r[3])); }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const hovIt = hover && layout.items.find(i => i.id === hover), tip = hovIt && hovIt.tip;
    for (const it of layout.items) {
      let txt = it.label(s);
      if (it.kind === 'label') {
        if (it.img) { const cv = it.img(s); if (cv) ctx.drawImage(cv, it.x, it.y, it.w, it.h); continue; }
        if (it.id === 'title' && tip) txt = tip;
        ctx.font = (it.id === 'title' ? '700 28px ' : (it.id === 'gname' ? '700 21px ' : '700 25px ')) + MONO; ctx.textAlign = 'left'; ctx.fillStyle = it.id === 'foot' || it.id[0] === 'h' && it.id.length === 2 ? TH.muted : TH.fg;
        ctx.fillText(fit(ctx, txt, it.w - 12), it.x + 6, it.y + it.h / 2); ctx.textAlign = 'center';
        continue;
      }
      const off = it.off && it.off(s);
      let fill = TH.btn, fg = TH.fg, dx = 0, shadow = true;
      if (it.on && it.on(s)) { fill = TH.on; fg = TH.onInk; }
      if (hover === it.id && !off) { fill = TH.hov; fg = TH.hovInk; }
      if (flash === it.id) { fill = TH.flash; fg = TH.hovInk; dx = SH; shadow = false; }
      if (off || it.id === 'del' && !s.canDel || it.id === 'add' && !s.canAdd || (it.id[0] === 'R' && it.id.length === 2 && !s.implicit)) fg = TH.muted;
      if (shadow && !off) { ctx.fillStyle = TH.shadow; ctx.fillRect(it.x + SH, it.y + SH, it.w, it.h); }
      ctx.fillStyle = fill; ctx.fillRect(it.x + dx, it.y + dx, it.w, it.h);
      ctx.lineWidth = 3; ctx.strokeStyle = off ? TH.muted : TH.ink; ctx.strokeRect(it.x + dx + 1.5, it.y + dx + 1.5, it.w - 3, it.h - 3);
      const cx = it.x + dx + it.w / 2, cy = it.y + dx + it.h / 2, ic = iconOf(it, s);
      const tid = typeof it.thumb === 'function' ? it.thumb(s) : it.thumb;
      if (it.thumb !== undefined || it.img) {   // anteprima della superficie sopra, nome sotto
        const cv = it.img ? it.img(s) : (s.thumbs && tid && s.thumbs[tid]);
        const big = it.h > 200, th = it.h - (big ? 8 : 44) - 8;
        if (cv && !off) ctx.drawImage(cv, it.x + dx + 8, it.y + dx + 8, it.w - 16, th);
        else if (!off) { ctx.fillStyle = TH.muted; ctx.font = '700 28px ' + MONO; ctx.fillText('…', cx, it.y + dx + 8 + th / 2); }
        if (!big) { ctx.fillStyle = fg; ctx.font = '700 19px ' + MONO; ctx.fillText(fit(ctx, txt, it.w - 12), cx, it.y + dx + it.h - 22); }
        else { ctx.fillStyle = fg; ctx.font = '700 22px ' + MONO; ctx.textAlign = 'center'; ctx.fillText(fit(ctx, txt, it.w - 12), cx, it.y + dx + it.h - 18); }
      } else if (it.swatch !== undefined) {   // tessera di una superficie nella scena: campione di colore + numero
        const col = s.swatch && s.swatch[it.swatch];
        if (col && !off) { ctx.fillStyle = col; ctx.fillRect(it.x + dx + 6, it.y + dx + 6, it.w - 12, 16); ctx.strokeStyle = TH.ink; ctx.lineWidth = 2; ctx.strokeRect(it.x + dx + 6, it.y + dx + 6, it.w - 12, 16); }
        ctx.fillStyle = fg; ctx.font = '700 28px ' + MONO; ctx.fillText(txt, cx, cy + 12);
      } else if (it.stack) {           // icona sopra, nome sotto (schede, Menu)
        if (ic && Icons) Icons.draw(ctx, ic, cx, it.y + dx + it.h * 0.36, 30, fg);
        ctx.fillStyle = fg; ctx.font = (it.w < 120 ? '700 17px ' : '700 20px ') + MONO; ctx.fillText(fit(ctx, txt, it.w - 6), cx, it.y + dx + it.h * 0.78);
      } else if (ic && txt) {          // icona a sinistra, testo nel resto
        if (Icons) Icons.draw(ctx, ic, it.x + dx + 28, cy, 28, fg);
        ctx.fillStyle = fg; ctx.font = '700 22px ' + MONO; ctx.fillText(fit(ctx, txt, it.w - 62), it.x + dx + 52 + (it.w - 60) / 2, cy);
      } else if (ic) {                 // solo icona
        if (Icons) Icons.draw(ctx, ic, cx, cy, Math.min(40, it.h - 20), fg, 2.6);
      } else {
        ctx.fillStyle = fg; ctx.font = '700 25px ' + MONO; ctx.fillText(fit(ctx, txt, it.w - 20), cx, cy);
      }
    }
  }

  const api = { LAYOUT: LAYOUT, FAB: FAB, TABS: TAB_DEF.map(t => t[0]), pageLayout: pageLayout, galleryLayout: galleryLayout, PALM: PALM, OBJMENU: OBJMENU, hit: hit, inFrame: inFrame, toPx: toPx, toLocalXY: toLocalXY,
                toLocal: toLocal, rayHit: rayHit, Poke: Poke, describe: describe, draw: draw, fmt: fmt, ARM: ARM, BACK: BACK, HOVER: HOVER, FRAME: FR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Panel = api;
})(typeof window !== 'undefined' ? window : globalThis);
