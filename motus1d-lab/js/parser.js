/* Expression parser (no eval).
   Differences: τ is a variable (local time), not 2π; names may carry digits or subscripts (v0, s₁). */
import { T } from './i18n.js';

const FN1 = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, step: x => (x >= 0 ? 1 : 0)
};
const FNN = {
  mod: [2, 2, (a, b) => a - b * Math.floor(a / b)], pow: [2, 2, Math.pow],
  min: [1, 9, Math.min], max: [1, 9, Math.max], if: [3, 3, (c, a, b) => (c ? a : b)]
};
const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E };
const isFn = n => n in FN1 || n in FNN;
const KNOWN = [...Object.keys(FN1), ...Object.keys(FNN), 'pi', 'tau'].sort((a, b) => b.length - a.length);
const LET = /[A-Za-zͰ-Ͽ]/;
const DIG = /[0-9₀-₉]/;
const SUB = '₀₁₂₃₄₅₆₇₈₉';

export class ExprError extends Error {}
const bad = (k, ...a) => new ExprError(T(k, ...a));

/* "v0" and "v₀" are the same name; the canonical form uses plain digits */
export const canon = n => n.replace(/[₀-₉]/g, c => String(SUB.indexOf(c)));
export const pretty = n => n.replace(/[0-9]/g, c => SUB[+c]);

function tokenize(src) {
  const s = src
    .replace(/[−–—]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/')
    .replace(/\*\*/g, '^').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt ')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/½/g, '(1/2)');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw bad('pe_dot');
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (LET.test(c)) {
      let j = i;
      while (j < s.length && LET.test(s[j])) j++;
      const run = s.slice(i, j);
      const parts = [];
      let k = 0;
      while (k < run.length) {
        const hit = KNOWN.find(n => run.startsWith(n, k));
        if (hit) { parts.push(hit); k += hit.length; } else { parts.push(run[k]); k++; }
      }
      // trailing digits stick to a final single-letter name: v0, s1, t₁
      let d = j;
      while (d < s.length && DIG.test(s[d])) d++;
      if (d > j && parts.length && parts[parts.length - 1].length === 1) {
        parts[parts.length - 1] += canon(s.slice(j, d));
        j = d;
      }
      for (const p of parts) out.push({ t: 'id', n: p === 'tau' ? 'τ' : p });
      i = j;
      continue;
    }
    if (c === '°') { out.push({ t: 'deg' }); i++; continue; }
    const two = s.substr(i, 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^(),<>!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw bad('pe_char', c);
  }
  return out;
}

function parse(src) {
  const tk = tokenize(src);
  if (!tk.length) throw bad('pe_empty');
  let i = 0;
  const isOp = o => tk[i] && tk[i].t === 'op' && tk[i].v === o;
  const desc = t => (!t ? T('pe_end') : t.t === 'num' ? String(t.v) : t.t === 'id' ? t.n : t.t === 'deg' ? '°' : t.v);
  const expect = c => { if (!isOp(c)) throw (c === ')' ? bad('pe_paren') : bad('pe_expect', c, desc(tk[i]))); i++; };
  const startsPrimary = t => t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('));

  function parseOr() { let a = parseAnd(); while (isOp('||')) { i++; a = { k: 'bin', op: '||', a, b: parseAnd() }; } return a; }
  function parseAnd() { let a = parseCmp(); while (isOp('&&')) { i++; a = { k: 'bin', op: '&&', a, b: parseCmp() }; } return a; }
  function parseCmp() {
    let a = parseAdd();
    while (tk[i] && tk[i].t === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(tk[i].v)) {
      const op = tk[i++].v;
      a = { k: 'bin', op, a, b: parseAdd() };
    }
    return a;
  }
  function parseAdd() {
    let a = parseMul();
    while (isOp('+') || isOp('-')) { const op = tk[i++].v; a = { k: 'bin', op, a, b: parseMul() }; }
    return a;
  }
  function parseMul() {
    let a = parseUnary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = tk[i++].v; a = { k: 'bin', op, a, b: parseUnary() }; }
      else if (startsPrimary(tk[i])) a = { k: 'bin', op: '*', a, b: parsePow() };
      else break;
    }
    return a;
  }
  function parseUnary() {
    if (isOp('-')) { i++; return { k: 'neg', a: parseUnary() }; }
    if (isOp('+')) { i++; return parseUnary(); }
    if (isOp('!')) { i++; return { k: 'not', a: parseUnary() }; }
    return parsePow();
  }
  function parsePow() {
    const a = parsePostfix();
    if (isOp('^')) { i++; return { k: 'bin', op: '^', a, b: parseUnary() }; }
    return a;
  }
  function parsePostfix() {
    let a = parsePrimary();
    while (tk[i] && tk[i].t === 'deg') { i++; a = { k: 'bin', op: '*', a, b: { k: 'num', v: Math.PI / 180 } }; }
    return a;
  }
  function parseChain() {
    if (isOp('-')) { i++; return { k: 'neg', a: parseChain() }; }
    let a = parsePow();
    while (tk[i] && (tk[i].t === 'num' || (tk[i].t === 'id' && !isFn(tk[i].n)) || (tk[i].t === 'op' && tk[i].v === '(')))
      a = { k: 'bin', op: '*', a, b: parsePow() };
    return a;
  }
  function parsePrimary() {
    const t = tk[i++];
    if (!t) throw bad('pe_early');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = parseOr(); expect(')'); return e; }
    if (t.t === 'id') {
      const n = t.n;
      if (isFn(n)) {
        let args = [];
        if (isOp('(')) {
          i++;
          if (!isOp(')')) { args.push(parseOr()); while (isOp(',')) { i++; args.push(parseOr()); } }
          expect(')');
        } else {
          if (!tk[i]) throw bad('pe_arg', n);
          args = [parseChain()];
        }
        const [lo, hi] = n in FN1 ? [1, 1] : [FNN[n][0], FNN[n][1]];
        if (args.length < lo || args.length > hi) throw bad('pe_nargs', n, lo === hi ? lo : lo + '+');
        return { k: 'call', f: n, args };
      }
      if (n in CONST) return { k: 'num', v: CONST[n] };
      return { k: 'var', n };
    }
    throw bad('pe_unexp', desc(t));
  }

  const ast = parseOr();
  if (i < tk.length) throw bad('pe_unexp', desc(tk[i]));
  return ast;
}

function compile(n) {
  switch (n.k) {
    case 'num': { const v = n.v; return () => v; }
    case 'var': { const k = n.n; return E => E[k]; }
    case 'neg': { const a = compile(n.a); return E => -a(E); }
    case 'not': { const a = compile(n.a); return E => (a(E) ? 0 : 1); }
    case 'bin': {
      const a = compile(n.a), b = compile(n.b);
      switch (n.op) {
        case '+': return E => a(E) + b(E);
        case '-': return E => a(E) - b(E);
        case '*': return E => a(E) * b(E);
        case '/': return E => a(E) / b(E);
        case '^': return E => Math.pow(a(E), b(E));
        case '<': return E => (a(E) < b(E) ? 1 : 0);
        case '>': return E => (a(E) > b(E) ? 1 : 0);
        case '<=': return E => (a(E) <= b(E) ? 1 : 0);
        case '>=': return E => (a(E) >= b(E) ? 1 : 0);
        case '==': return E => (a(E) === b(E) ? 1 : 0);
        case '!=': return E => (a(E) !== b(E) ? 1 : 0);
        case '&&': return E => (a(E) && b(E) ? 1 : 0);
        default: return E => (a(E) || b(E) ? 1 : 0);
      }
    }
    default: {
      const args = n.args.map(compile);
      if (n.f in FN1) { const g = FN1[n.f], a = args[0]; return E => g(a(E)); }
      const g = FNN[n.f][2];
      if (args.length === 2) { const [a, b] = args; return E => g(a(E), b(E)); }
      if (args.length === 3) { const [a, b, c] = args; return E => g(a(E), b(E), c(E)); }
      return E => g(...args.map(f => f(E)));
    }
  }
}
function collect(n, set) {
  if (n.k === 'var') set.add(n.n);
  else if (n.k === 'bin') { collect(n.a, set); collect(n.b, set); }
  else if (n.k === 'neg' || n.k === 'not') collect(n.a, set);
  else if (n.k === 'call') n.args.forEach(a => collect(a, set));
}

/* returns { fn, vars, err } */
export function compileExpr(src) {
  try {
    const ast = parse(String(src ?? ''));
    const vars = new Set();
    collect(ast, vars);
    return { fn: compile(ast), vars: [...vars], err: null };
  } catch (e) {
    if (e instanceof ExprError) return { fn: null, vars: [], err: e.message };
    throw e;
  }
}
