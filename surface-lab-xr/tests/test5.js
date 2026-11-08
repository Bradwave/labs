const Pointer = require('../pointer.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const P = [0, 0, 0];

// ---------- clic: down subito, tap se rilasciato presto
let tr = new Pointer.Tracker(), e;
e = tr.update('c0', { down: false, near: false, target: 'btn:a', point: P }, 0); ok(!e.down && !e.tap, 'senza pressione nessun evento');
e = tr.update('c0', { down: true, near: false, target: 'btn:a', point: P }, 10); ok(e.down === 'btn:a', 'down sul bersaglio indicato');
e = tr.update('c0', { down: true, near: false, target: 'btn:a', point: P }, 100); ok(!e.down && !e.hold, 'durante la pressione breve niente altro');
e = tr.update('c0', { down: false, near: false, target: 'btn:a', point: P }, 200); ok(e.tap === 'btn:a', 'rilascio rapido = tap');

// ---------- hold
tr = new Pointer.Tracker();
tr.update('c0', { down: true, target: 'srf:1', point: P }, 0);
e = tr.update('c0', { down: true, target: 'srf:1', point: P }, 300); ok(!e.hold, 'a 300 ms non è ancora hold');
e = tr.update('c0', { down: true, target: 'srf:1', point: P }, 520); ok(e.hold === 'srf:1', 'a 520 ms hold');
e = tr.update('c0', { down: true, target: 'srf:1', point: P }, 700); ok(!e.hold, 'hold una sola volta');
e = tr.update('c0', { down: false, target: 'srf:1', point: P }, 800); ok(!e.tap, 'dopo hold il rilascio non è un tap');

// ---------- tap lento e spostamento
tr = new Pointer.Tracker();
tr.update('c0', { down: true, target: 'srf:1', point: P }, 0);
e = tr.update('c0', { down: false, target: 'srf:1', point: P }, 460); ok(!e.tap, 'rilascio oltre tapMs: niente tap');
tr = new Pointer.Tracker();
tr.update('c0', { down: true, target: 'srf:1', point: [0, 0, 0] }, 0);
e = tr.update('c0', { down: true, target: 'srf:1', point: [0.1, 0, 0] }, 100); ok(e.cancel === 'srf:1', 'spostamento oltre la tolleranza: cancel');
e = tr.update('c0', { down: true, target: 'srf:1', point: [0.1, 0, 0] }, 700); ok(!e.hold, 'dopo cancel niente hold');
e = tr.update('c0', { down: false, target: 'srf:1', point: [0.1, 0, 0] }, 750); ok(!e.tap, 'dopo cancel niente tap');

// ---------- niente bersaglio
tr = new Pointer.Tracker();
e = tr.update('c0', { down: true, target: null, point: null }, 0); ok(!e.down, 'pressione nel vuoto: nessun down');
e = tr.update('c0', { down: false, target: null, point: null }, 100); ok(!e.tap, 'e nessun tap');

// ---------- mani: aggancio del bersaglio mentre la pinza si chiude
tr = new Pointer.Tracker();
tr.update('h0', { down: false, near: true, target: 'btn:b', point: P }, 0);
tr.update('h0', { down: false, near: true, target: 'btn:c', point: P }, 30); // il raggio salta mentre le dita si toccano
e = tr.update('h0', { down: true, near: true, target: 'btn:c', point: P }, 60);
ok(e.down === 'btn:b', 'si preme il bersaglio agganciato prima della pinza, non quello dopo il salto');
tr = new Pointer.Tracker();
tr.update('h0', { down: false, near: true, target: 'btn:b', point: P }, 0);
tr.update('h0', { down: false, near: false, target: 'btn:c', point: P }, 30);
e = tr.update('h0', { down: true, near: true, target: 'btn:c', point: P }, 60);
ok(e.down === 'btn:c', 'se la pinza si riapre l’aggancio decade');
tr = new Pointer.Tracker();
e = tr.update('h0', { down: true, near: true, target: 'btn:z', point: P }, 0); ok(e.down === 'btn:z', 'senza aggancio vale il bersaglio attuale');

// ---------- afferrare esclude il clic
tr = new Pointer.Tracker();
tr.update('h0', { down: false, near: true, target: 'srf:2', point: P }, 0);
e = tr.update('h0', { down: true, near: true, target: 'srf:2', point: P, grabbing: true }, 20); ok(!e.down, 'se la mano afferra, nessun down');
e = tr.update('h0', { down: false, near: false, target: 'srf:2', point: P, grabbing: false }, 400); ok(!e.tap, 'e nessun tap al rilascio');

// ---------- sorgenti indipendenti
tr = new Pointer.Tracker();
tr.update('c0', { down: true, target: 'a', point: P }, 0); e = tr.update('c1', { down: true, target: 'b', point: P }, 0);
ok(e.down === 'b', 'due sorgenti non si disturbano');
e = tr.update('c0', { down: false, target: 'a', point: P }, 100); ok(e.tap === 'a', 'tap della prima');

// ---------- ricerca lungo il raggio
const S = new Float32Array([0, 0, -1, 0.02, 0, -2, 0.5, 0, -1.5, 0, 0, 1]);
let n = Pointer.nearestOnRay(S, [0, 0, 0], [0, 0, -1], 0.05);
ok(n && n.i === 0 && Math.abs(n.t - 1) < 1e-9, 'sceglie il campione più vicino al raggio (e davanti)');
n = Pointer.nearestOnRay(S, [0, 0, 0], [0, 0, -1], 0.005); ok(n && n.i === 0, 'soglia stretta: solo l’esatto');
n = Pointer.nearestOnRay(S, [0, 0, 0], [0, 1, 0], 0.05); ok(n === null, 'raggio che non incontra nulla');
n = Pointer.nearestOnRay(new Float32Array([0, 0, 1]), [0, 0, 0], [0, 0, -1], 0.05); ok(n === null, 'campioni dietro l’origine ignorati');

console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
