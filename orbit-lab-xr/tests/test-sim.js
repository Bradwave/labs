// Test dello stato di simulazione: lancio, riavvolgimento, propulsori (clic breve / pressione lunga), livelli, missioni.
const { CORE } = require('../core.js');
const { Sim, MISSIONS } = require('../sim.js');
let fail = 0;
const t = (name, ok, info) => { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const run = (sim, seconds, dt = 1 / 60, t0 = 0) => { let now = t0; for (let i = 0; i < seconds / dt; i++) { now += dt * 1000; sim.update(dt, now); } return now; };

// lancio circolare dalla torre: l'orbita resta circolare
let s = new Sim(); s.S.h = 0.5; s.S.v = CORE.vc(0.5); s.S.ang = 0; s.launchChanged();
t('prima del lancio: fase prep, 1 passo', s.S.phase === 'prep' && s.H.n === 1);
s.launch(); run(s, 10);
let I = s.info();
t('orbita circolare dopo 10 s a 1×: e<1e-6, r=1.5', I.e < 1e-6 && Math.abs(I.r - 1.5) < 1e-6, 'e=' + I.e.toExponential(1));
t('tempo simulato = 10', Math.abs(s.viewState().t - 10) < 0.05, 't=' + s.viewState().t.toFixed(3));

// velocità 4×
const t1 = s.viewState().t; s.S.speed = 4; run(s, 1); t('velocità 4×: ~4 unità in 1 s', Math.abs(s.viewState().t - t1 - 4) < 0.1);

// riavvolgimento e ramificazione
s.S.speed = 1; const nBefore = s.H.n; s.setCursor(200);
t('scrubber: cursore a 200, in pausa', s.S.cur === 200 && !s.S.playing);
const x200 = s.viewState().x; s.S.playing = true; run(s, 0.5);
t('riproduzione dalla storia non crea passi nuovi', s.H.n === nBefore && s.S.cur > 200);
s.setCursor(100); s.S.playing = false;
t('clic breve prograde ramifica la storia', s.thrDown('pro', 0) === undefined && (s.thrUp('pro'), s.H.n === 101 + 0 || s.H.n === 102), 'n=' + s.H.n);
t('Δv di un passo = 0.02', Math.abs(s.viewState().dv - 0.02) < 1e-12);
t('prograde alza il punto più lontano', s.info().ra > 1.5 + 1e-3);

// pressione lunga: accensione continua
s = new Sim(); s.S.h = 0.5; s.S.v = CORE.vc(0.5); s.launchChanged(); s.launch();
let now = run(s, 1);
s.thrDown('pro', now); now = run(s, 0.1, 1 / 60, now);
t('a 100 ms non brucia ancora', !s.thrBurning('pro'));
now = run(s, 0.5, 1 / 60, now);
t('dopo 230 ms brucia', s.thrBurning('pro') && s.S.hold === 1);
const dvBurn = s.viewState().dv; t('Δv cresce durante la spinta', dvBurn > 0.05, 'dv=' + dvBurn.toFixed(3));
s.thrUp('pro'); t('rilascio: spinta spenta', s.S.hold === 0 && !s.thrBurning('pro'));
// lavoro-energia con spinta lunga
const q = s.viewState(), E0 = CORE.energy(...[s.H.get(0)].map(a => [a.x, a.y, a.vx, a.vy])[0]).E, E1 = CORE.energy(q.x, q.y, q.vx, q.vy).E;
t('E − E0 = W_T (spinta lunga)', Math.abs(E1 - E0 - q.W) < 1e-6, (E1 - E0 - q.W).toExponential(1));

// radiali bloccati a livello 1
s = new Sim(); s.S.v = 0.8; s.launchChanged(); s.launch();
s.thrDown('out', 0); t('propulsori radiali: bloccati a livello 1 (messaggio)', !s.thrHeld('out') && s.events.length > 0);
s.setLevel(2); s.thrDown('out', 0); t('…sbloccati a livello 2', s.thrHeld('out')); s.thrUp('out');

// niente propulsori prima del lancio
s = new Sim(); s.thrDown('pro', 0); t('propulsori prima del lancio: ignorati', !s.thrHeld('pro') && s.events.length === 1);

// schianto e arresto
s = new Sim(); s.S.h = 0.5; s.S.v = 0.3; s.launchChanged(); s.launch(); run(s, 6);
t('schianto: S.crashed impostato e simulazione ferma', !!s.S.crashed && !s.S.playing && s.info().crash);
t('dopo lo schianto togglePlay avvisa', (s.togglePlay(), s.events.length > 0));

// reset conserva il fantasma
const nG = s.S.ghosts.length; s.resetFlight(true); t('reset archivia la traiettoria come fantasma', s.S.ghosts.length === nG + 1 && s.S.phase === 'prep');

// missioni
s = new Sim();
s.missionOpen(3); s.missionPick(1);
t('missione 3: setup lancia in orbita circolare', s.S.phase === 'flying' && s.info().e < 0.01);
run(s, 6); s.missionCheck();
t('missione 3: obiettivo raggiunto dopo 5 unità senza spinta', s.M.stage === 'explain' && s.done.has(3));
s = new Sim(); s.missionOpen(1); s.missionPick(0);
t('missione 1: non ancora raggiunta', !s.missionCheck());
s.S.v = 0; s.launchChanged(); s.launch(); s.resetFlight(true); s.S.v = 0.5; s.launchChanged(); s.launch();
t('missione 1: raggiunta con due lanci', s.missionCheck() && s.done.has(1));
s = new Sim(); s.missionOpen(6); s.missionPick(1);
t('missione 6: il livello sale a 2', s.S.level === 2);
let now2 = run(s, 1); s.thrDown('pro', now2); s.thrUp('pro');
t('missione 6: dopo un passo non è ancora risolta (serve scendere di velocità)', !s.missionCheck());
t('tutte le missioni hanno setup, domanda, 3 opzioni e check', MISSIONS.every(m => m.setup && m.q && m.opts.length === 3 && typeof m.check === 'function'));
console.log(fail ? fail + ' FALLITI' : 'tutti i test di sim superati');
process.exit(fail ? 1 : 0);
