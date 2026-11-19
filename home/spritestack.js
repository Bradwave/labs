// Labs · home/spritestack.js
// True 1-draw-call GPU Pixel-Art Sprite Stacking for Three.js r128:
// Packs N horizontal pixel slices into one NearestFilter texture atlas + one merged quad stack
// with alphaTest depth shadows so organic props (monstera plants, sleeping lab cat, flasks, books)
// exhibit genuine 3D sprite-stacking parallax, exact jagged cast shadows and 1px ink outlines.

import { toonMat } from "./cel.js";

/**
 * Build a single-draw-call sprite-stacked 3D mesh from procedural pixel-art slices.
 * @param {object} opts
 * @param {number} opts.size      Pixel resolution per slice (size x size)
 * @param {number} opts.layers    Number of vertical slices
 * @param {number} opts.width     World width/depth of the stack
 * @param {number} opts.height    Total world height of the stack
 * @param {(ctx: CanvasRenderingContext2D, layer: number, size: number) => void} opts.drawLayer
 */
export function createSpriteStack({ size, layers, width, height, drawLayer }) {
  const canvas = document.createElement("canvas");
  canvas.width = size * layers;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < layers; i++) {
    ctx.save();
    ctx.translate(i * size, 0);
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    drawLayer(ctx, i, size);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.encoding = THREE.sRGBEncoding;

  // Build one merged BufferGeometry containing all stacked horizontal slices
  const positions = new Float32Array(layers * 4 * 3);
  const normals = new Float32Array(layers * 4 * 3);
  const uvs = new Float32Array(layers * 4 * 2);
  const indices = new Uint16Array(layers * 6);

  const hw = width / 2;
  const stepY = height / layers;

  for (let i = 0; i < layers; i++) {
    const y = (i + 0.5) * stepY;
    const vBase = i * 4;
    const pBase = vBase * 3;
    const uBase = vBase * 2;
    const iBase = i * 6;

    // 4 corners of horizontal quad in XZ plane
    positions[pBase + 0] = -hw; positions[pBase + 1] = y; positions[pBase + 2] = -hw;
    positions[pBase + 3] =  hw; positions[pBase + 4] = y; positions[pBase + 5] = -hw;
    positions[pBase + 6] =  hw; positions[pBase + 7] = y; positions[pBase + 8] =  hw;
    positions[pBase + 9] = -hw; positions[pBase + 10] = y; positions[pBase + 11] =  hw;

    for (let k = 0; k < 4; k++) {
      normals[pBase + k * 3 + 0] = 0;
      normals[pBase + k * 3 + 1] = 1;
      normals[pBase + k * 3 + 2] = 0;
    }

    const u0 = i / layers;
    const u1 = (i + 1) / layers;
    uvs[uBase + 0] = u0; uvs[uBase + 1] = 1;
    uvs[uBase + 2] = u1; uvs[uBase + 3] = 1;
    uvs[uBase + 4] = u1; uvs[uBase + 5] = 0;
    uvs[uBase + 6] = u0; uvs[uBase + 7] = 0;

    indices[iBase + 0] = vBase + 0;
    indices[iBase + 1] = vBase + 2;
    indices[iBase + 2] = vBase + 1;
    indices[iBase + 3] = vBase + 0;
    indices[iBase + 4] = vBase + 3;
    indices[iBase + 5] = vBase + 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const material = toonMat(0xffffff, { map: tex, side: THREE.DoubleSide });
  material.alphaTest = 0.5;

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Alpha-tested depth material so directional shadows match exact pixel silhouettes!
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: tex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  // Skip normal override pass (all slices share +Y normal; silhouettes come cleanly from alpha-tested depth!)
  mesh.userData.noPixelEdge = true;
  return mesh;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Lush sprite-stacked potted Monstera deliciosa with terracotta pot, fenestrated split leaves
 * and sunlit variegated green highlights (inspired by pixel-art stacking reference).
 */
export function createStackedMonstera(scale = 1) {
  const leafSpecs = [
    { ang: 0.2, startL: 6, endL: 11, dist: 5.5, rad: 4.1, col: "#2f7d44", hi: "#6bbd5b" },
    { ang: 1.45, startL: 7, endL: 13, dist: 6.2, rad: 4.3, col: "#378f4b", hi: "#82d462" },
    { ang: 2.65, startL: 6, endL: 12, dist: 5.8, rad: 4.0, col: "#296e3d", hi: "#59ad52" },
    { ang: 3.9, startL: 8, endL: 14, dist: 6.0, rad: 4.2, col: "#3d9c4f", hi: "#9be36b" },
    { ang: 5.15, startL: 7, endL: 13, dist: 5.7, rad: 4.1, col: "#318546", hi: "#78cc5e" },
    // Crown center leaves
    { ang: 0.85, startL: 11, endL: 16, dist: 3.4, rad: 3.8, col: "#4db055", hi: "#b8ed74" },
    { ang: 3.3, startL: 12, endL: 17, dist: 2.8, rad: 3.6, col: "#57bd59", hi: "#ccf584" },
  ];

  const mesh = createSpriteStack({
    size: 26,
    layers: 18,
    width: 0.92 * scale,
    height: 0.86 * scale,
    drawLayer(ctx, l, s) {
      const c = s / 2;
      // Terracotta pot (layers 0..5)
      if (l <= 5) {
        const r = 3.2 + l * 0.35;
        disc(ctx, c, c, r, l === 5 ? "#d47d50" : l === 0 ? "#8a482b" : "#b8633b");
        if (l === 5) disc(ctx, c, c, r - 1.1, "#4a3222"); // dark potting soil
        return;
      }
      // Central stems
      if (l <= 12) {
        disc(ctx, c, c, 1.4, "#276638");
      }
      // Fenestrated monstera leaves arching outward across layers
      for (const lf of leafSpecs) {
        if (l < lf.startL || l > lf.endL) continue;
        const u = (l - lf.startL) / Math.max(1, lf.endL - lf.startL);
        const reach = lf.dist * (0.45 + 0.55 * Math.sin(u * Math.PI * 0.85));
        const lx = c + Math.cos(lf.ang) * reach;
        const ly = c + Math.sin(lf.ang) * reach;
        const r = lf.rad * (0.65 + 0.35 * Math.sin(u * Math.PI));

        // Stem link on lower leaf layers
        if (u < 0.45) {
          px(ctx, (c + lx) / 2 - 0.5, (c + ly) / 2 - 0.5, 2, 2, "#2a6e3c");
        }
        // Main leaf lobe
        disc(ctx, lx, ly, r, u > 0.55 ? lf.hi : lf.col);
        // Variegated pale pixel flecks on top layers
        if (u > 0.65) {
          px(ctx, lx - 1, ly - 1, 2, 1, "#e6f7a8");
          px(ctx, lx + 1, ly, 1, 1, "#ffffff");
        }
        // Iconic monstera fenestration notches cut out on sides of the leaf
        const nx = -Math.sin(lf.ang);
        const ny = Math.cos(lf.ang);
        ctx.clearRect(Math.round(lx + nx * (r - 1.2)), Math.round(ly + ny * (r - 1.2)), 1, 1);
        ctx.clearRect(Math.round(lx - nx * (r - 1.2)), Math.round(ly - ny * (r - 1.2)), 1, 1);
      }
    },
  });
  return mesh;
}

/**
 * Cozy sprite-stacked ginger tabby lab cat curled up asleep on a wooden crate.
 */
export function createStackedLabCat() {
  return createSpriteStack({
    size: 20,
    layers: 12,
    width: 0.78,
    height: 0.44,
    drawLayer(ctx, l, s) {
      const c = s / 2;
      // Curled cat body (layers 0..7)
      if (l <= 7) {
        const r = l === 0 ? 5.2 : l < 6 ? 5.6 - l * 0.25 : 3.6;
        disc(ctx, c + 1, c, r, l > 4 ? "#e6a15c" : "#cf8342");
        // Tabby dark orange stripes across back
        if (l >= 3 && l <= 6) {
          px(ctx, c - 1, c - 2, 4, 1, "#a85d28");
          px(ctx, c, c + 1, 4, 1, "#a85d28");
        }
        // Curled tail wrapping around right side
        if (l <= 3) {
          px(ctx, c + 5, c + 2, 3, 2, "#cf8342");
          px(ctx, c + 7, c + 1, 2, 2, "#f2d6b3");
        }
      }
      // Cat head tucked on left (layers 2..9)
      if (l >= 2 && l <= 9) {
        const hr = l <= 7 ? 3.2 : 2.3;
        disc(ctx, c - 4.2, c + 0.8, hr, l > 6 ? "#ebb06e" : "#d98c4a");
        if (l === 4 || l === 5) {
          px(ctx, c - 7, c + 1, 1, 2, "#f5e3cc"); // cream muzzle
        }
      }
      // Pointy cat ears on top (layers 9..11)
      if (l >= 9) {
        const w = l === 11 ? 1 : 2;
        px(ctx, c - 5.5, c - 1.5, w, w, "#cf8342");
        px(ctx, c - 5.5, c + 2.5, w, w, "#cf8342");
      }
    },
  });
}

/**
 * Sprite-stacked tabletop glassware + coffee mug + lab notebook clutter cluster.
 * Uses 22 dense slices so the conical Erlenmeyer flask, beaker and mug have smooth silhouettes.
 */
export function createStackedBenchClutter() {
  return createSpriteStack({
    size: 28,
    layers: 22,
    width: 1.08,
    height: 0.44,
    drawLayer(ctx, l) {
      // Stacked lab notebooks on left (layers 0..6)
      if (l <= 3) {
        px(ctx, 2, 12, 10, 9, "#8a9eb2");
        px(ctx, 3, 13, 8, 7, "#dce5ed");
      }
      if (l >= 4 && l <= 6) {
        px(ctx, 3, 13, 9, 8, "#a2b4c4");
        px(ctx, 4, 14, 7, 6, "#f0f4f8");
      }
      // Cream lab coffee mug sitting on top of notebooks (layers 7..15)
      if (l >= 7 && l <= 15) {
        disc(ctx, 8, 17, 2.8, l === 7 ? "#cdd7e0" : "#eef3f7");
        if (l >= 14) disc(ctx, 8, 17, 1.8, "#5c3b28"); // hot coffee
        if (l >= 9 && l <= 13) px(ctx, 11, 16, 2, 2, "#eef3f7"); // mug handle
      }
      // Smooth conical Erlenmeyer flask on right (layers 0..21)
      if (l <= 11) {
        // Gentle smooth taper from rounded base (r=4.6) to neck (r=1.7)
        const u = l / 11;
        const r = l === 0 ? 4.2 : 4.6 - 2.9 * Math.pow(u, 0.92);
        const col = l <= 5 ? "#63b8ad" : l === 6 ? "#9be0d6" : "#cbe5f2";
        disc(ctx, 19, 12, r, col);
      } else if (l <= 19) {
        disc(ctx, 19, 12, 1.65, "#cbe5f2");
      } else {
        disc(ctx, 19, 12, 2.2, "#e2f1f8"); // flared flask lip
      }
      // Small amber beaker in front-right (layers 0..12)
      if (l <= 12) {
        const col = l <= 6 ? "#e2b254" : l === 7 ? "#f5d384" : "#cbe5f2";
        disc(ctx, 21, 21, l === 12 ? 2.6 : 2.35, col);
      }
    },
  });
}
