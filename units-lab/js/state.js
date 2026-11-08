// Units Lab · state.js
// Progress, statistics and settings, saved in localStorage (versioned key, every access guarded).
// The mountain: stations 0..TOP, a base camp every CAMP stations. Correct = up, wrong = down but never
// below the last base camp, partial (value right, form off) = stay.

const KEY = "units-lab.v2";
const TOP = 12;
const CAMP = 4;
const LAST_N = 20;

function fresh() {
  return {
    v: 1,
    settings: { level: 1, theme: "auto", name: "" },
    mountain: { alt: 0, summits: 0 },
    stats: { byModule: {}, last: {}, errors: {} },
    adapt: {},
  };
}

const S = fresh();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && d.v === 1) {
      Object.assign(S.settings, d.settings);
      Object.assign(S.mountain, d.mountain);
      Object.assign(S.stats, d.stats);
      Object.assign(S.adapt, d.adapt);
    }
  } catch (e) {
    /* private mode or corrupted: start fresh */
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    /* */
  }
}

function resetAll() {
  const keepName = S.settings;
  Object.assign(S, fresh());
  S.settings = { ...S.settings, ...keepName };
  save();
}

// ---------- mountain ----------

const campOf = (alt) => Math.floor(alt / CAMP) * CAMP;

/** Moves the climber. Returns { from, to, moved: +1|-1|0, summit, held } */
function climb(status) {
  const from = S.mountain.alt;
  let to = from;
  let summit = false;
  let held = false;
  if (status === "correct") {
    to = from + 1;
    if (to >= TOP) {
      summit = true;
      S.mountain.summits += 1;
      to = TOP; // shown at the top, the mountain resets on the next question
    }
  } else if (status === "wrong") {
    const floor = campOf(from);
    if (from > floor) to = from - 1;
    else held = true;
  }
  S.mountain.alt = to;
  save();
  return { from, to, moved: Math.sign(to - from), summit, held: held && status === "wrong" };
}

function newMountain() {
  if (S.mountain.alt >= TOP) S.mountain.alt = 0;
  save();
}

// ---------- statistics ----------

function record(module, level, result, hinted) {
  const key = `${module}`;
  const bm = (S.stats.byModule[key] ??= {});
  const cell = (bm[level] ??= { n: 0, c: 0, p: 0, w: 0, h: 0 });
  cell.n++;
  if (result.status === "correct") cell.c++;
  else if (result.status === "partial") cell.p++;
  else if (result.status === "wrong") cell.w++;
  if (hinted) cell.h++;
  const last = (S.stats.last[key] ??= []);
  last.push(result.status === "correct" ? "c" : result.status === "partial" ? "p" : "w");
  while (last.length > LAST_N) last.shift();
  if (result.status !== "correct" || (result.codes ?? []).length) {
    const codes = (result.codes ?? []).filter((c) => c !== "lastDigit");
    for (const c of codes.length ? codes : result.status === "wrong" ? ["other"] : []) S.stats.errors[c] = (S.stats.errors[c] ?? 0) + 1;
  }
  save();
}

/** accuracy over the last answers of a module (or all), 0..1, null when nothing yet */
function accuracy(module) {
  const keys = module ? [`${module}`] : Object.keys(S.stats.last);
  const all = keys.flatMap((k) => S.stats.last[k] ?? []);
  if (!all.length) return null;
  return all.filter((x) => x === "c").length / all.length;
}

function totals() {
  let n = 0;
  for (const bm of Object.values(S.stats.byModule)) for (const c of Object.values(bm)) n += c.n;
  return n;
}

function topErrors(k = 5) {
  return Object.entries(S.stats.errors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
}

// ---------- adaptive level ----------

/** After each answer: suggest a level change. Returns "up" | "down" | null. */
function adapt(module, status, hinted, level) {
  const a = (S.adapt[module] ??= { up: 0, down: 0 });
  if (status === "correct" && !hinted) {
    a.up++;
    a.down = 0;
  } else if (status === "wrong") {
    a.down++;
    a.up = 0;
  } else if (status === "partial") {
    a.up = 0;
  }
  let out = null;
  if (a.up >= 5 && level < 3) out = "up";
  if (a.down >= 3 && level > 1) out = "down";
  if (out) {
    a.up = 0;
    a.down = 0;
  }
  save();
  return out;
}

// ---------- export ----------

function exportData(lang) {
  return {
    app: "units-lab",
    v: 1,
    date: new Date().toISOString(),
    lang,
    name: S.settings.name || undefined,
    mountain: S.mountain,
    stats: S.stats,
  };
}

// ---------- link parameters (?lang=it&level=2&modules=1,2&tier=2&seed=7) ----------

function readParams(search) {
  const q = new URLSearchParams(search);
  const level = parseInt(q.get("level"), 10);
  const tier = parseInt(q.get("tier"), 10);
  const seed = parseInt(q.get("seed"), 10);
  const lang = q.get("lang");
  const modules = (q.get("modules") ?? "")
    .split(",")
    .map((x) => parseInt(x, 10))
    .filter((x) => x >= 1 && x <= 7);
  return {
    lang: lang === "it" || lang === "en" ? lang : null,
    level: level >= 1 && level <= 3 ? level : null,
    tier: tier >= 1 && tier <= 3 ? tier : 3,
    seed: Number.isFinite(seed) ? seed : null,
    modules: modules.length ? modules : null,
  };
}

export { S, TOP, CAMP, load, save, resetAll, climb, newMountain, campOf, record, accuracy, totals, topErrors, adapt, exportData, readParams };
