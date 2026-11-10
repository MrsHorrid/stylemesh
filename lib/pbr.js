// PBR surface generation: from a painted base-colour canvas, derive a height field, then a
// tangent-space normal map and a packed ORM map (R = occlusion, G = roughness, B = metalness,
// the glTF metallicRoughness + occlusion layout, so one texture serves both slots).
//
// Height = painter detail (luminance: plank seams, scale edges, stripes) + procedural noise
// chosen by surface kind (wood grain, stone, brushed metal, cloth weave, ...).
// Roughness / metalness / kind / emission come from the material name (HINTS) unless the
// asset overrides them with material(name, { pbr: { rough, metal, kind, emissive, alpha } }).
import { createCanvas } from '@napi-rs/canvas';

/** per-kind height recipe: lum = weight of painter luminance, strength = normal intensity */
const KINDS = {
  plastic: { lum: 0.06, noise: 'rock', amt: 0.1, strength: 0.5, roughVar: 0.08 }, // painter speckle would read as sponge bumps: keep it subtle
  scales:  { lum: 0.7, noise: 'fine', amt: 0.08, strength: 1.4, roughVar: 0.1 },
  fin:     { lum: 0.8, noise: 'fine', amt: 0.1, strength: 2.0, roughVar: 0.08 },
  wood:    { lum: 0.7, noise: 'grain', amt: 0.6, strength: 2.4, roughVar: 0.15 },
  bark:    { lum: 0.3, noise: 'bark', amt: 1.0, strength: 3.5, roughVar: 0.1 },
  stone:   { lum: 0.2, noise: 'rock', amt: 1.0, strength: 3.8, roughVar: 0.12 },
  sand:    { lum: 0.4, noise: 'grit', amt: 1.0, strength: 2.6, roughVar: 0.05 },
  metal:   { lum: 0.15, noise: 'brushed', amt: 0.35, strength: 0.7, roughVar: 0.12 },
  cloth:   { lum: 0.4, noise: 'weave', amt: 0.5, strength: 1.8, roughVar: 0.05 },
  leaf:    { lum: 0.3, noise: 'fine', amt: 0.25, strength: 1.4, roughVar: 0.1 },
  paint:   { lum: 0.3, noise: 'fine', amt: 0.05, strength: 0.8, roughVar: 0.05 },
};

/** defaults by material name. rough 0..1, metal 0..1 */
export const HINTS = {
  Body: { rough: 0.32, kind: 'scales' }, Fin: { rough: 0.38, kind: 'fin' }, Accent: { rough: 0.4 },
  Shell: { rough: 0.55, kind: 'stone' }, Eye: { rough: 0.06 }, Ink: { rough: 0.08 },
  Metal: { rough: 0.32, metal: 1, kind: 'metal' }, Iron: { rough: 0.55, metal: 1, kind: 'metal' },
  Bands: { rough: 0.5, metal: 0.9, kind: 'metal' }, Reel: { rough: 0.28, metal: 0.7, kind: 'metal' },
  Glass: { rough: 0.04, alpha: 0.35 }, Lamp: { rough: 0.3, emissive: 3 }, Glow: { rough: 0.3, emissive: 3 },
  Rock: { rough: 0.85, kind: 'stone' }, Sand: { rough: 0.95, kind: 'sand' },
  Coral: { rough: 0.8, kind: 'stone' }, Tips: { rough: 0.75, kind: 'stone' },
  Wood: { rough: 0.7, kind: 'wood' }, Planks: { rough: 0.72, kind: 'wood' }, Posts: { rough: 0.75, kind: 'wood' },
  Walls: { rough: 0.7, kind: 'wood' }, Counter: { rough: 0.55, kind: 'wood' }, Deck: { rough: 0.7, kind: 'wood' },
  Hull: { rough: 0.6, kind: 'wood' }, Board: { rough: 0.7, kind: 'wood' }, Staves: { rough: 0.7, kind: 'wood' },
  Trunk: { rough: 0.88, kind: 'bark' }, Coconut: { rough: 0.8, kind: 'bark' },
  Leaf: { rough: 0.55, kind: 'leaf' }, Needles: { rough: 0.7, kind: 'leaf' }, Kelp: { rough: 0.4, kind: 'leaf' },
  Rope: { rough: 0.95, kind: 'cloth' }, Awning: { rough: 0.85, kind: 'cloth' }, Grip: { rough: 0.7, kind: 'cloth' },
  Paper: { rough: 0.9, kind: 'cloth' }, Sign: { rough: 0.6, kind: 'paint' }, Header: { rough: 0.6, kind: 'paint' },
  Plate: { rough: 0.5, kind: 'paint' },
  Trim: { rough: 0.42 }, Red: { rough: 0.45 }, White: { rough: 0.45 }, Cabin: { rough: 0.5 }, Stripes: { rough: 0.45 },
  Roof: { rough: 0.6 }, Dark: { rough: 0.5 }, Pole: { rough: 0.4 }, Bucket: { rough: 0.35 }, Worm: { rough: 0.3 },
};

/** resolve {rough, metal, kind, emissive, alpha} for a material */
export function pbrHint(name, def) {
  const h = { rough: 0.5, metal: 0, kind: def.paint?.surface ?? 'plastic', ...HINTS[name], ...def.pbr };
  if (!KINDS[h.kind]) h.kind = 'plastic';
  return h;
}

// ---------------------------------------------------------------- tileable value noise
function hash2(x, y, s) { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
const fade = (t) => t * t * (3 - 2 * t);
/** value noise at (x,y) in [0,1)^2 with px x py cells, wrapping so textures tile across UV seams */
function vnoise(x, y, px, py, seed) {
  const fx = x * px, fy = y * py, ix = Math.floor(fx), iy = Math.floor(fy), tx = fade(fx - ix), ty = fade(fy - iy);
  const w = (a, p) => ((a % p) + p) % p;
  const a = hash2(w(ix, px), w(iy, py), seed), b = hash2(w(ix + 1, px), w(iy, py), seed);
  const c = hash2(w(ix, px), w(iy + 1, py), seed), d = hash2(w(ix + 1, px), w(iy + 1, py), seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function fbm(x, y, px, py, oct, seed) {
  let v = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { v += amp * vnoise(x, y, px << o, py << o, seed + o * 17); tot += amp; amp *= 0.5; }
  return v / tot;
}
const NOISE = {
  fine: (u, v, s) => fbm(u, v, 24, 24, 3, s),
  grain: (u, v, s) => fbm(u, v, 3, 48, 4, s) * 0.7 + fbm(u, v, 1, 160, 2, s + 5) * 0.3, // long streaks along u
  bark: (u, v, s) => 1 - Math.abs(fbm(u, v, 18, 3, 4, s) * 2 - 1), // vertical ridges
  rock: (u, v, s) => fbm(u, v, 4, 4, 5, s),
  grit: (u, v, s) => fbm(u, v, 48, 48, 2, s),
  brushed: (u, v, s) => fbm(u, v, 2, 256, 2, s),
  weave: (u, v, s) => 0.5 + 0.25 * (Math.sin(u * Math.PI * 128) + Math.sin(v * Math.PI * 128)) * 0.5 + 0.15 * (fbm(u, v, 32, 32, 2, s) - 0.5),
};

/**
 * Build the PBR maps for one material.
 * @param {import('@napi-rs/canvas').Canvas} base painted base-colour canvas
 * @returns {{normal: Buffer, orm: Buffer}} PNG buffers
 */
export function pbrMaps(base, hint, seed = 1, size = 512) {
  const k = KINDS[hint.kind];
  const src = createCanvas(size, size);
  src.getContext('2d').drawImage(base, 0, 0, size, size);
  const px = src.getContext('2d').getImageData(0, 0, size, size).data;
  const n = size * size, H = new Float32Array(n), noise = NOISE[k.noise];
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, j = i * 4;
    const lum = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) / 255;
    const h = lum * k.lum + noise(x / size, y / size, seed) * k.amt;
    H[i] = h; if (h < lo) lo = h; if (h > hi) hi = h;
  }
  const span = Math.max(1e-5, hi - lo);
  for (let i = 0; i < n; i++) H[i] = (H[i] - lo) / span;

  const nc = createCanvas(size, size), oc = createCanvas(size, size);
  const nd = nc.getContext('2d').createImageData(size, size), od = oc.getContext('2d').createImageData(size, size);
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  const str = k.strength * (size / 512) * 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, j = i * 4;
    // Sobel gradient -> tangent-space normal (glTF: +Y up in texture = green)
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * str, ny = dy * str, nz = 1;
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    nd.data[j] = (nx * 0.5 + 0.5) * 255; nd.data[j + 1] = (ny * 0.5 + 0.5) * 255; nd.data[j + 2] = (nz * 0.5 + 0.5) * 255; nd.data[j + 3] = 255;
    // ORM: cavities (low height) get occlusion and a little extra roughness
    const cav = 1 - H[i];
    const ao = 1 - 0.45 * cav * cav;
    const rough = Math.min(1, Math.max(0.02, hint.rough + (H[i] - 0.5) * -k.roughVar * 2 + cav * 0.05));
    od.data[j] = ao * 255; od.data[j + 1] = rough * 255; od.data[j + 2] = (hint.metal ?? 0) * 255; od.data[j + 3] = 255;
  }
  nc.getContext('2d').putImageData(nd, 0, 0);
  oc.getContext('2d').putImageData(od, 0, 0);
  return { normal: nc.toBuffer('image/png'), orm: oc.toBuffer('image/png') };
}
