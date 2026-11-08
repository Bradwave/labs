/* Levels are named sets of features. A shared link can set a level and lock it. */
export const ALL = ['gV', 'gA', 'tan', 'sec', 'areaV', 'areaA', 'avg', 'riemann',
  'kS', 'kV', 'kA', 'kU', 'uA', 'multi', 'joints', 'params', 'tau', 'drag', 'chal', 'draw', 'frame', 'vert', 'pred', 'diagram', 'ff', 'two', 'export'];

const L1 = ['kS', 'kU', 'sec', 'params', 'drag', 'chal', 'draw', 'frame', 'vert', 'pred', 'export'];
const L2 = [...L1, 'gV', 'tan', 'areaV', 'avg', 'kV', 'multi', 'diagram', 'two'];
const L3 = [...L2, 'gA', 'areaA', 'kA', 'uA', 'joints', 'ff'];
const L4 = ALL;
export const LEVELS = { 1: L1, 2: L2, 3: L3, 4: L4 };
export const featsFor = lvl => new Set(LEVELS[lvl] || L4);

/* what a set of sections needs in order to be shown */
export function needs(secs) {
  const n = new Set();
  for (const s of secs) {
    n.add({ s: 'kS', v: 'kV', a: 'kA', u: 'kU' }[s.kind]);
    if (s.kind === 'u' && String(s.a).trim() !== '0') n.add('uA');
  }
  if (secs.length > 1) n.add('multi');
  return n;
}

/* the authoring view lists features in these groups (labels are ft_<key>) */
export const FEAT_GROUPS = [
  ['fg_graphs', ['gV', 'gA']],
  ['fg_input', ['kS', 'kU', 'uA', 'kV', 'kA', 'multi', 'params', 'tau', 'draw', 'drag', 'chal']],
  ['fg_tools', ['tan', 'sec', 'areaV', 'areaA', 'avg', 'riemann', 'pred', 'diagram', 'joints']],
  ['fg_scene', ['frame', 'vert', 'ff', 'two', 'export']]
];
