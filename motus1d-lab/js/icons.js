/* Custom icons for ideas that have no standard symbol. 24×24, stroke = currentColor. */
const svg = (body, extra = '') => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
const CURVE = '<path d="M3 19 C8 18 11 12 21 5" />';

export const ICON = {
  tan: svg(CURVE + '<path d="M5 19.5 L21 9.5" stroke-dasharray="0" class="hl"/><circle cx="12.4" cy="13.7" r="2" class="fill"/>'),
  sec: svg(CURVE + '<path d="M5 18.6 L19 6.6" class="hl" stroke-dasharray="3 2.4"/><circle cx="6" cy="18" r="1.9" class="fill"/><circle cx="18" cy="7.4" r="1.9" class="fill"/>'),
  area: svg('<path d="M4 20 L4 15 C9 14 13 10 20 6 L20 20 Z" class="soft"/>' + '<path d="M4 15 C9 14 13 10 20 6"/><path d="M2 20 H22"/>'),
  avg: svg('<path d="M3 17 C8 16 11 11 21 5"/><path d="M4 20 V11.5 H20 V20" stroke-dasharray="3 2.2" class="hl"/><path d="M2 20 H22"/>'),
  r_true: svg('<path d="M3 20 V15 C9 14 13 10 21 6 V20 Z" class="soft"/><path d="M3 15 C9 14 13 10 21 6"/><path d="M2 20 H22"/>'),
  r_left: svg('<path d="M3 20 V16 H9 V20 M9 20 V13 H15 V20 M15 20 V9 H21 V20" class="box"/><path d="M3 16 C9 14 14 10 21 5" class="thin"/><circle cx="3" cy="16" r="1.6" class="fill"/><circle cx="9" cy="13" r="1.6" class="fill"/><circle cx="15" cy="9" r="1.6" class="fill"/>'),
  r_mid: svg('<path d="M3 20 V14.6 H9 V20 M9 20 V11.4 H15 V20 M15 20 V7 H21 V20" class="box"/><path d="M3 16 C9 14 14 10 21 5" class="thin"/><circle cx="6" cy="14.6" r="1.6" class="fill"/><circle cx="12" cy="11.4" r="1.6" class="fill"/><circle cx="18" cy="7" r="1.6" class="fill"/>'),
  r_right: svg('<path d="M3 20 V13 H9 V20 M9 20 V9 H15 V20 M15 20 V5 H21 V20" class="box"/><path d="M3 16 C9 14 14 10 21 5" class="thin"/><circle cx="9" cy="13" r="1.6" class="fill"/><circle cx="15" cy="9" r="1.6" class="fill"/><circle cx="21" cy="5" r="1.6" class="fill"/>'),
  r_trap: svg('<path d="M3 20 V16 L9 13 V20 M9 20 V13 L15 9 V20 M15 20 V9 L21 5 V20" class="box"/><circle cx="3" cy="16" r="1.6" class="fill"/><circle cx="9" cy="13" r="1.6" class="fill"/><circle cx="15" cy="9" r="1.6" class="fill"/><circle cx="21" cy="5" r="1.6" class="fill"/>'),
  j_smooth: svg('<path d="M3 17 C9 17 13 7 21 7"/><circle cx="12" cy="12" r="2.2" class="fill"/>'),
  j_acorner: svg('<path d="M3 18 C8 17 10 14 12 12 C15 10 18 9.6 21 9.4"/><circle cx="12" cy="12" r="2.2" class="fill"/>'),
  j_kink: svg('<path d="M3 18 L12 9 L21 15"/><circle cx="12" cy="9" r="2.2" class="fill"/>'),
  j_jump: svg('<path d="M3 17 L11 13 M13 9 L21 5"/><path d="M12 8 V14" stroke-dasharray="2 2"/><circle cx="11" cy="13" r="2" class="hol"/><circle cx="13" cy="9" r="2" class="fill"/>'),
  j_coll: svg('<path d="M3 6 L12 18 L21 6"/><path d="M5 20 H19" class="thin"/><circle cx="12" cy="18" r="2.2" class="fill"/>'),
  line: svg('<path d="M4 19 L20 5"/><rect x="2" y="17" width="4" height="4" class="fill"/><rect x="18" y="3" width="4" height="4" class="fill"/>'),
  para: svg('<path d="M4 20 C10 20 16 14 20 4"/><rect x="2" y="18" width="4" height="4" class="fill"/><rect x="18" y="2" width="4" height="4" class="fill"/>'),
  blend: svg('<path d="M3 18 L9.5 11.5 C11 10 13 10 14.5 11.5 L21 18" /><path d="M8 4 V7 M12 3 V7 M16 4 V7" class="thin"/>'),
  kind_u: svg('<path d="M3 20 C10 20 15 15 21 4"/><text x="3" y="10" font-size="8" font-weight="700" stroke="none" fill="currentColor">½</text>'),
  inherit: svg('<path d="M4 6 V12 C4 15 6 16 9 16 H20"/><path d="M16 12 L20 16 L16 20"/>'),
  track: svg('<path d="M2 18 H22"/><rect x="7" y="9" width="10" height="6" class="fill"/><circle cx="9.5" cy="16" r="1.6" class="fill"/><circle cx="14.5" cy="16" r="1.6" class="fill"/>')
};
