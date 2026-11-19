// Labs · home/main.js
// Fullscreen interactive 3D game-scene laboratory built with Three.js r128:
// smooth damped pan/orbit/zoom camera, WASD walking, bench quick-cameras, search-driven
// camera fly-to, raycast 3D picking, projected accessible title pins, IT/EN and light/dark themes.

import { initKit, t, getLang, onLang, isDark, onTheme } from "../kit/kit.js";
import { buildLabLayout } from "./benches.js";
import { createApparatus3D } from "./apparatus3d.js";
import { buildLabRoom3D } from "./room3d.js";

const strings = {
  it: {
    searchPlaceholder: "Cerca un esperimento… (es. urti, orbita, XR, frattali)",
    searchLabel: "Cerca tra i laboratori",
    searchClear: "Cancella ricerca",
    overview: "Vista sala",
    rotateLeft: "Ruota a sinistra",
    rotateRight: "Ruota a destra",
    countAll: "{n} apparati",
    countFiltered: "{shown} di {total}",
    controlsHint: "Trascina per esplorare · Scorri per zoom · Clicca un apparato per aprirlo",
    controlsTouch: "Trascina per esplorare · Pizzica per zoom · Tocca un apparato",
    noResults: "Nessun apparato trovato",
    webglFallback: "Il laboratorio 3D richiede WebGL. Scegli un laboratorio qui sotto:",
    title: "Laboratori di matematica e fisica",
    about:
      "Ogni laboratorio è una piccola app che si apre nel browser e si può installare. Tutto avviene sul dispositivo: nessun dato viene inviato.",
    aboutRoom:
      "Esplora il laboratorio 3D: trascina per muoverti tra i banchi, ruota con tasto destro o i pulsanti in basso, usa la ricerca per volare subito a un esperimento, e fai clic su qualsiasi apparato colorato per aprirlo.",
    foot: "Codice libero (MIT) su",
  },
  en: {
    searchPlaceholder: "Search an experiment… (e.g. orbit, collision, XR, fractal)",
    searchLabel: "Search labs",
    searchClear: "Clear search",
    overview: "Room view",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    countAll: "{n} apparatuses",
    countFiltered: "{shown} of {total}",
    controlsHint: "Drag to pan · Right-drag to orbit · Scroll to zoom · Click any apparatus",
    controlsTouch: "Drag to explore · Pinch to zoom · Tap any apparatus",
    noResults: "No matching apparatus",
    webglFallback: "The 3D laboratory requires WebGL. Choose a lab below:",
    title: "Math and physics labs",
    about:
      "Each lab is a small app that opens in the browser and can be installed. Everything runs on the device: no data is sent anywhere.",
    aboutRoom:
      "Explore the 3D laboratory: drag to pan between benches, right-drag or use the bottom buttons to orbit, type in search to fly straight to an experiment, and click any coloured apparatus to open it.",
    foot: "Open source (MIT) at",
  },
};

initKit({
  slug: "labs",
  name: "Labs",
  version: "0.3.0",
  strings,
  sw: false,
  landing: "https://matephis.com",
});

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const reducedMotionQuery =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const isReducedMotion = () => !!(reducedMotionQuery && reducedMotionQuery.matches);

let apps = [];
let layout = null;
let stations = [];
let room3d = null;
let query = "";
let activeBenchId = "overview";
let hoveredSlug = null;

// Camera spherical-target controller state
const camState = {
  target: new THREE.Vector3(0, 0.9, -0.3),
  goalTarget: new THREE.Vector3(0, 0.9, -0.3),
  yaw: 0.46,
  goalYaw: 0.46,
  pitch: 0.62,
  goalPitch: 0.62,
  dist: 22.5,
  goalDist: 22.5,
  parallaxX: 0,
  parallaxY: 0,
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

function getOverviewDist() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const span = layout ? Math.max(layout.roomWidth, layout.roomDepth) : 21;
  return aspect < 0.85 ? span * 1.48 : aspect < 1.25 ? span * 1.18 : span * 0.98;
}

function flyToOverview() {
  activeBenchId = "overview";
  camState.goalTarget.set(0, 0.85, -0.4);
  camState.goalYaw = 0.46;
  camState.goalPitch = 0.62;
  camState.goalDist = getOverviewDist();
  updateZoneButtons();
}

function flyToBench(bench) {
  activeBenchId = bench.tableId;
  camState.goalTarget.set(bench.x, 1.35, bench.z);
  camState.goalYaw = 0.14;
  camState.goalPitch = 0.5;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camState.goalDist = aspect < 0.85 ? 11.4 : 8.4;
  updateZoneButtons();
}

function flyToStation(st) {
  activeBenchId = "";
  const p = st.group.position;
  camState.goalTarget.set(p.x, p.y + 0.55, p.z);
  camState.goalYaw = 0.22;
  camState.goalPitch = 0.42;
  camState.goalDist = 4.9;
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
  const span = Math.max(maxX - minX, maxZ - minZ, 4);
  activeBenchId = "";
  camState.goalTarget.set(cx, 1.2, cz);
  camState.goalPitch = 0.54;
  camState.goalDist = Math.min(26, Math.max(7.2, span * 1.15));
  updateZoneButtons();
}

function updateZoneButtons() {
  for (const b of document.querySelectorAll("#zoneBar button[data-zone]")) {
    const on = b.dataset.zone === activeBenchId;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

function renderZoneBar() {
  const bar = document.getElementById("zoneBar");
  if (!bar || !layout) return;
  const lang = getLang();
  const btns = [
    `<button type="button" class="zone-btn ${activeBenchId === "overview" ? "on" : ""}" data-zone="overview" aria-pressed="${activeBenchId === "overview"}">${esc(t("overview"))}</button>`,
    ...layout.benches.map((b) => {
      const title = b.title?.[lang] || b.title?.en || b.id;
      const on = activeBenchId === b.tableId;
      return `<button type="button" class="zone-btn ${on ? "on" : ""}" data-zone="${esc(b.tableId)}" aria-pressed="${on}" title="${esc(title)}"><b>${esc(b.displayCode)}</b><span class="z-lbl">${esc(title)}</span></button>`;
    }),
  ];
  bar.innerHTML = btns.join("");
}

function updateHudCount() {
  const el = document.getElementById("hudCount");
  if (!el) return;
  const q = query.trim().toLowerCase();
  const matched = stations.filter((s) => matchesQuery(s.app, q));
  if (!q) {
    el.textContent = t("countAll", { n: apps.length });
    el.classList.remove("empty");
  } else if (!matched.length) {
    el.textContent = t("noResults");
    el.classList.add("empty");
  } else {
    el.textContent = t("countFiltered", { shown: matched.length, total: apps.length });
    el.classList.remove("empty");
  }
}

function applySearch(shouldFly = true) {
  const q = query.trim().toLowerCase();
  const matched = [];
  for (const st of stations) {
    const ok = matchesQuery(st.app, q);
    if (!q) {
      st.setSearchState("normal");
      st.pinEl.classList.remove("match", "dim");
    } else if (ok) {
      st.setSearchState("match");
      st.pinEl.classList.add("match");
      st.pinEl.classList.remove("dim");
      matched.push(st);
    } else {
      st.setSearchState("dim");
      st.pinEl.classList.add("dim");
      st.pinEl.classList.remove("match");
    }
  }
  updateHudCount();
  if (shouldFly) {
    if (!q) flyToOverview();
    else if (matched.length) flyToMatches(matched);
  }
}

function renderFallbackLinks(allApps) {
  const stage = document.getElementById("sceneWrap");
  const lang = getLang();
  stage.innerHTML = `<div class="webgl-fallback card">
    <p>${esc(t("webglFallback"))}</p>
    <div class="fb-grid">${allApps
      .map((a) => `<a class="btn" href="${esc(a.slug)}/">${esc(a.name)} ↗</a>`)
      .join("")}</div>
  </div>`;
}

function bootScene(allApps) {
  const wrap = document.getElementById("sceneWrap");
  const canvas = document.getElementById("labCanvas");
  const pinLayer = document.getElementById("pinLayer");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    renderFallbackLinks(allApps);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 95);

  layout = buildLabLayout(allApps);
  room3d = buildLabRoom3D(scene, layout, getLang());

  // Place all 21+ 3D animated apparatuses onto their workbenches + create accessible floating title pins
  stations = [];
  const hitTargets = [];
  const lang = getLang();

  for (const bench of layout.benches) {
    for (const slot of bench.slots) {
      const st = createApparatus3D(slot.app, allApps);
      st.group.position.set(slot.worldX, slot.worldY, slot.worldZ);
      scene.add(st.group);
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
        setHovered(st.slug);
        flyToStation(st);
      });
      pin.addEventListener("blur", () => setHovered(null));

      pinLayer.append(pin);
      st.pinEl = pin;
      st.anchor = new THREE.Vector3(slot.worldX, slot.worldY + 0.04, slot.worldZ + 0.72);
      stations.push(st);
    }
  }

  function setHovered(slug) {
    if (hoveredSlug === slug) return;
    hoveredSlug = slug;
    canvas.style.cursor = slug ? "pointer" : "grab";
    for (const st of stations) {
      const h = st.slug === slug;
      st.setHovered(h);
      st.pinEl.classList.toggle("hot", h);
    }
  }

  // Apply initial theme & camera overview
  room3d.applyTheme(isDark());
  flyToOverview();
  camState.target.copy(camState.goalTarget);
  camState.yaw = camState.goalYaw;
  camState.pitch = camState.goalPitch;
  camState.dist = camState.goalDist;

  renderZoneBar();
  updateHudCount();

  // Resize handler
  function resize() {
    const w = wrap.clientWidth || window.innerWidth;
    const h = wrap.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener("resize", resize);

  // ── GAME CAMERA CONTROLS (Mouse drag pan, Right/Shift drag orbit, Wheel zoom, Touch pan+pinch, WASD) ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const keys = new Set();

  let pointerMode = null; // "pan" | "orbit" | "pinch"
  let dragStartX = 0;
  let dragStartY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragMoved = 0;
  const activeTouches = new Map();
  let lastPinchDist = 0;
  let lastPinchAngle = 0;

  function clampTarget() {
    const b = layout.bounds;
    camState.goalTarget.x = Math.max(b.minX + 1.5, Math.min(b.maxX - 1.5, camState.goalTarget.x));
    camState.goalTarget.z = Math.max(b.minZ + 1.5, Math.min(b.maxZ - 1.5, camState.goalTarget.z));
    camState.goalPitch = Math.max(0.3, Math.min(1.18, camState.goalPitch));
    camState.goalDist = Math.max(4.4, Math.min(34, camState.goalDist));
  }

  function panByPixels(dx, dy) {
    const speed = camState.goalDist * 0.00145;
    const sinY = Math.sin(camState.yaw);
    const cosY = Math.cos(camState.yaw);
    // Right vector on XZ plane: (cosY, 0, -sinY); Forward-on-floor: (-sinY, 0, -cosY)
    camState.goalTarget.x += (-dx * cosY - dy * sinY) * speed;
    camState.goalTarget.z += (dx * sinY - dy * cosY) * speed;
    activeBenchId = "";
    updateZoneButtons();
    clampTarget();
  }

  function pickAtClient(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object.userData.slug : null;
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
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
    dragStartX = lastX = e.clientX;
    dragStartY = lastY = e.clientY;
    dragMoved = 0;
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    camState.parallaxX = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
    camState.parallaxY = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;

    if (activeTouches.has(e.pointerId)) {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointerMode === "pinch" && activeTouches.size === 2) {
      const [a, b] = [...activeTouches.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (lastPinchDist > 0) {
        camState.goalDist *= lastPinchDist / Math.max(10, d);
      }
      let dAng = ang - lastPinchAngle;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      camState.goalYaw -= dAng * 0.85;
      lastPinchDist = d;
      lastPinchAngle = ang;
      clampTarget();
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
      clampTarget();
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    // Idle hover picking on desktop pointer
    if (e.pointerType !== "touch") {
      const slug = pickAtClient(e.clientX, e.clientY);
      setHovered(slug);
    }
  });

  function endPointer(e) {
    const wasTap = pointerMode === "pan" && dragMoved < 8 && activeTouches.size <= 1;
    activeTouches.delete(e.pointerId);
    if (activeTouches.size === 0) {
      pointerMode = null;
      canvas.style.cursor = hoveredSlug ? "pointer" : "grab";
    }
    if (wasTap) {
      const slug = pickAtClient(e.clientX, e.clientY);
      if (slug) {
        window.location.href = `${slug}/`;
      }
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      camState.goalDist *= 1 + Math.sign(e.deltaY) * Math.min(0.14, Math.abs(e.deltaY) * 0.0012);
      clampTarget();
    },
    { passive: false },
  );

  // Keyboard navigation (WASD / arrows to glide, R / Esc to return to overview)
  window.addEventListener("keydown", (e) => {
    if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      keys.add(k);
    } else if (k === "r" || k === "escape") {
      flyToOverview();
    } else if (k === "q") {
      camState.goalYaw -= 0.45;
    } else if (k === "e") {
      camState.goalYaw += 0.45;
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Bottom zone quick-camera buttons + rotate buttons
  document.getElementById("zoneBar").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-zone]");
    if (!btn) return;
    const z = btn.dataset.zone;
    if (z === "overview") flyToOverview();
    else {
      const bench = layout.benches.find((b) => b.tableId === z);
      if (bench) flyToBench(bench);
    }
  });
  document.getElementById("rotLeftBtn")?.addEventListener("click", () => {
    camState.goalYaw -= 0.55;
  });
  document.getElementById("rotRightBtn")?.addEventListener("click", () => {
    camState.goalYaw += 0.55;
  });

  // Theme & language live listeners
  onTheme((dark) => room3d.applyTheme(dark));
  onLang((newLang) => {
    room3d.updateLanguage(newLang);
    renderZoneBar();
    updateHudCount();
    for (const st of stations) {
      const desc = st.app.description?.[newLang] || st.app.description?.en || "";
      st.pinEl.setAttribute("aria-label", `${st.app.name} — ${desc}`);
    }
  });

  // ── MAIN ANIMATION LOOP (pauses cleanly when tab is hidden) ──
  const proj = new THREE.Vector3();
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

    // Keyboard smooth floor glide
    if (keys.size) {
      const move = dt * camState.dist * 0.42;
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
        clampTarget();
      }
    }

    // Damped spherical camera update + subtle idle parallax
    const ease = Math.min(1, dt * 7.5);
    camState.target.lerp(camState.goalTarget, ease);
    camState.yaw += (camState.goalYaw - camState.yaw) * ease;
    camState.pitch += (camState.goalPitch - camState.pitch) * ease;
    camState.dist += (camState.goalDist - camState.dist) * ease;

    const px = reduced ? 0 : camState.parallaxX * 0.032;
    const py = reduced ? 0 : camState.parallaxY * 0.018;
    const yaw = camState.yaw + px;
    const pitch = Math.max(0.28, Math.min(1.2, camState.pitch + py));

    const horiz = Math.cos(pitch) * camState.dist;
    camera.position.set(
      camState.target.x + Math.sin(yaw) * horiz,
      camState.target.y + Math.sin(pitch) * camState.dist,
      camState.target.z + Math.cos(yaw) * horiz,
    );
    camera.lookAt(camState.target);

    // Update room ambiance + all 21+ 3D apparatuses
    room3d.update(elapsed, reduced);
    for (const st of stations) st.update(elapsed, dt, reduced);

    renderer.render(scene, camera);

    // Project 3D anchor positions -> crisp floating title pins
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const farZoom = camState.dist > 17;
    for (const st of stations) {
      proj.copy(st.anchor).project(camera);
      const inView = proj.z > -1 && proj.z < 1 && proj.x > -1.08 && proj.x < 1.08 && proj.y > -1.08 && proj.y < 1.08;
      if (!inView) {
        st.pinEl.style.opacity = "0";
        st.pinEl.style.pointerEvents = "none";
        continue;
      }
      const sx = (proj.x * 0.5 + 0.5) * w;
      const sy = (-proj.y * 0.5 + 0.5) * h;
      st.pinEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -20%)`;
      st.pinEl.style.opacity = "";
      st.pinEl.style.pointerEvents = "";
      st.pinEl.classList.toggle("compact", farZoom);
      st.pinEl.style.zIndex = st.slug === hoveredSlug ? "30" : String(Math.round((1 - proj.z) * 20));
    }
  }

  requestAnimationFrame(tick);
}

// ── WIRE SEARCH HUD ──
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
    const matched = stations.filter((s) => matchesQuery(s.app, q));
    if (matched.length === 1) {
      window.location.href = `${matched[0].slug}/`;
    } else if (matched.length > 1) {
      flyToMatches(matched);
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
