const Core = require('../core.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const area = m => { let A = 0; const P = m.positions; for (let t = 0; t < P.length; t += 9) { const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2]; A += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); } return A; };

// ---------- parametri nel parser
ok(Core.detectParams('x^2/a^2+y^2/b^2+z^2/c^2=1').join('') === 'abc', 'rileva a, b, c');
ok(Core.detectParams('abs(x)+y').length === 0, '«abs» è una funzione, non a·b·s');
ok(Core.detectParams('cos(x)=c').join('') === 'c' && Core.detectParams('min(x,y)=m').join('') === 'm', 'cos, min restano funzioni; c e m parametri');
ok(Core.detectParams('2a*x+3k=0').join('') === 'ak', 'prodotto implicito con parametri (2a, 3k)');
ok(Core.detectParams('x+(').length === 0, 'errore di sintassi: nessun parametro');
ok(Core.detectParamsParam('u', 'v', 'a*v').join('') === 'a', 'parametri anche nelle parametriche');
let c = Core.compile('x^2+y^2+z^2=a^2');
ok(near(c.fn(2, 0, 0), 3, 1e-12), 'valore predefinito a = 1');
ok(near(Core.compile('x^2+y^2+z^2=a^2', { a: 2 }).fn(2, 0, 0), 0, 1e-12), 'valore passato: a = 2');
ok(near(c.make({ a: 3 })(3, 0, 0), 0, 1e-12) && near(c.fn(3, 0, 0), 8, 1e-12), 'make() crea funzioni indipendenti');
const mk = Core.compile('z=a*sin(k*x)', { a: 2, k: Math.PI / 2 }); ok(near(mk.fn(1, 0, 2), 0, 1e-9) && near(mk.fn(1, 0, 0), -2, 1e-9), 'più parametri insieme');
let threw = false; try { Core.compile('x+q'); } catch (e) { threw = /q/.test(e.message); } ok(threw, 'lettere sconosciute segnalate');
threw = false; try { Core.compile('x=alert(1)'); } catch (e) { threw = true; } ok(threw, 'nessun codice arbitrario (alert)');
threw = false; try { Core.compile('x=a.b'); } catch (e) { threw = true; } ok(threw, 'nessun accesso a proprietà');
ok(Core.evalNumber('2*pi') > 6.28 && (() => { try { Core.evalNumber('a'); return false; } catch (e) { return true; } })(), 'gli estremi numerici non accettano parametri');
// parametri e sfera: l'area cambia con a
const m1 = Core.polygonize(Core.compile('x^2+y^2+z^2=a^2', { a: 1 }).fn, { R: 2.5, N: 64 }), m2 = Core.polygonize(Core.compile('x^2+y^2+z^2=a^2', { a: 2 }).fn, { R: 2.5, N: 64 });
ok(near(area(m1), 4 * Math.PI, 0.15) && near(area(m2), 16 * Math.PI, 0.9), 'area della sfera: a=1 → 4π, a=2 → 16π (' + area(m1).toFixed(2) + ', ' + area(m2).toFixed(2) + ')');
// ogni preset con parametri: valori predefiniti dentro i limiti e mesh valida
const withP = Core.PRESETS.filter(p => p.params);
ok(withP.length >= 8, 'preset con parametri (' + withP.length + ')');
ok(withP.every(p => Object.keys(p.params).every(k => { const q = p.params[k]; return q[1] <= q[0] && q[0] <= q[2] && Core.PARAM_LETTERS.indexOf(k) >= 0; })), 'valori predefiniti dentro [min, max]');
ok(withP.every(p => { const names = p.kind === 'param' ? Core.detectParamsParam(p.fx, p.fy, p.fz) : Core.detectParams(p.eq); return names.join('') === Object.keys(p.params).sort().join(''); }), 'i parametri dichiarati sono quelli dell’equazione');
let bad = 0;
for (const p of withP) for (const ext of [0, 1]) {   // agli estremi dei cursori la mesh resta valida
  const vals = {}; Object.keys(p.params).forEach(k => { vals[k] = p.params[k][1 + ext]; });
  const mm = p.kind === 'param' ? Core.polygonizeParam(Core.compileParam(p.fx, p.fy, p.fz, vals).fn, Core.evalNumber(p.u0), Core.evalNumber(p.u1), Core.evalNumber(p.v0), Core.evalNumber(p.v1), 24, 24)
    : Core.polygonize(Core.compile(p.eq, vals).fn, { R: p.R, N: 28 });
  if (!mm.triangles || !Array.from(mm.positions).every(Number.isFinite)) { bad++; console.log('   problema:', p.id, ext ? 'max' : 'min'); }
}
ok(bad === 0, 'mesh valida con i cursori al minimo e al massimo');

// ---------- dominio a scatola
const sph = Core.compile('x^2+y^2+z^2=1.5^2').fn;
const half = Core.polygonize(sph, { bounds: [-2, 2, -2, 2, 0, 2], N: 80 });
ok(near(area(half), 2 * Math.PI * 1.5 * 1.5, 0.35), 'emisfero: area ≈ 2πr² (' + area(half).toFixed(2) + ' vs ' + (2 * Math.PI * 2.25).toFixed(2) + ')');
let inside = true; const P = half.positions; for (let i = 0; i < P.length; i += 3) if (P[i + 2] < -1e-6 || P[i] < -2 - 1e-6 || P[i] > 2 + 1e-6) inside = false;
ok(inside, 'tutti i vertici dentro la scatola');
const cut = Core.polygonize(sph, { bounds: [0, 2, 0, 2, 0, 2], N: 64 });
ok(near(area(cut), 4 * Math.PI * 2.25 / 8, 0.25), 'ottante della sfera: area ≈ 4πr²/8 (' + area(cut).toFixed(2) + ')');
const flat = Core.polygonize(Core.compile('z=0').fn, { bounds: [-2, 2, -1, 1, -0.5, 0.5], N: 40 });
ok(near(area(flat), 4 * 2, 0.05), 'piano in una scatola non cubica: area 4×2 (' + area(flat).toFixed(2) + ')');
ok(Core.polygonize(sph, { bounds: [1, 1, -1, 1, -1, 1], N: 20 }).triangles === 0 && Core.polygonize(sph, { bounds: [2, 1, -1, 1, -1, 1], N: 20 }).triangles === 0, 'estensione nulla o negativa: nessun triangolo');
const cube = Core.polygonize(sph, { R: 2, N: 48 }), cube2 = Core.polygonize(sph, { bounds: [-2, 2, -2, 2, -2, 2], N: 48 });
ok(cube.triangles === cube2.triangles, 'R e bounds equivalenti danno la stessa mesh (' + cube.triangles + ')');
// sezione con dominio a scatola
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const full = Core.sectionSegments(sph, I4, [0, 0, 0.5], [1, 0, 0], [0, 1, 0], [-2, 2, -2, 2, -2, 2], 2.5, 80).length;
const clipped = Core.sectionSegments(sph, I4, [0, 0, 0.5], [1, 0, 0], [0, 1, 0], [0, 2, -2, 2, -2, 2], 2.5, 80).length;
const num = Core.sectionSegments(sph, I4, [0, 0, 0.5], [1, 0, 0], [0, 1, 0], 2, 2.5, 80).length;
ok(full === num && clipped > 0 && clipped < full * 0.65, 'la sezione rispetta la scatola: intera ' + full / 4 + ' segmenti, metà ' + clipped / 4);
console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
