// Parameter Lab XR · presets.js
// Esempi pronti (puro: solo dati). Nome e domanda guida di ogni esempio sono nelle stringhe: "pr.<id>" e "pq.<id>".
// a, b: relazioni (b vuota = una sola); k0, k1: intervallo di k; k: valore iniziale; W: finestra x, y ∈ [−W, W]; p: valore del parametro a.
// UMD: in Node `require`, nel browser globale `Presets`.
(function (root) {
  "use strict";
  const P = (id, a, b, k0, k1, k, W, extra) => Object.assign({ id, a, b, k0, k1, k, W, p: 1 }, extra || {});
  const LIST = [
    P("linecircle", "x^2 + y^2 = 4", "y = x + k", -4, 4, 0, 4),
    P("roots", "y = x^2 - 2*k*x + k", "y = 0", -2, 3, 2, 6),
    P("pencil", "y = k*x - 1", "y = x^2", -3, 3, 0, 7),
    P("circles", "x^2 + y^2 = 4", "(x - k)^2 + y^2 = 1", -4, 4, 0, 5),
    P("hyperbola", "x*y = k", "x^2 + y^2 = 4", -3, 3, 1, 3.5),
    P("sqrt", "y = sqrt(x)", "y = x - k", -1, 3, 0, 6),
    P("abs", "y = abs(x - 1)", "y = k", -2, 3, 1, 4),
    P("cubic", "y = x^3 - 3*x", "y = k", -3.5, 3.5, 1, 4),
    P("concentric", "x^2 + y^2 = k", "", 0, 9, 4, 4),
    P("regions", "x^2 + y^2 <= k", "y >= x + 1", 0, 8, 4, 4),
    P("parabolaregion", "y >= x^2 - k", "y <= 2", -3, 4, 1, 4),
  ];
  const api = { LIST, ORDER: LIST.map((p) => p.id), byId: (id) => LIST.find((p) => p.id === id) || null };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Presets = api;
})(typeof window !== "undefined" ? window : globalThis);
