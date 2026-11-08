// __NAME__ · main.js
// Entry point: kit setup, tabs, a minimal simulation loop to replace with the real one.
import { initKit, t, icon, readColors, onTheme, onLang, fmtNum, parseNum, store, toast } from "../../kit/kit.js";
import STRINGS from "./strings.js";

const VERSION = "0.1.0";

initKit({
  slug: "__SLUG__",
  name: "__NAME__",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "link", label: "menu.share", onClick: () => navigator.clipboard?.writeText(location.href).then(() => toast(t("copied"))) },
    { icon: "reset", label: "menu.reset", onClick: () => { store.remove("state"); location.hash = ""; location.reload(); } },
  ],
});

// ---------- icons and tabs ----------
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
const tabs = [...document.querySelectorAll(".tab")];
function showTab(i) {
  tabs.forEach((b, j) => {
    b.setAttribute("aria-selected", String(i === j));
    document.getElementById(b.getAttribute("aria-controls")).hidden = i !== j;
  });
}
tabs.forEach((b, i) => b.addEventListener("click", () => showTab(i)));

// ---------- state ----------
const S = { x: 0, v: 2, t: 0, running: false, vectors: true };

const $ = (id) => document.getElementById(id);
const v0 = $("v0"),
  x0 = $("x0");
function syncUI() {
  $("v0Out").textContent = fmtNum(+v0.value, 1, "m/s");
  $("clock").textContent = `t = ${fmtNum(S.t, 2, "s")}`;
  $("playBtn").querySelector(".lbl").textContent = t(S.running ? "pause" : "play");
}
v0.addEventListener("input", () => { S.v = +v0.value; syncUI(); draw(); });
x0.addEventListener("change", () => { const v = parseNum(x0.value); if (!Number.isNaN(v)) S.x = v; draw(); });
$("tgVec").addEventListener("click", (e) => {
  S.vectors = !S.vectors;
  e.currentTarget.setAttribute("aria-pressed", String(S.vectors));
  draw();
});
$("playBtn").addEventListener("click", () => { S.running = !S.running; syncUI(); if (S.running) requestAnimationFrame(loop); });
$("stepBtn").addEventListener("click", () => { advance(1 / 30); });
$("resetBtn").addEventListener("click", () => { S.t = 0; S.running = false; syncUI(); draw(); });

// ---------- simulation: fixed physics step, rendering at display rate (DESIGN.md §12) ----------
let last = 0;
function advance(dt) {
  S.t += dt;
  syncUI();
  draw();
}
function loop(now) {
  if (!S.running) return (last = 0);
  if (last) advance(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(loop);
}

// ---------- drawing ----------
const cv = $("cv");
let C = readColors();
function draw() {
  const r = cv.getBoundingClientRect(),
    dpr = devicePixelRatio || 1;
  cv.width = r.width * dpr;
  cv.height = r.height * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  const scale = r.width / 24,
    x = r.width / 2 + (S.x + S.v * S.t) * scale,
    y = r.height / 2;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y + 14);
  ctx.lineTo(r.width, y + 14);
  ctx.stroke();
  ctx.fillStyle = C.tile2;
  ctx.fillRect(x - 14, y - 14, 28, 28);
  ctx.strokeRect(x - 14, y - 14, 28, 28);
  if (S.vectors && S.v) {
    const len = S.v * scale;
    ctx.strokeStyle = ctx.fillStyle = C.vel;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x + len, y - 24);
    ctx.stroke();
    const d = Math.sign(len);
    ctx.beginPath();
    ctx.moveTo(x + len + d * 4, y - 24);
    ctx.lineTo(x + len - d * 8, y - 28);
    ctx.lineTo(x + len - d * 8, y - 20);
    ctx.fill();
  }
}
new ResizeObserver(draw).observe(cv);
onTheme(() => { C = readColors(); draw(); });
onLang(syncUI);
syncUI();
