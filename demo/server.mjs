import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp' };

export function startDemoServer(port = 5191) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname === '/demo/' ? '/demo/index.html' : url.pathname;
    if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Engine tests</title>'); return; }
    if (!/^\/(?:src\/[a-z-]+\.js|demo\/(?:index\.html|app\.js|style\.css)|assets\/demo-original\.webp)$/.test(pathname)) { response.writeHead(404); response.end(); return; }
    try {
      const body = await readFile(path.join(root, pathname));
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(pathname)], 'X-Content-Type-Options': 'nosniff' });
      response.end(body);
    } catch { response.writeHead(404); response.end(); }
  }).listen(port, '127.0.0.1');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 5191;
  startDemoServer(port);
  console.log(`Demo: http://127.0.0.1:${port}/demo/`);
}
