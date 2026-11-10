// World props in the shorts' style: chunky, rounded, painted, outlined. Y up, front = +X.
import * as THREE from 'three';
import { Asset } from '../../lib/core.js';
import { rbox, rcyl, cylBetween, cone, sphere, tube, fin, smoothFin, lathe, pineTiers, at } from '../../lib/shapes.js';
import { solid, woodPlanks, stripes, sandSpeckle, sign } from '../../lib/paint.js';

export function fishingRod() {
  const a = new Asset('Prop_FishingRod', { outline: 0.012, meta: { kind: 'tool' } });
  a.material('Grip', { paint: stripes('#6b3f22', '#4a2a16', 10) });
  a.material('Pole', { paint: solid('#f2e8cf') });
  a.material('Reel', { paint: solid('#e63946') });
  a.material('Metal', { paint: solid('#b8c0cc') });
  a.add('Grip', cylBetween([0, -0.55, 0], [0, 0.05, 0], 0.045, 0.04, 12));
  a.add('Pole', cylBetween([0, 0.05, 0], [0, 2.3, 0], 0.028, 0.012, 10));
  a.add('Metal', cylBetween([0.04, -0.22, 0], [0.11, -0.22, 0], 0.014, 0.014, 8));
  a.add('Reel', rcyl(0.09, 0.07, 0.025, 18, { p: [0.13, -0.22, -0.035], r: [90, 0, 0] }));
  a.add('Metal', cylBetween([0.13, -0.22, 0.04], [0.2, -0.17, 0.06], 0.012, 0.012, 6), { outlineScale: 0.5 });
  for (const y of [0.6, 1.2, 1.8, 2.25]) a.add('Metal', tube([[0.0, y, 0], [0.05, y, 0]], [0.008, 0.008], { n: 6 }), { outline: false });
  a.add('Pole', sphere(0.03, { p: [0, 2.31, 0] }));
  return a;
}

export function boat() {
  const a = new Asset('Prop_Boat', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Hull', { paint: woodPlanks('#c0703f', 5, 21) });
  a.material('Deck', { paint: woodPlanks('#8b5a3c', 8, 22) });
  a.material('Trim', { paint: solid('#e63946') });
  a.material('Cabin', { paint: solid('#f7f3e8') });
  a.material('Roof', { paint: solid('#3d7dd8') });
  a.material('Glass', { color: '#9fd8ff' });
  a.material('Dark', { paint: solid('#2b2d42') });
  // hull: lofted U-shape opened at top
  const prof = [[-1.6, 0.6, 0.35, 0.36], [-1.2, 0.78, 0.42, 0.3], [0, 0.88, 0.46, 0.3], [1.0, 0.72, 0.42, 0.33], [1.6, 0.3, 0.32, 0.45], [1.9, 0.04, 0.1, 0.62]];
  const hull = tube(prof.map(([x, , , y]) => [x, y, 0]), prof.map(([, s, u]) => [s, u]), { n: 20 });
  // squash the top half flat to a gunwale so it reads as an open boat
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.62) p.setY(i, 0.62);
  hull.computeVertexNormals();
  a.add('Hull', hull);
  a.add('Deck', rbox(3.0, 0.08, 1.45, 0.03, { p: [0.05, 0.62, 0] }), { outline: false });
  for (const s of [1, -1]) a.add('Trim', rbox(2.6, 0.1, 0.1, 0.04, { p: [-0.05, 0.66, s * 0.8] }), { outline: false });
  a.add('Cabin', rbox(0.9, 0.7, 1.15, 0.1, { p: [-0.7, 1.0, 0] }));
  a.add('Roof', rbox(1.1, 0.12, 1.35, 0.05, { p: [-0.7, 1.41, 0] }));
  a.add('Glass', rbox(0.04, 0.3, 0.85, 0.02, { p: [-0.24, 1.08, 0] }), { outline: false });
  a.add('Dark', rbox(0.34, 0.36, 0.3, 0.08, { p: [-1.72, 0.75, 0] }));
  a.add('Dark', cylBetween([-1.75, 0.6, 0], [-1.85, 0.05, 0], 0.06, 0.05, 10));
  a.add('Trim', sphere(0.11, { p: [1.0, 0.85, 0.7], s: [1, 1, 0.35] }));
  return a;
}

export function aquariumTank() {
  const a = new Asset('Prop_AquariumTank', { outline: 0.05, meta: { kind: 'prop', glass: { size: [4, 2.4, 2], center: [0, 1.75, 0] } } });
  a.material('Wood', { paint: woodPlanks('#7a4b2a', 4, 31) });
  a.material('Frame', { paint: solid('#2b2d42') });
  a.material('Sand', { paint: sandSpeckle() });
  a.material('Rock', { paint: solid('#8d99ae') });
  a.material('Kelp', { paint: solid('#52b788') });
  a.material('Plate', { paint: sign('MY FISH', '#f4d35e') });
  const w = 4, d = 2, h = 2.4;
  a.add('Wood', rbox(w + 0.4, 0.55, d + 0.4, 0.1, { p: [0, 0.275, 0] }));
  a.add('Wood', rbox(w + 0.4, 0.16, d + 0.4, 0.06, { p: [0, 0.55 + h + 0.08, 0] }));
  for (const sx of [1, -1]) for (const sz of [1, -1]) a.add('Frame', rbox(0.12, h, 0.12, 0.03, { p: [(sx * w) / 2, 0.55 + h / 2, (sz * d) / 2] }));
  a.add('Sand', rbox(w - 0.05, 0.25, d - 0.05, 0.06, { p: [0, 0.65, 0] }), { outline: false });
  for (const [x, z, s] of [[-1.4, 0.4, 0.28], [1.2, -0.5, 0.2], [0.3, 0.6, 0.16]]) a.add('Rock', sphere(s, { p: [x, 0.8, z], s: [1.3, 0.75, 1], seg: 10, rings: 7 }), { outlineScale: 0.5 });
  for (const [x, z] of [[-1.0, -0.5], [1.5, 0.5], [-0.2, -0.6]])
    a.add('Kelp', tube([[x, 0.75, z], [x + 0.12, 1.25, z], [x - 0.06, 1.8, z], [x + 0.05, 2.2, z]], [0.07, 0.06, 0.045, 0.02], { n: 8 }), { outlineScale: 0.5 });
  a.add('Plate', rbox(0.04, 0.32, 1.4, 0.02, { p: [w / 2 + 0.21, 0.3, 0] }), { outline: false });
  return a;
}

export function dockSection() {
  const a = new Asset('Prop_DockSection', { outline: 0.06, meta: { kind: 'prop', size: [12, 6] } });
  a.material('Planks', { paint: woodPlanks('#b07a4f', 10, 41) });
  a.material('Posts', { paint: woodPlanks('#6b4226', 3, 42) });
  a.material('Rope', { paint: stripes('#e9c46a', '#d4a84b', 12) });
  const L = 12, W = 6;
  a.add('Planks', rbox(L, 0.25, W, 0.06, { p: [0, 0, 0] }));
  for (const x of [-L / 2 + 0.35, 0, L / 2 - 0.35])
    for (const s of [1, -1]) {
      a.add('Posts', rcyl(0.22, 4.2, 0.08, 12, { p: [x, -3.3, s * (W / 2 - 0.25)] }));
      a.add('Rope', rcyl(0.25, 0.16, 0.05, 12, { p: [x, 0.55, s * (W / 2 - 0.25)] }), { outline: false });
    }
  for (const s of [1, -1]) a.add('Posts', rbox(L - 0.3, 0.12, 0.14, 0.04, { p: [0, 0.75, s * (W / 2 - 0.25)] }));
  return a;
}

export function lighthouse() {
  const a = new Asset('Prop_Lighthouse', { outline: 0.12, meta: { kind: 'prop' } });
  a.material('Rock', { paint: solid('#9aa5b1', 51, 0.1) });
  a.material('Red', { paint: solid('#e63946') });
  a.material('White', { paint: solid('#f7f3e8') });
  a.material('Dark', { paint: solid('#2b2d42') });
  a.material('Lamp', { color: '#ffe066' });
  a.add('Rock', sphere(3.2, { s: [1, 0.38, 1], seg: 9, rings: 6 }));
  for (let i = 0; i < 6; i++) {
    const y0 = 0.8 + i * 1.6, r0 = 1.6 - i * 0.12, r1 = r0 - 0.12;
    a.add(i % 2 ? 'White' : 'Red', cylBetween([0, y0, 0], [0, y0 + 1.6, 0], r0, r1, 18), { outline: i === 0 });
  }
  const top = 0.8 + 6 * 1.6;
  a.add('Dark', rcyl(1.35, 0.2, 0.06, 18, { p: [0, top, 0] }));
  a.add('Lamp', cylBetween([0, top + 0.2, 0], [0, top + 1.4, 0], 0.75, 0.75, 14));
  for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2; a.add('Dark', cylBetween([Math.cos(t) * 0.8, top + 0.2, Math.sin(t) * 0.8], [Math.cos(t) * 0.8, top + 1.4, Math.sin(t) * 0.8], 0.05, 0.05, 6), { outline: false }); }
  a.add('Red', cone([0, top + 1.4, 0], [0, top + 2.4, 0], 1.0, 14));
  a.add('Dark', rbox(0.14, 1.2, 0.8, 0.05, { p: [1.55, 1.4, 0] }), { outline: false });
  return a;
}

export function baitShop() {
  const a = new Asset('Prop_BaitShop', { outline: 0.07, meta: { kind: 'prop' } });
  a.material('Walls', { paint: woodPlanks('#d9a066', 9, 61) });
  a.material('Counter', { paint: woodPlanks('#7a4b2a', 3, 62) });
  a.material('Roof', { paint: solid('#3d7dd8') });
  a.material('Awning', { paint: stripes('#e63946', '#f7f3e8', 8, true) });
  a.material('Sign', { paint: sign('BAIT SHOP', '#f4d35e'), size: 1024 });
  a.material('Bucket', { paint: solid('#4ea8de') });
  a.material('Worm', { color: '#ff8fab' });
  a.add('Walls', rbox(5, 3, 4, 0.12, { p: [0, 1.5, 0] }));
  a.add('Counter', rbox(0.7, 1.2, 3.8, 0.08, { p: [2.75, 0.6, 0] }));
  // roof: extruded triangle
  a.add('Roof', fin([[-2.9, 0], [2.9, 0], [0, 1.6]], 4.6, { p: [0, 3.0, 0], r: [0, 90, 0] }));
  a.add('Awning', fin([[0, 0], [1.4, -0.5], [1.4, -0.62], [0, -0.12]], 4.2, { p: [2.5, 3.0, 0] }));
  a.add('Sign', rbox(0.1, 0.8, 3.0, 0.04, { p: [2.55, 3.65, 0] }), { outline: true, outlineScale: 0.5 });
  for (const z of [-1.3, 1.3]) {
    a.add('Bucket', lathe([[0, 0], [0.22, 0], [0.28, 0.35], [0.26, 0.35], [0.2, 0.03], [0, 0.03]], 16, { p: [2.75, 1.2, z] }));
    for (let i = 0; i < 3; i++) a.add('Worm', tube([[2.7 + i * 0.05, 1.52, z - 0.1], [2.75, 1.62, z], [2.8 - i * 0.04, 1.55, z + 0.1]], [0.03, 0.03, 0.03], { n: 6 }), { outline: false });
  }
  return a;
}

export function palmTree() {
  const a = new Asset('Prop_PalmTree', { outline: 0.06, meta: { kind: 'prop' } });
  a.material('Trunk', { paint: stripes('#a47148', '#8b5e34', 14) });
  a.material('Leaf', { paint: solid('#40916c') });
  a.material('Coconut', { paint: solid('#6f4518') });
  const pts = [], rad = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 1.4) * 1.0, t * 7, 0]); rad.push(0.35 - t * 0.14); }
  a.add('Trunk', tube(pts, rad, { n: 10 }));
  const top = new THREE.Vector3(...pts[8]);
  for (let k = 0; k < 7; k++) {
    const ang = (k / 7) * 360;
    a.add('Leaf', smoothFin([[0, 0], [1.2, 0.35], [2.6, 0.05], [3.2, -0.6], [2.4, -0.2], [1.2, -0.15]], 0.06, { p: top.toArray(), r: [0, ang, -15] }));
  }
  for (let k = 0; k < 3; k++) { const t = (k / 3) * Math.PI * 2; a.add('Coconut', sphere(0.24, { p: [top.x + Math.cos(t) * 0.3, top.y - 0.3, Math.sin(t) * 0.3] }), { outlineScale: 0.6 }); }
  return a;
}

export function pineTree() {
  const a = new Asset('Prop_PineTree', { outline: 0.06, meta: { kind: 'prop' } });
  a.material('Trunk', { paint: solid('#6b4226') });
  a.material('Needles', { paint: solid('#2d6a4f', 71, 0.08) });
  a.add('Trunk', cylBetween([0, 0, 0], [0, 1.6, 0], 0.32, 0.26, 8));
  for (const g of pineTiers(6, 2.2, 3, 7)) a.add('Needles', g);
  return a;
}

export function rock() {
  const a = new Asset('Prop_Rock', { outline: 0.06, meta: { kind: 'prop' } });
  a.material('Rock', { paint: solid('#8d99ae', 81, 0.12) });
  const g = new THREE.IcosahedronGeometry(1.4, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.85 + 0.3 * Math.abs(Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  g.computeVertexNormals();
  a.add('Rock', g);
  return a;
}

export function buoy() {
  const a = new Asset('Prop_Buoy', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Stripes', { paint: stripes('#e63946', '#f7f3e8', 6) });
  a.material('Dark', { paint: solid('#2b2d42') });
  a.material('Lamp', { color: '#ffe066' });
  a.add('Stripes', lathe([[0, -0.6], [0.7, -0.5], [0.85, -0.1], [0.75, 0.3], [0.4, 0.6], [0.32, 1.5], [0.3, 1.6], [0, 1.6]], 18));
  a.add('Dark', rcyl(0.95, 0.18, 0.06, 18, { p: [0, -0.15, 0] }));
  a.add('Dark', cylBetween([0, 1.6, 0], [0, 1.75, 0], 0.22, 0.22, 12));
  a.add('Lamp', sphere(0.18, { p: [0, 1.9, 0] }));
  return a;
}

export function crate() {
  const a = new Asset('Prop_Crate', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Planks', { paint: woodPlanks('#c48a52', 4, 91) });
  a.material('Frame', { paint: woodPlanks('#7a4b2a', 2, 92) });
  a.add('Planks', rbox(1.6, 1.6, 1.6, 0.08, { p: [0, 0.8, 0] }));
  for (const s of [1, -1]) {
    a.add('Frame', rbox(0.16, 1.7, 1.7, 0.04, { p: [s * 0.74, 0.8, 0] }), { outline: false });
    a.add('Frame', rbox(1.7, 0.16, 1.7, 0.04, { p: [0, 0.8 + s * 0.74, 0] }), { outline: false });
  }
  a.add('Frame', rbox(0.12, 2.1, 0.12, 0.03, { p: [0.82, 0.8, 0], r: [45, 0, 0] }), { outline: false });
  return a;
}

export function barrel() {
  const a = new Asset('Prop_Barrel', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Staves', { paint: stripes('#a0662f', '#8b5a2b', 14, true) });
  a.material('Bands', { paint: solid('#4a4e69') });
  a.add('Staves', lathe([[0, 0], [0.55, 0], [0.68, 0.45], [0.72, 0.8], [0.68, 1.15], [0.55, 1.6], [0, 1.6]], 18));
  for (const y of [0.25, 1.35]) a.add('Bands', rcyl(0.66, 0.1, 0.03, 18, { p: [0, y - 0.05, 0] }), { outline: false });
  return a;
}

export function lampPost() {
  const a = new Asset('Prop_LampPost', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Iron', { paint: solid('#2b2d42') });
  a.material('Glow', { color: '#ffd166' });
  a.add('Iron', rcyl(0.35, 0.3, 0.08, 12));
  a.add('Iron', cylBetween([0, 0.3, 0], [0, 3.6, 0], 0.1, 0.08, 10));
  a.add('Iron', rbox(0.62, 0.1, 0.62, 0.03, { p: [0, 3.65, 0] }));
  a.add('Glow', rbox(0.48, 0.6, 0.48, 0.06, { p: [0, 4.0, 0] }));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) a.add('Iron', cylBetween([x * 0.25, 3.7, z * 0.25], [x * 0.25, 4.3, z * 0.25], 0.03, 0.03, 6), { outline: false });
  a.add('Iron', cone([0, 4.3, 0], [0, 4.75, 0], 0.42, 10));
  return a;
}

export function coral() {
  const a = new Asset('Prop_Coral', { outline: 0.05, meta: { kind: 'prop' } });
  a.material('Coral', { paint: solid('#ff7b9c') });
  a.material('Tips', { paint: solid('#ffd6e0') });
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function branch(p, dir, len, rad, depth) {
    const end = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
    const mid = [(p[0] + end[0]) / 2 + (r() - 0.5) * 0.2, (p[1] + end[1]) / 2, (p[2] + end[2]) / 2 + (r() - 0.5) * 0.2];
    a.add('Coral', tube([p, mid, end], [rad, rad * 0.85, rad * 0.7], { n: 8 }), { outlineScale: 0.7 });
    if (depth === 0) { a.add('Tips', sphere(rad * 0.85, { p: end, seg: 10, rings: 8 }), { outline: false }); return; }
    for (let k = 0; k < 2; k++) {
      const ang = r() * Math.PI * 2, tilt = 0.45 + r() * 0.35;
      branch(end, [Math.cos(ang) * tilt, 1, Math.sin(ang) * tilt].map((v, i, arr) => v / Math.hypot(...arr)), len * 0.72, rad * 0.75, depth - 1);
    }
  }
  for (let i = 0; i < 3; i++) branch([(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6], [(r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4], 0.9, 0.16, 2);
  return a;
}

export function indexBoard() {
  const a = new Asset('Prop_IndexBoard', { outline: 0.06, meta: { kind: 'prop' } });
  a.material('Posts', { paint: woodPlanks('#7a4b2a', 3, 101) });
  a.material('Board', { paint: woodPlanks('#d9a066', 6, 102) });
  a.material('Header', { paint: sign('FISH INDEX', '#f4d35e'), size: 1024 });
  a.material('Paper', { paint: solid('#fff6e6') });
  for (const z of [-1.6, 1.6]) a.add('Posts', rbox(0.25, 4.2, 0.25, 0.06, { p: [0, 2.1, z] }));
  a.add('Board', rbox(0.16, 2.4, 3.6, 0.06, { p: [0, 2.6, 0] }));
  a.add('Header', rbox(0.1, 0.6, 2.8, 0.04, { p: [0.12, 4.05, 0] }), { outlineScale: 0.5 });
  for (const [y, z] of [[3.1, -1.1], [3.2, 0], [3.05, 1.1], [2.1, -0.6], [2.0, 0.6]]) a.add('Paper', rbox(0.04, 0.75, 0.7, 0.02, { p: [0.1, y, z], r: [((z * 7) % 6) - 3, 0, 0] }), { outline: false });
  return a;
}

export const PROPS = [fishingRod, boat, aquariumTank, dockSection, lighthouse, baitShop, palmTree, pineTree, rock,
  buoy, crate, barrel, lampPost, coral, indexBoard];
export default PROPS;
