// Tiny static server: serves viewer/ at / and the build output (STYLEMESH_VIEW_DIR, default ./out) at /models/. Port 5177 (or PORT).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const roots = { '/models/': path.resolve(process.env.STYLEMESH_VIEW_DIR ?? 'out'), '/': here };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const port = Number(process.env.PORT) || 5177;

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const prefix = url.startsWith('/models/') ? '/models/' : '/';
  const root = roots[prefix];
  const file = path.resolve(root, '.' + (url.slice(prefix.length - 1) === '/' ? '/index.html' : url.slice(prefix.length - 1)));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`stylemesh viewer: http://localhost:${port}`));
