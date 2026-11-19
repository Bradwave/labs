// Dynagraph XR · app.js
// Scena Three.js, ingressi WebXR (mani e controller), pannello flottante, interazione da schermo.
// La matematica è in expr.js e dyna.js (pure, testate in Node); qui c'è la presentazione.
// Riferimento: `stage` (il "palco") è un piano verticale davanti a chi guarda, in unità matematiche (1 unità = `stage.scale` metri):
//   x a destra, y in alto, z verso chi guarda. Gli assi sono orizzontali e paralleli: IN (in alto), OUT, COMP (in basso).
//   Un valore v di un asse sta a X = (v − centro)/mezza ampiezza · R (Dyna.valToX).
// L'interazione lavora in coordinate del palco (stage.worldToLocal): spostare o scalare il palco non cambia il significato di x.
/* global THREE, Expr, Dyna, Grab */

export function startApp(kit) {
  const { t, onLang, onTheme, isDark, toast, fmtNum, parseNum, store } = kit;
  const $ = (id) => document.getElementById(id);
  const MONITOR = /[?&]monitor=1/.test(location.search);
  const R = Dyna.R, clamp = Dyna.clamp;
  const S0 = 0.09;                                      // scala iniziale: l'asse è largo ~0,72 m, la mano lo abbraccia
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AXN = ["in", "out", "comp"], KEYS = ["f", "g"], NB = 4;   // assi; funzioni con ingresso; fasce di età della traccia
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- palette: token del laboratorio; f, g, h seguono i colori scelti ----------
  const PAL = {
    light: { scene: "#ECEEF2", card: "#FFFFFF", ink: "#15161A", muted: "#5B6070", accent: "#0F6FC2", onaccent: "#FFFFFF", tile2: "#FFD84D", grid: "#C2C7D0", base: "#5B6070" },
    dark: { scene: "#13151A", card: "#1D2028", ink: "#EEF0F4", muted: "#9AA1AE", accent: "#6DB4FF", onaccent: "#13151A", tile2: "#E9B92A", grid: "#3A3F4A", base: "#9AA1AE" },
  };
  let palName = isDark() ? "dark" : "light";
  let C = PAL[palName];

  // ---------- stato ----------
  const S = {
    src: { f: Dyna.DEFAULTS.f, g: Dyna.DEFAULTS.g, h: Dyna.DEFAULTS.h },
    x: { f: Dyna.DEFAULTS.xf, g: Dyna.DEFAULTS.xg },
    vis: { f: true, g: true }, hOn: false, link: false, conn: "2_to_3", cart: false, full: true, pulse: false,
    trace: { f: false, g: false }, samp: { f: false, g: false }, traceLen: 120, density: 10, sInt: null, sStart: null, sEnd: null,
    col: Object.assign({}, Dyna.DEFAULT_COLORS), view: { in: Dyna.newView(), out: Dyna.newView(), comp: Dyna.newView() },
    d12: 4, d23: 4, playing: false, page: 0,
  };
  const fn = { f: (x) => x + 1, g: (x) => (x * x) / 2, h: (y) => Math.sin(y) };
  const ui = { xr: null, placed: false };
  const tr = { f: new Dyna.Trace(S.traceLen), g: new Dyna.Trace(S.traceLen) };
  const pageName = () => (isDark() ? "dark" : "light");
  const hexOf = (key, name) => Dyna.COLORS[S.col[key]][name || palName];
  function paintColors() { for (const n of ["light", "dark"]) for (const k of Dyna.KEYS) PAL[n][k] = hexOf(k, n); }
  paintColors();

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
  stage.position.set(0, 1.2, -0.6);

  // ---------- segmenti istanziati: linee spesse che si vedono bene nel visore ----------
  const segGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 6, 1, false);
  const _o = new THREE.Object3D(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function SegMesh(n, material, parent) {
    const m = new THREE.InstancedMesh(segGeo, material, n);
    m.frustumCulled = false; m.count = 0; (parent || stage).add(m); m.userData.cap = n; return m;
  }
  function setSeg(m, i, a, b, r) {
    if (i >= m.userData.cap) return;
    _d.copy(b).sub(a);
    const L = _d.length();
    if (L < 1e-7) _o.scale.set(0, 0, 0);
    else { _o.position.copy(a).add(b).multiplyScalar(0.5); _o.quaternion.setFromUnitVectors(_y, _d.multiplyScalar(1 / L)); _o.scale.set(r, L, r); }
    _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
  }
  const endSegs = (m, n) => { m.count = Math.min(n, m.userData.cap); m.instanceMatrix.needsUpdate = true; };
  const dotGeo = new THREE.SphereBufferGeometry(1, 8, 6), _m4 = new THREE.Matrix4();
  function DotMesh(n, material) { const m = new THREE.InstancedMesh(dotGeo, material, n); m.frustumCulled = false; m.count = 0; m.userData.cap = n; stage.add(m); return m; }
  function putDot(m, p, r) { if (m.count >= m.userData.cap) return; _m4.makeScale(r, r, r).setPosition(p.x, p.y, p.z); m.setMatrixAt(m.count++, _m4); }
  const endDots = (m) => { m.instanceMatrix.needsUpdate = true; };

  // ---------- etichette (sprite con testo) ----------
  let labels = [];
  const FONT = '700 {n}px "Space Mono", monospace';
  function Label(text, w, o, parent) {
    o = o || {};
    this.text = text; this.o = o; this.cw = o.cw || 256;
    this.cv = document.createElement("canvas"); this.cv.width = this.cw; this.cv.height = 96;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false }));
    this.sprite.scale.set(w, (w * 96) / this.cw, 1);
    this.sprite.renderOrder = 8;
    (parent || stage).add(this.sprite);
    labels.push(this); this.redraw();
  }
  Label.prototype.redraw = function () {
    const c = this.cv.getContext("2d"), role = this.o.role || "ink", W = this.cw;
    c.clearRect(0, 0, W, 96);
    c.font = FONT.replace("{n}", this.o.size || 52); c.textAlign = "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.lineWidth = 12; c.strokeStyle = C.scene; c.strokeText(this.text, W / 2, 50, W - 12);
    c.fillStyle = C[role]; c.fillText(this.text, W / 2, 50, W - 12);
    this.tex.needsUpdate = true;
  };
  Label.prototype.set = function (text) { if (text !== this.text) { this.text = text; this.redraw(); } };

  // ---------- assi: linea, tacche tonde con numeri piccoli, nome ----------
  const axes = AXN.map((name, k) => {
    const group = new THREE.Group(); stage.add(group);
    const seg = SegMesh(64, mat("ink", { transparent: true, opacity: 0.6 }), group);
    const nameL = new Label("", 2.6, { size: 44, cw: 256 }, group); nameL.sprite.position.set(-R - 2.1, 0, 0);
    const tl = Array.from({ length: 16 }, () => { const l = new Label("", 1.0, { size: 40, role: "muted" }, group); l.sprite.visible = false; return l; });
    return { name, group, seg, nameL, tl };
  });
  const ys = () => (S.hOn ? [S.d12, 0, -S.d23] : [S.d12 / 2, -S.d12 / 2]);
  const tickText = (v, step) => fmtNum(v, step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))));
  function buildAxis(k) {
    const a = axes[k], w = S.view[a.name], tk = Dyna.ticks(w); let n = 0;
    setSeg(a.seg, n++, V3(-R - 0.5, 0, 0), V3(R + 0.5, 0, 0), 0.03);
    tk.values.slice(0, a.tl.length).forEach((v, i) => {
      const X = Dyna.valToX(v, w);
      setSeg(a.seg, n++, V3(X, -0.16, 0), V3(X, 0.16, 0), 0.02);
      const l = a.tl[i]; l.sprite.visible = true; l.sprite.position.set(X, -0.62, 0); l.set(tickText(v, tk.step));
    });
    for (let i = tk.values.length; i < a.tl.length; i++) a.tl[i].sprite.visible = false;
    endSegs(a.seg, n);
  }
  function layout() {
    const Y = ys();
    axes.forEach((a, k) => { a.group.visible = k < Y.length; if (k < Y.length) a.group.position.y = Y[k]; });
    axes[0].nameL.set("IN"); axes[1].nameL.set(S.hOn ? "OUT · IN" : "OUT"); axes[2].nameL.set("OUT");
    baseBox.position.set(-R + 0.5, Math.min(...Y) - 2.0, 0);
  }

  // ---------- frecce: un segmento con la punta ----------
  const UP = new THREE.Vector3(0, 1, 0), coneGeo = new THREE.ConeBufferGeometry(1, 1, 12);
  function Arrow(role, r, opacity) {
    this.r = r; this.mat = mat(role, opacity < 1 ? { transparent: true, opacity } : {});
    this.group = new THREE.Group(); stage.add(this.group);
    this.body = SegMesh(1, this.mat, this.group); this.cone = new THREE.Mesh(coneGeo, this.mat); this.group.add(this.cone);
  }
  Arrow.prototype.set = function (a, b) {
    const d = b.clone().sub(a), L = d.length();
    if (L < 1e-3) { this.group.visible = false; return; }
    this.group.visible = true; d.normalize();
    const hl = this.r * 8, hr = this.r * 3.2, h = Math.min(hl, L * 0.7), k = h / hl, e = b.clone().addScaledVector(d, -h);
    this.cone.scale.set(hr * k, h, hr * k); this.cone.position.copy(e).addScaledVector(d, h / 2); this.cone.quaternion.setFromUnitVectors(UP, d);
    if (e.distanceTo(a) > 1e-4) { setSeg(this.body, 0, a, e, this.r); endSegs(this.body, 1); } else endSegs(this.body, 0);
  };
  Arrow.prototype.hide = function () { this.group.visible = false; };

  // ---------- oggetti per funzione (f e g): maniglia d'ingresso, punti, frecce, etichette, campioni, tracce ----------
  const ballGeo = new THREE.SphereBufferGeometry(1, 20, 14);
  const K = {};
  for (const k of KEYS) {
    const o = K[k] = {};
    o.handle = new THREE.Group(); o.handleMat = mat(k);
    o.handle.add(new THREE.Mesh(ballGeo, o.handleMat));
    const ol = new THREE.Mesh(ballGeo, mat("ink", { side: THREE.BackSide })); ol.scale.setScalar(1.16); o.handle.add(ol);
    o.handle.scale.setScalar(0.3); stage.add(o.handle);
    const dot = (role, r) => { const m = new THREE.Mesh(ballGeo, mat(role)); m.scale.setScalar(r); stage.add(m); return m; };
    o.out = dot(k, 0.15); o.hout = dot("h", 0.15);
    o.a12 = new Arrow(k, 0.04, 1); o.a23 = new Arrow("h", 0.04, 1); o.a13 = new Arrow(k, 0.025, 0.85);
    o.lx = new Label("", 2.6, { size: 40, cw: 384, role: k }); o.ly = new Label("", 2.6, { size: 40, cw: 384, role: k }); o.lh = new Label("", 3.0, { size: 40, cw: 384, role: "h" });
    o.sSeg = SegMesh(340, mat(k, { transparent: true, opacity: 0.4 })); o.sSegH = SegMesh(170, mat("h", { transparent: true, opacity: 0.4 }));
    o.sDot = DotMesh(520, mat(k, { transparent: true, opacity: 0.55 })); o.sDotH = DotMesh(170, mat("h", { transparent: true, opacity: 0.55 }));
    o.tSeg = []; o.tSegH = [];
    for (let b = 0; b < NB; b++) {
      const op = 0.1 + 0.17 * b;
      o.tSeg.push(SegMesh(240, mat(k, { transparent: true, opacity: op }))); o.tSegH.push(SegMesh(130, mat("h", { transparent: true, opacity: op })));
    }
  }
  const ptIn = (k, x) => V3(Dyna.edgeX(x, S.view.in), ys()[0], k === "f" ? 0.06 : 0);
  const ptOut = (k, y) => V3(Dyna.edgeX(y, S.view.out), ys()[1], k === "f" ? 0.06 : 0);
  const ptComp = (k, v) => V3(Dyna.edgeX(v, S.view.comp), ys()[2], k === "f" ? 0.06 : 0);

  // base: cubo per spostare la scena
  const baseBox = new THREE.Group();
  baseBox.add(new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("base")));
  const bOut = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), mat("ink", { side: THREE.BackSide })); bOut.scale.setScalar(1.14); baseBox.add(bOut);
  baseBox.scale.setScalar(0.9); stage.add(baseBox);

  // ---------- piano cartesiano: y = f(x) e y = g(x) nel riquadro tra IN e OUT, h(y) in quello tra OUT e COMP ----------
  const cart = { group: new THREE.Group(), cx: 0, boxes: [] };
  stage.add(cart.group);
  cart.frame = SegMesh(64, mat("ink", { transparent: true, opacity: 0.6 }), cart.group);
  cart.zero = SegMesh(8, mat("muted", { transparent: true, opacity: 0.5 }), cart.group);
  cart.curve = { f: SegMesh(260, mat("f"), cart.group), g: SegMesh(260, mat("g"), cart.group), h: SegMesh(520, mat("h"), cart.group) };
  cart.dots = { f: DotMesh(1, mat("f")), g: DotMesh(1, mat("g")), hf: DotMesh(1, mat("f")), hg: DotMesh(1, mat("g")) };
  Object.values(cart.dots).forEach((m) => { stage.remove(m); cart.group.add(m); });
  function cartBoxes() {
    const Y = ys(), h1 = S.d12 * 0.45, h2 = S.d23 * 0.45, cx = R + 2.4 + Math.max(h1, S.hOn ? h2 : 0);
    const out = [{ cx, cy: (Y[0] + Y[1]) / 2, h: h1, xw: S.view.in, yw: S.view.out }];
    if (S.hOn) out.push({ cx, cy: (Y[1] + Y[2]) / 2, h: h2, xw: S.view.out, yw: S.view.comp });
    return out;
  }
  const boxPt = (b, u, v, z) => V3(b.cx + clamp(u, -1, 1) * b.h, b.cy + clamp(v, -1, 1) * b.h, z || 0);
  function buildCart() {
    cart.group.visible = S.cart;
    if (!S.cart) return;
    const bx = cartBoxes(); cart.boxes = bx; cart.cx = bx[0].cx;
    let nf = 0, nz = 0;
    bx.forEach((b) => {
      const c = [boxPt(b, -1, -1), boxPt(b, 1, -1), boxPt(b, 1, 1), boxPt(b, -1, 1)];
      for (let i = 0; i < 4; i++) setSeg(cart.frame, nf++, c[i], c[(i + 1) % 4], 0.03);
      const u0 = -b.xw.c / b.xw.hr, v0 = -b.yw.c / b.yw.hr;
      if (Math.abs(u0) <= 1) setSeg(cart.zero, nz++, boxPt(b, u0, -1), boxPt(b, u0, 1), 0.018);
      if (Math.abs(v0) <= 1) setSeg(cart.zero, nz++, boxPt(b, -1, v0), boxPt(b, 1, v0), 0.018);
    });
    endSegs(cart.frame, nf); endSegs(cart.zero, nz);
    const plot = (mesh, f, b, show) => {
      let n = 0;
      if (show) for (const sg of Dyna.curve(f, b.xw, b.yw, 200)) for (let i = 0; i < sg.length - 1; i++) setSeg(mesh, n++, boxPt(b, sg[i][0], sg[i][1]), boxPt(b, sg[i + 1][0], sg[i + 1][1]), 0.035);
      endSegs(mesh, n);
    };
    plot(cart.curve.f, fn.f, bx[0], S.vis.f); plot(cart.curve.g, fn.g, bx[0], S.vis.g);
    // h(y) nel secondo riquadro; con due funzioni visibili la curva è una sola
    plot(cart.curve.h, fn.h, bx[1] || bx[0], S.hOn && !!bx[1]);
  }
  function updateCartDots(c) {
    for (const m of Object.values(cart.dots)) m.count = 0;
    if (!S.cart) return;
    const [b0, b1] = cart.boxes;
    for (const k of KEYS) {
      if (!S.vis[k]) continue;
      const cc = c[k], u = (cc.x - b0.xw.c) / b0.xw.hr, v = (cc.y - b0.yw.c) / b0.yw.hr;
      if (Number.isFinite(v) && Math.abs(u) <= 1 && Math.abs(v) <= 1) putDot(cart.dots[k], boxPt(b0, u, v, 0.1), 0.17);
      if (b1 && Number.isFinite(cc.hv)) {
        const u2 = (cc.y - b1.xw.c) / b1.xw.hr, v2 = (cc.hv - b1.yw.c) / b1.yw.hr;
        if (Math.abs(u2) <= 1 && Math.abs(v2) <= 1) putDot(cart.dots["h" + k], boxPt(b1, u2, v2, 0.1), 0.17);
      }
    }
    Object.values(cart.dots).forEach(endDots);
  }

  // ---------- disegno dinamico: linee principali, campioni, tracce, etichette ----------
  let dirty = true, curvesDirty = true;
  const n2 = (v) => fmtNum(v, 2);
  function lineSet(o, x, k, segK, segH, dotK, dotH, ni, nh, nd, ndh, lnn, dotR) {
    const y = fn[k](x), hv = S.hOn && Number.isFinite(y) ? fn.h(y) : NaN, a = ptIn(k, x), b = ptOut(k, y), c = ptComp(k, hv);
    if (dotK) { putDot(dotK, a, dotR); if (Number.isFinite(y)) putDot(dotK, b, dotR); }
    if (Number.isFinite(y) && lnn.l12) setSeg(segK, segK.userData.n++, a, b, 0.018);
    if (Number.isFinite(hv)) {
      if (lnn.l23) { setSeg(segH, segH.userData.n++, b, c, 0.018); if (dotH) putDot(dotH, c, dotR); }
      if (lnn.l13) { setSeg(segK, segK.userData.n++, a, c, 0.014); if (dotH && !lnn.l23) putDot(dotH, c, dotR); }
    }
  }
  const resetSeg = (m) => { m.userData.n = 0; };
  function draw() {
    dirty = false;
    const ln = Dyna.lines(S.conn, S.hOn), c = {};
    for (const k of KEYS) {
      const o = K[k], on = S.vis[k], cc = c[k] = Dyna.chain(fn, k, S.x[k], S.hOn);
      for (const m of [o.handle, o.out, o.hout, o.lx.sprite, o.ly.sprite, o.lh.sprite]) m.visible = on;
      if (!on) { o.a12.hide(); o.a23.hide(); o.a13.hide(); for (const m of [o.sSeg, o.sSegH, o.sDot, o.sDotH, ...o.tSeg, ...o.tSegH]) m.count = 0; continue; }
      const dy = k === "f" ? 0.9 : -1.4, a = ptIn(k, cc.x), b = ptOut(k, cc.y), p = ptComp(k, cc.hv), okY = Number.isFinite(cc.y), okH = Number.isFinite(cc.hv);
      o.handle.position.copy(a);
      o.out.visible = okY; o.out.position.copy(b);
      o.hout.visible = okH && (ln.l23 || ln.l13); o.hout.position.copy(p);
      if (okY && ln.l12) o.a12.set(a, b); else o.a12.hide();
      if (okH && ln.l23) o.a23.set(b, p); else o.a23.hide();
      if (okH && ln.l13) o.a13.set(a, p); else o.a13.hide();
      const full = S.full;
      o.lx.sprite.position.set(a.x, a.y + dy, 0.1); o.lx.set((full ? "x = " : "") + n2(cc.x));
      o.ly.sprite.visible = okY; o.ly.sprite.position.set(b.x, b.y + dy, 0.1); o.ly.set((full ? k + "(x) = " : "") + n2(cc.y));
      o.lh.sprite.visible = okH && S.hOn; o.lh.sprite.position.set(p.x, p.y + dy, 0.1); o.lh.set((full ? "h(" + k + "(x)) = " : "") + n2(cc.hv));
      // campioni: tante linee leggere a distanza regolare
      [o.sSeg, o.sSegH].forEach(resetSeg); o.sDot.count = 0; o.sDotH.count = 0;
      if (S.samp[k]) {
        for (const xs of Dyna.sampleXs(S.view.in, { density: S.density, interval: S.sInt, start: S.sStart, end: S.sEnd }, S.x[k])) lineSet(o, xs, k, o.sSeg, o.sSegH, o.sDot, o.sDotH, 0, 0, 0, 0, ln, 0.06);
      }
      endSegs(o.sSeg, o.sSeg.userData.n || 0); endSegs(o.sSegH, o.sSegH.userData.n || 0); endDots(o.sDot); endDots(o.sDotH);
      // traccia: le ultime posizioni, più chiare quando sono più vecchie
      for (let bk = 0; bk < NB; bk++) { resetSeg(o.tSeg[bk]); resetSeg(o.tSegH[bk]); }
      if (S.trace[k]) tr[k].pts.forEach((xt, i, arr) => { const bk = Dyna.bucket(i, arr.length, NB); lineSet(o, xt, k, o.tSeg[bk], o.tSegH[bk], null, null, 0, 0, 0, 0, ln, 0); });
      for (let bk = 0; bk < NB; bk++) { endSegs(o.tSeg[bk], o.tSeg[bk].userData.n || 0); endSegs(o.tSegH[bk], o.tSegH[bk].userData.n || 0); }
    }
    updateCartDots(c);
    return c;
  }
  function update() { dirty = true; }
  function flush() { if (curvesDirty) { curvesDirty = false; buildCart(); } if (dirty) { const c = draw(); syncReadout(c); } }

  // ---------- impulso che viaggia: un numero corre lungo le linee, dall'ingresso all'uscita (facoltativo) ----------
  const beads = {};
  for (const k of KEYS) { const m = new THREE.Mesh(ballGeo, mat(k)); m.scale.setScalar(0.22); m.visible = false; m.renderOrder = 5; stage.add(m); const o = new THREE.Mesh(ballGeo, mat("ink", { side: THREE.BackSide })); o.scale.setScalar(1.16); m.add(o); beads[k] = m; }
  const SPEED = 5, PAUSE = 0.7;
  function animateBeads(now) {
    const ln = Dyna.lines(S.conn, S.hOn);
    for (const k of KEYS) {
      const b = beads[k]; b.visible = false;
      if (!S.pulse || !S.vis[k]) continue;
      const cc = Dyna.chain(fn, k, S.x[k], S.hOn);
      if (!Number.isFinite(cc.y)) continue;
      const P = [ptIn(k, cc.x)];
      if (ln.l12) P.push(ptOut(k, cc.y));
      if (Number.isFinite(cc.hv)) { if (ln.l23) P.push(ptComp(k, cc.hv)); else if (ln.l13) P.push(ptComp(k, cc.hv)); }
      if (P.length < 2) continue;
      const len = [0]; for (let i = 1; i < P.length; i++) len.push(len[i - 1] + P[i].distanceTo(P[i - 1]));
      const L = len[len.length - 1], travel = L / SPEED, u = reduceMotion ? travel : (now / 1000) % (travel + PAUSE), d = Math.min(L, u * SPEED);
      let i = 1; while (i < P.length - 1 && len[i] < d) i++;
      const seg = len[i] - len[i - 1];
      b.position.lerpVectors(P[i - 1], P[i], seg > 1e-9 ? clamp((d - len[i - 1]) / seg, 0, 1) : 1);
      b.position.z += 0.15; b.visible = true;
    }
  }

  // ---------- azioni (le stesse da schermo, dal pannello e da tastiera) ----------
  const snapStep = () => S.view.in.hr / 100;
  const snap = (x) => { const s = snapStep(); return Math.round(x / s) * s; };
  function markTraces() { for (const k of KEYS) tr[k].push(S.x[k], S.view.in.hr * 0.01); }
  function setX(key, x, src) {
    const [lo, hi] = Dyna.range(S.view.in); x = snap(clamp(x, lo, hi));
    const other = key === "f" ? "g" : "f";
    if (S.x[key] === x && (!S.link || S.x[other] === x)) return;
    const prev = S.x[key]; S.x[key] = x; if (S.link) S.x[other] = x;
    if (src) { const st = Dyna.niceStep(S.view.in.hr); if (Math.floor(prev / st + 1e-9) !== Math.floor(x / st + 1e-9)) buzz(src, 0.2, 12); } // un colpetto a ogni tacca
    markTraces(); update(); saveSoon();
  }
  function viewChanged() { AXN.forEach((_, k) => buildAxis(k)); curvesDirty = true; update(); syncAxisFields(); saveSoon(); }
  function layoutChanged() { layout(); viewChanged(); camPlace(); }
  function setView(name, w) { S.view[name] = w; viewChanged(); }
  const AXI = { in: 0, out: 1, comp: 2 };
  function zoomAxis(k, f) { setView(AXN[k], Dyna.zoom(S.view[AXN[k]], f)); }
  function panAxis(k, dX) { setView(AXN[k], Dyna.pan(S.view[AXN[k]], dX)); }
  function clearTraces() { tr.f.clear(); tr.g.clear(); markTraces(); update(); }
  function setPlaying(p) { S.playing = p; sync(); pSig = ""; }
  const gap = (key, d) => { S[key] = clamp(S[key] + d, 1.5, 6.5); layoutChanged(); };
  const cycleCol = (key) => { S.col[key] = (S.col[key] + 1) % Dyna.COLORS.length; recolor(); };
  const toggle = (key, sub) => { if (sub) S[key][sub] = !S[key][sub]; else S[key] = !S[key]; if (key === "vis") curvesDirty = true; sync(); pSig = ""; update(); saveSoon(); };
  const ACT = {
    sweep: () => setPlaying(!S.playing),
    visF: () => toggle("vis", "f"), visG: () => { toggle("vis", "g"); curvesDirty = true; }, hOn: () => { S.hOn = !S.hOn; layoutChanged(); sync(); pSig = ""; },
    link: () => { S.link = !S.link; if (S.link) { S.x.g = S.x.f; markTraces(); } sync(); pSig = ""; update(); saveSoon(); },
    cart: () => { S.cart = !S.cart; curvesDirty = true; update(); resize(); camPlace(); sync(); pSig = ""; saveSoon(); },
    conn: () => { S.conn = Dyna.nextConn(S.conn); sync(); pSig = ""; update(); saveSoon(); },
    traceF: () => toggle("trace", "f"), traceG: () => toggle("trace", "g"), sampF: () => toggle("samp", "f"), sampG: () => toggle("samp", "g"),
    clear: clearTraces, clearAll: clearTraces,
    full: () => toggle("full"), pulse: () => toggle("pulse"),
    densM: () => { S.density = clamp(+(S.density / 1.5).toFixed(2), 0.1, 30); S.sInt = null; sync(); pSig = ""; update(); }, densP: () => { S.density = clamp(+(S.density * 1.5).toFixed(2), 0.1, 30); S.sInt = null; sync(); pSig = ""; update(); },
    colF: () => cycleCol("f"), colG: () => cycleCol("g"), colH: () => cycleCol("h"),
    gap12m: () => gap("d12", -0.5), gap12p: () => gap("d12", 0.5), gap23m: () => gap("d23", -0.5), gap23p: () => gap("d23", 0.5),
    axReset: () => { for (const n of AXN) S.view[n] = Dyna.newView(); S.d12 = 4; S.d23 = 4; layoutChanged(); },
    axes: () => { S.page = 1; pSig = ""; }, more: () => { S.page = 2; pSig = ""; }, back: () => { S.page = 0; pSig = ""; },
    recenter: () => placeFromHead(), reset: () => { S.playing = false; applyState(Object.assign({}, Dyna.DEFAULTS, { col: Dyna.DEFAULT_COLORS, view: { in: Dyna.newView(), out: Dyna.newView(), comp: Dyna.newView() } })); },
  };
  for (const k of [0, 1, 2]) { ACT["zi" + k] = () => zoomAxis(k, 1.5); ACT["zo" + k] = () => zoomAxis(k, 1 / 1.5); ACT["pl" + k] = () => panAxis(k, R / 3); ACT["pr" + k] = () => panAxis(k, -R / 3); }
  function recolor() { paintColors(); applyPalette(palName); syncSwatches(); saveSoon(); }

  // ---------- funzioni, stato, link ----------
  const ERR = { f: "errF", g: "errG", h: "errH" }, FLD = { f: "fx", g: "gx", h: "hx" };
  function showErr(k, e) { $(ERR[k]).textContent = e ? t(e.code, e.params) : ""; $(FLD[k]).setAttribute("aria-invalid", e ? "true" : "false"); }
  function applyState(st) {
    for (const k of Dyna.KEYS) { const r = Expr.tryFn(st[k], "x"); if (r.ok) { fn[k] = r.fn; S.src[k] = st[k]; showErr(k, null); } else showErr(k, r.error); $(FLD[k]).value = S.src[k]; }
    S.x.f = Number.isFinite(st.xf) ? st.xf : 1; S.x.g = Number.isFinite(st.xg) ? st.xg : 1;
    S.link = !!st.link; S.hOn = !!st.hOn; S.cart = !!st.cart; S.full = st.full !== false; S.conn = st.conn || "2_to_3";
    if (st.col) S.col = Object.assign({}, st.col);
    if (st.view) for (const n of AXN) if (st.view[n]) S.view[n] = Object.assign({}, st.view[n]);
    if (S.link) S.x.g = S.x.f;
    S.playing = false; tr.f.clear(); tr.g.clear(); markTraces(); paintColors(); applyPalette(palName); layoutChanged(); syncSwatches(); sync();
  }
  const timers = {};
  function onFn(k) {
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => {
      const txt = $(FLD[k]).value, r = Expr.tryFn(txt, "x");
      if (!r.ok) { showErr(k, r.error); return; }
      showErr(k, null); fn[k] = r.fn; S.src[k] = txt; curvesDirty = true; update(); saveSoon();
    }, 250);
  }
  const stateObj = () => ({ f: S.src.f, g: S.src.g, h: S.src.h, xf: S.x.f, xg: S.x.g, link: S.link, hOn: S.hOn, conn: S.conn, cart: S.cart, full: S.full, col: S.col, view: S.view });
  const stateQuery = () => Dyna.toQuery(stateObj());
  const shareUrl = () => location.origin + location.pathname + "#" + stateQuery();
  let saveT = 0;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { const s = stateQuery(); store.set("state", s); try { history.replaceState(null, "", "#" + s); } catch (e) { /* ignore */ } }, 400); }
  function share() { try { navigator.clipboard.writeText(shareUrl()).then(() => toast(t("copied")), () => toast(t("copied"))); } catch (e) { toast(shareUrl()); } }

  // ---------- pannello flottante (canvas → texture): pagine con pochi pulsanti grandi ----------
  const PW = 640, PH = 512, PM = 0.42, PMH = (PM * PH) / PW;
  const pcv = document.createElement("canvas"); pcv.width = PW; pcv.height = PH;
  const ptex = new THREE.CanvasTexture(pcv); ptex.anisotropy = 4;
  const panel = new THREE.Group(); panel.rotation.order = "YXZ"; panel.visible = false; scene.add(panel);
  const pmesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ map: ptex, transparent: true }));
  const pshadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
  pshadow.position.set(0.006, -0.006, -0.004);
  panel.add(pshadow, pmesh);
  const X0 = 24, GAP = 8;
  function rowItems(y, h, defs) { let x = X0; return defs.map(([id, w]) => { const it = { id, x, y, w, h }; x += w + GAP; return it; }); }
  function pageItems() {
    if (S.page === 1) {
      const out = [], bh = 60, ax = [108, 176, 244].slice(0, S.hOn ? 3 : 2);
      ax.forEach((y, k) => out.push(...[["zo" + k, 104], ["zi" + k, 104], ["pl" + k, 104], ["pr" + k, 104]].map(([id, w], i) => ({ id, x: 184 + i * 112, y, w, h: bh }))));
      const gy = 108 + 68 * ax.length;
      out.push(...[["gap12m", 104], ["gap12p", 104]].map(([id, w], i) => ({ id, x: 184 + i * 112, y: gy, w, h: bh })));
      if (S.hOn) out.push(...[["gap23m", 104], ["gap23p", 104]].map(([id, w], i) => ({ id, x: 184 + i * 112, y: gy + 68, w, h: bh })));
      out.push(...rowItems(448, 60, [["back", 204], ["axReset", 380]]));
      return out;
    }
    if (S.page === 2) return [...rowItems(108, 60, [["densM", 120]]), { id: "densP", x: PW - 24 - 120, y: 108, w: 120, h: 60 }, ...rowItems(176, 60, [["full", 292], ["pulse", 292]]),
      ...rowItems(264, 60, [["colF", 192], ["colG", 192], ["colH", 192]]), ...rowItems(332, 60, [["clearAll", 592]]), ...rowItems(448, 60, [["back", 592]])];
    return [...rowItems(150, 64, [["visF", 192], ["visG", 192], ["hOn", 192]]), ...rowItems(222, 64, [["link", 192], ["cart", 192], ["conn", 192]]),
      ...rowItems(294, 64, [["traceF", 140], ["traceG", 140], ["sampF", 140], ["sampG", 140]]), ...rowItems(366, 64, [["sweep", 192], ["clear", 192], ["recenter", 192]]),
      ...rowItems(438, 64, [["axes", 292], ["more", 292]])];
  }
  let items = pageItems();
  let pSig = "", pHover = null;
  const pfont = (n) => FONT.replace("{n}", n);
  function drawPanel() {
    items = pageItems();
    const c = pcv.getContext("2d");
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = C.card; c.fillRect(0, 0, PW, PH);
    c.strokeStyle = C.ink; c.lineWidth = 8; c.strokeRect(4, 4, PW - 8, PH - 8);
    c.textBaseline = "alphabetic"; c.textAlign = "left";
    const ln = (txt, role, y) => { c.fillStyle = C[role]; c.font = pfont(26); c.fillText(txt, 28, y, PW - 56); };
    if (S.page === 0) { ln("f(x) = " + S.src.f, "f", 46); ln("g(x) = " + S.src.g, "g", 92); c.globalAlpha = S.hOn ? 1 : 0.4; ln("h(x) = " + S.src.h, "h", 138); c.globalAlpha = 1; }
    else {
      c.fillStyle = C.ink; c.fillRect(0, 0, PW, 80); c.fillStyle = C.card; c.font = pfont(30); c.fillText(t(S.page === 1 ? "x.axesTitle" : "x.moreTitle"), 28, 52);
      c.fillStyle = C.ink; c.font = pfont(22);
      if (S.page === 1) {
        ["x.in", "x.out", "x.comp"].slice(0, S.hOn ? 3 : 2).forEach((key, k) => c.fillText(t(key), 28, 108 + 68 * k + 38, 150));
        const gy = 108 + 68 * (S.hOn ? 3 : 2); c.fillText(t("x.gap12"), 28, gy + 38, 150); if (S.hOn) c.fillText(t("x.gap23"), 28, gy + 68 + 38, 150);
      } else { c.fillStyle = C.muted; c.textAlign = "left"; c.fillText(t("x.colors"), 28, 258, 300); }
    }
    for (const it of items) {
      const on = isOn(it.id), hov = pHover === it.id, colRole = { colF: "f", colG: "g", colH: "h" }[it.id], hot = on || it.id === "sweep";
      c.fillStyle = colRole ? C[colRole] : hot ? C.accent : C.card; c.fillRect(it.x, it.y, it.w, it.h);
      if (hov) { c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(it.x, it.y, it.w, it.h); }
      c.strokeStyle = C.ink; c.lineWidth = hov ? 7 : 4; c.strokeRect(it.x, it.y, it.w, it.h);
      c.fillStyle = colRole ? C.card === "#FFFFFF" ? "#15161A" : "#13151A" : hot ? C.onaccent : C.ink; c.textAlign = "center";
      const lab = itemLabel(it.id);
      c.font = pfont(lab.length > 11 ? 18 : lab.length > 8 ? 22 : 26);
      c.fillText(lab, it.x + it.w / 2, it.y + it.h / 2 + 8, it.w - 10);
    }
    if (S.page === 2) { c.fillStyle = C.ink; c.font = pfont(22); c.textAlign = "center"; /* etichetta della densità tra i due pulsanti */ c.fillText(t("x.dens", { v: fmtNum(S.density, S.density < 1 ? 1 : 0) }), PW / 2, 108 + 38, 300); }
    if (MONITOR) { c.font = pfont(14); c.fillStyle = C.muted; c.textAlign = "left"; monLines().forEach((l, i) => c.fillText(l, 24 + i * 300, 16)); }
    ptex.needsUpdate = true;
  }
  function isOn(id) {
    return { visF: S.vis.f, visG: S.vis.g, hOn: S.hOn, link: S.link, cart: S.cart, traceF: S.trace.f, traceG: S.trace.g, sampF: S.samp.f, sampG: S.samp.g, sweep: S.playing, full: S.full, pulse: S.pulse, conn: S.hOn && S.conn !== "2_to_3" }[id] || false;
  }
  function itemLabel(id) {
    const fixed = { visF: "f", visG: "g", hOn: "h", conn: t("x.conn", { c: t("conn." + ({ "2_to_3": "23", "1_to_3": "13", both: "both" })[S.conn]) }), sweep: t(S.playing ? "pause" : "sweep"), densM: "−", densP: "+", back: t("x.back"), axes: t("x.axes"), more: t("x.more"),
      colF: "f", colG: "g", colH: "h", gap12m: "−", gap12p: "+", gap23m: "−", gap23p: "+", axReset: t("x.axReset") };
    if (fixed[id]) return fixed[id];
    const m = /^(zi|zo|pl|pr)\d$/.exec(id); if (m) return { zi: "+", zo: "−", pl: "◀", pr: "▶" }[m[1]];
    return t("x." + id);
  }
  const panelSig = () => [JSON.stringify([S.src, S.vis, S.hOn, S.link, S.cart, S.conn, S.trace, S.samp, S.col, S.page, S.playing, S.full, S.pulse, S.density]), palName, pHover, t("sweep"), MONITOR ? Math.floor(performance.now() / 300) : 0].join("|");
  function itemAt(u, v) { const px = u * PW, py = (1 - v) * PH; return items.find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) || null; }
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

  // bersagli afferrabili, in coordinate del palco → mondo: le maniglie d'ingresso (una sola se gli ingressi sono collegati) e la base
  const _l = new THREE.Vector3();
  const reach = () => 0.06 + 0.4 * stage.scale.x;
  const inputKeys = () => { const v = KEYS.filter((k) => S.vis[k]); return S.link ? v.slice(0, 1) : v; };
  function targets() {
    const out = inputKeys().map((k) => [k, stage.localToWorld(ptIn(k, S.x[k]))]);
    out.push(["base", stage.localToWorld(baseBox.position.clone())]);
    return out;
  }
  function nearest(p) {
    let best = null, bd = reach();
    for (const [id, w] of targets()) { const d = w.distanceTo(p); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  const localOf = (w) => stage.worldToLocal(_l.copy(w));
  const valAtX = (X) => Dyna.xToVal(clamp(X, -R, R), S.view.in);
  const grab = new Grab.GrabController(THREE, {});
  let near = {};
  function xrInput(now, dt) {
    if (!ui.placed) placeFromHead();
    SRC.forEach(readSource);
    near = {}; pHover = null;
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
      // afferrare una maniglia d'ingresso o la base; la seconda mano sulla base scala la scena
      if (rising && !s.eng) {
        const id = nearest(s.pos);
        if (id === "f" || id === "g") { s.eng = id; s.off = localOf(s.pos).x - ptIn(id, S.x[id]).x; S.playing = false; buzz(s, 0.5, 40); }
        else if (id === "base") { s.eng = "base"; buzz(s, 0.5, 40); }
        else if (SRC.some((o) => o !== s && o.eng === "base")) s.eng = "base";
      }
      if (!s.down) s.eng = null;
      if (s.eng === "f" || s.eng === "g") setX(s.eng, valAtX(localOf(s.pos).x - s.off), s);
      if (s.stick && !s.eng) { S.playing = false; for (const k of inputKeys()) setX(k, S.x[k] + s.stick * S.view.in.hr * 0.6 * dt); }
      if (!s.eng && !s.down) { const id = nearest(s.pos); if (id) near[id] = true; }
      if (s.eng) near[s.eng] = true;
    }
    grab.update(SRC.map((s) => ({ id: "s" + s.i, active: s.active, pinching: s.eng === "base", pos: s.pos.clone(), quat: s.quat.clone() })), dt, () => stage);
    for (const k of KEYS) K[k].handle.scale.setScalar(near[k] ? 0.4 : 0.3);
    baseBox.scale.setScalar(near.base ? 1.15 : 0.9);
  }

  // ---------- posizionamento davanti a chi guarda: gli assi alla portata del braccio, pannello a sinistra ----------
  function placeFromHead() {
    const xc = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    const hp = new THREE.Vector3(), hq = new THREE.Quaternion();
    xc.getWorldPosition(hp); xc.getWorldQuaternion(hq);
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(hq); d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    d.normalize();
    const th = Math.atan2(-d.x, -d.z), hy = Math.max(1.0, hp.y), left = new THREE.Vector3(d.z, 0, -d.x); // sinistra di chi guarda
    stage.rotation.set(0, th, 0); stage.scale.setScalar(S0);
    stage.position.copy(hp).addScaledVector(d, 0.6); stage.position.y = hy - 0.15;
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
        xrSession = null; ui.xr = null; SRC.forEach((s) => (s.eng = null)); panel.visible = false; rays.forEach((r) => (r.visible = false)); S.page = 0;
        document.body.classList.remove("inxr"); applyPalette(isDark() ? "dark" : "light"); syncXrButtons();
        stage.rotation.set(0, 0, 0); stage.scale.setScalar(S0); stage.position.set(0, 1.2, -0.6); camPlace(); resize();
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
    floorGrid.material.color.set(C.grid);
    const vr = ui.xr === "immersive-vr", ar = ui.xr === "immersive-ar";
    scene.background = ar ? null : new THREE.Color(C.scene);
    floorGrid.visible = vr;
    labels.forEach((l) => l.redraw()); pSig = ""; update();
  }

  // ---------- schermo: camera orbitale, trascinamento delle maniglie e degli assi, tastiera ----------
  const cam = { yaw: 0.25, pitch: 0.12, dist: 1.5, user: false }; // user: chi ha usato rotella o pizzico tiene la sua distanza
  const target = new THREE.Vector3();
  function camPlace() {
    stage.updateMatrixWorld(true);
    stage.localToWorld(target.set(S.cart ? (cart.cx || R + 5) * 0.25 : 0, S.hOn ? (S.d12 - S.d23) / 2 : 0, 0));
    camera.position.set(target.x + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch), target.y + cam.dist * Math.sin(cam.pitch), target.z + cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(target);
  }
  function resize() {
    if (renderer.xr.isPresenting) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!cam.user) { cam.dist = clamp(S0 * Math.max((S.cart ? 17 : 13) / (w / h), 15) / 1.04, 0.6, 6); camPlace(); }
  }
  new ResizeObserver(() => resize()).observe(view);
  const cv = $("cv");
  const drag = { mode: null, id: null, x: 0, y: 0, off: 0, axis: -1, lastX: 0 };
  const pts2 = new Map(); let pinch0 = 0;
  const _ndc = new THREE.Vector2(), _rr = new THREE.Raycaster(), _pln = new THREE.Plane(), _hit = new THREE.Vector3(), _n = new THREE.Vector3();
  function screenRay(e) {
    const r = cv.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _rr.setFromCamera(_ndc, camera); return _rr.ray;
  }
  function planeHit(ray) { // punto del piano del palco (z = 0) colpito dal raggio, in coordinate del palco
    stage.updateMatrixWorld(true);
    _n.set(0, 0, 1).transformDirection(stage.matrixWorld);
    _pln.setFromNormalAndCoplanarPoint(_n, stage.localToWorld(V3(0, 0, 0)));
    return ray.intersectPlane(_pln, _hit) ? stage.worldToLocal(_hit.clone()) : null;
  }
  function nearestAxis(y) { const Y = ys(); let best = -1, bd = 1.4; Y.forEach((yy, k) => { const d = Math.abs(yy - y); if (d < bd) { bd = d; best = k; } }); return best; }
  function screenOf(key, e) {
    const h = stage.localToWorld(ptIn(key, S.x[key])).project(camera), r = cv.getBoundingClientRect();
    return Math.hypot(e.clientX - (((h.x + 1) / 2) * r.width + r.left), e.clientY - (((1 - h.y) / 2) * r.height + r.top));
  }
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts2.size === 2) { const [a, b] = [...pts2.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); drag.mode = "zoom"; return; }
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    const hp = planeHit(screenRay(e));
    if (e.shiftKey && hp && nearestAxis(hp.y) >= 0) { drag.mode = "pan"; drag.axis = nearestAxis(hp.y); drag.lastX = hp.x; }
    else {
      let best = null, bd = 40;
      for (const k of inputKeys()) { const d = screenOf(k, e); if (d < bd) { bd = d; best = k; } }
      if (best) { drag.mode = best; S.playing = false; sync(); drag.off = hp ? hp.x - ptIn(best, S.x[best]).x : 0; }
      else drag.mode = "orbit";
    }
    cv.classList.add("held");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts2.has(e.pointerId)) return;
    pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.mode === "zoom" && pts2.size === 2) { const [a, b] = [...pts2.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.dist = clamp(cam.dist * (pinch0 / d), 0.5, 6); cam.user = true; pinch0 = d; camPlace(); return; }
    if (e.pointerId !== drag.id || !drag.mode) return;
    if (drag.mode === "f" || drag.mode === "g") { const hp = planeHit(screenRay(e)); if (hp) setX(drag.mode, valAtX(hp.x - drag.off)); }
    else if (drag.mode === "pan") { const hp = planeHit(screenRay(e)); if (hp) { panAxis(drag.axis, hp.x - drag.lastX); drag.lastX = hp.x; } }
    else { cam.yaw -= (e.clientX - drag.x) * 0.008; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.006, -1.2, 1.5); camPlace(); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e) => { pts2.delete(e.pointerId); if (!pts2.size) { drag.mode = null; drag.id = null; cv.classList.remove("held"); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dy = e.deltaY || e.deltaX;
    if (e.shiftKey) { const hp = planeHit(screenRay(e)), k = hp ? nearestAxis(hp.y) : -1; if (k >= 0) { zoomAxis(k, Math.exp(-dy * 0.002)); return; } }
    cam.dist = clamp(cam.dist * Math.exp(dy * 0.001), 0.5, 6); cam.user = true; camPlace();
  }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea, dialog, button")) return;
    if (e.key === " ") { e.preventDefault(); ACT.sweep(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); S.playing = false; const key = e.shiftKey && S.vis.g ? "g" : S.vis.f ? "f" : "g"; setX(key, S.x[key] + (e.key === "ArrowRight" ? 1 : -1) * S.view.in.hr * 0.02); }
    else if (e.key === "r" || e.key === "R") ACT.reset();
  });

  // ---------- DOM ----------
  const press = (id, v) => $(id).setAttribute("aria-pressed", String(!!v));
  $("playBtn").addEventListener("click", ACT.sweep); $("resetBtn").addEventListener("click", ACT.reset); $("clear").addEventListener("click", ACT.clear);
  for (const [id, a] of [["tgVisF", "visF"], ["tgVisG", "visG"], ["tgHOn", "hOn"], ["tgLink", "link"], ["tgCart", "cart"], ["tgFull", "full"], ["tgPulse", "pulse"], ["tgTraceF", "traceF"], ["tgTraceG", "traceG"], ["tgSampF", "sampF"], ["tgSampG", "sampG"],
    ["g12m", "gap12m"], ["g12p", "gap12p"], ["g23m", "gap23m"], ["g23p", "gap23p"], ["axReset", "axReset"]]) $(id).addEventListener("click", ACT[a]);
  for (const k of Dyna.KEYS) $(FLD[k]).addEventListener("input", () => onFn(k));
  $("conn").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.conn = b.dataset.c; sync(); pSig = ""; update(); saveSoon(); } });
  // campi numerici (testo, con virgola decimale): si applicano quando l'ingresso è valido
  const numField = (id, apply, allowEmpty) => $(id).addEventListener("input", () => { const s = $(id).value.trim(); if (!s) { if (allowEmpty) apply(null); return; } const v = parseNum(s); if (Number.isFinite(v)) apply(v); });
  numField("traceLen", (v) => { S.traceLen = clamp(Math.round(v), 2, 300); tr.f.setMax(S.traceLen); tr.g.setMax(S.traceLen); update(); });
  numField("density", (v) => { S.density = clamp(v, 0.1, 30); S.sInt = null; $("sInt").value = ""; update(); });
  numField("sInt", (v) => { S.sInt = v > 0 ? v : null; update(); }, true); numField("sStart", (v) => { S.sStart = v; update(); }, true); numField("sEnd", (v) => { S.sEnd = v; update(); }, true);
  for (const [n, lo, hi] of [["in", "inLo", "inHi"], ["out", "outLo", "outHi"], ["comp", "compLo", "compHi"]]) {
    const apply = () => { const a = parseNum($(lo).value), b = parseNum($(hi).value); if (Number.isFinite(a) && Number.isFinite(b) && b > a) { S.view[n] = Dyna.setRange(S.view[n], a, b); AXN.forEach((_, k) => buildAxis(k)); curvesDirty = true; update(); saveSoon(); } };
    $(lo).addEventListener("input", apply); $(hi).addEventListener("input", apply);
  }
  function syncAxisFields() {
    for (const [n, lo, hi] of [["in", "inLo", "inHi"], ["out", "outLo", "outHi"], ["comp", "compLo", "compHi"]]) {
      const [a, b] = Dyna.range(S.view[n]);
      for (const [id, v] of [[lo, a], [hi, b]]) if (document.activeElement !== $(id)) $(id).value = fmtNum(+v.toPrecision(6), 4).replace(/([.,]\d*?)0+$/, "$1").replace(/[.,]$/, "");
    }
  }
  function syncSwatches() {
    const name = pageName();
    for (const k of Dyna.KEYS) document.documentElement.style.setProperty("--c-" + k, hexOf(k, name));
    for (const k of Dyna.KEYS) {
      const box = $("sw" + k.toUpperCase());
      box.innerHTML = Dyna.COLORS.map((c, i) => `<button type="button" style="--c:${c[name]}" data-i="${i}" aria-pressed="${S.col[k] === i}" aria-label="${t("p.color")} ${i + 1}"></button>`).join("");
    }
  }
  for (const k of Dyna.KEYS) $("sw" + k.toUpperCase()).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.col[k] = +b.dataset.i; recolor(); } });
  function syncReadout(c) {
    c = c || {}; const ro = $("readout");
    ro.innerHTML = KEYS.filter((k) => S.vis[k] && c[k]).map((k) => `<span class="c-${k}">${k}</span><b>${n2(c[k].x)} → ${n2(c[k].y)}</b>` + (S.hOn ? `<span class="c-h">h</span><b>${n2(c[k].hv)}</b>` : "")).join("");
  }
  function sync() {
    $("playLbl").textContent = t(S.playing ? "pause" : "sweep"); $("playIcon").innerHTML = kit.icon(S.playing ? "pause" : "play");
    press("tgVisF", S.vis.f); press("tgVisG", S.vis.g); press("tgHOn", S.hOn); press("tgLink", S.link); press("tgCart", S.cart); press("tgFull", S.full); press("tgPulse", S.pulse);
    press("tgTraceF", S.trace.f); press("tgTraceG", S.trace.g); press("tgSampF", S.samp.f); press("tgSampG", S.samp.g);
    $("conn").querySelectorAll("button").forEach((b) => { const on = b.dataset.c === S.conn; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    $("connBox").hidden = !S.hOn; $("compRow").hidden = !S.hOn; $("gap23").hidden = !S.hOn; $(FLD.h).closest(".fnrow").classList.toggle("off", !S.hOn);
    const act = document.activeElement;
    if (act !== $("traceLen")) $("traceLen").value = String(S.traceLen);
    if (act !== $("density")) $("density").value = fmtNum(S.density, S.density < 1 ? 1 : 0).replace(/([.,]\d*?)0+$/, "$1");
    syncAxisFields();
  }
  onLang(() => { sync(); syncSwatches(); syncXrButtons(); pSig = ""; for (const k of Dyna.KEYS) showErr(k, null); layout(); update(); });
  onTheme((dark) => { syncSwatches(); if (!ui.xr) applyPalette(dark ? "dark" : "light"); });
  if (document.fonts && document.fonts.load) document.fonts.load(pfont(30)).then(() => { labels.forEach((l) => l.redraw()); pSig = ""; }).catch(() => {});

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fnc) { try { return fnc(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error("Error in " + name + ":", err); note.textContent = "Error in " + name + ": " + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0, dir = 1;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    if (presenting) { scene.updateMatrixWorld(true); safe("input", () => xrInput(now, dt)); }
    if (S.playing) {
      const [lo, hi] = Dyna.range(S.view.in), v = (hi - lo) * 0.2 * dt * dir, k = S.vis.f ? "f" : "g";
      let x = S.x[k] + v;
      if (x >= hi) { x = hi; dir = -1; } if (x <= lo) { x = lo; dir = 1; }
      S.x.f = x; S.x.g = S.link ? x : clamp(S.x.g + v, lo, hi); markTraces(); update();
    }
    safe("draw", flush);
    if (presenting) safe("panel", () => { const sg = panelSig(); if (sg !== pSig && (frameN % 3 === 0 || pSig === "")) { pSig = sg; drawPanel(); } });
    animateBeads(now);
    renderer.render(scene, camera);
  });

  // ---------- avvio ----------
  paintColors(); applyPalette(palName);
  layout(); AXN.forEach((_, k) => buildAxis(k)); syncSwatches();
  const readQuery = (str) => Dyna.fromQuery(str, parseNum);
  const init = readQuery(location.hash) || readQuery(store.get("state") || "");
  applyState(init || Object.assign({}, Dyna.DEFAULTS, { col: Dyna.DEFAULT_COLORS, view: { in: Dyna.newView(), out: Dyna.newView(), comp: Dyna.newView() } }));
  window.addEventListener("hashchange", () => { const st = readQuery(location.hash); if (st) applyState(st); }); // un link incollato nella stessa scheda
  camPlace(); resize();
  window.__app = { THREE, scene, camera, renderer, stage, S, ui, SRC, ACT, panel, ctrls, grips, hands, xrInput, setX, placeFromHead, drawPanel, rayPanel, tipPanel, itemAt, pageItems, Dyna, tr, K, fn, flush, draw, cart, axes, applyState, stateQuery, setView, layoutChanged, zoomAxis, panAxis };
  return { reset: ACT.reset, share, url: shareUrl };
}
