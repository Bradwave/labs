// Units Lab · guidedui.js
// The guided card: a prediction, then three steps, one open at a time. Steps ① and ② are a balance:
// two pans, one token each (×10^k), the beam is level when the exponents cancel.
// Same colour = same step, in the tokens, in the sum and in the result lines.

import { parseUnit, unitLabel } from "./units.js";
import { mantString, expText, fmt, sepOf } from "./format.js";
import { checkConvert, checkNormalize, checkSum, tilt, sumTerms, outcome } from "./guided.js";
import { ladderVisual } from "./visuals.js";
import { t } from "./i18n.js";

const MAX_TRIES = 2;
const sup = (x) => `<sup>${expText(x)}</sup>`;
const pow = (x, cls = "") => `<span class="pw${cls ? " " + cls : ""}">10${sup(x)}</span>`;
const arrow = (dir) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="${dir < 0 ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}"/></svg>`;

function stepper(key, cls, label) {
  return `<span class="stp ${cls}" data-k="${key}" role="group" aria-label="${label}"><button type="button" data-d="-1" aria-label="−1">−</button><output><span>×10<sup>0</sup></span></output><button type="button" data-d="1" aria-label="+1">+</button></span>`;
}

/**
 * host: the answer card. problem/plan from guided.js. onPredict(): the prediction was made.
 * Returns the controller used by main.js: check() → null while steps remain, { status, codes } at the end.
 */
function createGuided(host, { problem, plan, loc, onPredict }) {
  const from = parseUnit(problem.fromUnit);
  const to = parseUnit(problem.toUnit);
  const uFrom = unitLabel(from, true);
  const uTo = unitLabel(to, true);
  const sepCh = sepOf(loc);
  const st = { pred: null, step: 0, tries: 0, mistakes: [], locked: false, u: 0, n: 0, i: plan.i0, q: 0, E: 0, shown: [] };

  const mant = (i) => mantString(plan.digits, i, loc);
  const expr = (m, exps, unit) => `${m}${exps.filter((e) => e.x !== 0).map((e) => ` · ${pow(e.x, e.c)}`).join("")} <span class="u">${unit}</span>`;
  const dataExp = plan.x0 ? [{ x: plan.x0, c: "c0" }] : [];
  const line1 = () => expr(mant(plan.i0), [...dataExp, { x: plan.n, c: "c1" }], uTo);
  const line2 = () => expr(mant(1), [...dataExp, { x: plan.n, c: "c1" }, { x: plan.q, c: "c2" }], uTo);
  const dataHtml = problem.dataForm === "decimal" ? mant(plan.i0) : fmt(problem.data, loc, problem.dataForm, { html: true, i: plan.i0 });
  const finalHtml = () => `${fmt(problem.expected, loc, problem.ask.form, { html: true })} <span class="u">${uTo}</span>`;

  // the prefix ladder helps with step ① when both units are the same base with prefixes
  const ladder = () => {
    if (from.terms.length !== 1 || to.terms.length !== 1) return "";
    const [a, b] = [from.terms[0], to.terms[0]];
    if (a.unit !== b.unit || !a.unit.prefixable || a.pow !== 1 || b.pow !== 1) return "";
    return ladderVisual(a.px.exp, b.px.exp, "");
  };

  host.innerHTML = `
    <div class="gd">
      <div class="gpred">
        <span class="gq">${t("gPredict")}</span>
        <div class="gpo"><button type="button" class="btn" data-pred="pos"><span>10<sup>+</sup> ${t("predPos")}</span></button><button type="button" class="btn" data-pred="neg"><span>10<sup>−</sup> ${t("predNeg")}</span></button></div>
      </div>
      <section class="gs" data-s="1">
        <div class="ghd"><span class="gn c1">1</span><b>${t("gStep1")}</b><span class="gr"></span></div>
        <div class="gbody">
          <div class="bil">
            <div class="beam" aria-hidden="true"></div><div class="piv" aria-hidden="true"></div>
            <div class="pan l"><span class="pl">${dataHtml} <span class="u">${uFrom}</span></span></div>
            <div class="pan r">
              <div class="pr"><small>${uFrom} → ${uTo}</small>${stepper("u", "c1", t("gUnit"))}</div>
              <div class="pr"><small>${t("gNumber")}</small>${stepper("n", "c1", t("gNumber"))}</div>
            </div>
          </div>
          <div class="ghint" aria-live="polite"></div>
        </div>
      </section>
      <section class="gs" data-s="2">
        <div class="ghd"><span class="gn c2">2</span><b>${t("gStep2")}</b><span class="gr"></span></div>
        <div class="gbody">
          <div class="row mant"><button type="button" class="step" data-a="L" aria-label="${t("commaLeft")}">${arrow(-1)}</button><div class="tiles"></div><button type="button" class="step" data-a="R" aria-label="${t("commaRight")}">${arrow(1)}</button></div>
          <div class="bil">
            <div class="beam" aria-hidden="true"></div><div class="piv" aria-hidden="true"></div>
            <div class="pan l"><span class="pl line1"></span></div>
            <div class="pan r">
              <div class="pr"><small>${t("gMant")}</small><span class="tok c2 auto"></span></div>
              <div class="pr"><small>${t("gPow")}</small>${stepper("q", "c2", t("gPow"))}</div>
            </div>
          </div>
          <div class="ghint" aria-live="polite"></div>
        </div>
      </section>
      <section class="gs" data-s="3">
        <div class="ghd"><span class="gn c3">3</span><b>${t("gStep3")}</b><span class="gr"></span></div>
        <div class="gbody">
          <div class="gsum"><span class="terms"></span> = <span class="stp c3 big" data-k="E" role="group" aria-label="${t("gStep3")}"><button type="button" data-d="-1" aria-label="−1">−</button><output><span>10<sup>0</sup></span></output><button type="button" data-d="1" aria-label="+1">+</button></span></div>
          <div class="ghint" aria-live="polite"></div>
        </div>
      </section>
      <div class="gend" hidden></div>
    </div>`;

  const $ = (s) => host.querySelector(s);
  const sec = (k) => host.querySelector(`.gs[data-s="${k}"]`);

  const termsHtml = () => {
    const parts = [];
    if (plan.x0) parts.push(pow(plan.x0, "c0"));
    if (plan.n) parts.push(pow(plan.n, "c1"));
    if (plan.q) parts.push(pow(plan.q, "c2"));
    return parts.join(" · ") || pow(0);
  };

  function setBeam(root, a, b) {
    const d = tilt(a, b);
    const bil = root.querySelector(".bil");
    if (!bil) return;
    bil.style.setProperty("--t", `${(d * 0.55).toFixed(1)}deg`);
    bil.style.setProperty("--dy", `${(d * 0.8).toFixed(1)}px`);
    bil.classList.toggle("level", d === 0 && a !== 0);
  }

  function render() {
    host.querySelector(".gd").classList.toggle("wait", st.pred === null);
    host.querySelectorAll("[data-pred]").forEach((b) => {
      b.classList.toggle("on", b.dataset.pred === st.pred);
      b.disabled = st.pred !== null;
    });
    for (const k of [1, 2, 3]) {
      const s = sec(k);
      s.classList.toggle("open", st.step === k);
      s.classList.toggle("done", st.step > k);
      s.classList.toggle("todo", st.step < k);
    }
    const out = (k, v, times = true) => {
      const o = host.querySelector(`.stp[data-k="${k}"] output`);
      if (o) o.innerHTML = `<span>${times ? "×" : ""}10${sup(v)}</span>`;
    };
    out("n", st.n);
    out("u", st.u);
    out("q", st.q);
    out("E", st.E, false);
    setBeam(sec(1), st.n, st.u);
    // step ②: comma tiles with the ghost of where it started
    const n = plan.digits.length;
    const lo = Math.min(st.i <= 0 ? st.i - 1 : 0, plan.i0 <= 0 ? plan.i0 - 1 : 0);
    const hi = Math.max(n, st.i, plan.i0);
    let h = "";
    for (let j = lo; j <= hi; j++) {
      if (j === st.i) h += `<i class="cm e">${sepCh}</i>`;
      else if (j === plan.i0) h += `<i class="cm s ghost" aria-hidden="true">${sepCh}</i>`;
      if (j === hi) break;
      const isDigit = j >= 0 && j < n;
      h += `<span class="tl${isDigit ? "" : " z"}">${isDigit ? plan.digits[j] : "0"}</span>`;
    }
    $(".tiles").innerHTML = h;
    const s = st.i - plan.i0; // the mantissa is multiplied by 10^s
    $(".tok.auto").innerHTML = `<span>×10${sup(s)}</span>`;
    setBeam(sec(2), s, st.q);
    $(".terms").innerHTML = termsHtml();
    $(".line1").innerHTML = line1();
    // result lines of the finished steps
    sec(1).querySelector(".gr").innerHTML = st.step > 1 ? `= ${line1()}${st.shown.includes(1) ? " <span class=\"ms gsh\" title=\"${t(\"gShown\")}\">visibility</span>" : ""}` : "";
    sec(2).querySelector(".gr").innerHTML = st.step > 2 ? (plan.normalized ? `<span class="gok">${t("gAlready")}</span>` : `= ${line2()}${st.shown.includes(2) ? " <span class=\"ms gsh\" title=\"${t(\"gShown\")}\">visibility</span>" : ""}`) : "";
    sec(3).querySelector(".gr").innerHTML = st.step > 3 ? `= ${pow(plan.E, "c3")}${st.shown.includes(3) ? " <span class=\"ms gsh\" title=\"${t(\"gShown\")}\">visibility</span>" : ""}` : "";
  }

  function hint(k, html) {
    sec(k).querySelector(".ghint").innerHTML = html;
  }

  function advance() {
    st.step++;
    st.tries = 0;
    if (st.step === 2 && plan.normalized) st.step = 3; // already 1 ≤ a < 10: nothing to move
    render();
    const open = sec(st.step);
    if (open) requestAnimationFrame(() => open.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  /** wrong answer on a step: a short hint; after MAX_TRIES the right values are shown and the step closes */
  function miss(k, res, reveal) {
    st.mistakes.push(res.code);
    st.tries++;
    sec(k).classList.remove("shake");
    void sec(k).offsetWidth;
    sec(k).classList.add("shake");
    if (st.tries >= MAX_TRIES) {
      reveal();
      st.shown.push(k);
      hint(k, "");
      advance();
      return;
    }
    let html = "";
    if (res.code === "g_unit") html = `<p>${t("gHintUnit")}</p>${ladder()}`;
    else if (res.code === "g_balance") html = `<p>${t("gHintBalance")}</p>`;
    else if (res.code === "g_comma") html = `<p>${t("gHintComma")}</p>`;
    else if (res.code === "g_sum") html = `<p>${t("gHintSum", sumTerms(plan).map((x, i) => (i ? (x < 0 ? " − " : " + ") + Math.abs(x) : expText(x))).join(""))}</p>`;
    hint(k, html);
    if (res.code === "g_unit") centerLadder(sec(k));
  }

  function centerLadder(root) {
    requestAnimationFrame(() => {
      const s = root.querySelector(".scrollx");
      if (!s) return;
      const marks = [...s.querySelectorAll(".pa, .pb")];
      if (marks.length < 1) return;
      const r = s.getBoundingClientRect();
      const xs = marks.map((m) => m.getBoundingClientRect().left);
      s.scrollLeft += (Math.min(...xs) + Math.max(...xs)) / 2 - (r.left + r.width / 2);
    });
  }

  function check() {
    if (st.locked || st.pred === null) return null;
    if (st.step === 1) {
      const res = checkConvert(plan, st.u, st.n);
      if (res.ok) {
        hint(1, "");
        advance();
      } else
        miss(1, res, () => {
          st.u = plan.unit;
          st.n = plan.n;
        });
      return null;
    }
    if (st.step === 2) {
      const res = checkNormalize(plan, st.i, st.q);
      if (res.ok) {
        hint(2, "");
        advance();
      } else
        miss(2, res, () => {
          st.i = 1;
          st.q = plan.q;
        });
      return null;
    }
    if (st.step === 3) {
      const res = checkSum(plan, st.E);
      if (res.ok) {
        hint(3, "");
        advance();
      } else {
        miss(3, res, () => {
          st.E = plan.E;
        });
        if (st.step === 3) return null;
      }
      return finish();
    }
    return null;
  }

  function finish() {
    const good = st.pred === plan.sign;
    const end = $(".gend");
    end.hidden = false;
    end.innerHTML = `<div class="gfin">${finalHtml()}</div><div class="gpv ${good ? "ok" : "no"}">${t("gPredWas")} 10<sup>${st.pred === "pos" ? "+" : "−"}</sup> ${good ? "✓" : "✗"}</div>`;
    st.locked = true;
    host.classList.add("done");
    return outcome(st.mistakes);
  }

  host.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-pred]");
    if (pb && st.pred === null) {
      st.pred = pb.dataset.pred;
      st.step = 1;
      render();
      onPredict?.();
      return;
    }
    if (st.locked || st.step === 0) return;
    const b = e.target.closest("button[data-d]");
    if (b) {
      const k = b.closest(".stp").dataset.k;
      const allowed = { 1: ["n", "u"], 2: ["q"], 3: ["E"] }[st.step] ?? [];
      if (!allowed.includes(k)) return;
      st[k] = Math.max(-30, Math.min(30, st[k] + +b.dataset.d));
      render();
      return;
    }
    const a = e.target.closest("button[data-a]");
    if (a && st.step === 2) {
      st.i = a.dataset.a === "L" ? Math.max(-8, st.i - 1) : Math.min(plan.digits.length + 10, st.i + 1);
      render();
    }
  });

  const onKey = (e) => {
    if (st.locked || st.step !== 2 || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "ArrowLeft") st.i = Math.max(-8, st.i - 1);
    else if (e.key === "ArrowRight") st.i = Math.min(plan.digits.length + 10, st.i + 1);
    else return false;
    e.preventDefault();
    render();
    return true;
  };

  render();
  return {
    el: host,
    kind: "guided",
    getValue: () => fmt(problem.expected, loc, problem.ask.form),
    isEmpty: () => false,
    isPredicted: () => st.pred !== null,
    setLocked(v) {
      if (v) st.locked = true;
      host.classList.toggle("locked", v);
    },
    onKey,
    check,
  };
}

export { createGuided };
