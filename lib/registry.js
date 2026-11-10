// Asset discovery. An asset pack is any ES module that exports asset factories:
//   export default [fishA, fishB]      (preferred)
//   export const ASSETS = [...]        (also fine)
//   or plain `export function x()`    (every exported function that returns an Asset counts)
// A factory takes no arguments and returns an Asset built under the active style.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Asset } from './core.js';
import { setStyle, getStyle } from './styles.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUILTIN_PACKS = [path.join(ROOT, 'examples', 'reelraiders', 'fish.js'), path.join(ROOT, 'examples', 'reelraiders', 'props.js')];

/** expand files and directories into .js module paths */
function expand(sources) {
  const out = [];
  for (const s of sources) {
    const p = path.resolve(s);
    if (!fs.existsSync(p)) throw Object.assign(new Error(`asset source not found: ${s}`), { code: 'SOURCE_NOT_FOUND' });
    if (fs.statSync(p).isDirectory()) out.push(...fs.readdirSync(p).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(p, f)));
    else out.push(p);
  }
  return out;
}

/**
 * Load factories from packs. Returns [{name, make, source}] (name = Asset name, unique).
 * @param {string[]} [sources] files or folders; default = built-in example packs
 */
export async function loadFactories(sources) {
  const files = expand(sources?.length ? sources : BUILTIN_PACKS);
  const prev = getStyle().name;
  setStyle('ink'); // probe under a cheap style
  const found = new Map();
  try {
    for (const file of files) {
      // cache-bust so an agent editing a pack sees its change in a long-lived MCP server
      const mod = await import(pathToFileURL(file).href + '?t=' + fs.statSync(file).mtimeMs);
      const list = Array.isArray(mod.default) ? mod.default : Array.isArray(mod.ASSETS) ? mod.ASSETS
        : Object.values(mod).filter((v) => typeof v === 'function' && !Array.isArray(v));
      const explicit = Array.isArray(mod.default) || Array.isArray(mod.ASSETS);
      for (const make of list) {
        let a;
        try { a = make(); } catch (e) {
          if (explicit) throw Object.assign(new Error(`${path.basename(file)}: ${make.name || 'factory'} threw: ${e.message}`), { code: 'ASSET_ERROR', cause: e });
          continue; // helper export with required args, not an asset
        }
        if (!(a instanceof Asset)) continue;
        if (found.has(a.name)) throw Object.assign(new Error(`duplicate asset name ${a.name} (${file})`), { code: 'DUPLICATE_ASSET' });
        found.set(a.name, { name: a.name, make, source: path.relative(process.cwd(), file) || file, kind: a.meta.kind ?? null });
      }
    }
  } finally { setStyle(prev); }
  return [...found.values()];
}

/** pick factories by exact name; throws with a hint listing near matches */
export function select(factories, names) {
  if (!names?.length) return factories;
  return names.map((n) => {
    const f = factories.find((x) => x.name === n);
    if (f) return f;
    const near = factories.filter((x) => x.name.toLowerCase().includes(n.toLowerCase().replace(/^(fish|prop)_/, ''))).map((x) => x.name);
    throw Object.assign(new Error(`unknown asset ${n}`), { code: 'UNKNOWN_ASSET', hint: near.length ? `did you mean ${near.join(', ')}?` : 'run `stylemesh list` to see asset names' });
  });
}

/** build one asset under a style */
export function make(factory, style) { setStyle(style); return factory.make(); }
