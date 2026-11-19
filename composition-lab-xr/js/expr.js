// Composition Lab XR · expr.js (copiato da parameter-lab-xr, con in più compileFn per le funzioni di una variabile)
// Parser puro (nessun DOM, nessun THREE): trasforma "y = x^2 + k", "x^2+y^2 <= k", "sin(x) - a*y > 0"
// in una funzione F(x, y, k, a) e in una relazione (curva F = 0, oppure regione F < 0, F >= 0, ...).
// Il codice JS viene generato SOLO da token validati (nessun eval del testo dell'utente).
// Gli errori sono oggetti { code, params } con chiavi "err.*" delle stringhe (italiano e inglese).
// UMD: in Node `require`, nel browser globale `Expr`.
(function (root) {
  "use strict";

  const FUNCS = {
    sin: "Math.sin", cos: "Math.cos", tan: "Math.tan", asin: "Math.asin", acos: "Math.acos", atan: "Math.atan",
    sinh: "Math.sinh", cosh: "Math.cosh", tanh: "Math.tanh", exp: "Math.exp", ln: "Math.log", log: "Math.log10",
    sqrt: "Math.sqrt", cbrt: "Math.cbrt", abs: "Math.abs", sign: "Math.sign", floor: "Math.floor", ceil: "Math.ceil",
    min: "Math.min", max: "Math.max",
  };
  const TWO = { min: 1, max: 1 }; // funzioni a due argomenti
  const WORDS = Object.keys(FUNCS).sort((a, b) => b.length - a.length);
  const VARS = ["x", "y", "k", "a"];
  const err = (code, params) => { const e = new Error(code); e.code = code; e.params = params || {}; return e; };

  // ---- normalizza i simboli tipografici ----
  function normalize(src) {
    let s = String(src);
    if (!/(min|max)\s*\(/i.test(s)) s = s.replace(/(\d),(\d)/g, "$1.$2"); // 0,5 → 0.5 (salvo le funzioni a due argomenti)
    return s
      .replace(/[−–—]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi")
      .replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "!=").replace(/²/g, "^2").replace(/³/g, "^3")
      .replace(/√\s*\(/g, "sqrt(").replace(/==/g, "=");
  }

  // ---- lessico ----
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const str = s.slice(i, j);
        if (!/^(\d+\.?\d*|\.\d+)$/.test(str)) throw err("err.number", { s: str });
        out.push({ t: "num", v: parseFloat(str), pos: i }); i = j; continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        const rest = s.slice(i).toLowerCase();
        const w = WORDS.find((f) => rest.startsWith(f));
        if (w) { out.push({ t: "func", v: w, pos: i }); i += w.length; continue; }
        if (rest.startsWith("pi")) { out.push({ t: "const", v: "Math.PI", pos: i }); i += 2; continue; }
        const l = rest[0];
        if (l === "e") { out.push({ t: "const", v: "Math.E", pos: i }); i++; continue; }
        if (VARS.includes(l)) { out.push({ t: "var", v: l, pos: i }); i++; continue; }
        throw err("err.var", { v: s[i] });
      }
      if ("+-*/^(),".includes(c)) { out.push({ t: c, pos: i }); i++; continue; }
      throw err("err.char", { c });
    }
    return out;
  }

  // ---- sintassi: espressione → { js, vars } ----
  function parseExpr(tokens) {
    let p = 0;
    const used = {};
    const peek = () => tokens[p];
    const starts = (tk) => tk && (tk.t === "num" || tk.t === "var" || tk.t === "func" || tk.t === "const" || tk.t === "(");
    function expr() {
      let l = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) { const op = tokens[p++].t; const r = term(); l = "(" + l + op + r + ")"; }
      return l;
    }
    function term() {
      let l = unary();
      for (;;) {
        const tk = peek();
        if (tk && (tk.t === "*" || tk.t === "/")) { p++; const r = unary(); l = "(" + l + tk.t + r + ")"; }
        else if (starts(tk)) { const r = unary(); l = "(" + l + "*" + r + ")"; } // prodotto implicito: 2x, xy, 2(x+1)
        else return l;
      }
    }
    function unary() {
      const tk = peek();
      if (tk && tk.t === "-") { p++; return "(-" + unary() + ")"; }
      if (tk && tk.t === "+") { p++; return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (peek() && peek().t === "^") { p++; return "Math.pow(" + base + "," + expo() + ")"; }
      return base;
    }
    function expo() { // l'esponente può avere il segno: 2^-x, e si associa a destra
      const tk = peek();
      if (tk && tk.t === "-") { p++; return "(-" + expo() + ")"; }
      if (tk && tk.t === "+") { p++; return expo(); }
      return power();
    }
    function atom() {
      const tk = tokens[p++];
      if (!tk) throw err("err.end");
      if (tk.t === "num") return "(" + tk.v + ")";
      if (tk.t === "const") return tk.v;
      if (tk.t === "var") { used[tk.v] = true; return tk.v; }
      if (tk.t === "(") { const e = expr(); if (!peek() || peek().t !== ")") throw err("err.paren"); p++; return "(" + e + ")"; }
      if (tk.t === "func") {
        if (!peek() || peek().t !== "(") throw err("err.func", { f: tk.v });
        p++;
        const a = [expr()];
        if (TWO[tk.v]) { if (!peek() || peek().t !== ",") throw err("err.args", { f: tk.v }); p++; a.push(expr()); }
        if (!peek() || peek().t !== ")") throw err("err.paren");
        p++;
        return FUNCS[tk.v] + "(" + a.join(",") + ")";
      }
      throw err("err.unexpected", { c: tk.t });
    }
    if (!tokens.length) throw err("err.empty");
    const js = expr();
    if (p < tokens.length) throw err(tokens[p].t === ")" ? "err.paren" : "err.unexpected", { c: tokens[p].t });
    return { js, used };
  }

  function compileSide(src) {
    const { js, used } = parseExpr(tokenize(src));
    return { js, used };
  }

  // ---- relazione: "lato sinistro OP lato destro" ----
  // Senza operatore: se compare y è "espressione = 0", altrimenti "y = espressione".
  const OPS = ["<=", ">=", "<", ">", "="];
  function splitRelation(s) {
    let found = null;
    for (let i = 0; i < s.length; i++) {
      const two = s.slice(i, i + 2);
      const op = OPS.find((o) => (o.length === 2 ? two === o : s[i] === o && two !== "<=" && two !== ">="));
      if (op) {
        if (found) throw err("err.rel");
        found = { op, i };
        i += op.length - 1;
      }
    }
    if (!found) return null;
    const l = s.slice(0, found.i).trim(), r = s.slice(found.i + found.op.length).trim();
    if (!l || !r) throw err("err.side");
    return { op: found.op, l, r };
  }

  const inside = {
    "<": (v) => v < 0, "<=": (v) => v <= 0, ">": (v) => v > 0, ">=": (v) => v >= 0,
  };

  // Restituisce { src, op, kind: "eq" | "ineq", strict, F, inside(v), uses: {x,y,k,a} } oppure lancia un errore { code, params }.
  function parseRelation(src) {
    const s = normalize(src).trim();
    if (!s) throw err("err.empty");
    let sp = splitRelation(s), op, js, used;
    if (sp) {
      op = sp.op;
      const L = compileSide(sp.l), R = compileSide(sp.r);
      js = "(" + L.js + "-" + R.js + ")"; used = Object.assign({}, L.used, R.used);
    } else {
      const E = compileSide(s);
      op = "="; used = E.used;
      js = E.used.y ? E.js : "(y-" + E.js + ")"; used = Object.assign({}, used, { y: true });
    }
    if (!used.x && !used.y) throw err("err.noxy");
    let F;
    try { F = new Function("x", "y", "k", "a", "return " + js + ";"); } catch (e) { throw err("err.syntax"); }
    return {
      src: String(src), op, kind: op === "=" ? "eq" : "ineq", strict: op === "<" || op === ">",
      F, inside: inside[op] || null, uses: { x: !!used.x, y: !!used.y, k: !!used.k, a: !!used.a },
    };
  }

  // Prova a leggere; non lancia: { ok, rel } oppure { ok: false, error: {code, params} }.
  function tryParse(src) {
    try { return { ok: true, rel: parseRelation(src) }; } catch (e) {
      if (e && e.code) return { ok: false, error: { code: e.code, params: e.params } };
      return { ok: false, error: { code: "err.syntax", params: {} } };
    }
  }


  // Funzione di una sola variabile: compileFn("x^2 - 1", "x") → u ↦ valore (NaN se non definita). Lancia { code, params }.
  function compileFn(src, v) {
    const s = normalize(src).trim();
    if (!s) throw err("err.empty");
    if (splitRelation(s)) throw err("err.rel");
    const { js, used } = compileSide(s);
    for (const w of VARS) if (used[w] && w !== v) throw err("err.var", { v: w });
    let F;
    try { F = new Function("x", "y", "k", "a", "return " + js + ";"); } catch (e) { throw err("err.syntax"); }
    const z = (u) => { try { const r = +(v === "x" ? F(u, 0, 0, 1) : F(0, u, 0, 1)); return Number.isFinite(r) ? r : NaN; } catch (e) { return NaN; } };
    z(0.37);
    return z;
  }
  function tryFn(src, v) {
    try { return { ok: true, fn: compileFn(src, v) }; } catch (e) {
      if (e && e.code) return { ok: false, error: { code: e.code, params: e.params } };
      return { ok: false, error: { code: "err.syntax", params: {} } };
    }
  }

  const api = { compileFn, tryFn, parseRelation, tryParse, normalize, FUNCS: Object.keys(FUNCS) };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Expr = api;
})(typeof window !== "undefined" ? window : globalThis);
