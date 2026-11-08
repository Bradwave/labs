// Costanti del modello. Tutte in unità SI.
// Nessun dato reale era disponibile: i valori sono stime plausibili da tarare
// su misure reali (rumore, attrito, forza dei magneti, molla).
export const CFG = {
  G: 9.81,
  DT: 0.0002,            // passo di integrazione (s)
  CART_LEN: 0.12,        // lunghezza dei carrelli (m)
  CART_H: 0.045,         // altezza (solo disegno)
  RAIL_DEFAULT: 1.0,
  BASE_MASS: { A: 1.0, B: 1.0 },
  EXTRA: { m1: 1.0, m05: 0.5 },

  // sensori
  DEAD: 0.15,            // distanza minima misurabile (m)
  RANGE: 4.0,
  SIGMA_DEFAULT: 0.0005, // rumore di posizione (m)
  TRUTH_DT: 0.002,       // passo di salvataggio della curva "reale"

  // attrito
  MU_DEFAULT: 0.004,     // resistenza al rotolamento (adimensionale)
  AIR: 0.0025,           // resistenza dell'aria, F = AIR * v * |v|  (N s²/m²)
  VEPS: 1e-4,            // sotto questa velocità il carrello può essere "fermo"

  // contatto duro (paraurti di plastica, parti metalliche)
  K_HARD: 3.0e4,         // N/m
  ZETA_HARD: 0.36,       // restituzione ≈ 0.3
  ZETA_STICK: 0.95,      // velcro: urto completamente anelastico

  // magneti (dipolo-dipolo, corto raggio): F = F0 (d0/(g+d0))^N, tagliata a MAG_RANGE
  // poli uguali: repulsione; poli opposti con velcro: attrazione
  REP_F0: 20.0, REP_D0: 0.012, ATT_F0: 10.0, ATT_D0: 0.012, MAG_N: 4,
  MAG_RANGE: 0.12,

  // respingitore a molla
  PLUNGER_PROT: 0.02,    // sporgenza a riposo (m)
  K_SPRING: 1500,        // N/m, rigidezza in urto
  ZETA_SPRING: 0.033,    // restituzione ≈ 0.9
  K_FIRE: 800,           // N/m, molla di lancio
  FIRE_E: [0.02, 0.03, 0.04], // corsa di spinta per i tre livelli (m)

  // masse nascoste e bilancia
  HIDDEN_MIN: 0.8, HIDDEN_MAX: 1.2, HIDDEN_GAP: 0.06,   // kg
  SCALE_SIGMA: 0.0006,   // rumore della bilancia (kg)
  SCALE_RES: 0.001,      // risoluzione (kg)

  // trigger di avvio: soglia di spostamento (mm)
  TRIG_DEFAULT_MM: 10,

  // lancio con il dito
  V_MAX_THROW: 1.5,
};

export const FACES = {
  // facce [sinistra, destra] di ciascun carrello non girato
  A: ['spring', 'velcro'],
  B: ['velcro', 'magnet'],
};

// Livello minimo (1 Lettura, 2 Analisi, 3 Completo) a cui compare ciascuna funzione.
export const FEATURES = {
  B: 1,
  select: 2, fitlin: 2, crop: 2, align: 2,
  presets2: 2, plunger: 2, masses: 2, scale: 2, hidden: 2, trigger: 2, invert: 2,
  fitquad: 3, fitconst: 3, truth: 3, vectors: 3, noise: 3, rail: 3, tilt: 3, friction: 3,
};
export const LEVEL_MAX = 3;
