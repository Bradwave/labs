// Test del pannello: layout senza sovrapposizioni, hit-test, cornice, raggio, poke, cursore.
const P = require('../xrpanel.js');
const { Sim, MISSIONS, LEVEL_FEATS } = require('../sim.js');
let fail = 0;
const t = (name, ok, info) => { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

function state(tab, over) {
  const sim = new Sim(); if (over && over.level) sim.setLevel(over.level);
  const S = sim.S;
  return Object.assign({ tab: tab, phase: S.phase, playing: false, speed: 1, scrub: 0, tLabel: 't = 0.00', view: 'planet', xr: 'immersive-vr', faceMe: false, h: S.h, v: S.v, ang: S.ang,
    tl: S.tl, dvStep: S.dvStep, dvUsed: 0, budget: S.budget, show: S.show, scale: 'lin', level: S.level, planet: 'none', levelNote: 'x', xrNote: 'y', feat: k => sim.feat(k), thrHeld: {},
    missions: MISSIONS.map(m => ({ id: m.id, title: m.title, level: m.level, done: false })), mission: { cur: null, stage: 'predict', choice: -1 }, noteLines: ['a', 'b'] }, over || {});
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const level of [1, 3]) for (const tab of P.TABS.map(x => x[0])) {
  const L = P.build(state(tab, { level: level }));
  const hits = L.items.filter(i => (i.kind === 'btn' || i.kind === 'slider') && !i.hidden && i.h > 0);
  let bad = [];
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) if (overlap(hits[i], hits[j])) bad.push(hits[i].id + '×' + hits[j].id);
  const out = hits.filter(i => i.x < P.FR || i.y < P.FR || i.x + i.w > P.W - P.FR || i.y + i.h > P.H - P.FR);
  t('layout ' + tab + ' L' + level + ': ' + hits.length + ' elementi, nessuna sovrapposizione, dentro la cornice', bad.length === 0 && out.length === 0, bad.concat(out.map(o => o.id)).join(' '));
  const small = hits.filter(i => i.h < 44 || i.w < 44);
  t('layout ' + tab + ' L' + level + ': bersagli ≥ 44 px (2,2 cm)', small.length === 0, small.map(i => i.id + ':' + i.w + 'x' + i.h).join(' '));
  const ids = L.items.map(i => i.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  t('layout ' + tab + ' L' + level + ': id unici', dup.length === 0, dup.join(' '));
}
// stati della scheda Goals
for (const stage of ['predict', 'run', 'explain']) {
  const L = P.build(state('goals', { mission: { cur: MISSIONS[0], stage: stage, choice: 0 } }));
  const hits = L.items.filter(i => i.kind === 'btn' && i.y < 630);
  let bad = []; for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) if (overlap(hits[i], hits[j])) bad.push(hits[i].id + '×' + hits[j].id);
  t('goals/' + stage + ': nessuna sovrapposizione, dentro la cornice', bad.length === 0 && hits.filter(i => i.y < 630).every(i => i.y + i.h <= 628), bad.join(' '));
}

// hit-test: il centro di un pulsante restituisce quel pulsante
const L = P.build(state('launch'));
const play = L.items.find(i => i.id === 'play');
const [lx, ly] = P.toLocalXY(play.x + play.w / 2, play.y + play.h / 2, L);
t('hit: centro di "play"', P.hit(L, lx, ly).id === 'play');
t('hit: fuori da tutto = null', P.hit(L, 0, -0.5) === null);
t('cornice: bordo sì, centro no', P.inFrame(L, ...P.toLocalXY(10, 300, L)) && !P.inFrame(L, 0, 0));
// raggio contro il piano: pannello alla identità, davanti a z=-1
const inv = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const r = P.rayHit(inv, [0.01, 0.02, 1], [0, 0, -1]);
t('raggio: colpisce il piano z=0 in (0.01, 0.02), t=1', r && Math.abs(r.x - 0.01) < 1e-12 && Math.abs(r.y - 0.02) < 1e-12 && Math.abs(r.t - 1) < 1e-12);
t('raggio parallelo = null; raggio all\'indietro = null', P.rayHit(inv, [0, 0, 1], [1, 0, 0]) === null && P.rayHit(inv, [0, 0, -1], [0, 0, -1]) === null);

// poke: si arma oltre 1,2 cm, preme attraversando z<=0
const pk = new P.Poke();
let o = pk.update('i', { x: lx, y: ly, z: 0.03 }, false, L, 1); t('poke: davanti, nessuna pressione, hover sì', !o.press && o.hover === 'play');
o = pk.update('i', { x: lx, y: ly, z: -0.005 }, false, L, 1); t('poke: attraversa → preme "play"', o.press === 'play');
o = pk.update('i', { x: lx, y: ly, z: -0.01 }, false, L, 1); t('poke: nessuna ripetizione senza ritirarsi', !o.press);
pk.update('i', { x: lx, y: ly, z: 0.03 }, false, L, 1); o = pk.update('i', { x: lx, y: ly, z: -0.1 }, false, L, 1); t('poke: troppo dietro (>3 cm) ignorato', !o.press);
o = pk.update('j', { x: lx, y: ly, z: -0.005 }, false, L, 1); t('poke: mai armato → niente', !o.press);
pk.update('i', { x: lx, y: ly, z: 0.03 }, false, L, 1); o = pk.update('i', { x: lx, y: ly, z: -0.005 }, true, L, 1); t('poke: ignorato mentre pinza', !o.press);
const lv = P.build(state('fly', { level: 1 })), out = lv.items.find(i => i.id === 'thr:out'), [ox, oy] = P.toLocalXY(out.x + 10, out.y + 10, lv);
const pk2 = new P.Poke(); pk2.update('i', { x: ox, y: oy, z: 0.03 }, false, lv, 1); o = pk2.update('i', { x: ox, y: oy, z: -0.005 }, false, lv, 1);
t('poke: pulsante disabilitato (radiale a livello 1) non preme', !o.press);
// cursore
const sl = L.items.find(i => i.kind === 'slider');
const [sx0, sy0] = P.toLocalXY(sl.x + 14, sl.y + 20, L), [sx1] = P.toLocalXY(sl.x + sl.w - 14, sl.y + 20, L), [sxm] = P.toLocalXY(sl.x + sl.w / 2, sl.y + 20, L);
t('cursore: estremi 0 e 1, metà 0.5', P.sliderValue(L, sl, sx0) === 0 && P.sliderValue(L, sl, sx1) === 1 && Math.abs(P.sliderValue(L, sl, sxm) - 0.5) < 1e-9);
// disegno su un finto contesto 2D: non deve lanciare per nessuna scheda
const noop = new Proxy({}, { get: (tg, k) => k === 'measureText' ? (s => ({ width: String(s).length * 12 })) : (() => { }), set: () => true });
const C = new Proxy({}, { get: () => '#000' });
let drew = true; try { for (const tab of P.TABS.map(x => x[0])) { P.draw(noop, P.build(state(tab)), {}, 'play', { 'thr:pro': true }, null, C); } P.drawFab(noop, P.FAB, 'menu', C); } catch (e) { drew = false; console.log(e); }
t('draw: tutte le schede disegnabili senza errori', drew);
console.log(fail ? fail + ' FALLITI' : 'tutti i test del pannello superati');
process.exit(fail ? 1 : 0);
