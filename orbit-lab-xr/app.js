/* app.js — Orbit Lab XR: scena Three.js, vista dall'esterno (AR / schermo) e vista in prima persona dalla nave (VR), ingressi WebXR.
   La fisica sta in core.js / sim.js (pure, testate in Node); qui c'è solo la presentazione.
   Sistema di riferimento: la scena "mondo" (`world`) è in coordinate matematiche (x, y = piano dell'orbita, z = normale), raggio del pianeta = 1.
   - Vista "planet" (esterna): `frameRoot` (afferrabile) mette il mondo davanti all'utente in scala FRAME_SCALE metri per unità.
   - Vista "ship" (cabina): la matrice di `frameRoot` è calcolata ogni fotogramma in modo che la nave stia fermo sopra la testa dell'utente,
     "su" = verticale locale, "avanti" = verso del moto; il pianeta e le stelle ruotano attorno. Scala SHIP_SCALE metri per unità. */
(function () {
  'use strict';
  const { CORE, shipFrame, dirToShipLocal, dashPolyline } = OrbitCore;
  const { Sim, MISSIONS, PLANETS, KEYS, STR, typeLabel } = OrbitSim;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- palette (token di Orbit Lab: chiara per AR/schermo, scura per VR) ----------
  const PAL = {
    light: { bg: '#8CCBEB', surface: '#F5F9FC', ink: '#0B1B3A', muted: '#4D6585', accent: '#FF6A3D', onaccent: '#0B1B3A', tile2: '#FFC23D', gridline: 'rgba(11,27,58,.13)',
      kin: '#2350D8', pot: '#D2570F', tot: '#0B1B3A', vel: '#0F9A63', grav: '#2350D8', thr: '#B42BA0', net: '#0B1B3A',
      'c-circle': '#0F9A63', 'c-ellipse': '#2350D8', 'c-parab': '#9A6A00', 'c-hyper': '#B42BA0', 'c-crash': '#E2412A', planet: '#BFE6F6', planet2: '#7DC4E4', space: '#F5F9FC', ship: '#FFC23D' },
    dark: { bg: '#0A1630', surface: '#12213F', ink: '#E8F1FF', muted: '#9BB0CF', accent: '#FF7A50', onaccent: '#0A1630', tile2: '#E9A92A', gridline: 'rgba(232,241,255,.10)',
      kin: '#86A6FF', pot: '#FF9A5C', tot: '#E8F1FF', vel: '#3DDC97', grav: '#86A6FF', thr: '#F27ADF', net: '#E8F1FF',
      'c-circle': '#3DDC97', 'c-ellipse': '#86A6FF', 'c-parab': '#E2B24A', 'c-hyper': '#F27ADF', 'c-crash': '#FF7C60', planet: '#1E4A7C', planet2: '#2E6AA8', space: '#0B1830', ship: '#F4B73A' }
  };
  let palName = matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let C = PAL[palName];

  // ---------- simulazione e stato dell'interfaccia ----------
  const sim = new Sim();
  const S = sim.S;
  const ui = { tab: 'launch', view: 'planet', faceMe: false, hidden: false, flash: null, flashUntil: 0, xr: null };
  try { const j = JSON.parse(localStorage.getItem('orbitxr.v1') || 'null'); if (j) { ['level', 'h', 'v', 'ang', 'planet'].forEach(k => { if (j[k] !== undefined) S[k] = j[k]; }); if (j.done) j.done.forEach(x => sim.done.add(x)); sim.launchChanged(); } } catch (e) { /* ignora */ }
  const persist = () => { try { localStorage.setItem('orbitxr.v1', JSON.stringify({ level: S.level, h: S.h, v: S.v, ang: S.ang, planet: S.planet, done: [...sim.done] })); } catch (e) { /* ignora */ } };

  // ---------- THREE ----------
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.xr.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60000);
  camera.position.set(0, 1.25, 0.1);
  scene.add(camera);

  const FRAME_SCALE = 0.16, SHIP_SCALE = 300, HOME = new THREE.Vector3(0, 1.3, -0.9), HEAD = new THREE.Vector3(0, 1.35, 0);
  const mats = {};
  function mat(role, kind, extra) { // materiale condiviso per ruolo di colore; applyPalette lo aggiorna
    const key = role + (kind || '');
    if (!mats[key]) { const M = kind === 'lambert' ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial; mats[key] = Object.assign(new M({ color: C[role] || role }), extra || {}); mats[key].userData.role = role; }
    return mats[key];
  }
  function applyPalette(name) {
    palName = name; C = PAL[name];
    for (const k in mats) { const r = mats[k].userData.role; if (C[r]) mats[k].color.set(C[r]); }
    planetTex.redraw(); panelSig = ''; hudSig = -1;
    document.documentElement.dataset.theme = name;
    updateBackground();
  }

  const frameRoot = new THREE.Group(); scene.add(frameRoot);
  frameRoot.position.copy(HOME); frameRoot.scale.setScalar(FRAME_SCALE);
  frameRoot.userData.grab = { scalable: true, min: 0.04 / FRAME_SCALE * FRAME_SCALE, max: 0.5, kind: 'frame' };
  const world = new THREE.Group(); frameRoot.add(world);
  const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(4, 3, 6); world.add(sun, sun.target);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));

  function outlined(geo, role, scale) { // forma con contorno d'inchiostro (guscio rovesciato)
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat(role)));
    const o = new THREE.Mesh(geo, mat('ink', '', { side: THREE.BackSide })); o.scale.setScalar(scale || 1.14); g.add(o);
    return g;
  }

  // pianeta: texture equirettangolare con macchie e tacche ogni 15° sull'equatore (che giace nel piano dell'orbita)
  const planetTex = (function () {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    const tex = new THREE.CanvasTexture(cv);
    function redraw() {
      const c = cv.getContext('2d');
      c.fillStyle = C.planet; c.fillRect(0, 0, 1024, 512);
      c.fillStyle = C.planet2;
      for (const [a, w, lat, h] of [[20, 26, 0, 70], [150, 34, 20, 60], [215, 20, -10, 50], [300, 30, 5, 80], [80, 18, -30, 40], [250, 24, 35, 40]]) {
        c.beginPath(); c.ellipse(a / 360 * 1024, 256 - lat / 90 * 256, w / 360 * 1024, h / 2, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = C.ink; c.globalAlpha = 0.55; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 256); c.lineTo(1024, 256); c.stroke();
      for (let a = 0; a < 360; a += 15) { const x = a / 360 * 1024, l = a % 90 === 0 ? 40 : 18; c.beginPath(); c.moveTo(x, 256 - l); c.lineTo(x, 256 + l); c.stroke(); }
      c.globalAlpha = 1; tex.needsUpdate = true;
    }
    return { tex: tex, redraw: redraw };
  })();
  planetTex.redraw();
  const planet = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 64, 32), new THREE.MeshLambertMaterial({ map: planetTex.tex }));
  planet.rotation.x = Math.PI / 2;           // poli lungo z: l'equatore è nel piano (x, y)
  const planetOutline = new THREE.Mesh(new THREE.SphereBufferGeometry(1.012, 32, 16), mat('ink', '', { side: THREE.BackSide }));
  const equator = new THREE.Mesh(new THREE.TorusBufferGeometry(1.004, 0.006, 6, 120), mat('ink'));
  world.add(planet, planetOutline, equator);

  // torre: due gambe e una piattaforma, solo un'impalcatura (la nave ignora le collisioni)
  const tower = new THREE.Group(); world.add(tower);
  const legGeo = new THREE.BoxBufferGeometry(0.008, 1, 0.008);
  const legs = [-0.03, 0.03].map(x => { const m = new THREE.Mesh(legGeo, mat('ink')); m.position.x = x; tower.add(m); return m; });
  const deck = new THREE.Mesh(new THREE.BoxBufferGeometry(0.14, 0.012, 0.06), mat('ink')); tower.add(deck);
  function updateTower() { tower.position.set(0, 1, 0); legs.forEach(l => { l.scale.y = Math.max(S.h, 0.001); l.position.y = S.h / 2; l.visible = S.h > 0.001; }); deck.position.y = S.h; }

  // griglia in unità di R (cerchi nel piano dell'orbita)
  const grid = new THREE.Group(); world.add(grid);
  for (let r = 2; r <= 6; r++) { const t = new THREE.Mesh(new THREE.TorusBufferGeometry(r, 0.0035, 4, 120), mat('muted', '', { transparent: true, opacity: 0.55 })); grid.add(t); }

  // nastri: polilinee con spessore fisso, visibili da ogni lato (un nastro nel piano e uno perpendicolare)
  function Ribbon(cap, material) {
    this.cap = cap; this.pos = new Float32Array(cap * 36);
    const geo = new THREE.BufferGeometry(), at = new THREE.BufferAttribute(this.pos, 3); at.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', at); geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geo, material); this.mesh.frustumCulled = false; this.geo = geo;
  }
  Ribbon.prototype.set = function (polys, w) {
    const P = this.pos, hw = w / 2; let n = 0, o = 0;
    const v = (x, y, z) => { P[o++] = x; P[o++] = y; P[o++] = z; };
    for (const poly of polys) for (let i = 1; i < poly.length && n < this.cap; i++) {
      const a = poly[i - 1], b = poly[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-9) continue;
      const nx = -dy / L * hw, ny = dx / L * hw;
      v(a[0] + nx, a[1] + ny, 0); v(a[0] - nx, a[1] - ny, 0); v(b[0] + nx, b[1] + ny, 0); v(a[0] - nx, a[1] - ny, 0); v(b[0] - nx, b[1] - ny, 0); v(b[0] + nx, b[1] + ny, 0);
      v(a[0], a[1], hw); v(a[0], a[1], -hw); v(b[0], b[1], hw); v(a[0], a[1], -hw); v(b[0], b[1], -hw); v(b[0], b[1], hw);
      n++;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.setDrawRange(0, n * 12);
  };
  const orbitRib = new Ribbon(5000, mat('c-ellipse', '', { side: THREE.DoubleSide }));
  const trailRib = new Ribbon(3200, mat('ink', '', { side: THREE.DoubleSide }));
  const ghostRibs = Array.from({ length: 8 }, () => new Ribbon(500, mat('muted', '', { side: THREE.DoubleSide, transparent: true, opacity: 0.5 })));
  world.add(orbitRib.mesh, trailRib.mesh); ghostRibs.forEach(r => world.add(r.mesh));
  const RW = 0.012;

  // marcatori: perigeo (pieno), apogeo (vuoto), impatto (croce)
  const sph = new THREE.SphereBufferGeometry(1, 16, 12);
  const periM = outlined(sph, 'ink', 1.0), apoM = outlined(sph, 'surface', 1.25);
  periM.scale.setScalar(0.035); apoM.scale.setScalar(0.035);
  const crossG = (role) => { const g = new THREE.Group(), b = new THREE.BoxBufferGeometry(0.11, 0.016, 0.016); [Math.PI / 4, -Math.PI / 4].forEach(a => { const m = new THREE.Mesh(b, mat(role)); m.rotation.z = a; g.add(m); }); return g; };
  const impactM = crossG('c-crash'), crashM = crossG('c-crash'); crashM.scale.setScalar(1.4);
  world.add(periM, apoM, impactM, crashM);

  // strobo di Keplero
  const strobes = Array.from({ length: 80 }, () => { const m = outlined(sph, 'ship', 1.2); m.scale.setScalar(0.03); m.visible = false; world.add(m); return m; });

  // nave (vista dall'esterno): cono giallo con ali e fiamma
  const shipG = new THREE.Group(); world.add(shipG);
  const coneGeo = new THREE.ConeBufferGeometry(0.035, 0.11, 14); coneGeo.rotateZ(-Math.PI / 2);
  shipG.add(outlined(coneGeo, 'ship', 1.15));
  const wing = new THREE.Mesh(new THREE.BoxBufferGeometry(0.035, 0.1, 0.008), mat('ship')); wing.position.x = -0.03; shipG.add(wing);
  const wing2 = new THREE.Mesh(new THREE.BoxBufferGeometry(0.035, 0.008, 0.1), mat('ship')); wing2.position.x = -0.03; shipG.add(wing2);
  const flameGeo = new THREE.ConeBufferGeometry(0.025, 0.1, 10); flameGeo.rotateZ(Math.PI / 2); flameGeo.translate(-0.1, 0, 0);
  const flame = new THREE.Mesh(flameGeo, mat('accent')); flame.visible = false; shipG.add(flame);   // la fiamma sta dietro alla spinta (sistema locale della nave)

  // frecce dei vettori
  function Arrow(role) {
    this.g = new THREE.Group(); const m = mat(role);
    this.shaft = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.009, 0.009, 1, 8), m); this.head = new THREE.Mesh(new THREE.ConeBufferGeometry(0.028, 0.075, 12), m);
    this.g.add(this.shaft, this.head); this.g.visible = false; world.add(this.g);
  }
  Arrow.prototype.set = function (x, y, dx, dy, len) {
    const L = Math.hypot(dx, dy); if (L < 1e-9 || len < 0.02) { this.g.visible = false; return; }
    const hl = Math.min(0.075, len * 0.5);
    this.g.visible = true; this.g.position.set(x, y, 0); this.g.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    this.shaft.scale.y = Math.max(0.001, len - hl); this.shaft.position.y = (len - hl) / 2; this.head.scale.y = hl / 0.075; this.head.position.y = len - hl / 2;
  };
  const arrows = { vel: new Arrow('vel'), grav: new Arrow('grav'), thr: new Arrow('thr'), net: new Arrow('net') };

  // stelle (sfera attorno al mondo; ruotano con il riferimento inerziale)
  const starsGeo = new THREE.BufferGeometry(), sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { const a = Math.random() * 6.2832, z = Math.random() * 2 - 1, r = Math.sqrt(1 - z * z); sp.set([Math.cos(a) * r * 120, Math.sin(a) * r * 120, z * 120], i * 3); }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })); stars.frustumCulled = false; world.add(stars);

  // ---------- cabina (vista dalla nave): fissa nel riferimento del visore ----------
  const cabin = new THREE.Group(); scene.add(cabin);
  [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(p => { const m = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.025, 0.025, 2.3, 8), mat('ink')); m.position.set(p[0], 1.15, p[1]); cabin.add(m); });
  const rim = new THREE.Mesh(new THREE.TorusBufferGeometry(1.27, 0.03, 6, 48), mat('accent')); rim.rotation.x = Math.PI / 2; rim.position.y = 2.3; cabin.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleBufferGeometry(1.25, 48), mat('surface', '', { transparent: true, opacity: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; cabin.add(floor);
  const dash = new THREE.Mesh(new THREE.BoxBufferGeometry(1.0, 0.05, 0.42), mat('ink')); dash.position.set(0, 0.86, -0.66); dash.rotation.x = -0.45; cabin.add(dash);
  const CAB = [0xFF6A3D, 0xFFC23D, 0x6E3FE0, 0x0F9A63].map((col, i) => {
    const m = new THREE.Mesh(new THREE.SphereBufferGeometry(0.045 + i * 0.012, 16, 12), new THREE.MeshBasicMaterial({ color: col }));
    m.position.set(-0.3 + i * 0.2, 1.3 + (i % 2) * 0.15, -0.5 - (i % 3) * 0.1); m.userData.v = new THREE.Vector3((i - 1.5) * 0.015, 0.012, 0.01 * (i % 2 ? 1 : -1)); cabin.add(m); return m;
  });
  const BOX = { x: 0.45, y0: 0.95, y1: 1.75, z0: -0.95, z1: -0.1 };
  function stepCabin(dt, th, F) {
    const tm = Math.hypot(th[0], th[1]); let ax = 0, ay = 0, az = 0;
    if (tm > 1e-6) { const d = dirToShipLocal(F, th[0] / tm, th[1] / tm), k = Math.min(2, tm * 6); ax = -d[0] * k; ay = -d[1] * k; az = -d[2] * k; }
    for (const m of CAB) {
      const v = m.userData.v; v.x += ax * dt; v.y += ay * dt; v.z += az * dt; m.position.addScaledVector(v, dt);
      if (m.position.x < -BOX.x || m.position.x > BOX.x) { v.x *= -0.4; m.position.x = clamp(m.position.x, -BOX.x, BOX.x); }
      if (m.position.y < BOX.y0 || m.position.y > BOX.y1) { v.y *= -0.4; m.position.y = clamp(m.position.y, BOX.y0, BOX.y1); }
      if (m.position.z < BOX.z0 || m.position.z > BOX.z1) { v.z *= -0.4; m.position.z = clamp(m.position.z, BOX.z0, BOX.z1); }
    }
  }
  // marcatori prograde / retrograde nel cielo (cerchio verde con tacche, croce rossa)
  function markerTex(kind) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.lineWidth = 9; c.lineCap = 'round';
    if (kind === 'pro') { c.strokeStyle = C.vel; c.beginPath(); c.arc(64, 64, 26, 0, 7); c.moveTo(64, 8); c.lineTo(64, 36); c.moveTo(8, 64); c.lineTo(36, 64); c.moveTo(120, 64); c.lineTo(92, 64); c.stroke(); }
    else { c.strokeStyle = C['c-crash']; c.beginPath(); c.arc(64, 64, 26, 0, 7); c.moveTo(46, 46); c.lineTo(82, 82); c.moveTo(82, 46); c.lineTo(46, 82); c.stroke(); }
    return new THREE.CanvasTexture(cv);
  }
  const navPro = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('pro'), depthTest: false, transparent: true })), navRetro = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('retro'), depthTest: false, transparent: true }));
  navPro.renderOrder = navRetro.renderOrder = 10; scene.add(navPro, navRetro);

  // ---------- pannelli fluttuanti (canvas -> texture) ----------
  const uiCanvas = $('ui'); uiCanvas.width = XRPanel.W; uiCanvas.height = XRPanel.H;   // lo stesso canvas serve anche alla pagina desktop
  const uiCtx = uiCanvas.getContext('2d'), uiTex = new THREE.CanvasTexture(uiCanvas);
  const ctlPanel = new THREE.Mesh(new THREE.PlaneBufferGeometry(XRPanel.W * XRPanel.MPP, XRPanel.H * XRPanel.MPP), new THREE.MeshBasicMaterial({ map: uiTex, side: THREE.DoubleSide, transparent: true }));
  ctlPanel.userData.grab = { scalable: true, min: 0.6, max: 2.5, kind: 'panel' }; scene.add(ctlPanel);
  const fabCanvas = document.createElement('canvas'); fabCanvas.width = XRPanel.FAB.W; fabCanvas.height = XRPanel.FAB.H;
  const fabTex = new THREE.CanvasTexture(fabCanvas);
  const fab = new THREE.Mesh(new THREE.PlaneBufferGeometry(XRPanel.FAB.W * XRPanel.MPP, XRPanel.FAB.H * XRPanel.MPP), new THREE.MeshBasicMaterial({ map: fabTex, side: THREE.DoubleSide, transparent: true })); scene.add(fab);
  const HUD = { W: 640, H: 360, MPP: 0.0006 }, hudCanvas = $('hud'); hudCanvas.width = HUD.W; hudCanvas.height = HUD.H;
  const hudCtx = hudCanvas.getContext('2d'), hudTex = new THREE.CanvasTexture(hudCanvas);
  const hudMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(HUD.W * HUD.MPP, HUD.H * HUD.MPP), new THREE.MeshBasicMaterial({ map: hudTex, side: THREE.DoubleSide, transparent: true }));
  hudMesh.userData.grab = { scalable: true, min: 0.5, max: 3, kind: 'hud' }; scene.add(hudMesh);
  const PIP = { W: 512, H: 336, MPP: 0.0007 }, pipCanvas = $('camcv'); pipCanvas.width = PIP.W; pipCanvas.height = PIP.H;
  const pipCtx = pipCanvas.getContext('2d'), pipTex = new THREE.CanvasTexture(pipCanvas);
  const pipMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(PIP.W * PIP.MPP, PIP.H * PIP.MPP), new THREE.MeshBasicMaterial({ map: pipTex, side: THREE.DoubleSide }));
  pipMesh.userData.grab = { scalable: true, min: 0.5, max: 3, kind: 'pip' }; scene.add(pipMesh);

  // pose dei pannelli per modalità (si ricordano quando l'utente li sposta)
  const POSES = {
    planet: { ctl: [[-0.42, 1.15, -0.55], [0, 0.5, 0]], hud: [[0.45, 1.5, -0.8], [0, -0.4, 0]], pip: [[0.5, 1.12, -0.72], [0, -0.4, 0]] },
    ship: { ctl: [[-0.38, 1.0, -0.5], [-0.2, 0.6, 0]], hud: [[0, 0.99, -0.6], [-0.95, 0, 0]], pip: [[0.5, 1.12, -0.72], [0, -0.4, 0]] }
  };
  function applyPoses(view) { const P = POSES[view]; [['ctl', ctlPanel], ['hud', hudMesh], ['pip', pipMesh]].forEach(([k, m]) => { m.position.fromArray(P[k][0]); m.rotation.set(P[k][1][0], P[k][1][1], P[k][1][2]); m.scale.setScalar(1); m.updateMatrix(); }); }
  function savePoses(view) { const P = POSES[view]; [['ctl', ctlPanel], ['hud', hudMesh], ['pip', pipMesh]].forEach(([k, m]) => { P[k] = [m.position.toArray(), [m.rotation.x, m.rotation.y, m.rotation.z]]; }); }
  applyPoses('planet');

  // ---------- vista: esterna o nave ----------
  const outPose = { p: new THREE.Vector3().copy(HOME), q: new THREE.Quaternion(), s: FRAME_SCALE };
  function setView(v) {
    if (v === ui.view) return;
    savePoses(ui.view);
    if (ui.view === 'planet') { outPose.p.copy(frameRoot.position); outPose.q.copy(frameRoot.quaternion); outPose.s = frameRoot.scale.x; }
    ui.view = v;
    if (v === 'planet') { frameRoot.matrixAutoUpdate = true; frameRoot.position.copy(outPose.p); frameRoot.quaternion.copy(outPose.q); frameRoot.scale.setScalar(outPose.s); frameRoot.updateMatrix(); }
    else frameRoot.matrixAutoUpdate = false;
    applyPoses(v); panelSig = ''; syncDom(); updateBackground();
  }
  const _M = new THREE.Matrix4(), _R = new THREE.Matrix4(), _T = new THREE.Matrix4(), _S = new THREE.Matrix4();
  function placeShipFrame(q, I) {
    const F = shipFrame(q.x, q.y, I.hz);
    _R.set(0, 0, F.det, 0, F.ux, F.uy, 0, 0, -F.fx, -F.fy, 0, 0, 0, 0, 0, 1);
    _M.makeTranslation(HEAD.x, HEAD.y, HEAD.z).multiply(_S.makeScale(SHIP_SCALE, SHIP_SCALE, SHIP_SCALE)).multiply(_R).multiply(_T.makeTranslation(-q.x, -q.y, 0));
    frameRoot.matrix.copy(_M); frameRoot.matrixWorldNeedsUpdate = true;
    return F;
  }
  function updateBackground() {
    const xrAR = ui.xr === 'immersive-ar';
    if (xrAR) { scene.background = null; renderer.setClearAlpha(0); return; }
    renderer.setClearAlpha(1);
    scene.background = new THREE.Color(ui.view === 'ship' ? '#030712' : (ui.xr || palName === 'dark') ? PAL.dark.space : C.space);
    stars.visible = ui.view === 'ship' || !!ui.xr || palName === 'dark';
  }

  // ---------- fotogramma: stato fisico -> scena ----------
  let F = null, lastCur = -1, lastSigO = '';
  function frameState() {
    const q = sim.viewState(), I = CORE.info(q.x, q.y, q.vx, q.vy, q.pad);
    const K = CORE.conic(I, (I.type === 'hyperbola' || I.type === 'parabola') ? 20 : 40);
    const E0 = sim.H.get(0);
    return { q: q, I: I, Io: I, K: K, cmd: q.cmd.k && q.cmd.a > 0 ? q.cmd : null, atEnd: sim.atEnd(), E0: CORE.energy(E0.x, E0.y, E0.vx, E0.vy).E };
  }
  const vecLen = m => Math.min(1.3, 0.45 * (S.scale === 'sqrt' ? Math.sqrt(m) : m));
  const _lastGhost = { n: -1 };
  function updateWorld(dt) {
    const { q, I, K, cmd } = F, shipView = ui.view === 'ship';
    updateTower();
    grid.visible = S.show.grid;
    // orbita prevista, scia, fantasmi
    const RWv = shipView ? RW * 0.3 : RW;
    const sig = ui.view + '|' + q.t + '|' + S.cur + '|' + S.hold + '|' + S.show.orbit + '|' + S.show.trail + '|' + S.phase + '|' + sim.H.n;
    if (sig !== lastSigO) {
      lastSigO = sig;
      orbitRib.mesh.visible = S.show.orbit && K.pts.length > 1;
      if (orbitRib.mesh.visible) { orbitRib.set(dashPolyline(K.pts.filter(p => Math.hypot(p[0], p[1]) <= 40), 0.1, 0.06), RWv); orbitRib.mesh.material.color.set(Hud.orbitColor(I, C)); }
      trailRib.mesh.visible = S.show.trail;
      if (S.show.trail) { const n = S.cur + 1, stride = Math.max(1, Math.floor(n / 2500)), pts = []; for (let i = 0; i < n; i += stride) { const g = sim.H.get(i); pts.push([g.x, g.y]); } pts.push([q.x, q.y]); trailRib.set([pts], RWv * 0.8); }
      periM.visible = S.show.orbit && !!K.peri; if (K.peri) periM.position.set(K.peri[0], K.peri[1], 0);
      apoM.visible = S.show.orbit && !!K.apo; if (K.apo) apoM.position.set(K.apo[0], K.apo[1], 0);
      impactM.visible = S.show.orbit && !!K.impact; if (K.impact) impactM.position.set(K.impact[0], K.impact[1], 0);
    }
    if (_lastGhost.n !== S.ghosts.length + ui.view || S.ghosts.length === 0) {
      _lastGhost.n = S.ghosts.length + ui.view;
      ghostRibs.forEach((r, i) => { const g = S.ghosts[i]; r.mesh.visible = S.show.ghosts && !!g; if (g) r.set([g], RWv * 0.7); });
    }
    ghostRibs.forEach((r, i) => { r.mesh.visible = S.show.ghosts && !!S.ghosts[i]; });
    if (shipView) for (const m of [periM, apoM, impactM]) if (m.visible && Math.hypot(m.position.x - q.x, m.position.y - q.y) < 0.15) m.visible = false;
    crashM.visible = !!S.crashed && F.atEnd; if (S.crashed) crashM.position.set(S.crashed.x, S.crashed.y, 0);
    // strobo
    let ns = 0;
    if (sim.feat('kepler') && S.show.strobe && S.phase === 'flying') {
      const H = sim.H, t1 = q.t, at = t => { let lo = 0, hi = S.cur; while (lo < hi) { const m = (lo + hi) >> 1; if (H.get(m).t < t) lo = m + 1; else hi = m; } return H.get(lo); };
      for (let k = 0; k * S.kep <= t1 + 1e-9 && ns < strobes.length; k++) { const p = at(k * S.kep); strobes[ns].position.set(p.x, p.y, 0); strobes[ns++].visible = !(shipView && Math.hypot(p.x - q.x, p.y - q.y) < 0.15); }
    }
    for (let i = ns; i < strobes.length; i++) strobes[i].visible = false;
    // nave
    shipG.visible = !shipView;
    shipG.position.set(q.x, q.y, 0);
    const ang = (q.pad || Math.hypot(q.vx, q.vy) < 1e-9) ? Math.atan2(q.y, q.x) : Math.atan2(q.vy, q.vx);
    shipG.rotation.z = ang;
    const th = CORE.thrustAcc(q.x, q.y, q.vx, q.vy, cmd), tm = Math.hypot(th[0], th[1]);
    flame.visible = tm > 1e-9 && !shipView;
    if (flame.visible) { const fa = Math.atan2(-th[1], -th[0]) - ang; flame.rotation.z = fa + Math.PI; flame.position.set(0, 0, 0); flame.scale.setScalar(0.8 + Math.min(2, tm * 4)); }
    // vettori
    const r = Math.hypot(q.x, q.y), g = 1 / (r * r), gx = -q.x / r * g, gy = -q.y / r * g, v = Math.hypot(q.vx, q.vy);
    arrows.vel.g.visible = false; arrows.grav.g.visible = false; arrows.thr.g.visible = false; arrows.net.g.visible = false;
    if (!shipView) {
      if (S.show.vel && !q.pad && v > 1e-9) arrows.vel.set(q.x, q.y, q.vx, q.vy, vecLen(v));
      if (S.show.grav) arrows.grav.set(q.x, q.y, gx, gy, vecLen(g));
      if (S.show.thr && tm > 1e-9) arrows.thr.set(q.x, q.y, th[0], th[1], vecLen(tm));
      if (S.show.net) { let nx = gx + th[0], ny = gy + th[1]; if (q.pad && (th[0] * q.x + th[1] * q.y) / r <= g) { nx = 0; ny = 0; } arrows.net.set(q.x, q.y, nx, ny, vecLen(Math.hypot(nx, ny))); }
    }
    // modalità nave: riferimento locale, cabina, marcatori
    cabin.visible = shipView;
    navPro.visible = navRetro.visible = shipView && !q.pad && v > 1e-6;
    if (shipView) {
      const Fs = placeShipFrame(q, I);
      stepCabin(dt, th, Fs);
      const d = dirToShipLocal(Fs, q.vx / (v || 1), q.vy / (v || 1)), D = 400;
      navPro.position.set(HEAD.x + d[0] * D, HEAD.y + d[1] * D, HEAD.z + d[2] * D); navPro.scale.setScalar(D * 0.09);
      navRetro.position.set(HEAD.x - d[0] * D, HEAD.y - d[1] * D, HEAD.z - d[2] * D); navRetro.scale.setScalar(D * 0.09);
    }
    // le texture dei marcatori seguono la palette
    return { th: th, tm: tm };
  }

  // ---------- pannello: stato, layout, disegno ----------
  let layout = null, panelSig = '', lastPanelDraw = 0, hudSig = -1, camT = 0, hover = null;
  const held = {};
  function noteLines() {
    const Io = F.Io, out = [{ text: typeLabel(Io), color: Hud.orbitColor(Io, C) }];
    out.push(Io.crash ? 'Closest: the ground' : 'Closest: ' + Hud.fmt(Io.rp - 1, 2) + ' R above');
    out.push(Io.ra === Infinity ? 'Farthest: escapes' : 'Farthest: ' + Hud.fmt(Io.ra - 1, 2) + ' R above');
    return out;
  }
  function panelState() {
    const q = F.q, p = sim.planetInfo(), M = sim.M;
    const cur = M.id ? MISSIONS.find(m => m.id === M.id) : null;
    const hh = {}; for (const k in KEYS) hh[k] = sim.thrHeld(k);
    return { tab: ui.tab, phase: S.phase, playing: S.playing, speed: S.speed, scrub: sim.H.n > 1 ? S.cur / (sim.H.n - 1) : 0, tLabel: 't = ' + q.t.toFixed(2) + (sim.feat('realUnits') && p.R ? ' · ' + (q.t * p.tau / 60).toFixed(1) + ' min' : ''),
      view: ui.view, xr: ui.xr, faceMe: ui.faceMe, h: S.h, v: S.v, ang: S.ang, tl: S.tl, dvStep: S.dvStep, dvUsed: q.dv, budget: S.budget, show: S.show, scale: S.scale, level: S.level, planet: S.planet,
      levelNote: STR.lv[S.level - 1], xrNote: ui.xr ? 'Grip / pinch near the planet or a panel edge to move it. Trigger or pinch-ray presses buttons. A, B, X, Y burn (unverified).' : 'Drag to orbit the view, wheel to zoom. Keys: W S D A thrusters, Space play, R reset.',
      feat: k => sim.feat(k), thrHeld: hh, noteLines: noteLines(), frameHot: ui.hot === 'ctl',
      missions: MISSIONS.map(m => ({ id: m.id, title: m.title, level: m.level, done: sim.done.has(m.id) })), mission: { cur: cur, stage: M.stage, choice: M.choice } };
  }
  function refreshPanel(force) {
    const now = performance.now();
    const ps = panelState();
    const sig = JSON.stringify([ps.tab, ps.phase, ps.playing, ps.speed, Math.round(ps.scrub * 200), ps.tLabel, ps.view, ps.xr, ps.faceMe, ps.h, ps.v, ps.ang, ps.tl, ps.dvStep, ps.level, ps.planet, ps.show, ps.scale, ps.thrHeld, ps.noteLines, ps.frameHot, ps.dvUsed.toFixed(3), ps.mission.cur && ps.mission.cur.id, ps.mission.stage, ps.mission.choice, [...sim.done], palName]) + '|' + hover + '|' + Object.keys(held).join() + '|' + (ui.flashUntil > now ? ui.flash : '');
    if (!force && sig === panelSig) return;
    if (!force && now - lastPanelDraw < 80 && !(ui.xr === null)) return;   // in XR massimo ~12 Hz (il caricamento della texture costa)
    panelSig = sig; lastPanelDraw = now;
    layout = XRPanel.build(ps);
    XRPanel.draw(uiCtx, layout, { frameHot: ps.frameHot }, hover, held, ui.flashUntil > now ? ui.flash : null, C);
    uiTex.needsUpdate = true;
    XRPanel.drawFab(fabCtx(), XRPanel.FAB, hover, C); fabTex.needsUpdate = true;
  }
  let _fabCtx = null; const fabCtx = () => _fabCtx || (_fabCtx = fabCanvas.getContext('2d'));

  // ---------- azioni ----------
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
  const holdName = id => id.slice(4);
  function holdStart(id) { held[id] = true; sim.thrDown(holdName(id), performance.now()); }
  function holdEnd(id) { if (held[id]) { delete held[id]; sim.thrUp(holdName(id)); } }
  function doAction(id) {
    const m = /^([hva])([+-]\d*\.?\d+)$/.exec(id) || /^([hva])=([\w.]+)$/.exec(id);
    if (m) {
      const k = m[1] === 'a' ? 'ang' : m[1], val = m[2];
      if (id.indexOf('=') > 0) S[k] = val === 'vc' ? CORE.vc(S.h) : val === 'vesc' ? CORE.vesc(S.h) : +val;
      else S[k] = (+S[k]) + +val;
      if (id === 'h-' || id === 'h+') S.h += 0;
      sim.launchChanged(); persist(); return;
    }
    if (id === 'h-' || id === 'h+') { S.h = Math.round((S.h + (id === 'h+' ? 0.05 : -0.05)) * 100) / 100; sim.launchChanged(); persist(); return; }
    if (id.indexOf('tab:') === 0) { ui.tab = id.slice(4); return; }
    if (id.indexOf('show:') === 0) { const k = id.slice(5); S.show[k] = !S.show[k]; lastSigO = ''; return; }
    if (id.indexOf('dv=') === 0) { S.dvStep = +id.slice(3); return; }
    if (id.indexOf('scl:') === 0) { S.scale = id.slice(4); return; }
    if (id.indexOf('lv:') === 0) { sim.setLevel(+id.slice(3)); persist(); return; }
    if (id.indexOf('pl:') === 0) { S.planet = id.slice(3); persist(); return; }
    if (id.indexOf('mis:') === 0) { sim.missionOpen(+id.slice(4)); return; }
    if (id.indexOf('misopt:') === 0) { sim.missionPick(+id.slice(7)); lastSigO = ''; return; }
    switch (id) {
      case 'launch': sim.launch(); lastSigO = ''; break;
      case 'reset': sim.resetFlight(true); lastSigO = ''; break;
      case 'play': sim.togglePlay(); break;
      case 'step': sim.step(); break;
      case 'spd-': case 'spd+': { const L = XRPanel.SPEEDS, i = clamp(L.indexOf(S.speed) + (id === 'spd+' ? 1 : -1), 0, L.length - 1); S.speed = L[i]; break; }
      case 'tl-': S.tl = clamp(Math.round((S.tl - 0.02) * 100) / 100, 0.02, 1); break;
      case 'tl+': S.tl = clamp(Math.round((S.tl + 0.02) * 100) / 100, 0.02, 1); break;
      case 'ghostclear': S.ghosts = []; _lastGhost.n = -1; toast('Ghost trails cleared'); break;
      case 'misback': sim.missionOpen(sim.M.id); break;
      case 'misagain': sim.missionAgain(); lastSigO = ''; break;
      case 'misexplain': sim.missionExplain(); break;
      case 'recenter': recenter(); break;
      case 'face': ui.faceMe = !ui.faceMe; break;
      case 'view': setView(ui.view === 'ship' ? 'planet' : 'ship'); break;
      case 'exit': if (xrSession) xrSession.end(); break;
      case 'hide': ui.hidden = true; break;
      case 'menu': ui.hidden = false; break;
      default: break;
    }
  }
  function press(id) {   // pressione singola (clic, poke, trigger sul pulsante)
    const it = layout && layout.items.find(i => i.id === id); if (it && it.off) return;
    if (id.indexOf('thr:') === 0) { sim.thrDown(holdName(id), performance.now()); sim.thrUp(holdName(id)); return; }   // clic breve = un passo di Δv
    ui.flash = id; ui.flashUntil = performance.now() + 140;
    doAction(id); panelSig = '';
  }
  function recenter() {
    const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
    const cp = camera.getWorldPosition(new THREE.Vector3());
    if (ui.view === 'planet') {
      frameRoot.position.copy(cp).addScaledVector(d, 0.9); frameRoot.position.y = cp.y - 0.1; frameRoot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-d.x, -d.z)); frameRoot.scale.setScalar(FRAME_SCALE);
      const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(-1);
      ctlPanel.position.copy(cp).addScaledVector(d, 0.55).addScaledVector(side, -0.42); ctlPanel.position.y = cp.y - 0.2; ctlPanel.scale.setScalar(1);
    }
    ctlPanel.lookAt(cp.x, ctlPanel.position.y, cp.z);
  }

  // ---------- ingressi desktop ----------
  const uiPx = e => { const r = uiCanvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * XRPanel.W, (e.clientY - r.top) / r.height * XRPanel.H]; };
  const itemAt = (px) => { if (!layout) return null; for (let i = layout.items.length - 1; i >= 0; i--) { const it = layout.items[i]; if ((it.kind === 'btn' || it.kind === 'slider') && !it.hidden && px[0] >= it.x && px[0] <= it.x + it.w && px[1] >= it.y && px[1] <= it.y + it.h) return it; } return null; };
  let uiDrag = null;
  uiCanvas.addEventListener('pointerdown', e => {
    const it = itemAt(uiPx(e)); if (!it || it.off) return;
    uiCanvas.setPointerCapture(e.pointerId);
    if (it.kind === 'slider') { uiDrag = it; scrubTo(uiPx(e)); }
    else if (it.hold) { uiDrag = it; holdStart(it.id); } else press(it.id);
    refreshPanel(true);
  });
  uiCanvas.addEventListener('pointermove', e => {
    const px = uiPx(e); if (uiDrag && uiDrag.kind === 'slider') scrubTo(px);
    const it = itemAt(px); const h = it && !it.off ? it.id : null; if (h !== hover) { hover = h; refreshPanel(true); }
  });
  const upDrag = () => { if (uiDrag && uiDrag.hold) holdEnd(uiDrag.id); uiDrag = null; refreshPanel(true); };
  uiCanvas.addEventListener('pointerup', upDrag); uiCanvas.addEventListener('pointercancel', upDrag);
  function scrubTo(px) { const it = layout.items.find(i => i.kind === 'slider'); scrubValue(Math.min(1, Math.max(0, (px[0] - it.x - 14) / (it.w - 28)))); }
  function scrubValue(v) { if (S.phase === 'flying') sim.setCursor(v * (sim.H.n - 1)); }
  const KEYMAP = { w: 'pro', s: 'retro', d: 'out', a: 'in' };
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) { if (!e.repeat) holdStart('thr:' + KEYMAP[k]); e.preventDefault(); }
    else if (e.key === ' ') { e.preventDefault(); sim.togglePlay(); } else if (k === 'r') doAction('reset'); else if (k === 'v') doAction('view');
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.key.toLowerCase()]; if (k) holdEnd('thr:' + k); });
  addEventListener('blur', () => { for (const id of Object.keys(held)) holdEnd(id); });

  // camera sul desktop: esterna = orbita attorno al pianeta, nave = sguardo libero dalla cabina
  const dcam = { yaw: 0.35, pitch: 0.2, dist: 1.5, lyaw: 0, lpitch: 0 };
  (function () {
    let down = null;
    const cvs = renderer.domElement;
    cvs.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; cvs.setPointerCapture(e.pointerId); });
    cvs.addEventListener('pointermove', e => {
      if (!down || renderer.xr.isPresenting) return;
      const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = [e.clientX, e.clientY];
      if (ui.view === 'planet') { dcam.yaw -= dx * 0.006; dcam.pitch = clamp(dcam.pitch + dy * 0.006, -1.4, 1.4); }
      else { dcam.lyaw -= dx * 0.004; dcam.lpitch = clamp(dcam.lpitch - dy * 0.004, -1.4, 1.4); }
    });
    cvs.addEventListener('pointerup', () => { down = null; });
    cvs.addEventListener('wheel', e => { e.preventDefault(); dcam.dist = clamp(dcam.dist * Math.exp(e.deltaY * 0.0015), 0.35, 6); }, { passive: false });
  })();
  function desktopCamera() {
    if (ui.view === 'planet') {
      const T = frameRoot.position, cp = Math.cos(dcam.pitch);
      camera.position.set(T.x + dcam.dist * Math.sin(dcam.yaw) * cp, T.y + dcam.dist * Math.sin(dcam.pitch), T.z + dcam.dist * Math.cos(dcam.yaw) * cp); camera.lookAt(T); camera.fov = 45;
    } else { camera.position.copy(HEAD); camera.rotation.set(dcam.lpitch, dcam.lyaw, 0, 'YXZ'); camera.fov = 75; }
    camera.updateProjectionMatrix();
  }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || renderer.xr.isPresenting) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); addEventListener('resize', resize);

  // ---------- WebXR: mani e controller (stessa impostazione di Superfici 3D) ----------
  const grab = new Grab.GrabController(THREE, {});
  const tracker = new Pointer.Tracker({ holdMs: 99999 });
  const poke = new XRPanel.Poke();
  const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)], ctrls = [renderer.xr.getController(0), renderer.xr.getController(1)];
  hands.forEach(h => scene.add(h));
  const rays = [0, 1].map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xfacc15 })); l.visible = false; return l; });
  const dots = [0, 1].map(() => { const d = new THREE.Mesh(new THREE.SphereBufferGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); d.visible = false; scene.add(d); return d; });
  const GP = { A: 4, B: 5, STICK: 3 };    // xr-standard dei Touch: 4 = A/X, 5 = B/Y, 3 = stick premuto — DA VERIFICARE sulla Quest (?monitor=1)
  ctrls.forEach((c, i) => {
    scene.add(c); c.add(rays[i]);
    c.userData = { kind: null, trig: false, sq: false, pinch: false, near: false, gp: null, btn: [], axes: [], handed: null, buzzT: 0 };
    c.addEventListener('connected', e => { c.userData.kind = e.data && e.data.hand ? 'hand' : 'controller'; c.userData.gp = (e.data && e.data.gamepad) || null; c.userData.handed = (e.data && e.data.handedness) || null; });
    c.addEventListener('disconnected', () => { Object.assign(c.userData, { kind: null, trig: false, sq: false, gp: null, btn: [] }); });
    c.addEventListener('selectstart', () => { if (c.userData.kind === 'controller') c.userData.trig = true; });
    c.addEventListener('selectend', () => { c.userData.trig = false; });
    c.addEventListener('squeezestart', () => { if (c.userData.kind === 'controller') c.userData.sq = true; });
    c.addEventListener('squeezeend', () => { c.userData.sq = false; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6), handMats = [new THREE.MeshBasicMaterial({ color: 0xf8fafc }), new THREE.MeshBasicMaterial({ color: 0xf8fafc })];
  const NEED = ['wrist', 'thumb-tip', 'index-finger-tip', 'index-finger-metacarpal', 'pinky-finger-metacarpal', 'middle-finger-metacarpal'];
  const _f = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4();
  function readHand(i) {
    const h = hands[i], c = ctrls[i], J = h.joints || {};
    for (const n of NEED) if (!J[n] || !J[n].visible) return { id: 'h' + i, ci: i, active: false };
    for (const k in J) { const jt = J[k]; if (!jt.userData.vis) { const m = new THREE.Mesh(jointGeo, handMats[i]); jt.add(m); jt.userData.vis = m; } jt.userData.vis.scale.setScalar(jt.jointRadius || 0.008); }
    const th = J['thumb-tip'].position, ix = J['index-finger-tip'].position, dist = th.distanceTo(ix);
    c.userData.pinch = Grab.pinchUpdate(c.userData.pinch, dist); c.userData.near = dist < 0.04;
    handMats[i].color.setHex(c.userData.pinch ? 0x34d399 : 0xf8fafc);
    _f.copy(J['middle-finger-metacarpal'].position).sub(J['wrist'].position).normalize();
    _s.copy(J['index-finger-metacarpal'].position).sub(J['pinky-finger-metacarpal'].position); _s.addScaledVector(_f, -_s.dot(_f)).normalize(); _u.crossVectors(_f, _s); _m.makeBasis(_s, _u, _f);
    return { id: 'h' + i, ci: i, active: true, pinching: c.userData.pinch, pos: th.clone().add(ix).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromRotationMatrix(_m), tip: ix.clone() };
  }
  function readSources() {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const c = ctrls[i];
      if (c.userData.kind === 'hand') out.push(readHand(i));
      else if (c.userData.kind === 'controller') out.push({ id: 'c' + i, ci: i, active: true, pinching: c.userData.sq, pos: c.position.clone(), quat: c.quaternion.clone() });
    }
    return out;
  }
  function buzz(c, k, ms) { const gp = c.userData.gp; if (!gp) return; try { const a = gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) a.pulse(k, ms); else if (gp.vibrationActuator && gp.vibrationActuator.playEffect) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: k, weakMagnitude: k }); } catch (e) { /* non supportata */ } }

  // pulsanti dei controller: A/B (destro) = prograde/retrograde, X/Y (sinistro) = radiale fuori/dentro, stick premuto = mostra/nascondi pannello
  function pollGamepads(now) {
    ctrls.forEach((c, i) => {
      const u = c.userData, gp = u.gp; if (!gp || u.kind !== 'controller') return;
      const cur = Array.prototype.map.call(gp.buttons || [], b => !!(b && b.pressed)), right = u.handed !== 'left';
      const map = [[GP.A, right ? 'pro' : 'out'], [GP.B, right ? 'retro' : 'in']];
      for (const [bi, name] of map) {
        if (cur[bi] && !u.btn[bi]) { sim.thrDown(name, now); held['gp' + i + name] = true; }
        if (!cur[bi] && u.btn[bi]) { sim.thrUp(name); delete held['gp' + i + name]; }
        if (cur[bi] && sim.thrBurning(name) && now - u.buzzT > 90) { buzz(c, 0.25, 50); u.buzzT = now; }
      }
      if (cur[GP.STICK] && !u.btn[GP.STICK]) ui.hidden = !ui.hidden;
      u.btn = cur; u.axes = Array.prototype.slice.call(gp.axes || []);
    });
  }

  const _inv = new THREE.Matrix4(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _tip = new THREE.Vector3(), _lp = new THREE.Vector3();
  const uiMeshes = () => ui.hidden ? [{ mesh: fab, layout: XRPanel.FAB, kind: 'fab' }] : [{ mesh: ctlPanel, layout: layout, kind: 'ctl' }];
  function rayTarget(o, d) {
    let best = null;
    for (const u of uiMeshes()) {
      if (!u.layout) continue;
      u.mesh.updateMatrixWorld(true); _inv.copy(u.mesh.matrixWorld).invert();
      const h = XRPanel.rayHit(_inv.elements, o.toArray(), d.toArray()); if (!h) continue;
      const t = h.t * u.mesh.scale.x, it = XRPanel.hit(u.layout, h.x, h.y, ['btn', 'slider']);
      if (it && !it.off && (!best || t < best.t)) best = { id: 'btn:' + it.id, item: it, t: t, point: o.clone().addScaledVector(d, t).toArray(), mesh: u.mesh, layout: u.layout, hx: h.x };
    }
    return best;
  }
  const holdFrom = {};
  function updatePointers(src, now) {
    for (let i = 0; i < 2; i++) { rays[i].visible = false; dots[i].visible = false; }
    let hov = null;
    src.forEach(s => {
      const c = ctrls[s.ci], u = c.userData, isHand = u.kind === 'hand';
      if (!s.active || !c.visible) { tracker.update(s.id, { down: false, near: false, target: null }, now); if (holdFrom[s.id]) { holdEnd(holdFrom[s.id]); delete holdFrom[s.id]; } return; }
      c.getWorldPosition(_o); _d.set(0, 0, -1).transformDirection(c.matrixWorld);
      const tg = rayTarget(_o, _d), grabbing = !!(grab.s[s.id] && grab.s[s.id].grab), down = isHand ? u.pinch : u.trig;
      const ev = tracker.update(s.id, { down: down, near: isHand ? u.near : false, target: tg && tg.id, point: tg && tg.point, grabbing: grabbing }, now);
      if (ev.down && ev.down.indexOf('btn:') === 0) {
        const id = ev.down.slice(4), it = tg && tg.item;
        if (it && it.kind === 'slider') holdFrom[s.id] = 'scrub';
        else if (it && it.hold) { holdStart(id); holdFrom[s.id] = id; } else press(id);
        buzz(c, 0.3, 25);
      }
      if (holdFrom[s.id] === 'scrub' && down && tg && tg.item.kind === 'slider') scrubValue(XRPanel.sliderValue(tg.layout, tg.item, tg.hx));
      if (!down && holdFrom[s.id]) { if (holdFrom[s.id] !== 'scrub') holdEnd(holdFrom[s.id]); delete holdFrom[s.id]; }
      if (tg && !grabbing) hov = tg.id.slice(4);
      const ray = rays[s.ci], dot = dots[s.ci];
      ray.visible = !grabbing && (!isHand || !!tg); ray.scale.z = tg ? tg.t : 0.5; ray.material.color.setHex(down ? 0x34d399 : 0xfacc15);
      if (tg && !grabbing) { dot.visible = true; dot.position.fromArray(tg.point); }
    });
    // dito indice (mani): poke
    src.forEach(s => {
      if (!s.active || !s.tip || ctrls[s.ci].userData.kind !== 'hand') return;
      for (const u of uiMeshes()) {
        if (!u.layout) continue;
        u.mesh.updateMatrixWorld(true); _lp.copy(s.tip); u.mesh.worldToLocal(_lp);
        const r = poke.update(s.id + u.kind, { x: _lp.x, y: _lp.y, z: _lp.z }, s.pinching, u.layout, u.mesh.scale.x);
        if (r.hover) hov = r.hover;
        if (r.press) { press(r.press); buzz(ctrls[s.ci], 0.3, 25); }
        if (r.slide) scrubValue(r.slide.value);
      }
    });
    hover = hov;
  }
  // oggetto afferrabile vicino a un punto (priorità: pannello, quadro, finestrella, pianeta)
  const _l = new THREE.Vector3();
  function pick(pos) {
    if (layout && !ui.hidden) { ctlPanel.updateMatrixWorld(true); _l.copy(pos); ctlPanel.worldToLocal(_l); if (Math.abs(_l.z * ctlPanel.scale.x) < 0.06 && XRPanel.inFrame(layout, _l.x, _l.y, 0.02)) return ctlPanel; }
    if (ui.hidden) { fab.updateMatrixWorld(true); _l.copy(pos); fab.worldToLocal(_l); if (Math.abs(_l.z) < 0.05 && Math.abs(_l.x) < XRPanel.FAB.W * XRPanel.MPP / 2 + 0.02 && Math.abs(_l.y) < XRPanel.FAB.H * XRPanel.MPP / 2 + 0.02) return fab; }
    for (const [m, w, h, mpp] of [[hudMesh, HUD.W, HUD.H, HUD.MPP], [pipMesh, PIP.W, PIP.H, PIP.MPP]]) {
      if (!m.visible) continue; m.updateMatrixWorld(true); _l.copy(pos); m.worldToLocal(_l);
      if (Math.abs(_l.z * m.scale.x) < 0.05 && Math.abs(_l.x) < w * mpp / 2 + 0.02 && Math.abs(_l.y) < h * mpp / 2 + 0.02) return m;
    }
    if (ui.view === 'planet') { frameRoot.updateMatrixWorld(true); _l.copy(pos); frameRoot.worldToLocal(_l); if (_l.length() < 1.3 + 0.05 / frameRoot.scale.x) return frameRoot; }
    return null;
  }

  // ---------- sessioni XR ----------
  let xrSession = null;
  const xrOk = {}, vrBtn = $('vrBtn'), arBtn = $('arBtn'), note = $('vrnote');
  const XR_LABEL = { 'immersive-vr': ['Enter VR · ship view', 'Leave VR'], 'immersive-ar': ['Enter AR · outside view', 'Leave AR'] };
  function syncXrButtons() {
    for (const [m, b] of [['immersive-vr', vrBtn], ['immersive-ar', arBtn]]) {
      b.disabled = !xrOk[m] || (!!xrSession && ui.xr !== m);
      b.querySelector('.lbl').textContent = XR_LABEL[m][ui.xr === m ? 1 : 0];
    }
  }
  (async function initXR() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) { vrBtn.disabled = arBtn.disabled = true; note.textContent = 'WebXR is not available in this browser. On the Quest open the page in the Quest Browser; on a computer use the Immersive Web Emulator. The page works on screen without a headset.'; return; }
    for (const m of ['immersive-vr', 'immersive-ar']) { try { xrOk[m] = await navigator.xr.isSessionSupported(m); } catch (e) { xrOk[m] = false; } }
    syncXrButtons();
    if (!xrOk['immersive-vr']) note.textContent = 'Immersive sessions are not available here (embedded previews often block them).';
  })();
  async function startXR(mode) {
    if (xrSession) { xrSession.end(); return; }
    const ar = mode === 'immersive-ar';
    try {
      renderer.xr.setReferenceSpaceType('local-floor');
      const sess = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      xrSession = sess; ui.xr = mode;
      sess.addEventListener('end', () => {
        xrSession = null; ui.xr = null; savePoses(ui.view); setView('planet'); applyPalette(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); poke.reset(); tracker.reset();
        for (const id of Object.keys(held)) holdEnd(id); document.body.classList.remove('inxr'); syncXrButtons(); resize();
      });
      await renderer.xr.setSession(sess);
      applyPalette(ar ? 'light' : 'dark');
      frameRoot.position.copy(HOME); frameRoot.quaternion.identity(); frameRoot.scale.setScalar(FRAME_SCALE); outPose.p.copy(HOME); outPose.q.identity(); outPose.s = FRAME_SCALE;
      ui.view = ar ? 'ship' : 'planet'; setView(ar ? 'planet' : 'ship');   // AR: vista esterna; VR: dalla nave
      if (ar) applyPoses('planet');
      ui.hidden = false; document.body.classList.add('inxr'); syncXrButtons(); updateBackground(); panelSig = '';
    } catch (err) { xrSession = null; ui.xr = null; syncXrButtons(); note.textContent = 'Could not start the ' + (ar ? 'AR' : 'VR') + ' session: ' + err.message; }
  }
  vrBtn.addEventListener('click', () => startXR('immersive-vr')); arBtn.addEventListener('click', () => startXR('immersive-ar'));

  // ---------- DOM ----------
  function syncDom() {
    document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === ui.view));
    $('pipbox').hidden = !(S.show.cam && ui.view === 'planet') || !!ui.xr;
    document.body.dataset.view = ui.view;
  }
  document.querySelectorAll('#viewSeg button').forEach(b => b.onclick = () => setView(b.dataset.v));
  $('helpBtn').onclick = () => $('help').showModal(); $('helpClose').onclick = () => $('help').close();
  $('themeBtn').onclick = () => applyPalette(palName === 'dark' ? 'light' : 'dark');

  // ---------- ciclo ----------
  const failed = {};
  function safe(name, fn) { try { return fn(); } catch (err) { if (!failed[name]) { failed[name] = true; console.error('Error in ' + name + ':', err); note.textContent = 'Error in ' + name + ': ' + err.message; } return null; } }
  let tPrev = performance.now(), frameN = 0, missionT = 0;
  const _bp = new THREE.Vector3();
  renderer.setAnimationLoop(function () {
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now; frameN++;
    const presenting = renderer.xr.isPresenting;
    safe('simulazione', () => { sim.update(dt, now); F = frameState(); });
    if (!F) return;
    const th = safe('mondo', () => updateWorld(dt));
    while (sim.events.length) toast(sim.events.shift());
    if (frameN % 8 === 0) safe('missioni', () => { if (sim.missionCheck()) { panelSig = ''; persist(); } });
    // pannelli: nel visore sono nella scena, sul desktop stanno nel DOM
    ctlPanel.visible = presenting && !ui.hidden; fab.visible = presenting && ui.hidden; hudMesh.visible = presenting && S.show.bars !== undefined && (ui.view === 'ship' || true);
    pipMesh.visible = presenting && S.show.cam && ui.view === 'planet';
    if (presenting) {
      scene.updateMatrixWorld(true);
      const src = readSources();
      safe('presa', () => grab.update(src, dt, pick));
      safe('pulsanti', () => pollGamepads(now));
      safe('puntatore', () => updatePointers(src, now));
      ui.hot = grab.target === ctlPanel ? 'ctl' : null;
      if (ui.view === 'planet' && grab.target === frameRoot) { outPose.p.copy(frameRoot.position); }
      if (ui.faceMe && grab.target !== ctlPanel) ctlPanel.lookAt(camera.position.x, ctlPanel.position.y, camera.position.z);
      if (ui.hidden && grab.target !== fab) { if (fab.userData.placed !== 1) { fab.position.copy(ctlPanel.position); fab.userData.placed = 1; } }
      if (!ui.hidden) { fab.userData.placed = 0; fab.position.copy(ctlPanel.position); fab.quaternion.copy(ctlPanel.quaternion); }
      if (ui.hidden && grab.target !== ctlPanel) { ctlPanel.position.copy(fab.position); ctlPanel.quaternion.copy(fab.quaternion); }
    } else { safe('camera', desktopCamera); hover = hover; }
    safe('pannello', () => refreshPanel(false));
    // quadro e finestrella
    if (frameN % 4 === 0) safe('quadro', () => { Hud.draw(hudCtx, HUD.W, HUD.H, F, sim, C); hudTex.needsUpdate = true; });
    if ((S.show.cam && ui.view === 'planet') && frameN % 3 === 0) safe('ship cam', () => { Hud.drawCam(pipCtx, PIP.W, PIP.H, F, 0.05, C); pipTex.needsUpdate = true; });
    if (frameN % 10 === 0) syncDom();
    renderer.render(scene, camera);
  });
  F = frameState(); resize(); syncDom(); updateBackground(); applyPalette(palName); refreshPanel(true);
  window.__app = { sim: sim, ui: ui, scene: scene, camera: camera, renderer: renderer, frameRoot: frameRoot, world: world, ctlPanel: ctlPanel, fab: fab, hudMesh: hudMesh, pipMesh: pipMesh, shipG: shipG, grab: grab,
    doAction: doAction, press: press, holdStart: holdStart, holdEnd: holdEnd, setView: setView, pick: pick, rayTarget: rayTarget, updatePointers: updatePointers, readSources: readSources, ctrls: ctrls,
    getF: () => F, dcam: dcam, getLayout: () => layout, applyPalette: applyPalette, placeShipFrame: placeShipFrame, refreshPanel: refreshPanel, orbitRib: orbitRib, trailRib: trailRib, CAB: CAB, navPro: navPro, cabin: cabin, poke: poke };
})();
