// Labs · home/cel.js
// Crisp 3-band cel-shading material helper tailored for the 3D pixel-art pipeline.
// Screen-space 1-pixel silhouettes and convex rim highlights are handled by home/pixelpass.js,
// so addShell/addCreases stay zero-overhead no-ops to maximize frame rate and pixel clarity.

export const INK_LIGHT = 0x14202b;
export const INK_DARK = 0x070d14;

function createToonGradient() {
  // 3 crisp graphic bands (clean shadow, midtone, bright lit face) harmonized with DESIGN.md
  const bands = [118, 192, 255];
  const data = new Uint8Array(bands.length * 4);
  for (let i = 0; i < bands.length; i++) {
    data[i * 4 + 0] = bands[i];
    data[i * 4 + 1] = bands[i];
    data[i * 4 + 2] = bands[i];
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, bands.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const sharedToonGradient = createToonGradient();

export function toonMat(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: sharedToonGradient,
    map: opts.map ?? null,
    emissive: opts.emissive ?? 0x000000,
    emissiveMap: opts.emissiveMap ?? null,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  return m;
}

export const apparatusShellMat = null;
export const detailShellMat = null;
export const roomShellMat = null;
export const apparatusCreaseMat = null;
export const roomCreaseMat = null;

// Outlines and creases are rendered cleanly at exact 1-virtual-pixel width by home/pixelpass.js
export function addShell(mesh) {
  return mesh;
}
export function addCreases(mesh) {
  return mesh;
}
export function setCelTheme() {}
