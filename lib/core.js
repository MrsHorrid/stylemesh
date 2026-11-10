// Modeler core: Asset container, style-aware meshing, inverted-hull outlines, paint filters,
// baked vertex lighting, voxelizer and GLB export.
// Conventions: Y up, models face +X, 1 unit ~= 1 stud before in-game scaling.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { createCanvas } from '@napi-rs/canvas';
import { getStyle } from './styles.js';
import { paintedFilter, clayGrain } from './paint.js';
import { pbrHint, pbrMaps } from './pbr.js';

export const INK = '#16131a'; // outline + pupil colour (near-black, slightly warm like the shorts)

// Normalise a geometry: non-indexed, only position/normal/uv.
export function prep(geom, flat = false) {
  let g = geom.index ? geom.toNonIndexed() : geom.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (flat && g.attributes.normal) g.deleteAttribute('normal');
  if (!g.attributes.normal) g.computeVertexNormals(); // non-indexed -> face normals when flat
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}

// Inverted hull: smooth normals, push out, flip winding.
export function hull(geom, width) {
  let g = geom.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * width, p.getY(i) + n.getY(i) * width, p.getZ(i) + n.getZ(i) * width);
  }
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return prep(g);
}

// ---------------------------------------------------------------- voxelizer
/** Surface-voxelize material groups. Later groups win shared cells; Eye then Ink win last so faces stay readable. */
export function voxelize(groups, cells = 28) {
  const order = [...groups].sort((a, b) => rank(a.mat) - rank(b.mat));
  const box = new THREE.Box3();
  for (const g of order) { g.geom.computeBoundingBox(); box.union(g.geom.boundingBox); }
  const size = box.getSize(new THREE.Vector3());
  const cell = Math.max(size.x, size.y, size.z) / cells;
  const key = (i, j, k) => `${i},${j},${k}`;
  const owner = new Map();
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3();
  order.forEach((g, gi) => {
    const pos = g.geom.attributes.position;
    for (let t = 0; t < pos.count; t += 3) {
      A.fromBufferAttribute(pos, t); Bv.fromBufferAttribute(pos, t + 1); C.fromBufferAttribute(pos, t + 2);
      const e = Math.max(A.distanceTo(Bv), Bv.distanceTo(C), C.distanceTo(A));
      const n = Math.max(1, Math.ceil(e / (cell * 0.45)));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        P.copy(A).addScaledVector(Bv.clone().sub(A), i / n).addScaledVector(C.clone().sub(A), j / n);
        owner.set(key(Math.floor((P.x - box.min.x) / cell), Math.floor((P.y - box.min.y) / cell), Math.floor((P.z - box.min.z) / cell)), gi);
      }
    }
  });
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const out = order.map(() => ({ pos: [], nor: [], cellId: [] }));
  let cid = 0;
  for (const [k, gi] of owner) {
    const [i, j, l] = k.split(',').map(Number);
    const o = new THREE.Vector3(box.min.x + i * cell, box.min.y + j * cell, box.min.z + l * cell);
    cid++;
    for (const d of dirs) {
      if (owner.has(key(i + d[0], j + d[1], l + d[2]))) continue; // hidden face
      const q = faceQuad(o, cell, d);
      out[gi].pos.push(...q); for (let v = 0; v < 6; v++) { out[gi].nor.push(...d); out[gi].cellId.push(cid); }
    }
  }
  return order.map((g, gi) => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(out[gi].pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(out[gi].nor, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((out[gi].pos.length / 3) * 2), 2));
    geom.userData.cellId = out[gi].cellId;
    return { ...g, geom };
  }).filter((g) => g.geom.attributes.position.count > 0);
}
function rank(mat) { return mat === 'Ink' ? 3 : mat === 'Eye' ? 2 : 0; }
function faceQuad(o, s, d) {
  // corners of the face of cube [o, o+s] facing d, wound counter-clockwise seen from outside
  const ax = d[0] !== 0 ? 0 : d[1] !== 0 ? 1 : 2;
  const pos = d[ax] > 0;
  const u = (ax + 1) % 3, v = (ax + 2) % 3;
  const c = (a, b) => { const p = [o.x, o.y, o.z]; p[ax] += pos ? s : 0; p[u] += a * s; p[v] += b * s; return p; };
  const [p00, p10, p11, p01] = [c(0, 0), c(1, 0), c(1, 1), c(0, 1)];
  return pos ? [...p00, ...p10, ...p11, ...p00, ...p11, ...p01] : [...p00, ...p11, ...p10, ...p00, ...p01, ...p11];
}

// ---------------------------------------------------------------- vertex colours
function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

/** COLOR_0: baked top light + height AO (painted) and/or per-face brightness jitter (flat, voxel). */
export function vertexColors(geom, style, box) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, count = pos.count;
  const col = new Float32Array(count * 3);
  const L = new THREE.Vector3(0.35, 1, 0.45).normalize();
  const warm = new THREE.Color(1.0, 0.98, 0.9), cool = new THREE.Color(0.42, 0.44, 0.68);
  const h = Math.max(1e-6, box.max.y - box.min.y);
  const c = new THREE.Color(), n = new THREE.Vector3();
  const cellId = geom.userData.cellId;
  for (let i = 0; i < count; i++) {
    c.setRGB(1, 1, 1);
    if (style.vertexLight) {
      n.fromBufferAttribute(nor, i);
      const lit = THREE.MathUtils.smoothstep(n.dot(L), -0.6, 0.9);
      const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep((pos.getY(i) - box.min.y) / h, 0, 0.75);
      c.copy(cool).lerp(warm, lit).multiplyScalar(ao);
    }
    if (style.faceJitter) {
      const id = cellId ? cellId[i] : Math.floor(i / 3);
      c.multiplyScalar(1 - style.faceJitter * hash(id + 1));
    }
    col[i * 3] = Math.min(1, c.r); col[i * 3 + 1] = Math.min(1, c.g); col[i * 3 + 2] = Math.min(1, c.b);
  }
  return col;
}

// ---------------------------------------------------------------- texture helpers
function averageColor(cv) {
  const { data } = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
  let r = 0, g = 0, b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

export class Asset {
  /**
   * @param {string} name   export name (file = name.glb)
   * @param {object} opts   { outline: hull width in units, meta: free-form data for the game }
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.style = getStyle();
    this.outline = (opts.outline ?? 0.03) * (this.style.outline ?? 1);
    this.meta = { ...(opts.meta ?? {}), style: this.style.name };
    this.mats = new Map(); // name -> {color, paint, size, tint}
    this.groups = new Map(); // mat name -> [geom]
    this.hulls = [];
    this.material('Ink', { color: INK });
  }
  /** define a material: {color:'#hex'} or {paint:(ctx,w,h)=>void, size:512, tint:'#hex' (default in-game tint)} */
  material(name, def) { def = { ...def, name }; this.mats.set(name, def); if (!this.groups.has(name)) this.groups.set(name, []); return this; }
  /** add geometry to a material group. opts.outline=false skips the hull; opts.outlineScale scales width */
  add(mat, geom, opts = {}) {
    if (!this.mats.has(mat)) throw new Error(`${this.name}: unknown material ${mat}`);
    const g = prep(geom, this.style.shading === 'flat');
    this.groups.get(mat).push(g);
    if (opts.outline !== false && this.outline > 0) this.hulls.push(hull(g, this.outline * (opts.outlineScale ?? 1)));
    return g;
  }
  merged() {
    if (this._merged) return this._merged;
    let out = [];
    for (const [mat, list] of this.groups) {
      const all = mat === 'Ink' ? [...list, ...this.hulls] : list;
      if (!all.length) continue;
      out.push({ mat, def: this.mats.get(mat), geom: mergeGeometries(all, false) });
    }
    if (this.style.voxel) out = voxelize(out, this.style.voxel);
    if (this.style.mergeFace) out = mergeFace(out);
    return (this._merged = out);
  }
  bounds() {
    const box = new THREE.Box3();
    for (const { geom } of this.merged()) { geom.computeBoundingBox(); box.union(geom.boundingBox); }
    return box;
  }
  tris() { return this.merged().reduce((s, m) => s + m.geom.attributes.position.count / 3, 0); }

  /** Paint a material per the style. Returns {png?: Buffer, factor: [r,g,b,1]} */
  surface(def, seed) {
    const st = this.style;
    const tint = st.bakeTint && def.tint ? def.tint : null;
    const pbr = st.paint === 'pbr' ? pbrHint(def.name, def) : null;
    if (!def.paint) {
      const c = new THREE.Color(def.color);
      return { factor: [c.r, c.g, c.b, pbr?.alpha ?? 1], pbr };
    }
    const size = def.size ?? 512;
    const cv = createCanvas(size, size);
    const ctx = cv.getContext('2d');
    def.paint(ctx, size, size);
    if (tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = 'source-over'; }
    if ((st.paint === 'solid' || st.paint === 'clay') && !def.paint.isText) {
      const c = averageColor(cv);
      if (st.paint === 'solid') return { factor: [c.r, c.g, c.b, 1] };
      const small = createCanvas(256, 256);
      clayGrain(small.getContext('2d'), 256, 256, '#' + c.getHexString(THREE.SRGBColorSpace), seed);
      return { png: small.toBuffer('image/png'), factor: [1, 1, 1, 1] };
    }
    if (st.paint === 'painted' && !def.paint.isText) paintedFilter(ctx, size, size, seed);
    if (pbr) return { png: cv.toBuffer('image/png'), factor: [1, 1, 1, pbr.alpha ?? 1], pbr, ...pbrMaps(cv, pbr, seed, Math.min(size, 512)) };
    return { png: cv.toBuffer('image/png'), factor: [1, 1, 1, 1] };
  }

  async writeGLB(path) {
    const doc = new Document();
    const buf = doc.createBuffer();
    const scene = doc.createScene(this.name);
    const root = doc.createNode(this.name);
    scene.addChild(root);
    const box = this.bounds();
    const st = this.style;
    let seed = 1;
    for (const { mat, def, geom } of this.merged()) {
      const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', acc('VEC3', new Float32Array(geom.attributes.position.array)))
        .setAttribute('NORMAL', acc('VEC3', new Float32Array(geom.attributes.normal.array)))
        .setAttribute('TEXCOORD_0', acc('VEC2', flipV(geom.attributes.uv.array)));
      if ((st.vertexLight || st.faceJitter) && mat !== 'Ink') prim.setAttribute('COLOR_0', acc('VEC3', vertexColors(geom, st, box)));
      const m = doc.createMaterial(mat).setMetallicFactor(0).setRoughnessFactor(st.paint === 'clay' ? 0.95 : 0.9);
      const surf = this.surface(def, seed++);
      m.setBaseColorFactor(surf.factor);
      if (surf.png) m.setBaseColorTexture(doc.createTexture(mat).setImage(surf.png).setMimeType('image/png'));
      if (surf.pbr) {
        const p = surf.pbr;
        m.setRoughnessFactor(surf.orm ? 1 : p.rough).setMetallicFactor(surf.orm ? 1 : p.metal ?? 0);
        if (surf.normal) m.setNormalTexture(doc.createTexture(mat + '_N').setImage(surf.normal).setMimeType('image/png'));
        if (surf.orm) {
          const orm = doc.createTexture(mat + '_ORM').setImage(surf.orm).setMimeType('image/png');
          m.setMetallicRoughnessTexture(orm).setOcclusionTexture(orm);
        }
        if (p.emissive) { const c = new THREE.Color(def.color ?? '#ffffff'); m.setEmissiveFactor([c.r, c.g, c.b]); m.setExtras({ emissiveStrength: p.emissive }); }
        if ((p.alpha ?? 1) < 1) m.setAlphaMode('BLEND');
      }
      prim.setMaterial(m);
      root.addChild(doc.createNode(mat).setMesh(doc.createMesh(mat).addPrimitive(prim)));
    }
    root.setExtras({ meta: this.meta, tints: st.bakeTint ? {} : this.tints() });
    await new NodeIO().write(path, doc);
  }
  tints() { return Object.fromEntries([...this.mats].filter(([, d]) => d.tint).map(([k, d]) => [k, d.tint])); }
}

/**
 * Fold the untinted solid-colour groups (Eye, Ink) into one 'Face' mesh with a 2-colour texture.
 * Roblox moderates each mesh on its own; a lone mesh of two white spheres (eyes) gets flagged.
 * Merged with the full outline hull, no uploaded mesh is ever just a pair of balls.
 */
function mergeFace(out) {
  const take = ['Eye', 'Ink'].map((n) => out.find((o) => o.mat === n)).filter(Boolean);
  if (take.length < 2) return out;
  const cols = take.map((t) => t.def.color);
  const geoms = take.map((t, i) => {
    const g = t.geom.clone();
    const u = (i + 0.5) / take.length, uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u, 0.5);
    return g;
  });
  const paint = (ctx, w, h) => cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * w) / cols.length, 0, w / cols.length, h); });
  paint.isText = true; // keep crisp: never averaged or brush-filtered
  const face = { mat: 'Face', def: { paint, size: 16 }, geom: mergeGeometries(geoms, false) };
  return [...out.filter((o) => !take.includes(o)), face];
}

function flipV(uv) { // three uses bottom-left origin, glTF top-left
  const out = new Float32Array(uv.length);
  for (let i = 0; i < uv.length; i += 2) { out[i] = uv[i]; out[i + 1] = 1 - uv[i + 1]; }
  return out;
}
