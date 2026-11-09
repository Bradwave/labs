// Force Lab XR · app.js
// Scena Three.js, ingressi WebXR (controller e mani) e da schermo, zone di forza, elastico, pannelli.
// La fisica (physics.js), le piste (tracks.js), gli ingressi puri (input.js) e i pannelli (xrpanel.js) sono testati in Node; qui c'è la presentazione.
// Riferimento: `stage` (il "palco") contiene pista, palla e zone in coordinate di pista (metri). L'utente può spostarlo, ruotarlo e
// scalarlo per comodità: la fisica resta nelle coordinate del palco, quindi la difficoltà non cambia.
/* global THREE, Physics, Tracks, Input, XRPanel, Grab, Pointer */

export function startApp(kit) {
  const { t, getLang, setLang, onLang, onTheme, isDark, store } = kit;
  const P = Physics, TR = Tracks, X = XRPanel;
  const V = P.V;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MONITOR = /[?&]monitor=1/.test(location.search);

  // ---------- palette: token del laboratorio + colori della fisica (DESIGN.md §3) ----------
  const PAL = {
    light: { bg: "#2BA3B4", surface: "#F2FBFC", ink: "#062A30", muted: "#3F646A", accent: "#C2410C", onaccent: "#FFFFFF", tile2: "#FFD23F", tile2Ink: "#062A30",
      vel: "#0F9A63", acc: "#B42BA0", force: "#E2412A", pos: "#2350D8", band: "#E8730C", floor: "#9FC9CF", sky: "#F2FBFC" },
    dark: { bg: "#04242A", surface: "#0B3A42", ink: "#E6FAFC", muted: "#9CC3C9", accent: "#FF9F45", onaccent: "#04242A", tile2: "#F2C230", tile2Ink: "#04242A",
      vel: "#3DDC97", acc: "#F27ADF", force: "#FF7C60", pos: "#86A6FF", band: "#FFA94D", floor: "#1C5560", sky: "#04242A" },
  };
  let C = PAL[isDark() ? "dark" : "light"];

  // ---------- stato ----------
  const DEF = { vec: { v: true, a: true, F: true }, each: false, split: false, strobe: true, predict: "auto", slow: 1, snap: true, g: 0, mass: 0.5 };
  const opt = Object.assign({}, DEF, store.getJSON("opts", {}));
  opt.vec = Object.assign({}, DEF.vec, opt.vec || {});
  const best = store.getJSON("best", {});
  const saveOpts = () => store.setJSON("opts", opt);
  let trackIdx = clamp(+store.get("track") || 0, 0, TR.TRACKS.length - 1);
  let track = TR.TRACKS[trackIdx];
  let run = new TR.Run(track);
  const zonesByTrack = {};
  let userZones = (zonesByTrack[track.id] = []);
  let selZone = null;
  const ui = { xr: null, options: false, gallery: null, galleryIdx: trackIdx, zoneMenu: null, msg: null, msgUntil: 0, lostAt: 0 };
  const lang = () => getLang();
  const gNow = () => (track.sandbox ? opt.g : track.g);
  const mNow = () => (track.sandbox ? opt.mass : track.mass);
  const allZones = () => track.zones.concat(userZones);
  const predictOn = () => opt.predict === "always" || (opt.predict === "auto" && track.predict);

  // ---------- THREE ----------
  const view = $("view");
  const renderer = new THREE.WebGLRenderer({ canvas: $("cv"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.xr.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 100);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(2, 4, 3); scene.add(sun);

  const mats = {};
  function mat(role, extra, kind) { // materiale condiviso per ruolo di colore
    const key = role + JSON.stringify(extra || {}) + (kind || "");
    if (!mats[key]) {
      const M = kind === "lambert" ? THREE.MeshLambertMaterial : kind === "line" ? THREE.LineBasicMaterial : kind === "dash" ? THREE.LineDashedMaterial : THREE.MeshBasicMaterial;
      mats[key] = new M(Object.assign({ color: C[role] || role }, extra || {}));
      mats[key].userData.role = role;
    }
    return mats[key];
  }
  function applyPalette(name) {
    C = PAL[name];
    for (const k in mats) { const r = mats[k].userData.role; if (C[r]) mats[k].color.set(C[r]); }
    scene.background = ui.xr === "immersive-ar" ? null : new THREE.Color(C.sky);
    floor.visible = ui.xr !== "immersive-ar";
    labels.forEach((l) => l.redraw());
    panels.forEach((p) => (p.sig = ""));
    drawOptCanvas();
  }

  const floor = new THREE.GridHelper(10, 20, 0x888888, 0x888888);
  floor.material = mat("floor", { transparent: true, opacity: 0.6 }, "line");
  scene.add(floor);

  const stage = new THREE.Group(); scene.add(stage);
  stage.userData.grab = { scalable: true, min: 0.25, max: 2.5, kind: "stage" };
  const trackG = new THREE.Group(); stage.add(trackG);

  // ---------- forme ----------
  const sph = new THREE.SphereBufferGeometry(1, 20, 14);
  const unitCyl = new THREE.CylinderBufferGeometry(1, 1, 1, 10); unitCyl.translate(0, 0.5, 0);
  const unitCone = new THREE.ConeBufferGeometry(1, 1, 14); unitCone.translate(0, -0.5, 0);
  const UP = new THREE.Vector3(0, 1, 0);
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

  function outlined(geo, role, s) { // forma con contorno d'inchiostro (guscio rovesciato)
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat(role, null, "lambert")));
    const o = new THREE.Mesh(geo, mat("ink", { side: THREE.BackSide })); o.scale.setScalar(s || 1.12); g.add(o);
    return g;
  }

  // freccia 3D: asta + punta; set(origine, vettore, scala m per unità)
  function Arrow(role, o) {
    o = o || {};
    this.g = new THREE.Group();
    const m = mat(role, o.opacity ? { transparent: true, opacity: o.opacity } : null);
    this.r = o.r || 0.008;
    this.shaft = new THREE.Mesh(unitCyl, m); this.head = new THREE.Mesh(unitCone, m);
    this.g.add(this.shaft, this.head); this.g.visible = false;
    (o.parent || stage).add(this.g);
  }
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  Arrow.prototype.set = function (origin, vec, k) {
    const L0 = Math.hypot(vec[0], vec[1], vec[2]);
    if (L0 < 1e-6) { this.g.visible = false; return; }
    const len = Math.max(0.03, L0 * k), hl = Math.min(len * 0.45, this.r * 5), hr = this.r * 2.6;
    this.g.visible = true; this.g.position.set(origin[0], origin[1], origin[2]);
    _v.set(vec[0] / L0, vec[1] / L0, vec[2] / L0); this.g.quaternion.setFromUnitVectors(UP, _v);
    this.shaft.scale.set(this.r, len - hl, this.r);
    this.head.scale.set(hr, hl, hr); this.head.position.y = len;
    this.tip = [origin[0] + _v.x * len, origin[1] + _v.y * len, origin[2] + _v.z * len];
  };
  Arrow.prototype.hide = function () { this.g.visible = false; };

  // etichette di testo (sprite)
  const labels = [];
  function Label(text, role, px, opts) {
    opts = opts || {};
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: opts.depthTest !== false, transparent: true }));
    sp.scale.set(0.16 * (px || 1), 0.06 * (px || 1), 1);
    this.sp = sp; this.cv = cv; this.tex = tex; this.text = text; this.role = role;
    this.redraw = () => {
      const c = cv.getContext("2d"); c.clearRect(0, 0, 256, 96);
      c.font = '700 54px "Space Mono", ui-monospace, monospace'; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = 12; c.strokeStyle = C.surface; c.strokeText(this.text, 128, 50);
      c.fillStyle = C[this.role] || this.role; c.fillText(this.text, 128, 50); tex.needsUpdate = true;
    };
    this.set = (s) => { if (s !== this.text) { this.text = s; this.redraw(); } };
    this.redraw(); labels.push(this);
  }

  // tubo flessibile (elastico): segmenti cilindrici
  function Tube(n, role) {
    this.g = new THREE.Group(); this.segs = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(unitCyl, mat(role)); this.g.add(m); this.segs.push(m); }
    stage.add(this.g); this.g.visible = false;
  }
  Tube.prototype.set = function (pts, r, role) {
    this.g.visible = true;
    for (let i = 0; i < this.segs.length; i++) {
      const m = this.segs[i], a = pts[i], b = pts[i + 1];
      if (!b) { m.visible = false; continue; }
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]);
      if (L < 1e-6) { m.visible = false; continue; }
      m.visible = true; m.material = mat(role); m.position.set(a[0], a[1], a[2]);
      _v.set(d[0] / L, d[1] / L, d[2] / L); m.quaternion.setFromUnitVectors(UP, _v); m.scale.set(r, L, r);
    }
  };

  function dashedLine(role, opacity) {
    const l = new THREE.Line(new THREE.BufferGeometry(), mat(role, { dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: opacity || 0.6 }, "dash"));
    l.frustumCulled = false; return l;
  }
  function setLine(line, pts) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(v3));
    line.computeLineDistances();
    line.visible = pts.length > 1;
  }

  // ---------- pista ----------
  // Costruisce pista e zone bloccate in coordinate di pista; mini = anteprima della galleria (niente etichette)
  function buildTrack(tr, mini) {
    const g = new THREE.Group(), gates = [];
    // partenza: sfera trasparente + colonnina fino al pavimento (con la manopola per spostare la pista)
    const sp = tr.start.p;
    const pad = new THREE.Mesh(sph, mat("accent", { transparent: true, opacity: 0.18, depthWrite: false })); pad.scale.setScalar(tr.start.r); pad.position.set(sp[0], sp[1], sp[2]); g.add(pad);
    const padRing = new THREE.Mesh(new THREE.TorusBufferGeometry(tr.start.r, 0.006, 6, 40), mat("accent")); padRing.rotation.x = Math.PI / 2; padRing.position.copy(pad.position); g.add(padRing);
    const post = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.012, 0.012, sp[1] - tr.start.r, 8), mat("ink")); post.position.set(sp[0], (sp[1] - tr.start.r) / 2, sp[2]); g.add(post);
    for (const gt of tr.gates) {
      let m;
      if (gt.type === "target") {
        m = new THREE.Group();
        const s = new THREE.Mesh(sph, mat("vel", { transparent: true, opacity: 0.16, depthWrite: false })); s.scale.setScalar(gt.r); m.add(s);
        const w = new THREE.Mesh(new THREE.TorusBufferGeometry(gt.r, 0.007, 6, 48), mat("ink")); w.rotation.x = Math.PI / 2; m.add(w);
        const w2 = new THREE.Mesh(new THREE.TorusBufferGeometry(gt.r, 0.007, 6, 48), mat("ink")); m.add(w2);
        m.userData.ring = [w, w2]; m.userData.lam = false;
      } else {
        m = new THREE.Group();
        const tor = new THREE.Mesh(new THREE.TorusBufferGeometry(gt.r, gt.type === "speed" ? 0.018 : 0.014, 8, 48), mat("ink", null, "lambert")); m.add(tor);
        const chev = new THREE.Mesh(unitCone, mat("ink", { transparent: true, opacity: 0.35 })); chev.scale.set(0.035, 0.07, 0.035); chev.rotation.x = -Math.PI / 2; chev.position.z = -0.035; m.add(chev);
        m.userData.ring = [tor]; m.userData.lam = true;
        _v.set(gt.n[0], gt.n[1], gt.n[2]); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _v);
      }
      m.position.set(gt.p[0], gt.p[1], gt.p[2]); g.add(m); gates.push(m);
      if (!mini && (gt.type === "speed" || gt.type === "target")) {
        const lb = new Label(gt.type === "speed" ? "≥ " + X.num(gt.vmin, 1, lang()) + " m/s" : "≤ " + X.num(gt.vmax, 1, lang()) + " m/s", "ink", 1.1);
        lb.isTrack = true; lb.sp.position.set(gt.p[0], gt.p[1] + gt.r + 0.07, gt.p[2]); g.add(lb.sp);
      }
    }
    if (tr.gates.length) { const path = dashedLine("ink", 0.4); setLine(path, TR.pathPoints(tr)); g.add(path); }
    if (tr.center) { // fionda: dove tenere la mano
      const c = new THREE.Mesh(sph, mat("band", { transparent: true, opacity: 0.5 })); c.scale.setScalar(0.025); c.position.set(tr.center[0], tr.center[1], tr.center[2]); g.add(c);
    }
    if (!mini) { // manopola sulla colonnina: impugnala per spostare, ruotare e (con due mani) scalare la pista
      const knob = outlined(new THREE.CylinderBufferGeometry(0.06, 0.06, 0.03, 24), "accent", 1.1); knob.position.set(sp[0], 0.9, sp[2]); g.add(knob);
    }
    return { g: g, gates: gates, post: post };
  }
  function zoneBox(z) {
    const size = [z.max[0] - z.min[0], z.max[1] - z.min[1], z.max[2] - z.min[2]];
    const b = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("force", { transparent: true, opacity: 0.12, depthWrite: false }));
    b.scale.set(size[0], size[1], size[2]); b.position.set((z.min[0] + z.max[0]) / 2, (z.min[1] + z.max[1]) / 2, (z.min[2] + z.max[2]) / 2);
    return b;
  }

  let built = null;
  function loadTrack(i) {
    trackIdx = (i + TR.TRACKS.length) % TR.TRACKS.length; track = TR.TRACKS[trackIdx]; store.set("track", String(trackIdx));
    userZones = zonesByTrack[track.id] || (zonesByTrack[track.id] = []);
    selZone = null; ui.zoneMenu = null;
    rebuildVisual();
    syncZoneViews();
    retry();
    placeHud();
    syncDom();
  }
  function rebuildVisual() {
    while (trackG.children.length) trackG.remove(trackG.children[0]);
    for (let i = labels.length - 1; i >= 0; i--) if (labels[i].isTrack) labels.splice(i, 1);
    built = buildTrack(track, false); trackG.add(built.g); miniFor = -1;
  }
  function retry() { run = new TR.Run(track); run.ball.m = mNow(); held = null; clearBand(); strobeClear(); ui.lostAt = 0; }

  // ---------- zone di forza ----------
  const ARROW_K = 0.5; // m per newton (freccia grande della zona e maniglia della punta)
  const handleGeo = new THREE.SphereBufferGeometry(1, 16, 12);
  function ZoneView(z) {
    this.z = z; this.g = new THREE.Group(); stage.add(this.g);
    this.box = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("force", { transparent: true, opacity: 0.08, depthWrite: false })); this.g.add(this.box);
    this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1, 1, 1)), mat(z.locked ? "muted" : "force", { transparent: true, opacity: 0.9 }, "line")); this.g.add(this.edges);
    this.small = []; // 3×3×3 frecce piccole: "la stessa forza ovunque"
    for (let i = 0; i < 27; i++) { const a = new Arrow("force", { opacity: 0.3, r: 0.003, parent: this.g }); this.small.push(a); }
    this.big = new Arrow("force", { r: 0.011, parent: this.g });
    this.label = new Label("", "force", 0.9); this.g.add(this.label.sp);
    if (!z.locked) {
      this.hMove = new THREE.Mesh(handleGeo, mat("ink")); this.hMove.scale.setScalar(0.025);
      this.hTip = outlined(handleGeo, "force", 1.25); this.hTip.scale.setScalar(0.028);
      this.hCorner = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("tile2", null, "lambert")); this.hCorner.scale.setScalar(0.045);
      [["move", this.hMove], ["tip", this.hTip], ["corner", this.hCorner]].forEach(([k, m]) => { m.userData.handle = { kind: k, view: this }; this.g.add(m); });
    }
    this.sig = "";
  }
  ZoneView.prototype.handles = function () { return this.z.locked ? [] : [this.hMove, this.hTip, this.hCorner]; };
  ZoneView.prototype.center = function () { const z = this.z; return [(z.min[0] + z.max[0]) / 2, (z.min[1] + z.max[1]) / 2, (z.min[2] + z.max[2]) / 2]; };
  ZoneView.prototype.update = function (hot) {
    const z = this.z, c = this.center(), size = [z.max[0] - z.min[0], z.max[1] - z.min[1], z.max[2] - z.min[2]];
    const sig = z.min.join() + z.max.join() + z.F.join() + (selZone === z) + lang();
    if (sig !== this.sig) {
      this.sig = sig;
      this.box.position.set(c[0], c[1], c[2]); this.box.scale.set(size[0], size[1], size[2]);
      this.edges.position.copy(this.box.position); this.edges.scale.copy(this.box.scale);
      this.edges.material = mat(z.locked ? "muted" : selZone === z ? "tile2" : "force", { transparent: true, opacity: 0.9 }, "line");
      const Fm = V.len(z.F), sm = Math.min(0.12, Math.min(size[0], size[1], size[2]) / 4);
      let i = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let d = 0; d < 3; d++) {
        const p = [z.min[0] + size[0] * (a + 0.5) / 3, z.min[1] + size[1] * (b + 0.5) / 3, z.min[2] + size[2] * (d + 0.5) / 3];
        const ar = this.small[i++];
        if (Fm < 1e-6 || (a === 1 && b === 1 && d === 1)) { ar.hide(); continue; }
        ar.set([p[0] - z.F[0] / Fm * sm / 2, p[1] - z.F[1] / Fm * sm / 2, p[2] - z.F[2] / Fm * sm / 2], z.F, sm / Fm);
      }
      this.big.set(c, z.F, ARROW_K);
      this.label.set("F = " + X.num(Fm, 2, lang()) + " N");
      const tip = [c[0] + z.F[0] * ARROW_K, c[1] + z.F[1] * ARROW_K, c[2] + z.F[2] * ARROW_K];
      this.label.sp.position.set(tip[0], tip[1] + 0.07, tip[2]);
      if (!z.locked) { this.hMove.position.set(c[0], c[1], c[2]); this.hTip.position.set(tip[0], tip[1], tip[2]); this.hCorner.position.set(z.max[0], z.max[1], z.max[2]); }
    }
    if (!z.locked) for (const h of this.handles()) h.scale.setScalar((h === this.hCorner ? 0.045 : h === this.hTip ? 0.028 : 0.025) * (hot === h ? 1.5 : 1));
  };
  ZoneView.prototype.dispose = function () { stage.remove(this.g); };
  const zoneViews = new Map();
  function syncZoneViews() {
    const want = new Set(allZones());
    for (const [z, v] of zoneViews) if (!want.has(z)) { v.dispose(); zoneViews.delete(z); }
    for (const z of want) if (!zoneViews.has(z)) zoneViews.set(z, new ZoneView(z));
  }
  function addZone(center) {
    if (userZones.length >= track.maxZones) { say(t("ev.maxZones")); return null; }
    const h = 0.25, c = center || [0, 1.2, -1.3 - userZones.length * 0.3];
    const z = TR.zone([c[0] - h, c[1] - h, c[2] - h], [c[0] + h, c[1] + h, c[2] + h], [0.3, 0, 0]);
    if (P.inBox(track.start.p, z)) { z.min[2] -= 0.6; z.max[2] -= 0.6; }
    userZones.push(z); selZone = z; syncZoneViews(); syncDom();
    return z;
  }
  function deleteZone(z) {
    const i = userZones.indexOf(z); if (i < 0) return;
    userZones.splice(i, 1); if (selZone === z) selZone = null; if (ui.zoneMenu === z) ui.zoneMenu = null; syncZoneViews(); syncDom();
  }
  function duplicateZone(z) {
    if (userZones.length >= track.maxZones) { say(t("ev.maxZones")); return; }
    const d = TR.zone(z.min.map((v, k) => v + (k === 0 ? 0.3 : 0)), z.max.map((v, k) => v + (k === 0 ? 0.3 : 0)), z.F.slice());
    userZones.push(d); selZone = d; syncZoneViews(); syncDom();
  }
  // trascinamento delle maniglie: target in coordinate di pista
  function dragHandle(view, kind, target) {
    const z = view.z;
    if (kind === "move") {
      const c = view.center(), d = V.sub(target, c);
      z.min = V.add(z.min, d); z.max = V.add(z.max, d);
    } else if (kind === "corner") {
      for (let k = 0; k < 3; k++) z.max[k] = clamp(target[k], z.min[k] + 0.2, z.min[k] + 2);
    } else if (kind === "tip") {
      const c = view.center();
      z.F = P.snapForce(V.mul(V.sub(target, c), 1 / ARROW_K), track.maxForce, { snap: opt.snap });
    }
    selZone = z;
  }
  function handlePos(view, kind) { return kind === "move" ? view.center() : kind === "corner" ? view.z.max.slice() : V.add(view.center(), V.mul(view.z.F, ARROW_K)); }

  // ---------- palla, frecce, scia, elastico, previsione ----------
  const ball = outlined(sph, "tile2", 1.15); ball.scale.setScalar(P.BALL_R); stage.add(ball);
  const ar = {
    v: new Arrow("vel", { r: 0.008 }), a: new Arrow("acc", { r: 0.008 }), F: new Arrow("force", { r: 0.008 }),
    Fz: new Arrow("force", { r: 0.007 }), Fb: new Arrow("band", { r: 0.007 }), W: new Arrow("pos", { r: 0.007 }),
    apar: new Arrow("acc", { r: 0.005, opacity: 0.55 }), aperp: new Arrow("acc", { r: 0.005, opacity: 0.55 }),
  };
  const K = { v: 0.3, a: 0.15, F: 0.3 };
  const lab = { v: new Label("v", "vel"), a: new Label("a", "acc"), F: new Label("F", "force") };
  Object.values(lab).forEach((l) => { l.sp.scale.set(0.09, 0.034, 1); stage.add(l.sp); });
  const strobe = Array.from({ length: 60 }, () => { const m = new THREE.Mesh(sph, mat("tile2", { transparent: true, opacity: 0.55 })); m.scale.setScalar(0.012); m.visible = false; stage.add(m); return m; });
  let strobeN = 0, strobeT = 0;
  function strobeClear() { strobe.forEach((m) => (m.visible = false)); strobeN = 0; strobeT = 0; }
  const bandTube = new Tube(16, "muted");
  const predLine = dashedLine("muted", 0.8); stage.add(predLine);

  // elastico: { src, anchor (pista), rest }
  let band = null;
  function clearBand() { band = null; bandTube.g.visible = false; }
  function attachBand(src, anchor) {
    if (!track.band) { say(t("ev.noBand")); return false; }
    const d = V.len(V.sub(run.ball.p, anchor));
    if (d > P.BAND.reach) { say(t("ev.tooFar")); return false; }
    band = { src: src, anchor: anchor, rest: d };
    return true;
  }
  function drawBand() {
    if (!band) { bandTube.g.visible = false; return; }
    const a = band.anchor, b = run.ball.p, d = V.len(V.sub(b, a)), free = band.rest + P.BAND.slack;
    const pts = [];
    if (d < free) { // molle: penzola (arco di parabola con la stessa lunghezza, verso il basso del mondo)
      const sag = Math.min(0.6, Math.sqrt(Math.max(0, 3 * d * (free - d) / 8)) + (d < 0.05 ? (free - d) / 2 : 0));
      stage.updateMatrixWorld(true);
      const down = new THREE.Vector3(0, -1, 0).transformDirection(_inv.copy(stage.matrixWorld).invert());
      const ctrl = [(a[0] + b[0]) / 2 + down.x * 2 * sag, (a[1] + b[1]) / 2 + down.y * 2 * sag, (a[2] + b[2]) / 2 + down.z * 2 * sag];
      for (let i = 0; i <= 16; i++) { const s = i / 16, u = 1 - s; pts.push([0, 1, 2].map((k) => u * u * a[k] + 2 * u * s * ctrl[k] + s * s * b[k])); }
      bandTube.set(pts, 0.004, "muted");
    } else {
      for (let i = 0; i <= 16; i++) pts.push([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * i / 16));
      bandTube.set(pts, Math.max(0.0025, 0.006 - (d - free) * 0.006), "band");
    }
  }

  function env() { return { zones: allZones(), g: gNow(), band: band ? { anchor: band.anchor, rest: band.rest } : null }; }

  // ---------- pannelli su canvas (in scena) ----------
  const panels = [];
  function PanelMesh(name) {
    this.name = name; this.cv = document.createElement("canvas"); this.ctx = this.cv.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.mesh.visible = false; this.layout = null; this.sig = ""; this.hover = null; this.flash = null;
    panels.push(this);
  }
  PanelMesh.prototype.render = function (layout, sig) {
    const s = sig + "|" + this.hover + "|" + this.flash + "|" + C.ink;
    this.layout = layout;
    if (s === this.sig) return;
    this.sig = s;
    if (this.cv.width !== layout.W || this.cv.height !== layout.H) {
      this.cv.width = layout.W; this.cv.height = layout.H;
      this.tex.dispose(); this.tex = new THREE.CanvasTexture(this.cv); this.mesh.material.map = this.tex;
    }
    this.mesh.scale.set(layout.W * layout.MPP, layout.H * layout.MPP, 1);
    X.draw(this.ctx, layout, this.hover, this.flash, C);
    this.tex.needsUpdate = true;
  };
  const hudP = new PanelMesh("hud"); stage.add(hudP.mesh);
  const optP = new PanelMesh("options"); scene.add(optP.mesh);
  const galP = new PanelMesh("gallery"); scene.add(galP.mesh);
  const zoneP = new PanelMesh("zone"); scene.add(zoneP.mesh);
  const monP = MONITOR ? new PanelMesh("monitor") : null; if (monP) scene.add(monP.mesh);
  // anteprima 3D della pista nella galleria
  const miniPivot = new THREE.Group(); scene.add(miniPivot); miniPivot.visible = false;
  let miniFor = -1;
  function buildMini(i) {
    if (miniFor === i) return; miniFor = i;
    while (miniPivot.children.length) miniPivot.remove(miniPivot.children[0]);
    const tr = TR.TRACKS[i], b = buildTrack(tr, true);
    for (const z of tr.zones) b.g.add(zoneBox(z));
    const box = new THREE.Box3().setFromObject(b.g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const k = 0.22 / Math.max(s.x, s.y, s.z, 0.5);
    const inner = new THREE.Group(); inner.add(b.g); b.g.position.copy(c).multiplyScalar(-1); inner.scale.setScalar(k);
    miniPivot.add(inner);
  }

  function placeHud() { // a sinistra della partenza, rivolto all'utente
    const sp = track.start.p; hudP.mesh.position.set(sp[0] - 0.62, sp[1] + 0.32, sp[2] - 0.25); hudP.mesh.rotation.set(0, 0.35, 0);
  }

  function hudState() {
    const now = performance.now(), b = run.ball;
    let msg = ui.msg && now < ui.msgUntil ? ui.msg : track.sandbox ? t("msg.sandbox") : t("msg." + (run.state === "held" ? "held" : run.state));
    if (track.sandbox && ui.msg && now < ui.msgUntil) msg = ui.msg;
    const f = liveForces();
    return { t: t, lang: lang(), track: track, run: { time: run.time, next: run.next, total: track.gates.length, state: run.state }, v: V.len(liveV()), a: V.len(f.a), F: V.len(f.net), mass: mNow(), g: gNow(), best: best[track.id], msg: msg };
  }
  function liveV() { return run.state === "held" && held ? held.est.velocity(performance.now(), held.kind) : run.ball.v; }
  const ZERO = { net: [0, 0, 0], a: [0, 0, 0], zone: [0, 0, 0], band: [0, 0, 0], weight: [0, 0, 0] };
  function liveForces() {
    if (run.state === "held" || run.state === "ready" && !band) return ZERO;
    return P.forces(run.ball.p, run.ball.m, env());
  }

  // ---------- messaggi ----------
  function say(s, ms) { ui.msg = s; ui.msgUntil = performance.now() + (ms || 2200); toast(s); }
  let toastT = 0;
  function toast(s) { if (ui.xr) return; const el = $("toast"); el.textContent = s; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2000); }
  function handleEvents() {
    while (run.events.length) {
      const e = run.events.shift();
      if (e.type === "gate") { say(t("ev.gate", { n: e.gate + 1 }), 900); buzzAll(0.5, 40); }
      else if (e.type === "done") {
        say(t("ev.done", { t: X.num(e.time, 2, lang()) }) + " " + ["", "🥉", "🥈", "🥇"][e.medal], 5000); buzzAll(0.9, 160);
        if (best[track.id] == null || e.time < best[track.id]) { best[track.id] = e.time; store.setJSON("best", best); syncDom(); }
      } else if (e.type === "tooSlow") say(t("ev.tooSlow", { v: X.num(e.speed, 2, lang()) }));
      else if (e.type === "lost") { say(t("ev.lost")); ui.lostAt = performance.now(); }
      else if (e.type === "timeUp") say(t("ev.timeUp"));
      else if (e.type === "void") say(t("ev.void"));
      else if (e.type === "notStart") say(t("ev.notStart"));
      else if (e.type === "launch") say(t("ev.launch"), 700);
    }
  }

  // ---------- azioni (pannelli, tasti, pulsanti) ----------
  function doAction(id) {
    const [k, v] = id.split(":");
    if (k === "vec") opt.vec[v] = !opt.vec[v];
    else if (k === "each") opt.each = !opt.each;
    else if (k === "split") opt.split = !opt.split;
    else if (k === "strobe") { opt.strobe = !opt.strobe; if (!opt.strobe) strobeClear(); }
    else if (k === "snap" || k === "zsnap") opt.snap = !opt.snap;
    else if (k === "pred") opt.predict = v;
    else if (k === "slow") opt.slow = +v;
    else if (k === "g") opt.g = +v;
    else if (k === "mass") { opt.mass = +v; if (track.sandbox) run.ball.m = opt.mass; }
    else if (k === "lang") setLang(v);
    else if (k === "close") ui.options = false;
    else if (k === "options") { ui.options = !ui.options; ui.gallery = null; }
    else if (k === "exit") { if (xrSession) xrSession.end(); }
    else if (k === "clearZones") { userZones.length = 0; selZone = null; ui.zoneMenu = null; syncZoneViews(); syncDom(); }
    else if (k === "homeStage") { stage.position.set(0, 0, 0); stage.quaternion.identity(); stage.scale.setScalar(1); }
    else if (k === "retry") retry();
    else if (k === "addZone") addZone(ui.gallery && ui.gallery.anchor ? ui.gallery.anchor : null);
    else if (k === "gprev") { ui.galleryIdx = (ui.galleryIdx + TR.TRACKS.length - 1) % TR.TRACKS.length; }
    else if (k === "gnext") { ui.galleryIdx = (ui.galleryIdx + 1) % TR.TRACKS.length; }
    else if (k === "gplay") { loadTrack(ui.galleryIdx); ui.gallery = null; }
    else if (k === "zclose") ui.zoneMenu = null;
    else if (k === "zdel" && ui.zoneMenu) deleteZone(ui.zoneMenu);
    else if (k === "zdup" && ui.zoneMenu) duplicateZone(ui.zoneMenu);
    else if (k === "zzero" && ui.zoneMenu) ui.zoneMenu.F = [0, 0, 0];
    saveOpts(); drawOptCanvas();
  }

  // ---------- WebXR: sorgenti (controller e mani) ----------
  const ctrls = [renderer.xr.getController(0), renderer.xr.getController(1)];
  const grips = [renderer.xr.getControllerGrip(0), renderer.xr.getControllerGrip(1)];
  const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
  const rays = [0, 1].map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xfacc15 })); l.visible = false; return l; });
  const rings = [0, 1].map(() => { const g = new THREE.RingBufferGeometry(0.03, 0.04, 48, 1); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false })); m.visible = false; m.renderOrder = 10; scene.add(m); return m; });
  const GP = { TRIG: 0, GRIP: 1, STICK: 3, A: 4, B: 5 }; // xr-standard dei Touch — DA VERIFICARE sulla Quest (?monitor=1)
  const SRC = [0, 1].map((i) => ({
    i: i, kind: null, handed: null, gp: null, eng: null, grip: false, trig: false, pinch: false, fist: false, palmT: 0, palmUp: false,
    btnA: new Input.Button(600), btnB: new Input.Button(600), stick: new Input.Stick(), est: new Input.ThrowEstimator(), drag: null, uiDown: false,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), rayO: new THREE.Vector3(), rayD: new THREE.Vector3(), tip: null, palm: null, palmN: null,
  }));
  hands.forEach((h) => scene.add(h));
  ctrls.forEach((c, i) => {
    scene.add(c); scene.add(grips[i]); c.add(rays[i]);
    const knob = new THREE.Mesh(new THREE.BoxBufferGeometry(0.03, 0.025, 0.09), mat("ink", null, "lambert")); grips[i].add(knob); grips[i].userData.knob = knob;
    c.addEventListener("connected", (e) => { const s = SRC[i]; s.kind = e.data && e.data.hand ? "hand" : "controller"; s.gp = (e.data && e.data.gamepad) || null; s.handed = (e.data && e.data.handedness) || null; knob.visible = s.kind === "controller"; });
    c.addEventListener("disconnected", () => { const s = SRC[i]; endEngagement(s); s.kind = null; s.gp = null; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6), handMats = [new THREE.MeshBasicMaterial({ color: 0xf8fafc }), new THREE.MeshBasicMaterial({ color: 0xf8fafc })];
  const NEED = ["wrist", "thumb-tip", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "index-finger-metacarpal", "middle-finger-metacarpal", "pinky-finger-metacarpal"];
  const arr = (v) => [v.x, v.y, v.z];
  function readHand(s) {
    const J = hands[s.i].joints || {};
    for (const n of NEED) if (!J[n] || !J[n].visible) return false;
    for (const k in J) { const jt = J[k]; if (!jt.userData.vis) { const m = new THREE.Mesh(jointGeo, handMats[s.i]); jt.add(m); jt.userData.vis = m; } jt.userData.vis.scale.setScalar(jt.jointRadius || 0.008); }
    const th = J["thumb-tip"].position, ix = J["index-finger-tip"].position;
    s.pinch = Grab.pinchUpdate(s.pinch, th.distanceTo(ix)); s.near = th.distanceTo(ix) < 0.04;
    const j = { wrist: arr(J["wrist"].position), indexMeta: arr(J["index-finger-metacarpal"].position), pinkyMeta: arr(J["pinky-finger-metacarpal"].position), middleMeta: arr(J["middle-finger-metacarpal"].position),
      indexTip: arr(ix), middleTip: arr(J["middle-finger-tip"].position), ringTip: arr(J["ring-finger-tip"].position) };
    s.fist = Input.fist(j); s.palmN = Input.palmNormal(j, s.handed); s.palmUpNow = s.palmN[1] > 0.75;
    s.palm = j.middleMeta; s.tip = ix.clone();
    s.pos.copy(s.pinch || s.near ? th.clone().add(ix).multiplyScalar(0.5) : J["middle-finger-metacarpal"].position);
    handMats[s.i].color.setHex(s.pinch ? 0x34d399 : s.fist ? 0xfacc15 : 0xf8fafc);
    return true;
  }
  function readSources() {
    for (const s of SRC) {
      s.active = false;
      if (s.kind === "hand") { s.active = readHand(s); }
      else if (s.kind === "controller" && s.gp) {
        const b = s.gp.buttons || [];
        s.trigNow = !!(b[GP.TRIG] && b[GP.TRIG].pressed); s.gripNow = !!(b[GP.GRIP] && b[GP.GRIP].pressed);
        s.aNow = !!(b[GP.A] && b[GP.A].pressed); s.bNow = !!(b[GP.B] && b[GP.B].pressed);
        s.axes = Array.prototype.slice.call(s.gp.axes || []);
        grips[s.i].getWorldPosition(s.pos); grips[s.i].getWorldQuaternion(s.quat);
        s.active = grips[s.i].visible !== false;
      }
      if (s.kind) { ctrls[s.i].getWorldPosition(s.rayO); s.rayD.set(0, 0, -1).transformDirection(ctrls[s.i].matrixWorld); }
    }
  }
  const _inv = new THREE.Matrix4(), _l = new THREE.Vector3();
  function toStage(w) { _l.copy(w); stage.worldToLocal(_l); return [_l.x, _l.y, _l.z]; }
  function toWorld(p) { return stage.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); }
  const stageScale = () => stage.scale.x;
  function buzz(s, k, ms) { const gp = s.gp; if (!gp || s.kind !== "controller") return; try { const a = gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) a.pulse(k, ms); } catch (e) { /* non supportata */ } }
  function buzzAll(k, ms) { SRC.forEach((s) => buzz(s, k, ms)); }

  // bersagli delle maniglie: la più vicina a un punto (pista) entro r
  function nearestHandle(p, r) {
    let best = null, bd = r;
    for (const v of zoneViews.values()) for (const h of v.handles()) {
      const kind = h.userData.handle.kind, hp = handlePos(v, kind), d = V.len(V.sub(hp, p));
      if (d < bd) { bd = d; best = { view: v, kind: kind, mesh: h }; }
    }
    return best;
  }
  // maniglia vicina a un raggio (mondo): distanza dal raggio < r
  function handleOnRay(o, d, r) {
    let best = null, bt = 4;
    for (const v of zoneViews.values()) for (const h of v.handles()) {
      const w = toWorld(handlePos(v, h.userData.handle.kind)), op = w.clone().sub(o), tt = op.dot(d);
      if (tt <= 0 || tt > bt) continue;
      if (op.addScaledVector(d, -tt).length() < r) { bt = tt; best = { view: v, kind: h.userData.handle.kind, mesh: h, t: tt }; }
    }
    return best;
  }
  function zoneAt(p) { for (const z of userZones) if (P.inBox(p, z)) return zoneViews.get(z); return null; }
  function nearestZone(p) { let b = null, bd = 0.6; for (const z of userZones) { const v = zoneViews.get(z), d = V.len(V.sub(v.center(), p)); if (d < bd || P.inBox(p, z)) { bd = d; b = z; } } return b || selZone; }

  // pannelli attivi (per raggi e dita)
  function activePanels() { return [optP, galP, zoneP].filter((p) => p.mesh.visible && p.layout); }
  function rayPanel(o, d) {
    let best = null;
    for (const p of activePanels()) {
      p.mesh.updateMatrixWorld(true); _inv.copy(p.mesh.matrixWorld).invert();
      const h = X.rayHit(_inv.elements, o.toArray(), d.toArray()); if (!h) continue;
      // il pannello è scalato: le coordinate locali vanno riportate in metri
      const lx = h.x * p.mesh.scale.x, ly = h.y * p.mesh.scale.y;
      if (!X.inside(p.layout, lx, ly, 0)) continue;
      const it = X.hit(p.layout, lx, ly, ["btn"]), tt = o.distanceTo(_v.copy(d).multiplyScalar(h.t).add(o));
      if (!best || tt < best.t) best = { panel: p, item: it && !it.off ? it : null, t: tt };
    }
    return best;
  }
  const tracker = new Pointer.Tracker({ holdMs: 99999 });
  const poke = new X.Poke();
  function pressPanel(p, id) { p.flash = id; setTimeout(() => { p.flash = null; }, 150); doAction(id); }

  // ---------- coinvolgimento di una sorgente ----------
  let held = null; // { s, est, kind }
  function grabBall(s) {
    run.grab(); held = { s: s, est: s.est, kind: s.kind }; s.est.clear(); s.eng = "ball";
    if (band) clearBand();
    buzz(s, 0.4, 30);
  }
  function releaseBall(s, now) {
    if (!held || held.s !== s) return;
    const v = held.est.velocity(now || performance.now(), held.kind);
    held = null; s.eng = null; run.ball.m = mNow(); run.release(v); strobeClear();
  }
  function endEngagement(s, now) {
    if (s.eng === "ball") releaseBall(s, now);
    if (s.eng === "band" && band && band.src === s) clearBand();
    s.eng = null; s.drag = null;
  }
  function startDrag(s, h, viaRay) {
    s.eng = "drag";
    const hp = handlePos(h.view, h.kind);
    if (viaRay) s.drag = { view: h.view, kind: h.kind, t: h.t, off: [0, 0, 0] };
    else s.drag = { view: h.view, kind: h.kind, off: V.sub(hp, toStage(s.pos)) };
    selZone = h.view.z; buzz(s, 0.3, 20);
  }
  function updateDrag(s) {
    const d = s.drag; if (!d) return;
    let p;
    if (d.t !== undefined) p = toStage(s.rayO.clone().addScaledVector(s.rayD, d.t));
    else p = V.add(toStage(s.pos), d.off);
    dragHandle(d.view, d.kind, p);
  }

  // un fotogramma di ingressi XR
  function xrInput(now, dt) {
    readSources();
    const ballW = toWorld(run.ball.p), sc = stageScale();
    let hoverHandle = null;
    for (const s of SRC) {
      rays[s.i].visible = false;
      if (!s.active) { if (s.eng) endEngagement(s, now); continue; }
      const sp = toStage(s.pos);
      if (s.eng === "ball") { run.hold(sp); s.est.push(now, sp); }
      else s.est.push(now, sp);
      const isHand = s.kind === "hand";
      // --- pressioni ---
      const gripDown = isHand ? s.fist && !s.pinch : s.gripNow;
      const trigDown = isHand ? s.pinch : s.trigNow;
      const gripEdge = gripDown && !s.grip, gripUp = !gripDown && s.grip;
      const trigEdge = trigDown && !s.trig, trigUp = !trigDown && s.trig;
      s.grip = gripDown; s.trig = trigDown;
      const dBall = s.pos.distanceTo(ballW) / sc; // distanza in metri di pista
      // pannelli: raggio + dito
      const rp = rayPanel(s.rayO, s.rayD);
      const tev = tracker.update("s" + s.i, { down: trigDown, near: isHand ? s.near : false, target: rp && rp.item ? rp.panel.name + "#" + rp.item.id : null, point: null, grabbing: !!s.eng && s.eng !== "ui" }, now);
      if (rp && rp.item) rp.panel.hover = rp.item.id;
      if (!s.eng) { const r = rays[s.i]; r.visible = !isHand || !!rp; r.scale.z = rp ? rp.t : 0.6; }
      // gesto "prendere" (impugnatura / pugno)
      if (gripEdge && !s.eng) {
        const h = nearestHandle(sp, 0.07);
        if (dBall < 0.12) grabBall(s);
        else if (h) startDrag(s, h, false);
        else if (!isHand && zoneAt(sp)) { const v = zoneAt(sp); startDrag(s, { view: v, kind: "move" }, false); }
        else if (!isHand && (V.len(V.sub(sp, [track.start.p[0], 0.9, track.start.p[2]])) < 0.15 || SRC.some((o) => o !== s && o.eng === "stage"))) s.eng = "stage";
      }
      if (gripUp && (s.eng === "ball" || s.eng === "drag" || s.eng === "stage")) endEngagement(s, now);
      // gesto "grilletto / pizzico"
      if (trigEdge && !s.eng) {
        if (ui.gallery && ui.gallery.owner === s && !isHand) { doAction("gplay"); }
        else if (tev.down) { const [pn, id] = tev.down.split("#"); const p = panels.find((q) => q.name === pn); if (p) pressPanel(p, id); s.eng = "ui"; buzz(s, 0.3, 20); }
        else if (isHand && dBall < 0.08) grabBall(s);
        else {
          const h = isHand ? nearestHandle(sp, 0.06) : null;
          const hr = !isHand ? handleOnRay(s.rayO, s.rayD, 0.035) : null;
          if (h) startDrag(s, h, false);
          else if (hr) startDrag(s, hr, true);
          else if (!rp && !(held && held.s === s) && attachBand(s, sp)) { s.eng = "band"; buzz(s, 0.3, 25); }
          else if (rp) s.eng = "ui";
        }
      }
      if (trigUp && (s.eng === "band" || s.eng === "ui" || (s.eng === "drag") || (isHand && s.eng === "ball"))) {
        if (!(isHand && s.eng === "ball" && s.fist)) endEngagement(s, now);
      }
      if (isHand && s.eng === "ball" && !s.pinch && !s.fist) endEngagement(s, now);
      if (s.eng === "drag") updateDrag(s);
      if (s.eng === "band" && band) { band.anchor = sp; if (V.len(V.sub(run.ball.p, sp)) > band.rest + P.BAND.slack && now - (s.buzzT || 0) > 120) { buzz(s, 0.15, 20); s.buzzT = now; } }
      if (!s.eng) { const h = isHand ? nearestHandle(sp, 0.06) : handleOnRay(s.rayO, s.rayD, 0.035); if (h) hoverHandle = h.mesh; }
      // --- pulsanti dei controller ---
      if (!isHand) {
        const ea = s.btnA.update(s.aNow, now), eb = s.btnB.update(s.bNow, now);
        if (ea.tap) { const z = addZone(V.add(sp, toStageDir(s.rayD, 0.35))); if (z) buzz(s, 0.3, 30); }
        if (ea.hold) { const z = nearestZone(sp); if (z) { ui.zoneMenu = z; selZone = z; } buzz(s, 0.5, 40); }
        if (eb.tap) { if (ui.gallery) ui.gallery = null; else retry(); buzz(s, 0.3, 25); }
        if (eb.hold) { ui.options = !ui.options; ui.gallery = null; buzz(s, 0.5, 40); }
        const prog = Math.max(ea.progress, eb.progress);
        const ring = rings[s.i];
        ring.visible = prog > 0;
        if (prog > 0) {
          ring.geometry.setDrawRange(0, Math.ceil(prog * 48) * 6);
          ring.material.color.set(ea.progress >= eb.progress ? C.force : C.accent);
          ring.position.copy(s.pos).add(_v.set(0, 0.07, 0)); ring.lookAt(camera.position);
        }
        const ax = s.axes || [], dir = s.stick.update(ax[2] || 0, ax[3] || 0);
        if (dir === "up" && (!ui.gallery || ui.gallery.owner !== s)) { ui.gallery = { owner: s }; ui.galleryIdx = trackIdx; ui.options = false; buzz(s, 0.3, 20); }
        else if (ui.gallery && ui.gallery.owner === s) {
          if (dir === "left") doAction("gprev"); else if (dir === "right") doAction("gnext"); else if (dir === "down") ui.gallery = null;
        }
      } else {
        // palmo in su per 0,4 s: menu del palmo (galleria + azioni)
        const free = !s.eng && !s.pinch && !s.fist;
        s.palmT = s.palmUpNow && free ? s.palmT + dt : Math.max(0, s.palmT - dt * 0.5);
        if (s.palmT > 0.4 && (!ui.gallery || ui.gallery.owner !== s)) { ui.gallery = { owner: s, palm: true }; ui.galleryIdx = trackIdx; }
        if (ui.gallery && ui.gallery.owner === s && s.palmT === 0) ui.gallery = null;
      }
    }
    // dito indice: poke sui pannelli (ogni mano su ogni pannello, tranne il menu del proprio palmo)
    for (const s of SRC) {
      if (!s.active || s.kind !== "hand" || !s.tip) continue;
      for (const p of activePanels()) {
        if (p === galP && ui.gallery && ui.gallery.owner === s) continue;
        p.mesh.updateMatrixWorld(true); _l.copy(s.tip); p.mesh.worldToLocal(_l);
        const r = poke.update(s.i + p.name, { x: _l.x * p.mesh.scale.x, y: _l.y * p.mesh.scale.y, z: _l.z }, s.pinch, p.layout, 1);
        if (r.hover) p.hover = r.hover;
        if (r.press) pressPanel(p, r.press);
      }
    }
    for (const v of zoneViews.values()) v.update(hoverHandle);
    // pista: presa con una o due mani (GrabController)
    grab.update(SRC.filter((s) => s.active).map((s) => ({ id: "s" + s.i, active: true, pinching: s.eng === "stage", pos: s.pos.clone(), quat: s.quat.clone() })), dt, () => stage);
  }
  const grab = new Grab.GrabController(THREE, {});
  function toStageDir(dw, len) { const a = toStage(new THREE.Vector3(0, 0, 0)), b = toStage(dw.clone()); return V.mul(V.norm(V.sub(b, a)), len); }

  // posizioni dei pannelli nel visore
  function placeXrPanels(now) {
    const head = camera.getWorldPosition(new THREE.Vector3()), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    if (ui.options && !optP.mesh.visible) { optP.mesh.position.copy(head).addScaledVector(fwd, 0.6).add(_v.set(0, -0.15, 0)); optP.mesh.lookAt(head); }
    optP.mesh.visible = ui.options;
    if (ui.gallery) {
      const s = ui.gallery.owner;
      const base = s.kind === "hand" && s.palm ? new THREE.Vector3(s.palm[0], s.palm[1], s.palm[2]).add(_v.set(0, 0.16, 0)) : s.pos.clone().add(_v.set(0, 0.17, 0));
      galP.mesh.position.copy(base); galP.mesh.lookAt(head);
      ui.gallery.anchor = toStage(base.clone().addScaledVector(fwd, 0.3));
      buildMini(ui.galleryIdx); miniPivot.visible = true;
      miniPivot.position.copy(base).add(_v.set(0, galP.mesh.scale.y / 2 + 0.09, 0)); miniPivot.rotation.y = now / 3000;
    } else miniPivot.visible = false;
    galP.mesh.visible = !!ui.gallery;
    if (ui.zoneMenu && zoneViews.get(ui.zoneMenu)) {
      const c = toWorld(zoneViews.get(ui.zoneMenu).center()), toHead = head.clone().sub(c).normalize();
      zoneP.mesh.position.copy(c).addScaledVector(toHead, 0.35); zoneP.mesh.lookAt(head); zoneP.mesh.visible = true;
    } else zoneP.mesh.visible = false;
    if (monP) { monP.mesh.visible = true; monP.mesh.position.copy(head).addScaledVector(fwd, 0.9).add(_v.set(0, 0.35, 0)); monP.mesh.lookAt(head); }
  }

  // ---------- disegno della scena (ogni fotogramma) ----------
  function updateScene() {
    const b = run.ball;
    ball.position.set(b.p[0], b.p[1], b.p[2]);
    // porte: prossima = accento, passate = verde, altre = inchiostro
    built.gates.forEach((m, i) => { const role = run.passed[i] ? "vel" : (i === run.next && run.state !== "done") ? "accent" : "ink"; m.userData.ring.forEach((r) => (r.material = mat(role, null, m.userData.lam ? "lambert" : ""))); });
    // frecce
    const v = liveV(), f = liveForces(), moving = run.state !== "ready" || band;
    const show = (key, on, origin, vec, k) => (on ? ar[key].set(origin, vec, k) : ar[key].hide());
    show("v", opt.vec.v && moving, b.p, v, K.v);
    show("a", opt.vec.a, b.p, f.a, K.a);
    show("F", opt.vec.F && !opt.each, b.p, f.net, K.F);
    show("Fz", opt.vec.F && opt.each, b.p, f.zone, K.F);
    show("Fb", opt.vec.F && opt.each, b.p, f.band, K.F);
    show("W", opt.vec.F && opt.each, b.p, f.weight, K.F);
    const sp = P.splitA(f.a, v);
    show("apar", opt.split && opt.vec.a, b.p, sp.par, K.a);
    show("aperp", opt.split && opt.vec.a, b.p, sp.perp, K.a);
    for (const k of ["v", "a", "F"]) {
      const a = k === "F" && opt.each ? null : ar[k];
      lab[k].sp.visible = !!(a && a.g.visible);
      if (lab[k].sp.visible) lab[k].sp.position.set(a.tip[0], a.tip[1] + 0.035, a.tip[2]);
    }
    drawBand();
    // previsione: palla in mano (velocità stimata) o in volo, senza elastico
    if (predictOn() && (run.state === "held" || run.state === "flying" || run.state === "free")) {
      const pts = P.predict(b.p, v, b.m, { zones: allZones(), g: gNow() }, 3, 0.04, (p) => !TR.inVolume(p));
      setLine(predLine, pts);
    } else predLine.visible = false;
  }
  function sampleStrobe(dtSim) {
    if (!opt.strobe || !["flying", "free", "done", "failed"].includes(run.state)) return;
    strobeT += dtSim;
    if (strobeT >= 0.1) { strobeT -= 0.1; const m = strobe[strobeN % strobe.length]; m.position.set(run.ball.p[0], run.ball.p[1], run.ball.p[2]); m.visible = true; strobeN++; }
  }

  // ---------- fisica: passo fisso, rallentatore ----------
  let accT = 0;
  function physics(dt) {
    run.ball.m = mNow();
    accT += dt * opt.slow;
    let n = Math.floor(accT / P.DT); accT -= n * P.DT; n = Math.min(n, 60);
    const e = env();
    for (let i = 0; i < n; i++) { run.advance(e, 1); sampleStrobe(P.DT); }
    handleEvents();
    if (run.state === "lost" && ui.lostAt && performance.now() - ui.lostAt > 1000) retry();
    if (["free", "done", "failed"].includes(run.state) && !TR.inVolume(run.ball.p)) retry();
  }

  // ---------- schermo: camera orbitale e trascinamenti ----------
  const orbit = { target: new THREE.Vector3(-0.15, 1.2, -1.5), r: 2.3, th: 0.5, ph: 1.2 };
  function placeCamera() {
    const o = orbit;
    camera.position.set(o.target.x + o.r * Math.sin(o.ph) * Math.sin(o.th), o.target.y + o.r * Math.cos(o.ph), o.target.z + o.r * Math.sin(o.ph) * Math.cos(o.th));
    camera.lookAt(o.target);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let mouse = null; // { mode: 'orbit'|'ball'|'drag', plane, ... }
  let lastPointer = null;
  function setNdc(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function planePoint(planeW) { const p = new THREE.Vector3(); return ray.ray.intersectPlane(planeW, p) ? p : null; }
  function camPlaneAt(w) { const n = camera.getWorldDirection(new THREE.Vector3()); return new THREE.Plane().setFromNormalAndCoplanarPoint(n, w); }
  // piano di trascinamento: orizzontale (avanti/indietro, destra/sinistra); con Maiusc verticale, rivolto alla camera
  function dragPlaneAt(w, e) { if (e.shiftKey) { const n = camera.getWorldDirection(new THREE.Vector3()); n.y = 0; if (n.lengthSq() < 1e-6) n.set(0, 0, -1); return new THREE.Plane().setFromNormalAndCoplanarPoint(n.normalize(), w); } return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), w); }
  const desk = { est: new Input.ThrowEstimator(), kind: "controller" };
  const cv = renderer.domElement;
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    if (renderer.xr.isPresenting) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* puntatore sintetico */ }
    updateScene(); zoneViews.forEach((v) => v.update(null)); scene.updateMatrixWorld(true); // mesh allineate alla fisica prima del raggio
    setNdc(e);
    if (e.button === 0) {
      const handles = []; zoneViews.forEach((v) => v.handles().forEach((h) => handles.push(h)));
      const hits = ray.intersectObjects([ball].concat(handles), true);
      if (hits.length) {
        let o = hits[0].object; while (o && o !== ball && !o.userData.handle) o = o.parent;
        if (o === ball) { mouse = { mode: "ball", plane: dragPlaneAt(toWorld(run.ball.p), e) }; run.grab(); held = { s: desk, est: desk.est, kind: "controller" }; desk.est.clear(); clearBand(); return; }
        if (o && o.userData.handle) { const hv = o.userData.handle; mouse = { mode: "drag", view: hv.view, kind: hv.kind, plane: dragPlaneAt(toWorld(handlePos(hv.view, hv.kind)), e) }; selZone = hv.view.z; syncDom(); return; }
      }
      const boxes = []; zoneViews.forEach((v) => { if (!v.z.locked) boxes.push(v.box); });
      const bh = ray.intersectObjects(boxes, false);
      if (bh.length) { const v = [...zoneViews.values()].find((q) => q.box === bh[0].object); selZone = v.z; syncDom(); }
    }
    mouse = { mode: "orbit", x: e.clientX, y: e.clientY };
  });
  cv.addEventListener("pointermove", (e) => {
    lastPointer = e;
    if (!mouse) return;
    setNdc(e);
    if (mouse.mode === "orbit") { orbit.th -= (e.clientX - mouse.x) * 0.006; orbit.ph = clamp(orbit.ph - (e.clientY - mouse.y) * 0.006, 0.15, 2.9); mouse.x = e.clientX; mouse.y = e.clientY; placeCamera(); }
    else {
      if (mouse.shift !== e.shiftKey && mouse.mode) { mouse.shift = e.shiftKey; const cur = mouse.mode === "ball" ? run.ball.p : handlePos(mouse.view, mouse.kind); mouse.plane = dragPlaneAt(toWorld(cur), e); }
      const w = planePoint(mouse.plane); if (!w) return; const p = toStage(w); if (mouse.mode === "ball") { run.hold(p); desk.est.push(performance.now(), p); } else dragHandle(mouse.view, mouse.kind, p); }
  });
  const endMouse = () => {
    if (mouse && mouse.mode === "ball" && held) { const v = desk.est.velocity(performance.now(), "controller"); held = null; run.ball.m = mNow(); run.release(v); strobeClear(); }
    mouse = null;
  };
  cv.addEventListener("pointerup", endMouse); cv.addEventListener("pointercancel", endMouse);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); orbit.r = clamp(orbit.r * Math.exp(e.deltaY * 0.001), 0.8, 8); placeCamera(); }, { passive: false });
  // Spazio: elastico verso il puntatore (piano per la palla rivolto alla camera)
  let spaceDown = false;
  function bandToPointer() {
    if (!lastPointer) return null;
    setNdc(lastPointer); const w = planePoint(camPlaneAt(toWorld(run.ball.p)));
    return w ? toStage(w) : null;
  }
  addEventListener("keydown", (e) => {
    if (renderer.xr.isPresenting || e.target.closest("input, textarea, dialog")) return;
    if (e.code === "Space") { e.preventDefault(); if (!spaceDown) { spaceDown = true; const p = bandToPointer(); if (p) attachBand(desk, p); } }
    else if (e.key === "r" || e.key === "R") retry();
    else if (e.key === "f" || e.key === "F") addZone();
    else if ((e.key === "Delete" || e.key === "Backspace") && selZone && !selZone.locked) deleteZone(selZone);
  });
  addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; if (band && band.src === desk) clearBand(); } });

  function resize() { const w = view.clientWidth, h = view.clientHeight; if (!w || !h || renderer.xr.isPresenting) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(view);

  // ---------- pagina: elenco piste, opzioni su canvas, pulsanti ----------
  const optcv = $("optcv");
  function drawOptCanvas() {
    const L = X.buildOptions({ t, lang: lang(), opt, sandbox: !!track.sandbox, xr: null });
    optcv.width = L.W; optcv.height = L.H; optcv._layout = L;
    X.draw(optcv.getContext("2d"), L, null, null, C);
  }
  optcv.addEventListener("click", (e) => {
    const L = optcv._layout; if (!L) return;
    const r = optcv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * L.W, py = (e.clientY - r.top) / r.height * L.H;
    const it = X.hit(L, (px - L.W / 2) * L.MPP, (L.H / 2 - py) * L.MPP, ["btn"]);
    if (it && !it.off && it.id !== "close") doAction(it.id);
  });
  function syncDom() {
    const list = $("trackList");
    list.innerHTML = "";
    TR.TRACKS.forEach((tr, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (i === trackIdx ? " on" : "");
      b.setAttribute("aria-pressed", String(i === trackIdx));
      const m = TR.medalFor(tr, best[tr.id]);
      b.innerHTML = `<span>${tr.sandbox ? "" : tr.n + " · "}${tr.name[lang()] || tr.name.en}</span><span class="med">${["", "🥉", "🥈", "🥇"][m]}</span>`;
      b.title = tr.idea[lang()] || tr.idea.en;
      b.onclick = () => loadTrack(i);
      list.append(b);
    });
    $("zoneBtn").disabled = userZones.length >= track.maxZones;
    $("delZoneBtn").disabled = !selZone || selZone.locked;
    drawOptCanvas();
  }
  $("retryBtn").onclick = () => retry();
  $("zoneBtn").onclick = () => addZone();
  $("delZoneBtn").onclick = () => selZone && deleteZone(selZone);
  onLang(() => { rebuildVisual(); labels.forEach((l) => l.redraw()); zoneViews.forEach((v) => (v.sig = "")); syncDom(); });
  onTheme((dark) => { if (!ui.xr) applyPalette(dark ? "dark" : "light"); });

  // ---------- sessioni XR ----------
  let xrSession = null;
  const xrOk = {}, vrBtn = $("vrBtn"), arBtn = $("arBtn"), note = $("xrnote");
  function syncXrButtons() {
    for (const [m, b, key] of [["immersive-vr", vrBtn, "vr"], ["immersive-ar", arBtn, "ar"]]) {
      b.disabled = !xrOk[m] || (!!xrSession && ui.xr !== m);
      b.querySelector(".lbl").textContent = t(ui.xr === m ? "leave" : key);
    }
  }
  (async function initXR() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) { note.textContent = t("noxr"); return; }
    for (const m of ["immersive-vr", "immersive-ar"]) { try { xrOk[m] = await navigator.xr.isSessionSupported(m); } catch (e) { xrOk[m] = false; } }
    syncXrButtons();
    if (!xrOk["immersive-vr"]) note.textContent = t("noimm");
  })();
  async function startXR(mode) {
    if (xrSession) { xrSession.end(); return; }
    try {
      renderer.xr.setReferenceSpaceType("local-floor");
      const sess = await navigator.xr.requestSession(mode, { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] });
      xrSession = sess; ui.xr = mode;
      sess.addEventListener("end", () => {
        xrSession = null; ui.xr = null; SRC.forEach(endEngagement); ui.options = false; ui.gallery = null; ui.zoneMenu = null;
        [optP, galP, zoneP].forEach((p) => (p.mesh.visible = false)); miniPivot.visible = false;
        document.body.classList.remove("inxr"); applyPalette(isDark() ? "dark" : "light"); syncXrButtons(); placeCamera(); resize();
      });
      await renderer.xr.setSession(sess);
      document.body.classList.add("inxr");
      applyPalette(mode === "immersive-ar" ? "light" : "dark");
      syncXrButtons();
    } catch (err) { xrSession = null; ui.xr = null; syncXrButtons(); note.textContent = t("xrfail", { msg: err.message }); }
  }
  vrBtn.addEventListener("click", () => startXR("immersive-vr"));
  arBtn.addEventListener("click", () => startXR("immersive-ar"));

  // ---------- monitor (?monitor=1): tasti e assi grezzi, palmo ----------
  function monitorLayout() {
    const lines = SRC.map((s) => s.kind === "controller" && s.gp ? `${s.handed || s.i}: btn [${(s.gp.buttons || []).map((b, i) => (b.pressed ? i : "")).filter((x) => x !== "").join(",")}] axes ${(s.axes || []).map((a) => a.toFixed(1)).join(" ")}`
      : s.kind === "hand" ? `${s.handed || s.i}: hand pinch=${s.pinch} fist=${s.fist} palm y=${s.palmN ? s.palmN[1].toFixed(2) : "-"}` : `${s.i}: —`);
    const items = lines.map((l, i) => ({ id: "m" + i, kind: "text", x: 20, y: 20 + i * 40, w: 760, h: 36, label: l, small: true }));
    return { W: 800, H: 110, MPP: 0.0006, frame: 0, items: items };
  }

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fn) { try { return fn(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error("Error in " + name + ":", err); note.textContent = "Error in " + name + ": " + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    panels.forEach((p) => (p.hover = null));
    if (presenting) {
      scene.updateMatrixWorld(true);
      safe("input", () => xrInput(now, dt));
      safe("panels", () => placeXrPanels(now));
    } else {
      for (const v of zoneViews.values()) v.update(null);
      if (spaceDown && band && band.src === desk) { const p = bandToPointer(); if (p) band.anchor = p; }
    }
    safe("physics", () => physics(dt));
    safe("scene", updateScene);
    safe("hud", () => {
      hudP.mesh.visible = presenting;
      const hs = hudState(), sig0 = hudP.sig;
      hudP.render(X.buildHud(hs), JSON.stringify([hs.msg, X.num(hs.run.time, 2, "en"), hs.run.next, hs.v.toFixed(2), hs.a.toFixed(2), hs.F.toFixed(2), hs.best, hs.mass, hs.g, lang()]));
      if (!presenting && hudP.sig !== sig0) { const hc = $("hudcv"); if (hc.width !== hudP.cv.width || hc.height !== hudP.cv.height) { hc.width = hudP.cv.width; hc.height = hudP.cv.height; } const c2 = hc.getContext("2d"); c2.clearRect(0, 0, hc.width, hc.height); c2.drawImage(hudP.cv, 0, 0); }
      if (optP.mesh.visible || ui.options) { const L = X.buildOptions({ t, lang: lang(), opt, sandbox: !!track.sandbox, xr: ui.xr }); optP.render(L, JSON.stringify(opt) + lang() + track.id); }
      if (ui.gallery) {
        const tr = TR.TRACKS[ui.galleryIdx];
        galP.render(X.buildGallery({ t, lang: lang(), track: tr, index: tr.n, count: TR.TRACKS.length - 1, best: best[tr.id], medal: TR.medalFor(tr, best[tr.id]), palm: !!ui.gallery.palm, canAdd: userZones.length < track.maxZones }), ui.galleryIdx + lang() + !!ui.gallery.palm + userZones.length);
      }
      if (ui.zoneMenu) zoneP.render(X.buildZoneMenu({ t, lang: lang(), F: V.len(ui.zoneMenu.F), snap: opt.snap, canAdd: userZones.length < track.maxZones }), V.len(ui.zoneMenu.F).toFixed(2) + opt.snap + lang() + userZones.length);
      if (monP && frameN % 6 === 0) monP.render(monitorLayout(), String(frameN));
    });
    if (!presenting && frameN % 15 === 0) $("delZoneBtn").disabled = !selZone || selZone.locked;
    renderer.render(scene, camera);
  });

  // ---------- avvio ----------
  placeCamera(); resize();
  applyPalette(isDark() ? "dark" : "light");
  loadTrack(trackIdx);
  window.__app = { THREE, scene, camera, renderer, stage, ball, get run() { return run; }, get track() { return track; }, get userZones() { return userZones; }, zoneViews, opt, ui, SRC, best,
    loadTrack, retry, addZone, deleteZone, dragHandle, handlePos, doAction, attachBand, clearBand, get band() { return band; }, xrInput, rayPanel, panels, grab, env, physics, applyPalette, readSources, ctrls, grips, hands, updateScene, placeXrPanels };
}
