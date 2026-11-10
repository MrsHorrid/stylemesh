// Canvas painters. Fish painters are light/greyscale so Roblox can tint them per fish
// (SurfaceAppearance.Color multiplies the texture). Prop painters are full colour.

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const mix = (a, b, t) => a + (b - a) * t;
function grey(v, a = 1) { const c = Math.round(v * 255); return `rgba(${c},${c},${c},${a})`; }
function shade(hex, k) { // k<1 darker, >1 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(k > 1 ? c + (255 - c) * (k - 1) : c * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
/** tag a painter with its PBR surface kind (see lib/pbr.js) */
const kind = (surface, fn) => Object.assign(fn, { surface });

function speckle(ctx, w, h, n, colorFn, rMax, seed = 7) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { ctx.fillStyle = colorFn(r()); ctx.beginPath(); ctx.arc(r() * w, r() * h, 1 + r() * rMax, 0, Math.PI * 2); ctx.fill(); }
}

/** fish body: u = around (x), v = along (y). Darker back, white belly, optional pattern. */
export function fishBody(pattern = 'scales', seed = 1) {
  return kind('scales', (ctx, w, h) => {
    // around-gradient: top (u=.25) darker, belly (u=.75) white
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, grey(0.86)); g.addColorStop(0.25, grey(0.72)); g.addColorStop(0.5, grey(0.86));
    g.addColorStop(0.68, grey(1)); g.addColorStop(0.82, grey(1)); g.addColorStop(1, grey(0.86));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(seed);
    if (pattern === 'scales') {
      ctx.strokeStyle = grey(0.55, 0.35); ctx.lineWidth = 2.5;
      const s = w / 16;
      for (let y = 0; y < h * 0.8; y += s * 0.7)
        for (let x = 0; x < w; x += s) {
          const off = (Math.round(y / (s * 0.7)) % 2) * s / 2;
          if (x > w * 0.55 && x < w * 0.95) continue; // clean belly
          ctx.beginPath(); ctx.arc(x + off, y + h * 0.12, s / 2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }
    } else if (pattern === 'stripes') {
      for (let i = 0; i < 4; i++) {
        const y = h * (0.2 + i * 0.17);
        ctx.fillStyle = grey(0.42, 0.85);
        ctx.beginPath(); ctx.ellipse(w * 0.25, y, w * 0.32, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 1.25, y, w * 0.32, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-w * 0.75, y, w * 0.32, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (pattern === 'spots') {
      for (let i = 0; i < 40; i++) {
        const x = r() * w; if (x > w * 0.6 && x < w * 0.9) continue;
        ctx.fillStyle = grey(0.5, 0.7);
        ctx.beginPath(); ctx.arc(x, r() * h * 0.85 + h * 0.05, 6 + r() * 14, 0, Math.PI * 2); ctx.fill();
      }
    } else if (pattern === 'bands') { // rings along length (eel)
      for (let i = 0; i < 9; i++) { ctx.fillStyle = grey(0.55, 0.6); ctx.fillRect(0, h * (0.08 + i * 0.1), w, h * 0.035); }
    }
    // soft painterly noise
    speckle(ctx, w, h, 500, (t) => grey(t > 0.5 ? 1 : 0.6, 0.07), 3, seed + 3);
  });
}

/** fin: light with darker rays */
export function finRays(rays = 9) {
  return kind('fin', (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, grey(1)); g.addColorStop(1, grey(0.78));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = grey(0.55, 0.5); ctx.lineWidth = 3;
    for (let i = 0; i <= rays; i++) {
      ctx.beginPath(); ctx.moveTo(w, h / 2); ctx.lineTo(0, (i / rays) * h); ctx.stroke();
    }
  });
}

/** soft solid with gentle noise (props) */
export function solid(hex, seed = 3, noise = 0.06) {
  return kind('plastic', (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(hex, 1.06)); g.addColorStop(1, shade(hex, 0.92));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 400, (t) => (t > 0.5 ? `rgba(255,255,255,${noise})` : `rgba(0,0,0,${noise})`), 3, seed);
  });
}

/** warm wood planks like the shorts' floors. planks run along u (x). */
export function woodPlanks(base = '#a8683a', planks = 6, seed = 11) {
  return kind('wood', (ctx, w, h) => {
    const r = rng(seed);
    const ph = h / planks;
    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = shade(base, mix(0.82, 1.1, r()));
      ctx.fillRect(0, i * ph, w, ph);
      ctx.strokeStyle = shade(base, 0.7); ctx.globalAlpha = 0.25; ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const y = i * ph + ph * (0.2 + 0.6 * r());
        ctx.beginPath(); ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.7, y + (r() - 0.5) * 6, w, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(base, 0.45); ctx.fillRect(0, i * ph, w, 3); // gap line
      const cut = r() * w; ctx.fillRect(cut, i * ph, 3, ph); // butt joint
    }
  });
}

export function stripes(c1, c2, n = 8, vertical = false) {
  return kind('plastic', (ctx, w, h) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? c2 : c1;
      if (vertical) ctx.fillRect((i * w) / n, 0, w / n + 1, h); else ctx.fillRect(0, (i * h) / n, w, h / n + 1);
    }
    speckle(ctx, w, h, 300, (t) => `rgba(0,0,0,${t * 0.05})`, 3, 5);
  });
}

export function sandSpeckle(base = '#e9d3a0') {
  return kind('sand', (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1400, (t) => (t > 0.5 ? shade(base, 0.82) : shade(base, 1.08)), 2.5, 9);
  });
}

/** sign with text (shop / name plates) */
export function sign(text, bg = '#f4d35e', fg = '#2a1d14') {
  return Object.assign((ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = shade(bg, 0.6); ctx.lineWidth = w * 0.03; ctx.strokeRect(w * 0.03, h * 0.03, w * 0.94, h * 0.94);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = h * 0.42; ctx.font = `bold ${size}px sans-serif`;
    while (ctx.measureText(text).width > w * 0.85 && size > 8) { size -= 2; ctx.font = `bold ${size}px sans-serif`; }
    ctx.fillText(text, w / 2, h / 2);
  }, { isText: true, surface: 'paint' });
}

// ---------------------------------------------------------------- style filters (applied after a painter)

/** Hand-painted MMO look: punchier colour, then hundreds of soft brush strokes sampled from the image itself. */
export function paintedFilter(ctx, w, h, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    for (let k = 0; k < 3; k++) {
      let v = l + (d[i + k] - l) * 1.25; // saturation
      v = (v - 128) * 1.1 + 128 + 8; // contrast + lift (vertex light darkens later)
      d[i + k] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(img, 0, 0);
  const src = ctx.getImageData(0, 0, w, h).data;
  const r = rng(seed * 31 + 7);
  const strokes = Math.round((w * h) / 520);
  ctx.lineCap = 'round';
  for (let s = 0; s < strokes; s++) {
    const x = r() * w, y = r() * h;
    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
    const k = r() < 0.5 ? 0.72 + r() * 0.12 : 1.12 + r() * 0.14; // darker or lighter dab
    const c = [src[i], src[i + 1], src[i + 2]].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + r() * 0.3})`;
    ctx.lineWidth = 4 + r() * (w / 32);
    const len = w / 40 + r() * (w / 14), ang = (r() - 0.5) * 0.9; // mostly horizontal strokes
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + (r() - 0.5) * 6, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
}

/** Clay: flat base colour with soft fingerprint-ish grain. */
export function clayGrain(ctx, w, h, hex, seed = 1) {
  ctx.fillStyle = hex; ctx.fillRect(0, 0, w, h);
  const r = rng(seed * 13 + 5);
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1 + r() * 1.5;
    ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 9, r() * 6.28, r() * 6.28 + 1.5 + r() * 2); ctx.stroke();
  }
}
