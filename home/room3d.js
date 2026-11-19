// Labs · home/room3d.js
// Builds the stylized cel/shell-shaded 3D cutaway laboratory hall: tiled floor, back & left
// architectural walls, day/night windows, classroom chalkboard, bookshelves, ticking wall clock,
// overhead pendant lamps, scalable island workbenches with bilingual zone signs, stools,
// tabletop clutter, dust motes & sleeping lab cat.

import {
  toonMat,
  addShell,
  addCreases,
  roomShellMat,
  detailShellMat,
  roomCreaseMat,
  setCelTheme,
} from "./cel.js";
import {
  createStackedMonstera,
  createStackedLabCat,
  createStackedBenchClutter,
} from "./spritestack.js";

function mat(color, opts = {}) {
  return toonMat(color, opts);
}

function outline(mesh, deg = 24, shelled = false) {
  if (shelled && (!mesh.material || !mesh.material.transparent)) {
    addShell(mesh, roomShellMat);
  }
  addCreases(mesh, roomCreaseMat, deg);
  return mesh;
}

function box(parent, w, h, d, m, x = 0, y = 0, z = 0, edged = true, shelled = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (edged) outline(mesh, 24, shelled);
  else if (shelled) addShell(mesh, roomShellMat);
  parent.add(mesh);
  return mesh;
}

function makeFloorTexture(dark) {
  // Harmonized with Matephis kit graph-paper drafting surface (DESIGN.md §3)
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = dark ? "#16212c" : "#dde4eb";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = dark ? "#1a2733" : "#d4dde6";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  // Crisp 1px drafting graph-paper grid lines
  ctx.fillStyle = dark ? "rgba(201,211,221,0.1)" : "rgba(20,32,43,0.14)";
  ctx.fillRect(0, 0, 64, 1);
  ctx.fillRect(0, 0, 1, 64);
  ctx.fillRect(0, 32, 64, 1);
  ctx.fillRect(32, 0, 1, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 10);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeChalkboardTexture(theme = "physics") {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 420;
  const ctx = c.getContext("2d");
  ctx.fillStyle = theme === "xr" ? "#18283b" : "#233936";
  ctx.fillRect(0, 0, 1024, 420);

  ctx.fillStyle = "rgba(235,245,240,0.04)";
  ctx.fillRect(26, 22, 972, 376);
  ctx.strokeStyle = "rgba(235,245,240,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 984, 380);

  ctx.fillStyle = "rgba(238,246,242,0.85)";
  ctx.font = "bold 36px 'Space Mono', monospace";

  if (theme === "math") {
    ctx.fillText("e^(iπ) + 1 = 0", 60, 112);
    ctx.fillText("Σ 1/n² = π² / 6", 60, 198);
    ctx.fillText("d₁(A,B) = |Δx| + |Δy|", 60, 286);
    ctx.fillText("Sₙ → L", 60, 360);

    // Geometric inscribed circle + triangle
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(690, 200, 96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(140,203,235,0.85)";
    ctx.beginPath();
    ctx.moveTo(690, 104);
    ctx.lineTo(774, 248);
    ctx.lineTo(606, 248);
    ctx.closePath();
    ctx.stroke();
  } else if (theme === "xr") {
    ctx.fillText("g ∘ f : X → Z", 60, 112);
    ctx.fillText("F(ω) = ∫ f(t)e^(-iωt)dt", 60, 202);
    ctx.fillText("x²/a² + y²/b² = z", 60, 294);
    ctx.fillText("WebXR · 3D", 60, 362);

    // Wireframe quadric + axes
    ctx.strokeStyle = "rgba(140,203,235,0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(790, 140, 95, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(790, 290, 95, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(695, 140);
    ctx.lineTo(885, 290);
    ctx.moveTo(885, 140);
    ctx.lineTo(695, 290);
    ctx.stroke();
  } else {
    ctx.fillText("F = m · a", 64, 110);
    ctx.fillText("Δp = ∫ F(t) dt", 64, 195);
    ctx.fillText("T = 2π √(L / g)", 64, 280);
    ctx.fillText("p₁ + p₂ = const", 64, 355);
    ctx.fillText("x(t) = x₀ + v₀t + ½at²", 530, 355);

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
  }

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeWindowSkyTexture(dark) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (!dark) {
    ctx.fillStyle = "#9ad2f4";
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = "#bfe3fa";
    ctx.fillRect(0, 96, 128, 64);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(14, 32, 48, 14);
    ctx.fillRect(24, 22, 28, 12);
    ctx.fillRect(64, 74, 52, 14);
    ctx.fillRect(76, 64, 28, 12);
  } else {
    ctx.fillStyle = "#0b1428";
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = "#ffd86b";
    ctx.fillRect(82, 30, 16, 18);
    ctx.fillStyle = "#0b1428";
    ctx.fillRect(88, 28, 14, 14);
    ctx.fillStyle = "#eaf2ff";
    for (const [sx, sy] of [[22, 26], [48, 56], [30, 96], [98, 106], [68, 32], [74, 128]]) {
      ctx.fillRect(sx - 3, sy, 7, 2);
      ctx.fillRect(sx, sy - 3, 2, 7);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
  outline(seat, 30, true);
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
 * Sprite-stacked non-clickable tabletop clutter placed on spare bench slots (1 draw call + tiny steam pixels).
 */
function buildTableClutter(parent, x, y, z, variant) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stack = createStackedBenchClutter();
  stack.rotation.y = variant % 2 === 0 ? 0.12 : -0.18;
  g.add(stack);

  // Subtle floating pixel steam cubes rising above the stacked coffee mug
  const steamCubes = [];
  for (let i = 0; i < 2; i++) {
    const puff = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.055, 0.055),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    puff.position.set(-0.22, 0.42 + i * 0.12, 0.12);
    puff.userData.noPixelEdge = true;
    g.add(puff);
    steamCubes.push({ mesh: puff, phase: i * 0.5 });
  }

  parent.add(g);
  return (t) => {
    for (const s of steamCubes) {
      const u = (t * 0.45 + s.phase) % 1;
      s.mesh.position.y = 0.36 + u * 0.28;
      s.mesh.material.opacity = Math.sin(u * Math.PI) * 0.5;
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

  // ── GIANT CLASSROOM CHALKBOARD ON BACK WALL (scaled cleanly to room width) ──
  const roomTheme = layout.room?.theme || "physics";
  const boardW = Math.min(7.2, Math.max(5.2, roomWidth * 0.44));
  const boardH = 2.9;
  const chalkTex = makeChalkboardTexture(roomTheme);
  box(root, boardW + 0.3, boardH + 0.3, 0.16, oakMat, 0, 3.65, -halfD + 0.1);
  const chalkMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boardW, boardH),
    toonMat(0xffffff, { map: chalkTex }),
  );
  chalkMesh.position.set(0, 3.65, -halfD + 0.19);
  root.add(chalkMesh);
  // Chalk tray + eraser + chalk sticks
  box(root, boardW + 0.5, 0.12, 0.28, oakMat, 0, 2.08, -halfD + 0.22);
  box(root, 0.36, 0.1, 0.14, mat(0xc46b54), -boardW * 0.24, 2.19, -halfD + 0.24);
  box(root, 0.22, 0.04, 0.04, mat(0xf4f8f6), -boardW * 0.14, 2.16, -halfD + 0.24, false);

  // ── TICKING 3D WALL CLOCK ON BACK WALL ──
  const clockGrp = new THREE.Group();
  clockGrp.position.set(Math.min(5.2, halfW - 1.7), 4.7, -halfD + 0.14);
  root.add(clockGrp);
  const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.14, 24), trimMat);
  clockBody.rotation.x = Math.PI / 2;
  outline(clockBody, 32, true);
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
  const shelfXs = roomWidth > 17 ? [-halfW + 3.2, halfW - 3.6] : [-halfW + 1.8];
  for (const bx of shelfXs) {
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

    // Sprite-stacked windowsill Monstera deliciosa on alternate sills
    if (i % 2 === 0) {
      const miniPlant = createStackedMonstera(0.62);
      miniPlant.position.set(0.72, -wH / 2 - 0.08, 0.22);
      wg.add(miniPlant);
    }
  }

  // ── HERO SPRITE-STACKED MONSTERA PLANT ON FRONT-LEFT CORNER STAND ──
  const plantStand = new THREE.Group();
  plantStand.position.set(-halfW + 1.45, 0, halfD - 1.45);
  root.add(plantStand);
  box(plantStand, 0.96, 0.62, 0.96, oakMat, 0, 0.31, 0);
  const heroMonstera = createStackedMonstera(1.38);
  heroMonstera.position.set(0, 0.62, 0);
  plantStand.add(heroMonstera);
  animUpdaters.push((t) => {
    heroMonstera.rotation.y = Math.sin(t * 0.45) * 0.08;
  });

  // ── COZY SPRITE-STACKED SLEEPING LAB CAT ON A CORNER CRATE ──
  const catCrate = new THREE.Group();
  catCrate.position.set(halfW - 1.5, 0, -halfD + 1.5);
  root.add(catCrate);
  box(catCrate, 1.35, 0.72, 1.05, oakMat, 0, 0.36, 0, true, true);
  const catStack = createStackedLabCat();
  catStack.position.set(0, 0.72, 0);
  catCrate.add(catStack);
  animUpdaters.push((t) => {
    catStack.scale.y = 1 + Math.sin(t * 1.9) * 0.07;
  });

  // ── 3D LABORATORY ISLAND WORKBENCHES + OVERHEAD PENDANT LAMPS ──
  benches.forEach((tb, idx) => {
    const bg = new THREE.Group();
    bg.position.set(tb.x, 0, tb.z);
    root.add(bg);

    // Thick butcher-block oak tabletop (top sits cleanly at y = tb.topY = 1.0)
    box(bg, tb.width, 0.14, tb.depth, oakMat, 0, tb.topY - 0.07, 0, true, true);

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

    // Clean recessed metal rail on front bench apron (crisp projected bench nameplate mounts here)
    box(bg, 2.3, 0.34, 0.08, steelMat, 0, 0.64, tb.depth / 2 - 0.16, false);

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
    outline(shade, 28, true);
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
    cone.userData.noPixelEdge = true;
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
  motes.userData.noPixelEdge = true;
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

  // ── SCENE LIGHTS (attached to root so switching rooms cleans them up automatically) ──
  const hemiLight = new THREE.HemisphereLight(0xebf4ff, 0x7b8996, 0.78);
  root.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6e5, 0.92);
  keyLight.position.set(-10, 18, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 52;
  const sc = Math.max(roomWidth, roomDepth) * 0.72;
  keyLight.shadow.camera.left = -sc;
  keyLight.shadow.camera.right = sc;
  keyLight.shadow.camera.top = sc;
  keyLight.shadow.camera.bottom = -sc;
  keyLight.shadow.bias = -0.0012;
  root.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaad0f5, 0.32);
  fillLight.position.set(14, 10, -8);
  root.add(fillLight);

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

    const bgHex = dark ? 0x111a22 : 0xc9d3dd;
    scene.background = new THREE.Color(bgHex);
    scene.fog = null;

    wallMat.color.setHex(dark ? 0x1b2834 : 0xe4ebf1);
    wainscotMat.color.setHex(dark ? 0x141e28 : 0xcfd9e3);
    trimMat.color.setHex(dark ? 0x263645 : 0xb8c5d2);
    slabMat.color.setHex(dark ? 0x18232d : 0xa3b3c2);
    oakMat.color.setHex(dark ? 0x6b4f39 : 0xd9b88e);
    drawerMat.color.setHex(dark ? 0x22303e : 0xc5d0db);
    setCelTheme(dark);

    hemiLight.color.setHex(dark ? 0x45608a : 0xeff6ff);
    hemiLight.groundColor.setHex(dark ? 0x151e28 : 0x7b8996);
    hemiLight.intensity = dark ? 0.45 : 0.62;

    keyLight.color.setHex(dark ? 0x95b8f5 : 0xfff8ea);
    keyLight.intensity = dark ? 0.52 : 1.05;
    fillLight.intensity = dark ? 0.14 : 0.16;

    for (const l of lampLights) l.intensity = dark ? 1.25 : 0.18;
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

  function dispose() {
    if (floorTex) floorTex.dispose();
    if (winTex) winTex.dispose();
    if (chalkTex) chalkTex.dispose();
    if (root.parent) root.parent.remove(root);
    else scene.remove(root);
  }

  return {
    root,
    applyTheme,
    updateLanguage,
    dispose,
    update(t, reducedMotion) {
      if (reducedMotion) return;
      for (const fn of animUpdaters) fn(t);
    },
  };
}
