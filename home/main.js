// Labs · home/main.js
// Renders the crowded laboratory landing page from apps.json: benches, animated stations,
// non-clickable scenery, filters, search, bench jump bar, compact index view, theme & i18n.

import { initKit, t, getLang, onLang, icon } from "../kit/kit.js";
import { buildBenchTables, benchIdForApp, BENCHES, NEW_ARRIVALS_BENCH } from "./benches.js";
import { renderStationSVG } from "./stations.js";
import {
  renderRoomCeilingScenery,
  renderBenchWallDecor,
  renderTableClutterProp,
  renderBenchUnderframe,
} from "./scenery.js";

const strings = {
  it: {
    intro:
      "Esplora i banchi del laboratorio: ogni apparato animato è un esperimento interattivo pronto da aprire, anche offline.",
    filter: "Filtra per materia",
    view: "Modalità di vista",
    "view.room": "Laboratorio",
    "view.list": "Indice",
    "f.all": "Tutti",
    "f.physics": "Fisica",
    "f.math": "Matematica",
    "f.xr": "XR",
    searchPlaceholder: "Cerca un laboratorio…",
    searchLabel: "Cerca tra i laboratori",
    searchClear: "Cancella ricerca",
    benchesLabel: "Banchi:",
    physics: "fisica",
    mathematics: "matematica",
    xr: "XR",
    wipTag: "in aggiornamento",
    openLab: "Apri",
    empty: "Nessun apparato corrisponde ai filtri selezionati.",
    resetFilters: "Mostra tutto il laboratorio",
    foot: "Codice libero (MIT) su",
    footHint: "Ogni apparato colorato con targhetta apre il laboratorio.",
    title: "Laboratori di matematica e fisica",
    about:
      "Ogni laboratorio è una piccola app che si apre nel browser e si può installare. Tutto avviene sul dispositivo: nessun dato viene inviato.",
    aboutRoom:
      "Gli strumenti animati sui banchi sono interattivi: fai clic su un apparato o sulla sua targhetta per aprire l'esperimento. Gli oggetti sullo sfondo (lavagna, lampade, mensole e sgabelli) sono solo scenografia.",
    wip: "I tag tratteggiati indicano i laboratori non ancora allineati al nuovo stile.",
  },
  en: {
    intro:
      "Explore the lab benches: every animated apparatus is an interactive experiment ready to open, even offline.",
    filter: "Filter by subject",
    view: "View mode",
    "view.room": "Lab room",
    "view.list": "Index",
    "f.all": "All",
    "f.physics": "Physics",
    "f.math": "Mathematics",
    "f.xr": "XR",
    searchPlaceholder: "Search labs…",
    searchLabel: "Search labs",
    searchClear: "Clear search",
    benchesLabel: "Benches:",
    physics: "physics",
    mathematics: "mathematics",
    xr: "XR",
    wipTag: "being updated",
    openLab: "Open",
    empty: "No apparatus matches the current filters.",
    resetFilters: "Show the whole lab",
    foot: "Open source (MIT) at",
    footHint: "Every coloured apparatus with a bench plaque opens a lab.",
    title: "Math and physics labs",
    about:
      "Each lab is a small app that opens in the browser and can be installed. Everything runs on the device: no data is sent anywhere.",
    aboutRoom:
      "The animated instruments on the benches are interactive: click any apparatus or its plaque to open the experiment. Background props (chalkboard, lamps, shelves and stools) are scenery only.",
    wip: "Dashed tags mark the labs not yet updated to the new style.",
  },
};

initKit({
  slug: "labs",
  name: "Labs",
  version: "0.2.0",
  strings,
  sw: false,
  landing: "https://matephis.com",
});

let apps = [];
let filter = "all";
let query = "";
let viewMode = "room"; // "room" | "list"
let observer = null;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function resolvePalette(app, allApps) {
  const src = app.palette
    ? app
    : allApps.find((b) => b.slug === app.sharesPaletteWith) || {};
  const pal = src.palette || {};
  const light = pal.proposed?.approved ? { ...pal.light, ...pal.proposed } : pal.light || {};
  const dark = pal.dark || light;
  return { light, dark };
}

/**
 * Generates CSS variables per lab slug for both light and dark modes directly from apps.json.
 * --st-brand stays the lab's vivid signature hue in both themes so equipment remains immediately
 * recognizable against both the light and dark laboratory walls.
 */
function injectStationPalettes(allApps) {
  let styleEl = document.getElementById("station-palettes");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "station-palettes";
    document.head.append(styleEl);
  }
  const lightRules = [];
  const darkMediaRules = [];
  const darkAttrRules = [];

  for (const a of allApps) {
    const { light, dark } = resolvePalette(a, allApps);
    const sel = `[data-slug="${a.slug}"]`;
    const brand = light.bg || "#8CCBEB";
    const brandInk = light.ink || "#14202b";

    lightRules.push(
      `${sel}{--st-brand:${brand};--st-brand-ink:${brandInk};--st-bg:${brand};--st-surface:${light.surface || "#f7f9fb"};--st-ink:${brandInk};--st-accent:${light.accent || "#e8553d"};--st-tile2:${light.tile2 || "#ffd23f"};}`,
    );
    const darkBody = `--st-brand:${brand};--st-brand-ink:${brandInk};--st-bg:${dark.bg || "#18242e"};--st-surface:${dark.surface || "#1b2731"};--st-ink:${dark.ink || "#e8eef3"};--st-accent:${dark.accent || light.accent || "#ff7a5c"};--st-tile2:${dark.tile2 || light.tile2 || "#e9b92a"};`;
    darkMediaRules.push(`:root:not([data-theme="light"]) ${sel}{${darkBody}}`);
    darkAttrRules.push(`:root[data-theme="dark"] ${sel}{${darkBody}}`);
  }

  styleEl.textContent = [
    ...lightRules,
    `@media (prefers-color-scheme: dark){${darkMediaRules.join("")}}`,
    ...darkAttrRules,
  ].join("\n");
}

function matchesFilter(app, f) {
  if (f === "all") return true;
  if (f === "xr") return app.kind === "xr";
  return app.subject === f;
}

function matchesQuery(app, q) {
  if (!q) return true;
  const hay = [
    app.name,
    app.slug,
    app.subject,
    app.kind,
    app.description?.it,
    app.description?.en,
    t(app.subject),
    app.kind === "xr" ? "xr vr ar" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function renderTags(app) {
  const tags = [`<span class="tag">${esc(t(app.subject))}</span>`];
  if (app.kind === "xr") tags.push(`<span class="tag xr">${esc(t("xr"))}</span>`);
  if (app.kit !== true) tags.push(`<span class="tag wip">${esc(t("wipTag"))}</span>`);
  return tags.join("");
}

function renderStation(app, lang) {
  const desc = app.description?.[lang] || app.description?.en || "";
  return `<a class="station" data-slug="${esc(app.slug)}" href="${esc(app.slug)}/" aria-label="${esc(app.name)} — ${esc(desc)}">
    <div class="apparatus-bay">
      ${renderStationSVG(app)}
    </div>
    <div class="table-strip" aria-hidden="true"></div>
    <div class="station-apron">
      <div class="plaque">
        <div class="plaque-head">
          <h3 class="plaque-title"><span class="plaque-swatch" aria-hidden="true"></span><span>${esc(app.name)}</span></h3>
          <span class="plaque-go" aria-hidden="true" title="${esc(t("openLab"))}">↗</span>
        </div>
        <p class="plaque-desc">${esc(desc)}</p>
        <div class="plaque-tags">${renderTags(app)}</div>
      </div>
    </div>
  </a>`;
}

function renderBench(table, index, lang) {
  const count = table.apps.length;
  // On desktop, tables with 2 or 3 stations get a muted non-clickable tabletop clutter bay
  // so every bench looks authentically lived-in while keeping clickability unmistakably clear.
  const hasClutter = count === 2 || count === 3;
  const surfaceCls =
    count === 3
      ? "bench-surface has-clutter-3"
      : count === 2
        ? "bench-surface has-clutter-2"
        : count === 1
          ? "bench-surface cols-1"
          : "bench-surface";

  const title = table.title?.[lang] || table.title?.en || table.id;
  const note = table.note?.[lang] || table.note?.en || "";
  const stationsHtml = table.apps.map((a) => renderStation(a, lang)).join("");
  const clutterHtml = hasClutter ? renderTableClutterProp(index) : "";

  return `<section class="bench" id="${esc(table.anchorId)}" aria-labelledby="title-${esc(table.tableId)}">
    <div class="bench-wall">
      <div class="bench-sign">
        <span class="bench-code">${esc(table.displayCode)}</span>
        <div class="bench-heading">
          <h2 class="bench-title" id="title-${esc(table.tableId)}">${esc(title)}</h2>
          <p class="bench-note">${esc(note)}</p>
        </div>
      </div>
      ${renderBenchWallDecor(table.scenery)}
    </div>
    <div class="${surfaceCls}">
      ${stationsHtml}
      ${clutterHtml}
    </div>
    ${renderBenchUnderframe(index)}
  </section>`;
}

function renderCompactList(filteredApps, lang) {
  const benchLookup = new Map([...BENCHES, NEW_ARRIVALS_BENCH].map((b) => [b.id, b]));
  return `<div class="lab-list">${filteredApps
    .map((app) => {
      const desc = app.description?.[lang] || app.description?.en || "";
      const b = benchLookup.get(benchIdForApp(app));
      const bTitle = b ? `${b.code} · ${b.title?.[lang] || b.title?.en}` : "";
      return `<a class="list-item card" data-slug="${esc(app.slug)}" href="${esc(app.slug)}/">
        <div class="list-head">
          <h2>${esc(app.name)}</h2>
          <span class="plaque-go" aria-hidden="true">↗</span>
        </div>
        ${bTitle ? `<span class="list-bench">${esc(bTitle)}</span>` : ""}
        <p>${esc(desc)}</p>
        <div class="plaque-tags">${renderTags(app)}</div>
      </a>`;
    })
    .join("")}</div>`;
}

function updateFilterCounts() {
  const counts = {
    all: apps.length,
    physics: apps.filter((a) => matchesFilter(a, "physics")).length,
    mathematics: apps.filter((a) => matchesFilter(a, "mathematics")).length,
    xr: apps.filter((a) => matchesFilter(a, "xr")).length,
  };
  for (const btn of document.querySelectorAll("#filter button")) {
    const v = btn.dataset.v;
    const key = v === "mathematics" ? "f.math" : `f.${v}`;
    btn.innerHTML = `${esc(t(key))}<span class="count-badge">(${counts[v] ?? 0})</span>`;
  }
}

function setupAnimationObserver() {
  if (observer) observer.disconnect();
  const stations = document.querySelectorAll(".station");
  if (!stations.length || typeof IntersectionObserver === "undefined") return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle("paused", !entry.isIntersecting);
      }
    },
    { rootMargin: "140px 0px" },
  );
  for (const el of stations) observer.observe(el);
}

function render() {
  const lang = getLang();
  updateFilterCounts();

  const q = query.trim().toLowerCase();
  const filtered = apps.filter((a) => matchesFilter(a, filter) && matchesQuery(a, q));
  const tables = buildBenchTables(filtered);

  const jumpEl = document.getElementById("benchJump");
  if (viewMode === "room" && tables.length > 1) {
    jumpEl.hidden = false;
    jumpEl.innerHTML =
      `<span class="bench-jump-label">${esc(t("benchesLabel"))}</span>` +
      tables
        .map(
          (tb) =>
            `<a class="jump-pill" href="#${esc(tb.anchorId)}"><b>${esc(tb.displayCode)}</b>${esc(tb.title?.[lang] || tb.title?.en)}</a>`,
        )
        .join("");
  } else {
    jumpEl.hidden = true;
    jumpEl.innerHTML = "";
  }

  const stage = document.getElementById("labStage");
  if (!filtered.length) {
    stage.innerHTML = `<div class="empty-state card">
      <p>${esc(t("empty"))}</p>
      <button type="button" class="btn primary" id="resetFiltersBtn">${esc(t("resetFilters"))}</button>
    </div>`;
    document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
      filter = "all";
      query = "";
      const input = document.getElementById("searchInput");
      if (input) input.value = "";
      document.getElementById("searchClear").hidden = true;
      for (const b of document.querySelectorAll("#filter button")) {
        b.classList.toggle("on", b.dataset.v === "all");
        b.setAttribute("aria-pressed", String(b.dataset.v === "all"));
      }
      render();
    });
    return;
  }

  if (viewMode === "list") {
    stage.innerHTML = renderCompactList(filtered, lang);
  } else {
    stage.innerHTML = `<div class="lab-room">${tables.map((tb, i) => renderBench(tb, i, lang)).join("")}</div>`;
    setupAnimationObserver();
  }
}

function wireUI() {
  // Overhead lab wall scenery (lamps, chalkboard, wall clock, shelves)
  const wallHost = document.getElementById("roomWallHost");
  if (wallHost) wallHost.innerHTML = renderRoomCeilingScenery();

  // Filter buttons
  const filterGroup = document.getElementById("filter");
  filterGroup.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    filter = btn.dataset.v;
    for (const x of filterGroup.querySelectorAll("button")) {
      x.classList.toggle("on", x === btn);
      x.setAttribute("aria-pressed", String(x === btn));
    }
    render();
  });

  // View mode toggle (Lab room vs Compact index)
  const viewGroup = document.getElementById("viewToggle");
  viewGroup.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    viewMode = btn.dataset.v;
    for (const x of viewGroup.querySelectorAll("button")) {
      x.classList.toggle("on", x === btn);
      x.setAttribute("aria-pressed", String(x === btn));
    }
    render();
  });

  // Instant search
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    searchClear.hidden = !query;
    render();
  });
  searchClear.addEventListener("click", () => {
    query = "";
    searchInput.value = "";
    searchClear.hidden = true;
    searchInput.focus();
    render();
  });

  // Pause animations when tab is hidden
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("tab-hidden", document.hidden);
  });

  // Populate small icons on view mode toggle buttons
  const roomBtn = viewGroup.querySelector('[data-v="room"]');
  const listBtn = viewGroup.querySelector('[data-v="list"]');
  if (roomBtn) roomBtn.insertAdjacentHTML("afterbegin", icon("layers"));
  if (listBtn) listBtn.insertAdjacentHTML("afterbegin", icon("table"));
}

wireUI();
onLang(render);

fetch("apps.json")
  .then((r) => r.json())
  .then((data) => {
    apps = data.apps || [];
    injectStationPalettes(apps);
    render();
  });
