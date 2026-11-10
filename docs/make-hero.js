// Regenerate docs/hero.png: the same assets in every style. node docs/make-hero.js
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadFactories, select, make } from '../lib/registry.js';
import { renderAsset } from '../lib/render.js';

const ASSETS = ['Fish_ChompShark', 'Prop_Boat', 'Fish_ClackyCrab', 'Prop_Lighthouse'];
const STYLES = ['ink', 'flat', 'painted', 'voxel', 'clay', 'pbr'];
const S = 220, L = 90;
const f = select(await loadFactories(), ASSETS);
const cv = createCanvas(L + S * ASSETS.length, S * STYLES.length);
const ctx = cv.getContext('2d');
ctx.fillStyle = '#e8e6e1'; ctx.fillRect(0, 0, cv.width, cv.height);
for (const [r, style] of STYLES.entries()) {
  ctx.fillStyle = '#2a2724'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(style, 12, r * S + S / 2 + 6);
  for (const [c, fac] of f.entries()) {
    const img = await loadImage(await renderAsset(make(fac, style), { views: ['iso'], size: S, label: false }));
    ctx.drawImage(img, L + c * S, r * S);
  }
}
fs.writeFileSync(new URL('./hero.png', import.meta.url), cv.toBuffer('image/png'));
