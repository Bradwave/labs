// lab-kit · kit.js
// Shared behaviour of the labs: language, theme, settings menu, info dialog, slider guard, number inputs,
// toast, storage, colours for canvas, service worker and install. See DESIGN.md §5–8, §14–15.
// Generated copy in each app: edit lab-kit/kit/kit.js, then run tools/sync-kit.mjs.

export const KIT_VERSION = "0.1.0";

// ---------- kit strings ----------
const KIT_STRINGS = {
  it: {
    "kit.info": "Informazioni",
    "kit.settings": "Impostazioni",
    "kit.lang": "Lingua",
    "kit.theme": "Tema",
    "kit.theme.auto": "Auto",
    "kit.theme.light": "Chiaro",
    "kit.theme.dark": "Scuro",
    "kit.install": "Installa l'app",
    "kit.installed": "App installata",
    "kit.updated": "Nuova versione pronta: ricarica la pagina",
    "kit.offline": "Pronta anche offline",
    "kit.close": "Chiudi",
    "kit.badNumber": "Numero non valido: usa per esempio 0,5 oppure -2,25",
    "kit.privacy": "Tutto avviene su questo dispositivo: nessun dato viene inviato.",
    "kit.license": "Licenza MIT",
    "kit.more": "Altri laboratori",
  },
  en: {
    "kit.info": "About",
    "kit.settings": "Settings",
    "kit.lang": "Language",
    "kit.theme": "Theme",
    "kit.theme.auto": "Auto",
    "kit.theme.light": "Light",
    "kit.theme.dark": "Dark",
    "kit.install": "Install the app",
    "kit.installed": "App installed",
    "kit.updated": "New version ready: reload the page",
    "kit.offline": "Ready to work offline",
    "kit.close": "Close",
    "kit.badNumber": "Not a number: try for example 0.5 or -2.25",
    "kit.privacy": "Everything runs on this device: no data is sent anywhere.",
    "kit.license": "MIT licence",
    "kit.more": "More labs",
  },
};

// ---------- icons (inline SVG, 24 × 24 grid) ----------
const ICONS = {
  info: '<rect x="3" y="3" width="18" height="18"/><path d="M12 10.5v7"/><rect class="f" x="10.75" y="6" width="2.5" height="2.5"/>',
  settings:
    '<path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/><rect x="7.5" y="7.5" width="9" height="9"/><rect x="10.5" y="10.5" width="3" height="3"/>',
  lang: '<path d="M3 5h10M8 3v2M5 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 9"/><path d="M13 21l4-10 4 10M14.5 17.5h5"/>',
  auto: '<rect x="3" y="3" width="18" height="18"/><path class="f" d="M12 3h9v18h-9z"/>',
  light: '<rect x="8" y="8" width="8" height="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  install: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v4h16v-4"/>',
  link: '<path d="M10 14l4-4"/><path d="M9 7l2-2a4 4 0 0 1 6 6l-2 2M15 17l-2 2a4 4 0 0 1-6-6l2-2"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5 10a8 8 0 1 1 2 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 21h16"/>',
  folder: '<path d="M3 5h7l2 2h9v12H3z"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  level: '<path d="M4 20v-5h4v5M10 20V10h4v10M16 20V4h4v16"/>',
  play: '<path class="f" d="M7 4l13 8-13 8z"/>',
  pause: '<path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  step: '<path class="f" d="M5 4l10 8-10 8z"/><path class="f" d="M16 4h3v16h-3z"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><rect class="f" x="7" y="4" width="5" height="6"/><rect class="f" x="13" y="14" width="5" height="6"/>',
  palette: '<rect x="3" y="3" width="8" height="8"/><rect class="f" x="13" y="3" width="8" height="8"/><rect class="f" x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M6 16l5-6 4 3 5-7"/>',
  table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M5 15H4V4h11v1"/>',
  waves: '<path d="M2 9c2.5-3 4.5-3 7 0s4.5 3 7 0 3.5-2.5 6-1M2 16c2.5-3 4.5-3 7 0s4.5 3 7 0 3.5-2.5 6-1"/>',
  up: '<path d="M4 3h16M12 21V8M7 13l5-5 5 5"/>',
  launch: '<path d="M5 19L19 5M10 5h9v9"/>',
  axes: '<path d="M5 3v16h16"/><path d="M2.5 6L5 3l2.5 3M18 16.5l3 2.5-3 2.5"/>',
  target: '<rect x="3" y="3" width="18" height="18"/><rect x="8" y="8" width="8" height="8"/><rect class="f" x="10.5" y="10.5" width="3" height="3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M13 7l4 4"/>',
  drop: '<path d="M12 3l6 9a6 6 0 1 1-12 0z"/>',
  ball: '<circle cx="12" cy="12" r="8"/><circle class="f" cx="12" cy="12" r="2.5"/>',
  impact: '<path d="M3 21h18"/><rect x="9" y="11" width="6" height="6"/><path d="M12 3v5M9 6l3 2 3-2"/>',
  image: '<rect x="3" y="4" width="18" height="16"/><path d="M3 17l5-5 4 4 3-3 6 6"/><rect class="f" x="14" y="7" width="3" height="3"/>',
  help: '<rect x="3" y="3" width="18" height="18"/><path d="M9 9.5a3 3 0 1 1 4 2.8c-.7.3-1 .8-1 1.5V15"/><rect class="f" x="10.75" y="16.5" width="2.5" height="2.5"/>',
};
export function icon(name, cls = "ki") {
  const body = ICONS[name] || name; // a name from the set, or raw SVG children
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// ---------- state ----------
const cfg = {
  slug: "lab",
  name: "Lab",
  version: "0.0.0",
  strings: { it: {}, en: {} },
  menu: [],
  sw: true,
  guardSliders: true,
  landing: "../", // the labs home page (labs.matephis.com/)
};
let dict = { it: {}, en: {} };
let lang = "it";
let theme = "auto";
const langListeners = [];
const themeListeners = [];
let menuEl = null;
let installEvent = null;

// ---------- storage: every key starts with the slug (DESIGN.md §14) ----------
export const store = {
  get(name) {
    try {
      return localStorage.getItem(`${cfg.slug}.${name}`);
    } catch (e) {
      return null;
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(`${cfg.slug}.${name}`, value);
    } catch (e) {
      /* the page works without storage */
    }
  },
  remove(name) {
    try {
      localStorage.removeItem(`${cfg.slug}.${name}`);
    } catch (e) {
      /* ignore */
    }
  },
  getJSON(name, fallback = null) {
    const s = this.get(name);
    if (s == null) return fallback;
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback;
    }
  },
  setJSON(name, value) {
    this.set(name, JSON.stringify(value));
  },
};

// ---------- language ----------
function pickLang() {
  const saved = store.get("lang");
  if (saved === "it" || saved === "en") return saved;
  const nav = (typeof navigator !== "undefined" && navigator.language) || "it";
  return nav.toLowerCase().startsWith("it") ? "it" : "en";
}
export function getLang() {
  return lang;
}
export function t(key, params) {
  let s = dict[lang][key] ?? dict.en[key] ?? dict.it[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  return s;
}
export function applyI18n(root = document) {
  if (root === document) document.documentElement.lang = lang;
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
}
export function setLang(l) {
  if (l !== "it" && l !== "en") return;
  lang = l;
  store.set("lang", l);
  applyI18n();
  if (menuEl) renderMenu();
  langListeners.forEach((fn) => fn(l));
}
export function onLang(fn) {
  langListeners.push(fn);
}

// ---------- theme ----------
const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export function getTheme() {
  return theme;
}
export function isDark() {
  return theme === "dark" || (theme === "auto" && !!darkQuery && darkQuery.matches);
}
function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;
  // browser chrome colour follows the page background
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (m.dataset.orig === undefined) m.dataset.orig = m.content;
    m.content = theme === "auto" ? m.dataset.orig : bg || m.dataset.orig;
  }
  themeListeners.forEach((fn) => fn(isDark()));
}
export function setTheme(v) {
  if (!["auto", "light", "dark"].includes(v)) return;
  theme = v;
  store.set("theme", v);
  applyTheme();
  if (menuEl) renderMenu();
}
export function onTheme(fn) {
  themeListeners.push(fn);
}

// Every token as { name: value } for canvas and SVG drawing (DESIGN.md §8).
const TOKENS = [
  "bg", "bgline", "surface", "ink", "muted", "accent", "onaccent", "tile2", "gridline",
  "pos", "vel", "acc", "force", "mom", "ek", "ep", "neg", "pos-sign", "err",
];
export function readColors(extra = []) {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const n of TOKENS.concat(extra)) out[n.replace(/-(\w)/g, (m, c) => c.toUpperCase())] = cs.getPropertyValue("--" + n).trim();
  return out;
}

// ---------- numbers (DESIGN.md §6) ----------
// "0,5" → 0.5 · "−2.25" → -2.25 · "1 250,5" → 1250.5 · "3,2×10^-4" → 0.00032 · "" → NaN
export function parseNum(input) {
  if (typeof input === "number") return input;
  let s = String(input ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/[−‒–]/g, "-").replace(/[\s   ']/g, "");
  s = s.replace(/[×x·*]10\^?(-?\d+)$/i, "e$1").replace(/⁻/g, "-");
  const lastComma = s.lastIndexOf(","),
    lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) || []).length > 1) return NaN;
    s = s.replace(",", ".");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}
// fmtNum(-1.5, 2) → "−1,50" in Italian, "−1.50" in English; unit is added after a thin space.
export function fmtNum(x, digits = 2, unit = "") {
  if (x == null || !Number.isFinite(x)) return "—";
  let s = Math.abs(x) < 0.5 * Math.pow(10, -digits) ? (0).toFixed(digits) : x.toFixed(digits);
  if (lang === "it") s = s.replace(".", ",");
  s = s.replace("-", "−");
  return unit ? `${s} ${unit}` : s;
}
// 3.2e-4 → "3,2 × 10⁻⁴"
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export function fmtSci(x, digits = 2) {
  if (x == null || !Number.isFinite(x)) return "—";
  if (x === 0) return fmtNum(0, digits);
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / Math.pow(10, e);
  if (e === 0) return fmtNum(x, digits);
  return `${fmtNum(m, digits)} × 10${String(e).replace(/./g, (c) => SUP[c])}`;
}
// Round tick values for an axis (DESIGN.md §10).
export function niceTicks(min, max, n = 6) {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, n);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  return out;
}

function enhanceNumbers(root = document) {
  for (const input of root.querySelectorAll(".num input")) {
    if (input.dataset.kit) continue;
    input.dataset.kit = "1";
    if (input.type === "text" && !input.inputMode) input.inputMode = "decimal";
    input.addEventListener("change", () => {
      const bad = input.value.trim() !== "" && Number.isNaN(parseNum(input.value));
      input.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad) toast(t("kit.badNumber"));
    });
    if (input.dataset.step == null) continue;
    const wrap = document.createElement("span");
    wrap.className = "step";
    input.replaceWith(wrap);
    const mk = (sign) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = sign < 0 ? "−" : "+";
      b.setAttribute("aria-label", sign < 0 ? "−" : "+");
      b.addEventListener("click", () => {
        const step = parseNum(input.dataset.step) || 1;
        let v = parseNum(input.value);
        if (Number.isNaN(v)) v = 0;
        v += sign * step;
        if (input.dataset.min != null) v = Math.max(parseNum(input.dataset.min), v);
        if (input.dataset.max != null) v = Math.min(parseNum(input.dataset.max), v);
        // decimals: data-digits if given, else as many as the step or the typed value has
        const decimals = (s) => (String(s).trim().split(/[.,]/)[1] || "").replace(/\D.*$/, "").length;
        const d = input.dataset.digits != null ? +input.dataset.digits : Math.max(decimals(input.dataset.step), decimals(input.value));
        input.value = fmtNum(v, d);
        input.setAttribute("aria-invalid", "false");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return b;
    };
    wrap.append(mk(-1), input, mk(1));
  }
}

// ---------- slider guard (DESIGN.md §6) ----------
// On touch a range input only changes after the finger has moved 8 px sideways, more sideways than vertically.
// Vertical swipes that start on a slider scroll the page; a tap on the track does not jump the value.
export function guardSliders() {
  if (document.documentElement.dataset.kitGuard) return;
  document.documentElement.dataset.kitGuard = "1";
  let g = null;
  const isRange = (el) => el instanceof HTMLInputElement && el.type === "range";
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch" || !isRange(e.target)) return;
      g = { el: e.target, id: e.pointerId, x: e.clientX, y: e.clientY, start: e.target.value, engaged: false };
    },
    true,
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!g || g.engaged || e.pointerId !== g.id) return;
      const dx = Math.abs(e.clientX - g.x),
        dy = Math.abs(e.clientY - g.y);
      if (dx >= 8 && dx > dy) g.engaged = true;
    },
    true,
  );
  const block = (e) => {
    if (!g || g.engaged || e.target !== g.el) return;
    g.el.value = g.start;
    e.stopImmediatePropagation();
  };
  document.addEventListener("input", block, true);
  document.addEventListener("change", block, true);
  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    if (!g.engaged) g.el.value = g.start;
    g = null;
  };
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
}

// ---------- toast ----------
let toastEl = null,
  toastTimer = 0;
export function toast(msg, ms = 2400) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "kit-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// ---------- header buttons, info dialog, settings menu (DESIGN.md §5) ----------
const desktopQuery = "(min-width: 921px), (orientation: landscape) and (min-height: 601px)";

function openInfo() {
  const dlg = document.getElementById("info");
  if (!dlg) return;
  const meta = dlg.querySelector(".kit-meta");
  if (meta)
    meta.innerHTML = `${t("kit.privacy")}<br>${cfg.name} v${cfg.version} · kit ${KIT_VERSION} · ${t("kit.license")} · <a href="${cfg.landing}" target="_blank" rel="noopener">${t("kit.more")}</a>`;
  dlg.showModal();
}

function renderMenu() {
  const seg = (name, value, options) =>
    `<div class="seg small" role="group" aria-label="${t("kit." + name)}">` +
    options
      .map(([v, label, ic]) => `<button type="button" data-kit-${name}="${v}" class="${v === value ? "on" : ""}" aria-pressed="${v === value}" title="${label}">${ic ? icon(ic) : label}</button>`)
      .join("") +
    "</div>";
  let html = "";
  html += `<div class="mrow">${icon("lang")}<span>${t("kit.lang")}</span>${seg("lang", lang, [["it", "IT"], ["en", "EN"]])}</div>`;
  html += `<div class="mrow">${icon(isDark() ? "dark" : "light")}<span>${t("kit.theme")}</span>${seg("theme", theme, [
    ["auto", t("kit.theme.auto"), "auto"],
    ["light", t("kit.theme.light"), "light"],
    ["dark", t("kit.theme.dark"), "dark"],
  ])}</div>`;
  const items = cfg.menu.filter((it) => !it.hidden || !it.hidden());
  if (items.length) {
    html += '<div class="msep" role="separator"></div>';
    items.forEach((it, i) => {
      const val = it.value ? `<b>${it.value()}</b>` : "";
      html += `<button type="button" class="mitem" data-kit-item="${i}">${icon(it.icon || "settings")}<span>${t(it.label)}</span>${val}</button>`;
    });
  }
  html += '<div class="msep" role="separator"></div>';
  if (installEvent) html += `<button type="button" class="mitem" data-kit-install>${icon("install")}<span>${t("kit.install")}</span></button>`;
  html += `<div class="mver">${cfg.name} v${cfg.version} · kit ${KIT_VERSION}</div>`;
  menuEl.innerHTML = html;
  menuEl._items = items;
}

function placeMenu(btn) {
  if (matchMedia(desktopQuery).matches) {
    const r = btn.getBoundingClientRect();
    menuEl.style.top = `${r.bottom + 10}px`;
    menuEl.style.right = `${Math.max(8, innerWidth - r.right)}px`;
  } else {
    menuEl.style.top = "";
    menuEl.style.right = "";
  }
}

let menuBtn = null;
function openMenu(btn) {
  menuBtn = btn;
  renderMenu();
  menuEl.hidden = false;
  placeMenu(btn);
  for (const b of document.querySelectorAll("[data-kit-settings]")) b.setAttribute("aria-expanded", "true");
  const first = menuEl.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}
function closeMenu(refocus = true) {
  if (!menuEl || menuEl.hidden) return;
  menuEl.hidden = true;
  for (const b of document.querySelectorAll("[data-kit-settings]")) b.setAttribute("aria-expanded", "false");
  if (refocus && menuBtn) menuBtn.focus({ preventScroll: true });
}

function setupHeader() {
  const info = document.getElementById("infoBtn");
  const gear = document.getElementById("settingsBtn");
  menuEl = document.createElement("div");
  menuEl.className = "menu card";
  menuEl.id = "kitMenu";
  menuEl.hidden = true;
  menuEl.setAttribute("role", "menu");
  document.body.append(menuEl);

  const wire = (b, kind) => {
    if (!b) return;
    if (!b.innerHTML.trim()) b.innerHTML = icon(kind);
    b.dataset.i18nAria = b.dataset.i18nAria || `kit.${kind}`;
    b.dataset.i18nTitle = b.dataset.i18nTitle || `kit.${kind}`;
    if (kind === "settings") {
      b.dataset.kitSettings = "1";
      b.setAttribute("aria-haspopup", "menu");
      b.setAttribute("aria-controls", "kitMenu");
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        menuEl.hidden ? openMenu(b) : closeMenu();
      });
    } else b.addEventListener("click", openInfo);
  };
  wire(info, "info");
  wire(gear, "settings");

  // short landscape: the header is hidden, so the two buttons are cloned into the tab row
  const tabs = document.querySelector(".tabs");
  if (tabs && (info || gear) && !tabs.querySelector(".kit-mini")) {
    const mini = document.createElement("div");
    mini.className = "kit-mini";
    for (const [src, kind] of [[info, "info"], [gear, "settings"]]) {
      if (!src) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "icon-btn";
      mini.append(b);
      wire(b, kind);
    }
    tabs.append(mini);
  }

  menuEl.addEventListener("click", (e) => {
    e.stopPropagation(); // the menu re-renders on lang/theme: its old buttons must not count as outside clicks
    const el = e.target.closest("button");
    if (!el) return;
    if (el.dataset.kitLang) return setLang(el.dataset.kitLang);
    if (el.dataset.kitTheme) return setTheme(el.dataset.kitTheme);
    if (el.dataset.kitInstall !== undefined) {
      closeMenu();
      installEvent.prompt();
      installEvent.userChoice.then(() => (installEvent = null));
      return;
    }
    if (el.dataset.kitItem !== undefined) {
      const it = menuEl._items[+el.dataset.kitItem];
      if (!it) return;
      if (it.keepOpen) {
        it.onClick();
        renderMenu();
      } else {
        closeMenu();
        it.onClick();
      }
    }
  });
  document.addEventListener("click", (e) => {
    if (menuEl.hidden || menuEl.contains(e.target)) return;
    closeMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  addEventListener("resize", () => {
    if (!menuEl.hidden && menuBtn) placeMenu(menuBtn);
  });

  for (const b of document.querySelectorAll("dialog [data-close]"))
    b.addEventListener("click", () => b.closest("dialog").close());
}

// ---------- service worker and install (DESIGN.md §15) ----------
function setupPWA() {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
  });
  addEventListener("appinstalled", () => {
    installEvent = null;
    toast(t("kit.installed"));
  });
  if (!cfg.sw || !("serviceWorker" in navigator) || location.protocol === "file:") return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) toast(t("kit.updated"), 6000);
  });
}

// ---------- init ----------
// initKit({ slug, name, version, strings: { it, en }, menu: [{ icon, label, onClick, value?, hidden?, keepOpen? }] })
export function initKit(options = {}) {
  Object.assign(cfg, options);
  dict = {
    it: { ...KIT_STRINGS.it, ...(cfg.strings.it || {}) },
    en: { ...KIT_STRINGS.en, ...(cfg.strings.en || {}) },
  };
  lang = pickLang();
  const savedTheme = store.get("theme");
  theme = ["auto", "light", "dark"].includes(savedTheme) ? savedTheme : "auto";
  setupHeader();
  applyTheme();
  applyI18n();
  if (darkQuery) darkQuery.addEventListener("change", () => theme === "auto" && applyTheme());
  if (cfg.guardSliders) guardSliders();
  enhanceNumbers(document);
  setupPWA();
  return { t, getLang, setLang, onLang, getTheme, setTheme, onTheme, isDark, readColors, toast, store };
}
export { enhanceNumbers };

// for tests in Node
export const _test = { KIT_STRINGS, setLangForTest: (l) => (lang = l) };
