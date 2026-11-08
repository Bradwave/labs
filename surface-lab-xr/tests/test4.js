const Panel = require('../panel.js');
const Icons = require('../icons.js');
const Core = require('../core.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const names = Panel.TABS.concat(['log', 'dom', 'par', 'kbd', 'qr']);
const pages = names.map(t => Panel.pageLayout(t));
const center = (it, L) => Panel.toLocalXY(it.x + it.w / 2, it.y + it.h / 2, L);
const st = { name: 'Cono', vis: true, theta: 45, phi: 0, d: 0.5, clipOn: true, snapOn: true, faceMe: false, planeOn: true, implicit: true, R: 2, plane: 'z = 0,50', canAdd: true, canDel: true,
  hot: false, mode: 'immersive-vr', tab: 'sup', domRows: [[-2, 2], [-2, 2], [-2, 2]], domHandles: false, parRows: [{ n: 'a', v: 1.2 }], nSurf: 2, selIndex: 0, swatch: ['#0072b2', '#d55e00'], tr: 'Non traslata', rot: 'Non ruotata', sca: 'Scala originale', details: false, kbKeys: Array.from({ length: 40 }, (_, i) => 'k' + i), kbLabel: 'F(x, y, z)', kbMulti: true, kbShow: 'x^2+|y', kbMsg: 'OK: espressione valida', qrCanvas: null, qrInfo: 'v10' };

// ---------- layout di ogni pagina
ok(Panel.TABS.length === 5 && new Set(pages).size === 10, 'cinque schede e le pagine cronologia, dominio, parametri, tastiera e QR, tutte diverse');
pages.forEach((L, k) => {
  const items = L.items, btns = items.filter(i => i.kind === 'btn'), name = names[k];
  ok(items.every(i => i.x >= Panel.FRAME && i.y >= Panel.FRAME && i.x + i.w <= L.W - Panel.FRAME && i.y + i.h <= L.H - Panel.FRAME), name + ': elementi dentro la cornice (' + items.length + ')');
  ok(btns.every(i => i.w * L.MPP >= (name === 'kbd' ? 0.026 : 0.029) && i.h * L.MPP >= 0.027), name + ': pulsanti larghi/alti almeno ~' + (name === 'kbd' ? '2,7' : '3') + ' cm (' + btns.length + ')');
  let overlap = 0;
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const p = items[a], q = items[b];
    if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) { overlap++; console.log('   sovrapposti', p.id, q.id); }
  }
  ok(overlap === 0, name + ': nessuna sovrapposizione');
  ok(new Set(items.map(i => i.id)).size === items.length, name + ': id unici');
  ok(btns.every(i => { const c = center(i, L), h = Panel.hit(L, c[0], c[1]); return h && h.id === i.id; }), name + ': il centro di ogni pulsante lo colpisce');
  ok((name === 'kbd' || name === 'qr' ? ['back', 'face', 'exit', 'hide'] : ['tab:sup', 'tab:pia', 'tab:ogg', 'tab:sce', 'tab:vis', 'face', 'exit', 'hide']).every(id => btns.some(b => b.id === id)), name + ': intestazione e schede presenti');
  const icons = []; items.forEach(i => { if (typeof i.icon === 'string') icons.push(i.icon); else if (i.icon) { icons.push(i.icon(st), i.icon(Object.assign({}, st, { vis: false, details: true }))); } });
  ok(icons.every(n => Icons.ICONS[n]), name + ': tutte le icone usate esistono');
});
const all = new Set([].concat(...pages.map(L => L.items.map(i => i.id))));
['th-', 'th+', 'ph-', 'ph+', 'd-', 'd+', 'gdom', 'gpar', 'dl-x', 'dl+x', 'du-y', 'du+z', 'dsym', 'dreset', 'dhandles', 'pm:0', 'pp:5', 'pdef', 'plane', 'clip', 'flip', 'snap', 'prev', 'next', 'vis', 'add', 'del', 'pickmenu', 'home', 'resetall', 'reset', 'det', 'sel:0', 'sel:5', 'cron', 'salva', 'nuova', 'kmie', 'klez', 'sdel', 'se:0', 'se:3', 'spp', 'spn', 'undo', 'lg:0', 'lg:4', 'lrev', 'lpp', 'lpn', 'probe', 'tgp', 'unpin', 'kopen', 'qr', 'kc:0', 'kc:39', 'kl', 'kr', 'kbs', 'kclr', 'ko', 'kpt', 'knt', 'back'].forEach(id => { if (!all.has(id)) ok(false, 'azione mancante: ' + id); });
ok(true, 'tutte le azioni del pannello hanno un pulsante');
const L0 = pages[0];
const px = Panel.toPx(0, 0); ok(near(px[0], L0.W / 2, 1e-9) && near(px[1], L0.H / 2, 1e-9), 'origine locale = centro del canvas');
ok(Panel.hit(L0, 1, 1) === null && Panel.hit(L0, -1, 0) === null, 'fuori dal pannello: nessun colpo');

// ---------- cornice afferrabile
const fx = Panel.toLocalXY(Panel.FRAME / 2, L0.H / 2, L0);        // metà della cornice a sinistra
ok(Panel.inFrame(L0, fx[0], fx[1]), 'il punto sulla cornice è afferrabile');
const fo = Panel.toLocalXY(-0.01 / L0.MPP, L0.H / 2, L0);          // 1 cm fuori dal bordo
ok(Panel.inFrame(L0, fo[0], fo[1]), 'anche poco fuori dal bordo (margine 2 cm)');
const ff = Panel.toLocalXY(-0.05 / L0.MPP, L0.H / 2, L0);          // 5 cm fuori
ok(!Panel.inFrame(L0, ff[0], ff[1]), 'lontano dal bordo non si afferra');
ok(!Panel.inFrame(L0, 0, 0), 'il centro del pannello non è cornice');
const btn = L0.items.find(i => i.id === 'add'), bc = center(btn, L0);
ok(!Panel.inFrame(L0, bc[0], bc[1]), 'un pulsante non è cornice');
const fc = Panel.toLocalXY(L0.W / 2, L0.H - Panel.FRAME / 2, L0);
ok(Panel.inFrame(L0, fc[0], fc[1]) && Panel.hit(L0, fc[0], fc[1], ['btn']) === null, 'la cornice non coincide con nessun pulsante');

// ---------- trasformazioni
let d = Panel.describe({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, angle: 0, axis: [0, 0, 1], s: 1 }, false);
ok(d.tr === 'Non traslata' && d.rot === 'Non ruotata' && d.sca === 'Scala originale', 'nessuna trasformazione');
d = Panel.describe({ px: 0.5, py: 0, pz: 1.2, rx: 0, ry: 0, rz: 30, angle: 30, axis: [0, 0, 1], s: 1.4 }, false);
ok(/Traslata di 1,30/.test(d.tr) && /Ruotata di 30° \(asse z\)/.test(d.rot) && /Ingrandita ×1,40/.test(d.sca), 'riepilogo: ' + [d.tr, d.rot, d.sca].join(' | '));
d = Panel.describe({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, angle: 45, axis: [0.6, 0.6, 0.5], s: 0.5 }, false);
ok(/obliquo/.test(d.rot) && /Rimpicciolita ×0,50/.test(d.sca), 'asse obliquo e rimpicciolita');
d = Panel.describe({ px: -0.5, py: 0, pz: 0.25, rx: 0, ry: 90, rz: 0, angle: 90, axis: [0, 1, 0], s: 2 }, true);
ok(d.tr === 'x −0,50  y 0,00  z 0,25' && d.rot === 'x 0°  y 90°  z 0°' && d.sca === 'scala 2,00', 'dettagli: ' + [d.tr, d.rot, d.sca].join(' | '));

// ---------- trasformazioni (pannello in (1,2,3) con scala 2)
const inv = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, -0.5, -1, -1.5, 1];
let l = Panel.toLocal(inv, 3, 4, 5);
ok(near(l[0], 1, 1e-9) && near(l[1], 1, 1e-9) && near(l[2], 1, 1e-9), 'toLocal punto');
l = Panel.toLocal(inv, 2, 0, 0, 0); ok(near(l[0], 1, 1e-9), 'toLocal direzione ignora la traslazione');
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const r = Panel.rayHit(I4, [0.05, 0.1, 0.4], [0, 0, -1]);
ok(r && near(r.x, 0.05, 1e-9) && near(r.y, 0.1, 1e-9) && near(r.t, 0.4, 1e-9), 'raggio frontale colpisce il piano');
ok(Panel.rayHit(I4, [0, 0, 0.4], [0, 0, 1]) === null, 'raggio che si allontana: nessun colpo');
ok(Panel.rayHit(I4, [0, 0, 0.4], [1, 0, 0]) === null, 'raggio parallelo: nessun colpo');

// ---------- poke col dito indice
const target = L0.items.find(i => i.id === 'add'), tc = center(target, L0);
const at = z => ({ x: tc[0], y: tc[1], z: z });
let pk = new Panel.Poke(), e;
e = pk.update('h0', at(0.08), false, L0, 1); ok(e.press === null && e.hover === null, 'lontano: niente hover');
e = pk.update('h0', at(0.03), false, L0, 1); e = pk.update('h0', at(0.01), false, L0, 1);
ok(e.press === null && e.hover === 'add', 'vicino: hover, non ancora premuto');
e = pk.update('h0', at(-0.004), false, L0, 1); ok(e.press === 'add', 'attraversa il piano dentro il pulsante: premuto');
e = pk.update('h0', at(-0.012), false, L0, 1); ok(e.press === null, 'rimanere oltre non ripreme');
e = pk.update('h0', at(0.004), false, L0, 1); e = pk.update('h0', at(-0.004), false, L0, 1);
ok(e.press === null, 'senza ritirarsi oltre ARM non si riarma');
pk.update('h0', at(0.03), false, L0, 1); e = pk.update('h0', at(0.0), false, L0, 1); ok(e.press === 'add', 'ritirato e riavvicinato: preme di nuovo');
pk = new Panel.Poke(); e = pk.update('h0', at(0.0), false, L0, 1); ok(e.press === null, 'ingresso laterale sul piano: nessuna pressione');
pk = new Panel.Poke(); pk.update('h0', at(0.03), true, L0, 1); e = pk.update('h0', at(-0.004), true, L0, 1);
ok(e.press === null && e.hover === null, 'mentre pizzica non preme');
pk = new Panel.Poke(); pk.update('h0', at(0.03), false, L0, 1);
e = pk.update('h0', { x: 0.2, y: 0.3, z: -0.004 }, false, L0, 1); ok(e.press === null, 'attraversa il piano fuori dai pulsanti: nessuna pressione');
pk = new Panel.Poke(); pk.update('h0', at(0.03), false, L0, 1); e = pk.update('h0', at(-0.05), false, L0, 1);
ok(e.press === null, 'dito che arriva da dietro (oltre BACK): ignorato');
pk = new Panel.Poke(); pk.update('h0', at(0.01), false, L0, 2); e = pk.update('h0', at(-0.001), false, L0, 2);
ok(e.press === 'add', 'con scala 2 le soglie sono in metri mondo');

// ---------- galleria (famiglie di superfici) e galleria sul palmo
const gall = Panel.galleryLayout(Core.GROUPS[0], Core.PRESETS.filter(p => p.group === Core.GROUPS[0]).map(p => ({ id: 'p:' + p.id, label: p.name, thumb: p.id })));
const maxG = Math.max(...Core.GROUPS.map(g => Core.PRESETS.filter(p => p.group === g).length));
ok(maxG <= 9, 'ogni famiglia ha al massimo 9 superfici (' + maxG + '): entra in 3×3');
const biggest = Core.GROUPS.reduce((a, b) => Core.PRESETS.filter(p => p.group === a).length >= Core.PRESETS.filter(p => p.group === b).length ? a : b);
const galB = Panel.galleryLayout(biggest, Core.PRESETS.filter(p => p.group === biggest).map(p => ({ id: 'p:' + p.id, label: p.name, thumb: p.id })));
ok(galB.items.every(i => i.x >= Panel.FRAME && i.y >= Panel.FRAME && i.x + i.w <= galB.W - Panel.FRAME && i.y + i.h <= galB.H - Panel.FRAME), 'galleria della famiglia più grande dentro la cornice (' + galB.items.length + ' elementi)');
let ov = 0; for (let a = 0; a < galB.items.length; a++) for (let b = a + 1; b < galB.items.length; b++) { const p = galB.items[a], q = galB.items[b]; if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) ov++; }
ok(ov === 0, 'galleria: nessuna sovrapposizione');
ok(galB.items.filter(i => i.kind === 'btn').every(i => { const c = center(i, galB), h = Panel.hit(galB, c[0], c[1]); return h && h.id === i.id; }), 'ogni anteprima e pulsante della galleria è colpibile');
ok(['galmode', 'back', 'gprev', 'gnext'].every(id => gall.items.some(i => i.id === id)), 'galleria: modo, indietro, cambio famiglia');
ok(galB.items.filter(i => i.thumb).every(i => i.w * Panel.LAYOUT.MPP >= 0.09 && i.h * Panel.LAYOUT.MPP >= 0.08), 'le anteprime sono grandi almeno 9 × 8 cm');
const PM = Panel.PALM;
ok(PM.items.every(i => i.x >= 0 && i.y >= 0 && i.x + i.w <= PM.W && i.y + i.h <= PM.H), 'galleria sul palmo dentro il canvas');
ok(PM.items.filter(i => i.kind === 'btn').every(i => { const c = center(i, PM), h = Panel.hit(PM, c[0], c[1]); return h && h.id === i.id; }), 'palmo: ogni pulsante è colpibile');
ok(PM.items.filter(i => i.kind === 'btn').every(i => i.w * PM.MPP >= 0.027 && i.h * PM.MPP >= 0.027), 'palmo: pulsanti di almeno ~2,7 cm');

// ---------- menu rapido della superficie
const OM = Panel.OBJMENU;
ok(OM.items.every(i => i.x >= 0 && i.y >= 0 && i.x + i.w <= OM.W && i.y + i.h <= OM.H), 'menu rapido dentro il canvas');
ok(OM.items.filter(i => i.kind === 'btn').length === 6 && OM.items.filter(i => i.kind === 'btn').every(i => { const c = center(i, OM), h = Panel.hit(OM, c[0], c[1]); return h && h.id === i.id; }), 'menu rapido: sei azioni, tutte colpibili');
ok(OM.items.filter(i => i.kind === 'btn').every(i => i.w * OM.MPP >= 0.09 && i.h * OM.MPP >= 0.029), 'menu rapido: pulsanti di almeno 9 × 3 cm');
const omIcons = []; OM.items.forEach(i => { if (typeof i.icon === 'string') omIcons.push(i.icon); else if (i.icon) omIcons.push(i.icon({ omVis: true }), i.icon({ omVis: false })); });
ok(omIcons.every(n => Icons.ICONS[n]), 'menu rapido: icone esistenti');

// ---------- pulsante "Menu" a pannello chiuso
const F = Panel.FAB, fcc = center(F.items[0], F);
ok(Panel.hit(F, fcc[0], fcc[1], ['btn']).id === 'show', 'il pulsante Menu si colpisce nel suo layout');
ok(F.items[0].w * F.MPP >= 0.05, 'pulsante Menu largo almeno 5 cm');
const fk = new Panel.Poke(); fk.update('h', { x: fcc[0], y: fcc[1], z: 0.03 }, false, F, 1);
ok(fk.update('h', { x: fcc[0], y: fcc[1], z: -0.004 }, false, F, 1).press === 'show', 'si preme anche col dito');

// ---------- icone
ok(Object.keys(Icons.ICONS).every(k => /^[MmLlHhVvAaCcSsQqTtZz0-9 .,\-]+$/.test(Icons.ICONS[k])), 'i tracciati delle icone usano solo comandi SVG validi (' + Object.keys(Icons.ICONS).length + ')');
ok(/<svg[^>]*><path d="M/.test(Icons.svg('cube', 20)) && Icons.svg('inesistente') === '', 'svg() produce markup e ignora i nomi sconosciuti');

// ---------- disegno (contesto finto)
const calls = {};
const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (s => ({ width: s.length * 14 })) : (() => { calls[k] = (calls[k] || 0) + 1; }), set: () => true });
let thrown = null;
try {
  names.forEach(t => Panel.draw(ctx, Panel.pageLayout(t), Object.assign({}, st, { tab: t, sceEntries: [{ name: 'Una scena', canvas: null }], sceKind: 'mie', sceInfo: '1/1', canUndo: true, undoLabel: 'Nuova scena', logRows: [{ text: '12:04 Cono spostata di 0,30' }], logSel: 0, logD1: 'a', logD2: 'b', logD3: 'c' }), 'add', 'exit'));
  Panel.draw(ctx, Panel.pageLayout('ogg'), Object.assign({}, st, { tab: 'ogg', implicit: false, vis: false, hot: true, details: true, mode: 'immersive-ar' }), 'face', null);
  Panel.draw(ctx, galB, Object.assign({}, st, { thumbs: { sfera: {} } }), 'gnext', null); Panel.draw(ctx, PM, Object.assign({}, st, { palmName: 'Sfera', palmId: 'sfera', palmPos: '3/45', thumbs: {} }), 'psel', null); Panel.draw(ctx, F, st, 'show', null); Panel.draw(ctx, OM, Object.assign({}, st, { omName: 'Cono', omVis: true, omSolo: false, omLocked: true }), 'om-del', null);
} catch (err) { thrown = err; }
ok(!thrown && calls.fillText >= 40, 'draw gira su tutte le pagine, elenchi e Menu' + (thrown ? ' ' + thrown.message : ''));

console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
