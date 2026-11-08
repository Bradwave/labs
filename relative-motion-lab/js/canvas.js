// Relative Motion Lab: Canvases, colours and coordinate maps between the two frames.
import { $ } from "./dom.js";
import { add, sub, rot } from "./vec.js";
import { ui } from "./state.js";

export const pan = { S: { cv: $("#cvS") }, P: { cv: $("#cvP") } },
  vec = { cv: $("#cvV") },
  gph = { cv: $("#cvG") };
export function sizeCanvas(o) {
  const w = o.cv.clientWidth,
    h = o.cv.clientHeight;
  if (!w || !h) return;
  o.w = w;
  o.h = h;
  ui.dpr = window.devicePixelRatio || 1;
  o.cv.width = Math.round(w * ui.dpr);
  o.cv.height = Math.round(h * ui.dpr);
}
export const C = {};
export function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["surface", "ink", "muted", "sC", "pC", "fC", "pale", "accent", "gridline", "body"])
    C[k] = cs.getPropertyValue("--" + k).trim();
}
export const mapPtoS = (q, F) => add(F.r, rot(q, F.th)),
  mapStoP = (q, F) => rot(sub(q, F.r), -F.th);
export function initCanvas() {
  for (const o of [pan.S, pan.P, vec, gph]) {
    o.ctx = o.cv.getContext("2d");
    o.w = 300;
    o.h = 200;
  }
}
