// Units Lab · input.js
// The two ways to answer: the on-screen keypad (free typing) and the mantissa/exponent widget
// (digits fixed, move the comma and set the exponent). Both give getValue() as a string for the checker.

import { mantString, sepOf, expText } from "./format.js";
import { sciExp } from "./decimal.js";
import { t } from "./i18n.js";

const MINUS = "−";

/** what the student typed → what is shown (exponent raised, typographic minus) */
function typedHtml(text) {
  return text.replace(/-/g, MINUS).replace(/\^(−?\d*)/, (m, e) => `<sup>${e}</sup>`);
}

const arrow = (dir) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="${dir < 0 ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}"/></svg>`;

// ---------- free typing + keypad ----------

function createFree(host, { loc, form, onChange, onSubmit }) {
  let text = "";
  let locked = false;
  const mark = form === "e" ? "e" : "·10^";
  const sep = sepOf(loc);

  host.innerHTML = `
    <div class="ans" role="textbox" aria-label="${t("answerLabel")}" aria-live="polite"><span class="val"></span><i class="caret"></i></div>
    <div class="keypad">
      ${["7", "8", "9", "bs", "4", "5", "6", "sg", "1", "2", "3", "ex", "0", "0", "sp", "ac"]
        .map((k, i) => {
          if (k === "0" && i === 13) return "";
          const cls = k === "0" ? "k wide" : k === "ex" && form === "decimal" ? "k off" : "k";
          const lab = { bs: "⌫", sg: "+/−", ex: form === "e" ? t("keyE") : t("keyTimes"), sp: sep, ac: "C" }[k] ?? k;
          const aria = { bs: t("keyBack"), ac: t("keyClear") }[k] ?? lab;
          return `<button type="button" class="${cls}${"bs sg ex ac".includes(k) && k.length === 2 ? " fn" : ""}" data-k="${k}" aria-label="${aria}" ${k === "ex" && form === "decimal" ? "disabled" : ""}>${lab}</button>`;
        })
        .join("")}
    </div>`;
  const val = host.querySelector(".val");

  const markIdx = () => text.indexOf(mark);
  const parts = () => {
    const i = markIdx();
    return i < 0 ? { mant: text, has: false, exp: "" } : { mant: text.slice(0, i), has: true, exp: text.slice(i + mark.length) };
  };
  const render = () => {
    val.innerHTML = text ? typedHtml(text) : `<span class="ph">${t("answerEmpty")}</span>`;
    onChange?.();
  };

  const press = (k) => {
    if (locked) return;
    const { mant, has, exp } = parts();
    if (/^\d$/.test(k)) {
      if (has ? exp.replace("-", "").length < 3 : mant.replace(/[-,.]/g, "").length < 12) text += k;
    } else if (k === "sp") {
      if (!has && !mant.includes(sep)) text += mant.replace("-", "") === "" ? "0" + sep : sep;
    } else if (k === "sg") {
      if (has) text = text.slice(0, markIdx() + mark.length) + (exp.startsWith("-") ? exp.slice(1) : "-" + exp);
      else text = mant.startsWith("-") ? mant.slice(1) : "-" + mant;
    } else if (k === "ex") {
      if (form !== "decimal" && !has && /\d/.test(mant)) text += mark;
    } else if (k === "bs") {
      text = text.endsWith(mark) ? text.slice(0, -mark.length) : text.slice(0, -1);
    } else if (k === "ac") {
      text = "";
    }
    render();
  };

  host.querySelector(".keypad").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (b) press(b.dataset.k);
  });

  // typing "5,2*10^3" on a physical keyboard: after the times sign, the "10^" is already in the mark
  let pending = "";
  const onKey = (e) => {
    if (locked || e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key;
    if (pending && k === pending[0]) {
      pending = pending.slice(1);
      e.preventDefault();
      return true;
    }
    pending = "";
    if (/^\d$/.test(k)) press(k);
    else if (k === "," || k === ".") press("sp");
    else if (k === "-" || k === "+" || k === MINUS) press("sg");
    else if (k === "e" || k === "E") press("ex");
    else if (k === "*" || k === "x" || k === "×" || k === "·") {
      press("ex");
      pending = "10^";
    }
    else if (k === "Backspace") press("bs");
    else if (k === "Delete" || k === "Escape") press("ac");
    else if (k === "Enter") onSubmit?.();
    else return false;
    e.preventDefault();
    return true;
  };

  render();
  return {
    el: host,
    kind: "free",
    getValue: () => text,
    isEmpty: () => !/\d/.test(text),
    setLocked(v) {
      locked = v;
      host.classList.toggle("locked", v);
    },
    onKey,
  };
}

// ---------- widget: digits fixed, comma and exponent move ----------

/**
 * plan: from visuals.commaPlan (digits, iStart, xStart, ...). form: "times" | "e" | "decimal".
 * level 1 shows the invariance badge (or the applied factor for conversions).
 */
function createWidget(host, { plan, problem, loc, form, level, onChange }) {
  const D = plan.digits;
  const n = D.length;
  const sepCh = sepOf(loc);
  let i = plan.iStart;
  let x = form === "decimal" ? 0 : plan.xStart;
  let locked = false;
  const lock = plan.toDecimal && !plan.fromDecimal; // sci data asked as decimal: the exponent is given
  const given = lock ? plan.xStart : null;
  const MINI = -8;
  const MAXI = n + 10;

  host.innerHTML = `
    <div class="wg">
      <div class="row mant">
        <button type="button" class="step" data-a="L" aria-label="${t("commaLeft")}">${arrow(-1)}</button>
        <div class="tiles" aria-live="polite"></div>
        <button type="button" class="step" data-a="R" aria-label="${t("commaRight")}">${arrow(1)}</button>
      </div>
      ${
        form === "decimal"
          ? given !== null
            ? `<div class="row expo given"><span class="mk">·10<sup>${expText(given)}</sup></span></div>`
            : ""
          : `<div class="row expo"><span class="mk">${form === "e" ? "e" : "·10"}</span>
              <button type="button" class="step" data-a="m" aria-label="${t("expMinus")}"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M6 12 H18"/></svg></button>
              <output class="xv"></output>
              <button type="button" class="step" data-a="p" aria-label="${t("expPlus")}"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M6 12 H18 M12 6 V18"/></svg></button></div>`
      }
      <div class="gh" aria-live="polite"></div>
      ${level === 1 ? `<div class="bal" aria-live="polite"></div>` : ""}
    </div>`;
  const tiles = host.querySelector(".tiles");
  const xv = host.querySelector(".xv");
  const bal = host.querySelector(".bal");
  const gh = host.querySelector(".gh");

  const value = () => {
    const mant = mantString(D, i, loc);
    if (form === "decimal") return mant;
    return form === "e" ? `${mant}e${x}` : `${mant}·10^${x}`;
  };

  const render = () => {
    // the range covers where the comma is now and where it started (the ghost)
    const lo = Math.min(i <= 0 ? i - 1 : 0, plan.iStart <= 0 ? plan.iStart - 1 : 0);
    const hi = Math.max(n, i, plan.iStart);
    let h = "";
    for (let j = lo; j <= hi; j++) {
      if (j === i) h += `<i class="cm e">${sepCh}</i>`;
      else if (j === plan.iStart) h += `<i class="cm s ghost" aria-hidden="true">${sepCh}</i>`;
      if (j === hi) break;
      const isDigit = j >= 0 && j < n;
      h += `<span class="tl${isDigit ? "" : " z"}">${isDigit ? D[j] : "0"}</span>`;
    }
    tiles.innerHTML = h;
    const moved = i - plan.iStart;
    if (gh) gh.innerHTML = moved === 0 ? `<span class="still">${t("ghNone")}</span>` : `<span class="mv">${moved < 0 ? "◀" : "▶"} ${t(moved < 0 ? "ghLeft" : "ghRight", Math.abs(moved))}</span>`;
    if (xv) xv.textContent = (x < 0 ? MINUS : "") + Math.abs(x);
    if (bal) {
      const k = i - 1 + (form === "decimal" ? 0 : x) - sciExp(problem.data);
      if (problem.kind === "notation") {
        bal.className = "bal " + (k === 0 ? "eq" : "off");
        bal.innerHTML = k === 0 ? `= ${t("balanceEq")}` : `≠ ${t("balanceOff", expText(k))}`;
      } else {
        bal.className = "bal fac";
        bal.innerHTML = `× 10<sup>${expText(k)}</sup>`;
      }
    }
    onChange?.();
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b || locked) return;
    const a = b.dataset.a;
    if (a === "L") i = Math.max(MINI, i - 1);
    else if (a === "R") i = Math.min(MAXI, i + 1);
    else if (a === "m") x = Math.max(-40, x - 1);
    else if (a === "p") x = Math.min(40, x + 1);
    render();
  });

  const onKey = (e) => {
    if (locked || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "ArrowLeft") i = Math.max(MINI, i - 1);
    else if (e.key === "ArrowRight") i = Math.min(MAXI, i + 1);
    else if (e.key === "ArrowDown" && form !== "decimal") x = Math.max(-40, x - 1);
    else if (e.key === "ArrowUp" && form !== "decimal") x = Math.min(40, x + 1);
    else return false;
    e.preventDefault();
    render();
    return true;
  };

  render();
  return {
    el: host,
    kind: "widget",
    getValue: value,
    isEmpty: () => false,
    setLocked(v) {
      locked = v;
      host.classList.toggle("locked", v);
    },
    onKey,
  };
}

export { createFree, createWidget, typedHtml };
