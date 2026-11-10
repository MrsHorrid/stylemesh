// Shape helpers. Every function returns a THREE.BufferGeometry in place (already transformed).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getStyle } from './styles.js';

/** scale a segment count by the active style's detail level */
const S = (n, min = 3) => Math.max(min, Math.round(n * (getStyle().seg ?? 1)));
const B = (r) => r * (getStyle().bevel ?? 1);

const V = (a) => (a instanceof THREE.Vector3 ? a : new THREE.Vector3(...a));
const D = Math.PI / 180;

/** apply position / rotation (degrees XYZ) / scale */
export function at(g, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(V(p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * D, r[1] * D, r[2] * D)),
    V(typeof s === 'number' ? [s, s, s] : s));
  g.applyMatrix4(m);
  return g;
}

/** loft elliptical rings along a polyline. radii[i] = r or [side, up]. UV: u around (0.25 = top, 0.75 = belly), v along. */
export function tube(pts, radii, { n = 14, caps = true } = {}) {
  n = S(n, 4);
  const P = pts.map(V);
  const pos = [], uv = [], idx = [];
  const acc = [0];
  for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = acc[acc.length - 1] || 1;
  for (let i = 0; i < P.length; i++) {
    const t = (i === 0 ? P[1].clone().sub(P[0]) : i === P.length - 1 ? P[i].clone().sub(P[i - 1]) : P[i + 1].clone().sub(P[i - 1])).normalize();
    const U = Math.abs(t.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(t, U).normalize();
    const up = new THREE.Vector3().crossVectors(side, t).normalize();
    const r = radii[i];
    const [a, b] = Array.isArray(r) ? r : [r, r];
    for (let k = 0; k <= n; k++) {
      const ang = (2 * Math.PI * k) / n;
      const q = P[i].clone().addScaledVector(side, a * Math.cos(ang)).addScaledVector(up, b * Math.sin(ang));
      pos.push(q.x, q.y, q.z);
      uv.push(k / n, acc[i] / total);
    }
  }
  const R = n + 1;
  for (let i = 0; i < P.length - 1; i++)
    for (let k = 0; k < n; k++) {
      const a = i * R + k, b = a + 1, c = a + R, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  if (caps) {
    const c0 = pos.length / 3; pos.push(...P[0].toArray()); uv.push(0.5, 0);
    const c1 = pos.length / 3; pos.push(...P[P.length - 1].toArray()); uv.push(0.5, 1);
    const last = (P.length - 1) * R;
    for (let k = 0; k < n; k++) { idx.push(c0, k + 1, k); idx.push(c1, last + k, last + k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** fish-style body: prof = [[x, sideR, upR, yOffset], ...] */
export function body(prof, opts) {
  return tube(prof.map(([x, , , y]) => [x, y, 0]), prof.map(([, a, b]) => [a, b]), opts);
}

export function sphere(r, { p, s, seg = 18, rings = 12 } = {}) {
  return at(new THREE.SphereGeometry(r, S(seg, 5), S(rings, 3)), { p, s });
}

export function rbox(w, h, d, radius = 0.08, opts = {}) {
  return at(new RoundedBoxGeometry(w, h, d, S(3, 1), Math.min(B(radius), Math.min(w, h, d) / 2 - 1e-3)), opts);
}

/** cylinder between two points (rTop at b). */
export function cylBetween(a, b, r, rTop = r, seg = 14) {
  a = V(a); b = V(b);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rTop, r, len, S(seg, 4), 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export function cone(a, b, r, seg = 10) { return cylBetween(a, b, r, 0.0005, seg); }

/** soft rounded cylinder (lathe with bevelled edges), axis Y, base at y=0 */
export function rcyl(r, h, bevel = 0.05, seg = 20, opts = {}) {
  const b = Math.min(B(bevel), r / 2, h / 2);
  const pts = [[0, 0], [r - b, 0], [r - b * 0.3, b * 0.3], [r, b], [r, h - b], [r - b * 0.3, h - b * 0.3], [r - b, h], [0, h]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return at(new THREE.LatheGeometry(pts, S(seg, 5)), opts);
}

export function lathe(profile, seg = 20, opts = {}) {
  return at(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), S(seg, 5)), opts);
}

/** rounded extruded flat shape (fins, tails, signs). pts in XY plane, extruded along Z, centred. */
export function fin(pts, depth = 0.03, opts = {}) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const bev = Math.min(depth * 0.6, 0.02);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: S(2, 1), curveSegments: S(6, 2) });
  g.translate(0, 0, -depth / 2);
  // normalise UVs to 0..1 over the shape bounds so painted textures map nicely
  g.computeBoundingBox();
  const bb = g.boundingBox, uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  return at(g, opts);
}

/** smooth closed curve fin from control points (catmull-rom), nicer silhouettes */
export function smoothFin(ctrl, depth = 0.03, opts = {}, samples = 28) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return fin(curve.getPoints(S(samples, 6)).map((v) => [v.x, v.y]), depth, opts);
}

/** faceted pine tier stack (like the shorts' trees) */
export function pineTiers(h, r, tiers = 3, seg = 7) {
  const gs = [];
  for (let i = 0; i < tiers; i++) {
    const y0 = h * 0.25 + i * (h * 0.75 / tiers) * 0.8;
    const rr = r * (1 - i * 0.25);
    const g = new THREE.ConeGeometry(rr, h * 0.45, S(seg, 4), 1);
    g.translate(0, y0 + h * 0.225, 0);
    gs.push(g);
  }
  return gs;
}
