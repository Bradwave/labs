// Fourier Lab XR · app.js
// Scena Three.js, ingressi WebXR (mani e controller), pannello flottante, interazione da schermo.
// La matematica è in fourier.js (pura, testata in Node); qui c'è la presentazione.
// Riferimento: `stage` (il "palco") contiene asse f, piano di avvolgimento, segnale avvolto, centro di massa e traccia, in unità di prototipo
// (1 unità = `stage.scale` metri). X = f, Y = Im, Z = Re. L'utente può spostarlo e scalarlo (cubo alla base); l'interazione lavora in coordinate del palco,
// quindi spostare o scalare non cambia il significato di f.
/* global THREE, Fourier, Grab, RadioAudio */

export function startApp(kit) {
  const { t, onLang, onTheme, isDark, toast, fmtNum, store } = kit;
  const F = Fourier;
  const { TAU, FMAX, DF, NF, NS } = F;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MONITOR = /[?&]monitor=1/.test(location.search);
  const KX = 0.62;                 // unità del palco per Hz lungo l'asse f
  const S0 = 0.28;                 // scala iniziale del palco in realtà mista (m per unità): l'asse è lungo ~1,0 m
  const NW = 200;                  // segmenti del segnale avvolto
  const BASE_X = -0.38;            // posizione (palco) del cubo-base
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- palette: token del laboratorio + colori della fisica (DESIGN.md §3) ----------
  const PAL = {
    light: { scene: "#FCF7EE", card: "#FCF7EE", ink: "#2B1A0A", muted: "#7A6652", accent: "#E8681F", onaccent: "#2B1A0A", tile2: "#FFD23F",
      sig: "#2350D8", com: "#E8681F", re: "#0F9A63", im: "#6E3FE0", grid: "#C9B79B", base: "#7A6652", ok: "#0F9A63" },
    dark: { scene: "#22160A", card: "#33220F", ink: "#FBEBD3", muted: "#B9A58C", accent: "#FF8A4D", onaccent: "#22160A", tile2: "#E9B92A",
      sig: "#86A6FF", com: "#FF8A4D", re: "#3DDC97", im: "#B59CFF", grid: "#5A4328", base: "#B9A58C", ok: "#3DDC97" },
  };
  let palName = isDark() ? "dark" : "light";
  let C = PAL[palName];

  // ---------- modello e stato ----------
  const M = new F.Model();
  const S = { f: 0, playing: false, speed: 1, ghost: false, plane: true, ring: true, preset: "one", input: "direct", wind: 0, u: 0, sound: "off", page: 0,
    adv: Object.assign({ walk: false, phase: false, shadows: false, epi: false, plot: "signal" }, store.getJSON("adv", {})) };
  const saveAdv = () => store.setJSON("adv", S.adv);
  const RD = { x: -1.15, y: 0.1, z: 0, r: 0.5 };   // radio: centro della faccia (palco), raggio; la faccia guarda l'utente (+z), la manopola gira attorno a z
  const KNOB_Z = 0.09;                              // altezza della manopola sulla faccia
  const SOUNDS = ["off", "sum", "mixer", "probe"], PLOTS = ["signal", "product", "scatter"];
  let audio = null, magNow = 0;
  const RX0 = 0.2, SX = 0.9, ZR = -2.2, WIND_T = 1.6; // corda del segnale: guida del tempo (x = RX0 + t·SX, dietro l'asse a z = ZR), durata dell'avvolgimento (s)
  const wheel = new F.Wheel();
  const WX = -1.0, WR = 0.42; // ruota: centro sull'asse a x = WX (palco), raggio WR; stesso verso di rotazione della manopola
  const ui = { xr: null, placed: false };

  // ---------- THREE ----------
  const view = $("view");
  const renderer = new THREE.WebGLRenderer({ canvas: $("cv"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.xr.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.02, 60);
  scene.add(camera);
  const floor = new THREE.GridHelper(8, 16, 0x888888, 0x888888);
  floor.material = new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.6 });
  floor.visible = false;
  scene.add(floor);

  const roleMats = [];
  function mat(role, extra) { // MeshBasicMaterial che segue la palette
    const m = new THREE.MeshBasicMaterial(Object.assign({ color: C[role] }, extra || {}));
    m.userData.role = role; roleMats.push(m); return m;
  }

  const stage = new THREE.Group();
  stage.userData.grab = { scalable: true, min: 0.1, max: 1.0 };
  scene.add(stage);
  stage.scale.setScalar(S0);
  stage.position.set(-0.5, 1.2, -0.9);

  // ---------- segmenti istanziati: linee spesse che si vedono bene nel visore ----------
  const segGeo = new THREE.CylinderBufferGeometry(1, 1, 1, 6, 1, false);
  const _o = new THREE.Object3D(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function SegMesh(n, material) {
    const m = new THREE.InstancedMesh(segGeo, material, n);
    m.frustumCulled = false; m.count = 0; stage.add(m); return m;
  }
  function setSeg(m, i, ax, ay, az, bx, by, bz, r) {
    _d.set(bx - ax, by - ay, bz - az);
    const L = _d.length();
    if (L < 1e-7) _o.scale.set(0, 0, 0);
    else { _o.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); _o.quaternion.setFromUnitVectors(_y, _d.multiplyScalar(1 / L)); _o.scale.set(r, L, r); }
    _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);
  }

  // ---------- etichette (sprite con testo) ----------
  const labels = [];
  const FONT = '700 {n}px "Space Mono", monospace';
  function Label(text, w, o) {
    o = o || {};
    this.text = text; this.o = o;
    this.cv = document.createElement("canvas"); this.cv.width = 256; this.cv.height = 96;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.sprite.scale.set(w, w * 96 / 256, 1);
    this.sprite.renderOrder = 5;
    (o.parent || stage).add(this.sprite);
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

  // ---------- il palco ----------
  // asse delle frequenze con freccia e tacche
  const AX_END = FMAX * KX + 0.3;
  const axisM = SegMesh(1, mat("ink"));
  setSeg(axisM, 0, -0.2, 0, 0, AX_END, 0, 0, 0.012); axisM.count = 1; axisM.instanceMatrix.needsUpdate = true;
  const axisHead = new THREE.Mesh(new THREE.ConeBufferGeometry(0.045, 0.14, 12), mat("ink"));
  axisHead.rotation.z = -Math.PI / 2; axisHead.position.set(AX_END + 0.05, 0, 0); stage.add(axisHead);
  const ticks = [];
  for (let h = 0; h <= FMAX; h++) ticks.push(new Label(String(h), 0.3, { size: 64, role: "ink" }));
  ticks.forEach((l, h) => l.sprite.position.set(h * KX, -0.17, 0));
  const fLabel = new Label("f (Hz)", 0.5, { size: 56 }); fLabel.sprite.position.set(AX_END + 0.05, 0.17, 0);
  const tickM = SegMesh(FMAX + 1, mat("ink"));
  for (let h = 0; h <= FMAX; h++) setSeg(tickM, h, h * KX, -0.045, 0, h * KX, 0.045, 0, 0.008);
  tickM.count = FMAX + 1; tickM.instanceMatrix.needsUpdate = true;

  // piano di avvolgimento a x = f·KX (scalato nel raggio R)
  const planeG = new THREE.Group(); stage.add(planeG);
  const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), mat("ink", { transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
  quad.rotation.y = Math.PI / 2; planeG.add(quad);
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[0, -1, -1], [0, 1, -1], [0, 1, 1], [0, -1, 1]].map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.55 }));
  const cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0]].map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.4 }));
  planeG.add(edge, cross);
  const reL = new Label("Re", 0.36, { size: 64, role: "re" }), imL = new Label("Im", 0.36, { size: 64, role: "im" });

  // manopola: anello di raggio R attorno all'asse con una perlina (un giro orario = 1 Hz)
  const ringM = new THREE.Mesh(new THREE.TorusBufferGeometry(1, 0.018, 8, 72), mat("base"));
  ringM.rotation.y = Math.PI / 2; const ringG = new THREE.Group(); ringG.add(ringM); stage.add(ringG);
  const bead = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 12), mat("tile2")); bead.scale.setScalar(0.085);
  const beadOut = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 12), mat("ink", { side: THREE.BackSide })); beadOut.scale.setScalar(1.2); bead.add(beadOut);
  stage.add(bead);

  // maniglia sull'asse (giallo, con contorno) e cubo-base per spostare la scena
  const handle = new THREE.Group();
  handle.add(new THREE.Mesh(new THREE.BoxBufferGeometry(0.16, 0.12, 0.12), mat("tile2")));
  const hOut = new THREE.Mesh(new THREE.BoxBufferGeometry(0.16, 0.12, 0.12), mat("ink", { side: THREE.BackSide })); hOut.scale.setScalar(1.14); handle.add(hOut);
  stage.add(handle);
  const baseBox = new THREE.Group();
  baseBox.add(new THREE.Mesh(new THREE.BoxBufferGeometry(0.12, 0.12, 0.12), mat("base")));
  const bOut = new THREE.Mesh(new THREE.BoxBufferGeometry(0.12, 0.12, 0.12), mat("ink", { side: THREE.BackSide })); bOut.scale.setScalar(1.14); baseBox.add(bOut);
  baseBox.position.set(BASE_X, 0, 0); stage.add(baseBox);

  // ruota (volano): disco nel piano Re–Im a sinistra dell'asse; si lancia in senso orario, f = κ · giri/s
  const wheelG = new THREE.Group(); wheelG.position.set(WX, 0, 0); wheelG.visible = false; stage.add(wheelG);
  const wRim = new THREE.Mesh(new THREE.TorusBufferGeometry(WR, 0.035, 8, 56), mat("tile2")); wRim.rotation.y = Math.PI / 2; wheelG.add(wRim);
  const wHub = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.07, 0.07, 0.07, 14), mat("base")); wHub.rotation.z = Math.PI / 2; wheelG.add(wHub);
  const wSpin = new THREE.Group(); wheelG.add(wSpin);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, sp = new THREE.Mesh(new THREE.BoxBufferGeometry(0.03, 0.03, WR), mat(i === 0 ? "com" : "base"));
    sp.position.set(0, -Math.sin(a) * WR / 2, Math.cos(a) * WR / 2); sp.rotation.x = a; wSpin.add(sp);
  }
  const wMark = new THREE.Mesh(new THREE.SphereBufferGeometry(0.07, 12, 10), mat("com")); wMark.position.set(0, 0, WR); wSpin.add(wMark);

  // radio: una faccia con la scala 0–6 Hz e una manopola di sintonia (270°, 8 Hz per giro); sotto, il misuratore |c| e l'oscillatore di riferimento
  const radioG = new THREE.Group(); radioG.position.set(RD.x, RD.y, RD.z); radioG.visible = false; stage.add(radioG);
  const plate = new THREE.Mesh(new THREE.CylinderBufferGeometry(RD.r, RD.r, 0.06, 48), mat("base")); plate.rotation.x = Math.PI / 2; radioG.add(plate);
  const plateRim = new THREE.Mesh(new THREE.TorusBufferGeometry(RD.r, 0.016, 8, 56), mat("ink")); plateRim.position.z = 0.03; radioG.add(plateRim);
  for (let i = 0; i <= 12; i++) {
    const major = i % 2 === 0, phi = F.dialPhi(i * 0.5), r0 = RD.r - (major ? 0.07 : 0.04);
    const tk = new THREE.Mesh(new THREE.BoxBufferGeometry(major ? 0.028 : 0.018, major ? 0.1 : 0.06, 0.02), mat("ink"));
    tk.position.set(r0 * Math.sin(phi), r0 * Math.cos(phi), 0.04); tk.rotation.z = -phi; radioG.add(tk);
    if (major) { const l = new Label(String(i / 2), 0.3, { size: 64, parent: radioG }); l.sprite.position.set((RD.r + 0.14) * Math.sin(phi), (RD.r + 0.14) * Math.cos(phi), 0.05); }
  }
  const dialRot = new THREE.Group(); radioG.add(dialRot);                // gira con f
  const needle = new THREE.Mesh(new THREE.BoxBufferGeometry(0.03, RD.r * 0.85, 0.02), mat("com")); needle.position.set(0, RD.r * 0.42, 0.045); dialRot.add(needle);
  const knob = new THREE.Group(); knob.position.z = KNOB_Z; radioG.add(knob);
  const knobBody = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.24, 0.26, 0.12, 28), mat("tile2")); knobBody.rotation.x = Math.PI / 2; knob.add(knobBody);
  const knobOut = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.24, 0.26, 0.12, 28), mat("ink", { side: THREE.BackSide })); knobOut.rotation.x = Math.PI / 2; knobOut.scale.set(1.1, 1, 1.1); knob.add(knobOut);
  const knobMark = new THREE.Mesh(new THREE.BoxBufferGeometry(0.05, 0.17, 0.02), mat("ink")); knobMark.position.set(0, 0.1, 0.07); dialRot.add(knobMark); knobMark.position.z = KNOB_Z + 0.07;
  const sMeter = new THREE.Mesh(new THREE.BoxBufferGeometry(0.98, 0.15, 0.02), mat("base")); sMeter.position.set(0, -0.9, 0.03); radioG.add(sMeter);
  const sFill = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 0.09, 0.03), mat("com")); sFill.position.set(-0.45, -0.9, 0.045); radioG.add(sFill);
  const sLabel = new Label("|c|", 0.3, { size: 60, parent: radioG }); sLabel.sprite.position.set(-0.68, -0.9, 0.05);
  const sndLabel = new Label("", 0.9, { size: 56, role: "com", parent: radioG }); sndLabel.sprite.position.set(0, -0.64, 0.06);
  const refRot = new THREE.Group(); refRot.position.set(0, -1.3, 0.03); radioG.add(refRot);   // oscillatore di riferimento: ruota in senso orario a f
  const refRing = new THREE.Mesh(new THREE.TorusBufferGeometry(0.19, 0.014, 8, 40), mat("ink")); refRing.position.set(0, -1.3, 0.03); radioG.add(refRing);
  const refArm = new THREE.Mesh(new THREE.BoxBufferGeometry(0.03, 0.18, 0.02), mat("com")); refArm.position.y = 0.09; refRot.add(refArm);
  const refTip = new THREE.Mesh(new THREE.SphereBufferGeometry(0.045, 10, 8), mat("com")); refTip.position.y = 0.18; refRot.add(refTip);
  const refLabel = new Label("f osc", 0.5, { size: 52, parent: radioG }); refLabel.sprite.position.set(0, -1.62, 0.05);
  let refT = 0;

  // segnale avvolto (sfumato: più chiaro = più tardi), centro di massa c e vettore c
  // guida del tempo: la funzione g(t) appesa come una corda, con t in secondi; l'avvolgimento la porta nel piano
  const railM = SegMesh(6, mat("muted"));
  setSeg(railM, 0, RX0 - 0.1, 0, ZR, RX0 + F.T * SX + 0.1, 0, ZR, 0.008);
  for (let h = 0; h <= F.T; h++) setSeg(railM, h + 1, RX0 + h * SX, -0.04, ZR, RX0 + h * SX, 0.04, ZR, 0.007);
  railM.count = 6; railM.instanceMatrix.needsUpdate = true;
  const railLabels = [];
  for (let h = 0; h <= F.T; h++) { const l = new Label(String(h), 0.26, { size: 60, role: "muted" }); l.sprite.position.set(RX0 + h * SX, -0.17, ZR); railLabels.push(l); }
  const tLabel = new Label("t (s)", 0.45, { size: 56, role: "sig" }); tLabel.sprite.position.set(RX0 + F.T * SX + 0.32, 0.17, ZR); railLabels.push(tLabel);
  const tBeads = [];
  for (let h = 0; h <= F.T; h++) { const b = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 12, 10), mat("tile2")); b.scale.setScalar(0.055); stage.add(b); tBeads.push(b); }
  const woundM = SegMesh(NW, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const woundCol = new THREE.Color(), woundDim = new THREE.Color();
  function paintWound() {
    woundM.count = NW; // setColorAt dimensiona il buffer su count (r128): con count = 0 il colore resta vuoto e la corda è nera
    woundDim.set(C.sig).multiplyScalar(0.3);
    for (let i = 0; i < NW - 1; i++) { woundCol.copy(woundDim).lerp(new THREE.Color(C.sig), 0.15 + 0.85 * (i / (NW - 2))); woundM.setColorAt(i, woundCol); }
    woundM.instanceColor.needsUpdate = true;
  }
  const cVec = SegMesh(1, mat("com"));
  const cDot = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 18, 14), mat("com")); cDot.scale.setScalar(0.1);
  const cOut = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 18, 14), mat("ink", { side: THREE.BackSide })); cOut.scale.setScalar(1.18); cDot.add(cOut);
  stage.add(cDot);
  // punta della traccia: il punto c(f) sulla trasformata, nello spazio (f, Re, Im); segue f e parte dall'asse con un vettore
  const tipVec = SegMesh(1, mat("com"));
  const tipDot = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 18, 14), mat("com")); tipDot.scale.setScalar(0.1);
  const tipOut = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 18, 14), mat("ink", { side: THREE.BackSide })); tipOut.scale.setScalar(1.18); tipDot.add(tipOut);
  stage.add(tipDot);
  const tipLabel = new Label("c(f)", 0.5, { size: 72 });
  const cLabel = new Label("c", 0.42, { size: 80 });

  // traccia (la parte visitata) e curva intera in trasparenza
  const traceM = SegMesh(NF, new THREE.MeshBasicMaterial({ color: 0xffffff }));   // colore per segmento: arancio, o la fase di c (opzione)
  const ghostM = SegMesh(NF, mat("com", { transparent: true, opacity: 0.35, depthWrite: false }));
  const wp = (j) => [j * DF * KX, M.cIm[j], M.cRe[j]];
  function buildGhost() {
    for (let j = 0; j < NF - 1; j++) { const a = wp(j), b = wp(j + 1); setSeg(ghostM, j, a[0], a[1], a[2], b[0], b[1], b[2], 0.012); }
    ghostM.count = NF - 1; ghostM.instanceMatrix.needsUpdate = true;
  }
  // ombre sulle pareti (opzione): la traccia proiettata sul pavimento (Re–f) e sulla parete di fondo (Im–f)
  const SHY = 1.5, SHZ = 1.5;
  const shFloor = SegMesh(NF, mat("re")), shWall = SegMesh(NF, mat("im")), shades = [];
  const shQuadMat = mat("ink", { transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false });
  const shQF = new THREE.Mesh(new THREE.PlaneBufferGeometry(AX_END + 0.5, 2 * SHZ), shQuadMat); shQF.rotation.x = -Math.PI / 2; shQF.position.set(AX_END / 2 - 0.15, -SHY, 0); stage.add(shQF);
  const shQW = new THREE.Mesh(new THREE.PlaneBufferGeometry(AX_END + 0.5, 2 * SHY), shQuadMat); shQW.position.set(AX_END / 2 - 0.15, 0, -SHZ); stage.add(shQW);
  const shLabF = new Label("Re(f)", 0.55, { size: 56, role: "re" }); shLabF.sprite.position.set(AX_END - 0.3, -SHY + 0.12, SHZ - 0.2);
  const shLabW = new Label("Im(f)", 0.55, { size: 56, role: "im" }); shLabW.sprite.position.set(AX_END - 0.3, SHY - 0.12, -SHZ + 0.05);
  shades.push(shFloor, shWall, shQF, shQW, shLabF.sprite, shLabW.sprite);
  const _col = new THREE.Color();
  function buildTrace() {
    traceM.count = NF; // setColorAt dimensiona il buffer su count (r128)
    if (!traceM.instanceColor) traceM.setColorAt(0, _col.set(C.com)); // il buffer dei colori deve esistere già alla prima compilazione dello shader, anche senza segmenti
    let n = 0, m = 0;
    for (let j = 0; j < NF - 1; j++) if (M.visited[j] && M.visited[j + 1]) {
      const a = wp(j), b = wp(j + 1);
      setSeg(traceM, n, a[0], a[1], a[2], b[0], b[1], b[2], 0.02);
      if (S.adv.phase) _col.setHSL(((Math.atan2(M.cIm[j], M.cRe[j]) / TAU) + 1) % 1, 1, palName === "dark" ? 0.58 : 0.42); else _col.set(C.com);
      traceM.setColorAt(n, _col); n++;
      setSeg(shFloor, m, a[0], -SHY, a[2], b[0], -SHY, b[2], 0.012); setSeg(shWall, m, a[0], a[1], -SHZ, b[0], b[1], -SHZ, 0.012); m++;
    }
    traceM.count = n; traceM.instanceMatrix.needsUpdate = true; if (traceM.instanceColor) traceM.instanceColor.needsUpdate = true;
    shFloor.count = shWall.count = m; shFloor.instanceMatrix.needsUpdate = shWall.instanceMatrix.needsUpdate = true;
  }

  // cammino (opzione): l'integrale parziale ∫0^τ g e^{-2πift} dt disegnato come un percorso nel piano di avvolgimento
  const walkM = SegMesh(NW, mat("tile2")), wlk = new Float32Array(2 * NW);
  const walkDot = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 14, 10), mat("tile2")); walkDot.scale.setScalar(0.07); stage.add(walkDot);
  const walkLabel = new Label("I(τ)", 0.4, { size: 64, role: "tile2" });

  // epicicli (opzione): i fasori dei picchi in catena; la parte reale della punta, che scorre, ricostruisce g(t)
  const EPI = { x: -1.45, y: 1.55, z: 0, sc: 0.3, n: 90, dtS: 1 / 30 };
  const epiM = SegMesh(5, mat("com")), epiTrail = SegMesh(EPI.n, mat("sig")), epiDot = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 12, 10), mat("com"));
  epiDot.scale.setScalar(0.05); stage.add(epiDot);
  const epiLabel = new Label("Σ A cos", 0.7, { size: 56, role: "muted" }); epiLabel.sprite.position.set(EPI.x, EPI.y - 0.62, EPI.z);
  let phs = [], epiT = 0, epiAcc = 0; const epiHist = new Float32Array(EPI.n);

  // ---------- aggiornamento della scena ----------
  const wbuf = new Float32Array(3 * NW);
  let Rcur = M.R, dirty = true;
  function updateStage() {
    const fx = S.f * KX;
    const R = Rcur;
    planeG.position.x = fx; planeG.scale.set(1, R, R); planeG.visible = S.plane;
    ringG.position.x = fx; ringG.scale.setScalar(R); ringG.visible = S.ring; bead.visible = S.ring;
    const psi = TAU * S.f;
    bead.position.set(fx, -R * Math.sin(psi), R * Math.cos(psi));
    handle.position.set(fx, 0, 0);
    reL.sprite.position.set(fx, 0, R + 0.17); reL.sprite.visible = S.plane;
    imL.sprite.position.set(fx, R + 0.17, 0); imL.sprite.visible = S.plane;
    // la corda g(t): a u = 0 è il grafico appeso alla guida; girando f si attorciglia (θ = 2π f t); a u = 1 è la curva avvolta nel piano
    const e = S.u * S.u * (3 - 2 * S.u), al = -(Math.PI / 2) * (1 - e);
    const rope = (k, o) => {
      const th = TAU * S.f * M.tk[k] + al, gk = M.g[k];
      o[0] = (RX0 + M.tk[k] * SX) * (1 - e) + fx * e; o[1] = -gk * Math.sin(th); o[2] = ZR * (1 - e) + gk * Math.cos(th);
    };
    let pa = [0, 0, 0], pb = [0, 0, 0];
    rope(0, pa);
    for (let i = 1; i < NW; i++) { rope(Math.min(NS - 1, Math.floor(i * NS / NW)), pb); setSeg(woundM, i - 1, pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], 0.016); pa = pb.slice(); }
    woundM.count = NW - 1; woundM.instanceMatrix.needsUpdate = true;
    tBeads.forEach((b, h) => { rope(Math.min(NS - 1, Math.floor(h / F.T * NS)), pb); b.position.set(pb[0], pb[1], pb[2]); });
    const rail = S.u < 0.98; railM.visible = rail; railLabels.forEach((l) => (l.sprite.visible = S.u < 0.5));
    // il centro di massa è il baricentro della corda, sempre visibile: sulla guida è sfalsato dall'asse del tempo di c(f) ruotato di α,
    // e scivola con la corda nel piano, dove coincide con c(f); la traccia (la trasformata) e la curva intera si vedono sempre
    const c = M.com(S.f), ca = Math.cos(al), sa = Math.sin(al);
    const cx = (RX0 + F.T / 2 * SX) * (1 - e) + fx * e, cz0 = ZR * (1 - e);
    const cy = c[1] * ca - c[0] * sa, cz = cz0 + c[0] * ca + c[1] * sa;
    traceM.visible = true; ghostM.visible = S.ghost;
    cDot.position.set(cx, cy, cz);
    setSeg(cVec, 0, cx, 0, cz0, cx, cy, cz, 0.014); cVec.count = 1; cVec.instanceMatrix.needsUpdate = true;
    cLabel.sprite.position.set(cx, cy + 0.13, cz + 0.05);
    cDot.visible = cVec.visible = cLabel.sprite.visible = S.u < 0.95; // quando la corda è nel piano coincide con la punta della traccia
    tipDot.position.set(fx, c[1], c[0]);
    setSeg(tipVec, 0, fx, 0, 0, fx, c[1], c[0], 0.014); tipVec.count = 1; tipVec.instanceMatrix.needsUpdate = true;
    tipLabel.sprite.position.set(fx, c[1] + 0.16, c[0] + 0.08);
    magNow = Math.hypot(c[0], c[1]);
    // opzioni avanzate
    const wk = S.adv.walk; walkM.visible = walkDot.visible = walkLabel.sprite.visible = wk;
    if (wk) {
      const I = M.walk(S.f, wlk, NW), sc = 1.8 * R / (F.T * Math.max(0.2, M.gmax));
      for (let i = 1; i < NW; i++) setSeg(walkM, i - 1, fx, sc * wlk[2 * i - 1], sc * wlk[2 * i - 2], fx, sc * wlk[2 * i + 1], sc * wlk[2 * i], 0.014);
      walkM.count = NW - 1; walkM.instanceMatrix.needsUpdate = true;
      walkDot.position.set(fx, sc * I[1], sc * I[0]); walkLabel.sprite.position.set(fx, sc * I[1] + 0.15, sc * I[0] + 0.1);
    }
    shades.forEach((o) => (o.visible = S.adv.shadows));
    // radio: indice, misuratore e oscillatore di riferimento
    dialRot.rotation.z = -F.dialPhi(S.f);
    const sw = clamp(magNow / Math.max(0.05, M.cMaxAll), 0, 1) * 0.9; sFill.scale.x = Math.max(0.001, sw); sFill.position.x = -0.45 + sw / 2;
    dirty = false;
  }

  // ---------- epicicli: catena di fasori + traccia della parte reale che scorre ----------
  function updateEpi(dt) {
    const on = S.adv.epi; epiM.visible = epiTrail.visible = epiDot.visible = epiLabel.sprite.visible = on;
    if (!on) return;
    epiT += dt * 0.35; epiAcc += dt;
    let x = EPI.x, y = EPI.y, i = 0;
    for (const p of phs) {
      const a = TAU * (p.f < 0.05 ? 0 : p.f) * epiT + p.phi, r = p.A * EPI.sc;
      const nx = x - r * Math.sin(a), ny = y + r * Math.cos(a);   // (−Im, Re): ruota in senso antiorario, la parte reale è in verticale
      setSeg(epiM, i++, x, y, EPI.z, nx, ny, EPI.z, 0.012); x = nx; y = ny;
    }
    epiM.count = i; epiM.instanceMatrix.needsUpdate = true; epiDot.position.set(x, y, EPI.z);
    while (epiAcc >= EPI.dtS) { epiAcc -= EPI.dtS; epiHist.copyWithin(1, 0, EPI.n - 1); epiHist[0] = y; }
    epiHist[0] = y;
    for (let k = 0; k < EPI.n - 1; k++) setSeg(epiTrail, k, x + k * 0.012, epiHist[k], EPI.z, x + (k + 1) * 0.012, epiHist[k + 1], EPI.z, 0.009);
    epiTrail.count = EPI.n - 1; epiTrail.instanceMatrix.needsUpdate = true;
  }

  // ---------- azioni (le stesse da schermo, dal pannello e da tastiera) ----------
  function setF(v) {
    v = clamp(v, 0, FMAX);
    if (v === S.f) return;
    M.markVisited(S.f, v); S.f = v; dirty = true; traceDirty = true; syncDom();
  }
  let traceDirty = true;
  function setPlaying(p) { if (p && S.input === "wheel") setInput("direct"); S.playing = p; if (p && S.f >= FMAX - 1e-6) { S.f = 0; dirty = true; } syncDom(); }
  function resetAll(full) {
    S.f = 0; M.visited.fill(0); S.playing = false; wheel.w = 0; dirty = traceDirty = true;
    if (full) { setInput("direct"); S.wind = 0; S.u = 0; }
    if (full) { S.ghost = false; S.plane = true; S.ring = true; applyPreset("one"); }
    syncDom();
  }
  function applyPreset(key) {
    S.preset = key; M.setPreset(key); buildGhost(); phs = M.phasors(4); if (audio && audio.ready) audio.setSignal(); S.f = 0; S.playing = false; wheel.w = 0; dirty = traceDirty = true; syncDom();
  }
  function cyclePreset() { const o = F.PRESET_ORDER; applyPreset(o[(o.indexOf(S.preset) + 1) % o.length]); }
  const toggle = (k) => () => { S[k] = !S[k]; dirty = true; syncDom(); };
  function csv() {
    const it = document.documentElement.lang === "it", sep = it ? ";" : ",", n = (x) => (it ? x.toFixed(5).replace(".", ",") : x.toFixed(5));
    const rows = [["f_Hz", "Re_c", "Im_c", "abs_c"].join(sep)];
    for (let j = 0; j < NF; j++) rows.push([n(j * DF), n(M.cRe[j]), n(M.cIm[j]), n(M.cMag[j])].join(sep));
    try { navigator.clipboard.writeText(rows.join("\n")).then(() => toast(t("csv.ok")), () => toast(t("csv.fail"))); } catch (e) { toast(t("csv.fail")); }
  }
  function setInput(m) {
    S.input = m; S.playing = false; wheel.held = false; wheel.w = m === "wheel" ? clamp(S.f / wheel.kappa, 0, wheel.wmax()) : 0;
    wheelG.visible = m === "wheel"; radioG.visible = m === "radio"; dirty = true;
    if (m === "radio" && S.sound === "off") setSound("sum"); // la radio si ascolta: i battimenti sono il modo più semplice
    syncDom();
  }
  // suono: il contesto audio parte solo dopo un gesto (un clic, o l'avvio della sessione)
  function ensureAudio() {
    if (!audio) audio = new RadioAudio.Engine({ K: F.AUDIO_K, T: F.T, sampler: (n) => M.signalSamples(n) });
    return audio.start();
  }
  function setSound(m) {
    if (m !== "off" && !ensureAudio()) { toast(t("snd.fail")); m = "off"; }
    S.sound = m; syncDom();
  }
  const cycleSound = () => setSound(SOUNDS[(SOUNDS.indexOf(S.sound) + 1) % SOUNDS.length]);
  const cycleInput = () => setInput(S.input === "direct" ? "wheel" : S.input === "wheel" ? "radio" : "direct");
  const advToggle = (k) => () => { S.adv[k] = !S.adv[k]; saveAdv(); dirty = true; if (k === "phase") traceDirty = true; syncDom(); };
  const cyclePlot = () => { S.adv.plot = PLOTS[(PLOTS.indexOf(S.adv.plot) + 1) % PLOTS.length]; saveAdv(); syncDom(); };
  const KAPPAS = [1, 2, 4, 8];
  function cycleKappa() { wheel.setKappa(KAPPAS[(KAPPAS.indexOf(wheel.kappa) + 1) % KAPPAS.length], S.f); syncDom(); }
  const ACT = { wind: () => { S.wind = S.wind ? 0 : 1; syncDom(); }, sweep: () => (S.input === "wheel" ? wheel.brake() : setPlaying(!S.playing)), input: cycleInput, aux: () => (S.input === "wheel" ? cycleKappa() : cycleSound()), sound: cycleSound, more: () => { S.page = 1; pSig = ""; }, back: () => { S.page = 0; pSig = ""; }, walk: advToggle("walk"), phase: advToggle("phase"), shadows: advToggle("shadows"), epi: advToggle("epi"), plot: cyclePlot, kappa: cycleKappa, reset: () => resetAll(false), preset: cyclePreset, ghost: toggle("ghost"), plane: toggle("plane"), ring: toggle("ring"), recenter: () => placeFromHead() };

  // ---------- pannello flottante (canvas → texture) ----------
  const PW = 1024, PH = 640, PM = 0.7, PMH = PM * PH / PW; // px, px, larghezza e altezza in metri
  const pcv = document.createElement("canvas"); pcv.width = PW; pcv.height = PH;
  const ptex = new THREE.CanvasTexture(pcv); ptex.anisotropy = 4;
  const panel = new THREE.Group(); panel.rotation.order = "YXZ"; panel.visible = false; scene.add(panel);
  const pmesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ map: ptex, transparent: true }));
  const pshadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(PM, PMH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
  pshadow.position.set(0.008, -0.008, -0.004);
  panel.add(pshadow, pmesh);
  // due pagine di pulsanti: la principale e le opzioni avanzate
  const PAGES = [["sweep", "reset", "preset", "wind", "ghost", "input", "aux", "more"], ["walk", "phase", "shadows", "epi", "plot", "sound", "recenter", "back"]];
  const BY = 552, BW = 118, BH = 72;
  const plotBox = { x: 24, y: 262, w: 976, h: 210 };
  const pageItems = PAGES.map((ids) => ids.map((id, i) => ({ id, x: 18 + i * 124, y: BY, w: BW, h: BH })).concat([{ id: "plot-spectrum", ...plotBox }]));
  const itemsNow = () => pageItems[S.page];
  let pSig = "", pHover = null;
  const pfont = (n) => FONT.replace("{n}", n);
  const NUMC = (x, d) => fmtNum(x, d);

  // grafici: gli stessi sul pannello nel visore (k = 1) e nella pagina (k < 1)
  function plotSignal(c, x, y, w, h, k) {
    c.strokeStyle = C.ink; c.lineWidth = 3 * k; c.strokeRect(x, y, w, h);
    c.font = pfont(20 * k); c.textAlign = "left"; c.fillStyle = C.muted; c.fillText(t("x.signal") + "  T = 4 s", x + 8 * k, y + 22 * k);
    const R = M.R, X = (v) => x + v / F.T * w, Y = (v) => y + h / 2 - (v / R) * (h / 2 - 6 * k);
    c.strokeStyle = C.grid; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x, Y(0)); c.lineTo(x + w, Y(0)); c.stroke();
    c.setLineDash([8 * k, 6 * k]); c.strokeStyle = C.muted; c.beginPath();
    for (let i = 0; i <= 160; i++) { const tt = i / 160 * F.T, v = 0.85 * R * Math.cos(TAU * S.f * tt); i ? c.lineTo(X(tt), Y(v)) : c.moveTo(X(tt), Y(v)); }
    c.stroke(); c.setLineDash([]);
    c.strokeStyle = C.sig; c.lineWidth = 4 * k; c.beginPath();
    for (let i = 0; i < NS; i += 3) { const tt = M.tk[i]; i ? c.lineTo(X(tt), Y(M.g[i])) : c.moveTo(X(tt), Y(M.g[i])); }
    c.stroke();
  }
  // il prodotto g(t)·cos(2πft) (parte reale) e −g(t)·sin(2πft) (parte immaginaria): l'area con segno, e la media, è l'integrale
  const pRe = new Float64Array(NS), pIm = new Float64Array(NS);
  function plotProduct(c, x, y, w, h, k) {
    c.strokeStyle = C.ink; c.lineWidth = 3 * k; c.strokeRect(x, y, w, h);
    c.font = pfont(19 * k); c.textAlign = "left"; c.fillStyle = C.muted; c.fillText(t("x.product"), x + 8 * k, y + 22 * k);
    M.products(S.f, pRe, pIm);
    const R = M.R, X = (v) => x + v / F.T * w, Y = (v) => y + h / 2 - (v / R) * (h / 2 - 6 * k), y0 = Y(0);
    const path = (arr) => { c.beginPath(); c.moveTo(X(M.tk[0]), y0); for (let i = 0; i < NS; i += 3) c.lineTo(X(M.tk[i]), Y(arr[i])); c.lineTo(X(M.tk[NS - 1]), y0); c.closePath(); };
    c.save(); c.beginPath(); c.rect(x, y, w, y0 - y); c.clip(); path(pRe); c.globalAlpha = 0.5; c.fillStyle = C.re; c.fill(); c.restore();      // area positiva
    c.save(); c.beginPath(); c.rect(x, y0, w, y + h - y0); c.clip(); path(pRe); c.globalAlpha = 0.5; c.fillStyle = C.muted; c.fill(); c.restore(); // area negativa
    c.strokeStyle = C.grid; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + w, y0); c.stroke();
    for (const [arr, col, lw] of [[pIm, C.im, 2], [pRe, C.re, 3.5]]) { c.strokeStyle = col; c.lineWidth = lw * k; c.beginPath(); for (let i = 0; i < NS; i += 3) { const px = X(M.tk[i]), py = Y(arr[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
    const cc = M.com(S.f); c.setLineDash([8 * k, 6 * k]); c.lineWidth = 3 * k;
    for (const [v, col] of [[cc[0], C.re], [cc[1], C.im]]) { c.strokeStyle = col; c.beginPath(); c.moveTo(x, Y(v)); c.lineTo(x + w, Y(v)); c.stroke(); }
    c.setLineDash([]); c.textAlign = "right"; c.font = pfont(17 * k); c.fillStyle = C.re; c.fillText("⟨g·cos⟩ = Re c", x + w - 8 * k, y + h - 8 * k);
  }
  // g(t) contro cos(2πft): se la frequenza è giusta i punti stanno su una retta di pendenza 2 Re c
  function plotScatter(c, x, y, w, h, k) {
    c.strokeStyle = C.ink; c.lineWidth = 3 * k; c.strokeRect(x, y, w, h);
    c.font = pfont(19 * k); c.textAlign = "left"; c.fillStyle = C.muted; c.fillText(t("x.scatter"), x + 8 * k, y + 22 * k);
    const R = M.R, cx = x + w / 2, cy = y + h / 2, sx = w * 0.42, sy = (h / 2 - 8 * k) / R;
    c.strokeStyle = C.grid; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x + 6 * k, cy); c.lineTo(x + w - 6 * k, cy); c.moveTo(cx, y + 30 * k); c.lineTo(cx, y + h - 6 * k); c.stroke();
    const rc = M.com(S.f)[0];
    c.strokeStyle = C.com; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(cx - sx, cy + 2 * rc * sy); c.lineTo(cx + sx, cy - 2 * rc * sy); c.stroke();
    for (let i = 0; i < NS; i += 5) {
      const u = Math.cos(TAU * S.f * M.tk[i]), px = cx + u * sx, py = cy - M.g[i] * sy, a = 0.25 + 0.75 * (i / NS);
      c.globalAlpha = a; c.fillStyle = C.sig; c.fillRect(px - 2.2 * k, py - 2.2 * k, 4.4 * k, 4.4 * k);
    }
    c.globalAlpha = 1; c.textAlign = "right"; c.font = pfont(17 * k); c.fillStyle = C.com; c.fillText("2 Re c", x + w - 8 * k, y + h - 8 * k);
  }
  const plotLeft = (c, x, y, w, h, k) => (S.adv.plot === "product" ? plotProduct : S.adv.plot === "scatter" ? plotScatter : plotSignal)(c, x, y, w, h, k);
  function plotSpectrum(c, b, k) {
    const yM = Math.max(0.2, M.cMaxAll * 1.2), l = 40 * k, r = 16 * k;
    c.strokeStyle = C.ink; c.lineWidth = 3 * k; c.strokeRect(b.x, b.y, b.w, b.h);
    c.font = pfont(20 * k); c.fillStyle = C.muted; c.textAlign = "left"; c.fillText(`${t("x.spectrum")} · ${t("x.explored")} ${Math.round(M.coverage() * 100)}%`, b.x + 10 * k, b.y + 24 * k);
    const PX = (f) => b.x + l + f / FMAX * (b.w - l - r), PY = (v) => b.y + b.h / 2 - (v / yM) * (b.h / 2 - 10 * k);
    c.strokeStyle = C.grid; c.lineWidth = 2 * k;
    c.beginPath(); c.moveTo(b.x + l, PY(0)); c.lineTo(b.x + b.w - r, PY(0)); c.stroke();
    c.textAlign = "center"; c.fillStyle = C.muted; c.font = pfont(18 * k);
    for (let h = 0; h <= FMAX; h++) { c.beginPath(); c.moveTo(PX(h), b.y + b.h - 8 * k); c.lineTo(PX(h), b.y + b.h - 18 * k); c.stroke(); c.fillText(String(h), PX(h), b.y + b.h - 24 * k); }
    for (const [arr, col, lw] of [[M.cRe, C.re, 4], [M.cIm, C.im, 4], [M.cMag, C.com, 5]]) {
      for (const [dash, alpha] of S.ghost ? [[true, 0.4], [false, 1]] : [[false, 1]]) {
        c.globalAlpha = alpha; c.setLineDash(dash ? [8 * k, 6 * k] : []); c.strokeStyle = col; c.lineWidth = (dash ? 2.5 : lw) * k;
        let open = false; c.beginPath();
        for (let j = 0; j < NF; j++) {
          if (dash || M.visited[j]) { open ? c.lineTo(PX(j * DF), PY(arr[j])) : c.moveTo(PX(j * DF), PY(arr[j])); open = true; } else open = false;
        }
        c.stroke();
      }
    }
    c.globalAlpha = 1; c.setLineDash([]);
    c.strokeStyle = C.ink; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(PX(S.f), b.y + 30 * k); c.lineTo(PX(S.f), b.y + b.h - 4 * k); c.stroke();
  }
  function btnLabel(id) {
    const w = S.input === "wheel";
    switch (id) {
      case "sweep": return t(w ? "x.brake" : S.playing ? "x.pause" : "x.sweep");
      case "preset": return t("preset." + S.preset);
      case "wind": return t(S.wind ? "x.unwind" : "x.wind");
      case "input": return t("in." + S.input);
      case "aux": return w ? "κ ×" + wheel.kappa : "♪ " + t("snd." + S.sound);
      case "sound": return "♪ " + t("snd." + S.sound);
      case "plot": return t("xp." + S.adv.plot);
      default: return t("x." + id);
    }
  }
  const btnOn = (id) => (id === "ghost" && S.ghost) || (id === "wind" && S.wind) || (id === "sweep" && S.playing) || (id === "input" && S.input !== "direct") || (id === "sound" && S.sound !== "off") || (id === "aux" && S.input !== "wheel" && S.sound !== "off") || (S.adv[id] === true);
  function drawPanel() {
    const c = pcv.getContext("2d");
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = C.card; c.fillRect(0, 0, PW, PH);
    c.strokeStyle = C.ink; c.lineWidth = 8; c.strokeRect(4, 4, PW - 8, PH - 8);
    c.textBaseline = "alphabetic";
    c.fillStyle = C.ink; c.textAlign = "left"; c.font = pfont(34); c.fillText(t("x.title") + " XR", 28, 62);
    c.textAlign = "right"; c.font = pfont(46); c.fillStyle = C.accent;
    c.fillText(`f = ${NUMC(S.f, 2)} Hz`, PW - 28, 64);
    plotLeft(c, 24, 100, 470, 140, 1);
    const cc = M.com(S.f), rows = [["Re c", cc[0], C.re], ["Im c", cc[1], C.im], ["|c|", Math.hypot(cc[0], cc[1]), C.com]];
    rows.forEach((r, i) => {
      const y = 132 + i * 44;
      c.fillStyle = r[2]; c.fillRect(530, y - 24, 22, 22); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(530, y - 24, 22, 22);
      c.fillStyle = C.ink; c.textAlign = "left"; c.font = pfont(30); c.fillText(r[0], 566, y);
      c.textAlign = "right"; c.font = pfont(34); c.fillText(NUMC(r[1], 3), 790, y);
    });
    c.textAlign = "left"; c.font = pfont(22); c.fillStyle = C.muted; c.fillText(`${NUMC(S.f * F.T, 2)} ${t("x.turns")}`, 810, 132);
    if (S.input === "wheel") c.fillText(`ω = ${NUMC(wheel.w, 2)} ${t("x.rps")}`, 810, 176);
    else if (S.sound !== "off") c.fillText("♪ " + t("snd." + S.sound), 810, 176);
    plotSpectrum(c, plotBox, 1);
    for (const it of itemsNow()) {
      if (it.id === "plot-spectrum") continue;
      const on = btnOn(it.id);
      const primary = it.id === "sweep" || it.id === "more" || it.id === "back", hov = pHover === it.id, dim = false;
      c.fillStyle = primary || on ? C.accent : C.card; c.fillRect(it.x, it.y, it.w, it.h);
      if (hov) { c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(it.x, it.y, it.w, it.h); }
      c.strokeStyle = C.ink; c.lineWidth = hov ? 7 : 4; c.strokeRect(it.x, it.y, it.w, it.h);
      c.globalAlpha = dim ? 0.45 : 1;
      c.fillStyle = primary || on ? C.onaccent : C.ink; c.textAlign = "center";
      // etichetta su una riga se ci sta, altrimenti su due righe (font più piccolo)
      const lab = btnLabel(it.id); c.font = pfont(20);
      if (c.measureText(lab).width <= it.w - 10) c.fillText(lab, it.x + it.w / 2, it.y + it.h / 2 + 8);
      else {
        const words = lab.split(" "), h = Math.ceil(words.length / 2), l1 = words.slice(0, h).join(" "), l2 = words.slice(h).join(" ");
        c.font = pfont(17); if (Math.max(c.measureText(l1).width, c.measureText(l2).width) > it.w - 8) c.font = pfont(14);
        c.fillText(l1, it.x + it.w / 2, it.y + it.h / 2 - 4, it.w - 8); c.fillText(l2 || "", it.x + it.w / 2, it.y + it.h / 2 + 18, it.w - 8);
      }
      c.globalAlpha = 1;
    }
    if (MONITOR) { c.font = pfont(16); c.fillStyle = C.muted; c.textAlign = "left"; monLines().forEach((l, i) => c.fillText(l, 24 + i * 480, 540)); }
    ptex.needsUpdate = true;
  }
  function panelSig() { return [S.f.toFixed(3), S.playing, S.ghost, S.plane, S.preset, S.input, S.sound, S.page, JSON.stringify(S.adv), S.wind, S.u.toFixed(2), wheel.kappa, wheel.w.toFixed(2), Math.round(M.coverage() * 200), palName, t("x.sweep"), pHover, MONITOR ? Math.floor(performance.now() / 300) : 0].join("|"); }
  function itemAt(u, v) { // u, v ∈ [0,1] sul pannello (v verso l'alto)
    const px = u * PW, py = (1 - v) * PH;
    return itemsNow().find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) || null;
  }
  function plotF(u) { const b = plotBox, px = u * PW; return clamp((px - (b.x + 40)) / (b.w - 56) * FMAX, 0, FMAX); }
  function runItem(it, u) { if (it.id === "plot-spectrum") { S.playing = false; setF(plotF(u)); } else ACT[it.id](); }
  // raggio (controller) contro il pannello; restituisce {u, v, d} o null
  const _rc = new THREE.Raycaster(), _pl = new THREE.Vector3();
  function rayPanel(o, d) {
    if (!panel.visible) return null;
    _rc.set(o, d); _rc.far = 3;
    const h = _rc.intersectObject(pmesh)[0];
    return h && h.uv ? { u: h.uv.x, v: h.uv.y, d: h.distance } : null;
  }
  function tipPanel(p) { // punta del dito: in coordinate del pannello
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
    rayO: new THREE.Vector3(), rayD: new THREE.Vector3(), pinch: false, down: false, prevDown: false, eng: null, off: 0, prevAng: 0, tipZ: 1, raw: "" }));
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.2)]);
  const rays = [0, 1].map(() => new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xfbebd3, transparent: true, opacity: 0.5 })));
  [0, 1].forEach((i) => {
    scene.add(ctrls[i], grips[i], hands[i]); ctrls[i].add(rays[i]); rays[i].visible = false;
    ctrls[i].addEventListener("connected", (e) => { const s = SRC[i]; s.kind = e.data && e.data.hand ? "hand" : "controller"; s.gp = (e.data && e.data.gamepad) || null; s.handed = (e.data && e.data.handedness) || null; });
    ctrls[i].addEventListener("disconnected", () => { const s = SRC[i]; if (s.eng === "wheel") wheel.release(); s.kind = null; s.gp = null; s.eng = null; s.active = false; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6), jointMat = new THREE.MeshBasicMaterial({ color: 0xfbebd3 });
  function readSource(s) {
    s.active = false; s.prevDown = s.down; s.down = false;
    if (s.kind === "hand") {
      const J = hands[s.i].joints || {};
      const th = J["thumb-tip"], ix = J["index-finger-tip"];
      if (!th || !ix || !th.visible || !ix.visible) return;
      for (const k in J) { const jt = J[k]; if (!jt.userData.vis) { const m = new THREE.Mesh(jointGeo, jointMat); jt.add(m); jt.userData.vis = m; } jt.userData.vis.scale.setScalar(jt.jointRadius || 0.008); }
      s.pinch = Grab.pinchUpdate(s.pinch, th.position.distanceTo(ix.position));
      s.tip.copy(ix.position); s.pos.copy(th.position).add(ix.position).multiplyScalar(0.5);
      s.down = s.pinch; s.active = true; s.raw = "hand pinch=" + s.pinch;
    } else if (s.kind === "controller" && s.gp) {
      const b = s.gp.buttons || [];
      const trig = !!(b[GP.TRIG] && b[GP.TRIG].pressed), grip = !!(b[GP.GRIP] && b[GP.GRIP].pressed);
      grips[s.i].getWorldPosition(s.pos); grips[s.i].getWorldQuaternion(s.quat);
      ctrls[s.i].getWorldPosition(s.rayO); s.rayD.set(0, 0, -1).transformDirection(ctrls[s.i].matrixWorld);
      s.tip.copy(s.rayO).addScaledVector(s.rayD, 0.03);
      s.down = trig || grip; s.trig = trig; s.active = grips[s.i].visible !== false;
      s.raw = `ctrl btn[${(b || []).map((x, k) => (x.pressed ? k : "")).filter((x) => x !== "").join(",")}]`;
    }
  }
  function monLines() { return SRC.map((s) => `${s.handed || s.i}: ${s.kind ? s.raw || s.kind : "—"} ${s.eng || ""}`); }
  function buzz(s, k, ms) { const gp = s.gp; if (!gp || s.kind !== "controller") return; try { const a = gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) a.pulse(k, ms); } catch (e) { /* non supportata */ } }

  // bersagli afferrabili, in coordinate del palco → mondo
  const _l = new THREE.Vector3(), _w = new THREE.Vector3();
  function targets() {
    const fx = S.f * KX, psi = TAU * S.f, R = Rcur;
    const list = [["handle", new THREE.Vector3(fx, 0, 0)], ["base", new THREE.Vector3(BASE_X, 0, 0)]];
    if (S.ring) list.push(["bead", new THREE.Vector3(fx, -R * Math.sin(psi), R * Math.cos(psi))]);
    if (S.input === "radio") list.push(["radio", new THREE.Vector3(RD.x, RD.y, RD.z + KNOB_Z)]);
    return list.map(([id, p]) => [id, stage.localToWorld(p)]);
  }
  const reach = () => 0.08 + 0.2 * stage.scale.x;
  function nearest(p) {
    let best = null, bd = reach();
    for (const [id, w] of targets()) { if (S.input !== "direct" && (id === "handle" || id === "bead")) continue; const d = w.distanceTo(p); if (d < bd) { bd = d; best = id; } }
    if (S.input === "wheel") { // bordo della ruota: distanza dalla circonferenza, in metri
      const l = localOf(p), d = Math.hypot(Math.hypot(l.y, l.z) - WR, l.x - WX) * stage.scale.x;
      if (d < bd) best = "wheel";
    }
    return best;
  }
  const localOf = (w) => stage.worldToLocal(_l.copy(w));
  const grab = new Grab.GrabController(THREE, {});
  let near = {};
  function xrInput(now, dt) {
    if (!ui.placed) placeFromHead();
    SRC.forEach(readSource);
    near = {};
    pHover = null;
    for (const s of SRC) {
      rays[s.i].visible = s.active && s.kind === "controller";
      if (!s.active) { s.eng = null; continue; }
      // pannello: raggio (controller) o punta del dito (mani)
      let hit = null;
      if (s.kind === "controller") { const h = rayPanel(s.rayO, s.rayD); if (h) { hit = h; rays[s.i].scale.z = h.d / 1.2; } else rays[s.i].scale.z = 1; }
      else if (s.kind === "hand" && !s.pinch) { const h = tipPanel(s.tip); if (h && h.z > -0.02 && h.z < 0.08) hit = h; }
      const it = hit ? itemAt(hit.u, hit.v) : null;
      if (it) pHover = it.id;
      const rising = s.down && !s.prevDown;
      // clic sul pannello: grilletto del controller con il raggio sul pannello; dito che attraversa il piano
      if (s.kind === "controller" && rising && it) { runItem(it, hit.u); buzz(s, 0.4, 30); if (it.id === "plot-spectrum") s.eng = "plot"; else s.eng = "ui"; }
      if (s.kind === "hand") {
        const z = hit ? hit.z : 1;
        if (it && s.tipZ > 0.025 && z <= 0.015) { runItem(it, hit.u); }
        s.tipZ = hit ? z : 1;
        if (it && it.id === "plot-spectrum" && z < 0.02) { S.playing = false; setF(plotF(hit.u)); }
      }
      if (s.kind === "controller" && s.eng === "plot" && s.down && hit) { S.playing = false; setF(plotF(hit.u)); }
      // afferrare maniglia, perlina o base
      if (rising && !s.eng) {
        const id = nearest(s.pos);
        if (id) {
          s.eng = id; if (id === "handle") { S.playing = false; s.off = localOf(s.pos).x - S.f * KX; }
          if (id === "bead") { S.playing = false; const l = localOf(s.pos); s.prevAng = F.knobAngle(l.z, l.y); }
          if (id === "wheel") { S.playing = false; const l = localOf(s.pos); s.prevAng = F.knobAngle(l.z, l.y); }
          if (id === "radio") { S.playing = false; const l = localOf(s.pos); s.prevAng = F.dialAngle(l.x - RD.x, l.y - RD.y); s.detent = Math.floor(S.f * 4); s.tBuzz = 0; }
          buzz(s, 0.5, 40);
        } else if (SRC.some((o) => o !== s && o.eng === "base")) s.eng = "base"; // la seconda mano scala la scena
      }
      if (!s.down) { if (s.eng === "wheel") wheel.release(); s.eng = null; }
      if (s.eng === "wheel") { const l = localOf(s.pos), a = F.knobAngle(l.z, l.y); if (Math.hypot(l.z, l.y) > 0.05) { wheel.drive(F.crankDelta(s.prevAng, a), dt); s.prevAng = a; } }
      if (s.eng === "radio") { // manopola di sintonia: 8 Hz per giro; scatti ogni 0,25 Hz, e un ronzio proporzionale a |c| (si sente la risonanza)
        const l = localOf(s.pos), dx = l.x - RD.x, dy = l.y - RD.y;
        if (Math.hypot(dx, dy) > 0.04) {
          const a = F.dialAngle(dx, dy); setF(S.f + F.dialTurn(s.prevAng, a) * F.HZ_PER_TURN); s.prevAng = a;
          const d = Math.floor(S.f * 4); if (d !== s.detent) { s.detent = d; buzz(s, 0.15, 10); }
        }
        s.tBuzz -= dt; const m = clamp(magNow / Math.max(0.05, M.cMaxAll), 0, 1);
        if (s.tBuzz <= 0 && m > 0.25) { buzz(s, 0.15 + 0.6 * m, 25); s.tBuzz = 0.07; }
      }
      if (s.eng === "handle") setF((localOf(s.pos).x - s.off) / KX);
      else if (s.eng === "bead") {
        const l = localOf(s.pos), a = F.knobAngle(l.z, l.y);
        if (Math.hypot(l.z, l.y) > 0.05) { setF(S.f + F.crankDelta(s.prevAng, a)); s.prevAng = a; }
      }
      if (!s.eng && !s.down) { const id = nearest(s.pos); if (id) near[id] = true; }
      if (s.eng) near[s.eng] = true;
    }
    grab.update(SRC.map((s) => ({ id: "s" + s.i, active: s.active, pinching: s.eng === "base", pos: s.pos.clone(), quat: s.quat.clone() })), dt, () => stage);
    wRim.scale.setScalar(near.wheel ? 1.25 : 1); knob.scale.setScalar(near.radio ? 1.2 : 1); handle.scale.setScalar(near.handle ? 1.3 : 1); bead.scale.setScalar(near.bead ? 0.11 : 0.085); baseBox.scale.setScalar(near.base ? 1.3 : 1);
  }

  // ---------- posizionamento davanti a chi guarda ----------
  function placeFromHead() {
    const xc = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    const hp = new THREE.Vector3(), hq = new THREE.Quaternion();
    xc.getWorldPosition(hp); xc.getWorldQuaternion(hq);
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(hq); d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    d.normalize();
    const th = Math.atan2(-d.x, -d.z), right = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
    const s = stage.scale.x, hy = Math.max(1.0, hp.y);
    stage.rotation.set(0, th, 0);
    stage.position.copy(hp).addScaledVector(d, 0.95).addScaledVector(right, -FMAX * KX * s / 2); stage.position.y = hy - 0.12;
    panel.rotation.set(-0.6, th, 0);
    panel.position.copy(hp).addScaledVector(d, 0.55); panel.position.y = Math.max(0.55, hy - 0.5);
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
    if (S.sound !== "off") ensureAudio(); // il clic che avvia la sessione è il gesto che sblocca l'audio
    try {
      renderer.xr.setReferenceSpaceType("local-floor");
      const sess = await navigator.xr.requestSession(mode, { optionalFeatures: ["local-floor", "hand-tracking"] });
      xrSession = sess; ui.xr = mode; ui.placed = false;
      sess.addEventListener("end", () => {
        xrSession = null; ui.xr = null; SRC.forEach((s) => (s.eng = null)); panel.visible = false; rays.forEach((r) => (r.visible = false));
        document.body.classList.remove("inxr"); applyPalette(isDark() ? "dark" : "light"); syncXrButtons();
        stage.rotation.set(0, 0, 0); stage.scale.setScalar(S0); stage.position.set(-0.5, 1.2, -0.9); camPlace(); resize();
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
    for (const l of [edge, cross]) l.material.color.set(C.ink);
    floor.material.color.set(C.grid);
    const vr = ui.xr === "immersive-vr", ar = ui.xr === "immersive-ar";
    scene.background = ar ? null : new THREE.Color(C.scene);
    floor.visible = vr;
    labels.forEach((l) => l.redraw()); paintWound(); traceDirty = true; pSig = ""; dSig = "";
  }

  // ---------- schermo: camera orbitale, trascinamento della maniglia, tastiera ----------
  const cam = { yaw: 0.5, pitch: 0.28, dist: 1.9 };
  const target = new THREE.Vector3();
  function camPlace() {
    stage.updateMatrixWorld(true);
    stage.localToWorld(target.set(1.25, 0.2, ZR / 2));
    camera.position.set(target.x + cam.dist * Math.sin(cam.yaw) * Math.cos(cam.pitch), target.y + cam.dist * Math.sin(cam.pitch), target.z + cam.dist * Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(target);
  }
  function resize() {
    if (renderer.xr.isPresenting) return;
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!cam.zoomed) { // inquadra tutto il palco (radio a sinistra, asse f, guida del tempo dietro) in qualunque finestra
      const th = Math.tan(camera.fov * Math.PI / 360), sc = stage.scale.x;
      cam.dist = clamp(1.25 * Math.max(3.1 * sc / (th * camera.aspect), 2.0 * sc / th), 0.8, 6); camPlace();
    }
  }
  new ResizeObserver(resize).observe(view);
  const cv = $("cv");
  const drag = { mode: null, id: null, x: 0, y: 0 };
  const pts = new Map(); let pinch0 = 0;
  const _ndc = new THREE.Vector2(), _rr = new THREE.Raycaster(), _p = new THREE.Vector3();
  function screenRay(e) {
    const r = cv.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _rr.setFromCamera(_ndc, camera); return _rr.ray;
  }
  function wheelPoint(e) { // il raggio dello schermo contro il piano della ruota → coordinate del palco
    const ray = screenRay(e), O = stage.localToWorld(new THREE.Vector3(WX, 0, 0)), N = stage.localToWorld(new THREE.Vector3(WX + 1, 0, 0)).sub(O).normalize();
    const den = ray.direction.dot(N); if (Math.abs(den) < 1e-6) return null;
    const tt = O.clone().sub(ray.origin).dot(N) / den; if (tt < 0) return null;
    return stage.worldToLocal(ray.origin.clone().addScaledVector(ray.direction, tt));
  }
  function dialPoint(e) { // il raggio dello schermo contro il piano della faccia della radio → coordinate del palco
    const ray = screenRay(e), O = stage.localToWorld(new THREE.Vector3(RD.x, RD.y, RD.z + KNOB_Z)), N = stage.localToWorld(new THREE.Vector3(RD.x, RD.y, RD.z + KNOB_Z + 1)).sub(O).normalize();
    const den = ray.direction.dot(N); if (Math.abs(den) < 1e-6) return null;
    const tt = O.clone().sub(ray.origin).dot(N) / den; if (tt < 0) return null;
    return stage.worldToLocal(ray.origin.clone().addScaledVector(ray.direction, tt));
  }
  function axisParam(ray) { // punto dell'asse f più vicino al raggio → f (Hz)
    const O = stage.localToWorld(new THREE.Vector3(0, 0, 0)), D = stage.localToWorld(new THREE.Vector3(1, 0, 0)).sub(O);
    const w0 = O.clone().sub(ray.origin), a = D.dot(D), b = D.dot(ray.direction), c = ray.direction.dot(ray.direction), d = D.dot(w0), e = ray.direction.dot(w0);
    const den = a * c - b * b; if (Math.abs(den) < 1e-9) return null;
    const s = (b * e - c * d) / den; // O + s D
    return { f: s / KX, dist: O.clone().addScaledVector(D, s).distanceTo(ray.origin.clone().addScaledVector(ray.direction, (a * e - b * d) / den)) };
  }
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); drag.mode = "zoom"; return; }
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    if (S.input === "wheel") {
      const l = wheelPoint(e);
      if (l && Math.abs(Math.hypot(l.y, l.z) - WR) < 0.2 * (1 + 0.5 * 0) && Math.abs(l.x - WX) < 0.3) { drag.mode = "wheel"; drag.ang = F.knobAngle(l.z, l.y); drag.t = performance.now(); cv.classList.add("held"); return; }
      drag.mode = "orbit"; cv.classList.add("held"); return;
    }
    if (S.input === "radio") {
      const l = dialPoint(e);
      if (l && Math.hypot(l.x - RD.x, l.y - RD.y) < RD.r * 1.25) { S.playing = false; drag.mode = "dial"; drag.ang = F.dialAngle(l.x - RD.x, l.y - RD.y); cv.classList.add("held"); return; }
      drag.mode = "orbit"; cv.classList.add("held"); return;
    }
    const ap = axisParam(screenRay(e));
    const h = stage.localToWorld(new THREE.Vector3(S.f * KX, 0, 0)).project(camera), r = cv.getBoundingClientRect();
    const hx = (h.x + 1) / 2 * r.width + r.left, hy = (1 - h.y) / 2 * r.height + r.top;
    const nearH = Math.hypot(e.clientX - hx, e.clientY - hy) < 34;
    drag.mode = nearH || (ap && ap.dist < 0.05 * stage.scale.x / S0 && ap.f > -0.3 && ap.f < FMAX + 0.3) ? "axis" : "orbit";
    if (drag.mode === "axis") { setPlaying(false); drag.off = ap ? ap.f - S.f : 0; if (nearH) drag.off = ap ? ap.f - S.f : 0; }
    cv.classList.add("held");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.mode === "zoom" && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.dist = clamp(cam.dist * (pinch0 / d), 0.6, 6); cam.zoomed = true; pinch0 = d; camPlace(); return; }
    if (e.pointerId !== drag.id || !drag.mode) return;
    if (drag.mode === "dial") {
      const l = dialPoint(e);
      if (l && Math.hypot(l.x - RD.x, l.y - RD.y) > 0.05) { const a = F.dialAngle(l.x - RD.x, l.y - RD.y); setF(S.f + F.dialTurn(drag.ang, a) * F.HZ_PER_TURN); drag.ang = a; }
    } else if (drag.mode === "wheel") {
      const l = wheelPoint(e), now = performance.now();
      if (l && Math.hypot(l.y, l.z) > 0.05) { const a = F.knobAngle(l.z, l.y); wheel.drive(F.crankDelta(drag.ang, a), (now - drag.t) / 1000); drag.ang = a; drag.t = now; }
    } else if (drag.mode === "axis") { const ap = axisParam(screenRay(e)); if (ap) setF(ap.f - drag.off); }
    else { cam.yaw -= (e.clientX - drag.x) * 0.008; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.006, -1.2, 1.4); camPlace(); }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e) => { if (drag.mode === "wheel") wheel.release(); pts.delete(e.pointerId); if (!pts.size) { drag.mode = null; drag.id = null; cv.classList.remove("held"); } };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 0.6, 6); cam.zoomed = true; camPlace(); }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea, dialog, button")) return;
    if (e.key === " ") { e.preventDefault(); ACT.sweep(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); S.playing = false; setF(S.f + (e.key === "ArrowRight" ? 0.1 : -0.1)); }
    else if (e.key === "r" || e.key === "R") ACT.reset();
    else if (e.key === "w" || e.key === "W") ACT.wind();
  });

  // ---------- DOM ----------
  const fR = $("fR");
  fR.addEventListener("input", () => { S.playing = false; setF(+fR.value); });
  $("playBtn").addEventListener("click", ACT.sweep);
  $("resetBtn").addEventListener("click", ACT.reset);
  $("windBtn").addEventListener("click", ACT.wind);
  for (const b of $("presetSeg").children) b.addEventListener("click", () => applyPreset(b.dataset.v));
  for (const b of $("inSeg").children) b.addEventListener("click", () => setInput(b.dataset.v));
  for (const b of $("kSeg").children) b.addEventListener("click", () => { wheel.setKappa(+b.dataset.v, S.f); syncDom(); });
  $("brakeBtn").addEventListener("click", () => wheel.brake());
  for (const b of $("sndSeg").children) b.addEventListener("click", () => setSound(b.dataset.v));
  for (const b of $("plotSeg").children) b.addEventListener("click", () => { S.adv.plot = b.dataset.v; saveAdv(); syncDom(); });
  for (const [id, k] of [["tgWalk", "walk"], ["tgPhase", "phase"], ["tgShadows", "shadows"], ["tgEpi", "epi"]]) $(id).addEventListener("click", advToggle(k));
  for (const [id, k] of [["tgGhost", "ghost"], ["tgPlane", "plane"], ["tgRing", "ring"]]) $(id).addEventListener("click", ACT[k]);
  function syncDom() {
    if (+fR.value !== S.f) fR.value = S.f;
    $("fL").textContent = `${fmtNum(S.f, 2, "Hz")} · ${fmtNum(S.f * F.T, 2)} ${t("x.turns")}`;
    const cc = M.com(S.f);
    $("readout").innerHTML = [["f", fmtNum(S.f, 2, "Hz")], ["Re c", fmtNum(cc[0], 3)], ["Im c", fmtNum(cc[1], 3)], ["|c|", fmtNum(Math.hypot(...cc), 3)]].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("");
    $("playLbl").textContent = t(S.playing ? "pause" : "sweep");
    $("windLbl").textContent = t(S.wind ? "unwind" : "wind"); $("windBtn").classList.toggle("primary", !S.wind);
    $("playIcon").innerHTML = kit.icon(S.playing ? "pause" : "play");
    for (const b of $("presetSeg").children) { const on = b.dataset.v === S.preset; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    for (const [id, k] of [["tgGhost", "ghost"], ["tgPlane", "plane"], ["tgRing", "ring"]]) $(id).setAttribute("aria-pressed", String(S[k]));
    for (const b of $("sndSeg").children) { const on = b.dataset.v === S.sound; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    for (const b of $("plotSeg").children) { const on = b.dataset.v === S.adv.plot; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    for (const [id, k] of [["tgWalk", "walk"], ["tgPhase", "phase"], ["tgShadows", "shadows"], ["tgEpi", "epi"]]) $(id).setAttribute("aria-pressed", String(S.adv[k]));
    $("sndNote").textContent = S.sound === "off" ? "" : t({ sum: "snd.noteSum", mixer: "snd.noteMixer", probe: "snd.noteProbe" }[S.sound]);
    sndLabel.set(S.sound === "off" ? "" : "♪ " + t("snd." + S.sound));
    pSig = "";
    const wm = S.input === "wheel";
    for (const b of $("inSeg").children) { const on = b.dataset.v === S.input; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    for (const b of $("kSeg").children) { const on = +b.dataset.v === wheel.kappa; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
    $("wheelCtl").hidden = !wm; for (const id of ["fR", "playBtn"]) $(id).disabled = wm;
    dSig = "";
    const e = Math.round(M.coverage() * 100); $("expBar").style.width = e + "%"; $("expTxt").textContent = e + "%";
  }
  onLang(() => { syncDom(); syncXrButtons(); pSig = ""; dSig = ""; });
  onTheme((dark) => { if (!ui.xr) applyPalette(dark ? "dark" : "light"); });
  if (document.fonts && document.fonts.load) document.fonts.load(pfont(30)).then(() => { labels.forEach((l) => l.redraw()); pSig = ""; }).catch(() => {});

  // ---------- grafici nella pagina (gli stessi del pannello) ----------
  const sigcv = $("sigcv"), gcv = $("gcv");
  let dSig = "";
  function prepCv(cv) {
    const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, r.width, r.height);
    c.fillStyle = C.card; c.fillRect(0, 0, r.width, r.height); c.textBaseline = "alphabetic";
    return [c, r.width, r.height];
  }
  const GK = 0.7;
  function drawDesk() {
    const sg = [S.f.toFixed(3), S.ghost, S.preset, S.input, S.adv.plot, Math.round(M.coverage() * 200), palName, t("x.signal"), sigcv.clientWidth, gcv.clientWidth].join("|");
    if (sg === dSig) return; dSig = sg;
    let a = prepCv(sigcv); if (a) plotLeft(a[0], 1, 1, a[1] - 2, a[2] - 2, GK);
    a = prepCv(gcv); if (a) plotSpectrum(a[0], { x: 1, y: 1, w: a[1] - 2, h: a[2] - 2 }, GK);
  }
  let gDrag = false;
  const gSet = (e) => { const r = gcv.getBoundingClientRect(), l = 40 * GK + 1, rr = 16 * GK + 1; if (S.input === "wheel") return; S.playing = false; setF(clamp((e.clientX - r.left - l) / (r.width - l - rr) * FMAX, 0, FMAX)); };
  gcv.addEventListener("pointerdown", (e) => { gcv.setPointerCapture(e.pointerId); gDrag = true; gSet(e); });
  gcv.addEventListener("pointermove", (e) => gDrag && gSet(e));
  gcv.addEventListener("pointerup", () => (gDrag = false)); gcv.addEventListener("pointercancel", () => (gDrag = false));
  new ResizeObserver(() => { dSig = ""; }).observe(gcv);

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fn) { try { return fn(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error("Error in " + name + ":", err); note.textContent = "Error in " + name + ": " + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    if (presenting) { scene.updateMatrixWorld(true); safe("input", () => xrInput(now, dt)); }
    if (Math.abs(S.u - S.wind) > 1e-4) { const du = dt / (reduceMotion ? 0.01 : WIND_T); S.u = S.wind > S.u ? Math.min(S.wind, S.u + du) : Math.max(S.wind, S.u - du); dirty = true; }
    if (S.input === "radio") { refT += dt * S.f * 0.25; refRot.rotation.z = -TAU * refT; }   // l'oscillatore di riferimento gira a f/4 giri al secondo
    if (S.input === "wheel") { setF(wheel.step(dt)); wSpin.rotation.x = wheel.phi; }
    else if (S.playing) { setF(S.f + 0.6 * S.speed * dt); if (S.f >= FMAX) setPlaying(false); }
    if (Math.abs(M.R - Rcur) > 1e-3) { Rcur += (M.R - Rcur) * (reduceMotion ? 1 : 0.25); dirty = true; } else if (Rcur !== M.R) { Rcur = M.R; dirty = true; }
    if (traceDirty) { buildTrace(); traceDirty = false; }
    if (dirty) safe("stage", updateStage);
    safe("epi", () => updateEpi(dt));
    if (audio && audio.ready) audio.update(S.sound, S.f, clamp(magNow / Math.max(0.05, M.cMaxAll), 0, 1));
    if (presenting) {
      safe("panel", () => { const sg = panelSig(); if (sg !== pSig && (frameN % 3 === 0 || pSig === "")) { pSig = sg; drawPanel(); } });
    }
    if (!presenting) safe("desk", drawDesk);
    renderer.render(scene, camera);
  });

  // ---------- avvio ----------
  M.setPreset("one"); buildGhost(); phs = M.phasors(4); paintWound();
  applyPalette(palName);
  Rcur = M.R; camPlace(); resize(); syncDom(); updateStage();
  window.__app = { wheel, setInput, setSound, audio: () => audio, phs: () => phs, THREE, scene, camera, renderer, stage, M, S, ui, SRC, ACT, panel, items: itemsNow, ctrls, grips, hands, xrInput, setF, placeFromHead, drawPanel, rayPanel, tipPanel, itemAt };
  return { reset: () => resetAll(true), csv };
}
