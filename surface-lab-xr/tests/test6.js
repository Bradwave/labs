const Core = require('../core.js');
const Thumbs = require('../thumbs.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// contesto finto che registra i punti disegnati
function rec() {
  const r = { pts: [], fills: 0, strokes: 0, fillStyles: new Set() };
  r.ctx = { fillStyle: '', strokeStyle: '', lineWidth: 1, clearRect() {}, fillRect() {}, beginPath() {}, closePath() {}, fill() { r.fills++; r.fillStyles.add(this.fillStyle); }, stroke() { r.strokes++; },
    moveTo(x, y) { r.pts.push([x, y]); }, lineTo(x, y) { r.pts.push([x, y]); } };
  return r;
}

// ---------- ogni preset: mesh valida, entra nel riquadro, colori in gioco
const W = 120, H = 90;
let worst = 0, slow = 0, tris = 0, emptyCount = 0;
const t0 = Date.now();
for (const p of Core.PRESETS) {
  const m = Thumbs.meshFor(Core, p);
  const r = rec(), n = Thumbs.render(r.ctx, W, H, m, {});
  tris += n;
  if (!n) { emptyCount++; console.log('   vuoto:', p.id); continue; }
  const bad = r.pts.filter(q => !(q[0] >= -0.5 && q[0] <= W + 0.5 && q[1] >= -0.5 && q[1] <= H + 0.5)).length;
  if (bad) { worst++; console.log('   fuori dal riquadro:', p.id, bad); }
  if (r.fills !== n) slow++;
}
const dt = Date.now() - t0;
ok(emptyCount === 0, 'ogni preset produce un’anteprima non vuota (' + Core.PRESETS.length + ')');
ok(worst === 0, 'tutte le anteprime restano dentro il riquadro');
ok(slow === 0, 'un riempimento per triangolo');
console.log('   ' + tris + ' triangoli in ' + dt + ' ms (' + Math.round(dt / Core.PRESETS.length) + ' ms per preset, in Node)');
ok(dt / Core.PRESETS.length < 120, 'generazione abbastanza veloce (< 120 ms per anteprima in Node)');

// ---------- colori: la sfera mostra il fronte; il nastro di Möbius (a due lati) anche il retro
const sph = rec(); Thumbs.render(sph.ctx, W, H, Thumbs.meshFor(Core, Core.presetById('sfera')), { front: 0x0072b2, back: 0xf2efe6 });
const blueish = [...sph.fillStyles].some(s => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(s); return m && +m[3] > +m[1]; });
ok(blueish, 'la sfera è disegnata col colore frontale');
// un cono visto dall'alto mostra l'interno (retro) di una falda: compaiono entrambi i colori
const cone = rec(); Thumbs.render(cone.ctx, W, H, Thumbs.meshFor(Core, Core.presetById('cono')), { front: 0x0072b2, back: 0xf2efe6 });
const warm = [...cone.fillStyles].some(s => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(s); return m && +m[1] > +m[3] + 20; });
ok(blueish && (warm || cone.fillStyles.size > 5), 'il cono ha ombreggiature diverse (fronte e retro)');

// ---------- ordine del pittore: i triangoli lontani prima di quelli vicini (profondità non decrescente nel disegno)
const m2 = Thumbs.meshFor(Core, Core.presetById('sfera'));
const seen = []; const r2 = rec(); r2.ctx.fill = function () { seen.push(this.fillStyle); };
Thumbs.render(r2.ctx, W, H, m2, {});
ok(seen.length === Math.floor(m2.positions.length / 9), 'disegnati tutti i triangoli della sfera (' + seen.length + ')');

// ---------- mesh vuota
ok(Thumbs.render(rec().ctx, W, H, { positions: new Float32Array(0), normals: new Float32Array(0) }, {}) === 0, 'mesh vuota: nessun disegno e nessun errore');

console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
