// Labs · home/benches.js
// Scalable multi-room (Wing) laboratory architecture:
// Splits the lab into cozy themed rooms (Physics, Mathematics, XR Studio) with automatic
// bench chunking (max 4 apparatuses per table) and data-driven placement for future apps.

export const MAX_STATIONS_PER_BENCH = 4;

export const BENCH_W = 7.4;
export const BENCH_D = 2.35;
export const BENCH_TOP_Y = 1.0;

export const ROOMS = [
  {
    id: "physics",
    theme: "physics",
    title: { it: "Fisica", en: "Physics" },
    benches: [
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
        title: { it: "Orbite e fasci", en: "Orbits & beams" },
        slugs: ["orbit-lab", "detach-lab"],
      },
    ],
  },
  {
    id: "math",
    theme: "math",
    title: { it: "Matematica", en: "Mathematics" },
    benches: [
      {
        id: "measure-space",
        code: "01",
        title: { it: "Aree e distanze", en: "Areas & metrics" },
        slugs: ["quadrature", "metric-lab"],
      },
      {
        id: "fractals-series",
        code: "02",
        title: { it: "Frattali e serie", en: "Fractals & series" },
        slugs: ["attractor-lab", "series-lab"],
      },
    ],
  },
  {
    id: "xr",
    theme: "xr",
    title: { it: "XR Studio", en: "XR Studio" },
    benches: [
      {
        id: "xr-physics-surfaces",
        code: "01",
        title: { it: "Fisica, superfici e segnali", en: "Physics, surfaces & signals" },
        slugs: ["orbit-lab-xr", "force-lab-xr", "surface-lab-xr", "fourier-lab-xr"],
      },
      {
        id: "xr-functions",
        code: "02",
        title: { it: "Parametri e funzioni", en: "Parameters & functions" },
        slugs: ["parameter-lab-xr", "composition-lab-xr", "dynagraph-xr"],
      },
    ],
  },
];

const NEW_BENCH_TEMPLATE = {
  id: "arrivals",
  code: "NEW",
  title: { it: "Nuovi apparati", en: "New arrivals" },
};

const SLUG_TO_LOC = new Map();
for (const room of ROOMS) {
  for (const b of room.benches) {
    for (const slug of b.slugs) {
      SLUG_TO_LOC.set(slug, { roomId: room.id, benchId: b.id });
    }
  }
}

export function locateApp(app) {
  if (app.room && ROOMS.some((r) => r.id === app.room)) {
    const room = ROOMS.find((r) => r.id === app.room);
    const benchId =
      app.bench && room.benches.some((b) => b.id === app.bench)
        ? app.bench
        : NEW_BENCH_TEMPLATE.id;
    return { roomId: room.id, benchId };
  }
  const known = SLUG_TO_LOC.get(app.slug);
  if (known) return known;

  // Automatic wing assignment for any future app added to apps.json
  if (app.kind === "xr") return { roomId: "xr", benchId: NEW_BENCH_TEMPLATE.id };
  if (app.subject === "mathematics") return { roomId: "math", benchId: NEW_BENCH_TEMPLATE.id };
  return { roomId: "physics", benchId: NEW_BENCH_TEMPLATE.id };
}

export function appsInRoom(roomId, allApps) {
  return allApps.filter((a) => locateApp(a).roomId === roomId);
}

/**
 * Build a cozy, well-proportioned 3D floorplan for a single laboratory wing.
 * Handles 1, 2, 3, or N benches gracefully while keeping every apparatus large and readable.
 */
export function buildRoomLayout(roomId, allApps) {
  const room = ROOMS.find((r) => r.id === roomId) || ROOMS[0];
  const roomApps = appsInRoom(room.id, allApps);

  const buckets = new Map();
  for (const b of room.benches) buckets.set(b.id, []);
  buckets.set(NEW_BENCH_TEMPLATE.id, []);

  for (const app of roomApps) {
    const { benchId } = locateApp(app);
    if (!buckets.has(benchId)) buckets.set(NEW_BENCH_TEMPLATE.id, [...(buckets.get(NEW_BENCH_TEMPLATE.id) || []), app]);
    else buckets.get(benchId).push(app);
  }

  const orderIndex = new Map();
  for (const b of room.benches) b.slugs.forEach((s, i) => orderIndex.set(s, i));

  const tables = [];
  for (const def of [...room.benches, NEW_BENCH_TEMPLATE]) {
    const list = buckets.get(def.id);
    if (!list || !list.length) continue;
    list.sort((a, b) => (orderIndex.get(a.slug) ?? 999) - (orderIndex.get(b.slug) ?? 999));

    const chunks = Math.ceil(list.length / MAX_STATIONS_PER_BENCH);
    for (let c = 0; c < chunks; c++) {
      const slice = list.slice(c * MAX_STATIONS_PER_BENCH, (c + 1) * MAX_STATIONS_PER_BENCH);
      const suffix = chunks > 1 ? String.fromCharCode(65 + c) : "";
      tables.push({
        ...def,
        roomId: room.id,
        tableId: suffix ? `${def.id}-${c + 1}` : def.id,
        displayCode: `${def.code}${suffix}`,
        apps: slice,
      });
    }
  }

  // Cozy room layout:
  // - 1–2 benches: single clean front-to-back column (large, intimate studio!)
  // - 3–4+ benches: tidy 2-column aisle grid (3rd bench centered cleanly if odd count!)
  const cols = tables.length <= 2 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(tables.length / cols));
  const colSpacing = 9.4;
  const rowSpacing = 5.1;

  const zHalf = ((rows - 1) * rowSpacing) / 2;

  tables.forEach((tb, idx) => {
    const row = Math.floor(idx / cols);
    const itemsInRow = row === rows - 1 ? tables.length - row * cols : cols;
    const colInRow = idx - row * cols;
    const rowXHalf = ((itemsInRow - 1) * colSpacing) / 2;

    tb.x = itemsInRow === 1 ? 0 : colInRow * colSpacing - rowXHalf;
    tb.z = row * rowSpacing - zHalf;
    tb.width = BENCH_W;
    tb.depth = BENCH_D;
    tb.topY = BENCH_TOP_Y;

    const n = tb.apps.length;
    const slotStep = 1.76;
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

  const roomWidth = cols === 1 ? 13.8 : Math.max(21.4, cols * colSpacing + 4.0);
  const roomDepth = Math.max(13.8, rows * rowSpacing + 5.6);

  return {
    room,
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
