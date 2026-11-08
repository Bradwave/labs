/* app.js — M3: sistema di riferimento, superfici indipendenti, piano di sezione, snapping, pannello 2D. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const D2R = Math.PI / 180;
  const FR = 2.5;            // semilato del sistema di riferimento (unità)
  const PR = 2.5;            // semilato del piano di sezione (unità)
  const SNAP_ANG = 6 * D2R;  // tolleranza angolare di snapping
  const SNAP_STEP = 0.25;    // passo dello snapping di posizione (unità)
  const DEF_SCALE = 0.16;    // metri per unità
  const Z = new THREE.Vector3(0, 0, 1);

  // ---------- scena ----------
  const scene = new THREE.Scene();
  const BG = new THREE.Color(dark ? 0x0d3a33 : 0xf6fbf9);   // come la superficie delle schede della pagina
  scene.background = BG;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 60);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha: serve alla realtà mista (passthrough)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.xr.enabled = true;
  renderer.localClippingEnabled = true;
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
  $('view').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x334055 : 0x9aa7b8, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(1.5, 3, 2);
  scene.add(sun);
  const floorGrid = new THREE.GridHelper(4, 16, dark ? 0x2f7568 : 0x8fc2b4, dark ? 0x1f5046 : 0xc3ddd5);
  scene.add(floorGrid);

  // frameRoot = sistema di riferimento (afferrabile: sposta tutta la scena). mathG: z matematico = verticale.
  const frameRoot = new THREE.Group();
  const HOME = new THREE.Vector3(0, 1.3, -0.7);
  frameRoot.position.copy(HOME);
  frameRoot.scale.setScalar(DEF_SCALE);
  frameRoot.userData.grab = { scalable: true, min: 0.04, max: 0.5, kind: 'frame' };
  scene.add(frameRoot);
  const mathG = new THREE.Group();
  mathG.rotation.x = -Math.PI / 2;
  frameRoot.add(mathG);
  const axesG = new THREE.Group();
  mathG.add(axesG);

  function label(text, color, size) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.font = '600 78px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = dark ? '#0d1218' : '#ffffff'; g.strokeText(text, 128, 68);
    g.fillStyle = color; g.fillText(text, 128, 68);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(size * 2, size, 1);
    sp.renderOrder = 10;
    return sp;
  }
  const fmtAx = v => (Math.round(v * 100) / 100).toString().replace('-', '−');
  const frameBoxMat = new THREE.LineBasicMaterial({ color: dark ? 0x56637a : 0x8a97ab, transparent: true, opacity: 0.5 });
  const FRAME_BOX_COLOR = frameBoxMat.color.getHex();
  (function buildAxes() {
    const cols = [0xd55e00, 0x009e73, 0x0072b2], css = ['#d55e00', '#009e73', '#0072b2'];   // vermiglio, verde bluastro, blu (Okabe-Ito); gli assi hanno anche la lettera
    const step = Core.tickStep(FR), tk = FR * 0.03;
    for (let a = 0; a < 3; a++) {
      const e = [0, 0, 0]; e[a] = 1;
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-FR * e[0], -FR * e[1], -FR * e[2], FR * e[0], FR * e[1], FR * e[2]]), 3));
      axesG.add(new THREE.Line(gg, new THREE.LineBasicMaterial({ color: cols[a] })));
      const side = [0, 0, 0]; side[(a + 1) % 3] = 1;
      const tp = [];
      for (let v = -Math.floor(FR / step) * step; v <= FR + 1e-9; v += step) {
        if (Math.abs(v) < 1e-9) continue;
        tp.push(e[0] * v - side[0] * tk, e[1] * v - side[1] * tk, e[2] * v - side[2] * tk, e[0] * v + side[0] * tk, e[1] * v + side[1] * tk, e[2] * v + side[2] * tk);
        const lb = label(fmtAx(v), css[a], FR * 0.1);
        lb.position.set(e[0] * v + side[0] * tk * 4.5, e[1] * v + side[1] * tk * 4.5, e[2] * v + side[2] * tk * 4.5);
        axesG.add(lb);
      }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tp), 3));
      axesG.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: cols[a] })));
      const nm = label(['x', 'y', 'z'][a], css[a], FR * 0.2);
      nm.position.set(e[0] * FR * 1.1, e[1] * FR * 1.1, e[2] * FR * 1.1);
      axesG.add(nm);
    }
    axesG.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * FR, 2 * FR, 2 * FR)), frameBoxMat));
  })();

  // ---------- piano di sezione (figlio del sistema di riferimento) ----------
  const planeG = new THREE.Group();
  planeG.userData.grab = { scalable: false, kind: 'plane' };
  planeG.position.set(0, 0, 0.5);
  mathG.add(planeG);
  const planeMat = new THREE.MeshBasicMaterial({ color: 0xf0e442, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * PR, 2 * PR), planeMat);
  planeMesh.renderOrder = 2;
  planeG.add(planeMesh);
  const planeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(planeMesh.geometry), new THREE.LineBasicMaterial({ color: 0xd9a400 }));
  planeG.add(planeEdge);
  const planeGrid = new THREE.GridHelper(2 * PR, 10, 0xd9a400, dark ? 0x7a6a10 : 0xd9c24a);
  planeGrid.rotation.x = Math.PI / 2; planeGrid.material.transparent = true; planeGrid.material.opacity = 0.5;
  planeG.add(planeGrid);
  [[1, 0, 0xe69f00, 'u'], [0, 1, 0xcc79a7, 'v']].forEach(a => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.003, a[0] * PR, a[1] * PR, 0.003]), 3));
    planeG.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: a[2] })));
    const lb = label(a[3], '#' + a[2].toString(16), 0.4); lb.position.set(a[0] * (PR + 0.25), a[1] * (PR + 0.25), 0); planeG.add(lb);
  });
  const eqCanvas = document.createElement('canvas'); eqCanvas.width = 640; eqCanvas.height = 96;
  const eqTex = new THREE.CanvasTexture(eqCanvas);
  const eqSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: eqTex, depthTest: false, transparent: true }));
  eqSprite.scale.set(1.9, 0.285, 1); eqSprite.position.set(0, -PR - 0.3, 0); eqSprite.renderOrder = 11;
  planeG.add(eqSprite);

  // ---------- superfici (ciascuna con la propria trasformazione nel sistema di riferimento) ----------
  // f = colore della superficie (Okabe-Ito, distinguibili anche con il daltonismo); r = curva di sezione, scura per leggersi sul piano giallo
  const PALETTE = [{ f: 0x0072b2, r: 0xd55e00 }, { f: 0xd55e00, r: 0x0b3d91 }, { f: 0x56b4e9, r: 0x6a1b9a }, { f: 0xcc79a7, r: 0x00574a }, { f: 0x009e73, r: 0x8c1c13 }, { f: 0x8a8a8a, r: 0x111111 }];
  const BACK_COLOR = 0xf2efe6;   // retro (dove F decresce): crema neutra, mai presente tra i colori delle superfici
  const CAP = 3000;
  const surfaces = [];
  let selected = null, nextId = 1;
  const clipPlane = new THREE.Plane();
  let clipOn = true, clipSide = 1, planeOn = true;  // planeOn: piano di sezione attivo (se spento: né piano, né curva, né taglio)
  let dirty = true;
  const isCone = eq => /^(x\^2\+y\^2=z\^2|x²\+y²=z²|z\^2=x\^2\+y\^2|z²=x²\+y²)$/.test(eq.replace(/\s+/g, '').toLowerCase());

  function makeRibbon(color) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAP * 4 * 3), 3));
    const idx = new Uint16Array(CAP * 6);
    for (let i = 0; i < CAP; i++) { const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6); }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.frustumCulled = false; m.position.z = 0.004; m.renderOrder = 3;
    planeG.add(m);
    return m;
  }

  // dominio: scatola [x0,x1,y0,y1,z0,z1] per ogni superficie implicita (un preset dà il cubo [-R,R]³); parametri: { a: {v, min, max} }
  const boundsOf = pr => { if (pr.b && pr.b.length === 6) return pr.b.slice(); const R = pr.R || 2; return [-R, R, -R, R, -R, R]; };
  const paramsOfPreset = pr => { const o = {}; Object.keys(pr.params || {}).forEach(k => { o[k] = { v: pr.params[k][0], min: pr.params[k][1], max: pr.params[k][2] }; }); return o; };
  const parVals = q => { const o = {}; Object.keys(q.params || {}).forEach(k => { o[k] = q.params[k].v; }); return o; };
  function syncParams(q, names) { // tiene i parametri dell'equazione attuale (con i loro valori) e aggiunge i nuovi con i valori predefiniti
    const o = {}; names.forEach(k => { o[k] = (q.params && q.params[k]) || { v: Core.DEF_PARAM[0], min: Core.DEF_PARAM[1], max: Core.DEF_PARAM[2] }; }); q.params = o;
  }
  const halfOf = b => Math.max(Math.abs(b[0]), Math.abs(b[1]), Math.abs(b[2]), Math.abs(b[3]), Math.abs(b[4]), Math.abs(b[5]));
  function addSurface(ref) {
    if (surfaces.length >= PALETTE.length) { setStatus('Massimo ' + PALETTE.length + ' superfici nella scena: eliminane una.', true); return null; }
    const used = surfaces.map(s => s.pal);
    let pal = 0; while (used.indexOf(pal) >= 0) pal++;
    const p = typeof ref === 'string' ? Core.presetById(ref) : (ref || Core.presetById('cono'));
    const group = new THREE.Group();
    group.userData.grab = { scalable: true, min: 0.15, max: 6, kind: 'surface' };
    const frontMat = new THREE.MeshStandardMaterial({ color: PALETTE[pal].f, roughness: 0.55, side: THREE.FrontSide });
    const backMat = new THREE.MeshStandardMaterial({ color: BACK_COLOR, roughness: 0.55, side: THREE.BackSide });
    const front = new THREE.Mesh(new THREE.BufferGeometry(), frontMat), back = new THREE.Mesh(front.geometry, backMat);
    front.frustumCulled = back.frustumCulled = false;
    const box = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: PALETTE[pal].f, transparent: true, opacity: 0.35 }));
    group.add(front, back, box);
    mathG.add(group);
    const s = { id: nextId++, pal: pal, name: p.name, presetId: p.id, kind: p.kind, eq: p.eq || '', R: p.R || 2, bounds: boundsOf(p), params: paramsOfPreset(p),
      fx: p.fx || '', fy: p.fy || '', fz: p.fz || '', u0: p.u0 || '0', u1: p.u1 || '2*pi', v0: p.v0 || '0', v1: p.v1 || '2*pi',
      N: p.N || 48, cone: !!p.cone, twoSided: !!p.twoSided, visible: true, group: group,
      frontMat: frontMat, backMat: backMat, front: front, back: back, box: box, samples: null, fn: null, grid: null, bbox: null, tris: 0,
      ribbon: makeRibbon(PALETTE[pal].r), section: { segs: new Float32Array(0), cls: { kind: 'none', name: '—' } }, lastM: new THREE.Matrix4() };
    surfaces.push(s);
    rebuild(s);
    applyClipFlag();
    select(s);
    return s;
  }

  function setBoxGeom(s, bb) { // riquadro del dominio (linee)
    s.box.geometry.dispose();
    if (isFinite(bb[0])) {
      const bg = new THREE.BoxGeometry(Math.max(bb[3] - bb[0], 0.01), Math.max(bb[4] - bb[1], 0.01), Math.max(bb[5] - bb[2], 0.01));
      bg.translate((bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2);
      s.box.geometry = new THREE.EdgesGeometry(bg); bg.dispose();
    } else s.box.geometry = new THREE.BufferGeometry();
  }
  function rebuild(s, Nover) { // ricalcola la mesh nel sistema locale della superficie (implicita o parametrica); Nover = risoluzione ridotta durante i trascinamenti
    const t0 = performance.now(), N = Nover || s.N;
    let m, bb;
    if (s.kind === 'param') {
      const c = Core.compileParam(s.fx, s.fy, s.fz, parVals(s)); syncParams(s, c.params);
      const u0 = Core.evalNumber(s.u0), u1 = Core.evalNumber(s.u1), v0 = Core.evalNumber(s.v0), v1 = Core.evalNumber(s.v1);
      if (!(u1 > u0) || !(v1 > v0)) throw new Error('Gli intervalli devono avere minimo < massimo.');
      m = Core.polygonizeParam(c.fn, u0, u1, v0, v1, N, N);
      s.fn = null; s.grid = m.grid; s.bbox = m.bbox; bb = m.bbox;
    } else {
      const c = Core.compile(s.eq, parVals(s)); syncParams(s, c.params);
      m = Core.polygonize(c.fn, { bounds: s.bounds, N: N });
      s.fn = c.fn; s.grid = null; bb = s.bounds.slice(); s.bbox = bb; s.R = halfOf(s.bounds);
    }
    s.ms = performance.now() - t0; s.tris = m.triangles;
    s.backMat.color.setHex(s.twoSided ? PALETTE[s.pal].f : BACK_COLOR);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    const old = s.front.geometry; s.front.geometry = g; s.back.geometry = g; old.dispose();
    const nv = m.positions.length / 3, k = Math.max(1, Math.ceil(nv / 1500)), pts = [];
    for (let i = 0; i < nv; i += k) pts.push(m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]);
    s.samples = new Float32Array(pts); s.skip = k;
    setBoxGeom(s, bb);
    dirty = true;
    if (s === selected && typeof renderParamSliders === 'function') { renderParamSliders(); syncDomainFields(); }
  }

  function removeSurface(s) {
    if (surfaces.length <= 1) return;
    surfaces.splice(surfaces.indexOf(s), 1);
    mathG.remove(s.group); planeG.remove(s.ribbon);
    s.front.geometry.dispose(); s.box.geometry.dispose(); s.ribbon.geometry.dispose();
    if (selected === s) select(surfaces[0]);
    renderChips(); dirty = true;
  }

  function applyClipFlag() {
    surfaces.forEach(s => {
      const v = clipOn && planeOn ? [clipPlane] : null;
      if (s.frontMat.clippingPlanes !== v && (!!s.frontMat.clippingPlanes !== !!v)) { s.frontMat.needsUpdate = true; s.backMat.needsUpdate = true; }
      s.frontMat.clippingPlanes = v; s.backMat.clippingPlanes = v;
    });
  }
  const _n = new THREE.Vector3(), _p = new THREE.Vector3();
  function updateClip() {
    planeG.updateWorldMatrix(true, false);
    _n.set(0, 0, 1).transformDirection(planeG.matrixWorld).multiplyScalar(-clipSide);
    _p.setFromMatrixPosition(planeG.matrixWorld);
    clipPlane.setFromNormalAndCoplanarPoint(_n, _p);
  }

  // ---------- piano: lettura/scrittura dei parametri ----------
  const fmt2 = v => { const r = Math.round(v * 100) / 100; return (Math.abs(r) < 0.005 ? 0 : r).toFixed(2).replace('.', ',').replace('-', '−'); };
  function planeParams() {
    const n = Z.clone().applyQuaternion(planeG.quaternion);
    return { n: n, d: n.dot(planeG.position) };
  }
  function planeText() {
    const p = planeParams(), n = p.n;
    for (let k = 0; k < 3; k++) {
      const o = [0, 1, 2].filter(i => i !== k);
      if (Math.abs(n.getComponent(k)) > 0.9995 && Math.abs(n.getComponent(o[0])) < 0.02 && Math.abs(n.getComponent(o[1])) < 0.02)
        return 'xyz'[k] + ' = ' + fmt2(p.d * Math.sign(n.getComponent(k)));
    }
    const t = (v, l, first) => (first ? (v < 0 ? '−' : '') : (v < 0 ? ' − ' : ' + ')) + fmt2(Math.abs(v)) + l;
    return t(n.x, 'x', true) + t(n.y, 'y') + t(n.z, 'z') + ' = ' + fmt2(p.d);
  }
  function setPlaneFromAngles(theta, phi, d) { // normale n(θ,φ); l’asse u resta orizzontale
    const q = new THREE.Quaternion().setFromAxisAngle(Z, phi * D2R).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta * D2R));
    planeG.quaternion.copy(q);
    planeG.position.copy(Z.clone().applyQuaternion(q).multiplyScalar(d));
    planeG.updateMatrix();
  }

  // Snapping: assi del riferimento e (per i coni) asse / generatrice / piani contenenti l’asse
  const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  function snapPlane(pos, quat) {
    const n = Z.clone().applyQuaternion(quat);
    let best = null;
    AXES.forEach((a, k) => {
      const c = n.dot(a), ang = Math.acos(Math.min(1, Math.abs(c)));
      if (ang < SNAP_ANG && (!best || ang < best.ang)) best = { ang: ang, target: a.clone().multiplyScalar(c < 0 ? -1 : 1), ref: new THREE.Vector3(), label: 'perpendicolare all’asse ' + 'xyz'[k] };
    });
    surfaces.forEach(s => {
      if (!s.cone || !s.visible) return;
      const a = Z.clone().applyQuaternion(s.group.quaternion), sg = n.dot(a) < 0 ? -1 : 1;
      const aa = a.clone().multiplyScalar(sg), ns = n.clone().multiplyScalar(sg);
      const th = Math.acos(Math.min(1, ns.dot(aa)));
      const perp = ns.clone().sub(aa.clone().multiplyScalar(ns.dot(aa)));
      [[0, 'perpendicolare all’asse del cono → circonferenza'], [45 * D2R, 'parallelo alla generatrice → parabola'], [90 * D2R, 'contiene l’asse → iperbole']].forEach(t => {
        const dl = Math.abs(th - t[0]);
        if (dl >= SNAP_ANG || (best && dl >= best.ang)) return;
        let target;
        if (t[0] === 0) target = aa.clone();
        else { if (perp.length() < 1e-6) return; perp.normalize(); target = aa.clone().multiplyScalar(Math.cos(t[0])).add(perp.clone().multiplyScalar(Math.sin(t[0]))); }
        best = { ang: dl, target: target.normalize(), ref: s.group.position.clone(), label: t[1] };
      });
    });
    if (!best) return '';
    quat.premultiply(new THREE.Quaternion().setFromUnitVectors(n, best.target));
    const d = best.target.dot(pos.clone().sub(best.ref)), d2 = Math.round(d / SNAP_STEP) * SNAP_STEP;
    pos.addScaledVector(best.target, d2 - d);
    return best.label;
  }
  let snapOn = true, snapLabel = '';

  // ---------- sezioni: curva + classificazione ----------
  const _Mi = new THREE.Matrix4();
  function recompute() {
    const q = planeG.quaternion, O = planeG.position.toArray();
    const E1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q).toArray(), E2 = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray();
    const n = renderer.xr.isPresenting ? 56 : 84;
    surfaces.forEach(s => {
      if (!s.visible) { s.section = { segs: new Float32Array(0), cls: { kind: 'none', name: '—' } }; s.ribbon.geometry.setDrawRange(0, 0); return; }
      let segs, cls;
      if (s.kind === 'param') {
        const nrm = Z.clone().applyQuaternion(q), d = nrm.x * O[0] + nrm.y * O[1] + nrm.z * O[2];
        segs = Core.sectionSegmentsMesh(s.grid, s.group.matrix.elements, O, E1, E2, nrm.toArray(), d);
        cls = segs.length ? { kind: 'param', name: 'curva di sezione' } : { kind: 'none', name: 'nessuna intersezione' };
      } else {
        const e = _Mi.copy(s.group.matrix).invert().elements;
        segs = Core.sectionSegments(s.fn, e, O, E1, E2, s.bounds, PR, n);
        cls = Core.sectionConic(s.fn, e, O, E1, E2);
      }
      s.section = { segs: segs, cls: cls };
      const cnt = Math.min(CAP, segs.length / 4), pos = s.ribbon.geometry.attributes.position.array, w = 0.022;
      for (let i = 0; i < cnt; i++) {
        const x1 = segs[4 * i], y1 = segs[4 * i + 1], x2 = segs[4 * i + 2], y2 = segs[4 * i + 3];
        let dx = x2 - x1, dy = y2 - y1; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const nx = -dy * w, ny = dx * w, ex = dx * w, ey = dy * w, b = i * 12;
        pos[b] = x1 - ex + nx; pos[b + 1] = y1 - ey + ny; pos[b + 2] = 0;
        pos[b + 3] = x1 - ex - nx; pos[b + 4] = y1 - ey - ny; pos[b + 5] = 0;
        pos[b + 6] = x2 + ex + nx; pos[b + 7] = y2 + ey + ny; pos[b + 8] = 0;
        pos[b + 9] = x2 + ex - nx; pos[b + 10] = y2 + ey - ny; pos[b + 11] = 0;
      }
      s.ribbon.geometry.attributes.position.needsUpdate = true;
      s.ribbon.geometry.setDrawRange(0, cnt * 6);
    });
  }
  function clsText(s) {
    const c = s.section.cls; let t = c.name;
    if (c.kind === 'circle') t += ', r = ' + fmt2(c.r);
    else if (c.e !== undefined && c.kind !== 'circle') t += ', e = ' + fmt2(c.e);
    if (s.visible && s.section.segs.length === 0 && ['circle', 'ellipse', 'hyperbola', 'parabola', 'line', 'other', 'lines2', 'line1'].indexOf(c.kind) >= 0) t += ' (fuori dal dominio)';
    return t;
  }

  // ---------- pannello 2D della sezione (DOM e VR) ----------
  const css = (hex) => '#' + ('000000' + hex.toString(16)).slice(-6);
  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  function drawPanel(ctx, W, H, th) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    const pad = W * 0.045, side = W - 2 * pad, fs = Math.round(W * 0.044);
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.font = '700 ' + Math.round(fs * 0.9) + 'px ' + MONO; ctx.fillStyle = th.fg;
    ctx.fillText('Piano  ' + planeText(), pad, pad * 0.8);
    const y0 = pad * 0.8 + fs * 1.6, k = side / (2 * PR), cx = pad + side / 2, cy = y0 + side / 2;
    ctx.fillStyle = th.plot; ctx.fillRect(pad, y0, side, side);
    ctx.lineWidth = 3; ctx.strokeStyle = th.fg; ctx.strokeRect(pad, y0, side, side);
    ctx.lineWidth = 1; ctx.strokeStyle = th.grid; ctx.beginPath();
    for (let g = -PR; g <= PR + 1e-9; g += 0.5) { ctx.moveTo(cx + g * k, y0); ctx.lineTo(cx + g * k, y0 + side); ctx.moveTo(pad, cy - g * k); ctx.lineTo(pad + side, cy - g * k); }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e69f00'; ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(pad + side, cy); ctx.stroke();
    ctx.strokeStyle = '#cc79a7'; ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y0 + side); ctx.stroke();
    ctx.font = '600 ' + Math.round(fs * 0.85) + 'px ' + MONO;
    ctx.fillStyle = '#e69f00'; ctx.fillText('u', pad + side - fs * 0.7, cy + 3);
    ctx.fillStyle = '#cc79a7'; ctx.fillText('v', cx + 5, y0 + 2);
    ctx.lineWidth = Math.max(2, W * 0.008); ctx.lineCap = 'round';
    surfaces.forEach(s => {
      if (!s.visible || !planeOn) return;
      const sg = s.section.segs; if (!sg.length) return;
      ctx.strokeStyle = css(PALETTE[s.pal].f); ctx.beginPath();
      for (let i = 0; i < sg.length; i += 4) { ctx.moveTo(cx + sg[i] * k, cy - sg[i + 1] * k); ctx.lineTo(cx + sg[i + 2] * k, cy - sg[i + 3] * k); }
      ctx.stroke();
    });
    let y = y0 + side + fs * 0.7;
    ctx.font = Math.round(fs * 0.85) + 'px ' + MONO;
    const vis = planeOn ? surfaces.filter(s => s.visible) : [];
    if (!vis.length) { ctx.fillStyle = th.muted; ctx.fillText(planeOn ? 'Nessuna superficie visibile' : 'Piano di sezione disattivato', pad, y); }
    vis.forEach(s => {
      ctx.fillStyle = css(PALETTE[s.pal].f); ctx.beginPath(); ctx.arc(pad + fs * 0.35, y + fs * 0.45, fs * 0.28, 0, 7); ctx.fill();
      ctx.fillStyle = th.fg; ctx.fillText(fitText(ctx, s.name + ': ' + clsText(s), W - 2 * pad - fs * 0.9), pad + fs * 0.9, y);
      y += fs * 1.35;
    });
  }
  const secCanvas = $('sec'), secCtx = secCanvas.getContext('2d');
  const TH_DOM = dark ? { bg: '#0d3a33', fg: '#e8fbf5', muted: '#9bc7bb', plot: '#0a2b26', grid: '#24574d' } : { bg: '#f6fbf9', fg: '#0a2a26', muted: '#41635d', plot: '#ffffff', grid: '#cfe6df' };
  const TH_XR = { bg: '#0d3a33', fg: '#e8fbf5', muted: '#9bc7bb', plot: '#0a2b26', grid: '#24574d' };
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  const xrCanvas = document.createElement('canvas'); xrCanvas.width = 512; xrCanvas.height = 780;
  const xrCtx = xrCanvas.getContext('2d'), xrTex = new THREE.CanvasTexture(xrCanvas);
  const xrPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.457), new THREE.MeshBasicMaterial({ map: xrTex, side: THREE.DoubleSide }));
  xrPanel.position.set(0.72, 1.35, -0.7); xrPanel.visible = false; scene.add(xrPanel);
  xrPanel.userData.grab = { scalable: true, min: 0.6, max: 2.5, kind: 'panel' };
  const XRL = { W: 512, H: 780, MPP: 0.3 / 512, frame: 20, items: [] };   // la scheda della sezione si afferra dal bordo, come il pannello di controllo
  let xrHot = false, lastXrDraw = 0;
  function drawFrameBand(ctx, w, h, f, hot) { // cornice afferrabile: chiara, arancio quando la mano è vicina
    ctx.fillStyle = hot ? '#ff8a3d' : '#e8fbf5';
    ctx.fillRect(0, 0, w, f); ctx.fillRect(0, h - f, w, f); ctx.fillRect(0, 0, f, h); ctx.fillRect(w - f, 0, f, h);
  }

  function refreshPanels(force) {
    drawPanel(secCtx, secCanvas.width, secCanvas.height, TH_DOM);
    if (renderer.xr.isPresenting) {
      const t = performance.now();
      if (force || t - lastXrDraw > 60) { drawPanel(xrCtx, 512, 780, TH_XR); drawFrameBand(xrCtx, 512, 780, XRL.frame, xrHot); xrTex.needsUpdate = true; lastXrDraw = t; }
    }
    // equazione del piano (sprite 3D)
    const txt = planeText();
    if (txt !== refreshPanels.lastTxt) {
      refreshPanels.lastTxt = txt;
      const g = eqCanvas.getContext('2d'); g.clearRect(0, 0, 640, 96);
      g.font = '600 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.lineJoin = 'round'; g.strokeStyle = dark ? '#0d1218' : '#ffffff'; g.strokeText('piano: ' + txt, 320, 50);
      g.fillStyle = '#d97706'; g.fillText('piano: ' + txt, 320, 50); eqTex.needsUpdate = true;
      $('planeeq').textContent = txt;
    }
    $('snaplabel').textContent = snapLabel ? 'Aggancio: ' + snapLabel : '';
  }

  // ---------- selezione e interfaccia ----------
  function setStatus(t, err) { const s = $('status'); s.textContent = t; s.dataset.err = err ? '1' : ''; }
  function renderChips() {
    const box = $('chips'); box.innerHTML = '';
    surfaces.forEach((s, i) => {
      const lab = document.createElement('label'); lab.className = 'chip' + (s === selected ? ' on' : '');
      const r = document.createElement('input'); r.type = 'radio'; r.name = 'sel'; r.checked = s === selected;
      r.addEventListener('change', () => select(s));
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = css(PALETTE[s.pal].f);
      const tx = document.createElement('span'); tx.textContent = s.name;
      const v = document.createElement('input'); v.type = 'checkbox'; v.checked = s.visible; v.title = 'Visibile'; v.setAttribute('aria-label', 'Visibile: ' + s.name);
      v.addEventListener('click', e => e.stopPropagation());
      v.addEventListener('change', () => { s.visible = v.checked; s.group.visible = v.checked; dirty = true; refreshPanels(true); });
      lab.append(r, dot, tx, v); box.appendChild(lab);
    });
    $('del').disabled = surfaces.length <= 1;
    $('add').disabled = surfaces.length >= PALETTE.length;
  }
  function select(s) {
    selected = s; renderChips(); syncFields();
  }
  function showMode() { const par = $('m-par').checked; $('improw').hidden = par; $('parrow').hidden = !par; }
  function syncFields() {
    const s = selected; if (!s) return;
    $('m-imp').checked = s.kind !== 'param'; $('m-par').checked = s.kind === 'param'; showMode();
    $('eq').value = s.eq; $('range').value = s.R;
    renderParamSliders(); syncDomainFields();
    $('fx').value = s.fx; $('fy').value = s.fy; $('fz').value = s.fz;
    $('u0').value = s.u0; $('u1').value = s.u1; $('v0').value = s.v0; $('v1').value = s.v1;
    $('res').value = s.N; $('resv').textContent = s.N;
    syncTransform();
    setStatus(s.tris ? s.tris.toLocaleString('it-IT') + ' triangoli · ' + Math.round(s.ms || 0) + ' ms' : '');
  }
  function syncTransform() {
    const s = selected; if (!s) return; const act = document.activeElement;
    const set = (id, v) => { const el = $(id); if (el !== act) el.value = (Math.round(v * 100) / 100); };
    set('px', s.group.position.x); set('py', s.group.position.y); set('pz', s.group.position.z);
    set('rx', s.group.rotation.x / D2R); set('ry', s.group.rotation.y / D2R); set('rz', s.group.rotation.z / D2R);
    set('sc', s.group.scale.x);
  }
  function syncPlaneControls() {
    const p = planeParams(), act = document.activeElement;
    const th = Math.acos(Math.max(-1, Math.min(1, p.n.z))) / D2R, ph = ((Math.atan2(p.n.y, p.n.x) / D2R) + 360) % 360;
    const set = (id, v) => { if ($(id) !== act) { $(id).value = v; } };
    set('pth', Math.round(th)); set('pph', Math.round(ph)); set('pd', Math.round(p.d * 100) / 100);
    $('pthv').textContent = Math.round(th) + '°'; $('pphv').textContent = Math.round(ph) + '°'; $('pdv').textContent = fmt2(p.d);
  }

  // Legge l'editor e ricostruisce la superficie selezionata. p = preset da cui proviene (opzionale).
  function applyEditor(p) {
    const s = selected; if (!s) return;
    const par = $('m-par').checked, N = Math.round(+$('res').value);
    const next = par
      ? { kind: 'param', fx: $('fx').value, fy: $('fy').value, fz: $('fz').value, u0: $('u0').value, u1: $('u1').value, v0: $('v0').value, v1: $('v1').value }
      : { kind: 'implicit', eq: $('eq').value };
    try {
      if (par) { Core.compileParam(next.fx, next.fy, next.fz); ['u0', 'u1', 'v0', 'v1'].forEach(k => Core.evalNumber(next[k])); }
      else Core.compile(next.eq);
    } catch (err) { setStatus(err.message, true); return; }
    const backup = {}; ['kind', 'eq', 'R', 'bounds', 'params', 'fx', 'fy', 'fz', 'u0', 'u1', 'v0', 'v1', 'N', 'name', 'presetId', 'cone', 'twoSided'].forEach(k => backup[k] = s[k]);
    Object.assign(s, next); s.N = N;
    if (p && p.id) { s.name = p.name; s.presetId = p.id; s.cone = !!p.cone; s.twoSided = !!p.twoSided; s.bounds = boundsOf(p); s.params = paramsOfPreset(p); }
    else {
      const m = Core.PRESETS.find(x => x.kind === s.kind && (s.kind === 'param' ? (x.fx === s.fx && x.fy === s.fy && x.fz === s.fz) : x.eq === s.eq));
      if (m) { s.name = m.name; s.presetId = m.id; s.cone = !!m.cone; s.twoSided = !!m.twoSided; }
      else { s.name = s.kind === 'param' ? 'Parametrica' : 'Personalizzata'; s.presetId = null; s.cone = s.kind !== 'param' && isCone(s.eq); s.twoSided = false; }
    }
    try { rebuild(s); }
    catch (err) { Object.assign(s, backup); setStatus('Calcolo non riuscito: ' + err.message, true); return; }
    renderChips();
    if (s.tris === 0) setStatus(s.kind === 'param' ? 'Nessun punto valido: controlla le espressioni e gli intervalli.' : 'Nessun punto della superficie nel dominio scelto. Prova ad ampliarlo.', true);
    else setStatus(s.tris.toLocaleString('it-IT') + ' triangoli · ' + Math.round(s.ms) + ' ms');
  }
  function fillEditor(p) { // copia un preset nell'editor
    $('m-imp').checked = p.kind !== 'param'; $('m-par').checked = p.kind === 'param'; showMode();
    if (p.kind === 'param') { $('fx').value = p.fx; $('fy').value = p.fy; $('fz').value = p.fz; $('u0').value = p.u0; $('u1').value = p.u1; $('v0').value = p.v0; $('v1').value = p.v1; }
    else { $('eq').value = p.eq; $('range').value = p.R; }
    $('res').value = p.N || 48; $('resv').textContent = $('res').value;
  }
  function usePreset(p) { fillEditor(p); applyEditor(p); }
  // cursori dei parametri (pagina)
  let parBusy = false;
  function renderParamSliders() { // ricostruisce i cursori solo se cambiano superficie o parametri; altrimenti aggiorna i valori (senza interrompere un trascinamento)
    const box = $('parsliders'), wrap = $('parwrap'); if (!box) return;
    const q = selected, names = q ? Object.keys(q.params || {}) : [], sig = (q ? q.id : '') + ':' + names.join(',');
    wrap.hidden = !names.length;
    if (box.dataset.sig === sig) {
      names.forEach(k => { const r = box._r && box._r[k]; if (r && document.activeElement !== r.inp) { r.inp.value = q.params[k].v; r.out.textContent = fmt2(q.params[k].v); } });
      return;
    }
    box.dataset.sig = sig; box.innerHTML = ''; box._r = {};
    names.forEach(k => {
      const pr = q.params[k], lab = document.createElement('label'), out = document.createElement('span'), inp = document.createElement('input');
      inp.type = 'range'; inp.min = pr.min; inp.max = pr.max; inp.step = 0.01; inp.value = pr.v; out.textContent = fmt2(pr.v); box._r[k] = { inp: inp, out: out };
      lab.append(document.createTextNode(k + '  '), out, inp);
      inp.addEventListener('input', () => { pr.v = +inp.value; out.textContent = fmt2(pr.v); if (parBusy) return; parBusy = true; requestAnimationFrame(() => { parBusy = false; try { rebuild(q, Math.min(q.N, 32)); } catch (e) { setStatus(e.message, true); } }); });
      inp.addEventListener('change', () => { pr.v = +inp.value; out.textContent = fmt2(pr.v); try { rebuild(q); setStatus(q.tris.toLocaleString('it-IT') + ' triangoli · ' + Math.round(q.ms) + ' ms'); } catch (e) { setStatus(e.message, true); } });
      box.appendChild(lab);
    });
  }
  // dominio per asse (pagina)
  const DOMIDS = ['dxl', 'dxh', 'dyl', 'dyh', 'dzl', 'dzh'];
  function syncDomainFields() {
    const q = selected, act = document.activeElement; if (!q) return;
    DOMIDS.forEach((id, i) => { const el = $(id); if (el && el !== act) el.value = q.bounds[i]; });
  }
  function readDomainFields() {
    const q = selected; if (!q) return;
    const b = DOMIDS.map(id => parseFloat($(id).value));
    if (b.some(v => !isFinite(v)) || !(b[0] < b[1] && b[2] < b[3] && b[4] < b[5])) { setStatus('Dominio non valido: ogni minimo deve essere minore del massimo.', true); return; }
    q.bounds = b.map(v => Math.max(-10, Math.min(10, v)));
    try { rebuild(q); setStatus(q.tris ? q.tris.toLocaleString('it-IT') + ' triangoli · ' + Math.round(q.ms) + ' ms' : 'Nessun punto della superficie nel dominio scelto.', !q.tris); } catch (e) { setStatus(e.message, true); }
  }
  function cyclePreset(dir) {
    const n = Core.PRESETS.length, i = Core.PRESETS.findIndex(x => x.id === (selected && selected.presetId));
    usePreset(Core.PRESETS[((i < 0 ? 0 : i) + dir + n) % n]);
  }

  const sel = $('preset');
  Core.GROUPS.forEach(g => {
    const og = document.createElement('optgroup'); og.label = g;
    Core.PRESETS.filter(p => p.group === g).forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; og.appendChild(o); });
    sel.appendChild(og);
  });
  sel.value = 'cono';
  $('add').addEventListener('click', () => { const s = addSurface(sel.value); if (s) renderChips(); });
  $('apply').addEventListener('click', () => usePreset(Core.presetById(sel.value)));
  $('del').addEventListener('click', () => removeSurface(selected));
  $('m-imp').addEventListener('change', showMode); $('m-par').addEventListener('change', showMode);
  $('draw').addEventListener('click', () => applyEditor());
  ['eq', 'fx', 'fy', 'fz', 'u0', 'u1', 'v0', 'v1'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') applyEditor(); }));
  $('range').addEventListener('change', () => { const R = Math.min(10, Math.max(0.5, parseFloat($('range').value) || 2)); if (selected && selected.kind !== 'param') selected.bounds = [-R, R, -R, R, -R, R]; applyEditor(); });
  DOMIDS.forEach(id => $(id).addEventListener('change', readDomainFields));
  $('dsym').addEventListener('click', () => { const q = selected; if (!q) return; const R = Math.max(0.5, halfOf(q.bounds)); q.bounds = [-R, R, -R, R, -R, R]; try { rebuild(q); } catch (e) { setStatus(e.message, true); } });
  $('res').addEventListener('input', () => { $('resv').textContent = $('res').value; });
  $('res').addEventListener('change', () => applyEditor());

  ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sc'].forEach(id => $(id).addEventListener('input', () => {
    const s = selected, v = id => parseFloat($(id).value) || 0; if (!s) return;
    s.group.position.set(v('px'), v('py'), v('pz'));
    s.group.rotation.set(v('rx') * D2R, v('ry') * D2R, v('rz') * D2R);
    s.group.scale.setScalar(Math.min(6, Math.max(0.15, parseFloat($('sc').value) || 1)));
    s.group.updateMatrix(); dirty = true;
  }));
  function restoreSurface(s) { // posizione, rotazione e scala originali della superficie nel sistema di riferimento
    s.group.position.set(0, 0, 0); s.group.rotation.set(0, 0, 0); s.group.scale.setScalar(1); s.group.updateMatrix(); dirty = true;
    if (s === selected) syncTransform();
  }
  function restorePlane() { setPlaneFromAngles(0, 0, 0.5); snapLabel = ''; planeG.updateMatrix(); dirty = true; syncPlaneControls(); refreshPanels(); }
  function resetAll() { resetView(); restorePlane(); surfaces.forEach(restoreSurface); }
  $('tzero').addEventListener('click', () => { if (selected) restoreSurface(selected); });
  $('resetall').addEventListener('click', resetAll);

  function applyPlane(th, ph, d) {
    setPlaneFromAngles(th, ph, d);
    snapLabel = '';
    if (snapOn) { snapLabel = snapPlane(planeG.position, planeG.quaternion); planeG.updateMatrix(); }
    dirty = true; syncPlaneControls(); refreshPanels();
  }
  function planeSlidersInput() { applyPlane(+$('pth').value, +$('pph').value, +$('pd').value); }
  function planeAngles() { // θ, φ (gradi) e d del piano attuale
    const p = planeParams();
    return { th: Math.acos(Math.max(-1, Math.min(1, p.n.z))) / D2R, ph: ((Math.atan2(p.n.y, p.n.x) / D2R) + 360) % 360, d: p.d };
  }
  function planeNudge(dth, dph, dd) { // dal pannello VR; con l’aggancio attivo θ procede a passi più larghi del raggio di aggancio
    const a = planeAngles();
    applyPlane(Math.min(180, Math.max(0, Math.round(a.th) + dth)), (Math.round(a.ph) + dph + 360) % 360, Math.min(PR, Math.max(-PR, Math.round((a.d + dd) * 100) / 100)));
  }
  ['pth', 'pph', 'pd'].forEach(id => $(id).addEventListener('input', planeSlidersInput));
  $('pquick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const [th, ph] = b.dataset.a.split(',').map(Number);
    setPlaneFromAngles(th, ph, +$('pd').value); snapLabel = ''; planeG.updateMatrix(); dirty = true; syncPlaneControls(); refreshPanels();
  });
  $('snap').addEventListener('change', () => { snapOn = $('snap').checked; if (!snapOn) { snapLabel = ''; refreshPanels(); } });
  $('clip').addEventListener('change', () => { clipOn = $('clip').checked; applyClipFlag(); });
  function setPlaneOn(on) { planeOn = on; planeG.visible = on; $('planeon').checked = on; applyClipFlag(); dirty = true; refreshPanels(true); }
  $('planeon').addEventListener('change', () => setPlaneOn($('planeon').checked));
  $('flip').addEventListener('click', () => { clipSide = -clipSide; });
  $('reset').addEventListener('click', resetView);
  function resetView() {
    frameRoot.position.copy(HOME); frameRoot.quaternion.identity(); frameRoot.scale.setScalar(DEF_SCALE);
    az = 0.6; el = 0.35; dist = 1.5;
  }

  // ---------- orbita (desktop e telefono) ----------
  let az = 0.6, el = 0.35, dist = 1.5;
  const ptrs = new Map(); let pinch0 = 0, dist0 = 1.5;
  const cv = renderer.domElement; cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = dist; } });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { az -= (e.clientX - p.x) * 0.006; el = Math.max(-1.4, Math.min(1.4, el + (e.clientY - p.y) * 0.006)); }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch0 > 0) { const [a, b] = [...ptrs.values()]; dist = Math.max(0.3, Math.min(6, dist0 * pinch0 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)))); }
  });
  const endPtr = e => { ptrs.delete(e.pointerId); };
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(0.3, Math.min(6, dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  function desktopCamera() {
    const t = frameRoot.position;
    camera.position.set(t.x + dist * Math.cos(el) * Math.sin(az), t.y + dist * Math.sin(el), t.z + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(t);
  }
  function resize() { // la scena riempie il palco (#view), non la finestra
    const v = $('view'), w = Math.max(1, v.clientWidth), h = Math.max(1, v.clientHeight);
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('view'));

  // etichetta col nome dell'oggetto indicato (si legge prima di afferrarlo)
  const tagCanvas = document.createElement('canvas'); tagCanvas.width = 384; tagCanvas.height = 72;
  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const hoverTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true }));
  hoverTag.scale.set(0.2, 0.0375, 1); hoverTag.renderOrder = 14; hoverTag.visible = false; scene.add(hoverTag);
  let tagText = '';
  const _tp = new THREE.Vector3();
  function updateTag(set) {
    let name = null; const o = set.size ? set.values().next().value : null;
    if (o && o.userData && o.userData.face) { name = faceName(o); o.getWorldPosition(_tp); _tp.y += 0.05; }
    else if (o === planeG) { name = 'Piano di sezione'; planeG.getWorldPosition(_tp); _tp.y += PR * frameRoot.scale.x * 0.5 + 0.06; }
    else if (o === frameRoot) { name = 'Sistema di riferimento'; frameRoot.getWorldPosition(_tp); _tp.y += FR * frameRoot.scale.x + 0.06; }
    else {
      const sf = surfaces.find(q => q.group === o);
      if (sf) {
        name = sf.name; const b = sf.bbox, ws = sf.group.matrixWorld.getMaxScaleOnAxis();
        if (b && isFinite(b[0])) { _tp.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2).applyMatrix4(sf.group.matrixWorld); _tp.y += 0.5 * Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) * ws + 0.06; }
        else sf.group.getWorldPosition(_tp);
      }
    }
    hoverTag.visible = !!name;
    if (!name) return;
    hoverTag.position.copy(_tp);
    if (name !== tagText) {
      tagText = name;
      const g = tagCanvas.getContext('2d'); g.clearRect(0, 0, 384, 72);
      g.fillStyle = '#f0e442'; g.fillRect(4, 4, 376, 64); g.lineWidth = 6; g.strokeStyle = '#06201c'; g.strokeRect(3, 3, 378, 66);
      g.fillStyle = '#06201c'; g.font = '700 30px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
      let t = name; while (t.length > 3 && g.measureText(t).width > 350) t = t.slice(0, -2) + '…';
      g.fillText(t, 192, 38); tagTex.needsUpdate = true;
    }
  }

  // ---------- scelta dell’oggetto da afferrare ----------
  const _q = new THREE.Vector3(), _i = new THREE.Matrix4();
  const REACH_SURF = 0.06, REACH_AXES = 0.05, REACH_PLANE = 0.06;
  const _hp = new THREE.Vector3();
  const REACH_PANEL = 0.05; // distanza (m) dal piano del pannello entro cui la pinza sulla barra del titolo lo afferra
  function pick(pos) {
    for (const pn of [[ctlPanel, ctlLay], [xrPanel, XRL]]) { // i pannelli hanno la priorità massima, ma solo sulla cornice
      if (!pn[0].visible) continue;
      const l = Panel.toLocal(_pi.copy(pn[0].matrixWorld).invert().elements, pos.x, pos.y, pos.z);
      if (Math.abs(l[2]) * pn[0].scale.x < REACH_PANEL && Panel.inFrame(pn[1], l[0], l[1])) return pn[0];
    }
    if (selected && domHandles && selected.handles && selected.kind !== 'param') { // maniglie delle facce del dominio
      let hb = null, hd = 0.04;
      for (const h of selected.handles) { if (!h.visible) continue; h.getWorldPosition(_hp); const d = _hp.distanceTo(pos); if (d < hd) { hd = d; hb = h; } }
      if (hb) return hb;
    }
    let best = null, bd = REACH_SURF;
    for (const s of surfaces) {
      if (!s.visible || !s.samples || s.locked) continue;
      _i.copy(s.group.matrixWorld).invert(); _q.copy(pos).applyMatrix4(_i);
      const ws = s.group.matrixWorld.getMaxScaleOnAxis(), S = s.samples;
      let m = Infinity;
      for (let k = 0; k < S.length; k += 3) { const dx = S[k] - _q.x, dy = S[k + 1] - _q.y, dz = S[k + 2] - _q.z, d = dx * dx + dy * dy + dz * dz; if (d < m) m = d; }
      const d = Math.sqrt(m) * ws; if (d < bd) { bd = d; best = s.group; }
    }
    if (best) return best;
    _i.copy(mathG.matrixWorld).invert(); _q.copy(pos).applyMatrix4(_i);
    const wsF = mathG.matrixWorld.getMaxScaleOnAxis(), c = [_q.x, _q.y, _q.z];
    let da = Infinity;
    for (let a = 0; a < 3; a++) {
      const o = [0, 1, 2].filter(i => i !== a), t = Math.max(-FR, Math.min(FR, c[a]));
      da = Math.min(da, Math.hypot(c[a] - t, c[o[0]], c[o[1]]));
    }
    if (da * wsF < REACH_AXES) return frameRoot;
    _i.copy(planeG.matrixWorld).invert(); _q.copy(pos).applyMatrix4(_i);
    const dp = Math.hypot(Math.max(Math.abs(_q.x) - PR, 0), Math.max(Math.abs(_q.y) - PR, 0), _q.z) * planeG.matrixWorld.getMaxScaleOnAxis();
    return planeOn && dp < REACH_PLANE ? planeG : null;
  }
  function highlight(set) {
    surfaces.forEach(s => { // l'oggetto che si sta per afferrare: schiarito, con il riquadro pieno e giallo
      const on = set.has(s.group);
      s.frontMat.emissive.setHex(on ? 0x5a5a5a : 0); s.backMat.emissive.setHex(on ? 0x5a3a10 : 0);
      s.box.material.opacity = on ? 1 : 0.35; s.box.material.color.setHex(on ? 0xfacc15 : PALETTE[s.pal].f);
    });
    surfaces.forEach(q => { if (q.handles) q.handles.forEach(h => { h.material.color.setHex(set.has(h) ? 0xffffff : FACE_COL); }); });
    planeMat.opacity = set.has(planeG) ? 0.5 : 0.14; planeEdge.material.color.setHex(set.has(planeG) ? 0xffffff : 0xd9a400);
    updateTag(set);
    ctlHot = set.has(ctlPanel);
    const xh = set.has(xrPanel); if (xh !== xrHot) { xrHot = xh; refreshPanels(true); }
    const f = set.has(frameRoot); frameBoxMat.color.setHex(f ? 0xfacc15 : FRAME_BOX_COLOR); frameBoxMat.opacity = f ? 1 : 0.5;
  }

  // ---------- WebXR: mani e controller ----------
  // Controller: impugnatura (grip) = afferra; grilletto = raggio (preme pulsanti, seleziona, tiene premuto → menu rapido); B/Y = mostra/nascondi i pannelli.
  // Mani: pinza vicino a un oggetto = afferra; pinza col raggio su un pulsante o una superficie = clic/selezione (stessa logica del grilletto).
  const grab = new Grab.GrabController(THREE, {});
  const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
  const ctrls = [renderer.xr.getController(0), renderer.xr.getController(1)];
  hands.forEach(h => scene.add(h));
  const GP = { A: 4, B: 5 };   // mappatura xr-standard dei Touch: 0 grilletto, 1 impugnatura, 3 stick premuto, 4 A/X, 5 B/Y (da verificare sulla Quest: ?monitor=1)
  const MONITOR = /[?&]monitor=1/.test(location.search);
  ctrls.forEach(c => {
    scene.add(c);
    c.userData = { kind: null, trig: false, trigPrev: false, trigUsed: false, sq: false, pinch: false, near: false, gp: null, btn: [], axes: [], hov: false, hovKey: null, handed: null, palmUp: false, palmN: 0, palmPos: new THREE.Vector3() };
    c.addEventListener('connected', e => { c.userData.kind = e.data && e.data.hand ? 'hand' : 'controller'; c.userData.gp = (e.data && e.data.gamepad) || null; c.userData.handed = (e.data && e.data.handedness) || null; });
    c.addEventListener('disconnected', () => { Object.assign(c.userData, { kind: null, trig: false, sq: false, gp: null, btn: [], axes: [] }); });
    c.addEventListener('selectstart', () => { if (c.userData.kind === 'controller') c.userData.trig = true; });
    c.addEventListener('selectend', () => { c.userData.trig = false; });
    c.addEventListener('squeezestart', () => { if (c.userData.kind === 'controller') c.userData.sq = true; });
    c.addEventListener('squeezeend', () => { c.userData.sq = false; });
  });
  const jointGeo = new THREE.SphereBufferGeometry(1, 8, 6);
  const handMats = [new THREE.MeshBasicMaterial({ color: 0xf8fafc }), new THREE.MeshBasicMaterial({ color: 0xf8fafc })];
  const NEED = ['wrist', 'thumb-tip', 'index-finger-tip', 'index-finger-metacarpal', 'pinky-finger-metacarpal', 'middle-finger-metacarpal'];
  const _f = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _pn = new THREE.Vector3();
  function readHand(i) {
    const h = hands[i], c = ctrls[i], J = h.joints || {};
    for (const n of NEED) if (!J[n] || !J[n].visible) return { id: 'h' + i, ci: i, active: false };
    for (const k in J) { const jt = J[k]; if (!jt.userData.vis) { const m = new THREE.Mesh(jointGeo, handMats[i]); jt.add(m); jt.userData.vis = m; } jt.userData.vis.scale.setScalar(jt.jointRadius || 0.008); }
    const th = J['thumb-tip'].position, ix = J['index-finger-tip'].position, dist = th.distanceTo(ix);
    c.userData.pinch = Grab.pinchUpdate(c.userData.pinch, dist);
    c.userData.near = dist < 0.04;   // la pinza si sta chiudendo: serve ad agganciare il bersaglio del raggio
    // palmo verso l'alto? normale del palmo = indice × mignolo (segno invertito per la mano sinistra); il palmo verso il soffitto apre la galleria
    _v1.copy(J['index-finger-metacarpal'].position).sub(J['wrist'].position); _v2.copy(J['pinky-finger-metacarpal'].position).sub(J['wrist'].position);
    _pn.crossVectors(_v1, _v2); if (c.userData.handed === 'left') _pn.negate(); _pn.normalize();
    c.userData.palmN = _pn.y;
    c.userData.palmUp = _pn.y > 0.75 && camera.position.y - J['wrist'].position.y > 0.15 && !c.userData.pinch;
    c.userData.palmPos.copy(J['wrist'].position).add(J['index-finger-metacarpal'].position).add(J['pinky-finger-metacarpal'].position).add(J['middle-finger-metacarpal'].position).multiplyScalar(0.25);
    handMats[i].color.setHex(c.userData.pinch ? 0x34d399 : (c.userData.hov ? 0xfacc15 : 0xf8fafc));
    _f.copy(J['middle-finger-metacarpal'].position).sub(J['wrist'].position).normalize();
    _s.copy(J['index-finger-metacarpal'].position).sub(J['pinky-finger-metacarpal'].position);
    _s.addScaledVector(_f, -_s.dot(_f)).normalize(); _u.crossVectors(_f, _s); _m.makeBasis(_s, _u, _f);
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
  function buzz(c, k, ms) { // vibrazione breve del controller (se il browser la espone)
    const gp = c.userData.gp; if (!gp) return;
    try {
      const a = gp.hapticActuators && gp.hapticActuators[0];
      if (a && a.pulse) a.pulse(k, ms);
      else if (gp.vibrationActuator && gp.vibrationActuator.playEffect) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: k, weakMagnitude: k });
    } catch (e) { /* non supportata */ }
  }

  // ---------- pannello flottante di controllo in VR (afferrabile dalla barra del titolo) ----------
  const PLY = Panel.LAYOUT;
  const ctlCanvas = document.createElement('canvas'); ctlCanvas.width = PLY.W; ctlCanvas.height = PLY.H;
  const ctlCtx = ctlCanvas.getContext('2d'), ctlTex = new THREE.CanvasTexture(ctlCanvas);
  const ctlPanel = new THREE.Mesh(new THREE.PlaneGeometry(PLY.W * PLY.MPP, PLY.H * PLY.MPP), new THREE.MeshBasicMaterial({ map: ctlTex, side: THREE.DoubleSide, transparent: true }));
  ctlPanel.userData.grab = { scalable: true, min: 0.6, max: 2.5, kind: 'panel' };
  ctlPanel.visible = false; scene.add(ctlPanel);
  // pannello chiuso: resta un piccolo pulsante "Menu" che lo riapre
  const FABL = Panel.FAB, fabCanvas = document.createElement('canvas'); fabCanvas.width = FABL.W; fabCanvas.height = FABL.H;
  const fabCtx = fabCanvas.getContext('2d'), fabTex = new THREE.CanvasTexture(fabCanvas);
  const fab = new THREE.Mesh(new THREE.PlaneGeometry(FABL.W * FABL.MPP, FABL.H * FABL.MPP), new THREE.MeshBasicMaterial({ map: fabTex, side: THREE.DoubleSide, transparent: true }));
  fab.visible = false; scene.add(fab);
  let panelsOpen = true, fabSig = '';
  let ctlTab = 'sup', ctlDetails = false, galGroup = 0, galAdd = false;
  let ctlLay = Panel.LAYOUT, ctlPage = 'main', ctlGroup = null;   // pagina del pannello: 'main' | 'groups' (gruppi) | 'list' (superfici di un gruppo)
  let ctlHot = false, faceMe = false, ctlSig = '', flashId = null, flashUntil = 0;
  let xrSession = null, xrMode = null;   // xrMode: 'immersive-vr' | 'immersive-ar'
  const poke = new Panel.Poke(), tracker = new Pointer.Tracker(), _pi = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
  const _io = new THREE.Vector3(), _id = new THREE.Vector3(), _im = new THREE.Matrix4();
  const panelInv = () => _pi.copy(ctlPanel.matrixWorld).invert().elements;
  const panelLocal = p => Panel.toLocal(panelInv(), p.x, p.y, p.z);
  const uiPanels = () => { const a = []; if (ctlPanel.visible) a.push({ mesh: ctlPanel, layout: ctlLay }); if (fab.visible) a.push({ mesh: fab, layout: FABL }); if (palmMesh.visible) a.push({ mesh: palmMesh, layout: Panel.PALM }); if (omMesh.visible) a.push({ mesh: omMesh, layout: Panel.OBJMENU }); return a; };
  function placePanel() { ctlPanel.scale.setScalar(1); ctlPanel.position.set(-0.75, 1.2, -0.4); ctlPanel.lookAt(0, 1.2, 0); }
  function applyPanelsVisible() {
    const inx = !!xrSession;
    if (inx && !panelsOpen && ctlPanel.visible) { fab.position.copy(ctlPanel.position); fab.quaternion.copy(ctlPanel.quaternion); }
    ctlPanel.visible = inx && panelsOpen; xrPanel.visible = inx && panelsOpen; fab.visible = inx && !panelsOpen; ctlSig = ''; fabSig = '';
  }
  function togglePanels() { panelsOpen = !panelsOpen; applyPanelsVisible(); }

  // ---------- anteprime delle superfici (gallerie) ----------
  const THUMB_W = 172, THUMB_H = 112, thumbs = {}, thumbQueue = [];
  let thumbVer = 0, lastThumb = 0;
  function ensureThumb(id, urgent) { if (thumbs[id] || !Core.presetById(id)) return; const k = thumbQueue.indexOf(id); if (k >= 0) { if (!urgent) return; thumbQueue.splice(k, 1); } if (urgent) thumbQueue.unshift(id); else thumbQueue.push(id); }
  function pumpThumbs(now, gap) { // un'anteprima per volta, per non bloccare il rendering
    if (!thumbQueue.length || now - lastThumb < gap) return;
    lastThumb = now; const id = thumbQueue.shift();
    try {
      const cv = document.createElement('canvas'); cv.width = THUMB_W; cv.height = THUMB_H;
      Thumbs.render(cv.getContext('2d'), THUMB_W, THUMB_H, Thumbs.meshFor(Core, Core.presetById(id)), { front: 0x56b4e9, back: 0xf2efe6 });
      thumbs[id] = cv; thumbVer++;
    } catch (err) { thumbs[id] = document.createElement('canvas'); }
  }
  Core.PRESETS.forEach(q => ensureThumb(q.id));

  // ---------- galleria rapida (stick) e galleria sul palmo (mani): stesso anello di superfici, stesso stato ----------
  const quick = new Quick.Quick(Core.PRESETS.map(q => ({ id: q.id, group: Core.GROUPS.indexOf(q.group) })));
  const ghostGeo = {};
  const ghost = new THREE.Group(), ghostSpin = new THREE.Group(), ghostMath = new THREE.Group();
  ghostMath.rotation.x = -Math.PI / 2; ghostSpin.add(ghostMath); ghost.add(ghostSpin); ghost.visible = false; scene.add(ghost);
  const ghostFront = new THREE.MeshStandardMaterial({ color: 0x56b4e9, roughness: 0.5, side: THREE.FrontSide }), ghostBack = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6, side: THREE.BackSide });
  const ghostMeshes = [new THREE.Mesh(new THREE.BufferGeometry(), ghostFront), new THREE.Mesh(new THREE.BufferGeometry(), ghostBack)];
  ghostMeshes.forEach(m => { m.frustumCulled = false; ghostMath.add(m); });
  const qTagCanvas = document.createElement('canvas'); qTagCanvas.width = 512; qTagCanvas.height = 104;
  const qTagTex = new THREE.CanvasTexture(qTagCanvas), qTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTagTex, depthTest: false, transparent: true }));
  qTag.scale.set(0.26, 0.0528, 1); qTag.renderOrder = 15; qTag.visible = false; scene.add(qTag);
  let ghostId = null, qTagText = '', quickAnchor = null;
  function ghostFor(id) { // geometria a bassa risoluzione, centrata e normalizzata (raggio 1)
    if (ghostGeo[id]) return ghostGeo[id];
    const m = Thumbs.meshFor(Core, Core.presetById(id), 26), P = m.positions;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { if (P[i + a] < mn[a]) mn[a] = P[i + a]; if (P[i + a] > mx[a]) mx[a] = P[i + a]; }
    const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]; let r = 0;
    for (let i = 0; i < P.length; i += 3) r = Math.max(r, Math.hypot(P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    return (ghostGeo[id] = { g: g, c: c, r: r || 1 });
  }
  function showGhost(id) {
    if (id === ghostId) return; ghostId = id;
    try { const e = ghostFor(id), k = 0.075 / e.r; ghostMeshes.forEach(m => { m.geometry = e.g; m.scale.setScalar(k); m.position.set(-e.c[0] * k, -e.c[1] * k, -e.c[2] * k); }); } catch (err) { ghostId = null; }
  }
  function drawQuickTag(lines) {
    const t = lines.join('|'); if (t === qTagText) return; qTagText = t;
    const g = qTagCanvas.getContext('2d'); g.clearRect(0, 0, 512, 104);
    g.fillStyle = '#f0e442'; g.fillRect(4, 4, 504, 96); g.lineWidth = 6; g.strokeStyle = '#06201c'; g.strokeRect(3, 3, 506, 98);
    g.fillStyle = '#06201c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 34px ' + MONO; let n = lines[0]; while (n.length > 3 && g.measureText(n).width > 480) n = n.slice(0, -2) + '…'; g.fillText(n, 256, 36);
    g.font = '700 24px ' + MONO; g.fillText(lines[1], 256, 76); qTagTex.needsUpdate = true;
  }
  function quickApply() { // sceglie la superficie in anteprima: sostituisce quella selezionata (o ne aggiunge una, secondo il modo della galleria)
    const id = quick.current(), pr = Core.presetById(id);
    if (galAdd) { if (addSurface(id)) renderChips(); } else usePreset(pr);
    if (ctlPage === 'gallery') setPage('gallery');
    ctlSig = '';
  }
  function updateQuickVisual(now, camPos) {
    ghost.visible = qTag.visible = quick.open;
    if (!quick.open || !quickAnchor) return;
    const id = quick.current(), pr = Core.presetById(id);
    ensureThumb(id, true); showGhost(id);
    ghost.position.copy(quickAnchor).add(_qo.set(0, 0.17, 0)); ghostSpin.rotation.y = now * 0.0006;
    qTag.position.copy(ghost.position).add(_qo.set(0, 0.115, 0));
    drawQuickTag([pr.name, pr.group + ' · ' + quick.pos()]);
  }
  const _qo = new THREE.Vector3();
  // palmo verso l'alto per ~0,4 s → galleria sul palmo; si chiude quando il palmo non è più visibile
  const PALM = Panel.PALM, palmCanvas = document.createElement('canvas'); palmCanvas.width = PALM.W; palmCanvas.height = PALM.H;
  const palmCtx = palmCanvas.getContext('2d'), palmTex = new THREE.CanvasTexture(palmCanvas);
  const palmMesh = new THREE.Mesh(new THREE.PlaneGeometry(PALM.W * PALM.MPP, PALM.H * PALM.MPP), new THREE.MeshBasicMaterial({ map: palmTex, side: THREE.DoubleSide, transparent: true }));
  palmMesh.visible = false; scene.add(palmMesh);
  let palmShown = false, palmHand = -1, palmSince = null, palmLost = null, palmSupp = false, palmSig = '';
  function updatePalm(now) {
    let cand = -1;
    for (let i = 0; i < 2; i++) { const u = ctrls[i].userData; if (u.kind === 'hand' && u.palmUp) { cand = i; break; } }
    if (cand >= 0) {
      palmLost = null; if (palmSince === null) palmSince = now; palmHand = cand;
      if (!palmShown && !palmSupp && now - palmSince > 400) { palmShown = true; ensureThumb(quick.current(), true); }
    } else {
      palmSince = null; palmSupp = false;
      if (palmShown) { if (palmLost === null) palmLost = now; if (now - palmLost > 400) { palmShown = false; palmHand = -1; } }
    }
    palmMesh.visible = palmShown && !!xrSession;
    if (palmMesh.visible && palmHand >= 0) {
      palmMesh.position.copy(ctrls[palmHand].userData.palmPos).add(_qo.set(0, 0.15, 0));
      palmMesh.lookAt(camera.position.x, palmMesh.position.y, camera.position.z);
    }
  }
  function palmState() { const pr = Core.presetById(quick.current()); return Object.assign(ctlState(), { palmName: pr.name, palmId: pr.id, palmPos: quick.pos() }); }

  // ---------- scene: salvate, lezioni, annulla, cronologia dei gesti ----------
  const SCENES_KEY = 'surface-lab-xr.scenes.v1';
  let saved = [], sceKind = 'mie', scePg = 0, delMode = false, undoSlot = null;
  try { const a = JSON.parse(localStorage.getItem(SCENES_KEY) || '[]'); if (Array.isArray(a)) saved = a; } catch (e) { saved = []; }
  const persist = () => { try { localStorage.setItem(SCENES_KEY, JSON.stringify(saved)); return true; } catch (e) { return false; } };
  const poseOf = o => ({ p: o.position.toArray(), q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w], s: o.scale.x });
  function applyPose(o, d) { o.position.fromArray(d.p); o.quaternion.set(d.q[0], d.q[1], d.q[2], d.q[3]); o.scale.setScalar(d.s); o.updateMatrix(); dirty = true; }
  function snapScene(name) { // stato attuale come scena (formato di scene.js); le superfici di libreria si salvano per id
    const same = (q, pr) => pr && q.kind === pr.kind && (q.kind === 'param' ? (q.fx === pr.fx && q.fy === pr.fy && q.fz === pr.fz && q.u0 === pr.u0 && q.u1 === pr.u1 && q.v0 === pr.v0 && q.v1 === pr.v1) : q.eq === pr.eq);
    return { v: 1, name: name || '', frame: poseOf(frameRoot), plane: { p: planeG.position.toArray(), q: [planeG.quaternion.x, planeG.quaternion.y, planeG.quaternion.z, planeG.quaternion.w] },
      planeOn: planeOn, clipOn: clipOn, clipSide: clipSide, snapOn: snapOn, sel: Math.max(0, surfaces.indexOf(selected)),
      surfaces: surfaces.map(q => {
        const pr = q.presetId && Core.presetById(q.presetId), o = Object.assign({ vis: q.visible, pal: q.pal }, poseOf(q.group));
        if (same(q, pr)) { o.pre = pr.id; if (q.N !== pr.N) o.N = q.N; }
        else if (q.kind === 'param') Object.assign(o, { kind: 'param', name: q.name, fx: q.fx, fy: q.fy, fz: q.fz, u0: q.u0, u1: q.u1, v0: q.v0, v1: q.v1, N: q.N, twoSided: q.twoSided });
        else Object.assign(o, { kind: 'implicit', name: q.name, eq: q.eq, R: q.R, N: q.N, cone: q.cone });
        if (q.kind !== 'param' && (!pr || q.bounds.some((v, i) => v !== boundsOf(pr)[i]))) o.b = q.bounds.slice();
        if (Object.keys(q.params || {}).length) o.par = parVals(q);
        return o;
      }) };
  }
  function loadInto(q, d) {
    const ref = d.pre ? Core.presetById(d.pre) : d;
    q.name = ref.name; q.presetId = d.pre || null; q.kind = ref.kind; q.eq = ref.eq || ''; q.R = d.R || ref.R || 2;
    q.bounds = d.b ? d.b.slice() : boundsOf({ R: q.R }); q.params = d.pre ? paramsOfPreset(ref) : {};
    Object.keys(d.par || {}).forEach(k => { const o = q.params[k] || { v: 1, min: Core.DEF_PARAM[1], max: Core.DEF_PARAM[2] }; o.v = d.par[k]; o.min = Math.min(o.min, o.v); o.max = Math.max(o.max, o.v); q.params[k] = o; });
    ['fx', 'fy', 'fz'].forEach(k => { q[k] = ref[k] || ''; }); q.u0 = ref.u0 || '0'; q.u1 = ref.u1 || '2*pi'; q.v0 = ref.v0 || '0'; q.v1 = ref.v1 || '2*pi';
    q.N = d.N || ref.N || 48; q.cone = !!ref.cone; q.twoSided = !!ref.twoSided;
    try { rebuild(q); } catch (err) { setStatus('Calcolo non riuscito: ' + err.message, true); }
    applyPose(q.group, d); q.visible = d.vis !== false; q.group.visible = q.visible;
  }
  function pushUndo(label) { undoSlot = { label: label, raw: snapScene() }; }
  function applyScene(raw, label) { // raw = scena grezza; label = se c'è, prima si salva lo stato per "Annulla"
    const v = SceneIO.validate(raw, Core);
    if (!v.ok) { setStatus('Scena non valida: ' + v.errors.join('; '), true); return false; }
    if (label) pushUndo(label);
    const sc = v.scene;
    while (surfaces.length > 1) removeSurface(surfaces[surfaces.length - 1]);
    loadInto(surfaces[0], sc.surfaces[0]);
    for (let i = 1; i < sc.surfaces.length; i++) { const d = sc.surfaces[i], ns = addSurface(d.pre ? d.pre : d); if (ns) loadInto(ns, d); }
    if (sc.frame) applyPose(frameRoot, sc.frame);
    if (sc.plane.theta !== undefined) setPlaneFromAngles(sc.plane.theta, sc.plane.phi, sc.plane.d);
    else { planeG.position.fromArray(sc.plane.p); planeG.quaternion.set(sc.plane.q[0], sc.plane.q[1], sc.plane.q[2], sc.plane.q[3]); }
    planeG.updateMatrix();
    clipOn = sc.clipOn; $('clip').checked = clipOn; clipSide = sc.clipSide; snapOn = sc.snapOn; $('snap').checked = snapOn; snapLabel = '';
    applyClipFlag(); setPlaneOn(sc.planeOn);
    select(surfaces[Math.min(sc.sel, surfaces.length - 1)]);
    renderChips(); dirty = true; syncPlaneControls(); refreshPanels(true); ctlSig = ''; refreshSceUI();
    return true;
  }
  function doUndo() {
    if (!undoSlot) return;
    const cur = snapScene(), u = undoSlot;
    undoSlot = { label: u.label + ' (ripeti)', raw: cur };
    applyScene(u.raw);
  }
  const hhmm = t => { const d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  function saveScene() {
    const sn = snapScene(), nm = surfaces.slice(0, 2).map(q => q.name).join(' + ') + (surfaces.length > 2 ? ' +' + (surfaces.length - 2) : '') + ' · ' + hhmm(Date.now());
    sn.name = nm; saved.push({ id: 'sv' + Date.now().toString(36), name: nm, ts: Date.now(), data: sn }); if (saved.length > 24) saved.shift();
    const ok = persist(); setStatus(ok ? 'Scena salvata: ' + nm : 'Impossibile salvare: il browser non concede spazio.', !ok);
    sceKind = 'mie'; scePg = 0; ctlSig = ''; refreshSceUI();
  }
  const sceList = () => sceKind === 'mie' ? saved.slice().reverse() : SceneIO.LESSONS.map(l => ({ id: l.id, name: l.name, data: l.data }));
  const entryThumbs = {};
  function entryCanvas(e) { // anteprima di una scena: le anteprime delle sue superfici (fino a tre) affiancate
    if (entryThumbs[e.id]) return entryThumbs[e.id];
    const sf = (e.data.surfaces || []).slice(0, 3), ids = sf.map(q => q.pre).filter(Boolean);
    ids.forEach(id => ensureThumb(id));
    if (ids.some(id => !thumbs[id])) return null;
    const cv = document.createElement('canvas'); cv.width = 266; cv.height = 84; const g = cv.getContext('2d'), n = Math.max(1, sf.length), cw = 266 / n;
    sf.forEach((q, i) => {
      const img = q.pre && thumbs[q.pre];
      if (img && img.width) { const k = Math.min(cw / img.width, 84 / img.height); g.drawImage(img, i * cw + (cw - img.width * k) / 2, (84 - img.height * k) / 2, img.width * k, img.height * k); }
      else { g.fillStyle = 'rgba(232,251,245,.25)'; g.fillRect(i * cw + cw * 0.25, 20, cw * 0.5, 44); }
    });
    return (entryThumbs[e.id] = cv);
  }
  function sceneState() {
    const list = sceList(), pages = Math.max(1, Math.ceil(list.length / 4));
    scePg = Math.min(scePg, pages - 1);
    return { sceKind: sceKind, delMode: delMode, sceEntries: list.slice(scePg * 4, scePg * 4 + 4).map(e => ({ id: e.id, name: e.name, canvas: entryCanvas(e) })),
      sceInfo: (sceKind === 'mie' ? 'Mie ' : 'Lezioni ') + (scePg + 1) + '/' + pages };
  }
  // cronologia dei gesti: un voce per ogni presa (dall'afferrare al rilasciare) che ha cambiato la posa dell'oggetto
  const gestureLog = []; let gStart = null, gPrev = null, logPg = 0, logSel = 0;
  const objKey = o => o === planeG ? 'plane' : (o === frameRoot ? 'frame' : ((surfaces.find(q => q.group === o) || {}).id ? 'surf:' + surfaces.find(q => q.group === o).id : null));
  const objName = o => o === planeG ? 'Piano' : (o === frameRoot ? 'Sistema di riferimento' : ((surfaces.find(q => q.group === o) || {}).name || '?'));
  const objOf = key => key === 'plane' ? planeG : (key === 'frame' ? frameRoot : ((surfaces.find(q => 'surf:' + q.id === key) || {}).group || null));
  function trackGesture() {
    const t = grab.target && grab.target.userData.grab && grab.target.userData.grab.kind !== 'panel' ? grab.target : null;   // (le maniglie del dominio contano qui solo per il ricalcolo)
    if (t === gPrev) return;
    if (gPrev && gPrev.userData && gPrev.userData.face) { // rilasciata una maniglia: si ricalcola la superficie e si può annullare
      const q = gPrev.userData.face.s; try { rebuild(q); } catch (e) { setStatus(e.message, true); }
      if (faceUndo) { undoSlot = { label: 'Cambia dominio', raw: faceUndo }; faceUndo = null; } ctlSig = '';
    }
    if (t && t.userData && t.userData.face) faceUndo = snapScene();
    if (gStart) {
      const after = poseOf(gStart.obj), key = objKey(gStart.obj);
      if (key && SceneIO.changed(gStart.before, after)) { gestureLog.unshift({ t: Date.now(), key: key, name: objName(gStart.obj), before: gStart.before, after: after }); if (gestureLog.length > 60) gestureLog.pop(); logPg = 0; logSel = 0; ctlSig = ''; }
      gStart = null;
    }
    if (t) gStart = { obj: t, before: poseOf(t) };
    gPrev = t;
  }
  const pf = d => 'x ' + Panel.fmt(d.p[0]) + ' y ' + Panel.fmt(d.p[1]) + ' z ' + Panel.fmt(d.p[2]) + ' ×' + Panel.fmt(d.s);
  function logState() {
    const rows = gestureLog.slice(logPg * 5, logPg * 5 + 5).map(g => ({ text: hhmm(g.t) + ' ' + g.name + ' ' + SceneIO.describeDelta(g.before, g.after) }));
    const g = gestureLog[logPg * 5 + logSel];
    return { logRows: rows, logSel: logSel, logD1: g ? 'prima: ' + pf(g.before) : (gestureLog.length ? '' : 'Nessun gesto registrato'), logD2: g ? 'dopo:  ' + pf(g.after) : '', logD3: g ? SceneIO.describeDelta(g.before, g.after) : '' };
  }
  function revertGesture() {
    const g = gestureLog[logPg * 5 + logSel], o = g && objOf(g.key);
    if (!o) { setStatus('Oggetto non più presente.', true); return; }
    pushUndo('Torna a prima del gesto'); applyPose(o, g.before); if (o === frameRoot) resetViewCamOnly();
  }
  function resetViewCamOnly() { /* il riferimento è già stato riportato; la telecamera da desktop resta com'è */ }
  // pannello "Scene" della pagina (desktop): lezioni e scene salvate, codice da copiare o incollare
  function refreshSceUI() {
    const sel = $('sc-list'); if (!sel) return;
    const keep = sel.value; sel.innerHTML = '';
    [['Lezioni', SceneIO.LESSONS.map(l => ({ id: l.id, name: l.name }))], ['Mie scene', saved.slice().reverse().map(e => ({ id: e.id, name: e.name }))]].forEach(gr => {
      if (!gr[1].length) return; const og = document.createElement('optgroup'); og.label = gr[0];
      gr[1].forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; og.appendChild(o); }); sel.appendChild(og);
    });
    if (keep) sel.value = keep;
  }
  const sceById = id => { const l = SceneIO.LESSONS.find(q => q.id === id); if (l) return { id: id, name: l.name, data: l.data, lesson: true }; return saved.find(q => q.id === id) || null; };
  const sceMsg = (t, err) => { const m = $('sc-msg'); if (m) { m.textContent = t; m.dataset.err = err ? '1' : ''; } };
  if ($('sc-save')) {
    $('sc-save').addEventListener('click', () => { saveScene(); sceMsg('Scena salvata.'); });
    $('sc-new').addEventListener('click', () => { if (applyScene(SceneIO.DEFAULT_SCENE, 'Nuova scena')) { resetView(); sceMsg('Nuova scena. Puoi annullare.'); } });
    $('sc-undo').addEventListener('click', () => { if (undoSlot) { sceMsg('Annullato: ' + undoSlot.label); doUndo(); } else sceMsg('Niente da annullare.'); });
    $('sc-open').addEventListener('click', () => { const e = sceById($('sc-list').value); if (e && applyScene(e.data, 'Apri «' + e.name + '»')) sceMsg('Aperta: ' + e.name); });
    $('sc-del').addEventListener('click', () => { const e = sceById($('sc-list').value); if (!e || e.lesson) { sceMsg('Le lezioni non si eliminano.', true); return; } saved = saved.filter(q => q.id !== e.id); persist(); refreshSceUI(); ctlSig = ''; sceMsg('Eliminata.'); });
    $('sc-copy').addEventListener('click', () => { const code = SceneIO.encode(snapScene('Scena')); $('sc-code').value = code; try { navigator.clipboard.writeText(code).then(() => sceMsg('Codice copiato (' + code.length + ' caratteri).'), () => sceMsg('Codice pronto: selezionalo e copialo.')); } catch (e) { sceMsg('Codice pronto: selezionalo e copialo.'); } });
    $('sc-load').addEventListener('click', () => { const r = SceneIO.decode($('sc-code').value, Core); if (!r.ok) { sceMsg('Codice non valido: ' + r.errors.join('; '), true); return; } if (applyScene(r.scene, 'Carica codice')) sceMsg('Scena caricata dal codice.'); });
  }
  refreshSceUI();

  // ---------- menu rapido di una superficie (pressione lunga) ----------
  const OM = Panel.OBJMENU, omCanvas = document.createElement('canvas'); omCanvas.width = OM.W; omCanvas.height = OM.H;
  const omCtx = omCanvas.getContext('2d'), omTex = new THREE.CanvasTexture(omCanvas);
  const omMesh = new THREE.Mesh(new THREE.PlaneGeometry(OM.W * OM.MPP, OM.H * OM.MPP), new THREE.MeshBasicMaterial({ map: omTex, side: THREE.DoubleSide, transparent: true }));
  omMesh.visible = false; scene.add(omMesh);
  let omSid = null, omSince = 0, omSig = '';
  const omSurf = () => surfaces.find(q => q.id === omSid) || null;
  function closeObjMenu() { omSid = null; omMesh.visible = false; omSig = ''; }
  function openObjMenu(sf, point, now) {
    omSid = sf.id; omSince = now; omMesh.visible = true; omSig = '';
    omMesh.position.fromArray(point); omMesh.position.y += 0.14; omMesh.lookAt(camera.position.x, omMesh.position.y, camera.position.z);
  }
  function omState() {
    const q = omSurf(); if (!q) return {};
    return { omName: q.name, omVis: q.visible, omLocked: !!q.locked, omSolo: q.visible && surfaces.every(o => o === q || !o.visible), canDel: surfaces.length > 1, canAdd: surfaces.length < PALETTE.length };
  }
  function omAction(id) {
    const q = omSurf(); if (!q) { closeObjMenu(); return; }
    switch (id) {
      case 'om-hide': q.visible = !q.visible; q.group.visible = q.visible; dirty = true; renderChips(); break;
      case 'om-del': if (surfaces.length > 1) { pushUndo('Elimina superficie'); removeSurface(q); } closeObjMenu(); break;
      case 'om-home': pushUndo('Posizione originale'); restoreSurface(q); closeObjMenu(); break;
      case 'om-solo': {
        pushUndo('Isola superficie');
        const solo = q.visible && surfaces.every(o => o === q || !o.visible);
        surfaces.forEach(o => { o.visible = solo ? true : o === q; o.group.visible = o.visible; }); dirty = true; renderChips(); closeObjMenu(); break;
      }
      case 'om-dup': {
        if (surfaces.length >= PALETTE.length) break;
        pushUndo('Duplica superficie'); const d = snapScene().surfaces[surfaces.indexOf(q)], ns = addSurface(d.pre ? d.pre : d);
        if (ns) { loadInto(ns, d); ns.group.position.x += 0.4; ns.group.position.z += 0.3; ns.group.updateMatrix(); select(ns); renderChips(); }
        closeObjMenu(); break;
      }
      case 'om-lock': q.locked = !q.locked; break;
    }
    ctlSig = ''; omSig = '';
  }

  // ---------- sonda: punto, gradiente, normale, piano tangente ----------
  const PMx = ProbeMath;
  let probeMode = false, showTg = false, pinned = null, liveProbe = null;
  const _pw = new THREE.Vector3(), _nw = new THREE.Vector3(), _zz = new THREE.Vector3(0, 0, 1), _pi2 = new THREE.Matrix4();
  function makeProbeVis() {
    const root = new THREE.Group(), dot = new THREE.Mesh(new THREE.SphereBufferGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf0e442, depthTest: false }));
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.05, 0xff8a3d, 0.016, 0.011);
    [arrow.line.material, arrow.cone.material].forEach(m => { m.depthTest = false; });
    const tg = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xf0e442, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 150; const tex = new THREE.CanvasTexture(cv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); tag.scale.set(0.2, 0.0586, 1); tag.renderOrder = 16;
    dot.renderOrder = arrow.renderOrder = 15; arrow.line.renderOrder = arrow.cone.renderOrder = 15;
    root.add(dot, arrow, tg, tag); root.visible = false; scene.add(root);
    return { root: root, arrow: arrow, tg: tg, tag: tag, cv: cv, tex: tex, text: '' };
  }
  const probeLiveVis = makeProbeVis(), probePinVis = makeProbeVis();
  function probeData(sf, worldPoint) { // punto della superficie più vicino al punto indicato, con normale (e gradiente se implicita)
    _pi2.copy(sf.group.matrixWorld).invert();
    const pl0 = worldPoint.clone().applyMatrix4(_pi2).toArray();
    if (sf.kind !== 'param' && sf.fn) {
      const r = PMx.project(sf.fn, pl0, 5), n = r.ok ? PMx.norm(r.g) : null;
      return n ? { sid: sf.id, pl: r.p, nl: n, g: r.g, hasGrad: true } : null;
    }
    const S = sf.samples, nrm = sf.front.geometry.attributes.normal; if (!S || !nrm) return null;
    let bi = -1, bd = Infinity;
    for (let k = 0; k < S.length; k += 3) { const dx = S[k] - pl0[0], dy = S[k + 1] - pl0[1], dz = S[k + 2] - pl0[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = k / 3; } }
    if (bi < 0) return null;
    const vi = Math.min(bi * (sf.skip || 1), nrm.count - 1), n = PMx.norm([nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi)]);
    return n ? { sid: sf.id, pl: [S[bi * 3], S[bi * 3 + 1], S[bi * 3 + 2]], nl: n, g: null, hasGrad: false } : null;
  }
  function showProbe(vis, d) {
    const sf = d && surfaces.find(q => q.id === d.sid);
    vis.root.visible = !!sf; if (!sf) return;
    _pw.fromArray(d.pl).applyMatrix4(sf.group.matrixWorld); _nw.fromArray(d.nl).transformDirection(sf.group.matrixWorld);
    vis.root.position.copy(_pw); vis.arrow.setDirection(_nw); vis.arrow.setLength(0.05, 0.016, 0.011);
    vis.tg.visible = showTg; vis.tg.quaternion.setFromUnitVectors(_zz, _nw);
    vis.tag.position.copy(_nw).multiplyScalar(0.07).add(_qo.set(0, 0.04, 0));
    const nr = new THREE.Vector3().fromArray(d.nl).applyQuaternion(sf.group.quaternion).toArray();
    const lines = ['P  ' + PMx.fmtVec(d.pl), d.hasGrad ? '∇F ' + PMx.fmtVec(d.g) : '∇F non definito', 'n̂  ' + PMx.fmtVec(nr) + ' rif.'], t = lines.join('|');
    if (t !== vis.text) {
      vis.text = t; const g = vis.cv.getContext('2d'); g.clearRect(0, 0, 512, 150);
      g.fillStyle = '#0d3a33'; g.fillRect(4, 4, 504, 142); g.lineWidth = 6; g.strokeStyle = '#f0e442'; g.strokeRect(3, 3, 506, 144);
      g.fillStyle = '#e8fbf5'; g.font = '700 28px ' + MONO; g.textAlign = 'left'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, 22, 32 + i * 44)); vis.tex.needsUpdate = true;
    }
  }
  function updateProbeVisuals() { showProbe(probeLiveVis, liveProbe); if (pinned && !surfaces.find(q => q.id === pinned.sid)) pinned = null; showProbe(probePinVis, pinned); }

  // ---------- tastiera in VR per scrivere le equazioni ----------
  let kb = null;
  const KB_LABEL = { eq: 'F(x, y, z)   [ = 0 ]', fx: 'x(u, v) =', fy: 'y(u, v) =', fz: 'z(u, v) =', u0: 'u da', u1: 'u a', v0: 'v da', v1: 'v a' };
  function kbKeyDefs(param) { // 40 tasti: cifre, lettere (x y z oppure u v), operatori, funzioni
    const k = (l, t) => ({ l: l, t: t === undefined ? l : t }), out = [];
    '1234567890'.split('').forEach(c => out.push(k(c)));
    (param ? ['u', 'v', 'a', 'b', 'c', 'd', 'k', 'm', 'n'] : ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'k', 'm', 'n']).forEach(c => out.push(k(c)));
    if (param) out.push(k('min', 'min('));
    out.push(k('+'), k('−', '-'), k('×', '*'), k('÷', '/'), k('^'), k('('), k(')'), param ? k('²', '^2') : k('='), k(','), k('.'));
    ['sin', 'cos', 'tan', 'sqrt', 'exp'].forEach(f => out.push(k(f, f + '(')));
    out.push(k('ln', 'ln('), k('abs', 'abs('), k('pi'), k('e'), k('²', '^2'));
    return out;
  }
  const kbField = () => kb.fields[kb.fi];
  function kbTouch() { // controlla l'espressione ad ogni modifica
    try {
      if (!kb.param) Core.compile(kb.vals.eq); else { Core.compileParam(kb.vals.fx, kb.vals.fy, kb.vals.fz); ['u0', 'u1', 'v0', 'v1'].forEach(f => Core.evalNumber(kb.vals[f])); }
      kb.msg = 'OK: espressione valida';
    } catch (e) { kb.msg = 'Errore: ' + e.message; }
    ctlSig = '';
  }
  function openKeyboard() {
    const q = selected; if (!q) return;
    const fields = q.kind === 'param' ? ['fx', 'fy', 'fz', 'u0', 'u1', 'v0', 'v1'] : ['eq'], vals = {};
    fields.forEach(f => { vals[f] = q[f] || ''; });
    kb = { sid: q.id, fields: fields, fi: 0, vals: vals, pos: vals[fields[0]].length, param: q.kind === 'param', msg: '' };
    kbTouch(); setPage('kbd');
  }
  function kbState() {
    if (!kb) return { kbKeys: [] };
    const t = kb.vals[kbField()], start = Math.max(0, kb.pos - 26), end = Math.min(t.length, start + 34);
    return { kbLabel: KB_LABEL[kbField()], kbMulti: kb.fields.length > 1, kbMsg: kb.msg, kbKeys: kbKeyDefs(kb.param).map(q => q.l),
      kbShow: (start > 0 ? '…' : '') + t.slice(start, kb.pos) + '|' + t.slice(kb.pos, end) + (end < t.length ? '…' : '') };
  }
  function kbPress(id) {
    if (!kb) return;
    const f = kbField(), v = kb.vals[f];
    if (id.indexOf('kc:') === 0) { const d = kbKeyDefs(kb.param)[+id.slice(3)]; if (!d) return; kb.vals[f] = v.slice(0, kb.pos) + d.t + v.slice(kb.pos); kb.pos += d.t.length; }
    else if (id === 'kl') kb.pos = Math.max(0, kb.pos - 1);
    else if (id === 'kr') kb.pos = Math.min(v.length, kb.pos + 1);
    else if (id === 'kbs') { if (kb.pos > 0) { kb.vals[f] = v.slice(0, kb.pos - 1) + v.slice(kb.pos); kb.pos--; } }
    else if (id === 'kclr') { kb.vals[f] = ''; kb.pos = 0; }
    else if (id === 'kpt' || id === 'knt') { kb.fi = (kb.fi + (id === 'knt' ? 1 : -1) + kb.fields.length) % kb.fields.length; kb.pos = kb.vals[kbField()].length; }
    else if (id === 'ko') {
      const q = surfaces.find(o => o.id === kb.sid); if (!q) { kb = null; setPage('main'); return; }
      kb.fields.forEach(fl => { $(fl).value = kb.vals[fl]; });
      $('m-par').checked = kb.param; $('m-imp').checked = !kb.param; showMode();
      const prev = undoSlot; pushUndo('Modifica equazione'); applyEditor();
      if ($('status').dataset.err === '1') { undoSlot = prev; kb.msg = 'Errore: ' + $('status').textContent; ctlSig = ''; return; }
      kb = null; ctlSig = ''; setPage('main'); return;
    }
    kbTouch();
  }

  // ---------- collegamento alla scena e codice QR ----------
  const BASE_KEY = 'surface-lab-xr.base';
  const getBase = () => { try { const b = localStorage.getItem(BASE_KEY); if (b) return b; } catch (e) { /* nessuna memoria */ } return location.origin + location.pathname.replace(/index\.html$/, ''); };
  const sceneUrl = () => getBase().replace(/#.*$/, '') + '#' + SceneIO.encode(snapScene('Scena'));
  let qrCanvas = null, qrInfo = '';
  function buildQr(px) { // restituisce { url, qr } e prepara l'immagine per il pannello VR
    const url = sceneUrl(); let q = null;
    try { q = QR.make(url, 'auto'); const cv = document.createElement('canvas'); cv.width = cv.height = px || 560; QR.draw(cv.getContext('2d'), q, cv.width, '#000000', '#ffffff'); qrCanvas = cv; qrInfo = 'v' + q.version + ' · ' + q.bytes + ' byte · ' + getBase().replace(/^https?:\/\//, '').slice(0, 30); }
    catch (e) { qrCanvas = null; qrInfo = e.message; }
    return { url: url, qr: q };
  }
  function applyHash() { // un collegamento «…#s3d1.…» apre la scena (QR letto da un telefono, comando adb sulla Quest)
    const m = /^#(s3d1\.[A-Za-z0-9_-]+)/.exec(location.hash); if (!m) return;
    const r = SceneIO.decode(m[1], Core);
    if (!r.ok) { setStatus('Collegamento non valido: ' + r.errors.join('; '), true); return; }
    if (applyScene(r.scene, 'Apri collegamento')) setStatus('Scena aperta dal collegamento.');
  }
  window.addEventListener('hashchange', applyHash);
  if ($('sc-qrbtn')) {
    $('sc-base').value = (function () { try { return localStorage.getItem(BASE_KEY) || ''; } catch (e) { return ''; } })();
    $('sc-base').addEventListener('change', () => { try { const v = $('sc-base').value.trim(); if (v) localStorage.setItem(BASE_KEY, v); else localStorage.removeItem(BASE_KEY); } catch (e) { /* ignora */ } });
    $('sc-qrbtn').addEventListener('click', () => {
      const r = buildQr(480), cv = $('sc-qr'), box = $('sc-url');
      box.hidden = false; box.value = r.url;
      if (!r.qr) { cv.hidden = true; sceMsg(qrInfo, true); return; }
      cv.hidden = false; QR.draw(cv.getContext('2d'), r.qr, cv.width, '#000000', '#ffffff'); sceMsg('QR pronto (' + qrInfo + '). Il telefono lo apre solo se l’indirizzo è raggiungibile da lui.');
    });
    $('sc-adb').addEventListener('click', () => {
      const host = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:' + (location.port || '8000') + '/' : getBase(), url = host + '#' + SceneIO.encode(snapScene('Scena')), box = $('sc-url');
      box.hidden = false; box.value = 'adb shell am start -a android.intent.action.VIEW -d "' + url + '"'; $('sc-qr').hidden = true;
      sceMsg('Comando da incollare nel Terminale con la Quest collegata (adb reverse attivo): apre la scena nel Quest Browser.');
    });
  }

  // ---------- dominio: passi dal pannello e maniglie sulle facce della scatola ----------
  let domHandles = false, faceUndo = null;
  function rebuildSafe(q) { try { rebuild(q); ctlSig = ''; } catch (e) { setStatus(e.message, true); } }
  function domStep(side, dir, axis) { // side 0 = minimo, 1 = massimo; passo 0,25 con i limiti ±10 e distanza minima 0,25
    const q = selected; if (!q || q.kind === 'param') return;
    const i = axis * 2 + side, b = q.bounds, st = 0.25;
    b[i] = side === 0 ? Math.max(-10, Math.min(b[i + 1] - st, b[i] + dir * st)) : Math.min(10, Math.max(b[i - 1] + st, b[i] + dir * st));
    rebuildSafe(q);
  }
  const FACE_COL = 0xf0e442;
  function ensureHandles(q) {
    if (q.handles) return;
    q.handles = [];
    for (let a = 0; a < 3; a++) for (let sd = 0; sd < 2; sd++) {
      const h = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: FACE_COL, transparent: true, opacity: 0.92, depthTest: false }));
      h.renderOrder = 12; h.userData.grab = { scalable: false, kind: 'face' }; h.userData.face = { s: q, axis: a, side: sd }; h.visible = false;
      q.group.add(h); q.handles.push(h);
    }
  }
  function placeHandles(q, skip) { // al centro di ogni faccia; raggio ~1,3 cm nel mondo
    const b = q.bounds, ws = q.group.matrixWorld.getMaxScaleOnAxis() || 1, c = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2];
    q.handles.forEach(h => {
      const f = h.userData.face; if (h === skip) { h.scale.setScalar(0.013 / ws); return; }
      const pos = c.slice(); pos[f.axis] = b[f.axis * 2 + f.side]; h.position.fromArray(pos); h.quaternion.set(0, 0, 0, 1); h.scale.setScalar(0.013 / ws); h.updateMatrix();
    });
  }
  function updateHandles() {
    surfaces.forEach(q => { if (q.handles) q.handles.forEach(h => { h.visible = false; }); });
    const q = selected; if (!q || q.kind === 'param' || !domHandles || !q.visible) return;
    ensureHandles(q);
    const g = grab.target && grab.target.userData.face && grab.target.userData.face.s === q ? grab.target : null;
    if (g) { // vincolo: la maniglia scorre solo lungo il suo asse; il valore diventa il limite della scatola
      const f = g.userData.face, i = f.axis * 2 + f.side, b = q.bounds, v = g.position.getComponent(f.axis);
      b[i] = f.side === 0 ? Math.max(-10, Math.min(b[i + 1] - 0.25, v)) : Math.min(10, Math.max(b[i - 1] + 0.25, v));
      setBoxGeom(q, b); dirty = true;
    }
    placeHandles(q, g);
    if (g) { const f = g.userData.face, b = q.bounds, c = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2]; c[f.axis] = b[f.axis * 2 + f.side]; g.position.fromArray(c); g.updateMatrix(); }
    q.handles.forEach(h => { h.visible = true; });
  }
  function faceName(h) { const f = h.userData.face; return 'Dominio ' + 'xyz'[f.axis] + (f.side ? ' max' : ' min'); }

  // ---------- puntatore a raggio (controller e mani) ----------
  const REACH_RAY = 0.035;   // m: distanza massima dal raggio per "puntare" una superficie
  const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, -1]), 3));
  const rays = ctrls.map(c => { const l = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xfacc15 })); l.visible = false; l.scale.z = 0.5; c.add(l); return l; });
  const dots = ctrls.map(() => { const m = new THREE.Mesh(new THREE.SphereBufferGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false })); m.renderOrder = 13; m.visible = false; scene.add(m); return m; });
  // bersaglio del raggio (origine o, direzione d, in coordinate mondo): un pulsante di un pannello, altrimenti una superficie
  function rayTarget(o, d) {
    let best = null;
    for (const p of uiPanels()) {
      const h = Panel.rayHit(_pi.copy(p.mesh.matrixWorld).invert().elements, o.toArray(), d.toArray());
      if (!h) continue;
      const t = h.t * p.mesh.scale.x; if (t > 4) continue;
      const it = Panel.hit(p.layout, h.x, h.y, ['btn']);
      if (it && (!best || t < best.t)) best = { id: 'btn:' + it.id, kind: 'btn', t: t, point: [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t] };
    }
    if (best) return best;
    for (const s of surfaces) {
      if (!s.visible || !s.samples) continue;
      _im.copy(s.group.matrixWorld).invert();
      _io.copy(o).applyMatrix4(_im); _id.copy(d).transformDirection(_im);
      const ws = s.group.matrixWorld.getMaxScaleOnAxis(), n = Pointer.nearestOnRay(s.samples, _io.toArray(), _id.toArray(), REACH_RAY / ws);
      if (n) { const t = n.t * ws; if (t < 6 && (!best || t < best.t)) best = { id: 'srf:' + s.id, kind: 'srf', s: s, t: t, point: [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t] }; }
    }
    return best;
  }
  function updatePointers(src, now) {
    const out = { hover: null, hovSurf: null, presses: [], taps: [], holds: [] };
    liveProbe = null;
    for (let i = 0; i < 2; i++) { rays[i].visible = false; dots[i].visible = false; }
    src.forEach(s => {
      const c = ctrls[s.ci], u = c.userData, isHand = u.kind === 'hand';
      if (!s.active || !c.visible) { tracker.update(s.id, { down: false, near: false, target: null }, now); return; }
      c.getWorldPosition(_ro); _rd.set(0, 0, -1).transformDirection(c.matrixWorld);
      const tg = rayTarget(_ro, _rd);
      const grabbing = !!(grab.s[s.id] && grab.s[s.id].grab);
      const ev = tracker.update(s.id, { down: isHand ? u.pinch : (u.trig && !u.trigUsed), near: isHand ? u.near : false, target: tg && tg.id, point: tg && tg.point, grabbing: grabbing }, now);
      const key = tg ? tg.id : null;
      if (key && key !== u.hovKey && !grabbing) buzz(c, 0.12, 15);   // il raggio è passato su qualcosa di interattivo
      u.hovKey = key;
      if (ev.down && ev.down.indexOf('btn:') === 0) { out.presses.push(ev.down.slice(4)); buzz(c, 0.3, 25); }
      const probing = (!isHand && !!u.btn[GP.A]) || probeMode;   // A/X tenuto premuto (controller) o modo sonda (mani, dal pannello)
      if (probing && tg && tg.kind === 'srf') {
        const pd = probeData(tg.s, _pw.fromArray(tg.point)); if (pd) { liveProbe = pd; if (ev.down) { pinned = pd; buzz(c, 0.4, 35); ctlSig = ''; } }
      } else {
        if (ev.tap && ev.tap.indexOf('srf:') === 0) { const sf = surfaces.find(q => 'srf:' + q.id === ev.tap); if (sf) { select(sf); closeObjMenu(); buzz(c, 0.3, 30); } }
        if (ev.hold && tg && tg.kind === 'srf') { openObjMenu(tg.s, tg.point, now); buzz(c, 0.5, 60); }
      }
      if (tg && !grabbing) { if (tg.kind === 'btn') out.hover = tg.id.slice(4); else out.hovSurf = tg.s.group; }
      const ray = rays[s.ci], dot = dots[s.ci];
      ray.visible = !grabbing && (!isHand || !!tg);
      ray.scale.z = tg ? tg.t : 0.5;
      ray.material.color.setHex((isHand ? u.pinch : (u.trig && !u.trigUsed)) ? 0x34d399 : 0xfacc15);
      if (tg && !grabbing) { dot.visible = true; dot.position.fromArray(tg.point); }
    });
    return out;
  }
  // pulsanti del controller (B/Y mostra/nascondi i pannelli); lo stato grezzo serve al monitor
  function pollGamepads() {
    ctrls.forEach(c => {
      const u = c.userData, gp = u.gp; if (!gp || u.kind !== 'controller') return;
      const cur = Array.prototype.map.call(gp.buttons || [], b => !!(b && b.pressed));
      if (cur[GP.B] && !u.btn[GP.B]) togglePanels();
      u.btn = cur; u.axes = Array.prototype.slice.call(gp.axes || []);
    });
  }
  // stick: su apre la galleria rapida, giù la chiude, sinistra/destra scorre; il grilletto sceglie
  function updateQuick(now) {
    if (!quick.open && !palmShown && selected) quick.set(selected.presetId);
    ctrls.forEach((c, i) => {
      const u = c.userData; if (u.kind !== 'controller') { u.trigUsed = false; return; }
      const ax = u.axes || [], evs = quick.update('c' + i, ax[2] || 0, ax[3] || 0, now);
      if (evs.length) { buzz(c, 0.15, 12); if (evs[0].type === 'open') quickAnchor = c.position; }
      if (quick.open && !quickAnchor) quickAnchor = c.position;
      if (quick.open && u.trig && !u.trigPrev) { quickApply(); quick.close(); buzz(c, 0.4, 35); }
      u.trigUsed = quick.open ? u.trig : (u.trigUsed && u.trig);
      u.trigPrev = u.trig;
    });
    quick.tick(now);
    if (!quick.open) quickAnchor = null; else if (quickAnchor) { const c = ctrls.find(q => q.userData.kind === 'controller' && 'c' + ctrls.indexOf(q) === quick.owner); if (c) quickAnchor = c.position; }
  }

  function tfSummary(s) { // trasformazioni della superficie nel sistema di riferimento, in parole (o in numeri con "Dettagli")
    if (!s) return { tr: '—', rot: '—', sca: '—' };
    const g = s.group, q = g.quaternion, w = Math.min(1, Math.abs(q.w)), sn = Math.sqrt(1 - w * w);
    return Panel.describe({ px: g.position.x, py: g.position.y, pz: g.position.z, rx: g.rotation.x / D2R, ry: g.rotation.y / D2R, rz: g.rotation.z / D2R,
      angle: 2 * Math.acos(w) / D2R, axis: sn < 1e-6 ? [0, 0, 1] : [q.x / sn, q.y / sn, q.z / sn], s: g.scale.x }, ctlDetails);
  }
  function ctlState() {
    const s = selected, a = planeAngles(), tf = tfSummary(s);
    return Object.assign({ name: s ? s.name : '—', vis: !!(s && s.visible), theta: a.th, phi: a.ph, d: a.d, plane: planeText(), clipOn: clipOn, planeOn: planeOn, snapOn: snapOn, faceMe: faceMe,
      implicit: !!s && s.kind !== 'param', R: s ? s.R : 0, canAdd: surfaces.length < PALETTE.length, canDel: surfaces.length > 1, hot: ctlHot, mode: xrMode, addMode: galAdd, thumbs: thumbs, probeMode: probeMode, showTg: showTg, canUnpin: !!pinned, domHandles: domHandles, qrCanvas: qrCanvas, qrInfo: qrInfo,
      domRows: s && s.kind !== 'param' ? [[s.bounds[0], s.bounds[1]], [s.bounds[2], s.bounds[3]], [s.bounds[4], s.bounds[5]]] : null,
      parRows: s ? Object.keys(s.params || {}).map(k => ({ n: k, v: s.params[k].v })) : [], canUndo: !!undoSlot, undoLabel: undoSlot ? undoSlot.label : '',
      tab: ctlTab, details: ctlDetails, tr: tf.tr, rot: tf.rot, sca: tf.sca, nSurf: surfaces.length, selIndex: surfaces.indexOf(s), swatch: surfaces.map(q => css(PALETTE[q.pal].f)) }, ctlTab === 'sce' ? sceneState() : { sceEntries: [], sceKind: sceKind, sceInfo: '' }, ctlPage === 'log' ? logState() : { logRows: [], logSel: 0 }, kbState());
  }
  function domainNudge(dr) {
    const s = selected; if (!s || s.kind === 'param') return;
    $('eq').value = s.eq; $('range').value = Math.min(10, Math.max(0.5, Math.round((s.R + dr) * 4) / 4)); applyEditor();
  }
  function setPage(page, g) { // costruisce il layout della pagina (le voci dei gruppi e dei preset vengono dalla libreria)
    ctlPage = page; ctlGroup = g === undefined ? null : g; ctlSig = '';
    const cur = selected && Core.presetById(selected.presetId);
    if (page === 'gallery') {
      const gname = Core.GROUPS[galGroup], list = Core.PRESETS.filter(q => q.group === gname);
      list.forEach(q => ensureThumb(q.id, true));
      ctlLay = Panel.galleryLayout(gname, list.map(q => ({ id: 'p:' + q.id, label: q.name, thumb: q.id, on: !!cur && cur.id === q.id })));
    }
    else if (page === 'log' || page === 'dom' || page === 'par' || page === 'kbd' || page === 'qr') ctlLay = Panel.pageLayout(page);
    else ctlLay = Panel.pageLayout(ctlTab);
  }
  function doAction(id) {
    const s = selected, th = snapOn ? 10 : 5;
    if (id.indexOf('tab:') === 0) { ctlTab = id.slice(4); return setPage('main'); }
    if (id.indexOf('sel:') === 0) { const q = surfaces[+id.slice(4)]; if (q) select(q); return; }
    if (id === 'det') { ctlDetails = !ctlDetails; ctlSig = ''; return; }
    if (id === 'pickmenu') { const cur = s && Core.presetById(s.presetId); galGroup = cur ? Math.max(0, Core.GROUPS.indexOf(cur.group)) : 0; return setPage('gallery'); }
    if (id === 'back') { kb = null; return setPage('main'); }
    if (id === 'kopen') return openKeyboard();
    if (/^(kc:\d+|kl|kr|kbs|kclr|kpt|knt|ko)$/.test(id)) return kbPress(id);
    if (id === 'qr') { buildQr(560); return setPage('qr'); }
    if (id === 'gprev' || id === 'gnext') { galGroup = (galGroup + (id === 'gnext' ? 1 : -1) + Core.GROUPS.length) % Core.GROUPS.length; return setPage('gallery'); }
    if (id === 'galmode') { galAdd = !galAdd; ctlSig = ''; return; }
    if (id === 'gdom') return setPage('dom');
    if (id === 'gpar') return setPage('par');
    { const md = /^d([lu])([-+])([xyz])$/.exec(id); if (md) return domStep(md[1] === 'l' ? 0 : 1, md[2] === '+' ? 1 : -1, 'xyz'.indexOf(md[3])); }
    if (id === 'dsym' && s && s.kind !== 'param') { const R = Math.max(0.5, halfOf(s.bounds)); s.bounds = [-R, R, -R, R, -R, R]; rebuildSafe(s); return; }
    if (id === 'dreset' && s && s.kind !== 'param') { const pr = s.presetId && Core.presetById(s.presetId); s.bounds = boundsOf(pr || { R: 2 }); rebuildSafe(s); return; }
    if (id === 'dhandles') { domHandles = !domHandles; ctlSig = ''; return; }
    { const mp = /^p([mp]):(\d)$/.exec(id); if (mp && s) { const k = Object.keys(s.params)[+mp[2]]; if (k) { const q = s.params[k], st = Math.max(0.05, Math.round((q.max - q.min) / 24 * 20) / 20); q.v = Math.max(q.min, Math.min(q.max, Math.round((q.v + (mp[1] === 'p' ? st : -st)) * 100) / 100)); rebuildSafe(s); } return; } }
    if (id === 'pdef' && s) { const pr = s.presetId && Core.presetById(s.presetId), d = pr ? paramsOfPreset(pr) : {}; Object.keys(s.params).forEach(k => { s.params[k].v = d[k] ? d[k].v : Core.DEF_PARAM[0]; }); rebuildSafe(s); return; }
    if (id.indexOf('om-') === 0) return omAction(id);
    if (id === 'probe') { probeMode = !probeMode; ctlSig = ''; return; }
    if (id === 'tgp') { showTg = !showTg; ctlSig = ''; return; }
    if (id === 'unpin') { pinned = null; ctlSig = ''; return; }
    if (id === 'cron') { logPg = 0; logSel = 0; return setPage('log'); }
    if (id === 'lpp' || id === 'lpn') { logPg = Math.max(0, Math.min(Math.ceil(gestureLog.length / 5) - 1, logPg + (id === 'lpn' ? 1 : -1))); logSel = 0; ctlSig = ''; return; }
    if (id.indexOf('lg:') === 0) { logSel = +id.slice(3); ctlSig = ''; return; }
    if (id === 'lrev') return revertGesture();
    if (id === 'undo') return doUndo();
    if (id === 'kmie' || id === 'klez') { sceKind = id === 'kmie' ? 'mie' : 'lez'; scePg = 0; delMode = false; ctlSig = ''; return; }
    if (id === 'sdel') { delMode = !delMode; ctlSig = ''; return; }
    if (id === 'salva') return saveScene();
    if (id === 'nuova') { if (applyScene(SceneIO.DEFAULT_SCENE, 'Nuova scena')) resetView(); return; }
    if (id === 'spp' || id === 'spn') { const n = Math.max(1, Math.ceil(sceList().length / 4)); scePg = Math.max(0, Math.min(n - 1, scePg + (id === 'spn' ? 1 : -1))); ctlSig = ''; return; }
    if (id.indexOf('se:') === 0) {
      const e = sceList()[scePg * 4 + (+id.slice(3))]; if (!e) return;
      if (delMode && sceKind === 'mie') { saved = saved.filter(q => q.id !== e.id); persist(); delMode = false; ctlSig = ''; refreshSceUI(); return; }
      applyScene(e.data, 'Apri «' + e.name + '»'); return;
    }
    if (id.indexOf('p:') === 0) { const pr = Core.presetById(id.slice(2)); pushUndo(galAdd ? 'Aggiungi superficie' : 'Cambia superficie'); if (galAdd) { if (addSurface(pr.id)) renderChips(); } else usePreset(pr); return setPage('gallery'); }
    if (id === 'pprev') { quick.step(-1); ensureThumb(quick.current(), true); return; }
    if (id === 'pnext') { quick.step(1); ensureThumb(quick.current(), true); return; }
    if (id === 'pgp') { quick.groupStep(-1); ensureThumb(quick.current(), true); return; }
    if (id === 'pgn') { quick.groupStep(1); ensureThumb(quick.current(), true); return; }
    if (id === 'psel') { quickApply(); palmShown = false; palmSupp = true; return; }
    switch (id) {
      case 'exit': if (xrSession) xrSession.end(); break;
      case 'hide': panelsOpen = false; applyPanelsVisible(); break;
      case 'show': panelsOpen = true; applyPanelsVisible(); break;
      case 'reset': resetView(); break;
      case 'home': if (s) restoreSurface(s); break;
      case 'resetall': pushUndo('Ripristina tutto'); resetAll(); break;
      case 'face': faceMe = !faceMe; break;
      case 'prev': cyclePreset(-1); break;
      case 'next': cyclePreset(1); break;
      case 'vis': if (s) { s.visible = !s.visible; s.group.visible = s.visible; dirty = true; renderChips(); } break;
      case 'add': if (addSurface(sel.value)) renderChips(); break;
      case 'del': if (surfaces.length > 1) pushUndo('Elimina superficie'); removeSurface(selected); break;
      case 'th-': planeNudge(-th, 0, 0); break;
      case 'th+': planeNudge(th, 0, 0); break;
      case 'ph-': planeNudge(0, -15, 0); break;
      case 'ph+': planeNudge(0, 15, 0); break;
      case 'd-': planeNudge(0, 0, -SNAP_STEP); break;
      case 'd+': planeNudge(0, 0, SNAP_STEP); break;
      case 'clip': clipOn = !clipOn; $('clip').checked = clipOn; applyClipFlag(); break;
      case 'flip': clipSide = -clipSide; break;
      case 'plane': setPlaneOn(!planeOn); break;
      case 'snap': snapOn = !snapOn; $('snap').checked = snapOn; if (!snapOn) { snapLabel = ''; refreshPanels(); } break;
      case 'R-': domainNudge(-0.25); break;
      case 'R+': domainNudge(0.25); break;
    }
  }
  // dito indice (poke) e puntatori a raggio; poi ridisegna le texture solo se qualcosa è cambiato
  function updatePanel(src, now, ptr) {
    let hover = ptr ? ptr.hover : null;
    const press = id => { doAction(id); flashId = id; flashUntil = now + 200; };
    const panels = uiPanels();
    src.forEach(s => {
      if (!s.tip) return;
      panels.forEach((p, k) => {
        const l = Panel.toLocal(_pi.copy(p.mesh.matrixWorld).invert().elements, s.tip.x, s.tip.y, s.tip.z);
        const e = poke.update(s.id + ':' + k, { x: l[0], y: l[1], z: l[2] }, s.pinching, p.layout, p.mesh.scale.x);
        if (e.hover) hover = e.hover;
        if (e.press) press(e.press);
      });
    });
    if (ptr) ptr.presses.forEach(press);
    if (now > flashUntil) flashId = null;
    const st = ctlState();
    if (ctlPanel.visible) {
      const sig = JSON.stringify(st, (k, v) => k === 'thumbs' ? undefined : v) + '|' + hover + '|' + flashId + '|' + ctlPage + galGroup + '|' + thumbVer + '|' + delMode;
      if (sig !== ctlSig) { ctlSig = sig; Panel.draw(ctlCtx, ctlLay, st, hover, flashId); ctlTex.needsUpdate = true; }
    }
    if (omMesh.visible) {
      if (now - omSince > 10000 || !omSurf()) closeObjMenu();
      else { const sig = JSON.stringify(omState()) + '|' + hover + '|' + flashId; if (sig !== omSig) { omSig = sig; Panel.draw(omCtx, Panel.OBJMENU, Object.assign(ctlState(), omState()), hover, flashId); omTex.needsUpdate = true; } }
    }
    if (palmMesh.visible) {
      const sig = quick.current() + '|' + hover + '|' + flashId + '|' + thumbVer;
      if (sig !== palmSig) { palmSig = sig; Panel.draw(palmCtx, Panel.PALM, palmState(), hover, flashId); palmTex.needsUpdate = true; }
    }
    if (fab.visible) {
      const sig = hover + '|' + flashId;
      if (sig !== fabSig) { fabSig = sig; Panel.draw(fabCtx, FABL, st, hover, flashId); fabTex.needsUpdate = true; }
      fab.lookAt(camera.position);
    }
  }

  // ---------- monitor degli ingressi (aprire la pagina con ?monitor=1): mostra pulsanti, stick, bersaglio del raggio ----------
  let monCanvas = null, monCtx = null, monTex = null, monLast = 0;
  if (MONITOR) {
    monCanvas = document.createElement('canvas'); monCanvas.width = 640; monCanvas.height = 300; monCtx = monCanvas.getContext('2d'); monTex = new THREE.CanvasTexture(monCanvas);
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.15), new THREE.MeshBasicMaterial({ map: monTex, side: THREE.DoubleSide }));
    mm.position.set(0, PLY.H * PLY.MPP / 2 + 0.09, 0); ctlPanel.add(mm);
  }
  function drawMonitor(now, ptr) {
    if (!MONITOR || now - monLast < 100) return; monLast = now;
    monCtx.fillStyle = '#04110b'; monCtx.fillRect(0, 0, 640, 300); monCtx.fillStyle = '#e6fff0'; monCtx.font = '20px ui-monospace, Menlo, monospace'; monCtx.textBaseline = 'top';
    let y = 8;
    ctrls.forEach((c, i) => {
      const u = c.userData;
      const bt = u.btn.map((b, k) => b ? k : null).filter(k => k !== null).join(',');
      const ax = u.axes.map(a => (Math.round(a * 100) / 100).toFixed(2)).join(' ');
      monCtx.fillText(i + ' ' + (u.kind || '—') + (u.kind === 'hand' ? ' pinza=' + (u.pinch ? 1 : 0) + ' vicino=' + (u.near ? 1 : 0) : ' grilletto=' + (u.trig ? 1 : 0) + ' grip=' + (u.sq ? 1 : 0)), 8, y); y += 26;
      monCtx.fillText('  tasti[' + bt + '] assi[' + ax + ']', 8, y); y += 26;
      monCtx.fillText('  raggio→ ' + (u.hovKey || '—') + (c.visible ? '' : ' (nessuna posa)') + (u.kind === 'hand' ? ' palmo y=' + (Math.round(u.palmN * 100) / 100) : ''), 8, y); y += 30;
    });
    monCtx.fillText('pannelli ' + (panelsOpen ? 'aperti' : 'chiusi') + ' · pagina ' + ctlPage + ' · grab ' + (grab.target ? 'sì' : 'no'), 8, y);
    monTex.needsUpdate = true;
  }

  // ---------- sessioni WebXR: VR e realtà mista (passthrough) ----------
  const vrBtn = $('vr'), arBtn = $('ar'), xrOk = {};
  const XR_LABEL = { 'immersive-vr': ['Entra in VR', 'Esci da VR'], 'immersive-ar': ['Entra in realtà mista', 'Esci dalla realtà mista'] };
  const xrBtns = { 'immersive-vr': vrBtn, 'immersive-ar': arBtn };
  const syncXrButtons = () => { vrBtn.disabled = !xrOk['immersive-vr'] || (!!xrSession && xrMode !== 'immersive-vr'); arBtn.disabled = !xrOk['immersive-ar'] || (!!xrSession && xrMode !== 'immersive-ar'); };
  (async function initXR() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) { vrBtn.disabled = arBtn.disabled = true; $('vrnote').textContent = 'WebXR non disponibile in questo browser. Su Quest apri la pagina dal Quest Browser; su PC usa Immersive Web Emulator.'; return; }
    for (const m of ['immersive-vr', 'immersive-ar']) { try { xrOk[m] = await navigator.xr.isSessionSupported(m); } catch (e) { xrOk[m] = false; } }
    syncXrButtons();
    if (!xrOk['immersive-vr']) $('vrnote').textContent = 'Sessione immersiva non disponibile qui (le anteprime incorporate spesso la bloccano). Apri la pagina pubblicata nel Quest Browser o con Immersive Web Emulator.';
    else if (!xrOk['immersive-ar']) $('vrnote').textContent = 'Realtà mista (passthrough) non disponibile in questo browser.';
  })();
  async function startXR(mode) {
    if (xrSession) { xrSession.end(); return; }
    const ar = mode === 'immersive-ar', btn = xrBtns[mode];
    try {
      renderer.xr.setReferenceSpaceType('local-floor');
      const sess = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      xrSession = sess; xrMode = mode;
      sess.addEventListener('end', () => {
        xrSession = null; xrMode = null; btn.querySelector('.lbl').textContent = XR_LABEL[mode][0]; syncXrButtons();
        document.body.classList.remove('inxr'); panelsOpen = true; applyPanelsVisible(); poke.reset(); tracker.reset(); setPage('main'); quick.close(); palmShown = false; palmMesh.visible = false; ghost.visible = qTag.visible = false; closeObjMenu(); liveProbe = null; probeLiveVis.root.visible = false;
        scene.background = BG; floorGrid.visible = true;
      });
      await renderer.xr.setSession(sess);
      scene.background = ar ? null : BG; floorGrid.visible = !ar;   // in realtà mista si vede la stanza, non il fondale né il pavimento
      frameRoot.position.copy(HOME); frameRoot.quaternion.identity(); frameRoot.scale.setScalar(DEF_SCALE);
      btn.querySelector('.lbl').textContent = XR_LABEL[mode][1]; syncXrButtons();
      document.body.classList.add('inxr'); placePanel(); setPage('main'); panelsOpen = true; applyPanelsVisible(); dirty = true;
    } catch (err) { xrSession = null; xrMode = null; syncXrButtons(); $('vrnote').textContent = 'Impossibile avviare la sessione ' + (ar ? 'di realtà mista' : 'VR') + ': ' + err.message; }
  }
  vrBtn.addEventListener('click', () => startXR('immersive-vr'));
  arBtn.addEventListener('click', () => startXR('immersive-ar'));

  // Un errore in un modulo non deve fermare il rendering: si segnala una volta sola (nella nota sotto i pulsanti VR e nella console) e si prosegue.
  const failed = {};
  function safe(name, fn) {
    try { return fn(); } catch (err) {
      if (!failed[name]) { failed[name] = true; console.error('Errore in ' + name + ':', err); const n = $('vrnote'); if (n) n.textContent = 'Errore in ' + name + ': ' + err.message; }
      return null;
    }
  }

  // ---------- ciclo di rendering ----------
  const clock = new THREE.Clock();
  let lastSync = 0;
  const _bp = new THREE.Vector3();
  renderer.setAnimationLoop(function () {
    const dt = Math.min(clock.getDelta(), 0.1);
    scene.updateMatrixWorld(true);
    const hl = new Set();
    if (renderer.xr.isPresenting) {
      const now0 = performance.now();
      const src = readSources();
      grab.update(src, dt, pick);
      safe('maniglie', updateHandles); safe('gamepad', pollGamepads); safe('gesti', trackGesture); safe('galleria rapida', () => updateQuick(now0)); safe('galleria sul palmo', () => updatePalm(now0));
      if (grab.target) {
        hl.add(grab.target);
        if (grab.target === planeG && snapOn) { snapLabel = snapPlane(planeG.position, planeG.quaternion); planeG.updateMatrix(); }
      } else {
        snapLabel = '';
        src.forEach(s => { if (s.active && !s.pinching) { const h = pick(s.pos); if (h) hl.add(h); } });
      }
      src.forEach(s => { ctrls[s.ci].userData.hov = !!(s.active && !s.pinching && pick(s.pos)); });
      const ptr = safe('puntatore', () => updatePointers(src, now0)) || { hover: null, hovSurf: null, presses: [], taps: [], holds: [] };
      if (ptr.hovSurf && !grab.target) hl.add(ptr.hovSurf);
      if (grab.target !== xrPanel) xrPanel.lookAt(camera.position.x, xrPanel.position.y, camera.position.z);
      if (faceMe && grab.target !== ctlPanel) ctlPanel.lookAt(camera.position.x, ctlPanel.position.y, camera.position.z);
      safe('pannello', () => updatePanel(src, now0, ptr)); safe('monitor', () => drawMonitor(now0, ptr)); safe('anteprima rapida', () => updateQuickVisual(now0)); safe('sonda', updateProbeVisuals);
      if (grab.target && grab.holding.length) grab.holding.forEach(id => { const c = ctrls[+id.slice(1)]; if (c && grab.s[id] && grab.s[id].just) buzz(c, 0.4, 40); });
    } else {
      desktopCamera(); safe('maniglie', updateHandles);
    }
    // posa cambiata (da mani o da campi) → ricalcola le sezioni
    planeG.updateMatrix(); if (!planeG.matrix.equals(recompute.lp)) { recompute.lp.copy(planeG.matrix); dirty = true; }
    surfaces.forEach(s => { s.group.updateMatrix(); if (!s.group.matrix.equals(s.lastM)) { s.lastM.copy(s.group.matrix); dirty = true; } });
    scene.updateMatrixWorld(true);
    if (dirty) { recompute(); refreshPanels(); dirty = false; }
    updateClip();
    highlight(hl);
    const now = performance.now();
    pumpThumbs(now, renderer.xr.isPresenting ? 250 : 40);
    if (now - lastSync > 200) { lastSync = now; if (!renderer.xr.isPresenting) { syncTransform(); syncPlaneControls(); } }
    renderer.render(scene, camera);
  });
  recompute.lp = new THREE.Matrix4();

  // ---------- avvio ----------
  addSurface('cono');  // cono doppio: il caso d’uso principale
  syncPlaneControls();
  refreshPanels(true);
  applyHash();
  window.__app = { surfaces: surfaces, planeG: planeG, frameRoot: frameRoot, mathG: mathG, hands: hands, ctrls: ctrls, grab: grab, readSources: readSources, pick: pick,
    addSurface: addSurface, snapPlane: snapPlane, setPlaneFromAngles: setPlaneFromAngles, recompute: recompute, planeText: planeText, camera: camera, renderer: renderer,
    ctlPanel: ctlPanel, fab: fab, ctlState: ctlState, setPage: setPage, setPlaneOn: setPlaneOn, updatePanel: updatePanel, doAction: doAction, planeNudge: planeNudge, panelLocal: panelLocal,
    rayTarget: rayTarget, updatePointers: updatePointers, pollGamepads: pollGamepads, tracker: tracker, togglePanels: togglePanels, applyPanelsVisible: applyPanelsVisible,
    quick: quick, updateHandles: updateHandles, domStep: domStep, getSelectedNow: () => selected, openObjMenu: openObjMenu, omMesh: omMesh, probeData: probeData, showProbe: showProbe, updateProbeVisuals: updateProbeVisuals, getPinned: () => pinned, setPinned: d => { pinned = d; }, probeLiveVis: probeLiveVis, probePinVis: probePinVis, setProbeMode: v => { probeMode = v; }, quick: quick, thumbs: thumbs, snapScene: snapScene, applyScene: applyScene, doUndo: doUndo, saved: () => saved, gestureLog: gestureLog, trackGesture: trackGesture, sceList: sceList, pumpThumbs: pumpThumbs, updateQuick: updateQuick, updatePalm: updatePalm, palmMesh: palmMesh, restoreSurface: restoreSurface, resetAll: resetAll, select: select, highlight: highlight, getSelected: () => selected };
})();
