/* Equation gallery and graph-matching targets. Names and descriptions live in i18n (g_<id>, gd_<id>). */

const sec = (kind, o) => ({
  kind, f: o.f || '', end: String(o.end),
  s0: { inh: o.s0 === undefined, e: String(o.s0 ?? 0) },
  v0: { inh: o.v0 === undefined, e: String(o.v0 ?? 0) },
  a: String(o.a ?? 0), blend: !!o.blend
});

// p: name -> [value, min, max, step]
export const PRESETS = [
  { id: 'mru', secs: [sec('s', { f: 's0 + v t', end: 6 })], p: { s0: [0, -5, 5, 0.1], v: [1.5, -3, 3, 0.1] } },
  { id: 'mrua', secs: [sec('s', { f: 's0 + v0 t + ½ a t^2', end: 6 })], p: { s0: [0, -5, 5, 0.1], v0: [0, -4, 4, 0.1], a: [1, -2, 2, 0.05] } },
  { id: 'brake', secs: [sec('u', { s0: 0, v0: 8, a: -2, end: 4 }), sec('u', { a: 0, end: 6 })], p: {} },
  { id: 'backforth', secs: [sec('s', { f: 's0 + v0 t + ½ a t^2', end: 5 })], p: { s0: [0, -5, 5, 0.1], v0: [4, -5, 5, 0.1], a: [-2, -3, 3, 0.05] } },
  { id: 'trip', secs: [sec('a', { f: '1.5', s0: 0, v0: 0, end: 2 }), sec('a', { f: '0', end: 5 }), sec('a', { f: '-1.5', end: 7 })], p: {} },
  { id: 'steps', secs: [sec('v', { f: '2', s0: 0, end: 2 }), sec('v', { f: '0', end: 3 }), sec('v', { f: '-1', end: 6 })], p: {} },
  { id: 'wall', secs: [sec('s', { f: '2t', end: 2 }), sec('s', { f: '4 - 2(t - 2)', end: 4 })], p: {} },
  { id: 'teleport', secs: [sec('s', { f: 't', end: 2 }), sec('s', { f: 't + 2', end: 4 })], p: {} },
  { id: 'osc', secs: [sec('s', { f: 'A sin(ω t)', end: '4π/ω' })], p: { A: [2, 0, 5, 0.1], 'ω': [1.5, 0.2, 4, 0.05] } },
  { id: 'jerk', secs: [sec('a', { f: 'k t', s0: 0, v0: 0, end: 4 })], p: { k: [0.5, -2, 2, 0.05] } },
  { id: 'toss', ff: { w0: 1, v0: 8, g: 9.81, floor: true, e: 0.6, T: 4 } },
  { id: 'drop', ff: { w0: 8, v0: 0, g: 9.81, floor: true, e: 0.75, T: 5 } },
  { id: 'terminal', secs: [sec('v', { f: 'V (1 - exp(-k t))', s0: 0, end: 8 })], p: { V: [3, 0, 6, 0.1], k: [1, 0.1, 3, 0.05] } }
];

/* graph matching on a 0–10 m track; q is the graph to match */
export const TARGETS = [
  { id: 'c1', q: 's', secs: [sec('s', { f: '2 + t', end: 6 })] },
  { id: 'c2', q: 's', secs: [sec('u', { s0: 3, v0: 0, a: 0, end: 2 }), sec('u', { v0: 2, a: 0, end: 4 }), sec('u', { v0: 0, a: 0, end: 6 })] },
  { id: 'c3', q: 's', secs: [sec('u', { s0: 2, v0: 2, a: 0, end: 3 }), sec('u', { v0: -2, a: 0, end: 6 })] },
  { id: 'c4', q: 's', secs: [sec('s', { f: '1 + 0.5 t^2', end: 4 })] },
  { id: 'c5', q: 'v', secs: [sec('v', { f: '1.2', s0: 2, end: 5 })] },
  { id: 'c6', q: 'v', secs: [sec('v', { f: '2', s0: 1, end: 2 }), sec('v', { f: '0', end: 3 }), sec('v', { f: '-1.5', end: 6 })] },
  { id: 'c7', q: 'v', secs: [sec('v', { f: 't', s0: 1, end: 2 }), sec('v', { f: '2 - (t - 2)', end: 4 })] }
];

export const kindsOf = secs => [...new Set(secs.map(s => s.kind))];
export const clone = o => JSON.parse(JSON.stringify(o));
