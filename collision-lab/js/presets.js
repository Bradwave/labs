// Collision Lab · presets.js
// Named scenes for links (#p=<id>), pure: an id, a title and a note in Italian and English, and the settings in
// the same format as the hash. A link applies the defaults, then the preset, then the keys written after it.

const COMMON = "show=strobe,cm&f=lab&w=0";
const S1 = "s=headon&m1=0.25&m2=0.25&v1=1&v2=0&x1=0.5&x2=1.2&e=1&st=0";
const S8 = "s=explosion&m1=0.1&m2=0.4&E=0.2&v0=0&phi=0";

// replaces (or adds) keys in a settings string: with(S1, "e=0.5") keeps the order of S1
function withKeys(base, extra) {
  const q = new URLSearchParams(base);
  for (const [k, v] of new URLSearchParams(extra)) q.set(k, v);
  return [...q].map(([k, v]) => `${k}=${v}`).join("&");
}
const P = (id, settings, it, en) => ({ id, settings: `${settings}&${COMMON}`, title: { it: it[0], en: en[0] }, note: { it: it[1], en: en[1] } });

export const PRESETS = [
  P("urti/s1", S1,
    ["Urto elastico, masse uguali", "A urta B, fermo. Prevedi le velocità dopo l'urto, poi premi Avvia."],
    ["Elastic collision, equal masses", "A hits B, at rest. Predict the velocities after the collision, then press Play."]),
  P("urti/s2", withKeys(S1, "e=0.5"),
    ["Urto anelastico, e = 0,5", "Gli stessi dischi, ma l'urto non è elastico. Quanta energia cinetica si perde?"],
    ["Inelastic collision, e = 0.5", "The same discs, but the collision is not elastic. How much kinetic energy is lost?"]),
  P("urti/s3", withKeys(S1, "st=1"),
    ["I dischi si attaccano", "Dopo l'urto A e B si muovono insieme. Con quale velocità?"],
    ["The discs stick together", "After the collision A and B move together. At what velocity?"]),
  P("urti/s4", withKeys(S1, "e=0.7&hide=e,bal&lock=1"),
    ["Urto misterioso", "Il coefficiente di restituzione è nascosto: misura le velocità nei grafici e ricavalo."],
    ["Mystery collision", "The coefficient of restitution is hidden: measure the velocities in the graphs and work it out."]),
  P("urti/s5", "s=headon&m1=0.1&m2=1&v1=1&v2=0&x1=0.5&x2=1.2&e=1&st=0",
    ["Leggero contro pesante", "A (0,1 kg) urta B (1 kg), fermo. Che cosa succede ad A?"],
    ["Light against heavy", "A (0.1 kg) hits B (1 kg), at rest. What happens to A?"]),
  P("urti/s6", "s=headon&m1=1&m2=0.1&v1=1&v2=0&x1=0.5&x2=1.2&e=1&st=0",
    ["Pesante contro leggero", "A (1 kg) urta B (0,1 kg), fermo. Quanto veloce parte B?"],
    ["Heavy against light", "A (1 kg) hits B (0.1 kg), at rest. How fast does B leave?"]),
  P("urti/s7", "s=headon&m1=0.4&m2=0.1&v1=0.8&v2=-1&x1=0.5&x2=1.4&st=1",
    ["Si vengono incontro e si attaccano", "A e B si vengono incontro e restano attaccati. Da che parte va la coppia, e quanto veloce?"],
    ["Head-on, and they stick", "A and B move towards each other and stick. Which way does the pair go, and how fast?"]),
  P("urti/s8", S8,
    ["Esplosione da fermo", "Un corpo fermo si divide in due pezzi di massa diversa. Come sono le loro quantità di moto?"],
    ["Explosion from rest", "A body at rest splits into two pieces of different mass. How do their momenta compare?"]),
  P("urti/s9", withKeys(S8, "v0=0.6"),
    ["Esplosione in moto", "Lo stesso corpo, ora in moto a 0,6 m/s. Che cosa fa il centro di massa dopo l'esplosione?"],
    ["Explosion in motion", "The same body, now moving at 0.6 m/s. What does the centre of mass do after the explosion?"]),
  P("urti/s10", "s=glancing&m1=0.25&m2=0.25&v1=1&b=0.5&x1=0.4&e=1&st=0",
    ["Urto obliquo, masse uguali", "A urta di lato B, fermo. Che angolo formano le traiettorie dopo l'urto?"],
    ["Glancing collision, equal masses", "A hits B, at rest, off-centre. What angle do the paths make after the collision?"]),
  P("urti/s11", "s=glancing&m1=0.4&m2=0.1&v1=1&b=0.5&x1=0.4&e=1&st=0",
    ["Urto obliquo, masse diverse", "Ora A è più pesante di B. L'angolo dopo l'urto è ancora retto?"],
    ["Glancing collision, different masses", "Now A is heavier than B. Is the angle after the collision still a right angle?"]),
];

export const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));
