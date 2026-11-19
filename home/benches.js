// Labs · home/benches.js
// Bench definitions, bilingual labels, app-to-bench grouping and automatic bench chunking for scalability.

export const MAX_STATIONS_PER_TABLE = 4;

export const BENCHES = [
  {
    id: "mechanics",
    code: "01",
    scenery: "mechanics",
    title: { it: "Meccanica e urti", en: "Mechanics & collisions" },
    note: { it: "Pendoli, rotaie, cuscino d'aria e impulsi", en: "Pendulums, rails, air table and impulse" },
    slugs: ["pendulum-lab", "carts-lab", "collision-lab", "impulse-lab"],
  },
  {
    id: "motion",
    code: "02",
    scenery: "motion",
    title: { it: "Moto e misura", en: "Motion & measurement" },
    note: { it: "Cinematica, sistemi di riferimento, videoanalisi e unità", en: "Kinematics, reference frames, video analysis and units" },
    slugs: ["motus1d-lab", "relative-motion-lab", "crackler", "units-lab"],
  },
  {
    id: "modern",
    code: "03",
    scenery: "modern",
    title: { it: "Orbite, fasci e forza", en: "Orbits, beams & forces" },
    note: { it: "Gravitazione, fasci laser ed esperimenti di fisica in XR", en: "Gravitation, laser beams and physics in XR" },
    slugs: ["orbit-lab", "orbit-lab-xr", "detach-lab", "force-lab-xr"],
  },
  {
    id: "geometry",
    code: "04",
    scenery: "geometry",
    title: { it: "Geometria e analisi", en: "Geometry & analysis" },
    note: { it: "Aree, distanze, frattali e serie nel piano complesso", en: "Areas, metrics, fractals and complex series" },
    slugs: ["quadrature", "metric-lab", "attractor-lab", "series-lab"],
  },
  {
    id: "xr-surfaces",
    code: "05",
    scenery: "xr-surfaces",
    title: { it: "Superfici e segnali XR", en: "Surfaces & signals XR" },
    note: { it: "Quadriche, trasformata di Fourier ed equazioni parametriche", en: "Quadrics, Fourier winding and parametric slices" },
    slugs: ["surface-lab-xr", "fourier-lab-xr", "parameter-lab-xr"],
  },
  {
    id: "xr-functions",
    code: "06",
    scenery: "xr-functions",
    title: { it: "Funzioni nello spazio XR", en: "Functions in space XR" },
    note: { it: "Composizione di funzioni e dynagraph su assi paralleli", en: "Function composition and parallel-axis dynagraphs" },
    slugs: ["composition-lab-xr", "dynagraph-xr"],
  },
];

// Fallback bench for any new app added to apps.json without an explicit bench assignment.
export const NEW_ARRIVALS_BENCH = {
  id: "arrivals",
  code: "NEW",
  scenery: "arrivals",
  title: { it: "Nuovi apparati", en: "New arrivals" },
  note: { it: "Esperimenti appena arrivati in laboratorio", en: "Fresh equipment just unpacked in the lab" },
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
 * Group filtered apps onto physical lab tables.
 * Any bench exceeding MAX_STATIONS_PER_TABLE automatically splits into additional tables
 * (e.g. 01A, 01B) so the layout remains readable and uncluttered even with dozens of apps.
 */
export function buildBenchTables(apps) {
  const buckets = new Map();
  for (const b of BENCHES) buckets.set(b.id, []);
  buckets.set(NEW_ARRIVALS_BENCH.id, []);

  for (const app of apps) {
    const id = benchIdForApp(app);
    buckets.get(id).push(app);
  }

  // Keep curated order within each bench, placing unknown slugs in apps.json order after them.
  const orderIndex = new Map();
  for (const b of BENCHES) b.slugs.forEach((s, i) => orderIndex.set(s, i));

  const tables = [];
  const defs = [...BENCHES, NEW_ARRIVALS_BENCH];
  for (const def of defs) {
    const list = buckets.get(def.id);
    if (!list || !list.length) continue;
    list.sort((a, b) => (orderIndex.get(a.slug) ?? 999) - (orderIndex.get(b.slug) ?? 999));

    const chunkCount = Math.ceil(list.length / MAX_STATIONS_PER_TABLE);
    for (let c = 0; c < chunkCount; c++) {
      const slice = list.slice(c * MAX_STATIONS_PER_TABLE, (c + 1) * MAX_STATIONS_PER_TABLE);
      const suffix = chunkCount > 1 ? String.fromCharCode(65 + c) : "";
      tables.push({
        ...def,
        tableId: suffix ? `${def.id}-${c + 1}` : def.id,
        anchorId: c === 0 ? `bench-${def.id}` : `bench-${def.id}-${c + 1}`,
        displayCode: `${def.code}${suffix}`,
        apps: slice,
        isContinuation: c > 0,
      });
    }
  }
  return tables;
}
