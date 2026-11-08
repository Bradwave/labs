// Units Lab · format.js
// Writes a Dec as text or HTML: decimal comma in Italian, decimal point in English;
// scientific notation as 5,2·10³ ("times") or 5,2e3 ("e"). No thousands separators, ever.

import { sciExp } from "./decimal.js";

const sepOf = (loc) => (loc === "en" ? "." : ",");
const MINUS = "−";

/** Mantissa with `i` digits before the separator (i may be ≤ 0 or ≥ the number of digits). */
function mantString(digits, i, loc) {
  const n = digits.length;
  const sep = sepOf(loc);
  if (i <= 0) return "0" + sep + "0".repeat(-i) + digits;
  if (i >= n) return digits + "0".repeat(i - n);
  return digits.slice(0, i) + sep + digits.slice(i);
}

function decimalString(a, loc) {
  const sign = a.s < 0 && a.d !== 0n ? MINUS : "";
  if (a.d === 0n) return "0";
  const D = a.d.toString();
  if (a.e >= 0) return sign + D + "0".repeat(a.e);
  return sign + mantString(D, D.length + a.e, loc);
}

/** Exponent of ten that goes with a mantissa having `i` digits before the separator. */
const expForPoint = (a, i) => a.e + a.sf - i;

function expText(x) {
  return (x < 0 ? MINUS : "") + Math.abs(x);
}

/**
 * form: "decimal" | "times" | "e". i = digits before the separator in the mantissa (default 1 = normalized).
 * html: exponent as <sup>.
 */
function fmt(a, loc, form = "decimal", { html = false, i = 1 } = {}) {
  if (form === "decimal") return decimalString(a, loc);
  const sign = a.s < 0 && a.d !== 0n ? MINUS : "";
  const m = sign + mantString(a.d.toString(), i, loc);
  const x = expForPoint(a, i);
  if (form === "e") return `${m}e${expText(x)}`;
  return html ? `${m}·10<sup>${expText(x)}</sup>` : `${m}·10^${expText(x)}`;
}

/** Ordinary text for the answer string a student would send for this Dec in this form. */
const answerString = (a, loc, form) => fmt(a, loc, form);

export { sepOf, MINUS, mantString, decimalString, expForPoint, expText, fmt, answerString, sciExp };
