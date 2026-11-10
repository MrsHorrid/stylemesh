// Programmatic API shared by the CLI and the MCP server. Every function returns plain JSON-able
// data and never writes to stdout (the MCP server owns stdout).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { STYLES } from './styles.js';
import { loadFactories, select, make, ROOT } from './registry.js';
import { renderAsset, VIEWS } from './render.js';
import { pbrHint } from './pbr.js';

export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
/** tri budget above which `check` warns (per asset) */
export const TRI_BUDGET = 20000;

export function err(code, message, hint) { return Object.assign(new Error(message), { code, hint }); }

/** read ./stylemesh.config.json if present: { assets: [paths], out: 'dir' } */
export function loadConfig(cwd = process.cwd()) {
  const f = path.join(cwd, 'stylemesh.config.json');
  if (!fs.existsSync(f)) return {};
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { ...c, assets: (c.assets ?? []).map((p) => path.resolve(cwd, p)), out: c.out && path.resolve(cwd, c.out) };
}
/** asset sources: explicit > STYLEMESH_ASSETS env > config > built-in examples */
export function resolveSources(sources) {
  if (sources?.length) return sources;
  if (process.env.STYLEMESH_ASSETS) return process.env.STYLEMESH_ASSETS.split(path.delimiter).filter(Boolean);
  return loadConfig().assets ?? [];
}

/** 'all' = every style except target variants (roblox); also accepts 'ink,flat' */
export function resolveStyles(spec, fallback = 'ink') {
  const raw = Array.isArray(spec) ? spec : String(spec ?? fallback).split(',');
  const list = raw.flatMap((s) => (s.trim() === 'all' ? Object.keys(STYLES).filter((k) => k !== 'roblox') : [s.trim()]));
  for (const s of list) if (!STYLES[s]) throw err('UNKNOWN_STYLE', `unknown style ${s}`, `styles: ${Object.keys(STYLES).join(', ')}, all`);
  return [...new Set(list)];
}

export function listStyles() {
  return Object.entries(STYLES).map(([id, s]) => ({ id, ...s }));
}

export async function listAssets({ sources } = {}) {
  return (await loadFactories(resolveSources(sources))).map(({ name, kind, source }) => ({ name, kind, source }));
}

async function one(name, style, sources) {
  if (!name) throw err('BAD_ARGS', 'asset name required', 'run `stylemesh list` to see asset names');
  const [f] = select(await loadFactories(resolveSources(sources)), [name]);
  resolveStyles(style);
  return make(f, style);
}

const round = (v) => +v.toFixed(3);

function summarize(a) {
  const box = a.bounds();
  const size = box.getSize(new THREE.Vector3());
  return {
    name: a.name, style: a.style.name, meta: a.meta,
    tris: Math.round(a.tris()),
    size: size.toArray().map(round),
    bounds: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
  };
}

export async function inspectAsset({ name, style = 'ink', sources } = {}) {
  const a = await one(name, style, sources);
  const used = new Set(a.merged().map((m) => m.mat));
  return {
    ...summarize(a),
    parts: a.merged().map(({ mat, geom }) => ({ material: mat, tris: geom.attributes.position.count / 3 })),
    materials: [...a.mats].map(([n, d]) => ({
      name: n,
      ...(d.color && { color: d.color }), ...(d.tint && { tint: d.tint }),
      painter: d.paint ? (d.paint.surface ?? 'custom') : null,
      used: used.has(n) || (n === 'Ink' && a.hulls.length > 0),
      ...(a.style.paint === 'pbr' && { pbr: pbrHint(n, d) }),
    })),
    tints: a.tints(),
  };
}

/** geometry + convention checks for one built asset */
function checkOne(a) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });
  let degenerate = 0, total = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (const { mat, geom } of a.merged()) {
    const pos = geom.attributes.position.array;
    if (pos.some((v) => !Number.isFinite(v))) add('error', 'NAN_POSITION', `${mat}: non-finite vertex positions`);
    if (!geom.attributes.uv) add('error', 'NO_UV', `${mat}: missing UVs`);
    for (let i = 0; i + 8 < pos.length; i += 9) {
      A.fromArray(pos, i); B.fromArray(pos, i + 3); C.fromArray(pos, i + 6);
      total++;
      if (B.sub(A).cross(C.sub(A)).lengthSq() < 1e-14) degenerate++;
    }
  }
  if (total && degenerate / total > 0.25) add('warn', 'DEGENERATE_TRIS', `${((degenerate / total) * 100).toFixed(1)}% zero-area triangles`);
  const tris = a.tris();
  if (tris > TRI_BUDGET) add('warn', 'TRI_BUDGET', `${Math.round(tris)} tris > budget ${TRI_BUDGET}`);
  const size = a.bounds().getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest < 0.05 || longest > 200) add('warn', 'SCALE', `longest side ${longest.toFixed(3)} units (convention: 1 unit ~ 1 stud/metre)`);
  for (const [n, list] of a.groups) if (!list.length && n !== 'Ink') add('info', 'UNUSED_MATERIAL', `material ${n} has no geometry`);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(a.name)) add('warn', 'NAME', `asset name "${a.name}" should be [A-Za-z0-9_] (it becomes a file name)`);
  return issues;
}

export async function checkAssets({ names, styles = 'ink', sources } = {}) {
  const factories = select(await loadFactories(resolveSources(sources)), names);
  const results = [];
  for (const style of resolveStyles(styles)) {
    for (const f of factories) {
      let issues;
      try { issues = checkOne(make(f, style)); } catch (e) { issues = [{ level: 'error', code: 'BUILD_FAILED', message: e.message }]; }
      results.push({ name: f.name, style, issues });
    }
  }
  const errors = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0);
  const warnings = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'warn').length, 0);
  const infos = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'info').length, 0);
  return { ok: errors === 0, errors, warnings, infos, results: results.filter((r) => r.issues.length), checked: results.length };
}

/**
 * Write GLBs. Layout: <out>/<style>/<Asset>.glb + index.json, and <out>/catalog.json for the viewer.
 * flat: write straight into <out> (one style only), the layout a game import folder wants.
 */
export async function buildAssets({ names, styles = 'ink', out, flat = false, sources } = {}) {
  out = path.resolve(out ?? loadConfig().out ?? 'out');
  const list = resolveStyles(styles);
  if (flat && list.length > 1) throw err('BAD_ARGS', '--flat writes one style only', 'pass a single --style');
  const factories = select(await loadFactories(resolveSources(sources)), names);
  const outputs = [];
  for (const style of list) {
    const dir = flat ? out : path.join(out, style);
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const index = [];
    for (const f of factories) {
      const a = make(f, style);
      const file = path.join(dir, a.name + '.glb');
      await a.writeGLB(file);
      index.push({ ...summarize(a), file: a.name + '.glb', tints: a.style.bakeTint ? {} : a.tints(), parts: a.merged().map((m) => m.mat) });
    }
    // merge into an existing index so building a subset keeps the rest
    const idxFile = path.join(dir, 'index.json');
    const prev = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')).filter((e) => !index.some((n) => n.name === e.name)) : [];
    const merged = [...prev, ...index].sort((x, y) => x.name.localeCompare(y.name));
    fs.writeFileSync(idxFile, JSON.stringify(merged, null, 2));
    outputs.push({ style, dir, files: index.map((e) => path.join(dir, e.file)), tris: index.reduce((s, e) => s + e.tris, 0), seconds: (Date.now() - t0) / 1000 });
  }
  writeCatalog(out);
  return { out, outputs };
}

/** catalog.json: every style folder (or flat root) under out that has an index.json */
export function writeCatalog(out) {
  const entries = [];
  const style = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))[0]?.style; } catch { return null; } };
  const root = style(out);
  if (root && STYLES[root]) entries.push({ id: root, ...STYLES[root], dir: '' });
  for (const d of Object.keys(STYLES)) {
    const s = path.join(out, d);
    if (fs.existsSync(path.join(s, 'index.json'))) entries.push({ id: d, ...STYLES[d], dir: d + '/' });
  }
  fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(entries, null, 2));
  return entries;
}

/** render a PNG contact sheet; writes it when `out` is given. Returns {png: Buffer, file?, ...summary} */
export async function renderPreview({ name, style = 'ink', views, size, out, sources } = {}) {
  const a = await one(name, style, sources);
  const png = await renderAsset(a, { views, size });
  let file;
  if (out) { file = path.resolve(out); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, png); }
  return { png, file, ...summarize(a), views: views ?? ['side', 'front', 'top', 'iso'] };
}

export const VIEW_NAMES = Object.keys(VIEWS);

/** new asset pack from the template */
export function scaffold({ name, file, kind = 'prop' } = {}) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name ?? '')) throw err('BAD_ARGS', 'asset name must match [A-Za-z][A-Za-z0-9_]*', 'e.g. stylemesh new Prop_Lantern');
  file = path.resolve(file ?? path.join('assets', name + '.js'));
  if (fs.existsSync(file)) throw err('EXISTS', `${file} already exists`, 'pick another --file or edit the existing pack');
  const fn = name.replace(/^[A-Z][a-z]*_/, '').replace(/^./, (c) => c.toLowerCase());
  const lib = path.relative(path.dirname(file), path.join(ROOT, 'lib')).split(path.sep).join('/');
  const src = fs.readFileSync(path.join(ROOT, 'templates', 'asset.js'), 'utf8')
    .replaceAll('__LIB__', lib.startsWith('.') ? lib : './' + lib).replaceAll('__NAME__', name).replaceAll('__FN__', fn).replaceAll('__KIND__', kind);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, src);
  return { file, name, next: [`stylemesh render ${name} --assets ${path.relative(process.cwd(), file)} --out ${name}.png`] };
}
