// Motore fisico 1D: due carrelli su rotaia, forze di coppia, attrito, inclinazione, deragliamento.
import { CFG, FACES } from './config.js';

const sgn = (x) => (x > 0) - (x < 0);

function makeCart(id) {
  return {
    id, x: 0.3, v: 0, base: CFG.BASE_MASS[id], flipped: false,
    plungerMode: 'active', plunger: 'active', level: 1, firing: false,
    derailed: false, dT: 0, dDir: 0, dV: 0, dX: 0,
    held: false, hx: 0, hv: 0,
  };
}

export class World {
  constructor() {
    this.L = CFG.RAIL_DEFAULT;
    this.mu = CFG.MU_DEFAULT;
    this.tiltMm = 0;                 // quota piede sinistro − piede destro (mm); > 0 spinge verso destra
    this.time = 0;
    this.carts = { A: makeCart('A'), B: makeCart('B') };
    this.order = ['A', 'B'];         // da sinistra a destra
    this.extra = { m1: null, m05: null };
    this.hideMass = false;           // le masse dei carrelli non vengono mostrate
    this.home = { A: 0.25, B: 0.65 };
    this.preset('elastic');
  }

  // ---- configurazione ----
  mass(c) {
    let m = c.base;
    if (this.extra.m1 === c.id) m += CFG.EXTRA.m1;
    if (this.extra.m05 === c.id) m += CFG.EXTRA.m05;
    return m;
  }
  faces(c) {
    const f = FACES[c.id];
    return c.flipped ? [f[1], f[0]] : [f[0], f[1]];
  }
  setBase(id, kg) { this.carts[id].base = kg; }
  slot(id) { return this.order.indexOf(id); }
  cartAt(slot) { return this.carts[this.order[slot]]; }
  sinTheta() { const dh = this.tiltMm / 1000; return dh / Math.hypot(this.L, dh); }
  cosTheta() { const dh = this.tiltMm / 1000; return this.L / Math.hypot(this.L, dh); }
  tiltDeg() { return Math.atan2(this.tiltMm / 1000, this.L) * 180 / Math.PI; }

  setRail(L) {
    this.L = L;
    for (const c of Object.values(this.carts)) {
      c.x = Math.min(Math.max(c.x, CFG.CART_LEN / 2), L - CFG.CART_LEN / 2);
      this.home[c.id] = Math.min(Math.max(this.home[c.id], CFG.CART_LEN / 2), L - CFG.CART_LEN / 2);
    }
  }
  setHome() { for (const c of Object.values(this.carts)) this.home[c.id] = c.x; }

  // Rimette i carrelli nelle posizioni di partenza, fermi, e riarma la molla.
  restore() {
    for (const c of Object.values(this.carts)) {
      c.x = this.home[c.id]; c.v = 0; c.derailed = false; c.held = false;
      c.plunger = c.plungerMode; c.firing = false;
    }
  }

  // Scambia l'ordine dei carrelli sulla rotaia (mantiene le posizioni occupate).
  swap() {
    const [l, r] = this.order.map((id) => this.carts[id]);
    const xl = this.home[l.id], xr = this.home[r.id];
    this.order = [r.id, l.id];
    this.home[r.id] = xl; this.home[l.id] = xr;
    this.restore();
  }
  flip(id) { const c = this.carts[id]; c.flipped = !c.flipped; }
  setPlunger(id, mode) { const c = this.carts[id]; c.plungerMode = mode; c.plunger = mode; c.firing = false; }
  setLevel(id, lvl) { this.carts[id].level = lvl; }
  setExtra(which, id) { this.extra[which] = id; }

  // Montaggi predefiniti, coerenti con l'attrezzatura reale.
  preset(name) {
    const A = this.carts.A, B = this.carts.B, ℓ = CFG.CART_LEN;
    this.order = ['A', 'B'];
    A.flipped = false; B.flipped = false;
    A.plungerMode = 'active'; B.plungerMode = 'active';
    A.level = 1;
    this.extra = { m1: null, m05: null };
    const L = this.L;
    this.home = { A: 0.25 * L, B: 0.65 * L };
    if (name === 'elastic') { B.flipped = true; }                 // velcro di A contro magnete liscio di B
    else if (name === 'sticky') { /* velcro contro velcro */ }
    else if (name === 'spring') { A.flipped = true; A.plungerMode = 'active'; }  // molla di A contro B
    else if (name === 'explosion') {
      A.flipped = true; A.plungerMode = 'loaded';
      this.home = { A: L / 2 - ℓ / 2, B: L / 2 + ℓ / 2 };
    }
    this.restore();
  }

  // Dice quale coppia di facce si affronta (cart sinistro, cart destro).
  pairType() {
    const [cl, cr] = [this.cartAt(0), this.cartAt(1)];
    const fl = this.faces(cl)[1], fr = this.faces(cr)[0];
    if (fl === 'spring') return { type: 'spring', plungerCart: cl.id, fl, fr };
    if (fr === 'spring') return { type: 'spring', plungerCart: cr.id, fl, fr };
    if (fl === 'velcro' && fr === 'velcro') return { type: 'stick', fl, fr };
    return { type: 'rep', fl, fr };
  }

  // ---- interazione ----
  hold(id, x) {
    const c = this.carts[id];
    c.held = true; c.hx = x; c.v = 0; c.hv = 0;
    if (c.derailed) { c.derailed = false; c.x = x; }
  }
  moveHeld(id, x) { this.carts[id].hx = x; }
  release(id, v) {
    const c = this.carts[id];
    c.held = false;
    c.v = Math.max(-CFG.V_MAX_THROW, Math.min(CFG.V_MAX_THROW, v));
  }
  launch(id, v) { const c = this.carts[id]; if (!c.derailed && !c.held) c.v = v; }
  fire(id) {
    const c = this.carts[id];
    if (c.plunger === 'loaded') { c.plunger = 'active'; c.firing = true; return true; }
    return false;
  }

  // ---- forze ----
  _contact(k, zeta, mu, g, gd) {
    if (g >= 0) return 0;
    return Math.max(0, -k * g - 2 * zeta * Math.sqrt(k * mu) * gd);
  }
  _mag(F0, d0, g) {
    const f = (gg) => F0 * Math.pow(d0 / (gg + d0), CFG.MAG_N);
    return f(Math.max(g, 0)) - f(CFG.MAG_RANGE);
  }
  // Forza sul carrello di destra (positiva = lo spinge a destra), g = distanza tra le facce.
  pairForce(cl, cr, g, gd) {
    const ml = this.mass(cl), mr = this.mass(cr), mu = ml * mr / (ml + mr);
    const pt = this.pairType();
    if (g > CFG.MAG_RANGE && pt.type !== 'spring') return 0;
    if (pt.type === 'rep') {
      return (g < CFG.MAG_RANGE ? this._mag(CFG.REP_F0, CFG.REP_D0, g) : 0)
        + this._contact(CFG.K_HARD, CFG.ZETA_HARD, mu, g, gd);
    }
    if (pt.type === 'stick') {
      return -(g < CFG.MAG_RANGE ? this._mag(CFG.ATT_F0, CFG.ATT_D0, g) : 0)
        + this._contact(CFG.K_HARD, CFG.ZETA_STICK, mu, g, gd);
    }
    const pc = this.carts[pt.plungerCart];
    if (pc.plunger === 'blocked' || pc.plunger === 'loaded') {
      return this._contact(CFG.K_HARD, CFG.ZETA_HARD, mu, g, gd);
    }
    // molla attiva
    const P0 = CFG.PLUNGER_PROT;
    if (pc.firing) {
      const Ef = CFG.FIRE_E[pc.level - 1];
      if (g >= Ef) { pc.firing = false; }
      else return CFG.K_FIRE * (Ef - Math.max(g, -0.002)) + this._contact(CFG.K_HARD, CFG.ZETA_HARD, mu, g, gd);
    }
    const gt = g - P0;
    if (gt >= 0) return 0;
    const s = -gt, c = 2 * CFG.ZETA_SPRING * Math.sqrt(CFG.K_SPRING * mu);
    let f = s <= P0 ? CFG.K_SPRING * s : CFG.K_SPRING * P0 + CFG.K_HARD * (s - P0);
    f -= c * gd;
    return Math.max(0, f);
  }

  // ---- un passo di integrazione ----
  step(dt = CFG.DT) {
    const [cl, cr] = [this.cartAt(0), this.cartAt(1)];
    const sinT = this.sinTheta(), cosT = this.cosTheta(), ℓ = CFG.CART_LEN;
    const F = { A: 0, B: 0 };
    for (const c of [cl, cr]) {
      if (c.derailed) continue;
      F[c.id] += this.mass(c) * CFG.G * sinT - CFG.AIR * c.v * Math.abs(c.v);
    }
    if (!cl.derailed && !cr.derailed) {
      const g = (cr.x - ℓ / 2) - (cl.x + ℓ / 2), gd = cr.v - cl.v;
      const f = this.pairForce(cl, cr, g, gd);
      F[cr.id] += f; F[cl.id] -= f;
    }
    for (const c of [cl, cr]) {
      if (c.derailed) continue;
      if (c.held) {
        const xOld = c.x;
        let xn = c.x + (c.hx - c.x) * (1 - Math.exp(-dt / 0.012));
        const o = c === cl ? cr : cl;
        if (!o.derailed) {   // non si può passare attraverso l'altro carrello
          if (c === cl) xn = Math.min(xn, o.x - ℓ + 0.002);
          else xn = Math.max(xn, o.x + ℓ - 0.002);
        }
        xn = Math.min(Math.max(xn, ℓ / 2), this.L - ℓ / 2);
        c.x = xn; c.hv = (xn - xOld) / dt; c.v = c.hv;
        continue;
      }
      const m = this.mass(c), Fc = this.mu * m * CFG.G * cosT, Fn = F[c.id];
      let v = c.v;
      if (Math.abs(v) < CFG.VEPS && Math.abs(Fn) <= Fc) {
        v = 0;
      } else {
        const dir = Math.abs(v) >= CFG.VEPS ? sgn(v) : sgn(Fn);
        let vn = v + (Fn - dir * Fc) / m * dt;
        if (Math.abs(v) >= CFG.VEPS && sgn(vn) !== sgn(v) && Math.abs(Fn) <= Fc) vn = 0;
        v = vn;
      }
      c.v = v;
      c.x += v * dt;
    }
    for (const c of [cl, cr]) {
      if (!c.derailed && !c.held && (c.x < 0 || c.x > this.L)) {
        c.derailed = true; c.dT = this.time; c.dDir = c.x < 0 ? -1 : 1; c.dV = c.v; c.dX = c.x;
      }
    }
    this.time += dt;
  }

  momentum() { let p = 0; for (const c of Object.values(this.carts)) if (!c.derailed) p += this.mass(c) * c.v; return p; }
  kinetic() { let k = 0; for (const c of Object.values(this.carts)) if (!c.derailed) k += 0.5 * this.mass(c) * c.v * c.v; return k; }
}
