// Units Lab · data/contexts.js
// Catalogue of real-world contexts for the exercises. One entry = one situation.
//   m: module (3 prefixes · 4 area/volume/capacity · 5 composite/non-decimal)
//   unit: natural unit; lo..hi: plausible range in that unit (drawn with `sf` figures);
//   fixed: exact written value for constants and defined quantities (overrides lo/hi);
//   alts: other units the exercise may convert to/from; rev: true once checked by the teacher.
// Values are typical orders of magnitude, introduced with "circa"/"tipico" where they vary.

const C = (id, m, it, unit, o) => ({ id, m, it, unit, sf: 3, alts: [], rev: false, ...o });

const CONTEXTS = [
  // ---- module 3: prefixes on a single unit ----
  C("laser-rosso", 3, "Lunghezza d'onda di un laser rosso", "nm", { lo: 630, hi: 680, alts: ["µm", "m", "mm"] }),
  C("luce-verde", 3, "Lunghezza d'onda della luce verde", "nm", { lo: 520, hi: 560, alts: ["µm", "m", "cm"] }),
  C("capello", 3, "Diametro tipico di un capello umano", "µm", { lo: 50, hi: 100, sf: 2, alts: ["mm", "m", "nm"] }),
  C("globulo-rosso", 3, "Diametro di un globulo rosso", "µm", { lo: 6.5, hi: 8.5, sf: 2, alts: ["m", "mm", "nm"] }),
  C("foglio-carta", 3, "Spessore di un foglio di carta per stampante", "µm", { lo: 80, hi: 120, alts: ["mm", "m", "cm"] }),
  C("atomo", 3, "Diametro tipico di un atomo", "nm", { lo: 0.1, hi: 0.3, sf: 2, alts: ["pm", "m", "µm"] }),
  C("altezza-persona", 3, "Altezza di una persona adulta", "cm", { lo: 155, hi: 195, alts: ["m", "mm", "km"] }),
  C("campo-calcio", 3, "Lunghezza di un campo da calcio per partite internazionali", "m", { lo: 100, hi: 110, alts: ["km", "cm", "dm"] }),
  C("maratona", 3, "Lunghezza di una maratona", "km", { fixed: "42,195", alts: ["m", "cm", "hm"] }),
  C("raggio-terra", 3, "Raggio medio della Terra", "km", { fixed: "6371", alts: ["m", "Mm", "cm"] }),
  C("terra-luna", 3, "Distanza media Terra–Luna", "km", { fixed: "3,844e5", alts: ["m", "Mm", "Gm"] }),
  C("terra-sole", 3, "Distanza media Terra–Sole", "km", { fixed: "1,496e8", alts: ["m", "Gm", "Tm"] }),
  C("mela", 3, "Massa di una mela", "g", { lo: 120, hi: 220, alts: ["kg", "mg", "cg"] }),
  C("automobile", 3, "Massa di un'utilitaria", "kg", { lo: 900, hi: 1500, alts: ["g", "t", "Mg"] }),
  C("zanzara", 3, "Massa di una zanzara", "mg", { lo: 1.5, hi: 3.0, sf: 2, alts: ["g", "kg", "µg"] }),
  C("uovo", 3, "Massa di un uovo di gallina", "g", { lo: 50, hi: 65, sf: 2, alts: ["kg", "mg"] }),
  C("elefante", 3, "Massa di un elefante africano adulto", "t", { lo: 4.0, hi: 6.0, sf: 2, tier: 2, alts: ["kg", "g", "Mg"] }),
  C("massa-terra", 3, "Massa della Terra", "kg", { fixed: "5,97e24", alts: ["Mg", "g", "Gg"] }),
  C("elettrone", 3, "Massa dell'elettrone", "kg", { fixed: "9,11e-31", alts: ["g", "mg", "µg"] }),
  C("film", 3, "Durata di un film", "min", { lo: 95, hi: 180, alts: ["s", "h"] }),
  C("battito", 3, "Intervallo tra due battiti del cuore a riposo", "ms", { lo: 750, hi: 950, sf: 2, alts: ["s", "µs", "min"] }),
  C("riflessi", 3, "Tempo di reazione di una persona", "ms", { lo: 180, hi: 280, alts: ["s", "µs", "min"] }),
  C("anno", 3, "Durata dell'anno giuliano", "d", { fixed: "365,25", alts: ["h", "s", "min"] }),
  C("fm", 3, "Frequenza di una stazione radio FM", "MHz", { lo: 88, hi: 108, alts: ["Hz", "kHz", "GHz"] }),
  C("cpu", 3, "Frequenza di un processore", "GHz", { lo: 2.0, hi: 4.5, sf: 2, alts: ["MHz", "Hz", "kHz"] }),
  C("wifi", 3, "Frequenza di un router Wi-Fi", "GHz", { fixed: "2,4", alts: ["MHz", "Hz", "kHz"] }),
  C("diapason", 3, "Frequenza della nota La (diapason)", "Hz", { fixed: "440", alts: ["kHz", "mHz", "MHz"] }),
  C("led", 3, "Corrente in un LED acceso", "mA", { lo: 10, hi: 20, sf: 2, tier: 2, alts: ["A", "µA", "kA"] }),
  C("asciugacapelli", 3, "Potenza di un asciugacapelli", "kW", { lo: 1.2, hi: 2.2, sf: 2, tier: 2, alts: ["W", "MW", "mW"] }),
  C("lampadina", 3, "Potenza di una lampadina LED domestica", "W", { lo: 5.5, hi: 14.5, sf: 2, tier: 2, alts: ["mW", "kW", "µW"] }),
  C("presa", 3, "Tensione della rete elettrica domestica", "V", { fixed: "230", tier: 2, alts: ["kV", "mV", "MV"] }),
  C("condensatore", 3, "Capacità di un condensatore elettrolitico", "µF", { lo: 100, hi: 470, sf: 2, tier: 3, alts: ["F", "mF", "nF"] }),
  C("resistenza", 3, "Resistenza in un circuito elettronico", "kΩ", { lo: 1.0, hi: 9.9, sf: 2, tier: 3, alts: ["Ω", "MΩ", "mΩ"] }),
  C("foto", 3, "Dimensione di una foto scattata con uno smartphone", "MB", { lo: 2.0, hi: 6.0, sf: 2, tier: 3, alts: ["kB", "B", "GB"] }),
  C("chiavetta", 3, "Capacità di una chiavetta USB", "GB", { lo: 8, hi: 128, sf: 2, tier: 3, alts: ["MB", "TB", "kB"] }),
  C("atm", 3, "Pressione atmosferica al livello del mare", "Pa", { fixed: "1,013e5", tier: 2, alts: ["hPa", "kPa", "MPa"] }),
  C("forza-peso", 3, "Forza peso di un oggetto di massa 1 kg sulla Terra", "N", { fixed: "9,8", tier: 2, alts: ["kN", "mN", "cN"] }),
  // ---- module 4: area, volume, capacity ----
  C("a4", 4, "Area di un foglio A4", "cm2", { fixed: "623,7", alts: ["m2", "mm2", "dm2"] }),
  C("italia", 4, "Superficie dell'Italia", "km2", { fixed: "3,01e5", alts: ["m2", "ha", "cm2"] }),
  C("garda", 4, "Superficie del Lago di Garda", "km2", { fixed: "368", alts: ["m2", "ha", "dm2"] }),
  C("lattina", 4, "Volume di una lattina di bibita", "mL", { fixed: "330", alts: ["L", "cm3", "m3", "dm3"] }),
  C("bottiglia", 4, "Capacità di una bottiglia d'acqua grande", "L", { fixed: "1,5", alts: ["mL", "cm3", "m3", "dm3"] }),
  C("serbatoio", 4, "Capacità del serbatoio di un'automobile", "L", { lo: 35, hi: 65, sf: 2, alts: ["dm3", "m3", "mL", "cm3"] }),
  C("goccia", 4, "Volume di una goccia d'acqua", "mL", { fixed: "0,05", alts: ["cm3", "mm3", "L", "µL"] }),
  C("aula", 4, "Volume di un'aula scolastica", "m3", { lo: 140, hi: 200, alts: ["dm3", "cm3", "L"] }),
  C("piscina", 4, "Volume d'acqua di una piscina olimpionica, circa", "m3", { fixed: "2,5e3", alts: ["L", "dm3", "cm3", "mL"] }),
  C("moneta", 4, "Superficie di una moneta da 2 euro, circa", "cm2", { fixed: "5,3", sf: 2, alts: ["mm2", "m2", "dm2"] }),
  // ---- module 5: composite and non-decimal ----
  C("auto", 5, "Velocità di un'auto in autostrada", "km/h", { lo: 110, hi: 130, alts: ["m/s"] }),
  C("treno", 5, "Velocità massima di un treno ad alta velocità", "km/h", { lo: 250, hi: 300, alts: ["m/s"] }),
  C("suono", 5, "Velocità del suono in aria a 20 °C", "m/s", { fixed: "343", alts: ["km/h", "cm/s", "km/s"] }),
  C("luce", 5, "Velocità della luce nel vuoto", "m/s", { fixed: "2,998e8", alts: ["km/s", "km/h", "cm/s"] }),
  C("velocista", 5, "Velocità media di un velocista sui 100 m", "m/s", { lo: 9.8, hi: 10.4, alts: ["km/h"] }),
  C("cammino", 5, "Velocità di una persona che cammina", "km/h", { lo: 4.5, hi: 5.5, sf: 2, alts: ["m/s", "cm/s"] }),
  C("terra-orbita", 5, "Velocità orbitale della Terra intorno al Sole", "km/s", { fixed: "29,8", alts: ["m/s", "km/h"] }),
  C("acqua", 5, "Densità dell'acqua", "g/cm3", { fixed: "1,00", alts: ["kg/m3", "kg/L", "g/mL"] }),
  C("ferro", 5, "Densità del ferro", "g/cm3", { fixed: "7,87", alts: ["kg/m3", "kg/L"] }),
  C("alluminio", 5, "Densità dell'alluminio", "g/cm3", { fixed: "2,70", alts: ["kg/m3", "kg/L"] }),
  C("oro", 5, "Densità dell'oro", "g/cm3", { fixed: "19,3", alts: ["kg/m3", "kg/dm3"] }),
  C("rame", 5, "Densità del rame", "g/cm3", { fixed: "8,96", alts: ["kg/m3", "kg/L"] }),
  C("aria", 5, "Densità dell'aria a 20 °C", "kg/m3", { fixed: "1,20", alts: ["g/cm3", "g/L"] }),
  C("ghiaccio", 5, "Densità del ghiaccio", "g/cm3", { fixed: "0,917", alts: ["kg/m3", "kg/L"] }),
  C("mercurio", 5, "Densità del mercurio", "g/cm3", { fixed: "13,6", alts: ["kg/m3", "kg/L"] }),
  C("rubinetto", 5, "Portata di un rubinetto aperto", "L/min", { lo: 6.0, hi: 12.0, sf: 2, alts: ["m3/s", "mL/s", "L/h"] }),
  C("doccia", 5, "Portata di una doccia", "L/min", { lo: 7.0, hi: 12.0, sf: 2, alts: ["m3/s", "mL/s", "L/h"] }),
  C("pneumatico", 5, "Pressione di gonfiaggio di un pneumatico", "N/cm2", { lo: 20, hi: 26, sf: 2, tier: 2, alts: ["Pa", "kPa", "N/m2"] }),
  C("pneumatico-bar", 5, "Pressione di gonfiaggio di un pneumatico", "bar", { lo: 2.0, hi: 2.6, sf: 2, tier: 3, alts: ["Pa", "kPa", "N/cm2"] }),
  C("pressione-sangue", 5, "Pressione sistolica di una persona sana", "mmHg", { lo: 105, hi: 130, tier: 3, alts: ["Pa", "kPa", "hPa"] }),
  C("fotone", 5, "Energia di un fotone di luce visibile", "eV", { lo: 1.8, hi: 3.1, sf: 2, tier: 3, alts: ["J"] }),
  C("barretta", 5, "Energia di una barretta di cioccolato", "kcal", { lo: 210, hi: 290, tier: 3, alts: ["cal", "J", "kJ"] }),
  C("bolletta", 5, "Consumo elettrico mensile di una famiglia", "kWh", { lo: 190, hi: 310, tier: 3, alts: ["J", "MJ", "Wh"] }),
];

export { CONTEXTS };
