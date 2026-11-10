// Fish archetypes. Y up, face +X, side = Z. ~1.2 units long; game scales them.
// Body/Fin/Accent textures are light so Roblox tints them per fish variant (meta.tints = default look).
import { Asset } from '../../lib/core.js';
import { body, sphere, fin, smoothFin, cylBetween, cone, tube, rbox, at } from '../../lib/shapes.js';
import { fishBody, finRays, solid } from '../../lib/paint.js';

function fishAsset(name, pattern, tints, seed = 1, outline = 0.022) {
  const a = new Asset(name, { outline, meta: { kind: 'fish' } });
  a.material('Body', { paint: fishBody(pattern, seed), tint: tints.Body });
  a.material('Fin', { paint: finRays(), tint: tints.Fin });
  a.material('Accent', { paint: solid('#ffffff', seed), tint: tints.Accent ?? '#ff5a5f' });
  a.material('Eye', { color: '#ffffff' });
  return a;
}

/** big cute eyes: white ball, ink pupil looking forward, white glint */
function eyes(a, x, y, z, r, { pupil = 0.55, look = [1, 0, 0.35] } = {}) {
  for (const s of [1, -1]) {
    const c = [x, y, s * z];
    a.add('Eye', sphere(r, { p: c, seg: 20, rings: 14 }));
    const L = Math.hypot(...look);
    const d = [look[0] / L, look[1] / L, (s * look[2]) / L];
    const pc = c.map((v, i) => v + d[i] * r * 0.72);
    a.add('Ink', sphere(r * pupil, { p: pc, s: [1, 1, 1], seg: 16, rings: 12 }), { outline: false });
    a.add('Eye', sphere(r * pupil * 0.32, { p: [pc[0] + d[0] * r * 0.45, pc[1] + r * 0.2, pc[2] + d[2] * r * 0.45], seg: 10, rings: 8 }), { outline: false });
  }
}

function tail(a, x, y, h, len, opts = {}) {
  a.add('Fin', smoothFin([[x + 0.05, y], [x - len * 0.6, y + h * 0.5], [x - len, y + h], [x - len * 0.75, y], [x - len, y - h], [x - len * 0.6, y - h * 0.5]], 0.045), opts);
}

export function guppling() {
  const a = fishAsset('Fish_Guppling', 'scales', { Body: '#ff9f43', Fin: '#ffd166' });
  a.add('Body', body([[-0.52, 0.03, 0.05, 0], [-0.4, 0.11, 0.18, 0], [-0.12, 0.2, 0.31, 0.01], [0.18, 0.21, 0.3, 0.01], [0.4, 0.16, 0.21, 0], [0.54, 0.05, 0.07, -0.02]]));
  tail(a, -0.48, 0, 0.3, 0.38);
  a.add('Fin', smoothFin([[-0.28, 0.24], [0.12, 0.29], [-0.05, 0.42], [-0.3, 0.46]], 0.035));
  for (const s of [1, -1]) a.add('Fin', smoothFin([[0, 0], [-0.22, 0.07], [-0.2, -0.1]], 0.025, { p: [0.16, -0.08, s * 0.19], r: [0, s * -25, -15] }));
  eyes(a, 0.32, 0.08, 0.13, 0.085);
  a.add('Accent', sphere(0.035, { p: [0.53, -0.04, 0], s: [0.6, 0.7, 1.6] }), { outline: false });
  return a;
}

export function noodleEel() {
  const a = fishAsset('Fish_NoodleEel', 'bands', { Body: '#7bd389', Fin: '#c3f584', Accent: '#ffe066' }, 2);
  const N = 18, pts = [], rad = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push([-1.1 + 2.2 * t, 0.06 * Math.sin(t * 7), 0.2 * Math.sin(t * 2.5 * Math.PI)]);
    const r = t < 0.92 ? 0.045 + 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.15)) : 0.1 - (t - 0.92) * 0.6;
    rad.push([r * 1.05, r]);
  }
  a.add('Body', tube(pts, rad, { n: 12 }));
  for (let i = 2; i < N - 3; i += 2) {
    const [x, y, z] = pts[i];
    a.add('Fin', smoothFin([[-0.1, 0], [0.1, 0], [0.02, 0.09]], 0.02, { p: [x, y + rad[i][1] * 0.85, z] }));
  }
  const [hx, hy, hz] = pts[N - 1];
  eyes(a, hx - 0.07, hy + 0.06, 0.07, 0.055, { look: [1, 0, 0.5] });
  a.add('Accent', tube([[hx - 0.02, hy - 0.04, hz - 0.04], [hx + 0.02, hy - 0.05, hz], [hx - 0.02, hy - 0.04, hz + 0.04]], [0.012, 0.012, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function spikeball() {
  const a = fishAsset('Fish_Spikeball', 'spots', { Body: '#ffd93d', Fin: '#ff9f1c', Accent: '#ffffff' }, 3);
  a.add('Body', sphere(0.42, { seg: 24, rings: 16, s: [1.05, 0.95, 1] }));
  // spikes on a fibonacci sphere, skipping the face
  const n = 34;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const d = [Math.cos(th) * r, y, Math.sin(th) * r];
    if (d[0] > 0.55 && Math.abs(d[1]) < 0.6) continue;
    a.add('Accent', cone(d.map((v) => v * 0.38), d.map((v) => v * 0.6), 0.05, 6), { outlineScale: 0.6 });
  }
  tail(a, -0.38, 0, 0.18, 0.24);
  for (const s of [1, -1]) a.add('Fin', smoothFin([[0, 0], [-0.14, 0.08], [-0.12, -0.07]], 0.025, { p: [0.05, 0, s * 0.42], r: [0, s * -60, 0] }));
  eyes(a, 0.3, 0.12, 0.17, 0.11);
  a.add('Ink', sphere(0.05, { p: [0.43, -0.12, 0], s: [0.5, 0.8, 1] }), { outline: false }); // little "o" mouth
  return a;
}

export function chompShark() {
  const a = fishAsset('Fish_ChompShark', 'plain', { Body: '#8fa3b8', Fin: '#6d819a', Accent: '#ffffff' }, 4, 0.026);
  a.add('Body', body([[-0.95, 0.03, 0.05, 0.05], [-0.7, 0.1, 0.13, 0.02], [-0.2, 0.23, 0.28, 0], [0.3, 0.23, 0.26, 0], [0.68, 0.14, 0.16, -0.02], [0.9, 0.04, 0.06, -0.05]]));
  a.add('Fin', smoothFin([[-0.88, 0.05], [-1.12, 0.3], [-1.25, 0.55], [-1.08, 0.08], [-1.18, -0.3], [-1.0, -0.12]], 0.045));
  a.add('Fin', smoothFin([[-0.18, 0.22], [0.22, 0.24], [0.0, 0.42], [-0.12, 0.62]], 0.045));
  for (const s of [1, -1]) a.add('Fin', smoothFin([[0, 0], [-0.32, -0.04], [-0.3, -0.22]], 0.035, { p: [0.25, -0.13, s * 0.2], r: [0, s * -25, 0] }));
  eyes(a, 0.55, 0.08, 0.15, 0.07, { pupil: 0.6 });
  // toothy grin
  a.add('Ink', tube([[0.66, -0.1, -0.13], [0.8, -0.08, 0], [0.66, -0.1, 0.13]], [0.018, 0.022, 0.018], { n: 6 }), { outline: false });
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    const x = 0.79 - Math.abs(t) * 0.12, z = t * 0.12;
    a.add('Accent', cone([x, -0.085, z], [x + 0.005, -0.15, z], 0.022, 5), { outline: false });
  }
  return a;
}

export function lanternLurker() {
  const a = fishAsset('Fish_LanternLurker', 'spots', { Body: '#5b4b8a', Fin: '#8e7cc3', Accent: '#fff275' }, 5);
  a.add('Body', body([[-0.45, 0.04, 0.05, 0], [-0.3, 0.2, 0.22, 0], [0.05, 0.32, 0.36, 0.02], [0.3, 0.31, 0.33, 0], [0.47, 0.2, 0.22, -0.06]], { n: 18 }));
  tail(a, -0.42, 0, 0.25, 0.28);
  a.add('Fin', tube([[0.1, 0.34, 0], [0.25, 0.6, 0], [0.48, 0.67, 0], [0.62, 0.5, 0]], [0.022, 0.02, 0.016, 0.013], { n: 8 }), { outlineScale: 0.6 });
  a.add('Accent', sphere(0.085, { p: [0.63, 0.44, 0] }));
  eyes(a, 0.3, 0.14, 0.2, 0.075);
  a.add('Ink', tube([[0.42, -0.1, -0.2], [0.5, -0.06, 0], [0.42, -0.1, 0.2]], [0.02, 0.025, 0.02], { n: 6 }), { outline: false });
  for (let i = 0; i < 6; i++) {
    const t = (i - 2.5) / 2.5;
    a.add('Eye', cone([0.47 - Math.abs(t) * 0.05, -0.1, t * 0.17], [0.48 - Math.abs(t) * 0.05, -0.0, t * 0.17], 0.026, 5), { outline: false });
  }
  return a;
}

export function sirStabsalot() {
  const a = fishAsset('Fish_SirStabsalot', 'stripes', { Body: '#4d96ff', Fin: '#2f6fdf', Accent: '#ffd166' }, 6);
  a.add('Body', body([[-0.8, 0.03, 0.05, 0], [-0.55, 0.1, 0.16, 0], [-0.1, 0.18, 0.26, 0], [0.3, 0.17, 0.23, 0], [0.6, 0.08, 0.11, 0]]));
  a.add('Accent', cone([0.56, 0, 0], [1.35, 0.03, 0], 0.06, 10));
  a.add('Fin', smoothFin([[-0.75, 0], [-0.95, 0.25], [-1.15, 0.45], [-0.92, 0], [-1.15, -0.45], [-0.95, -0.25]], 0.045));
  a.add('Fin', smoothFin([[-0.45, 0.18], [0.35, 0.2], [0.25, 0.55], [0.05, 0.85], [-0.3, 0.6]], 0.035));
  eyes(a, 0.42, 0.07, 0.1, 0.065);
  return a;
}

export function jiggleJelly() {
  const a = fishAsset('Fish_JiggleJelly', 'spots', { Body: '#ff8fd8', Fin: '#ffc6ec', Accent: '#ffffff' }, 7);
  // dome via lathe-like squashed half sphere tube
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = (i / 10) * Math.PI / 2; prof.push([0, Math.sin(t) * 0.36, 0, Math.cos(t) * 0.45]); }
  a.add('Body', tube(prof.map(([, y]) => [0, y, 0]), prof.map(([, , , r]) => [Math.max(r, 0.01), Math.max(r, 0.01)]), { n: 22 }));
  a.add('Body', tube([[0, -0.02, 0], [0, 0.0, 0]], [[0.45, 0.45], [0.45, 0.45]], { n: 22 }));
  for (let k = 0; k < 8; k++) {
    const ang = (2 * Math.PI * k) / 8, bx = 0.28 * Math.cos(ang), bz = 0.28 * Math.sin(ang);
    const pts = [], rad = [];
    for (let i = 0; i < 8; i++) { pts.push([bx + 0.06 * Math.sin(i * 1.2 + k), -i * 0.11, bz + 0.06 * Math.cos(i * 1.2 + k)]); rad.push(0.04 - i * 0.004); }
    a.add('Fin', tube(pts, rad, { n: 8 }), { outlineScale: 0.6 });
  }
  eyes(a, 0.3, 0.15, 0.14, 0.07, { look: [1, 0, 0.3] });
  a.add('Ink', tube([[0.41, 0.05, -0.06], [0.44, 0.02, 0], [0.41, 0.05, 0.06]], [0.012, 0.012, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function sneakerSnapper() {
  const a = fishAsset('Fish_SneakerSnapper', 'scales', { Body: '#ff6b6b', Fin: '#ffa69e', Accent: '#ffffff' }, 8);
  const y0 = 0.12;
  a.add('Body', body([[-0.52, 0.03, 0.05, y0], [-0.4, 0.12, 0.19, y0], [-0.12, 0.21, 0.31, y0], [0.18, 0.21, 0.3, y0], [0.4, 0.16, 0.21, y0], [0.54, 0.05, 0.07, y0 - 0.02]]));
  tail(a, -0.48, y0, 0.3, 0.36);
  a.add('Fin', smoothFin([[-0.28, y0 + 0.24], [0.12, y0 + 0.29], [-0.3, y0 + 0.46]], 0.035));
  for (const s of [1, -1]) {
    a.add('Fin', cylBetween([0, y0 - 0.2, s * 0.1], [0.02, -0.3, s * 0.12], 0.035, 0.03, 10), { outlineScale: 0.7 });
    a.add('Accent', rbox(0.24, 0.1, 0.13, 0.045, { p: [0.07, -0.33, s * 0.12] }));
    a.add('Fin', rbox(0.26, 0.03, 0.14, 0.012, { p: [0.07, -0.385, s * 0.12] }), { outlineScale: 0.5 });
  }
  // sunglasses
  for (const s of [1, -1]) a.add('Ink', rbox(0.05, 0.1, 0.13, 0.03, { p: [0.38, y0 + 0.09, s * 0.09], r: [0, s * 15, 0] }));
  a.add('Ink', rbox(0.03, 0.025, 0.08, 0.01, { p: [0.4, y0 + 0.12, 0] }), { outline: false });
  a.add('Ink', tube([[0.47, y0 - 0.06, -0.07], [0.51, y0 - 0.08, 0], [0.47, y0 - 0.05, 0.08]], [0.012, 0.012, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function clackyCrab() {
  const a = fishAsset('Fish_ClackyCrab', 'spots', { Body: '#ff7043', Fin: '#ff8a65', Accent: '#ff5722' }, 9);
  a.add('Body', sphere(0.32, { p: [0, 0.2, 0], s: [0.85, 0.5, 1.15], seg: 22, rings: 14 }));
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const x = -0.15 + i * 0.13;
      a.add('Fin', tube([[x, 0.17, s * 0.3], [x - 0.03, 0.24, s * 0.5], [x - 0.06, 0.0, s * 0.6]], [0.035, 0.03, 0.016], { n: 8 }), { outlineScale: 0.7 });
    }
    a.add('Fin', tube([[0.15, 0.2, s * 0.28], [0.32, 0.24, s * 0.38], [0.45, 0.24, s * 0.3]], [0.045, 0.04, 0.04], { n: 8 }));
    a.add('Accent', sphere(0.12, { p: [0.56, 0.25, s * 0.3], s: [1.25, 0.8, 0.9] }));
    a.add('Accent', cone([0.62, 0.3, s * 0.3], [0.78, 0.36, s * 0.27], 0.055, 8));
    a.add('Fin', cylBetween([0.18, 0.3, s * 0.09], [0.22, 0.48, s * 0.11], 0.022, 0.02, 8), { outlineScale: 0.6 });
  }
  eyes(a, 0.23, 0.52, 0.11, 0.06, { look: [1, 0.1, 0.2] });
  a.add('Ink', tube([[0.26, 0.16, -0.08], [0.29, 0.13, 0], [0.26, 0.16, 0.08]], [0.012, 0.012, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function inkyBoss() {
  const a = fishAsset('Fish_InkyBoss', 'spots', { Body: '#b980f0', Fin: '#9b5de5', Accent: '#ffd166' }, 10);
  a.add('Body', sphere(0.38, { p: [0, 0.36, 0], s: [1, 1.15, 1], seg: 24, rings: 16 }));
  for (let k = 0; k < 8; k++) {
    const ang = (2 * Math.PI * k) / 8 + Math.PI / 8, pts = [], rad = [];
    for (let i = 0; i < 8; i++) {
      const rr = 0.18 + i * 0.09;
      pts.push([rr * Math.cos(ang), 0.1 - 0.03 * i + 0.06 * Math.sin(i * 0.9), rr * Math.sin(ang)]);
      rad.push(0.075 - i * 0.008);
    }
    a.add('Body', tube(pts, rad, { n: 10 }));
  }
  eyes(a, 0.3, 0.42, 0.15, 0.085);
  a.add('Ink', tube([[0.33, 0.24, -0.07], [0.37, 0.21, 0], [0.33, 0.24, 0.07]], [0.013, 0.013, 0.013], { n: 6 }), { outline: false });
  // top hat: he's the boss
  a.add('Ink', cylBetween([0, 0.76, 0], [0, 0.79, 0], 0.2, 0.2, 20));
  a.add('Ink', cylBetween([0, 0.79, 0], [0, 1.03, 0], 0.12, 0.125, 20));
  a.add('Accent', cylBetween([0, 0.8, 0], [0, 0.85, 0], 0.128, 0.128, 20), { outline: false });
  return a;
}

export function shellby() {
  const a = fishAsset('Fish_Shellby', 'plain', { Body: '#8bc34a', Fin: '#7cb342', Accent: '#8d6e63' }, 11);
  a.material('Shell', { paint: fishBody('scales', 12), tint: '#a1887f' });
  a.add('Shell', sphere(0.42, { p: [0, 0.22, 0], s: [1.1, 0.6, 0.95], seg: 22, rings: 14 }));
  a.add('Accent', tube([[-0.47, 0.1, 0], [0.47, 0.1, 0]], [[0.46, 0.06], [0.46, 0.06]], { n: 22 }), { outline: false });
  a.add('Body', sphere(0.15, { p: [0.55, 0.22, 0], s: [1.2, 1, 1] }));
  for (const s of [1, -1]) {
    a.add('Fin', smoothFin([[0, 0], [0.3, 0.06], [0.4, -0.12], [0.1, -0.08]], 0.04, { p: [0.25, 0.05, s * 0.36], r: [s * 70, s * -20, 0] }));
    a.add('Fin', smoothFin([[0, 0], [-0.2, 0.05], [-0.25, -0.1]], 0.04, { p: [-0.3, 0.05, s * 0.32], r: [s * 70, s * 20, 0] }));
  }
  eyes(a, 0.64, 0.28, 0.08, 0.055);
  a.add('Ink', tube([[0.68, 0.17, -0.05], [0.71, 0.15, 0], [0.68, 0.17, 0.05]], [0.01, 0.01, 0.01], { n: 6 }), { outline: false });
  return a;
}

export function flappyManta() {
  const a = fishAsset('Fish_FlappyManta', 'spots', { Body: '#3d5a80', Fin: '#293241', Accent: '#e0fbfc' }, 13);
  a.add('Body', sphere(0.4, { s: [1, 0.28, 0.9], seg: 22, rings: 12 }));
  a.add('Fin', smoothFin([[0.25, 0], [-0.05, 0.55], [-0.25, 0.95], [-0.3, 0.4], [-0.35, 0]], 0.04, { r: [90, 0, 0] }));
  a.add('Fin', smoothFin([[0.25, 0], [-0.05, -0.55], [-0.25, -0.95], [-0.3, -0.4], [-0.35, 0]], 0.04, { r: [90, 0, 0] }));
  a.add('Fin', tube([[-0.35, 0, 0], [-0.8, 0.02, 0], [-1.2, 0.08, 0]], [0.04, 0.02, 0.008], { n: 6 }), { outlineScale: 0.5 });
  for (const s of [1, -1]) a.add('Accent', cone([0.35, 0.02, s * 0.14], [0.52, 0.02, s * 0.18], 0.06, 8));
  eyes(a, 0.3, 0.1, 0.16, 0.06, { look: [1, 0.2, 0.4] });
  a.add('Ink', tube([[0.4, -0.04, -0.1], [0.43, -0.06, 0], [0.4, -0.04, 0.1]], [0.012, 0.012, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function sirNeigh() {
  const a = fishAsset('Fish_SirNeigh', 'bands', { Body: '#ffb703', Fin: '#fb8500', Accent: '#ffffff' }, 14);
  const pts = [[0.05, 0.75, 0], [0.12, 0.55, 0], [0.08, 0.3, 0], [0.0, 0.1, 0], [-0.05, -0.1, 0], [0.02, -0.28, 0], [0.12, -0.34, 0], [0.16, -0.26, 0], [0.1, -0.2, 0]];
  a.add('Body', tube(pts, [0.12, 0.15, 0.15, 0.13, 0.1, 0.07, 0.05, 0.035, 0.02], { n: 12 }));
  a.add('Body', sphere(0.15, { p: [0.08, 0.82, 0], s: [1.2, 1, 0.9] }));
  a.add('Body', cylBetween([0.18, 0.8, 0], [0.42, 0.74, 0], 0.05, 0.04, 10));
  a.add('Fin', smoothFin([[0, 0], [-0.18, 0.08], [-0.2, -0.12]], 0.025, { p: [-0.08, 0.35, 0] }));
  for (let i = 0; i < 4; i++) a.add('Fin', cone([0.0 - i * 0.02, 0.92 - i * 0.1, 0], [-0.12 - i * 0.03, 0.97 - i * 0.12, 0], 0.03, 6), { outlineScale: 0.5 });
  eyes(a, 0.16, 0.86, 0.1, 0.055);
  return a;
}

export function hammerTime() {
  const a = fishAsset('Fish_HammerTime', 'plain', { Body: '#adb5bd', Fin: '#868e96', Accent: '#ffffff' }, 15, 0.026);
  a.add('Body', body([[-0.95, 0.03, 0.05, 0.05], [-0.7, 0.1, 0.13, 0.02], [-0.2, 0.22, 0.26, 0], [0.3, 0.2, 0.22, 0], [0.62, 0.12, 0.13, -0.02], [0.72, 0.08, 0.08, -0.03]]));
  a.add('Body', rbox(0.18, 0.1, 0.78, 0.045, { p: [0.75, -0.02, 0] }));
  a.add('Fin', smoothFin([[-0.88, 0.05], [-1.12, 0.3], [-1.25, 0.55], [-1.08, 0.08], [-1.18, -0.3], [-1.0, -0.12]], 0.045));
  a.add('Fin', smoothFin([[-0.18, 0.2], [0.22, 0.22], [0.0, 0.42], [-0.12, 0.62]], 0.045));
  for (const s of [1, -1]) {
    a.add('Fin', smoothFin([[0, 0], [-0.3, -0.04], [-0.28, -0.2]], 0.035, { p: [0.2, -0.12, s * 0.18], r: [0, s * -25, 0] }));
    a.add('Eye', sphere(0.06, { p: [0.78, 0.02, s * 0.42] }));
    a.add('Ink', sphere(0.035, { p: [0.82, 0.03, s * 0.44] }), { outline: false });
  }
  a.add('Ink', tube([[0.8, -0.07, -0.1], [0.84, -0.06, 0], [0.8, -0.07, 0.1]], [0.012, 0.014, 0.012], { n: 6 }), { outline: false });
  return a;
}

export function sadBlob() {
  const a = fishAsset('Fish_SadBlob', 'plain', { Body: '#f4a6b7', Fin: '#e98aa0', Accent: '#ef7a95' }, 16);
  const g = sphere(0.42, { seg: 24, rings: 16, s: [1.05, 0.8, 0.95] });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { // droop: sag the lower half and the front
    const y = p.getY(i), x = p.getX(i);
    if (y < 0) { p.setY(i, y * 1.25 - 0.06 * Math.max(0, x)); p.setX(i, x * 1.08); }
  }
  g.computeVertexNormals();
  a.add('Body', g);
  a.add('Accent', sphere(0.12, { p: [0.42, -0.08, 0], s: [1, 0.85, 1.1] })); // the nose
  tail(a, -0.4, -0.05, 0.14, 0.2);
  for (const s of [1, -1]) a.add('Fin', smoothFin([[0, 0], [-0.12, 0.05], [-0.1, -0.08]], 0.025, { p: [0.1, -0.12, s * 0.38], r: [0, s * -50, 0] }));
  eyes(a, 0.34, 0.08, 0.15, 0.05, { pupil: 0.6, look: [1, -0.4, 0.3] });
  a.add('Ink', tube([[0.36, -0.24, -0.13], [0.4, -0.2, -0.05], [0.41, -0.19, 0], [0.4, -0.2, 0.05], [0.36, -0.24, 0.13]], [0.012, 0.013, 0.013, 0.013, 0.012], { n: 6 }), { outline: false });
  return a;
}

export const FISH = [guppling, noodleEel, spikeball, chompShark, lanternLurker, sirStabsalot, jiggleJelly, sneakerSnapper, clackyCrab, inkyBoss,
  shellby, flappyManta, sirNeigh, hammerTime, sadBlob];
export default FISH;
