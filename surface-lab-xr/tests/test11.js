const QR = require('../qr.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ---------- capacità in byte dati (codeword) note dallo standard: verificano le tabelle di blocchi e correzione
const CAP_L = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276];
const CAP_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669, 714, 782, 860, 914, 1000];
ok(CAP_L.every((c, i) => QR.dataCodewords(i + 1, 'L') === c), 'codeword di dati livello L, versioni 1–25, come da standard');
ok(CAP_M.every((c, i) => QR.dataCodewords(i + 1, 'M') === c), 'codeword di dati livello M, versioni 1–25, come da standard');

// ---------- Reed-Solomon: esempio pubblicato per «HELLO WORLD» 1-M (10 codeword di correzione)
const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
const ecc = QR.rsRemainder(data, QR.rsDivisor(10));
ok(JSON.stringify(ecc) === JSON.stringify([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]), 'correzione di errore di «HELLO WORLD» = esempio dello standard (' + ecc.join(' ') + ')');

// ---------- struttura
const q = QR.make('HELLO WORLD', 'M');
ok(q.version === 1 && q.size === 21 && q.ecl === 'M', 'testo breve: versione 1, 21×21');
const finderOk = (x0, y0) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); if (q.get(x0 + dx, y0 + dy) !== (d !== 2)) return false; } return true; };
ok(finderOk(0, 0) && finderOk(14, 0) && finderOk(0, 14), 'tre quadrati di riferimento');
let tim = true; for (let i = 8; i < 13; i++) if (q.get(i, 6) !== (i % 2 === 0) || q.get(6, i) !== (i % 2 === 0)) tim = false;
ok(tim, 'linee di sincronismo alternate');
ok(q.get(8, 13) === true, 'modulo scuro fisso');
// bit di formato: ricalcolati e confrontati con quelli letti dalla matrice (due copie)
const fmt = (ecl, mask) => { const d = ({ L: 1, M: 0 }[ecl] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; };
const readFmt1 = () => { let v = 0; const pts = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]; pts.forEach((p, i) => { if (q.get(p[0], p[1])) v |= 1 << i; }); return v; };
const readFmt2 = () => { let v = 0; for (let i = 0; i < 8; i++) if (q.get(q.size - 1 - i, 8)) v |= 1 << i; for (let i = 8; i < 15; i++) if (q.get(8, q.size - 15 + i)) v |= 1 << i; return v; };
ok(readFmt1() === fmt('M', q.mask) && readFmt2() === fmt('M', q.mask), 'bit di formato corretti nelle due copie (maschera ' + q.mask + ')');

// ---------- scelta della versione e limiti
ok(QR.make('a'.repeat(17), 'L').version === 1 && QR.make('a'.repeat(18), 'L').version === 2, 'confine versione 1/2 a 17 byte (L)');
ok(QR.make('a'.repeat(1273), 'L').version === 25, '1273 byte entrano nella versione 25-L');
let threw = false; try { QR.make('a'.repeat(1400), 'L'); } catch (e) { threw = /troppo lungo/.test(e.message); } ok(threw, 'testo troppo lungo: errore chiaro');
const big = QR.make('s3d1.' + 'x'.repeat(600), 'auto'); ok(big.ecl === 'L' && big.version > 12, 'auto: oltre la versione 12 passa a L (v' + big.version + ')');
const mid = QR.make('s3d1.' + 'x'.repeat(150), 'auto'); ok(mid.ecl === 'M' && mid.version <= 12, 'auto: testo medio con livello M (v' + mid.version + ')');
const u = QR.make('àèì', 'M'); ok(u.bytes === 6, 'UTF-8: 3 lettere accentate = 6 byte');
// tutte le versioni producono una matrice quadrata con i tre riferimenti e senza eccezioni
let allOk = true; for (const n of [5, 30, 60, 100, 160, 220, 300, 420, 600, 800, 1000, 1200]) { try { const c = QR.make('q'.repeat(n), 'L'); if (c.size !== c.version * 4 + 17 || !c.get(3, 3) || !c.get(c.size - 4, 3) || !c.get(3, c.size - 4)) allOk = false; } catch (e) { allOk = false; } }
ok(allOk, 'matrici valide per lunghezze da 5 a 1200 byte');
// stesso testo → stessa matrice
const a1 = QR.make('abc', 'M'), a2 = QR.make('abc', 'M'); let same = true; for (let y = 0; y < a1.size; y++) for (let x = 0; x < a1.size; x++) if (a1.get(x, y) !== a2.get(x, y)) same = false;
ok(same, 'deterministico');
console.log(fails ? fails + ' FALLITI' : 'tutti ok');
process.exit(fails ? 1 : 0);
