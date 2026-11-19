// Labs · home/cel.js
// Cel / shell shading toolkit for Three.js r128:
// - 4-band NearestFilter DataTexture gradient map for crisp stepped MeshToonMaterial shading
// - Smooth-normal inverted-hull shell outlines (BackSide vertex extrusion with zero corner gaps
//   and subtle distance compensation so ink silhouettes stay ~2px crisp at any zoom)
// - Shared ink line materials for sharp interior box creases, synced to light/dark themes.

export const INK_LIGHT = 0x14202b;
export const INK_DARK = 0x060b10;

// 4-step crisp cel-shading ramp (shadow, mid-shadow, mid-light, highlight)
function createToonGradient() {
  const bands = [94, 158, 218, 255];
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

/**
 * Create a stepped cel-shaded MeshToonMaterial using the shared 4-band gradient map.
 */
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
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
}

// Track all created shell & crease materials so theme toggles update ink color globally
const shellMaterials = [];
export const apparatusCreaseMat = new THREE.LineBasicMaterial({ color: INK_LIGHT });
export const roomCreaseMat = new THREE.LineBasicMaterial({
  color: INK_LIGHT,
  transparent: true,
  opacity: 0.55,
});

/**
 * Create a watertight inverted-hull (shell) outline material using BackSide normal extrusion
 * with subtle camera-distance compensation and built-in Three.js scene fog support.
 */
function createShellMaterial(thickness, color = INK_LIGHT) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uThickness: { value: thickness },
      },
    ]),
    vertexShader: `
      uniform float uThickness;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvBase = modelViewMatrix * vec4(position, 1.0);
        float distScale = clamp(-mvBase.z * 0.068, 0.55, 1.85);
        vec3 extruded = position + normalize(normal) * (uThickness * distScale);
        vec4 mvPosition = modelViewMatrix * vec4(extruded, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  shellMaterials.push(mat);
  return mat;
}

// Shared shell materials for different outline weights (apparatus vs smaller detail vs room furniture)
export const apparatusShellMat = createShellMaterial(0.022, INK_LIGHT);
export const detailShellMat = createShellMaterial(0.015, INK_LIGHT);
export const roomShellMat = createShellMaterial(0.026, INK_LIGHT);

/**
 * Compute averaged smooth outward normals per shared vertex position so BackSide
 * shell extrusion stays 100% watertight with zero gaps at sharp box/cone/cylinder corners.
 */
function buildSmoothShellGeometry(sourceGeo) {
  const pos = sourceGeo.attributes.position;
  const nrm = sourceGeo.attributes.normal;
  if (!pos || !nrm) return sourceGeo;

  const accum = new Map();
  const keys = new Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    keys[i] = k;
    let v = accum.get(k);
    if (!v) {
      v = [0, 0, 0];
      accum.set(k, v);
    }
    v[0] += nrm.getX(i);
    v[1] += nrm.getY(i);
    v[2] += nrm.getZ(i);
  }

  const smoothNormals = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = accum.get(keys[i]);
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    smoothNormals[i * 3 + 0] = v[0] / len;
    smoothNormals[i * 3 + 1] = v[1] / len;
    smoothNormals[i * 3 + 2] = v[2] / len;
  }

  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute("position", pos);
  shellGeo.setAttribute("normal", new THREE.BufferAttribute(smoothNormals, 3));
  if (sourceGeo.index) shellGeo.setIndex(sourceGeo.index);
  return shellGeo;
}

/**
 * Attach a watertight inverted-hull ink shell silhouette to any mesh.
 */
export function addShell(mesh, shellMat = apparatusShellMat) {
  const shell = new THREE.Mesh(buildSmoothShellGeometry(mesh.geometry), shellMat);
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return shell;
}

/**
 * Attach crisp interior hard-crease lines (for sharp 90° edges inside boxy silhouettes).
 */
export function addCreases(mesh, creaseMat = apparatusCreaseMat, threshold = 24) {
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), creaseMat);
  mesh.add(line);
  return line;
}

/**
 * Update ink outline colors when toggling light/dark theme.
 */
export function setCelTheme(dark) {
  const hex = dark ? INK_DARK : INK_LIGHT;
  apparatusCreaseMat.color.setHex(hex);
  roomCreaseMat.color.setHex(hex);
  roomCreaseMat.opacity = dark ? 0.65 : 0.48;
  for (const m of shellMaterials) {
    m.uniforms.uColor.value.setHex(hex);
  }
}
