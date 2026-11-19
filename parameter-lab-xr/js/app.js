// Parameter Lab XR · app.js
// Scena Three.js, ingressi WebXR (mani e controller), pannello flottante, grafico della fetta, discussione, interazione da schermo.
// La matematica è in expr.js ed engine.js (pure, testate in Node); qui c'è la presentazione.
// Riferimento: `stage` (il "palco") contiene il piano (x, y) estruso lungo k, in unità di prototipo (1 unità = `stage.scale` metri):
//   X = x / W, Z = −y / W (la y del piano punta verso il fondo), Y = (k − k0)/(k1 − k0) · HK (verso l'alto).
// L'interazione lavora in coordinate del palco (stage.worldToLocal): spostare o scalare il palco non cambia il significato di k.
/* global THREE, Expr, Engine, Presets, Grab */

export function startApp(kit) {
  const { t, onLang, onTheme, isDark, toast, fmtNum, parseNum, niceTicks, store } = kit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MONITOR = /[?&]monitor=1/.test(location.search);
  const HK = 1.5;                  // altezza dell'asse k nel palco
  const KX = -1.14, KZ = 1.14;     // asse k: spigolo anteriore sinistro, appena fuori dal piano
  const BASE = [1.32, 0, 1.2];     // cubo-base
  const S0 = 0.3;                  // scala iniziale del palco (m per unità): il piano è largo ~0,6 m, l'asse k alto ~0,45 m
  const MR = 128;                  // risoluzione delle maschere nel grafico della fetta
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- palette: token del laboratorio + colori delle relazioni (DESIGN.md §3) ----------
  // A blu e B arancione: coppia sicura per i daltonici; il viola (accento) è sempre "soluzione".
  const PAL = {
    light: { scene: "#FFF6F9", card: "#FFF6F9", ink: "#2E1020", muted: "#7A5266", accent: "#6B2FD6", onaccent: "#FFFFFF", tile2: "#FFD23F",
      A: "#2155CD", B: "#D96A00", grid: "#D8B3C3", base: "#7A5266", n: ["#D9C9D1", "#C3B1F2", "#9A78E8", "#6B2FD6", "#3D1A8A"], ntext: ["#2E1020", "#2E1020", "#2E1020", "#FFFFFF", "#FFFFFF"] },
    dark: { scene: "#2B1220", card: "#3B1B2E", ink: "#FFE3EE", muted: "#C79AB0", accent: "#B79CFF", onaccent: "#2B1220", tile2: "#E9B92A",
      A: "#7FA8FF", B: "#FFA24D", grid: "#5C3348", base: "#C79AB0", n: ["#4A2E3D", "#5E4A9A", "#8269D1", "#B79CFF", "#E2D6FF"], ntext: ["#FFE3EE", "#FFE3EE", "#FFFFFF", "#2B1220", "#2B1220"] },
  };
  let palName = isDark() ? "dark" : "light";
  let C = PAL[palName];
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

  // ---------- stato ----------
  const S = { a: "", b: "", k: 0, k0: -4, k1: 4, W: 4, p: 1, preset: "linecircle", playing: false, layers: true, surface: true, focus: false, disc: true };
  const R = { A: null, B: null };            // relazioni lette
  let sc = null, dis = null, chain = new Float32Array(0), slice = null;
  const ui = { xr: null, placed: false };
  const sx = (x) => x / S.W, sz = (y) => -y / S.W, sy = (k) => ((k - S.k0) / (S.k1 - S.k0)) * HK;

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
  stage.userData.grab = { scalable: true, min: 0.1, max: 1.0 };
  scene.add(stage);
  stage.scale.setScalar(S0);
  stage.position.set(-0.3, 1.0, -0.9);

  // ---------- segmenti istanziati: linee spesse che si vedono bene nel visore ----------
  const segGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 6, 1, false);
  const _o = new THREE.Object3D(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function SegMesh(n, material, parent) {
    const m = new THREE.InstancedMesh(segGeo, material, n);
    m.frustumCulled = false; m.count = 0; (parent || stage).add(m); m.userData.cap = n; return m;
  }
  function setSeg(m, i, ax, ay, az, bx, by, bz, r) {
    _d.set(bx - ax, by - ay, bz - az);
    const L = _d.length();
    if (L < 1e-7) _o.scale.set(0, 0, 0);
    else { _o.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); _o.quaternion.setFromUnitVectors(_y, _d.multiplyScalar(1 / L)); _o.scale.set(r, L, r); }
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
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.sprite.scale.set(w, (w * 96) / 256, 1);
    this.sprite.renderOrder = 6;
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

  // ---------- cornice: piano di base, assi, asse k ----------
  const floorQ = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), mat("ink", { transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  floorQ.rotation.x = -Math.PI / 2; stage.add(floorQ);
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.7 }));
  stage.add(gridLines);
  const boxLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.28 }));
  stage.add(boxLines);
  const axisM = SegMesh(8, mat("ink", { transparent: true, opacity: 0.6 }));
  let frameLabels = [];
  const kLabel = new Label("k", 0.42, { size: 44, role: "accent" });
  function buildFrame() {
    frameLabels.forEach((l) => l.dispose()); frameLabels = [];
    // griglia del piano a k = k0 (a passi "belli")
    const W = S.W, tk = niceTicks(-W, W, 6), g = [];
    for (const v of tk) { g.push(sx(v), 0, -1, sx(v), 0, 1, -1, 0, sz(v), 1, 0, sz(v)); }
    gridLines.geometry.dispose(); gridLines.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(g, 3));
    // spigoli del volume
    const b = [];
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.push(x, 0, z, x, HK, z);
    for (const [x1, z1, x2, z2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) b.push(x1, HK, z1, x2, HK, z2);
    boxLines.geometry.dispose(); boxLines.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(b, 3));
    // assi x e y
    setSeg(axisM, 0, -1, 0, 0, 1.08, 0, 0, 0.012); setSeg(axisM, 1, 0, 0, 1, 0, 0, -1.08, 0.012);
    setSeg(axisM, 2, KX, 0, KZ, KX, HK + 0.1, KZ, 0.016);
    endSegs(axisM, 3);
    const add = (text, x, y, z, w, o) => { const l = new Label(text, w, o); l.sprite.position.set(x, y, z); frameLabels.push(l); return l; };
    add("x", 1.2, 0, 0, 0.26, { size: 56 }); add("y", 0, 0, -1.2, 0.26, { size: 56 });
    const fv = (v) => fmtNum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0);
    add(fv(-W), -1, -0.002, 1.16, 0.3, { size: 42, role: "muted" }); add(fv(W), 1, -0.002, 1.16, 0.3, { size: 42, role: "muted" });
    add(fv(W), -1.17, -0.002, -1, 0.3, { size: 42, role: "muted" });
    add(fv(S.k0), KX - 0.2, 0, KZ, 0.34, { size: 42, role: "muted" });
    add(fv(S.k1), KX - 0.2, HK, KZ, 0.34, { size: 42, role: "muted" });
    add("k", KX, HK + 0.22, KZ, 0.26, { size: 56, role: "accent" });
  }

  // ---------- strati (linee di livello a k fissi), superfici e solidi ----------
  const layerLines = { A: null, B: null };
  for (const r of ["A", "B"]) {
    layerLines[r] = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C[r], transparent: true, opacity: 0.8 }));
    layerLines[r].userData.role = r; layerLines[r].frustumCulled = false; stage.add(layerLines[r]);
  }
  function buildLayerLines() {
    for (const r of ["A", "B"]) {
      const out = [], key = r.toLowerCase();
      if (sc && R[r]) for (const L of sc.layers) {
        const s = L[key], y = sy(L.k);
        if (s) for (let i = 0; i < s.length; i += 4) out.push(sx(s[i]), y, sz(s[i + 1]), sx(s[i + 2]), y, sz(s[i + 3]));
      }
      layerLines[r].geometry.dispose();
      layerLines[r].geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    }
  }

  const surf = { A: null, B: null };
  const LDIR = new THREE.Vector3(0.4, -0.5, 0.8).normalize();
  function buildSurface(r, N, Nz) {
    if (surf[r]) { stage.remove(surf[r].mesh); surf[r].mesh.geometry.dispose(); surf[r].mesh.material.dispose(); surf[r] = null; }
    if (!R[r]) return;
    const s = Engine.surface(R[r].F, S.p, S.W, S.k0, S.k1, N, Nz);
    const pos = new Float32Array(s.pos.length), shade = new Float32Array(s.pos.length / 3);
    for (let i = 0; i < s.pos.length; i += 3) {
      pos[i] = sx(s.pos[i]); pos[i + 1] = sy(s.pos[i + 2]); pos[i + 2] = sz(s.pos[i + 1]);
      shade[i / 3] = 0.6 + 0.4 * Math.abs(s.nrm[i] * LDIR.x + s.nrm[i + 1] * LDIR.y + s.nrm[i + 2] * LDIR.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = 1; stage.add(m);
    surf[r] = { mesh: m, shade };
  }
  const _c = new THREE.Color();
  function paintSurfaces() {
    for (const r of ["A", "B"]) if (surf[r]) {
      const col = surf[r].mesh.geometry.attributes.color, sh = surf[r].shade; _c.set(C[r]);
      for (let i = 0; i < sh.length; i++) col.setXYZ(i, _c.r * sh[i], _c.g * sh[i], _c.b * sh[i]);
      col.needsUpdate = true;
    }
  }

  // colorazione di maschere (regioni) in RGBA: A blu, B arancione, la parte comune viola (le soluzioni)
  function composite(data, mA, mB, M, flip, k) {
    const cA = rgb(C.A), cB = rgb(C.B), cS = rgb(C.accent), aA = 255 * 0.2 * k, aB = 255 * 0.2 * k, aS = 255 * 0.55 * k;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const src = j * M + i, dst = ((flip ? M - 1 - j : j) * M + i) * 4, a = mA && mA[src], b = mB && mB[src];
      const col = a && b ? cS : a ? cA : b ? cB : null, al = a && b ? aS : a ? aA : b ? aB : 0;
      data[dst] = col ? col[0] : 0; data[dst + 1] = col ? col[1] : 0; data[dst + 2] = col ? col[2] : 0; data[dst + 3] = al;
    }
  }
  const slabGeo = new THREE.PlaneBufferGeometry(2, 2); slabGeo.rotateX(-Math.PI / 2);
  const slabG = new THREE.Group(); stage.add(slabG);
  let slabs = []; // { mesh, tex, mA, mB, M }
  function buildSlabs(final) {
    for (const s of slabs) { slabG.remove(s.mesh); s.tex.dispose(); s.mesh.material.dispose(); }
    slabs = [];
    const M = final ? 96 : 48;
    if (!sc || !((R.A && R.A.kind === "ineq") || (R.B && R.B.kind === "ineq"))) return;
    sc.layers.forEach((L, i) => {
      if (i % 2) return;
      const mA = R.A.kind === "ineq" ? Engine.mask(R.A, L.k, S.p, S.W, M) : null, mB = R.B && R.B.kind === "ineq" ? Engine.mask(R.B, L.k, S.p, S.W, M) : null;
      const data = new Uint8Array(M * M * 4), tex = new THREE.DataTexture(data, M, M, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
      const mesh = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      mesh.position.y = sy(L.k); mesh.renderOrder = 2; slabG.add(mesh);
      slabs.push({ mesh, tex, mA, mB, M });
    });
    paintSlabs();
  }
  function paintSlabs() { for (const s of slabs) { composite(s.tex.image.data, s.mA, s.mB, s.M, false, 1.4); s.tex.needsUpdate = true; } }

  // curva 3D delle intersezioni (soluzioni del sistema)
  const chainM = SegMesh(3000, mat("accent"));
  function buildChain() {
    const n = chain.length / 6;
    for (let i = 0; i < Math.min(n, 3000); i++) {
      const o = 6 * i;
      setSeg(chainM, i, sx(chain[o]), sy(chain[o + 2]), sz(chain[o + 1]), sx(chain[o + 3]), sy(chain[o + 5]), sz(chain[o + 4]), 0.016);
    }
    endSegs(chainM, n);
  }

  // ---------- la fetta: piastra, curve alla quota k, punti, maniglia ----------
  const plateG = new THREE.Group(); stage.add(plateG);
  const plateQ = new THREE.Mesh(slabGeo, mat("ink", { transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })); plateQ.renderOrder = 3; plateG.add(plateQ);
  const plateData = new Uint8Array(MR * MR * 4), plateTex = new THREE.DataTexture(plateData, MR, MR, THREE.RGBAFormat);
  plateTex.magFilter = THREE.LinearFilter; plateTex.minFilter = THREE.LinearFilter;
  const plateMask = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ map: plateTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })); plateMask.renderOrder = 4; plateMask.position.y = 0.002; plateG.add(plateMask);
  const plateEdge = SegMesh(4, mat("tile2"), plateG);
  [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]].forEach((e, i) => setSeg(plateEdge, i, e[0], 0, e[1], e[2], 0, e[3], 0.016));
  endSegs(plateEdge, 4);
  const sliceM = { A: SegMesh(2500, mat("A"), plateG), B: SegMesh(2500, mat("B"), plateG), SA: SegMesh(2500, mat("accent"), plateG), SB: SegMesh(2500, mat("accent"), plateG) };
  const ptGeo = new THREE.SphereBufferGeometry(1, 16, 12);
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group(), a = new THREE.Mesh(ptGeo, mat("accent")), o = new THREE.Mesh(ptGeo, mat("ink", { side: THREE.BackSide }));
    a.scale.setScalar(0.05); o.scale.setScalar(0.06); g.add(a, o); g.visible = false; plateG.add(g); pts.push(g);
  }
  // maniglia (giallo con contorno) e cubo-base per spostare la scena
  const handle = new THREE.Group();
  handle.add(new THREE.Mesh(new THREE.BoxBufferGeometry(0.16, 0.12, 0.16), mat("tile2")));
  const hOut = new THREE.Mesh(new THREE.BoxBufferGeometry(0.16, 0.12, 0.16), mat("ink", { side: THREE.BackSide })); hOut.scale.setScalar(1.14); handle.add(hOut);
  stage.add(handle);
  const baseBox = new THREE.Group();
  baseBox.add(new THREE.Mesh(new THREE.BoxBufferGeometry(0.12, 0.12, 0.12), mat("base")));
  const bOut = new THREE.Mesh(new THREE.BoxBufferGeometry(0.12, 0.12, 0.12), mat("ink", { side: THREE.BackSide })); bOut.scale.setScalar(1.14); baseBox.add(bOut);
  baseBox.position.set(...BASE); stage.add(baseBox);

  function computeSlice() {
    const A = R.A, B = R.B, k = S.k, N = 128;
    const cA = A ? Engine.contour(A.F, k, S.p, S.W, N) : null, cB = B ? Engine.contour(B.F, k, S.p, S.W, N) : null;
    const o = { k, cA: cA && cA.seg, cB: cB && cB.seg, pts: [], solA: null, solB: null, mA: null, mB: null };
    if (A && B) o.pts = Engine.intersections(A.F, B.F, k, S.p, S.W, N, cA, cB).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    if (A && B && A.kind === "eq" && B.kind === "ineq") o.solA = Engine.filterInside(cA.seg, B, k, S.p);
    if (A && B && B.kind === "eq" && A.kind === "ineq") o.solB = Engine.filterInside(cB.seg, A, k, S.p);
    if (A && A.kind === "ineq") o.mA = Engine.mask(A, k, S.p, S.W, MR, slice && slice.mA);
    if (B && B.kind === "ineq") o.mB = Engine.mask(B, k, S.p, S.W, MR, slice && slice.mB);
    slice = o;
  }
  function fillSlice(m, seg, r) {
    let n = 0;
    if (seg) for (let i = 0; i < seg.length && n < m.userData.cap; i += 4) setSeg(m, n++, sx(seg[i]), 0.004, sz(seg[i + 1]), sx(seg[i + 2]), 0.004, sz(seg[i + 3]), r);
    endSegs(m, n);
  }
  function updateSliceMeshes() {
    const yk = sy(S.k);
    plateG.position.y = yk; handle.position.set(KX, yk, KZ);
    fillSlice(sliceM.A, slice.cA, 0.014); fillSlice(sliceM.B, slice.cB, 0.014);
    fillSlice(sliceM.SA, slice.solA, 0.026); fillSlice(sliceM.SB, slice.solB, 0.026);
    pts.forEach((g, i) => { const p = slice.pts[i]; g.visible = !!p; if (p) g.position.set(sx(p[0]), 0.01, sz(p[1])); });
    composite(plateData, slice.mA, slice.mB, MR, false, 1.6); plateTex.needsUpdate = true;
    kLabel.set(`k = ${fmtNum(S.k, 2)}`); kLabel.sprite.position.set(1.0, yk + 0.12, 1.3);
    labelHandleSig = "";
  }
  let labelHandleSig = "";

  // ---------- discussione sull'asse k: barra colorata, numeri e valori critici ----------
  const stripPool = [], stripLabels = [], critPool = [];
  const boxGeo = new THREE.BoxBufferGeometry(1, 1, 1);
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); m.visible = false; stage.add(m); stripPool.push(m);
    const l = new Label("0", 0.2, { size: 60 }); l.sprite.visible = false; stripLabels.push(l);
  }
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(boxGeo, mat("ink")); m.visible = false; m.scale.set(0.24, 0.022, 0.24); stage.add(m); // un trattino d'inchiostro sull'asse: non confondibile con la maniglia gialla
    const l = new Label("", 0.36, { size: 40, role: "accent" }); l.sprite.visible = false; critPool.push({ m, l });
  }
  const strip = { x: KX, z: KZ, w: 0.08 };
  function buildStrip() {
    const show = S.disc && dis && R.B;
    const runs = show ? dis.runs : [{ k0: S.k0, k1: S.k1, n: -1 }];
    stripPool.forEach((m, i) => {
      const r = runs[i], l = stripLabels[i];
      m.visible = !!r; l.sprite.visible = false;
      if (!r) return;
      const y0 = sy(r.k0), y1 = sy(r.k1);
      m.scale.set(strip.w, Math.max(0.004, y1 - y0), strip.w); m.position.set(strip.x, (y0 + y1) / 2, strip.z);
      m.material.color.set(r.n < 0 ? C.grid : C.n[Math.min(4, r.n)]);
      if (r.n >= 0 && y1 - y0 > 0.1) { l.set(String(r.n)); l.sprite.position.set(strip.x + 0.01, (y0 + y1) / 2, strip.z + 0.08); l.sprite.visible = true; l.sprite.scale.set(0.16, 0.06, 1); }
    });
    const cr = show ? dis.crit : [];
    critPool.forEach((c, i) => {
      const e = cr[i]; c.m.visible = !!e; c.l.sprite.visible = !!e && cr.length <= 10;
      if (!e) return;
      c.m.position.set(strip.x, sy(e.k), strip.z); c.l.set(fmtNum(e.k, 2)); c.l.sprite.position.set(strip.x - 0.3, sy(e.k), strip.z);
    });
  }

  // ---------- ricostruzione completa (cambio di relazioni, intervallo, finestra, parametro a) ----------
  function rebuild(final) {
    if (!R.A) return;
    const FA = R.A.F, FB = R.B ? R.B.F : null;
    sc = Engine.scan(FA, FB, S.k0, S.k1, S.p, S.W, final ? { nk: 160, N: 80, stride: 8 } : { nk: 48, N: 56, stride: 3 });
    if (final || !FB) dis = FB ? Engine.discuss(FA, FB, sc) : null;
    chain = FB ? Engine.link(sc) : new Float32Array(0);
    buildFrame(); buildLayerLines(); buildChain(); buildSlabs(final);
    const n = final ? 44 : 24, nz = final ? 40 : 20;
    buildSurface("A", n, nz); buildSurface("B", n, nz); paintSurfaces();
    computeSlice(); updateSliceMeshes(); buildStrip(); applyVisibility();
    syncDom();
  }
  function applyVisibility() {
    const f = S.focus;
    for (const r of ["A", "B"]) {
      layerLines[r].visible = S.layers; layerLines[r].material.opacity = f ? 0.15 : 0.8;
      if (surf[r]) { surf[r].mesh.visible = S.surface; surf[r].mesh.material.opacity = f ? 0.06 : 0.3; }
    }
    slabG.visible = S.layers; for (const s of slabs) s.mesh.material.opacity = f ? 0.25 : 1;
    chainM.material.opacity = 1; chainM.material.transparent = f; chainM.material.opacity = f ? 0.35 : 1;
    plateQ.material.opacity = f ? 0.55 : 0.07; plateQ.material.color.set(f ? C.card : C.ink);
  }

  // ---------- azioni (le stesse da schermo, dal pannello e da tastiera) ----------
  function setK(v, keepPlaying) {
    v = clamp(v, S.k0, S.k1);
    if (v === S.k) return;
    S.k = v; if (!keepPlaying) S.playing = false;
    computeSlice(); updateSliceMeshes(); syncDom(true);
  }
  function setPlaying(p) { S.playing = p; if (p && S.k >= S.k1 - 1e-9) setK(S.k0, true); syncDom(); }
  const stepK = (dir, big) => setK(S.k + dir * (S.k1 - S.k0) * (big ? 0.05 : 0.01));
  function nextCrit() {
    const cr = dis && dis.crit.length ? dis.crit : null;
    if (!cr) return;
    const nx = cr.find((c) => c.k > S.k + 1e-6) || cr[0]; S.playing = false; setK(nx.k);
  }
  function prevCrit() {
    const cr = dis && dis.crit.length ? dis.crit : null;
    if (!cr) return;
    const pv = [...cr].reverse().find((c) => c.k < S.k - 1e-6) || cr[cr.length - 1]; S.playing = false; setK(pv.k);
  }
  function cyclePreset(dir) {
    const o = Presets.ORDER, i = o.indexOf(S.preset);
    loadPreset(o[(((i < 0 ? 0 : i) + dir) % o.length + o.length) % o.length]);
  }
  const toggle = (key) => () => { S[key] = !S[key]; if (key === "disc") buildStrip(); applyVisibility(); syncDom(); };
  const ACT = {
    sweep: () => setPlaying(!S.playing), kminus: () => stepK(-1, true), kplus: () => stepK(1, true), prev: () => cyclePreset(-1), next: () => cyclePreset(1),
    crit: nextCrit, focus: toggle("focus"), layers: toggle("layers"), surface: toggle("surface"), disc: toggle("disc"), recenter: () => placeFromHead(),
    reset: () => { S.playing = false; setK(Presets.byId(S.preset) ? Presets.byId(S.preset).k : S.k0); },
  };

  // ---------- relazioni, esempi, link ----------
  function loadPreset(id, over) {
    const p = Presets.byId(id) || Presets.LIST[0];
    applyState(Object.assign({ preset: p.id, a: p.a, b: p.b, k0: p.k0, k1: p.k1, k: p.k, W: p.W, p: p.p }, over || {}));
  }
  // Applica uno stato completo; se una relazione non si legge si ricade sul primo esempio.
  function applyState(st) {
    const ra = Expr.tryParse(st.a), rb = st.b && st.b.trim() ? Expr.tryParse(st.b) : { ok: true, rel: null };
    if (!ra.ok || !rb.ok) { if (st.a !== Presets.LIST[0].a) return loadPreset(Presets.LIST[0].id); return; }
    R.A = ra.rel; R.B = rb.rel;
    Object.assign(S, { a: st.a, b: st.b || "", k0: st.k0, k1: st.k1, W: st.W, p: st.p, playing: false });
    S.k = clamp(st.k, S.k0, S.k1); matchPreset(st.preset);
    $("relA").value = S.a; $("relB").value = S.b; showErr("A", null); showErr("B", null);
    rebuild(true);
  }
  function matchPreset(hint) { // se le relazioni coincidono con un esempio, quello; altrimenti "Personalizzato"
    const p = Presets.LIST.find((q) => q.a === S.a && q.b === S.b && q.k0 === S.k0 && q.k1 === S.k1 && q.W === S.W);
    S.preset = p ? p.id : hint && Presets.byId(hint) ? hint : "custom";
  }
  function showErr(which, e) {
    const el = $("rel" + which);
    $("err" + which).textContent = e ? t(e.code, e.params) : "";
    el.setAttribute("aria-invalid", e ? "true" : "false");
  }
  const timers = {};
  function onRel(which) {
    clearTimeout(timers[which]);
    timers[which] = setTimeout(() => {
      const txt = $("rel" + which).value;
      if (which === "B" && !txt.trim()) { R.B = null; S.b = ""; showErr("B", null); edited(); return; }
      const r = Expr.tryParse(txt);
      if (!r.ok) { showErr(which, r.error); return; }
      showErr(which, null);
      R[which] = r.rel; S[which.toLowerCase()] = txt; edited();
    }, 300);
  }
  function edited() { // le relazioni sono cambiate
    matchPreset(null); S.k = clamp(S.k, S.k0, S.k1); S.playing = false; rebuild(true);
  }
  function stateQuery() {
    const q = new URLSearchParams();
    q.set("a", S.a); if (S.b) q.set("b", S.b);
    q.set("k0", +S.k0.toFixed(6)); q.set("k1", +S.k1.toFixed(6)); q.set("w", +S.W.toFixed(6)); q.set("k", +S.k.toFixed(4));
    if (S.p !== 1) q.set("p", +S.p.toFixed(4));
    return q.toString();
  }
  const shareUrl = () => location.origin + location.pathname + "#" + stateQuery();
  function readQuery(str) {
    const q = new URLSearchParams(str.replace(/^#/, ""));
    if (!q.has("a")) return null;
    const num = (key, d) => { const v = parseNum(q.get(key)); return Number.isFinite(v) ? v : d; };
    const k0 = num("k0", -4), k1 = num("k1", 4);
    if (!(k1 > k0)) return null;
    const W = num("w", 4);
    return { preset: "custom", a: q.get("a"), b: q.get("b") || "", k0, k1, W: W > 0 ? W : 4, k: num("k", k0), p: num("p", 1) };
  }
  let saveT = 0;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => { const s = stateQuery(); store.set("state", s); try { history.replaceState(null, "", "#" + s); } catch (e) { /* ignore */ } }, 400); }
  function share() { try { navigator.clipboard.writeText(shareUrl()).then(() => toast(t("copied")), () => toast(t("copied"))); } catch (e) { toast(shareUrl()); } }

  // ---------- testi della discussione ----------
  const bothEq = () => R.A && R.B && R.A.kind === "eq" && R.B.kind === "eq";
  function countText(n) { return t((bothEq() ? "n.sol." : "n.int.") + (n === 0 ? "0" : n === 1 ? "1" : "n"), { n }); }
  function discText() {
    if (!dis || !R.B) { toast(t("dc.none")); return; }
    const f = (v) => fmtNum(v, 2), rows = [t("dc.head") + " · A: " + S.a + " · B: " + S.b];
    dis.runs.forEach((r, i) => {
      const c = countText(r.n);
      rows.push(dis.runs.length === 1 ? c : i === 0 ? t("dc.lt", { v: f(r.k1), c }) : i === dis.runs.length - 1 ? t("dc.gt", { v: f(r.k0), c }) : t("dc.between", { a: f(r.k0), b: f(r.k1), c }));
      const cr = dis.crit[i];
      if (cr && cr.at != null) rows.push(t("dc.eq", { v: f(cr.k), c: countText(cr.at) }));
    });
    try { navigator.clipboard.writeText(rows.join("\n")).then(() => toast(t("dc.copied")), () => toast(t("dc.copied"))); } catch (e) { toast(rows.join(" | ")); }
  }

  // ---------- grafico della fetta (usato nella pagina e nel pannello in 3D) ----------
  const rc = document.createElement("canvas"); rc.width = MR; rc.height = MR;
  const rctx = rc.getContext("2d"), rimg = rctx.createImageData(MR, MR);
  function drawSlice(c, X, Y, w, h, fs) {
    const W = S.W, ml = fs * 2.7, mb = fs * 2.1, mt = fs * 0.9, mr = fs * 0.9;
    const size = Math.min(w - ml - mr, h - mt - mb), x0 = X + ml + (w - ml - mr - size) / 2, y0 = Y + mt;
    const px = (x) => x0 + ((x + W) / (2 * W)) * size, py = (y) => y0 + (1 - (y + W) / (2 * W)) * size;
    c.save();
    c.fillStyle = C.card; c.fillRect(X, Y, w, h);
    // regioni
    if (slice && (slice.mA || slice.mB)) {
      composite(rimg.data, slice.mA, slice.mB, MR, true, 1.6); rctx.putImageData(rimg, 0, 0);
      c.imageSmoothingEnabled = true; c.drawImage(rc, x0, y0, size, size);
    }
    // griglia, assi, tacche
    const tk = niceTicks(-W, W, 6), lw = Math.max(1, fs / 8);
    c.font = `700 ${fs * 0.85}px "Space Mono", monospace`; c.fillStyle = C.muted; c.textBaseline = "top"; c.textAlign = "center";
    c.lineWidth = lw; c.strokeStyle = C.grid;
    for (const v of tk) {
      c.beginPath(); c.moveTo(px(v), y0); c.lineTo(px(v), y0 + size); c.moveTo(x0, py(v)); c.lineTo(x0 + size, py(v)); c.stroke();
      c.fillText(fmtNum(v, v % 1 ? 1 : 0), px(v), y0 + size + fs * 0.3);
    }
    c.textAlign = "right"; c.textBaseline = "middle";
    for (const v of tk) c.fillText(fmtNum(v, v % 1 ? 1 : 0), x0 - fs * 0.4, py(v));
    c.strokeStyle = C.ink; c.lineWidth = lw * 1.5; c.beginPath(); c.moveTo(x0, py(0)); c.lineTo(x0 + size, py(0)); c.moveTo(px(0), y0); c.lineTo(px(0), y0 + size); c.stroke();
    c.save(); c.beginPath(); c.rect(x0, y0, size, size); c.clip();
    // curve: tratteggiate se la disequazione è stretta
    const stroke = (seg, col, width, dash) => {
      if (!seg || !seg.length) return;
      c.strokeStyle = col; c.lineWidth = width; c.lineCap = "round"; c.setLineDash(dash ? [fs * 0.6, fs * 0.45] : []);
      c.beginPath(); for (let i = 0; i < seg.length; i += 4) { c.moveTo(px(seg[i]), py(seg[i + 1])); c.lineTo(px(seg[i + 2]), py(seg[i + 3])); } c.stroke(); c.setLineDash([]);
    };
    if (slice) {
      stroke(slice.cA, C.A, lw * 2.2, R.A && R.A.strict); stroke(slice.cB, C.B, lw * 2.2, R.B && R.B.strict);
      stroke(slice.solA, C.accent, lw * 4.2); stroke(slice.solB, C.accent, lw * 4.2);
      for (const p of slice.pts) {
        c.beginPath(); c.arc(px(p[0]), py(p[1]), fs * 0.5, 0, 7); c.fillStyle = C.accent; c.fill(); c.lineWidth = lw * 1.6; c.strokeStyle = C.ink; c.stroke();
      }
    }
    c.restore();
    c.strokeStyle = C.ink; c.lineWidth = lw * 1.6; c.strokeRect(x0, y0, size, size);
    c.fillStyle = C.ink; c.font = `700 ${fs * 1.05}px "Space Mono", monospace`; c.textBaseline = "alphabetic";
    c.textAlign = "right"; c.fillText("x", x0 + size - fs * 0.35, py(0) - fs * 0.35);
    c.textAlign = "left"; c.fillText("y", px(0) + fs * 0.4, y0 + fs * 1.1);
    c.restore();
    return { x0, y0, size };
  }
  // barra della discussione: intervalli colorati col numero di intersezioni, valori critici, cursore k
  function drawDisc(c, X, Y, w, h, fs) {
    const barH = h * 0.58, kx = (k) => X + ((k - S.k0) / (S.k1 - S.k0)) * w, show = S.disc && dis && R.B;
    c.save();
    c.fillStyle = C.card; c.fillRect(X, Y, w, h);
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = `700 ${fs * 1.15}px "Space Mono", monospace`;
    if (show) {
      for (const r of dis.runs) {
        const a = kx(r.k0), b = kx(r.k1), n = Math.min(4, r.n);
        c.fillStyle = C.n[n]; c.fillRect(a, Y, Math.max(1, b - a), barH);
        c.strokeStyle = C.ink; c.lineWidth = Math.max(1, fs / 9); c.strokeRect(a, Y, Math.max(1, b - a), barH);
        if (b - a > fs * 1.8) { c.fillStyle = C.ntext[n]; c.fillText(String(r.n), (a + b) / 2, Y + barH / 2 + 1); }
      }
    } else {
      c.fillStyle = C.grid; c.globalAlpha = 0.45; c.fillRect(X, Y, w, barH); c.globalAlpha = 1;
      c.strokeStyle = C.ink; c.lineWidth = Math.max(1, fs / 9); c.strokeRect(X, Y, w, barH);
      if (R.B && !S.disc) { c.fillStyle = C.muted; c.fillText(t("x.hidden"), X + w / 2, Y + barH / 2); }
    }
    // etichette: valori critici (a due righe se si sovrappongono) o gli estremi
    c.font = `700 ${fs * 0.85}px "Space Mono", monospace`; c.textBaseline = "top";
    c.strokeStyle = C.ink; c.lineWidth = Math.max(1, fs / 8);
    if (show && dis.crit.length) {
      const rowEnd = [-1e9, -1e9];
      for (const e of dis.crit) {
        const txt = fmtNum(e.k, 2), wd = c.measureText(txt).width, x = clamp(kx(e.k), X + wd / 2, X + w - wd / 2);
        c.beginPath(); c.moveTo(kx(e.k), Y + barH - 1); c.lineTo(kx(e.k), Y + barH + fs * 0.3); c.stroke();
        const row = x - wd / 2 > rowEnd[0] + fs * 0.4 ? 0 : 1;
        rowEnd[row] = x + wd / 2; c.fillStyle = C.accent; c.fillText(txt, x, Y + barH + fs * 0.35 + row * fs * 1.05);
      }
    } else { c.textAlign = "left"; c.fillStyle = C.muted; c.fillText(fmtNum(S.k0, 2), X + 2, Y + barH + fs * 0.3); c.textAlign = "right"; c.fillText(fmtNum(S.k1, 2), X + w - 2, Y + barH + fs * 0.3); }
    // cursore
    const cx = kx(S.k);
    c.fillStyle = C.ink; c.fillRect(cx - Math.max(1.5, fs / 7), Y - 1, Math.max(3, fs / 3.5), barH + 2);
    c.fillStyle = C.tile2; c.fillRect(cx - fs * 0.45, Y + barH - fs * 0.15, fs * 0.9, fs * 0.9); c.strokeRect(cx - fs * 0.45, Y + barH - fs * 0.15, fs * 0.9, fs * 0.9);
    c.restore();
    return { kx };
  }

  // ---------- pannello flottante (canvas → texture) ----------
  const PW = 1024, PH = 690, PM = 0.74, PMH = (PM * PH) / PW;
  const pcv = document.createElement("canvas"); pcv.width = PW; pcv.height = PH;
  const ptex = new THREE.CanvasTexture(pcv); ptex.anisotropy = 4;
  const panel = new THREE.Group(); panel.rotation.order = "YXZ"; panel.visible = false; scene.add(panel);
  const pmesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ map: ptex, transparent: true }));
  const pshadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
  pshadow.position.set(0.008, -0.008, -0.004);
  panel.add(pshadow, pmesh);
  const RB = 600, RW = 412, BH = 66;
  const items = [
    { id: "kminus", x: RB, y: 444, w: 120, h: BH }, { id: "sweep", x: RB + 132, y: 444, w: 148, h: BH }, { id: "kplus", x: RB + 292, y: 444, w: 120, h: BH },
    { id: "prev", x: RB, y: 522, w: 100, h: BH }, { id: "next", x: RB + 112, y: 522, w: 100, h: BH }, { id: "crit", x: RB + 224, y: 522, w: 188, h: BH },
    { id: "focus", x: RB, y: 600, w: 132, h: BH }, { id: "layers", x: RB + 144, y: 600, w: 132, h: BH }, { id: "recenter", x: RB + 288, y: 600, w: 124, h: BH },
    { id: "disc", x: RB, y: 336, w: RW, h: 80 }, { id: "plot", x: 20, y: 72, w: 552, h: 552 },
  ];
  let pSig = "", pHover = null;
  const pfont = (n) => FONT.replace("{n}", n);
  const plotBox = items.find((i) => i.id === "plot"), discBox = items.find((i) => i.id === "disc");
  function wrap(c, text, x, y, maxW, lh, maxLines) {
    const words = text.split(" "); let line = "", n = 0;
    for (const wd of words) {
      const test = line ? line + " " + wd : wd;
      if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y + n * lh); n++; line = wd; if (n >= maxLines) return; } else line = test;
    }
    if (line && n < maxLines) c.fillText(line, x, y + n * lh);
  }
  function relLabel(r) { return r ? r.src.replace(/\s+/g, " ") : ""; }
  function drawPanel() {
    const c = pcv.getContext("2d");
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = C.card; c.fillRect(0, 0, PW, PH);
    c.strokeStyle = C.ink; c.lineWidth = 8; c.strokeRect(4, 4, PW - 8, PH - 8);
    c.textBaseline = "alphabetic";
    // titolo e k
    c.fillStyle = C.ink; c.textAlign = "left"; c.font = pfont(28);
    const pname = S.preset === "custom" ? t("custom") : t("pr." + S.preset);
    c.fillText(pname.length > 28 ? pname.slice(0, 27) + "…" : pname, 28, 52);
    c.textAlign = "right"; c.font = pfont(46); c.fillStyle = C.accent; c.fillText(`k = ${fmtNum(S.k, 2)}`, PW - 28, 56);
    // grafico della fetta
    drawSlice(c, plotBox.x, plotBox.y, plotBox.w, plotBox.h, 19);
    c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(plotBox.x, plotBox.y, plotBox.w, plotBox.h);
    // relazioni e risultato
    c.textAlign = "left"; c.font = pfont(24);
    [["A", R.A, C.A], ["B", R.B, C.B]].forEach(([id, r, col], i) => {
      if (!r) return;
      const y = 106 + i * 46;
      c.fillStyle = col; c.fillRect(RB, y - 22, 26, 26); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(RB, y - 22, 26, 26);
      c.fillStyle = C.ink; c.fillText(relLabel(r), RB + 40, y, RW - 44);
    });
    const n = slice ? slice.pts.length : 0, paired = R.A && R.B;
    c.fillStyle = C.accent; c.font = pfont(32);
    c.fillText(paired ? countText(n) : R.A && R.A.kind === "ineq" ? t("slice.region") : t("slice.one"), RB, 232, RW);
    c.fillStyle = C.ink; c.font = pfont(22);
    if (slice) slice.pts.slice(0, 3).forEach((p, i) => c.fillText(`(${fmtNum(p[0], 2)} ; ${fmtNum(p[1], 2)})`, RB, 272 + i * 30));
    if (slice && slice.pts.length > 3) { c.fillStyle = C.muted; c.fillText(`… ${t("x.more")}`, RB + 260, 272); }
    // discussione
    c.fillStyle = C.muted; c.font = pfont(18); c.fillText(t("x.disc"), RB, 330);
    drawDisc(c, discBox.x, discBox.y + 6, discBox.w, discBox.h - 6, 18);
    // pulsanti
    for (const it of items) {
      if (it.id === "plot" || it.id === "disc") continue;
      const on = (it.id === "focus" && S.focus) || (it.id === "layers" && S.layers) || (it.id === "sweep" && S.playing);
      const primary = it.id === "sweep", hov = pHover === it.id;
      c.fillStyle = primary || on ? C.accent : C.card; c.fillRect(it.x, it.y, it.w, it.h);
      if (hov) { c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(it.x, it.y, it.w, it.h); }
      c.strokeStyle = C.ink; c.lineWidth = hov ? 7 : 4; c.strokeRect(it.x, it.y, it.w, it.h);
      c.fillStyle = primary || on ? C.onaccent : C.ink; c.textAlign = "center";
      const lab = { kminus: "−", kplus: "+", sweep: t(S.playing ? "x.pause" : "x.sweep"), prev: "◀", next: "▶" }[it.id] || t("x." + it.id);
      c.font = pfont(it.id === "kminus" || it.id === "kplus" ? 40 : it.id === "prev" || it.id === "next" ? 30 : lab.length > 8 ? 21 : 26);
      c.fillText(lab, it.x + it.w / 2, it.y + it.h / 2 + 9, it.w - 10);
    }
    if (MONITOR) { c.font = pfont(16); c.fillStyle = C.muted; c.textAlign = "left"; monLines().forEach((l, i) => c.fillText(l, 24 + i * 480, 18)); }
    ptex.needsUpdate = true;
  }
  const panelSig = () => [S.k.toFixed(3), S.playing, S.focus, S.layers, S.preset, S.disc, S.a, S.b, S.W, palName, t("x.sweep"), pHover, dis ? dis.crit.length : -1, MONITOR ? Math.floor(performance.now() / 300) : 0].join("|");
  function itemAt(u, v) { // u, v ∈ [0,1] sul pannello (v verso l'alto)
    const px = u * PW, py = (1 - v) * PH;
    return items.find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) || null;
  }
  const discK = (u) => clamp(S.k0 + ((u * PW - discBox.x) / discBox.w) * (S.k1 - S.k0), S.k0, S.k1);
  function runItem(it, u) { if (it.id === "disc") { S.playing = false; setK(discK(u)); } else if (it.id !== "plot") ACT[it.id](); }
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
  const GP = { TRIG: 0, GRIP: 1 }; // xr-standard dei Touch — DA VERIFICARE sulla Quest (?monitor=1)
  const SRC = [0, 1].map((i) => ({ i, kind: null, gp: null, handed: null, active: false, pos: new THREE.Vector3(), tip: new THREE.Vector3(), quat: new THREE.Quaternion(),
    rayO: new THREE.Vector3(), rayD: new THREE.Vector3(), pinch: false, down: false, prevDown: false, eng: null, off: 0, tipZ: 1, raw: "", stick: 0 }));
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.2)]);
  const rays = [0, 1].map(() => new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffe3ee, transparent: true, opacity: 0.5 })));
  [0, 1].forEach((i) => {
    scene.add(ctrls[i], grips[i], hands[i]); ctrls[i].add(rays[i]); rays[i].visible = false;
    ctrls[i].addEventListener("connected", (e) => { const s = SRC[i]; s.kind = e.data && e.data.hand ? "hand" : "controller"; s.gp = (e.data && e.data.gamepad) || null; s.handed = (e.data && e.data.handedness) || null; });
    ctrls[i].addEventListener("disconnected", () => { const s = SRC[i]; s.kind = null; s.gp = null; s.eng = null; s.active = false; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6), jointMat = new THREE.MeshBasicMaterial({ color: 0xffe3ee });
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
      const sy_ = ax.length >= 4 ? ax[3] : 0; s.stick = Math.abs(sy_) > 0.18 ? -sy_ : 0; // spinta in alto = k aumenta (asse y negativo in alto)
      s.raw = `ctrl btn[${b.map((x, k) => (x.pressed ? k : "")).filter((x) => x !== "").join(",")}] stick=${s.stick.toFixed(2)}`;
    }
  }
  function monLines() { return SRC.map((s) => `${s.handed || s.i}: ${s.kind ? s.raw || s.kind : "—"} ${s.eng || ""}`); }
  function buzz(s, k, ms) { const gp = s.gp; if (!gp || s.kind !== "controller") return; try { const a = gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) a.pulse(k, ms); } catch (e) { /* non supportata */ } }

  // bersagli afferrabili, in coordinate del palco → mondo
  const _l = new THREE.Vector3();
  function targets() {
    return [["handle", new THREE.Vector3(KX, sy(S.k), KZ)], ["base", new THREE.Vector3(...BASE)]].map(([id, p]) => [id, stage.localToWorld(p)]);
  }
  const reach = () => 0.08 + 0.2 * stage.scale.x;
  function nearest(p) {
    let best = null, bd = reach();
    for (const [id, w] of targets()) { const d = w.distanceTo(p); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  const localOf = (w) => stage.worldToLocal(_l.copy(w));
  const kOfY = (y) => S.k0 + (y / HK) * (S.k1 - S.k0);
  // aggancio ai valori critici (1 % dell'intervallo): una piccola calamita, con un impulso sul controller
  let snapped = null;
  function setKSnap(v, s) {
    const cr = dis && S.disc && R.B ? dis.crit : [], tol = 0.012 * (S.k1 - S.k0);
    const hit = cr.find((c) => Math.abs(c.k - v) < tol);
    if (hit) { if (snapped !== hit && s) buzz(s, 0.6, 40); snapped = hit; v = hit.k; } else snapped = null;
    setK(v);
  }
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
      if (s.kind === "controller" && rising && it) { runItem(it, hit.u); buzz(s, 0.4, 30); s.eng = it.id === "disc" ? "disc" : "ui"; }
      if (s.kind === "hand") {
        const z = hit ? hit.z : 1;
        if (it && s.tipZ > 0.025 && z <= 0.015) runItem(it, hit.u);
        s.tipZ = hit ? z : 1;
        if (it && it.id === "disc" && z < 0.02) { S.playing = false; setK(discK(hit.u)); }
      }
      if (s.kind === "controller" && s.eng === "disc" && s.down && hit) { S.playing = false; setK(discK(hit.u)); }
      // afferrare la maniglia o la base
      if (rising && !s.eng) {
        const id = nearest(s.pos);
        if (id) { s.eng = id; if (id === "handle") { S.playing = false; s.off = localOf(s.pos).y - sy(S.k); } buzz(s, 0.5, 40); }
        else if (SRC.some((o) => o !== s && o.eng === "base")) s.eng = "base"; // la seconda mano scala la scena
      }
      if (!s.down) s.eng = null;
      if (s.eng === "handle") setKSnap(kOfY(localOf(s.pos).y - s.off), s);
      if (s.stick && !s.eng) { S.playing = false; setK(S.k + s.stick * (S.k1 - S.k0) * 0.25 * dt); }
      if (!s.eng && !s.down) { const id = nearest(s.pos); if (id) near[id] = true; }
      if (s.eng) near[s.eng] = true;
    }
    grab.update(SRC.map((s) => ({ id: "s" + s.i, active: s.active, pinching: s.eng === "base", pos: s.pos.clone(), quat: s.quat.clone() })), dt, () => stage);
    handle.scale.setScalar(near.handle ? 1.3 : 1); baseBox.scale.setScalar(near.base ? 1.3 : 1);
  }

  // ---------- posizionamento davanti a chi guarda ----------
  function placeFromHead() {
    const xc = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    const hp = new THREE.Vector3(), hq = new THREE.Quaternion();
    xc.getWorldPosition(hp); xc.getWorldQuaternion(hq);
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(hq); d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    d.normalize();
    const th = Math.atan2(-d.x, -d.z), hy = Math.max(1.0, hp.y);
    stage.rotation.set(0, th, 0);
    stage.position.copy(hp).addScaledVector(d, 1.0); stage.position.y = hy - 0.5;
    panel.rotation.set(-0.6, th, 0);
    panel.position.copy(hp).addScaledVector(d, 0.55); panel.position.y = Math.max(0.55, hy - 0.52);
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
        xrSession = null; ui.xr = null; SRC.forEach((s) => (s.eng = null)); panel.visible = false; rays.forEach((r) => (r.visible = false));
        document.body.classList.remove("inxr"); applyPalette(isDark() ? "dark" : "light"); syncXrButtons();
        stage.rotation.set(0, 0, 0); stage.scale.setScalar(S0); stage.position.set(-0.3, 1.0, -0.9); camPlace(); resize();
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
    for (const r of ["A", "B"]) layerLines[r].material.color.set(C[r]);
    gridLines.material.color.set(C.grid); boxLines.material.color.set(C.ink); floorGrid.material.color.set(C.grid);
    const vr = ui.xr === "immersive-vr", ar = ui.xr === "immersive-ar";
    scene.background = ar ? null : new THREE.Color(C.scene);
    floorGrid.visible = vr;
    labels.forEach((l) => l.redraw()); paintSurfaces(); paintSlabs(); buildStrip();
    composite(plateData, slice && slice.mA, slice && slice.mB, MR, false, 1.6); plateTex.needsUpdate = true;
    applyVisibility(); pSig = "";
  }

  // ---------- schermo: camera orbitale, trascinamento della maniglia, tastiera ----------
  const cam = { yaw: 0.55, pitch: 0.42, dist: 1.0, user: false }; // user: chi ha usato rotella o pizzico tiene la sua distanza
  const target = new THREE.Vector3();
  function camPlace() {
    stage.updateMatrixWorld(true);
    stage.localToWorld(target.set(-0.1, HK * 0.45, 0.05)); // il centro include l'asse k, a sinistra del piano
    camera.position.set(target.x + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch), target.y + cam.dist * Math.sin(cam.pitch), target.z + cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(target);
  }
  function resize() {
    if (renderer.xr.isPresenting) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!cam.user) { cam.dist = w / h < 1.15 ? clamp(1.0 * (1.15 / (w / h)) * 0.88, 1.0, 2.2) : 1.0; camPlace(); } // in verticale ci si allontana
  }
  new ResizeObserver(() => { resize(); drawDom(); }).observe(view);
  const cv = $("cv");
  const drag = { mode: null, id: null, x: 0, y: 0, off: 0 };
  const pts2 = new Map(); let pinch0 = 0;
  const _ndc = new THREE.Vector2(), _rr = new THREE.Raycaster();
  function screenRay(e) {
    const r = cv.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _rr.setFromCamera(_ndc, camera); return _rr.ray;
  }
  function axisParam(ray) { // punto dell'asse k più vicino al raggio → k
    const O = stage.localToWorld(new THREE.Vector3(KX, 0, KZ)), D = stage.localToWorld(new THREE.Vector3(KX, 1, KZ)).sub(O);
    const w0 = O.clone().sub(ray.origin), a = D.dot(D), b = D.dot(ray.direction), c = ray.direction.dot(ray.direction), d = D.dot(w0), e = ray.direction.dot(w0);
    const den = a * c - b * b; if (Math.abs(den) < 1e-9) return null;
    return { k: kOfY((b * e - c * d) / den) };
  }
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts2.size === 2) { const [a, b] = [...pts2.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); drag.mode = "zoom"; return; }
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    const h = stage.localToWorld(new THREE.Vector3(KX, sy(S.k), KZ)).project(camera), r = cv.getBoundingClientRect();
    const hx = ((h.x + 1) / 2) * r.width + r.left, hy = ((1 - h.y) / 2) * r.height + r.top;
    const nearH = Math.hypot(e.clientX - hx, e.clientY - hy) < 36;
    drag.mode = nearH ? "axis" : "orbit";
    if (drag.mode === "axis") { setPlaying(false); const ap = axisParam(screenRay(e)); drag.off = ap ? ap.k - S.k : 0; }
    cv.classList.add("held");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts2.has(e.pointerId)) return;
    pts2.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.mode === "zoom" && pts2.size === 2) { const [a, b] = [...pts2.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.dist = clamp(cam.dist * (pinch0 / d), 0.5, 6); cam.user = true; pinch0 = d; camPlace(); return; }
    if (e.pointerId !== drag.id || !drag.mode) return;
    if (drag.mode === "axis") { const ap = axisParam(screenRay(e)); if (ap) setKSnap(ap.k - drag.off, null); }
    else { cam.yaw -= (e.clientX - drag.x) * 0.008; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.006, -1.2, 1.5); camPlace(); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e) => { pts2.delete(e.pointerId); if (!pts2.size) { drag.mode = null; drag.id = null; cv.classList.remove("held"); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 0.5, 6); cam.user = true; camPlace(); }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea, dialog, button")) return;
    if (e.key === " ") { e.preventDefault(); ACT.sweep(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepK(e.key === "ArrowRight" ? 1 : -1, e.shiftKey); }
    else if (e.key === "c" || e.key === "C") { e.shiftKey ? prevCrit() : nextCrit(); }
    else if (e.key === "r" || e.key === "R") ACT.reset();
  });

  // ---------- DOM ----------
  const plotCv = $("plot"), discCv = $("disc");
  function fit(cv2) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv2.clientWidth, h = cv2.clientHeight;
    if (!w || !h) return null;
    if (cv2.width !== Math.round(w * dpr) || cv2.height !== Math.round(h * dpr)) { cv2.width = Math.round(w * dpr); cv2.height = Math.round(h * dpr); }
    const c = cv2.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, w, h };
  }
  function drawDom() {
    let f = fit(plotCv); if (f) drawSlice(f.c, 0, 0, f.w, f.h, Math.max(10, Math.min(13, f.w / 28)));
    f = fit(discCv); if (f) drawDisc(f.c, 8, 6, f.w - 16, f.h - 8, 11);
  }
  const kR = $("kR"), aR = $("aR");
  kR.addEventListener("input", () => { S.playing = false; setK(+kR.value); });
  aR.addEventListener("input", () => { S.p = +aR.value; rebuild(false); clearTimeout(aR._t); aR._t = setTimeout(() => { rebuild(true); saveSoon(); }, 250); });
  $("playBtn").addEventListener("click", ACT.sweep);
  $("resetBtn").addEventListener("click", ACT.reset);
  for (const [id, k] of [["tgDisc", "disc"], ["tgLayers", "layers"], ["tgSurface", "surface"], ["tgFocus", "focus"]]) $(id).addEventListener("click", ACT[k]);
  $("relA").addEventListener("input", () => onRel("A")); $("relB").addEventListener("input", () => onRel("B"));
  const psel = $("presetSel");
  function fillPresets() {
    const cur = S.preset;
    psel.innerHTML = Presets.LIST.map((p) => `<option value="${p.id}">${t("pr." + p.id)}</option>`).join("") + `<option value="custom">${t("custom")}</option>`;
    psel.value = cur;
  }
  psel.addEventListener("change", () => { if (psel.value !== "custom") loadPreset(psel.value); });
  for (const [id, key] of [["k0In", "k0"], ["k1In", "k1"], ["wIn", "W"]]) {
    $(id).addEventListener("change", () => {
      const v = parseNum($(id).value);
      if (!Number.isFinite(v) || (key === "W" && !(v > 0)) || (key === "k0" && !(v < S.k1)) || (key === "k1" && !(v > S.k0))) { $(id).setAttribute("aria-invalid", "true"); return; }
      S[key] = v; edited();
    });
  }
  // la barra della discussione si trascina: ogni punto è un k
  discCv.addEventListener("pointerdown", (e) => { discCv.setPointerCapture(e.pointerId); discCv._d = true; discAt(e); });
  discCv.addEventListener("pointermove", (e) => { if (discCv._d) discAt(e); });
  discCv.addEventListener("pointerup", () => { discCv._d = false; });
  function discAt(e) { const r = discCv.getBoundingClientRect(); S.playing = false; setKSnap(S.k0 + clamp((e.clientX - r.left - 8) / (r.width - 16), 0, 1) * (S.k1 - S.k0), null); }

  let domSig = "";
  function syncDom(light) {
    const kmin = S.k0, kmax = S.k1;
    if (+kR.min !== kmin || +kR.max !== kmax) { kR.min = kmin; kR.max = kmax; kR.step = (kmax - kmin) / 400; }
    if (+kR.value !== S.k) kR.value = S.k;
    $("kL").textContent = fmtNum(S.k, 2);
    const usesA = (R.A && R.A.uses.a) || (R.B && R.B.uses.a);
    $("aCtl").hidden = !usesA; if (usesA) { if (+aR.value !== S.p) aR.value = S.p; $("aL").textContent = fmtNum(S.p, 2); }
    // lettura sul grafico 3D
    const rows = [["k", fmtNum(S.k, 2)]];
    if (R.A && R.B) rows.push([bothEq() ? "n" : "∩", String(slice ? slice.pts.length : 0)]);
    $("readout").innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");
    // lettura sotto il grafico della fetta
    const n = slice ? slice.pts.length : 0, f2 = (v) => fmtNum(v, 2);
    let html = `<b>k = ${f2(S.k)}</b>`;
    if (R.A && R.B) html += ` · ${countText(n)}` + (n ? ": " + slice.pts.slice(0, 6).map((p) => `(${f2(p[0])} ; ${f2(p[1])})`).join(" ") + (n > 6 ? " …" : "") : "");
    else if (R.A && R.A.kind === "ineq") html += ` · ${t("slice.region")}`; else html += ` · ${t("slice.one")}`;
    $("sliceInfo").innerHTML = html;
    $("playLbl").textContent = t(S.playing ? "pause" : "sweep");
    $("playIcon").innerHTML = kit.icon(S.playing ? "pause" : "play");
    if (!light) {
      $("k0In").value = fmtNum(S.k0, 2).replace(/[,.]?0+$/, ""); $("k1In").value = fmtNum(S.k1, 2).replace(/[,.]?0+$/, ""); $("wIn").value = fmtNum(S.W, 2).replace(/[,.]?0+$/, "");
      for (const id of ["k0In", "k1In", "wIn"]) $(id).setAttribute("aria-invalid", "false");
      fillPresets();
      $("question").textContent = Presets.byId(S.preset) ? t("pq." + S.preset) : "";
      const ch = $("crits"), cr = dis && R.B ? dis.crit : [];
      ch.innerHTML = cr.length ? cr.map((c, i) => `<button type="button" class="lg on" data-i="${i}" title="${t(c.tangent ? "crit.tangent" : "crit.edge")}"><i class="sw"></i>k = ${f2(c.k)}${c.tangent ? "" : " ≈"}</button>`).join("") : "";
      ch.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { S.playing = false; setK(cr[+b.dataset.i].k); }));
      for (const [id, k] of [["tgDisc", "disc"], ["tgLayers", "layers"], ["tgSurface", "surface"], ["tgFocus", "focus"]]) $(id).setAttribute("aria-pressed", String(S[k]));
      $("tgDisc").hidden = !R.B;
      saveSoon();
    }
    drawDomSoon();
  }
  let domQ = false;
  function drawDomSoon() { if (!domQ) { domQ = true; requestAnimationFrame(() => { domQ = false; drawDom(); }); } }
  onLang(() => { syncDom(); syncXrButtons(); pSig = ""; buildFrame(); });
  onTheme((dark) => { if (!ui.xr) applyPalette(dark ? "dark" : "light"); drawDomSoon(); });
  if (document.fonts && document.fonts.load) document.fonts.load(pfont(30)).then(() => { labels.forEach((l) => l.redraw()); pSig = ""; drawDomSoon(); }).catch(() => {});

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fn) { try { return fn(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error("Error in " + name + ":", err); note.textContent = "Error in " + name + ": " + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    if (presenting) { scene.updateMatrixWorld(true); safe("input", () => xrInput(now, dt)); }
    if (S.playing) { setK(S.k + ((S.k1 - S.k0) / 8) * dt, true); if (S.k >= S.k1) setPlaying(false); }
    if (presenting) safe("panel", () => { const sg = panelSig(); if (sg !== pSig && (frameN % 3 === 0 || pSig === "")) { pSig = sg; drawPanel(); } });
    renderer.render(scene, camera);
  });

  // ---------- avvio ----------
  applyPalette(palName);
  buildFrame();
  const init = readQuery(location.hash) || readQuery("#" + (store.get("state") || ""));
  if (init) applyState(init); else loadPreset("linecircle");
  window.addEventListener("hashchange", () => { const st = readQuery(location.hash); if (st) applyState(st); }); // un link incollato nella stessa scheda
  camPlace(); resize(); drawDom();
  window.__app = { THREE, scene, camera, renderer, stage, S, R, ui, SRC, ACT, panel, items, ctrls, grips, hands, xrInput, setK, placeFromHead, drawPanel, rayPanel, tipPanel, itemAt, Engine, get sc() { return sc; }, get dis() { return dis; }, get slice() { return slice; }, get chain() { return chain; }, loadPreset, applyState, rebuild };
  return { reset: () => loadPreset(Presets.byId(S.preset) ? S.preset : "linecircle"), share, url: shareUrl, discText };
}
