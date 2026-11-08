const DICT = {
  it: {
    tag: 'Lancia i carrelli, registra con i sensori di posizione e impara a leggere i grafici x–t e v–t.',
    lang: 'Lingua', theme: 'Tema chiaro/scuro', help: 'Come si usa', close: 'Chiudi',
    live: 'Torna al vivo', launch: 'Lancia', fire: 'Scatta', home: 'Riposiziona', home_t: 'Rimette i carrelli dove li avevi messi',
    record: 'Registra', stop: 'Stop', run: 'Reg.', example: 'Esempio', saved: 'Registrazione salvata',
    freq_t: 'Frequenza di campionamento', dur_t: 'Durata della registrazione', speed_t: 'Velocità della scena',
    tool_probe: 'Lettura: tocca o trascina per leggere i valori', tool_select: 'Selezione: trascina per scegliere un intervallo',
    tool_pan: 'Mano: trascina per spostare, rotella o pizzico per ingrandire',
    autoscale: 'Scala automatica', autoscale_s: 'Scala', v_points: 'Solo punti campionati', v_joined: 'Punti uniti',
    cursor_b: 'Secondo cursore B: misura differenze e pendenza', truth_t: 'Mostra il moto reale (tratteggio)', truth: 'Reale',
    uncrop_t: 'Ripristina i dati ritagliati', uncrop: 'Ripristina',
    fit_lin: 'Fit lineare', fit_quad: 'Fit quadratico', fit_const: 'Fit costante (media)', crop_t: 'Ritaglia sull\'intervallo selezionato',
    tab_graphs: 'Grafici', tab_setup: 'Montaggio', tab_sensors: 'Sensori', tab_data: 'Dati',
    graph_empty: 'Premi Registra e lancia un carrello',
    readout_hint: 'Usa la lettura: tocca un grafico per leggere i valori dei due sensori. Il cursore muove anche i carrelli nella scena.',
    f_spring: 'molla', f_velcro: 'velcro', f_magnet: 'magnete',
    pair_rep: 'repulsione magnetica (urto quasi elastico)', pair_stick: 'attrazione e velcro (urto anelastico)', pair_spring: 'contatto con la molla',
    facing: 'Facce che si affrontano',
    g_quick: 'Montaggi rapidi', p_elastic: 'Elastico', p_sticky: 'Anelastico', p_spring: 'Con molla', p_explosion: 'Scoppio',
    g_carts: 'Carrelli', swap: 'Scambia', left: 'Sinistro', right: 'Destro', flip: 'Gira',
    plunger: 'Respingitore a molla (A)', pl_blocked: 'Bloccato', pl_active: 'Attivo', pl_loaded: 'Carico', level: 'Livello di carica',
    g_masses: 'Masse aggiuntive',
    g_launch: 'Velocità di lancio', launch_note: 'Il pulsante Lancia avvia la registrazione e dà questa velocità ai carrelli (positiva verso destra). Puoi anche trascinare un carrello durante la registrazione.',
    g_rail: 'Rotaia', length: 'Lunghezza', tilt: 'Piedino sinistro − destro',
    tilt_note: 'Positivo: il lato sinistro è più alto e i carrelli scendono verso destra. Nel disegno l\'inclinazione è ×3.',
    friction: 'Attrito di rotolamento', friction_note: 'Frena i carrelli con una forza costante: la decelerazione vale μg e non dipende dalla massa. L\'aria è trascurabile. Una piccola inclinazione con tan θ = μ lo compensa, ma solo in un verso di moto.',
    g_reference: 'Riferimento dei sensori', invert: 'Inverti', inv_on: 'positivo verso il sensore', inv_off: 'positivo allontanandosi dal sensore',
    invert_note: 'Di base ogni sensore misura la distanza da sé: lo stesso moto ha velocità di segno opposto sui due sensori.',
    g_noise: 'Rumore', noise_note: 'Deviazione standard del sensore. La velocità è ricavata dai campioni di posizione con la differenza centrale a tre punti.',
    g_sensor: 'Zona morta', sensor_note: 'Sotto 15 cm il sensore non misura e riporta la distanza minima, 0,15 m. Se un carrello esce dalla rotaia il sensore vede quello rimasto.',
    g_runs: 'Registrazioni', no_runs: 'Nessuna registrazione.', cropped: 'ritagliata', hide: 'Nascondi/mostra', delete: 'Elimina',
    g_fits: 'Fit', no_fits: 'Seleziona un intervallo e scegli il tipo di fit sul grafico. Le rette tratteggiate si estendono oltre l\'intervallo.',
    g_display: 'Visualizzazione', align: 'Allinea gli inizi', align_s: 'Ogni registrazione parte dal suo primo dato visibile',
    vectors: 'Velocità vera sui carrelli', vectors_s: 'Freccia con il valore esatto nella scena', truth_full: 'Moto reale sui grafici', truth_s: 'Tratteggio sotto i campioni',
    lvl_t: 'Livello delle funzioni', lvl_1: 'Lettura', lvl_2: 'Analisi', lvl_3: 'Completo', lvl_word: 'Livello',
    g_trigger: 'Avvio con trigger', trig_on: 'Avvia al movimento', trig_on_s: 'Registra arma i sensori: si parte quando un carrello si muove', trig_thr: 'Soglia di spostamento',
    trig_note: 'Con il trigger attivo, Registra arma i sensori e la registrazione parte da sola quando una distanza cambia più della soglia. L\'istante t = 0 è quello in cui la soglia viene superata: i primi campioni mostrano già un piccolo spostamento.',
    arm: 'Arma', armed: 'Annulla', waiting: 'In attesa del moto…', graph_armed: 'Trigger armato: muovi un carrello o premi Lancia', armed_toast: 'Trigger armato',
    g_scale: 'Bilancia', hidden_on: 'Masse dei carrelli nascoste', hidden_s: 'Ogni carrello ha una massa ignota: misurala o ricavala dai dati', seed: 'Seme', seed_t: 'Stesso seme, stesse masse',
    weigh: 'Pesa', scale_note: 'La bilancia ha risoluzione di 1 g e una piccola incertezza: conviene pesare più volte. Il carrello viene pesato con le masse aggiuntive che porta.',
    reveal: 'Svela le masse', unreveal: 'Nascondi di nuovo', clear_w: 'Azzera le misure', mass_unknown: 'massa ignota', no_weigh: 'Nessuna misura.',
    help_html: `<h2>Come si usa</h2>
<h3>Registrare</h3><p>Premi <b>Registra</b> e trascina un carrello lungo la rotaia: se lo rilasci mentre si muove, parte con quella velocità. Oppure imposta le velocità nel pannello e premi <b>Lancia</b>.</p>
<h3>Sensori</h3><p>S1 e S2 sono agli estremi della rotaia e misurano la distanza dalla faccia del carrello più vicino. Sotto 15 cm riportano 0,15 m. La velocità si calcola dai campioni di posizione.</p>
<h3>Grafici</h3><ul><li><b>Lettura</b>: tocca per leggere i valori, con <b>B</b> misuri differenze e pendenza. La scena mostra i carrelli in quell\'istante.</li><li><b>Selezione</b>: trascina su un intervallo, poi scegli il fit (retta, parabola, costante) o ritaglia.</li><li><b>Mano</b>: sposta e ingrandisci. <b>Scala</b> adatta gli assi ai dati.</li></ul>
<h3>Montaggio</h3><p>Gira i carrelli, scambiali, aggiungi masse, scegli la molla. I magneti ai poli uguali si respingono, quelli con velcro si agganciano.</p>
<h3>Livelli</h3><p>Il pulsante in alto passa tra <b>Lettura</b>, <b>Analisi</b> e <b>Completo</b>: ogni livello mostra più strumenti. L\'indirizzo della pagina contiene il livello (per esempio <b>#livello-2</b>), così si può condividere.</p>
<h3>Trigger e bilancia</h3><p>Dal livello Analisi, in <b>Sensori</b> puoi far partire la registrazione al movimento. In <b>Montaggio</b> puoi nascondere le masse dei carrelli e misurarle con la bilancia.</p>`,
  },
  en: {
    tag: 'Launch the carts, record with the position sensors and learn to read x–t and v–t graphs.',
    lang: 'Language', theme: 'Light/dark theme', help: 'How it works', close: 'Close',
    live: 'Back to live', launch: 'Launch', fire: 'Fire', home: 'Reset', home_t: 'Put the carts back where you placed them',
    record: 'Record', stop: 'Stop', run: 'Run', example: 'Example', saved: 'Run saved',
    freq_t: 'Sampling rate', dur_t: 'Recording time', speed_t: 'Scene speed',
    tool_probe: 'Probe: tap or drag to read values', tool_select: 'Select: drag to choose an interval',
    tool_pan: 'Pan: drag to move, wheel or pinch to zoom',
    autoscale: 'Autoscale', autoscale_s: 'Scale', v_points: 'Sampled points only', v_joined: 'Joined points',
    cursor_b: 'Second cursor B: measure differences and slope', truth_t: 'Show the true motion (dashed)', truth: 'True',
    uncrop_t: 'Restore cropped data', uncrop: 'Restore',
    fit_lin: 'Linear fit', fit_quad: 'Quadratic fit', fit_const: 'Constant fit (mean)', crop_t: 'Crop to the selected interval',
    tab_graphs: 'Graphs', tab_setup: 'Setup', tab_sensors: 'Sensors', tab_data: 'Data',
    graph_empty: 'Press Record and launch a cart',
    readout_hint: 'Use the probe: tap a graph to read both sensors. The cursor also moves the carts in the scene.',
    f_spring: 'spring', f_velcro: 'velcro', f_magnet: 'magnet',
    pair_rep: 'magnetic repulsion (almost elastic)', pair_stick: 'attraction and velcro (inelastic)', pair_spring: 'spring contact',
    facing: 'Facing ends',
    g_quick: 'Quick setups', p_elastic: 'Elastic', p_sticky: 'Inelastic', p_spring: 'With spring', p_explosion: 'Explosion',
    g_carts: 'Carts', swap: 'Swap', left: 'Left', right: 'Right', flip: 'Flip',
    plunger: 'Spring plunger (A)', pl_blocked: 'Locked', pl_active: 'Active', pl_loaded: 'Loaded', level: 'Charge level',
    g_masses: 'Extra masses',
    g_launch: 'Launch speed', launch_note: 'Launch starts a recording and gives the carts these speeds (positive to the right). You can also drag a cart while recording.',
    g_rail: 'Rail', length: 'Length', tilt: 'Left foot − right foot',
    tilt_note: 'Positive: the left end is higher and the carts roll right. The drawing exaggerates the tilt ×3.',
    friction: 'Rolling friction', friction_note: 'It slows the carts with a constant force: the deceleration is μg whatever the mass. Air drag is negligible. A small tilt with tan θ = μ cancels it, but only for one direction of motion.',
    g_reference: 'Sensor reference', invert: 'Reverse', inv_on: 'positive toward the sensor', inv_off: 'positive away from the sensor',
    invert_note: 'By default each sensor measures distance from itself, so the same motion has opposite velocity signs on the two sensors.',
    g_noise: 'Noise', noise_note: 'Standard deviation of the sensor. Velocity comes from the position samples using a three-point central difference.',
    g_sensor: 'Dead zone', sensor_note: 'Below 15 cm the sensor cannot measure and reports the minimum distance, 0.15 m. If a cart leaves the rail the sensor sees the one that stayed.',
    g_runs: 'Runs', no_runs: 'No runs yet.', cropped: 'cropped', hide: 'Hide/show', delete: 'Delete',
    g_fits: 'Fits', no_fits: 'Select an interval and pick a fit on the graph. Dashed lines extend past the interval.',
    g_display: 'Display', align: 'Align starts', align_s: 'Every run starts at its first visible sample',
    vectors: 'True velocity on the carts', vectors_s: 'An arrow with the exact value in the scene', truth_full: 'True motion on the graphs', truth_s: 'Dashed under the samples',
    lvl_t: 'Feature level', lvl_1: 'Reading', lvl_2: 'Analysis', lvl_3: 'Full', lvl_word: 'Level',
    g_trigger: 'Trigger start', trig_on: 'Start on motion', trig_on_s: 'Record arms the sensors: it starts when a cart moves', trig_thr: 'Displacement threshold',
    trig_note: 'With the trigger on, Record arms the sensors and the run starts by itself when a distance changes by more than the threshold. Time t = 0 is the moment the threshold is crossed, so the first samples already show a small displacement.',
    arm: 'Arm', armed: 'Cancel', waiting: 'Waiting for motion…', graph_armed: 'Trigger armed: move a cart or press Launch', armed_toast: 'Trigger armed',
    g_scale: 'Scale', hidden_on: 'Hidden cart masses', hidden_s: 'Each cart has an unknown mass: measure it or work it out from the data', seed: 'Seed', seed_t: 'Same seed, same masses',
    weigh: 'Weigh', scale_note: 'The scale resolves 1 g and has a small uncertainty, so weigh more than once. The cart is weighed with any extra masses it carries.',
    reveal: 'Reveal masses', unreveal: 'Hide again', clear_w: 'Clear readings', mass_unknown: 'unknown mass', no_weigh: 'No readings.',
    help_html: `<h2>How it works</h2>
<h3>Recording</h3><p>Press <b>Record</b> and drag a cart along the rail: if you let go while it moves, it keeps that speed. Or set the speeds in the panel and press <b>Launch</b>.</p>
<h3>Sensors</h3><p>S1 and S2 sit at the rail ends and measure the distance to the nearest cart face. Below 15 cm they report 0.15 m. Velocity is computed from the position samples.</p>
<h3>Graphs</h3><ul><li><b>Probe</b>: tap to read values, use <b>B</b> for differences and slope. The scene shows the carts at that instant.</li><li><b>Select</b>: drag an interval, then pick a fit (line, parabola, constant) or crop.</li><li><b>Pan</b>: move and zoom. <b>Scale</b> fits the axes to the data.</li></ul>
<h3>Setup</h3><p>Flip the carts, swap them, add masses, choose the spring. Same-pole magnets repel, velcro ends stick.</p>
<h3>Levels</h3><p>The button at the top cycles <b>Reading</b>, <b>Analysis</b> and <b>Full</b>: each level shows more tools. The page address carries the level (for example <b>#level-2</b>) so it can be shared.</p>
<h3>Trigger and scale</h3><p>From the Analysis level, <b>Sensors</b> lets the run start on motion. <b>Setup</b> can hide the cart masses so you measure them with the scale.</p>`,
  },
};

let lang = 'it';
export const getLang = () => lang;
export function setLang(l) { lang = DICT[l] ? l : 'it'; }
export function t(key) {
  const v = DICT[lang][key] ?? DICT.it[key];
  if (v == null) { console.warn('missing i18n key', key); return key; }
  return v;
}
export const KEYS = DICT;
