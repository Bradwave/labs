// Labs · home/room3d.js
// Builds the stylized 3D cutaway laboratory hall: tiled floor, back & left architectural walls,
// day/night windows, classroom chalkboard, bookshelves, ticking wall clock, overhead pendant lamps,
// scalable island workbenches with bilingual zone signs, stools, tabletop clutter, dust motes & lab cat.

const INK = 0x14202b;
const inkLineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.72 });

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.04,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function outline(mesh, deg = 24) {
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, deg), inkLineMat));
  return mesh;
}

function box(parent, w, h, d, m, x = 0, y = 0, z = 0, edged = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (edged) outline(mesh);
  parent.add(mesh);
  return mesh;
}

function makeFloorTexture(dark) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = dark ? "#18242f" : "#d7dfe7";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = dark ? "#1c2a36" : "#ced8e2";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  ctx.strokeStyle = dark ? "rgba(210,224,236,0.08)" : "rgba(20,32,43,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 8);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeChalkboardTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 420;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#233936";
  ctx.fillRect(0, 0, 1024, 420);

  // Subtle dusty chalk haze
  ctx.fillStyle = "rgba(235,245,240,0.04)";
  ctx.fillRect(26, 22, 972, 376);
  ctx.strokeStyle = "rgba(235,245,240,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 984, 380);

  ctx.fillStyle = "rgba(238,246,242,0.82)";
  ctx.font = "bold 36px 'Space Mono', monospace";
  ctx.fillText("F = m · a", 64, 110);
  ctx.fillText("Δp = ∫ F(t) dt", 64, 195);
  ctx.fillText("T = 2π √(L / g)", 64, 280);
  ctx.fillText("p₁ + p₂ = const", 64, 355);

  ctx.fillText("e^(iπ) + 1 = 0", 620, 110);
  ctx.fillText("x(t) = x₀ + v₀t + ½at²", 550, 355);

  // Chalk physics sketches (wave + parabola + orbit)
  ctx.strokeStyle = "rgba(238,246,242,0.68)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(410, 275);
  ctx.lineTo(660, 275);
  ctx.moveTo(430, 295);
  ctx.lineTo(430, 130);
  ctx.stroke();

  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 430 + i * 5.4;
    const y = 220 - Math.sin(i * 0.35) * 44;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Chalk orbit ellipse on right
  ctx.strokeStyle = "rgba(140,203,235,0.8)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(830, 220, 110, 56, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(800, 224, 16, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeWindowSkyTexture(dark) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext("2d");
  if (!dark) {
    ctx.fillStyle = "#9ad2f4";
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = "#bfe3fa";
    ctx.fillRect(0, 190, 256, 130);
    // Crisp blocky game clouds
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(28, 64, 96, 26);
    ctx.fillRect(48, 46, 56, 22);
    ctx.fillRect(126, 146, 102, 26);
    ctx.fillRect(150, 128, 54, 22);
  } else {
    ctx.fillStyle = "#0b1428";
    ctx.fillRect(0, 0, 256, 320);
    // Crescent moon
    ctx.fillStyle = "#ffd86b";
    ctx.beginPath();
    ctx.arc(178, 86, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1428";
    ctx.beginPath();
    ctx.arc(192, 78, 24, 0, Math.PI * 2);
    ctx.fill();
    // Crisp star crosses
    ctx.fillStyle = "#eaf2ff";
    for (const [sx, sy, s] of [[44, 52, 6], [96, 110, 4], [62, 190, 6], [198, 210, 5], [134, 62, 4], [148, 256, 6]]) {
      ctx.fillRect(sx - s, sy - 1.5, s * 2, 3);
      ctx.fillRect(sx - 1.5, sy - s, 3, s * 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeBenchSignTexture(code, title) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f7f9fb";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "#14202b";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 88);
  // Left dark code badge
  ctx.fillStyle = "#14202b";
  ctx.fillRect(8, 8, 92, 80);
  ctx.fillStyle = "#f7f9fb";
  ctx.font = "bold 40px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(code, 54, 50);
  // Bench title
  ctx.fillStyle = "#14202b";
  ctx.font = "bold 26px 'Space Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), 118, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/**
 * Build a wooden lab stool tucked near a workbench.
 */
function buildStool(parent, x, z, woodMat, metalMat) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), woodMat);
  seat.position.y = 0.62;
  seat.castShadow = true;
  seat.receiveShadow = true;
  outline(seat, 30);
  g.add(seat);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.62, 8), metalMat);
    leg.position.set(Math.cos(a) * 0.2, 0.31, Math.sin(a) * 0.2);
    leg.rotation.z = Math.cos(a) * 0.1;
    leg.rotation.x = -Math.sin(a) * 0.1;
    leg.castShadow = true;
    g.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 16), metalMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  g.add(ring);
  parent.add(g);
}

/**
 * Muted non-clickable tabletop clutter placed on spare bench slots so every table feels lived-in.
 */
function buildTableClutter(parent, x, y, z, variant) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mBook1 = mat(0x9fb0bf);
  const mBook2 = mat(0xb8c6d2);
  const mMug = mat(0xdde4ea);
  const mGlass = mat(0xcfe8f4, { transparent: true, opacity: 0.45, roughness: 0.2 });
  const mLiquid = mat(0x88a8b8, { transparent: true, opacity: 0.55 });
  const steamRings = [];

  // Stacked lab notebooks
  box(g, 0.48, 0.07, 0.36, mBook1, -0.26, 0.035, 0.1);
  const b2 = box(g, 0.44, 0.06, 0.32, mBook2, -0.24, 0.1, 0.08);
  b2.rotation.y = 0.14;

  // Coffee mug with gently rising steam wisps
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.16, 12), mMug);
  mug.position.set(-0.22, 0.21, 0.08);
  mug.castShadow = true;
  outline(mug, 32);
  g.add(mug);

  for (let i = 0; i < 2; i++) {
    const puff = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.008, 6, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }),
    );
    puff.rotation.x = Math.PI / 2;
    puff.position.set(-0.22, 0.34 + i * 0.1, 0.08);
    g.add(puff);
    steamRings.push({ mesh: puff, phase: i * 1.5 });
  }

  // Erlenmeyer flask & beaker (muted blueprint glassware)
  const flask = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 14), mGlass);
  flask.position.set(0.26, 0.14, -0.06);
  g.add(flask);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.14, 12), mGlass);
  neck.position.set(0.26, 0.32, -0.06);
  g.add(neck);
  const liq = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 12), mLiquid);
  liq.position.set(0.26, 0.07, -0.06);
  g.add(liq);

  if (variant % 2 === 1) {
    // Graduated cylinder beside flask
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 12), mGlass);
    cyl.position.set(0.46, 0.19, 0.14);
    g.add(cyl);
  }

  parent.add(g);
  return (t) => {
    for (const s of steamRings) {
      const u = ((t * 0.55 + s.phase) % 1);
      s.mesh.position.y = 0.31 + u * 0.26;
      s.mesh.scale.setScalar(0.75 + u * 0.65);
      s.mesh.material.opacity = Math.sin(u * Math.PI) * 0.32;
    }
  };
}

/**
 * Build the complete 3D cutaway laboratory environment around the dynamic layout.
 */
export function buildLabRoom3D(scene, layout, lang) {
  const root = new THREE.Group();
  scene.add(root);

  const { roomWidth, roomDepth, benches } = layout;
  const halfW = roomWidth / 2;
  const halfD = roomDepth / 2;
  const wallH = 6.2;

  const animUpdaters = [];
  const signMeshes = [];
  const lampLights = [];
  const lampCones = [];
  const lampBulbs = [];
  const windowPanes = [];

  // Shared architectural materials updated live on theme toggle
  const floorMat = mat(0xffffff, { roughness: 0.9 });
  const wallMat = mat(0xe3eaf0, { roughness: 0.92 });
  const wainscotMat = mat(0xcfd9e3, { roughness: 0.88 });
  const trimMat = mat(0xb8c5d2, { roughness: 0.82 });
  const slabMat = mat(0x9fb0bf, { roughness: 0.9 });
  const oakMat = mat(0xd8b68a, { roughness: 0.78 });
  const steelMat = mat(0x3a4958, { roughness: 0.52, metalness: 0.35 });
  const drawerMat = mat(0xc5d0db, { roughness: 0.82 });
  const brassMat = mat(0xd4a94e, { roughness: 0.4, metalness: 0.5 });

  // ── FLOOR SLAB ──
  const floorSlab = box(root, roomWidth + 0.8, 0.4, roomDepth + 0.8, slabMat, 0, -0.2, 0, true);
  floorSlab.castShadow = false;
  const floorTop = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
  floorTop.rotation.x = -Math.PI / 2;
  floorTop.position.y = 0.005;
  floorTop.receiveShadow = true;
  root.add(floorTop);

  // ── BACK WALL (Z = -halfD) & LEFT WALL (X = -halfW) ──
  const wallThick = 0.4;
  box(root, roomWidth + wallThick * 2, wallH, wallThick, wallMat, 0, wallH / 2, -halfD - wallThick / 2);
  box(root, wallThick, wallH, roomDepth + wallThick, wallMat, -halfW - wallThick / 2, wallH / 2, 0);

  // Wainscoting + dado rail + baseboard on back & left walls
  box(root, roomWidth, 1.55, 0.08, wainscotMat, 0, 0.775, -halfD + 0.04, false);
  box(root, roomWidth, 0.1, 0.14, trimMat, 0, 1.58, -halfD + 0.07);
  box(root, 0.08, 1.55, roomDepth, wainscotMat, -halfW + 0.04, 0.775, 0, false);
  box(root, 0.14, 0.1, roomDepth, trimMat, -halfW + 0.07, 1.58, 0);

  // ── GIANT CLASSROOM CHALKBOARD ON BACK WALL ──
  const boardW = 7.4;
  const boardH = 3.0;
  box(root, boardW + 0.3, boardH + 0.3, 0.16, oakMat, 0, 3.65, -halfD + 0.1);
  const chalkMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boardW, boardH),
    new THREE.MeshStandardMaterial({ map: makeChalkboardTexture(), roughness: 0.92 }),
  );
  chalkMesh.position.set(0, 3.65, -halfD + 0.19);
  root.add(chalkMesh);
  // Chalk tray + eraser + chalk sticks
  box(root, boardW + 0.5, 0.12, 0.28, oakMat, 0, 2.08, -halfD + 0.22);
  box(root, 0.36, 0.1, 0.14, mat(0xc46b54), -1.8, 2.19, -halfD + 0.24);
  box(root, 0.22, 0.04, 0.04, mat(0xf4f8f6), -1.1, 2.16, -halfD + 0.24, false);

  // ── TICKING 3D WALL CLOCK ON BACK WALL ──
  const clockGrp = new THREE.Group();
  clockGrp.position.set(5.4, 4.7, -halfD + 0.14);
  root.add(clockGrp);
  const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.14, 24), trimMat);
  clockBody.rotation.x = Math.PI / 2;
  outline(clockBody, 32);
  clockGrp.add(clockBody);
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 24), mat(0xf7f9fb));
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.z = 0.07;
  clockGrp.add(clockFace);
  const minHand = new THREE.Group();
  minHand.position.z = 0.11;
  clockGrp.add(minHand);
  box(minHand, 0.045, 0.36, 0.02, steelMat, 0, 0.15, 0, false);
  const hrHand = new THREE.Group();
  hrHand.position.z = 0.1;
  hrHand.rotation.z = -1.1;
  clockGrp.add(hrHand);
  box(hrHand, 0.06, 0.24, 0.02, steelMat, 0, 0.09, 0, false);
  const secHand = new THREE.Group();
  secHand.position.z = 0.125;
  clockGrp.add(secHand);
  box(secHand, 0.022, 0.44, 0.015, mat(0xe8553d), 0, 0.17, 0, false);
  animUpdaters.push((t) => {
    secHand.rotation.z = -Math.floor(t) * ((Math.PI * 2) / 60);
    minHand.rotation.z = -t * 0.008 - 0.6;
  });

  // ── WALL BOOKSHELVES FLANKING THE CHALKBOARD ──
  const bookColors = [0x8b9eb0, 0xa8927c, 0x7d998c, 0xb28787, 0x8e8aa8, 0xa3a987];
  for (const bx of [-6.8, 6.8]) {
    const shelf = new THREE.Group();
    shelf.position.set(bx, 0, -halfD + 0.5);
    root.add(shelf);
    box(shelf, 2.7, 3.6, 0.72, oakMat, 0, 1.8, 0);
    for (let row = 0; row < 3; row++) {
      const sy = 0.6 + row * 1.05;
      box(shelf, 2.48, 0.86, 0.62, wainscotMat, 0, sy, 0.08, false);
      let cursor = -1.04;
      for (let b = 0; b < 8 && cursor < 0.9; b++) {
        const bw = 0.14 + ((b * 7 + row * 3) % 4) * 0.04;
        const bh = 0.56 + ((b * 5 + row) % 4) * 0.07;
        const bm = mat(bookColors[(b + row * 2 + (bx > 0 ? 3 : 0)) % bookColors.length]);
        box(shelf, bw, bh, 0.44, bm, cursor + bw / 2, sy - 0.42 + bh / 2, 0.12);
        cursor += bw + 0.04;
      }
    }
  }

  // ── TALL GRIDDED LAB WINDOWS ALONG THE LEFT WALL ──
  const winCount = Math.max(2, Math.floor(roomDepth / 5.5));
  for (let i = 0; i < winCount; i++) {
    const wz = -halfD + 3.2 + (i * (roomDepth - 6.4)) / Math.max(1, winCount - 1);
    const wg = new THREE.Group();
    wg.position.set(-halfW + 0.08, 3.65, wz);
    wg.rotation.y = Math.PI / 2;
    root.add(wg);

    const wW = 2.6;
    const wH = 2.9;
    // Frame + windowsill
    box(wg, wW + 0.28, wH + 0.28, 0.18, trimMat, 0, 0, -0.02);
    box(wg, wW + 0.48, 0.12, 0.42, oakMat, 0, -wH / 2 - 0.14, 0.14);
    // Sky pane
    const paneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(wW, wH), paneMat);
    pane.position.z = 0.08;
    wg.add(pane);
    windowPanes.push(paneMat);
    // Mullions
    box(wg, 0.08, wH, 0.1, trimMat, 0, 0, 0.09, false);
    box(wg, wW, 0.08, 0.1, trimMat, 0, 0.1, 0.09, false);

    // Potted window succulent on alternate sills
    if (i % 2 === 0) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.2, 10), mat(0xb87a5e));
      pot.position.set(0.75, -wH / 2 + 0.02, 0.2);
      pot.castShadow = true;
      wg.add(pot);
      const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat(0x5b8a64));
      plant.position.set(0.75, -wH / 2 + 0.2, 0.2);
      plant.castShadow = true;
      wg.add(plant);
    }
  }

  // ── COZY SLEEPING 3D LAB CAT ON A CORNER CRATE ──
  const catCrate = new THREE.Group();
  catCrate.position.set(halfW - 1.5, 0, -halfD + 1.5);
  root.add(catCrate);
  box(catCrate, 1.35, 0.72, 1.05, oakMat, 0, 0.36, 0);
  const catMat = mat(0xd89358);
  const cat = new THREE.Group();
  cat.position.set(0, 0.74, 0);
  catCrate.add(cat);
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), catMat);
  catBody.scale.set(1.25, 0.62, 0.95);
  catBody.position.set(0, 0.14, 0);
  catBody.castShadow = true;
  cat.add(catBody);
  const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), catMat);
  catHead.position.set(-0.28, 0.18, 0.08);
  catHead.castShadow = true;
  cat.add(catHead);
  for (const ez of [-0.07, 0.07]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), catMat);
    ear.position.set(-0.28, 0.33, 0.08 + ez);
    cat.add(ear);
  }
  const catTail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.42, 8), catMat);
  catTail.rotation.z = Math.PI / 2.2;
  catTail.position.set(0.36, 0.14, 0.14);
  cat.add(catTail);
  animUpdaters.push((t) => {
    catBody.scale.y = 0.62 + Math.sin(t * 1.9) * 0.05;
    catTail.rotation.y = Math.sin(t * 1.4) * 0.25;
  });

  // ── 3D LABORATORY ISLAND WORKBENCHES + OVERHEAD PENDANT LAMPS ──
  benches.forEach((tb, idx) => {
    const bg = new THREE.Group();
    bg.position.set(tb.x, 0, tb.z);
    root.add(bg);

    // Thick butcher-block oak tabletop (top sits cleanly at y = tb.topY = 1.0)
    box(bg, tb.width, 0.14, tb.depth, oakMat, 0, tb.topY - 0.07, 0);

    // Steel H-frame legs
    const lx = tb.width / 2 - 0.26;
    const lz = tb.depth / 2 - 0.22;
    for (const sx of [-lx, lx]) {
      for (const sz of [-lz, lz]) {
        box(bg, 0.12, tb.topY - 0.14, 0.12, steelMat, sx, (tb.topY - 0.14) / 2, sz);
      }
      box(bg, 0.1, 0.08, tb.depth - 0.44, steelMat, sx, 0.24, 0, false);
    }
    // Lower longitudinal stretcher + storage shelf
    box(bg, tb.width - 0.56, 0.06, tb.depth - 0.66, trimMat, 0, 0.24, 0);

    // Under-bench wooden drawer unit on left & right ends
    for (const dx of [-tb.width / 2 + 1.05, tb.width / 2 - 1.05]) {
      box(bg, 1.35, 0.58, tb.depth - 0.34, drawerMat, dx, 0.58, 0);
      box(bg, 0.28, 0.05, 0.06, brassMat, dx, 0.72, (tb.depth - 0.34) / 2 + 0.03, false);
      box(bg, 0.28, 0.05, 0.06, brassMat, dx, 0.46, (tb.depth - 0.34) / 2 + 0.03, false);
    }

    // Front Bench Zone Signboard mounted on center front apron
    const signMat = new THREE.MeshStandardMaterial({
      map: makeBenchSignTexture(tb.displayCode, tb.title?.[lang] || tb.title?.en || tb.id),
      roughness: 0.7,
    });
    const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.44), signMat);
    signPlane.position.set(0, 0.64, tb.depth / 2 - 0.14);
    bg.add(signPlane);
    signMeshes.push({ mat: signMat, bench: tb });

    // Tucked-in lab stool next to bench
    buildStool(root, tb.x + (idx % 2 === 0 ? -1.4 : 1.4), tb.z + tb.depth / 2 + 0.52, oakMat, steelMat);

    // Non-clickable tabletop clutter on spare bench slots
    if (tb.clutterLocalX !== null) {
      const upd = buildTableClutter(bg, tb.clutterLocalX, tb.topY, 0, idx);
      animUpdaters.push(upd);
    }

    // Overhead hanging industrial workshop pendant lamp centered above this bench
    const lampGrp = new THREE.Group();
    lampGrp.position.set(tb.x, 4.95, tb.z);
    root.add(lampGrp);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), steelMat);
    cord.position.y = 0.75;
    lampGrp.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.34, 14), steelMat);
    shade.position.y = 0;
    outline(shade, 28);
    lampGrp.add(shade);
    const bulbMat = mat(0xfff0b8, { emissive: 0xffd56b, emissiveIntensity: 0.8 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bulbMat);
    bulb.position.y = -0.14;
    lampGrp.add(bulb);
    lampBulbs.push(bulbMat);

    // Subtle translucent volumetric light cone
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.6, 16, 1, true), coneMat);
    cone.position.y = -1.96;
    lampGrp.add(cone);
    lampCones.push(coneMat);

    // Warm tungsten lamp point light (brighter in dark mode!)
    const pt = new THREE.PointLight(0xffcf78, 0.25, 11, 1.8);
    pt.position.set(tb.x, 4.4, tb.z);
    root.add(pt);
    lampLights.push(pt);
  });

  // ── FLOATING AMBIENT DUST MOTES / CHALK SPARKLES ──
  const moteCount = 65;
  const motePos = new Float32Array(moteCount * 3);
  const moteBase = [];
  for (let i = 0; i < moteCount; i++) {
    const mx = (Math.random() - 0.5) * (roomWidth - 2);
    const my = 1.2 + Math.random() * 4.2;
    const mz = (Math.random() - 0.5) * (roomDepth - 2);
    motePos[i * 3] = mx;
    motePos[i * 3 + 1] = my;
    motePos[i * 3 + 2] = mz;
    moteBase.push({ x: mx, y: my, z: mz, p: Math.random() * Math.PI * 2 });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xfff3c4,
    size: 0.09,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  root.add(motes);
  animUpdaters.push((t) => {
    const pos = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      const b = moteBase[i];
      pos[i * 3] = b.x + Math.sin(t * 0.4 + b.p) * 0.18;
      pos[i * 3 + 1] = b.y + Math.cos(t * 0.35 + b.p) * 0.16;
    }
    moteGeo.attributes.position.needsUpdate = true;
  });

  // ── SCENE LIGHTS (updated live between Daytime & Late-Night themes) ──
  const hemiLight = new THREE.HemisphereLight(0xebf4ff, 0x7b8996, 0.78);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6e5, 0.92);
  keyLight.position.set(-10, 18, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 52;
  const sc = Math.max(roomWidth, roomDepth) * 0.72;
  keyLight.shadow.camera.left = -sc;
  keyLight.shadow.camera.right = sc;
  keyLight.shadow.camera.top = sc;
  keyLight.shadow.camera.bottom = -sc;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaad0f5, 0.32);
  fillLight.position.set(14, 10, -8);
  scene.add(fillLight);

  let floorTex = null;
  let winTex = null;

  function applyTheme(dark) {
    if (floorTex) floorTex.dispose();
    if (winTex) winTex.dispose();
    floorTex = makeFloorTexture(dark);
    winTex = makeWindowSkyTexture(dark);
    floorMat.map = floorTex;
    floorMat.needsUpdate = true;
    for (const pm of windowPanes) {
      pm.map = winTex;
      pm.needsUpdate = true;
    }

    const bgHex = dark ? 0x0f171f : 0xc9d3dd;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 28, 62);

    wallMat.color.setHex(dark ? 0x1b2834 : 0xe4ebf1);
    wainscotMat.color.setHex(dark ? 0x141e28 : 0xcfd9e3);
    trimMat.color.setHex(dark ? 0x263645 : 0xb8c5d2);
    slabMat.color.setHex(dark ? 0x18232d : 0xa3b3c2);
    oakMat.color.setHex(dark ? 0x6b4f39 : 0xd9b88e);
    drawerMat.color.setHex(dark ? 0x22303e : 0xc5d0db);
    inkLineMat.color.setHex(dark ? 0x091017 : 0x14202b);

    hemiLight.color.setHex(dark ? 0x45608a : 0xebf4ff);
    hemiLight.groundColor.setHex(dark ? 0x151e28 : 0x7b8996);
    hemiLight.intensity = dark ? 0.5 : 0.78;

    keyLight.color.setHex(dark ? 0x8fb4f0 : 0xfff6e5);
    keyLight.intensity = dark ? 0.45 : 0.92;
    fillLight.intensity = dark ? 0.22 : 0.34;

    for (const l of lampLights) l.intensity = dark ? 1.15 : 0.2;
    for (const c of lampCones) c.opacity = dark ? 0.11 : 0.045;
    for (const b of lampBulbs) b.emissiveIntensity = dark ? 1.5 : 0.75;
    moteMat.opacity = dark ? 0.55 : 0.38;
  }

  function updateLanguage(newLang) {
    for (const item of signMeshes) {
      if (item.mat.map) item.mat.map.dispose();
      item.mat.map = makeBenchSignTexture(
        item.bench.displayCode,
        item.bench.title?.[newLang] || item.bench.title?.en || item.bench.id,
      );
      item.mat.needsUpdate = true;
    }
  }

  return {
    root,
    applyTheme,
    updateLanguage,
    update(t, reducedMotion) {
      if (reducedMotion) return;
      for (const fn of animUpdaters) fn(t);
    },
  };
}
