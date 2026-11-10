// Series Lab · expr.js
// Parser and evaluator for complex expressions in n and z (pure module, no DOM). Complex numbers are [re, im].
// compile("z^n/fact(n)") → { fn(n, z) → [re, im], names }. Errors are thrown as ExprError { code, params }.

export class ExprError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

// ---------- complex arithmetic ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function div(a, b) {
  if (b[1] === 0) return [a[0] / b[0], a[1] / b[0]];
  // Smith's algorithm: no spurious overflow
  if (Math.abs(b[0]) >= Math.abs(b[1])) {
    const r = b[1] / b[0],
      d = b[0] + b[1] * r;
    return [(a[0] + a[1] * r) / d, (a[1] - a[0] * r) / d];
  }
  const r = b[0] / b[1],
    d = b[0] * r + b[1];
  return [(a[0] * r + a[1]) / d, (a[1] * r - a[0]) / d];
}
const abs = (a) => Math.hypot(a[0], a[1]);
const exp = (a) => {
  const m = Math.exp(a[0]);
  return a[1] === 0 ? [m, 0] : [m * Math.cos(a[1]), m * Math.sin(a[1])];
};
const ln = (a) => [Math.log(abs(a)), Math.atan2(a[1], a[0])];
const sqrt = (a) => {
  if (a[1] === 0) return a[0] >= 0 ? [Math.sqrt(a[0]), 0] : [0, Math.sqrt(-a[0])];
  const m = abs(a),
    re = Math.sqrt((m + a[0]) / 2),
    im = Math.sqrt((m - a[0]) / 2);
  return [re, a[1] < 0 ? -im : im];
};
const sin = (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];
const cos = (a) => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])];
const sinh = (a) => [Math.sinh(a[0]) * Math.cos(a[1]), Math.cosh(a[0]) * Math.sin(a[1])];
const cosh = (a) => [Math.cosh(a[0]) * Math.cos(a[1]), Math.sinh(a[0]) * Math.sin(a[1])];

function pow(a, b) {
  if (b[1] === 0) {
    const k = b[0];
    if (a[1] === 0 && (a[0] > 0 || Number.isInteger(k))) return [Math.pow(a[0], k), 0];
    if (Number.isInteger(k) && Math.abs(k) <= 4096) {
      // binary exponentiation: (−1)^n and i^n come out exact
      let r = [1, 0],
        base = a,
        e = Math.abs(k);
      while (e > 0) {
        if (e & 1) r = mul(r, base);
        base = mul(base, base);
        e = Math.floor(e / 2);
      }
      return k < 0 ? div([1, 0], r) : r;
    }
  }
  if (a[0] === 0 && a[1] === 0) return b[0] > 0 ? [0, 0] : b[0] === 0 && b[1] === 0 ? [1, 0] : [NaN, NaN];
  return exp(mul(b, ln(a)));
}

const FACT = [1];
for (let k = 1; k <= 170; k++) FACT[k] = FACT[k - 1] * k;
function fact(a) {
  if (a[1] !== 0 || a[0] < 0 || !Number.isInteger(a[0])) return [NaN, NaN];
  return [a[0] > 170 ? Infinity : FACT[a[0]], 0];
}

const FUNCS = {
  exp,
  ln,
  log: ln,
  sin,
  cos,
  tan: (a) => div(sin(a), cos(a)),
  sinh,
  cosh,
  tanh: (a) => div(sinh(a), cosh(a)),
  sqrt,
  abs: (a) => [abs(a), 0],
  re: (a) => [a[0], 0],
  im: (a) => [a[1], 0],
  conj: (a) => [a[0], -a[1]],
  arg: (a) => [Math.atan2(a[1], a[0]), 0],
  fact,
};
const CONSTS = { i: [0, 1], pi: [Math.PI, 0], π: [Math.PI, 0], e: [Math.E, 0] };
const VARS = new Set(["n", "z"]);
export const FUNCTION_NAMES = Object.keys(FUNCS);

// ---------- tokens ----------
function tokenize(src) {
  const s = String(src).replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/[[{]/g, "(").replace(/[\]}]/g, ")");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    let m;
    if ((m = /^(\d+([.,]\d+)?|[.,]\d+)(e[+-]?\d+)?/i.exec(s.slice(i)))) {
      out.push({ k: "num", v: Number(m[0].replace(",", ".")), pos: i });
      i += m[0].length;
    } else if ((m = /^[A-Za-zπ_][A-Za-z0-9π_]*/.exec(s.slice(i)))) {
      out.push({ k: "id", v: m[0], pos: i });
      i += m[0].length;
    } else if (s.startsWith("**", i)) {
      out.push({ k: "op", v: "^", pos: i });
      i += 2;
    } else if ("+-*/^()!".includes(c)) {
      out.push({ k: "op", v: c, pos: i });
      i++;
    } else throw new ExprError("char", { ch: c, pos: i + 1 });
  }
  return out;
}

// ---------- parser: builds closures (ctx) → complex ----------
export function compile(src) {
  const toks = tokenize(src);
  if (!toks.length) throw new ExprError("empty");
  const names = new Set();
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => toks[p] && toks[p].k === "op" && toks[p].v === v;
  const expect = (v) => {
    if (!isOp(v)) throw new ExprError(toks[p] ? "expected" : "unexpectedEnd", { what: v, ch: toks[p]?.v });
    p++;
  };

  function expr() {
    let l = term();
    while (isOp("+") || isOp("-")) {
      const minus = toks[p++].v === "-",
        a = l,
        b = term();
      l = minus ? (c) => sub(a(c), b(c)) : (c) => add(a(c), b(c));
    }
    return l;
  }
  const startsOperand = () => {
    const t = peek();
    return t && (t.k === "num" || t.k === "id" || (t.k === "op" && t.v === "("));
  };
  function term() {
    let l = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const slash = toks[p++].v === "/",
          a = l,
          b = unary();
        l = slash ? (c) => div(a(c), b(c)) : (c) => mul(a(c), b(c));
      } else if (startsOperand()) {
        // implicit product: 2n, 3i, n(n+1), (1+i)(1−i)
        const a = l,
          b = unary();
        l = (c) => mul(a(c), b(c));
      } else return l;
    }
  }
  function unary() {
    if (isOp("-")) {
      p++;
      const a = unary();
      return (c) => [-a(c)[0], -a(c)[1]];
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp("^")) {
      p++;
      const a = base,
        b = unary(); // right associative, and 2^-n works
      return (c) => pow(a(c), b(c));
    }
    return base;
  }
  function postfix() {
    let a = atom();
    while (isOp("!")) {
      p++;
      const f = a;
      a = (c) => fact(f(c));
    }
    return a;
  }
  function atom() {
    const t = peek();
    if (!t) throw new ExprError("unexpectedEnd");
    if (t.k === "num") {
      p++;
      const v = [t.v, 0];
      return () => v;
    }
    if (t.k === "id") {
      p++;
      const name = t.v;
      const low = name.toLowerCase();
      if (FUNCS[low] && !VARS.has(name)) {
        if (!isOp("(")) throw new ExprError("needParens", { name });
        p++;
        const arg = expr();
        expect(")");
        const f = FUNCS[low];
        return (c) => f(arg(c));
      }
      if (VARS.has(name)) {
        names.add(name);
        return name === "n" ? (c) => [c.n, 0] : (c) => c.z;
      }
      if (CONSTS[name] || CONSTS[low]) {
        const v = CONSTS[name] || CONSTS[low];
        return () => v;
      }
      throw new ExprError("unknown", { name });
    }
    if (isOp("(")) {
      p++;
      const a = expr();
      expect(")");
      return a;
    }
    throw new ExprError("unexpected", { ch: t.v, pos: t.pos + 1 });
  }

  const root = expr();
  if (p < toks.length) throw new ExprError("unexpected", { ch: toks[p].v, pos: toks[p].pos + 1 });
  const ctx = { n: 0, z: [0, 0] };
  return {
    names,
    fn(n, z) {
      ctx.n = n;
      ctx.z = z;
      return root(ctx);
    },
  };
}
