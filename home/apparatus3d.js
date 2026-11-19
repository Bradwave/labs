// Labs · home/apparatus3d.js
// 21 bespoke, physically accurate 3D animated lab apparatuses + modular fallback console.
// Built for Three.js r128 with matte stylized shading, ink edge outlines, tabletop mats,
// hover/search 3D selection rings and bouncing crystal beacons.

const INK_COLOR = 0x14202b;

function hexNum(cssHex, fallback = 0x8ccbeb) {
  if (!cssHex || typeof cssHex !== "string") return fallback;
  const n = parseInt(cssHex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : fallback;
}

function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.76,
    metalness: opts.metalness ?? 0.06,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

const sharedInkLineMat = new THREE.LineBasicMaterial({ color: INK_COLOR });
const sharedDarkMetal = makeMat(0x283542, { roughness: 0.45, metalness: 0.45 });
const sharedChrome = makeMat(0xd5dee6, { roughness: 0.28, metalness: 0.65 });
const sharedGlass = makeMat(0xdff4ff, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.34 });

function addOutline(mesh, threshold = 24) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
  const line = new THREE.LineSegments(edges, sharedInkLineMat);
  mesh.add(line);
  return mesh;
}

function addBox(parent, w, h, d, mat, x = 0, y = 0, z = 0, outlined = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outlined) addOutline(mesh);
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, segs = 16, outlined = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outlined) addOutline(mesh, 32);
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, r, mat, x = 0, y = 0, z = 0, segs = 16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeScreenTexture(drawFn, w = 256, h = 160) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/**
 * Resolve vivid palette materials for an apparatus from its apps.json entry.
 */
function paletteMats(app, allApps) {
  const src = app.palette ? app : allApps.find((b) => b.slug === app.sharesPaletteWith) || {};
  const light = src.palette?.proposed?.approved
    ? { ...src.palette.light, ...src.palette.proposed }
    : src.palette?.light || {};

  const brandHex = light.bg || "#8CCBEB";
  const surfHex = light.surface || "#F7F9FB";
  const accentHex = light.accent || "#E8553D";
  const tile2Hex = light.tile2 || "#FFD23F";
  const inkHex = light.ink || "#14202B";

  return {
    brandHex,
    surfHex,
    accentHex,
    tile2Hex,
    inkHex,
    brand: makeMat(hexNum(brandHex)),
    surface: makeMat(hexNum(surfHex), { roughness: 0.85 }),
    accent: makeMat(hexNum(accentHex), { emissive: hexNum(accentHex), emissiveIntensity: 0.14 }),
    tile2: makeMat(hexNum(tile2Hex), { emissive: hexNum(tile2Hex), emissiveIntensity: 0.1 }),
    ink: makeMat(hexNum(inkHex), { roughness: 0.65 }),
    pos: makeMat(0x2350d8, { emissive: 0x2350d8, emissiveIntensity: 0.12 }),
    vel: makeMat(0x0f9a63, { emissive: 0x0f9a63, emissiveIntensity: 0.12 }),
    force: makeMat(0xe2412a, { emissive: 0xe2412a, emissiveIntensity: 0.22 }),
    mom: makeMat(0x6e3fe0, { emissive: 0x6e3fe0, emissiveIntensity: 0.14 }),
  };
}

// ============================================================================
// 21 BESPOKE 3D ANIMATED APPARATUSES
// ============================================================================

const BUILDERS = {
  // 01 · Pendulum Lab: 3D retort stand, swinging golden bob, force vector & tabletop stopwatch
  "pendulum-lab": (root, m) => {
    addBox(root, 0.96, 0.08, 0.62, m.brand, -0.1, 0.04, 0);
    addBox(root, 0.86, 0.04, 0.52, m.surface, -0.1, 0.1, 0);
    addCyl(root, 0.035, 0.035, 1.18, sharedChrome, -0.44, 0.69, 0, 12);
    addBox(root, 0.14, 0.13, 0.14, m.brand, -0.44, 1.18, 0);
    addBox(root, 0.62, 0.06, 0.08, m.brand, -0.13, 1.18, 0);

    // Pivot pin
    addCyl(root, 0.045, 0.045, 0.12, m.accent, 0.14, 1.18, 0.02, 14).rotation.x = Math.PI / 2;

    // Swinging pendulum assembly
    const arm = new THREE.Group();
    arm.position.set(0.14, 1.18, 0.05);
    root.add(arm);
    addCyl(arm, 0.014, 0.014, 0.72, sharedDarkMetal, 0, -0.36, 0, 8);
    addSphere(arm, 0.14, m.tile2, 0, -0.76, 0, 18);
    // Subtle red gravity vector arrow below bob
    addCyl(arm, 0.015, 0.015, 0.14, m.force, 0, -0.96, 0, 8);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 10), m.force);
    tip.position.set(0, -1.04, 0);
    tip.rotation.x = Math.PI;
    arm.add(tip);

    // Tabletop stopwatch sitting on the right
    const sw = new THREE.Group();
    sw.position.set(0.5, 0.24, 0.18);
    root.add(sw);
    addBox(sw, 0.26, 0.05, 0.2, m.ink, 0, -0.21, 0);
    const dial = addCyl(sw, 0.18, 0.18, 0.08, m.surface, 0, 0, 0, 18, true);
    dial.rotation.x = Math.PI / 2;
    const hand = new THREE.Group();
    hand.position.set(0, 0, 0.055);
    sw.add(hand);
    addBox(hand, 0.022, 0.12, 0.016, m.accent, 0, 0.05, 0, false);

    return (t) => {
      arm.rotation.z = Math.sin(t * 2.55) * 0.52;
      hand.rotation.z = -t * 1.3;
    };
  },

  // 02 · Carts Lab: elevated dynamics rail, twin colliding wheeled carts, blinking photogates & impact star
  "carts-lab": (root, m) => {
    // Support A-legs & track rail
    addBox(root, 0.12, 0.34, 0.44, m.surface, -0.58, 0.17, 0);
    addBox(root, 0.12, 0.34, 0.44, m.surface, 0.58, 0.17, 0);
    addBox(root, 1.44, 0.1, 0.34, m.brand, 0, 0.38, 0);
    // Photogate sensor arches at each end
    addBox(root, 0.09, 0.38, 0.36, m.surface, -0.66, 0.62, 0);
    addBox(root, 0.09, 0.38, 0.36, m.surface, 0.66, 0.62, 0);
    const ledLMat = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 0.4 });
    const ledRMat = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 0.4 });
    addBox(root, 0.06, 0.06, 0.08, ledLMat, -0.66, 0.84, 0.14, false);
    addBox(root, 0.06, 0.06, 0.08, ledRMat, 0.66, 0.84, 0.14, false);

    const makeCart = (bodyMat, bumperMat) => {
      const g = new THREE.Group();
      addBox(g, 0.32, 0.18, 0.24, bodyMat, 0, 0.14, 0);
      addBox(g, 0.04, 0.1, 0.16, bumperMat, 0.18, 0.14, 0, false);
      for (const wx of [-0.1, 0.1]) {
        for (const wz of [-0.12, 0.12]) {
          const w = addCyl(g, 0.048, 0.048, 0.03, sharedDarkMetal, wx, 0.048, wz, 12);
          w.rotation.x = Math.PI / 2;
        }
      }
      g.position.y = 0.43;
      root.add(g);
      return g;
    };

    const cartA = makeCart(m.tile2, m.brand);
    const cartB = makeCart(m.surface, m.accent);
    cartB.rotation.y = Math.PI;

    // 3D impact burst octahedron above collision point
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), m.accent);
    spark.position.set(0, 0.94, 0);
    addOutline(spark, 10);
    root.add(spark);

    return (t) => {
      const p = (t % 3.6) / 3.6;
      // Elastic equal-mass exchange: A moves -0.44 -> -0.17, hits B; B moves 0.17 -> 0.44 -> 0.17, hits A; A returns
      let xA = -0.17;
      let xB = 0.17;
      if (p < 0.25) {
        const u = p / 0.25;
        xA = -0.46 + 0.29 * u;
        xB = 0.17;
      } else if (p < 0.5) {
        const u = (p - 0.25) / 0.25;
        xA = -0.17;
        xB = 0.17 + 0.29 * u;
      } else if (p < 0.75) {
        const u = (p - 0.5) / 0.25;
        xA = -0.17;
        xB = 0.46 - 0.29 * u;
      } else {
        const u = (p - 0.75) / 0.25;
        xA = -0.17 - 0.29 * u;
        xB = 0.17;
      }
      cartA.position.x = xA;
      cartB.position.x = xB;

      const hit = Math.abs(p - 0.25) < 0.055 || Math.abs(p - 0.75) < 0.055;
      spark.visible = hit;
      spark.rotation.y = t * 6;
      spark.scale.setScalar(hit ? 1.05 : 0.01);
      ledLMat.emissiveIntensity = p < 0.08 || p > 0.92 ? 1.2 : 0.1;
      ledRMat.emissiveIntensity = Math.abs(p - 0.5) < 0.08 ? 1.2 : 0.1;
    };
  },

  // 03 · Collision Lab: tilted 2D air table with rim bumpers & equal-mass 90° elastic puck scatter
  "collision-lab": (root, m) => {
    for (const [lx, lz] of [[-0.56, -0.38], [0.56, -0.38], [-0.56, 0.38], [0.56, 0.38]]) {
      addCyl(root, 0.04, 0.04, 0.22, sharedDarkMetal, lx, 0.11, lz, 10);
    }
    const table = new THREE.Group();
    table.position.set(0, 0.32, 0);
    table.rotation.x = 0.22; // gently tilted toward camera so pucks are super legible!
    root.add(table);

    // Outer bumper rim + playing surface
    addBox(table, 1.34, 0.12, 0.94, m.brand, 0, 0, 0);
    addBox(table, 1.18, 0.04, 0.78, m.surface, 0, 0.06, 0, false);

    // Two 3D pucks
    const pA = addCyl(table, 0.12, 0.12, 0.07, m.tile2, -0.35, 0.115, -0.04, 18, true);
    const pB = addCyl(table, 0.12, 0.12, 0.07, m.accent, 0.02, 0.115, 0.06, 18, true);

    return (t) => {
      const p = (t % 3.2) / 3.2;
      if (p < 0.4) {
        const u = p / 0.4;
        pA.position.set(-0.42 + 0.22 * u, 0.115, -0.06);
        pB.position.set(0.02, 0.115, 0.06);
        pA.visible = pB.visible = true;
      } else if (p < 0.88) {
        const u = (p - 0.4) / 0.48;
        pA.position.set(-0.2 + 0.24 * u, 0.115, -0.06 - 0.26 * u);
        pB.position.set(0.02 + 0.38 * u, 0.115, 0.06 + 0.22 * u);
        pA.visible = pB.visible = true;
      } else {
        pA.visible = pB.visible = false;
      }
    };
  },

  // 04 · Impulse Lab: spring force-sensor wall + rolling orange ball + live F(t) oscilloscope
  "impulse-lab": (root, m) => {
    // Launch track & wall on left
    addBox(root, 0.78, 0.08, 0.46, m.surface, -0.34, 0.04, 0.06);
    addBox(root, 0.14, 0.56, 0.44, m.brand, -0.02, 0.32, 0.06);

    // Helical 3D coiled spring
    const springPts = [];
    for (let i = 0; i <= 36; i++) {
      const f = i / 36;
      const a = f * Math.PI * 8;
      springPts.push(new THREE.Vector3(-f * 0.26, Math.sin(a) * 0.06, Math.cos(a) * 0.06));
    }
    const springMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 40, 0.015, 6, false),
      sharedChrome,
    );
    springMesh.position.set(-0.09, 0.22, 0.06);
    springMesh.castShadow = true;
    root.add(springMesh);

    const ball = addSphere(root, 0.11, m.accent, -0.58, 0.19, 0.06);

    // Chunky tabletop F(t) oscilloscope on right
    addBox(root, 0.66, 0.74, 0.46, m.brand, 0.42, 0.39, -0.04);
    const screenTex = makeScreenTexture((ctx, w, h) => {
      ctx.fillStyle = m.surfHex;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#14202b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 128);
      ctx.lineTo(236, 128);
      ctx.stroke();
      ctx.fillStyle = m.tile2Hex;
      ctx.beginPath();
      ctx.moveTo(46, 128);
      ctx.bezierCurveTo(86, 128, 96, 34, 128, 34);
      ctx.bezierCurveTo(160, 34, 170, 128, 210, 128);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.stroke();
    });
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      roughness: 0.4,
      emissive: 0xffffff,
      emissiveMap: screenTex,
      emissiveIntensity: 0.18,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.38), screenMat);
    screen.position.set(0.42, 0.5, 0.195);
    root.add(screen);
    // Rotary knobs
    addCyl(root, 0.045, 0.045, 0.05, m.surface, 0.26, 0.18, 0.2, 12).rotation.x = Math.PI / 2;
    addCyl(root, 0.045, 0.045, 0.05, m.tile2, 0.42, 0.18, 0.2, 12).rotation.x = Math.PI / 2;

    return (t) => {
      const p = (t % 3.0) / 3.0;
      let bx = -0.62;
      let sc = 1;
      if (p < 0.36) {
        bx = -0.62 + 0.18 * (p / 0.36);
      } else if (p < 0.5) {
        const u = (p - 0.36) / 0.14;
        const s = Math.sin(u * Math.PI * 0.5);
        bx = -0.44 + 0.11 * s;
        sc = 1 - 0.46 * s;
      } else if (p < 0.64) {
        const u = (p - 0.5) / 0.14;
        const s = Math.cos(u * Math.PI * 0.5);
        bx = -0.44 + 0.11 * s;
        sc = 1 - 0.46 * s;
      } else {
        bx = -0.44 - 0.18 * ((p - 0.64) / 0.36);
      }
      ball.position.x = bx;
      springMesh.scale.x = sc;
      screenMat.emissiveIntensity = p > 0.38 && p < 0.72 ? 0.42 : 0.12;
    };
  },

  // 05 · Motus 1D Lab: linear track + uniformly accelerating cart + triple-screen telemetry rack
  "motus1d-lab": (root, m) => {
    // Telemetry console behind track
    addBox(root, 0.08, 0.44, 0.12, sharedDarkMetal, -0.48, 0.24, -0.26);
    addBox(root, 0.08, 0.44, 0.12, sharedDarkMetal, 0.48, 0.24, -0.26);
    addBox(root, 1.38, 0.56, 0.14, m.brand, 0, 0.72, -0.26);

    const tex = makeScreenTexture((ctx, w, h) => {
      ctx.fillStyle = m.brandHex;
      ctx.fillRect(0, 0, w, h);
      const colors = ["#2350d8", "#0f9a63", "#b42ba0"];
      for (let i = 0; i < 3; i++) {
        const sx = 12 + i * 80;
        ctx.fillStyle = m.surfHex;
        ctx.fillRect(sx, 16, 72, 128);
        ctx.strokeStyle = "#14202b";
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, 16, 72, 128);
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (i === 0) {
          ctx.moveTo(sx + 10, 126);
          ctx.quadraticCurveTo(sx + 40, 126, sx + 62, 34);
        } else if (i === 1) {
          ctx.moveTo(sx + 10, 126);
          ctx.lineTo(sx + 62, 34);
        } else {
          ctx.moveTo(sx + 10, 68);
          ctx.lineTo(sx + 62, 68);
        }
        ctx.stroke();
      }
    }, 256, 160);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.28, 0.46),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14 }),
    );
    panel.position.set(0, 0.72, -0.185);
    root.add(panel);

    // Front linear track
    addBox(root, 1.44, 0.08, 0.34, m.surface, 0, 0.04, 0.2);

    // Accelerating yellow cart
    const cart = new THREE.Group();
    cart.position.set(-0.5, 0.08, 0.2);
    root.add(cart);
    addBox(cart, 0.3, 0.16, 0.22, m.tile2, 0, 0.12, 0);
    addBox(cart, 0.07, 0.07, 0.1, m.accent, 0.08, 0.23, 0);
    for (const wx of [-0.09, 0.09]) {
      for (const wz of [-0.11, 0.11]) {
        const w = addCyl(cart, 0.045, 0.045, 0.03, sharedDarkMetal, wx, 0.045, wz, 10);
        w.rotation.x = Math.PI / 2;
      }
    }

    return (t) => {
      const p = (t % 3.2) / 3.2;
      const u = Math.min(1, p / 0.78);
      cart.position.x = -0.52 + 1.04 * u * u; // true uniform acceleration x ∝ t²
      cart.visible = p < 0.94;
    };
  },

  // 06 · Relative Motion Lab: model railway + moving train tossing a yellow sphere along a true Galilean parabola
  "relative-motion-lab": (root, m) => {
    addBox(root, 1.48, 0.07, 0.4, m.brand, 0, 0.035, 0);
    addBox(root, 1.44, 0.03, 0.05, sharedChrome, 0, 0.085, -0.11, false);
    addBox(root, 1.44, 0.03, 0.05, sharedChrome, 0, 0.085, 0.11, false);

    // Faint translucent parabolic arch wire showing ground-frame trajectory
    const arcPts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      arcPts.push(new THREE.Vector3(-0.52 + 1.04 * u, 0.44 + 0.68 * 4 * u * (1 - u), 0));
    }
    const arcLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(arcPts),
      new THREE.LineBasicMaterial({ color: hexNum(m.surfHex), transparent: true, opacity: 0.75 }),
    );
    root.add(arcLine);

    const train = new THREE.Group();
    train.position.set(0, 0.1, 0);
    root.add(train);
    addBox(train, 0.44, 0.24, 0.28, m.surface, 0, 0.17, 0);
    addBox(train, 0.46, 0.05, 0.3, m.brand, 0, 0.3, 0);
    addCyl(train, 0.055, 0.065, 0.12, m.accent, 0, 0.38, 0, 12);
    for (const wx of [-0.14, 0.14]) {
      for (const wz of [-0.14, 0.14]) {
        const w = addCyl(train, 0.05, 0.05, 0.03, sharedDarkMetal, wx, 0.05, wz, 12);
        w.rotation.x = Math.PI / 2;
      }
    }

    const ball = addSphere(root, 0.085, m.tile2, 0, 0.9, 0);

    return (t) => {
      const p = (t % 3.0) / 3.0;
      const u = Math.min(1, p / 0.84);
      const x = -0.52 + 1.04 * u;
      const y = 0.46 + 0.68 * 4 * u * (1 - u);
      train.position.x = x;
      ball.position.set(x, y, 0);
    };
  },

  // 07 · Crackler: 3D cinema camera on tripod aiming at a calibrated drop tower with stroboscopic rings
  "crackler": (root, m) => {
    // Tripod on left
    const camHead = new THREE.Vector3(-0.42, 0.62, 0.1);
    for (const [fx, fz] of [[-0.64, 0.3], [-0.2, 0.3], [-0.42, -0.14]]) {
      const start = camHead;
      const end = new THREE.Vector3(fx, 0, fz);
      const dir = end.clone().sub(start);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, dir.length(), 8), sharedDarkMetal);
      leg.position.copy(start).add(end).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      leg.castShadow = true;
      root.add(leg);
    }
    addBox(root, 0.36, 0.24, 0.24, m.brand, -0.44, 0.76, 0.1);
    const lens = addCyl(root, 0.08, 0.06, 0.14, m.surface, -0.2, 0.76, 0.1, 14, true);
    lens.rotation.z = Math.PI / 2;
    const recMat = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 0.9 });
    addSphere(root, 0.032, recMat, -0.54, 0.84, 0.23, 10);

    // Drop tower board on right
    addBox(root, 0.64, 0.08, 0.44, m.brand, 0.34, 0.04, -0.02);
    addBox(root, 0.56, 1.12, 0.08, m.surface, 0.34, 0.64, -0.12);

    // 5 stroboscopic target rings at y ∝ t²
    const rings = [];
    const ringMats = [];
    for (let i = 0; i < 5; i++) {
      const f = i / 4;
      const ry = 1.08 - 0.88 * f * f;
      const rm = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 0.35, transparent: true, opacity: 1 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 8, 16), rm);
      ring.position.set(0.34, ry, -0.05);
      root.add(ring);
      rings.push(ring);
      ringMats.push(rm);
    }

    const ball = addSphere(root, 0.08, m.tile2, 0.34, 1.08, 0.04);

    return (t) => {
      const p = (t % 3.2) / 3.2;
      const u = Math.min(1, p / 0.78);
      ball.position.y = 1.08 - 0.88 * u * u;
      ball.visible = p < 0.82;
      recMat.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.2 : 0.15;
      for (let i = 0; i < 5; i++) {
        const thresh = (i / 4) * 0.78;
        rings[i].visible = p >= thresh && p < 0.94;
      }
    };
  },

  // 08 · Units Lab: 3D brass two-pan balance + miniature summit mountain with climbing flag
  "units-lab": (root, m) => {
    // Balance on left
    addBox(root, 0.58, 0.08, 0.38, m.brand, -0.34, 0.04, 0.06);
    addCyl(root, 0.035, 0.07, 0.66, m.surface, -0.34, 0.41, 0.06, 12, true);
    const beam = new THREE.Group();
    beam.position.set(-0.34, 0.74, 0.06);
    root.add(beam);
    addBox(beam, 0.66, 0.05, 0.06, m.brand, 0, 0, 0);

    const panL = new THREE.Group();
    panL.position.set(-0.28, -0.02, 0);
    beam.add(panL);
    addCyl(panL, 0.01, 0.01, 0.28, sharedDarkMetal, 0, -0.14, 0, 6);
    addCyl(panL, 0.11, 0.1, 0.03, m.surface, 0, -0.28, 0, 14, true);
    addCyl(panL, 0.055, 0.065, 0.12, m.tile2, 0, -0.21, 0, 12);

    const panR = new THREE.Group();
    panR.position.set(0.28, -0.02, 0);
    beam.add(panR);
    addCyl(panR, 0.01, 0.01, 0.28, sharedDarkMetal, 0, -0.14, 0, 6);
    addCyl(panR, 0.11, 0.1, 0.03, m.surface, 0, -0.28, 0, 14, true);
    addCyl(panR, 0.04, 0.045, 0.09, m.accent, -0.035, -0.22, 0, 10);
    addCyl(panR, 0.035, 0.04, 0.07, m.accent, 0.04, -0.23, 0, 10);

    // Summit pyramid on right
    addBox(root, 0.62, 0.08, 0.56, m.surface, 0.36, 0.04, -0.04);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.84, 4), m.surface);
    peak.position.set(0.36, 0.5, -0.04);
    peak.rotation.y = Math.PI / 4;
    peak.castShadow = true;
    addOutline(peak, 15);
    root.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 4), m.brand);
    cap.position.set(0.36, 0.78, -0.04);
    cap.rotation.y = Math.PI / 4;
    root.add(cap);

    // Climbing flag
    const flag = new THREE.Group();
    root.add(flag);
    addCyl(flag, 0.012, 0.012, 0.22, sharedDarkMetal, 0, 0.11, 0, 6);
    addBox(flag, 0.14, 0.09, 0.02, m.accent, 0.07, 0.18, 0);

    return (t) => {
      const ang = Math.sin(t * 2.1) * 0.18;
      beam.rotation.z = ang;
      panL.rotation.z = -ang;
      panR.rotation.z = -ang;
      const step = Math.floor(((t % 4.0) / 4.0) * 6);
      const u = Math.min(4, step) / 4;
      flag.position.set(0.16 + 0.2 * u, 0.14 + 0.74 * u, 0.14 - 0.16 * u);
    };
  },

  // 09 · Orbit Lab: tabletop planetary orrery with globe, Newton's tower & orbiting rocket cone
  "orbit-lab": (root, m) => {
    addCyl(root, 0.36, 0.44, 0.1, m.brand, 0, 0.05, 0, 20, true);
    addCyl(root, 0.09, 0.12, 0.34, m.surface, 0, 0.27, 0, 14, true);

    const center = new THREE.Group();
    center.position.set(0, 0.74, 0);
    root.add(center);

    // Planet globe + launch tower
    const globe = addSphere(center, 0.24, m.surface, 0, 0, 0, 20);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 8, 24), m.brand);
    band.rotation.x = Math.PI / 2.2;
    globe.add(band);
    addBox(center, 0.06, 0.12, 0.06, m.ink, 0, 0.28, 0);

    // Orbital ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.014, 8, 36), m.brand);
    ring.rotation.x = Math.PI / 2.4;
    ring.rotation.y = 0.2;
    center.add(ring);

    // Orbiting ship
    const pivot = new THREE.Group();
    pivot.rotation.x = Math.PI / 2.4;
    pivot.rotation.y = 0.2;
    center.add(pivot);

    const ship = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.19, 10), m.accent);
    ship.position.set(0.52, 0, 0);
    ship.castShadow = true;
    addOutline(ship, 20);
    pivot.add(ship);

    return (t) => {
      pivot.rotation.z = t * 1.5;
      globe.rotation.y = t * 0.45;
    };
  },

  // 10 · Orbit Lab XR: sleek 3D VR headset on tabletop cradle projecting a holographic tilted orbit
  "orbit-lab-xr": (root, m) => {
    addCyl(root, 0.32, 0.38, 0.08, m.brand, 0, 0.04, 0, 18, true);
    addCyl(root, 0.06, 0.08, 0.34, m.surface, 0, 0.25, -0.05, 12);

    // Headset body
    const hmd = new THREE.Group();
    hmd.position.set(0, 0.54, -0.08);
    root.add(hmd);
    addBox(hmd, 0.78, 0.38, 0.36, m.surface, 0, 0, 0);
    addBox(hmd, 0.68, 0.28, 0.06, m.brand, 0, 0, 0.17);
    // Side strap arms
    addBox(hmd, 0.08, 0.12, 0.46, m.ink, -0.4, 0.02, -0.18);
    addBox(hmd, 0.08, 0.12, 0.46, m.ink, 0.4, 0.02, -0.18);
    // Yellow XR badge on top
    addBox(hmd, 0.18, 0.06, 0.1, m.tile2, 0.24, 0.22, 0.06);

    // Floating holographic orbit right in front of the visor!
    const holo = new THREE.Group();
    holo.position.set(0, 0.72, 0.34);
    root.add(holo);
    addSphere(holo, 0.09, m.tile2, 0, 0, 0, 14);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.012, 8, 30),
      makeMat(hexNum(m.surfHex), { emissive: hexNum(m.surfHex), emissiveIntensity: 0.55 }),
    );
    orbit.rotation.x = Math.PI / 2.6;
    holo.add(orbit);

    const satPivot = new THREE.Group();
    satPivot.rotation.x = Math.PI / 2.6;
    holo.add(satPivot);
    addSphere(satPivot, 0.052, m.accent, 0.28, 0, 0, 12);

    return (t) => {
      satPivot.rotation.z = t * 2.1;
      holo.position.y = 0.74 + Math.sin(t * 2.4) * 0.04;
    };
  },

  // 11 · Detach Lab: horizontal vacuum laser beamline with pulsing raspberry laser & twin-atom split
  "detach-lab": (root, m) => {
    addBox(root, 1.44, 0.08, 0.44, m.surface, 0, 0.04, 0);
    addCyl(root, 0.04, 0.04, 0.36, sharedDarkMetal, -0.48, 0.24, 0, 10);
    addCyl(root, 0.04, 0.04, 0.36, sharedDarkMetal, 0.02, 0.24, 0, 10);

    // Ion source box on left
    addBox(root, 0.26, 0.34, 0.32, m.brand, -0.54, 0.52, 0);
    // Transparent glass vacuum tube
    const tube = addCyl(root, 0.13, 0.13, 0.88, sharedGlass, -0.02, 0.52, 0, 16);
    tube.rotation.z = Math.PI / 2;

    // Overhead vertical laser emitter + beam
    addBox(root, 0.2, 0.18, 0.22, m.brand, -0.06, 1.04, 0);
    const beamMat = makeMat(hexNum(m.accentHex), {
      emissive: hexNum(m.accentHex),
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.75,
    });
    const laser = addCyl(root, 0.024, 0.024, 0.84, beamMat, -0.06, 0.54, 0, 10);

    // Detector plate on right
    addBox(root, 0.14, 0.82, 0.42, m.brand, 0.54, 0.49, 0);
    addBox(root, 0.04, 0.7, 0.34, m.surface, 0.46, 0.49, 0, false);
    const hitMat = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 1.1 });
    const hit1 = addBox(root, 0.04, 0.09, 0.12, hitMat, 0.44, 0.74, 0, false);
    const hit2 = addBox(root, 0.04, 0.09, 0.12, hitMat, 0.44, 0.26, 0, false);

    // Paired I₂⁻ spheres splitting at laser
    const a1 = addSphere(root, 0.055, m.tile2, -0.4, 0.52, 0, 12);
    const a2 = addSphere(root, 0.055, m.tile2, -0.35, 0.52, 0, 12);

    return (t) => {
      const p = (t % 3.2) / 3.2;
      if (p < 0.4) {
        const u = p / 0.4;
        a1.position.set(-0.4 + 0.34 * u, 0.53, 0);
        a2.position.set(-0.34 + 0.28 * u, 0.51, 0);
        a1.visible = a2.visible = true;
      } else if (p < 0.84) {
        const u = (p - 0.4) / 0.44;
        a1.position.set(-0.06 + 0.5 * u, 0.53 + 0.21 * u, 0);
        a2.position.set(-0.06 + 0.5 * u, 0.51 - 0.25 * u, 0);
        a1.visible = a2.visible = true;
      } else {
        a1.visible = a2.visible = false;
      }
      const flash = Math.abs(p - 0.4) < 0.06;
      beamMat.opacity = flash ? 1 : 0.35;
      laser.scale.x = laser.scale.z = flash ? 1.55 : 0.85;
      hit1.visible = hit2.visible = p >= 0.82 && p < 0.96;
    };
  },

  // 12 · Force Lab XR: force-zone chamber, golden torus gate hoop & curving yellow ball
  "force-lab-xr": (root, m) => {
    addBox(root, 1.44, 0.09, 0.62, m.brand, 0, 0.045, 0);
    // Left ball launcher
    addBox(root, 0.24, 0.22, 0.24, m.surface, -0.54, 0.2, 0);
    // Translucent crimson force-zone box
    const zoneMat = makeMat(0xe2412a, { transparent: true, opacity: 0.26, emissive: 0xe2412a, emissiveIntensity: 0.25 });
    addBox(root, 0.42, 0.66, 0.46, zoneMat, -0.06, 0.42, 0);
    // Upward force arrow inside zone
    const arrow = new THREE.Group();
    arrow.position.set(-0.06, 0.42, 0);
    root.add(arrow);
    addCyl(arrow, 0.022, 0.022, 0.22, m.force, 0, -0.04, 0, 8);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.11, 10), m.force);
    cone.position.set(0, 0.12, 0);
    arrow.add(cone);

    // Target golden torus gate on right
    addCyl(root, 0.024, 0.024, 0.56, sharedDarkMetal, 0.48, 0.34, 0, 10);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.036, 10, 24), m.tile2);
    hoop.position.set(0.48, 0.84, 0);
    hoop.rotation.y = Math.PI / 2;
    hoop.rotation.x = 0.42;
    hoop.castShadow = true;
    root.add(hoop);

    const ball = addSphere(root, 0.075, m.tile2, -0.4, 0.24, 0);

    return (t) => {
      const p = (t % 3.2) / 3.2;
      arrow.position.y = 0.42 + Math.sin(t * 4) * 0.06;
      if (p < 0.24) {
        const u = p / 0.24;
        ball.position.set(-0.46 + 0.22 * u, 0.22, 0);
        ball.visible = true;
      } else if (p < 0.66) {
        const u = (p - 0.24) / 0.42;
        ball.position.set(-0.24 + 0.42 * u, 0.22 + 0.34 * u * u, 0);
        ball.visible = true;
      } else if (p < 0.92) {
        const u = (p - 0.66) / 0.26;
        ball.position.set(0.18 + 0.42 * u, 0.56 + 0.42 * u, 0);
        ball.visible = true;
      } else {
        ball.visible = false;
      }
    };
  },

  // 13 · Quadrature: angled light-table with 3D grid squares raising inside an elliptical loop
  "quadrature": (root, m) => {
    const board = new THREE.Group();
    board.position.set(0, 0.36, 0);
    board.rotation.x = 0.46;
    root.add(board);

    addBox(board, 1.24, 0.1, 0.96, m.brand, 0, 0, 0);
    addBox(board, 0.96, 0.04, 0.78, m.surface, -0.06, 0.06, 0, false);

    // 5×5 grid of 3D tiles that pop up inside/on the ellipse
    const tiles = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const nx = (c - 2) / 2.2;
        const ny = (r - 2) / 2.2;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1.28) continue;
        const inside = d2 < 0.55;
        const tile = addBox(
          board,
          0.14,
          0.07,
          0.12,
          inside ? m.accent : m.brand,
          -0.06 + (c - 2) * 0.16,
          0.1,
          (r - 2) * 0.14,
          true,
        );
        tiles.push({ mesh: tile, order: tiles.length });
      }
    }

    // Elliptical outline ring floating over grid
    const ellipse = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 32), m.ink);
    ellipse.rotation.x = Math.PI / 2;
    ellipse.scale.set(1.08, 0.9, 1);
    ellipse.position.set(-0.06, 0.15, 0);
    board.add(ellipse);

    // Support legs
    addBox(root, 0.12, 0.46, 0.12, sharedDarkMetal, -0.46, 0.23, -0.28);
    addBox(root, 0.12, 0.46, 0.12, sharedDarkMetal, 0.46, 0.23, -0.28);

    return (t) => {
      const p = (t % 4.0) / 4.0;
      const total = tiles.length;
      for (const item of tiles) {
        const thresh = (item.order / total) * 0.72;
        const on = p >= thresh && p < 0.94;
        item.mesh.scale.y = on ? 1 : 0.15;
        item.mesh.position.y = on ? 0.105 : 0.072;
      }
    };
  },

  // 14 · Metric Lab: standing 3D easel holding a city-block relief tracing Manhattan vs Euclidean path
  "metric-lab": (root, m) => {
    // Easel A-frame legs
    const backLeg = addBox(root, 0.06, 1.05, 0.06, sharedDarkMetal, 0, 0.5, -0.22);
    backLeg.rotation.x = -0.32;
    const easel = new THREE.Group();
    easel.position.set(0, 0.58, 0.04);
    easel.rotation.x = -0.18;
    root.add(easel);

    addBox(easel, 0.96, 0.9, 0.09, m.brand, 0, 0, 0);
    addBox(easel, 0.82, 0.76, 0.04, m.surface, 0, 0, 0.055, false);
    addBox(easel, 1.04, 0.07, 0.16, m.surface, 0, -0.48, 0.06);

    // Taxicab stair-step glowing segments
    const steps = [
      [-0.26, -0.24], [-0.14, -0.24], [-0.14, -0.12], [-0.02, -0.12],
      [-0.02, 0.0], [0.1, 0.0], [0.1, 0.12], [0.22, 0.12], [0.22, 0.24],
    ];
    const cubes = steps.map(([sx, sy]) => addBox(easel, 0.085, 0.085, 0.07, m.accent, sx, sy, 0.09, false));

    // Euclidean direct bar
    const chord = addBox(easel, 0.72, 0.036, 0.05, m.ink, -0.02, 0, 0.135, false);
    chord.rotation.z = Math.PI / 4;

    // Mint endpoints A & B
    addBox(easel, 0.12, 0.12, 0.1, m.tile2, -0.26, -0.24, 0.11);
    addBox(easel, 0.12, 0.12, 0.1, m.tile2, 0.22, 0.24, 0.11);

    return (t) => {
      const p = (t % 4.0) / 4.0;
      cubes.forEach((c, i) => {
        const on = p >= (i / cubes.length) * 0.45 && p < 0.92;
        c.visible = on;
      });
      const eu = p > 0.52 && p < 0.92 ? Math.min(1, (p - 0.52) / 0.24) : 0.001;
      chord.scale.x = eu;
      chord.visible = p > 0.52 && p < 0.92;
    };
  },

  // 15 · Attractor Lab: orchid IFS fractal plotter console building a 3D Sierpinski fractal pyramid
  "attractor-lab": (root, m) => {
    addBox(root, 1.12, 0.14, 0.84, m.brand, 0, 0.07, 0);
    addBox(root, 0.94, 0.05, 0.68, m.surface, 0, 0.165, 0, false);
    const ledMat = makeMat(hexNum(m.accentHex), { emissive: hexNum(m.accentHex), emissiveIntensity: 0.9 });
    addBox(root, 0.14, 0.06, 0.05, ledMat, 0.36, 0.08, 0.43, false);

    // 16 level-2 Sierpinski sub-tetrahedra forming a 3D fractal pyramid!
    const subGeo = new THREE.ConeGeometry(0.14, 0.22, 3);
    const prisms = [];
    const build = (cx, cy, cz, s, depth) => {
      if (depth === 0) {
        const mesh = new THREE.Mesh(subGeo, m.accent);
        mesh.position.set(cx, cy, cz);
        mesh.castShadow = true;
        addOutline(mesh, 15);
        root.add(mesh);
        prisms.push(mesh);
        return;
      }
      const r = s * 0.5;
      const h = s * 0.78;
      build(cx, cy + h, cz, r, depth - 1);
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3 + Math.PI / 6;
        build(cx + Math.cos(a) * r * 1.15, cy, cz + Math.sin(a) * r * 1.15, r, depth - 1);
      }
    };
    build(0, 0.3, 0, 0.56, 2);

    return (t) => {
      const p = (t % 4.2) / 4.2;
      prisms.forEach((mesh, i) => {
        const order = (i * 7) % prisms.length;
        const thresh = (order / prisms.length) * 0.65;
        const on = p >= thresh && p < 0.92;
        mesh.scale.setScalar(on ? 1 : 0.001);
        mesh.visible = on;
      });
      ledMat.emissiveIntensity = Math.sin(t * 7) > 0 ? 1.1 : 0.15;
    };
  },

  // 16 · Series Lab: Argand-plane oscilloscope with animated 3D converging polygonal spiral & glowing limit cube
  "series-lab": (root, m) => {
    addBox(root, 1.24, 0.84, 0.5, m.brand, 0, 0.44, 0);
    addBox(root, 0.8, 0.66, 0.06, m.surface, -0.14, 0.46, 0.24, false);
    // Side knobs
    addCyl(root, 0.075, 0.075, 0.06, m.tile2, 0.43, 0.62, 0.26, 14).rotation.x = Math.PI / 2;
    addCyl(root, 0.075, 0.075, 0.06, m.surface, 0.43, 0.4, 0.26, 14).rotation.x = Math.PI / 2;
    addBox(root, 0.16, 0.08, 0.05, m.accent, 0.43, 0.2, 0.26);

    // 3D polygonal partial-sum segments standing proud of the Argand screen
    const pts2d = [
      [-0.44, 0.22], [0.06, 0.22], [0.14, 0.58], [-0.08, 0.68],
      [-0.16, 0.54], [-0.08, 0.46], [-0.02, 0.5], [-0.04, 0.54],
    ];
    const segs = [];
    for (let i = 0; i < pts2d.length - 1; i++) {
      const a = new THREE.Vector3(pts2d[i][0], pts2d[i][1], 0.29);
      const b = new THREE.Vector3(pts2d[i + 1][0], pts2d[i + 1][1], 0.29);
      const d = b.clone().sub(a);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, d.length(), 8), m.ink);
      bar.position.copy(a).add(b).multiplyScalar(0.5);
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      root.add(bar);
      segs.push(bar);
    }
    const lim = addBox(root, 0.1, 0.1, 0.09, m.accent, -0.05, 0.53, 0.3);

    return (t) => {
      const p = (t % 3.8) / 3.8;
      segs.forEach((s, i) => {
        const thresh = (i / segs.length) * 0.66;
        s.visible = p >= thresh && p < 0.94;
      });
      const pulse = p > 0.66 && p < 0.94 ? 1.25 : 0.85;
      lim.scale.setScalar(pulse);
      lim.rotation.z = t * 1.4;
    };
  },

  // 17 · Surface Lab XR: 3D double-cone sculpture on turntable with sliding translucent conic-section plane
  "surface-lab-xr": (root, m) => {
    addCyl(root, 0.46, 0.52, 0.12, m.brand, 0, 0.06, 0, 22, true);
    addCyl(root, 0.36, 0.38, 0.06, m.surface, 0, 0.15, 0, 20);

    // Double cone sculpture
    const botCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.46, 20), m.surface);
    botCone.position.set(0, 0.41, 0);
    botCone.castShadow = true;
    addOutline(botCone, 30);
    root.add(botCone);

    const topCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.46, 20), m.surface);
    topCone.position.set(0, 0.87, 0);
    topCone.rotation.x = Math.PI;
    topCone.castShadow = true;
    addOutline(topCone, 30);
    root.add(topCone);

    // Sliding translucent slicing plane + dynamically scaling conic ellipse ring
    const slice = new THREE.Group();
    slice.position.set(0, 0.34, 0);
    root.add(slice);

    const planeMat = makeMat(hexNum(m.tile2Hex), { transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    addBox(slice, 0.82, 0.02, 0.72, planeMat, 0, 0, 0);
    const conicRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.026, 10, 28), m.accent);
    conicRing.rotation.x = Math.PI / 2;
    slice.add(conicRing);

    return (t) => {
      const s = Math.sin(t * 2.0); // -1 .. +1
      const y = 0.64 + s * 0.32; // sweeps across both cones through vertex y = 0.64!
      slice.position.y = y;
      const rScale = Math.max(0.14, Math.abs(s) * 0.96);
      conicRing.scale.set(rScale, rScale, 1);
    };
  },

  // 18 · Fourier Lab XR: mechanical frequency-winding drum with spinning 3D polar cardioid & orange CM sphere
  "fourier-lab-xr": (root, m) => {
    addBox(root, 1.06, 0.12, 0.56, m.brand, 0, 0.06, 0);
    addBox(root, 0.88, 0.88, 0.32, m.brand, -0.04, 0.56, -0.04);
    const face = addCyl(root, 0.36, 0.36, 0.05, m.surface, -0.04, 0.56, 0.13, 24, true);
    face.rotation.x = Math.PI / 2;

    // Side winding crank
    const crank = new THREE.Group();
    crank.position.set(0.42, 0.56, -0.04);
    root.add(crank);
    addBox(crank, 0.16, 0.05, 0.05, sharedChrome, 0.08, 0, 0, false);
    addBox(crank, 0.06, 0.24, 0.06, m.tile2, 0.16, 0.1, 0);

    // Rotating polar wound signal cardioid tube + orange center-of-mass beacon
    const rotor = new THREE.Group();
    rotor.position.set(-0.04, 0.56, 0.19);
    root.add(rotor);

    const cPts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 0.15 + 0.12 * Math.cos(a);
      cPts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const cardioid = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cPts, true), 48, 0.022, 8, true),
      m.pos,
    );
    rotor.add(cardioid);
    addSphere(rotor, 0.065, m.accent, 0.08, 0, 0.02, 14);

    return (t) => {
      rotor.rotation.z = -t * 1.4;
      crank.rotation.x = t * 1.4;
    };
  },

  // 19 · Parameter Lab XR: vertical k-axis extrusion frame with stacked rings & rising glowing solution slice
  "parameter-lab-xr": (root, m) => {
    addBox(root, 1.12, 0.12, 0.68, m.brand, 0, 0.06, 0);
    // Left k-axis vertical rail + sliding yellow knob
    addCyl(root, 0.032, 0.032, 0.96, sharedChrome, -0.42, 0.6, 0.06, 10);
    const knob = addBox(root, 0.18, 0.12, 0.16, m.tile2, -0.42, 0.6, 0.06);

    // Extruded stacked blue ellipses
    for (const [ry, rad] of [[0.28, 0.16], [0.54, 0.25], [0.8, 0.34]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.018, 8, 26), m.pos);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0.12, ry, 0);
      root.add(ring);
    }

    // Rising glowing violet solution slice
    const sliceMat = makeMat(hexNum(m.accentHex), { transparent: true, opacity: 0.42, emissive: hexNum(m.accentHex), emissiveIntensity: 0.35 });
    const slice = new THREE.Group();
    slice.position.set(0.12, 0.6, 0);
    root.add(slice);
    const disk = addCyl(slice, 0.36, 0.36, 0.022, sliceMat, 0, 0, 0, 24);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.024, 8, 28), m.accent);
    rim.rotation.x = Math.PI / 2;
    slice.add(rim);

    return (t) => {
      const u = 0.5 + 0.5 * Math.sin(t * 1.7);
      const y = 0.26 + u * 0.62;
      const sc = 0.44 + u * 0.58;
      knob.position.y = y;
      slice.position.y = y;
      slice.scale.set(sc, 1, sc);
      disk.rotation.y = t * 0.5;
    };
  },

  // 20 · Composition Lab XR: 3-plane orthogonal stage (xy, yz, xz) with function tubes & linked sliding beads
  "composition-lab-xr": (root, m) => {
    addBox(root, 1.18, 0.1, 0.72, m.brand, 0, 0.05, 0);
    // Upright back xz plane & right yz plane
    addBox(root, 1.02, 0.82, 0.04, m.surface, 0, 0.51, -0.26);
    addBox(root, 0.04, 0.82, 0.58, m.surface, 0.5, 0.51, 0.03);

    // Bold violet g∘f curve tube on back plane
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      pts.push(new THREE.Vector3(-0.38 + 0.76 * u, 0.24 + 0.52 * Math.sin(u * Math.PI * 0.55) + 0.08 * Math.sin(u * 5), -0.2));
    }
    const curve = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.024, 8, false), m.mom);
    root.add(curve);

    // Input x bar + yellow bead & green linked output bead
    addCyl(root, 0.016, 0.016, 0.82, sharedDarkMetal, 0, 0.22, 0.12, 8).rotation.z = Math.PI / 2;
    const xBead = addSphere(root, 0.072, m.tile2, 0, 0.22, 0.12);
    const yBead = addSphere(root, 0.072, m.vel, 0, 0.56, -0.18);

    return (t) => {
      const u = 0.5 + 0.5 * Math.sin(t * 1.65);
      const x = -0.34 + 0.68 * u;
      xBead.position.x = x;
      yBead.position.set(x, 0.24 + 0.52 * Math.sin(u * Math.PI * 0.55) + 0.08 * Math.sin(u * 5), -0.18);
    };
  },

  // 21 · Dynagraph XR: lime twin-upright parallel-axis jig with sliding beads & dynamic mapping rod
  "dynagraph-xr": (root, m) => {
    addBox(root, 1.32, 0.1, 0.54, m.brand, 0, 0.05, 0);
    addBox(root, 0.12, 0.86, 0.22, m.brand, -0.58, 0.52, 0);
    addBox(root, 0.12, 0.86, 0.22, m.brand, 0.58, 0.52, 0);
    // Two parallel horizontal chrome axes
    const topRod = addCyl(root, 0.022, 0.022, 1.1, sharedChrome, 0, 0.78, 0, 10);
    topRod.rotation.z = Math.PI / 2;
    const botRod = addCyl(root, 0.022, 0.022, 1.1, sharedChrome, 0, 0.34, 0, 10);
    botRod.rotation.z = Math.PI / 2;

    const inBead = addSphere(root, 0.085, m.tile2, 0, 0.78, 0);
    const outBead = addSphere(root, 0.08, m.accent, 0, 0.34, 0);

    // Dynamic connecting arrow cylinder stretching between input & output beads
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 8), m.pos);
    root.add(link);

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    return (t) => {
      const s = Math.sin(t * 1.65);
      const xIn = s * 0.4;
      const xOut = Math.sin(s * 1.45) * 0.34 + 0.08;
      inBead.position.x = xIn;
      outBead.position.x = xOut;

      vA.set(xIn, 0.78, 0);
      vB.set(xOut, 0.34, 0);
      dir.subVectors(vB, vA);
      const len = dir.length();
      link.position.copy(vA).add(vB).multiplyScalar(0.5);
      link.scale.set(1, len, 1);
      link.quaternion.setFromUnitVectors(up, dir.normalize());
    };
  },
};

/**
 * Fallback 3D modular lab console for any future app added to apps.json.
 */
function buildFallback3D(root, m) {
  addBox(root, 1.06, 0.76, 0.5, m.brand, 0, 0.4, 0);
  addBox(root, 0.68, 0.5, 0.06, m.surface, -0.1, 0.46, 0.24, false);
  const dial = addCyl(root, 0.08, 0.08, 0.06, m.tile2, 0.36, 0.56, 0.26, 14);
  dial.rotation.x = Math.PI / 2;
  const bar = addBox(root, 0.48, 0.08, 0.06, m.accent, -0.1, 0.46, 0.28, false);
  return (t) => {
    bar.position.y = 0.46 + Math.sin(t * 3) * 0.14;
    dial.rotation.y = t * 1.8;
  };
}

/**
 * Build a complete interactive 3D apparatus station (mat + machine + invisible generous hitbox
 * + glowing hover/search selection ring + bouncing 3D beacon crystal).
 */
export function createApparatus3D(app, allApps) {
  const m = paletteMats(app, allApps);
  const group = new THREE.Group();
  group.userData = { slug: app.slug, app };

  // Crisp vivid brand-colored tabletop mat marking this as a clickable apparatus
  const matPad = addBox(group, 1.54, 0.032, 1.24, m.brand, 0, 0.016, 0, true);
  matPad.receiveShadow = true;

  // Inner machine container (lifts gently on hover!)
  const machine = new THREE.Group();
  machine.position.y = 0.032;
  group.add(machine);

  const builder = BUILDERS[app.slug];
  const animFn = builder ? builder(machine, m) : buildFallback3D(machine, m);

  // 3D selection ring on the tabletop mat (glows when hovered or matched by search)
  const ringMat = new THREE.MeshBasicMaterial({
    color: hexNum(m.tile2Hex),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const selectRing = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.82, 4), ringMat);
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.rotation.z = Math.PI / 4;
  selectRing.position.y = 0.038;
  group.add(selectRing);

  // Floating bouncing 3D target crystal beacon above apparatus (revealed on hover / search highlight)
  const beaconMat = makeMat(hexNum(m.brandHex), {
    emissive: hexNum(m.brandHex),
    emissiveIntensity: 0.55,
  });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), beaconMat);
  beacon.position.set(0, 1.55, 0);
  beacon.visible = false;
  addOutline(beacon, 12);
  group.add(beacon);

  // Generous invisible raycast collider box so clicking/tapping anywhere on the apparatus feels effortless
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 1.38, 1.28),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.set(0, 0.69, 0);
  hitBox.userData = { slug: app.slug, app };
  group.add(hitBox);

  let hoverMix = 0;
  let hovered = false;
  let searchState = "normal"; // "normal" | "match" | "dim"

  return {
    slug: app.slug,
    app,
    brandHex: m.brandHex,
    inkHex: m.inkHex,
    group,
    hitBox,
    setHovered(v) {
      hovered = v;
    },
    setSearchState(state) {
      searchState = state;
    },
    update(t, dt, reducedMotion) {
      if (!reducedMotion) animFn(t);
      const targetHover = hovered ? 1 : searchState === "match" ? 0.65 : 0;
      hoverMix += (targetHover - hoverMix) * Math.min(1, dt * 12);

      // Gentle pop-up lift on hover/match
      machine.position.y = 0.032 + hoverMix * 0.08;
      const sc = 1 + hoverMix * 0.045;
      machine.scale.setScalar(sc);

      // Selection ring & bouncing beacon
      const showRing = hoverMix > 0.04;
      selectRing.visible = showRing;
      ringMat.opacity = hoverMix * 0.92;
      selectRing.scale.setScalar(0.95 + hoverMix * 0.1);

      const showBeacon = hovered || searchState === "match";
      beacon.visible = showBeacon;
      if (showBeacon) {
        beacon.position.y = 1.52 + (reducedMotion ? 0 : Math.sin(t * 5.2) * 0.09);
        beacon.rotation.y = reducedMotion ? 0 : t * 2.6;
      }

      // Subtle dim when filtered out by search
      const dimScale = searchState === "dim" ? 0.88 : 1;
      group.scale.y += (dimScale - group.scale.y) * Math.min(1, dt * 10);
    },
  };
}
