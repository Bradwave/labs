// Labs · home/pixelpass.js
// Zero-reallocation dynamic-resolution 3D pixel-art pipeline for Three.js r128 + OrthographicCamera:
// - Pre-allocates color+depth and normal RenderTargets once per window resize at max clarity
// - Dynamically adjusts active viewport/scissor per frame as zoom changes (world-locked pixelation:
//   crisp & readable when zoomed out, chunkier pixel art when zoomed in) with zero GPU reallocation
// - Composites exact 1-virtual-pixel foreground ink silhouettes, convex pixel rim highlights,
//   concave creases and virtual-pixel-aligned 4x4 Bayer dithering onto the display canvas.

const MIN_PIXEL_SIZE = 1.35;

export function createPixelPipeline(renderer, initialPixelSize = 2.0) {
  let pixelSize = initialPixelSize;
  let viewW = 960;
  let viewH = 600;
  let maxW = 640;
  let maxH = 400;
  let curW = 480;
  let curH = 300;

  const rtOpts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    generateMipmaps: false,
    depthBuffer: true,
    stencilBuffer: false,
  };

  let colorTarget = null;
  let normalTarget = null;

  const normalOverrideMat = new THREE.MeshNormalMaterial();

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    tColor: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    uActiveRes: { value: new THREE.Vector2(curW, curH) },
    uTexRes: { value: new THREE.Vector2(maxW, maxH) },
    uInkColor: { value: new THREE.Color(0x14202b) },
    uOutlineStrength: { value: 0.9 },
    uHighlightStrength: { value: 0.25 },
    uCreaseStrength: { value: 0.32 },
    uDitherStrength: { value: 0.032 },
  };

  const postMat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tNormal;
      uniform vec2 uActiveRes;
      uniform vec2 uTexRes;
      uniform vec3 uInkColor;
      uniform float uOutlineStrength;
      uniform float uHighlightStrength;
      uniform float uCreaseStrength;
      uniform float uDitherStrength;
      varying vec2 vUv;

      // 4x4 ordered Bayer dither threshold in [-0.5, 0.5]
      float bayer4(vec2 p) {
        vec2 c = floor(mod(p, 4.0));
        int x = int(c.x);
        int y = int(c.y);
        int idx = y * 4 + x;
        float m = 0.0;
        if (idx == 0) m = 0.0;
        else if (idx == 1) m = 8.0;
        else if (idx == 2) m = 2.0;
        else if (idx == 3) m = 10.0;
        else if (idx == 4) m = 12.0;
        else if (idx == 5) m = 4.0;
        else if (idx == 6) m = 14.0;
        else if (idx == 7) m = 6.0;
        else if (idx == 8) m = 3.0;
        else if (idx == 9) m = 11.0;
        else if (idx == 10) m = 1.0;
        else if (idx == 11) m = 9.0;
        else if (idx == 12) m = 15.0;
        else if (idx == 13) m = 7.0;
        else if (idx == 14) m = 13.0;
        else m = 5.0;
        return (m + 0.5) / 16.0 - 0.5;
      }

      vec3 getNormal(vec2 uv) {
        return normalize(texture2D(tNormal, uv).rgb * 2.0 - 1.0);
      }

      void main() {
        // Snap screen UV cleanly to virtual pixel center inside active [0..uActiveRes] scissor rect
        vec2 pix = clamp(floor(vUv * uActiveRes), vec2(0.0), uActiveRes - 1.0);
        vec2 minUv = vec2(0.5) / uTexRes;
        vec2 maxUv = (uActiveRes - 0.5) / uTexRes;
        vec2 texel = 1.0 / uTexRes;
        vec2 cUv = (pix + 0.5) / uTexRes;

        vec4 base = texture2D(tColor, cUv);
        float d0 = texture2D(tDepth, cUv).r;

        // Background void: pass through cleanly without edge artifacts
        if (d0 >= 0.9992) {
          gl_FragColor = vec4(base.rgb, 1.0);
          return;
        }

        vec2 uvL = clamp(cUv + vec2(-texel.x, 0.0), minUv, maxUv);
        vec2 uvR = clamp(cUv + vec2( texel.x, 0.0), minUv, maxUv);
        vec2 uvU = clamp(cUv + vec2(0.0,  texel.y), minUv, maxUv);
        vec2 uvD = clamp(cUv + vec2(0.0, -texel.y), minUv, maxUv);

        float dL = texture2D(tDepth, uvL).r;
        float dR = texture2D(tDepth, uvR).r;
        float dU = texture2D(tDepth, uvU).r;
        float dD = texture2D(tDepth, uvD).r;

        // Orthographic linear depth: exact 1-virtual-pixel foreground ink silhouette
        float depthThresh = 0.0032;
        float maxDiff = max(max(dL - d0, dR - d0), max(dU - d0, dD - d0));
        float isSilhouette = step(depthThresh, maxDiff);

        vec3 n0 = getNormal(cUv);
        vec3 nL = getNormal(uvL);
        vec3 nR = getNormal(uvR);
        vec3 nU = getNormal(uvU);
        vec3 nD = getNormal(uvD);

        vec3 lightBias = normalize(vec3(-0.6, 0.9, 0.55));
        float convex = 0.0;
        float concave = 0.0;
        float normThresh = 0.28;

        if (abs(dL - d0) < depthThresh) {
          float diff = 1.0 - dot(n0, nL);
          if (diff > normThresh) {
            float dir = dot(n0 - nL, lightBias);
            if (dir > 0.08) convex = max(convex, diff);
            else if (dir < -0.18) concave = max(concave, diff);
          }
        }
        if (abs(dR - d0) < depthThresh) {
          float diff = 1.0 - dot(n0, nR);
          if (diff > normThresh) {
            float dir = dot(n0 - nR, lightBias);
            if (dir > 0.08) convex = max(convex, diff);
            else if (dir < -0.18) concave = max(concave, diff);
          }
        }
        if (abs(dU - d0) < depthThresh) {
          float diff = 1.0 - dot(n0, nU);
          if (diff > normThresh) {
            float dir = dot(n0 - nU, lightBias);
            if (dir > 0.08) convex = max(convex, diff);
            else if (dir < -0.18) concave = max(concave, diff);
          }
        }
        if (abs(dD - d0) < depthThresh) {
          float diff = 1.0 - dot(n0, nD);
          if (diff > normThresh) {
            float dir = dot(n0 - nD, lightBias);
            if (dir > 0.08) convex = max(convex, diff);
            else if (dir < -0.18) concave = max(concave, diff);
          }
        }

        // Virtual-pixel-aligned 4x4 Bayer ordered dither + gentle quantization
        float b = bayer4(pix);
        vec3 col = base.rgb + b * uDitherStrength;
        col = floor(col * 24.0 + 0.5) / 24.0;

        if (convex > 0.0 && isSilhouette < 0.5) {
          vec3 hi = min(vec3(1.0), col * 1.24 + vec3(0.065));
          col = mix(col, hi, uHighlightStrength * clamp(convex * 1.4, 0.45, 1.0));
        }

        if (concave > 0.0 && isSilhouette < 0.5) {
          col = mix(col, uInkColor, uCreaseStrength * clamp(concave, 0.35, 0.9));
        }

        col = mix(col, uInkColor, isSilhouette * uOutlineStrength);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  postScene.add(quad);

  function updateActiveViewport() {
    if (!colorTarget || !normalTarget) return;
    const clampedPx = Math.max(MIN_PIXEL_SIZE, pixelSize);
    // Keep even dimensions so the pixel grid stays symmetric around screen center while scaling
    const rawW = Math.max(120, Math.min(maxW, Math.round(viewW / clampedPx)));
    const rawH = Math.max(90, Math.min(maxH, Math.round(viewH / clampedPx)));
    curW = Math.max(120, rawW & ~1);
    curH = Math.max(90, rawH & ~1);

    colorTarget.viewport.set(0, 0, curW, curH);
    colorTarget.scissor.set(0, 0, curW, curH);
    colorTarget.scissorTest = true;

    normalTarget.viewport.set(0, 0, curW, curH);
    normalTarget.scissor.set(0, 0, curW, curH);
    normalTarget.scissorTest = true;

    uniforms.uActiveRes.value.set(curW, curH);
  }

  function resize(w, h) {
    viewW = Math.max(160, Math.round(w));
    viewH = Math.max(120, Math.round(h));

    if (colorTarget) {
      if (colorTarget.depthTexture) colorTarget.depthTexture.dispose();
      colorTarget.dispose();
    }
    if (normalTarget) normalTarget.dispose();

    // Pre-allocate render targets once at highest clarity (min pixel size) — zero allocations during zoom!
    maxW = Math.max(240, Math.round(viewW / MIN_PIXEL_SIZE) & ~1);
    maxH = Math.max(180, Math.round(viewH / MIN_PIXEL_SIZE) & ~1);

    colorTarget = new THREE.WebGLRenderTarget(maxW, maxH, rtOpts);
    colorTarget.texture.encoding = THREE.sRGBEncoding;
    colorTarget.depthTexture = new THREE.DepthTexture(maxW, maxH);
    colorTarget.depthTexture.type = THREE.UnsignedShortType;
    colorTarget.depthTexture.minFilter = THREE.NearestFilter;
    colorTarget.depthTexture.magFilter = THREE.NearestFilter;

    normalTarget = new THREE.WebGLRenderTarget(maxW, maxH, rtOpts);

    uniforms.tColor.value = colorTarget.texture;
    uniforms.tDepth.value = colorTarget.depthTexture;
    uniforms.tNormal.value = normalTarget.texture;
    uniforms.uTexRes.value.set(maxW, maxH);

    // Display canvas stays fixed at CSS viewport size (never thrashes during zoom!)
    renderer.setPixelRatio(1);
    renderer.setSize(viewW, viewH, false);

    updateActiveViewport();
  }

  /**
   * Update virtual pixel size cheaply per frame (only updates viewport/scissor & uniform, no allocations).
   */
  function setPixelSize(nextSize) {
    if (Math.abs(nextSize - pixelSize) < 0.005) return;
    pixelSize = nextSize;
    updateActiveViewport();
  }

  function setTheme(dark) {
    uniforms.uInkColor.value.setHex(dark ? 0x070d14 : 0x14202b);
    uniforms.uOutlineStrength.value = dark ? 0.94 : 0.9;
    uniforms.uHighlightStrength.value = dark ? 0.2 : 0.26;
    uniforms.uCreaseStrength.value = dark ? 0.42 : 0.32;
  }

  function render(scene, camera) {
    if (!colorTarget) return;

    const hiddenForNormal = [];
    scene.traverse((obj) => {
      if (obj.visible && obj.userData && obj.userData.noPixelEdge) {
        obj.visible = false;
        hiddenForNormal.push(obj);
      }
    });

    // Pass 1: View-space normals into active sub-viewport
    const prevBg = scene.background;
    scene.background = null;
    scene.overrideMaterial = normalOverrideMat;
    renderer.setRenderTarget(normalTarget);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = prevBg;

    // Pass 2: Toon color + linear depth into active sub-viewport
    for (const obj of hiddenForNormal) obj.visible = true;
    renderer.setRenderTarget(colorTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // Pass 3: Full-canvas pixel-art edge & Bayer dither composite
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  return {
    resize,
    setPixelSize,
    getPixelSize: () => pixelSize,
    getResolution: () => ({ width: curW, height: curH }),
    setTheme,
    render,
  };
}
