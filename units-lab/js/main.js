// Units Lab · main.js
// Entry point: screens, the question flow, feedback, statistics dialog, theme and language.

import { S, TOP, load, save, resetAll, climb, newMountain, record, accuracy, topErrors, adapt, exportData, readParams } from "./state.js";
import { t, setLang, getLang, applyI18n } from "./i18n.js";
import { generate } from "./generator.js";
import { check } from "./checker.js";
import { fmt } from "./format.js";
import { mk, mulRatio, sciExp } from "./decimal.js";
import { parseUnit, unitLabel, ratio } from "./units.js";
import { visualsFor, commaPlan, figuresHtml, ladderVisual } from "./visuals.js";
import { createFree, createWidget } from "./input.js";
import { mountainSvg, moveClimber } from "./climb.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PARAMS = readParams(location.search);
const MODULES = [1, 2, 3, 4, 5, 6, 7];
const MIXED_N = 12;

const G = { mode: "module", module: 1, problem: null, ctl: null, answered: false, hinted: false, predicted: true, recent: [], counter: 0, mixed: null, picks: [] };

// ---------- helpers ----------

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

const loc = () => getLang();
const level = () => PARAMS.level ?? S.settings.level;
const maxTier = () => PARAMS.tier ?? (level() === 1 ? 2 : 3);
const isPick = (p) => p.kind === "order" || p.kind === "intruder" || p.choice === true;
const moduleName = (m) => (m === "mixed" ? t("mixed") : t(`m${m}`));

function nextSeed() {
  G.counter++;
  return PARAMS.seed !== null ? PARAMS.seed + G.counter : Math.floor(Math.random() * 2 ** 31);
}

function applyTheme() {
  const th = S.settings.theme;
  if (th === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", th);
}

// ---------- home ----------

function renderHome() {
  $("#homeMount").innerHTML = mountainSvg(S.mountain.alt, S.mountain.summits);
  $("#homeAlt").textContent = t("altitude", S.mountain.alt, TOP);
  const lv = level();
  const locked = PARAMS.level !== null;
  $("#lvlLock").hidden = !locked;
  $$("#lvlSeg button").forEach((b) => {
    b.classList.toggle("on", +b.dataset.lv === lv);
    b.disabled = locked;
  });
  $("#lvlDesc").textContent = t(`l${lv}d`);
  const mods = (PARAMS.modules ?? MODULES).filter((m) => MODULES.includes(m));
  const acc = (m) => {
    const a = accuracy(m);
    return a === null ? "" : `<span class="acc">${Math.round(a * 100)}%</span>`;
  };
  $("#mods").innerHTML =
    mods
      .map((m) => `<button type="button" class="mod m${m}" data-m="${m}"><span class="num">${m}</span><span class="tx"><b>${t(`m${m}`)}</b><small>${t(`m${m}d`)}</small></span>${acc(m)}</button>`)
      .join("") +
    `<button type="button" class="mod mx" data-m="mixed"><span class="num">★</span><span class="tx"><b>${t("mixed")}</b><small>${t("mixedd")}</small></span></button>`;
}

function showScreen(name) {
  $("#home").hidden = name !== "home";
  $("#play").hidden = name !== "play";
  window.scrollTo(0, 0);
}

// ---------- session ----------

function startSession(m) {
  G.mode = m === "mixed" ? "mixed" : "module";
  G.module = m === "mixed" ? 0 : m;
  G.recent = [];
  G.mixed = m === "mixed" ? { i: 0, ok: 0, part: 0, wrong: 0, errors: {} } : null;
  newMountain();
  showScreen("play");
  nextQuestion();
}

function pickModule() {
  if (G.mode === "module") return G.module;
  const pool = (PARAMS.modules ?? MODULES).filter((m) => MODULES.includes(m));
  return pool[Math.floor(Math.random() * pool.length)];
}

function nextQuestion() {
  const m = pickModule();
  const opts = { maxTier: maxTier(), avoid: G.recent };
  G.problem = generate(m, nextSeed(), opts);
  if (G.problem.ctx) {
    G.recent.push(G.problem.ctx);
    if (G.recent.length > 8) G.recent.shift();
  }
  G.answered = false;
  G.hinted = false;
  renderQuestion();
}

// ---------- the question ----------

function numberHtml(p) {
  return fmt(p.data, loc(), p.dataForm, { html: true, i: p.dataI ?? 1 });
}

function renderQuestion() {
  const p = G.problem;
  const lv = level();
  const hintOk = lv === 3 && G.mode !== "mixed" && !isPick(p);
  $("#pTitle").textContent = G.mode === "mixed" ? `${moduleName("mixed")} ${G.mixed.i + 1}/${MIXED_N}` : moduleName(p.module);
  $("#pLevel").textContent = t(`l${lv}`);
  $("#pMount").innerHTML = G.mode === "mixed" ? "" : mountainSvg(S.mountain.alt, S.mountain.summits);
  $("#qCtx").innerHTML = p.text ? `<span class="tag">${t("contextLabel")}</span> ${p.text}` : "";
  $("#qCtx").hidden = !p.text;
  $("#fb").hidden = true;
  $("#sol").hidden = true;
  $("#assist").hidden = true;
  $("#assist").innerHTML = "";
  $("#pred").hidden = true;
  $("#btnCheck").hidden = false;
  $("#btnNext").hidden = true;
  $("#btnHint").hidden = !hintOk;

  if (isPick(p)) renderCompareQuestion(p);
  else if (p.kind === "prefix") renderTypedQuestion(p, lv);
  else if (p.kind === "oom") renderTypedQuestion(p, lv);
  else renderNumberQuestion(p, lv);
  applyI18n($("#play"));
}

function askLines(p) {
  if (p.kind === "notation") {
    const f = p.ask.form;
    if (p.variant === "format") return [t(`ask_format_${f}`), ""];
    if (p.variant === "toDecimal") return [t("ask_decimal"), ""];
    return [p.variant === "normalize" ? t("ask_normalize") : "", t(`ask_${f}`)];
  }
  return [t("ask_convert", unitLabel(parseUnit(p.toUnit), true)), t(`ask_${p.ask.form}`)];
}

function renderNumberQuestion(p, lv) {
  const unit = p.fromUnit ? ` <span class="u">${unitLabel(parseUnit(p.fromUnit), true)}</span>` : "";
  $("#qStmt").innerHTML = `<span class="num">${numberHtml(p)}</span>${unit}`;
  const [a1, a2] = askLines(p);
  $("#qAsk").innerHTML = a1;
  $("#qAsk2").innerHTML = a2;
  $("#qSf").textContent = lv < 3 && p.kind === "convert" ? (p.data.sf === 1 ? t("sfLine1") : t("sfLine", p.data.sf)) : "";

  // answer area: widget (L1, L2) when the digits do not change, keypad otherwise
  const plan = commaPlan(p);
  const useWidget = lv <= 2 && plan && p.variant !== "format";
  const host = $("#answer");
  host.className = "card answer";
  const common = { loc: loc(), form: p.ask.form, onChange: () => {}, onSubmit: onCheck };
  G.ctl = useWidget ? createWidget(host, { ...common, plan, problem: p, level: lv }) : createFree(host, common);
  host.classList.add(useWidget ? "is-widget" : "is-free");

  // level 1: prediction first, then the visual aids for modules 2-4
  G.predicted = true;
  if (lv === 1) {
    const pr = buildPrediction(p);
    if (pr) {
      G.predicted = false;
      showPrediction(pr);
    }
    const aids = G.mode === "mixed" ? [] : assistFor(p);
    if (aids.length) {
      $("#assist").hidden = false;
      $("#assist").innerHTML = aids.map((h) => `<div class="card aid">${h}</div>`).join("");
      centerScrollers($("#assist"));
    }
  }
  gate();
}

/** the visuals offered before answering (level 1): they help, they never print the answer */
function assistFor(p) {
  if (p.kind === "prefix") return [ladderVisual(null, null, t("ladCap"))];
  if (p.kind === "oom") return [];
  return visualsFor(p, loc(), { assist: true })
    .filter((h) => !h.includes('class="vis comma"'))
    .slice(0, 2);
}

const unitHtml = (spec) => unitLabel(parseUnit(spec), true);
const pxUnit = (sym, base) => `${sym}${base}`;

/** statement of the prefix and order-of-magnitude exercises */
function typedStatement(p) {
  const L = loc();
  if (p.kind === "prefix") {
    if (p.variant === "toPower") return `<span class="num">1 ${pxUnit(p.px, p.base)} = 10<sup>?</sup> ${p.base}</span>`;
    if (p.variant === "diff") return `<span class="num">1 ${pxUnit(p.a, p.base)} = 10<sup>?</sup> ${pxUnit(p.b, p.base)}</span>`;
    if (p.variant === "toPrefix") return `<span class="num">10<sup>${expTxt(p.exp)}</sup> = ? ${p.base}</span>`;
    if (p.variant === "swapBack") return `<span class="num">${fmt(p.data, L, "times", { html: true })} <span class="u">${p.base}</span></span>`;
    return `<span class="num">${fmt(p.data, L, "decimal")}</span> <span class="u">${pxUnit(p.px, p.base)}</span>`;
  }
  const num = (d, form) => fmt(d, L, form, { html: true, i: 1 });
  if (p.variant === "ratio") return `<div class="two"><span class="num">A = ${num(p.data, p.dataForm)}</span> <span class="u">${unitHtml(p.unit)}</span></div><div class="two"><span class="num">B = ${num(p.dataB, p.dataFormB)}</span> <span class="u">${unitHtml(p.unit)}</span></div>`;
  return `<span class="num">${num(p.data, p.dataForm)}</span>${p.unit ? ` <span class="u">${unitHtml(p.unit)}</span>` : ""}`;
}
const expTxt = (x) => (x < 0 ? "−" : "") + Math.abs(x);

function typedAsk(p) {
  if (p.kind === "oom") {
    if (p.variant === "inUnit") return [t("askOomIn", unitHtml(p.toUnit)), ""];
    if (p.variant === "ratio") return [t("askOomRatio"), ""];
    return [t("askOom"), ""];
  }
  if (p.variant === "toPower" || p.variant === "diff") return [t("askPower"), ""];
  if (p.variant === "toPrefix") return [t("askPrefix"), ""];
  if (p.variant === "swapBack") return [t("askSwapBack"), ""];
  return [t("askSubstitute"), t(p.ask.form === "e" ? "fmtE" : "fmtTimes")];
}

function renderTypedQuestion(p, lv) {
  $("#qStmt").innerHTML = typedStatement(p);
  const [a1, a2] = typedAsk(p);
  $("#qAsk").innerHTML = a1;
  $("#qAsk2").innerHTML = a2;
  $("#qSf").innerHTML = p.kind === "oom" && lv < 3 ? t("oomRule") : "";
  if (p.kind === "prefix" && (p.variant === "toPower" || p.variant === "diff") && p.px) {
    $("#qCtx").hidden = false;
    $("#qCtx").innerHTML = `<span class="tag">${t("pxLabel")}</span> ${t(`px_${p.px}`)}`;
  }
  const host = $("#answer");
  host.className = "card answer is-free";
  G.ctl = createFree(host, { loc: loc(), form: p.ask.form, onChange: () => {}, onSubmit: onCheck });
  G.predicted = true;
  if (lv === 1) {
    const pr = buildPrediction(p);
    if (pr) {
      G.predicted = false;
      showPrediction(pr);
    }
    const aids = G.mode === "mixed" ? [] : assistFor(p);
    if (aids.length) {
      $("#assist").hidden = false;
      $("#assist").innerHTML = aids.map((h) => `<div class="card aid">${h}</div>`).join("");
      centerScrollers($("#assist"));
    }
  }
  gate();
}

function choiceLabel(p, i) {
  const L = loc();
  if (p.variant === "toPrefix") return `${p.items[i]} · ${t(`px_${p.items[i]}`)}`;
  return `${fmt(p.mant, L, "decimal")} ${pxUnit(p.items[i], p.base)}`;
}

function gate() {
  $("#answer").classList.toggle("gated", !G.predicted);
  G.ctl.setLocked(!G.predicted || G.answered);
}

// ---------- prediction (level 1) ----------

function buildPrediction(p) {
  if (p.kind === "convert") {
    const r = ratio(parseUnit(p.fromUnit), parseUnit(p.toUnit));
    const bigger = r.p >= 0 ? r.n * 10n ** BigInt(r.p) > r.d : r.n > r.d * 10n ** BigInt(-r.p);
    return {
      q: t("predConv", unitLabel(parseUnit(p.fromUnit), true), unitLabel(parseUnit(p.toUnit), true)),
      opts: [["big", t("predBigger")], ["small", t("predSmaller")]],
      right: bigger ? "big" : "small",
      ok: bigger ? t("predConvBig") : t("predConvSmall"),
      no: t("predConvNo"),
    };
  }
  if (p.kind === "prefix") {
    if (p.variant === "toPower") {
      const pos = p.exp > 0;
      return { q: t("predPowSign"), opts: [["pos", t("predPos")], ["neg", t("predNeg")]], right: pos ? "pos" : "neg", ok: t(pos ? "predPowPos" : "predPowNeg"), no: t("predPowNo") };
    }
    if (p.variant === "diff") {
      const big = p.exp > 0;
      return { q: t("predDiffSign"), opts: [["big", t("predBigger")], ["small", t("predSmaller")]], right: big ? "big" : "small", ok: t(big ? "predConvBig" : "predConvSmall"), no: t("predConvNo") };
    }
    return null;
  }
  if (p.kind === "oom") {
    if (p.variant !== "direct" && p.variant !== "edge") return null;
    return { q: t("predOom"), opts: [["less", t("predOomLess")], ["more", t("predOomMore")]], right: p.oom.up ? "more" : "less", ok: t(p.oom.up ? "predOomYesMore" : "predOomYesLess"), no: t("predOomNo") };
  }
  if (p.kind !== "notation" || p.variant === "format") return null;
  const X = sciExp(p.data);
  if (p.variant === "toSci") {
    return { q: t("predExp"), opts: [["pos", t("predPos")], ["neg", t("predNeg")]], right: X > 0 ? "pos" : "neg", ok: X > 0 ? t("predExpPos") : t("predExpNeg"), no: t("predExpNo") };
  }
  if (p.variant === "toDecimal") {
    return { q: t("predDec"), opts: [["big", t("predBigger")], ["small", t("predSmaller")]], right: X > 0 ? "big" : "small", ok: X > 0 ? t("predConvBig") : t("predConvSmall"), no: t("predExpNo") };
  }
  const left = (p.dataI ?? 1) > 1;
  return { q: t("predNorm"), opts: [["l", t("predLeft")], ["r", t("predRight")]], right: left ? "l" : "r", ok: left ? t("predNormLeft") : t("predNormRight"), no: t("predNormNo") };
}

function showPrediction(pr) {
  const el = $("#pred");
  el.hidden = false;
  el.innerHTML = `<div class="ptt">${t("predTitle")}</div><div class="pq">${pr.q}</div><div class="popts">${pr.opts.map(([k, l]) => `<button type="button" class="btn" data-p="${k}">${l}</button>`).join("")}</div><div class="pans" aria-live="polite"></div>`;
  el.onclick = (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b || G.predicted) return;
    G.predicted = true;
    const good = b.dataset.p === pr.right;
    b.classList.add(good ? "good" : "bad");
    $(".pans", el).innerHTML = good ? pr.ok : pr.no;
    gate();
  };
}

// ---------- module 5 ----------

function renderCompareQuestion(p) {
  $("#qStmt").innerHTML = p.choice ? typedStatement(p) : "";
  $("#qSf").textContent = "";
  $("#qAsk2").innerHTML = "";
  G.predicted = true;
  const host = $("#answer");
  host.className = "card answer is-compare";
  const chip = (it, i) => `<button type="button" class="chip-m" data-i="${i}"><span class="n"></span><span class="v">${p.choice ? choiceLabel(p, i) : `${fmt(it.dec, loc(), it.form ?? "decimal", { html: true })} ${unitLabel(parseUnit(it.unit), true)}`}</span></button>`;
  if (p.choice) {
    $("#qAsk").innerHTML = typedAsk(p)[0];
    host.innerHTML = `<div class="chips">${p.items.map(chip).join("")}</div>`;
    G.picks = [];
  } else if (p.kind === "order") {
    $("#qAsk").textContent = t(p.dir === "asc" ? "ordAsc" : "ordDesc");
    host.innerHTML = `<div class="hintline">${t("ordTap")}</div><div class="chips">${p.items.map(chip).join("")}</div><button class="btn small" type="button" id="btnOrdReset"><span class="ms">undo</span>${t("ordReset")}</button>`;
    G.picks = [];
  } else {
    $("#qAsk").textContent = t("intAsk");
    host.innerHTML = `<div class="chips">${p.items.map(chip).join("")}</div>`;
    G.picks = [];
  }
  host.onclick = (e) => {
    if (G.answered) return;
    const b = e.target.closest(".chip-m");
    if (b) {
      const i = +b.dataset.i;
      if (p.kind === "order") {
        const at = G.picks.indexOf(i);
        if (at >= 0) G.picks.splice(at, 1);
        else if (G.picks.length < p.items.length) G.picks.push(i);
      } else G.picks = [i];
      $$(".chip-m", host).forEach((c) => {
        const rank = G.picks.indexOf(+c.dataset.i);
        c.classList.toggle("sel", rank >= 0);
        $(".n", c).textContent = rank >= 0 && p.kind === "order" ? rank + 1 : "";
      });
    } else if (e.target.closest("#btnOrdReset")) {
      G.picks = [];
      $$(".chip-m", host).forEach((c) => {
        c.classList.remove("sel");
        $(".n", c).textContent = "";
      });
    }
  };
  G.ctl = { kind: "compare", getValue: () => "", isEmpty: () => (p.kind === "order" ? G.picks.length < p.items.length : G.picks.length < 1), setLocked() {}, onKey: () => false };
}

// ---------- checking ----------

function onCheck() {
  if (G.answered || !G.predicted) return;
  const p = G.problem;
  let res;
  if (isPick(p)) {
    if (G.ctl.isEmpty()) return;
    const good = p.kind === "order" ? G.picks.every((v, i) => v === p.answer[i]) : G.picks[0] === p.answer;
    res = { status: good ? "correct" : "wrong", codes: [] };
  } else {
    if (G.ctl.isEmpty()) return toast(t("inv_empty"));
    res = check(p, G.ctl.getValue().replace(/−/g, "-"), { locale: loc() });
    if (res.status === "invalid") {
      showFeedback(res, null);
      return;
    }
  }
  G.answered = true;
  G.ctl.setLocked(true);
  $("#answer").classList.add("done");
  const hinted = G.hinted;
  record(p.module, level(), res, hinted);
  let move = null;
  if (G.mode === "module") {
    move = climb(res.status);
    $("#pMount").innerHTML = mountainSvg(move.from, S.mountain.summits);
    requestAnimationFrame(() => requestAnimationFrame(() => moveClimber($("#pMount"), move.to)));
  } else {
    const mx = G.mixed;
    mx.i++;
    if (res.status === "correct") mx.ok++;
    else if (res.status === "partial") mx.part++;
    else mx.wrong++;
    for (const c of res.codes) mx.errors[c] = (mx.errors[c] ?? 0) + 1;
  }
  showFeedback(res, move);
  const sug = adapt(p.module, res.status, hinted, level());
  if (sug && PARAMS.level === null && G.mode === "module") offerLevel(sug);
  $("#btnCheck").hidden = true;
  $("#btnHint").hidden = true;
  $("#btnNext").hidden = false;
  if (move?.summit) toast(t("summitMsg", S.mountain.summits));
}

const SENTENCE = {
  notNormalized: () => t("c_notNormalized"),
  wrongForm: (p) => (p.ask.form === "decimal" ? t("c_wrongFormDec") : t("c_wrongFormSci")),
  wrongNotation: (p) => t("c_wrongNotation", p.ask.form === "e" ? "a e n" : "a·10<sup>n</sup>"),
  sfTooMany: (p) => t("c_sfTooMany", p.expected.sf),
  sfTooFew: (p) => t("c_sfTooFew", p.expected.sf),
  tooManyDigits: (p) => t("c_tooManyDigits", p.expected.sf),
  tooFewDigits: (p) => t("c_tooFewDigits", p.expected.sf),
  truncated: () => t("c_truncated"),
  wrongDirection: (p) => t(p.kind === "notation" ? "c_wrongDirection_n" : "c_wrongDirection_c"),
  noShift: () => t("c_noShift"),
  noConversion: () => t("c_noConversion"),
  offByOne: () => t("c_offByOne"),
  doubleShift: () => t("c_doubleShift"),
  dimNotMultiplied: () => t("c_dimNotMultiplied"),
  timeDecimal: () => t("c_timeDecimal"),
  litreBridge: () => t("c_litreBridge"),
  prefixSwap: () => t("c_prefixSwap"),
  signFlip: () => t("c_signFlip"),
  valueNotExp: () => t("c_valueNotExp"),
  sumInstead: () => t("c_sumInstead"),
  noPower: () => t("c_noPower"),
  noRound: () => t("c_noRound"),
  roundWrong: () => t("c_roundWrong"),
  sqrt10: () => t("c_sqrt10"),
  ratioInverted: () => t("c_ratioInverted"),
  ratioSum: () => t("c_ratioSum"),
};
const FORM_CODES = ["notNormalized", "wrongForm", "wrongNotation", "sfTooMany", "sfTooFew"];

function expectedHtml(p) {
  if (p.integer) return `10<sup>${fmt(p.expected, loc(), "decimal")}</sup>`;
  return fmt(p.expected, loc(), p.ask.form, { html: true }) + (p.toUnit ? ` ${unitLabel(parseUnit(p.toUnit), true)}` : "");
}

function showFeedback(res, move) {
  const p = G.problem;
  const el = $("#fb");
  el.hidden = false;
  let cls = "wrong";
  let title;
  let body = "";
  if (res.status === "invalid") {
    cls = "invalid";
    title = t("fbInvalid");
    body = `<p>${t(`inv_${res.error}`)}</p>`;
  } else if (res.status === "correct") {
    cls = "ok";
    title = t("fbCorrect");
    if (res.codes.includes("lastDigit")) body = `<p>${t("c_lastDigit", expectedHtml(p))}</p>`;
  } else if (res.status === "partial") {
    cls = "part";
    const formFirst = res.codes.some((c) => FORM_CODES.includes(c));
    const sentences = res.codes.map((c) => SENTENCE[c]?.(p)).filter(Boolean);
    title = formFirst ? `${t("fbPartial")}` : t("fbAlmost");
    body = `<p>${formFirst ? sentences.map((s) => `${s}`).join(" ") : sentences.join(" ")}</p><p>${t("expectedIs", expectedHtml(p))}</p>`;
  } else {
    title = t("fbWrong");
    const sentences = res.codes.map((c) => SENTENCE[c]?.(p)).filter(Boolean);
    body = `<p>${sentences.length ? sentences.join(" ") : t("c_none")}</p>`;
    if (p.kind === "order") body += `<p>${t("ordSolution")}</p>`;
    else if (p.kind === "intruder") body = `<p>${t("intSolution", p.base)}</p>`;
    else if (p.choice) body = `<p>${t("expectedIs", choiceLabel(p, p.answer))}</p>`;
    else body += `<p>${t("expectedIs", expectedHtml(p))}</p>`;
  }
  let mv = "";
  if (move) {
    const label = move.summit ? t("summit") : move.moved > 0 ? t("climb") : move.moved < 0 ? t("slip") : move.held ? t("campHold") : t("stay");
    mv = `<div class="mv ${move.moved > 0 ? "up" : move.moved < 0 ? "down" : ""}">${move.moved > 0 ? "▲" : move.moved < 0 ? "▼" : "•"} ${label} · ${t("altitude", move.to, TOP)}</div>`;
  }
  el.className = `card fb ${cls}`;
  el.innerHTML = `<div class="ft">${title}</div>${body}${mv}<div class="sug" id="sug"></div>`;
  if (res.status === "invalid") return;
  renderSolution(res);
}

function renderSolution(res) {
  const p = G.problem;
  const parts = visualsFor(p, loc());
  if (p.kind === "convert" || p.kind === "notation") {
    if (p.ask.form === "decimal" && p.expected.d !== 0n) parts.push(`<div class="vis figs"><div class="fg">${figuresHtml(p.expected, loc())}</div><div class="cap">${t("solFigures")}</div></div>`);
  }
  const el = $("#sol");
  if (!parts.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const open = res.status === "wrong" || res.status === "partial";
  el.innerHTML = `<button type="button" class="solbtn" aria-expanded="${open}"><span class="ms">visibility</span> ${t("showSolution")}</button><div class="solbody"${open ? "" : " hidden"}>${parts.join("")}</div>`;
  $(".solbtn", el).onclick = () => {
    const body = $(".solbody", el);
    body.hidden = !body.hidden;
    $(".solbtn", el).setAttribute("aria-expanded", String(!body.hidden));
    if (!body.hidden) centerScrollers(body);
  };
  if (open) centerScrollers(el);
}

function centerScrollers(root) {
  requestAnimationFrame(() => {
    $$(".vis.line .scrollx", root).forEach((s) => {
      s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2;
      const marks = $$(".pa, .pb", s);
      if (marks.length === 2 && s.scrollWidth > s.clientWidth) {
        const a = marks[0].getBoundingClientRect().left;
        const b = marks[1].getBoundingClientRect().left;
        const r = s.getBoundingClientRect();
        s.scrollLeft += (a + b) / 2 - (r.left + r.width / 2);
      }
    });
  });
}

function offerLevel(dir) {
  const target = dir === "up" ? level() + 1 : level() - 1;
  const el = $("#sug");
  if (!el) return;
  el.innerHTML = `<span>${t(dir === "up" ? "suggestUp" : "suggestDown", target)}</span> <button class="btn small" type="button" data-y>${t("yes")}</button> <button class="btn small" type="button" data-n>${t("no")}</button>`;
  el.onclick = (e) => {
    if (e.target.closest("[data-y]")) {
      S.settings.level = target;
      save();
      $("#pLevel").textContent = t(`l${target}`);
    }
    if (e.target.closest("[data-y],[data-n]")) el.innerHTML = "";
  };
}

// ---------- hint (level 3) ----------

function onHint() {
  const p = G.problem;
  if (G.answered || G.hinted) return;
  G.hinted = true;
  let html;
  if (p.kind === "convert") {
    const f = parseUnit(p.fromUnit);
    const to = parseUnit(p.toUnit);
    const r = ratio(f, to);
    const one = mk(1, 1000n, -3, 4);
    const res = mulRatio(one, r.n, r.d, r.p, { sf: 4 });
    html = t(res.exact ? "hintLine" : "hintLineApprox", unitLabel(f, true), fmt(res.dec, loc(), Math.abs(sciExp(res.dec)) > 5 ? "times" : "decimal", { html: true }), unitLabel(to, true));
  } else if (p.kind === "prefix") html = ladderVisual(null, null, t("ladCap"));
  else if (p.kind === "oom") html = t("oomRule");
  else html = t("solComma");
  const el = $("#assist");
  el.hidden = false;
  el.innerHTML = `<div class="card aid hint">${html}<small>${t("hintNote")}</small></div>`;
  $("#btnHint").hidden = true;
}

// ---------- end of mixed challenge ----------

function finishMixed() {
  const mx = G.mixed;
  const pct = Math.round((mx.ok / MIXED_N) * 100);
  const errs = Object.entries(mx.errors).sort((a, b) => b[1] - a[1]);
  $("#statsBody").innerHTML = `<h3>${t("mixed")}</h3><div class="big">${mx.ok}/${MIXED_N} · ${pct}%</div>
    <p>✓ ${mx.ok} · ≈ ${mx.part} · ✗ ${mx.wrong}</p>
    ${errs.length ? `<h3>${t("commonErrors")}</h3><ul>${errs.map(([c, n]) => `<li>${errName(c)} <b>×${n}</b></li>`).join("")}</ul>` : ""}`;
  $("#dlgStats").dataset.mode = "mixed";
  $("#dlgStats").showModal();
  backHome();
}

// ---------- statistics dialog ----------

const errName = (c) => (DICT_HAS(`e_${c}`) ? t(`e_${c}`) : t("e_other"));
function DICT_HAS(k) {
  return t(k) !== k;
}

function renderStats() {
  const rows = MODULES.map((m) => {
    const bm = S.stats.byModule[m] ?? {};
    const n = Object.values(bm).reduce((a, c) => a + c.n, 0);
    const a = accuracy(m);
    return `<tr><td>${t(`m${m}`)}</td><td class="r">${n}</td><td class="r">${a === null ? "–" : Math.round(a * 100) + "%"}</td></tr>`;
  }).join("");
  const errs = topErrors(6);
  const all = accuracy();
  $("#statsBody").innerHTML = `
    <div class="noprint"><label class="nm">${t("studentName")}<input id="stName" type="text" maxlength="40" value="${(S.settings.name || "").replace(/"/g, "&quot;")}"></label></div>
    <p class="sum"><b>${S.settings.name ? S.settings.name + " · " : ""}</b>${t("summaryDate")}: ${new Date().toLocaleDateString(loc())}</p>
    <div class="big">${all === null ? "–" : Math.round(all * 100) + "%"} <small>${t("accuracy")}</small></div>
    <table class="tbl"><thead><tr><th></th><th class="r">${t("answered")}</th><th class="r">${t("accuracy")}</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="sum">${t("altitude", S.mountain.alt, TOP)} · ▲ ${S.mountain.summits}</p>
    <h3>${t("commonErrors")}</h3>${errs.length ? `<ul>${errs.map(([c, n]) => `<li>${errName(c)} <b>×${n}</b></li>`).join("")}</ul>` : `<p>${t("noErrors")}</p>`}`;
  $("#stName")?.addEventListener("input", (e) => {
    S.settings.name = e.target.value;
    save();
  });
}

function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e2) {
      /* */
    }
    ta.remove();
  }
  toast(t("copied"));
}

// ---------- navigation and wiring ----------

function backHome() {
  G.problem = null;
  showScreen("home");
  renderHome();
}

function renderAll() {
  applyI18n(document);
  $("#helpBody").innerHTML = t("helpBody");
  if (!$("#home").hidden) renderHome();
  else if (G.problem) renderQuestion();
}

function init() {
  load();
  if (PARAMS.lang) setLang(PARAMS.lang);
  applyTheme();
  renderAll();

  $("#mods").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-m]");
    if (b) startSession(b.dataset.m === "mixed" ? "mixed" : +b.dataset.m);
  });
  $("#lvlSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lv]");
    if (!b || PARAMS.level !== null) return;
    S.settings.level = +b.dataset.lv;
    save();
    renderHome();
  });
  $("#btnBack").onclick = backHome;
  $("#btnCheck").onclick = onCheck;
  $("#btnHint").onclick = onHint;
  $("#btnNext").onclick = () => {
    if (G.mode === "mixed" && G.mixed.i >= MIXED_N) return finishMixed();
    nextQuestion();
  };
  $("#btnHelp").onclick = () => $("#dlgHelp").showModal();
  $("#btnStats").onclick = () => {
    renderStats();
    $("#dlgStats").dataset.mode = "stats";
    $("#dlgStats").showModal();
  };
  $("#btnLang").onclick = () => {
    setLang(getLang() === "it" ? "en" : "it");
    renderAll();
  };
  $("#btnTheme").onclick = () => {
    const order = ["auto", "light", "dark"];
    S.settings.theme = order[(order.indexOf(S.settings.theme) + 1) % 3];
    save();
    applyTheme();
    toast({ auto: t("themeAuto"), light: t("themeLight"), dark: t("themeDark") }[S.settings.theme]);
  };
  $$("[data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
  $("#btnPrint").onclick = () => window.print();
  $("#btnJson").onclick = () => download(`units-lab-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportData(loc()), null, 2));
  $("#btnCopy").onclick = () => copyText(JSON.stringify(exportData(loc())));
  let resetTimer = 0;
  $("#btnReset").onclick = () => {
    const b = $("#btnReset");
    if (b.dataset.armed) {
      clearTimeout(resetTimer);
      delete b.dataset.armed;
      resetAll();
      renderStats();
      renderHome();
      b.lastElementChild.textContent = t("resetStats");
      return;
    }
    b.dataset.armed = "1";
    b.lastElementChild.textContent = t("resetConfirm");
    resetTimer = setTimeout(() => {
      delete b.dataset.armed;
      b.lastElementChild.textContent = t("resetStats");
    }, 4000);
  };

  document.addEventListener("keydown", (e) => {
    if ($("#play").hidden || document.querySelector("dialog[open]") || e.target.matches("input,textarea")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (G.answered) $("#btnNext").click();
      else onCheck();
    } else if (!G.answered && G.predicted && G.ctl?.onKey?.(e)) {
      /* handled */
    }
  });
}

init();

// handy for the tests of the interface (Playwright) and for debugging
window.__unitsLab = { G, S };
export {};
