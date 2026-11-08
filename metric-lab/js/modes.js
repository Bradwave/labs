/* Schede aggiuntive: previsione, distanza tra insiemi, Voronoi, verifica degli assiomi.
   Ogni scheda e' un oggetto { init, handles, draw, update, wire, tap } che riceve `api` da main.js. */
(function (root) {
  'use strict';
  const DL = (root.DL = root.DL || {});
  const modes = (DL.modes = {});
  const hypot = Math.hypot;
  const hex = h => { const v = parseInt(String(h).replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const mark = (api, el, on) => el.setAttribute('aria-pressed', String(on));

  /* ===================== PREVISIONE: prevedi, discuti, confronta ===================== */
  modes.pred = {
    init(S) { S.pred = { kind: 'axis', pts: [], stage: 'predict' }; },
    kinds: ['axis', 'circle', 'geo'],
    handles(api) { return [{ k: 'A', p: api.S.A }, { k: 'B', p: api.S.B }]; },
    field(api) {
      const S = api.S, m = api.met(), A = S.A, B = S.B;
      if (S.pred.kind === 'axis') return (x, y) => m.dist(x, y, A.x, A.y) - m.dist(x, y, B.x, B.y);
      if (S.pred.kind === 'circle') { const r = m.dist(A.x, A.y, B.x, B.y); return (x, y) => m.dist(x, y, A.x, A.y) - r; }
      return api.PA.excessField(m, A, B);
    },
    tap(api, x, y) {
      const P = api.S.pred; if (P.stage !== 'predict') return false;
      P.pts.push({ x: api.snapV(x), y: api.snapV(y) }); api.dirty(); return true;
    },
    draw(api) {
      const S = api.S, P = S.pred, m = api.met(), col = api.C[S.metric], A = S.A, B = S.B, FD = api.FD, PA = api.PA, ctx = api.ctx;
      const F = this.field(api);
      if (P.stage === 'reveal') {
        const cell = api.cellSize();
        if (P.kind !== 'geo') api.drawFields([F], col, cell);
        else if (m.disc) { const a = api.toPx(A), b = api.toPx(B); ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore(); }
        else if (m.strict || m.id === 'sncf') for (const e of PA.extremes(m, A, B)) api.polyline(e, col, 5);
        else {
          const g = FD.sample(F, S.view, api.W, api.H, cell), gh = FD.map(g, v => v - 0.75 * cell / S.view.s);
          api.fillShapes(FD.fillShapes(gh, 0), col, 0.24); api.strokeSegs(FD.contours(gh, 0), col, 2.6, 1);
        }
      }
      const tol = Math.max(0.3, 6 / S.view.s);
      P.pts.forEach(p => {
        const q = api.toPx(p);
        ctx.save();
        if (P.stage === 'reveal') {
          const ok = Math.abs(F(p.x, p.y)) <= tol;
          if (ok) { ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 6.2832); ctx.fillStyle = api.C.good; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = api.C.bg; ctx.stroke(); }
          else {
            ctx.strokeStyle = api.C.bad; ctx.lineWidth = 3.2; ctx.beginPath();
            ctx.moveTo(q[0] - 6, q[1] - 6); ctx.lineTo(q[0] + 6, q[1] + 6); ctx.moveTo(q[0] + 6, q[1] - 6); ctx.lineTo(q[0] - 6, q[1] + 6); ctx.stroke();
          }
        } else { ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, 6.2832); ctx.fillStyle = api.C.acc; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = api.C.ink; ctx.stroke(); }
        ctx.restore();
      });
      S.status = P.stage === 'predict' ? api.t('pr.tapmsg') : '';
    },
    update(api) {
      const S = api.S, P = S.pred, m = api.met();
      document.querySelectorAll('#prKind button').forEach(b => mark(api, b, b.dataset.kind === P.kind));
      const q = api.$('#prQ'); q.textContent = api.t('pr.q.' + P.kind); q.style.setProperty('--c', `var(--m-${S.metric})`);
      api.$('#prRevealT').textContent = api.t(P.stage === 'predict' ? 'pr.reveal' : 'pr.hide');
      api.$('#prDisc').hidden = P.stage !== 'reveal';
      const d = m.dist(S.A.x, S.A.y, S.B.x, S.B.y);
      api.$('#prOut').innerHTML = `${api.t('pr.points')}: <b>${P.pts.length}</b><br>d(A,B) = <b>${api.fmt(d)}</b>` + (P.kind === 'circle' ? ` = r` : '');
      api.$('#prUndo').disabled = !P.pts.length;
    },
    wire(api) {
      const S = api.S, P = () => S.pred;
      const box = api.$('#prKind');
      for (const k of this.kinds) {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.kind = k; b.textContent = api.t('pr.k.' + k);
        b.addEventListener('click', () => { P().kind = k; P().pts = []; P().stage = 'predict'; api.dirty(); });
        box.appendChild(b);
      }
      api.$('#prReveal').addEventListener('click', () => { P().stage = P().stage === 'predict' ? 'reveal' : 'predict'; api.dirty(); });
      api.$('#prUndo').addEventListener('click', () => { P().pts.pop(); api.dirty(); });
      api.$('#prClear').addEventListener('click', () => { P().pts = []; P().stage = 'predict'; api.dirty(); });
      api.$('#prNew').addEventListener('click', () => {
        const r = () => api.snapV((Math.random() - 0.5) * 12);
        let a, b; do { a = { x: r(), y: r() }; b = { x: r(), y: r() }; } while (Math.hypot(a.x - b.x, a.y - b.y) < 3);
        Object.assign(S.A, a); Object.assign(S.B, b); P().pts = []; P().stage = 'predict'; api.dirty();
      });
    },
    relabel(api) { document.querySelectorAll('#prKind button').forEach(b => { b.textContent = api.t('pr.k.' + b.dataset.kind); }); }
  };

  /* ===================== INSIEMI: distanza e distanza di Hausdorff ===================== */
  const SET_TYPES = ['point', 'segment', 'circle', 'disc'];
  function sampleSet(m, s, N) {
    const xs = [], ys = [], p = s.p, q = s.q;
    if (s.type === 'point') return { xs: [p.x], ys: [p.y], ring: [] };
    if (s.type === 'segment') { for (let i = 0; i < N; i++) { const t = i / (N - 1); xs.push(p.x + t * (q.x - p.x)); ys.push(p.y + t * (q.y - p.y)); } return { xs, ys, ring: [] }; }
    const r = m.norm ? m.dist(p.x, p.y, q.x, q.y) : hypot(q.x - p.x, q.y - p.y), ring = [];
    const dirs = (n, rr, push) => {
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * i / n, ux = Math.cos(a), uy = Math.sin(a), nr = m.norm ? m.dist(0, 0, ux, uy) : 1;
        push(p.x + rr * ux / nr, p.y + rr * uy / nr);
      }
    };
    dirs(N, r, (x, y) => { xs.push(x); ys.push(y); ring.push([x, y]); });
    if (s.type === 'disc') for (let k = 1; k < 6; k++) dirs(Math.max(8, Math.round(N * k / 6 / 2)), r * k / 6, (x, y) => { xs.push(x); ys.push(y); });
    return { xs, ys, ring };
  }
  function setDist(m, a, b) {
    const na = a.xs.length, nb = b.xs.length, dA = new Float64Array(na).fill(Infinity), dB = new Float64Array(nb).fill(Infinity), gA = new Int32Array(na), gB = new Int32Array(nb);
    let dmin = Infinity, ia = 0, ib = 0;
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
      const d = m.dist(a.xs[i], a.ys[i], b.xs[j], b.ys[j]);
      if (d < dmin) { dmin = d; ia = i; ib = j; }
      if (d < dA[i]) { dA[i] = d; gA[i] = j; }
      if (d < dB[j]) { dB[j] = d; gB[j] = i; }
    }
    let hA = -1, iA = 0, hB = -1, iB = 0;
    for (let i = 0; i < na; i++) if (dA[i] > hA) { hA = dA[i]; iA = i; }
    for (let j = 0; j < nb; j++) if (dB[j] > hB) { hB = dB[j]; iB = j; }
    return { d: dmin, ia, ib, hA, iA, jA: gA[iA], hB, iB, iBa: gB[iB], H: Math.max(hA, hB) };
  }
  modes.sets = {
    init(S) { S.sets = { X: { type: 'segment', p: { x: -6, y: 2 }, q: { x: -2, y: 4 } }, Y: { type: 'circle', p: { x: 3, y: -2 }, q: { x: 6, y: -2 } } }; },
    handles(api) {
      const hs = [];
      for (const k of ['X', 'Y']) { const s = api.S.sets[k]; hs.push({ k: k + '1', p: s.p, lab: k + '1' }); if (s.type !== 'point') hs.push({ k: k + '2', p: s.q, lab: k + '2' }); }
      return hs;
    },
    draw(api) {
      const S = api.S, ctx = api.ctx, N = S.dragging ? 70 : 150, cur = api.met(), res = {};
      for (const id of api.IDS) {
        const m = api.mk(id, S.p), a = sampleSet(m, S.sets.X, N), b = sampleSet(m, S.sets.Y, N);
        res[id] = { r: setDist(m, a, b), a, b };
      }
      S.setsRes = res;
      const R = res[S.metric], colX = api.C.acc, colY = api.C.ink;
      const shape = (smp, s, col) => {
        ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        const P = s.p, Q = s.q;
        if (s.type === 'segment') { const a = api.toPx(P), b = api.toPx(Q); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        else if (s.type === 'point') { const a = api.toPx(P); ctx.beginPath(); ctx.arc(a[0], a[1], 5, 0, 6.2832); ctx.fill(); }
        else {
          ctx.beginPath(); smp.ring.forEach((r, i) => { const q = api.toPx({ x: r[0], y: r[1] }); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
          if (s.type === 'disc') { ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; } ctx.stroke();
        }
        ctx.restore();
      };
      shape(R.a, S.sets.X, colX); shape(R.b, S.sets.Y, colY);
      const r = R.r, ln = (x1, y1, x2, y2, col, lw, dash) => {
        const a = api.toPx({ x: x1, y: y1 }), b = api.toPx({ x: x2, y: y2 });
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      };
      // coppia di Hausdorff: il punto piu' lontano dall'altro insieme e il suo punto piu' vicino
      let hx1, hy1, hx2, hy2;
      if (r.hA >= r.hB) { hx1 = R.a.xs[r.iA]; hy1 = R.a.ys[r.iA]; hx2 = R.b.xs[r.jA]; hy2 = R.b.ys[r.jA]; }
      else { hx1 = R.b.xs[r.iB]; hy1 = R.b.ys[r.iB]; hx2 = R.a.xs[r.iBa]; hy2 = R.a.ys[r.iBa]; }
      const mh = ln(hx1, hy1, hx2, hy2, api.C.acc, 2.2, [3, 4]);
      api.dot({ x: hx1, y: hy1 }, 5, api.C.acc, api.C.bg);
      api.label('dH = ' + api.fmt(r.H, 2), mh[0] + 8, mh[1] - 8, api.C.acc, 'left');
      const x1 = R.a.xs[r.ia], y1 = R.a.ys[r.ia], x2 = R.b.xs[r.ib], y2 = R.b.ys[r.ib];
      const md = ln(x1, y1, x2, y2, api.C[S.metric], 3.2);
      api.dot({ x: x1, y: y1 }, 4.5, api.C[S.metric], api.C.bg); api.dot({ x: x2, y: y2 }, 4.5, api.C[S.metric], api.C.bg);
      api.label('d = ' + api.fmt(r.d, 2), md[0] + 8, md[1] + 12, api.C[S.metric], 'left');
      S.status = '';
    },
    update(api) {
      const S = api.S, res = S.setsRes; if (!res) return;
      for (const k of ['X', 'Y']) document.querySelectorAll('#st' + k + ' button').forEach(b => mark(api, b, b.dataset.type === S.sets[k].type));
      const box = api.$('#stTable'); box.textContent = '';
      for (const id of api.IDS) {
        const row = document.createElement('div'); row.className = 'drow'; row.style.setProperty('--c', `var(--m-${id})`);
        row.style.gridTemplateColumns = 'minmax(0,1fr) auto auto'; row.style.cursor = 'default'; row.dataset.off = String(id !== S.metric);
        row.innerHTML = '<div class="dname"></div><span class="dval"></span><span class="dval"></span>';
        row.firstChild.textContent = api.t('m.' + id);
        row.children[1].textContent = api.fmt(res[id].r.d, 2); row.children[2].textContent = api.fmt(res[id].r.H, 2);
        box.appendChild(row);
      }
      const r = res[S.metric].r;
      api.$('#stOut').innerHTML = `d(X,Y) = inf d(x,y) = <b>${api.fmt(r.d)}</b><br>sup<sub>x</sub> d(x,Y) = <b>${api.fmt(r.hA)}</b><br>sup<sub>y</sub> d(y,X) = <b>${api.fmt(r.hB)}</b><br>d<sub>H</sub> = max = <b>${api.fmt(r.H)}</b>`;
    },
    wire(api) {
      const S = api.S;
      for (const k of ['X', 'Y']) {
        const box = api.$('#st' + k);
        for (const ty of SET_TYPES) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.type = ty; b.textContent = api.t('st.' + ty);
          b.addEventListener('click', () => { S.sets[k].type = ty; api.dirty(); });
          box.appendChild(b);
        }
      }
    },
    relabel(api) { for (const k of ['X', 'Y']) document.querySelectorAll('#st' + k + ' button').forEach(b => { b.textContent = api.t('st.' + b.dataset.type); }); }
  };

  /* ===================== VORONOI ===================== */
  const VCOL = ['#E8456B', '#2F6BFF', '#17B26A', '#F5A623', '#9B51E0', '#00B8D9', '#FF7A45', '#8C9A1E'];
  const off = document.createElement('canvas');
  modes.vor = {
    init(S) { S.vor = { sites: [{ x: -5, y: 3 }, { x: 4, y: 4 }, { x: -2, y: -4 }, { x: 5, y: -2 }], tie: true }; },
    handles(api) { return api.S.vor.sites.map((p, i) => ({ k: String(i + 1), p, lab: String(i + 1), fill: VCOL[i % VCOL.length] })); },
    draw(api) {
      const S = api.S, V = S.vor, m = api.met(), W = api.W, H = api.H, sites = V.sites, v = S.view;
      S.status = '';
      if (!sites.length) return;
      let c = S.dragging ? 8 : 4; while ((W / c) * (H / c) > 70000) c++;
      const nx = Math.ceil(W / c), ny = Math.ceil(H / c);
      off.width = nx; off.height = ny;
      const o = off.getContext('2d'), img = o.createImageData(nx, ny), ink = hex(api.C.ink), cols = VCOL.map(hex);
      let ties = 0;
      for (let j = 0; j < ny; j++) {
        const y = (v.cy - (j * c + c / 2)) / v.s;
        for (let i = 0; i < nx; i++) {
          const x = (i * c + c / 2 - v.cx) / v.s;
          let b = Infinity, b2 = Infinity, bi = 0;
          for (let k = 0; k < sites.length; k++) {
            const d = m.dist(x, y, sites[k].x, sites[k].y);
            if (d < b) { b2 = b; b = d; bi = k; } else if (d < b2) b2 = d;
          }
          const o4 = (j * nx + i) * 4, tie = b2 - b <= 1e-9 * (1 + b);
          if (tie && sites.length > 1) { ties++; const a = V.tie ? (((i + j) & 1) ? 190 : 70) : 0; img.data[o4] = ink[0]; img.data[o4 + 1] = ink[1]; img.data[o4 + 2] = ink[2]; img.data[o4 + 3] = a; }
          else { const cc = cols[bi % cols.length]; img.data[o4] = cc[0]; img.data[o4 + 1] = cc[1]; img.data[o4 + 2] = cc[2]; img.data[o4 + 3] = 105; }
        }
      }
      o.putImageData(img, 0, 0);
      api.ctx.save(); api.ctx.imageSmoothingEnabled = false; api.ctx.drawImage(off, 0, 0, nx * c, ny * c); api.ctx.restore();
      S.vorTies = ties;
    },
    update(api) {
      const S = api.S, V = S.vor;
      api.$('#vTie').checked = V.tie;
      api.$('#vAdd').disabled = V.sites.length >= 8; api.$('#vDel').disabled = V.sites.length <= 1;
      api.$('#vOut').innerHTML = `${api.t('vor.sites')}: <b>${V.sites.length}</b>` + (S.vorTies > 6 && V.sites.length > 1 ? `<br>${api.t('vor.tienote')}` : '');
    },
    wire(api) {
      const S = api.S, V = () => S.vor;
      api.$('#vAdd').addEventListener('click', () => {
        const wc = api.toW(api.W / 2, api.H / 2), r = () => (Math.random() - 0.5) * 12;
        V().sites.push({ x: api.snapV(wc.x + r()), y: api.snapV(wc.y + r()) }); api.dirty();
      });
      api.$('#vDel').addEventListener('click', () => { V().sites.pop(); api.dirty(); });
      api.$('#vRand').addEventListener('click', () => { const r = () => api.snapV((Math.random() - 0.5) * 14); V().sites.forEach(p => { p.x = r(); p.y = r(); }); api.dirty(); });
      api.$('#vTie').addEventListener('change', e => { V().tie = e.target.checked; api.dirty(); });
    }
  };

  /* ===================== ASSIOMI ===================== */
  const AXK = ['nonneg', 'ident', 'sym', 'tri'];
  modes.ax = {
    init(S) { S.ax = { fn: 'cur', show: null, key: '', res: null }; },
    handles() { return []; },
    compute(api) {
      const S = api.S, A = S.ax, m = api.met();
      const key = [A.fn, S.metric, S.p, S.n, S.H.x, S.H.y].join('|');
      if (key === A.key) return;
      A.key = key;
      const dist = A.fn === 'cur' ? m.dist : DL.axioms.BROKEN[A.fn];
      A.res = DL.axioms.check(dist, 5); A.dist = dist;
      if (!A.show || (A.res[A.show] && A.res[A.show].ok)) A.show = AXK.find(k => !A.res[k].ok) || null;
    },
    draw(api) {
      this.compute(api);
      const S = api.S, A = S.ax, res = A.res; S.status = '';
      const e = A.show && res[A.show] && !res[A.show].ok ? res[A.show].ex : null; if (!e) return;
      const ctx = api.ctx, col = api.C.bad, pts = [['A', e.A], ['B', e.B]]; if (e.C) pts.push(['C', e.C]);
      const seg = (p, q, text) => {
        const a = api.toPx(p), b = api.toPx(q);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
        api.label(text, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10, col, 'center');
      };
      if (e.C) { seg(e.A, e.B, api.fmt(e.ab, 2)); seg(e.B, e.C, api.fmt(e.bc, 2)); seg(e.A, e.C, api.fmt(e.ac, 2)); }
      else if (e.same) { /* d(A,A) != 0: solo il punto */ }
      else seg(e.A, e.B, e.ba !== undefined ? `${api.fmt(e.ab, 2)} / ${api.fmt(e.ba, 2)}` : api.fmt(e.ab, 2));
      pts.forEach(([k, p]) => { api.dot(p, 7, col, api.C.bg); const q = api.toPx(p); api.label(k + ' (' + api.fmt(p.x, 1) + '; ' + api.fmt(p.y, 1) + ')', q[0] + 10, q[1] - 12, api.C.ink, 'left'); });
    },
    update(api) {
      this.compute(api);
      const S = api.S, A = S.ax, res = A.res;
      document.querySelectorAll('#axFn button').forEach(b => mark(api, b, b.dataset.fn === A.fn));
      const box = api.$('#axOut'); box.textContent = '';
      for (const k of AXK) {
        const r = res[k], row = document.createElement('button'); row.type = 'button'; row.className = 'drow';
        row.style.setProperty('--c', r.ok ? 'var(--good)' : 'var(--bad)'); row.style.textAlign = 'left'; row.style.background = 'transparent'; row.style.width = '100%';
        row.style.border = '0'; row.style.borderLeft = '8px solid var(--c)'; row.style.borderBottom = '1.5px dashed var(--line)';
        let ex = api.t('ax.ok');
        if (!r.ok) {
          const e = r.ex;
          if (k === 'tri') ex = `d(A,C) = ${api.fmt(e.ac)} > ${api.fmt(e.ab)} + ${api.fmt(e.bc)} = ${api.fmt(e.ab + e.bc)}`;
          else if (k === 'sym') ex = `d(A,B) = ${api.fmt(e.ab)} ≠ d(B,A) = ${api.fmt(e.ba)}`;
          else if (k === 'ident') ex = e.same ? `d(A,A) = ${api.fmt(e.ab)}` : `d(A,B) = ${api.fmt(e.ab)}, A ≠ B`;
          else ex = `d(A,B) = ${api.fmt(e.ab)}`;
        }
        row.innerHTML = '<span class="dval"></span><div><div class="dname"></div><div class="dform"></div></div><span></span>';
        row.children[0].textContent = r.ok ? '✓' : '✗'; row.children[0].style.color = r.ok ? 'var(--good)' : 'var(--bad)';
        row.querySelector('.dname').textContent = api.t('ax.' + k); row.querySelector('.dform').textContent = ex;
        if (!r.ok) { row.style.cursor = 'pointer'; if (A.show === k) row.style.background = 'color-mix(in srgb, var(--bad) 14%, var(--surface))'; row.addEventListener('click', () => { A.show = k; api.dirty(); }); }
        else row.style.cursor = 'default';
        box.appendChild(row);
      }
      const ok = AXK.every(k => res[k].ok);
      api.$('#axVerdict').innerHTML = ok ? `<span class="ok">${api.t('ax.metric')}</span>` : `<span class="no">${api.t('ax.notmetric')}</span>`;
    },
    wire(api) {
      const S = api.S, box = api.$('#axFn');
      const ids = ['cur'].concat(DL.BROKEN_IDS);
      for (const id of ids) {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.fn = id; b.textContent = api.t('ax.fn.' + id);
        b.addEventListener('click', () => { S.ax.fn = id; S.ax.key = ''; S.ax.show = null; api.dirty(); });
        box.appendChild(b);
      }
    },
    relabel(api) { document.querySelectorAll('#axFn button').forEach(b => { b.textContent = api.t('ax.fn.' + b.dataset.fn); }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
