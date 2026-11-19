// Labs · home/benches.js
// Cutaway laboratory floors, bilingual room signs, app-to-floor grouping and automatic floor chunking.

export const MAX_STATIONS_PER_FLOOR = 4;

export const FLOORS = [
  {
    id: "mechanics",
    code: "F1",
    roomTheme: "mechanics",
    title: { it: "Meccanica e urti", en: "Mechanics & collisions" },
    slugs: ["pendulum-lab", "carts-lab", "collision-lab", "impulse-lab"],
  },
  {
    id: "motion",
    code: "F2",
    roomTheme: "motion",
    title: { it: "Moto e misura", en: "Motion & measurement" },
    slugs: ["motus1d-lab", "relative-motion-lab", "crackler", "units-lab"],
  },
  {
    id: "modern",
    code: "F3",
    roomTheme: "modern",
    title: { it: "Orbite, fasci e forza", en: "Orbits, beams & forces" },
    slugs: ["orbit-lab", "orbit-lab-xr", "detach-lab", "force-lab-xr"],
  },
  {
    id: "geometry",
    code: "F4",
    roomTheme: "geometry",
    title: { it: "Geometria e analisi", en: "Geometry & analysis" },
    slugs: ["quadrature", "metric-lab", "attractor-lab", "series-lab"],
  },
  {
    id: "xr-surfaces",
    code: "F5",
    roomTheme: "xr-surfaces",
    title: { it: "Superfici e segnali XR", en: "Surfaces & signals XR" },
    slugs: ["surface-lab-xr", "fourier-lab-xr", "parameter-lab-xr"],
  },
  {
    id: "xr-functions",
    code: "F6",
    roomTheme: "xr-functions",
    title: { it: "Funzioni nello spazio XR", en: "Functions in space XR" },
    slugs: ["composition-lab-xr", "dynagraph-xr"],
  },
];

export const NEW_ARRIVALS_FLOOR = {
  id: "arrivals",
  code: "NEW",
  roomTheme: "arrivals",
  title: { it: "Nuovi apparati", en: "New arrivals" },
};

const SLUG_TO_FLOOR = new Map();
for (const f of FLOORS) {
  for (const slug of f.slugs) SLUG_TO_FLOOR.set(slug, f.id);
}

export function floorIdForApp(app) {
  if (app.bench && FLOORS.some((f) => f.id === app.bench)) return app.bench;
  return SLUG_TO_FLOOR.get(app.slug) || NEW_ARRIVALS_FLOOR.id;
}

/**
 * Group apps onto cutaway laboratory floors (max MAX_STATIONS_PER_FLOOR per room).
 * Any zone with >4 apps automatically adds an extra wing (e.g. F1A, F1B) so the
 * building scales vertically as the lab collection grows.
 */
export function buildLabFloors(apps) {
  const buckets = new Map();
  for (const f of FLOORS) buckets.set(f.id, []);
  buckets.set(NEW_ARRIVALS_FLOOR.id, []);

  for (const app of apps) {
    buckets.get(floorIdForApp(app)).push(app);
  }

  const orderIndex = new Map();
  for (const f of FLOORS) f.slugs.forEach((s, i) => orderIndex.set(s, i));

  const rooms = [];
  const defs = [...FLOORS, NEW_ARRIVALS_FLOOR];
  for (const def of defs) {
    const list = buckets.get(def.id);
    if (!list || !list.length) continue;
    list.sort((a, b) => (orderIndex.get(a.slug) ?? 999) - (orderIndex.get(b.slug) ?? 999));

    const chunks = Math.ceil(list.length / MAX_STATIONS_PER_FLOOR);
    for (let c = 0; c < chunks; c++) {
      const slice = list.slice(c * MAX_STATIONS_PER_FLOOR, (c + 1) * MAX_STATIONS_PER_FLOOR);
      const suffix = chunks > 1 ? String.fromCharCode(65 + c) : "";
      rooms.push({
        ...def,
        roomId: suffix ? `${def.id}-${c + 1}` : def.id,
        displayCode: `${def.code}${suffix}`,
        apps: slice,
      });
    }
  }
  return rooms;
}
