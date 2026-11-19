// Labs · home/main.js
// Renders the 2D cutaway laboratory game scene from apps.json: multi-floor rooms,
// integrated animated apparatuses on continuous workbenches, diegetic titles, instant search,
// theme palette injection, IT/EN support and offscreen animation pausing.

import { initKit, t, getLang, onLang } from "../kit/kit.js";
import { buildLabFloors } from "./benches.js";
import { renderStationSVG } from "./stations.js";
import {
  renderRoofScenery,
  renderFloorBackdrop,
  renderTableProp,
  renderFloorUnderbench,
} from "./scenery.js";

const strings = {
  it: {
    searchPlaceholder: "Cerca un esperimento… (es. urti, orbita, XR, frattali)",
    searchLabel: "Cerca tra i laboratori",
    searchClear: "Cancella ricerca",
    countAll: "{n} apparati",
    countFiltered: "{shown} di {total}",
    swipe: "↔ scorri",
    empty: "Nessun apparato trovato per questa ricerca.",
    resetSearch: "Mostra tutto il laboratorio",
    foot: "Codice libero (MIT) su",
    footHint: "Fai clic su qualsiasi apparato colorato per aprire il laboratorio.",
    title: "Laboratori di matematica e fisica",
    about:
      "Ogni laboratorio è una piccola app che si apre nel browser e si può installare. Tutto avviene sul dispositivo: nessun dato viene inviato.",
    aboutRoom:
      "Esplora i piani del laboratorio: gli apparati colorati e animati sui banchi aprono i singoli esperimenti. Lampade, finestre, lavagna, mensole e sgabelli sono solo scenografia.",
  },
  en: {
    searchPlaceholder: "Search an experiment… (e.g. orbit, collision, XR, fractal)",
    searchLabel: "Search labs",
    searchClear: "Clear search",
    countAll: "{n} apparatuses",
    countFiltered: "{shown} of {total}",
    swipe: "↔ swipe",
    empty: "No apparatus matches your search.",
    resetSearch: "Show the whole lab",
    foot: "Open source (MIT) at",
    footHint: "Click any coloured apparatus on a bench to open its lab.",
    title: "Math and physics labs",
    about:
      "Each lab is a small app that opens in the browser and can be installed. Everything runs on the device: no data is sent anywhere.",
    aboutRoom:
      "Explore the floors of the laboratory: the coloured animated apparatuses on the benches open each experiment. Lamps, windows, chalkboard, shelves and stools are scenery only.",
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
let query = "";
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

function matchesQuery(app, q) {
  if (!q) return true;
  const hay = [
    app.name,
    app.slug,
    app.subject,
    app.subject === "physics" ? "fisica" : "matematica",
    app.kind,
    app.kind === "xr" ? "xr vr ar virtual reality realtà virtuale aumentata" : "",
    app.description?.it,
    app.description?.en,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function renderStation(app, lang) {
  const desc = app.description?.[lang] || app.description?.en || "";
  return `<a class="station" data-slug="${esc(app.slug)}" href="${esc(app.slug)}/" aria-label="${esc(app.name)} — ${esc(desc)}">
    <div class="apparatus-stage">
      <div class="game-reticle" aria-hidden="true">
        <span class="game-pointer"></span>
        <i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i>
      </div>
      ${renderStationSVG(app)}
    </div>
    <div class="station-tag-slot">
      <span class="station-tag">
        <span class="station-pip" aria-hidden="true"></span>
        <span class="station-name">${esc(app.name)}</span>
        <span class="station-arrow" aria-hidden="true">↗</span>
      </span>
    </div>
  </a>`;
}

function renderFloor(room, index, total, lang) {
  const count = room.apps.length;
  const title = room.title?.[lang] || room.title?.en || room.id;
  const stationsHtml = room.apps.map((a) => renderStation(a, lang)).join("");
  // Add a muted non-clickable tabletop prop on floors with 2 or 3 stations for lived-in balance
  const propHtml = count === 2 || count === 3 ? renderTableProp(index) : "";
  const isLast = index === total - 1;

  return `<section class="lab-floor" aria-label="${esc(room.displayCode)} ${esc(title)}">
    <div class="room-sign" aria-hidden="true">
      <b>${esc(room.displayCode)}</b>
      <span>${esc(title)}</span>
      ${count > 1 ? `<span class="room-swipe-hint">${esc(t("swipe"))}</span>` : ""}
    </div>
    <div class="floor-scroll">
      <div class="floor-scene count-${count}">
        ${renderFloorBackdrop(room.roomTheme, index)}
        <div class="floor-benchtop-bar" aria-hidden="true"></div>
        <div class="floor-stations">
          ${stationsHtml}
          ${propHtml}
        </div>
        ${renderFloorUnderbench(index, isLast)}
      </div>
    </div>
  </section>`;
}

function setupAnimationObserver() {
  if (observer) observer.disconnect();
  const floors = document.querySelectorAll(".lab-floor");
  if (!floors.length || typeof IntersectionObserver === "undefined") return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle("paused", !entry.isIntersecting);
      }
    },
    { rootMargin: "160px 0px" },
  );
  for (const el of floors) observer.observe(el);
}

function render() {
  const lang = getLang();
  const q = query.trim().toLowerCase();
  const filtered = apps.filter((a) => matchesQuery(a, q));

  const statusEl = document.getElementById("hudCount");
  if (statusEl) {
    statusEl.textContent = q
      ? t("countFiltered", { shown: filtered.length, total: apps.length })
      : t("countAll", { n: apps.length });
  }

  const building = document.getElementById("labBuilding");
  if (!filtered.length) {
    building.innerHTML = `<div class="empty-state">
      <p>${esc(t("empty"))}</p>
      <button type="button" class="btn primary" id="resetSearchBtn">${esc(t("resetSearch"))}</button>
    </div>`;
    document.getElementById("resetSearchBtn")?.addEventListener("click", () => {
      query = "";
      const input = document.getElementById("searchInput");
      if (input) input.value = "";
      document.getElementById("searchClear").hidden = true;
      render();
    });
    return;
  }

  const floors = buildLabFloors(filtered);
  building.innerHTML = floors
    .map((room, i) => renderFloor(room, i, floors.length, lang))
    .join("");
  setupAnimationObserver();
}

function wireUI() {
  const roofHost = document.getElementById("roofHost");
  if (roofHost) roofHost.innerHTML = renderRoofScenery();

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

  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("tab-hidden", document.hidden);
  });
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
