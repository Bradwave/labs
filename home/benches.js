// Labs · home/benches.js
// Thematic laboratory benches, bilingual labels, automatic chunking (max 4 stations per bench)
// and scalable 3D aisle floorplan placement for any number of apps.

export const MAX_STATIONS_PER_BENCH = 4;

export const BENCH_W = 7.6;
export const BENCH_D = 2.35;
export const BENCH_TOP_Y = 1.0;

export const BENCHES = [
  {
    id: "mechanics",
    code: "01",
    title: { it: "Meccanica e urti", en: "Mechanics & collisions" },
    slugs: ["pendulum-lab", "carts-lab", "collision-lab", "impulse-lab"],
  },
  {
    id: "motion",
    code: "02",
    title: { it: "Moto e misura", en: "Motion & measurement" },
    slugs: ["motus1d-lab", "relative-motion-lab", "crackler", "units-lab"],
  },
  {
    id: "modern",
    code: "03",
    title: { it: "Orbite, fasci e forza", en: "Orbits, beams & forces" },
    slugs: ["orbit-lab", "orbit-lab-xr", "detach-lab", "force-lab-xr"],
  },
  {
    id: "geometry",
    code: "04",
    title: { it: "Geometria e analisi", en: "Geometry & analysis" },
    slugs: ["quadrature", "metric-lab", "attractor-lab", "series-lab"],
  },
  {
    id: "xr-surfaces",
    code: "05",
    title: { it: "Superfici e segnali XR", en: "Surfaces & signals XR" },
    slugs: ["surface-lab-xr", "fourier-lab-xr", "parameter-lab-xr"],
  },
  {
    id: "xr-functions",
    code: "06",
    title: { it: "Funzioni nello spazio XR", en: "Functions in space XR" },
    slugs: ["composition-lab-xr", "dynagraph-xr"],
  },
];

export const NEW_ARRIVALS_BENCH = {
  id: "arrivals",
  code: "NEW",
  title: { it: "Nuovi apparati", en: "New arrivals" },
};

const SLUG_TO_BENCH = new Map();
for (const b of BENCHES) {
  for (const slug of b.slugs) SLUG_TO_BENCH.set(slug, b.id);
}

export function benchIdForApp(app) {
  if (app.bench && BENCHES.some((b) => b.id === app.bench)) return app.bench;
  return SLUG_TO_BENCH.get(app.slug) || NEW_ARRIVALS_BENCH.id;
}

/**
 * Group apps onto physical 3D lab island benches arranged in a 2-column navigable aisle grid.
 * Automatically adds new rows and expands room bounds as the number of apps grows.
 */
export function buildLabLayout(apps) {
  const buckets = new Map();
  for (const b of BENCHES) buckets.set(b.id, []);
  buckets.set(NEW_ARRIVALS_BENCH.id, []);

  for (const app of apps) buckets.get(benchIdForApp(app)).push(app);

  const orderIndex = new Map();
  for (const b of BENCHES) b.slugs.forEach((s, i) => orderIndex.set(s, i));

  const tables = [];
  for (const def of [...BENCHES, NEW_ARRIVALS_BENCH]) {
    const list = buckets.get(def.id);
    if (!list || !list.length) continue;
    list.sort((a, b) => (orderIndex.get(a.slug) ?? 999) - (orderIndex.get(b.slug) ?? 999));

    const chunks = Math.ceil(list.length / MAX_STATIONS_PER_BENCH);
    for (let c = 0; c < chunks; c++) {
      const slice = list.slice(c * MAX_STATIONS_PER_BENCH, (c + 1) * MAX_STATIONS_PER_BENCH);
      const suffix = chunks > 1 ? String.fromCharCode(65 + c) : "";
      tables.push({
        ...def,
        tableId: suffix ? `${def.id}-${c + 1}` : def.id,
        displayCode: `${def.code}${suffix}`,
        apps: slice,
      });
    }
  }

  const cols = tables.length === 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(tables.length / cols));
  const colSpacing = 9.6;
  const rowSpacing = 5.4;

  const xHalf = ((cols - 1) * colSpacing) / 2;
  const zHalf = ((rows - 1) * rowSpacing) / 2;

  tables.forEach((tb, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    tb.x = cols === 1 ? 0 : col * colSpacing - xHalf;
    tb.z = row * rowSpacing - zHalf;
    tb.width = BENCH_W;
    tb.depth = BENCH_D;
    tb.topY = BENCH_TOP_Y;

    // Station world positions along the benchtop (centered cleanly, leaving room for clutter if <4)
    const n = tb.apps.length;
    const slotStep = 1.78;
    const hasClutter = n <= 3;
    const totalSlots = hasClutter ? n + 1 : n;
    const startX = -((totalSlots - 1) * slotStep) / 2;

    tb.slots = tb.apps.map((app, i) => ({
      app,
      localX: startX + i * slotStep,
      worldX: tb.x + startX + i * slotStep,
      worldY: tb.topY,
      worldZ: tb.z,
    }));
    tb.clutterLocalX = hasClutter ? startX + n * slotStep : null;
  });

  const roomWidth = Math.max(21.6, cols * colSpacing + 4.4);
  const roomDepth = Math.max(18.6, rows * rowSpacing + 5.2);

  return {
    benches: tables,
    roomWidth,
    roomDepth,
    bounds: {
      minX: -roomWidth / 2,
      maxX: roomWidth / 2,
      minZ: -roomDepth / 2,
      maxZ: roomDepth / 2,
    },
  };
}
