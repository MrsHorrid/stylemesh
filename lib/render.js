// Headless preview renderer: a small CPU rasterizer (z-buffer, back-face culling, textures,
// vertex colours, alpha) so an agent can SEE an asset without a GPU, browser or display.
// It is a preview, not the engine look: lighting is a fixed key + hemisphere, toon styles band it.
import * as THREE from 'three';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { vertexColors } from './core.js';

export const VIEWS = {
  side: { dir: [0, 0, 1], up: [0, 1, 0] }, // profile: front (+X) points right
  front: { dir: [1, 0, 0], up: [0, 1, 0] },
  back: { dir: [-1, 0, 0], up: [0, 1, 0] },
  top: { dir: [0, 1, 0], up: [1, 0, 0] }, // front points up
  iso: { dir: [1, 0.75, 1.25], up: [0, 1, 0] },
};
const LIGHT = new THREE.Vector3(0.45, 1, 0.65).normalize();
const toSRGB = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

async function texture(surf) {
  if (!surf.png) return null;
  const img = await loadImage(surf.png);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}

/** prepare draw groups once, reuse for every view */
async function groups(asset) {
  const st = asset.style;
  const box = asset.bounds();
  const out = [];
  let seed = 1;
  for (const { mat, def, geom } of asset.merged()) {
    const surf = asset.surface(def, seed++); // same seed order as writeGLB
    const alpha = surf.factor[3] ?? 1;
    out.push({
      mat, geom, alpha,
      factor: surf.factor.slice(0, 3).map(toSRGB),
      tex: await texture(surf),
      vcol: (st.vertexLight || st.faceJitter) && mat !== 'Ink' ? vertexColors(geom, st, box) : null,
      unlit: mat === 'Ink' || mat === 'Face' || !!surf.pbr?.emissive,
    });
  }
  return out;
}

function shadeFn(mode) {
  if (mode === 'toon') return (d) => (d > 0.15 ? 1 : 0.68);
  if (mode === 'flat') return (d) => 0.55 + 0.45 * Math.max(0, d);
  return (d) => 0.42 + 0.58 * Math.max(0, d) ** 0.9;
}

/** rasterize one view into an RGBA buffer of size s x s */
function drawView(gs, view, s, mode, bg) {
  const V = VIEWS[view];
  const eye = new THREE.Vector3(...V.dir).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(...V.up), eye).normalize();
  const up = new THREE.Vector3().crossVectors(eye, right);
  // fit
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const p = new THREE.Vector3();
  for (const g of gs) {
    const pos = g.geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const x = p.dot(right), y = p.dot(up);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const k = (s * 0.86) / Math.max(x1 - x0, y1 - y0, 1e-6);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const img = new Float32Array(s * s * 3);
  for (let i = 0; i < s * s; i++) { img[i * 3] = bg[0]; img[i * 3 + 1] = bg[1]; img[i * 3 + 2] = bg[2]; }
  const zb = new Float32Array(s * s).fill(-Infinity);
  const shade = shadeFn(mode);
  const n = new THREE.Vector3();

  const passes = [gs.filter((g) => g.alpha >= 1), gs.filter((g) => g.alpha < 1)];
  for (const [pass, list] of passes.entries()) {
    for (const g of list) {
      const pos = g.geom.attributes.position, nor = g.geom.attributes.normal, uv = g.geom.attributes.uv;
      const cnt = pos.count;
      const sx = new Float32Array(cnt), sy = new Float32Array(cnt), sz = new Float32Array(cnt), lit = new Float32Array(cnt);
      for (let i = 0; i < cnt; i++) {
        p.fromBufferAttribute(pos, i);
        sx[i] = s / 2 + (p.dot(right) - cx) * k;
        sy[i] = s / 2 - (p.dot(up) - cy) * k;
        sz[i] = p.dot(eye);
        n.fromBufferAttribute(nor, i);
        lit[i] = g.unlit ? 1 : shade(n.dot(LIGHT));
      }
      const idx = g.geom.index ? g.geom.index.array : null;
      const triCount = (idx ? idx.length : cnt) / 3;
      for (let t = 0; t < triCount; t++) {
        const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
        // screen y points down, so counter-clockwise (front-facing) triangles have negative area here
        const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]);
        if (area >= 0) continue;
        const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))), maxX = Math.min(s - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
        const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]))), maxY = Math.min(s - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((sx[b] - px) * (sy[c] - py) - (sx[c] - px) * (sy[b] - py)) / area;
          const w1 = ((sx[c] - px) * (sy[a] - py) - (sx[a] - px) * (sy[c] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
          const o = y * s + x;
          if (z <= zb[o]) continue;
          if (pass === 0) zb[o] = z;
          let r = g.factor[0], gg = g.factor[1], bb = g.factor[2];
          if (g.tex) {
            let u = w0 * uv.getX(a) + w1 * uv.getX(b) + w2 * uv.getX(c);
            let v = 1 - (w0 * uv.getY(a) + w1 * uv.getY(b) + w2 * uv.getY(c));
            u -= Math.floor(u); v -= Math.floor(v);
            const ti = (Math.min(g.tex.h - 1, Math.floor(v * g.tex.h)) * g.tex.w + Math.min(g.tex.w - 1, Math.floor(u * g.tex.w))) * 4;
            r *= g.tex.data[ti] / 255; gg *= g.tex.data[ti + 1] / 255; bb *= g.tex.data[ti + 2] / 255;
          }
          if (g.vcol) {
            r *= toSRGB(w0 * g.vcol[a * 3] + w1 * g.vcol[b * 3] + w2 * g.vcol[c * 3]);
            gg *= toSRGB(w0 * g.vcol[a * 3 + 1] + w1 * g.vcol[b * 3 + 1] + w2 * g.vcol[c * 3 + 1]);
            bb *= toSRGB(w0 * g.vcol[a * 3 + 2] + w1 * g.vcol[b * 3 + 2] + w2 * g.vcol[c * 3 + 2]);
          }
          const l = w0 * lit[a] + w1 * lit[b] + w2 * lit[c];
          const al = g.alpha;
          img[o * 3] = img[o * 3] * (1 - al) + r * l * al;
          img[o * 3 + 1] = img[o * 3 + 1] * (1 - al) + gg * l * al;
          img[o * 3 + 2] = img[o * 3 + 2] * (1 - al) + bb * l * al;
        }
      }
    }
  }
  return img;
}

/**
 * Render a contact sheet of views to a PNG buffer.
 * @param {import('./core.js').Asset} asset built asset (under its style)
 * @param {{views?: string[], size?: number, label?: boolean}} [opts] size = pixels per view
 */
export async function renderAsset(asset, { views = ['side', 'front', 'top', 'iso'], size = 384, label = true } = {}) {
  for (const v of views) if (!VIEWS[v]) throw Object.assign(new Error(`unknown view ${v}`), { code: 'BAD_ARGS', hint: `views: ${Object.keys(VIEWS).join(', ')}` });
  const ss = 2; // supersample
  const gs = await groups(asset);
  const mode = asset.style.viewer ?? 'toon';
  const bg = [0.91, 0.9, 0.88];
  const cols = views.length <= 2 ? views.length : Math.ceil(Math.sqrt(views.length));
  const rows = Math.ceil(views.length / cols);
  const foot = label ? 28 : 0;
  const sheet = createCanvas(cols * size, rows * size + foot);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#e8e6e1'; ctx.fillRect(0, 0, sheet.width, sheet.height);
  for (const [i, view] of views.entries()) {
    const S = size * ss;
    const buf = drawView(gs, view, S, mode, bg);
    const big = createCanvas(S, S);
    const bctx = big.getContext('2d');
    const id = bctx.createImageData(S, S);
    for (let j = 0; j < S * S; j++) {
      id.data[j * 4] = Math.min(255, buf[j * 3] * 255); id.data[j * 4 + 1] = Math.min(255, buf[j * 3 + 1] * 255);
      id.data[j * 4 + 2] = Math.min(255, buf[j * 3 + 2] * 255); id.data[j * 4 + 3] = 255;
    }
    bctx.putImageData(id, 0, 0);
    const x = (i % cols) * size, y = Math.floor(i / cols) * size;
    ctx.drawImage(big, x, y, size, size);
    ctx.strokeStyle = '#c9c6bf'; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    if (label) { ctx.fillStyle = '#5a5650'; ctx.font = '14px sans-serif'; ctx.fillText(view, x + 8, y + 18); }
  }
  if (label) {
    ctx.fillStyle = '#2a2724'; ctx.font = '14px sans-serif';
    ctx.fillText(`${asset.name}  ·  ${asset.style.name}  ·  ${Math.round(asset.tris())} tris`, 8, rows * size + 19);
  }
  return sheet.toBuffer('image/png');
}
