/* grab.js — presa con una o due mani/controller su oggetti scelti da una funzione pick(pos).
   Gli oggetti possono essere figli di gruppi trasformati: si lavora in posa mondiale e si riconverte in locale. */
(function (root) {
  'use strict';

  // Isteresi: si attiva sotto "on", si rilascia sopra "off" (metri). Evita sfarfallii.
  function pinchUpdate(prev, dist, on, off) {
    on = on === undefined ? 0.022 : on;
    off = off === undefined ? 0.035 : off;
    return prev ? dist < off : dist < on;
  }

  // obj.userData.grab = { scalable: bool, min, max }  (limiti sulla scala LOCALE, uniforme)
  function GrabController(THREE, opts) {
    opts = opts || {};
    this.T = THREE;
    this.smooth = opts.smooth === undefined ? 28 : opts.smooth; // 1/s: più alto = meno ritardo, più tremolio
    this.s = {};
    this.holding = [];
    this.anchor = null;
    this.target = null;
  }

  GrabController.prototype._world = function (obj) {
    const T = this.T;
    obj.updateWorldMatrix(true, false);
    const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    obj.matrixWorld.decompose(p, q, s);
    return { pos: p, quat: q, scale: s.x };
  };

  GrabController.prototype._parentScale = function (obj) {
    if (!obj.parent) return 1;
    obj.parent.updateWorldMatrix(true, false);
    return obj.parent.matrixWorld.getMaxScaleOnAxis();
  };

  GrabController.prototype._setWorld = function (obj, pos, quat, scale) {
    const T = this.T;
    const M = new T.Matrix4().compose(pos, quat, new T.Vector3(scale, scale, scale));
    if (obj.parent) {
      obj.parent.updateWorldMatrix(true, false);
      M.premultiply(new T.Matrix4().copy(obj.parent.matrixWorld).invert());
    }
    M.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrix();
  };

  GrabController.prototype.update = function (sources, dt, pick) {
    const T = this.T;
    const a = 1 - Math.exp(-this.smooth * dt);
    const seen = {};

    for (const src of sources) {
      seen[src.id] = true;
      let st = this.s[src.id];
      if (!st) st = this.s[src.id] = { pinch: false, just: false, grab: false, pos: new T.Vector3(), quat: new T.Quaternion() };
      if (src.active && src.pinching) {
        if (!st.pinch) { st.pos.copy(src.pos); st.quat.copy(src.quat); st.pinch = true; st.just = true; st.grab = false; }
        else { st.pos.lerp(src.pos, a); st.quat.slerp(src.quat, a); st.just = false; }
      } else { st.pinch = false; st.just = false; st.grab = false; }
    }
    for (const id in this.s) if (!seen[id]) { const st = this.s[id]; st.pinch = false; st.just = false; st.grab = false; }

    let changed = false;
    const before = this.holding.length;
    this.holding = this.holding.filter(id => this.s[id].pinch);
    if (this.holding.length !== before) changed = true;
    if (this.holding.length === 0) this.target = null;

    // 1) chi inizia a pinzare vicino a un oggetto lo afferra
    for (const id in this.s) {
      const st = this.s[id];
      if (st.just && !st.grab && this.holding.length < 2 && !this.target) {
        const hit = pick ? pick(st.pos) : null;
        if (hit) { st.grab = true; this.holding.push(id); this.target = hit; changed = true; }
      }
    }
    // 2) la seconda mano può pinzare ovunque per scalare / ruotare lo stesso oggetto
    if (this.holding.length === 1 && this.target) {
      for (const id in this.s) {
        const st = this.s[id];
        if (st.just && !st.grab && this.holding.length < 2) { st.grab = true; this.holding.push(id); changed = true; }
      }
    }

    if (changed) this.anchor = this._makeAnchor();
    if (this.target && this.holding.length === 1) this._applyOne();
    else if (this.target && this.holding.length === 2) this._applyTwo();
  };

  GrabController.prototype._makeAnchor = function () {
    const obj = this.target;
    if (!obj) return null;
    const w = this._world(obj);
    if (this.holding.length === 1) {
      const st = this.s[this.holding[0]];
      const inv = st.quat.clone().conjugate();
      return { off: w.pos.clone().sub(st.pos).applyQuaternion(inv), rel: inv.clone().multiply(w.quat), scale: w.scale };
    }
    if (this.holding.length === 2) {
      const A = this.s[this.holding[0]], B = this.s[this.holding[1]];
      const v0 = B.pos.clone().sub(A.pos);
      return { v0: v0, d0: v0.length(), mid0: A.pos.clone().add(B.pos).multiplyScalar(0.5),
               pos0: w.pos, quat0: w.quat, s0: w.scale, ps: this._parentScale(obj) };
    }
    return null;
  };

  GrabController.prototype._applyOne = function () {
    const st = this.s[this.holding[0]], an = this.anchor, obj = this.target;
    const quat = st.quat.clone().multiply(an.rel);
    const pos = an.off.clone().applyQuaternion(st.quat).add(st.pos);
    this._setWorld(obj, pos, quat, an.scale);
  };

  GrabController.prototype._applyTwo = function () {
    const T = this.T, obj = this.target, an = this.anchor;
    const A = this.s[this.holding[0]], B = this.s[this.holding[1]];
    const v = B.pos.clone().sub(A.pos), d = v.length();
    const mid = A.pos.clone().add(B.pos).multiplyScalar(0.5);
    if (an.d0 < 0.03 || d < 1e-6) return;
    const cfg = obj.userData.grab || {};
    let s = an.s0;
    if (cfg.scalable !== false) {
      s = an.s0 * (d / an.d0);
      const lo = (cfg.min || 0.001) * an.ps, hi = (cfg.max || 1e3) * an.ps; // limiti locali → mondiali
      s = Math.min(hi, Math.max(lo, s));
    }
    const ratio = s / an.s0;
    const q = new T.Quaternion().setFromUnitVectors(an.v0.clone().normalize(), v.clone().normalize());
    const quat = q.clone().multiply(an.quat0);
    const pos = an.pos0.clone().sub(an.mid0).applyQuaternion(q).multiplyScalar(ratio).add(mid);
    this._setWorld(obj, pos, quat, s);
  };

  const api = { GrabController: GrabController, pinchUpdate: pinchUpdate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Grab = api;
})(typeof window !== 'undefined' ? window : globalThis);
