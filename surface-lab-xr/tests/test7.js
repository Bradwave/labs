const Q = require('../quick.js'), Core = require('../core.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const items = Core.PRESETS.map(p => ({ id: p.id, group: Core.GROUPS.indexOf(p.group) }));

// ---------- direzioni (WebXR: y negativo = su)
ok(Q.dirOf(0, -1) === 'up' && Q.dirOf(0, 1) === 'down' && Q.dirOf(-1, 0) === 'left' && Q.dirOf(1, 0) === 'right', 'direzioni dello stick');
ok(Q.dirOf(0.3, -0.3) === null && Q.dirOf(0, 0) === null, 'zona morta: nessuna direzione');
ok(Q.dirOf(0.8, -0.6) === 'right', 'direzione dominante');

// ---------- ordine: per famiglia, stabile, tutte le superfici
const q = new Q.Quick(items);
ok(q.size() === Core.PRESETS.length, 'anello con tutte le superfici (' + q.size() + ')');
let sorted = true; for (let k = 1; k < q.items.length; k++) if (q.items[k].group < q.items[k - 1].group) sorted = false;
ok(sorted, 'ordinate per famiglia');
ok(new Set(q.items.map(i => i.id)).size === q.size(), 'nessun duplicato');

// ---------- apertura, chiusura, scorrimento
q.set('sfera'); const start = q.current();
let e = q.update('c0', 0, -1, 100); ok(e.length === 1 && e[0].type === 'open' && q.open && q.owner === 'c0', 'stick su apre');
e = q.update('c0', 0, -1, 120); ok(e.length === 0, 'tenuto su: nessun evento ripetuto');
q.update('c0', 0, 0, 140);
e = q.update('c0', 1, 0, 200); ok(e[0].type === 'item' && q.current() !== start, 'destra: superficie successiva');
q.update('c0', 0, 0, 220); e = q.update('c0', -1, 0, 260); ok(q.current() === start, 'sinistra: torna indietro');
q.update('c0', 0, 0, 280); e = q.update('c0', 0, 1, 300); ok(e[0].type === 'close' && !q.open, 'stick giù chiude');
q.update('c0', 0, 0, 310); e = q.update('c0', 1, 0, 320); ok(e.length === 0, 'chiusa: sinistra/destra non fanno nulla');

// ---------- salto di famiglia con l'altro stick
q.set('sfera'); q.update('c0', 0, 0, 400); q.update('c0', 0, -1, 410);
const g0 = q.groupIdx();
q.update('c1', 0, 0, 420); e = q.update('c1', 1, 0, 430);
ok(e[0].type === 'group' && q.groupIdx() === (g0 + 1) % Core.GROUPS.length, 'l’altro stick salta alla famiglia successiva');
ok(q.items[q.i].group !== g0 && (q.i === 0 || q.items[q.i - 1].group !== q.items[q.i].group), 'atterra sulla prima superficie della famiglia');
q.update('c1', 0, 0, 440); q.update('c1', -1, 0, 450); ok(q.groupIdx() === g0, 'e torna indietro');

// ---------- anello circolare
q.i = q.size() - 1; q.update('c0', 0, 0, 500); q.update('c0', 1, 0, 510); ok(q.i === 0, 'dopo l’ultima torna alla prima');
q.update('c0', 0, 0, 520); q.update('c0', -1, 0, 530); ok(q.i === q.size() - 1, 'prima della prima va all’ultima');
q.set(items[0].id); q.groupStep(-1); ok(q.groupIdx() === Core.GROUPS.length - 1, 'famiglia precedente alla prima: l’ultima');

// ---------- inattività
q.close(); q.update('c0', 0, 0, 600); q.update('c0', 0, -1, 610);
ok(q.tick(5000).length === 0 && q.open, 'dopo 5 s aperta');
e = q.tick(9000); ok(e[0] && e[0].idle && !q.open, 'dopo 8 s di inattività si chiude da sola');

// ---------- condivisione con il palmo: step e groupStep diretti
q.set('sfera'); const a = q.current(); q.step(1); q.step(-1); ok(q.current() === a, 'step avanti e indietro');
ok(/^\d+\/\d+$/.test(q.pos()), 'posizione testuale ' + q.pos());
console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
