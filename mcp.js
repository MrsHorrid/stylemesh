// stylemesh MCP server: JSON-RPC 2.0 over stdio, newline-delimited (Model Context Protocol).
// No SDK dependency. stdout carries protocol messages only; diagnostics go to stderr.
//   claude mcp add stylemesh -- node /path/to/stylemesh/cli.js mcp
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import * as api from './lib/api.js';
import { ROOT } from './lib/registry.js';

const sourcesProp = { type: 'array', items: { type: 'string' }, description: 'asset pack files or folders (default: $STYLEMESH_ASSETS, stylemesh.config.json, built-in examples)' };
const styleProp = { type: 'string', description: `style id: ${api.listStyles().map((s) => s.id).join(', ')}`, default: 'ink' };
const namesProp = { type: 'array', items: { type: 'string' }, description: 'asset names (empty = all)' };

const TOOLS = [
  {
    name: 'guide', description: 'Authoring guide: conventions, shapes, painters, materials, styles and the edit-render-check loop. Read once before writing assets.',
    inputSchema: { type: 'object', properties: {} },
    run: () => text(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')),
  },
  {
    name: 'list_assets', description: 'List asset names, kinds and the pack file each comes from.',
    inputSchema: { type: 'object', properties: { sources: sourcesProp } },
    run: async ({ sources }) => json(await api.listAssets({ sources })),
  },
  {
    name: 'list_styles', description: 'List art styles and their knobs.',
    inputSchema: { type: 'object', properties: {} },
    run: () => json(api.listStyles()),
  },
  {
    name: 'inspect_asset', description: 'Materials (colour, tint, painter, PBR hint), parts, triangle count and bounds of one asset under a style.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, style: styleProp, sources: sourcesProp }, required: ['name'] },
    run: async (a) => json(await api.inspectAsset(a)),
  },
  {
    name: 'render_asset', description: 'Render a PNG contact sheet of the asset (side/front/top/iso by default) and return it as an image. Use after every edit to see the result.',
    inputSchema: {
      type: 'object', required: ['name'],
      properties: {
        name: { type: 'string' }, style: styleProp, sources: sourcesProp,
        views: { type: 'array', items: { type: 'string', enum: api.VIEW_NAMES } },
        size: { type: 'number', description: 'pixels per view (default 384)' },
        out: { type: 'string', description: 'also save the PNG here' },
      },
    },
    run: async (a) => {
      const r = await api.renderPreview(a);
      const { png, ...meta } = r;
      return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }, { type: 'text', text: JSON.stringify(meta) }] };
    },
  },
  {
    name: 'check_assets', description: 'Validate geometry and conventions (NaN, missing UVs, degenerate tris, tri budget, scale, unused materials, names). ok=false means errors.',
    inputSchema: { type: 'object', properties: { names: namesProp, styles: { type: 'string', description: 'style, comma list or "all"', default: 'ink' }, sources: sourcesProp } },
    run: async (a) => json(await api.checkAssets(a)),
  },
  {
    name: 'build_assets', description: 'Export GLBs to <out>/<style>/ (or straight into <out> with flat=true) plus index.json and catalog.json.',
    inputSchema: {
      type: 'object',
      properties: {
        names: namesProp, styles: { type: 'string', description: 'style, comma list or "all"', default: 'ink' },
        out: { type: 'string', description: 'output folder (default ./out)' }, flat: { type: 'boolean' }, sources: sourcesProp,
      },
    },
    run: async (a) => json(await api.buildAssets(a)),
  },
  {
    name: 'new_asset', description: 'Scaffold a new asset pack file from the template. Then edit it and call render_asset.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: 'e.g. Prop_Lantern' }, file: { type: 'string' }, kind: { type: 'string' } } },
    run: (a) => json(api.scaffold(a)),
  },
];

function text(t) { return { content: [{ type: 'text', text: t }] }; }
function json(v) { return text(JSON.stringify(v, null, 2)); }

const INSTRUCTIONS = 'stylemesh turns short JavaScript asset files into GLB models in many art styles. '
  + 'Loop: guide (once) -> new_asset or edit a pack file -> render_asset (look at the image) -> check_assets -> build_assets.';

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'stylemesh', version: api.VERSION }, instructions: INSTRUCTIONS };
    case 'ping': return {};
    case 'tools/list': return { tools: TOOLS.map(({ run, ...t }) => t) };
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) throw Object.assign(new Error(`unknown tool ${params?.name}`), { rpc: -32602 });
      try { return await tool.run(params.arguments ?? {}); } catch (e) {
        // tool errors go back to the model as content, so it can fix its call
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: e.code ?? 'ERROR', message: e.message, ...(e.hint && { hint: e.hint }) }) }] };
      }
    }
    default:
      if (id === undefined) return undefined; // notification
      throw Object.assign(new Error(`method not found: ${method}`), { rpc: -32601 });
  }
}

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
let queue = Promise.resolve(); // serialize calls: the active style is process-global
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  queue = queue.then(async () => {
    try {
      const result = await handle(msg);
      if (msg.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: msg.id, result });
    } catch (e) {
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: e.rpc ?? -32603, message: e.message } });
    }
  });
});
console.error(`stylemesh MCP ${api.VERSION} ready (stdio)`);
