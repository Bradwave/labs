// Labs · home/main.js
// Scalable multi-room 3D pixel-art isometric laboratory (Three.js r128):
// - Cozy themed Wings (Physics, Mathematics, XR Studio) so every room stays readable & fast
// - Semantic zoom for labels: clean bench signs in overview (apparatus titles on hover/search),
//   fading seamlessly to crisp apparatus titles when zoomed in (zero overlap)
// - Global cross-room search with auto-wing switching & smooth camera fly-to
// - World-locked zoom-scaled pixelation, anti-shimmer texel snapping, sprite-stacked props,
//   and automatic pixel-CRT fallback consoles for future apps.

import { initKit, t, getLang, onLang, isDark, onTheme } from "../kit/kit.js";
import { ROOMS, appsInRoom, locateApp, buildRoomLayout } from "./benches.js";
import { createApparatus3D } from "./apparatus3d.js";
import { buildLabRoom3D } from "./room3d.js";
import { createPixelPipeline } from "./pixelpass.js";

const strings = {
  it: {
    searchPlaceholder: "Cerca in tutto il lab… (es. urti, orbita, XR, frattali)",
    searchLabel: "Cerca tra tutti i laboratori",
    searchClear: "Cancella ricerca",
    roomSelector: "Selettore sala",
    prevRoom: "Sala precedente",
    nextRoom: "Sala successiva",
    overviewBtn: "↩ Vista sala",
    rotateLeft: "Ruota a sinistra",
    rotateRight: "Ruota a destra",
    pixelScale: "Dimensione pixel",
    countAll: "{n} apparati",
    countFiltered: "{shown} di {total}",
    controlsHint: "Trascina per esplorare · Scorri per zoom · Clicca un banco o un apparato",
    controlsTouch: "Trascina per esplorare · Pizzica per zoom · Tocca un banco o un apparato",
    noResults: "Nessun apparato trovato",
    webglFallback: "Il laboratorio 3D richiede WebGL. Scegli un laboratorio qui sotto:",
    title: "Laboratori di matematica e fisica",
    about:
      "Ogni laboratorio è una piccola app che si apre nel browser e si può installare. Tutto avviene sul dispositivo: nessun dato viene inviato.",
    aboutRoom:
      "Il laboratorio è organizzato in sale tematiche. Usa il selettore in basso per cambiare sala, clicca un banco o scorri per avvicinarti e vedere i titoli degli apparati, usa la ricerca globale per volare in qualsiasi sala, e clicca qualsiasi apparato colorato per aprirlo.",
    foot: "Codice libero (MIT) su",
  },
  en: {
    searchPlaceholder: "Search all rooms… (e.g. orbit, collision, XR, fractal)",
    searchLabel: "Search all labs",
    searchClear: "Clear search",
    roomSelector: "Room selector",
    prevRoom: "Previous room",
    nextRoom: "Next room",
    overviewBtn: "↩ Room view",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    pixelScale: "Pixel scale",
    countAll: "{n} apparatuses",
    countFiltered: "{shown} of {total}",
    controlsHint: "Drag to pan · Right-drag to orbit · Scroll to zoom · Click a bench or apparatus",
    controlsTouch: "Drag to explore · Pinch to zoom · Tap a bench or apparatus",
    noResults: "No matching apparatus",
    webglFallback: "The 3D laboratory requires WebGL. Choose a lab below:",
    title: "Math and physics labs",
    about:
      "Each lab is a small app that opens in the browser and can be installed. Everything runs on the device: no data is sent anywhere.",
    aboutRoom:
      "The laboratory is organized into themed rooms. Use the bottom selector to switch rooms, click a bench or zoom in to reveal apparatus titles, use global search to jump to any room, and click any coloured apparatus to open it.",
    foot: "Open source (MIT) at",
  },
};

const PIXEL_PRESETS = [
  { label: "PX", mult: 1.0 },
  { label: "PX+", mult: 1.32 },
  { label: "PX−", mult: 0.78 },
];
let pixelPresetIdx = 0;

function cyclePixelPreset() {
  pixelPresetIdx = (pixelPresetIdx + 1) % PIXEL_PRESETS.length;
  if (pixelPass) pixelPass.setPixelSize(computePixelSize(camState.zoom));
}

initKit({
  slug: "labs",
  name: "Labs",
  version: "0.5.0",
  strings,
  sw: false,
  landing: "https://matephis.com",
  menu: [
    {
      icon: "palette",
      label: "pixelScale",
      value: () => PIXEL_PRESETS[pixelPresetIdx].label,
      keepOpen: true,
      onClick: cyclePixelPreset,
    },
  ],
});

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const reducedMotionQuery =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const isReducedMotion = () => !!(reducedMotionQuery && reducedMotionQuery.matches);

const ISO_YAW = Math.PI / 4;
const ISO_PITCH = Math.atan(1 / Math.sqrt(2));
const CAM_RADIUS = 38;
const BASE_FRUSTUM_H = 19.5;

let apps = [];
let activeRoomId = ROOMS[0].id;
let layout = null;
let stations = [];
let benchPins = [];
let hitTargets = [];
let room3d = null;
let roomStage = null;
let pixelPass = null;
let sceneRef = null;
let canvasRef = null;
let pinLayerRef = null;

// Tactile 3D diorama room-switch animation state
const roomAnim = {
  phase: "idle", // "idle" | "out" | "in"
  t: 0,
  dir: 1,
  nextRoomId: null,
  afterSwap: null,
};

let query = "";
let activeBenchId = "overview";
let hoveredSlug = null;
let focusedSlug = null;

const camState = {
  target: new THREE.Vector3(0, 0.9, -0.3),
  goalTarget: new THREE.Vector3(0, 0.9, -0.3),
  yaw: ISO_YAW,
  goalYaw: ISO_YAW,
  pitch: ISO_PITCH,
  goalPitch: ISO_PITCH,
  zoom: 1.0,
  goalZoom: 1.0,
  snapWeight: 1.0,
};

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
    .every((w) => hay.includes(w));
}

function getOverviewZoom() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const span = layout ? Math.max(layout.roomWidth, layout.roomDepth) : 18;
  const fit = 22.5 / Math.max(14.5, span);
  if (aspect < 0.8) return 0.62 * fit;
  if (aspect < 1.25) return 0.84 * fit;
  return 0.98 * fit;
}

function computePixelSize(zoom) {
  const baseZoom = Math.max(0.45, getOverviewZoom());
  const ratio = Math.max(0.5, zoom / baseZoom);
  const mobileFactor = window.innerWidth <= 600 ? 0.85 : 1.0;
  const presetMult = PIXEL_PRESETS[pixelPresetIdx].mult;
  const raw = 1.65 * Math.pow(ratio, 0.62) * mobileFactor * presetMult;
  return Math.max(1.35, Math.min(4.8, raw));
}

function flyToOverview(snapImmediate = false) {
  activeBenchId = "overview";
  camState.goalTarget.set(0, 0.85, -0.25);
  camState.goalYaw = ISO_YAW;
  camState.goalPitch = ISO_PITCH;
  camState.goalZoom = getOverviewZoom();
  if (snapImmediate) {
    camState.target.copy(camState.goalTarget);
    camState.yaw = camState.goalYaw;
    camState.pitch = camState.goalPitch;
    camState.zoom = camState.goalZoom;
  }
  updateZoneButtons();
}

function flyToBench(bench) {
  activeBenchId = bench.tableId;
  camState.goalTarget.set(bench.x, 1.3, bench.z);
  camState.goalYaw = 0.22;
  camState.goalPitch = 0.56;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camState.goalZoom = Math.max(getOverviewZoom() * 1.65, aspect < 0.85 ? 1.55 : 2.15);
  updateZoneButtons();
}

function flyToStation(st) {
  activeBenchId = "";
  const p = st.group.position;
  camState.goalTarget.set(p.x, p.y + 0.55, p.z);
  camState.goalYaw = ISO_YAW * 0.72;
  camState.goalPitch = 0.52;
  camState.goalZoom = Math.max(getOverviewZoom() * 2.1, 3.1);
  updateZoneButtons();
}

function flyToMatches(matched) {
  if (!matched.length) return;
  if (matched.length === 1) {
    flyToStation(matched[0]);
    return;
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const st of matched) {
    const p = st.group.position;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 4.5);
  activeBenchId = "";
  camState.goalTarget.set(cx, 1.2, cz);
  camState.goalPitch = ISO_PITCH;
  camState.goalZoom = Math.min(2.9, Math.max(getOverviewZoom() * 1.45, 16.0 / span));
  updateZoneButtons();
}

function setHovered(slug) {
  if (hoveredSlug === slug) return;
  hoveredSlug = slug;
  if (canvasRef) canvasRef.style.cursor = slug ? "pointer" : "grab";
  for (const st of stations) {
    const h = st.slug === slug || st.slug === focusedSlug;
    st.setHovered(h);
    st.pinEl.classList.toggle("hot", h);
  }
}

function renderRoomTabs(highlightId = activeRoomId) {
  const menu = document.getElementById("roomMenu");
  const codeEl = document.getElementById("rtCode");
  const nameEl = document.getElementById("rtName");
  const cntEl = document.getElementById("rtCnt");
  const lang = getLang();

  const curIdx = Math.max(0, ROOMS.findIndex((r) => r.id === highlightId));
  const cur = ROOMS[curIdx];
  if (codeEl) codeEl.textContent = String(curIdx + 1).padStart(2, "0");
  if (nameEl) nameEl.textContent = cur.title?.[lang] || cur.title?.en || cur.id;
  if (cntEl) cntEl.textContent = `(${appsInRoom(cur.id, apps).length})`;

  if (!menu) return;
  menu.innerHTML = ROOMS.map((r, i) => {
    const n = appsInRoom(r.id, apps).length;
    const label = r.title?.[lang] || r.title?.en || r.id;
    const num = String(i + 1).padStart(2, "0");
    const on = r.id === highlightId;
    return `<button type="button" class="rm-opt" role="option" data-room="${esc(r.id)}" aria-selected="${on}">
      <b class="rm-code">${num}</b>
      <span class="rm-name">${esc(label)}</span>
      <span class="rm-cnt">${n}</span>
    </button>`;
  }).join("");
}

function updateZoneButtons() {
  const btn = document.getElementById("overviewBtn");
  if (!btn) return;
  const awayFromOverview =
    activeBenchId !== "overview" ||
    Math.abs(camState.goalZoom - getOverviewZoom()) > 0.25 ||
    Math.hypot(camState.goalTarget.x, camState.goalTarget.z + 0.25) > 1.2;
  btn.hidden = !awayFromOverview;
}

function renderZoneBar() {
  updateZoneButtons();
}

function updateHudCount(globalMatchedCount = null) {
  const el = document.getElementById("hudCount");
  if (!el) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    el.textContent = t("countAll", { n: apps.length });
    el.classList.remove("empty");
    return;
  }
  const n = globalMatchedCount ?? apps.filter((a) => matchesQuery(a, q)).length;
  if (!n) {
    el.textContent = t("noResults");
    el.classList.add("empty");
  } else {
    el.textContent = t("countFiltered", { shown: n, total: apps.length });
    el.classList.remove("empty");
  }
}

function renderSearchTray(globalMatches) {
  const tray = document.getElementById("searchResults");
  if (!tray) return;
  const q = query.trim();
  if (!q || !globalMatches.length) {
    tray.hidden = true;
    tray.innerHTML = "";
    return;
  }
  const lang = getLang();
  const roomMap = new Map(ROOMS.map((r) => [r.id, r.title?.[lang] || r.title?.en || r.id]));
  tray.hidden = false;
  tray.innerHTML = globalMatches
    .slice(0, 8)
    .map((app) => {
      const { roomId } = locateApp(app);
      const pal = app.palette?.light || apps.find((b) => b.slug === app.sharesPaletteWith)?.palette?.light || {};
      const sw = pal.bg || "#8CCBEB";
      return `<a class="sr-item" href="${esc(app.slug)}/" data-slug="${esc(app.slug)}" data-room="${esc(roomId)}">
        <span class="sr-pip" style="background:${esc(sw)}"></span>
        <span class="sr-name">${esc(app.name)}</span>
        <span class="sr-room">${esc(roomMap.get(roomId) || roomId)}</span>
        <span class="sr-go" aria-hidden="true">↗</span>
      </a>`;
    })
    .join("");
}

/**
 * Mount a laboratory Wing into roomStage (disposing the previous wing cleanly).
 */
function loadRoom(roomId, snapCamera = false) {
  if (!sceneRef || !roomStage || !pinLayerRef) return;
  activeRoomId = roomId;
  hoveredSlug = null;
  focusedSlug = null;

  if (room3d) {
    room3d.dispose();
    room3d = null;
  }
  for (const st of stations) roomStage.remove(st.group);
  stations = [];
  benchPins = [];
  hitTargets = [];
  pinLayerRef.innerHTML = "";

  layout = buildRoomLayout(roomId, apps);
  room3d = buildLabRoom3D(sceneRef, layout, getLang());
  roomStage.add(room3d.root);
  const darkNow = isDark();
  room3d.applyTheme(darkNow);
  if (pixelPass) pixelPass.setTheme(darkNow);

  const lang = getLang();
  for (const bench of layout.benches) {
    const bPin = document.createElement("button");
    bPin.type = "button";
    bPin.className = "bench-pin";
    const bTitle = bench.title?.[lang] || bench.title?.en || bench.id;
    bPin.innerHTML = `<b>${esc(bench.displayCode)}</b><span>${esc(bTitle)}</span>`;
    bPin.addEventListener("click", () => flyToBench(bench));
    pinLayerRef.append(bPin);
    benchPins.push({
      bench,
      el: bPin,
      anchor: new THREE.Vector3(bench.x, 0.56, bench.z + bench.depth / 2 + 0.04),
    });

    for (const slot of bench.slots) {
      const st = createApparatus3D(slot.app, apps);
      st.group.position.set(slot.worldX, slot.worldY, slot.worldZ);
      roomStage.add(st.group);
      hitTargets.push(st.hitBox);

      const pin = document.createElement("a");
      pin.className = "lab-pin";
      pin.href = `${slot.app.slug}/`;
      pin.dataset.slug = slot.app.slug;
      pin.style.setProperty("--pin-brand", st.brandHex);
      pin.style.setProperty("--pin-ink", st.inkHex);
      const desc = slot.app.description?.[lang] || slot.app.description?.en || "";
      pin.setAttribute("aria-label", `${slot.app.name} — ${desc}`);
      pin.innerHTML = `<span class="pin-pip" aria-hidden="true"></span><span class="pin-txt">${esc(slot.app.name)}</span><span class="pin-go" aria-hidden="true">↗</span>`;

      pin.addEventListener("mouseenter", () => setHovered(st.slug));
      pin.addEventListener("mouseleave", () => setHovered(null));
      pin.addEventListener("focus", () => {
        focusedSlug = st.slug;
        setHovered(st.slug);
        flyToStation(st);
      });
      pin.addEventListener("blur", () => {
        focusedSlug = null;
        setHovered(null);
      });

      pinLayerRef.append(pin);
      st.pinEl = pin;
      st.anchor = new THREE.Vector3(slot.worldX, slot.worldY + 0.04, slot.worldZ + 0.72);
      stations.push(st);
    }
  }

  renderRoomTabs();
  renderZoneBar();
  flyToOverview(snapCamera);
}

/**
 * Animated 3D diorama swap between laboratory wings (slides & dips out, swaps room,
 * glides in with staggered apparatus pop-in; instant under prefers-reduced-motion).
 */
function switchRoom(targetRoomId, afterSwap = null) {
  if (targetRoomId === activeRoomId && roomAnim.phase === "idle") {
    afterSwap?.();
    return;
  }
  if (isReducedMotion()) {
    loadRoom(targetRoomId, true);
    afterSwap?.();
    return;
  }
  const curIdx = ROOMS.findIndex((r) => r.id === activeRoomId);
  const nextIdx = ROOMS.findIndex((r) => r.id === targetRoomId);
  roomAnim.dir = nextIdx >= curIdx ? 1 : -1;
  roomAnim.nextRoomId = targetRoomId;
  roomAnim.afterSwap = afterSwap;
  renderRoomTabs(targetRoomId);
  pinLayerRef?.classList.add("swapping");
  if (roomAnim.phase !== "out") {
    roomAnim.phase = "out";
    roomAnim.t = 0;
  }
}

function applySearch(shouldFly = true) {
  const q = query.trim().toLowerCase();
  const globalMatches = q ? apps.filter((a) => matchesQuery(a, q)) : [];
  renderSearchTray(globalMatches);
  updateHudCount(globalMatches.length);

  // If search matches exist ONLY in another room, animate smoothly into that wing!
  if (q && globalMatches.length) {
    const inCurrent = globalMatches.some((a) => locateApp(a).roomId === activeRoomId);
    if (!inCurrent) {
      const targetRoomId = locateApp(globalMatches[0]).roomId;
      switchRoom(targetRoomId, () => applySearch(shouldFly));
      return;
    }
  }

  const matchedHere = [];
  for (const st of stations) {
    const ok = matchesQuery(st.app, q);
    if (!q) {
      st.setSearchState("normal");
      st.pinEl.classList.remove("match", "dim");
    } else if (ok) {
      st.setSearchState("match");
      st.pinEl.classList.add("match");
      st.pinEl.classList.remove("dim");
      matchedHere.push(st);
    } else {
      st.setSearchState("dim");
      st.pinEl.classList.add("dim");
      st.pinEl.classList.remove("match");
    }
  }

  if (shouldFly) {
    if (!q) flyToOverview();
    else if (matchedHere.length) flyToMatches(matchedHere);
  }
}

function renderFallbackLinks(allApps) {
  const stage = document.getElementById("sceneWrap");
  stage.innerHTML = `<div class="webgl-fallback card">
    <p>${esc(t("webglFallback"))}</p>
    <div class="fb-grid">${allApps
      .map((a) => `<a class="btn" href="${esc(a.slug)}/">${esc(a.name)} ↗</a>`)
      .join("")}</div>
  </div>`;
}

function bootScene(allApps) {
  const wrap = document.getElementById("sceneWrap");
  canvasRef = document.getElementById("labCanvas");
  pinLayerRef = document.getElementById("pinLayer");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef, antialias: false, powerPreference: "high-performance" });
  } catch (e) {
    renderFallbackLinks(allApps);
    return;
  }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  sceneRef = new THREE.Scene();
  roomStage = new THREE.Group();
  sceneRef.add(roomStage);
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 4, 88);

  pixelPass = createPixelPipeline(renderer, 1.65);
  loadRoom(ROOMS[0].id, true);
  updateHudCount();

  let frustumW = 24;
  let frustumH = BASE_FRUSTUM_H;
  function resize() {
    const w = wrap.clientWidth || window.innerWidth;
    const h = wrap.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    frustumH = BASE_FRUSTUM_H;
    frustumW = frustumH * aspect;
    camera.left = -frustumW / 2;
    camera.right = frustumW / 2;
    camera.top = frustumH / 2;
    camera.bottom = -frustumH / 2;
    camera.updateProjectionMatrix();
    pixelPass.resize(w, h);
  }
  resize();
  window.addEventListener("resize", resize);

  // Scalable Room Switcher: ◀ [ Kit Drop-Up Room Menu ] ▶ (triggers tactile 3D diorama swap)
  const roomTrigger = document.getElementById("roomTrigger");
  const roomMenu = document.getElementById("roomMenu");
  const roomPicker = document.getElementById("roomPicker");

  const closeRoomMenu = (refocus = false) => {
    if (!roomMenu || roomMenu.hidden) return;
    roomMenu.hidden = true;
    roomTrigger?.setAttribute("aria-expanded", "false");
    if (refocus) roomTrigger?.focus({ preventScroll: true });
  };
  const openRoomMenu = () => {
    if (!roomMenu) return;
    roomMenu.hidden = false;
    roomTrigger?.setAttribute("aria-expanded", "true");
    const activeOpt = roomMenu.querySelector('[aria-selected="true"]') || roomMenu.querySelector(".rm-opt");
    activeOpt?.focus({ preventScroll: true });
  };

  const stepRoom = (delta) => {
    closeRoomMenu(false);
    const baseId = roomAnim.phase === "out" && roomAnim.nextRoomId ? roomAnim.nextRoomId : activeRoomId;
    const idx = ROOMS.findIndex((r) => r.id === baseId);
    const next = ROOMS[(idx + delta + ROOMS.length) % ROOMS.length];
    switchRoom(next.id, () => {
      if (query.trim()) applySearch(false);
    });
  };
  document.getElementById("prevRoomBtn")?.addEventListener("click", () => stepRoom(-1));
  document.getElementById("nextRoomBtn")?.addEventListener("click", () => stepRoom(1));

  roomTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (roomMenu.hidden) openRoomMenu();
    else closeRoomMenu(false);
  });
  roomMenu?.addEventListener("click", (e) => {
    const opt = e.target.closest(".rm-opt[data-room]");
    if (!opt) return;
    closeRoomMenu(true);
    switchRoom(opt.dataset.room, () => {
      if (query.trim()) applySearch(false);
    });
  });
  roomMenu?.addEventListener("keydown", (e) => {
    const opts = [...roomMenu.querySelectorAll(".rm-opt")];
    const i = opts.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      opts[(i + 1) % opts.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      opts[(i - 1 + opts.length) % opts.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      opts[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      opts[opts.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeRoomMenu(true);
    }
  });
  document.addEventListener("click", (e) => {
    if (roomMenu && !roomMenu.hidden && !roomPicker?.contains(e.target)) closeRoomMenu(false);
  });
  document.getElementById("overviewBtn")?.addEventListener("click", () => flyToOverview());

  // Search tray hover preview (if match is in active room, spotlight it!)
  document.getElementById("searchResults")?.addEventListener("mouseover", (e) => {
    const item = e.target.closest(".sr-item");
    if (!item) return;
    if (item.dataset.room === activeRoomId) setHovered(item.dataset.slug);
  });
  document.getElementById("searchResults")?.addEventListener("mouseout", () => setHovered(null));

  // ── CAMERA CONTROLS ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const keys = new Set();

  let pointerMode = null;
  let lastX = 0;
  let lastY = 0;
  let dragMoved = 0;
  const activeTouches = new Map();
  let lastPinchDist = 0;
  let lastPinchAngle = 0;

  function clampCamera() {
    if (!layout) return;
    const b = layout.bounds;
    camState.goalTarget.x = Math.max(b.minX + 1.5, Math.min(b.maxX - 1.5, camState.goalTarget.x));
    camState.goalTarget.z = Math.max(b.minZ + 1.5, Math.min(b.maxZ - 1.5, camState.goalTarget.z));
    camState.goalPitch = Math.max(0.32, Math.min(1.15, camState.goalPitch));
    camState.goalZoom = Math.max(0.55, Math.min(4.2, camState.goalZoom));
  }

  function panByPixels(dx, dy) {
    const worldPerPx = frustumH / (Math.max(1, wrap.clientHeight) * camState.zoom);
    const sinY = Math.sin(camState.yaw);
    const cosY = Math.cos(camState.yaw);
    const pitchBoost = 1 / Math.max(0.35, Math.sin(camState.pitch));
    camState.goalTarget.x += (-dx * cosY - dy * sinY * pitchBoost) * worldPerPx;
    camState.goalTarget.z += (dx * sinY - dy * cosY * pitchBoost) * worldPerPx;
    activeBenchId = "";
    updateZoneButtons();
    clampCamera();
  }

  function pickAtClient(cx, cy) {
    const r = canvasRef.getBoundingClientRect();
    ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object.userData.slug : null;
  }

  canvasRef.addEventListener("contextmenu", (e) => e.preventDefault());

  canvasRef.addEventListener("pointerdown", (e) => {
    canvasRef.setPointerCapture(e.pointerId);
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeTouches.size === 2) {
      pointerMode = "pinch";
      const [a, b] = [...activeTouches.values()];
      lastPinchDist = Math.hypot(b.x - a.x, b.y - a.y);
      lastPinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
      dragMoved = 99;
      return;
    }

    pointerMode = e.button === 2 || e.shiftKey || e.altKey ? "orbit" : "pan";
    lastX = e.clientX;
    lastY = e.clientY;
    dragMoved = 0;
    canvasRef.style.cursor = "grabbing";
  });

  canvasRef.addEventListener("pointermove", (e) => {
    if (activeTouches.has(e.pointerId)) {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointerMode === "pinch" && activeTouches.size === 2) {
      const [a, b] = [...activeTouches.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (lastPinchDist > 0) camState.goalZoom *= d / Math.max(10, lastPinchDist);
      let dAng = ang - lastPinchAngle;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      camState.goalYaw -= dAng * 0.85;
      lastPinchDist = d;
      lastPinchAngle = ang;
      clampCamera();
      updateZoneButtons();
      return;
    }

    if (pointerMode === "pan") {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragMoved += Math.hypot(dx, dy);
      panByPixels(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    if (pointerMode === "orbit") {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragMoved += Math.hypot(dx, dy);
      camState.goalYaw -= dx * 0.0065;
      camState.goalPitch += dy * 0.0055;
      clampCamera();
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    if (e.pointerType !== "touch") {
      setHovered(pickAtClient(e.clientX, e.clientY));
    }
  });

  function endPointer(e) {
    const wasTap = pointerMode === "pan" && dragMoved < 8 && activeTouches.size <= 1;
    activeTouches.delete(e.pointerId);
    if (activeTouches.size === 0) {
      pointerMode = null;
      canvasRef.style.cursor = hoveredSlug ? "pointer" : "grab";
    }
    if (wasTap) {
      const slug = pickAtClient(e.clientX, e.clientY);
      if (slug) window.location.href = `${slug}/`;
    }
  }
  canvasRef.addEventListener("pointerup", endPointer);
  canvasRef.addEventListener("pointercancel", endPointer);

  canvasRef.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      camState.goalZoom *= 1 - Math.sign(e.deltaY) * Math.min(0.15, Math.abs(e.deltaY) * 0.0014);
      clampCamera();
      updateZoneButtons();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      keys.add(k);
    } else if (k === "r" || k === "escape") {
      flyToOverview();
    } else if (k === "q") {
      camState.goalYaw -= Math.PI / 4;
    } else if (k === "e") {
      camState.goalYaw += Math.PI / 4;
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  document.getElementById("rotLeftBtn")?.addEventListener("click", () => {
    camState.goalYaw -= Math.PI / 4;
  });
  document.getElementById("rotRightBtn")?.addEventListener("click", () => {
    camState.goalYaw += Math.PI / 4;
  });

  onTheme((dark) => {
    room3d?.applyTheme(dark);
    pixelPass.setTheme(dark);
  });
  onLang((newLang) => {
    room3d?.updateLanguage(newLang);
    renderRoomTabs();
    renderZoneBar();
    updateHudCount();
    if (query.trim()) renderSearchTray(apps.filter((a) => matchesQuery(a, query.trim().toLowerCase())));
    for (const bp of benchPins) {
      const bTitle = bp.bench.title?.[newLang] || bp.bench.title?.en || bp.bench.id;
      bp.el.innerHTML = `<b>${esc(bp.bench.displayCode)}</b><span>${esc(bTitle)}</span>`;
    }
    for (const st of stations) {
      const desc = st.app.description?.[newLang] || st.app.description?.en || "";
      st.pinEl.setAttribute("aria-label", `${st.app.name} — ${desc}`);
    }
  });

  // ── MAIN RENDER LOOP WITH SEMANTIC ZOOM LABELS ──
  const proj = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const snappedTarget = new THREE.Vector3();

  let lastTime = performance.now();
  let elapsed = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) {
      lastTime = now;
      return;
    }
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const reduced = isReducedMotion();
    if (!reduced) elapsed += dt;

    if (keys.size) {
      const move = (dt * 9.5) / Math.max(0.5, camState.zoom);
      const sinY = Math.sin(camState.yaw);
      const cosY = Math.cos(camState.yaw);
      let mx = 0, mz = 0;
      if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
      if (keys.has("d") || keys.has("arrowright")) mx += 1;
      if (keys.has("w") || keys.has("arrowup")) mz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) mz += 1;
      if (mx || mz) {
        camState.goalTarget.x += (mx * cosY + mz * sinY) * move;
        camState.goalTarget.z += (-mx * sinY + mz * cosY) * move;
        activeBenchId = "";
        updateZoneButtons();
        clampCamera();
      }
    }

    const ease = Math.min(1, dt * 8.0);
    camState.target.lerp(camState.goalTarget, ease);
    camState.yaw += (camState.goalYaw - camState.yaw) * ease;
    camState.pitch += (camState.goalPitch - camState.pitch) * ease;
    camState.zoom += (camState.goalZoom - camState.zoom) * ease;

    camera.zoom = camState.zoom;
    camera.updateProjectionMatrix();

    pixelPass.setPixelSize(computePixelSize(camState.zoom));

    const horiz = Math.cos(camState.pitch) * CAM_RADIUS;
    camera.position.set(
      camState.target.x + Math.sin(camState.yaw) * horiz,
      camState.target.y + Math.sin(camState.pitch) * CAM_RADIUS,
      camState.target.z + Math.cos(camState.yaw) * horiz,
    );
    camera.lookAt(camState.target);
    camera.updateMatrixWorld();

    const zoomOrOrbitActive =
      roomAnim.phase !== "idle" ||
      Math.abs(camState.goalZoom - camState.zoom) > 0.003 ||
      Math.abs(camState.goalYaw - camState.yaw) > 0.002 ||
      Math.abs(camState.goalPitch - camState.pitch) > 0.002 ||
      pointerMode === "pinch" ||
      pointerMode === "orbit";
    const targetSnap = zoomOrOrbitActive ? 0 : 1;
    camState.snapWeight += (targetSnap - camState.snapWeight) * Math.min(1, dt * (zoomOrOrbitActive ? 18 : 7));

    camera.matrixWorld.extractBasis(camRight, camUp, camFwd);

    if (camState.snapWeight > 0.01) {
      const { width: pxW, height: pxH } = pixelPass.getResolution();
      const texelW = frustumW / (camera.zoom * Math.max(1, pxW));
      const texelH = frustumH / (camera.zoom * Math.max(1, pxH));
      const rx = camState.target.dot(camRight);
      const ry = camState.target.dot(camUp);
      const snapDx = (Math.round(rx / texelW) * texelW - rx) * camState.snapWeight;
      const snapDy = (Math.round(ry / texelH) * texelH - ry) * camState.snapWeight;

      snappedTarget.copy(camState.target).addScaledVector(camRight, snapDx).addScaledVector(camUp, snapDy);
      camera.position.addScaledVector(camRight, snapDx).addScaledVector(camUp, snapDy);
      camera.lookAt(snappedTarget);
      camera.updateMatrixWorld();
    }

    room3d?.update(elapsed, reduced);
    for (const st of stations) st.update(elapsed, dt, reduced);

    // ── 3D DIORAMA ROOM SWAP ANIMATION ──
    if (roomAnim.phase === "out") {
      roomAnim.t += dt;
      const u = Math.min(1, roomAnim.t / 0.19);
      const easeIn = u * u * u;
      const slideDist = -roomAnim.dir * easeIn * 14.5;
      roomStage.position.set(camRight.x * slideDist, -easeIn * 1.25, camRight.z * slideDist);
      roomStage.rotation.y = -roomAnim.dir * easeIn * 0.11;
      roomStage.scale.setScalar(1 - easeIn * 0.08);
      if (u >= 1) {
        const nextId = roomAnim.nextRoomId;
        const cb = roomAnim.afterSwap;
        roomAnim.afterSwap = null;
        loadRoom(nextId, true);
        cb?.();
        roomAnim.phase = "in";
        roomAnim.t = 0;
        const enterDist = roomAnim.dir * 14.5;
        roomStage.position.set(camRight.x * enterDist, -1.15, camRight.z * enterDist);
        roomStage.rotation.y = roomAnim.dir * 0.1;
        roomStage.scale.setScalar(0.92);
      }
    } else if (roomAnim.phase === "in") {
      roomAnim.t += dt;
      const u = Math.min(1, roomAnim.t / 0.34);
      const inv = 1 - u;
      const easeOut = 1 - inv * inv * inv;
      const slideDist = roomAnim.dir * (1 - easeOut) * 14.5;
      roomStage.position.set(camRight.x * slideDist, -(1 - easeOut) * 1.15, camRight.z * slideDist);
      roomStage.rotation.y = roomAnim.dir * (1 - easeOut) * 0.1;
      roomStage.scale.setScalar(0.92 + 0.08 * easeOut);

      // Charming staggered bounce pop-in for each apparatus on the incoming benches!
      for (let i = 0; i < stations.length; i++) {
        const delay = Math.min(0.32, i * 0.032);
        const pu = Math.max(0, Math.min(1, (u - delay) / Math.max(0.25, 1 - delay)));
        const pop = 0.55 + 0.45 * (1 - Math.pow(1 - pu, 3)) + Math.sin(pu * Math.PI) * 0.09 * (1 - pu);
        stations[i].group.scale.setScalar(pop);
      }

      if (u >= 1) {
        roomStage.position.set(0, 0, 0);
        roomStage.rotation.set(0, 0, 0);
        roomStage.scale.setScalar(1);
        for (const st of stations) st.group.scale.setScalar(1);
        roomAnim.phase = "idle";
        pinLayerRef?.classList.remove("swapping");
      }
    }

    pixelPass.render(sceneRef, camera);

    // ── SEMANTIC ZOOM LABEL VISIBILITY (Zero overlap!) ──
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const zoomedIn = camState.zoom >= getOverviewZoom() * 1.38;
    const hasSearch = query.trim().length > 0;
    const isSwapping = roomAnim.phase !== "idle";

    for (const bp of benchPins) {
      proj.copy(bp.anchor).project(camera);
      const inView =
        !isSwapping &&
        !zoomedIn &&
        !hasSearch &&
        proj.z > -1 &&
        proj.z < 1 &&
        proj.x > -1.06 &&
        proj.x < 1.06 &&
        proj.y > -1.06 &&
        proj.y < 1.06;
      if (!inView) {
        bp.el.classList.add("hidden-lod");
        continue;
      }
      const sx = (proj.x * 0.5 + 0.5) * w;
      const sy = (-proj.y * 0.5 + 0.5) * h;
      bp.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      bp.el.classList.remove("hidden-lod");
      bp.el.classList.toggle("active", activeBenchId === bp.bench.tableId);
      bp.el.style.zIndex = String(Math.max(1, Math.round((1 - proj.z) * 10)));
    }

    for (const st of stations) {
      const isHot = st.slug === hoveredSlug || st.slug === focusedSlug;
      const isMatch = st.pinEl.classList.contains("match");
      const shouldShow = zoomedIn || isHot || isMatch;

      proj.copy(st.anchor).project(camera);
      const inView =
        shouldShow &&
        proj.z > -1 &&
        proj.z < 1 &&
        proj.x > -1.08 &&
        proj.x < 1.08 &&
        proj.y > -1.08 &&
        proj.y < 1.08;
      if (!inView) {
        st.pinEl.classList.add("hidden-lod");
        continue;
      }
      const sx = (proj.x * 0.5 + 0.5) * w;
      const sy = (-proj.y * 0.5 + 0.5) * h;
      st.pinEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -18%)`;
      st.pinEl.classList.remove("hidden-lod");
      st.pinEl.style.zIndex = isHot ? "35" : String(Math.round((1 - proj.z) * 20));
    }
  }

  requestAnimationFrame(tick);
}

// ── WIRE GLOBAL CROSS-ROOM SEARCH ──
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  searchClear.hidden = !query;
  applySearch(true);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = query.trim().toLowerCase();
    const matched = apps.filter((a) => matchesQuery(a, q));
    if (matched.length === 1) {
      window.location.href = `${matched[0].slug}/`;
    } else if (matched.length > 1) {
      applySearch(true);
    }
  } else if (e.key === "Escape") {
    query = "";
    searchInput.value = "";
    searchClear.hidden = true;
    searchInput.blur();
    applySearch(true);
  }
});
searchClear.addEventListener("click", () => {
  query = "";
  searchInput.value = "";
  searchClear.hidden = true;
  searchInput.focus();
  applySearch(true);
});

fetch("apps.json")
  .then((r) => r.json())
  .then((data) => {
    apps = data.apps || [];
    bootScene(apps);
  });
