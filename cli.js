#!/usr/bin/env node
// stylemesh CLI. Built for agents first: every command takes --json and then prints exactly one
// JSON object on stdout ({ok:true,...} or {ok:false,error:{code,message,hint}}); progress goes to stderr.
import fs from 'node:fs';
import path from 'node:path';
import * as api from './lib/api.js';

const HELP = `stylemesh ${api.VERSION}: code-first 3D assets, exported to GLB in any art style

usage: stylemesh <command> [args] [--json] [--assets <file|dir>]...

  list [assets|styles]                  asset names (default) or styles
  inspect <Asset> [--style s]           materials, parts, tris, bounds
  render <Asset> [--style s] [--views side,front,top,iso] [--size 384] [--out file.png]
                                        PNG contact sheet (CPU, no GPU needed). Look at it.
  check [Asset...] [--style s|all]      geometry + convention checks; exit 1 on errors
  build [Asset...] [--style s|a,b|all] [--out dir] [--flat]
                                        write GLBs to <out>/<style>/ (flat: straight into <out>)
  new <Asset> [--file path] [--kind k]  scaffold an asset pack from the template
  view [--dir out] [--port 5177]        browser viewer with style switcher
  mcp                                   MCP server on stdio (tools for agents)

options
  --json            one JSON object on stdout, nothing else
  --assets <path>   asset pack file or folder (repeatable). Default: $STYLEMESH_ASSETS,
                    stylemesh.config.json "assets", then the built-in examples
styles: ${api.listStyles().map((s) => s.id).join(', ')}   (all = every style except roblox)
views: ${api.VIEW_NAMES.join(', ')}
docs: AGENTS.md (authoring guide for agents), README.md`;

/** argv -> {_: positionals, flags} ; repeatable flags collect into arrays */
function parse(argv) {
  const out = { _: [], assets: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { out._.push(t); continue; }
    const [k, inline] = t.slice(2).split('=', 2);
    const val = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    if (k === 'assets') out.assets.push(val); else out[k] = val;
  }
  return out;
}

const a = parse(process.argv.slice(2));
const json = !!a.json;
const [cmd, ...rest] = a._;
const sources = a.assets.length ? a.assets : undefined;
const log = (...m) => { if (!json) console.log(...m); };
const info = (...m) => console.error(...m);
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

function done(result, text) {
  if (json) process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
  else if (text) console.log(text);
}

async function run() {
  switch (cmd) {
    case undefined: case 'help': case '-h': console.log(HELP); return;
    case 'version': return done({ version: api.VERSION }, api.VERSION);

    case 'list': {
      if (rest[0] === 'styles') {
        const styles = api.listStyles();
        return done({ styles }, styles.map((s) => `${s.id.padEnd(8)} ${s.label.padEnd(28)} ${s.blurb ?? ''}`).join('\n'));
      }
      const assets = await api.listAssets({ sources });
      return done({ assets }, assets.map((x) => `${x.name.padEnd(24)} ${String(x.kind ?? '').padEnd(8)} ${x.source}`).join('\n'));
    }

    case 'inspect': {
      const r = await api.inspectAsset({ name: rest[0], style: a.style ?? 'ink', sources });
      return done({ asset: r }, JSON.stringify(r, null, 2));
    }

    case 'render': {
      const name = rest[0];
      const style = a.style ?? 'ink';
      const out = a.out ?? `${name}_${style}.png`;
      const r = await api.renderPreview({ name, style, views: list(a.views), size: a.size ? Number(a.size) : undefined, out, sources });
      delete r.png;
      return done({ render: r }, `${r.file}  (${r.tris} tris, ${r.size.join(' x ')} units)`);
    }

    case 'check': {
      const r = await api.checkAssets({ names: rest, styles: a.style ?? 'ink', sources });
      if (!json) {
        for (const x of r.results) for (const i of x.issues) if (i.level !== 'info' || a.verbose) console.log(`${i.level.padEnd(5)} ${x.name} [${x.style}] ${i.code}: ${i.message}`);
        console.log(`${r.checked} checked, ${r.errors} errors, ${r.warnings} warnings, ${r.infos} notes (--verbose)`);
      } else done({ check: r });
      if (!r.ok) process.exitCode = 1;
      return;
    }

    case 'build': {
      const r = await api.buildAssets({ names: rest, styles: a.style ?? 'ink', out: a.out, flat: !!a.flat, sources });
      return done({ build: r }, r.outputs.map((o) => `${o.style.padEnd(8)} ${String(o.files.length).padStart(3)} assets ${String(o.tris).padStart(8)} tris ${o.seconds.toFixed(1)}s -> ${path.relative(process.cwd(), o.dir) || '.'}`).join('\n'));
    }

    case 'new': {
      const r = api.scaffold({ name: rest[0], file: a.file, kind: a.kind });
      return done({ created: r }, `created ${r.file}\nnext: ${r.next.join('\n      ')}`);
    }

    case 'view': {
      process.env.STYLEMESH_VIEW_DIR = path.resolve(a.dir ?? api.loadConfig().out ?? 'out');
      if (a.port) process.env.PORT = a.port;
      if (!fs.existsSync(path.join(process.env.STYLEMESH_VIEW_DIR, 'catalog.json'))) info(`no catalog.json in ${process.env.STYLEMESH_VIEW_DIR}: run \`stylemesh build --style all\` first`);
      await import('./viewer/serve.js');
      return;
    }

    case 'mcp': { await import('./mcp.js'); return; }

    default: throw api.err('UNKNOWN_COMMAND', `unknown command ${cmd}`, 'run `stylemesh help`');
  }
}

run().catch((e) => {
  const error = { code: e.code ?? 'ERROR', message: e.message, ...(e.hint && { hint: e.hint }) };
  if (json) process.stdout.write(JSON.stringify({ ok: false, error }) + '\n');
  else { console.error(`error: ${e.message}${e.hint ? `\nhint: ${e.hint}` : ''}`); if (!e.code && process.env.DEBUG) console.error(e.stack); }
  process.exitCode = ['BAD_ARGS', 'UNKNOWN_COMMAND'].includes(e.code) ? 2 : 1;
});
