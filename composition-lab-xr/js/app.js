// Composition Lab XR · app.js
// Scena Three.js, ingressi WebXR (mani e controller), pannello flottante, interazione da schermo.
// La matematica è in expr.js e compose.js (pure, testate in Node); qui c'è la presentazione.
// Riferimento: `stage` (il "palco") contiene il cubo [−R, R]³ in unità matematiche (1 unità = `stage.scale` metri):
//   matematica (x, y, z) → Three.js (x, z, −y): x a destra, y verso il fondo, z verso l'alto.
//   Piano xy = f (orizzontale), piano yz = g (parete laterale), piano xz = g∘f (parete davanti a chi guarda).
// L'interazione lavora in coordinate del palco (stage.worldToLocal): spostare o scalare il palco non cambia il significato di x.
/* global THREE, Expr, Compose, Grab */

export function startApp(kit) {
  const { t, onLang, onTheme, isDark, toast, fmtNum, parseNum, store } = kit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MONITOR = /[?&]monitor=1/.test(location.search);
  const R = Compose.R, NB = Compose.NB;
  const V = (x, y, z) => new THREE.Vector3(x, z, -y);   // matematica → Three.js
  const S0 = 0.09;                                      // scala iniziale: il cubo è largo ~0,72 m, la mano lo abbraccia
  const BASE = [R + 1.6, -R * 0.2, R + 0.4];            // cubo-base (coordinate Three.js del palco): in basso a destra, davanti
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- palette: token del laboratorio + i tre grafici (f arancione, g verde, g∘f viola) ----------
  const PAL = {
    light: { scene: "#ECEEF2", card: "#FFFFFF", ink: "#15161A", muted: "#5B6070", accent: "#2449D6", onaccent: "#FFFFFF", tile2: "#FFD84D", f: "#C96A00", g: "#0F9A63", gf: "#6E3FE0", grid: "#C2C7D0", base: "#5B6070" },
    dark: { scene: "#13151A", card: "#1D2028", ink: "#EEF0F4", muted: "#9AA1AE", accent: "#8AA4FF", onaccent: "#13151A", tile2: "#E9B92A", f: "#FFB44D", g: "#3DDC97", gf: "#B59CFF", grid: "#3A3F4A", base: "#9AA1AE" },
  };
  let palName = isDark() ? "dark" : "light";
  let C = PAL[palName];

  // ---------- stato ----------
  const S = { fsrc: "x^2", gsrc: "y - 2", x0: 1.5, x1: -1, level: 3, mode: "trace", order: false, playing: false, preset: "square", traceFG: false, space: false, ball: false, adv: false };
  let f = (x) => x * x, g = (y) => y - 2;
  const ui = { xr: null, placed: false };
  const trail = new Compose.Trail();

  // ---------- THREE ----------
  const view = $("view");
  const renderer = new THREE.WebGLRenderer({ canvas: $("cv"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.xr.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.02, 60);
  scene.add(camera);
  const floorGrid = new THREE.GridHelper(8, 16, 0x888888, 0x888888);
  floorGrid.material = new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.6 });
  floorGrid.visible = false;
  scene.add(floorGrid);

  const roleMats = [];
  function mat(role, extra) { // MeshBasicMaterial che segue la palette
    const m = new THREE.MeshBasicMaterial(Object.assign({ color: C[role] }, extra || {}));
    m.userData.role = role; roleMats.push(m); return m;
  }
  const stage = new THREE.Group();
  stage.userData.grab = { scalable: true, min: 0.3, max: 3 };
  scene.add(stage);
  stage.scale.setScalar(S0);
  stage.position.set(0, 1.0, -0.6);

  // ---------- segmenti istanziati: linee spesse che si vedono bene nel visore ----------
  const segGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 6, 1, false);
  const _o = new THREE.Object3D(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function SegMesh(n, material, parent) {
    const m = new THREE.InstancedMesh(segGeo, material, n);
    m.frustumCulled = false; m.count = 0; (parent || stage).add(m); m.userData.cap = n; return m;
  }
  function setSeg(m, i, a, b, r) {
    _d.copy(b).sub(a);
    const L = _d.length();
    if (L < 1e-7) _o.scale.set(0, 0, 0);
    else { _o.position.copy(a).add(b).multiplyScalar(0.5); _o.quaternion.setFromUnitVectors(_y, _d.multiplyScalar(1 / L)); _o.scale.set(r, L, r); }
    _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
  }
  const endSegs = (m, n) => { m.count = Math.min(n, m.userData.cap); m.instanceMatrix.needsUpdate = true; };

  // ---------- etichette (sprite con testo) ----------
  let labels = [];
  const FONT = '700 {n}px "Space Mono", monospace';
  function Label(text, w, o, parent) {
    o = o || {};
    this.text = text; this.o = o;
    this.cv = document.createElement("canvas"); this.cv.width = 256; this.cv.height = 96;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false }));
    this.sprite.scale.set(w, (w * 96) / 256, 1);
    this.sprite.renderOrder = 8;
    (parent || stage).add(this.sprite);
    labels.push(this); this.redraw();
  }
  Label.prototype.redraw = function () {
    const c = this.cv.getContext("2d"), role = this.o.role || "ink";
    c.clearRect(0, 0, 256, 96);
    c.font = FONT.replace("{n}", this.o.size || 52); c.textAlign = "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.lineWidth = 12; c.strokeStyle = C.scene; c.strokeText(this.text, 128, 50);
    c.fillStyle = C[role]; c.fillText(this.text, 128, 50);
    this.tex.needsUpdate = true;
  };
  Label.prototype.set = function (text) { if (text !== this.text) { this.text = text; this.redraw(); } };
  Label.prototype.dispose = function () {
    this.sprite.parent && this.sprite.parent.remove(this.sprite);
    this.tex.dispose(); this.sprite.material.dispose(); labels = labels.filter((l) => l !== this);
  };

  // ---------- cornice: tre piani con le sole squadrette d'angolo, assi con tacche, nomi ----------
  // Poco inchiostro: niente griglie, niente numeri sulle tacche; i numeri compaiono solo sulle sfere che viaggiano.
  const planes = [
    { role: "f", level: 1, name: "f", at: [R - 0.2, R - 0.2, 0], fill: (m) => m.rotation.set(-Math.PI / 2, 0, 0), uv: (u, v) => V(u, v, 0) },
    { role: "g", level: 2, name: "g", at: [0, R - 0.2, R - 0.2], fill: (m) => m.rotation.set(0, Math.PI / 2, 0), uv: (u, v) => V(0, u, v) },
    { role: "gf", level: 3, name: "g∘f", at: [R - 0.6, 0, R - 0.2], fill: () => {}, uv: (u, v) => V(u, 0, v) },
  ];
  const quadGeo = new THREE.PlaneBufferGeometry(2 * R, 2 * R);
  for (const p of planes) {
    p.group = new THREE.Group(); stage.add(p.group);
    const fill = new THREE.Mesh(quadGeo, mat(p.role, { transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    p.fill(fill); p.group.add(fill);
    p.brk = SegMesh(24, mat(p.role, { transparent: true, opacity: 0.8 }), p.group);
    let n = 0; const L = 1.1;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = p.uv(sx * R, sy * R);
      setSeg(p.brk, n++, c, p.uv(sx * R - sx * L, sy * R), 0.03); setSeg(p.brk, n++, c, p.uv(sx * R, sy * R - sy * L), 0.03);
    }
    endSegs(p.brk, n);
    p.label = new Label(p.name, 1.5, { size: 60, role: p.role }, p.group);
    p.label.sprite.position.copy(V(...p.at));
  }
  const axisM = SegMesh(64, mat("ink", { transparent: true, opacity: 0.55 }));
  {
    let n = 0;
    const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], perp = [[0, -1, 0], [-1, 0, 0], [-1, 0, 0]];
    dirs.forEach((d, i) => {
      setSeg(axisM, n++, V(...d.map((v) => -v * R)), V(...d.map((v) => v * (R + 0.7))), 0.025);
      for (let k = -R; k <= R; k++) {
        if (!k) continue;
        const c = d.map((v) => v * k), e = c.map((v, j) => v + perp[i][j] * 0.22);
        setSeg(axisM, n++, V(...c), V(...e), 0.018);
      }
    });
    endSegs(axisM, n);
  }
  let frameLabels = [];
  function buildFrameLabels() {
    frameLabels.forEach((l) => l.dispose()); frameLabels = [];
    const add = (text, p, w, o) => { const l = new Label(text, w, o); l.sprite.position.copy(V(...p)); frameLabels.push(l); };
    add("x", [R + 1.3, 0, 0], 1.1, { size: 60 }); add("y", [0, R + 1.3, 0], 1.1, { size: 60 }); add("z", [0, 0, R + 1.3], 1.1, { size: 60 });
    for (const [a, b, c] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) for (const s of [-1, 1]) {
      const off = a ? [0, -0.7, 0] : [-0.8, 0, 0];
      add(fmtNum(s * R, 0), [a * s * R + off[0], b * s * R + off[1], c * s * R + off[2]], 1.0, { size: 44, role: "muted" });
    }
  }

  // ---------- curve: f, g (la parte che g∘f usa in rilievo), g∘f intera ----------
  let curves = new THREE.Group(); stage.add(curves);
  function tube(pts, role, radius, opacity) {
    if (pts.length < 2) return;
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0), Math.max(2, pts.length * 2), radius, 8, false);
    const m = new THREE.Mesh(geo, mat(role, opacity < 1 ? { transparent: true, opacity } : {})); curves.add(m);
  }
  function buildCurves() {
    curves.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const i = roleMats.indexOf(o.material); if (i >= 0) roleMats.splice(i, 1); o.material.dispose(); } });
    stage.remove(curves); curves = new THREE.Group(); stage.add(curves);
    const N = 600, P = (a) => a.map((p) => V(...p));
    if (!S.traceFG) for (const s of Compose.sample(-R, R, N, (x) => [x, f(x), 0])) tube(P(s), "f", 0.035, 1);
    if (S.level >= 2 && !S.traceFG) {
      const r = Compose.range(f, N);
      for (const s of Compose.sample(-R, R, N, (y) => [0, y, g(y)])) tube(P(s), "g", 0.018, 0.22);   // g fuori dall'immagine di f: sbiadita
      if (r) for (const s of Compose.sample(r.lo, r.hi, N, (y) => [0, y, g(y)])) tube(P(s), "g", 0.035, 1);
    }
    if (S.level >= 2 && S.space) for (const s of Compose.sample(-R, R, N, (x) => [x, f(x), gf(x)])) tube(P(s), "ink", 0.022, 0.75); // la curva (x, f(x), g(f(x))): le sue ombre sono f, g e g∘f
    if (S.level >= 3 && S.mode === "full") for (const s of Compose.sample(-R, R, N, (x) => [x, 0, gf(x)])) tube(P(s), "gf", 0.035, 1);
  }
  const gf = (x) => { const y = f(x); return Number.isFinite(y) ? g(y) : NaN; };

  // ---------- traccia di g∘f: i punti compaiono solo dove la mano è passata ----------
  const trailMesh = new THREE.InstancedMesh(new THREE.SphereBufferGeometry(0.06, 8, 6), mat("gf"), NB + 1);
  trailMesh.frustumCulled = false; trailMesh.count = 0; stage.add(trailMesh);
  // con "Traccia anche f e g" la mano disegna anche f (piano xy) e g (piano yz), punto per punto
  const mkTrail = (role) => { const m = new THREE.InstancedMesh(new THREE.SphereBufferGeometry(0.06, 8, 6), mat(role), NB + 1); m.frustumCulled = false; m.count = 0; stage.add(m); return m; };
  const trailF = mkTrail("f"), trailG = mkTrail("g");
  const _m4 = new THREE.Matrix4();
  const putDot = (m, p) => { _m4.makeTranslation(p.x, p.y, p.z); m.setMatrixAt(m.count++, _m4); };
  function markTrail(key, x) {
    for (const k of trail.mark(key, x)) {
      const xx = trail.xOf(k), y = f(xx), z = gf(xx);
      if (Compose.inBox(z)) putDot(trailMesh, V(xx, 0, z));
      if (Compose.inBox(y)) putDot(trailF, V(xx, y, 0));
      if (Compose.inBox(y) && Compose.inBox(z)) putDot(trailG, V(0, y, z));
    }
    for (const m of [trailMesh, trailF, trailG]) m.instanceMatrix.needsUpdate = true;
  }
  function clearTrail() { trail.clear(); for (const m of [trailMesh, trailF, trailG]) { m.count = 0; m.instanceMatrix.needsUpdate = true; } }

  // ---------- la catena x → f(x) → g(f(x)) per un ingresso (x₀ piena, x₁ più tenue) ----------
  const UP = new THREE.Vector3(0, 1, 0);
  const coneGeo = new THREE.ConeBufferGeometry(1, 1, 16), ballGeo = new THREE.SphereBufferGeometry(1, 20, 14);
  function Arrow(role, opacity, r) {
    this.r = r; this.mat = mat(role, opacity < 1 ? { transparent: true, opacity } : {});
    this.group = new THREE.Group(); stage.add(this.group);
    this.body = SegMesh(3, this.mat, this.group);
    this.cone = new THREE.Mesh(coneGeo, this.mat); this.group.add(this.cone);
    this.joints = [0, 1].map(() => { const m = new THREE.Mesh(ballGeo, this.mat); m.scale.setScalar(r); this.group.add(m); return m; });
  }
  Arrow.prototype.set = function (pts) {
    const P = [pts[0]];
    for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(P[P.length - 1]) > 1e-4) P.push(pts[i]);
    this.cone.visible = false; this.joints.forEach((j) => (j.visible = false));
    let n = 0; const hl = this.r * 8, hr = this.r * 3.2;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i]; let b = P[i + 1];
      const d = b.clone().sub(a), L = d.length(); d.normalize();
      if (i === P.length - 2) {
        const h = Math.min(hl, L * 0.7), k = h / hl;
        b = b.clone().addScaledVector(d, -h);
        this.cone.visible = true; this.cone.scale.set(hr * k, h, hr * k);
        this.cone.position.copy(b).addScaledVector(d, h / 2); this.cone.quaternion.setFromUnitVectors(UP, d);
      }
      if (b.distanceTo(a) > 1e-4) setSeg(this.body, n++, a, b, this.r);
      if (i > 0) { this.joints[i - 1].visible = true; this.joints[i - 1].position.copy(a); }
    }
    endSegs(this.body, n);
  };
  Arrow.prototype.show = function (v) { this.group.visible = v; };
  const ballM = (role, r, opacity) => { const m = new THREE.Mesh(ballGeo, mat(role, opacity < 1 ? { transparent: true, opacity } : {})); m.scale.setScalar(r); stage.add(m); return m; };

  function Chain(name, opacity) {
    this.name = name; this.op = opacity;
    this.fArrow = new Arrow("f", opacity, 0.04); this.gArrow = new Arrow("g", opacity, 0.04);
    this.guide = SegMesh(2, mat("gf", opacity < 1 ? { transparent: true, opacity } : {}));
    this.handle = new THREE.Group();
    this.handleMat = mat(opacity < 1 ? "muted" : "tile2");
    this.handle.add(new THREE.Mesh(ballGeo, this.handleMat));
    const out = new THREE.Mesh(ballGeo, mat("ink", { side: THREE.BackSide })); out.scale.setScalar(1.16); this.handle.add(out);
    this.handle.scale.setScalar(0.3); stage.add(this.handle);
    this.yDot = ballM("f", 0.14, opacity); this.zDot = ballM("g", 0.14, opacity); this.q = ballM("gf", 0.16, opacity);
    const role = opacity < 1 ? "muted" : "ink";
    this.lx = new Label("", 1.7, { size: 50, role }); this.ly = new Label("", 1.7, { size: 50, role: "f" }); this.lz = new Label("", 1.7, { size: 50, role: "g" });
    this.lab = [this.lx, this.ly, this.lz];
  }
  Chain.prototype.setVisible = function (v) {
    [this.fArrow.group, this.gArrow.group, this.handle, this.yDot, this.zDot, this.q, this.guide].forEach((o) => (o.visible = v));
    this.lab.forEach((l) => (l.sprite.visible = v));
  };
  Chain.prototype.update = function (x) {
    const c = Compose.chain(f, g, x), lv = S.level;
    this.handle.position.copy(V(x, 0, 0)); this.handleMat.color.set(c.okY ? C[this.op < 1 ? "muted" : "tile2"] : C.muted);
    this.lx.sprite.position.copy(V(x, -0.2, -1.0)); this.lx.set(fmtNum(x, 2));
    const showF = c.okY, showG = lv >= 2 && c.okZ, showQ = lv >= 3 && c.okZ;
    this.fArrow.show(showF); if (showF) this.fArrow.set([V(x, 0, 0), V(x, c.y, 0), V(0, c.y, 0)]);
    this.yDot.visible = showF; this.yDot.position.copy(V(0, c.y, 0));
    this.ly.sprite.visible = showF; if (showF) { this.ly.sprite.position.copy(V(-1.2, c.y, 0.0)); this.ly.set(fmtNum(c.y, 2)); }
    this.gArrow.show(showG); if (showG) this.gArrow.set([V(0, c.y, 0), V(0, c.y, c.z), V(0, 0, c.z)]);
    this.zDot.visible = showG; this.zDot.position.copy(V(0, 0, c.z));
    this.lz.sprite.visible = showG; if (showG) { this.lz.sprite.position.copy(V(-1.2, -0.4, c.z)); this.lz.set(fmtNum(c.z, 2)); }
    this.q.visible = showQ; this.guide.visible = showQ;
    if (showQ) {
      this.q.position.copy(V(x, 0, c.z));
      setSeg(this.guide, 0, V(0, 0, c.z), V(x, 0, c.z), 0.015); setSeg(this.guide, 1, V(x, 0, 0), V(x, 0, c.z), 0.015); endSegs(this.guide, 2);
    }
    return c;
  };
  const ch0 = new Chain("x₀", 1), ch1 = new Chain("x₁", 0.5);
  ch1.lx.set(""); // le etichette di x₁ sono più discrete: solo la sfera e le frecce
  const ordArrows = { x: new Arrow("ink", 1, 0.06), y: new Arrow("f", 1, 0.06), z: new Arrow("g", 1, 0.06) };
  const ordLab = { y: new Label("", 2.6, { size: 38, role: "f" }), z: new Label("", 2.6, { size: 38, role: "g" }) };
  // filo tratteggiato dalla mano alla sfera: fa sentire che la mano "è" x
  const stringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineDashedMaterial({ color: C.ink, dashSize: 0.18, gapSize: 0.12 }));
  stringLine.visible = false; stringLine.frustumCulled = false; stage.add(stringLine);

  // base: cubo per spostare la scena
  const baseBox = new THREE.Group();
  baseBox.add(new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("base")));
  const bOut = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("ink", { side: THREE.BackSide })); bOut.scale.setScalar(1.14); baseBox.add(bOut);
  baseBox.position.set(...BASE); baseBox.scale.setScalar(0.9); stage.add(baseBox);

  // ---------- impulso che viaggia da x a g(f(x)) lungo le frecce (facoltativo): una testa luminosa e una coda che sbiadisce ----------
  const ballG = new THREE.Group();
  ballG.add(new THREE.Mesh(ballGeo, mat("accent")));
  const bo = new THREE.Mesh(ballGeo, mat("ink", { side: THREE.BackSide })); bo.scale.setScalar(1.16); ballG.add(bo);
  ballG.scale.setScalar(0.24); ballG.visible = false; ballG.renderOrder = 5; stage.add(ballG);
  const TAIL = 12, TSP = 0.16, SPEED = 5, PAUSE = 0.7;   // punti di coda, distanza tra i punti (unità), velocità (unità/s), pausa tra due impulsi (s)
  const tail = Array.from({ length: TAIL }, (_, i) => {
    const m = new THREE.Mesh(ballGeo, mat("accent", { transparent: true, opacity: 1 - (i + 1) / (TAIL + 1) }));
    m.visible = false; m.renderOrder = 4; stage.add(m); return m;
  });
  function pointAt(P, len, d, out) {
    let i = 1; while (i < P.length - 1 && len[i] < d) i++;
    const seg = len[i] - len[i - 1];
    return out.lerpVectors(P[i - 1], P[i], seg > 1e-9 ? clamp((d - len[i - 1]) / seg, 0, 1) : 1);
  }
  function animateBall(now) {
    ballG.visible = false; tail.forEach((m) => (m.visible = false));
    if (!S.ball) return;
    const c = Compose.chain(f, g, S.x0);
    if (!c.okY) return;
    const P = [V(c.x, 0, 0), V(c.x, c.y, 0), V(0, c.y, 0)];
    if (S.level >= 2 && c.okZ) { P.push(V(0, c.y, c.z), V(0, 0, c.z)); if (S.level >= 3) P.push(V(c.x, 0, c.z)); }
    const len = [0]; for (let i = 1; i < P.length; i++) len.push(len[i - 1] + P[i].distanceTo(P[i - 1]));
    const L = len[len.length - 1], travel = L / SPEED;
    let d = L, fade = 1;
    if (!reduceMotion) { const u = (now / 1000) % (travel + PAUSE); d = Math.min(L, u * SPEED); fade = u <= travel ? 1 : 1 - (u - travel) / PAUSE; }
    pointAt(P, len, d, ballG.position); ballG.visible = fade > 0.02; ballG.scale.setScalar(0.24 * (0.6 + 0.4 * fade));
    if (reduceMotion) return;
    tail.forEach((m, i) => {
      const di = d - (i + 1) * TSP * (0.6 + 0.4 * fade);
      m.visible = di >= 0 && fade > 0.02; if (!m.visible) return;
      pointAt(P, len, di, m.position); m.scale.setScalar(0.2 * (1 - i / (TAIL + 2)) * fade);
    });
  }

  // ---------- aggiornamento ----------
  function applyLevel() {
    planes.forEach((p) => (p.group.visible = S.level >= p.level));
    trailMesh.visible = S.level >= 3 && S.mode === "trace";
    trailF.visible = S.traceFG; trailG.visible = S.traceFG && S.level >= 2;
  }
  const stepText = (s) => (s === "none" ? "—" : t(s));
  function update() {
    applyLevel();
    const c0 = ch0.update(S.x0);
    ch1.setVisible(S.order);
    Object.values(ordArrows).forEach((a) => a.show(false)); Object.values(ordLab).forEach((l) => (l.sprite.visible = false));
    let o = null, c1 = null;
    if (S.order) {
      c1 = ch1.update(S.x1); ch1.lx.sprite.visible = false; ch1.ly.sprite.visible = false; ch1.lz.sprite.visible = false;
      o = Compose.order(c0, c1);
      if (o.rx && o.rx !== "=") {
        ordArrows.x.show(true); ordArrows.x.set([V(c0.x, 0, 0), V(c1.x, 0, 0)]);
        if (c0.okY && c1.okY && o.ry !== "=") {
          ordArrows.y.show(true); ordArrows.y.set([V(0, c0.y, 0), V(0, c1.y, 0)]);
          ordLab.y.sprite.visible = true; ordLab.y.set(stepText(o.f)); ordLab.y.sprite.position.copy(V(-1.9, (c0.y + c1.y) / 2, 0));
        }
        if (S.level >= 2 && c0.okZ && c1.okZ && o.rz !== "=") {
          ordArrows.z.show(true); ordArrows.z.set([V(0, 0, c0.z), V(0, 0, c1.z)]);
          ordLab.z.sprite.visible = true; ordLab.z.set(stepText(o.g)); ordLab.z.sprite.position.copy(V(-1.9, -0.4, (c0.z + c1.z) / 2));
        }
      }
    }
    syncDom(c0, c1, o);
    pSig = "";
  }
  function setX(key, x, src) {
    x = Compose.snap(x);
    if (S[key] === x) return;
    const prev = S[key]; S[key] = x; markTrail(key, x);
    if (src && Math.round(prev) !== Math.round(x)) buzz(src, 0.2, 12); // un colpetto a ogni intero
    update();
  }
  function setLevel(l) { S.level = l; buildCurves(); update(); }
  function setMode(m) { S.mode = m; buildCurves(); update(); }
  function setOrder(on) { S.order = on; if (on) { trail.forget("x1"); markTrail("x1", S.x1); } update(); }
  function refresh() { buildCurves(); clearTrail(); markTrail("x0", S.x0); if (S.order) markTrail("x1", S.x1); update(); saveSoon(); }

  // ---------- azioni (le stesse da schermo, dal pannello e da tastiera) ----------
  const idx = () => Compose.LIST.findIndex((p) => p.id === S.preset);
  function cyclePreset(dir) { const n = Compose.LIST.length, i = idx(); loadPreset(Compose.LIST[(((i < 0 ? 0 : i) + dir) % n + n) % n].id); }
  function loadPreset(id) {
    const p = Compose.byId(id) || Compose.LIST[0];
    applyState({ preset: p.id, f: p.f, g: p.g, x: p.x });
  }
  function setPlaying(p) { S.playing = p; syncDom(); pSig = ""; }
  const ACT = {
    sweep: () => setPlaying(!S.playing), prev: () => cyclePreset(-1), next: () => cyclePreset(1),
    l1: () => setLevel(1), l2: () => setLevel(2), l3: () => setLevel(3),
    clear: () => { clearTrail(); markTrail("x0", S.x0); if (S.order) markTrail("x1", S.x1); update(); },
    cmp: () => setOrder(!S.order), full: () => setMode(S.mode === "full" ? "trace" : "full"),
    adv: () => { S.adv = !S.adv; pSig = ""; }, back: () => { S.adv = false; pSig = ""; },
    traceFG: () => { S.traceFG = !S.traceFG; refresh(); }, space: () => { S.space = !S.space; buildCurves(); update(); }, ball: () => { S.ball = !S.ball; update(); },
    recenter: () => placeFromHead(), reset: () => { S.playing = false; loadPreset(Compose.byId(S.preset) ? S.preset : "square"); },
  };

  // ---------- funzioni, esempi, link ----------
  function showErr(which, e) {
    const el = $(which === "f" ? "fx" : "gy");
    $(which === "f" ? "errF" : "errG").textContent = e ? t(e.code, e.params) : "";
    el.setAttribute("aria-invalid", e ? "true" : "false");
  }
  function applyState(st) {
    const rf = Expr.tryFn(st.f, "x"), rg = Expr.tryFn(st.g, "y");
    if (!rf.ok || !rg.ok) { if (st.f !== Compose.LIST[0].f) return loadPreset(Compose.LIST[0].id); return; }
    f = rf.fn; g = rg.fn; S.fsrc = st.f; S.gsrc = st.g; S.x0 = Compose.snap(Number.isFinite(st.x) ? st.x : 0); S.playing = false;
    const p = Compose.LIST.find((q) => q.f === S.fsrc && q.g === S.gsrc);
    S.preset = p ? p.id : "custom";
    $("fx").value = S.fsrc; $("gy").value = S.gsrc; showErr("f", null); showErr("g", null);
    refresh();
  }
  const timers = {};
  function onFn(which) {
    clearTimeout(timers[which]);
    timers[which] = setTimeout(() => {
      const txt = $(which === "f" ? "fx" : "gy").value, r = Expr.tryFn(txt, which === "f" ? "x" : "y");
      if (!r.ok) { showErr(which, r.error); return; }
      showErr(which, null);
      if (which === "f") { f = r.fn; S.fsrc = txt; } else { g = r.fn; S.gsrc = txt; }
      const p = Compose.LIST.find((q) => q.f === S.fsrc && q.g === S.gsrc); S.preset = p ? p.id : "custom";
      refresh();
    }, 250);
  }
  const stateQuery = () => new URLSearchParams({ f: S.fsrc, g: S.gsrc, x: +S.x0.toFixed(2) }).toString();
  const shareUrl = () => location.origin + location.pathname + "#" + stateQuery();
  function readQuery(str) {
    const q = new URLSearchParams(str.replace(/^#/, ""));
    if (!q.has("f") || !q.has("g")) return null;
    const x = parseNum(q.get("x"));
    return { preset: "custom", f: q.get("f"), g: q.get("g"), x: Number.isFinite(x) ? x : 1 };
  }
  let saveT = 0;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { const s = stateQuery(); store.set("state", s); try { history.replaceState(null, "", "#" + s); } catch (e) { /* ignore */ } }, 400); }
  function share() { try { navigator.clipboard.writeText(shareUrl()).then(() => toast(t("copied")), () => toast(t("copied"))); } catch (e) { toast(shareUrl()); } }

  // ---------- pannello flottante (canvas → texture): pochi pulsanti grandi ----------
  const PW = 640, PH = 512, PM = 0.42, PMH = (PM * PH) / PW;
  const pcv = document.createElement("canvas"); pcv.width = PW; pcv.height = PH;
  const ptex = new THREE.CanvasTexture(pcv); ptex.anisotropy = 4;
  const panel = new THREE.Group(); panel.rotation.order = "YXZ"; panel.visible = false; scene.add(panel);
  const pmesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ map: ptex, transparent: true }));
  const pshadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
  pshadow.position.set(0.006, -0.006, -0.004);
  panel.add(pshadow, pmesh);
  const BH = 64, X0 = 24;
  const items = [
    { id: "prev", x: X0, y: 284, w: 88, h: BH }, { id: "next", x: X0 + 96, y: 284, w: 88, h: BH },
    { id: "l1", x: X0 + 192, y: 284, w: 112, h: BH }, { id: "l2", x: X0 + 312, y: 284, w: 112, h: BH }, { id: "l3", x: X0 + 432, y: 284, w: 136, h: BH },
    { id: "sweep", x: X0, y: 356, w: 172, h: BH }, { id: "clear", x: X0 + 180, y: 356, w: 136, h: BH }, { id: "cmp", x: X0 + 324, y: 356, w: 136, h: BH }, { id: "recenter", x: X0 + 468, y: 356, w: 100, h: BH },
    { id: "full", x: X0, y: 428, w: 436, h: BH }, { id: "adv", x: X0 + 444, y: 428, w: 124, h: BH },
  ];
  // seconda pagina del pannello: impostazioni avanzate
  const advItems = [
    { id: "traceFG", x: X0, y: 140, w: 568, h: BH }, { id: "space", x: X0, y: 220, w: 568, h: BH }, { id: "ball", x: X0, y: 300, w: 568, h: BH }, { id: "back", x: X0, y: 428, w: 568, h: BH },
  ];
  const curItems = () => (S.adv ? advItems : items);
  let pSig = "", pHover = null;
  const pfont = (n) => FONT.replace("{n}", n);
  function wrapText(c, text, x, y, maxW, lh, maxLines) {
    const words = text.split(" "); let line = "", n = 0;
    for (const wd of words) {
      const test = line ? line + " " + wd : wd;
      if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y + n * lh); n++; line = wd; if (n >= maxLines) return; } else line = test;
    }
    if (line && n < maxLines) c.fillText(line, x, y + n * lh);
  }
  function drawPanel() {
    const c = pcv.getContext("2d");
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = C.card; c.fillRect(0, 0, PW, PH);
    c.strokeStyle = C.ink; c.lineWidth = 8; c.strokeRect(4, 4, PW - 8, PH - 8);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
    if (!S.adv) {
      c.fillStyle = C.f; c.font = pfont(30); c.fillText("f(x) = " + S.fsrc, 28, 62, PW - 56);
      c.fillStyle = C.g; c.fillText("g(y) = " + S.gsrc, 28, 110, PW - 56);
    }
    c.fillStyle = C.muted; c.font = pfont(20);
    const q = Compose.byId(S.preset) ? t("pq." + S.preset) : t("custom");
    if (S.adv) { c.fillStyle = C.ink; c.fillRect(0, 0, PW, 100); c.fillStyle = C.card; c.font = pfont(30); c.textAlign = "left"; c.fillText(t("x.advTitle"), 28, 62); } else wrapText(c, q, 28, 158, PW - 56, 28, 3);
    for (const it of curItems()) {
      const on = (it.id === "l1" && S.level === 1) || (it.id === "l2" && S.level === 2) || (it.id === "l3" && S.level === 3) || (it.id === "sweep" && S.playing) || (it.id === "cmp" && S.order) || (S.adv && S[it.id] === true);
      const hov = pHover === it.id, hot = on || it.id === "sweep";
      c.fillStyle = hot ? C.accent : C.card; c.fillRect(it.x, it.y, it.w, it.h);
      if (hov) { c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(it.x, it.y, it.w, it.h); }
      c.strokeStyle = C.ink; c.lineWidth = hov ? 7 : 4; c.strokeRect(it.x, it.y, it.w, it.h);
      c.fillStyle = hot ? C.onaccent : C.ink; c.textAlign = "center";
      const lab = { prev: "◀", next: "▶", sweep: t(S.playing ? "pause" : "sweep"), full: t(S.mode === "full" ? "x.trace" : "x.full"), adv: t("x.adv"), back: t("x.back") }[it.id] || t("x." + it.id);
      c.font = pfont(it.id === "prev" || it.id === "next" ? 30 : lab.length > 9 ? 20 : 26);
      c.fillText(lab, it.x + it.w / 2, it.y + it.h / 2 + 9, it.w - 10);
    }
    if (MONITOR) { c.font = pfont(14); c.fillStyle = C.muted; c.textAlign = "left"; monLines().forEach((l, i) => c.fillText(l, 24 + i * 300, 16)); }
    ptex.needsUpdate = true;
  }
  const panelSig = () => [S.fsrc, S.gsrc, S.level, S.mode, S.order, S.playing, S.adv, S.traceFG, S.space, S.ball, S.preset, palName, t("sweep"), pHover, MONITOR ? Math.floor(performance.now() / 300) : 0].join("|");
  function itemAt(u, v) { const px = u * PW, py = (1 - v) * PH; return curItems().find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) || null; }
  const _rc = new THREE.Raycaster(), _pl = new THREE.Vector3();
  function rayPanel(o, d) {
    if (!panel.visible) return null;
    _rc.set(o, d); _rc.far = 3;
    const h = _rc.intersectObject(pmesh)[0];
    return h && h.uv ? { u: h.uv.x, v: h.uv.y, d: h.distance } : null;
  }
  function tipPanel(p) {
    if (!panel.visible) return null;
    _pl.copy(p); pmesh.worldToLocal(_pl);
    if (Math.abs(_pl.x) > PM / 2 || Math.abs(_pl.y) > PMH / 2) return null;
    return { u: _pl.x / PM + 0.5, v: _pl.y / PMH + 0.5, z: _pl.z };
  }

  // ---------- sorgenti XR: controller e mani ----------
  const ctrls = [renderer.xr.getController(0), renderer.xr.getController(1)];
  const grips = [renderer.xr.getControllerGrip(0), renderer.xr.getControllerGrip(1)];
  const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
  const GP = { TRIG: 0, GRIP: 1, STICKX: 2 }; // xr-standard dei Touch — DA VERIFICARE sulla Quest (?monitor=1)
  const SRC = [0, 1].map((i) => ({ i, kind: null, gp: null, handed: null, active: false, pos: new THREE.Vector3(), tip: new THREE.Vector3(), quat: new THREE.Quaternion(),
    rayO: new THREE.Vector3(), rayD: new THREE.Vector3(), pinch: false, down: false, prevDown: false, eng: null, off: 0, tipZ: 1, raw: "", stick: 0 }));
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.2)]);
  const rays = [0, 1].map(() => new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xeef0f4, transparent: true, opacity: 0.5 })));
  [0, 1].forEach((i) => {
    scene.add(ctrls[i], grips[i], hands[i]); ctrls[i].add(rays[i]); rays[i].visible = false;
    ctrls[i].addEventListener("connected", (e) => { const s = SRC[i]; s.kind = e.data && e.data.hand ? "hand" : "controller"; s.gp = (e.data && e.data.gamepad) || null; s.handed = (e.data && e.data.handedness) || null; });
    ctrls[i].addEventListener("disconnected", () => { const s = SRC[i]; s.kind = null; s.gp = null; s.eng = null; s.active = false; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6), jointMat = new THREE.MeshBasicMaterial({ color: 0xeef0f4 });
  function readSource(s) {
    s.active = false; s.prevDown = s.down; s.down = false; s.stick = 0;
    if (s.kind === "hand") {
      const J = hands[s.i].joints || {};
      const th = J["thumb-tip"], ix = J["index-finger-tip"];
      if (!th || !ix || !th.visible || !ix.visible) return;
      for (const k in J) { const jt = J[k]; if (!jt.userData.vis) { const m = new THREE.Mesh(jointGeo, jointMat); jt.add(m); jt.userData.vis = m; } jt.userData.vis.scale.setScalar(jt.jointRadius || 0.008); }
      s.pinch = Grab.pinchUpdate(s.pinch, th.position.distanceTo(ix.position));
      s.tip.copy(ix.position); s.pos.copy(th.position).add(ix.position).multiplyScalar(0.5);
      s.down = s.pinch; s.active = true; s.raw = "hand pinch=" + s.pinch;
    } else if (s.kind === "controller" && s.gp) {
      const b = s.gp.buttons || [], ax = s.gp.axes || [];
      const trig = !!(b[GP.TRIG] && b[GP.TRIG].pressed), grip = !!(b[GP.GRIP] && b[GP.GRIP].pressed);
      grips[s.i].getWorldPosition(s.pos); grips[s.i].getWorldQuaternion(s.quat);
      ctrls[s.i].getWorldPosition(s.rayO); s.rayD.set(0, 0, -1).transformDirection(ctrls[s.i].matrixWorld);
      s.tip.copy(s.rayO).addScaledVector(s.rayD, 0.03);
      s.down = trig || grip; s.trig = trig; s.active = grips[s.i].visible !== false;
      const sx_ = ax.length >= 3 ? ax[GP.STICKX] : 0; s.stick = Math.abs(sx_) > 0.18 ? sx_ : 0;
      s.raw = `ctrl btn[${b.map((x, k) => (x.pressed ? k : "")).filter((x) => x !== "").join(",")}] stick=${s.stick.toFixed(2)}`;
    }
  }
  function monLines() { return SRC.map((s) => `${s.handed || s.i}: ${s.kind ? s.raw || s.kind : "—"} ${s.eng || ""}`); }
  function buzz(s, k, ms) { const gp = s.gp; if (!gp || s.kind !== "controller") return; try { const a = gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) a.pulse(k, ms); } catch (e) { /* non supportata */ } }

  // bersagli afferrabili, in coordinate del palco → mondo
  const _l = new THREE.Vector3();
  const reach = () => 0.06 + 0.4 * stage.scale.x;
  function targets() {
    const out = [["x0", stage.localToWorld(V(S.x0, 0, 0))], ["base", stage.localToWorld(new THREE.Vector3(...BASE))]];
    if (S.order) out.push(["x1", stage.localToWorld(V(S.x1, 0, 0))]);
    return out;
  }
  function nearest(p) {
    let best = null, bd = reach();
    for (const [id, w] of targets()) { const d = w.distanceTo(p); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  const localOf = (w) => stage.worldToLocal(_l.copy(w));
  // la mano libera, vicino all'asse x mentre l'altra tiene x₀: è x₁ (destra e sinistra delle mani = ordine dei numeri)
  function nearAxis(p) { const l = localOf(p); return Math.hypot(l.y, l.z) < 1.3 && Math.abs(l.x) <= R + 1; }
  const grab = new Grab.GrabController(THREE, {});
  let near = {};
  function xrInput(now, dt) {
    if (!ui.placed) placeFromHead();
    SRC.forEach(readSource);
    near = {}; pHover = null; stringLine.visible = false;
    for (const s of SRC) {
      rays[s.i].visible = s.active && s.kind === "controller";
      if (!s.active) { s.eng = null; continue; }
      let hit = null;
      if (s.kind === "controller") { const h = rayPanel(s.rayO, s.rayD); if (h) { hit = h; rays[s.i].scale.z = h.d / 1.2; } else rays[s.i].scale.z = 1; }
      else if (s.kind === "hand" && !s.pinch) { const h = tipPanel(s.tip); if (h && h.z > -0.02 && h.z < 0.08) hit = h; }
      const it = hit ? itemAt(hit.u, hit.v) : null;
      if (it) pHover = it.id;
      const rising = s.down && !s.prevDown;
      if (s.kind === "controller" && rising && it) { ACT[it.id](); buzz(s, 0.4, 30); s.eng = "ui"; }
      if (s.kind === "hand") {
        const z = hit ? hit.z : 1;
        if (it && s.tipZ > 0.025 && z <= 0.015) ACT[it.id]();
        s.tipZ = hit ? z : 1;
      }
      // afferrare la sfera x₀ (o x₁) o la base; la seconda mano vicino all'asse diventa x₁
      if (rising && !s.eng) {
        const id = nearest(s.pos);
        if (id === "x0" || id === "x1") { s.eng = id; s.off = localOf(s.pos).x - S[id]; S.playing = false; buzz(s, 0.5, 40); }
        else if (id === "base") { s.eng = "base"; buzz(s, 0.5, 40); }
        else if (SRC.some((o) => o !== s && o.eng === "x0") && nearAxis(s.pos)) { s.eng = "x1"; s.off = 0; if (!S.order) setOrder(true); S.x1 = Compose.snap(localOf(s.pos).x); trail.forget("x1"); update(); buzz(s, 0.5, 40); }
        else if (SRC.some((o) => o !== s && o.eng === "base")) s.eng = "base"; // la seconda mano scala la scena
      }
      if (!s.down) s.eng = null;
      if (s.eng === "x0" || s.eng === "x1") {
        const l = localOf(s.pos);
        setX(s.eng, l.x - s.off, s);
        const tok = V(S[s.eng], 0, 0); stringLine.visible = true;
        stringLine.geometry.setFromPoints([l.clone(), tok]); stringLine.computeLineDistances();
      }
      if (s.stick && !s.eng) { S.playing = false; setX("x0", S.x0 + s.stick * 3 * dt); }
      if (!s.eng && !s.down) { const id = nearest(s.pos); if (id) near[id] = true; }
      if (s.eng) near[s.eng] = true;
    }
    grab.update(SRC.map((s) => ({ id: "s" + s.i, active: s.active, pinching: s.eng === "base", pos: s.pos.clone(), quat: s.quat.clone() })), dt, () => stage);
    ch0.handle.scale.setScalar(near.x0 ? 0.4 : 0.3); ch1.handle.scale.setScalar(near.x1 ? 0.4 : 0.3); baseBox.scale.setScalar(near.base ? 1.15 : 0.9);
  }

  // ---------- posizionamento davanti a chi guarda: x alla portata del braccio, pannello a sinistra ----------
  function placeFromHead() {
    const xc = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    const hp = new THREE.Vector3(), hq = new THREE.Quaternion();
    xc.getWorldPosition(hp); xc.getWorldQuaternion(hq);
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(hq); d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    d.normalize();
    const th = Math.atan2(-d.x, -d.z), hy = Math.max(1.0, hp.y), left = new THREE.Vector3(d.z, 0, -d.x); // sinistra di chi guarda
    stage.rotation.set(0, th, 0); stage.scale.setScalar(S0);
    stage.position.copy(hp).addScaledVector(d, 0.6); stage.position.y = hy - 0.4;
    panel.rotation.set(-0.35, th + 0.45, 0);
    panel.position.copy(hp).addScaledVector(d, 0.5).addScaledVector(left, 0.62); panel.position.y = Math.max(0.6, hy - 0.45);
    ui.placed = true; pSig = "";
  }

  // ---------- sessioni WebXR ----------
  let xrSession = null;
  const xrOk = {}, vrBtn = $("vrBtn"), arBtn = $("arBtn"), note = $("xrnote");
  function syncXrButtons() {
    for (const [m, b, key] of [["immersive-ar", arBtn, "ar"], ["immersive-vr", vrBtn, "vr"]]) {
      b.disabled = !xrOk[m] || (!!xrSession && ui.xr !== m);
      b.querySelector(".lbl").textContent = t(ui.xr === m ? "leave" : key);
    }
  }
  (async function initXR() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) { note.textContent = t("noxr"); return; }
    for (const m of ["immersive-ar", "immersive-vr"]) { try { xrOk[m] = await navigator.xr.isSessionSupported(m); } catch (e) { xrOk[m] = false; } }
    syncXrButtons();
    if (!xrOk["immersive-ar"] && !xrOk["immersive-vr"]) note.textContent = t("noimm");
  })();
  async function startXR(mode) {
    if (xrSession) { xrSession.end(); return; }
    try {
      renderer.xr.setReferenceSpaceType("local-floor");
      const sess = await navigator.xr.requestSession(mode, { optionalFeatures: ["local-floor", "hand-tracking"] });
      xrSession = sess; ui.xr = mode; ui.placed = false;
      sess.addEventListener("end", () => {
        xrSession = null; ui.xr = null; SRC.forEach((s) => (s.eng = null)); panel.visible = false; rays.forEach((r) => (r.visible = false)); stringLine.visible = false;
        document.body.classList.remove("inxr"); applyPalette(isDark() ? "dark" : "light"); syncXrButtons();
        stage.rotation.set(0, 0, 0); stage.scale.setScalar(S0); stage.position.set(0, 1.0, -0.6); camPlace(); resize();
      });
      await renderer.xr.setSession(sess);
      document.body.classList.add("inxr");
      applyPalette("dark"); // scuro nel visore: le tinte chiare si vedono sia nel nero della VR sia nel passthrough
      panel.visible = true; pSig = "";
      syncXrButtons();
    } catch (err) { xrSession = null; ui.xr = null; syncXrButtons(); note.textContent = t("xrfail", { msg: err.message }); }
  }
  arBtn.addEventListener("click", () => startXR("immersive-ar"));
  vrBtn.addEventListener("click", () => startXR("immersive-vr"));

  // ---------- palette ----------
  function applyPalette(name) {
    palName = name; C = PAL[name];
    for (const m of roleMats) m.color.set(C[m.userData.role]);
    floorGrid.material.color.set(C.grid); stringLine.material.color.set(C.ink);
    const vr = ui.xr === "immersive-vr", ar = ui.xr === "immersive-ar";
    scene.background = ar ? null : new THREE.Color(C.scene);
    floorGrid.visible = vr;
    labels.forEach((l) => l.redraw()); pSig = ""; update();
  }

  // ---------- schermo: camera orbitale, trascinamento della sfera, tastiera ----------
  const cam = { yaw: 0.5, pitch: 0.32, dist: 1.35, user: false }; // user: chi ha usato rotella o pizzico tiene la sua distanza
  const target = new THREE.Vector3();
  function camPlace() {
    stage.updateMatrixWorld(true);
    stage.localToWorld(target.set(0, 0, 0));
    camera.position.set(target.x + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch), target.y + cam.dist * Math.sin(cam.pitch), target.z + cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(target);
  }
  function resize() {
    if (renderer.xr.isPresenting) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!cam.user) { cam.dist = w / h < 1.2 ? clamp(1.35 * (1.2 / (w / h)) * 0.9, 1.35, 3) : 1.35; camPlace(); }
  }
  new ResizeObserver(() => resize()).observe(view);
  const cv = $("cv");
  const drag = { mode: null, id: null, x: 0, y: 0, off: 0 };
  const pts2 = new Map(); let pinch0 = 0;
  const _ndc = new THREE.Vector2(), _rr = new THREE.Raycaster();
  function screenRay(e) {
    const r = cv.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _rr.setFromCamera(_ndc, camera); return _rr.ray;
  }
  function axisX(ray) { // punto dell'asse x più vicino al raggio → x (unità del palco)
    const O = stage.localToWorld(V(0, 0, 0)), D = stage.localToWorld(V(1, 0, 0)).sub(O);
    const w0 = O.clone().sub(ray.origin), a = D.dot(D), b = D.dot(ray.direction), c = ray.direction.dot(ray.direction), d = D.dot(w0), e = ray.direction.dot(w0);
    const den = a * c - b * b; if (Math.abs(den) < 1e-12) return null;
    return (b * e - c * d) / den;
  }
  function screenOf(key, e) {
    const h = stage.localToWorld(V(S[key], 0, 0)).project(camera), r = cv.getBoundingClientRect();
    return Math.hypot(e.clientX - (((h.x + 1) / 2) * r.width + r.left), e.clientY - (((1 - h.y) / 2) * r.height + r.top));
  }
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts2.size === 2) { const [a, b] = [...pts2.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); drag.mode = "zoom"; return; }
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    const d0 = screenOf("x0", e), d1 = S.order ? screenOf("x1", e) : 1e9, key = d1 < d0 ? "x1" : "x0";
    if (Math.min(d0, d1) < 40) { drag.mode = key; S.playing = false; syncDom(); const x = axisX(screenRay(e)); drag.off = x === null ? 0 : x - S[key]; }
    else drag.mode = "orbit";
    cv.classList.add("held");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts2.has(e.pointerId)) return;
    pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.mode === "zoom" && pts2.size === 2) { const [a, b] = [...pts2.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.dist = clamp(cam.dist * (pinch0 / d), 0.5, 6); cam.user = true; pinch0 = d; camPlace(); return; }
    if (e.pointerId !== drag.id || !drag.mode) return;
    if (drag.mode === "x0" || drag.mode === "x1") { const x = axisX(screenRay(e)); if (x !== null) setX(drag.mode, x - drag.off); }
    else { cam.yaw -= (e.clientX - drag.x) * 0.008; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.006, -1.2, 1.5); camPlace(); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e) => { pts2.delete(e.pointerId); if (!pts2.size) { drag.mode = null; drag.id = null; cv.classList.remove("held"); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 0.5, 6); cam.user = true; camPlace(); }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea, dialog, button")) return;
    if (e.key === " ") { e.preventDefault(); ACT.sweep(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); S.playing = false; const key = e.shiftKey && S.order ? "x1" : "x0"; setX(key, S[key] + (e.key === "ArrowRight" ? 0.1 : -0.1)); }
    else if (e.key === "r" || e.key === "R") ACT.reset();
  });

  // ---------- DOM ----------
  $("playBtn").addEventListener("click", ACT.sweep);
  $("resetBtn").addEventListener("click", ACT.reset);
  $("clear").addEventListener("click", ACT.clear);
  $("tgOrder").addEventListener("click", ACT.cmp);
  for (const k of ["traceFG", "space", "ball"]) $("tg" + k[0].toUpperCase() + k.slice(1)).addEventListener("click", ACT[k]);
  $("fx").addEventListener("input", () => onFn("f")); $("gy").addEventListener("input", () => onFn("g"));
  $("levels").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setLevel(+b.dataset.l); });
  $("modeGF").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.m); });
  const psel = $("presetSel");
  function fillPresets() {
    psel.innerHTML = Compose.LIST.map((p) => `<option value="${p.id}">${t("pr." + p.id)}</option>`).join("") + `<option value="custom">${t("custom")}</option>`;
    psel.value = S.preset;
  }
  psel.addEventListener("change", () => { if (psel.value !== "custom") loadPreset(psel.value); });
  const seg = (id, attr, val) => $(id).querySelectorAll("button").forEach((b) => { const on = b.dataset[attr] === String(val); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const stepTag = (s) => (s === "none" ? `<span class="tag flat">—</span>` : `<span class="tag ${s}">${t(s)}</span>`);
  let presetSig = "";
  function syncDom(c0, c1, o) {
    c0 = c0 || Compose.chain(f, g, S.x0);
    const ro = $("readout"), n = (v) => fmtNum(v, 2);
    ro.innerHTML = `<span>x₀</span><b>${n(c0.x)}</b><span class="cf">f</span><b>${n(c0.y)}</b>` + (S.level >= 2 ? `<span class="cg">g</span><b>${n(c0.z)}</b>` : "");
    $("playLbl").textContent = t(S.playing ? "pause" : "sweep");
    $("playIcon").innerHTML = kit.icon(S.playing ? "pause" : "play");
    seg("levels", "l", S.level); seg("modeGF", "m", S.mode);
    $("clear").hidden = S.mode === "full";
    $("tgOrder").setAttribute("aria-pressed", String(S.order));
    for (const k of ["traceFG", "space", "ball"]) $("tg" + k[0].toUpperCase() + k.slice(1)).setAttribute("aria-pressed", String(S[k]));
    const ord = $("ordOut"); ord.hidden = !S.order;
    if (S.order && c1 && o) {
      ord.innerHTML = `<span>x₀ ${o.rx ?? "?"} x₁</span><span></span><span><b class="cf">f</b>: f(x₀) ${o.ry ?? "?"} f(x₁)</span>${stepTag(o.f)}`
        + (S.level >= 2 ? `<span><b class="cg">g</b>: g(f(x₀)) ${o.rz ?? "?"} g(f(x₁))</span>${stepTag(o.g)}` : "")
        + (S.level >= 3 ? `<span class="sum"><b class="cgf">g∘f</b></span>${stepTag(o.gf)}` : "");
    }
    const sig = S.preset + "|" + S.fsrc + "|" + S.gsrc;
    if (sig !== presetSig) { presetSig = sig; fillPresets(); $("question").textContent = Compose.byId(S.preset) ? t("pq." + S.preset) : ""; }
    saveSoon();
  }
  onLang(() => { presetSig = ""; syncDom(); syncXrButtons(); pSig = ""; buildFrameLabels(); });
  onTheme((dark) => { if (!ui.xr) applyPalette(dark ? "dark" : "light"); });
  if (document.fonts && document.fonts.load) document.fonts.load(pfont(30)).then(() => { labels.forEach((l) => l.redraw()); pSig = ""; }).catch(() => {});

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fn) { try { return fn(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error("Error in " + name + ":", err); note.textContent = "Error in " + name + ": " + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0, dir = 1;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    if (presenting) { scene.updateMatrixWorld(true); safe("input", () => xrInput(now, dt)); }
    if (S.playing) {
      let x = S.x0 + dir * dt * 1.6;
      if (x >= R) { x = R; dir = -1; } if (x <= -R) { x = -R; dir = 1; }
      S.x0 = x; markTrail("x0", x); update();
    }
    if (presenting) safe("panel", () => { const sg = panelSig(); if (sg !== pSig && (frameN % 3 === 0 || pSig === "")) { pSig = sg; drawPanel(); } });
    animateBall(now);
    renderer.render(scene, camera);
  });

  // ---------- avvio ----------
  applyPalette(palName);
  buildFrameLabels();
  const init = readQuery(location.hash) || readQuery("#" + (store.get("state") || ""));
  if (init) applyState(init); else loadPreset("square");
  window.addEventListener("hashchange", () => { const st = readQuery(location.hash); if (st) applyState(st); }); // un link incollato nella stessa scheda
  camPlace(); resize();
  window.__app = { THREE, scene, camera, renderer, stage, S, ui, SRC, ACT, panel, items, advItems, ctrls, grips, hands, xrInput, setX, setOrder, setLevel, placeFromHead, drawPanel, rayPanel, tipPanel, itemAt, Compose, trail, trailMesh, ch0, ch1, loadPreset, applyState };
  return { reset: ACT.reset, share, url: shareUrl };
}
