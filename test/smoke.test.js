// Every example asset must build, pass checks and render in every style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as api from '../lib/api.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stylemesh-'));
const cli = (...args) => JSON.parse(execFileSync(process.execPath, ['cli.js', ...args, '--json'], { encoding: 'utf8' }));

test('examples load', async () => {
  const assets = await api.listAssets();
  assert.equal(assets.length, 30);
  assert.ok(assets.every((a) => /^[A-Za-z][A-Za-z0-9_]*$/.test(a.name)));
});

test('check passes in every style', async () => {
  const r = await api.checkAssets({ styles: 'all,roblox' });
  assert.equal(r.errors, 0, JSON.stringify(r.results.filter((x) => x.issues.some((i) => i.level === 'error')), null, 2));
});

test('build writes GLBs, index and catalog', async () => {
  const r = await api.buildAssets({ names: ['Fish_Guppling', 'Prop_Barrel'], styles: 'ink,voxel,pbr', out: tmp });
  for (const o of r.outputs) for (const f of o.files) assert.ok(fs.statSync(f).size > 1000, f);
  const cat = JSON.parse(fs.readFileSync(path.join(tmp, 'catalog.json'), 'utf8'));
  assert.deepEqual(cat.map((c) => c.id), ['ink', 'voxel', 'pbr']);
});

test('render returns a PNG', async () => {
  const r = await api.renderPreview({ name: 'Fish_ClackyCrab', style: 'ink', size: 96 });
  assert.equal(r.png.subarray(1, 4).toString(), 'PNG');
});

test('cli: json envelope and errors', () => {
  assert.equal(cli('list').ok, true);
  let out;
  try { execFileSync(process.execPath, ['cli.js', 'inspect', 'Nope', '--json'], { encoding: 'utf8' }); } catch (e) { out = JSON.parse(e.stdout); assert.equal(e.status, 1); }
  assert.equal(out.error.code, 'UNKNOWN_ASSET');
});

test('new + render a scaffolded asset', () => {
  const file = path.join(tmp, 'packs', 'Prop_Test.js');
  cli('new', 'Prop_Test', '--file', file);
  const r = cli('render', 'Prop_Test', '--assets', file, '--size', '64', '--out', path.join(tmp, 't.png'));
  assert.ok(r.render.tris > 100);
});

test('mcp: initialize, list, call', () => {
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'render_asset', arguments: { name: 'Prop_Rock', views: ['iso'], size: 64 } } },
  ];
  const out = execFileSync(process.execPath, ['cli.js', 'mcp'], { input: msgs.map((m) => JSON.stringify(m)).join('\n') + '\n', encoding: 'utf8' })
    .trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(out.length, 3);
  assert.equal(out[0].result.serverInfo.name, 'stylemesh');
  assert.ok(out[1].result.tools.some((t) => t.name === 'render_asset'));
  assert.equal(out[2].result.content[0].type, 'image');
});
