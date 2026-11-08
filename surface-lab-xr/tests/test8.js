const Core = require('../core.js'), S = require('../scene.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, t) => Math.abs(a - b) <= t;

// ---------- lezioni e scena predefinita
ok(S.LESSONS.length >= 8 && new Set(S.LESSONS.map(l => l.id)).size === S.LESSONS.length, 'lezioni con id unici (' + S.LESSONS.length + ')');
ok(S.LESSONS.every(l => S.validate(l.data, Core).ok), 'tutte le lezioni sono valide');
ok(S.validate(S.DEFAULT_SCENE, Core).ok, 'la scena predefinita è valida');

// ---------- validazione
let r = S.validate({ v: 1, surfaces: [{ pre: 'sfera', p: [1, 2, 3], q: [0, 0, 0, 2], s: 1.5 }], plane: { theta: 45, phi: 30, d: 0.5 } }, Core);
ok(r.ok && r.scene.surfaces[0].pre === 'sfera' && near(r.scene.surfaces[0].q[3], 1, 1e-9), 'preset noto; quaternione normalizzato');
ok(r.scene.surfaces[0].s === 1.5 && r.scene.plane.theta === 45, 'valori conservati');
r = S.validate({ v: 1, surfaces: [{ kind: 'implicit', eq: 'x^2+y^2+z^2=1', R: 99, s: -4 }] }, Core);
ok(r.ok && r.scene.surfaces[0].R === 10 && r.scene.surfaces[0].s === 0.01, 'valori fuori limite riportati nei limiti');
r = S.validate({ v: 1, surfaces: [{ kind: 'implicit', eq: 'x^2+(' }, { kind: 'implicit', eq: 'x^2+y^2=z^2' }] }, Core);
ok(r.ok && r.scene.surfaces.length === 1 && r.errors.length === 1, 'equazione non valida scartata, l’altra resta');
r = S.validate({ v: 1, surfaces: [{ kind: 'param', fx: 'cos(u)', fy: 'sin(u)', fz: 'v', u0: '0', u1: '2*pi', v0: '-1', v1: '1' }] }, Core);
ok(r.ok && r.scene.surfaces[0].kind === 'param', 'superficie parametrica valida');
r = S.validate({ v: 1, surfaces: [{ kind: 'param', fx: 'cos(u', fy: 'u', fz: 'v', u0: '0', u1: '1', v0: '0', v1: '1' }] }, Core);
ok(!r.ok, 'parametrica non valida: scena senza superfici = rifiutata');
ok(!S.validate(null, Core).ok && !S.validate({ v: 2 }, Core).ok && !S.validate({ v: 1, surfaces: [] }, Core).ok, 'dati nulli, versione ignota o senza superfici: rifiutati');
r = S.validate({ v: 1, surfaces: Array.from({ length: 10 }, () => ({ pre: 'sfera' })) }, Core);
ok(r.ok && r.scene.surfaces.length === 6, 'al massimo 6 superfici');
r = S.validate({ v: 1, surfaces: [{ pre: 'sfera', p: ['x', null, 3], q: 'no', s: 'big' }], frame: { p: [NaN, 0, 0] } }, Core);
ok(r.ok && r.scene.surfaces[0].p[0] === 0 && r.scene.surfaces[0].p[2] === 3 && r.scene.frame.p[0] === 0, 'numeri non validi sostituiti dai valori di default');
r = S.validate({ v: 1, name: '<script>x</script>'.repeat(30), surfaces: [{ pre: 'sfera' }] }, Core);
ok(r.scene.name.length <= 80, 'nome limitato a 80 caratteri');

// ---------- dominio e parametri nelle scene
r = S.validate({ v: 1, surfaces: [{ pre: 'ellissoide-abc', b: [-1, 2, -1.5, 1.5, 0, 3], par: { a: 1.8, b: 0.9, zz: 5, c: 'x' } }] }, Core);
ok(r.ok && JSON.stringify(r.scene.surfaces[0].b) === '[-1,2,-1.5,1.5,0,3]' && r.scene.surfaces[0].par.a === 1.8 && r.scene.surfaces[0].par.zz === undefined && r.scene.surfaces[0].par.c === 1, 'dominio e parametri conservati; chiavi estranee ignorate, valori non numerici → 1');
r = S.validate({ v: 1, surfaces: [{ pre: 'sfera', b: [2, 1, -1, 1, -1, 1] }, { pre: 'sfera', b: [1, 2, 3] }, { pre: 'sfera', b: [-99, 99, -1, 1, -1, 1] }] }, Core);
ok(r.ok && r.scene.surfaces[0].b === undefined && r.scene.surfaces[1].b === undefined && r.scene.surfaces[2].b[0] === -10 && r.scene.surfaces[2].b[1] === 10, 'dominio non valido scartato; fuori limite riportato a ±10');
r = S.validate({ v: 1, surfaces: [{ kind: 'implicit', eq: 'x^2/a^2+y^2+z^2=1', par: { a: 2 }, b: [-3, 3, -1, 1, -1, 1] }] }, Core);
ok(r.ok && r.scene.surfaces[0].par.a === 2, 'equazione con parametro valida');
r = S.validate({ v: 1, surfaces: [{ kind: 'implicit', eq: 'x^2/q^2=1' }] }, Core); ok(!r.ok, 'lettera non ammessa: scartata');
const cd = S.decode(S.encode(S.validate({ v: 1, surfaces: [{ pre: 'toro-ab', par: { a: 1.6, b: 0.4 }, b: [-2, 2, -2, 2, -1, 1] }] }, Core).scene), Core);
ok(cd.ok && cd.scene.surfaces[0].par.b === 0.4 && cd.scene.surfaces[0].b[5] === 1, 'andata e ritorno nel codice con dominio e parametri');

// ---------- codice breve
const sc = S.validate({ v: 1, name: 'Prova àè', frame: { p: [0, 1.3, -0.7], q: [0, 0.1, 0, 0.995], s: 0.16 }, plane: { p: [0, 0, 0.5], q: [0, 0, 0, 1] }, surfaces: [{ pre: 'cono', p: [0.123456, 0, 1], q: [0, 0, 0.2, 0.98], s: 1.2 }, { kind: 'implicit', eq: 'x^2+y^2-z=0', R: 2, name: 'Paraboloide' }], sel: 1 }, Core).scene;
const code = S.encode(sc);
ok(code.indexOf('s3d1.') === 0 && /^[A-Za-z0-9._-]+$/.test(code), 'codice con solo caratteri sicuri (' + code.length + ' caratteri)');
const back = S.decode(code, Core);
ok(back.ok && back.scene.name === 'Prova àè' && back.scene.surfaces.length === 2 && back.scene.sel === 1, 'andata e ritorno del codice');
ok(near(back.scene.surfaces[0].p[0], 0.1235, 1e-9), 'numeri arrotondati a 4 decimali');
ok(S.decode('  testo ' + code + ' fine', Core).ok, 'il codice si trova anche dentro un testo incollato');
ok(!S.decode('s3d1.@@@', Core).ok && !S.decode('ciao', Core).ok && !S.decode('', Core).ok, 'codici sbagliati rifiutati');
ok(S.encode(S.validate(S.LESSONS[0].data, Core).scene).length < 400, 'una lezione semplice ha un codice corto (< 400 caratteri)');

// ---------- cronologia dei gesti
const A = { p: [0, 0, 0], q: [0, 0, 0, 1], s: 1 };
ok(S.describeDelta(A, A) === 'nessun cambiamento' && !S.changed(A, A), 'nessun cambiamento');
const B = { p: [0.3, 0.4, 0], q: [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)], s: 1.5 };
ok(S.describeDelta(A, B) === 'spostata di 0,50 · ruotata di 30° · ingrandita ×1,50', 'parole: ' + S.describeDelta(A, B));
ok(/rimpicciolita ×0,50/.test(S.describeDelta(A, { p: [0, 0, 0], q: [0, 0, 0, 1], s: 0.5 })), 'rimpicciolita');
ok(near(S.delta(A, { p: [0, 0, 0], q: [0, 0, 0, -1], s: 1 }).angle, 0, 1e-6), 'q e −q sono la stessa rotazione');
console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
